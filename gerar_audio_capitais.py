# gerar_audio_capitais.py
# VERSÃO FINAL E PADRONIZADA
import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs import save

load_dotenv()

def gerar_audios_capitais():
    CHAVE_API = os.getenv("ELEVENLABS_API_KEY")
    if not CHAVE_API:
        print("ERRO CRÍTICO: Chave 'ELEVENLABS_API_KEY' não encontrada no arquivo .env")
        return

    # Lista de países divididos por América (Norte, Central e Sul)
    paises_info = [
    # EUROPA
    {'nome': 'Albânia', 'codigo': 'al', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Tirana'},
    {'nome': 'Alemanha', 'codigo': 'de', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Berlim'},
    {'nome': 'Andorra', 'codigo': 'ad', 'artigo': 'de', 'continente': 'Europa', 'capital': 'Andorra-a-Velha'},
    {'nome': 'Áustria', 'codigo': 'at', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Viena'},
    {'nome': 'Bélgica', 'codigo': 'be', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Bruxelas'},
    {'nome': 'Bielorrússia', 'codigo': 'by', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Minsque'},
    {'nome': 'Bósnia e Herzegovina', 'codigo': 'ba', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Saraievo'},
    {'nome': 'Bulgária', 'codigo': 'bg', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Sófia'},
    {'nome': 'Chipre', 'codigo': 'cy', 'artigo': 'do', 'continente': 'Europa', 'capital': 'Nicósia'},
    {'nome': 'Croácia', 'codigo': 'hr', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Zagrebe'},
    {'nome': 'Dinamarca', 'codigo': 'dk', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Copenhaga'},
    {'nome': 'Eslováquia', 'codigo': 'sk', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Bratislava'},
    {'nome': 'Eslovênia', 'codigo': 'si', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Liubliana'},
    {'nome': 'Espanha', 'codigo': 'es', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Madri'},
    {'nome': 'Estônia', 'codigo': 'ee', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Talim'},
    {'nome': 'Finlândia', 'codigo': 'fi', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Helsinque'},
    {'nome': 'França', 'codigo': 'fr', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Paris'},
    {'nome': 'Grécia', 'codigo': 'gr', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Atenas'},
    {'nome': 'Hungria', 'codigo': 'hu', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Budapeste'},
    {'nome': 'Irlanda', 'codigo': 'ie', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Dublim'},
    {'nome': 'Islândia', 'codigo': 'is', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Reiquiavique'},
    {'nome': 'Itália', 'codigo': 'it', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Roma'},
    {'nome': 'Letônia', 'codigo': 'lv', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Riga'},
    {'nome': 'Liechtenstein', 'codigo': 'li', 'artigo': 'de', 'continente': 'Europa', 'capital': 'Vaduz'},
    {'nome': 'Lituânia', 'codigo': 'lt', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Vílnius'},
    {'nome': 'Luxemburgo', 'codigo': 'lu', 'artigo': 'de', 'continente': 'Europa', 'capital': 'Luxemburgo'},
    {'nome': 'Macedônia do Norte', 'codigo': 'mk', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Escópia'},
    {'nome': 'Malta', 'codigo': 'mt', 'artigo': 'de', 'continente': 'Europa', 'capital': 'Valeta'},
    {'nome': 'Moldávia', 'codigo': 'md', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Quixinau'},
    {'nome': 'Mônaco', 'codigo': 'mc', 'artigo': 'de', 'continente': 'Europa', 'capital': 'Mônaco'},
    {'nome': 'Montenegro', 'codigo': 'me', 'artigo': 'de', 'continente': 'Europa', 'capital': 'Podgoritsa'},
    {'nome': 'Noruega', 'codigo': 'no', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Oslo'},
    {'nome': 'Países Baixos', 'codigo': 'nl', 'artigo': 'dos', 'continente': 'Europa', 'capital': 'Amesterdão'},
    {'nome': 'Polônia', 'codigo': 'pl', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Varsóvia'},
    {'nome': 'Portugal', 'codigo': 'pt', 'artigo': 'de', 'continente': 'Europa', 'capital': 'Lisboa'},
    {'nome': 'Reino Unido', 'codigo': 'gb', 'artigo': 'do', 'continente': 'Europa', 'capital': 'Londres'},
    {'nome': 'República Tcheca', 'codigo': 'cz', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Praga'},
    {'nome': 'Romênia', 'codigo': 'ro', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Bucareste'},
    {'nome': 'Rússia', 'codigo': 'ru', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Moscou'},
    {'nome': 'San Marino', 'codigo': 'sm', 'artigo': 'de', 'continente': 'Europa', 'capital': 'São Marinho'},
    {'nome': 'Sérvia', 'codigo': 'rs', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Belgrado'},
    {'nome': 'Suécia', 'codigo': 'se', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Estocolmo'},
    {'nome': 'Suíça', 'codigo': 'ch', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Berna'},
    {'nome': 'Ucrânia', 'codigo': 'ua', 'artigo': 'da', 'continente': 'Europa', 'capital': 'Quieve'},

    # ÁSIA
    {'nome': 'Afeganistão', 'codigo': 'af', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Cabul'},
    {'nome': 'Arábia Saudita', 'codigo': 'sa', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Riade'},
    {'nome': 'Armênia', 'codigo': 'am', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Erevã'},
    {'nome': 'Azerbaijão', 'codigo': 'az', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Bacu'},
    {'nome': 'Bangladesh', 'codigo': 'bd', 'artigo': 'de', 'continente': 'Ásia', 'capital': 'Daca'},
    {'nome': 'Barein', 'codigo': 'bh', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Manama'},
    {'nome': 'Brunei', 'codigo': 'bn', 'artigo': 'de', 'continente': 'Ásia', 'capital': 'Bandar Seri Begauã'},
    {'nome': 'Butão', 'codigo': 'bt', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Timbu'},
    {'nome': 'Camboja', 'codigo': 'kh', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Pnom Pene'},
    {'nome': 'Catar', 'codigo': 'qa', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Doa'},
    {'nome': 'Cazaquistão', 'codigo': 'kz', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Astana'},
    {'nome': 'China', 'codigo': 'cn', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Pequim'},
    {'nome': 'Coreia do Norte', 'codigo': 'kp', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Piongueangue'},
    {'nome': 'Coreia do Sul', 'codigo': 'kr', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Seul'},
    {'nome': 'Emirados Árabes Unidos', 'codigo': 'ae', 'artigo': 'dos', 'continente': 'Ásia', 'capital': 'Abu Dabi'},
    {'nome': 'Filipinas', 'codigo': 'ph', 'artigo': 'das', 'continente': 'Ásia', 'capital': 'Manila'},
    {'nome': 'Geórgia', 'codigo': 'ge', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Tebilíssi'},
    {'nome': 'Iêmen', 'codigo': 'ye', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Saná'},
    {'nome': 'Índia', 'codigo': 'in', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Nova Déli'},
    {'nome': 'Indonésia', 'codigo': 'id', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Jacarta'},
    {'nome': 'Irã', 'codigo': 'ir', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Teerã'},
    {'nome': 'Iraque', 'codigo': 'iq', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Bagdá'},
    {'nome': 'Israel', 'codigo': 'il', 'artigo': 'de', 'continente': 'Ásia', 'capital': 'Jerusalém'},
    {'nome': 'Japão', 'codigo': 'jp', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Tóquio'},
    {'nome': 'Jordânia', 'codigo': 'jo', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Amã'},
    {'nome': 'Kuwait', 'codigo': 'kw', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Cidade do Kuwait'},
    {'nome': 'Laos', 'codigo': 'la', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Vienciana'},
    {'nome': 'Líbano', 'codigo': 'lb', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Beirute'},
    {'nome': 'Malásia', 'codigo': 'my', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Cuala Lumpur'},
    {'nome': 'Maldivas', 'codigo': 'mv', 'artigo': 'das', 'continente': 'Ásia', 'capital': 'Malé'},
    {'nome': 'Mianmar', 'codigo': 'mm', 'artigo': 'de', 'continente': 'Ásia', 'capital': 'Nepiedó'},
    {'nome': 'Mongólia', 'codigo': 'mn', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Ulã Bator'},
    {'nome': 'Nepal', 'codigo': 'np', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Catmandu'},
    {'nome': 'Omã', 'codigo': 'om', 'artigo': 'de', 'continente': 'Ásia', 'capital': 'Mascate'},
    {'nome': 'Paquistão', 'codigo': 'pk', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Islamabade'},
    {'nome': 'Quirguistão', 'codigo': 'kg', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Bisqueque'},
    {'nome': 'Síria', 'codigo': 'sy', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Damasco'},
    {'nome': 'Sri Lanka', 'codigo': 'lk', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Sri Jaiavardenapura-Cota'},
    {'nome': 'Tailândia', 'codigo': 'th', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Banguecoque'},
    {'nome': 'Tajiquistão', 'codigo': 'tj', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Duchambé'},
    {'nome': 'Timor-Leste', 'codigo': 'tl', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Díli'},
    {'nome': 'Turcomenistão', 'codigo': 'tm', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Asgabate'},
    {'nome': 'Turquia', 'codigo': 'tr', 'artigo': 'da', 'continente': 'Ásia', 'capital': 'Ancara'},
    {'nome': 'Uzbequistão', 'codigo': 'uz', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Tasquente'},
    {'nome': 'Vietnã', 'codigo': 'vn', 'artigo': 'do', 'continente': 'Ásia', 'capital': 'Hanói'},

    # ÁFRICA
    {'nome': 'África do Sul', 'codigo': 'za', 'artigo': 'da', 'continente': 'África', 'capital': 'Pretória'},
    {'nome': 'Angola', 'codigo': 'ao', 'artigo': 'de', 'continente': 'África', 'capital': 'Luanda'},
    {'nome': 'Argélia', 'codigo': 'dz', 'artigo': 'da', 'continente': 'África', 'capital': 'Argel'},
    {'nome': 'Benin', 'codigo': 'bj', 'artigo': 'do', 'continente': 'África', 'capital': 'Porto Novo'},
    {'nome': 'Botsuana', 'codigo': 'bw', 'artigo': 'de', 'continente': 'África', 'capital': 'Gaborone'},
    {'nome': 'Burquina Faso', 'codigo': 'bf', 'artigo': 'de', 'continente': 'África', 'capital': 'Uagadugu'},
    {'nome': 'Burundi', 'codigo': 'bi', 'artigo': 'do', 'continente': 'África', 'capital': 'Gitega'},
    {'nome': 'Cabo Verde', 'codigo': 'cv', 'artigo': 'de', 'continente': 'África', 'capital': 'Praia'},
    {'nome': 'Camarões', 'codigo': 'cm', 'artigo': 'dos', 'continente': 'África', 'capital': 'Iaundé'},
    {'nome': 'Chade', 'codigo': 'td', 'artigo': 'do', 'continente': 'África', 'capital': 'Jamena'},
    {'nome': 'Comores', 'codigo': 'km', 'artigo': 'de', 'continente': 'África', 'capital': 'Moroni'},
    {'nome': 'Congo', 'codigo': 'cg', 'artigo': 'do', 'continente': 'África', 'capital': 'Brazavile'},
    {'nome': 'Costa do Marfim', 'codigo': 'ci', 'artigo': 'da', 'continente': 'África', 'capital': 'Iamussucro'},
    {'nome': 'Djibuti', 'codigo': 'dj', 'artigo': 'do', 'continente': 'África', 'capital': 'Djibuti'},
    {'nome': 'Egito', 'codigo': 'eg', 'artigo': 'do', 'continente': 'África', 'capital': 'Cairo'},
    {'nome': 'Eritreia', 'codigo': 'er', 'artigo': 'da', 'continente': 'África', 'capital': 'Asmara'},
    {'nome': 'Etiópia', 'codigo': 'et', 'artigo': 'da', 'continente': 'África', 'capital': 'Adis Abeba'},
    {'nome': 'Gabão', 'codigo': 'ga', 'artigo': 'do', 'continente': 'África', 'capital': 'Librevile'},
    {'nome': 'Gâmbia', 'codigo': 'gm', 'artigo': 'da', 'continente': 'África', 'capital': 'Banjul'},
    {'nome': 'Gana', 'codigo': 'gh', 'artigo': 'de', 'continente': 'África', 'capital': 'Acra'},
    {'nome': 'Guiné', 'codigo': 'gn', 'artigo': 'da', 'continente': 'África', 'capital': 'Conacri'},
    {'nome': 'Guiné Equatorial', 'codigo': 'gq', 'artigo': 'da', 'continente': 'África', 'capital': 'Malabo'},
    {'nome': 'Guiné-Bissau', 'codigo': 'gw', 'artigo': 'da', 'continente': 'África', 'capital': 'Bissau'},
    {'nome': 'Lesoto', 'codigo': 'ls', 'artigo': 'do', 'continente': 'África', 'capital': 'Maseru'},
    {'nome': 'Libéria', 'codigo': 'lr', 'artigo': 'da', 'continente': 'África', 'capital': 'Monróvia'},
    {'nome': 'Líbia', 'codigo': 'ly', 'artigo': 'da', 'continente': 'África', 'capital': 'Trípoli'},
    {'nome': 'Madagáscar', 'codigo': 'mg', 'artigo': 'de', 'continente': 'África', 'capital': 'Antananarivo'},
    {'nome': 'Malaui', 'codigo': 'mw', 'artigo': 'do', 'continente': 'África', 'capital': 'Lilongué'},
    {'nome': 'Mali', 'codigo': 'ml', 'artigo': 'do', 'continente': 'África', 'capital': 'Bamaco'},
    {'nome': 'Marrocos', 'codigo': 'ma', 'artigo': 'do', 'continente': 'África', 'capital': 'Rabate'},
    {'nome': 'Maurício', 'codigo': 'mu', 'artigo': 'de', 'continente': 'África', 'capital': 'Porto Luís'},
    {'nome': 'Mauritânia', 'codigo': 'mr', 'artigo': 'da', 'continente': 'África', 'capital': 'Nuaquechote'},
    {'nome': 'Moçambique', 'codigo': 'mz', 'artigo': 'de', 'continente': 'África', 'capital': 'Maputo'},
    {'nome': 'Namíbia', 'codigo': 'na', 'artigo': 'da', 'continente': 'África', 'capital': 'Vinduque'},
    {'nome': 'Níger', 'codigo': 'ne', 'artigo': 'do', 'continente': 'África', 'capital': 'Niamei'},
    {'nome': 'Nigéria', 'codigo': 'ng', 'artigo': 'da', 'continente': 'África', 'capital': 'Abuja'},
    {'nome': 'Quênia', 'codigo': 'ke', 'artigo': 'do', 'continente': 'África', 'capital': 'Nairóbi'},
    {'nome': 'República Centro-Africana', 'codigo': 'cf', 'artigo': 'da', 'continente': 'África', 'capital': 'Bangui'},
    {'nome': 'República Democrática do Congo', 'codigo': 'cd', 'artigo': 'da', 'continente': 'África', 'capital': 'Quinxassa'},
    {'nome': 'Ruanda', 'codigo': 'rw', 'artigo': 'de', 'continente': 'África', 'capital': 'Quigali'},
    {'nome': 'São Tomé e Príncipe', 'codigo': 'st', 'artigo': 'de', 'continente': 'África', 'capital': 'São Tomé'},
    {'nome': 'Senegal', 'codigo': 'sn', 'artigo': 'do', 'continente': 'África', 'capital': 'Dacar'},
    {'nome': 'Serra Leoa', 'codigo': 'sl', 'artigo': 'da', 'continente': 'África', 'capital': 'Freetown'},
    {'nome': 'Seicheles', 'codigo': 'sc', 'artigo': 'de', 'continente': 'África', 'capital': 'Victória'},
    {'nome': 'Somália', 'codigo': 'so', 'artigo': 'da', 'continente': 'África', 'capital': 'Mogadíscio'},
    {'nome': 'Suazilândia', 'codigo': 'sz', 'artigo': 'da', 'continente': 'África', 'capital': 'Lobamba'},
    {'nome': 'Sudão', 'codigo': 'sd', 'artigo': 'do', 'continente': 'África', 'capital': 'Cartum'},
    {'nome': 'Sudão do Sul', 'codigo': 'ss', 'artigo': 'do', 'continente': 'África', 'capital': 'Juba'},
    {'nome': 'Tanzânia', 'codigo': 'tz', 'artigo': 'da', 'continente': 'África', 'capital': 'Dodoma'},
    {'nome': 'Togo', 'codigo': 'tg', 'artigo': 'do', 'continente': 'África', 'capital': 'Lomé'},
    {'nome': 'Tunísia', 'codigo': 'tn', 'artigo': 'da', 'continente': 'África', 'capital': 'Tunes'},
    {'nome': 'Uganda', 'codigo': 'ug', 'artigo': 'de', 'continente': 'África', 'capital': 'Campala'},
    {'nome': 'Zâmbia', 'codigo': 'zm', 'artigo': 'da', 'continente': 'África', 'capital': 'Lusaca'},
    {'nome': 'Zimbábue', 'codigo': 'zw', 'artigo': 'do', 'continente': 'África', 'capital': 'Harare'},

    # AMÉRICA DO NORTE
    {'nome': 'Canadá', 'codigo': 'ca', 'artigo': 'do', 'continente': 'América do Norte', 'capital': 'Otava'},
    {'nome': 'Estados Unidos', 'codigo': 'us', 'artigo': 'dos', 'continente': 'América do Norte', 'capital': 'Washington, D.C.'},
    {'nome': 'México', 'codigo': 'mx', 'artigo': 'do', 'continente': 'América do Norte', 'capital': 'Cidade do México'},
    
    # AMÉRICA CENTRAL
    {'nome': 'Antígua e Barbuda', 'codigo': 'ag', 'artigo': 'de', 'continente': 'América Central', 'capital': 'São João'},
    {'nome': 'Bahamas', 'codigo': 'bs', 'artigo': 'das', 'continente': 'América Central', 'capital': 'Nassau'},
    {'nome': 'Barbados', 'codigo': 'bb', 'artigo': 'de', 'continente': 'América Central', 'capital': 'Bridgetown'},
    {'nome': 'Belize', 'codigo': 'bz', 'artigo': 'de', 'continente': 'América Central', 'capital': 'Belmopã'},
    {'nome': 'Costa Rica', 'codigo': 'cr', 'artigo': 'da', 'continente': 'América Central', 'capital': 'São José'},
    {'nome': 'Cuba', 'codigo': 'cu', 'artigo': 'de', 'continente': 'América Central', 'capital': 'Havana'},
    {'nome': 'Dominica', 'codigo': 'dm', 'artigo': 'da', 'continente': 'América Central', 'capital': 'Roseau'},
    {'nome': 'El Salvador', 'codigo': 'sv', 'artigo': 'de', 'continente': 'América Central', 'capital': 'São Salvador'},
    {'nome': 'Granada', 'codigo': 'gd', 'artigo': 'de', 'continente': 'América Central', 'capital': 'São Jorge'},
    {'nome': 'Guatemala', 'codigo': 'gt', 'artigo': 'da', 'continente': 'América Central', 'capital': 'Cidade da Guatemala'},
    {'nome': 'Haiti', 'codigo': 'ht', 'artigo': 'do', 'continente': 'América Central', 'capital': 'Porto Príncipe'},
    {'nome': 'Honduras', 'codigo': 'hn', 'artigo': 'de', 'continente': 'América Central', 'capital': 'Tegucigalpa'},
    {'nome': 'Jamaica', 'codigo': 'jm', 'artigo': 'da', 'continente': 'América Central', 'capital': 'Kingston'},
    {'nome': 'Nicarágua', 'codigo': 'ni', 'artigo': 'da', 'continente': 'América Central', 'capital': 'Manágua'},
    {'nome': 'Panamá', 'codigo': 'pa', 'artigo': 'do', 'continente': 'América Central', 'capital': 'Cidade do Panamá'},
    {'nome': 'República Dominicana', 'codigo': 'do', 'artigo': 'da', 'continente': 'América Central', 'capital': 'São Domingos'},
    {'nome': 'Santa Lúcia', 'codigo': 'lc', 'artigo': 'de', 'continente': 'América Central', 'capital': 'Castries'},
    {'nome': 'São Cristóvão e Névis', 'codigo': 'kn', 'artigo': 'de', 'continente': 'América Central', 'capital': 'Basseterre'},
    {'nome': 'São Vicente e Granadinas', 'codigo': 'vc', 'artigo': 'de', 'continente': 'América Central', 'capital': 'Kingstown'},
    {'nome': 'Trindade e Tobago', 'codigo': 'tt', 'artigo': 'de', 'continente': 'América Central', 'capital': 'Porto de Espanha'},

    # AMÉRICA DO SUL
    {'nome': 'Argentina', 'codigo': 'ar', 'artigo': 'da', 'continente': 'América do Sul', 'capital': 'Buenos Aires'},
    {'nome': 'Bolívia', 'codigo': 'bo', 'artigo': 'da', 'continente': 'América do Sul', 'capital': 'Sucre'},
    {'nome': 'Brasil', 'codigo': 'br', 'artigo': 'do', 'continente': 'América do Sul', 'capital': 'Brasília'},
    {'nome': 'Chile', 'codigo': 'cl', 'artigo': 'do', 'continente': 'América do Sul', 'capital': 'Santiago'},
    {'nome': 'Colômbia', 'codigo': 'co', 'artigo': 'da', 'continente': 'América do Sul', 'capital': 'Bogotá'},
    {'nome': 'Equador', 'codigo': 'ec', 'artigo': 'do', 'continente': 'América do Sul', 'capital': 'Quito'},
    {'nome': 'Guiana', 'codigo': 'gy', 'artigo': 'da', 'continente': 'América do Sul', 'capital': 'Georgetown'},
    {'nome': 'Paraguai', 'codigo': 'py', 'artigo': 'do', 'continente': 'América do Sul', 'capital': 'Assunção'},
    {'nome': 'Peru', 'codigo': 'pe', 'artigo': 'do', 'continente': 'América do Sul', 'capital': 'Lima'},
    {'nome': 'Suriname', 'codigo': 'sr', 'artigo': 'do', 'continente': 'América do Sul', 'capital': 'Paramaribo'},
    {'nome': 'Uruguai', 'codigo': 'uy', 'artigo': 'do', 'continente': 'América do Sul', 'capital': 'Montevidéu'},
    {'nome': 'Venezuela', 'codigo': 've', 'artigo': 'da', 'continente': 'América do Sul', 'capital': 'Caracas'},

    # OCEANIA
    {'nome': 'Austrália', 'codigo': 'au', 'artigo': 'da', 'continente': 'Oceania', 'capital': 'Camberra'},
    {'nome': 'Fiji', 'codigo': 'fj', 'artigo': 'de', 'continente': 'Oceania', 'capital': 'Suva'},
    {'nome': 'Ilhas Marshall', 'codigo': 'mh', 'artigo': 'das', 'continente': 'Oceania', 'capital': 'Majuro'},
    {'nome': 'Ilhas Salomão', 'codigo': 'sb', 'artigo': 'das', 'continente': 'Oceania', 'capital': 'Honiara'},
    {'nome': 'Kiribati', 'codigo': 'ki', 'artigo': 'do', 'continente': 'Oceania', 'capital': 'Taraua do Sul'},
    {'nome': 'Micronésia', 'codigo': 'fm', 'artigo': 'da', 'continente': 'Oceania', 'capital': 'Paliquir'},
    {'nome': 'Nauru', 'codigo': 'nr', 'artigo': 'de', 'continente': 'Oceania', 'capital': 'Iarém'},
    {'nome': 'Nova Zelândia', 'codigo': 'nz', 'artigo': 'da', 'continente': 'Oceania', 'capital': 'Wellington'},
    {'nome': 'Palau', 'codigo': 'pw', 'artigo': 'de', 'continente': 'Oceania', 'capital': 'Ngerulmud'},
    {'nome': 'Papua-Nova Guiné', 'codigo': 'pg', 'artigo': 'da', 'continente': 'Oceania', 'capital': 'Porto Moresby'},
    {'nome': 'Samoa', 'codigo': 'ws', 'artigo': 'de', 'continente': 'Oceania', 'capital': 'Apia'},
    {'nome': 'Tonga', 'codigo': 'to', 'artigo': 'de', 'continente': 'Oceania', 'capital': 'Nucualofa'},
    {'nome': 'Tuvalu', 'codigo': 'tv', 'artigo': 'de', 'continente': 'Oceania', 'capital': 'Funafuti'},
    {'nome': 'Vanuatu', 'codigo': 'vu', 'artigo': 'de', 'continente': 'Oceania', 'capital': 'Porto Vila'}
]
    
    output_folder = "assets/audio/capitais"
    voice_id = "cgSgspJ2msm6clMCkdW9" # Voz "Jessica"

    try:
        client = ElevenLabs(api_key=CHAVE_API)
        os.makedirs(output_folder, exist_ok=True)
        print(f"--- MODO CAPITAIS ---")
        print(f"Usando a voz: Jessica (ID: {voice_id})")
        
        for pais in paises_info:
            capital = pais['capital']
            texto_pergunta = f'Qual país tem a capital {capital}?'
            nome_arquivo = f"{capital.lower().replace(' ', '_').replace('.', '').replace(',', '')}.mp3"
            caminho_completo = os.path.join(output_folder, nome_arquivo)

            if os.path.exists(caminho_completo):
                print(f" -> Áudio para '{capital}' já existe. Pulando.")
                continue

            audio_gerado = client.text_to_speech.convert(voice_id=voice_id, text=texto_pergunta, model_id="eleven_multilingual_v2")
            save(audio_gerado, caminho_completo)
            print(f" -> Áudio para capital '{capital}' gerado.")

        print("\n✅ Áudios de capitais gerados com sucesso!")
    except Exception as e:
        print(f"\nOcorreu um erro inesperado: {e}")

if __name__ == "__main__":
    gerar_audios_capitais()
