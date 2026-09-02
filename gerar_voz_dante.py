# -*- coding: utf-8 -*-
import os, torch, soundfile as sf
from omnivoice import OmniVoice

text = 'O Melhor jogador do mundo é o Messi e Pelé, depois Ronaldo fenômeno e Maradona e depois Ronaldinho Gaúcho e Neymar, Cristiano Ronaldo vem por último.'
ref_audio = r'D:\Bandeiras\assets\audio\testes\Voz Dante.m4a'
output_wav = r'D:\Bandeiras\assets\audio\testes\voz_dante_resultado.wav'

print('-> Carregando OmniVoice na RTX 3070...')
model = OmniVoice.from_pretrained('k2-fsa/OmniVoice', device_map='cuda:0', dtype=torch.float16)

print(f'-> Clonando voz de: {ref_audio}')
print(f'-> Texto: {text}')

audio = model.generate(text=text, ref_audio=ref_audio)

sf.write(output_wav, audio[0], 24000)
print(f'-> Audio gerado com sucesso: {output_wav}')
