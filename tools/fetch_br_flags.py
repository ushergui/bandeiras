"""Baixa as bandeiras dos 26 estados + DF do Wikimedia Commons
(SVG oficial renderizado em PNG pela própria API do Commons — insígnias
de domínio público). Salva em assets/stickers/bra/<uf>.png
"""
import json
import os
import time
import urllib.parse
import urllib.request

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "stickers", "bra")
os.makedirs(OUT, exist_ok=True)
UA = "DetetiveGlobal/1.0 (jogo educativo; guilhermeduarte2007@gmail.com)"

# uf -> título do arquivo no Commons
FILES = {
    "ac": "Flag of Acre.svg",
    "al": "Flag of Alagoas.svg",
    "ap": "Flag of Amapá.svg",
    "am": "Bandeira do Amazonas.svg",
    "ba": "Flag of Bahia.svg",
    "ce": "Flag of Ceará.svg",
    "df": "Bandeira do Distrito Federal (Brasil).svg",
    "es": "Flag of Espírito Santo.svg",
    "go": "Flag of Goiás.svg",
    "ma": "Flag of Maranhão.svg",
    "mt": "Flag of Mato Grosso.svg",
    "ms": "Flag of Mato Grosso do Sul.svg",
    "mg": "Flag of Minas Gerais.svg",
    "pa": "Flag of Pará.svg",
    "pb": "Flag of Paraíba.svg",
    "pr": "Flag of Paraná.svg",
    "pe": "Flag of Pernambuco.svg",
    "pi": "Flag of Piauí.svg",
    "rj": "Flag of Rio de Janeiro (state).svg",
    "rn": "Flag of Rio Grande do Norte.svg",
    "rs": "Flag of Rio Grande do Sul.svg",
    "ro": "Flag of Rondônia.svg",
    "rr": "Flag of Roraima.svg",
    "sc": "Flag of Santa Catarina.svg",
    "sp": "Flag of São Paulo.svg",
    "se": "Flag of Sergipe.svg",
    "to": "Flag of Tocantins.svg",
}


def api_thumbs(titles, width=900):
    params = {
        "action": "query",
        "titles": "|".join("File:" + t for t in titles),
        "prop": "imageinfo",
        "iiprop": "url",
        "iiurlwidth": str(width),
        "format": "json",
        "redirects": "1",
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)

    # normalização de redirects/normalized
    norm = {}
    for n in data["query"].get("normalized", []):
        norm[n["to"]] = n["from"]
    for n in data["query"].get("redirects", []):
        norm[n["to"]] = norm.get(n["from"], n["from"])

    out = {}
    for page in data["query"]["pages"].values():
        title = page.get("title", "")
        orig = norm.get(title, title).replace("File:", "")
        ii = page.get("imageinfo")
        if ii:
            out[orig] = ii[0].get("thumburl")
    return out


def main():
    titles = list(FILES.values())
    thumbs = {}
    for i in range(0, len(titles), 20):
        thumbs.update(api_thumbs(titles[i:i + 20]))
        time.sleep(0.5)

    ok = miss = 0
    for uf, title in FILES.items():
        url = thumbs.get(title)
        if not url:
            print(f"  ! {uf}: sem thumburl para '{title}'")
            miss += 1
            continue
        url = url.split("?")[0]
        dst = os.path.join(OUT, f"{uf}.png")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                open(dst, "wb").write(r.read())
            print(f"  ok {uf}  ({os.path.getsize(dst)//1024} KB)")
            ok += 1
        except Exception as e:
            print(f"  ! {uf}: {e}")
            miss += 1
        time.sleep(0.3)
    print(f"\nConcluído: {ok} ok, {miss} faltando  ->  {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
