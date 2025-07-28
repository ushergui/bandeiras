import os
import re
import requests
from tqdm import tqdm # Para uma barra de progresso bonita

def extrair_codigos_paises(caminho_arquivo):
    """
    Lê o arquivo countries.js e extrai todos os códigos de dois dígitos dos países.
    """
    codigos = set()
    # Padrão regex para encontrar "codigo: 'xx'"
    padrao = re.compile(r"codigo:\s*'([a-z]{2})'")
    try:
        with open(caminho_arquivo, 'r', encoding='utf-8') as f:
            conteudo = f.read()
            matches = padrao.findall(conteudo)
            for codigo in matches:
                codigos.add(codigo)
        print(f"✅ {len(codigos)} códigos de países encontrados em {caminho_arquivo}.")
        return sorted(list(codigos))
    except FileNotFoundError:
        print(f"❌ Erro: O arquivo '{caminho_arquivo}' não foi encontrado.")
        print("Certifique-se de que este script está na mesma pasta que o seu arquivo countries.js.")
        return []

def baixar_mapas_svg(lista_codigos):
    """
    Baixa os arquivos SVG para cada código de país da lista.
    """
    if not lista_codigos:
        print("Nenhum código para baixar. Encerrando.")
        return

    # Cria a pasta de destino se ela não existir
    pasta_destino = os.path.join('assets', 'shapes')
    os.makedirs(pasta_destino, exist_ok=True)
    print(f"📂 Os mapas serão salvos em: '{pasta_destino}'")

    url_base = "https://cdn.jsdelivr.net/gh/djaiss/mapsicon@master/all/{}/vector.svg"
    
    # Usando tqdm para criar uma barra de progresso
    for codigo in tqdm(lista_codigos, desc="Baixando mapas"):
        url = url_base.format(codigo)
        nome_arquivo = os.path.join(pasta_destino, f"{codigo}.svg")
        
        try:
            resposta = requests.get(url, timeout=10)
            # Verifica se o download foi bem-sucedido
            if resposta.status_code == 200:
                with open(nome_arquivo, 'wb') as f:
                    f.write(resposta.content)
            else:
                # Informa se um mapa específico não foi encontrado
                tqdm.write(f"⚠️  Aviso: Mapa para o código '{codigo}' não encontrado (Status: {resposta.status_code}). Pulando.")
        except requests.exceptions.RequestException as e:
            tqdm.write(f"❌ Erro de conexão ao tentar baixar '{codigo}': {e}. Pulando.")

    print("\n🎉 Processo de download concluído!")

if __name__ == "__main__":
    # O nome do seu arquivo de países
    arquivo_js = 'countries.js'
    
    # 1. Extrai os códigos do arquivo JS
    codigos_dos_paises = extrair_codigos_paises(arquivo_js)
    
    # 2. Baixa os SVGs para a pasta assets/shapes
    baixar_mapas_svg(codigos_dos_paises)
