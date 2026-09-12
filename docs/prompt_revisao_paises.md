# Pesquisa: revisao dos paises de cada figurinha (animais + legumes)

> Cole este texto INTEIRO no ChatGPT (de preferencia com "Deep Research" / busca ativada) e, separadamente, no Gemini (com "Deep Research"). Salve as DUAS respostas e mande de volta pro Claude -- ele cruza as duas e aplica.

## Seu papel

Voce e um zoologo/botanico revisando os dados de um album de figurinhas educativo brasileiro. Para cada item ha uma lista de **codigos de pais ISO 3166-1 alfa-2 minusculos** (ex.: `br`, `id`, `cd`). Verifique e corrija cada lista usando fontes confiaveis.

## Regras (valem para os dois blocos)

- **Entre 1 e 5 codigos** por item. Nunca 0, nunca mais que 5.
- Se houver mais de 5 paises possiveis, escolha os **5 mais importantes** (onde esta a maior parte da populacao / producao / associacao).
- Ordene do mais importante para o menos importante.
- Use **so ISO alfa-2 minusculo**. Para areas principais que nao sao paises soberanos, use o codigo do territorio: `aq` (Antartida), `nc` (Nova Caledonia), `pf` (Polinesia Francesa), `ky` (Ilhas Cayman), `gf` (Guiana Francesa), `ms` (Montserrat), `sb` (Ilhas Salomao), `pg` (Papua-Nova Guine). Para o Havai use `us`.

### ANIMAIS -- criterio: "onde a especie AINDA vive hoje, em populacao selvagem"

- Conta: pais com populacao **selvagem atual, residente ou reprodutiva** confirmada.
- **NAO conta**: pais onde a especie ja foi extinta localmente; registro apenas historico; individuos errantes (vagrants); apenas cativeiro; reintroducao ainda nao estabelecida -- exceto quando for o UNICO lugar que restou (ex.: rinoceronte-branco-do-norte).
- Fonte principal: **IUCN Red List** (ficha da especie -> "Geographic Range" -> "Countries of Occurrence: Extant (resident/breeding)"). Secundaria: ICMBio (Brasil), BirdLife, artigos recentes.
- Especies **marinhas de ampla distribuicao** (baleias, tubaroes, tartarugas marinhas, corais, raias): liste os paises cujas aguas concentram as **populacoes, colonias de reproducao, agregacoes ou desova** mais importantes. Max 5.
- Especies **endemicas de um pais**: 1 codigo so.

### LEGUMES -- criterio: "onde e MAIS CONSUMIDO no mundo hoje"

- Combine: maiores consumidores per capita + paises onde e alimento basico / ingrediente iconico + grandes produtores que tambem consomem.
- Fontes: FAOSTAT (food supply), Our World in Data, referencias culinarias solidas.
- 1 a 5 codigos, do mais forte pro mais fraco.

## Formato da resposta (siga EXATAMENTE)

Responda com TRES blocos e NADA fora deles:

```
##PAISES
1|br
2|br
11|br pe co ve bo
...
225|id
L1|in br mm us
L2|us mx br cn in
...
L55|be nl gb de us
##MUDANCAS
11 | tinha: br pe co bo mx | virou: br pe co ve bo | onca sumiu do sul do Brasil, populacao forte na Venezuela | IUCN 2017
L14 | tinha: cn uz us ru af | virou: ... | ... | FAOSTAT 2022
##INCERTOS
95, 143, 173, L7
```

Regras do formato:
- `ID|cod cod cod` -- pipe logo depois do id, codigos separados por espaco simples.
- Animais = `1` ate `225`. Legumes = `L1` ate `L55`.
- No `##PAISES`, liste TODOS os 280 (inclusive os que voce NAO mudou -- repita a lista atual).
- `##MUDANCAS`: so os itens alterados.
- `##INCERTOS`: numeros onde, mesmo pesquisando, voce ficou em duvida.
- Nenhum texto, comentario ou markdown fora dos tres blocos.

---

## ANIMAIS (225) -- `id | slug | nome_ingles | status_IUCN | paises_atuais_no_album`

1 | mico-leao-dourado | golden lion tamarin | EN | br
2 | mico-leao-preto | black lion tamarin | EN | br
3 | mico-leao-de-cara-preta | black-faced lion tamarin | EN | br
4 | mico-leao-de-cara-dourada | golden-headed lion tamarin | EN | br
5 | muriqui-do-norte | northern muriqui | CR | br
6 | muriqui-do-sul | southern muriqui | EN | br
7 | sauim-de-coleira | pied tamarin | EN | br
8 | macaco-prego-do-peito-amarelo | yellow-breasted capuchin | EN | br
9 | guigo-da-caatinga | blond titi monkey | CR | br
10 | cuxiu-de-nariz-branco | white-nosed saki monkey | EN | br
11 | onca-pintada | jaguar | VU | br pe co bo mx
12 | ariranha | giant otter | EN | br pe bo co gy
13 | lobo-guara | maned wolf | VU | br bo ar py pe
14 | tamandua-bandeira | giant anteater | VU | br bo ar py co
15 | tatu-canastra | giant armadillo | VU | br bo pe py gy
16 | tatu-bola | Brazilian three-banded armadillo | VU | br
17 | anta-brasileira | lowland tapir | VU | br pe co bo ec
18 | queixada | white-lipped peccary | VU | br pe bo co py
19 | cervo-do-pantanal | marsh deer | VU | br bo py ar pe
20 | gato-maracaja | margay | VU | br pe co bo mx
21 | preguica-de-coleira | maned sloth | VU | br
22 | peixe-boi-marinho | Antillean manatee | EN | br ve co mx cu
23 | peixe-boi-da-amazonia | Amazonian manatee | VU | br pe co ec ve
24 | toninha | franciscana dolphin | EN | br uy ar
25 | boto-cinza | Guiana dolphin | EN | br ve co gy hn
26 | boto-do-araguaia | Araguaian river dolphin | EN | br
27 | ararinha-azul | Spix's macaw | CR | br
28 | arara-azul-de-lear | Lear's macaw | EN | br
29 | arara-azul-grande | hyacinth macaw | VU | br bo py
30 | soldadinho-do-araripe | Araripe manakin | CR | br
31 | pato-mergulhao | Brazilian merganser | CR | br ar py
32 | mutum-do-sudeste | red-billed curassow | EN | br
33 | mutum-de-alagoas | Alagoas curassow | CR | br
34 | jacutinga | black-fronted piping guan | VU | br ar py
35 | bicudo | great-billed seed finch | EN | br bo ar py
36 | papagaio-chaua | red-browed amazon parrot | EN | br
37 | papagaio-de-peito-roxo | vinaceous-breasted amazon parrot | EN | br ar py
38 | periquito-cara-suja | grey-breasted parakeet | VU | br
39 | rolinha-do-planalto | blue-eyed ground dove | CR | br
40 | formigueiro-do-litoral | restinga antwren | CR | br
41 | choquinha-de-alagoas | Alagoas antwren | CR | br
42 | aguia-cinzenta | crowned solitary eagle | EN | ar br bo py uy
43 | pica-pau-de-cara-canela | Kaempfer's woodpecker | VU | br
44 | macarico-esquimo | Eskimo curlew | CR | ca us ar br
45 | cagado-de-hoge | Hoge's side-necked turtle | EN | br
46 | lagartixa-da-praia | Lutz's tropidurus lizard | EN | br
47 | perereca-de-alcatrazes | Alcatrazes tree frog | CR | br
48 | sapinho-de-barriga-vermelha | red-bellied toad | EN | br
49 | tartaruga-de-couro | leatherback sea turtle | VU | br sr ga cr tt
50 | mero | Atlantic goliath grouper | VU | br us mx sn cu
51 | raia-viola | Brazilian guitarfish | CR | br uy ar
52 | borboleta-da-praia | Burchell's swallowtail butterfly | CR | br
53 | leopardo-de-amur | Amur leopard | CR | ru cn
54 | guepardo-asiatico | Asiatic cheetah | CR | ir
55 | tigre-de-sumatra | Sumatran tiger | CR | id
56 | leao-asiatico | Asiatic lion | EN | in
57 | leopardo-das-neves | snow leopard | VU | cn mn in kg kz
58 | lince-iberico | Iberian lynx | VU | es pt
59 | gato-andino | Andean mountain cat | EN | pe bo ar cl
60 | cachorro-selvagem-africano | African wild dog | EN | bw tz zw za ke
61 | lobo-etiope | Ethiopian wolf | EN | et
62 | rinoceronte-branco-do-norte | northern white rhinoceros | CR | ke cd ss
63 | rinoceronte-de-java | Javan rhinoceros | CR | id
64 | rinoceronte-de-sumatra | Sumatran rhinoceros | CR | id
65 | rinoceronte-negro | black rhinoceros | CR | na za ke zw tz
66 | elefante-da-floresta-africano | African forest elephant | CR | ga cg cd cm cf
67 | elefante-de-sumatra | Sumatran elephant | CR | id
68 | elefante-asiatico | Asian elephant | EN | in lk th mm my
69 | girafa-masai | Masai giraffe | EN | ke tz
70 | zebra-de-grevy | Grévy's zebra | EN | ke et
71 | orix-da-arabia | Arabian oryx | VU | om sa ae jo
72 | cavalo-de-przewalski | Przewalski's horse | EN | mn cn kz
73 | anta-da-montanha | mountain tapir | EN | co ec pe
74 | saola | saola | CR | vn la
75 | tamaru | tamaraw | CR | ph
76 | orangotango-de-sumatra | Sumatran orangutan | CR | id
77 | orangotango-de-borneu | Bornean orangutan | CR | id my bn
78 | orangotango-de-tapanuli | Tapanuli orangutan | CR | id
79 | gorila-do-rio-cross | Cross River gorilla | CR | ng cm
80 | gorila-das-montanhas | mountain gorilla | EN | cd rw ug
81 | bonobo | bonobo | EN | cd
82 | chimpanze | chimpanzee | EN | cd cm gn ci ug
83 | gibao-de-hainan | Hainan gibbon | CR | cn
84 | loris-lento-de-java | Javan slow loris | CR | id
85 | sifaka-sedoso | silky sifaka | CR | mg
86 | aye-aye | aye-aye | EN | mg
87 | diabo-da-tasmania | Tasmanian devil | EN | au
88 | numbat | numbat | EN | au
89 | coala | koala | EN | au
90 | ornitorrinco | platypus | NT | au
91 | preguica-pigmeia | pygmy three-toed sloth | CR | pa
92 | pangolim-malaio | Sunda pangolin | CR | id my th vn la
93 | vaquita | vaquita porpoise | CR | mx
94 | baleia-franca-do-atlantico-norte | North Atlantic right whale | CR | us ca
95 | baleia-azul | blue whale | EN | cl lk us is au
96 | golfinho-do-ganges | Ganges river dolphin | EN | in bd np
97 | golfinho-do-irrawaddy | Irrawaddy dolphin | EN | mm kh bd id th
98 | foca-de-saimaa | Saimaa ringed seal | EN | fi
99 | foca-monge-do-havai | Hawaiian monk seal | EN | us
100 | dugongo | dugong | VU | au ae id mz in
101 | lontra-marinha | sea otter | EN | us ru ca
102 | urso-polar | polar bear | VU | ca ru us gl no
103 | panda-gigante | giant panda | VU | cn
104 | kakapo | kakapo parrot | CR | nz
105 | condor-da-california | California condor | CR | us mx
106 | aguia-das-filipinas | Philippine eagle | CR | ph
107 | harpia | harpy eagle | VU | br pa co ec pe
108 | grou-americano | whooping crane | EN | ca us
109 | ibis-gigante | giant ibis | CR | kh la vn
110 | abetarda-indiana | great Indian bustard | CR | in pk
111 | macarico-de-bico-de-colher | spoon-billed sandpiper | CR | ru mm bd cn th
112 | abutre-de-dorso-branco | white-rumped vulture | CR | in np bd pk mm
113 | arara-de-garganta-azul | blue-throated macaw | CR | bo
114 | arara-verde-grande | great green macaw | CR | cr ni pa co ec
115 | papagaio-cinzento-africano | African grey parrot | EN | cd cm cg ga gh
116 | cacatua-de-crista-amarela | yellow-crested cockatoo | CR | id tl
117 | calau-de-capacete | helmeted hornbill | CR | id my th mm bn
118 | pinguim-africano | African penguin | CR | za na
119 | pinguim-de-galapagos | Galápagos penguin | EN | ec
120 | pinguim-imperador | emperor penguin | NT | aq
121 | kagu | kagu bird | EN | nc
122 | tartaruga-de-pente | hawksbill sea turtle | CR | au id mx cu sc
123 | tartaruga-verde | green sea turtle | EN | au cr mx om id
124 | tartaruga-do-yangtze | Yangtze giant softshell turtle | CR | cn vn
125 | tartaruga-angonoka | ploughshare tortoise | CR | mg
126 | gavial | gharial | CR | in np
127 | crocodilo-das-filipinas | Philippine crocodile | CR | ph
128 | iguana-azul | blue iguana | EN | ky
129 | iguana-rosa-de-galapagos | Galápagos pink land iguana | CR | ec
130 | dragao-de-komodo | Komodo dragon | EN | id
131 | axolote | axolotl salamander | CR | mx
132 | salamandra-gigante-da-china | Chinese giant salamander | CR | cn
133 | sapo-dourado-do-panama | Panamanian golden frog | CR | pa
134 | ra-de-corroboree | southern corroboree frog | CR | au
135 | ra-galinha | mountain chicken frog | CR | dm ms
136 | sapo-de-darwin | Darwin's frog | EN | cl ar
137 | ra-do-titicaca | Titicaca water frog | EN | pe bo
138 | ra-golias | goliath frog | EN | cm gq
139 | perereca-lemur | lemur leaf frog | CR | cr pa co
140 | enguia-europeia | European eel | CR | fr es pt gb it
141 | atum-azul-do-sul | southern bluefin tuna | EN | au nz za id jp
142 | esturjao-beluga | beluga sturgeon | CR | ir ru kz az ro
143 | tubarao-baleia | whale shark | EN | mx au ph mz mv
144 | tubarao-anjo | angelshark | CR | es ie gb it tn
145 | tubarao-martelo-grande | great hammerhead shark | CR | au us bs mx za
146 | peixe-serra | largetooth sawfish | CR | au us ni br mz
147 | celacanto | coelacanth fish | CR | km tz mz za mg
148 | coral-chifre-de-alce | elkhorn coral | CR | bs cu us mx hn
149 | coral-chifre-de-veado | staghorn coral | CR | bs cu us mx hn
150 | bicho-pau-de-lord-howe | Lord Howe Island stick insect | CR | au
151 | borboleta-monarca | monarch butterfly | VU | mx us ca
152 | borboleta-rainha-alexandra | Queen Alexandra's birdwing butterfly | EN | pg
153 | mamangava-de-mancha-ferruginosa | rusty-patched bumble bee | CR | us ca
154 | sapo-parteiro-de-maiorca | Mallorcan midwife toad | EN | es
155 | ra-arlequim-de-limosa | Limosa harlequin frog | CR | pa
156 | jambato | Quito harlequin toad | CR | ec
157 | olm | olm cave salamander | VU | si hr ba it
158 | salamandra-gigante-do-japao | Japanese giant salamander | VU | jp
159 | sapo-de-kihansi | Kihansi spray toad | CR | tz
160 | perereca-de-morelet | Morelet's tree frog | CR | mx bz gt hn sv
161 | perereca-de-veneno-de-lehmann | Lehmann's poison frog | CR | co
162 | ra-marsupial-de-chifres | horned marsupial frog | EN | co ec pa
163 | ra-de-vidro-da-colombia | Lynch's glass frog | EN | co ec
164 | ra-do-monte-nimba | Nimba toad | EN | gn ci lr
165 | sapo-de-hula | Hula painted frog | CR | il
166 | ra-de-hamilton | Hamilton's frog | EN | nz
167 | achoque | Lake Pátzcuaro salamander | CR | mx
168 | ra-gigante-do-junin | Lake Junín frog | EN | pe
169 | coral-pilar | pillar coral | CR | bs cu us mx hn
170 | coral-cacto-do-caribe | rough cactus coral | EN | bs cu us mx hn
171 | coral-elegante | elegance coral | VU | id ph au jp fj
172 | coral-cogumelo | mushroom coral | VU | id ph au jp fj
173 | coral-negro | black coral | VU | id ph au us mx
174 | coral-vermelho-do-mediterraneo | Mediterranean red coral | EN | it es fr gr tn
175 | coral-azul | blue coral | VU | id ph au jp fj
176 | coral-orgao | organ pipe coral | NT | id ph au jp fj
177 | coral-de-agua-fria | cold-water coral | VU | no gb ie us is
178 | gorgonia-vermelha | red gorgonian sea fan | VU | it es fr hr gr
179 | indri | indri lemur | CR | mg
180 | fossa | fossa | VU | mg
181 | camaleao-de-tarzan | Tarzan's chameleon | CR | mg
182 | tartaruga-radiada | radiated tortoise | CR | mg
183 | pombo-manumea | tooth-billed pigeon | CR | ws
184 | corvo-do-havai | Hawaiian crow | CR | us
185 | pato-de-laysan | Laysan duck | CR | us
186 | akikiki | akikiki | CR | us
187 | monarca-de-taiti | Tahiti monarch | CR | pf
188 | loris-de-rimatara | Rimatara lorikeet | EN | pf
189 | kiwi-de-okarito | Okarito kiwi | VU | nz
190 | weta-gigante | giant weta | EN | nz
191 | caramujo-de-partula | Partula tree snail | CR | pf
192 | iguana-de-crista-de-fiji | Fiji crested iguana | CR | fj
193 | caranguejo-dos-coqueiros | coconut crab | VU | sc vu sb ki fj
194 | raposa-voadora-de-livingstone | Livingstone's fruit bat | CR | km
195 | rinoceronte-indiano | Indian rhinoceros | VU | in np
196 | porco-pigmeu | pygmy hog | EN | in
197 | macaco-de-nariz-arrebitado | golden snub-nosed monkey | EN | cn
198 | tartaruga-estrelada-da-birmania | Burmese star tortoise | CR | mm
199 | tartaruga-caixa-da-china | golden coin turtle | CR | cn vn
200 | peixe-napoleao | humphead wrasse | EN | id ph au mv fj
201 | arraia-gigante-de-agua-doce | giant freshwater stingray | EN | th kh my id au
202 | hirola | hirola antelope | CR | ke so
203 | macaco-de-roloway | Roloway monkey | CR | ci gh
204 | pangolim-gigante | giant pangolin | EN | cd cm ug ga ci
205 | ibis-careca-do-norte | northern bald ibis | EN | ma es tr
206 | toupeira-dourada-de-de-winton | De Winton's golden mole | CR | za
207 | condor-dos-andes | Andean condor | VU | ar cl pe bo co
208 | urso-de-oculos | spectacled bear | VU | pe bo co ec ve
209 | huemul | huemul deer | EN | cl ar
210 | chinchila-de-cauda-curta | short-tailed chinchilla | EN | cl ar bo pe
211 | macaco-aranha-marrom | brown spider monkey | CR | co ve
212 | tartaruga-do-rio-magdalena | Magdalena river turtle | CR | co
213 | estrela-do-mar-girassol | sunflower sea star | CR | us ca mx
214 | abalone-branco | white abalone | CR | us mx
215 | vison-europeu | European mink | CR | es fr ro ua ru
216 | foca-do-caspio | Caspian seal | EN | ru kz az ir tm
217 | esturjao-do-atlantico | Atlantic sturgeon | CR | us ca
218 | lince-dos-balcas | Balkan lynx | CR | mk al me
219 | mexilhao-perola-de-agua-doce | freshwater pearl mussel | EN | ru se no fi gb
220 | cavalo-marinho-de-knysna | Knysna seahorse | EN | za
221 | tubarao-frade | basking shark | EN | gb ie us ca no
222 | raia-jamanta-de-recife | reef manta ray | VU | id mv au mz fj
223 | tridacna-gigante | giant clam | VU | id ph au fj sb
224 | caranguejo-ferradura-tricuspide | tri-spine horseshoe crab | EN | cn jp in my th
225 | abelha-gigante-de-wallace | Wallace's giant bee | VU | id

---

## LEGUMES (55) -- `id | slug | nome_ingles | paises_atuais_no_album`

L1 | feijao | common beans | br mx in us mm
L2 | milho | maize (corn) cob | us cn br mx in
L3 | batata | potato | cn in ru ua pe
L4 | batata-doce | sweet potato | cn ng ug us jp
L5 | mandioca | cassava root | ng cd th id br
L6 | inhame | yam | ng gh ci bj cm
L7 | taro | taro corm | ng cn gh cm jp
L8 | tomate | tomato | cn in tr us it
L9 | pimenta | chili peppers | in cn mx th hu
L10 | abobora | pumpkin (squash) | cn in ru us mx
L11 | cebola | onion | in cn us eg tr
L12 | alho | garlic bulb | cn in bd es eg
L13 | alho-poro | leek | wls fr be tr nl
L14 | cenoura | carrot | cn uz us ru af
L15 | beterraba | beetroot | ru fr us de ua
L16 | nabo | turnip | cn jp gb fr in
L17 | rabanete | radish | cn jp kr mx de
L18 | repolho | cabbage | cn in ru kr de
L19 | couve | kale / collard greens | br pt ke us cn
L20 | brocolis | broccoli | cn in us es it
L21 | couve-flor | cauliflower | in cn us es it
L22 | alface | lettuce | cn us in es it
L23 | espinafre | spinach | cn us ir jp tr
L24 | acelga | chard | it fr gr tr us
L25 | rucula | arugula (rocket) | it fr gr eg us
L26 | berinjela | eggplant (aubergine) | cn in eg tr it
L27 | quiabo | okra pods | in ng br us eg
L28 | pepino | cucumber | cn ru tr ir ua
L29 | abobrinha | zucchini | cn it eg es mx
L30 | chuchu | chayote | mx cr br in cn
L31 | ervilha | peas in the pod | cn in ru us fr
L32 | grao-de-bico | chickpeas | in tr pk et lb
L33 | lentilha | lentils | in bd np tr ca
L34 | feijao-fradinho | black-eyed peas (cowpea) | ng ne br us in
L35 | soja | soybeans | br us ar cn in
L36 | amendoim | peanuts | cn in ng us id
L37 | azuki | adzuki beans | jp cn kr tw
L38 | aspargo | asparagus | cn de us fr pe
L39 | alcachofra | artichoke | it eg es pe ar
L40 | aipo | celery | cn us in eg fr
L41 | funcho | fennel bulb | in it fr es eg
L42 | cebolinha | scallions (green onion) | cn jp kr br th
L43 | gengibre | ginger root | in ng cn id np
L44 | curcuma | turmeric root | in bd pk mm np
L45 | wasabi | wasabi rhizome | jp
L46 | lotus | lotus root | cn jp in kr th
L47 | bambu | bamboo shoots | cn th jp np tw
L48 | daikon | daikon radish | jp kr cn vn in
L49 | jilo | scarlet eggplant (jiló) | br
L50 | maxixe | West Indian gherkin (maxixe) | br
L51 | palmito | heart of palm | br cr ec py bo
L52 | mandioquinha | arracacha (Peruvian parsnip) | br pe co ve bo
L53 | quinoa | quinoa grains | pe bo ec us cn
L54 | shiitake | shiitake mushrooms | cn jp kr us nl
L55 | couve-bruxelas | Brussels sprouts | be nl gb de us
