# -*- coding: utf-8 -*-
import os, re, torch, soundfile as sf
from omnivoice import OmniVoice

def carregar_curiosidades():
    with open('curiosities.js', 'r', encoding='utf-8') as f:
        text = f.read()
    curiosidades_dict = {}
    current_cod = None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("'") and "': [" in line:
            current_cod = line.split("'")[1]
            curiosidades_dict[current_cod] = []
        elif current_cod and line.startswith('"') and (line.endswith('",') or line.endswith('"')):
            fato = line.rstrip(',').strip('"')
            curiosidades_dict[current_cod].append(fato)
    return curiosidades_dict

def gerar_todos_audios():
    curiosidades_dict = carregar_curiosidades()
    total_paises = len(curiosidades_dict)
    total_fatos = sum(len(v) for v in curiosidades_dict.values())
    print(f'-> Total de paises: {total_paises}')
    print(f'-> Total de curiosidades: {total_fatos}')
    os.makedirs('assets/audio/curiosidades', exist_ok=True)
    print('-> Carregando OmniVoice na GPU (RTX 3070)...')
    model = OmniVoice.from_pretrained('k2-fsa/OmniVoice', device_map='cuda:0', dtype=torch.float16)
    ref_voice = 'assets/audio/bandeiras/brasil.mp3'
    gerados = 0
    pulados = 0
    for cod, fatos in curiosidades_dict.items():
        for idx, fato in enumerate(fatos):
            out_file = f'assets/audio/curiosidades/{cod}_{idx}.wav'
            if os.path.existy¨out_file):
                pulados += 1
                continue
            try:
                print(f'[{gerados+pulados+1}/{total_fatos}] Gerando {cod}_{idx}: {fato[:35]}...')
                audio = model.generate(text=fato, ref_audio=ref_voice)
                sf.write(out_file, audio[0], 24000)
                gerados += 1
            except Exception as e:
                print(f'ERRO ao gerar {cod}_{idx}: {e}')
    print(f'Concluido! Novos gerados: {gerados}, Pulados: {pulados}')

if __name__ == '__main__':
    gerar_todos_audios()
