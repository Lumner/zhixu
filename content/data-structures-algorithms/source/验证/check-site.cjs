// Run after a serialized root build: node content/data-structures-algorithms/source/验证/check-site.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../../');
const out = path.join(root, 'dist');
const core = require(path.join(root, 'web/assets/core.js'));
const window = {};
const readScript = file => vm.runInNewContext(fs.readFileSync(file, 'utf8'), { window });
readScript(path.join(out, 'data/catalog.js'));
readScript(path.join(out, 'data/search.js'));
const id = 'data-structures-algorithms';
const course = window.TUTORIAL_CATALOG.courses.find(c => c.id === id);
let count = 0;
function check(label, fn) { fn(); count++; }
check('course has complete learning sequence', () => assert.equal(course?.status, 'complete'));
check('fifty-two delivered lessons', () => assert.equal(course.chapterCount, 52));
check('stable lesson IDs', () => assert.deepEqual(Array.from(course.documents.filter(d => d.kind === 'chapter'), d => d.id), Array.from({length:52}, (_,i)=>String(i+1).padStart(2,'0'))));
check('nine complete learning groups', () => assert.equal(course.groups.length, 9));
check('sixty-three complete program groups', () => assert.equal(course.stats.examples, 63));
check('registered in existing systems category', () => assert.equal(course.category, 'systems'));
check('guide does not count as lesson', () => assert.equal(course.documents.find(d => d.id === '00').kind, 'guide'));
check('download exists', () => assert.ok(fs.statSync(path.join(out, course.download)).size > 1000));
for (const term of ['容量', 'getchar', '值传递', '整数除法', '学习分钟统计器', 'realloc', '生命周期', '临时目录', '资料目录', '循环不变量', '递归', '二分查找', '半开区间', '摊还', '顺序表', '单链表', '双向', '循环队列', '后缀', '括号', 'LIFO', 'FIFO', 'KMP', '拉链法', '墓碑', '负载因子', '主数据', '稳定性', '选择排序', '希尔排序', '归并排序', '三路快排', '计数排序', '基数排序', '排序视图', '二叉树', '层序', '中序后继', 'AVL', '优先队列', '堆排序', '哈夫曼', '前缀码', '邻接矩阵', 'DFS', 'BFS', '拓扑排序', 'Dijkstra', '负环', 'Floyd', '并查集', 'Kruskal', 'Prim', '最小生成森林', '交换论证', '贪心', '回溯', '剪枝', '位掩码', '数独', '记忆化', '0/1背包', '滚动数组', '伪多项式', '业务ID', '候选对象', '先修闭包', '序列化', '侧文件', 'swap_owners']) {
  check('course index match: ' + term, () => assert.ok(core.search(term, window.TUTORIAL_SEARCH, window.TUTORIAL_SEARCH.length).some(item => item.courseId === id), term));
}
for (const term of ['循环队列', '后缀表达式', 'KMP', '墓碑', '三路快排', '希尔排序', '中序后继', '哈夫曼', 'Dijkstra', '最小生成森林', '交换论证', '记忆化', '0/1背包', '先修闭包']) {
  check('visible specific search: ' + term, () => assert.ok(core.search(term, window.TUTORIAL_SEARCH).some(item => item.courseId === id), term));
}
for (const lesson of course.documents.filter(d => d.kind === 'chapter')) {
  check('lesson payload ' + lesson.id, () => {
    let payload;
    vm.runInNewContext(fs.readFileSync(path.join(out, 'data/content', id, lesson.id + '.js'), 'utf8'), {
      window: { TutorialContent: { register(key, data) { assert.equal(key, id + '/' + lesson.id); payload = data; } } }
    });
    assert.ok(payload.html.includes('完成条件'));
    assert.ok(payload.toc.length >= 8);
    if (lesson.id !== '01') assert.ok(payload.html.includes('hljs'));
    if (lesson.id === '52') assert.ok(payload.html.includes('class="course-diagram'), 'candidate ownership SVG generated');
    if (lesson.id === '50') assert.ok(payload.html.includes('class="course-diagram'), 'subset search tree SVG generated');
    if (lesson.id === '45') assert.ok(payload.html.includes('class="course-diagram'), 'dependency SVG generated');
    if (lesson.id === '37') assert.ok(payload.html.includes('class="course-diagram'), 'binary tree SVG generated');
  });
}
check('course progress isolation', () => {
  const store = core.createStore(null);
  store.toggleComplete(id + '/01');
  assert.equal(store.progress(course).done, 1);
  const other = window.TUTORIAL_CATALOG.courses.find(c => c.id === 'wechat-miniprogram');
  assert.equal(store.progress(other).done, 0);
  store.toggleBookmark(id + '/02');
  assert.equal(store.isBookmarked('wechat-miniprogram/02'), false);
});
const report = { date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()), course: id, checks: count, passed: true, browserQA: false };
fs.writeFileSync(path.join(__dirname, '../../site-integration-checks.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
