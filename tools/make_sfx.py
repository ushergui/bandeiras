"""Sintetiza os efeitos sonoros "de jogo" que o pacote Kenney não cobre
(fanfarras, moeda, brilho de raridade, rasgo de pacote, etc.).
Gera .wav e converte pra .mp3 em assets/audio/effects/sfx/.

Somente numpy + wave + ffmpeg.
"""
import os
import struct
import subprocess
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "audio", "effects", "sfx")
os.makedirs(OUT, exist_ok=True)


def _env(n, a=0.01, d=0.1, s=0.6, r=0.2, sl=0.7):
    """ADSR simples."""
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    s = max(0, n - a - d - r)
    out = np.concatenate([
        np.linspace(0, 1, a, endpoint=False),
        np.linspace(1, sl, d, endpoint=False),
        np.full(s, sl),
        np.linspace(sl, 0, r),
    ])
    return out[:n] if len(out) >= n else np.pad(out, (0, n - len(out)))


def tone(freq, dur, kind="sine", vol=0.5, detune=0.0, **env):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + detune)
    if kind == "sine":
        w = np.sin(2 * np.pi * f * t)
    elif kind == "tri":
        w = 2 * np.abs(2 * (t * f - np.floor(t * f + 0.5))) - 1
    elif kind == "square":
        w = np.sign(np.sin(2 * np.pi * f * t))
    elif kind == "saw":
        w = 2 * (t * f - np.floor(t * f + 0.5))
    else:
        w = np.sin(2 * np.pi * f * t)
    # leve brilho: 2ª harmônica
    w = 0.8 * w + 0.2 * np.sin(2 * np.pi * 2 * f * t)
    return w * _env(n, **env) * vol


def noise(dur, vol=0.3, lp=None, **env):
    n = int(dur * SR)
    w = np.random.uniform(-1, 1, n)
    if lp:
        # filtro passa-baixa 1ª ordem
        a = np.exp(-2 * np.pi * lp / SR)
        for i in range(1, n):
            w[i] = a * w[i - 1] + (1 - a) * w[i]
        w /= (np.max(np.abs(w)) or 1)
    return w * _env(n, **env) * vol


def mix(*parts):
    m = max(len(p) for p in parts)
    out = np.zeros(m)
    for p in parts:
        out[:len(p)] += p
    peak = np.max(np.abs(out)) or 1
    return out / peak * 0.92


def seq(notes, gap=0.0):
    """notes: lista de arrays; concatena com gap opcional."""
    g = np.zeros(int(gap * SR))
    out = []
    for x in notes:
        out.append(x)
        out.append(g)
    return np.concatenate(out) if out else np.zeros(1)


NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(
    ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"])}


def nf(name, octave):
    return NOTE[name] * 2 ** (octave - 4)


def save(name, data):
    data = np.clip(data, -1, 1)
    pcm = (data * 32767).astype("<i2")
    wav = os.path.join(OUT, name + ".wav")
    with wave.open(wav, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    mp3 = os.path.join(OUT, name + ".mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav,
                    "-ac", "1", "-b:a", "96k", mp3], check=True)
    os.remove(wav)
    print("  ", name + ".mp3")


def build():
    # ACERTO — arpejo maior ascendente, curtinho e feliz
    save("correct", seq([
        tone(nf("C", 5), 0.09, "tri", 0.5, a=0.005, d=0.03, r=0.05, sl=0.5),
        tone(nf("E", 5), 0.09, "tri", 0.5, a=0.005, d=0.03, r=0.05, sl=0.5),
        tone(nf("G", 5), 0.16, "tri", 0.55, a=0.005, d=0.04, r=0.1, sl=0.5),
    ], gap=0.005))

    # ERRO — duas notas descendentes suaves (nada agressivo)
    save("wrong", seq([
        tone(nf("Ds", 4), 0.11, "tri", 0.45, a=0.005, d=0.05, r=0.05, sl=0.4),
        tone(nf("As", 3), 0.2, "tri", 0.42, a=0.005, d=0.06, r=0.12, sl=0.35),
    ], gap=0.01))

    # SEQUÊNCIA (streak) — brilho rápido
    save("streak", mix(
        tone(nf("G", 5), 0.12, "sine", 0.4, a=0.002, d=0.04, r=0.07, sl=0.4),
        tone(nf("D", 6), 0.12, "sine", 0.3, detune=0.01, a=0.01, d=0.05, r=0.06, sl=0.3),
        tone(nf("B", 6), 0.14, "sine", 0.22, a=0.03, d=0.05, r=0.06, sl=0.2),
    ))

    # LEVEL UP — fanfarra de 4 notas
    save("levelup", seq([
        tone(nf("C", 5), 0.1, "square", 0.32, a=0.004, d=0.03, r=0.04, sl=0.5),
        tone(nf("E", 5), 0.1, "square", 0.32, a=0.004, d=0.03, r=0.04, sl=0.5),
        tone(nf("G", 5), 0.1, "square", 0.32, a=0.004, d=0.03, r=0.04, sl=0.5),
        mix(tone(nf("C", 6), 0.32, "square", 0.34, a=0.004, d=0.06, r=0.2, sl=0.4),
            tone(nf("G", 5), 0.32, "tri", 0.2, a=0.004, d=0.06, r=0.2, sl=0.3)),
    ], gap=0.008))

    # VITÓRIA — acorde triunfante + subida
    chord = mix(
        tone(nf("C", 5), 0.7, "tri", 0.3, a=0.01, d=0.1, r=0.4, sl=0.5),
        tone(nf("E", 5), 0.7, "tri", 0.28, detune=0.005, a=0.01, d=0.1, r=0.4, sl=0.5),
        tone(nf("G", 5), 0.7, "tri", 0.28, a=0.01, d=0.1, r=0.4, sl=0.5),
        tone(nf("C", 6), 0.7, "sine", 0.22, a=0.02, d=0.1, r=0.4, sl=0.4),
    )
    save("victory", seq([
        tone(nf("G", 4), 0.09, "square", 0.28, a=0.004, d=0.03, r=0.03, sl=0.5),
        tone(nf("C", 5), 0.09, "square", 0.28, a=0.004, d=0.03, r=0.03, sl=0.5),
        tone(nf("E", 5), 0.09, "square", 0.28, a=0.004, d=0.03, r=0.03, sl=0.5),
        chord,
    ], gap=0.006))

    # DERROTA — 3 notas tristes descendo
    save("defeat", seq([
        tone(nf("E", 4), 0.16, "tri", 0.4, a=0.006, d=0.06, r=0.06, sl=0.4),
        tone(nf("Ds", 4), 0.16, "tri", 0.4, a=0.006, d=0.06, r=0.06, sl=0.4),
        tone(nf("C", 4), 0.4, "tri", 0.4, a=0.006, d=0.1, r=0.25, sl=0.35),
    ], gap=0.02))

    # MOEDA / RECOMPENSA — clássico "blip blip" (ganhou pacote)
    save("coin", seq([
        tone(nf("B", 5), 0.06, "square", 0.4, a=0.002, d=0.02, r=0.02, sl=0.6),
        tone(nf("E", 6), 0.24, "square", 0.4, a=0.002, d=0.05, r=0.16, sl=0.5),
    ], gap=0.0))

    # WHOOSH — troca de tela
    save("whoosh", noise(0.28, 0.35, lp=1400, a=0.05, d=0.08, r=0.14, sl=0.5))

    # RASGO DO PACOTE — ruído "papel" com modulação
    n = int(0.5 * SR)
    crin = np.random.uniform(-1, 1, n)
    am = (0.5 + 0.5 * np.sin(2 * np.pi * 22 * np.arange(n) / SR)) * np.random.uniform(0.4, 1, n)
    a = np.exp(-2 * np.pi * 3500 / SR)
    for i in range(1, n):
        crin[i] = a * crin[i - 1] + (1 - a) * crin[i]
    crin = crin / (np.max(np.abs(crin)) or 1) * am
    save("pack_tear", crin * _env(n, a=0.02, d=0.1, r=0.25, sl=0.6) * 0.6)

    # REVELAR COMUM — chime suave
    save("reveal_common", tone(nf("A", 5), 0.28, "sine", 0.4, a=0.004, d=0.08, r=0.18, sl=0.3))

    # REVELAR RARA — shimmer
    save("reveal_rare", mix(
        tone(nf("D", 5), 0.4, "sine", 0.32, a=0.005, d=0.1, r=0.25, sl=0.35),
        tone(nf("Fs", 5), 0.4, "sine", 0.28, detune=0.008, a=0.02, d=0.1, r=0.25, sl=0.3),
        tone(nf("A", 5), 0.42, "sine", 0.26, a=0.04, d=0.1, r=0.25, sl=0.25),
        tone(nf("D", 6), 0.44, "sine", 0.18, a=0.08, d=0.1, r=0.25, sl=0.2),
    ))

    # REVELAR LENDÁRIA — acorde grande + subida cintilante
    sparkle = seq([tone(nf(x, o), 0.05, "sine", 0.18, a=0.002, r=0.03, sl=0.4)
                   for x, o in [("D", 6), ("Fs", 6), ("A", 6), ("D", 7), ("Fs", 7)]], gap=0.0)
    big = mix(
        tone(nf("D", 4), 0.9, "tri", 0.3, a=0.01, d=0.15, r=0.5, sl=0.5),
        tone(nf("A", 4), 0.9, "tri", 0.26, detune=0.004, a=0.01, d=0.15, r=0.5, sl=0.45),
        tone(nf("D", 5), 0.9, "tri", 0.24, a=0.02, d=0.15, r=0.5, sl=0.4),
        tone(nf("Fs", 5), 0.9, "sine", 0.2, a=0.03, d=0.15, r=0.5, sl=0.35),
    )
    save("reveal_legend", mix(seq([sparkle, np.zeros(int(0.02 * SR))]), big))

    # COLAR FIGURINHA — "toc" + brilhinho
    save("sticker_paste", mix(
        noise(0.09, 0.3, lp=900, a=0.001, d=0.03, r=0.04, sl=0.3),
        tone(nf("C", 6), 0.16, "sine", 0.22, a=0.005, d=0.05, r=0.09, sl=0.2),
    ))

    # CONQUISTA — acorde alegre e curto
    save("achievement", mix(
        tone(nf("F", 5), 0.5, "tri", 0.3, a=0.006, d=0.1, r=0.3, sl=0.4),
        tone(nf("A", 5), 0.5, "tri", 0.28, detune=0.005, a=0.006, d=0.1, r=0.3, sl=0.4),
        tone(nf("C", 6), 0.52, "tri", 0.26, a=0.02, d=0.1, r=0.3, sl=0.35),
    ))

    # TROCA FEITA — dois "blip" (desce e sobe)
    save("trade", seq([
        tone(nf("A", 5), 0.1, "sine", 0.35, a=0.003, d=0.04, r=0.05, sl=0.4),
        tone(nf("E", 5), 0.1, "sine", 0.35, a=0.003, d=0.04, r=0.05, sl=0.4),
        tone(nf("A", 5), 0.16, "sine", 0.38, a=0.003, d=0.05, r=0.1, sl=0.4),
    ], gap=0.006))


if __name__ == "__main__":
    print("Sintetizando SFX em", os.path.abspath(OUT))
    build()
    print("OK")
