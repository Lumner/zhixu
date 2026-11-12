"""Verify actual complete programs extracted from chapters 17-20 and batch 05.
No ordinary-variable data races, permanent-deadlock demos, or sleep-based ordering.
Fault wrappers are linked only into temporary executables; timeouts clean owned groups.
"""
from pathlib import Path
import errno
import itertools
import json
import os
import platform
import re
import shutil
import signal
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
checks = []
programs = {}


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)


if platform.system() != "Linux":
    raise SystemExit("Run inside Linux/WSL Ubuntu.")
for doc in [next(SOURCE.glob(f"{n:02d}-*.md")) for n in range(17, 21)] + [SOURCE / "详写第五批-练习与参考答案.md"]:
    text = doc.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
    for filename, code in re.findall(r"\*\*完整程序：([^*]+)\*\*\s*```c\n(.*?)\n```", text, re.S):
        check("unique teaching program " + filename, filename not in programs)
        programs[filename] = code
check("14 complete teaching programs extracted", len(programs) == 14)
for name in ["threads", "mutex", "queue"]:
    programs[name + ".c"] = (SOURCE / "示例代码" / (name + ".c")).read_text(encoding="utf-8-sig")

with tempfile.TemporaryDirectory(prefix="os-detailed-batch05-") as temporary:
    root = Path(temporary) / "learner workspace"
    root.mkdir()
    shutil.copy(SOURCE / "示例代码/lab.h", root / "lab.h")
    shutil.copy(HERE / "thread-faults.c", root / "thread-faults.c")
    flags = ["gcc", "-std=c17", "-D_POSIX_C_SOURCE=200809L", "-Wall", "-Wextra", "-Wpedantic", "-Werror", "-g", "-pthread"]
    wraps = ["pthread_create", "pthread_join", "pthread_cond_wait", "pthread_cond_broadcast",
             "pthread_mutex_destroy", "pthread_cond_destroy", "sem_wait", "sem_init", "sem_destroy", "malloc", "free"]

    def compile_program(name, code, fault=False, extra=()):
        file = root / (name + ".c")
        file.write_text(code, encoding="utf-8")
        target = root / name
        command = flags + list(extra) + [str(file)]
        if fault:
            command += [str(root / "thread-faults.c"), *["-Wl,--wrap=" + item for item in wraps]]
        result = subprocess.run(command + ["-o", str(target)], cwd=root, text=True, capture_output=True, timeout=30)
        if result.returncode:
            print(result.stderr)
        check("compile " + name, result.returncode == 0)
        check("warning free " + name, not result.stderr)
        return target

    targets = {Path(name).stem: compile_program(Path(name).stem, code) for name, code in programs.items()}
    fault_names = ["thread-batch", "thread-return", "cond-latch", "semaphore-credit", "sem-channel", "queue", "ring-queue"]
    for name in fault_names:
        targets[name + "-faults"] = compile_program(name + "-faults", programs[name + ".c"], fault=True)

    def finish(process, timeout=10):
        try:
            out, err = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
            raise AssertionError("timeout cleaned owned group: " + str(process.args))
        return subprocess.CompletedProcess(process.args, process.returncode, out, err)

    def run(name, args=(), status=0, output=None, env=None):
        process = subprocess.Popen([str(targets[name]), *map(str, args)], cwd=root, text=True,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True,
                                   env={**os.environ, "LC_ALL":"C", **(env or {})})
        result = finish(process)
        check("exit " + name + "=" + str(status), result.returncode == status)
        if output is not None:
            check("stdout " + name, result.stdout == output)
        check("no unbalanced audited resources " + name, "LAB_UNBALANCED" not in result.stderr)
        return result

    expected = {
        "thread-once":"result=42\n", "thread-batch":"results=20,60,120\n", "thread-return":"square=49\n",
        "thread-local":"main_local=99 worker0=0->1 worker1=0->2\n", "threads":"results=20,40\n",
        "mutex":"counter=20000\n", "locked-pair":"total=200 nonnegative=1\n",
        "atomic-counter":"atomic_counter=20000\n", "atomic-split":"split_result=1\n",
        "cond-latch":"result=42\n", "queue":"sum=15\n",
        "semaphore-credit":"credit_consumed=1\nempty=would_block\n", "sem-channel":"sum=15\n",
        "ordered-transfer":"balances=100000,100000 total=200000\n", "trylock-probe":"busy=1\n",
        "deadlock-model":"opposite_order_cycle=1\nordered_state_cycle=0\n", "ring-queue":"items=20 total=210\n",
    }
    for name, output in expected.items():
        run(name, output=output)
    for attempt in range(20):
        for name in ["mutex", "atomic-counter", "atomic-split", "queue", "sem-channel", "ordered-transfer"]:
            run(name, output=expected[name])

    audit = {"OS_LAB_AUDIT":"1"}
    for fail_at in [1, 2, 3]:
        r = run("thread-batch-faults", status=1, output="", env={**audit,"OS_LAB_CREATE_FAIL":str(fail_at)})
        check("pthread direct error ignores stale errno " + str(fail_at), os.strerror(errno.EAGAIN) in r.stderr and os.strerror(errno.EBADF) not in r.stderr)
        check("partial creation joined " + str(fail_at), f"created={fail_at-1} joined={fail_at-1}" in r.stderr)
    run("thread-batch-faults", output=expected["thread-batch"], env=audit)
    r = run("thread-return-faults", output=expected["thread-return"], env=audit)
    check("heap result transferred and freed", "live=0" in r.stderr and "created=1 joined=1" in r.stderr)
    r = run("thread-return-faults", status=1, output="", env={**audit,"OS_LAB_ALLOC_FAIL":"1"})
    check("worker allocation failure explained", "could not allocate" in r.stderr)
    for name in ["semaphore-credit", "sem-channel"]:
        r = run(name + "-faults", output=expected[name], env={**audit,"OS_LAB_SEM_EINTR":"1"})
        count = 1 if name == "semaphore-credit" else 2
        check("semaphore lifetime " + name, f"sem_init={count} sem_destroy={count}" in r.stderr)
    run("cond-latch-faults", output=expected["cond-latch"], env={**audit,"OS_LAB_SPURIOUS":"1"})
    run("queue-faults", output=expected["queue"], env={**audit,"OS_LAB_SPURIOUS":"1"})

    # Deterministic last-item state from the actual queue consumer, no producer running.
    queue_code = programs["queue.c"]
    prefix = queue_code.split("int main(void) {")[0]
    for label, initial, output in [("last", "slot=5;full=1;done=1;", "sum=5\n"),
                                    ("empty", "slot=0;full=0;done=1;", "sum=0\n")]:
        driver = '''int main(void) {
    (void)producer;
    INITIAL
    pthread_t c;
    thread_check(pthread_create(&c,NULL,consumer,NULL),"create");
    thread_check(pthread_join(c,NULL),"join");
    printf("sum=%d\\n",total);
    thread_check(pthread_cond_destroy(&changed),"destroy condition");
    thread_check(pthread_mutex_destroy(&lock),"destroy mutex");
    return 0;
}
'''.replace("INITIAL", initial)
        name = "queue-closed-" + label
        targets[name] = compile_program(name, prefix + driver)
        run(name, output=output)

    # Exercise declared modifications, without introducing any non-atomic race.
    variants = [
        ("counter-fourteen", programs["atomic-counter.c"].replace("i < 10000", "i < 7"), "atomic_counter=14\n"),
        ("transfer-one-way", programs["ordered-transfer.c"].replace("{{0, 1}, {1, 0}}", "{{0, 1}, {0, 1}}"), "balances=80000,120000 total=200000\n"),
        ("transfer-self", programs["ordered-transfer.c"].replace("{{0, 1}, {1, 0}}", "{{0, 0}, {1, 1}}"), "balances=100000,100000 total=200000\n"),
    ]
    for name, code, output in variants:
        targets[name] = compile_program(name, code)
        run(name, output=output)

    for n in [0, 1, 4, 5, 20, 123, 10000]:
        run("ring-queue", [n], output=f"items={n} total={n*(n+1)//2}\n")
    for bad in ["-1", "10001", "two", "2x", "", "999999999999999999999999999999999999"]:
        r = run("ring-queue", [bad], status=2, output="")
        check("invalid count explained " + bad, bool(r.stderr))
    run("ring-queue", [1, 2], status=2)
    for fail_at in [1, 2]:
        settings = {**audit,"OS_LAB_CREATE_FAIL":str(fail_at)}
        if fail_at == 2:
            settings["OS_LAB_GATE_SECOND"] = "1"
        r = run("ring-queue-faults", [123], status=1, output="", env=settings)
        check("ring partial workers joined " + str(fail_at), f"created={fail_at-1} joined={fail_at-1}" in r.stderr)
        check("ring synchronization objects destroyed " + str(fail_at), "mutex_destroy=1 cond_destroy=2" in r.stderr)
        if fail_at == 2:
            check("consumer reached wait before injected second-create failure", "reached_wait=1" in r.stderr)
    r = run("ring-queue-faults", [123], output="items=123 total=7626\n",
            env={**audit,"OS_LAB_SPURIOUS":"1","OS_LAB_GATE_SECOND":"1"})
    match = re.search(r"injected=(\d+)", r.stderr)
    check("simulated successful waits really injected", bool(match) and int(match[1]) >= 3)

    # Instrument the actual dequeue location inside the lock; ordering is not inferred from processing logs.
    marker = "    *value = queue.data[queue.head];"
    check("unique dequeue trace insertion point", programs["ring-queue.c"].count(marker) == 1)
    traced = programs["ring-queue.c"].replace(marker, marker + '\n    fprintf(stderr, "LAB_ITEM=%d\\n", *value);')
    for capacity in [1, 4, 7]:
        name = "ring-trace-cap" + str(capacity)
        targets[name] = compile_program(name, traced.replace("CAPACITY = 4", "CAPACITY = " + str(capacity)), fault=True, extra=["-O2"])
        for n in [0, 1, capacity, capacity+1, 123, 10000]:
            r = run(name, [n], output=f"items={n} total={n*(n+1)//2}\n", env={**audit,"OS_LAB_SPURIOUS":"1"})
            seen = list(map(int,re.findall(r"^LAB_ITEM=(\d+)$", r.stderr, re.M)))
            check("exact FIFO no loss duplication cap=" + str(capacity) + " n=" + str(n), seen == list(range(1,n+1)))
            check("all consumers joined cap=" + str(capacity) + " n=" + str(n), "created=2 joined=2" in r.stderr)
            check("queue objects destroyed cap=" + str(capacity) + " n=" + str(n), "mutex_destroy=1 cond_destroy=2" in r.stderr)

    # Independently check the hand-calculated resource safety examples.
    def safe_orders(allocated, maximum, available):
        orders = []
        for order in itertools.permutations(range(len(allocated))):
            work = available
            for job in order:
                if maximum[job] - allocated[job] > work:
                    break
                work += allocated[job]
            else:
                orders.append(order)
        return orders
    check("banker stated safe sequence", (1,0,2) in safe_orders([1,1,1],[3,2,3],2))
    check("banker alternative sequence", (0,1,2) in safe_orders([1,1,1],[3,2,3],2))
    check("banker unsafe worst-case state", not safe_orders([1,1],[3,3],1))

    tsan_source = root / "mutex-tsan.c"
    tsan_source.write_text(programs["mutex.c"],encoding="utf-8")
    tsan_binary = root / "mutex-tsan"
    result = subprocess.run(flags + ["-O1","-fsanitize=thread",str(tsan_source),"-o",str(tsan_binary)],cwd=root,text=True,capture_output=True,timeout=30)
    tsan = {"compiled":result.returncode == 0, "passed":False}
    if result.returncode == 0:
        process = subprocess.Popen([str(tsan_binary)],cwd=root,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
        result = finish(process)
        tsan.update({"returnCode":result.returncode,"diagnostic":result.stderr[:1600]})
        if "WARNING: ThreadSanitizer: data race" in result.stderr:
            raise AssertionError("TSan reported an actual data race")
        if result.returncode == 0:
            check("TSan normal counter output", result.stdout == expected["mutex"])
            tsan["passed"] = True
        else:
            tsan["status"] = "runtime_failed_not_a_clean_diagnostic_run"
    else:
        tsan.update({"status":"compile_unavailable","diagnostic":result.stderr[:1600]})

report = {"date":"2026-11-05","passed":True,"checks":len(checks),"teachingPrograms":14,"mainExamples":3,
          "faultWrappedPrograms":7,"ringTraceCapacities":[1,4,7],"maxQueueItems":10000,
          "repeatedRunsPerCoreProgram":20,"threadSanitizer":tsan,
          "compiler":subprocess.check_output(["gcc","--version"],text=True).splitlines()[0],"platform":platform.platform(),
          "limitations":["Repeated runs do not exhaust all interleavings", "No ordinary non-atomic data-race or permanent-deadlock program was executed", "Wrappers simulate successful predicate-unchanged waits, not runtime-generated spurious wakeups", "Audit covers tutorial-explicit allocations, successful creates/joins and destruction counts, not all libc internal resources", "Project recovers partial thread creation; other unrecoverable pthread errors terminate the experiment process"],
          "details":checks}
(HERE / "详写第五批测试结果.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v for k,v in report.items() if k != "details"},ensure_ascii=False))
