// script.js
// VERSÃO FINAL CORRIGIDA - 23/07/2025

// --- 1. CONFIGURAÇÃO E ELEMENTOS GLOBAIS ---
// Telas
const mainMenu = document.getElementById('main-menu');
const flagGameMenu = document.getElementById('flag-game-menu');
const levelSelectMenu = document.getElementById('level-select-menu');
const livesSelectMenu = document.getElementById('lives-select-menu');
const gameScreen = document.getElementById('game-screen');
const levelUpModal = document.getElementById('level-up-modal');
const rankingModal = document.getElementById('ranking-modal');

// Botões e seletores
const startFlagGameButton = document.getElementById('start-flag-game');
const backButtons = document.querySelectorAll('.back-button');
const levelUpContinueButton = document.getElementById('level-up-continue-button');
const showRankingButton = document.getElementById('show-ranking-button');
const closeRankingButton = document.getElementById('close-ranking-button');
const backToMenuButton = document.getElementById('back-to-menu-button');
const rankingSelector = document.getElementById('ranking-selector');

// Elementos do Jogo
const instructionElement = document.getElementById('instruction');
const optionsContainer = document.getElementById('options-container');
const feedbackElement = document.getElementById('feedback');
const nextButton = document.getElementById('next-button');
const scoreElement = document.getElementById('score');
const streakElement = document.getElementById('streak');
const chancesElement = document.getElementById('chances');
const levelUpMessage = document.getElementById('level-up-message');
const saveScoreForm = document.getElementById('save-score-form');
const playerNameInput = document.getElementById('player-name');
const rankingList = document.getElementById('ranking-list');

// Efeitos Sonoros (Pré-carregamento)
const sounds = {
    win: new Audio('assets/audio/effects/win.mp3'),
    wrong: new Audio('assets/audio/effects/wrong.mp3'),
    levelUp: new Audio('assets/audio/effects/level.mp3'),
    completed: new Audio('assets/audio/effects/completed.mp3')
};

// --- OBJETOS DE ESTADO E CONFIGURAÇÃO ---
let gameConfig = {};
let gameState = {};
let correctAnswer = null; // Declarada globalmente

// --- 2. LÓGICA DE PREPARAÇÃO DOS JOGOS ---

const gameModes = {
    'BandeiraPorPais': {
        prepareRound: function() {
            if (gameState.availableCountries.length === 0) { nextRound(); return; }
            let roundOptions = [];
            correctAnswer = shuffle([...gameState.availableCountries])[0];
            roundOptions.push(correctAnswer);

            let wrongOptions = gameState.availableCountries.filter(c => c.codigo !== correctAnswer.codigo);
            wrongOptions = shuffle(wrongOptions).slice(0, 3);
            roundOptions.push(...wrongOptions);

            const neededFillers = 4 - roundOptions.length;
            if (neededFillers > 0) {
                const fillers = shuffle([...gameState.answeredCountriesThisLevel]).slice(0, neededFillers);
                roundOptions.push(...fillers);
            }
            
            instructionElement.textContent = `Qual é a bandeira ${correctAnswer.artigo} ${correctAnswer.nome}?`;
            playAudio(`bandeiras/${correctAnswer.nome}`);
            displayFlagOptions(shuffle(roundOptions));
        },
        checkAnswer: function(clickedCode) {
            return clickedCode === correctAnswer.codigo;
        }
    },
    'PaisPorCapital': {
        prepareRound: function() {
            const roundOptions = shuffle(countries).slice(0, 4);
            correctAnswer = roundOptions[Math.floor(Math.random() * 4)];
            instructionElement.textContent = `Qual país tem a capital ${correctAnswer.capital}?`;
            playAudio(`capitais/${correctAnswer.capital}`);
            displayFlagOptions(roundOptions);
        },
        checkAnswer: function(clickedCode) {
            return clickedCode === correctAnswer.codigo;
        }
    },
    'ContinentePorPais': {
        prepareRound: function() {
            const allContinents = [...new Set(countries.map(c => c.continente))];
            correctAnswer = shuffle(countries)[0];
            instructionElement.textContent = `Qual é o continente ${correctAnswer.artigo} ${correctAnswer.nome}?`;
            playAudio(`continente_do_pais/${correctAnswer.nome}`);
            displayTextOptions(allContinents);
        },
        checkAnswer: function(clickedContinent) {
            return clickedContinent === correctAnswer.continente;
        }
    },
    'PaisPorContinente': {
        prepareRound: function() {
            const allContinents = [...new Set(countries.map(c => c.continente))];
            const randomContinent = allContinents[Math.floor(Math.random() * allContinents.length)];
            const artigosContinentes = {'América do Norte': 'da', 'América Central': 'da', 'América do Sul': 'da', 'Europa': 'da', 'Ásia': 'da', 'África': 'da', 'Oceania': 'da'};
            const artigo = artigosContinentes[randomContinent] || 'do';
            
            const countriesInContinent = countries.filter(c => c.continente === randomContinent);
            const countriesOutside = countries.filter(c => c.continente !== randomContinent);

            if (countriesInContinent.length === 0 || countriesOutside.length < 3) {
                nextRound(); return;
            }

            correctAnswer = shuffle(countriesInContinent)[0];
            const wrongOptions = shuffle(countriesOutside).slice(0, 3);
            const roundOptions = shuffle([correctAnswer, ...wrongOptions]);
            
            instructionElement.textContent = `Qual destes países faz parte ${artigo} ${randomContinent}?`;
            playAudio(`pais_do_continente/${randomContinent}`);
            displayFlagOptions(roundOptions);
        },
        checkAnswer: function(clickedCode) {
            return clickedCode === correctAnswer.codigo;
        }
    }
};

// --- 3. FUNÇÕES DE CONTROLE DE JOGO E ESTADO ---

function startGame(config) {
    gameConfig = config;
    showScreen('game-screen');
    saveScoreForm.classList.add('hidden');

    gameState = {
        score: 0, streak: 0,
        chances: gameConfig.lives === 'infinite' ? '♾️' : gameConfig.lives,
        currentJourneyLevel: 1, availableCountries: [],
        answeredCountriesThisLevel: [], attemptsThisRound: 0,
    };

    if (gameConfig.mode === 'BandeiraPorPais') {
        if (gameConfig.type === 'Jornada') {
            gameState.availableCountries = countries.filter(c => c.nivel === 1);
        } else {
            gameState.availableCountries = countries.filter(c => c.nivel === gameConfig.level);
        }
    } else {
        gameState.availableCountries = [...countries];
    }
    
    updateStats();
    nextRound();
}

function nextRound() {
    // Para o jogo de bandeiras, verifica se o nível/jornada acabou
    if (gameConfig.mode === 'BandeiraPorPais' && gameState.availableCountries.length === 0) {
        if (gameConfig.type === 'Jornada') { levelUp(); } 
        else { gameOver(true); }
        return;
    }
    // Para todos os jogos, verifica se as vidas acabaram
    if (gameState.chances === 0 && gameConfig.lives !== 'infinite') {
        gameOver(false); return;
    }
    
    gameState.attemptsThisRound = 0;
    gameLocked = false;
    feedbackElement.textContent = '';
    nextButton.classList.add('hidden');
    
    gameModes[gameConfig.mode].prepareRound();
}

function handleOptionClick(event) {
    if (gameLocked) return;
    
    const clickedElement = event.target;
    const type = clickedElement.dataset.type;
    let isCorrect = false;

    // A verificação da resposta agora funciona para todos os tipos
    if (type === 'flag') { isCorrect = gameModes[gameConfig.mode].checkAnswer(clickedElement.dataset.codigo); } 
    else if (type === 'text') { isCorrect = gameModes[gameConfig.mode].checkAnswer(clickedElement.dataset.continente); }
    
    // Lógica de pontuação complexa para o Jogo de Bandeiras
    if (gameConfig.mode === 'BandeiraPorPais') {
        if (isCorrect) {
            playSound('win');
            gameLocked = true;
            let pointsEarned = 0, streakBonus = 0;
            if (gameState.attemptsThisRound === 0) {
                pointsEarned = 10;
                gameState.streak++;
                streakBonus = gameState.streak > 1 ? gameState.streak : 0;
                gameState.score += pointsEarned + streakBonus;
            } else {
                gameState.streak = 0;
                if (gameState.attemptsThisRound === 1) pointsEarned = 6;
                else if (gameState.attemptsThisRound === 2) pointsEarned = 4;
                else if (gameState.attemptsThisRound === 3) pointsEarned = 2;
                gameState.score += pointsEarned;
            }

            gameState.answeredCountriesThisLevel.push(correctAnswer);
            gameState.availableCountries = gameState.availableCountries.filter(c => c.codigo !== correctAnswer.codigo);

            document.querySelectorAll('.flag-option, .text-option').forEach(el => el.classList.add('disabled'));
            clickedElement.classList.remove('disabled');
            clickedElement.classList.add('correct');
            
            let feedbackText = `Correto! (+${pointsEarned} pts)`;
            if (streakBonus > 0) feedbackText += ` 🔥 Bônus: +${streakBonus}!`;
            feedbackElement.textContent = feedbackText;
            feedbackElement.style.color = '#32CD32';
            nextButton.classList.remove('hidden');
        } else {
            playSound('wrong');
            clickedElement.classList.add('incorrect', 'disabled');
            if (gameState.attemptsThisRound === 0) {
                gameState.streak = 0;
                if (gameConfig.lives !== 'infinite') gameState.chances--;
            }
            gameState.attemptsThisRound++;
            if (gameState.chances === 0 && gameConfig.lives !== 'infinite') gameOver(false);
        }
    } else { // Lógica de pontuação simples para os outros modos
        if(isCorrect) {
            playSound('win');
            gameLocked = true;
            gameState.score += 10;
            gameState.streak++;
            feedbackElement.textContent = `Correto! (+10 pts)`;
            feedbackElement.style.color = '#32CD32';
            nextButton.classList.remove('hidden');
        } else {
            playSound('wrong');
            gameState.streak = 0;
            if (gameConfig.lives !== 'infinite') gameState.chances--;
            clickedElement.classList.add('incorrect');
            if (gameState.chances === 0 && gameConfig.lives !== 'infinite') gameOver(false);
        }
    }
    updateStats();
}

function levelUp() {
    playSound('levelUp');
    gameState.currentJourneyLevel++;
    if (gameState.currentJourneyLevel > 5) {
        gameOver(true); return;
    }
    gameState.availableCountries = countries.filter(c => c.nivel === gameState.currentJourneyLevel);
    gameState.answeredCountriesThisLevel = [];
    levelUpMessage.textContent = `Você chegou ao Nível ${gameState.currentJourneyLevel}!`;
    levelUpModal.classList.remove('hidden');
}

function continueAfterLevelUp() {
    levelUpModal.classList.add('hidden');
    nextRound();
}

function gameOver(didWin) {
    playSound('completed');
    gameLocked = true;
    nextButton.classList.add('hidden');
    backToMenuButton.textContent = 'Menu Principal';

    if (didWin) {
        instructionElement.textContent = 'Parabéns, você completou!';
        feedbackElement.textContent = 'Você é um mestre!';
    } else {
        instructionElement.textContent = 'Fim de Jogo!';
        feedbackElement.textContent = 'Não desista, tente de novo!';
    }
    
    optionsContainer.innerHTML = `<div class="game-over-screen">Pontuação final: ${gameState.score}</div>`;
    checkAndSaveScore(gameState.score);
}

// --- 4. FUNÇÕES DE RANKING ---
function getRanking(key) {
    const rankingJSON = localStorage.getItem(key);
    return rankingJSON ? JSON.parse(rankingJSON) : [];
}
function saveRanking(key, ranking) {
    localStorage.setItem(key, JSON.stringify(ranking));
}
function displayRanking(key) {
    document.querySelectorAll('.ranking-mode-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-rankingkey="${key}"]`).classList.add('active');
    const ranking = getRanking(key);
    rankingList.innerHTML = '';
    if (ranking.length === 0) {
        rankingList.innerHTML = '<p>Nenhuma pontuação salva para este modo.</p>';
    } else {
        ranking.forEach((entry, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'ranking-entry';
            entryDiv.innerHTML = `<span>${index + 1}. <span class="ranking-name">${entry.nome}</span></span><span class="ranking-score">${entry.score} pts</span>`;
            rankingList.appendChild(entryDiv);
        });
    }
    rankingModal.classList.remove('hidden');
}
function checkAndSaveScore(finalScore) {
    if (gameConfig.mode !== 'BandeiraPorPais') return;
    const key = `ranking_bandeira_${gameConfig.type.toLowerCase()}`;
    const ranking = getRanking(key);
    const lowestRankedScore = ranking.length < 10 ? 0 : ranking[9].score;
    if (finalScore > 0 && finalScore >= lowestRankedScore) {
        setTimeout(() => {
            optionsContainer.appendChild(saveScoreForm);
            saveScoreForm.classList.remove('hidden');
            playerNameInput.focus();
        }, 1000);
    }
}

// --- 5. FUNÇÕES DE UI E AUXILIARES ---
function showScreen(screenId) {
    [mainMenu, flagGameMenu, levelSelectMenu, livesSelectMenu, gameScreen].forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}
function updateStats() {
    scoreElement.textContent = `Pontos: ${gameState.score}`;
    streakElement.textContent = `🔥 ${gameState.streak}`;
    chancesElement.textContent = `❤️ ${gameState.chances}`;
}
function displayFlagOptions(options) {
    optionsContainer.innerHTML = '';
    options.forEach(country => {
        const img = document.createElement('img');
        img.src = `assets/flags/${country.codigo}.png`;
        img.className = 'flag-option';
        img.dataset.codigo = country.codigo;
        img.dataset.type = 'flag'; // Adicionado tipo para o handler
        img.addEventListener('click', handleOptionClick);
        optionsContainer.appendChild(img);
    });
}
function displayTextOptions(options) {
    optionsContainer.innerHTML = '';
    shuffle(options).forEach(optionText => {
        if (optionText && optionText.trim() !== "") {
            const button = document.createElement('button');
            button.textContent = optionText;
            button.className = 'text-option';
            button.dataset.continente = optionText;
            button.dataset.type = 'text'; // Adicionado tipo para o handler
            button.addEventListener('click', handleOptionClick);
            optionsContainer.appendChild(button);
        }
    });
}
function playSound(soundName) {
    if (sounds[soundName]) {
        sounds[soundName].currentTime = 0;
        sounds[soundName].play().catch(e => console.error("Erro ao tocar som:", e));
    }
}
function playAudio(fileName) {
    const safeFileName = fileName.toLowerCase().replace(/ /g, '_').replace(/\./g, '');
    const audio = new Audio(`assets/audio/${safeFileName}.mp3`);
    audio.play().catch(error => console.warn("Não foi possível tocar o áudio:", error));
}
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- 6. INICIALIZAÇÃO E EVENT LISTENERS ---
// Navegação do Menu
startFlagGameButton.addEventListener('click', () => showScreen('flag-game-menu'));
backButtons.forEach(button => button.addEventListener('click', () => showScreen(button.dataset.target)));

// Iniciar outros modos de jogo a partir do menu principal
document.querySelectorAll('#main-menu .mode-button[data-gamemode]').forEach(button => {
    const mode = button.dataset.gamemode;
    button.addEventListener('click', () => {
        // Para estes modos, usamos uma configuração padrão
        startGame({ mode: mode, lives: 'infinite' });
    });
});

// Configuração e início do Jogo de Bandeiras
document.querySelectorAll('#flag-game-menu .mode-button').forEach(button => {
    button.addEventListener('click', () => {
        const config = { mode: 'BandeiraPorPais', type: button.dataset.gametype };
        if (config.type === 'Jornada') {
            config.lives = 'infinite';
            startGame(config);
        } else {
            gameConfig = config; // Salva a configuração parcial
            showScreen('level-select-menu');
        }
    });
});
document.querySelectorAll('#level-select-menu .mode-button').forEach(button => {
    button.addEventListener('click', () => {
        gameConfig.level = parseInt(button.dataset.level);
        showScreen('lives-select-menu');
    });
});
document.querySelectorAll('#lives-select-menu .mode-button').forEach(button => {
    button.addEventListener('click', () => {
        const lives = button.dataset.lives;
        gameConfig.lives = lives === 'infinite' ? 'infinite' : parseInt(lives);
        startGame(gameConfig);
    });
});

// Ranking
saveScoreForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const playerName = playerNameInput.value.trim();
    if (!playerName) return;
    const key = `ranking_bandeira_${gameConfig.type.toLowerCase()}`;
    const ranking = getRanking(key);
    ranking.push({ nome: playerName, score: gameState.score });
    ranking.sort((a, b) => b.score - a.score);
    const finalRanking = ranking.slice(0, 10);
    saveRanking(key, finalRanking);
    saveScoreForm.classList.add('hidden');
    feedbackElement.textContent = 'Pontuação salva!';
});
showRankingButton.addEventListener('click', () => displayRanking('ranking_bandeira_jornada'));
closeRankingButton.addEventListener('click', () => rankingModal.classList.add('hidden'));
rankingSelector.addEventListener('click', (event) => {
    if (event.target.classList.contains('ranking-mode-button')) {
        displayRanking(event.target.dataset.rankingkey);
    }
});

// Controles do jogo
backToMenuButton.addEventListener('click', () => showScreen('main-menu'));
levelUpContinueButton.addEventListener('click', continueAfterLevelUp);
nextButton.addEventListener('click', nextRound);

// Inicia na tela principal
showScreen('main-menu');