<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROI Dinâmico - Odontologia (RDC Anvisa 1002/2025)</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- jQuery -->
    <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>

    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; padding-bottom: 120px; }
        .critical-badge { background-color: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
        .nc-badge { background-color: #e0e7ff; color: #3730a3; border: 1px solid #818cf8; }
        .radio-option:checked + div { border-color: #3b82f6; background-color: #eff6ff; }
        .score-0-2 { border-left: 4px solid #ef4444 !important; }
        .score-3 { border-left: 4px solid #eab308 !important; }
        .score-4-5 { border-left: 4px solid #22c55e !important; }
        
        #dashboard {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            background: #ffffff;
            box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1);
            z-index: 50;
            transition: all 0.3s ease;
        }

        @media print {
            body { background-color: #fff; padding-bottom: 0; }
            #dashboard, #setup-panel, .no-print { display: none !important; }
            .radio-option:not(:checked) + div { display: none; }
            .radio-option:checked + div { border: 1px solid #000; background-color: #fff; }
            .question-container { break-inside: avoid; page-break-inside: avoid; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 10px; }
            header { border: none; box-shadow: none; }
        }
    </style>
</head>
<body class="text-gray-800">

    <div class="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        
        <!-- Cabeçalho -->
        <header class="bg-white rounded-xl shadow-md p-6 mb-6 border-t-4 border-blue-600">
            <div class="flex justify-between items-start">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 mb-2"><i class="fa-solid fa-tooth text-blue-600 mr-2"></i>Autoinspeção / ROI Odontologia</h1>
                    <p class="text-sm text-gray-600">Classificação inteligente baseada na <b>RDC Anvisa nº 1.002/2025</b>.</p>
                </div>
                <button onclick="window.print()" class="no-print bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded shadow hidden" id="btn-print">
                    <i class="fa-solid fa-print mr-2"></i> Imprimir Laudo
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase">Razão Social / Nome Fantasia</label>
                    <input type="text" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" placeholder="Nome do Estabelecimento">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase">CNPJ / CPF</label>
                    <input type="text" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" placeholder="00.000.000/0000-00">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase">Avaliador (Fiscal ou RT)</label>
                    <input type="text" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" placeholder="Nome do Avaliador">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase">Data da Avaliação</label>
                    <input type="date" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500">
                </div>
            </div>
        </header>

        <!-- PASSO 1: Setup do Estabelecimento (Classificador) -->
        <div id="setup-panel" class="bg-white rounded-xl shadow-lg border-2 border-indigo-100 p-6 mb-8">
            <h2 class="text-xl font-black text-indigo-900 mb-2"><i class="fa-solid fa-sliders mr-2"></i>Passo 1: Perfil do Estabelecimento</h2>
            <p class="text-sm text-gray-600 mb-6">Selecione abaixo os serviços e equipamentos que a clínica possui. O Roteiro será gerado apenas com as perguntas aplicáveis.</p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-indigo-50 transition">
                    <input type="checkbox" id="chk-rx-fixo" class="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                    <span class="ml-3 font-semibold text-gray-700">Possui Raio-X Intraoral (Fixo na Parede)</span>
                </label>
                
                <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-indigo-50 transition">
                    <input type="checkbox" id="chk-rx-portatil" class="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                    <span class="ml-3 font-semibold text-gray-700">Possui Raio-X Portátil (Mão/Tripé)</span>
                </label>

                <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-indigo-50 transition">
                    <input type="checkbox" id="chk-rx-extraoral" class="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                    <span class="ml-3 font-semibold text-gray-700">Possui Sala de Imagem (Panorâmico / Tomografia)</span>
                </label>

                <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-indigo-50 transition">
                    <input type="checkbox" id="chk-sedacao" class="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                    <span class="ml-3 font-semibold text-gray-700">Realiza Sedação (Inalatória com Óxido Nitroso ou Endovenosa)</span>
                </label>

                <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-indigo-50 transition">
                    <input type="checkbox" id="chk-lpd" class="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                    <span class="ml-3 font-semibold text-gray-700">Possui Laboratório de Prótese Dentária (LPD) próprio</span>
                </label>
            </div>

            <div class="flex justify-end">
                <button id="btn-generate" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-colors text-lg">
                    <i class="fa-solid fa-wand-magic-sparkles mr-2"></i> Gerar ROI Personalizado
                </button>
            </div>
        </div>

        <!-- PASSO 2: Container do Formulário Gerado dinamicamente -->
        <div id="roi-wrapper" class="hidden">
            <div class="mb-4 text-xs text-gray-500 flex gap-4 bg-white p-3 rounded shadow-sm border border-gray-200">
                <span class="font-bold mr-2">Legenda de Avaliação:</span>
                <span class="flex items-center"><span class="w-3 h-3 rounded-full bg-red-500 mr-1"></span> 0 a 2: Inaceitável</span>
                <span class="flex items-center"><span class="w-3 h-3 rounded-full bg-yellow-500 mr-1"></span> 3: Aceitável (Mínimo da Norma)</span>
                <span class="flex items-center"><span class="w-3 h-3 rounded-full bg-green-500 mr-1"></span> 4 e 5: Baixo Risco (Padrão Ouro)</span>
            </div>
            
            <form id="roi-form" class="space-y-8">
                <!-- Conteúdo injetado via jQuery -->
            </form>
        </div>

    </div>

    <!-- Painel de Dashboard Fixo (Escondido inicialmente) -->
    <div id="dashboard" class="hidden p-4 border-t-4 border-gray-300">
        <div class="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            
            <div class="flex items-center gap-6">
                <div class="text-center">
                    <p class="text-xs text-gray-500 font-bold uppercase">Progresso</p>
                    <p class="text-2xl font-black text-gray-800"><span id="lbl-answered">0</span><span class="text-sm text-gray-400">/<span id="lbl-total">0</span></span></p>
                </div>
                <div class="h-10 w-px bg-gray-300"></div>
                <div class="text-center">
                    <p class="text-xs text-gray-500 font-bold uppercase">Pontuação</p>
                    <p class="text-2xl font-black text-blue-600"><span id="lbl-score">0</span> <span class="text-sm text-gray-400">pts</span></p>
                </div>
                <div class="h-10 w-px bg-gray-300"></div>
                <div class="text-center">
                    <p class="text-xs text-gray-500 font-bold uppercase">Conformidade</p>
                    <p class="text-2xl font-black text-gray-800"><span id="lbl-percent">0</span>%</p>
                </div>
            </div>

            <div class="flex items-center gap-4 w-full md:w-auto">
                <div id="alert-critical" class="hidden flex items-center bg-red-100 text-red-800 px-4 py-2 rounded-lg border border-red-300 shadow-sm animate-pulse">
                    <i class="fa-solid fa-triangle-exclamation text-xl mr-2"></i>
                    <div class="text-sm">
                        <p class="font-bold">Gatilho de Risco Ativado!</p>
                        <p class="text-xs">Item Crítico com nota < 3 detectado.</p>
                    </div>
                </div>

                <div id="status-card" class="bg-gray-100 text-gray-600 px-6 py-3 rounded-lg border-2 border-gray-300 shadow-sm min-w-[250px] text-center transition-colors duration-300">
                    <p class="text-xs font-bold uppercase mb-1">Risco Sanitário Global</p>
                    <p id="lbl-status" class="text-lg font-black uppercase">Aguardando...</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Script de Dados e Lógica MARP Dinâmica -->
    <script>
        // O Banco de Dados Completo com Condicionais (tags)
        const roiMasterData = [
            {
                bloco: "BLOCO 1: Gestão, Licenciamento e Infraestrutura",
                indicadores: [
                    {
                        id: "q1", tag: "geral", titulo: "Alvará / Licença Sanitária", critico: false, norma: "RDC 1002/2025 - Art. 8º",
                        opcoes: [
                            "Não possui Licença Sanitária ou está exercendo atividade não licenciada.",
                            "Licença Sanitária vencida, sem protocolo de renovação.",
                            "Licença Sanitária vencida, com protocolo de renovação apenas iniciado.",
                            "Possui Licença Sanitária inicial ou de renovação atualizada, concedida pela autoridade competente.",
                            "Licença atualizada e exibe em local visível ao público.",
                            "Licença atualizada, possui histórico de renovações sempre antecipadas."
                        ]
                    },
                    {
                        id: "q2", tag: "geral", titulo: "Responsabilidade Técnica (RT)", critico: false, norma: "RDC 1002/2025 - Art. 5º e Art. 7º",
                        opcoes: [
                            "Sem Responsável Técnico definido perante a VISA.",
                            "RT designado, mas não possui habilitação legal (inscrição ativa no CRO).",
                            "Clínica com mais de um CD, mas o RT não possui substituto formalmente designado.",
                            "RT cirurgião-dentista (e substituto, se aplicável) legalmente habilitados e formalmente designados pelo Responsável Legal.",
                            "Órgão sanitário notificado de todas as alterações recentes de RT.",
                            "RT possui especialização formal na principal área de atuação da clínica."
                        ]
                    },
                    {
                        id: "q3", tag: "geral", titulo: "Série de Documentos de Boas Práticas (SDBPF)", critico: false, norma: "RDC 1002/2025 - Art. 110, Art. 111 e Art. 113",
                        opcoes: [
                            "Não possui a Série de Documentos de Boas Práticas de Funcionamento (SDBPF).",
                            "SDBPF existe, mas não está assinada pelo Responsável Legal ou não é acessível aos profissionais.",
                            "SDBPF acessível, mas falta conteúdo mínimo (ex: sem projeto de RH, sem POPs de processamento).",
                            "SDBPF elaborada pelo RT, assinada pelo RL, contendo rotinas, POPs e planos previstos no Art. 113.",
                            "SDBPF revisada nos últimos 2 anos ou após mudança de perfil epidemiológico.",
                            "Termo de ciência assinado por todos os profissionais comprometendo-se a cumprir a SDBPF (Art. 6º, P. Único)."
                        ]
                    },
                    {
                        id: "q4", tag: "geral", titulo: "Projeto Básico de Arquitetura (PBA)", critico: false, norma: "RDC 1002/2025 - Art. 13",
                        opcoes: [
                            "Não possui PBA aprovado pela VISA local.",
                            "Possui PBA antigo, mas realizou ampliação ou reforma sem nova aprovação.",
                            "PBA desatualizado, mas já protocolado na VISA para avaliação da reforma recente.",
                            "Possui PBA aprovado pela VISA, perfeitamente compatível com a estrutura atual.",
                            "PBA atualizado e arquivado formalmente junto à SDBPF do serviço.",
                            "Possui procedimento institucional proibindo qualquer intervenção física sem prévia aprovação."
                        ]
                    },
                    {
                        id: "q5", tag: "geral", titulo: "Revestimentos Físicos e Instalações", critico: false, norma: "RDC 1002/2025 - Art. 22",
                        opcoes: [
                            "Pisos, paredes ou tetos de materiais porosos, ou com frestas e mofo nas áreas assistenciais.",
                            "Materiais adequados, mas com danos estruturais extensos prejudicando a limpeza.",
                            "Maioria íntegra, mas com instalações elétricas/hidráulicas aparentes e sem proteção de calhas.",
                            "Revestimentos lisos, impermeáveis e resistentes nas áreas assistenciais. Instalações embutidas ou em calhas.",
                            "Manutenção predial impecável, sem nenhuma trinca ou infiltração observada.",
                            "Superfícies de alto desempenho facilitando a limpeza terminal e concorrente."
                        ]
                    },
                    {
                        id: "q6", tag: "geral", titulo: "Sanitários e Depósito de Material de Limpeza (DML)", critico: false, norma: "RDC 1002/2025 - Art. 17 a Art. 21",
                        opcoes: [
                            "Não possui sanitário ou DML separados da área de assistência.",
                            "Clínica com 3 ou mais consultórios não possui sanitários diferenciados para pacientes e funcionários.",
                            "Clínica não possui ao menos um sanitário acessível para Pessoa com Deficiência (PcD).",
                            "Sanitários e DML estruturados conforme o porte (1 PcD p/ até 2 consultórios; diferenciados p/ 3+).",
                            "Consultório individual Classe I (sem clínica) utiliza sanitário compartilhado com DML, mas com armário c/ chave e ponto de água baixo.",
                            "DML e sanitários perfeitamente estruturados, identificados e dimensionados acima do mínimo."
                        ]
                    },
                    {
                        id: "q7", tag: "geral", titulo: "Pias dos Ambientes Finalísticos (Consultórios)", critico: true, norma: "RDC 1002/2025 - Art. 14",
                        opcoes: [
                            "Consultório não possui lavatório exclusivo para higienização das mãos.",
                            "Possui lavatório, mas a torneira exige contato manual ou usa toalha de tecido.",
                            "Torneira adequada, mas falta sabonete líquido, lixeira c/ pedal ou dispensador de álcool.",
                            "Lavatório exclusivo, torneira sem contato manual, papel toalha em suporte fechado, sabão líquido, lixeira c/ pedal e dispensador de álcool.",
                            "Dispensadores instalados em alturas ergonômicas e todos devidamente identificados.",
                            "Monitoramento da adesão à higienização das mãos formalizado."
                        ]
                    }
                ]
            },
            {
                bloco: "BLOCO 2: Água, Equipamentos e Saúde do Trabalhador",
                indicadores: [
                    {
                        id: "q8", tag: "geral", titulo: "Água do Equipo Odontológico", critico: true, norma: "RDC 1002/2025 - Art. 40, Art. 41 e Art. 42",
                        opcoes: [
                            "Água do equipo não é potável ou mangueiras apresentam fissuras/sujidade externa.",
                            "Reservatórios de água e mangueiras não são drenados/vazios ao final do expediente de trabalho.",
                            "Usa sistema de purificação, mas não possui registros de manutenção preventiva do filtro.",
                            "Água potável, mangueiras íntegras e reservatórios/mangueiras devidamente drenados e vazios ao final do expediente.",
                            "Registro formal da manutenção do sistema de purificação arquivado na SDBPF.",
                            "Substituição preventiva programada de mangueiras antes de apresentarem fissuras."
                        ]
                    },
                    {
                        id: "q9", tag: "geral", titulo: "Gestão e Manutenção de Equipamentos", critico: false, norma: "RDC 1002/2025 - Art. 38, Art. 130 e Art. 134",
                        opcoes: [
                            "Equipamentos e aparelhos avariados, oxidados ou fora das especificações do fabricante em uso.",
                            "Não há registros de atividades de assistência técnica ou manutenção.",
                            "Registros de manutenção existem, mas estão incompletos (falta identificação ou assinatura).",
                            "Equipamentos em bom estado; manutenção, calibração e ajuste executados e registrados conforme o fabricante.",
                            "Plano de Gerenciamento de Tecnologias (PGT) implantado e atualizado (Art. 131).",
                            "Mobiliário e equipamentos fora de uso devidamente retirados das áreas de trabalho (Art. 39)."
                        ]
                    },
                    {
                        id: "q10", tag: "geral", titulo: "Equipamentos de Proteção Individual (EPIs)", critico: true, norma: "RDC 1002/2025 - Art. 108 Parágrafo único",
                        opcoes: [
                            "Equipe não utiliza EPIs básicos ou o serviço não os disponibiliza.",
                            "EPIs disponíveis, mas não estão em conformidade com a Norma Regulamentadora nº 32.",
                            "EPIs incompatíveis com a complexidade dos procedimentos (ex: ausência de proteção respiratória adequada).",
                            "Serviço provê e profissionais utilizam EPIs completos, adequados e em quantidade suficiente, conforme NR 32.",
                            "Comprovação de capacitação da equipe sobre uso e descarte de EPIs.",
                            "Auditoria contínua da adesão ao uso de EPIs pela equipe."
                        ]
                    },
                    {
                        id: "q11", tag: "geral", titulo: "Saúde Ocupacional e Capacitação", critico: false, norma: "RDC 1002/2025 - Art. 113 (II, III, XIV), Art. 114 e Art. 115",
                        opcoes: [
                            "Sem controle de saúde ocupacional ou comprovação de vacinação.",
                            "Não possui protocolo de encaminhamento em caso de acidentes com perfurocortantes.",
                            "Não há registro de capacitação admissional sobre a SDBPF e rotinas.",
                            "Fichas de saúde ocupacional em dia, protocolo de acidente perfurocortante implementado, capacitação registrada.",
                            "Plano anual de educação permanente em execução e arquivado.",
                            "PCMSO plenamente integrado e revisões periódicas da SDBPF absorvidas pela equipe."
                        ]
                    },
                    {
                        id: "q12", tag: "geral", titulo: "Núcleo de Segurança do Paciente (NSP) e Notificações", critico: false, norma: "RDC 1002/2025 - Art. 117 a Art. 120",
                        opcoes: [
                            "Não aplica ações de segurança do paciente ou não notifica eventos adversos.",
                            "Clínica com 2+ consultórios (ou ensino) NÃO constituiu o NSP obrigatório.",
                            "Possui PSP (Plano de Segurança do Paciente), mas não realiza as notificações mensais via Anvisa.",
                            "Ações do PSP implementadas; NSP instituído (se exigido); notificações realizadas até o 15º dia útil do mês subsequente.",
                            "Eventos graves (óbito/surtos) notificados rigorosamente em até 24 horas.",
                            "Análise e investigação sistêmica de eventos adversos gerando melhoria contínua."
                        ]
                    }
                ]
            },
            {
                bloco: "BLOCO 3: Processamento de Dispositivos Médicos (CME)",
                indicadores: [
                    {
                        id: "q13", tag: "geral", titulo: "Estrutura para Processamento", critico: true, norma: "RDC 1002/2025 - Art. 25 a Art. 30",
                        opcoes: [
                            "Processamento na mesma bancada de atendimento clínico ou no lavatório de mãos (proibido Art. 25 §2º).",
                            "Consultório coletivo / CCO utilizando bancada setorizada (proibido Art. 26).",
                            "Bancada ou sala sem separação física mínima de 50 cm entre área suja e limpa.",
                            "Adequado: Bancada setorizada (p/ Consultório Indiv.), sala única ou duas salas, respeitando fluxo unidirecional sujo->limpo.",
                            "Cuba c/ afastamento mínimo de 30 cm e dispensador de álcool na área limpa.",
                            "Ambiente com conforto acústico, térmico e luminoso adequado (Art. 28)."
                        ]
                    },
                    {
                        id: "q14", tag: "geral", titulo: "Pré-Limpeza", critico: false, norma: "RDC 1002/2025 - Art. 59 e Art. 60",
                        opcoes: [
                            "Nenhuma pré-limpeza é executada após o atendimento.",
                            "Dispositivos médicos (DM) ficam imersos em detergente no ponto de assistência (proibido Art. 59 p.ú.).",
                            "Pré-limpeza executada muito tempo após o término do atendimento.",
                            "Pré-limpeza mecânica executada imediatamente após atendimento; Turbinas acionadas sem broca para limpeza interna.",
                            "Procedimento documentado no POP de processamento da SDBPF.",
                            "Fluxo imediato ao expurgo, evitando qualquer ressecamento de matéria orgânica."
                        ]
                    },
                    {
                        id: "q15", tag: "geral", titulo: "Insumos e Água para Limpeza", critico: true, norma: "RDC 1002/2025 - Art. 63 a Art. 66",
                        opcoes: [
                            "Uso de detergente de uso domiciliar ou pasta abrasiva (proibido Art. 66 §2º).",
                            "Água não potável ou não troca a solução de detergente a cada uso (Art. 66 §4º).",
                            "Saneantes regulares, mas diluição feita a olho (sem recipiente volumétrico graduado).",
                            "Água potável, saneantes registrados na Anvisa, diluição com medidor volumétrico, solução trocada a cada uso.",
                            "Água de enxágue atende especificações rigorosas e objetos de escovação não soltam partículas.",
                            "Objetos de limpeza descartados imediatamente ao comprometerem funcionalidade."
                        ]
                    },
                    {
                        id: "q16", tag: "geral", titulo: "Técnica de Limpeza e Inspeção", critico: true, norma: "RDC 1002/2025 - Art. 62, Art. 67, Art. 68 e Art. 71",
                        opcoes: [
                            "Limpeza manual ineficiente, com sujidade residual visível.",
                            "DM de conformação complexa não são submetidos a limpeza automatizada (ex: cuba ultrassônica).",
                            "Materiais canulados limpos sem escovas adequadas ou sem pistola de água sob pressão.",
                            "Limpeza manual correta; cuba ultrassônica para DM complexos; pistola sob pressão para canulados.",
                            "Desmontagem de DMs reutilizáveis aplicada quando indicada pelo fabricante.",
                            "Inspeção visual executada rigorosamente com auxílio de lentes intensificadoras de no mínimo 8 vezes (Art. 71)."
                        ]
                    },
                    {
                        id: "q18", tag: "geral", titulo: "Embalagem e Selagem", critico: true, norma: "RDC 1002/2025 - Art. 73 a Art. 76",
                        opcoes: [
                            "Uso de caixas metálicas s/ furos, papel kraft, toalha, alumínio ou plásticos puros (proibido Art. 73).",
                            "Embalagens descartáveis sendo reutilizadas (proibido Art. 76).",
                            "Embalagem grau cirúrgico fechada com fita zebrada ou s/ termosseladora adequada (proibido Art. 75).",
                            "Embalagens específicas, selagem por termosseladora, sem rugas/fissuras, permitindo abertura asséptica.",
                            "Embalagem dimensionada permitindo circulação do vapor.",
                            "Testes rotineiros de integridade da seladora arquivados."
                        ]
                    },
                    {
                        id: "q19", tag: "geral", titulo: "Etiquetagem e Validade da Esterilidade", critico: false, norma: "RDC 1002/2025 - Art. 79 a Art. 82",
                        opcoes: [
                            "Nenhuma etiqueta ou identificação nos pacotes.",
                            "Identificação escrita à caneta comum derretendo na face do papel (não aprovada p/ esterilização).",
                            "Etiqueta não contém todos os dados obrigatórios do Art. 81 (Data, Responsável, Lote, Conteúdo).",
                            "Etiquetas com todas as informações na face plástica. Validade de 6 meses aplicada (na ausência de validação própria).",
                            "Validade científica superior a 6 meses atestada por estudos próprios aprovados.",
                            "Sistema informatizado imprimindo etiquetas de rastreabilidade à prova d'água."
                        ]
                    },
                    {
                        id: "q20", tag: "geral", titulo: "Equipamento de Esterilização", critico: true, norma: "RDC 1002/2025 - Art. 84 a Art. 88",
                        opcoes: [
                            "Uso de estufas (calor seco) ou caixas de luz UV para esterilização (Expressamente proibido Art. 84).",
                            "Ciclo a vapor não compatível com o tipo de carga, ou pacotes encostados nas paredes da câmara.",
                            "Pacotes empilhados na horizontal ou papel encostado em plástico na vertical (proibido Art. 86).",
                            "Autoclave adequada, água atende especificações, pacotes organizados papel-papel/plástico-plástico, espaçados.",
                            "Se autoclave pré-vácuo, realiza teste Bowie & Dick no 1º ciclo do dia (Art. 88).",
                            "Qualificação do equipamento arquivada em relatório da engenharia clínica."
                        ]
                    },
                    {
                        id: "q21", tag: "geral", titulo: "Monitoramento Físico, Químico e Biológico", critico: true, norma: "RDC 1002/2025 - Art. 78, Art. 89, Art. 90 e Art. 91",
                        opcoes: [
                            "Não realiza testes biológicos ou químicos internos.",
                            "Uso apenas de fita zebrada (Tipo 1), sem integradores tipo 5/6 internos.",
                            "Não realiza o teste biológico semanalmente ou não registra os parâmetros físicos.",
                            "Indicador externo (T1) em todos; Integrador (T5/6) em ciclos subsequentes; Teste Biológico + Integrador (T5/6) semanal no 1º ciclo.",
                            "Registros arquivados por 5 anos, contendo lote, operador, resultado, tempo, temp. e pressão (Art. 91, 92).",
                            "Incubadora biológica com manutenção preventiva anual comprovada (Art. 136)."
                        ]
                    },
                    {
                        id: "q22", tag: "geral", titulo: "Armazenamento de Dispositivos Processados", critico: false, norma: "RDC 1002/2025 - Art. 102",
                        opcoes: [
                            "Pacotes estéreis armazenados em gavetas clínicas sujas, abertas ou com luz solar direta.",
                            "Armazenados em área próxima a sifão de pias (proibido Art. 102 §3º).",
                            "Pacotes armazenados apertados, comprimindo e danificando a integridade da embalagem.",
                            "Local de armazenamento exclusivo, seco, escuro, longe de fontes de umidade/sifão.",
                            "Manuseio mínimo, inspecionando integridade antes do uso (rejeita se amassada/molhada).",
                            "Controle rigoroso de FIFO (Primeiro a vencer, primeiro a sair)."
                        ]
                    }
                ]
            },
            {
                bloco: "BLOCO 4: Gestão de Resíduos (PGRSS)",
                indicadores: [
                    {
                        id: "q23", tag: "geral", titulo: "Resíduos Sólidos e Perfurocortantes (Grupos A, D, E)", critico: true, norma: "RDC 1002/2025 - Art. 122 e Art. 128",
                        opcoes: [
                            "Não possui PGRSS ou descarta perfurocortantes em lixo comum.",
                            "Reaproveitamento de tubetes anestésicos vazios ou agulhas (proibido Art. 128 p.ú.).",
                            "Perfurocortantes além do limite do coletor, ou lixeiras de resíduos infectantes sem tampa/pedal.",
                            "PGRSS elaborado, lixeiras regulares, descarte correto de agulhas e tubetes sem reaproveitamento.",
                            "Destinação final assegurada por empresa licenciada e contratada.",
                            "Operacionalização do PGRSS monitorada com indicadores internos de redução."
                        ]
                    },
                    {
                        id: "q24", tag: "geral", titulo: "Resíduos Químicos (Amálgama e Radiologia)", critico: false, norma: "RDC 1002/2025 - Art. 123 a Art. 126",
                        opcoes: [
                            "Descarte de revelador/fixador ou resíduo de amálgama diretamente no esgoto.",
                            "Líquidos guardados, mas sem recipiente rígido e sem identificação de risco.",
                            "Amálgama armazenado, mas não sob selo d'água.",
                            "Revelador neutralizado (se no esgoto c/ fita pH) ou coletado; Fixador e Películas coletados; Amálgama sob selo d'água.",
                            "Cápsulas de amálgama estocadas separadamente para recuperação.",
                            "Clínica isenta de geração destes resíduos (Digital e sem amálgama)."
                        ]
                    }
                ]
            },
            {
                bloco: "BLOCO 5: Radiologia Odontológica (Módulo Dinâmico)",
                indicadores: [
                    {
                        id: "q25", tag: "rx-fixo", titulo: "Levantamento Radiométrico e Proteção (Equipamento Fixo)", critico: false, norma: "RDC 1002/2025 - Art. 15, 141 e 144",
                        opcoes: [
                            "Não realiza levantamento radiométrico ou usa mais de um RX na mesma sala (Art. 15 §4º).",
                            "Levantamento vencido (> 4 anos) ou não refez após mudança do equipamento.",
                            "Operador a menos de 2 metros de distância sem uso de disparador externo ou biombo.",
                            "Levantamento válido (< 4 anos), RX cadastrado na VISA, operador protegido a 2m, contato visual mantido.",
                            "Vestimenta plumbífera (0,25 mmPb) garantindo proteção de tireoide e gônadas disponível.",
                            "Programa de Proteção Radiológica com Supervisor designado formalmente (Art. 146)."
                        ]
                    },
                    {
                        id: "q26", tag: "rx-portatil", titulo: "Equipamento Portátil de Radiografia", critico: true, norma: "RDC 1002/2025 - Art. 143",
                        opcoes: [
                            "Uso de RX portátil sem qualquer certificação e segurando diretamente com as mãos sem cabo.",
                            "Uso de RX portátil sem comprovação de segurança radiométrica atualizada.",
                            "Usa RX Portátil segurando com as mãos, sem certificação técnica formal atestando segurança sem cabo.",
                            "RX Portátil utilizado com suporte de tripé/parede e cabo disparador de no mínimo 2m.",
                            "Utiliza sem cabo suportado por certificação técnica explícita do fabricante (radiação de fuga ok).",
                            "Equipamento submetido a rigoroso controle de qualidade digital de imagem."
                        ]
                    },
                    {
                        id: "q27", tag: "rx-extraoral", titulo: "Salas de Imagem (Radiologia Extraoral / Panorâmica)", critico: false, norma: "RDC 1002/2025 - Art. 148 a 151",
                        opcoes: [
                            "Sala de RX extraoral sem nenhuma blindagem ou projeto de proteção.",
                            "RX Extraoral sem Projeto de Blindagem aprovado pela VISA local.",
                            "Falta sinalização de área controlada ou sala de laudos (quando não há terceirização).",
                            "Projeto de Blindagem aprovado, áreas delimitadas. Se laudo a distância, possui contrato e assinatura digital.",
                            "Filmes acondicionados corretamente ou ambiente 100% digitalizado.",
                            "Softwares de planejamento digital regularizados pela Anvisa (Art. 154)."
                        ]
                    }
                ]
            },
            {
                bloco: "BLOCO 6: Urgências, Sedação e Prótese (Módulo Dinâmico)",
                indicadores: [
                    {
                        id: "q28", tag: "geral", titulo: "Urgência e Emergência (Equipamentos Básicos)", critico: true, norma: "RDC 1002/2025 - Art. 36 e Art. 116",
                        opcoes: [
                            "Não possui protocolo de urgência nem qualquer maleta/kit de emergência médica.",
                            "Falta fluxograma de encaminhamento para UPA/SAMU ou maleta incompleta.",
                            "Kit disponível, mas contém medicamentos de emergência vitais vencidos.",
                            "Protocolo de encaminhamento ativo, equipe sabe acionar SAMU, maleta/kit de primeiros socorros organizada e no prazo.",
                            "Além do básico, possui suporte ventilatório básico (Ambú) disponível.",
                            "Equipe realiza simulações semestrais de suporte básico de vida (BLS)."
                        ]
                    },
                    {
                        id: "q29", tag: "sedacao", titulo: "Procedimento de Sedação (Inalatória ou Endovenosa)", critico: true, norma: "RDC 1002/2025 - Art. 14, 36 e 116",
                        opcoes: [
                            "Realiza sedação sem ter oxímetro, monitor ou ressuscitador (Ambú) e cilindros de O2 soltos na sala.",
                            "Profissional realiza sem capacitação ou estrutura do gás não possui exaustão.",
                            "Monitorização existe, mas falta desfibrilador (DEA) obrigatório para sedação endovenosa.",
                            "Profissional capacitado, cilindros fixos, monitorização de sinais vitais ininterrupta, ressuscitador e protocolo.",
                            "Sala possui exaustão mecânica para diluição de gás anestésico residual (N2O).",
                            "DEA (Desfibrilador) presente e operante no local."
                        ]
                    },
                    {
                        id: "q30", tag: "lpd", titulo: "Laboratório de Prótese Dentária - LPD Próprio", critico: false, norma: "RDC 1002/2025 - Art. 157 a 181",
                        opcoes: [
                            "LPD funcionando no mesmo ambiente de atendimento clínico, gerando alta contaminação cruzada.",
                            "LPD não possui divisória até o teto isolando-o da área clínica (Art. 163).",
                            "LPD sem RT Técnico em Prótese ou sem pia com caixa de decantação de gesso.",
                            "LPD com barreira física/porta, RT exclusivo, lavatório próprio e protocolo de desinfecção de moldes (Art. 175).",
                            "Registros de serviços de prótese rigorosamente controlados (Art. 177).",
                            "Exaustão de gases para fundição ativa e EPIs específicos monitorados (Art. 173)."
                        ]
                    }
                ]
            }
        ];

        let totalQuestionsActive = 0;

        $(document).ready(function() {
            
            // Botão "Gerar ROI"
            $('#btn-generate').click(function() {
                const config = {
                    'rx-fixo': $('#chk-rx-fixo').is(':checked'),
                    'rx-portatil': $('#chk-rx-portatil').is(':checked'),
                    'rx-extraoral': $('#chk-rx-extraoral').is(':checked'),
                    'sedacao': $('#chk-sedacao').is(':checked'),
                    'lpd': $('#chk-lpd').is(':checked'),
                    'geral': true // Tags gerais sempre entram
                };

                renderizarFormulario(config);

                // UI Transitions
                $('#setup-panel').slideUp(400, function() {
                    $('#roi-wrapper').fadeIn(400);
                    $('#dashboard').removeClass('hidden').addClass('flex');
                    $('#btn-print').removeClass('hidden');
                });
            });

            function renderizarFormulario(config) {
                let html = '';
                totalQuestionsActive = 0;
                
                roiMasterData.forEach((bloco) => {
                    // Filtra os indicadores baseados na configuração escolhida
                    let indicadoresFiltrados = bloco.indicadores.filter(ind => config[ind.tag] === true);

                    if(indicadoresFiltrados.length > 0) {
                        html += `
                        <fieldset class="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 question-container">
                            <div class="bg-indigo-900 text-white p-4">
                                <h2 class="text-xl font-bold">${bloco.bloco}</h2>
                            </div>
                            <div class="p-6 space-y-8">
                        `;

                        indicadoresFiltrados.forEach((ind) => {
                            totalQuestionsActive++;
                            const criticalBadge = ind.critico ? 
                                `<span class="text-xs font-bold px-2 py-1 rounded critical-badge"><i class="fa-solid fa-triangle-exclamation mr-1"></i> CRÍTICO</span>` : 
                                `<span class="text-xs font-bold px-2 py-1 rounded nc-badge">NÃO CRÍTICO</span>`;

                            html += `
                                <div class="border-b border-gray-100 pb-8 last:border-0 last:pb-0" id="item-${ind.id}">
                                    <div class="flex flex-col md:flex-row md:items-center gap-2 mb-4">
                                        <h3 class="text-lg font-bold text-gray-800 flex-1">${ind.titulo}</h3>
                                        <div class="flex gap-2 items-center">
                                            <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200" title="Marco Regulatório">
                                                <i class="fa-solid fa-scale-balanced mr-1"></i> ${ind.norma}
                                            </span>
                                            ${criticalBadge}
                                        </div>
                                    </div>
                                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            `;

                            ind.opcoes.forEach((opcao, val) => {
                                let colorClass = '';
                                if (val <= 2) colorClass = 'hover:border-red-400 focus-within:ring-red-200';
                                else if (val == 3) colorClass = 'hover:border-yellow-400 focus-within:ring-yellow-200';
                                else colorClass = 'hover:border-green-400 focus-within:ring-green-200';

                                html += `
                                    <label class="relative cursor-pointer group">
                                        <input type="radio" name="${ind.id}" value="${val}" data-critical="${ind.critico}" class="sr-only radio-option">
                                        <div class="h-full p-4 rounded-lg border-2 border-gray-200 bg-white transition-all duration-200 ${colorClass} flex gap-3 items-start shadow-sm">
                                            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 border border-gray-300 group-hover:bg-blue-50 mt-1">
                                                ${val}
                                            </div>
                                            <div class="text-sm text-gray-700 font-medium py-1">
                                                ${opcao}
                                            </div>
                                        </div>
                                    </label>
                                `;
                            });

                            html += `
                                    </div>
                                </div>
                            `;
                        });

                        html += `
                            </div>
                        </fieldset>
                        `;
                    }
                });

                $('#roi-form').html(html);
                $('#lbl-total').text(totalQuestionsActive);
                
                // Reinicia os cálculos para o novo formulário vazio
                calcularRisco(); 
            }

            // Motor de Cálculo MARP Dinâmico
            function calcularRisco() {
                let totalScore = 0;
                let answeredCount = 0;
                let triggerCritical = false;

                $('.radio-option:checked').each(function() {
                    let val = parseInt($(this).val());
                    let isCritical = $(this).data('critical');
                    
                    totalScore += val;
                    answeredCount++;

                    let parentContainer = $(this).closest('.grid').parent();
                    parentContainer.removeClass('score-0-2 score-3 score-4-5');
                    
                    if(val <= 2) parentContainer.addClass('score-0-2');
                    else if(val === 3) parentContainer.addClass('score-3');
                    else parentContainer.addClass('score-4-5');

                    if (isCritical && val < 3) {
                        triggerCritical = true;
                    }
                });

                $('#lbl-answered').text(answeredCount);
                $('#lbl-score').text(totalScore);

                let percentage = 0;
                if(answeredCount > 0) {
                    // O peso total máximo é baseado apenas nas questões exibidas que já foram respondidas
                    let maxScore = answeredCount * 5; 
                    percentage = Math.round((totalScore / maxScore) * 100);
                }
                $('#lbl-percent').text(percentage);

                let statusText = "Aguardando...";
                let statusClasses = "bg-gray-100 text-gray-600 border-gray-300";

                if (answeredCount > 0) {
                    if (triggerCritical) {
                        $('#alert-critical').removeClass('hidden');
                        statusText = "Risco Inaceitável / Interdição";
                        statusClasses = "bg-red-600 text-white border-red-800";
                    } else {
                        $('#alert-critical').addClass('hidden');
                        
                        if (percentage < 60) {
                            statusText = "Risco Alto";
                            statusClasses = "bg-orange-500 text-white border-orange-700";
                        } else if (percentage < 80) {
                            statusText = "Risco Aceitável (Atenção)";
                            statusClasses = "bg-yellow-400 text-gray-900 border-yellow-600";
                        } else {
                            statusText = "Baixo Risco (Padrão Ouro)";
                            statusClasses = "bg-green-600 text-white border-green-800";
                        }
                    }
                }

                $('#status-card').removeClass().addClass(`px-6 py-3 rounded-lg border-2 shadow-sm min-w-[250px] text-center transition-colors duration-300 ${statusClasses}`);
                $('#lbl-status').text(statusText);
            }

            $(document).on('change', '.radio-option', calcularRisco);
        });
    </script>
</body>
</html>