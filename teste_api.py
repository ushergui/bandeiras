import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

def testar_api():
    chave_api = os.getenv("ELEVENLABS_API_KEY")
    
    if not chave_api:
        print("ERRO: Chave API não encontrada no arquivo .env")
        return
    
    print(f"Chave API encontrada: {chave_api[:10]}...")
    
    try:
        client = ElevenLabs(api_key=chave_api)
        
        # Tenta listar as vozes para verificar se a API funciona
        voices = client.voices.get_all()
        print(f"Conexão bem-sucedida! Encontradas {len(voices.voices)} vozes disponíveis.")
        
        # Lista algumas vozes
        print("\nAlgumas vozes disponíveis:")
        for i, voice in enumerate(voices.voices[:5]):
            print(f"- {voice.name} (ID: {voice.voice_id})")
            
    except Exception as e:
        print(f"Erro na conexão: {e}")
        print("Possíveis causas:")
        print("1. Chave API inválida")
        print("2. Conta sem créditos")
        print("3. Problema de rede")

if __name__ == "__main__":
    testar_api()
