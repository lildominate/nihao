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

PAD = 44        # look well beyond each cell: objects often overflow the grid line (neighbour fragments are filtered out)
THRESH = 22     # "not white" threshold


def isolate(cell: Image.Image, core: tuple[int, int, int, int]) -> Image.Image:
    """`core` = the grid cell itself inside the padded crop; the object is the one centred there."""
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
    cx0, cy0, cx1, cy1 = core

    def centred(k):
        _, x0, y0, x1, y1 = comps[k]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        return cx0 <= mx <= cx1 and cy0 <= my <= cy1

    # The object is the biggest component CENTRED in this cell — not the biggest in the padded crop,
    # which can be a neighbour that overflows its own cell.
    main = max((k for k in range(len(comps)) if centred(k)), key=lambda k: comps[k][0])
    m = comps[main]

    def keep(k):
        n, x0, y0, x1, y1 = comps[k]
        if k == main:
            return True
        if n <= 12 or not centred(k):
            return False  # specks, or pieces of neighbours
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
    return transparent_background(sq).resize((256, 256), Image.LANCZOS)


def transparent_background(img: Image.Image) -> Image.Image:
    """Make the white surroundings transparent (flood fill from the border), keeping white
    INSIDE the object (baozi dough, milk). Near-white edge pixels get partial alpha for a soft edge."""
    w, h = img.size
    px = img.load()
    def whiteness(p):  # 0 = clearly coloured … 255 = pure white
        return min(p)
    outside = [[False] * w for _ in range(h)]
    q = deque((x, y) for x in range(w) for y in (0, h - 1)) + deque((x, y) for y in range(h) for x in (0, w - 1))
    for x, y in q:
        outside[y][x] = whiteness(px[x, y]) >= 226
    q = deque((x, y) for x, y in q if outside[y][x])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not outside[ny][nx] and whiteness(px[nx, ny]) >= 226:
                outside[ny][nx] = True; q.append((nx, ny))
    rgba = img.convert('RGBA'); rp = rgba.load()
    for y in range(h):
        for x in range(w):
            if outside[y][x]:
                rp[x, y] = (255, 255, 255, 0)
            else:
                # anti-alias: pixels bordering the outside that are nearly white fade out
                near = any(0 <= x + dx < w and 0 <= y + dy < h and outside[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if near:
                    r, g, b_, _ = rp[x, y]
                    rp[x, y] = (r, g, b_, max(0, min(255, int((255 - min(r, g, b_)) * 4))))
    return rgba


def main():
    src, cols, rows, out, ids = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5].split(',')
    assert len(ids) == cols * rows, f'expected {cols * rows} ids, got {len(ids)}'
    im = Image.open(src).convert('RGB'); W, H = im.size
    dest = Path('public/pics') / out; dest.mkdir(parents=True, exist_ok=True)
    for i, wid in enumerate(ids):
        if wid == '-':
            continue
        r, c = divmod(i, cols)
        gx0, gy0, gx1, gy1 = round(c * W / cols), round(r * H / rows), round((c + 1) * W / cols), round((r + 1) * H / rows)
        box = (max(0, gx0 - PAD), max(0, gy0 - PAD), min(W, gx1 + PAD), min(H, gy1 + PAD))
        core = (gx0 - box[0], gy0 - box[1], gx1 - box[0], gy1 - box[1])
        isolate(im.crop(box), core).save(dest / f'{wid}.webp', 'WEBP', quality=85)
    print(f'{sum(1 for i in ids if i != "-")} images -> {dest}')


if __name__ == '__main__':
    main()
