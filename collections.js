// collections.js
// Seções do álbum que NÃO são países. Cada seção é um "livro" com sigla
// própria; o motor do álbum renderiza qualquer uma a partir daqui.
// (Fase 18 — ligação no álbum + no modo "Qual a Bandeira?")

const BR_ESTADOS = [
    { uf: 'AC', nome: 'Acre', capital: 'Rio Branco' },
    { uf: 'AL', nome: 'Alagoas', capital: 'Maceió' },
    { uf: 'AP', nome: 'Amapá', capital: 'Macapá' },
    { uf: 'AM', nome: 'Amazonas', capital: 'Manaus' },
    { uf: 'BA', nome: 'Bahia', capital: 'Salvador' },
    { uf: 'CE', nome: 'Ceará', capital: 'Fortaleza' },
    { uf: 'DF', nome: 'Distrito Federal', capital: 'Brasília' },
    { uf: 'ES', nome: 'Espírito Santo', capital: 'Vitória' },
    { uf: 'GO', nome: 'Goiás', capital: 'Goiânia' },
    { uf: 'MA', nome: 'Maranhão', capital: 'São Luís' },
    { uf: 'MT', nome: 'Mato Grosso', capital: 'Cuiabá' },
    { uf: 'MS', nome: 'Mato Grosso do Sul', capital: 'Campo Grande' },
    { uf: 'MG', nome: 'Minas Gerais', capital: 'Belo Horizonte' },
    { uf: 'PA', nome: 'Pará', capital: 'Belém' },
    { uf: 'PB', nome: 'Paraíba', capital: 'João Pessoa' },
    { uf: 'PR', nome: 'Paraná', capital: 'Curitiba' },
    { uf: 'PE', nome: 'Pernambuco', capital: 'Recife' },
    { uf: 'PI', nome: 'Piauí', capital: 'Teresina' },
    { uf: 'RJ', nome: 'Rio de Janeiro', capital: 'Rio de Janeiro' },
    { uf: 'RN', nome: 'Rio Grande do Norte', capital: 'Natal' },
    { uf: 'RS', nome: 'Rio Grande do Sul', capital: 'Porto Alegre' },
    { uf: 'RO', nome: 'Rondônia', capital: 'Porto Velho' },
    { uf: 'RR', nome: 'Roraima', capital: 'Boa Vista' },
    { uf: 'SC', nome: 'Santa Catarina', capital: 'Florianópolis' },
    { uf: 'SP', nome: 'São Paulo', capital: 'São Paulo' },
    { uf: 'SE', nome: 'Sergipe', capital: 'Aracaju' },
    { uf: 'TO', nome: 'Tocantins', capital: 'Palmas' },
];

// paisagem icônica de cada capital (nome que vai na figurinha)
const BR_PAISAGENS = {
    AC: 'Palácio Rio Branco',
    AL: 'Praia de Pajuçara',
    AP: 'Fortaleza de São José',
    AM: 'Teatro Amazonas',
    BA: 'Elevador Lacerda',
    CE: 'Ponte dos Ingleses',
    DF: 'Congresso Nacional',
    ES: 'Convento da Penha',
    GO: 'Monumento às Três Raças',
    MA: 'Palácio dos Leões',
    MT: 'Igreja do Rosário',
    MS: 'Morada dos Baís',
    MG: 'Praça da Liberdade',
    PA: 'Teatro da Paz',
    PB: 'Farol do Cabo Branco',   // imagem pendente
    PR: 'Jardim Botânico',
    PE: 'Marco Zero',
    PI: 'Ponte Estaiada',
    RJ: 'Cristo Redentor',
    RN: 'Forte dos Reis Magos',
    RS: 'Usina do Gasômetro',
    RO: 'Locomotiva Madeira-Mamoré',
    RR: 'Monumento aos Garimpeiros', // imagem pendente
    SC: 'Ponte Hercílio Luz',
    SP: 'MASP',
    SE: 'Passarela do Caranguejo',
    TO: 'Palácio Araguaia',
};

// estados com brilho fixo (os "grandões" — como os países principais)
const BR_SHINY = ['SP', 'RJ', 'MG', 'RS', 'BA', 'PR', 'DF'];

// capitais cuja paisagem ainda não foi gerada
const CAPITAIS_PENDENTES = ['PB', 'RR'];

const COLLECTIONS = {
    estados: {
        id: 'estados',
        nome: 'Estados do Brasil',
        emoji: '🇧🇷',
        sigla: 'BRA',
        accent: '#22c55e',
        tipo: 'flag',
        itens: BR_ESTADOS.map((e, i) => ({
            num: i + 1,
            codigo: 'uf-' + e.uf.toLowerCase(),
            nome: e.nome,
            sub: e.uf,
            src: 'assets/stickers/bra/' + e.uf.toLowerCase() + '.png',
            fixedShiny: BR_SHINY.includes(e.uf),
            // usado pelo modo "Qual a Bandeira?"
            artigo: 'de', capital: e.capital, uf: e.uf,
        })),
    },
    capitais: {
        id: 'capitais',
        nome: 'Capitais do Brasil',
        emoji: '🏙️',
        sigla: 'CAP',
        accent: '#f59e0b',
        tipo: 'img',
        itens: BR_ESTADOS.map((e, i) => ({
            num: i + 1,
            codigo: 'cap-' + e.uf.toLowerCase(),
            nome: BR_PAISAGENS[e.uf] || e.capital,
            sub: e.capital + ' · ' + e.uf,
            src: 'assets/stickers/capitais/' + e.uf.toLowerCase() + '.jpg',
            fixedShiny: BR_SHINY.includes(e.uf),
            pendente: CAPITAIS_PENDENTES.includes(e.uf),
            uf: e.uf,
        })),
    },
};

if (typeof window !== 'undefined') {
    window.COLLECTIONS = COLLECTIONS;
    window.BR_ESTADOS = BR_ESTADOS;
}
