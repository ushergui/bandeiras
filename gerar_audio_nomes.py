import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs import save

load_dotenv()

def gerar_audios_nomes():
    CHAVE_API = os.getenv("ELEVENLABS_API_KEY")

    if not CHAVE_API:
        print("ERRO CRÍTICO: Chave 'ELEVENLABS_API_KEY' não encontrada no arquivo .env")
        return

    # Mapeamento completo dos códigos de bandeiras para nomes em PT-BR
    # Baseado na lista de arquivos .png fornecida
    paises_info = [
        {'codigo': 'ad', 'nome': 'Andorra'},
        {'codigo': 'ae', 'nome': 'Emirados Árabes Unidos'},
        {'codigo': 'af', 'nome': 'Afeganistão'},
        {'codigo': 'ag', 'nome': 'Antígua e Barbuda'},
        {'codigo': 'ai', 'nome': 'Anguila'},
        {'codigo': 'al', 'nome': 'Albânia'},
        {'codigo': 'am', 'nome': 'Armênia'},
        {'codigo': 'ao', 'nome': 'Angola'},
        {'codigo': 'aq', 'nome': 'Antártida'},
        {'codigo': 'ar', 'nome': 'Argentina'},
        {'codigo': 'as', 'nome': 'Samoa Americana'},
        {'codigo': 'at', 'nome': 'Áustria'},
        {'codigo': 'au', 'nome': 'Austrália'},
        {'codigo': 'aw', 'nome': 'Aruba'},
        {'codigo': 'ax', 'nome': 'Ilhas Aland'},
        {'codigo': 'az', 'nome': 'Azerbaijão'},
        {'codigo': 'ba', 'nome': 'Bósnia e Herzegovina'},
        {'codigo': 'bb', 'nome': 'Barbados'},
        {'codigo': 'bd', 'nome': 'Bangladesh'},
        {'codigo': 'be', 'nome': 'Bélgica'},
        {'codigo': 'bf', 'nome': 'Burquina Faso'},
        {'codigo': 'bg', 'nome': 'Bulgária'},
        {'codigo': 'bh', 'nome': 'Barein'},
        {'codigo': 'bi', 'nome': 'Burundi'},
        {'codigo': 'bj', 'nome': 'Benin'},
        {'codigo': 'bl', 'nome': 'São Bartolomeu'},
        {'codigo': 'bm', 'nome': 'Bermudas'},
        {'codigo': 'bn', 'nome': 'Brunei'},
        {'codigo': 'bo', 'nome': 'Bolívia'},
        {'codigo': 'bq', 'nome': 'Caribe Holandês'},
        {'codigo': 'br', 'nome': 'Brasil'},
        {'codigo': 'bs', 'nome': 'Bahamas'},
        {'codigo': 'bt', 'nome': 'Butão'},
        {'codigo': 'bv', 'nome': 'Ilha Bouvet'},
        {'codigo': 'bw', 'nome': 'Botsuana'},
        {'codigo': 'by', 'nome': 'Bielorrússia'},
        {'codigo': 'bz', 'nome': 'Belize'},
        {'codigo': 'ca', 'nome': 'Canadá'},
        {'codigo': 'cc', 'nome': 'Ilhas Cocos'},
        {'codigo': 'cd', 'nome': 'República Democrática do Congo'},
        {'codigo': 'cf', 'nome': 'República Centro-Africana'},
        {'codigo': 'cg', 'nome': 'Congo'},
        {'codigo': 'ch', 'nome': 'Suíça'},
        {'codigo': 'ci', 'nome': 'Costa do Marfim'},
        {'codigo': 'ck', 'nome': 'Ilhas Cook'},
        {'codigo': 'cl', 'nome': 'Chile'},
        {'codigo': 'cm', 'nome': 'Camarões'},
        {'codigo': 'cn', 'nome': 'China'},
        {'codigo': 'co', 'nome': 'Colômbia'},
        {'codigo': 'cr', 'nome': 'Costa Rica'},
        {'codigo': 'cu', 'nome': 'Cuba'},
        {'codigo': 'cv', 'nome': 'Cabo Verde'},
        {'codigo': 'cw', 'nome': 'Curaçao'},
        {'codigo': 'cx', 'nome': 'Ilha Christmas'},
        {'codigo': 'cy', 'nome': 'Chipre'},
        {'codigo': 'cz', 'nome': 'República Tcheca'},
        {'codigo': 'de', 'nome': 'Alemanha'},
        {'codigo': 'dj', 'nome': 'Djibuti'},
        {'codigo': 'dk', 'nome': 'Dinamarca'},
        {'codigo': 'dm', 'nome': 'Dominica'},
        {'codigo': 'do', 'nome': 'República Dominicana'},
        {'codigo': 'dz', 'nome': 'Argélia'},
        {'codigo': 'ec', 'nome': 'Equador'},
        {'codigo': 'ee', 'nome': 'Estônia'},
        {'codigo': 'eg', 'nome': 'Egito'},
        {'codigo': 'eh', 'nome': 'Saara Ocidental'},
        {'codigo': 'er', 'nome': 'Eritreia'},
        {'codigo': 'es', 'nome': 'Espanha'},
        {'codigo': 'et', 'nome': 'Etiópia'},
        {'codigo': 'fi', 'nome': 'Finlândia'},
        {'codigo': 'fj', 'nome': 'Fiji'},
        {'codigo': 'fk', 'nome': 'Ilhas Malvinas'},
        {'codigo': 'fm', 'nome': 'Micronésia'},
        {'codigo': 'fo', 'nome': 'Ilhas Faroé'},
        {'codigo': 'fr', 'nome': 'França'},
        {'codigo': 'ga', 'nome': 'Gabão'},
        {'codigo': 'gb', 'nome': 'Reino Unido'},
        {'codigo': 'gb-eng', 'nome': 'Inglaterra'},
        {'codigo': 'gb-nir', 'nome': 'Irlanda do Norte'},
        {'codigo': 'gb-sct', 'nome': 'Escócia'},
        {'codigo': 'gb-wls', 'nome': 'País de Gales'},
        {'codigo': 'gd', 'nome': 'Granada'},
        {'codigo': 'ge', 'nome': 'Geórgia'},
        {'codigo': 'gf', 'nome': 'Guiana Francesa'},
        {'codigo': 'gg', 'nome': 'Guernsey'},
        {'codigo': 'gh', 'nome': 'Gana'},
        {'codigo': 'gi', 'nome': 'Gibraltar'},
        {'codigo': 'gl', 'nome': 'Groenlândia'},
        {'codigo': 'gm', 'nome': 'Gâmbia'},
        {'codigo': 'gn', 'nome': 'Guiné'},
        {'codigo': 'gp', 'nome': 'Guadalupe'},
        {'codigo': 'gq', 'nome': 'Guiné Equatorial'},
        {'codigo': 'gr', 'nome': 'Grécia'},
        {'codigo': 'gs', 'nome': 'Ilhas Geórgia do Sul e Sandwich do Sul'},
        {'codigo': 'gt', 'nome': 'Guatemala'},
        {'codigo': 'gu', 'nome': 'Guam'},
        {'codigo': 'gw', 'nome': 'Guiné-Bissau'},
        {'codigo': 'gy', 'nome': 'Guiana'},
        {'codigo': 'hk', 'nome': 'Hong Kong'},
        {'codigo': 'hm', 'nome': 'Ilha Heard e Ilhas McDonald'},
        {'codigo': 'hn', 'nome': 'Honduras'},
        {'codigo': 'hr', 'nome': 'Croácia'},
        {'codigo': 'ht', 'nome': 'Haiti'},
        {'codigo': 'hu', 'nome': 'Hungria'},
        {'codigo': 'id', 'nome': 'Indonésia'},
        {'codigo': 'ie', 'nome': 'Irlanda'},
        {'codigo': 'il', 'nome': 'Israel'},
        {'codigo': 'im', 'nome': 'Ilha de Man'},
        {'codigo': 'in', 'nome': 'Índia'},
        {'codigo': 'io', 'nome': 'Território Britânico do Oceano Índico'},
        {'codigo': 'iq', 'nome': 'Iraque'},
        {'codigo': 'ir', 'nome': 'Irã'},
        {'codigo': 'is', 'nome': 'Islândia'},
        {'codigo': 'it', 'nome': 'Itália'},
        {'codigo': 'je', 'nome': 'Jersey'},
        {'codigo': 'jm', 'nome': 'Jamaica'},
        {'codigo': 'jo', 'nome': 'Jordânia'},
        {'codigo': 'jp', 'nome': 'Japão'},
        {'codigo': 'ke', 'nome': 'Quênia'},
        {'codigo': 'kg', 'nome': 'Quirguistão'},
        {'codigo': 'kh', 'nome': 'Camboja'},
        {'codigo': 'ki', 'nome': 'Kiribati'},
        {'codigo': 'km', 'nome': 'Comores'},
        {'codigo': 'kn', 'nome': 'São Cristóvão e Névis'},
        {'codigo': 'kp', 'nome': 'Coreia do Norte'},
        {'codigo': 'kr', 'nome': 'Coreia do Sul'},
        {'codigo': 'kw', 'nome': 'Kuwait'},
        {'codigo': 'ky', 'nome': 'Ilhas Cayman'},
        {'codigo': 'kz', 'nome': 'Cazaquistão'},
        {'codigo': 'la', 'nome': 'Laos'},
        {'codigo': 'lb', 'nome': 'Líbano'},
        {'codigo': 'lc', 'nome': 'Santa Lúcia'},
        {'codigo': 'li', 'nome': 'Liechtenstein'},
        {'codigo': 'lk', 'nome': 'Sri Lanka'},
        {'codigo': 'lr', 'nome': 'Libéria'},
        {'codigo': 'ls', 'nome': 'Lesoto'},
        {'codigo': 'lt', 'nome': 'Lituânia'},
        {'codigo': 'lu', 'nome': 'Luxemburgo'},
        {'codigo': 'lv', 'nome': 'Letônia'},
        {'codigo': 'ly', 'nome': 'Líbia'},
        {'codigo': 'ma', 'nome': 'Marrocos'},
        {'codigo': 'mc', 'nome': 'Mônaco'},
        {'codigo': 'md', 'nome': 'Moldávia'},
        {'codigo': 'me', 'nome': 'Montenegro'},
        {'codigo': 'mf', 'nome': 'São Martinho'},
        {'codigo': 'mg', 'nome': 'Madagáscar'},
        {'codigo': 'mh', 'nome': 'Ilhas Marshall'},
        {'codigo': 'mk', 'nome': 'Macedônia do Norte'},
        {'codigo': 'ml', 'nome': 'Mali'},
        {'codigo': 'mm', 'nome': 'Mianmar'},
        {'codigo': 'mn', 'nome': 'Mongólia'},
        {'codigo': 'mo', 'nome': 'Macau'},
        {'codigo': 'mp', 'nome': 'Ilhas Marianas do Norte'},
        {'codigo': 'mq', 'nome': 'Martinica'},
        {'codigo': 'mr', 'nome': 'Mauritânia'},
        {'codigo': 'ms', 'nome': 'Montserrat'},
        {'codigo': 'mt', 'nome': 'Malta'},
        {'codigo': 'mu', 'nome': 'Maurício'},
        {'codigo': 'mv', 'nome': 'Maldivas'},
        {'codigo': 'mw', 'nome': 'Malaui'},
        {'codigo': 'mx', 'nome': 'México'},
        {'codigo': 'my', 'nome': 'Malásia'},
        {'codigo': 'mz', 'nome': 'Moçambique'},
        {'codigo': 'na', 'nome': 'Namíbia'},
        {'codigo': 'nc', 'nome': 'Nova Caledônia'},
        {'codigo': 'ne', 'nome': 'Níger'},
        {'codigo': 'nf', 'nome': 'Ilha Norfolk'},
        {'codigo': 'ng', 'nome': 'Nigéria'},
        {'codigo': 'ni', 'nome': 'Nicarágua'},
        {'codigo': 'nl', 'nome': 'Países Baixos'},
        {'codigo': 'no', 'nome': 'Noruega'},
        {'codigo': 'np', 'nome': 'Nepal'},
        {'codigo': 'nr', 'nome': 'Nauru'},
        {'codigo': 'nu', 'nome': 'Niue'},
        {'codigo': 'nz', 'nome': 'Nova Zelândia'},
        {'codigo': 'om', 'nome': 'Omã'},
        {'codigo': 'pa', 'nome': 'Panamá'},
        {'codigo': 'pe', 'nome': 'Peru'},
        {'codigo': 'pf', 'nome': 'Polinésia Francesa'},
        {'codigo': 'pg', 'nome': 'Papua-Nova Guiné'},
        {'codigo': 'ph', 'nome': 'Filipinas'},
        {'codigo': 'pk', 'nome': 'Paquistão'},
        {'codigo': 'pl', 'nome': 'Polônia'},
        {'codigo': 'pm', 'nome': 'São Pedro e Miquelão'},
        {'codigo': 'pn', 'nome': 'Ilhas Pitcairn'},
        {'codigo': 'pr', 'nome': 'Porto Rico'},
        {'codigo': 'ps', 'nome': 'Palestina'},
        {'codigo': 'pt', 'nome': 'Portugal'},
        {'codigo': 'pw', 'nome': 'Palau'},
        {'codigo': 'py', 'nome': 'Paraguai'},
        {'codigo': 'qa', 'nome': 'Catar'},
        {'codigo': 're', 'nome': 'Reunião'},
        {'codigo': 'ro', 'nome': 'Romênia'},
        {'codigo': 'rs', 'nome': 'Sérvia'},
        {'codigo': 'ru', 'nome': 'Rússia'},
        {'codigo': 'rw', 'nome': 'Ruanda'},
        {'codigo': 'sa', 'nome': 'Arábia Saudita'},
        {'codigo': 'sb', 'nome': 'Ilhas Salomão'},
        {'codigo': 'sc', 'nome': 'Seicheles'},
        {'codigo': 'sd', 'nome': 'Sudão'},
        {'codigo': 'se', 'nome': 'Suécia'},
        {'codigo': 'sg', 'nome': 'Singapura'},
        {'codigo': 'sh', 'nome': 'Santa Helena'},
        {'codigo': 'si', 'nome': 'Eslovênia'},
        {'codigo': 'sj', 'nome': 'Svalbard e Jan Mayen'},
        {'codigo': 'sk', 'nome': 'Eslováquia'},
        {'codigo': 'sl', 'nome': 'Serra Leoa'},
        {'codigo': 'sm', 'nome': 'San Marino'},
        {'codigo': 'sn', 'nome': 'Senegal'},
        {'codigo': 'so', 'nome': 'Somália'},
        {'codigo': 'sr', 'nome': 'Suriname'},
        {'codigo': 'ss', 'nome': 'Sudão do Sul'},
        {'codigo': 'st', 'nome': 'São Tomé e Príncipe'},
        {'codigo': 'sv', 'nome': 'El Salvador'},
        {'codigo': 'sx', 'nome': 'São Martinho Holandês'},
        {'codigo': 'sy', 'nome': 'Síria'},
        {'codigo': 'sz', 'nome': 'Essuatíni'}, # Antiga Suazilândia
        {'codigo': 'tc', 'nome': 'Ilhas Turcas e Caicos'},
        {'codigo': 'td', 'nome': 'Chade'},
        {'codigo': 'tf', 'nome': 'Terras Austrais e Antárticas Francesas'},
        {'codigo': 'tg', 'nome': 'Togo'},
        {'codigo': 'th', 'nome': 'Tailândia'},
        {'codigo': 'tj', 'nome': 'Tajiquistão'},
        {'codigo': 'tk', 'nome': 'Tokelau'},
        {'codigo': 'tl', 'nome': 'Timor-Leste'},
        {'codigo': 'tm', 'nome': 'Turcomenistão'},
        {'codigo': 'tn', 'nome': 'Tunísia'},
        {'codigo': 'to', 'nome': 'Tonga'},
        {'codigo': 'tr', 'nome': 'Turquia'},
        {'codigo': 'tt', 'nome': 'Trindade e Tobago'},
        {'codigo': 'tv', 'nome': 'Tuvalu'},
        {'codigo': 'tw', 'nome': 'Taiwan'},
        {'codigo': 'tz', 'nome': 'Tanzânia'},
        {'codigo': 'ua', 'nome': 'Ucrânia'},
        {'codigo': 'ug', 'nome': 'Uganda'},
        {'codigo': 'um', 'nome': 'Ilhas Menores Distantes dos EUA'},
        {'codigo': 'us', 'nome': 'Estados Unidos'},
        {'codigo': 'uy', 'nome': 'Uruguai'},
        {'codigo': 'uz', 'nome': 'Uzbequistão'},
        {'codigo': 'va', 'nome': 'Vaticano'},
        {'codigo': 'vc', 'nome': 'São Vicente e Granadinas'},
        {'codigo': 've', 'nome': 'Venezuela'},
        {'codigo': 'vg', 'nome': 'Ilhas Virgens Britânicas'},
        {'codigo': 'vi', 'nome': 'Ilhas Virgens Americanas'},
        {'codigo': 'vn', 'nome': 'Vietnã'},
        {'codigo': 'vu', 'nome': 'Vanuatu'},
        {'codigo': 'wf', 'nome': 'Wallis e Futuna'},
        {'codigo': 'ws', 'nome': 'Samoa'},
        {'codigo': 'xk', 'nome': 'Kosovo'},
        {'codigo': 'ye', 'nome': 'Iêmen'},
        {'codigo': 'yt', 'nome': 'Mayotte'},
        {'codigo': 'za', 'nome': 'África do Sul'},
        {'codigo': 'zm', 'nome': 'Zâmbia'},
        {'codigo': 'zw', 'nome': 'Zimbábue'}
    ]

    # Pasta de saída
    output_folder = "assets/audio/nomes_paises"
    
    # Voz sugerida para nomes (clara e neutra) - Jessica
    voice_id = "cgSgspJ2msm6clMCkdW9" 

    try:
        client = ElevenLabs(api_key=CHAVE_API)
        os.makedirs(output_folder, exist_ok=True)
        
        print(f"--- GERANDO ÁUDIOS (NOMES DOS PAÍSES) ---")
        print(f"Total de arquivos na lista: {len(paises_info)}")
        print(f"Salvando em: {output_folder}")

        for pais in paises_info:
            nome_pais = pais['nome']
            
            # O texto a ser falado é APENAS o nome do país
            texto_falar = nome_pais
            
            # Sanitiza o nome para criar o arquivo (minúsculo, sem espaços, sem acentos se preferir, mas aqui mantemos acentos na fala e limpamos no arquivo)
            nome_arquivo = f"{nome_pais.lower().replace(' ', '_')}.mp3"
            
            # Para evitar problemas com nomes muito longos ou caracteres especiais no sistema de arquivos, 
            # você pode querer adicionar mais limpeza no nome do arquivo aqui se der erro.
            # Mas o replace de espaço por underline já resolve 90%.

            caminho_completo = os.path.join(output_folder, nome_arquivo)

            if os.path.exists(caminho_completo):
                print(f" -> [Pular] '{nome_pais}' já existe.")
                continue

            try:
                audio_gerado = client.text_to_speech.convert(
                    voice_id=voice_id,
                    text=texto_falar,
                    model_id="eleven_multilingual_v2"
                )
                save(audio_gerado, caminho_completo)
                print(f" -> [Gerado] '{nome_pais}'")
            except Exception as e:
                print(f"❌ ERRO ao gerar '{nome_pais}': {e}")

        print("\n✅ Processo concluído!")

    except Exception as e:
        print(f"\nOcorreu um erro inesperado: {e}")

if __name__ == "__main__":
    gerar_audios_nomes()