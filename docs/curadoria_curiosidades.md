# Curadoria dos textos de curiosidade — revisão de fatos

Revisão de tudo que o jogo afirma nos textos de "Saiba mais" / curiosidade, pra
não ensinar nada errado. Nada aqui foi alterado no código ainda — é lista de
correções pra discutir. Ninguém está usando o jogo (fase de teste).

**Legenda:** ⚠️ erro confirmado · 🟡 impreciso / discutível · 🔎 ainda a verificar · ✅ conferido, está certo

Áreas:
1. `curiosities_br.js` — bandeiras dos estados (27) — **revisado (1ª passada)**
2. `curiosities_br.js` — paisagens das capitais (27) — **revisado (1ª passada)**
3. `curiosities.js` — curiosidades dos países (~1900 frases) — pendente
4. `figurinhas_data.js` `animais` — 225 bichos (status IUCN + fato) — pendente
5. `figurinhas_data.js` `lendas` — 485 jogadores (país, posição, nº, era, físico) — pendente
6. `figurinhas_data.js` `clubes` — 272 (clube, liga, país) — pendente
7. `figurinhas_data.js` `frutas` / `legumes` / `comidas` / `moedas` — ~300 — pendente

---

## 1. `curiosities_br.js` → `bandeiras`

### ⚠️ AP — Amapá
**Texto:** "A bandeira do Amapá é de 1984, ano em que o território virou estado."
**Problema:** a bandeira é de 1984 (Decreto nº 8, de 23/04/1984), mas o Amapá
ainda era **Território Federal** — só virou **estado em 1988** (Constituição).
O texto junta duas coisas erradas.
**Sugestão:** "A bandeira do Amapá é de 1984, de quando o Amapá ainda era
Território Federal — ele ganhou bandeira antes de virar estado, o que só
aconteceu em 1988. O verde simboliza as florestas, o azul o céu e as águas, o
branco a paz e o amarelo as riquezas minerais. A faixa preta homenageia os que
morreram defendendo o território, e a Fortaleza de São José aparece estilizada à
esquerda."
Fonte: [Wikipédia — Bandeira do Amapá](https://pt.wikipedia.org/wiki/Bandeira_do_Amap%C3%A1)

### ⚠️ PE — Pernambuco
**Texto:** "…a cruz branca no campo vermelho completa o desenho."
**Problema:** está invertido. A parte de baixo da bandeira é **branca com uma
cruz vermelha**, não o contrário.
**Sugestão:** trocar por "…e a cruz vermelha sobre o campo branco completa o
desenho." (A bandeira foi oficializada em 1917, no centenário da revolução —
pode valer citar.)
Fonte: [Wikipédia — Bandeira de Pernambuco](https://pt.wikipedia.org/wiki/Bandeira_de_Pernambuco)

### ⚠️ ES — Espírito Santo
**Texto:** "As faixas azul, branca e rosa vêm das cores da Casa de
Habsburgo-Lorena, ligada a Dom Pedro II."
**Problema:** a ligação com os Habsburgo é falsa. As cores (azul e rosa) são as
**vestes de Nossa Senhora da Vitória**, padroeira da capital. O lema "Trabalha e
Confia" vem da doutrina de Santo Inácio de Loyola.
**Sugestão:** "A bandeira do Espírito Santo foi criada em 1908 (e oficializada em
1947). As faixas azul, branca e rosa são as cores do manto de Nossa Senhora da
Vitória, padroeira de Vitória. O lema 'Trabalha e Confia', inspirado em Santo
Inácio de Loyola, resume o espírito do estado."
Fonte: [Wikipédia — Bandeira do Espírito Santo](https://pt.wikipedia.org/wiki/Bandeira_do_Esp%C3%ADrito_Santo) ·
[A Gazeta](https://www.agazeta.com.br/capixapedia/trabalha-e-confia-na-bandeira-do-es-tem-origem-religiosa-e-no-desenvolvimento-do-estado-0321)

### ⚠️ RR — Roraima
**Texto:** "As faixas verde, amarela e azul representam a floresta, as savanas e
os rios; a faixa vermelha com uma estrela branca simboliza a linha do Equador…"
**Problema:** duas cores erradas. As faixas diagonais são **verde, branca e
azul** (não "amarela"). A estrela é **dourada/amarela**, não branca. A faixa
vermelha = linha do Equador (isso está certo). O ano (1996, Lei nº 133) está
certo.
**Sugestão:** "A bandeira de Roraima é de 1996. As faixas diagonais verde,
branca e azul representam as matas, a paz e o céu; a fina faixa vermelha é a
linha do Equador, que corta o estado, e a estrela dourada representa Roraima —
a mesma que aparece por ele na bandeira do Brasil."
Fonte: [Wikipédia — Bandeira de Roraima](https://pt.wikipedia.org/wiki/Bandeira_de_Roraima)

### 🟡 MS — Mato Grosso do Sul
**Texto:** "Mato Grosso do Sul foi criado em 1977, e sua bandeira é do ano
seguinte."
**Problema:** a bandeira foi instituída em **1º de janeiro de 1979** (Decreto
nº 1), quando o estado foi de fato instalado. "Ano seguinte" a 1977 seria 1978 —
está errado por um ano.
**Sugestão:** "…e sua bandeira é de 1979, quando o estado foi instalado."
Fonte: [Wikipédia — Bandeira de Mato Grosso do Sul](https://pt.wikipedia.org/wiki/Bandeira_de_Mato_Grosso_do_Sul)

### ✅ Conferidos, estão certos
- **MA — Maranhão:** Sousândrade (1889), inspiração na bandeira dos EUA, cores =
  três etnias, e a estrela **é mesmo Beta de Escorpião (Acrab)**, que representa
  o Maranhão na bandeira nacional. OK.
- **MG — Minas:** estandarte da Inconfidência (1789), "Libertas Quae Sera Tamen"
  = "Liberdade ainda que tardia". OK.
- **PB — Paraíba:** o "NEGO", a data 26/07/1930 (assassinato de João Pessoa), o
  preto como luto. OK.
- **AC, BA, PA, RN, RS, DF, PR, SP, TO:** sem erro aparente nesta passada.

### 🔎 A verificar numa 2ª passada
- **AM — Amazonas:** confirmar o que a estrela maior representa (Manaus × o
  estado) — as fontes divergem.
- **CE (1922), GO (1919), PI (1922), SC (1953), SE (1920), RN (1957):** anos de
  adoção não conferidos um a um ainda.

---

## 2. `curiosities_br.js` → `paisagens`

### 🟡 BA — Elevador Lacerda
**Texto:** "…cerca de 72 metros de desnível. Inaugurado em 1873 e movido a
vapor, foi o primeiro elevador urbano do Brasil."
**Observações:**
- Nome original: **Elevador Hidráulico da Conceição da Praia** (o apelido
  "Lacerda" veio em 1896).
- Na inauguração (08/12/1873) tinha **63 m**; passou a ~72 m só na reforma de
  1906. "Cerca de 72 metros" descreve o de hoje, não o de 1873.
- "Movido a vapor" — há fontes que dizem máquina a vapor com cabos e
  contrapesos; ok, mas dá pra suavizar.
- "Primeiro elevador urbano do Brasil" — as fontes dizem **do mundo**; a nossa
  frase está mais modesta, então não é erro.
**Sugestão:** "…Inaugurado em 1873, foi o primeiro elevador urbano do mundo a
servir de transporte público. Hoje vence cerca de 72 metros de desnível e leva
milhares de pessoas por dia entre a Cidade Baixa e a Cidade Alta em segundos."
Fonte: [Prefeitura de Salvador](https://comunicacao.salvador.ba.gov.br/patrimonio-cultural-e-cartao-postal-de-salvador-elevador-lacerda-completa-150-anos-nesta-sexta-8/)

### ✅ Conferidos, estão certos
- **DF — Congresso Nacional:** a cúpula **côncava (virada para cima) é o Senado**
  e a **convexa (virada para baixo) é a Câmara** — o texto está certo.
- **GO — Monumento às Três Raças:** escultora **Neusa Morais**, bronze sobre base
  de granito, ~1967-68. OK.
- **RJ — Cristo Redentor:** Corcovado a 710 m, 1931, 30 m + 8 m de pedestal,
  28 m de braços, Sete Maravilhas. OK.
- **AM — Teatro Amazonas** (1896, ~36 mil peças na cúpula), **AP — Fortaleza de
  São José** (1764-1782, maior do Brasil), **RN — Fortaleza dos Reis Magos**
  (iniciada em 06/01/1598, Dia de Reis), **RR — Boa Vista** (única capital toda
  ao norte do Equador), **SC — Ponte Hercílio Luz** (1926, 821 m, reaberta 2019),
  **SP — MASP** (Lina Bo Bardi, 1968, vão de 74 m), **PB — Estação Cabo Branco**
  (Niemeyer, 2008), **RO — Madeira-Mamoré** ("ferrovia do diabo"). OK.

### 🔎 A verificar numa 2ª passada
- **MT — Igreja do Rosário e São Benedito (Cuiabá):** confirmar "a mais antiga da
  cidade" (o prédio atual pode ser reconstrução do séc. XIX).
- **PI — Ponte Estaiada (Teresina):** conferir a altura do mirante (75 m) e do
  mastro.
- **MA — São Luís:** "maior conjunto de sobrados coloniais portugueses da
  América Latina" — conferir a formulação exata (é Patrimônio da Humanidade
  desde 1997).

---

## 3. `curiosities.js` — curiosidades dos países

~193 países × ~10 frases. Li o arquivo inteiro; abaixo os problemas que valem
correção. A maioria das frases está boa. Muita coisa aqui é "fato curioso" que
circula na internet e é meia-verdade — marquei essas como 🟡.

### ⚠️ Erros confirmados

| País | Frase | Problema / correção |
|---|---|---|
| **Alemanha** (`de`) | "O primeiro livro impresso do mundo foi criado pelo alemão Johannes Gutenberg." | Gutenberg criou a imprensa de **tipos móveis na Europa** (~1450). Livros impressos existiam antes na Ásia (o *Jikji* coreano, 1377, é o mais antigo com tipos móveis de metal; a China imprimia com blocos desde o século IX). → "Gutenberg criou a primeira imprensa de tipos móveis da Europa, que espalhou os livros pelo Ocidente." |
| **Coreia do Sul** (`kr`) | "Os sul-coreanos nascem com um ano de idade, pois a contagem de idade começa no útero." | **Desatualizado.** A Coreia do Sul **aboliu** a "idade coreana" em **28/06/2023** e adotou a contagem internacional. → "Até 2023, os sul-coreanos contavam a idade de um jeito próprio: já nasciam com 1 ano e todos ganhavam mais um ano no dia 1º de janeiro." [CNN](https://www.cnn.com/2023/06/27/asia/south-korea-drops-korean-age-intl-hnk/index.html) |
| **Cazaquistão** (`kz`) | "Astana (agora Nur-Sultan) é uma das capitais mais novas..." | **Desatualizado.** A capital foi Nur-Sultan só de 2019 a 2022 — **voltou a se chamar Astana em setembro de 2022**. → tirar o "(agora Nur-Sultan)". [Eurasianet](https://eurasianet.org/kazakhstan-capital-reverts-to-astana-ending-brief-stint-as-nur-sultan) |
| **Nicarágua** (`ni`) | "O Lago Nicarágua... abriga os únicos tubarões de água doce do mundo." | **Mito.** São **tubarões-touro** que sobem do mar pelo rio San Juan; não são espécie exclusiva nem "os únicos de água doce" (não existe tubarão 100% de água doce; há ainda tubarões de rio na Ásia). → "…abriga tubarões-touro, que nadam do mar de Caribe até o lago subindo o rio San Juan." [Nicaragua.com](https://www.nicaragua.com/blog/the-bull-sharks-of-lake-nicaragua/) |
| **Ilhas Marshall** (`mh`) | "…um dos quatro únicos no mundo que não possui um exército (junto com Andorra, Liechtenstein e Vaticano)." | **Falso** e contradiz o próprio arquivo (Costa Rica, Islândia, Micronésia, Tuvalu, San Marino, Nauru… também não têm). → "…é um dos vários países sem forças armadas; sua defesa é responsabilidade dos Estados Unidos." |
| **Bangladesh** (`bd`) | "…é chamado de bangladês ou **benegalês**." | Erro de digitação → "bengalês" (ou "bângladês"). |
| **Butão** (`bt`) | "A língua falada no país é o **dzonga**." | O idioma é o **dzongkha**. |
| **Japão** (`jp`) | "O Japão é composto por mais de 6.800 ilhas." | Recontagem oficial de **2023**: **14.125 ilhas** (a de 6.852 era de 1987). → "mais de 14.000 ilhas". [Nippon.com](https://www.nippon.com/en/japan-data/h01615/) |

### 🟡 Meia-verdade / lenda / precisa de ressalva

- **Brasil** — "A Feijoada… foi inventada pelos escravos africanos [com sobras]." É um **mito** já desmontado por historiadores; a feijoada vem dos cozidos europeus de feijão com carnes (o feijão com carne-seca já era caro). → "A feijoada tem raízes nos cozidos portugueses de feijão e carne, e virou o prato mais brasileiro que existe."
- **Rússia** — "A Rússia foi o primeiro país a enviar um ser humano ao espaço." Foi a **União Soviética** (Gagarin, 1961).
- **Austrália** — "A 'selfie' foi inventada na Austrália." A **palavra** "selfie" apareceu num fórum australiano em 2002; a foto de si mesmo é bem mais antiga.
- **China** — "O jogo de Kitesurf (pipa) foi inventado na China." Confuso: a **pipa / papagaio de papel** foi inventada na China; kitesurf é esporte náutico moderno. · "Sorvete inventado na China há 4.000 anos" é exagero (sobremesas geladas chinesas são bem mais recentes).
- **França** — "É ilegal nomear um porco de 'Napoleão'." **Lenda urbana**, não existe lei assim. · Croissant "inventado em Viena" — origem debatida (o *kipferl* austríaco), não é consenso.
- **Etiópia** — "abriga o fóssil humano mais antigo já descoberto, 'Lucy'." Lucy (3,2 mi de anos) **não é o mais antigo** — o próprio arquivo cita "Toumaï", no Chade (~7 mi de anos). → "abriga 'Lucy', um dos fósseis de ancestrais humanos mais famosos do mundo."
- **Filipinas** — "o único país de maioria cristã na Ásia." **Timor-Leste também é** (o próprio arquivo diz "único país da Ásia onde a maioria é católica"). → "um dos poucos países de maioria cristã da Ásia."
- **Guatemala** / **México** — chocolate: "inventado pela civilização maia na Guatemala" vs "introduzido ao mundo pelo México". Os dois simplificam demais — o cacau é mesoamericano e o uso do chocolate passou por olmecas, maias e astecas. Padronizar as duas frases.
- **Nova Zelândia** — "o ponto mais distante de qualquer terra está perto da Nova Zelândia." O **Ponto Nemo** fica no Pacífico Sul; a terra mais próxima é a Ilha de Páscoa / Pitcairn / uma ilha da Antártida — não a Nova Zelândia.
- **Trindade e Tobago** — "o pimentão mais picante do mundo, o Trinidad Moruga Scorpion." **Foi**, em 2012; depois foi superado (Carolina Reaper, Pepper X). → "já foi considerado o mais picante do mundo".
- **El Salvador** — "o primeiro país a adotar o Bitcoin como moeda legal." Verdade em 2021, mas o país **reduziu o status do Bitcoin em 2025** (acordo com o FMI). → deixar claro "em 2021, foi o primeiro…".
- **Suíça** — "é ilegal cortar a grama ou lavar o carro aos domingos." Exagero de um fato real (regras locais de silêncio aos domingos em alguns lugares), não é lei nacional.
- **Turcomenistão** — "a 'Porta para o Inferno' queima desde 1971." A data de 1971 é a **história popular**; geólogos contestam (pode ter sido incendiada nos anos 80).
- **Turquia** — "Istambul é a única cidade do mundo localizada em dois continentes." Há outras cidades transcontinentais (Suez, Oremburgo, Atyrau). → "uma das poucas".
- **Portugal** — "a ponte Vasco da Gama é a ponte mais longa da Europa." Já foi; hoje há pontes mais longas. → "uma das mais longas da Europa".
- **Albânia** — "não tem nenhuma loja do McDonald's." Verdadeiro por enquanto — vale reconferir de tempos em tempos.
- **San Marino** vs **Ucrânia** — "constituição mais antiga do mundo ainda em vigor" (San Marino, 1600) vs "primeira constituição do mundo moderno" (Ucrânia, 1710). As duas são "reivindicações" comuns — manter o "afirma ser".

### Observação geral
O padrão "A língua falada no país é X / Quem nasce em Y é chamado de Z" está correto
na esmagadora maioria. Onde há várias línguas oficiais o texto costuma listar as
principais — ok para o público do jogo.

---

## 4. `figurinhas_data.js` → `lendas` (485 jogadores) — **CORRIGIDO**

Revisei os 485. País, posição e era estão certos na quase totalidade. Abaixo o
que foi **efetivamente corrigido no arquivo** (texto `cur` e/ou número da camisa
`num`).

### Número da camisa errado (afeta só a arte da figurinha, não o áudio)
| Jogador | Era | Estava | Correto | Fonte |
|---|---|---|---|---|
| Eusébio | 1966 | 10 | **13** | camisa oficial de 1966 |
| Michael Owen | 1998 | 10 | **20** | camisa oficial da Copa 1998 |
| Paul Gascoigne | 1990 | 8 | **19** | camisa oficial da Itália 90 |
| Karim Benzema | anos 2020 | 10 | **19** | nº que usou no retorno à seleção (o 10 é do Mbappé) |

### Texto `cur` corrigido
| Jogador | O que estava errado |
|---|---|
| **Zbigniew Boniek** | dizia "terceiro nas Copas de 1974 e 1982" — ele não estava no time de 1974 |
| **Park Ji-sung** | "primeiro asiático a jogar E VENCER uma final de Champions" — ficou fora da final de 2008; jogou (e perdeu) as de 2009 e 2011 |
| **Emmanuel Adebayor** | "único togolês a marcar numa Copa" — o único gol do Togo em Copas foi de Mohamed Kader Coubadja |
| **Ahmed Faras** | "único marroquino melhor jogador africano" — Mustapha Hadji também ganhou (1998) |
| **Mohamed Salah** | "recordista de gols numa temporada da PL" — Haaland bateu (36 em 2022-23); ajustado para "recorde de um campeonato de 38 jogos" |
| **Nani** | "marcou na FINAL da Euro 2016" — o gol foi do Éder; Nani marcou na semifinal |
| **Pepe** | "aos 39 jogava SEMIFINAL de Copa" — Portugal foi às quartas em 2022 |
| **Andrei Arshavin** | "4 gols contra a Holanda" — os 4 gols foram pelo Arsenal contra o Liverpool; contra a Holanda foi 1 gol + 2 assistências |
| **Clint Dempsey** | "gol mais rápido da história das Copas" — o recorde é de Hakan Şükür (11 s, 2002); ajustado para "o mais rápido feito pelos EUA" |
| **Gareth Bale** | "três Ligas dos Campeões" — foram cinco (2014, 2016, 2017, 2018, 2022) |
| **Chancel Mbemba** | "melhor jogador da Copa Africana de 2024" — o prêmio foi de Troost-Ekong; Mbemba entrou na seleção do torneio |
| **Karim Bagheri** | "o gol contra os EUA em 1998" — quem marcou foi Estili e Mahdavikia; mantido o recorde de 19 gols nas eliminatórias |
| **Wu Lei** | "maior artilheiro da história da China" — contestado (Hao Haidong tem mais); virou "um dos maiores" |
| **Lothar Matthäus** | "recordista de partidas em Copas" — Messi passou (26 × 25); virou "por muitos anos" |
| **Thierry Henry** | "maior artilheiro da França" — Giroud passou (2022); virou "por muitos anos" |
| **Iker Casillas** | "pênalti na semi e na final da Euro" — os pênaltis defendidos foram nas quartas da Euro 2008 |
| **Sami Hyypiä** | "capitão do Liverpool campeão europeu de 2005" — o capitão era Gerrard |
| **Guillermo Ochoa** | "contra Brasil e Argentina" — as grandes atuações foram vs Brasil (2014) e Alemanha (2018) |
| **Ahmed Hassan** | "tricampeão africano" — foi tetra (1998, 2006, 2008, 2010) |
| **Adel Sellimi** | "melhor jogador africano de 1996" — quem ganhou foi Nwankwo Kanu |
| **Baichung Bhutia** | "primeiro indiano a jogar na Europa" — Mohammed Salim jogou pelo Celtic em 1936; virou "um dos primeiros" |
| **Wynton Rufer / Rune Bratseth** | "campeão europeu pelo Werder Bremen em 1992" — era a Recopa Europeia, não a Copa dos Campeões |
| **Giuseppe Bergomi** | "campeão mundial de 1982 aos 18 anos" — tinha 19 na final |
| **Taffarel** | "defendeu os pênaltis" — defendeu um (o de Massaro) |

Não achei erro em país de nascimento nem em posição/era. Dúvidas menores que
deixei como estão: alguns apelidos, "Alemanha campeã" em 1982 (eram campeões
europeus, não mundiais), datas "por volta de".

---

## 🔊 Áudio a regerar — SÓ das correções

### `assets/audio/br/` (voz feminina, `tools/gerar_br_audios.py`)
- `bandeira_ap.mp3` · `bandeira_pe.mp3` · `bandeira_es.mp3` · `bandeira_ms.mp3` · `bandeira_rr.mp3`
- `paisagem_ba.mp3`

### `assets/audio/curiosidades/` (18 arquivos, `<código>_<índice>`)
`de_9` · `au_8` · `br_3` · `cn_2` · `cn_9` · `jp_2` · `ru_7` · `kr_7` · `nz_8` ·
`kz_5` · `et_2` · `et_5` · `ph_5` · `bd_1` · `bt_0` · `ni_3` · `mh_7` · `tt_7`

### `assets/audio/lendas/` (25 arquivos — só onde o texto mudou)
`de-lothar-matthaus` · `fr-thierry-henry` · `es-iker-casillas` · `pl-zbigniew-boniek` ·
`eg-mohamed-salah` · `kr-park-ji-sung` · `tg-emmanuel-adebayor` · `br-taffarel` ·
`it-giuseppe-bergomi` · `pt-pepe` · `pt-nani` · `ru-andrei-arshavin` · `us-clint-dempsey` ·
`ma-ahmed-faras` · `fi-sami-hyypia` · `mx-guillermo-ochoa` · `wls-gareth-bale` ·
`tn-adel-sellimi` · `nz-wynton-rufer` · `cd-chancel-mbemba` · `cn-wu-lei` ·
`in-baichung-bhutia` · `eg-ahmed-hassan` · `ir-karim-bagheri` · `no-rune-bratseth`

**Não precisa de áudio novo** (só mudou o número da camisa → regerar a *imagem* da figurinha):
`pt-eusebio` (13) · `fr-karim-benzema` (19) · `gb-paul-gascoigne` (19) · `gb-michael-owen` (20)

---

## 5. `figurinhas_data.js` → `clubes` (272) — **CORRIGIDO**

Revisei os 272. Nome, liga e país estão certos na quase totalidade (algumas
ligas ficam desatualizadas com rebaixamentos/acessos — não mexi nisso, muda
toda temporada). Corrigido:

| Clube | O que estava errado |
|---|---|
| **Grêmio** | "bicampeão da Libertadores (1983, 1995)" → **tricampeão** (+2017) |
| **Santos** | "bicampeão... e de novo em 2011" → **tricampeão** da Libertadores (1962, 1963, 2011) |
| **Palmeiras** | "campeão do mundo em 1951" → a FIFA não reconhece a Copa Rio como título mundial; reescrito |
| **Napoli** | "de novo em 2023" → também **2025** |
| **Fiorentina** | "duas finais europeias na década de 2010" → foram 2023 e 2024 (Liga Conferência) |
| **Olympique de Marseille** | "único francês campeão da Champions" → **primeiro** (o PSG ganhou em 2025) |
| **Saint-Étienne** | "recordista de títulos franceses" → o PSG tem mais agora (13 × 10) |
| **AEK Atenas** | "semifinalista da Copa dos Campeões em 1977" → era a Copa da UEFA |
| **Estrela Vermelha** | "único clube dos Bálcãs" → "único clube da ex-Iugoslávia" (Steaua, romeno, também ganhou) |
| **Brøndby** | "semifinalista de 1991 com os irmãos Laudrup" → nenhum dos Laudrup estava no time em 1991 |
| **Maccabi Haifa** | "1ª vitória na Champions, contra a Juventus, em 2009" → foi **3 a 0 no Manchester United, em 2002** |
| **Orlando Pirates** | "único sul-africano campeão da CAF (1995)" → **primeiro** (o Sundowns ganhou em 2016) |
| **Enyimba** | "os únicos títulos continentais de clubes da Nigéria" → há outros; ajustado para "da Liga dos Campeões da CAF" |
| **Toronto FC** | `code` estava `us` → **`ca`** (é clube canadense; só afeta a bandeira do card, não o áudio) |

---

## 🔊 Áudio a regerar — atualizado com os clubes

### `assets/audio/clubes/` (13)
`palmeiras` · `gremio` · `santos` · `napoli` · `fiorentina` · `marseille` ·
`saint-etienne` · `aek-atenas` · `estrela-vermelha` · `brondby` · `maccabi-haifa` ·
`orlando-pirates` · `enyimba`

### Só imagem nova (mudou o país no card, áudio igual)
`clubes/toronto-fc` (agora com a bandeira do Canadá no fundo)

*(as listas de `br/`, `curiosidades/` e `lendas/` continuam como na seção acima)*

---

## 6. `figurinhas_data.js` → `animais` (225) — **REVISADO / CORRIGIDO**

Estes textos foram escritos nesta sessão com pesquisa; a revisão achou pouca
coisa. Corrigido:

| Bicho | O que mudou |
|---|---|
| **Lince-ibérico** | `status` **EN → VU** — a IUCN reclassificou em junho de 2024 (recuperação de 62 para 2.000+ indivíduos); `cur` ajustado para contar a boa notícia. [IUCN](https://iucn.org/press-release/202406/iberian-lynx-rebounding-thanks-conservation-action-iucn-red-list) |
| **Vaquita** | "o menor golfinho do mundo" → "o menor **cetáceo** do mundo" (é uma toninha, não um golfinho; e evita conflito com a Toninha nº 24) |

Conferi as afirmações de superlativo ("o maior", "o único", "restam X",
"o primeiro") uma a uma — as demais batem. Novo tally: **CR 100 · EN 80 · VU 42 · NT 3**.

**Áudio:** a seção `animais` ainda não tem áudio gerado — nada a regerar; as
correções já entram no texto que vai virar a narração.

---

## 7. `frutas` (57) · `legumes` (55) · `comidas` (121) · `moedas` (69) — **REVISADO / CORRIGIDO**

Bem limpos. Corrigido:

| Item | Correção |
|---|---|
| **Toranja** (fruta) | "cruzamento de laranja e **cidra**" → "laranja com **pomelo**" (cidra é outra fruta) |
| **Jaca** (fruta) | "fruta nacional de Bangladesh **e do Sri Lanka**" → só Bangladesh (no Sri Lanka não é oficial) |
| **Peso colombiano** (moeda) | "tartaruga-de-couro e o sapo-arlequim" → descrição genérica (a moeda de 500 traz uma tartaruga-de-pente, não de couro) |
| **Hryvnia** (moeda) | "retomado na independência de 1996" → a independência foi em 1991; a hryvnia voltou em 1996 |

`legumes` e `comidas`: nenhum erro — as histórias (milho do teosinto, batata do Titicaca,
currywurst de 1949, pad thai promovido nos anos 40, borsch na UNESCO 2022…) batem.

**Áudio a regerar:** `assets/audio/frutas/` → **`jaca`** e **`toranja`**.
(`legumes`, `comidas` e `moedas` não têm áudio no jogo.)

---

# ✅ Curadoria completa — resumo do áudio a regerar

| Pasta | Arquivos |
|---|---|
| `assets/audio/br/` | `bandeira_ap` `bandeira_pe` `bandeira_es` `bandeira_ms` `bandeira_rr` `paisagem_ba` |
| `assets/audio/curiosidades/` (18) | `de_9` `au_8` `br_3` `cn_2` `cn_9` `jp_2` `ru_7` `kr_7` `nz_8` `kz_5` `et_2` `et_5` `ph_5` `bd_1` `bt_0` `ni_3` `mh_7` `tt_7` |
| `assets/audio/lendas/` (25) | matthaus, henry, casillas, boniek, salah, park-ji-sung, adebayor, taffarel, bergomi, pepe, nani, arshavin, dempsey, faras, hyypia, ochoa, bale, sellimi, rufer, mbemba, wu-lei, bhutia, ahmed-hassan, bagheri, bratseth *(nomes completos na seção 4)* |
| `assets/audio/clubes/` (13) | `palmeiras` `gremio` `santos` `napoli` `fiorentina` `marseille` `saint-etienne` `aek-atenas` `estrela-vermelha` `brondby` `maccabi-haifa` `orlando-pirates` `enyimba` |
| `assets/audio/frutas/` (2) | `jaca` `toranja` |

**Só imagem nova (número/país mudou, áudio igual):**
- lendas: `pt-eusebio` (13) · `fr-karim-benzema` (19) · `gb-paul-gascoigne` (19) · `gb-michael-owen` (20)
- clubes: `toronto-fc` (bandeira do Canadá)

**Sem áudio ainda (nada a regerar):** `animais` — as 2 correções (lince-ibérico, vaquita) já entram no texto que vai virar narração.
