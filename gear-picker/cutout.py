"""Вырезает предмет с белого фона каталожного фото -> WebP с прозрачностью.
python cutout.py in_dir out_dir [max_w max_h]"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

def cutout(src, dst, W=480, H=360):
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    mn = a.min(axis=2)                      # насколько пиксель «белый»
    spread = a.max(axis=2) - mn             # цветность
    near = (mn >= 238) & (spread <= 14)     # кандидаты фона
    lab, _ = ndimage.label(near)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border = border[border > 0]
    bg = np.isin(lab, border)
    # мягкий край: полоса 2 px вокруг фона получает частичную прозрачность по «белизне»
    fg = ~bg
    edge = fg & ndimage.binary_dilation(bg, iterations=2)
    alpha = np.where(bg, 0, 255).astype(np.float32)
    soft = np.clip((255 - mn) / (255 - 200) * 255, 0, 255)
    alpha[edge] = np.minimum(alpha[edge], soft[edge])
    # убрать мелкий мусор
    lab2, n = ndimage.label(alpha > 0)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(alpha), lab2, range(1, n + 1))
        keep = np.isin(lab2, np.where(sizes >= max(40, sizes.max() * 0.002))[0] + 1)
        alpha[~keep] = 0
    rgba = np.dstack([a.astype(np.uint8), alpha.astype(np.uint8)])
    out = Image.fromarray(rgba, "RGBA")
    bbox = out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        out = out.crop(bbox)
    out.thumbnail((W, H), Image.LANCZOS)
    out.save(dst, "WEBP", quality=82, method=6)
    return out.size

if __name__ == "__main__":
    i, o = sys.argv[1], sys.argv[2]
    W = int(sys.argv[3]) if len(sys.argv) > 3 else 480
    H = int(sys.argv[4]) if len(sys.argv) > 4 else 360
    os.makedirs(o, exist_ok=True)
    ok = 0
    for f in sorted(os.listdir(i)):
        if not f.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        dst = os.path.join(o, os.path.splitext(f)[0] + ".webp")
        if os.path.exists(dst):
            continue
        try:
            cutout(os.path.join(i, f), dst, W, H); ok += 1
        except Exception as e:
            print("ERR", f, e)
    print("done", ok)
