document.addEventListener('DOMContentLoaded', () => {

    const screens = {
        profile: document.getElementById('profile-menu'),
        main: document.getElementById('main-menu'),
        gameType: document.getElementById('game-type-menu'),
        levelSelect: document.getElementById('level-select-menu'),
        livesSelect: document.getElementById('lives-select-menu'),
        game: document.getElementById('game-screen'),
        passport: document.getElementById('passport-menu')
    };

    const modals = {
        levelUp: document.getElementById('level-up-modal'),
        ranking: document.getElementById('ranking-modal'),
        facts: document.getElementById('facts-modal'),
        achievement: document.getElementById('achievement-modal')
    };

    const elements = {
        mainContainer: document.getElementById('main-container'),
        profilesList: document.getElementById('profiles-list'),
        newProfileInput: document.getElementById('new-profile-name'),
        voiceSelect: document.getElementById('voice-select'),
        welcomeMessage: document.getElementById('welcome-message'),
        instruction: document.getElementById('instruction'),
        options: document.getElementById('options-container'),
        feedback: document.getElementById('feedback'),
        stat1: document.getElementById('stat-1'),
        stat2: document.getElementById('stat-2'),
        stat3: document.getElementById('stat-3'),
        progressBar: document.getElementById('progress-bar-fill'),
        countryShape: document.getElementById('country-shape-container'),
        memoryGame: document.getElementById('memory-game-container'),
        memoryGrid: document.getElementById('memory-grid'),
        passportGrid: document.getElementById('passport-grid'),
        passportCount: document.getElementById('passport-count'),
        passportGold: document.getElementById('passport-gold'),
        achievementText: document.getElementById('achievement-text'),
        levelButtonsContainer: document.getElementById('level-buttons-container')
    };

    const buttons = {
        createProfile: document.getElementById('create-profile-btn'),
        changeProfile: document.getElementById('change-profile-btn'),
        next: document.getElementById('next-button'),
        facts: document.getElementById('facts-button'),
        backToMenu: document.getElementById('back-to-menu-button'),
        playAgain: document.getElementById('play-again-button'),
        levelUpContinue: document.getElementById('level-up-continue-button'),
        closeRanking: document.getElementById('close-ranking-button'),
        closeFacts: document.getElementById('close-facts-button'),
        closeAchievement: document.getElementById('close-achievement-button'),
        showRanking: document.getElementById('show-ranking-button'),
        showPassport: document.getElementById('show-passport-button'),
        testVoice: document.getElementById('test-voice-btn'),
        levelBack: document.getElementById('level-back-btn')
    };

    const sounds = {
        win: new Audio('assets/audio/effects/win.mp3'),
        wrong: new Audio('assets/audio/effects/wrong.mp3'),
        levelUp: new Audio('assets/audio/effects/level.mp3'),
        completed: new Audio('assets/audio/effects/completed.mp3'),
        match: new Audio('assets/audio/effects/win.mp3')
    };

    let currentUser = null;
    let gameConfig = {};
    let gameState = {};
    let correctAnswer = null;
    let gameLocked = false;
    let voices = [];
    
    let memoryCards = [];
    let hasFlippedCard = false;
    let lockBoard = false;
    let firstCard, secondCard;
    let memoryMatches = 0;
    let memoryMoves = 0;

    // --- PERFIL & VOZ ---
    function initProfiles() {
        const profiles = JSON.parse(localStorage.getItem('detetive_profiles')) || [];
        elements.profilesList.innerHTML = '';
        if (profiles.length === 0) elements.profilesList.innerHTML = '<p>Crie um novo perfil abaixo!</p>';
        else profiles.forEach(name => {
            const btn = document.createElement('div'); btn.className = 'profile-btn';
            btn.textContent = name; btn.onclick = () => selectProfile(name);
            elements.profilesList.appendChild(btn);
        });
    }
    function createProfile() {
        const name = elements.newProfileInput.value.trim();
        if (!name) return alert('Digite um nome!');
        const profiles = JSON.parse(localStorage.getItem('detetive_profiles')) || [];
        if (profiles.includes(name)) return alert('Este nome já existe!');
        profiles.push(name); localStorage.setItem('detetive_profiles', JSON.stringify(profiles));
        elements.newProfileInput.value = ''; initProfiles(); selectProfile(name);
    }
    function selectProfile(name) {
        currentUser = name;
        elements.welcomeMessage.textContent = `Olá, ${currentUser}!`;
        const savedVoice = localStorage.getItem(`detetive_voice_${currentUser}`);
        if (savedVoice) elements.voiceSelect.value = savedVoice;
        showScreen('main'); speakText(`Seja bem vindo ${currentUser}!`);
    }
    function loadVoices() {
        voices = window.speechSynthesis.getVoices(); elements.voiceSelect.innerHTML = '';
        const pt = voices.filter(v => v.lang.includes('pt') || v.lang.includes('PT'));
        (pt.length ? pt : voices).forEach(v => {
            const opt = document.createElement('option'); opt.value = v.voiceURI; opt.textContent = v.name;
            elements.voiceSelect.appendChild(opt);
        });
    }
    function speakText(text) {
        if (!text) return; window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const v = voices.find(val => val.voiceURI === elements.voiceSelect.value);
        if (v) u.voice = v; u.rate = 1.4; window.speechSynthesis.speak(u);
    }
    if (window.speechSynthesis.onvoiceschanged !== undefined) window.speechSynthesis.onvoiceschanged = loadVoices;
    setTimeout(loadVoices, 500);

    // --- PROGRESSO ---
    function loadPlayerProgress() { return JSON.parse(localStorage.getItem(`detetive_progress_${currentUser}`)) || {}; }
    function savePlayerProgress(p) { localStorage.setItem(`detetive_progress_${currentUser}`, JSON.stringify(p)); }
    function updateCountryStats(code, isCorrect) {
        const p = loadPlayerProgress();
        if (!p[code]) p[code] = { acertos: 0, erros: 0, streak: 0 };
        if (isCorrect) { p[code].acertos++; p[code].streak++; } else { p[code].erros++; p[code].streak = 0; }
        savePlayerProgress(p); checkAchievements();
    }
    function getWeightedCountry(pool) {
        const p = loadPlayerProgress(); let wList = [];
        pool.forEach(c => {
            const s = p[c.codigo] || { acertos: 0, erros: 0 };
            let w = 1; if (s.erros > s.acertos) w = 5; else if (s.erros > 0) w = 3;
            for (let i = 0; i < w; i++) wList.push(c);
        });
        return shuffle(wList)[0];
    }

    // --- JOGO ---
    const gameModes = {
        'BandeiraPorPais': {
            title: "Qual a Bandeira?",
            setup: () => setupStandardRound((c) => {
                elements.instruction.textContent = `Qual é a bandeira ${c.artigo} ${c.nome}?`;
                playAudio(`bandeiras/${c.nome}`);
            }, 'flag')
        },
        'FormaPorPais': {
            title: "Qual a Forma?",
            setup: () => {
                elements.countryShape.classList.remove('hidden');
                setupStandardRound((c) => {
                    elements.instruction.textContent = `De qual país é esta forma?`;
                    playAudio(`formas/${c.nome}`);
                    displayCountryShape(c);
                }, 'flag')
            }
        },
        'PaisPorCapital': {
            title: "Qual o País?",
            setup: () => prepareStandardLogic((c) => {
                elements.instruction.textContent = `Qual país tem a capital ${c.capital}?`;
                playAudio(`capitais/${c.capital}`);
            }, 'flag', true)
        },
        'ContinentePorPais': {
            title: "Qual o Continente?",
            setup: () => {
                const all = [...new Set(countries.map(c => c.continente))];
                let sel = gameState.availableCountries;
                correctAnswer = gameConfig.type === 'Jornada' ? getWeightedCountry(sel) : shuffle([...sel])[0];
                if (!correctAnswer) { handleLevelComplete(); return; }
                elements.instruction.textContent = `Qual o continente ${correctAnswer.artigo} ${correctAnswer.nome}?`;
                playAudio(`continente_do_pais/${correctAnswer.nome}`);
                let opts = [correctAnswer.continente, ...shuffle(all.filter(c => c !== correctAnswer.continente)).slice(0, 3)];
                displayTextOptions(shuffle(opts));
            }
        },
        'Memoria': {
            title: "Jogo da Memória",
            setup: () => setupMemoryGame()
        }
    };

    function setupStandardRound(cb, type) { prepareStandardLogic(cb, type, false); }
    function prepareStandardLogic(cb, type, random) {
        elements.countryShape.classList.add('hidden'); elements.memoryGame.classList.add('hidden');
        let pool = gameState.availableCountries;
        if (pool.length === 0) { handleLevelComplete(); return; }
        correctAnswer = (gameConfig.type === 'Jornada' && !random) ? getWeightedCountry(pool) : shuffle([...pool])[0];
        let wrong = countries.filter(c => c.codigo !== correctAnswer.codigo);
        let hard = wrong.filter(c => c.continente === correctAnswer.continente);
        let opts = [correctAnswer, ...shuffle(hard.length >= 3 ? hard : wrong).slice(0, 3)];
        cb(correctAnswer); displayFlagOptions(shuffle(opts), gameConfig.mode === 'FormaPorPais');
    }

    function startGame(conf) {
        gameConfig = conf; 
        showScreen('game'); 
        elements.options.classList.remove('hidden'); 
        buttons.backToMenu.textContent = 'Menu Principal';
        buttons.playAgain.classList.add('hidden');

        // MODO MEMÓRIA COM LÓGICA DE NÍVEIS 1-5
        if (gameConfig.mode === 'Memoria') {
            elements.mainContainer.classList.add('memory-mode');

            let possibleCountries = [];
            let gridSize = 16; // Padrão

            // Filtra países pela dificuldade
            if (conf.level === 1) {
                // Só fáceis (Nivel 1)
                possibleCountries = countries.filter(c => c.nivel === 1);
                gridSize = 16; // 4x4
            } else if (conf.level === 2) {
                // Até nível 2
                possibleCountries = countries.filter(c => c.nivel <= 2);
                gridSize = 20; // 5x4
            } else if (conf.level === 3) {
                // Até nível 3
                possibleCountries = countries.filter(c => c.nivel <= 3);
                gridSize = 24; // 6x4
            } else if (conf.level === 4) {
                // Até nível 4
                possibleCountries = countries.filter(c => c.nivel <= 4);
                gridSize = 32; // 8x4
            } else {
                // Nível 5 (Todos/Difíceis)
                possibleCountries = [...countries]; // Pega tudo
                gridSize = 40; // 10x4
            }
            
            // Garante que temos países suficientes
            if(possibleCountries.length < gridSize/2) possibleCountries = [...countries];

            gameState = {
                score: 0, streak: 0, chances: '♾️', 
                currentLevel: conf.level,
                availableCountries: shuffle(possibleCountries).slice(0, gridSize/2),
                totalQuestionsInLevel: gridSize/2, // Pares
                pairsFound: 0
            };
            memoryMoves = 0;

        // MODO QUIZ
        } else {
            elements.mainContainer.classList.remove('memory-mode');
            let sl = 1;
            if (gameConfig.type === 'Jornada') sl = parseInt(localStorage.getItem(`detetive_journey_${currentUser}`)) || 1;
            else sl = gameConfig.level || 1;
            let pool = (gameConfig.type === 'Rápido' || gameConfig.type === 'Jornada') ? countries.filter(c => c.nivel === sl) : [...countries];
            gameState = {
                score: 0, streak: 0, 
                chances: gameConfig.lives === 'infinite' ? '♾️' : gameConfig.lives,
                currentLevel: sl, availableCountries: pool, totalQuestionsInLevel: pool.length, attemptsThisRound: 0
            };
        }
        updateStats(); updateProgressBar(); nextRound();
    }

    function nextRound() {
        if (gameState.chances === 0 && gameConfig.lives !== 'infinite') { gameOver(false); return; }
        buttons.facts.classList.add('hidden'); buttons.next.classList.add('hidden'); elements.feedback.textContent = '';
        gameLocked = false; gameState.attemptsThisRound = 0; gameModes[gameConfig.mode].setup();
    }

    function handleOptionClick(e) {
        if (gameLocked) return;
        const el = e.target.closest('.flag-option') || e.target.closest('.text-option');
        if (!el) return;
        const type = el.dataset.type;
        const val = type === 'flag' ? el.dataset.codigo : el.dataset.continente;
        const isCor = type === 'flag' ? (val === correctAnswer.codigo) : (val === correctAnswer.continente);

        if (type === 'flag' && gameConfig.mode !== 'ContinentePorPais') updateCountryStats(correctAnswer.codigo, isCor);

        if (isCor) {
            playSound('win'); gameLocked = true; gameState.streak++;
            let pts = Math.max(1, 10 - (gameState.attemptsThisRound * 2)) + (gameState.streak > 1 ? gameState.streak : 0);
            gameState.score += pts;
            gameState.availableCountries = gameState.availableCountries.filter(c => c.codigo !== correctAnswer.codigo);
            document.querySelectorAll('.flag-option, .text-option').forEach(x => x.classList.add('disabled'));
            el.classList.remove('disabled'); el.classList.add('correct');
            elements.feedback.textContent = `Boa! (+${pts} pts)`; elements.feedback.style.color = '#32CD32';
            buttons.next.classList.remove('hidden'); buttons.facts.classList.remove('hidden');
            updateStats(); updateProgressBar();
            if (gameState.availableCountries.length === 0) setTimeout(handleLevelComplete, 1000);
        } else {
            playSound('wrong'); el.classList.add('incorrect', 'disabled'); gameState.streak = 0;
            if (gameConfig.lives !== 'infinite') gameState.chances--;
            gameState.attemptsThisRound++;
            let msg = "Ops! ";
            if (type === 'flag') { const c = countries.find(x => x.codigo === val); if (c) msg += `Essa é ${c.artigo} ${c.nome}.`; }
            elements.feedback.textContent = msg; elements.feedback.style.color = '#FF6347';
            if (gameState.chances === 0 && gameConfig.lives !== 'infinite') setTimeout(() => gameOver(false), 1000);
            updateStats();
        }
    }

    // --- MEMÓRIA ---
    function setupMemoryGame() {
        elements.options.classList.add('hidden'); elements.instruction.textContent = "Encontre os pares!";
        elements.memoryGame.classList.remove('hidden'); elements.memoryGrid.innerHTML = ''; buttons.next.classList.add('hidden');
        
        elements.memoryGrid.className = 'memory-grid';
        
        // Define classe de colunas baseada no total de cartas
        const totalCards = gameState.totalQuestionsInLevel * 2;
        if (totalCards === 16) elements.memoryGrid.classList.add('grid-cols-4');
        else if (totalCards === 20) elements.memoryGrid.classList.add('grid-cols-5');
        else if (totalCards === 24) elements.memoryGrid.classList.add('grid-cols-6');
        else if (totalCards === 32) elements.memoryGrid.classList.add('grid-cols-8');
        else elements.memoryGrid.classList.add('grid-cols-10');

        let sel = gameState.availableCountries;
        if (sel.length === 0) { handleLevelComplete(); return; }
        
        memoryCards = [];
        sel.forEach(c => {
            memoryCards.push({ id: c.codigo, type: 'flag', content: `assets/flags/${c.codigo}.png`, country: c });
            memoryCards.push({ id: c.codigo, type: 'name', content: c.nome, country: c });
        });
        memoryCards = shuffle(memoryCards); memoryMatches = 0;
        
        memoryCards.forEach((c, i) => {
            const el = document.createElement('div'); el.className = 'memory-card'; el.dataset.index = i; el.dataset.id = c.id;
            el.innerHTML = `<div class="memory-card-inner"><div class="memory-card-front">?</div><div class="memory-card-back">${c.type === 'flag' ? `<img src="${c.content}">` : `<span class="memory-text">${c.content}</span>`}</div></div>`;
            el.addEventListener('click', flipCard); elements.memoryGrid.appendChild(el);
        });
    }

    function flipCard() {
        if (lockBoard || this === firstCard) return;
        this.classList.add('flipped');
        if (!hasFlippedCard) { hasFlippedCard = true; firstCard = this; return; }
        secondCard = this; memoryMoves++; updateStats(); checkForMatch();
    }

    function checkForMatch() {
        if (firstCard.dataset.id === secondCard.dataset.id) {
            disableCards(); playSound('match'); confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
            gameState.score += 100; memoryMatches++; gameState.pairsFound = memoryMatches;
            updateStats(); updateCountryStats(firstCard.dataset.id, true);
            if (memoryMatches === memoryCards.length / 2) setTimeout(handleLevelComplete, 1000);
        } else {
            if(gameState.score > 0) gameState.score -= 10;
            updateStats(); unflipCards();
        }
    }
    function disableCards() { firstCard.classList.add('matched'); secondCard.classList.add('matched'); resetBoard(); }
    function unflipCards() { lockBoard = true; setTimeout(() => { firstCard.classList.remove('flipped'); secondCard.classList.remove('flipped'); resetBoard(); }, 1500); }
    function resetBoard() { [hasFlippedCard, lockBoard] = [false, false]; [firstCard, secondCard] = [null, null]; }

    // --- FIM DE JOGO ---
    function handleLevelComplete() {
        updateProgressBar(100); playSound('completed'); dispararConfetes();
        if (gameConfig.type === 'Jornada') {
            gameState.currentLevel++; localStorage.setItem(`detetive_journey_${currentUser}`, gameState.currentLevel);
            if (gameState.currentLevel > 5) gameOver(true);
            else {
                modals.levelUp.querySelector('p').textContent = `Nível ${gameState.currentLevel - 1} Completo!`;
                modals.levelUp.classList.remove('hidden');
                speakText(`Parabéns ${currentUser}! Nível completo.`);
            }
        } else gameOver(true);
    }
    
    function gameOver(win) {
        gameLocked = true; buttons.next.classList.add('hidden'); buttons.facts.classList.add('hidden');
        buttons.backToMenu.textContent = 'Menu Principal'; buttons.playAgain.classList.remove('hidden');
        elements.options.classList.add('hidden'); elements.countryShape.classList.add('hidden'); elements.memoryGame.classList.add('hidden');
        elements.instruction.textContent = win ? 'Missão Cumprida!' : 'Fim de Jogo';
        elements.feedback.textContent = win ? `Pontuação Final: ${gameState.score}` : `Tente de novo! Pontos: ${gameState.score}`;
        elements.feedback.style.color = win ? '#32CD32' : '#DC143C';
        speakText(win ? `Incrível ${currentUser}! Você venceu.` : `Bom jogo ${currentUser}. Tente novamente.`);
        saveGlobalScore(gameState.score);
    }

    // --- UTILS ---
    function showScreen(key) { Object.values(screens).forEach(s => s.classList.add('hidden')); screens[key].classList.remove('hidden'); }
    
    function updateStats() { 
        if (gameConfig.mode === 'Memoria') {
            const pairsLeft = gameState.totalQuestionsInLevel - (gameState.pairsFound || 0);
            elements.stat1.textContent = `Pares: ${pairsLeft}`;
            elements.stat2.textContent = `Tentativas: ${memoryMoves}`;
            elements.stat3.textContent = `Pts: ${gameState.score}`;
            updateProgressBar((gameState.pairsFound / gameState.totalQuestionsInLevel) * 100);
        } else {
            elements.stat1.textContent = `Pts: ${gameState.score}`; 
            elements.stat2.textContent = `🔥 ${gameState.streak}`; 
            elements.stat3.textContent = `❤️ ${gameState.chances}`; 
            let cur = gameState.totalQuestionsInLevel - gameState.availableCountries.length;
            let tot = gameState.totalQuestionsInLevel || 1;
            updateProgressBar((cur / tot) * 100);
        }
    }
    function updateProgressBar(p) { if (p > 100) p = 100; elements.progressBar.style.width = `${p}%`; }
    function displayCountryShape(c) { elements.countryShape.innerHTML = `<img src="assets/shapes/${c.codigo}.svg">`; }
    function displayFlagOptions(opts, n) {
        elements.options.innerHTML = '';
        opts.forEach(c => {
            const w = document.createElement('div'); w.className = 'option-wrapper';
            const i = document.createElement('img'); i.src = `assets/flags/${c.codigo}.png`;
            i.className = 'flag-option'; i.dataset.codigo = c.codigo; i.dataset.type = 'flag';
            i.addEventListener('click', handleOptionClick);
            w.appendChild(i);
            if (n) { const l = document.createElement('div'); l.className = 'country-name-label'; l.textContent = c.nome.toUpperCase(); w.appendChild(l); }
            elements.options.appendChild(w);
        });
    }
    function displayTextOptions(opts) {
        elements.options.innerHTML = '';
        opts.forEach(t => {
            const b = document.createElement('button'); b.textContent = t; b.className = 'text-option';
            b.dataset.continente = t; b.dataset.type = 'text'; b.addEventListener('click', handleOptionClick);
            elements.options.appendChild(b);
        });
    }
    function playAudio(p) { const c = p.toLowerCase().replace(/ /g, '_').replace(/\./g, ''); const a = new Audio(`assets/audio/${c}.mp3`); a.play().catch(e => { }); }
    function playSound(k) { if (sounds[k]) { sounds[k].currentTime = 0; sounds[k].play().catch(e => { }); } }
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function saveGlobalScore(s) {
        const l = JSON.parse(localStorage.getItem('ranking_global')) || [];
        l.push({ nome: currentUser, score: s, mode: gameModes[gameConfig.mode].title });
        l.sort((a, b) => b.score - a.score); localStorage.setItem('ranking_global', JSON.stringify(l.slice(0, 10)));
    }
    function checkAchievements() {
        const p = loadPlayerProgress(); const u = JSON.parse(localStorage.getItem(`detetive_achievements_${currentUser}`)) || [];
        [{ id: '1', t: 'Primeiro Passo', c: x => Object.values(x).some(v => v.acertos > 0) }, { id: '10', t: 'Explorador', c: x => Object.values(x).filter(v => v.acertos > 0).length >= 10 }]
            .forEach(a => {
                if (!u.includes(a.id) && a.c(p)) {
                    elements.achievementText.textContent = a.t; modals.achievement.classList.remove('hidden');
                    playSound('win'); dispararConfetes(); u.push(a.id); localStorage.setItem(`detetive_achievements_${currentUser}`, JSON.stringify(u));
                }
            });
    }
    function dispararConfetes() { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }

    buttons.createProfile.addEventListener('click', createProfile);
    buttons.changeProfile.addEventListener('click', () => { currentUser = null; showScreen('profile'); });
    buttons.testVoice.addEventListener('click', () => speakText(`Testando ${currentUser}`));
    elements.voiceSelect.addEventListener('change', () => { localStorage.setItem(`detetive_voice_${currentUser}`, elements.voiceSelect.value); speakText('Ok'); });
    buttons.backToMenu.addEventListener('click', () => {
        elements.mainContainer.classList.remove('memory-mode');
        showScreen('main');
    });
    buttons.playAgain.addEventListener('click', () => startGame(gameConfig));
    buttons.levelUpContinue.addEventListener('click', () => { modals.levelUp.classList.add('hidden'); startGame(gameConfig); });
    buttons.next.addEventListener('click', nextRound);
    buttons.facts.addEventListener('click', () => {
        const f = curiosities[correctAnswer.codigo]; document.getElementById('facts-content').textContent = f ? f[0] : '...';
        modals.facts.classList.remove('hidden');
    });
    buttons.closeFacts.addEventListener('click', () => modals.facts.classList.add('hidden'));
    buttons.closeAchievement.addEventListener('click', () => modals.achievement.classList.add('hidden'));
    buttons.closeRanking.addEventListener('click', () => modals.ranking.classList.add('hidden'));
    buttons.showRanking.addEventListener('click', () => {
        const l = JSON.parse(localStorage.getItem('ranking_global')) || [];
        const c = document.getElementById('ranking-list'); c.innerHTML = '';
        l.forEach((r, i) => c.innerHTML += `<div class="ranking-entry"><span>${i + 1}. ${r.nome}</span><span>${r.score}</span></div>`);
        modals.ranking.classList.remove('hidden');
    });
    buttons.showPassport.addEventListener('click', () => {
        const p = loadPlayerProgress(); const g = elements.passportGrid; g.innerHTML = ''; let u = 0, go = 0;
        countries.forEach(c => {
            const s = p[c.codigo] || { acertos: 0 }; if (s.acertos > 0) { u++; if (s.acertos >= 5 && s.erros < 2) go++; }
            const i = document.createElement('div'); i.className = 'passport-item';
            if (s.acertos > 0) { i.classList.add('unlocked'); if (s.acertos >= 5 && s.erros < 2) i.classList.add('gold'); }
            i.innerHTML = `<img src="assets/flags/${c.codigo}.png">`; g.appendChild(i);
        });
        elements.passportCount.textContent = u; elements.passportGold.textContent = go; showScreen('passport');
    });

    document.querySelectorAll('.back-button').forEach(b => b.addEventListener('click', () => {
        const t = b.dataset.target;
        if (t === 'main-menu') { elements.mainContainer.classList.remove('memory-mode'); showScreen('main'); } 
        else if (t === 'game-type-menu') showScreen('gameType'); else showScreen('levelSelect');
    }));
    document.querySelectorAll('#main-menu .mode-button').forEach(b => b.addEventListener('click', () => {
        gameConfig.mode = b.dataset.gamemode;
        // Habilita todos os níveis para memória (ou ajusta se necessário)
        if (gameConfig.mode === 'Memoria') {
            // Garante que todos os botões de nível aparecem (1 a 5)
            for(let i=1; i<=5; i++) document.getElementById(`btn-level-${i}`).classList.remove('hidden');
            showScreen('levelSelect');
        } else {
            for(let i=1; i<=5; i++) document.getElementById(`btn-level-${i}`).classList.remove('hidden');
            showScreen('gameType');
        }
    }));
    document.querySelectorAll('#game-type-menu .mode-button').forEach(b => b.addEventListener('click', () => {
        gameConfig.type = b.dataset.gametype;
        if (gameConfig.type === 'Jornada') { gameConfig.lives = 'infinite'; startGame(gameConfig); } else showScreen('levelSelect');
    }));
    document.querySelectorAll('#level-select-menu .mode-button').forEach(b => b.addEventListener('click', () => {
        gameConfig.level = parseInt(b.dataset.level);
        if (gameConfig.mode === 'Memoria') { gameConfig.lives = 'infinite'; startGame(gameConfig); } else showScreen('livesSelect');
    }));
    document.querySelectorAll('#lives-select-menu .mode-button').forEach(b => b.addEventListener('click', () => {
        gameConfig.lives = b.dataset.lives === 'infinite' ? 'infinite' : parseInt(b.dataset.lives); startGame(gameConfig);
    }));

    initProfiles(); showScreen('profile');
});