"""Gera os ícones PWA + a logo do app a partir de imagens-geradas/logo_refeita.png
(ícone quadrado com fundo squircle navy) e horizontal.png."""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "imagens-geradas", "logo_refeita.png")
SRC_H = os.path.join(ROOT, "imagens-geradas", "horizontal.png")
ICONS = os.path.join(ROOT, "assets", "icons")
IMG = os.path.join(ROOT, "assets", "img")
NAVY = (15, 27, 45, 255)  # #0f1b2d


def load_sq():
    im = Image.open(SRC).convert("RGBA")
    # o logo já é quase quadrado; recorta pro menor lado, centralizado
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    return im


def flatten(im, bg=NAVY):
    base = Image.new("RGBA", im.size, bg)
    base.alpha_composite(im)
    return base


def main():
    sq = load_sq()

    # "any" — o próprio logo (já tem o fundo squircle), sobre navy pra tapar cantos
    for size in (192, 512):
        flatten(sq).resize((size, size), Image.LANCZOS).convert("RGB").save(
            os.path.join(ICONS, f"icon-{size}.png"))

    # "maskable" — precisa de margem de segurança (safe zone ~80%)
    for size in (192, 512):
        pad = int(size * 0.14)
        canvas = Image.new("RGBA", (size, size), NAVY)
        inner = flatten(sq).resize((size - 2 * pad, size - 2 * pad), Image.LANCZOS)
        canvas.alpha_composite(inner, (pad, pad))
        canvas.convert("RGB").save(os.path.join(ICONS, f"maskable-{size}.png"))

    flatten(sq).resize((180, 180), Image.LANCZOS).convert("RGB").save(
        os.path.join(ICONS, "apple-touch-icon.png"))
    flatten(sq).resize((32, 32), Image.LANCZOS).convert("RGB").save(
        os.path.join(ICONS, "favicon-32.png"))

    # logo do app (transparente, cantos arredondados nativos da arte)
    Image.open(SRC).convert("RGBA").resize((512, 512), Image.LANCZOS).save(
        os.path.join(IMG, "logo.png"))
    h = Image.open(SRC_H).convert("RGBA")
    ratio = 900 / h.width
    h.resize((900, int(h.height * ratio)), Image.LANCZOS).save(
        os.path.join(IMG, "logo-horizontal.png"))

    print("Ícones e logo gerados.")
    for f in sorted(os.listdir(ICONS)):
        p = os.path.join(ICONS, f)
        print(f"  {f}  {os.path.getsize(p)//1024} KB")


if __name__ == "__main__":
    main()
