#!/usr/bin/env python3
"""Ошибки кадра «как в камере» из эталона det-N-ok (Claude, 01.11.2026, Matis Academy).

Все операции — в линейном свете (sRGB → linear → ... → sRGB), как это происходит
в камере: экспозиция в ступенях с жёстким клипом каналов, баланс белого через
коэффициенты каналов для цветовой температуры, шум сенсора (дробовой + шум
считывания + цветные пятна) с последующим «вытягиванием», наклон — поворот с
обрезкой внутрь кадра.

Два уровня: base (Новичок — ошибка видна сразу) и pro (Профи — тонко).

Использование:
  python3 frame_errors.py IN_DIR OUT_DIR [--w 1200] [--q 80]
  IN_DIR: det-N-ok.png, det-N-focus.png, det-N-motion.png (+ kr-*, cover-*)
"""
import sys, os, re, glob, argparse, math
import numpy as np
from PIL import Image

LEVELS = {
    'base': dict(over=2.8, under=-2.6, cold=3000, warm=11000, tilt=8.0, iso_stops=3.6, iso_dark=-1.1),
    'pro':  dict(over=1.15, under=-1.35, cold=4300, warm=7600, tilt=3.2, iso_stops=2.5, iso_dark=-0.6),
}
SCENE_K = 5600  # эталон снят в нейтральном дневном балансе


def to_lin(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def to_srgb(l):
    l = np.clip(l, 0, 1)
    return np.where(l <= 0.0031308, l * 12.92, 1.055 * l ** (1 / 2.4) - 0.055)


def load(p):
    return np.asarray(Image.open(p).convert('RGB'), dtype=np.float32) / 255.0


def kelvin_rgb(t):
    """Линейный sRGB цвет чёрного тела (приближение Планка через CIE 1931 xy)."""
    t = float(t)
    # x,y на локусе Планка (Kim et al. cubic spline)
    if t <= 4000:
        x = -0.2661239e9 / t**3 - 0.2343589e6 / t**2 + 0.8776956e3 / t + 0.179910
    else:
        x = -3.0258469e9 / t**3 + 2.1070379e6 / t**2 + 0.2226347e3 / t + 0.240390
    if t <= 2222:
        y = -1.1063814 * x**3 - 1.34811020 * x**2 + 2.18555832 * x - 0.20219683
    elif t <= 4000:
        y = -0.9549476 * x**3 - 1.37418593 * x**2 + 2.09137015 * x - 0.16748867
    else:
        y = 3.0817580 * x**3 - 5.87338670 * x**2 + 3.75112997 * x - 0.37001483
    X, Y, Z = x / y, 1.0, (1 - x - y) / y
    M = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    return M @ np.array([X, Y, Z])


def wb_gains(cam_k, scene_k=SCENE_K):
    """Камера настроена на cam_k, а свет — scene_k. Нейтраль станет scene/cam."""
    g = kelvin_rgb(scene_k) / kelvin_rgb(cam_k)
    lum = np.array([0.2126, 0.7152, 0.0722])
    return g / (g @ lum)


def exposure(lin, stops):
    return lin * (2.0 ** stops)  # клип каналов при выводе — как у видеокамеры


def white_balance(lin, cam_k):
    return lin * wb_gains(cam_k)[None, None, :]


def sensor_noise(lin, stops, dark, rng):
    """Сцена темнее на |dark| ступеней, ISO поднято на stops: шум растёт, тени «грязные»."""
    h, w, _ = lin.shape
    gain = 2.0 ** stops
    sig = lin * (2.0 ** dark) / gain           # что реально набрал сенсор
    full_well = 2600.0                          # электронов на «белое» при базовом ISO
    e = sig * full_well
    shot = rng.normal(0, 1, e.shape) * np.sqrt(np.maximum(e, 0))
    read = rng.normal(0, 1, e.shape) * 3.2
    e_n = e + shot + read

    # хрома-пятна: низкочастотный цветной шум (то, что делает ISO 12800 «грязным»)
    def lowfreq(f, s):
        sm = rng.normal(0, 1, (math.ceil(h / f), math.ceil(w / f), 3)).astype(np.float32)
        out = np.stack([np.asarray(Image.fromarray(sm[..., c], 'F').resize((w, h), Image.BICUBIC)) for c in range(3)], -1)
        return out * s
    blot = lowfreq(3, 1.0) + lowfreq(7, 0.6)
    blot -= blot.mean(axis=2, keepdims=True)    # только цвет, без яркости
    e_n = e_n + blot * (3.0 + 0.35 * np.sqrt(np.maximum(e, 0)))
    # зерно чуть крупнее пикселя (дебайеринг)
    lum_grain = lowfreq(2, 1.0).mean(axis=2, keepdims=True)
    e_n = e_n + lum_grain * (0.6 * np.sqrt(np.maximum(e, 0)) + 2.0)

    out = (e_n / full_well) * gain
    out = out + 0.004 * gain / 12                # приподнятый «молочный» чёрный
    # компрессия: немного съесть насыщенность и детали в тенях
    l = (out * np.array([0.2126, 0.7152, 0.0722])).sum(-1, keepdims=True)
    out = l + (out - l) * 0.85
    return out


def tilt(img_srgb, deg):
    """Наклон камеры: поворот и обрезка до максимального прямоугольника 3:2 без пустых углов."""
    h, w, _ = img_srgb.shape
    im = Image.fromarray((np.clip(img_srgb, 0, 1) * 255 + 0.5).astype(np.uint8))
    big = im.resize((w * 2, h * 2), Image.LANCZOS)
    rot = big.rotate(deg, resample=Image.BICUBIC, expand=False)
    a = math.radians(abs(deg))
    # наибольший прямоугольник того же соотношения, вписанный в повёрнутый кадр
    W, H = w * 2, h * 2
    s = min(W / (W * math.cos(a) + H * math.sin(a)), H / (W * math.sin(a) + H * math.cos(a)))
    cw, ch = W * s, H * s
    box = ((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2)
    return np.asarray(rot.crop(tuple(int(round(v)) for v in box)).resize((w, h), Image.LANCZOS), dtype=np.float32) / 255


def save(a, path, W, q):
    im = Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
    if im.width != W:
        im = im.resize((W, round(W * im.height / im.width)), Image.LANCZOS)
    im.save(path, 'WEBP', quality=q, method=6)


def variants(ok_srgb, seed):
    rng = np.random.default_rng(seed)
    lin = to_lin(ok_srgb)
    out = {}
    # пересвет подбираем по яркости кадра: светлая сцена «выбивается» раньше тёмной
    med = float(np.median((lin * np.array([0.2126, 0.7152, 0.0722])).sum(-1)))
    ob = float(np.clip(math.log2(0.6 / max(med, 1e-3)), 1.4, LEVELS['base']['over']))
    over_st = {'base': ob, 'pro': max(0.7, min(LEVELS['pro']['over'], ob * 0.45))}
    for lv, P in LEVELS.items():
        sfx = '' if lv == 'base' else '-pro'
        out['over' + sfx] = to_srgb(exposure(lin, over_st[lv]))
        u = exposure(lin, P['under'])
        u = u + rng.normal(0, 0.0006, u.shape) * np.sqrt(np.maximum(u, 0) + 1e-4)
        out['under' + sfx] = to_srgb(u)
        out['cold' + sfx] = to_srgb(white_balance(lin, P['cold']))
        out['warm' + sfx] = to_srgb(white_balance(lin, P['warm']))
        out['noise' + sfx] = to_srgb(sensor_noise(lin, P['iso_stops'], P['iso_dark'], rng))
        sign = 1 if rng.random() < .5 else -1
        out['tilt' + sfx] = tilt(ok_srgb, sign * P['tilt'])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('out')
    ap.add_argument('--w', type=int, default=1200); ap.add_argument('--q', type=int, default=80)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    files = sorted(glob.glob(os.path.join(a.inp, '**', '*.*'), recursive=True))
    for p in files:
        name = os.path.basename(p)
        m = re.match(r'(det-\d+)-(ok|focus|motion)\.(png|jpe?g|webp)$', name, re.I)
        if m:
            scene, kind = m.group(1), m.group(2)
            src = load(p)
            save(src, os.path.join(a.out, f'{scene}-{kind}.webp'), a.w, a.q)
            if kind == 'ok':
                seed = int(scene.split('-')[1]) * 7919
                for k, v in variants(src, seed).items():
                    save(v, os.path.join(a.out, f'{scene}-{k}.webp'), a.w, a.q)
                print('det', scene, 'ok + 12 вариантов')
            continue
        m = re.match(r'(kr-\d+-[a-z-]+)\.(png|jpe?g|webp)$', name, re.I)
        if m:
            save(load(p), os.path.join(a.out, m.group(1) + '.webp'), a.w, a.q); print('kr', m.group(1)); continue
        m = re.match(r'(cover-(det|kr|bl))\.(png|jpe?g|webp)$', name, re.I)
        if m:
            save(load(p), os.path.join(a.out, m.group(1) + '.webp'), 512, 82); print('cover', m.group(1))


if __name__ == '__main__':
    main()
