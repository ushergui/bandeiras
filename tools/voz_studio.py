# -*- coding: utf-8 -*-
"""
Estudio de voz local (OmniVoice) -- ferramenta de desenvolvimento.

Sobe um servidorzinho + pagina em http://localhost:5001 onde voce:
  - cadastra vozes de referencia (sobe um audio de 5 a 15 s)
  - escreve um texto, escolhe a voz e gera o audio nessa voz
  - ouve e baixa o resultado na propria tela
  - opcional: salva direto em assets/audio/<caminho>.mp3

NAO faz parte do site. Roda so na sua maquina, com a GPU.
Rodar:  venv\\Scripts\\python.exe tools\\voz_studio.py
"""
import os, sys, io, time, uuid, glob, subprocess, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# re-executa no python da venv se preciso
_VENV_PY = os.path.join(ROOT, "venv", "Scripts", "python.exe")
if os.path.exists(_VENV_PY) and os.path.abspath(sys.executable).lower() != os.path.abspath(_VENV_PY).lower():
    print("(usando o python da venv)", flush=True)
    os.execv(_VENV_PY, [_VENV_PY] + sys.argv)

for _c in (r"G:\AI\huggingface", r"C:\AI\huggingface"):
    if os.path.isdir(os.path.join(_c, "hub")):
        os.environ["HF_HOME"] = _c
        break

FFMPEG = "ffmpeg"
for _cand in (r"C:\FFmpeg\bin\ffmpeg.exe", r"C:\ffmpeg\bin\ffmpeg.exe"):
    if os.path.exists(_cand):
        FFMPEG = _cand
        break

VOICES_DIR = os.path.join(ROOT, "tools", "vozes")
OUT_DIR = os.path.join(ROOT, "tools", "_studio_out")
os.makedirs(VOICES_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

# vozes que ja existem no jogo entram na lista automaticamente
SEED_VOICES = [
    ("ref_bandeiras (voz do jogo)", os.path.join(ROOT, "assets", "audio", "ref_bandeiras.mp3")),
]

_lock = threading.Lock()
_model = None
_sf = None


def log(m):
    print("[%s] %s" % (time.strftime("%H:%M:%S"), m), flush=True)


def load_model():
    global _model, _sf
    import torch, soundfile as sf
    from omnivoice import OmniVoice
    log("carregando OmniVoice (1a vez le ~4.6 GB do disco, ~3 min)...")
    t0 = time.time()
    _model = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cuda:0", dtype=torch.float16)
    _sf = sf
    log("modelo pronto em %.0f s  ->  abra http://localhost:5001" % (time.time() - t0))


def voices_list():
    out = []
    for nome, path in SEED_VOICES:
        if os.path.exists(path):
            out.append({"id": "seed:" + os.path.basename(path), "nome": nome, "path": path, "seed": True})
    for f in sorted(glob.glob(os.path.join(VOICES_DIR, "*"))):
        if f.lower().endswith((".mp3", ".wav", ".m4a", ".ogg", ".flac")):
            out.append({"id": os.path.basename(f), "nome": os.path.splitext(os.path.basename(f))[0],
                        "path": f, "seed": False})
    return out


def voice_path(vid):
    for v in voices_list():
        if v["id"] == vid:
            return v["path"]
    return None


def generate(texto, ref_path):
    with _lock:
        audio = _model.generate(text=texto, ref_audio=ref_path)
    name = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:4] + ".mp3"
    wav = os.path.join(OUT_DIR, name[:-4] + ".wav")
    mp3 = os.path.join(OUT_DIR, name)
    _sf.write(wav, audio[0], 24000)
    subprocess.run([FFMPEG, "-y", "-i", wav, "-codec:a", "libmp3lame", "-q:a", "3", mp3],
                   check=True, capture_output=True)
    os.remove(wav)
    return name


# ---------------------------------------------------------------- servidor
from flask import Flask, request, jsonify, send_from_directory, Response

app = Flask(__name__)


@app.get("/")
def index():
    return Response(PAGE, mimetype="text/html")


@app.get("/api/voices")
def api_voices():
    return jsonify([{"id": v["id"], "nome": v["nome"], "seed": v["seed"]} for v in voices_list()])


@app.post("/api/voices")
def api_voice_add():
    f = request.files.get("file")
    nome = (request.form.get("nome") or "").strip()
    if not f or not nome:
        return jsonify({"erro": "faltou arquivo ou nome"}), 400
    ext = os.path.splitext(f.filename)[1].lower() or ".mp3"
    safe = "".join(c for c in nome if c.isalnum() or c in " -_").strip().replace(" ", "_")
    f.save(os.path.join(VOICES_DIR, safe + ext))
    return jsonify({"ok": True})


@app.delete("/api/voices/<vid>")
def api_voice_del(vid):
    p = os.path.join(VOICES_DIR, vid)
    if os.path.isfile(p) and os.path.dirname(p) == VOICES_DIR:
        os.remove(p)
        return jsonify({"ok": True})
    return jsonify({"erro": "nao achei"}), 404


@app.post("/api/generate")
def api_generate():
    if _model is None:
        return jsonify({"erro": "modelo ainda carregando, aguarde"}), 503
    d = request.get_json(force=True)
    texto = (d.get("texto") or "").strip()
    ref = voice_path(d.get("voz"))
    if not texto:
        return jsonify({"erro": "escreva um texto"}), 400
    if not ref:
        return jsonify({"erro": "escolha uma voz"}), 400
    try:
        t0 = time.time()
        name = generate(texto, ref)
        return jsonify({"ok": True, "url": "/out/" + name, "name": name, "segundos": round(time.time() - t0, 1)})
    except Exception as e:
        log("ERRO generate: %s" % e)
        return jsonify({"erro": str(e)}), 500


@app.get("/out/<name>")
def api_out(name):
    return send_from_directory(OUT_DIR, name, mimetype="audio/mpeg")


@app.get("/api/history")
def api_history():
    fs = sorted(glob.glob(os.path.join(OUT_DIR, "*.mp3")), reverse=True)[:40]
    return jsonify([os.path.basename(f) for f in fs])


@app.post("/api/save")
def api_save():
    d = request.get_json(force=True)
    name = d.get("name") or ""
    destino = (d.get("destino") or "").strip().lstrip("/\\")
    src = os.path.join(OUT_DIR, name)
    if not os.path.isfile(src) or ".." in destino or not destino:
        return jsonify({"erro": "dados invalidos"}), 400
    if not destino.lower().endswith(".mp3"):
        destino += ".mp3"
    dst = os.path.join(ROOT, "assets", "audio", destino)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    import shutil
    shutil.copyfile(src, dst)
    log("salvo -> assets/audio/%s" % destino)
    return jsonify({"ok": True, "destino": "assets/audio/" + destino})


PAGE = r"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Estudio de Voz</title>
<style>
 :root{--bg:#0e1626;--sf:#16233b;--sf2:#1d2c48;--ink:#eef2f8;--mut:#8b9ab2;--line:rgba(255,255,255,.12);--acc:#f0a94a;--good:#55d39b}
 *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,Segoe UI,sans-serif}
 .wrap{max-width:760px;margin:0 auto;padding:24px 18px 80px}
 h1{font-size:1.4rem;margin:0 0 4px}.sub{color:var(--mut);font-size:.85rem;margin-bottom:22px}
 .card{background:var(--sf);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:16px}
 .card h2{font-size:1rem;margin:0 0 12px}
 label{display:block;font-size:.78rem;font-weight:700;color:var(--mut);margin:10px 0 4px;text-transform:uppercase;letter-spacing:.03em}
 input,select,textarea{width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line);background:var(--sf2);color:var(--ink);font:inherit}
 textarea{min-height:90px;resize:vertical}
 button{padding:10px 18px;border:0;border-radius:9px;background:var(--acc);color:#1a1300;font:inherit;font-weight:800;cursor:pointer}
 button.ghost{background:var(--sf2);color:var(--ink);border:1px solid var(--line)}
 button:disabled{opacity:.5;cursor:wait}
 .row{display:flex;gap:10px;flex-wrap:wrap;align-items:end}
 .row>*{flex:1;min-width:120px}
 .vlist{display:flex;flex-direction:column;gap:6px;margin-top:8px}
 .vitem{display:flex;align-items:center;gap:8px;background:var(--sf2);border-radius:8px;padding:7px 10px;font-size:.9rem}
 .vitem .x{margin-left:auto;background:none;color:var(--mut);border:0;cursor:pointer;font-size:1rem;padding:0 4px}
 .msg{font-size:.85rem;margin-top:10px;min-height:18px}
 .msg.err{color:#ff8a8a}.msg.ok{color:var(--good)}
 audio{width:100%;margin-top:12px}
 .hist{font-size:.82rem;color:var(--mut)}.hist a{color:var(--acc);text-decoration:none}
 .hint{font-size:.76rem;color:var(--mut);margin-top:4px}
</style></head><body><div class="wrap">
 <h1>Estudio de Voz</h1>
 <div class="sub">OmniVoice local — clona a voz de referencia e fala o texto. Ferramenta de dev, nao vai pro site.</div>

 <div class="card">
  <h2>1 · Vozes de referencia</h2>
  <div class="row">
   <div style="flex:2"><label>arquivo de audio (5 a 15 s, voz limpa)</label><input type="file" id="vfile" accept="audio/*"></div>
   <div><label>nome</label><input id="vnome" placeholder="ex: narradora"></div>
   <div style="flex:0 0 auto"><button id="vadd">Cadastrar</button></div>
  </div>
  <div class="vlist" id="vlist"></div>
  <div class="msg" id="vmsg"></div>
 </div>

 <div class="card">
  <h2>2 · Gerar</h2>
  <label>voz</label><select id="voz"></select>
  <label>texto</label><textarea id="texto" placeholder="Digite a frase que a voz vai falar..."></textarea>
  <div style="margin-top:12px"><button id="gen">Gerar audio</button></div>
  <div class="msg" id="gmsg"></div>
  <audio id="player" controls hidden></audio>
  <div id="saverow" hidden>
   <label>salvar direto em assets/audio/ (opcional)</label>
   <div class="row">
    <input id="destino" placeholder="ex: bandeiras/franca  ou  testes/oi">
    <div style="flex:0 0 auto"><button class="ghost" id="save">Salvar no projeto</button></div>
   </div>
   <div class="hint">nao precisa por .mp3. cria a pasta se nao existir.</div>
  </div>
 </div>

 <div class="card">
  <h2>Historico da sessao</h2>
  <div class="hist" id="hist">—</div>
 </div>
</div>
<script>
const $=s=>document.querySelector(s), api=(u,o)=>fetch(u,o).then(r=>r.json());
let lastName=null;

async function loadVoices(){
 const vs=await api('/api/voices');
 $('#voz').innerHTML=vs.map(v=>`<option value="${v.id}">${v.nome}</option>`).join('');
 $('#vlist').innerHTML=vs.map(v=>`<div class="vitem">${v.seed?'★ ':''}${v.nome}${v.seed?'':`<button class="x" data-id="${v.id}">✕</button>`}</div>`).join('');
 document.querySelectorAll('.vitem .x').forEach(b=>b.onclick=async()=>{
  await fetch('/api/voices/'+encodeURIComponent(b.dataset.id),{method:'DELETE'}); loadVoices();
 });
}
$('#vadd').onclick=async()=>{
 const f=$('#vfile').files[0], nome=$('#vnome').value.trim();
 if(!f||!nome){$('#vmsg').className='msg err';$('#vmsg').textContent='escolha o arquivo e ponha um nome';return;}
 const fd=new FormData();fd.append('file',f);fd.append('nome',nome);
 const r=await fetch('/api/voices',{method:'POST',body:fd}).then(x=>x.json());
 $('#vmsg').className='msg '+(r.ok?'ok':'err');
 $('#vmsg').textContent=r.ok?'voz cadastrada':(r.erro||'erro');
 if(r.ok){$('#vfile').value='';$('#vnome').value='';loadVoices();}
};
$('#gen').onclick=async()=>{
 const b=$('#gen');b.disabled=true;b.textContent='gerando...';
 $('#gmsg').className='msg';$('#gmsg').textContent='';
 const r=await api('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({texto:$('#texto').value,voz:$('#voz').value})});
 b.disabled=false;b.textContent='Gerar audio';
 if(r.ok){
  lastName=r.name;
  const p=$('#player');p.src=r.url+'?t='+Date.now();p.hidden=false;p.play();
  $('#saverow').hidden=false;
  $('#gmsg').className='msg ok';$('#gmsg').textContent='pronto em '+r.segundos+'s';
  loadHist();
 }else{$('#gmsg').className='msg err';$('#gmsg').textContent=r.erro||'erro';}
};
$('#save').onclick=async()=>{
 if(!lastName)return;
 const r=await api('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({name:lastName,destino:$('#destino').value})});
 $('#gmsg').className='msg '+(r.ok?'ok':'err');
 $('#gmsg').textContent=r.ok?('salvo em '+r.destino):(r.erro||'erro');
};
async function loadHist(){
 const h=await api('/api/history');
 $('#hist').innerHTML=h.length?h.map(n=>`<a href="/out/${n}" target="_blank">${n}</a>`).join('<br>'):'—';
}
loadVoices();loadHist();
</script></body></html>"""


if __name__ == "__main__":
    print("=" * 60, flush=True)
    load_model()
    print("=" * 60, flush=True)
    app.run(host="127.0.0.1", port=5001, threaded=True, debug=False)
