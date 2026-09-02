
// ═══════════════════════════════════════════════════════
// CAMADA DE DADOS — "modo local" (localStorage)
// Mesma interface que será usada pelo backend (Supabase).
// Trocar só esta implementação quando o backend existir.
// ═══════════════════════════════════════════════════════
const Store = {
    _get(key, fallback) {
        try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
        catch (e) { return fallback; }
    },
    _set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('Store cheio?', e); }
    },
    _profilesKey: 'dg_profiles',
    _progressKey: n => `dg_progress_${n}`,
    _journeyKey: n => `dg_journey_${n}`,
    _stickersKey: n => `dg_stickers_${n}`,
    _packsCountKey: n => `detetive_packs_${n}`,
    _packsDateKey: n => `detetive_daily_pack_date_${n}`,
    _rankingKey: 'ranking_global',
};

const API = {
    async getProfiles() {
        const list = Store._get(Store._profilesKey, []);
        return list.map(p => ({
            name: p.name,
            avatar: p.avatar || '🌍',
            created_at: p.created_at,
            sticker_count: Store._get(Store._stickersKey(p.name), []).length,
            journey_level: Store._get(Store._journeyKey(p.name), 1),
        }));
    },
    async createProfile(name, avatar) {
        name = (name || '').trim();
        if (!name || name.length > 16) return { error: 'Nome inválido' };
        const list = Store._get(Store._profilesKey, []);
        if (list.some(p => p.name.toLowerCase() === name.toLowerCase())) return { error: 'Esse nome já existe' };
        const profile = { name, avatar: avatar || '🌍', created_at: new Date().toISOString() };
        list.push(profile);
        Store._set(Store._profilesKey, list);
        Store._set(Store._packsCountKey(name), 1);
        return profile;
    },
    async deleteProfile(name) {
        Store._set(Store._profilesKey, Store._get(Store._profilesKey, []).filter(p => p.name !== name));
        [Store._progressKey, Store._journeyKey, Store._stickersKey, Store._packsCountKey, Store._packsDateKey]
            .forEach(k => localStorage.removeItem(k(name)));
        localStorage.removeItem(`detetive_achievements_${name}`);
    },
    async getProgress(name) { return Store._get(Store._progressKey(name), {}); },
    async saveProgress(name, data) { Store._set(Store._progressKey(name), data); },
    async getStickers(name) { return Store._get(Store._stickersKey(name), []); },
    async saveStickers(name, stickers) { Store._set(Store._stickersKey(name), stickers); },
    async getPacks(name) {
        return {
            count: Number(localStorage.getItem(Store._packsCountKey(name)) || 0),
            last_daily_at: localStorage.getItem(Store._packsDateKey(name)) || null,
        };
    },
    async savePacks(name, count, last_daily_at) {
        localStorage.setItem(Store._packsCountKey(name), Number(count) || 0);
        if (last_daily_at) localStorage.setItem(Store._packsDateKey(name), last_daily_at);
    },
    async getJourney(name) { return { level: Store._get(Store._journeyKey(name), 1) }; },
    async saveJourney(name, level) { Store._set(Store._journeyKey(name), Number(level) || 1); },
    async getRanking(mode) {
        let l = Store._get(Store._rankingKey, []);
        if (mode && mode !== 'Todos') l = l.filter(r => r.mode === mode);
        return l.sort((a, b) => b.score - a.score).slice(0, 20);
    },
    async addRanking(nome, score, mode) {
        const l = Store._get(Store._rankingKey, []);
        l.push({ nome, score: Number(score) || 0, mode, played_at: new Date().toISOString() });
        l.sort((a, b) => b.score - a.score);
        Store._set(Store._rankingKey, l.slice(0, 200));
    },
};

// ═══════════════════════════════════════════════════════
// AUTENTICAÇÃO — usuário + senha ("modo local")
// Troca só esta implementação quando o Supabase existir.
// ═══════════════════════════════════════════════════════
const Auth = {
    async _hash(password, salt) {
        const bytes = new TextEncoder().encode(`${salt}:${password}`);
        const buf = await crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    },
    _accounts() { return Store._get(Store._profilesKey, []); },
    _saveAccounts(list) { Store._set(Store._profilesKey, list); },
    list() { return this._accounts().map(a => ({ name: a.name, avatar: a.avatar || '🌍' })); },
    avatarOf(name) {
        const a = this._accounts().find(x => x.name === name);
        return a ? (a.avatar || '🌍') : '🌍';
    },
    async signup(name, password, avatar) {
        name = (name || '').trim();
        if (name.length < 2 || name.length > 16) return { error: 'O usuário precisa ter de 2 a 16 caracteres.' };
        if (!/^[\p{L}\p{N} _.\-]+$/u.test(name)) return { error: 'Use apenas letras, números, espaço, ponto ou hífen.' };
        if ((password || '').length < 4) return { error: 'A senha precisa ter pelo menos 4 caracteres.' };
        const accts = this._accounts();
        if (accts.some(a => a.name.toLowerCase() === name.toLowerCase())) {
            return { error: 'Esse usuário já existe. Tente entrar.' };
        }
        const salt = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random());
        const hash = await this._hash(password, salt);
        const acct = { name, avatar: avatar || '🌍', salt, hash, created_at: new Date().toISOString() };
        accts.push(acct);
        this._saveAccounts(accts);
        localStorage.setItem(Store._packsCountKey(name), 1);
        return { name, avatar: acct.avatar };
    },
    async login(name, password) {
        name = (name || '').trim();
        const accts = this._accounts();
        const acct = accts.find(a => a.name.toLowerCase() === name.toLowerCase());
        if (!acct) return { error: 'Usuário não encontrado. Crie uma conta.' };
        if (!acct.hash) {
            // conta antiga (sem senha) — adota a senha digitada agora
            acct.salt = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random());
            acct.hash = await this._hash(password, acct.salt);
            this._saveAccounts(accts.map(a => (a.name === acct.name ? acct : a)));
            return { name: acct.name, avatar: acct.avatar || '🌍' };
        }
        const hash = await this._hash(password, acct.salt);
        if (hash !== acct.hash) return { error: 'Senha incorreta.' };
        return { name: acct.name, avatar: acct.avatar || '🌍' };
    },
    removeAccount(name) {
        this._saveAccounts(this._accounts().filter(a => a.name !== name));
    },
    logout() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('detetive_avatar');
    },
};

// ═══════════════════════════════════════════════════════
// TROCAS — entre contas do mesmo aparelho ("modo local")
// Vira offer/accept via Supabase Realtime quando o backend existir.
// ═══════════════════════════════════════════════════════
// Modelo de figurinha: { codigo, colada: null|rarity, pilha: [rarity, ...] }
//   colada  -> a que está no álbum (null = ainda não colada)
//   pilha   -> cópias na mão (pra colar OU trocar)
const Trades = {
    _key: n => `dg_stickers_${n}`,
    _read(name) {
        try {
            const list = JSON.parse(localStorage.getItem(this._key(name)) || '[]');
            return list.map(Trades._normalize);
        } catch (e) { return []; }
    },
    _write(name, list) { localStorage.setItem(this._key(name), JSON.stringify(list)); },

    // converte formato antigo {codigo,rarity,count} -> novo
    _normalize(s) {
        if (s && Array.isArray(s.pilha) && ('colada' in s)) return s;
        const count = Math.max(1, s.count || 1);
        return { codigo: s.codigo, colada: s.rarity || 'base', pilha: Array(count - 1).fill('base') };
    },

    others(me) { return Auth.list().filter(a => a.name !== me); },

    // figurinhas de `name` com cópias na pilha (disponíveis pra troca)
    repeats(name) {
        return this._read(name)
            .filter(s => (s.pilha || []).length > 0)
            .map(s => ({ codigo: s.codigo, count: s.pilha.length, rarities: s.pilha }));
    },

    // códigos que `name` ainda não colou no álbum
    missingCodes(name, allCodes) {
        const colada = new Set(this._read(name).filter(s => s.colada).map(s => s.codigo));
        return allCodes.filter(c => !colada.has(c));
    },

    // move 1 cópia (raridade mais baixa) da pilha de `from` para a de `to`
    _give(from, to, codigo) {
        const src = this._read(from);
        const it = src.find(s => s.codigo === codigo);
        if (!it || !(it.pilha || []).length) return false;
        // dá a cópia mais fraca
        const order = ['base', 'roxa', 'bronze', 'prata', 'ouro'];
        it.pilha.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        const rar = it.pilha.shift();
        this._write(from, src);

        const dst = this._read(to);
        let d = dst.find(s => s.codigo === codigo);
        if (!d) { d = { codigo, colada: null, pilha: [] }; dst.push(d); }
        d.pilha.push(rar);
        this._write(to, dst);
        return true;
    },

    execute(me, other, iGive, iGet) {
        const okA = this._give(me, other, iGive);
        if (!okA) return { error: 'Você não tem essa figurinha na pilha.' };
        const okB = this._give(other, me, iGet);
        if (!okB) {
            this._give(other, me, iGive); // desfaz
            return { error: `${other} não tem essa figurinha na pilha.` };
        }
        return { ok: true };
    },
};

// In-memory cache for current session (to avoid too many API calls during a game)
const _cache = {};

// ═══════════════════════════════════════════════════════
// AVATAR PICKER — Seletor de avatares com categorias
// ═══════════════════════════════════════════════════════
const AVATAR_CATEGORIES = [
    {
        label: '🌍 Mundo',
        emojis: ['🌍','🌎','🌏','🗺️','🧭','🏔️','🌋','🏝️','🏜️','🌊','🌄','🌅','🌆','🌇','🌃','🌌','⭐','🌟','💫','✨','☄️','🌠','🎆','🎇','🗼','🗽','🏰','🏯','🗿','🧱']
    },
    {
        label: '🏆 Vitória',
        emojis: ['🏆','🥇','🥈','🥉','🎯','🎖️','🏅','👑','💎','💰','🎰','🎲','🃏','♟️','🎮','🕹️','🎳','🎱','🎪','🎠','🎡','🎢','🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶']
    },
    {
        label: '🦁 Animais',
        emojis: ['🦁','🐯','🐻','🦊','🐺','🐗','🦝','🦨','🦡','🦦','🦥','🐼','🐨','🦘','🦛','🦏','🐘','🦒','🐪','🐫','🦙','🦔','🐇','🦌','🦬','🐂','🐃','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦣','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝']
    },
    {
        label: '🦅 Aves',
        emojis: ['🦅','🦆','🐦','🦉','🦇','🐺','🦋','🐛','🐌','🐜','🐝','🐞','🦗','🦟','🦠','🦈','🐬','🐳','🐋','🦭','🐊','🐢','🦎','🐍','🦕','🦖','🦎','🐸','🦑','🐙','🦀','🦞','🦐','🦪']
    },
    {
        label: '🌺 Natureza',
        emojis: ['🌺','🌸','🌹','🌻','🌼','💐','🌷','🌿','🍀','🍁','🍂','🍃','🌱','🌲','🌳','🌴','🎋','🎍','🍄','🌾','🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥','🥑','🫑']
    },
    {
        label: '🔥 Elementos',
        emojis: ['🔥','💧','🌊','⚡','❄️','🌪️','🌈','⛈️','🌩️','🌨️','☁️','⛅','🌤️','☀️','🌙','🌛','🌜','🌝','🌞','🪐','💥','🌀','🌂','⚓','🗡️','⚔️','🛡️','🪬','🔮','🪄','🎩','🧿']
    },
    {
        label: '🚀 Aventura',
        emojis: ['🚀','🛸','🛩️','✈️','🚂','🚢','🛥️','⛵','🏄','🧗','🤿','🏊','🏇','🚴','🏋️','⛷️','🏂','🧘','🏌️','🏹','🎣','🤺','🥊','🎽','⛷️','🪂','🧳','🗺️','🔭','🪁','🎿']
    },
    {
        label: '🎭 Diversão',
        emojis: ['🎭','🃏','🎪','🤡','👹','👺','👻','💀','☠️','👽','👾','🤖','😈','👿','🦄','🐉','🐲','🦋','🌈','🎠','🎡','🎢','🎰','🎳','🎯','🎱','🎲','🎮','🕹️','🎴','🀄']
    },
    {
        label: '😎 Rostos',
        emojis: ['😎','🤩','🥳','😏','😤','🤠','🥸','🤓','👽','🤡','💩','😈','👻','🦸','🦹','🧙','🧝','🧛','🧟','🧞','🧜','🧚','👮','🕵️','💂','🥷','👷','🤴','👸','🤶','🎅']
    },
    {
        label: '⚽ Esportes',
        emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥍','🏑','🏏','🪃','⛳','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','🪂']
    }
];

function initAvatarPicker() {
    const modal = document.getElementById('avatar-picker-modal');
    const tabsContainer = document.getElementById('avatar-picker-tabs');
    const gridContainer = document.getElementById('avatar-picker-grid');
    const preview = document.getElementById('avatar-preview-bubble');
    const hiddenInput = document.getElementById('selected-avatar');
    const openBtn = document.getElementById('open-avatar-picker');
    const closeBtn = document.getElementById('close-avatar-picker');

    if (!modal || !openBtn) {
        console.warn('Avatar picker: elementos nao encontrados no DOM');
        return;
    }

    // Prevent duplicate listeners
    if (openBtn._avatarInitialized) return;
    openBtn._avatarInitialized = true;

    let currentCategory = 0;
    let selectedEmoji = hiddenInput ? hiddenInput.value : '??';

    function renderTabs() {
        if (tabsContainer.children.length === 0) {
            AVATAR_CATEGORIES.forEach((cat, i) => {
                const btn = document.createElement('button');
                btn.className = 'avatar-tab-btn' + (i === currentCategory ? ' active' : '');
                btn.textContent = cat.label;
                btn.addEventListener('click', () => {
                    currentCategory = i;
                    renderTabs();
                    renderGrid();
                });
                tabsContainer.appendChild(btn);
            });
        } else {
            Array.from(tabsContainer.children).forEach((btn, i) => {
                btn.className = 'avatar-tab-btn' + (i === currentCategory ? ' active' : '');
            });
        }
    }

    function renderGrid() {
        gridContainer.innerHTML = '';
        const cat = AVATAR_CATEGORIES[currentCategory];
        if (!cat) return;
        cat.emojis.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = 'avatar-emoji-btn' + (emoji === selectedEmoji ? ' selected' : '');
            btn.textContent = emoji;
            btn.title = emoji;
            btn.addEventListener('click', () => {
                selectedEmoji = emoji;
                if (preview) preview.textContent = emoji;
                if (hiddenInput) hiddenInput.value = emoji;
                gridContainer.querySelectorAll('.avatar-emoji-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                setTimeout(() => modal.classList.add('hidden'), 280);
            });
            gridContainer.appendChild(btn);
        });
    }

    openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modal.classList.remove('hidden');
        renderTabs();
        renderGrid();
    });

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    if (preview) preview.textContent = selectedEmoji;
    console.log('Avatar picker inicializado com sucesso!');
}

const continentSVGs = {
    'América do Sul': '<svg viewBox="0 0 100 100" fill="currentColor" width="40" height="40"><path d="M40,20 Q50,30 45,50 Q40,70 50,90 Q30,95 25,75 Q20,55 30,35 Q35,25 40,20 Z"/></svg>',
    'América do Norte': '<svg viewBox="0 0 100 100" fill="currentColor" width="40" height="40"><path d="M20,10 Q50,5 70,20 Q80,40 60,60 Q40,50 30,65 Q10,40 20,10 Z"/></svg>',
    'Europa': '<svg viewBox="0 0 100 100" fill="currentColor" width="40" height="40"><path d="M40,30 Q60,25 75,35 Q80,55 60,65 Q45,55 40,50 Q30,40 40,30 Z"/></svg>',
    'África': '<svg viewBox="0 0 100 100" fill="currentColor" width="40" height="40"><path d="M30,30 Q60,20 80,40 Q75,70 50,85 Q40,65 25,50 Q20,40 30,30 Z"/></svg>',
    'Ásia': '<svg viewBox="0 0 100 100" fill="currentColor" width="40" height="40"><path d="M40,20 Q80,10 90,40 Q85,70 70,80 Q50,75 30,60 Q20,30 40,20 Z"/></svg>',
    'Oceania': '<svg viewBox="0 0 100 100" fill="currentColor" width="40" height="40"><path d="M50,50 Q80,45 90,60 Q85,85 60,80 Q40,70 50,50 Z"/></svg>'
};
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW falhou:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // --- REFERÊNCIAS ---
    const screens = {
        profile: document.getElementById('profile-menu'),
        main: document.getElementById('main-menu'),
        setup: document.getElementById('game-setup'),
        trades: document.getElementById('trades-menu'),
        game: document.getElementById('game-screen'),
        passport: document.getElementById('passport-menu'),
        album: document.getElementById('album-menu'),
        partyLobbyHost: document.getElementById('party-lobby-host'),
        partyJoinClient: document.getElementById('party-join-client'),
        partyWaitClient: document.getElementById('party-wait-client'),
        partyGameHost: document.getElementById('party-game-host'),
        partyGameClient: document.getElementById('party-game-client'),
        partyLeaderboardHost: document.getElementById('party-leaderboard-host')
    };

    const modals = {
        levelUp: document.getElementById('level-up-modal'),
        ranking: document.getElementById('ranking-modal'),
        facts: document.getElementById('facts-modal'),
        achievement: document.getElementById('achievement-modal'),
        pack: document.getElementById('pack-modal')
    };

    const elements = {
        mainContainer: document.getElementById('main-container'),
        profilesList: document.getElementById('profiles-list'),
        newProfileInput: document.getElementById('new-profile-name'),
        // voiceSelect REMOVIDO
        welcomeMessage: document.getElementById('welcome-message'),
        instruction: document.getElementById('instruction'),
        options: document.getElementById('options-container'),
        feedback: document.getElementById('feedback'),
        stat1: document.getElementById('stat-1'),
        stat2: document.getElementById('stat-2'),
        stat3: document.getElementById('stat-3'),
        progressBar: document.getElementById('progress-bar-fill'),
        memoryGame: document.getElementById('memory-game-container'),
        memoryGrid: document.getElementById('memory-grid'),
        passportGrid: document.getElementById('passport-grid'),
        passportCount: document.getElementById('passport-count'),
        passportGold: document.getElementById('passport-gold'),
        achievementText: document.getElementById('achievement-text'),
        levelButtonsContainer: document.getElementById('level-buttons-container'),
        albumGrid: document.getElementById('album-grid'),
        albumProgress: document.getElementById('album-progress'),
        packsCount: document.getElementById('packs-count'),
        packAnimationContainer: document.getElementById('pack-animation-container'),
        openedStickers: document.getElementById('opened-stickers'),
        // Multiplayer Elements
        hostRoomCode: document.getElementById('host-room-code'),
        hostPlayerCount: document.getElementById('host-player-count'),
        hostPlayersList: document.getElementById('host-players-list'),
        joinRoomCode: document.getElementById('join-room-code'),
        joinPlayerName: document.getElementById('join-player-name'),
        joinErrorMsg: document.getElementById('join-error-msg'),
        partyHostInstruction: document.getElementById('party-host-instruction'),
        partyHostOptions: document.getElementById('party-host-options'),
        partyHostLeaderboard: document.getElementById('party-host-leaderboard'),
        partyHostTimer: document.getElementById('party-host-timer'),
        partyHostRound: document.getElementById('party-host-round'),
        partyClientInstruction: document.getElementById('party-client-instruction'),
        partyClientOptions: document.getElementById('party-client-options'),
        partyClientFeedback: document.getElementById('party-client-feedback'),
        partyFinalPodium: document.getElementById('party-final-podium'),
        // Album Pagination
        albumPrevPage: document.getElementById('album-prev-page'),
        albumNextPage: document.getElementById('album-next-page'),
        albumPageInfo: document.getElementById('album-page-info')
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
        showAlbum: document.getElementById('show-album-button'),
        openPack: document.getElementById('open-pack-btn'),
        closePack: document.getElementById('close-pack-button'),
        levelBack: document.getElementById('level-back-btn'),
        // Multiplayer Buttons
        btnHostParty: document.getElementById('btn-host-party'),
        btnJoinParty: document.getElementById('btn-join-party'),
         calmModeToggle: document.getElementById('calm-mode-toggle'),
        closeConstructive: document.getElementById('close-constructive-button'),
        startPartyBtn: document.getElementById('start-party-btn'),
        joinRoomBtn: document.getElementById('join-room-btn'),
        partyHostPlayAgain: document.getElementById('party-host-play-again'),
        partyHostBackMenu: document.getElementById('party-host-back-menu'),
        partyHostLevelSelect: document.getElementById('party-host-level-select')
    };

    // chaves antigas -> novas (SFX). playSound() abaixo faz a ponte.
    const SOUND_ALIAS = {
        win: 'correct', wrong: 'wrong', levelUp: 'levelup',
        completed: 'victory', match: 'card_match',
    };

    // --- ESTADO ---
    let currentUser = localStorage.getItem("currentUser") || null;
    let gameConfig = {};
    let currentRound = 0;
    let lastCorrectFlag = null;
    let roundStartAt = 0;
    let lastAudioPath = null;

    // --- TOAST NOTIFICATIONS ---
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (message.toLowerCase().includes('pacotinho')) icon = '🎁';

        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('toast-leave');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    }

    let gameState = {};
    let correctAnswer = null;
    let gameLocked = false;
    let selectedVoice = null;
     let calmMode = localStorage.getItem('detetive_calm_mode') === 'true';
     if (window.SFX) { window.SFX.calm = calmMode; window.SFX.preload(); }

    // Variáveis da Memória
    let memoryCards = [];
    let hasFlippedCard = false;
    let lockBoard = false;
    let firstCard, secondCard;
    let memoryMatches = 0;
    let memoryMoves = 0;

    // --- PERFIL / SESSÃO ---

    async function selectProfile(name, avatar) {
        currentUser = name;
        localStorage.setItem('currentUser', name);
        if (avatar) localStorage.setItem('detetive_avatar', avatar);

        // Load progress from API into cache
        try {
            _cache.progress = await API.getProgress(name);
        } catch(e) {
            console.warn('Erro ao carregar progress:', e);
            _cache.progress = {};
        }

        // Load stickers (para o contador do hub e o álbum)
        try {
            _cache.stickers = await API.getStickers(name);
        } catch(e) { _cache.stickers = []; }

        // Load journey level
        try {
            const journeyData = await API.getJourney(name);
            _cache.journeyLevel = journeyData.level;
        } catch(e) { _cache.journeyLevel = 1; }

        // Load packs — 3 pacotes grátis por "dia" (dia vira às 06:00)
        try {
            const packsData = await API.getPacks(name);
            const today = packDayKey();
            let count = packsData.count;
            if (packsData.last_daily_at !== today) {
                count += DAILY_FREE_PACKS;
                await API.savePacks(name, count, today);
                registerLoginStreak(name);
                setTimeout(() => showToast(`Você ganhou ${DAILY_FREE_PACKS} pacotes de hoje! 🎁 Abra no Álbum.`, 'success'), 800);
            }
            _cache.packsCount = count;
        } catch(e) {
            console.warn('Erro ao carregar packs:', e);
            _cache.packsCount = 0;
        }

        _cache.dailyProgress = loadDailyProgress(name);
        showScreen('main');
    }

    // --- ECONOMIA DE PACOTES ---
    const DAILY_FREE_PACKS = 3;
    const PACK_STICKERS = 3;

    // "dia do pacote": vira às 06:00. Antes das 6h ainda conta como o dia anterior.
    function packDayKey(d) {
        d = d ? new Date(d) : new Date();
        if (d.getHours() < 6) d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
    }

    function loadDailyProgress(name) {
        const raw = Store._get(`dg_daily_${name}`, null);
        if (!raw || raw.day !== packDayKey()) {
            return { day: packDayKey(), acertos: 0, bonus: {}, masteredToday: 0 };
        }
        return raw;
    }
    function saveDailyProgress() {
        if (currentUser && _cache.dailyProgress) {
            Store._set(`dg_daily_${currentUser}`, _cache.dailyProgress);
        }
    }

    // concede um pacote-bônus uma única vez por dia (id) — devolve true se concedeu
    function grantBonusPack(id, qty, msg) {
        const dp = _cache.dailyProgress || (_cache.dailyProgress = loadDailyProgress(currentUser));
        if (dp.day !== packDayKey()) { _cache.dailyProgress = loadDailyProgress(currentUser); }
        if (_cache.dailyProgress.bonus[id]) return false;
        _cache.dailyProgress.bonus[id] = 1;
        saveDailyProgress();
        addPacks(qty || 1);
        if (msg) showToast(`${msg} +${qty || 1} pacote${(qty || 1) > 1 ? 's' : ''} 🎁`, 'success');
        return true;
    }

    // streak de login: 7º dia +3, 8º em diante +1/dia, zera se faltar
    function registerLoginStreak(name) {
        const key = `dg_streak_${name}`;
        const s = Store._get(key, { last: null, count: 0 });
        const today = packDayKey();
        if (s.last === today) return;
        const yesterday = packDayKey(Date.now() - 24 * 3600 * 1000);
        s.count = (s.last === yesterday) ? s.count + 1 : 1;
        s.last = today;
        Store._set(key, s);
        _cache.loginStreak = s.count;
        if (s.count === 7) setTimeout(() => grantBonusPack('streak7', 3, `7 dias seguidos! 🔥`), 1400);
        else if (s.count > 7) setTimeout(() => grantBonusPack('streak' + s.count, 1, `${s.count} dias seguidos! 🔥`), 1400);
    }

    // Narração por voz sintética (TTS) removida a pedido — usamos só os
    // áudios gravados e os efeitos sonoros.
    function loadVoices() {}
    function speakText() {}

    // --- PROGRESSO ---
    function loadPlayerProgress() { 
        return _cache.progress || {}; 
    }
    function savePlayerProgress(p) {
        _cache.progress = p;
        if (currentUser) {
            API.saveProgress(currentUser, p).catch(console.warn);
        }
    }

    function updateCountryStats(code, isCorrect, responseMs) {
        const p = loadPlayerProgress();
        if (!p[code]) p[code] = { acertos: 0, erros: 0, streak: 0 };
        const s = p[code];
        const masteryBefore = s.mastery || 0;
        if (isCorrect) { s.acertos++; s.streak = (s.streak || 0) + 1; }
        else { s.erros++; s.streak = 0; }
        s.lastSeen = Date.now();

        if (responseMs && responseMs > 0 && responseMs < 60000) {
            s.hist = (s.hist || []).concat([{ t: Date.now(), ok: !!isCorrect, ms: Math.round(responseMs) }]).slice(-20);
            const oks = s.hist.filter(h => h.ok).map(h => h.ms);
            if (oks.length) s.avgMs = Math.round(oks.reduce((a, b) => a + b, 0) / oks.length);
        }

        // mastery 0-100: mistura precisão histórica com sequência atual
        const total = s.acertos + s.erros;
        const acc = total ? s.acertos / total : 0;
        s.mastery = Math.round(Math.max(0, Math.min(100, acc * 55 + Math.min(s.streak || 0, 6) / 6 * 45)));

        savePlayerProgress(p);
        if (isCorrect) trackDailyCorrect(masteryBefore < 85 && s.mastery >= 85);
        checkAchievements();
    }

    // metas diárias -> pacotes bônus
    function trackDailyCorrect(newlyMastered) {
        if (!currentUser) return;
        const dp = _cache.dailyProgress || (_cache.dailyProgress = loadDailyProgress(currentUser));
        if (dp.day !== packDayKey()) { _cache.dailyProgress = loadDailyProgress(currentUser); }
        const d = _cache.dailyProgress;
        d.acertos = (d.acertos || 0) + 1;
        if (newlyMastered) d.masteredToday = (d.masteredToday || 0) + 1;
        saveDailyProgress();

        if (d.acertos === 10) grantBonusPack('acertos10', 1, '10 acertos hoje!');
        if (d.acertos === 25) grantBonusPack('acertos25', 1, '25 acertos hoje!');
        if (newlyMastered && d.masteredToday <= 3) {
            grantBonusPack('mastered' + d.masteredToday, 1, 'Dominou uma bandeira nova!');
        }
    }

    function getWeightedCountry(pool) {
        const p = loadPlayerProgress(); let wList = [];
        pool.forEach(c => {
            const s = p[c.codigo] || { acertos: 0, erros: 0 };
            let w = 1;
            if (s.erros > s.acertos) w = 5; else if (s.erros > 0) w = 3;
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
        'NomePorBandeira': {
            title: "De que País é?",
            setup: () => {
                elements.memoryGame.classList.add('hidden');
                const pool = gameState.availableCountries;
                if (pool.length === 0) { handleLevelComplete(); return; }
                correctAnswer = (gameConfig.type === 'Jornada') ? getWeightedCountry(pool) : shuffle([...pool])[0];

                elements.instruction.textContent = 'De qual país é esta bandeira?';
                const media = document.getElementById('question-media');
                if (media) {
                    media.innerHTML = `<img src="assets/flags/${correctAnswer.codigo}.png" alt="bandeira">`;
                    media.classList.remove('hidden');
                }

                let wrong = countries.filter(c => c.codigo !== correctAnswer.codigo);
                let hard = wrong.filter(c => c.continente === correctAnswer.continente);
                let opts = [correctAnswer, ...shuffle(hard.length >= 3 ? hard : wrong).slice(0, 3)];
                displayNameOptions(shuffle(opts));
            }
        },
        'Memoria': {
            title: "Jogo da Memória",
            setup: () => setupMemoryGame()
        }
    };

    function setupStandardRound(cb, type) { prepareStandardLogic(cb, type, false); }

    function prepareStandardLogic(cb, type, random) {
        elements.memoryGame.classList.add('hidden');
        let pool = gameState.availableCountries;
        if (pool.length === 0) { handleLevelComplete(); return; }

        correctAnswer = (gameConfig.type === 'Jornada' && !random) ? getWeightedCountry(pool) : shuffle([...pool])[0];
        let wrong = countries.filter(c => c.codigo !== correctAnswer.codigo);
        let hard = wrong.filter(c => c.continente === correctAnswer.continente);
        let opts = [correctAnswer, ...shuffle(hard.length >= 3 ? hard : wrong).slice(0, 3)];

        cb(correctAnswer); displayFlagOptions(shuffle(opts), false);
    }

    // --- FLUXO PRINCIPAL ---
    function startGame(conf) {
        gameConfig = conf;
        showScreen('game');
        screens.game.classList.remove('game-over-view');
        elements.options.classList.remove('hidden');
        buttons.backToMenu.textContent = 'Sair';
        buttons.playAgain.classList.add('hidden');
        elements.feedback.textContent = '';
        elements.feedback.className = 'feedback';

        // MODO MEMÓRIA
        if (gameConfig.mode === 'Memoria') {
            elements.mainContainer.classList.add('memory-mode');
            let possibleCountries = [];
            let gridSize = 16;

            // Níveis
            if (conf.level === 1) { possibleCountries = countries.filter(c => c.nivel === 1); gridSize = 12; }
            else if (conf.level === 2) { possibleCountries = countries.filter(c => c.nivel <= 2); gridSize = 16; }
            else if (conf.level === 3) { possibleCountries = countries.filter(c => c.nivel <= 3); gridSize = 20; }
            else if (conf.level === 4) { possibleCountries = countries.filter(c => c.nivel <= 4); gridSize = 24; }
            else { possibleCountries = [...countries]; gridSize = 32; }

            if (possibleCountries.length < gridSize / 2) possibleCountries = [...countries];

            gameState = {
                score: 0, streak: 0, chances: '♾️',
                currentLevel: conf.level,
                availableCountries: shuffle(possibleCountries).slice(0, gridSize / 2),
                totalQuestionsInLevel: gridSize / 2,
                pairsFound: 0
            };
            memoryMoves = 0;

            // MODO QUIZ
        } else {
            elements.mainContainer.classList.remove('memory-mode');
            let sl = 1;
            if (gameConfig.type === 'Jornada') sl = (_cache.journeyLevel || 1);
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

        buttons.facts.classList.add('hidden'); buttons.next.classList.add('hidden');
        elements.feedback.textContent = '';
        elements.feedback.className = 'feedback';
        gameLocked = false; gameState.attemptsThisRound = 0;
        roundStartAt = Date.now();

        const replay = document.getElementById('replay-audio-btn');
        if (replay) replay.hidden = (gameConfig.mode === 'Memoria' || gameConfig.mode === 'NomePorBandeira');
        const media = document.getElementById('question-media');
        if (media && gameConfig.mode !== 'NomePorBandeira') { media.classList.add('hidden'); media.innerHTML = ''; }

        gameModes[gameConfig.mode].setup();
    }

    // Clique Opção
    function handleOptionClick(e) {
        if (gameLocked) return;
        const el = e.target.closest('.flag-option') || e.target.closest('.text-option');
        if (!el) return;

        const type = el.dataset.type;
        let isCor;
        if (type === 'flag') isCor = el.dataset.codigo === correctAnswer.codigo;
        else if (gameConfig.mode === 'ContinentePorPais') isCor = el.dataset.continente === correctAnswer.continente;
        else isCor = el.dataset.codigo === correctAnswer.codigo; // NomePorBandeira
        const val = el.dataset.codigo || el.dataset.continente;
        const responseMs = roundStartAt ? Date.now() - roundStartAt : null;

        // registra a resposta para o país da rodada (algoritmo de aprendizado)
        if (correctAnswer && correctAnswer.codigo) updateCountryStats(correctAnswer.codigo, isCor, responseMs);

        if (isCor) {
            playSound('win');
            gameLocked = true; gameState.streak++;
            if (gameState.streak === 5 || gameState.streak === 10 || gameState.streak === 20) {
                if (window.SFX) window.SFX.play('streak');
            }
            if (gameState.streak === 15) grantBonusPack('streak15', 1, 'Sequência de 15!');
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
            playSound('wrong'); el.classList.add('wrong', 'disabled'); gameState.streak = 0;
            if (gameConfig.lives !== 'infinite') gameState.chances--;
            gameState.attemptsThisRound++;

            if (type === 'flag') {
                const c = countries.find(x => x.codigo === val);
                document.getElementById('constructive-img-wrong').src = `assets/flags/${val}.png`;
                document.getElementById('constructive-name-wrong').textContent = c ? c.nome : 'Desconhecido';
                
                document.getElementById('constructive-img-right').src = `assets/flags/${correctAnswer.codigo}.png`;
                document.getElementById('constructive-name-right').textContent = correctAnswer.nome;
                
                document.getElementById('constructive-feedback-modal').classList.remove('hidden');
                elements.feedback.textContent = `Atenção à diferença!`;
            } else if (gameConfig.mode === 'ContinentePorPais') {
                elements.feedback.textContent = `Ops! Era ${correctAnswer.continente}.`;
            } else {
                elements.feedback.textContent = `Ops! Era ${correctAnswer.artigo} ${correctAnswer.nome}.`;
                document.querySelectorAll('.text-option').forEach(o => {
                    o.classList.add('disabled');
                    if (o.dataset.codigo === correctAnswer.codigo) o.classList.add('correct');
                });
                buttons.next.classList.remove('hidden');
                gameLocked = true;
            }
            elements.feedback.style.color = '#FF6347';

            if (gameState.chances === 0 && gameConfig.lives !== 'infinite') setTimeout(() => gameOver(false), 1000);
            updateStats();
        }
    }

    // --- MEMÓRIA (Setup) ---
    function memoryColumns(totalCards) {
        // [colunas no celular, colunas no desktop]
        const map = { 12: [3, 4], 16: [4, 4], 18: [3, 6], 20: [4, 5], 24: [4, 6], 30: [5, 6], 32: [4, 8] };
        const [mCols, dCols] = map[totalCards] || [4, Math.min(8, Math.ceil(totalCards / 4))];
        return window.matchMedia('(min-width: 768px)').matches ? dCols : mCols;
    }

    function setupMemoryGame() {
        elements.options.classList.add('hidden');
        elements.instruction.textContent = 'Encontre os pares: bandeira + nome do país';
        elements.memoryGame.classList.remove('hidden');
        elements.memoryGrid.innerHTML = '';
        buttons.next.classList.add('hidden');

        const totalCards = gameState.totalQuestionsInLevel * 2;
        elements.memoryGrid.className = 'memory-grid';
        elements.memoryGrid.style.setProperty('--mem-cols', memoryColumns(totalCards));

        let sel = gameState.availableCountries;
        if (sel.length === 0) { handleLevelComplete(); return; }

        memoryCards = [];
        sel.forEach(c => {
            memoryCards.push({ id: c.codigo, type: 'flag', content: `assets/flags/${c.codigo}.png`, country: c });
            memoryCards.push({ id: c.codigo, type: 'name', content: c.nome, country: c });
        });
        memoryCards = shuffle(memoryCards); memoryMatches = 0;

        memoryCards.forEach((c, i) => {
            const el = document.createElement('div'); el.className = 'memory-card';
            el.dataset.index = i; el.dataset.id = c.id;
            el.innerHTML = `
                <div class="memory-card-inner">
                    <div class="memory-card-front">🌍</div>
                    <div class="memory-card-back memory-card-back--${c.type}">
                        ${c.type === 'flag' ? `<img src="${c.content}" alt="">` : `<div class="memory-text">${c.content}</div>`}
                    </div>
                </div>
            `;
            el.addEventListener('click', flipCard); elements.memoryGrid.appendChild(el);
        });
    }

    function flipCard() {
        if (lockBoard || this === firstCard) return;
        this.classList.add('flipped');
        if (window.SFX) window.SFX.play('card_flip');

        // ÁUDIO AO ABRIR NOME
        const cardIndex = this.dataset.index;
        const cardInfo = memoryCards[cardIndex];

        if (cardInfo && cardInfo.type === 'name') {
            playAudio(`nomes_paises/${cardInfo.country.nome}`);
        }

        if (!hasFlippedCard) { hasFlippedCard = true; firstCard = this; return; }

        secondCard = this; memoryMoves++; updateStats(); checkForMatch();
    }

    function checkForMatch() {
        if (firstCard.dataset.id === secondCard.dataset.id) {
            const matchedId = firstCard.dataset.id; // guarda antes de resetBoard() zerar firstCard
            lockBoard = true;

            // Delay para ver o par formado antes de esmaecer
            setTimeout(() => {
                disableCards();
                playSound('match');

                if (!calmMode) {
                    confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
                }

                gameState.score += 100; memoryMatches++; gameState.pairsFound = memoryMatches;
                updateStats();
                updateCountryStats(matchedId, true);

                if (memoryMatches === memoryCards.length / 2) setTimeout(handleLevelComplete, 1000);
            }, 800);

        } else {
            if (gameState.score > 0) gameState.score -= 10;
            updateStats(); unflipCards();
        }
    }

    function disableCards() { firstCard.classList.add('matched'); secondCard.classList.add('matched'); resetBoard(); }
    function unflipCards() { lockBoard = true; setTimeout(() => { firstCard.classList.remove('flipped'); secondCard.classList.remove('flipped'); resetBoard(); }, 1500); }
    function resetBoard() { [hasFlippedCard, lockBoard] = [false, false];[firstCard, secondCard] = [null, null]; }

    // --- UTILS ---
    function handleLevelComplete() {
        updateProgressBar(100); playSound('completed'); dispararConfetes();
        if (gameConfig.mode === 'Memoria') grantBonusPack('memoria', 1, 'Tabuleiro da Memória completo!');
        else if (gameConfig.type === 'Jornada') grantBonusPack('jornada', 1, 'Nível da Jornada completo!');
        if (gameConfig.type === 'Jornada') {
            gameState.currentLevel++; (_cache.journeyLevel = gameState.currentLevel, API.saveJourney(currentUser, gameState.currentLevel));
            if (gameState.currentLevel > 5) gameOver(true);
            else {
                modals.levelUp.querySelector('p').textContent = `Nível ${gameState.currentLevel - 1} Completo!`;
                modals.levelUp.classList.remove('hidden');
            }
        } else gameOver(true);
    }

    function gameOver(win) {
        gameLocked = true; buttons.next.classList.add('hidden'); buttons.facts.classList.add('hidden');
        buttons.backToMenu.textContent = 'Sair';
        buttons.playAgain.classList.remove('hidden');
        elements.options.classList.add('hidden');
        elements.memoryGame.classList.add('hidden');
        screens.game.classList.add('game-over-view');
        const replay = document.getElementById('replay-audio-btn');
        if (replay) replay.hidden = true;

        elements.instruction.textContent = win ? 'Missão Cumprida!' : 'Fim de Jogo';
        elements.feedback.textContent = win ? `Pontuação Final: ${gameState.score}` : `Tente de novo! Pontos: ${gameState.score}`;
        elements.feedback.style.color = win ? '#32CD32' : '#DC143C';

        speakText(win ? `Incrível ${currentUser}! Você venceu.` : `Bom jogo ${currentUser}. Tente novamente.`);
        saveGlobalScore(gameState.score);
    }

    function showScreen(key) {
        Object.values(screens).forEach(s => s.classList.add('hidden'));
        screens[key].classList.remove('hidden');
        updateAppNav(key);
        if (key === 'main') refreshHub();
        if (key === 'album' && typeof renderAlbum === 'function') renderAlbum();
        if (showScreen._ready && window.SFX) window.SFX.play('whoosh');
        showScreen._ready = true;
        try { elements.mainContainer.scrollTop = 0; window.scrollTo(0, 0); } catch (e) {}
    }

    // --- BARRA DE NAVEGAÇÃO PERSISTENTE ---
    const NAV_KEY_FOR_SCREEN = { main: 'jogar', album: 'album', passport: 'passport' };
    function updateAppNav(key) {
        const nav = document.getElementById('app-nav');
        if (!nav) return;
        const show = key === 'main' || key === 'album' || key === 'passport';
        nav.classList.toggle('hidden', !show);
        document.body.classList.toggle('has-nav', show);
        const active = NAV_KEY_FOR_SCREEN[key];
        nav.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.nav === active));
    }
    document.querySelectorAll('#app-nav .nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const dest = item.dataset.nav;
            if (dest === 'jogar') showScreen('main');
            else if (dest === 'album') openAlbum();
            else if (dest === 'passport') openPassport();
            else if (dest === 'ranking') openRanking();
        });
    });

    // --- CABEÇALHO DO HUB (avatar, saudação, mini-estatísticas) ---
    function refreshHub() {
        const nameEl = document.getElementById('welcome-message');
        if (nameEl) nameEl.textContent = currentUser || 'explorador';
        const avEl = document.getElementById('hub-avatar');
        if (avEl) avEl.textContent = Auth.avatarOf(currentUser) || localStorage.getItem('detetive_avatar') || '🌍';

        const p = (_cache.progress && typeof _cache.progress === 'object') ? _cache.progress : {};
        let known = 0, mastered = 0;
        Object.values(p).forEach(s => {
            if (!s) return;
            if ((s.acertos || 0) > 0) known++;
            if ((s.acertos || 0) >= 5 && (s.erros || 0) < 2) mastered++;
        });
        const stickers = Array.isArray(_cache.stickers) ? _cache.stickers.filter(s => s && s.colada).length : 0;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('hub-stat-known', known);
        set('hub-stat-mastered', mastered);
        set('hub-stat-stickers', stickers);
    }

    function updateStats() {
        if (gameConfig.mode === 'Memoria') {
            const pairsLeft = gameState.totalQuestionsInLevel - (gameState.pairsFound || 0);
            elements.stat1.textContent = `🃏 ${pairsLeft}`;
            elements.stat2.textContent = `🔀 ${memoryMoves}`;
            elements.stat3.textContent = `⭐ ${gameState.score}`;
            updateProgressBar((gameState.pairsFound / gameState.totalQuestionsInLevel) * 100);
        } else {
            elements.stat1.textContent = `⭐ ${gameState.score}`;
            elements.stat2.textContent = `🔥 ${gameState.streak}`;
            elements.stat3.textContent = gameConfig.lives === 'infinite' ? `❤️ ∞` : `❤️ ${gameState.chances}`;
            let cur = gameState.totalQuestionsInLevel - gameState.availableCountries.length;
            let tot = gameState.totalQuestionsInLevel || 1;
            updateProgressBar((cur / tot) * 100);
        }
    }

    function updateProgressBar(p) { if (p > 100) p = 100; elements.progressBar.style.width = `${p}%`; }

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
            const b = document.createElement('button'); 
            b.className = 'text-option';
            
            if (gameConfig.mode === 'ContinentePorPais' && continentSVGs[t]) {
                b.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                    ${continentSVGs[t]}
                    <span>${t}</span>
                </div>`;
            } else {
                b.textContent = t;
            }
            
            b.dataset.continente = t;
            b.dataset.type = 'text';
            b.addEventListener('click', handleOptionClick);
            elements.options.appendChild(b);
        });
    }

    // opções de NOME de país (modo "De que país é?")
    function displayNameOptions(opts) {
        elements.options.classList.remove('hidden');
        elements.options.innerHTML = '';
        opts.forEach(c => {
            const b = document.createElement('button');
            b.className = 'text-option';
            b.textContent = c.nome;
            b.dataset.codigo = c.codigo;
            b.dataset.type = 'text';
            b.addEventListener('click', handleOptionClick);
            elements.options.appendChild(b);
        });
    }

    function playAudio(p) {
        lastAudioPath = p;
        const c = p.toLowerCase().replace(/ /g, '_').replace(/\./g, '');
        const a = new Audio(`assets/audio/${c}.mp3`);
        a.play().catch(e => { });
    }

    (function wireReplayAudio() {
        const btn = document.getElementById('replay-audio-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (lastAudioPath) {
                playAudio(lastAudioPath);
                btn.classList.add('playing');
                setTimeout(() => btn.classList.remove('playing'), 600);
            }
        });
    })();

    function playSound(k) {
        if (window.SFX) window.SFX.play(SOUND_ALIAS[k] || k);
    }

    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

    function saveGlobalScore(s) {
        if (!currentUser || !gameConfig.mode || !gameModes[gameConfig.mode]) return;
        API.addRanking(currentUser, s, gameModes[gameConfig.mode].title);
    }

    function checkAchievements() {
        const p = loadPlayerProgress(); 
        const u = JSON.parse(localStorage.getItem(`detetive_achievements_${currentUser}`)) || [];
        
        const achs = [
            { id: '1', t: 'Primeiro Passo', desc: 'Acertou sua primeira bandeira! (+1 Pacote)', packs: 1, c: x => Object.values(x).some(v => v.acertos > 0) },
            { id: '10', t: 'Explorador', desc: 'Acertou 10 bandeiras diferentes! (+1 Pacote)', packs: 1, c: x => Object.values(x).filter(v => v.acertos > 0).length >= 10 },
            { id: '50', t: 'Mochileiro', desc: 'Acertou 50 bandeiras diferentes! (+2 Pacotes)', packs: 2, c: x => Object.values(x).filter(v => v.acertos > 0).length >= 50 },
            { id: 'perfect', t: 'Intocável', desc: 'Fez uma sequência de 20 acertos em um país! (+3 Pacotes)', packs: 3, c: x => Object.values(x).some(v => v.streak >= 20) },
            { id: 'master', t: 'Mestre Geográfico', desc: 'Fez 100 acertos no total! (+5 Pacotes)', packs: 5, c: x => Object.values(x).reduce((acc, curr) => acc + curr.acertos, 0) >= 100 }
        ];

        achs.forEach(a => {
            if (!u.includes(a.id) && a.c(p)) {
                elements.achievementText.innerHTML = `<strong>${a.t}</strong><br><span style="font-size:0.8em; color:#555;">${a.desc}</span>`;
                modals.achievement.classList.remove('hidden');
                if (window.SFX) window.SFX.play('achievement');
                dispararConfetes();
                u.push(a.id);
                localStorage.setItem(`detetive_achievements_${currentUser}`, JSON.stringify(u));
                if (a.packs > 0 && typeof addPacks === 'function') addPacks(a.packs);
            }
        });
    }

    function dispararConfetes() { 
         if (calmMode) {
            confetti({ particleCount: 15, spread: 30, origin: { y: 0.6 }, disableForReducedMotion: true });
        } else {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); 
        }
    }

    // ─── TELA DE LOGIN / CADASTRO ────────────────────────
    const authForm = document.getElementById('auth-form');
    const authUser = document.getElementById('auth-username');
    const authPass = document.getElementById('auth-password');
    const authErr = document.getElementById('auth-error');
    const authSubmit = document.getElementById('auth-submit');
    const authTabs = Array.from(document.querySelectorAll('.auth-tab'));
    let authMode = 'login';

    function showAuthError(msg) { if (authErr) { authErr.textContent = msg; authErr.classList.remove('hidden'); } }
    function hideAuthError() { if (authErr) authErr.classList.add('hidden'); }

    function setAuthMode(mode) {
        authMode = mode;
        authTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === mode));
        document.querySelectorAll('[data-signup]').forEach(el => el.classList.toggle('hidden', mode !== 'signup'));
        if (authSubmit) authSubmit.textContent = mode === 'signup' ? 'Criar conta e entrar' : 'Entrar';
        if (authPass) authPass.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
        hideAuthError();
    }

    function renderAuthAccounts() {
        const wrap = document.getElementById('auth-accounts');
        if (!wrap) return;
        const accts = Auth.list();
        if (!accts.length) { wrap.innerHTML = ''; wrap.classList.add('hidden'); return; }
        wrap.classList.remove('hidden');
        wrap.innerHTML = '<p class="auth-accounts-label">Contas neste aparelho</p>';
        const row = document.createElement('div');
        row.className = 'auth-accounts-row';
        accts.forEach(a => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'auth-account-chip';
            chip.innerHTML = `<span class="aa-avatar">${a.avatar}</span><span class="aa-name"></span><span class="aa-remove" title="Remover deste aparelho">✕</span>`;
            chip.querySelector('.aa-name').textContent = a.name;
            chip.addEventListener('click', (e) => {
                if (e.target.classList.contains('aa-remove')) {
                    if (confirm(`Remover "${a.name}" deste aparelho? O progresso salvo aqui será apagado.`)) {
                        Auth.removeAccount(a.name);
                        API.deleteProfile(a.name);
                        renderAuthAccounts();
                    }
                    return;
                }
                setAuthMode('login');
                authUser.value = a.name;
                authPass.value = '';
                authPass.focus();
            });
            row.appendChild(chip);
        });
        wrap.appendChild(row);
    }

    authTabs.forEach(t => t.addEventListener('click', () => setAuthMode(t.dataset.tab)));

    if (authForm) authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthError();
        const name = authUser.value.trim();
        const pass = authPass.value;
        if (!name || !pass) return showAuthError('Preencha usuário e senha.');
        authSubmit.disabled = true;
        authSubmit.textContent = 'Aguarde…';
        const avatar = (document.getElementById('selected-avatar') || {}).value || '🌍';
        const res = authMode === 'signup'
            ? await Auth.signup(name, pass, avatar)
            : await Auth.login(name, pass);
        authSubmit.disabled = false;
        setAuthMode(authMode);
        if (res.error) return showAuthError(res.error);
        authPass.value = '';
        localStorage.setItem('detetive_avatar', res.avatar);
        _cache.progress = null;
        _cache.stickers = null;
        _cache.packsCount = null;
        await selectProfile(res.name, res.avatar);
    });

    // Botão de som (liga/desliga, acesso fácil no hub)
    (function wireSoundToggle() {
        const btn = document.getElementById('sound-toggle');
        if (!btn) return;
        const paint = () => { btn.textContent = (window.SFX && window.SFX.enabled) ? '🔊' : '🔇'; btn.classList.toggle('muted', !(window.SFX && window.SFX.enabled)); };
        paint();
        btn.addEventListener('click', () => {
            if (!window.SFX) return;
            window.SFX.enabled = !window.SFX.enabled;
            paint();
            if (window.SFX.enabled) window.SFX.play('toggle');
        });
    })();

    // Botão "Sair" (no menu principal) → volta para o login
    buttons.changeProfile.addEventListener('click', () => {
        Auth.logout();
        currentUser = null;
        _cache.progress = null;
        _cache.stickers = null;
        _cache.packsCount = null;
        if (authPass) authPass.value = '';
        setAuthMode('login');
        renderAuthAccounts();
        showScreen('profile');
        setTimeout(initAvatarPicker, 50);
    });

    // Event Listeners de VOZ removidos

    if(buttons.backToMenu) buttons.backToMenu.addEventListener('click', () => { elements.mainContainer.classList.remove('memory-mode'); showScreen('main'); });
    
    // --- CONTROLE DE CURIOSIDADES ALEATORIAS SEM REPETICAO & AUDIO ---
    const seenFactsMap = {};
    let currentFactContext = { countryCode: null, factIndex: 0 };
    let factAudioInstance = null;

    function showRandomFactForCountry(countryCode, countryName) {
        countryCode = (countryCode || '').toLowerCase().trim();
        const curDb = (typeof curiosities !== 'undefined') ? curiosities : null;
        if (!curDb || !curDb[countryCode]) {
            document.getElementById('facts-content').textContent = 'Nenhuma curiosidade disponível para este país.';
            return;
        }

        const allFacts = curDb[countryCode];
        if (!seenFactsMap[countryCode]) {
            seenFactsMap[countryCode] = [];
        }

        let unseenIndices = allFacts.map((_, i) => i).filter(i => !seenFactsMap[countryCode].includes(i));
        let justReset = false;

        // Se ja viu todas as curiosidades, recomeca o ciclo
        if (unseenIndices.length === 0) {
            seenFactsMap[countryCode] = [];
            unseenIndices = allFacts.map((_, i) => i);
            justReset = true;
        }

        // Escolhe um indice aleatorio nao visto
        const chosenIndex = unseenIndices[Math.floor(Math.random() * unseenIndices.length)];
        seenFactsMap[countryCode].push(chosenIndex);
        currentFactContext = { countryCode, factIndex: chosenIndex };

        // Atualiza elementos visuais
        const nameEl = document.getElementById('facts-country-name');
        if (nameEl) nameEl.textContent = countryName ? (' (' + countryName + ')') : '';

        const badgeEl = document.getElementById('facts-badge');
        if (badgeEl) {
            badgeEl.textContent = 'Curiosidade ' + seenFactsMap[countryCode].length + ' de ' + allFacts.length + (justReset ? ' • Ciclo reiniciado! 🔄' : '');
            badgeEl.style.backgroundColor = justReset ? '#FEF3C7' : '#eef4fb';
            badgeEl.style.color = justReset ? '#D97706' : '#3b82f6';
        }

        const contentEl = document.getElementById('facts-content');
        if (contentEl) {
            contentEl.textContent = allFacts[chosenIndex];
        }

        // Toca automaticamente a narracao ao abrir/mudar curiosidade
        playCurrentFactAudio();
    }

    function playCurrentFactAudio() {
        if (!currentFactContext.countryCode && currentFactContext.countryCode !== 0) return;
        const iconEl = document.getElementById('facts-audio-icon');
        const textEl = document.getElementById('facts-audio-text');

        if (factAudioInstance && !factAudioInstance.paused) {
            stopFactAudio();
            return;
        }

        stopFactAudio();

        const base = 'assets/audio/curiosidades/' + currentFactContext.countryCode + '_' + currentFactContext.factIndex;
        const pathMp3 = base + '.mp3';
        const pathWav = base + '.wav';

        if (textEl) textEl.textContent = 'Reproduzindo...';
        if (iconEl) iconEl.textContent = '🔊';

        factAudioInstance = new Audio(pathMp3);
        const playPromise = factAudioInstance.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                if (textEl) textEl.textContent = 'Pausar Áudio';
                if (iconEl) iconEl.textContent = '⏸️';
            }).catch(() => {
                factAudioInstance = new Audio(pathWav);
                factAudioInstance.play().then(() => {
                    if (textEl) textEl.textContent = 'Pausar Áudio';
                    if (iconEl) iconEl.textContent = '⏸️';
                }).catch((e) => {
                    console.log('Audio de curiosidade em geracao ou bloqueado:', e);
                    if (textEl) textEl.textContent = 'Ouvir Narradora';
                    if (iconEl) iconEl.textContent = '🔊';
                });
            });
        }

        factAudioInstance.onended = () => {
            stopFactAudio();
        };
    }

    function stopFactAudio() {
        if (factAudioInstance) {
            factAudioInstance.pause();
            factAudioInstance.currentTime = 0;
            factAudioInstance = null;
        }
        const iconEl = document.getElementById('facts-audio-icon');
        const textEl = document.getElementById('facts-audio-text');
        if (textEl) textEl.textContent = 'Ouvir Narradora';
        if (iconEl) iconEl.textContent = '🔊';
    }

    if(buttons.playAgain) buttons.playAgain.addEventListener('click', () => startGame(gameConfig));
    if(buttons.levelUpContinue) buttons.levelUpContinue.addEventListener('click', () => { modals.levelUp.classList.add('hidden'); startGame(gameConfig); });
    if(buttons.next) buttons.next.addEventListener('click', nextRound);
    if(buttons.facts) buttons.facts.addEventListener('click', () => {
    if (correctAnswer && correctAnswer.codigo) {
        showRandomFactForCountry(correctAnswer.codigo, correctAnswer.nome);
    }
    modals.facts.classList.remove('hidden');
  });

  const nextFactBtn = document.getElementById('next-fact-btn');
  if (nextFactBtn) {
    if(nextFactBtn) nextFactBtn.addEventListener('click', () => {
        if (currentFactContext.countryCode) {
            showRandomFactForCountry(currentFactContext.countryCode, correctAnswer ? correctAnswer.nome : '');
        }
    });
  }

  const playFactAudioBtn = document.getElementById('play-facts-audio-btn');
  if (playFactAudioBtn) {
    playFactAudioBtn.addEventListener('click', playCurrentFactAudio);
  }
    buttons.closeFacts.addEventListener('click', () => { stopFactAudio(); modals.facts.classList.add('hidden'); });
    buttons.closeAchievement.addEventListener('click', () => modals.achievement.classList.add('hidden'));
    buttons.closeRanking.addEventListener('click', () => modals.ranking.classList.add('hidden'));

    // Passaporte e Ranking
    function renderRanking(filter) {
        let l = JSON.parse(localStorage.getItem('ranking_global')) || [];
        if (filter && filter !== 'Todos') {
            l = l.filter(r => r.mode === filter);
        }
        const c = document.getElementById('ranking-list'); c.innerHTML = '';
        if (l.length === 0) {
            c.innerHTML = '<p style="color:#777; text-align:center;">Nenhum detetive nesta categoria ainda!</p>';
        } else {
            l.forEach((r, i) => c.innerHTML += `<p><strong>${i + 1}. ${r.nome}</strong>: <span style="color:#32CD32; font-weight:bold;">${r.score}</span> <small style="color:#777;">(${r.mode || 'Geral'})</small></p>`);
        }
    }

    function openRanking() {
        document.getElementById('ranking-filter').value = 'Todos';
        renderRanking('Todos');
        modals.ranking.classList.remove('hidden');
    }
    if (buttons.showRanking) buttons.showRanking.addEventListener('click', openRanking);

    document.getElementById('ranking-filter').addEventListener('change', (e) => {
        renderRanking(e.target.value);
    });

    async function openPassport() {
        if (!_cache.progress && currentUser) {
            _cache.progress = await API.getProgress(currentUser);
        }
        const p = loadPlayerProgress();
        const g = elements.passportGrid;
        g.innerHTML = '';
        let u = 0, go = 0;
        countries.forEach(c => {
            const s = p[c.codigo] || { acertos: 0 };
            if (s.acertos > 0) { u++; if (s.acertos >= 5 && s.erros < 2) go++; }
            const i = document.createElement('div');
            i.className = 'passport-item';
            if (s.acertos > 0) { i.classList.add('unlocked'); if (s.acertos >= 5 && s.erros < 2) i.classList.add('gold'); }
            i.innerHTML = `<img src="assets/flags/${c.codigo}.png" alt="${c.nome}" loading="lazy">`;
            g.appendChild(i);
        });
        elements.passportCount.textContent = u;
        elements.passportGold.textContent = go;
        showScreen('passport');
    }
    if (buttons.showPassport) buttons.showPassport.addEventListener('click', openPassport);

    // ═══════════════════════════════════════════════════════
    // ÁLBUM DE FIGURINHAS  (modelo: colada + pilha)
    // ═══════════════════════════════════════════════════════
    const RARITY_ORDER = ['base', 'roxa', 'bronze', 'prata', 'ouro'];
    const RARITY_LABELS = {
        ouro: { text: 'LENDA DOURADA ✨' }, prata: { text: 'LENDA PRATA 🥈' },
        bronze: { text: 'LENDA BRONZE 🥉' }, roxa: { text: 'LENDA ROXA 💜' },
        base: { text: 'NOVA! 🌍' },
    };

    function loadStickers() {
        return Array.isArray(_cache.stickers) ? _cache.stickers : [];
    }
    function saveStickers(s) {
        _cache.stickers = s;
        if (currentUser) API.saveStickers(currentUser, s);
    }
    // converte formato antigo {codigo,rarity,count} para {codigo,colada,pilha}
    function migrateStickers() {
        const s = loadStickers();
        let changed = false;
        s.forEach(x => {
            if (Array.isArray(x.pilha) && ('colada' in x)) return;
            const count = Math.max(1, x.count || 1);
            x.colada = x.rarity || 'base';
            x.pilha = Array(count - 1).fill('base');
            delete x.rarity; delete x.count;
            changed = true;
        });
        if (changed) saveStickers(s);
    }

    function stickerEntry(code, create) {
        const s = loadStickers();
        let e = s.find(x => x.codigo === code);
        if (!e && create) { e = { codigo: code, colada: null, pilha: [] }; s.push(e); saveStickers(s); }
        return e;
    }
    function isColada(code) { const e = stickerEntry(code); return !!(e && e.colada); }
    function coladaRarity(code) { const e = stickerEntry(code); return e ? e.colada : null; }
    function pilhaOf(code) { const e = stickerEntry(code); return (e && e.pilha) || []; }
    function bestPilha(code) {
        return pilhaOf(code).reduce((b, r) =>
            RARITY_ORDER.indexOf(r) > RARITY_ORDER.indexOf(b) ? r : b, null);
    }
    function totalPilha() { return loadStickers().reduce((n, s) => n + (s.pilha || []).length, 0); }

    // cola uma cópia (raridade `rar`, ou a melhor da pilha) no álbum
    function glueSticker(code, rar) {
        const e = stickerEntry(code, true);
        rar = rar || bestPilha(code);
        if (!rar) return false;
        const idx = e.pilha.indexOf(rar);
        if (idx < 0) return false;
        e.pilha.splice(idx, 1);
        // se já havia uma colada, ela volta pra pilha (só troca se for melhor)
        if (e.colada && RARITY_ORDER.indexOf(rar) <= RARITY_ORDER.indexOf(e.colada)) {
            e.pilha.push(rar); return false;
        }
        if (e.colada) e.pilha.push(e.colada);
        e.colada = rar;
        saveStickers(loadStickers());
        return true;
    }

    function getPacksCount() {
        if (typeof _cache.packsCount !== 'number') {
            _cache.packsCount = Number(localStorage.getItem(`detetive_packs_${currentUser}`) || 0);
        }
        return _cache.packsCount;
    }
    function savePacks(n) {
        n = Math.max(0, Number(n) || 0);
        _cache.packsCount = n;
        localStorage.setItem(`detetive_packs_${currentUser}`, n);
        document.querySelectorAll('#packs-count').forEach(el => el.textContent = n);
        const btn = document.getElementById('open-pack-btn');
        if (btn) btn.classList.toggle('has-packs', n > 0);
    }
    function addPacks(n) {
        savePacks(getPacksCount() + n);
        if (n > 0 && window.SFX) window.SFX.play('coin');
    }
    function removePack() {
        if (getPacksCount() > 0) { savePacks(getPacksCount() - 1); return true; }
        return false;
    }

    // Legends: dourada 0,20% · prata 0,33% · bronze 0,66% · roxa 1,00%
    function rollRarity() {
        const r = Math.random();
        if (r < 0.0020) return 'ouro';
        if (r < 0.0053) return 'prata';
        if (r < 0.0119) return 'bronze';
        if (r < 0.0219) return 'roxa';
        return 'base';
    }

    // --- CONTINENTES / CÓDIGO DE FIGURINHA ---
    const CONTINENTS_ORDER = [
        'América do Sul', 'América do Norte', 'América Central',
        'Europa', 'Ásia', 'África', 'Oceania'
    ];
    const CONTINENT_META = {
        'América do Sul':   { emoji: '🌎', accent: '#34d399', sigla: 'AMS' },
        'América do Norte': { emoji: '🗽', accent: '#60a5fa', sigla: 'AMN' },
        'América Central':  { emoji: '🏝️', accent: '#c084fc', sigla: 'AMC' },
        'Europa':           { emoji: '🏰', accent: '#818cf8', sigla: 'EUR' },
        'Ásia':             { emoji: '⛩️', accent: '#f87171', sigla: 'ASI' },
        'África':           { emoji: '🦁', accent: '#fbbf24', sigla: 'AFR' },
        'Oceania':          { emoji: '🐨', accent: '#22d3ee', sigla: 'OCE' },
    };
    let currentContinent = null;

    const STICKER_CODE = (() => {
        const map = {};
        CONTINENTS_ORDER.forEach(cont => {
            const sig = (CONTINENT_META[cont] || {}).sigla || 'XXX';
            countries.filter(c => c.continente === cont)
                .forEach((c, i) => { map[c.codigo] = `${sig}-${String(i + 1).padStart(2, '0')}`; });
        });
        return map;
    })();
    function stickerCode(codigo) { return STICKER_CODE[codigo] || '—'; }

    function continentStats(cont) {
        const list = countries.filter(c => c.continente === cont);
        const have = list.filter(c => isColada(c.codigo)).length;
        return { have, total: list.length };
    }

    function buildContinentNav() {
        const nav = document.getElementById('continent-nav');
        if (!nav) return;
        nav.innerHTML = '';
        CONTINENTS_ORDER.forEach(cont => {
            const meta = CONTINENT_META[cont] || { emoji: '🌐', accent: '#94a3b8' };
            const st = continentStats(cont);
            const btn = document.createElement('button');
            btn.className = 'continent-tab' + (cont === currentContinent ? ' active' : '');
            btn.style.setProperty('--tab-accent', meta.accent);
            btn.innerHTML = `<span class="ct-emoji">${meta.emoji}</span><span class="ct-name">${cont}</span><span class="ct-count">${st.have}/${st.total}</span>`;
            btn.addEventListener('click', () => {
                if (currentContinent === cont) return;
                currentContinent = cont;
                animatePageTurn();
                renderAlbum();
            });
            nav.appendChild(btn);
        });
    }

    function animatePageTurn() {
        const g = elements.albumGrid;
        if (!g || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        g.classList.remove('page-turn');
        void g.offsetWidth;
        g.classList.add('page-turn');
        setTimeout(() => g.classList.remove('page-turn'), 550);
        if (window.SFX) window.SFX.play('whoosh');
    }

    function renderAlbum() {
        const grid = elements.albumGrid;
        if (!grid) return;
        if (!currentContinent) currentContinent = CONTINENTS_ORDER[0];
        const meta = CONTINENT_META[currentContinent] || { emoji: '🌐', accent: '#94a3b8', sigla: 'ams' };
        const screen = document.getElementById('album-menu');
        if (screen) {
            screen.style.setProperty('--cont-accent', meta.accent);
            screen.style.setProperty('--cont-bg', `url("/assets/img/bg/${(meta.sigla || 'ams').toLowerCase()}.jpg")`);
        }

        grid.innerHTML = '';
        countries.filter(c => c.continente === currentContinent).forEach(c => {
            const code = stickerCode(c.codigo);
            const colada = coladaRarity(c.codigo);
            const pilha = pilhaOf(c.codigo);
            const item = document.createElement('div');

            if (!colada) {
                const canGlue = pilha.length > 0;
                item.className = 'album-card missing' + (canGlue ? ' has-pilha' : '');
                item.innerHTML = `
                    <div class="ac-frame">
                        <img class="ac-silhouette" src="assets/shapes/${c.codigo}.svg" alt="" loading="lazy"
                             onerror="this.style.display='none'">
                        ${canGlue
                        ? `<button class="ac-plus" data-glue="${c.codigo}" aria-label="Colar">+</button>`
                        : `<span class="ac-num">${code}</span>`}
                    </div>
                    <div class="ac-name">${c.nome}</div>`;
            } else {
                const holo = !!c.fixedShiny || colada === 'ouro' || colada === 'prata' || colada === 'bronze' || colada === 'roxa';
                const better = bestPilha(c.codigo);
                const canUp = better && RARITY_ORDER.indexOf(better) > RARITY_ORDER.indexOf(colada);
                item.className = `album-card collected rarity-${colada}` + (holo ? ' holo' : '');
                const badge = pilha.length ? `<span class="ac-count" title="Na pilha">×${pilha.length}</span>` : '';
                const up = canUp ? `<button class="ac-up" data-glue="${c.codigo}" data-rar="${better}" title="Colar a versão ${better}">⬆</button>` : '';
                item.innerHTML = `
                    <div class="ac-frame">
                        <img src="assets/flags/${c.codigo}.png" alt="${c.nome}" loading="lazy">
                        <span class="ac-shine"></span>
                        <span class="ac-code">${code}</span>
                        ${badge}${up}
                    </div>
                    <div class="ac-name">${c.nome}</div>`;
            }
            item.title = `${code} · ${c.nome}`;
            grid.appendChild(item);
        });

        grid.querySelectorAll('[data-glue]').forEach(b => {
            b.addEventListener('click', e => {
                e.stopPropagation();
                doGlue(b.dataset.glue, b.dataset.rar, b);
            });
        });

        // toque na figurinha colada mostra a sigla por 2s (no desktop ja aparece no hover)
        grid.querySelectorAll('.album-card.collected').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.closest('[data-glue]')) return;
                grid.querySelectorAll('.album-card.show-code').forEach(c => { if (c !== card) c.classList.remove('show-code'); });
                card.classList.toggle('show-code');
                clearTimeout(card._codeT);
                if (card.classList.contains('show-code')) {
                    card._codeT = setTimeout(() => card.classList.remove('show-code'), 2200);
                }
            });
        });

        const st = continentStats(currentContinent);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('album-continent-name', `${meta.emoji} ${currentContinent}`);
        set('album-continent-count', `${st.have}/${st.total}`);

        const totalHave = loadStickers().filter(s => s.colada).length;
        const pct = Math.round((totalHave / countries.length) * 100);
        set('album-progress', `${pct}%`);
        set('album-count', `${totalHave}/${countries.length}`);
        const fill = document.getElementById('album-overall-fill');
        if (fill) fill.style.width = `${pct}%`;

        const reps = totalPilha();
        set('repeats-count', reps);
        const tb = document.getElementById('open-trades-btn');
        if (tb) tb.classList.toggle('has-repeats', reps > 0);

        buildContinentNav();
    }

    // cola com animação (a figurinha "desce" e gruda) + confete + som
    function doGlue(code, rar, btn) {
        const frame = btn.closest('.ac-frame');
        if (glueSticker(code, rar)) {
            if (window.SFX) window.SFX.play('sticker_paste');
            if (!calmMode && typeof confetti !== 'undefined' && frame) {
                const r = frame.getBoundingClientRect();
                confetti({
                    particleCount: 55, spread: 55, startVelocity: 28,
                    origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight },
                });
            }
            renderAlbum();
            const card = elements.albumGrid.querySelector(`[title^="${stickerCode(code)} "]`);
            if (card) { card.classList.add('just-glued'); setTimeout(() => card.classList.remove('just-glued'), 1400); }
            refreshHub();
        }
    }

    async function openAlbum() {
        if (!Array.isArray(_cache.stickers) && currentUser) {
            try { _cache.stickers = await API.getStickers(currentUser); } catch (e) { _cache.stickers = []; }
        }
        migrateStickers();
        if (!currentContinent) currentContinent = CONTINENTS_ORDER[0];
        savePacks(getPacksCount());
        renderAlbum();
        showScreen('album');
    }
    if (buttons.showAlbum) buttons.showAlbum.addEventListener('click', openAlbum);

    // ─── TROCA ENTRE CONTAS ──────────────────────────────
    const ALL_CODES = countries.map(c => c.codigo);
    let tradeOther = null, tradeGive = null, tradeGet = null;

    function openTrades() {
        tradeOther = tradeGive = tradeGet = null;
        document.getElementById('trades-panel').classList.add('hidden');
        renderMachine();
        const wrap = document.getElementById('trades-accounts');
        wrap.innerHTML = '';
        const others = Trades.others(currentUser);
        if (!others.length) {
            wrap.innerHTML = '<p class="trades-empty">Crie outra conta neste aparelho (tela de login) para trocar direto.</p>';
        } else {
            others.forEach(a => {
                const theirRepeats = Trades.repeats(a.name);
                const btn = document.createElement('button');
                btn.className = 'trade-account';
                btn.innerHTML = `<span class="ta-avatar">${a.avatar}</span>
                    <span class="ta-name">${a.name}</span>
                    <span class="ta-meta">${theirRepeats.reduce((n, s) => n + s.count, 0)} na pilha</span>`;
                btn.addEventListener('click', () => selectTradePartner(a.name));
                wrap.appendChild(btn);
            });
        }
        showScreen('trades');
    }

    function stickerChip(codigo, count, selected) {
        const c = countries.find(x => x.codigo === codigo) || { nome: codigo };
        const el = document.createElement('button');
        el.className = 'trade-chip' + (selected ? ' selected' : '');
        el.dataset.codigo = codigo;
        el.innerHTML = `<img src="assets/flags/${codigo}.png" alt=""><span>${c.nome}</span>${count > 1 ? `<b>×${count}</b>` : ''}`;
        return el;
    }

    function selectTradePartner(name) {
        tradeOther = name;
        tradeGive = tradeGet = null;
        document.querySelectorAll('.trade-account').forEach(b =>
            b.classList.toggle('active', b.querySelector('.ta-name').textContent === name));
        document.getElementById('trades-other-name').textContent = name;
        document.getElementById('trades-panel').classList.remove('hidden');
        renderTradeStrips();
    }

    function renderTradeStrips() {
        const theyMiss = new Set(Trades.missingCodes(tradeOther, ALL_CODES));
        const iMiss = new Set(Trades.missingCodes(currentUser, ALL_CODES));

        const fill = (wrapId, list, sel, onPick, emptyMsg) => {
            const w = document.getElementById(wrapId);
            w.innerHTML = '';
            if (!list.length) { w.innerHTML = `<p class="trades-empty">${emptyMsg}</p>`; return; }
            list.forEach(s => {
                const chip = stickerChip(s.codigo, s.count, sel === s.codigo);
                chip.addEventListener('click', () => { onPick(s.codigo); renderTradeStrips(); });
                w.appendChild(chip);
            });
        };
        fill('trades-mine', Trades.repeats(currentUser).filter(s => theyMiss.has(s.codigo)),
            tradeGive, c => tradeGive = c, 'Você não tem repetidas que faltem pra essa conta.');
        fill('trades-theirs', Trades.repeats(tradeOther).filter(s => iMiss.has(s.codigo)),
            tradeGet, c => tradeGet = c, 'Essa conta não tem repetidas que faltem pra você.');

        const btn = document.getElementById('trades-confirm');
        const ready = tradeGive && tradeGet;
        btn.disabled = !ready;
        btn.textContent = ready ? 'Confirmar troca' : 'Escolha uma de cada lado';
    }

    document.getElementById('open-trades-btn').addEventListener('click', openTrades);
    document.getElementById('trades-back').addEventListener('click', () => showScreen('album'));
    document.getElementById('trades-confirm').addEventListener('click', () => {
        if (!tradeGive || !tradeGet || !tradeOther) return;
        const gname = (countries.find(c => c.codigo === tradeGive) || {}).nome;
        const rname = (countries.find(c => c.codigo === tradeGet) || {}).nome;
        const res = Trades.execute(currentUser, tradeOther, tradeGive, tradeGet);
        if (res.error) { showToast(res.error, 'error'); return; }
        _cache.stickers = Trades._read(currentUser);
        if (window.SFX) window.SFX.play('trade');
        grantBonusPack('troca', 1, 'Primeira troca do dia!');
        showToast(`Troca feita! Você deu ${gname} e recebeu ${rname}.`, 'success');
        if (!calmMode && typeof confetti !== 'undefined') confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        tradeGive = tradeGet = null;
        selectTradePartner(tradeOther);
    });

    // ─── MÁQUINA DE TROCA (7 repetidas -> 1 nova) ─────────
    let machineDeposit = []; // [{codigo, rar}]
    const MACHINE_COST = 7;

    function renderMachine() {
        const n = machineDeposit.length;
        const cnt = document.getElementById('tm-count');
        if (cnt) cnt.textContent = `${n} / ${MACHINE_COST}`;
        const fill = document.getElementById('tm-progress');
        if (fill) fill.style.width = `${(n / MACHINE_COST) * 100}%`;
        const pull = document.getElementById('tm-pull');
        if (pull) pull.disabled = n < MACHINE_COST;
        const add = document.getElementById('tm-add');
        if (add) add.disabled = totalPilha() <= 0 && n < MACHINE_COST;
    }

    function machineAddOne() {
        if (machineDeposit.length >= MACHINE_COST) return;
        const s = loadStickers().find(x => (x.pilha || []).length > 0);
        if (!s) { showToast('Você não tem repetidas na pilha.', 'error'); return; }
        s.pilha.sort((a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b));
        machineDeposit.push({ codigo: s.codigo, rar: s.pilha.shift() });
        saveStickers(loadStickers());
        if (window.SFX) window.SFX.play('tick');
        renderMachine();
    }

    function machinePull() {
        if (machineDeposit.length < MACHINE_COST) return;
        // prioriza país que falta no continente atual, senão qualquer que falte colar
        const missCur = countries.filter(c => c.continente === currentContinent && !isColada(c.codigo));
        const missAny = countries.filter(c => !isColada(c.codigo));
        const pool = missCur.length ? missCur : (missAny.length ? missAny : countries);
        const won = shuffle([...pool])[0];
        const e = stickerEntry(won.codigo, true);
        e.pilha.push('base');
        saveStickers(loadStickers());
        machineDeposit = [];
        renderMachine();
        if (window.SFX) { window.SFX.play('coin'); setTimeout(() => window.SFX.play('reveal_common'), 250); }
        if (!calmMode && typeof confetti !== 'undefined') confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
        showToast(`A máquina soltou: ${won.nome}! 🎰 (foi pra sua pilha)`, 'success');
    }

    document.getElementById('tm-add').addEventListener('click', machineAddOne);
    document.getElementById('tm-pull').addEventListener('click', machinePull);

    // ─── ABRIR PACOTE ────────────────────────────────────
    const PACK_SIZE = PACK_STICKERS;

    function openPackModal() {
        if (getPacksCount() <= 0) {
            showToast('Você não tem pacotes! Jogue partidas ou volte amanhã.', 'error');
            return;
        }
        elements.openedStickers.innerHTML = '';
        elements.openedStickers.classList.add('hidden');
        document.getElementById('pack-decide').classList.add('hidden');
        elements.packAnimationContainer.classList.remove('hidden', 'opening');
        const pw = elements.packAnimationContainer.querySelector('.pack-wrapper');
        if (pw) { pw.classList.remove('tearing'); pw.style.setProperty('--tear', '0'); }
        if (buttons.closePack) buttons.closePack.classList.add('hidden');
        modals.pack.classList.remove('hidden');
    }
    if (buttons.openPack) buttons.openPack.addEventListener('click', openPackModal);

    // sorteia o pacote e joga tudo na PILHA (o jogador decide o que colar depois)
    function drawPack() {
        const stickers = loadStickers();
        const results = [];
        for (let i = 0; i < PACK_SIZE; i++) {
            const drawn = shuffle([...countries])[0];
            let rarity = rollRarity();
            if (drawn.fixedShiny && rarity === 'base') rarity = 'ouro';
            let e = stickers.find(s => s.codigo === drawn.codigo);
            if (!e) { e = { codigo: drawn.codigo, colada: null, pilha: [] }; stickers.push(e); }
            const isNew = !e.colada;
            e.pilha.push(rarity);
            results.push({ country: drawn, rarity, isNew });
        }
        saveStickers(stickers);
        return results;
    }

    function runPackOpen() {
        if (elements.packAnimationContainer.classList.contains('opening')) return;
        if (!removePack()) { showToast('Você não tem pacotes!', 'error'); return; }

        elements.packAnimationContainer.classList.add('opening');
        if (window.SFX) window.SFX.play('pack_tear');

        setTimeout(() => {
            const results = drawPack();
            elements.packAnimationContainer.classList.add('hidden');
            elements.openedStickers.innerHTML = '';
            elements.openedStickers.classList.remove('hidden');

            const best = results.reduce((b, r) => Math.max(b, RARITY_ORDER.indexOf(r.rarity)), 0);
            if (window.SFX) {
                const rev = best >= 3 ? 'reveal_legend' : best >= 1 ? 'reveal_rare' : 'reveal_common';
                setTimeout(() => window.SFX.play(rev), 200);
            }

            results.forEach((r, i) => {
                const card = document.createElement('div');
                card.className = `pack-card rarity-${r.rarity}` + (r.isNew ? ' is-new' : '');
                card.style.animationDelay = `${i * 0.14}s`;
                card.innerHTML = `
                    <div class="pc-frame">
                        <img src="assets/flags/${r.country.codigo}.png" alt="${r.country.nome}">
                        <span class="ac-shine"></span>
                        ${r.isNew ? '<span class="pc-star">★</span>' : ''}
                    </div>
                    <div class="pc-name">${r.country.nome}</div>
                    <div class="pc-tag">${r.isNew ? (RARITY_LABELS[r.rarity] || RARITY_LABELS.base).text : 'repetida'}</div>`;
                elements.openedStickers.appendChild(card);
            });

            if (!calmMode && typeof confetti !== 'undefined') {
                const n = best >= 3 ? 140 : best >= 1 ? 80 : 45;
                confetti({ particleCount: n, spread: 75, origin: { y: 0.5 } });
            }

            buildDecideList(results);
            if (buttons.closePack) buttons.closePack.classList.remove('hidden');
        }, 650);
    }

    // ─── ENVELOPE: rasgo guiado seguindo o cursor ───────
    (function wirePackTear() {
        const stage = elements.packAnimationContainer;
        if (!stage) return;
        const wrap = () => stage.querySelector('.pack-wrapper');
        let dragging = false, moved = false, w = null;

        const setTear = f => { f = Math.max(0, Math.min(1, f)); if (w) w.style.setProperty('--tear', f.toFixed(3)); return f; };

        stage.addEventListener('pointerdown', e => {
            if (stage.classList.contains('opening')) return;
            w = wrap(); if (!w) return;
            dragging = true; moved = false;
            w.classList.add('tearing');
            const r = w.getBoundingClientRect();
            setTear((e.clientX - r.left) / r.width);
            try { stage.setPointerCapture(e.pointerId); } catch (_) {}
        });
        stage.addEventListener('pointermove', e => {
            if (!dragging || !w) return;
            moved = true;
            const r = w.getBoundingClientRect();
            const f = setTear((e.clientX - r.left) / r.width);
            if (f >= 0.62) finishTear();
        });
        const cancelTear = () => {
            if (!dragging) return;
            dragging = false;
            if (w) { w.classList.remove('tearing'); w.style.setProperty('--tear', '0'); }
        };
        const finishTear = () => {
            if (!dragging) return;
            dragging = false;
            if (w) w.classList.remove('tearing');
            runPackOpen();
        };
        stage.addEventListener('pointerup', () => { if (dragging) cancelTear(); });
        stage.addEventListener('pointercancel', cancelTear);

        // toque simples / clique tambem abre (acessivel)
        stage.addEventListener('click', () => { if (!moved) runPackOpen(); moved = false; });
    })();

    // lista "o que fazer com as novas" (só as que ainda não estão coladas)
    function buildDecideList(results) {
        const box = document.getElementById('pack-decide');
        const list = document.getElementById('pack-decide-list');
        const novas = results.filter(r => r.isNew);
        list.innerHTML = '';
        if (!novas.length) { box.classList.add('hidden'); return; }
        box.classList.remove('hidden');
        // dedup por país (se veio 2x a mesma nova)
        const seen = new Set();
        novas.forEach(r => {
            if (seen.has(r.country.codigo)) return;
            seen.add(r.country.codigo);
            const row = document.createElement('div');
            row.className = 'decide-row';
            row.dataset.codigo = r.country.codigo;
            row.innerHTML = `
                <img src="assets/flags/${r.country.codigo}.png" alt="">
                <span class="decide-name">${r.country.nome}</span>
                <button class="decide-glue">Colar</button>
                <button class="decide-keep">Guardar</button>`;
            row.querySelector('.decide-glue').addEventListener('click', () => {
                if (glueSticker(r.country.codigo)) {
                    if (window.SFX) window.SFX.play('sticker_paste');
                    row.classList.add('done'); row.querySelector('.decide-name').textContent = r.country.nome + ' — colada ✓';
                    row.querySelectorAll('button').forEach(b => b.remove());
                }
            });
            row.querySelector('.decide-keep').addEventListener('click', () => {
                row.classList.add('done'); row.querySelector('.decide-name').textContent = r.country.nome + ' — na pilha';
                row.querySelectorAll('button').forEach(b => b.remove());
            });
            list.appendChild(row);
        });
    }

    if (buttons.closePack) buttons.closePack.addEventListener('click', () => {
        modals.pack.classList.add('hidden');
        openAlbum();
    });

    // Eventos Multiplayer
    buttons.btnHostParty.addEventListener('click', initPartyHostMode);
    buttons.btnJoinParty.addEventListener('click', () => {
        const profiles = JSON.parse(localStorage.getItem('detetive_profiles')) || [];
        if (!currentUser) {
            showToast("Você precisa criar um perfil na tela principal antes de jogar online!", "error");
            return;
        }
        profiles.forEach(name => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = name;
            elements.joinPlayerName.appendChild(opt);
        });
        showScreen('partyJoinClient');
    });
    buttons.joinRoomBtn.addEventListener('click', joinPartyRoom);
    buttons.startPartyBtn.addEventListener('click', startPartyGame);
    buttons.partyHostBackMenu.addEventListener('click', () => { partyCleanup(); showScreen('main'); });
    buttons.partyHostPlayAgain.addEventListener('click', startPartyGame);
    document.getElementById('cancel-party-btn').addEventListener('click', partyCleanup);

     // Configuração do Modo Calmo
     if (calmMode) {
         document.body.classList.add('calm-mode');
         buttons.calmModeToggle.checked = true;
    }
     if (buttons.calmModeToggle) buttons.calmModeToggle.addEventListener('change', (e) => {
         calmMode = e.target.checked;
         localStorage.setItem('detetive_calm_mode', calmMode);
         document.body.classList.toggle('calm-mode', calmMode);
    });

    document.getElementById('close-constructive-button').addEventListener('click', () => {
        document.getElementById('constructive-feedback-modal').classList.add('hidden');
        if (gameConfig.lives === 'infinite' || gameState.chances > 0) {
            if (gameState.availableCountries.length > 0) {
                nextRound();
            }
        }
    });

    document.querySelectorAll('.back-button').forEach(b => b.addEventListener('click', () => {
        elements.mainContainer.classList.remove('memory-mode');
        partyCleanup();
        showScreen('main');
    }));

    // ─── FASE 3: CONFIGURAÇÃO DA PARTIDA (tela única) ─────
    const MODE_META = {
        BandeiraPorPais:   { icon: '🏳️', label: 'Qual a Bandeira?' },
        NomePorBandeira:   { icon: '🔎', label: 'De que País é?' },
        PaisPorCapital:    { icon: '🏛️', label: 'Qual o País?' },
        ContinentePorPais: { icon: '🌎', label: 'Qual o Continente?' },
        Memoria:           { icon: '🃏', label: 'Jogo da Memória' },
    };
    const setupEl = document.getElementById('game-setup');

    function openSetup(mode) {
        gameConfig = { mode, type: null, level: null, lives: 'infinite' };
        const meta = MODE_META[mode] || { icon: '🎮', label: mode };
        document.getElementById('setup-mode-icon').textContent = meta.icon;
        document.getElementById('setup-mode-name').textContent = meta.label;
        setupEl.querySelectorAll('.setup-opt.selected').forEach(o => o.classList.remove('selected'));
        if (mode === 'Memoria') gameConfig.type = 'Memoria'; // pula o passo "como jogar"
        updateSetupUI();
        showScreen('setup');
    }

    function updateSetupUI() {
        const isMemory = gameConfig.mode === 'Memoria';
        const isJornada = gameConfig.type === 'Jornada';
        const isRapido = gameConfig.type === 'Rápido';
        document.getElementById('setup-sec-type').classList.toggle('hidden', isMemory);
        document.getElementById('setup-sec-level').classList.toggle('hidden', !(isMemory || isRapido));
        document.getElementById('setup-sec-lives').classList.toggle('hidden', !isRapido);

        const ready =
            (isMemory && gameConfig.level != null) ||
            isJornada ||
            (isRapido && gameConfig.level != null);
        document.getElementById('setup-start').disabled = !ready;
    }

    setupEl.querySelectorAll('.setup-opt').forEach(opt => opt.addEventListener('click', () => {
        const kind = opt.dataset.setup;
        const raw = opt.dataset.value;
        setupEl.querySelectorAll(`.setup-opt[data-setup="${kind}"]`).forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');

        if (kind === 'type') {
            gameConfig.type = raw;
            if (raw === 'Jornada') { gameConfig.level = null; gameConfig.lives = 'infinite'; }
        } else if (kind === 'level') {
            gameConfig.level = parseInt(raw, 10);
        } else if (kind === 'lives') {
            gameConfig.lives = raw === 'infinite' ? 'infinite' : parseInt(raw, 10);
        }
        updateSetupUI();
    }));

    document.getElementById('setup-start').addEventListener('click', () => {
        if (document.getElementById('setup-start').disabled) return;
        if (gameConfig.mode === 'Memoria') gameConfig.lives = 'infinite';
        if (gameConfig.type === 'Jornada') gameConfig.lives = 'infinite';
        startGame(gameConfig);
    });

    document.getElementById('setup-back').addEventListener('click', () => showScreen('main'));

    document.querySelectorAll('#main-menu .mode-button:not(.party-mode)').forEach(b => b.addEventListener('click', () => {
        openSetup(b.dataset.gamemode);
    }));

    // --- MULTIPLAYER PARTY MODE LOGIC ---
    let myPeer = null;
    let myConnection = null;
    let hostConnections = [];
    let isHost = false;
    let partyState = {
        players: [], // {id, name, score}
        round: 0,
        maxRounds: 10,
        currentAnswers: {},
        roundTimer: 0,
        timerInterval: null
    };

    function initPartyHostMode() {
        showScreen('partyLobbyHost');
        isHost = true;
        hostConnections = [];
        partyState.players = [];
        elements.hostPlayersList.innerHTML = '';
        elements.hostPlayerCount.textContent = '0';
        buttons.startPartyBtn.disabled = true;
        elements.mainContainer.classList.remove('party-mobile-view');
        elements.mainContainer.classList.add('party-tv-view');

        // Check if there's an active host session we can recover
        let hostId = sessionStorage.getItem('detetive_host_id');
        if (!hostId) {
            hostId = 'detetive-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            sessionStorage.setItem('detetive_host_id', hostId);
        }

        elements.hostRoomCode.textContent = "CRIANDO...";

        myPeer = new Peer(hostId);
        myPeer.on('open', (id) => {
            elements.hostRoomCode.textContent = id.replace('detetive-', '').toUpperCase();
        });
        myPeer.on('connection', (conn) => {
            conn.on('data', (data) => handleHostData(conn, data));
            conn.on('close', () => {
                partyState.players = partyState.players.filter(p => p.id !== conn.peer);
                hostConnections = hostConnections.filter(c => c.peer !== conn.peer);
                updateHostLobby();
            });
        });
        myPeer.on('error', (err) => {
            console.error(err);
            showToast("Erro ao criar sala. Tente novamente.", "error");
            partyCleanup();
            showScreen('main');
        });
    }

    function updateHostLobby() {
        elements.hostPlayersList.innerHTML = '';
        partyState.players.forEach(p => {
            const div = document.createElement('div');
            div.className = 'profile-btn';
            div.textContent = p.name;
            elements.hostPlayersList.appendChild(div);
        });
        elements.hostPlayerCount.textContent = partyState.players.length;
        buttons.startPartyBtn.disabled = partyState.players.length === 0;
    }

    function handleHostData(conn, data) {
        if (data.type === 'join') {
            if (hostConnections.length >= 8) { conn.send({ type: 'error', msg: 'Sala Cheia!' }); return; }
            hostConnections.push(conn);
            partyState.players.push({ id: conn.peer, name: data.name, score: 0 });
            updateHostLobby();
            conn.send({ type: 'joined' });
        } else if (data.type === 'answer') {
            partyState.currentAnswers[conn.peer] = { answer: data.answer, time: data.time };
            const isCorrect = data.answer === correctAnswer.codigo;
            conn.send({ type: 'answer_received', correct: isCorrect });
        }
    }

    function joinPartyRoom() {
        const code = elements.joinRoomCode.value.toUpperCase().trim();
        const name = elements.joinPlayerName.value;
        if (!code || !name) { elements.joinErrorMsg.textContent = "Preencha tudo!"; elements.joinErrorMsg.classList.remove('hidden'); return; }

        elements.joinErrorMsg.classList.add('hidden');
        showScreen('partyWaitClient');
        isHost = false;
        elements.mainContainer.classList.add('party-mobile-view');

        myPeer = new Peer();
        myPeer.on('open', (id) => {
            myConnection = myPeer.connect('detetive-' + code);
            myConnection.on('open', () => {
                myConnection.send({ type: 'join', name: name });
            });
            myConnection.on('data', handleClientData);
            myConnection.on('error', (err) => {
                elements.joinErrorMsg.textContent = "Erro na sala."; elements.joinErrorMsg.classList.remove('hidden');
                showScreen('partyJoinClient');
                elements.mainContainer.classList.remove('party-mobile-view');
            });
            myConnection.on('close', () => {
                showToast("A sala foi fechada.", "error");
                partyCleanup();
                showScreen('main');
            });
        });
    }

    function handleClientData(data) {
        if (data.type === 'joined') {
            document.getElementById('client-wait-message').textContent = "Conectado! 🎮";
            elements.partyClientOptions.innerHTML = '';
        } else if (data.type === 'error') {
            alert(data.msg); showScreen('partyJoinClient'); partyCleanup();
        } else if (data.type === 'start_round') {
            showScreen('partyGameClient');
            elements.partyClientInstruction.textContent = "Olhe para a TV!";
            elements.partyClientFeedback.textContent = "";
            renderClientOptions(data.options);
        } else if (data.type === 'answer_received') {
            elements.partyClientFeedback.textContent = data.correct ? "Boa! Aguarde os outros..." : "Ops! Aguarde os outros...";
            elements.partyClientFeedback.style.color = data.correct ? "#32CD32" : "#FF6347";
        } else if (data.type === 'round_end') {
            const myScore = data.leaderboard.find(x => x.id === myPeer.id)?.score || 0;
            elements.partyClientInstruction.textContent = `Pontos: ${myScore}`;
            elements.partyClientOptions.innerHTML = '';
        } else if (data.type === 'game_over') {
            document.getElementById('client-wait-message').textContent = "Fim de Jogo! Olhe a TV.";
            showScreen('partyWaitClient');
        }
    }

    function renderClientOptions(options) {
        elements.partyClientOptions.innerHTML = '';
        const colors = ['#FF5722', '#4CAF50', '#2196F3', '#FFC107'];
        options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = `party-client-btn`;
            btn.dataset.codigo = opt.codigo;

            btn.style.padding = '0';
            btn.style.border = `6px solid ${colors[i % 4]}`;
            btn.style.backgroundColor = colors[i % 4];
            btn.style.overflow = 'hidden';
            btn.style.display = 'flex';

            const img = document.createElement('img');
            img.src = `assets/flags/${opt.codigo}.png`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.pointerEvents = 'none';

            btn.appendChild(img);

            const startInteractionTime = Date.now();
            btn.onclick = () => {
                if (!myConnection) return;
                const timeTaken = Date.now() - startInteractionTime;
                myConnection.send({ type: 'answer', answer: opt.codigo, time: timeTaken });
                Array.from(elements.partyClientOptions.children).forEach(b => {
                    b.disabled = true;
                    b.style.opacity = '0.5';
                });
                btn.style.opacity = '1';
                btn.style.transform = 'scale(0.95)';
                playSound('match');
            };
            elements.partyClientOptions.appendChild(btn);
        });
    }

    function startPartyGame() {
        showScreen('partyGameHost');
        partyState.round = 0;
        partyState.players.forEach(p => p.score = 0);

        const sl = buttons.partyHostLevelSelect.value;
        if (sl === 'all') {
            gameState.availableCountries = [...countries];
        } else {
            const levelNum = parseInt(sl);
            gameState.availableCountries = countries.filter(c => c.nivel === levelNum);
        }

        nextPartyRound();
    }

    function nextPartyRound() {
        partyState.round++;
        if (partyState.round > partyState.maxRounds || gameState.availableCountries.length === 0) {
            endPartyGame();
            return;
        }

        elements.partyHostRound.textContent = partyState.round;
        partyState.currentAnswers = {};

        let pool = gameState.availableCountries;
        correctAnswer = shuffle([...pool])[0];
        let wrong = countries.filter(c => c.codigo !== correctAnswer.codigo);
        let hard = wrong.filter(c => c.continente === correctAnswer.continente);
        let opts = [correctAnswer, ...shuffle(hard.length >= 3 ? hard : wrong).slice(0, 3)];
        opts = shuffle(opts);

        elements.partyHostInstruction.textContent = `Qual é a bandeira ${correctAnswer.artigo} ${correctAnswer.nome}?`;
        playAudio(`bandeiras/${correctAnswer.nome}`);

        elements.partyHostOptions.innerHTML = '';
        const colors = ['#FF5722', '#4CAF50', '#2196F3', '#FFC107'];
        opts.forEach((c, i) => {
            const w = document.createElement('div'); w.className = 'option-wrapper';
            w.style.position = 'relative'; /* For placing the indicator perfectly */
            const ind = document.createElement('div'); ind.className = 'party-option-indicator';
            ind.style.backgroundColor = colors[i % 4];
            ind.style.position = 'absolute';
            ind.style.bottom = '-10px';
            ind.style.left = '50%';
            ind.style.transform = 'translateX(-50%)';
            ind.style.border = '2px solid white';

            const img = document.createElement('img'); img.src = `assets/flags/${c.codigo}.png`;
            img.className = 'flag-option'; img.style.pointerEvents = 'none';

            w.appendChild(img);
            w.appendChild(ind); // Using indicator directly instead of full label
            elements.partyHostOptions.appendChild(w);
        });

        const clientOpts = opts.map(o => ({ codigo: o.codigo }));
        hostConnections.forEach(c => c.send({ type: 'start_round', options: clientOpts }));

        updateHostLeaderboard();
        partyState.roundTimer = 10;
        elements.partyHostTimer.textContent = `⏱️ ${partyState.roundTimer}s`;
        elements.partyHostTimer.style.color = '#FFD700';

        clearInterval(partyState.timerInterval);
        partyState.timerInterval = setInterval(() => {
            partyState.roundTimer--;
            elements.partyHostTimer.textContent = `⏱️ ${partyState.roundTimer}s`;
            if (partyState.roundTimer <= 3) elements.partyHostTimer.style.color = '#FF6347';

            if (partyState.roundTimer <= 0 || Object.keys(partyState.currentAnswers).length === hostConnections.length) {
                clearInterval(partyState.timerInterval);
                resolvePartyRound();
            }
        }, 1000);
    }

    function resolvePartyRound() {
        Object.keys(partyState.currentAnswers).forEach(peerId => {
            const ans = partyState.currentAnswers[peerId];
            if (ans.answer === correctAnswer.codigo) {
                let timeBonus = Math.max(0, 10000 - ans.time) / 100;
                let points = 100 + Math.floor(timeBonus);
                const player = partyState.players.find(p => p.id === peerId);
                if (player) player.score += points;
            }
        });

        Array.from(elements.partyHostOptions.children).forEach(w => {
            const img = w.querySelector('img');
            if (img && img.src.includes(correctAnswer.codigo)) {
                img.classList.add('correct');
            } else {
                img.classList.add('incorrect');
            }
        });

        updateHostLeaderboard();
        playSound('win');

        partyState.players.sort((a, b) => b.score - a.score);
        hostConnections.forEach(c => c.send({ type: 'round_end', leaderboard: partyState.players }));

        gameState.availableCountries = gameState.availableCountries.filter(c => c.codigo !== correctAnswer.codigo);

        setTimeout(() => {
            nextPartyRound();
        }, 4000);
    }

    function updateHostLeaderboard() {
        elements.partyHostLeaderboard.innerHTML = '';
        const sortedInfo = [...partyState.players].sort((a, b) => b.score - a.score);
        sortedInfo.slice(0, 5).forEach((p, i) => {
            const div = document.createElement('div');
            div.className = 'party-player-score';
            if (partyState.round > 0 && Object.keys(partyState.currentAnswers).includes(p.id)) {
                div.style.border = '2px solid #32CD32';
            }
            div.innerHTML = `<span>${i + 1}. ${p.name}</span><span>${p.score} pts</span>`;
            elements.partyHostLeaderboard.appendChild(div);
        });
    }

    function endPartyGame() {
        showScreen('partyLeaderboardHost');
        elements.partyFinalPodium.innerHTML = '';
        const sorted = [...partyState.players].sort((a, b) => b.score - a.score);
        sorted.slice(0, 3).forEach((p, i) => {
            const div = document.createElement('div');
            div.className = `party-player-score podium-${i + 1}`;
            div.innerHTML = `<span>${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} ${p.name}</span><span>${p.score} pts</span>`;
            elements.partyFinalPodium.appendChild(div);
        });
        playSound('completed');
        dispararConfetes();
        hostConnections.forEach(c => c.send({ type: 'game_over' }));
    }

    function partyCleanup() {
        clearInterval(partyState.timerInterval);
        if (myPeer) { myPeer.destroy(); myPeer = null; }
        myConnection = null;
        hostConnections = [];
        partyState.players = [];
        elements.mainContainer.classList.remove('party-mobile-view');
        elements.mainContainer.classList.remove('party-tv-view');
        sessionStorage.removeItem('detetive_host_id');
    }

    // ─── BOOTSTRAP ───────────────────────────────────────
    initAvatarPicker();
    setAuthMode('login');
    renderAuthAccounts();

    if (currentUser && Auth.list().some(a => a.name === currentUser)) {
        selectProfile(currentUser, Auth.avatarOf(currentUser));
    } else {
        Auth.logout();
        currentUser = null;
        showScreen('profile');
    }
});

    