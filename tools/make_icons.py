"""Gera os ícones PWA a partir do conceito do favicon (globo + lupa dourada).
Usa apenas Pillow (sem dependência de SVG). Saída em assets/icons/.
"""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "icons")
os.makedirs(OUT, exist_ok=True)

BLUE = (74, 144, 226, 255)
BLUE_DARK = (37, 99, 235, 255)
WHITE = (255, 255, 255, 255)
GOLD = (255, 215, 0, 255)


def draw_icon(size, pad_ratio=0.0):
    """Desenha o ícone num canvas quadrado `size`. pad_ratio reserva margem
    (para versão maskable)."""
    scale = 4  # supersampling p/ antialias
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(S * pad_ratio)
    box = (pad, pad, S - pad, S - pad)
    cx = cy = S / 2
    r = (S - 2 * pad) / 2

    # fundo: vertical gradient dentro de um círculo perfeito
    grad = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        t = y / S
        col = tuple(round(a + (b - a) * t) for a, b in zip(BLUE, BLUE_DARK))
        gd.line((0, y, S, y), fill=col)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    img.paste(grad, (0, 0), mask)
    # meridianos / paralelos do globo
    lw = max(2, int(S * 0.012))
    d.line((cx - r * 0.95, cy, cx + r * 0.95, cy), fill=WHITE, width=lw)
    for k in (0.5, 0.82):
        yy = r * k
        d.arc((cx - r * 0.95, cy - yy, cx + r * 0.95, cy + yy), 0, 360, fill=WHITE, width=lw)
    d.arc((cx - r * 0.42, box[1] + r * 0.05, cx + r * 0.42, box[3] - r * 0.05), 0, 360, fill=WHITE, width=lw)
    d.arc((cx - r * 0.78, box[1] + r * 0.05, cx + r * 0.78, box[3] - r * 0.05), 0, 360, fill=WHITE, width=lw)

    # lupa dourada no centro-baixo
    glw = max(4, int(S * 0.055))
    gx, gy, gr = cx, cy - r * 0.02, r * 0.30
    d.arc((gx - gr, gy - gr, gx + gr, gy + gr), 0, 360, fill=GOLD, width=glw)
    ang = math.radians(55)
    d.line((gx + gr * math.cos(ang), gy + gr * math.sin(ang),
            gx + (gr + r * 0.34) * math.cos(ang), gy + (gr + r * 0.34) * math.sin(ang)),
           fill=GOLD, width=glw)

    return img.resize((size, size), Image.LANCZOS)


def main():
    for size in (192, 512):
        draw_icon(size).save(os.path.join(OUT, f"icon-{size}.png"))
        draw_icon(size, pad_ratio=0.16).save(os.path.join(OUT, f"maskable-{size}.png"))
    draw_icon(180, pad_ratio=0.06).save(os.path.join(OUT, "apple-touch-icon.png"))
    draw_icon(32).save(os.path.join(OUT, "favicon-32.png"))
    print("Ícones gerados em", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
