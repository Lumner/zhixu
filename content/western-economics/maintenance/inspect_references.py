"""Read legacy PPT text records without Office; never modify the supplied slides."""
from pathlib import Path
import struct


def ppt_stream(path):
    data = Path(path).read_bytes()
    if data[:8] != bytes.fromhex("d0cf11e0a1b11ae1"):
        raise ValueError("Expected OLE compound file")
    size = 1 << struct.unpack_from("<H", data, 30)[0]
    def sector(n):
        return data[(n + 1) * size:(n + 2) * size]
    fat_ids = list(struct.unpack_from("<109I", data, 76))
    nxt, count = struct.unpack_from("<II", data, 68)
    for _ in range(count):
        chunk = struct.unpack("<" + "I" * (size // 4), sector(nxt))
        fat_ids.extend(chunk[:-1])
        nxt = chunk[-1]
    fat = []
    for n in fat_ids:
        if n < 0xFFFFFFFA:
            fat.extend(struct.unpack("<" + "I" * (size // 4), sector(n)))
    def chain(n):
        chunks, seen = [], set()
        while n < 0xFFFFFFFA:
            if n in seen:
                raise ValueError("Circular sector chain")
            seen.add(n)
            chunks.append(sector(n))
            n = fat[n]
        return b"".join(chunks)
    directory = chain(struct.unpack_from("<I", data, 48)[0])
    for pos in range(0, len(directory), 128):
        entry = directory[pos:pos + 128]
        length = struct.unpack_from("<H", entry, 64)[0]
        name = entry[:max(0, length - 2)].decode("utf-16le", errors="replace")
        if name == "PowerPoint Document":
            start = struct.unpack_from("<I", entry, 116)[0]
            length = struct.unpack_from("<Q", entry, 120)[0]
            if length < 4096:
                raise ValueError("Mini streams are outside this reader's scope")
            return chain(start)[:length]
    raise ValueError("PowerPoint Document stream missing")


def texts(data):
    pos = 0
    while pos + 8 <= len(data):
        version, kind, length = struct.unpack_from("<HHI", data, pos)
        end = pos + 8 + length
        if end > len(data):
            break
        payload = data[pos + 8:end]
        if kind in (4000, 4008):
            yield payload.decode("utf-16le" if kind == 4000 else "cp1252", errors="replace")
        elif version & 15 == 15:
            yield from texts(payload)
        pos = end


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    for name in sys.argv[1:]:
        found = list(texts(ppt_stream(name)))
        print(Path(name).name, "text atoms:", len(found))
        filtered = [x for x in found if x.strip() and not x.startswith("单击") and x.strip() != "*"]
        for item in filtered[:5]:
            print(item.replace("\r", " / ")[:280])
