# -*- coding: utf-8 -*-
"""
Baixa os escudos dos clubes da secao "Clubes" do figurinhas_data.js.

Fonte: TheSportsDB (banco gratuito, key publica "3"). Salva em
  assets/stickers/clubes/<slug>.png
Pula os que ja existem. No fim lista os que nao achou (pra voce pegar na mao
pelo botao "buscar" do estudio ou por upload).

Rodar:  venv\\Scripts\\python.exe tools\\fetch_escudos.py
        venv\\Scripts\\python.exe tools\\fetch_escudos.py --force        (rebaixa tudo)
        venv\\Scripts\\python.exe tools\\fetch_escudos.py --only bra      (so os que casam com "bra")
"""
import os, sys, re, json, time, io, subprocess, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
_VENV_PY = os.path.join(ROOT, "venv", "Scripts", "python.exe")
if os.path.exists(_VENV_PY) and os.path.abspath(sys.executable).lower() != os.path.abspath(_VENV_PY).lower():
    os.execv(_VENV_PY, [_VENV_PY] + sys.argv)

OUT = os.path.join(ROOT, "assets", "stickers", "clubes")
os.makedirs(OUT, exist_ok=True)
API = "https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t="
UA = {"User-Agent": "detetive-global-dev/1.0 (escudos, uso educativo local)"}

# nomes de pais do TheSportsDB por codigo ISO (pra desempatar buscas)
DB_COUNTRY = {
    "br": "Brazil", "ar": "Argentina", "uy": "Uruguay", "py": "Paraguay", "cl": "Chile",
    "co": "Colombia", "ec": "Ecuador", "pe": "Peru", "bo": "Bolivia", "ve": "Venezuela",
    "es": "Spain", "gb": "England", "it": "Italy", "de": "Germany", "fr": "France",
    "pt": "Portugal", "nl": "Netherlands", "be": "Belgium", "tr": "Turkey", "gr": "Greece",
    "sct": "Scotland", "wls": "Wales", "ua": "Ukraine", "ch": "Switzerland", "at": "Austria",
    "cz": "Czechia", "hr": "Croatia", "rs": "Serbia", "dk": "Denmark", "no": "Norway",
    "se": "Sweden", "pl": "Poland", "ro": "Romania", "ru": "Russia", "il": "Israel",
    "cy": "Cyprus", "hu": "Hungary", "bg": "Bulgaria", "sk": "Slovakia", "si": "Slovenia",
    "by": "Belarus", "md": "Moldova", "kz": "Kazakhstan", "az": "Azerbaijan", "ge": "Georgia",
    "mx": "Mexico", "us": "USA", "sa": "Saudi Arabia", "cn": "China", "jp": "Japan",
    "kr": "South Korea", "eg": "Egypt", "ma": "Morocco", "za": "South Africa", "ng": "Nigeria",
    "tn": "Tunisia", "dz": "Algeria", "ao": "Angola", "cd": "DR Congo", "au": "Australia", "nz": "New Zealand",
}

FFMPEG = "ffmpeg"
for c in (r"C:\FFmpeg\bin\ffmpeg.exe", r"C:\ffmpeg\bin\ffmpeg.exe"):
    if os.path.exists(c):
        FFMPEG = c
        break


def clubes():
    js = subprocess.check_output(
        ["node", "-e", "console.log(JSON.stringify((require('./figurinhas_data.js').clubes||{}).itens||[]))"],
        cwd=ROOT).decode("utf-8")
    return json.loads(js)


def get_json(url):
    wait = 3
    for _ in range(4):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=25) as r:
                raw = r.read().decode("utf-8", "ignore")
            if "error code: 1015" in raw or "being rate limited" in raw:
                print("     (rate limit -- pausando %ds)" % wait, flush=True)
                time.sleep(wait); wait = min(wait * 2, 45); continue
            return json.loads(raw)
        except Exception:
            time.sleep(wait); wait = min(wait * 2, 45)
    return None


def download(url, dest):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    tmp = dest + ".dl"
    open(tmp, "wb").write(data)
    # normaliza pra PNG (alguns vem .png ja, outros webp) via ffmpeg
    try:
        subprocess.run([FFMPEG, "-y", "-i", tmp, dest], check=True, capture_output=True)
        os.remove(tmp)
    except Exception:
        os.replace(tmp, dest)


_BAD = re.compile(r"\b(women|wom|wfc|ladies|fem|feminin|basket|hand|volley|"
                  r"futsal|youth|academy|u-?\d\d|reserv|ii\b|b team)\b", re.I)


def best_match(teams, want_country):
    if not teams:
        return None
    soccer = [t for t in teams if (t.get("strSport") or "").lower() == "soccer"]
    if not soccer:
        soccer = [t for t in teams if not (t.get("strSport") or "")] or teams
    main = [t for t in soccer if not _BAD.search(t.get("strTeam") or "")]
    soccer = main or soccer
    if want_country:
        exact = [t for t in soccer if (t.get("strCountry") or "") == want_country]
        if exact:
            soccer = exact
    return soccer[0]


def badge_of(team):
    for k in ("strBadge", "strTeamBadge", "strLogo"):
        if team.get(k):
            return team[k]
    return None


def run(only=None, force=False):
    items = clubes()
    if not items:
        print("nenhum clube em figurinhas_data.js -> secao 'clubes'. nada a fazer.")
        return
    print(f"{len(items)} clubes na lista.\n")
    ok = miss = skip = 0
    misses = []
    for it in items:
        slug = it["slug"]
        if only and only not in slug and only not in (it.get("liga") or ""):
            continue
        dest = os.path.join(OUT, slug + ".png")
        if os.path.exists(dest) and not force:
            skip += 1
            continue
        term = it.get("busca") or it["nome"]
        data = get_json(API + urllib.parse.quote(term))
        team = best_match((data or {}).get("teams") or [], DB_COUNTRY.get(it.get("code")))
        badge = badge_of(team) if team else None
        if not badge:
            miss += 1
            misses.append(it["nome"])
            print(f"  -- {it['nome']}  (nao achei)")
            continue
        try:
            download(badge, dest)
            ok += 1
            print(f"  ok {it['nome']}  <- {team.get('strTeam')}")
        except Exception as e:
            miss += 1
            misses.append(it["nome"])
            print(f"  ERRO {it['nome']}: {e}")
        time.sleep(1.6)  # TheSportsDB (key publica) tem rate limit agressivo do Cloudflare
    print(f"\nbaixados: {ok} | ja tinha: {skip} | nao achou: {miss}")
    if misses:
        print("\nfaltaram (pegar na mao pelo estudio):")
        for m in misses:
            print("  - " + m)


if __name__ == "__main__":
    args = sys.argv[1:]
    only = args[args.index("--only") + 1] if "--only" in args and args.index("--only") + 1 < len(args) else None
    run(only=only, force=("--force" in args))
