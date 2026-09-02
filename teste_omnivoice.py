import os
import torch

def testar_ambiente_omnivoice():
    print("=" * 60)
    print("VERIFICAÇÃO DE AMBIENTE & SEGURANÇA - OMNIVOICE")
    print("=" * 60)
    
    # 1. Checagem de Hardware / CUDA
    cuda_disponivel = torch.cuda.is_available()
    print(f"-> PyTorch Versão: {torch.__version__}")
    print(f"-> CUDA Disponível: {cuda_disponivel}")
    if cuda_disponivel:
        print(f"-> Dispositivo GPU: {torch.cuda.get_device_name(0)}")
        print(f"-> VRAM Total: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB")
    else:
        print("-> AVISO: CUDA não detectado. A inferência rodará na CPU.")
    
    # 2. Carregamento do OmniVoice
    print("\nCarregando OmniVoice...")
    try:
        from omnivoice import OmniVoice
        import soundfile as sf
        
        device = "cuda:0" if cuda_disponivel else "cpu"
        dtype = torch.float16 if cuda_disponivel else torch.float32
        
        print(f"-> Inicializando modelo no dispositivo: {device} ({dtype})...")
        model = OmniVoice.from_pretrained(
            "k2-fsa/OmniVoice",
            device_map=device,
            dtype=dtype
        )
        print("-> Modelo carregado com sucesso!")
        
        # 3. Teste de síntese em memória (sem sobrescrever arquivos do jogo)
        texto_teste = "Olá! Este é um teste do modelo OmniVoice para o jogo de bandeiras e álbum de figurinhas."
        print(f"\n-> Gerando áudio de teste: '{texto_teste}'")
        
        # Geração de fala
        audio = model.generate(
            text=texto_teste,
            instruct="male, clear voice, confident tone, portuguese accent"
        )
        
        # Salva apenas um arquivo temporário de validação
        os.makedirs("assets/audio/testes", exist_ok=True)
        caminho_teste = "assets/audio/testes/teste_omnivoice_preview.wav"
        sf.write(caminho_teste, audio[0], 24000)
        
        print(f"-> SUCESSO: Áudio de teste gerado com sucesso em '{caminho_teste}'!")
        print("=" * 60)
        
    except ImportError as e:
        print(f"-> Pacote 'omnivoice' ainda não instalado ou pendente de dependências: {e}")
    except Exception as e:
        print(f"-> Ocorreu um erro durante o teste do OmniVoice: {e}")

if __name__ == "__main__":
    testar_ambiente_omnivoice()
