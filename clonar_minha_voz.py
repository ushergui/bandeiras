import os
import torch
import soundfile as sf
from omnivoice import OmniVoice

def clonar_minha_voz(audio_referencia='assets/audio/testes/minha_voz.wav', texto=''):
    if not os.path.exists(audio_referencia):
        for ext in ['.mp3', '.m4a', '.ogg']:
            cand = os.path.splitext(audio_referencia)[0] + ext
            if os.path.exists(cand):
                audio_referencia = cand
                break
        else:
            print(f'ERRO: Nao encontrei o arquivo de voz em: {audio_referencia}')
            print('Coloque uma gravacao da sua voz (5 a 15s) na pasta assets/audio/testes/ com o nome minha_voz.wav ou minha_voz.mp3')
            return

    print(f'-> Carregando modelo OmniVoice na GPU (RTX 3070)...')
    model = OmniVoice.from_pretrained('k2-fsa/OmniVoice', device_map='cuda:0', dtype=torch.float16)

    if not texto:
        texto = 'Ola! Esta e a minha propria voz clonada pelo OmniVoice para narrar o jogo das bandeiras e o album de figurinhas.'

    print(f'-> Clonando voz a partir de: {audio_referencia}')
    print(f'-> Gerando fala: \'{texto}\'')

    audio = model.generate(text=texto, ref_audio=audio_referencia)
    saida = 'assets/audio/testes/minha_voz_gerada.wav'
    sf.write(saida, audio[0], 24000)
    print(f'-> SUCESSO: Audio gerado em: {saida}')

if __name__ == '__main__':
    clonar_minha_voz()
