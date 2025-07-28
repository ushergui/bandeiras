// script.js
// Contém toda a lógica de funcionamento do jogo "Detetive Global".

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURAÇÃO E ELEMENTOS GLOBAIS ---
    const mainMenu = document.getElementById('main-menu');
    const gameTypeMenu = document.getElementById('game-type-menu');
    const levelSelectMenu = document.getElementById('level-select-menu');
    const livesSelectMenu = document.getElementById('lives-select-menu');
    const gameScreen = document.getElementById('game-screen');
    const levelUpModal = document.getElementById('level-up-modal');
    const rankingModal = document.getElementById('ranking-modal');
    const factsModal = document.getElementById('facts-modal');
    const countryShapeContainer = document.getElementById('country-shape-container');

    const backButtons = document.querySelectorAll('.back-button');
    const levelUpContinueButton = document.getElementById('level-up-continue-button');
    const showRankingButton = document.getElementById('show-ranking-button');
    const closeRankingButton = document.getElementById('close-ranking-button');
    const backToMenuButton = document.getElementById('back-to-menu-button');
    const factsButton = document.getElementById('facts-button');
    const closeFactsButton = document.getElementById('close-facts-button');

    // Seletores de Ranking
    const rankingMainSelector = document.getElementById('ranking-main-selector');
    const rankingTypeSelector = document.getElementById('ranking-type-selector');
    const rankingLevelSelector = document.getElementById('ranking-level-selector');

    // Títulos dinâmicos dos menus
    const gameTypeTitle = document.getElementById('game-type-title');
    const levelSelectTitle = document.getElementById('level-select-title');
    const livesSelectTitle = document.getElementById('lives-select-title');

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
    const factsTitle = document.getElementById('facts-title');
    const factsContent = document.getElementById('facts-content');

    // Sons do jogo (reabilitados para uso local)
    const sounds = {
        win: new Audio('assets/audio/effects/win.mp3'),
        wrong: new Audio('assets/audio/effects/wrong.mp3'),
        levelUp: new Audio('assets/audio/effects/level.mp3'),
        completed: new Audio('assets/audio/effects/completed.mp3')
    };

    let gameConfig = {};
    let gameState = {};
    let correctAnswer = null;
    let gameLocked = false;
    let currentRankingSelection = {};


    // --- 2. LÓGICA DE PREPARAÇÃO DOS JOGOS ---

    const gameModes = {
        'BandeiraPorPais': {
            title: "Qual a Bandeira?",
            prepareRound: function() {
                countryShapeContainer.classList.add('hidden');
                if (gameState.availableCountries.length === 0) {
                    setTimeout(() => {
                        if (gameConfig.type === 'Jornada') { levelUp(); } 
                        else { gameOver(true); }
                    }, 500);
                    return;
                }
                let roundOptions = [];
                correctAnswer = shuffle([...gameState.availableCountries])[0];
                roundOptions.push(correctAnswer);
                
                let allPossibleWrongOptions = countries.filter(c => c.nivel === correctAnswer.nivel && c.codigo !== correctAnswer.codigo);
                if(allPossibleWrongOptions.length < 3) {
                    allPossibleWrongOptions = countries.filter(c => c.codigo !== correctAnswer.codigo);
                }

                let wrongOptions = shuffle(allPossibleWrongOptions).slice(0, 3);
                roundOptions.push(...wrongOptions);
                
                instructionElement.textContent = `Qual é a bandeira ${correctAnswer.artigo} ${correctAnswer.nome}?`;
                displayFlagOptions(shuffle(roundOptions));
            },
            checkAnswer: function(clickedCode) {
                return clickedCode === correctAnswer.codigo;
            }
        },
        'FormaPorPais': {
            title: "Qual a Forma do País?",
            prepareRound: function() {
                countryShapeContainer.classList.remove('hidden');
                
                if (gameState.availableCountries.length === 0) {
                     setTimeout(() => {
                        if (gameConfig.type === 'Jornada') { levelUp(); } 
                        else { gameOver(true); }
                    }, 500);
                    return;
                }

                let roundOptions = [];
                correctAnswer = shuffle([...gameState.availableCountries])[0];
                roundOptions.push(correctAnswer);

                let allPossibleWrongOptions = countries.filter(c => c.nivel === correctAnswer.nivel && c.codigo !== correctAnswer.codigo);
                if(allPossibleWrongOptions.length < 3) {
                    allPossibleWrongOptions = countries.filter(c => c.codigo !== correctAnswer.codigo);
                }
                
                let wrongOptions = shuffle(allPossibleWrongOptions).slice(0, 3);
                roundOptions.push(...wrongOptions);

                instructionElement.textContent = `A qual país pertence esta forma?`;
                
                displayCountryShape(correctAnswer);
                displayFlagOptions(shuffle(roundOptions));
            },
            checkAnswer: function(clickedCode) {
                return clickedCode === correctAnswer.codigo;
            }
        },
        'PaisPorCapital': {
            title: "Qual o País da Capital?",
            prepareRound: function() {
                countryShapeContainer.classList.add('hidden');
                const roundOptions = shuffle([...countries]).slice(0, 4);
                correctAnswer = roundOptions[Math.floor(Math.random() * 4)];
                instructionElement.textContent = `Qual país tem a capital ${correctAnswer.capital}?`;
                displayFlagOptions(roundOptions);
            },
            checkAnswer: function(clickedCode) {
                return clickedCode === correctAnswer.codigo;
            }
        },
        'ContinentePorPais': {
            title: "Qual o Continente?",
            prepareRound: function() {
                countryShapeContainer.classList.add('hidden');
                const allContinents = [...new Set(countries.map(c => c.continente))];
                correctAnswer = shuffle([...countries])[0];
                instructionElement.textContent = `Qual é o continente ${correctAnswer.artigo} ${correctAnswer.nome}?`;
                
                let continentOptions = [correctAnswer.continente];
                let wrongContinents = allContinents.filter(c => c !== correctAnswer.continente);
                continentOptions.push(...shuffle(wrongContinents).slice(0, 3));

                displayTextOptions(shuffle(continentOptions));
            },
            checkAnswer: function(clickedContinent) {
                return clickedContinent === correctAnswer.continente;
            }
        }
    };

    // --- 3. FUNÇÕES DE CONTROLE DE JOGO E ESTADO ---

    function startGame(config) {
        gameConfig = config;
        showScreen('game-screen');
        saveScoreForm.classList.add('hidden');
        optionsContainer.classList.remove('hidden');
        backToMenuButton.textContent = 'Sair do Jogo';


        gameState = {
            score: 0, streak: 0,
            chances: gameConfig.lives === 'infinite' ? '♾️' : gameConfig.lives,
            currentJourneyLevel: 1, availableCountries: [],
            answeredCountriesThisLevel: [], attemptsThisRound: 0,
        };
        
        // A lógica de seleção de países agora funciona para Bandeira e Forma
        if (gameConfig.type === 'Jornada') {
            gameState.availableCountries = countries.filter(c => c.nivel === 1);
        } else if (gameConfig.type === 'Rápido') {
            gameState.availableCountries = countries.filter(c => c.nivel === gameConfig.level);
        } else { // Para outros modos de jogo como Capital, etc.
             gameState.availableCountries = [...countries];
        }
        
        updateStats();
        nextRound();
    }

    function nextRound() {
        if (gameState.chances === 0 && gameConfig.lives !== 'infinite') {
            gameOver(false); return;
        }
        
        factsButton.classList.add('hidden');
        gameModes[gameConfig.mode].prepareRound();

        if (gameLocked) {
            gameState.attemptsThisRound = 0;
            gameLocked = false;
            feedbackElement.textContent = '';
            nextButton.classList.add('hidden');
        }
    }

    function handleOptionClick(event) {
        if (gameLocked) return;
        
        const clickedElement = event.target.closest('.flag-option') || event.target.closest('.text-option');
        if (!clickedElement) return;

        const type = clickedElement.dataset.type;
        let isCorrect = false;

        if (type === 'flag') { isCorrect = gameModes[gameConfig.mode].checkAnswer(clickedElement.dataset.codigo); } 
        else if (type === 'text') { isCorrect = gameModes[gameConfig.mode].checkAnswer(clickedElement.dataset.continente); }
        
        if (isCorrect) {
            playSound('win');
            gameLocked = true;
            gameState.streak++;
            
            let pointsEarned = 10;
            let streakBonus = gameState.streak > 1 ? gameState.streak : 0;
            
            if (gameConfig.mode === 'BandeiraPorPais' || gameConfig.mode === 'FormaPorPais') {
                if (gameState.attemptsThisRound === 0) {
                    pointsEarned = 10;
                } else if (gameState.attemptsThisRound === 1) {
                    pointsEarned = 6;
                } else if (gameState.attemptsThisRound === 2) {
                    pointsEarned = 4;
                } else if (gameState.attemptsThisRound === 3) {
                    pointsEarned = 2;
                }
                gameState.streak = gameState.attemptsThisRound > 0 ? 0 : gameState.streak;
                streakBonus = gameState.streak > 1 ? gameState.streak : 0;
            }
            
            gameState.score += pointsEarned + streakBonus;
            
            if (gameConfig.type === 'Jornada' || gameConfig.type === 'Rápido') {
                gameState.availableCountries = gameState.availableCountries.filter(c => c.codigo !== correctAnswer.codigo);
            }

            document.querySelectorAll('.flag-option, .text-option').forEach(el => el.classList.add('disabled'));
            clickedElement.classList.remove('disabled');
            clickedElement.classList.add('correct');
            
            let feedbackText = `Correto! (+${pointsEarned} pts)`;
            if (streakBonus > 0) feedbackText += ` 🔥 Bônus: +${streakBonus}!`;
            feedbackElement.textContent = feedbackText;
            feedbackElement.style.color = '#32CD32';
            nextButton.classList.remove('hidden');
            factsButton.classList.remove('hidden');
        } else {
            playSound('wrong');
            clickedElement.classList.add('incorrect', 'disabled');
            gameState.streak = 0;
            
            if (gameConfig.type === 'Jornada' || gameConfig.type === 'Rápido') {
                if (gameState.attemptsThisRound === 0 && gameConfig.lives !== 'infinite') {
                    gameState.chances--;
                }
                gameState.attemptsThisRound++;
            } else {
                if (gameConfig.lives !== 'infinite') gameState.chances--;
            }
            
            if (gameState.chances === 0 && gameConfig.lives !== 'infinite') {
                setTimeout(() => gameOver(false), 500);
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
        factsButton.classList.add('hidden');
        backToMenuButton.textContent = 'Menu Principal';
        optionsContainer.innerHTML = '';
        optionsContainer.classList.add('hidden');
        countryShapeContainer.classList.add('hidden');

        if (didWin) {
            instructionElement.textContent = 'Parabéns, você completou!';
            feedbackElement.textContent = `Pontuação final: ${gameState.score}`;
        } else {
            instructionElement.textContent = 'Fim de Jogo!';
            feedbackElement.textContent = `Sua pontuação foi: ${gameState.score}`;
        }
        
        checkAndSaveScore(gameState.score);
    }
    
    // --- 4. FUNÇÃO DE CURIOSIDADES LOCAIS ---
    function displayLocalFact() {
        if (!correctAnswer) return;

        factsTitle.textContent = `Curiosidades sobre ${correctAnswer.nome}`;
        
        const countryCode = correctAnswer.codigo;
        const availableFacts = curiosities[countryCode];

        if (availableFacts && availableFacts.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableFacts.length);
            const randomFact = availableFacts[randomIndex];
            factsContent.textContent = randomFact;
        } else {
            factsContent.textContent = 'Nenhuma curiosidade encontrada para este país ainda.';
        }

        factsModal.classList.remove('hidden');
    }


    // --- 5. FUNÇÕES DE RANKING ---
    function getRanking(key) {
        try {
            const rankingJSON = localStorage.getItem(key);
            return rankingJSON ? JSON.parse(rankingJSON) : [];
        } catch (e) { console.error("Falha ao ler o ranking:", e); return []; }
    }
    function saveRanking(key, ranking) {
         try {
            localStorage.setItem(key, JSON.stringify(ranking));
        } catch (e) { console.error("Falha ao salvar o ranking:", e); }
    }
    
    function renderRankingList(key) {
        const ranking = getRanking(key);
        rankingList.innerHTML = ''; 
        if (ranking.length === 0) {
            rankingList.innerHTML = '<p>Nenhuma pontuação salva aqui.</p>';
        } else {
            ranking.forEach((entry, index) => {
                const entryDiv = document.createElement('div');
                entryDiv.className = 'ranking-entry';
                entryDiv.innerHTML = `<span>${index + 1}. <span class="ranking-name">${entry.nome}</span></span><span class="ranking-score">${entry.score} pts</span>`;
                rankingList.appendChild(entryDiv);
            });
        }
    }

    function openRankingModal() {
        rankingModal.classList.remove('hidden');
        rankingTypeSelector.classList.add('hidden');
        rankingLevelSelector.classList.add('hidden');
        rankingList.innerHTML = '<p>Selecione um modo de jogo.</p>';
        document.querySelectorAll('.ranking-main-button, .ranking-type-button, .ranking-level-button').forEach(btn => btn.classList.remove('active'));
    }

    function checkAndSaveScore(finalScore) {
        if (!gameConfig.type || finalScore <= 0) return; // Só salva ranking para modos com tipo (Jornada/Rápido)

        const modeKey = gameConfig.mode === 'BandeiraPorPais' ? 'bandeira' : 'forma';
        let key;
        if (gameConfig.type === 'Jornada') {
            key = `ranking_${modeKey}_jornada`;
        } else { 
            key = `ranking_${modeKey}_rapido_${gameConfig.level}`;
        }
        
        const ranking = getRanking(key);
        const lowestRankedScore = ranking.length < 10 ? 0 : ranking[9].score;

        if (finalScore > lowestRankedScore) {
            saveScoreForm.classList.remove('hidden');
            playerNameInput.value = '';
            playerNameInput.focus();
        }
    }

    // --- 6. FUNÇÕES DE UI E AUXILIARES ---
    function showScreen(screenId) {
        [mainMenu, gameTypeMenu, levelSelectMenu, livesSelectMenu, gameScreen].forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
    }
    function updateStats() {
        scoreElement.textContent = `Pontos: ${gameState.score}`;
        streakElement.textContent = `🔥 ${gameState.streak}`;
        chancesElement.textContent = `❤️ ${gameState.chances}`;
    }
    
    function displayCountryShape(country) {
        countryShapeContainer.innerHTML = '';
        const img = document.createElement('img');
        // Caminho para os arquivos SVG locais
        img.src = `assets/shapes/${country.codigo}.svg`;
        img.alt = `Forma do país ${country.nome}`;
        countryShapeContainer.appendChild(img);
    }

    function displayFlagOptions(options) {
        optionsContainer.innerHTML = '';
        optionsContainer.classList.remove('hidden');
        options.forEach(country => {
            const wrapper = document.createElement('div');
            wrapper.className = 'option-wrapper';

            const img = document.createElement('img');
            // Caminho para as imagens das bandeiras locais
            img.src = `assets/flags/${country.codigo}.png`;
            img.alt = `Bandeira de ${country.nome}`;
            img.className = 'flag-option';
            img.dataset.codigo = country.codigo;
            img.dataset.type = 'flag';
            img.addEventListener('click', handleOptionClick);
            
            wrapper.appendChild(img);

            if (gameConfig.mode === 'FormaPorPais') {
                const nameLabel = document.createElement('div');
                nameLabel.className = 'country-name-label';
                nameLabel.textContent = country.nome.toUpperCase();
                wrapper.appendChild(nameLabel);
            }

            optionsContainer.appendChild(wrapper);
        });
    }
    function displayTextOptions(options) {
        optionsContainer.innerHTML = '';
        optionsContainer.classList.remove('hidden');
        shuffle(options).forEach(optionText => {
            if (optionText && optionText.trim() !== "") {
                const button = document.createElement('button');
                button.textContent = optionText;
                button.className = 'text-option';
                button.dataset.continente = optionText;
                button.dataset.type = 'text';
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

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // --- 7. INICIALIZAÇÃO E EVENT LISTENERS ---
    backButtons.forEach(button => button.addEventListener('click', () => showScreen(button.dataset.target)));

    document.querySelectorAll('#main-menu .mode-button').forEach(button => {
        const mode = button.dataset.gamemode;
        const modeTitle = gameModes[mode].title;

        if (mode === 'BandeiraPorPais' || mode === 'FormaPorPais') {
            button.addEventListener('click', () => {
                gameConfig = { mode: mode };
                gameTypeTitle.textContent = modeTitle;
                levelSelectTitle.textContent = modeTitle;
                livesSelectTitle.textContent = modeTitle;
                showScreen('game-type-menu');
            });
        } else {
             button.addEventListener('click', () => {
                startGame({ mode: mode, lives: 5 });
            });
        }
    });

    document.querySelectorAll('#game-type-menu .mode-button').forEach(button => {
        button.addEventListener('click', () => {
            gameConfig.type = button.dataset.gametype;
            if (gameConfig.type === 'Jornada') {
                gameConfig.lives = 'infinite';
                startGame(gameConfig);
            } else {
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

    saveScoreForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const playerName = playerNameInput.value.trim();
        if (!playerName) return;

        const modeKey = gameConfig.mode === 'BandeiraPorPais' ? 'bandeira' : 'forma';
        let key;
        if (gameConfig.type === 'Jornada') {
            key = `ranking_${modeKey}_jornada`;
        } else {
            key = `ranking_${modeKey}_rapido_${gameConfig.level}`;
        }

        const ranking = getRanking(key);
        ranking.push({ nome: playerName, score: gameState.score });
        ranking.sort((a, b) => b.score - a.score);
        const finalRanking = ranking.slice(0, 10);

        saveRanking(key, finalRanking);
        saveScoreForm.classList.add('hidden');
        feedbackElement.textContent = 'Pontuação salva com sucesso!';
    });
    
    factsButton.addEventListener('click', displayLocalFact);
    closeFactsButton.addEventListener('click', () => factsModal.classList.add('hidden'));
    backToMenuButton.addEventListener('click', () => showScreen('main-menu'));
    levelUpContinueButton.addEventListener('click', continueAfterLevelUp);
    nextButton.addEventListener('click', nextRound);
    showRankingButton.addEventListener('click', openRankingModal);
    closeRankingButton.addEventListener('click', () => rankingModal.classList.add('hidden'));
    
    // Lógica do Ranking
    rankingMainSelector.addEventListener('click', (event) => {
        const target = event.target.closest('.ranking-main-button');
        if (!target) return;

        currentRankingSelection = { mode: target.dataset.mode };
        document.querySelectorAll('.ranking-main-button').forEach(btn => btn.classList.remove('active'));
        target.classList.add('active');

        rankingTypeSelector.classList.remove('hidden');
        rankingLevelSelector.classList.add('hidden');
        rankingList.innerHTML = '<p>Selecione o tipo (Jornada/Rápido).</p>';
        document.querySelectorAll('.ranking-type-button, .ranking-level-button').forEach(btn => btn.classList.remove('active'));
    });

    rankingTypeSelector.addEventListener('click', (event) => {
        const target = event.target.closest('.ranking-type-button');
        if (!target) return;

        currentRankingSelection.type = target.dataset.type;
        document.querySelectorAll('.ranking-type-button').forEach(btn => btn.classList.remove('active'));
        target.classList.add('active');
        
        const modeKey = currentRankingSelection.mode === 'BandeiraPorPais' ? 'bandeira' : 'forma';

        if (currentRankingSelection.type === 'jornada') {
            rankingLevelSelector.classList.add('hidden');
            const key = `ranking_${modeKey}_jornada`;
            renderRankingList(key);
        } else { // Rápido
            rankingLevelSelector.classList.remove('hidden');
            rankingList.innerHTML = '<p>Selecione um nível para ver o ranking.</p>';
            document.querySelectorAll('.ranking-level-button').forEach(btn => btn.classList.remove('active'));
        }
    });

    rankingLevelSelector.addEventListener('click', (event) => {
        const target = event.target.closest('.ranking-level-button');
        if (!target) return;

        currentRankingSelection.level = target.dataset.level;
        document.querySelectorAll('.ranking-level-button').forEach(btn => btn.classList.remove('active'));
        target.classList.add('active');

        const modeKey = currentRankingSelection.mode === 'BandeiraPorPais' ? 'bandeira' : 'forma';
        const key = `ranking_${modeKey}_rapido_${currentRankingSelection.level}`;
        renderRankingList(key);
    });

    showScreen('main-menu');
});
