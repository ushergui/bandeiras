"""Converte os áudios .wav de curiosidades para .mp3 (voz, mono, 64 kbps).
Reduz ~331 MB -> ~30 MB e deixa a pasta publicável no Netlify.
Os .wav originais ficam (são ignorados pelo git); pode apagar depois de conferir.

Uso:
    python tools/convert_audio.py            # converte o que falta
    python tools/convert_audio.py --force    # reconverte tudo
    python tools/convert_audio.py --delete-wav   # apaga os .wav já convertidos
"""
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "assets", "audio", "curiosidades")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
FORCE = "--force" in sys.argv
DELETE_WAV = "--delete-wav" in sys.argv


def main():
    if not os.path.isdir(ROOT):
        print("Pasta não encontrada:", ROOT)
        return
    wavs = sorted(f for f in os.listdir(ROOT) if f.lower().endswith(".wav"))
    total = len(wavs)
    done = skipped = failed = 0
    for i, wav in enumerate(wavs, 1):
        src = os.path.join(ROOT, wav)
        dst = os.path.join(ROOT, wav[:-4] + ".mp3")
        if os.path.exists(dst) and not FORCE:
            skipped += 1
        else:
            r = subprocess.run(
                [FFMPEG, "-y", "-loglevel", "error", "-i", src,
                 "-ac", "1", "-ar", "22050", "-b:a", "64k", dst],
                capture_output=True, text=True,
            )
            if r.returncode == 0:
                done += 1
            else:
                failed += 1
                print("FALHOU:", wav, r.stderr.strip()[:200])
        if DELETE_WAV and os.path.exists(dst):
            os.remove(src)
        if i % 100 == 0 or i == total:
            print(f"[{i}/{total}] convertidos={done} pulados={skipped} falhas={failed}")
    print("Concluído.", f"convertidos={done} pulados={skipped} falhas={failed}")


if __name__ == "__main__":
    main()
