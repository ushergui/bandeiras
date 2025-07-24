import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs import save

load_dotenv()

def gerar_audios():
    """Função principal para gerar os áudios."""
    
    CHAVE_API = os.getenv("ELEVENLABS_API_KEY")

    if not CHAVE_API:
        print("ERRO CRÍTICO: Chave 'ELEVENLABS_API_KEY' não encontrada no arquivo .env")
        return

    # Lista de países
    paises_info = [
        {'nome': 'Brasil', 'artigo': 'do'},
        {'nome': 'Japão', 'artigo': 'do'},
        {'nome': 'Itália', 'artigo': 'da'},
        {'nome': 'Canadá', 'artigo': 'do'},
        {'nome': 'Argentina', 'artigo': 'da'},
        {'nome': 'França', 'artigo': 'da'},
        {'nome': 'Alemanha', 'artigo': 'da'},
        {'nome': 'Estados Unidos', 'artigo': 'dos'}
    ]

    output_folder = "assets/audio"

    try:
        client = ElevenLabs(api_key=CHAVE_API)
        os.makedirs(output_folder, exist_ok=True)

        # ID da voz George (já confirmado que funciona)
        voice_id = "XrExE9yKIg1WjnnlVkGX"
        
        print(f"Usando a voz: George (ID: {voice_id})")
        print("Gerando arquivos de áudio com a voz da ElevenLabs...")
        
        for pais in paises_info:
            nome_pais = pais['nome']
            artigo_pais = pais['artigo']
            texto_pergunta = f'Qual é a bandeira {artigo_pais} {nome_pais}?'
            
            try:
                # SINTAXE CORRETA para versão 2.8.0
                audio_gerado = client.text_to_speech.convert(
                    voice_id=voice_id,
                    text=texto_pergunta,
                    model_id="eleven_multilingual_v2"
                )

                nome_arquivo = f"{nome_pais.lower().replace(' ', '_')}.mp3"
                caminho_completo = os.path.join(output_folder, nome_arquivo)
                save(audio_gerado, caminho_completo)
                print(f" -> Áudio para '{nome_pais}' gerado com sucesso!")
                
            except Exception as e:
                print(f" -> ERRO ao gerar áudio para '{nome_pais}': {e}")
                continue

        print("\n✅ Todos os áudios foram gerados com sucesso!")

    except Exception as e:
        print(f"\nOcorreu um erro inesperado: {e}")

if __name__ == "__main__":
    gerar_audios()
