# -*- coding: utf-8 -*-
"""
Otimiza as figurinhas geradas por IA (assets/stickers/<secao>/*.png) para o
deploy: redimensiona e reencoda como .webp ao lado do .png.

- retrato/paisagem (frutas, lendas, comidas, animais, legumes): lado maior 640px
- escudo (clubes) e moeda: lado maior 400px, mantendo transparencia
- pula o que ja tem .webp mais novo que o .png

Rodar:  venv\\Scripts\\python.exe tools\\otimizar_stickers.py
        venv\\Scripts\\python.exe tools\\otimizar_stickers.py --force
        venv\\Scripts\\python.exe tools\\otimizar_stickers.py --only lendas
"""
import os, sys, io

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_VENV_PY = os.path.join(ROOT, "venv", "Scripts", "python.exe")
if os.path.exists(_VENV_PY) and os.path.abspath(sys.executable).lower() != os.path.abspath(_VENV_PY).lower():
    os.execv(_VENV_PY, [_VENV_PY] + sys.argv)

from PIL import Image

STICKERS = os.path.join(ROOT, "assets", "stickers")

# secao -> (lado maior em px, qualidade webp)
CFG = {
    "frutas":   (640, 82),
    "legumes":  (640, 82),
    "animais":  (640, 82),
    "comidas":  (640, 82),
    "lendas":   (640, 82),
    "clubes":   (400, 88),
    "moedas":   (400, 88),
}


def one(src, max_side, q):
    im = Image.open(src)
    im.load()
    has_alpha = im.mode in ("RGBA", "LA", "P") and (
        im.mode != "P" or "transparency" in im.info
    )
    im = im.convert("RGBA" if has_alpha else "RGB")
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1.0:
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    dest = os.path.splitext(src)[0] + ".webp"
    im.save(dest, "WEBP", quality=q, method=6)
    return dest, os.path.getsize(dest)


def run(only=None, force=False):
    total_in = total_out = n = skip = 0
    for sec, (max_side, q) in CFG.items():
        if only and only != sec:
            continue
        d = os.path.join(STICKERS, sec)
        if not os.path.isdir(d):
            continue
        srcs = sorted(f for f in os.listdir(d)
                      if f.lower().endswith((".png", ".jpg", ".jpeg")))
        print(f"\n== {sec}  ({len(srcs)} imagens)")
        for f in srcs:
            src = os.path.join(d, f)
            webp = os.path.splitext(src)[0] + ".webp"
            if (not force) and os.path.exists(webp) and os.path.getmtime(webp) >= os.path.getmtime(src):
                skip += 1
                continue
            try:
                _, size = one(src, max_side, q)
                total_in += os.path.getsize(src)
                total_out += size
                n += 1
                if n % 50 == 0:
                    print(f"   ... {n} feitas")
            except Exception as e:
                print(f"   ERRO {f}: {e}")
    mb = lambda b: f"{b/1048576:.1f} MB"
    print(f"\notimizadas: {n} | puladas: {skip}")
    if n:
        print(f"origem: {mb(total_in)}  ->  webp: {mb(total_out)}  ({100*total_out/max(1,total_in):.0f}%)")


if __name__ == "__main__":
    a = sys.argv[1:]
    only = a[a.index("--only") + 1] if "--only" in a and a.index("--only") + 1 < len(a) else None
    run(only=only, force=("--force" in a))
