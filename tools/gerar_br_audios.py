# -*- coding: utf-8 -*-
"""
Gera os áudios novos com a MESMA voz dos outros (assets/audio/bandeiras/brasil.mp3).
Precisa do OmniVoice instalado (mesmo do gerar_curiosidades_omnivoice.py).

Saídas:
  assets/audio/testes/forca_intro.mp3              -> intro do modo Forca
  assets/audio/mapa/<codigo>.mp3                   -> "Toque no contorno d{o|a} {pais}"  (paises + estados)
  assets/audio/br/bandeira_<uf>.mp3               -> historia da bandeira do estado
  assets/audio/br/paisagem_<uf>.mp3              -> explicacao da paisagem da capital
  (opcional) recria andorra / georgia com dica de pronuncia

Roda:  python tools/gerar_br_audios.py
"""
import os, re, json, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# voz de referência que o OmniVoice clona. Troque aqui se gerar uma nova
# (ex.: uma amostra do ElevenLabs salva em assets/audio/ref_voz.mp3)
REF = "assets/audio/bandeiras/brasil.mp3"
if os.path.exists("assets/audio/ref_voz.mp3"):
    REF = "assets/audio/ref_voz.mp3"

FFMPEG = "ffmpeg"
for cand in (r"C:\FFmpeg\bin\ffmpeg.exe", r"C:\ffmpeg\bin\ffmpeg.exe"):
    if os.path.exists(cand):
        FFMPEG = cand
        break


def _read_js_object(path, var):
    """extrai um objeto JS simples (chaves entre aspas) -> dict python (best effort)."""
    txt = open(path, encoding="utf-8").read()
    txt = txt[txt.index(var):]
    # pega tudo entre a 1a { e o } que fecha no nivel 0
    depth = 0
    start = txt.index("{")
    for i in range(start, len(txt)):
        if txt[i] == "{":
            depth += 1
        elif txt[i] == "}":
            depth -= 1
            if depth == 0:
                blob = txt[start:i + 1]
                break
    return blob


def frases_mapa():
    """(codigo, texto) para paises (countries.js) e estados (collections.js)."""
    out = []
    cj = open("countries.js", encoding="utf-8").read()
    for m in re.finditer(r"nome:\s*'([^']+)',\s*codigo:\s*'([^']+)',\s*artigo:\s*'([^']+)'", cj):
        nome, cod, art = m.group(1), m.group(2), m.group(3)
        out.append((cod, f"Toque no contorno {art} {nome}."))
    # estados
    ests = {
        "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia",
        "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás",
        "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul", "MG": "Minas Gerais",
        "PA": "Pará", "PB": "Paraíba", "PR": "Paraná", "PE": "Pernambuco", "PI": "Piauí",
        "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte", "RS": "Rio Grande do Sul",
        "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina", "SP": "São Paulo",
        "SE": "Sergipe", "TO": "Tocantins",
    }
    for uf, nome in ests.items():
        out.append((f"uf-{uf.lower()}", f"Toque no contorno do estado {nome}."))
    return out


def frases_br():
    """(saida, texto) da historia das bandeiras e das paisagens."""
    import importlib.util
    # parse manual do curiosities_br.js
    txt = open("curiosities_br.js", encoding="utf-8").read()
    out = []
    for grupo, prefixo in (("bandeiras", "bandeira"), ("paisagens", "paisagem")):
        bloco = re.search(grupo + r":\s*\{(.+?)\n  \},", txt, re.S).group(1)
        for m in re.finditer(r'([A-Z]{2}):\s*"((?:[^"\\]|\\.)*)"', bloco):
            uf, frase = m.group(1), m.group(2).encode().decode("unicode_escape")
            out.append((f"br/{prefixo}_{uf.lower()}", frase))
    return out


def gerar(model, sf, torch, tarefas):
    novos = 0
    for saida, texto in tarefas:
        wav = f"assets/audio/{saida}.wav"
        mp3 = f"assets/audio/{saida}.mp3"
        os.makedirs(os.path.dirname(wav), exist_ok=True)
        if os.path.exists(mp3):
            continue
        try:
            audio = model.generate(text=texto, ref_audio=REF)
            sf.write(wav, audio[0], 24000)
            subprocess.run([FFMPEG, "-y", "-i", wav, "-codec:a", "libmp3lame", "-q:a", "4", mp3],
                           check=True, capture_output=True)
            os.remove(wav)
            novos += 1
            print(f"  ok  {saida}")
        except Exception as e:
            print(f"  ERRO {saida}: {e}")
    return novos


if __name__ == "__main__":
    import torch, soundfile as sf
    from omnivoice import OmniVoice

    print("Carregando OmniVoice...")
    model = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cuda:0", dtype=torch.float16)

    tarefas = []
    tarefas.append(("testes/forca_intro", "Adivinhe o país letra por letra."))
    tarefas += frases_mapa()
    tarefas += frases_br()
    # correções de pronúncia (descomente pra regerar)
    # tarefas.append(("nomes_paises/andorra", "Andorra."))
    # tarefas.append(("nomes_paises/georgia", "Geórgia."))

    print(f"{len(tarefas)} áudios a gerar (pula os que já existem)...")
    n = gerar(model, sf, torch, tarefas)
    print(f"Concluído. Novos: {n}")
