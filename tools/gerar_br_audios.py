# -*- coding: utf-8 -*-
"""
Gera TODOS os audios do jogo com a voz clonada pelo OmniVoice
(assets/audio/ref_bandeiras.mp3 -> a mesma voz que ja estava no jogo).

O modelo demora pra carregar UMA vez por execucao (~3 min do SSD). Depois cada
frase leva ~3-4 s.

  python tools/gerar_br_audios.py                 -> conjunto "novos" (forca, mapa, br), pula existentes
  python tools/gerar_br_audios.py teste           -> 5 arquivos, so pra testar a voz
  python tools/gerar_br_audios.py loop            -> carrega o modelo 1x e fica gerando sob demanda
  python tools/gerar_br_audios.py --set <nome>    -> gera um conjunto especifico
  python tools/gerar_br_audios.py --set tudo --force   -> REFAZ tudo (menos curiosidades), sobrescrevendo

Conjuntos (--set):
  novos         forca_intro + mapa/<cod> + br/<uf>              (padrao)
  bandeiras     bandeiras/<pais>        "Qual e a bandeira <art> <pais>?"
  capitais      capitais/<capital>      "Qual pais tem a capital <capital>?"
  continentes   continente_do_pais/<pais> + pais_do_continente/<cont>
  nomes         nomes_paises/<pais>     "<pais>."
  curiosidades  curiosidades/<cod>_<i>  (texto de curiosities.js -- LENTO, ~1900 arquivos)
  tudo          novos + bandeiras + capitais + continentes + nomes  (NAO inclui curiosidades)

Flags:
  --force       sobrescreve os .mp3 que ja existem (necessario pra trocar a voz antiga)
  --only <txt>  so os arquivos cujo caminho contem <txt>
  --limit <n>   para depois de <n> gerados
  --pron        (re)gera nomes_paises/andorra e /georgia com dica de pronuncia

Dica: rode primeiro  `... teste`. Se a voz agradar, rode `... --set tudo --force`
(vai levar ~15-20 min) e, se quiser, `... --set curiosidades --force` depois
(esse sozinho leva ~2 h).
"""
import os, re, sys, time, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# se nao estiver no python da venv, re-executa nele (evita "No module named ...")
_VENV_PY = os.path.join(ROOT, "venv", "Scripts", "python.exe")
if os.path.exists(_VENV_PY) and os.path.abspath(sys.executable).lower() != os.path.abspath(_VENV_PY).lower():
    print("(usando o python da venv)", flush=True)
    os.execv(_VENV_PY, [_VENV_PY] + sys.argv)

# cache do modelo em SSD, se existir (carrega MUITO mais rapido)
for _c in (r"G:\AI\huggingface", r"C:\AI\huggingface"):
    if os.path.isdir(os.path.join(_c, "hub")):
        os.environ["HF_HOME"] = _c
        break
print("HF_HOME =", os.environ.get("HF_HOME", "(padrao)"), flush=True)


def log(m):
    print("[%s] %s" % (time.strftime("%H:%M:%S"), m), flush=True)


# voz de referencia: ref_bandeiras.mp3 (~20 s da voz que ja estava no jogo) tem prioridade
REF = "assets/audio/bandeiras/brasil.mp3"
for _r in ("assets/audio/ref_voz.mp3", "assets/audio/ref_bandeiras.mp3"):
    if os.path.exists(_r):
        REF = _r
print("REF     =", REF, flush=True)

FFMPEG = "ffmpeg"
for _cand in (r"C:\FFmpeg\bin\ffmpeg.exe", r"C:\ffmpeg\bin\ffmpeg.exe"):
    if os.path.exists(_cand):
        FFMPEG = _cand
        break


def game_slug(s):
    """mesma normalizacao do playAudio() em script.js: minusculo, espaco->_, tira ponto."""
    return s.lower().replace(" ", "_").replace(".", "")


def _paises():
    """lista (nome, codigo, artigo, continente, capital) a partir de countries.js."""
    txt = open("countries.js", encoding="utf-8").read()
    out = []
    rx = re.compile(
        r"nome:\s*'([^']+)',\s*'?codigo'?:\s*'([^']+)',\s*artigo:\s*'([^']+)',"
        r"\s*continente:\s*'([^']+)',\s*capital:\s*'([^']+)'")
    for m in rx.finditer(txt):
        out.append(dict(nome=m.group(1), cod=m.group(2), art=m.group(3),
                        cont=m.group(4), cap=m.group(5)))
    return out


ESTADOS = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia",
    "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás",
    "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul", "MG": "Minas Gerais",
    "PA": "Pará", "PB": "Paraíba", "PR": "Paraná", "PE": "Pernambuco", "PI": "Piauí",
    "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte", "RS": "Rio Grande do Sul",
    "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina", "SP": "São Paulo",
    "SE": "Sergipe", "TO": "Tocantins",
}


def set_novos():
    out = [("testes/forca_intro", "Adivinhe o país letra por letra.")]
    for p in _paises():
        out.append(("mapa/" + p["cod"], "Toque no contorno %s %s." % (p["art"], p["nome"])))
    for uf, nome in ESTADOS.items():
        out.append(("mapa/uf-" + uf.lower(), "Toque no contorno do estado %s." % nome))
    # curiosidades das bandeiras e paisagens dos estados (curiosities_br.js)
    try:
        txt = open("curiosities_br.js", encoding="utf-8").read()
        for grupo, pref in (("bandeiras", "bandeira"), ("paisagens", "paisagem")):
            bloco = re.search(grupo + r":\s*\{(.+?)\n  \},", txt, re.S).group(1)
            for m in re.finditer(r'([A-Z]{2}):\s*"((?:[^"\\]|\\.)*)"', bloco):
                uf, frase = m.group(1), m.group(2).encode().decode("unicode_escape")
                out.append(("br/%s_%s" % (pref, uf.lower()), frase))
    except Exception as e:
        log("aviso: curiosities_br.js nao lido (%s)" % e)
    return out


def set_bandeiras():
    return [("bandeiras/" + game_slug(p["nome"]),
             "Qual é a bandeira %s %s?" % (p["art"], p["nome"])) for p in _paises()]


def set_capitais():
    return [("capitais/" + game_slug(p["cap"]),
             "Qual país tem a capital %s?" % p["cap"]) for p in _paises()]


def set_continentes():
    out = []
    conts = []
    for p in _paises():
        out.append(("continente_do_pais/" + game_slug(p["nome"]),
                    "Qual é o continente %s %s?" % (p["art"], p["nome"])))
        if p["cont"] not in conts:
            conts.append(p["cont"])
    for c in conts:
        out.append(("pais_do_continente/" + game_slug(c),
                    "Qual destes países faz parte da %s?" % c))
    return out


def set_nomes():
    return [("nomes_paises/" + game_slug(p["nome"]), p["nome"] + ".") for p in _paises()]


def set_curiosidades():
    """le curiosities.js -> curiosidades/<cod>_<idx>."""
    txt = open("curiosities.js", encoding="utf-8").read()
    out, cod = [], None
    for line in txt.splitlines():
        line = line.strip()
        m = re.match(r"'([a-z-]+)'\s*:\s*\[", line)
        if m:
            cod = m.group(1); idx = 0; continue
        if cod and line.startswith('"'):
            fato = line.rstrip(",").strip('"')
            if fato:
                out.append(("curiosidades/%s_%d" % (cod, idx), fato)); idx += 1
    return out


SETS = {
    "novos": set_novos, "bandeiras": set_bandeiras, "capitais": set_capitais,
    "continentes": set_continentes, "nomes": set_nomes, "curiosidades": set_curiosidades,
}
SET_TUDO = ["novos", "bandeiras", "capitais", "continentes", "nomes"]


def build(setname, pron=False):
    tarefas = []
    names = SET_TUDO if setname == "tudo" else [setname]
    for n in names:
        tarefas += SETS[n]()
    if pron:
        tarefas += [
            ("nomes_paises/andorra", "Andorra. An-dó-rra."),
            ("nomes_paises/georgia", "Geórgia. Jê-ór-jia."),
        ]
    # tira duplicados mantendo ordem
    seen, uniq = set(), []
    for s, t in tarefas:
        if s not in seen:
            seen.add(s); uniq.append((s, t))
    return uniq


def pendentes(tarefas, only=None, force=False):
    out = []
    for saida, texto in tarefas:
        if only and only not in saida:
            continue
        if not force and os.path.exists("assets/audio/%s.mp3" % saida):
            continue
        out.append((saida, texto))
    return out


def load_model():
    import torch
    from omnivoice import OmniVoice
    log("carregando OmniVoice (1a vez le ~4.6 GB -- aguarde SEM apertar Enter)...")
    t0 = time.time()
    model = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cuda:0", dtype=torch.float16)
    log("modelo pronto em %.0f s" % (time.time() - t0))
    return model


def gen_one(model, sf, saida, texto):
    wav = "assets/audio/%s.wav" % saida
    mp3 = "assets/audio/%s.mp3" % saida
    os.makedirs(os.path.dirname(wav), exist_ok=True)
    audio = model.generate(text=texto, ref_audio=REF)
    sf.write(wav, audio[0], 24000)
    subprocess.run([FFMPEG, "-y", "-i", wav, "-codec:a", "libmp3lame", "-q:a", "4", mp3],
                   check=True, capture_output=True)
    os.remove(wav)


def run_batch(setname, only=None, limit=None, teste=False, force=False, pron=False):
    import soundfile as sf
    if not os.path.exists(REF):
        log("ERRO: referencia de voz nao encontrada: " + REF); return
    fila = pendentes(build(setname, pron), only=only, force=force or pron)
    if teste:
        fila = fila[:5]
    if limit:
        fila = fila[:int(limit)]
    if not fila:
        log("nada a gerar (use --force pra sobrescrever os que ja existem)."); return
    log("conjunto '%s': %d audios na fila." % (setname, len(fila)))
    model = load_model()
    ok = 0
    for i, (saida, texto) in enumerate(fila, 1):
        try:
            t0 = time.time()
            gen_one(model, sf, saida, texto)
            ok += 1
            log("[%d/%d] ok  %s  (%.1fs)" % (i, len(fila), saida, time.time() - t0))
        except Exception as e:
            log("[%d/%d] ERRO %s: %s" % (i, len(fila), saida, e))
    log("concluido. gerados: %d" % ok)


def run_loop():
    import soundfile as sf
    model = load_model()
    log('modo loop. digite:  <caminho> | <frase>   (ex:  testes/oi | Ola, tudo bem?)')
    log('"sair" encerra.')
    while True:
        try:
            linha = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print(); break
        if not linha:
            continue
        if linha.lower() in ("sair", "quit", "exit"):
            break
        if "|" not in linha:
            print("  formato:  caminho | frase"); continue
        saida, texto = [x.strip() for x in linha.split("|", 1)]
        if not saida or not texto:
            print("  faltou caminho ou frase"); continue
        try:
            t0 = time.time()
            gen_one(model, sf, saida, texto)
            log("ok  assets/audio/%s.mp3  (%.1fs)" % (saida, time.time() - t0))
        except Exception as e:
            log("ERRO: %s" % e)


if __name__ == "__main__":
    args = sys.argv[1:]

    def opt(name):
        return args[args.index(name) + 1] if name in args and args.index(name) + 1 < len(args) else None

    if "loop" in args:
        run_loop()
    else:
        setname = opt("--set") or "novos"
        if setname not in SETS and setname != "tudo":
            print("conjunto invalido:", setname, "\nvalidos:", ", ".join(list(SETS) + ["tudo"]))
            sys.exit(1)
        run_batch(setname,
                  only=opt("--only"), limit=opt("--limit"),
                  teste=("teste" in args), force=("--force" in args), pron=("--pron" in args))
