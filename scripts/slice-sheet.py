"""Slice an illustration sheet (a grid of objects on white) into one WebP per word.

Usage: python scripts/slice-sheet.py <sheet image> <cols> <rows> <out dir under public/pics> <id,id,...>
Ids are given row by row; use "-" to skip a cell. Each object is isolated by connected
components (neighbour fragments that overflow the grid line are erased), padded to a square
and saved as 256x256 WebP.
"""
import sys
from collections import deque
from pathlib import Path
from PIL import Image, ImageChops

PAD = 14        # look slightly beyond each cell so objects overflowing the grid line stay whole
THRESH = 22     # "not white" threshold


def isolate(cell: Image.Image) -> Image.Image:
    w, h = cell.size
    px = ImageChops.difference(cell, Image.new('RGB', cell.size, (255, 255, 255))).convert('L').load()
    lab = [[-1] * w for _ in range(h)]
    comps = []  # (size, x0, y0, x1, y1)
    for y in range(h):
        for x in range(w):
            if px[x, y] > THRESH and lab[y][x] < 0:
                k = len(comps); q = deque([(x, y)]); lab[y][x] = k
                n, x0, x1, y0, y1 = 0, x, x, y, y
                while q:
                    a, b = q.popleft(); n += 1
                    x0, x1, y0, y1 = min(x0, a), max(x1, a), min(y0, b), max(y1, b)
                    for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        na, nb = a + da, b + db
                        if 0 <= na < w and 0 <= nb < h and px[na, nb] > THRESH and lab[nb][na] < 0:
                            lab[nb][na] = k; q.append((na, nb))
                comps.append((n, x0, y0, x1, y1))
    main = max(range(len(comps)), key=lambda k: comps[k][0])
    m = comps[main]

    def keep(k):
        n, x0, y0, x1, y1 = comps[k]
        if k == main:
            return True
        if n <= 12 or x0 <= 2 or y0 <= 2 or x1 >= w - 3 or y1 >= h - 3:
            return False  # specks, or fragments of a neighbour touching the crop edge
        return y0 <= m[4]  # details below the object belong to the next row (e.g. its steam)

    kept = {k for k in range(len(comps)) if keep(k)}
    out = cell.copy(); op = out.load()
    for y in range(h):
        for x in range(w):
            if lab[y][x] >= 0 and lab[y][x] not in kept:
                op[x, y] = (255, 255, 255)
    box = (min(comps[k][1] for k in kept), min(comps[k][2] for k in kept),
           max(comps[k][3] for k in kept) + 1, max(comps[k][4] for k in kept) + 1)
    obj = out.crop(box)
    side = int(max(obj.size) * 1.12)
    sq = Image.new('RGB', (side, side), (255, 255, 255))
    sq.paste(obj, ((side - obj.width) // 2, (side - obj.height) // 2))
    return sq.resize((256, 256), Image.LANCZOS)


def main():
    src, cols, rows, out, ids = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5].split(',')
    assert len(ids) == cols * rows, f'expected {cols * rows} ids, got {len(ids)}'
    im = Image.open(src).convert('RGB'); W, H = im.size
    dest = Path('public/pics') / out; dest.mkdir(parents=True, exist_ok=True)
    for i, wid in enumerate(ids):
        if wid == '-':
            continue
        r, c = divmod(i, cols)
        box = (max(0, round(c * W / cols) - PAD), max(0, round(r * H / rows) - PAD),
               min(W, round((c + 1) * W / cols) + PAD), min(H, round((r + 1) * H / rows) + PAD))
        isolate(im.crop(box)).save(dest / f'{wid}.webp', 'WEBP', quality=82)
    print(f'{sum(1 for i in ids if i != "-")} images -> {dest}')


if __name__ == '__main__':
    main()
