# -*- coding: utf-8 -*-
"""
Gera os audios do "Saber mais" das secoes ilustradas (lendas, frutas, clubes)
com a MESMA voz clonada pelo OmniVoice (assets/audio/ref_bandeiras.mp3).

Cada frase = "<nome>. <curiosidade>"  (a narradora fala o nome primeiro).
Saida (mp3 MONO leve ~48 kbps, ~15-25 KB cada):
  assets/audio/lendas/<code>-<slug-do-nome>.mp3
  assets/audio/frutas/<slug>.mp3
  assets/audio/clubes/<slug>.mp3

  python tools/gerar_fig_audios.py --frases        -> so escreve tools/_fig_frases.json (revisar, NAO carrega modelo)
  python tools/gerar_fig_audios.py teste           -> 5 audios, so pra testar
  python tools/gerar_fig_audios.py                 -> gera o que falta (lendas + frutas + clubes)
  python tools/gerar_fig_audios.py --set frutas    -> so uma secao (frutas | lendas | clubes | tudo)
  python tools/gerar_fig_audios.py --set tudo --force   -> REFAZ tudo
  python tools/gerar_fig_audios.py loop            -> carrega o modelo 1x e gera sob demanda

Flags: --force (sobrescreve), --only <txt>, --limit <n>
"""
import os, re, sys, json, time, subprocess, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_VENV_PY = os.path.join(ROOT, "venv", "Scripts", "python.exe")
_need_model = not ("--frases" in sys.argv)
if _need_model and os.path.exists(_VENV_PY) and os.path.abspath(sys.executable).lower() != os.path.abspath(_VENV_PY).lower():
    print("(usando o python da venv)", flush=True)
    os.execv(_VENV_PY, [_VENV_PY] + sys.argv)

for _c in (r"G:\AI\huggingface", r"C:\AI\huggingface"):
    if os.path.isdir(os.path.join(_c, "hub")):
        os.environ["HF_HOME"] = _c
        break


def log(m):
    print("[%s] %s" % (time.strftime("%H:%M:%S"), m), flush=True)


REF = "assets/audio/bandeiras/brasil.mp3"
for _r in ("assets/audio/ref_voz.mp3", "assets/audio/ref_bandeiras.mp3"):
    if os.path.exists(_r):
        REF = _r

FFMPEG = "ffmpeg"
for _cand in (r"C:\FFmpeg\bin\ffmpeg.exe", r"C:\ffmpeg\bin\ffmpeg.exe"):
    if os.path.exists(_cand):
        FFMPEG = _cand
        break


def slug_name(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def _fig_data():
    js = subprocess.check_output(
        ["node", "-e", "console.log(JSON.stringify(require('./figurinhas_data.js')))"],
        cwd=ROOT).decode("utf-8")
    return json.loads(js)


def _phrase(nome, cur):
    nome = (nome or "").strip()
    cur = (cur or "").strip()
    if not cur:
        return nome + "."
    # evita "Nome. Nome ..." se a curiosidade ja comeca com o nome
    if cur.lower().startswith(nome.lower()):
        return cur
    sep = " " if nome.endswith((".", "!", "?")) else ". "
    return nome + sep + cur


def set_frutas(F):
    return [("frutas/" + it["slug"], _phrase(it["n"], it.get("cur")))
            for it in F["frutas"]["itens"]]


def set_lendas(F):
    return [("lendas/" + it["code"] + "-" + slug_name(it["nome"]), _phrase(it["nome"], it.get("cur")))
            for it in F["lendas"]["itens"]]


def set_clubes(F):
    return [("clubes/" + it["slug"], _phrase(it["nome"], it.get("cur")))
            for it in F["clubes"]["itens"]]


SETS = {"frutas": set_frutas, "lendas": set_lendas, "clubes": set_clubes}
SET_TUDO = ["frutas", "lendas", "clubes"]


def build(setname):
    F = _fig_data()
    names = SET_TUDO if setname == "tudo" else [setname]
    tarefas = []
    for n in names:
        tarefas += SETS[n](F)
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
    log("carregando OmniVoice (1a vez ~4.6 GB -- aguarde SEM apertar Enter)...")
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
    # MONO, 48 kbps -> arquivo bem leve pro celular
    subprocess.run([FFMPEG, "-y", "-i", wav, "-ac", "1", "-ar", "24000",
                    "-codec:a", "libmp3lame", "-b:a", "48k", mp3],
                   check=True, capture_output=True)
    os.remove(wav)


def dump_frases(setname):
    fila = build(setname)
    data = [{"out": s, "text": t} for s, t in fila]
    open("tools/_fig_frases.json", "w", encoding="utf-8").write(
        json.dumps(data, ensure_ascii=False, indent=1))
    log("tools/_fig_frases.json  (%d frases) -- revise antes de gerar" % len(data))
    for d in data[:8]:
        print("  %-34s %s" % (d["out"], d["text"][:90]))


def run_batch(setname, only=None, limit=None, teste=False, force=False):
    import soundfile as sf
    if not os.path.exists(REF):
        log("ERRO: referencia de voz nao encontrada: " + REF); return
    fila = pendentes(build(setname), only=only, force=force)
    if teste:
        fila = fila[:5]
    if limit:
        fila = fila[:int(limit)]
    if not fila:
        log("nada a gerar (use --force pra refazer)."); return
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
    log('modo loop.  <caminho> | <frase>   ("sair" encerra)')
    while True:
        try:
            linha = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print(); break
        if linha.lower() in ("sair", "quit", "exit"):
            break
        if "|" not in linha:
            print("  formato:  caminho | frase"); continue
        saida, texto = [x.strip() for x in linha.split("|", 1)]
        if saida and texto:
            try:
                gen_one(model, sf, saida, texto)
                log("ok  assets/audio/%s.mp3" % saida)
            except Exception as e:
                log("ERRO: %s" % e)


if __name__ == "__main__":
    args = sys.argv[1:]

    def opt(name):
        return args[args.index(name) + 1] if name in args and args.index(name) + 1 < len(args) else None

    setname = opt("--set") or "tudo"
    if setname not in SETS and setname != "tudo":
        print("conjunto invalido:", setname, "| validos:", ", ".join(list(SETS) + ["tudo"]))
        sys.exit(1)

    if "--frases" in args:
        dump_frases(setname)
    elif "loop" in args:
        run_loop()
    else:
        run_batch(setname, only=opt("--only"), limit=opt("--limit"),
                  teste=("teste" in args), force=("--force" in args))
