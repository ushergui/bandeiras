
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

// impl LOCAL (fallback). js/data-online.js sobrescreve window.API/window.Auth
// quando o modo online está configurado (js/config.js).
window.API = {
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
window.Auth = {
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
    // stubs (modo online implementa de verdade)
    onReady: () => Promise.resolve(),
    isOnline: () => true,
    currentName: () => localStorage.getItem('currentUser') || null,
    needsPasswordChange: () => false,
    isAdmin: () => false,
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
        setpw: document.getElementById('set-password'),
        admin: document.getElementById('admin-menu'),
        setup: document.getElementById('game-setup'),
        trades: document.getElementById('trades-menu'),
        duels: document.getElementById('duels-menu'),
        live: document.getElementById('live-room'),
        kpHost: document.getElementById('kp-host'),
        kpJoin: document.getElementById('kp-join'),
        kpCtrl: document.getElementById('kp-ctrl'),
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
        pack: document.getElementById('pack-modal'),
        tmPicker: document.getElementById('tm-picker-modal'),
        duelCompose: document.getElementById('duel-compose-modal')
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
        hint: document.getElementById('hint-button'),
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
        openMore: document.getElementById('pack-open-more'),
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
    function showToast(message, type = 'info', ms) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type} ${type}`;

        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (message.toLowerCase().includes('pacotinho') || message.includes('+') && message.includes('pacote')) icon = '🎁';
        if (type === 'fact') { icon = '📌'; type = 'info'; toast.className = 'toast toast-fact info'; }

        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-leave');
            setTimeout(() => toast.remove(), 400);
        }, ms || 3200);
    }

    let gameState = {};
    let session = { correct: 0, wrong: 0, mastered: 0, missed: {} };
    let correctAnswer = null;

    // pares de bandeiras que confundem — dica curta ao errar
    const FLAG_TIPS = {
        'ro|td': 'Chade e Romênia usam as mesmas 3 cores. O azul do Chade é mais escuro (quase índigo).',
        'id|mc': 'Indonésia e Mônaco são vermelho sobre branco. Mônaco é quase quadrada; a Indonésia é mais comprida.',
        'mc|pl': 'A Polônia é branco em cima e vermelho embaixo — o contrário de Mônaco.',
        'id|pl': 'A Polônia é branco em cima; a Indonésia é vermelho em cima.',
        'lu|nl': 'Luxemburgo é mais claro e mais comprido que a Holanda, e o azul é celeste.',
        'ci|ie': 'Na Irlanda o verde fica na haste; na Costa do Marfim é o laranja que fica na haste.',
        'gn|ml': 'Mali tem o verde na haste; a Guiné tem o vermelho na haste.',
        'ml|sn': 'Iguais, mas o Senegal tem uma estrela verde no centro.',
        'au|nz': 'A Austrália tem 6 estrelas brancas; a Nova Zelândia tem 4 estrelas vermelhas com borda branca.',
        'is|no': 'Noruega: fundo vermelho, cruz azul. Islândia: fundo azul, cruz vermelha.',
        'co|ec': 'O Equador tem um brasão grande no centro; a Colômbia é lisa.',
        'co|ve': 'A Venezuela tem um arco de estrelas brancas; a Colômbia é lisa.',
        'lr|us': 'Os EUA têm 50 estrelas; a Libéria tem só 1.',
        'my|us': 'A Malásia tem crescente e estrela amarelos no cantão azul.',
        'eg|ye': 'Iêmen é liso; o Egito tem a águia dourada no centro.',
        'iq|ye': 'Iêmen é liso; o Iraque tem "Deus é maior" escrito em verde.',
        'ru|si': 'A Eslovênia tem um brasão no canto superior esquerdo; a Rússia é lisa.',
        'ru|sk': 'A Eslováquia tem um brasão no centro-esquerda; a Rússia é lisa.',
        'si|sk': 'O brasão da Eslováquia é uma cruz sobre montes; o da Eslovênia tem o monte Triglav e estrelas.',
        'bh|qa': 'O Catar é bordô (vinho) e tem 9 pontas; o Bahrein é vermelho e tem 5 pontas.',
        'bd|jp': 'No Japão o círculo é vermelho sobre branco e centralizado; em Bangladesh é sobre verde e puxado pra esquerda.',
        'in|ne': 'A Índia tem a roda azul (Chakra) no centro; o Níger tem um círculo laranja.',
        'ar|uy': 'A Argentina tem o sol no meio da faixa branca; o Uruguai tem 9 listras e o sol no cantão.',
        'at|lv': 'A Letônia é vermelho-escuro (carmim) e a faixa branca é bem fininha.',
        'cf|td': 'A República Centro-Africana tem 4 faixas horizontais + 1 vertical vermelha e uma estrela.',
    };
    function flagTip(a, b) { return FLAG_TIPS[[a, b].sort().join('|')] || ''; }
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

        // Load packs — pacotes grátis por "dia" (dia vira às 06:00)
        try {
            const packsData = await API.getPacks(name);
            const today = packDayKey();
            const localMark = `dg_freeday_${name}`;
            const alreadyToday = packsData.last_daily_at === today
                || localStorage.getItem(localMark) === today;
            let count = packsData.count;
            if (!alreadyToday) {
                count += DAILY_FREE_PACKS;
                await API.savePacks(name, count, today);
                setTimeout(() => showToast(`Você ganhou ${DAILY_FREE_PACKS} pacotes de hoje! 🎁 Abra no Álbum.`, 'success'), 800);
            }
            try { localStorage.setItem(localMark, today); } catch (e) {}
            _cache.packsCount = count;
            _cache.freePacksDay = today;
            savePacks(count); // repinta #packs-count / botão "Abrir pacote"
            try { registerLoginStreak(name); } catch (e) { console.warn(e); }
        } catch(e) {
            console.warn('Erro ao carregar packs:', e);
            _cache.packsCount = 0;
            savePacks(0);
        }

        _cache.dailyProgress = loadDailyProgress(name);
        if (window.DG_ONLINE && typeof liveNotifSubscribe === 'function') { try { liveNotifSubscribe(); } catch (e) {} }
        showScreen('main');
    }

    // --- ECONOMIA DE PACOTES ---
    const DAILY_FREE_PACKS = 2;
    const PACK_STICKERS = 4;
    const ALL_MODES = ['BandeiraPorPais', 'NomePorBandeira', 'PaisPorCapital', 'ContinentePorPais', 'Mapa', 'Forca', 'Memoria'];

    // "dia do pacote": vira às 06:00. Antes das 6h ainda conta como o dia anterior.
    // usa a data LOCAL (não UTC) — senão "vira de dia" às 21h no horário do Brasil.
    function packDayKey(d) {
        d = d ? new Date(d) : new Date();
        if (d.getHours() < 6) d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function loadDailyProgress(name) {
        const raw = window.DG_ONLINE ? API._sync.daily(packDayKey()) : Store._get(`dg_daily_${name}`, null);
        if (!raw || raw.day !== packDayKey()) {
            return { day: packDayKey(), acertos: 0, bonus: {}, modes: {} };
        }
        if (!raw.modes) raw.modes = {};
        if (!raw.bonus) raw.bonus = {};
        return raw;
    }
    // "modesWon" e "trocas" NÃO são campos novos no banco (o online só persiste
    // acertos/modes/bonus — schema fixo no Supabase) -- aninhados dentro de
    // `modes`/`bonus`, que já são JSONB livres e trafegam inteiros. Zero SQL novo.
    function dpModesWon(dp) { if (!dp.modes.__won) dp.modes.__won = {}; return dp.modes.__won; }
    function dpTrocas(dp) { return (dp.bonus && dp.bonus._trocas) || 0; }
    function saveDailyProgress() {
        if (!currentUser || !_cache.dailyProgress) return;
        if (window.DG_ONLINE) API.saveDaily(currentUser, _cache.dailyProgress.day, _cache.dailyProgress);
        else Store._set(`dg_daily_${currentUser}`, _cache.dailyProgress);
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

    // recompensa da sequência de login para uma dada contagem de dias
    // 1 dia: nada · 2: +1 · 3+: +2/dia · múltiplos de 10 (10,20,30…): +5
    function streakReward(count) {
        if (count < 2) return { qty: 0, msg: '' };
        if (count % 10 === 0) return { qty: 5, msg: `${count} dias seguidos! 🔥🔥` };
        if (count === 2) return { qty: 1, msg: `2 dias seguidos! 🔥` };
        return { qty: 2, msg: `${count} dias seguidos! 🔥` };
    }
    function registerLoginStreak(name) {
        const key = `dg_streak_${name}`;
        const s = window.DG_ONLINE ? API._sync.streak() : Store._get(key, { last: null, count: 0 });
        const today = packDayKey();
        if (s.last === today) { _cache.loginStreak = s.count; return; }
        const yesterday = packDayKey(Date.now() - 24 * 3600 * 1000);
        s.count = (s.last === yesterday) ? s.count + 1 : 1;
        s.last = today;
        if (window.DG_ONLINE) API.saveStreak(name, s); else Store._set(key, s);
        _cache.loginStreak = s.count;
        const rw = streakReward(s.count);
        if (rw.qty) setTimeout(() => grantBonusPack('streak' + s.count, rw.qty, rw.msg), 1400);
    }

    // registro simples de "jogou esse modo hoje" (estatística; não dá pacote --
    // quem dá pacote agora é markModeWon, só quando VENCE de verdade)
    function markModePlayed(mode) {
        if (!currentUser || !ALL_MODES.includes(mode)) return;
        const dp = _cache.dailyProgress || (_cache.dailyProgress = loadDailyProgress(currentUser));
        if (dp.day !== packDayKey()) { _cache.dailyProgress = loadDailyProgress(currentUser); }
        const d = _cache.dailyProgress;
        if (d.modes[mode]) return;
        d.modes[mode] = 1;
        saveDailyProgress();
    }

    // vencer (offline) em pelo menos 2 modos diferentes no dia -> +2 pacotes.
    // Só chamada de dentro de gameOver(true) -- duelo online NUNCA passa por lá,
    // então fica de fora automaticamente (a meta pede "offline" mesmo).
    function markModeWon(mode) {
        if (!currentUser || !ALL_MODES.includes(mode)) return;
        const dp = _cache.dailyProgress || (_cache.dailyProgress = loadDailyProgress(currentUser));
        if (dp.day !== packDayKey()) { _cache.dailyProgress = loadDailyProgress(currentUser); }
        const d = _cache.dailyProgress;
        const won = dpModesWon(d);
        if (won[mode]) return;
        won[mode] = 1;
        saveDailyProgress();
        if (Object.keys(won).length === 2) grantBonusPack('vencer2modos', 2, 'Venceu em 2 modos diferentes hoje!');
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

    // repetição espaçada (SM-2 enxuto): intervalo por "caixa" (streak), em ms
    const SR_BOX_MS = [10 * 60e3, 60 * 60e3, 24 * 3600e3, 3 * 24 * 3600e3, 7 * 24 * 3600e3, 21 * 24 * 3600e3];

    function updateCountryStats(code, isCorrect, responseMs) {
        const p = loadPlayerProgress();
        if (!p[code]) p[code] = { acertos: 0, erros: 0, streak: 0, ease: 2.3 };
        const s = p[code];
        const masteryBefore = s.mastery || 0;
        const now = Date.now();
        const fast = responseMs && responseMs > 0 && responseMs < 4500;

        if (isCorrect) {
            s.acertos++; s.streak = (s.streak || 0) + 1;
            s.ease = Math.min(2.8, (s.ease || 2.3) + (fast ? 0.12 : 0.02));
        } else {
            s.erros++; s.streak = 0;
            s.ease = Math.max(1.3, (s.ease || 2.3) - 0.22);
        }
        s.lastSeen = now;
        // quando revisar de novo
        const box = Math.min(s.streak, SR_BOX_MS.length - 1);
        s.nextReview = isCorrect ? now + Math.round(SR_BOX_MS[box] * (s.ease / 2.3)) : now + 4 * 60e3;

        if (responseMs && responseMs > 0 && responseMs < 60000) {
            s.hist = (s.hist || []).concat([{ t: now, ok: !!isCorrect, ms: Math.round(responseMs) }]).slice(-20);
            const oks = s.hist.filter(h => h.ok).map(h => h.ms);
            if (oks.length) s.avgMs = Math.round(oks.reduce((a, b) => a + b, 0) / oks.length);
        }

        // mastery 0-100: precisão histórica + sequência atual + bônus de rapidez
        const total = s.acertos + s.erros;
        const acc = total ? s.acertos / total : 0;
        const speedBonus = (s.avgMs && s.avgMs < 3000) ? 6 : 0;
        s.mastery = Math.round(Math.max(0, Math.min(100, acc * 52 + Math.min(s.streak || 0, 6) / 6 * 42 + speedBonus)));

        savePlayerProgress(p);
        // resumo da sessão
        if (isCorrect) {
            session.correct++;
            if (masteryBefore < 85 && s.mastery >= 85) session.mastered++;
        } else {
            session.wrong++;
            session.missed[code] = (session.missed[code] || 0) + 1;
        }
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
        saveDailyProgress();

        if (d.acertos === 20) grantBonusPack('acertos20', 1, '20 acertos hoje!');
        if (d.acertos === 50) grantBonusPack('acertos50', 1, '50 acertos hoje!');
        // "dominar bandeiras" saiu daqui -- virou missão FIXA (não diária, não
        // reseta), ver checkAchievements(): cada 2 bandeiras dominadas pra
        // sempre rende 1 pacote. updateCountryStats() já chama checkAchievements()
        // logo em seguida, então não precisa de nada extra aqui.
    }

    // peso de aprendizado: nunca visto e revisão vencida têm prioridade;
    // dominado recente quase não aparece; evita repetir o que acabou de sair.
    function learnWeight(s) {
        if (!s || !s.lastSeen) return 7;                       // nunca viu
        const now = Date.now();
        if (now - s.lastSeen < 25e3) return 1;                 // saiu agora há pouco
        const m = s.mastery || 0;
        let w = 2;
        if (s.nextReview && now >= s.nextReview) w += 3;       // revisão vencida
        if (m < 40) w += 3; else if (m < 70) w += 1;           // ainda aprendendo
        if ((s.erros || 0) > (s.acertos || 0)) w += 2;         // erra mais que acerta
        if (m >= 85 && !(s.nextReview && now >= s.nextReview)) w = 1; // dominado e em dia
        return Math.max(1, w);
    }
    function getWeightedCountry(pool) {
        const p = loadPlayerProgress(); const wList = [];
        pool.forEach(c => {
            const w = learnWeight(p[c.codigo]);
            for (let i = 0; i < w; i++) wList.push(c);
        });
        return shuffle(wList)[0] || shuffle([...pool])[0];
    }

    // fila de revisão: o que você errou volta ~3 rodadas depois, na mesma partida
    function queueReview(code) {
        if (!gameState.review) gameState.review = [];
        if (!gameState.review.some(r => r.code === code)) {
            gameState.review.push({ code, dueRound: (gameState.roundNum || 0) + 3 });
        }
    }
    function pickRoundCountry(pool) {
        // desafio entre amigos: perguntas fixas, na ordem gravada
        if (gameState.duel) {
            const q = gameState.duel.questions[gameState.duelIdx];
            return q ? albumItem(q.code) : null;
        }
        if (!pool || !pool.length) return null;
        const rn = gameState.roundNum || 0;
        const due = (gameState.review || []).find(r => r.dueRound <= rn && pool.some(c => c.codigo === r.code));
        if (due) {
            gameState.review = gameState.review.filter(r => r !== due);
            return pool.find(c => c.codigo === due.code);
        }
        // algoritmo de aprendizado em todos os modos; um pouco de aleatório extra no "Rápido"
        if (gameConfig.type === 'Rápido' && Math.random() < 0.35) return shuffle([...pool])[0];
        return getWeightedCountry(pool);
    }

    // ─── DICA (custa 3 pontos) ───────────────────────────
    const HINT_MODES = ['BandeiraPorPais', 'NomePorBandeira', 'PaisPorCapital', 'Mapa', 'ContinentePorPais', 'Forca'];
    const HINT_COST = 3, HINT_MAX = 2;

    function useHint() {
        if (gameLocked || !correctAnswer) return;
        if ((gameState.hintsUsed || 0) >= HINT_MAX) return;

        let ok = false;
        if (gameConfig.mode === 'Forca') {
            // revela uma letra ainda não tentada
            const missing = [...new Set(forcaState.plain.split(''))]
                .filter(ch => ch !== ' ' && !forcaState.guessed.has(ch));
            if (missing.length) {
                forcaState.guessed.add(shuffle(missing)[0]);
                renderForca();
                ok = true;
                const solved = [...forcaState.plain].every(ch => ch === ' ' || forcaState.guessed.has(ch));
                if (solved) forcaGuess(missing[0]); // fecha a rodada se a dica completou
            }
        } else {
            // elimina uma opção errada
            const isText = gameConfig.mode === 'ContinentePorPais';
            const cands = [...document.querySelectorAll('#options-container .flag-option, #options-container .text-option')]
                .filter(el => !el.classList.contains('disabled') && !el.classList.contains('hinted')
                    && (isText ? el.dataset.continente !== correctAnswer.continente
                        : el.dataset.codigo !== correctAnswer.codigo));
            if (cands.length) {
                const pick = shuffle(cands)[0];
                pick.classList.add('disabled', 'hinted');
                ok = true;
            }
        }

        if (!ok) return;
        gameState.score = Math.max(0, gameState.score - HINT_COST);
        gameState.hintsUsed = (gameState.hintsUsed || 0) + 1;
        if (window.SFX) window.SFX.play('tick');
        updateStats();
        if (gameState.hintsUsed >= HINT_MAX) buttons.hint.classList.add('hidden');
    }

    // 3 opções erradas — nos níveis 4-5, garante 1-2 bandeiras que confundem de propósito
    function wrongOptions(base, n) {
        n = n || 3;
        const wrong = base.filter(c => c.codigo !== correctAnswer.codigo);
        const hard = wrong.filter(c => c.continente === correctAnswer.continente);
        const out = [];
        if ((gameState.currentLevel || 1) >= 4) {
            const conf = Object.keys(FLAG_TIPS)
                .filter(k => k.split('|').includes(correctAnswer.codigo))
                .flatMap(k => k.split('|')).filter(c => c !== correctAnswer.codigo);
            shuffle(conf).slice(0, n - 1).forEach(cd => {
                const c = base.find(x => x.codigo === cd);
                if (c) out.push(c);
            });
        }
        const fill = shuffle((hard.length >= n ? hard : wrong).filter(c => !out.some(o => o.codigo === c.codigo)));
        while (out.length < n && fill.length) out.push(fill.shift());
        return out;
    }

    // --- JOGO ---
    const gameModes = {
        'BandeiraPorPais': {
            title: "Qual a Bandeira?",
            setup: () => setupStandardRound((c) => {
                elements.instruction.textContent = `Qual é a bandeira ${c.artigo} ${c.nome}?`;
                if (!c._kind) playAudio(`bandeiras/${c.nome}`);
            }, 'flag')
        },
        'PaisPorCapital': {
            title: "Qual o País?",
            setup: () => prepareStandardLogic((c) => {
                elements.instruction.textContent = `De qual país é a capital ${c.capital}?`;
                playAudio(`capitais/${c.capital}`);
            }, 'flag', true)
        },
        'ContinentePorPais': {
            title: "Qual o Continente?",
            setup: () => {
                const all = [...new Set(countries.map(c => c.continente))];
                let sel = gameState.availableCountries;
                correctAnswer = pickRoundCountry(sel);
                if (!correctAnswer) { gameState.duel ? finishDuel() : handleLevelComplete(); return; }

                elements.instruction.textContent = `Qual o continente ${correctAnswer.artigo} ${correctAnswer.nome}?`;
                playAudio(`continente_do_pais/${correctAnswer.nome}`);

                let opts = gameState.duel ? duelOpts()
                    : [correctAnswer.continente, ...shuffle(all.filter(c => c !== correctAnswer.continente)).slice(0, 3)];
                displayTextOptions(shuffle(opts));
            }
        },
        'NomePorBandeira': {
            title: "De que País é?",
            setup: () => {
                elements.memoryGame.classList.add('hidden');
                const pool = gameState.availableCountries;
                if (!gameState.duel && pool.length === 0) { handleLevelComplete(); return; }
                correctAnswer = pickRoundCountry(pool);
                if (!correctAnswer) { finishDuel(); return; }

                elements.instruction.textContent = 'De qual país é esta bandeira?';
                const media = document.getElementById('question-media');
                if (media) {
                    media.innerHTML = `<img src="assets/flags/${correctAnswer.codigo}.png" alt="bandeira">`;
                    media.classList.remove('hidden');
                }

                const opts = gameState.duel ? duelOpts() : [correctAnswer, ...wrongOptions(countries, 3)];
                displayNameOptions(shuffle(opts));
            }
        },
        'Mapa': {
            title: "Que Formato é?",
            setup: () => {
                elements.memoryGame.classList.add('hidden');
                const pool = gameState.availableCountries;
                if (!gameState.duel && pool.length === 0) { handleLevelComplete(); return; }
                correctAnswer = pickRoundCountry(pool);
                if (!correctAnswer) { finishDuel(); return; }

                elements.instruction.textContent = `Toque no contorno ${correctAnswer.artigo} ${correctAnswer.nome}`;
                playAudio(`mapa/${correctAnswer.codigo}`);
                const media = document.getElementById('question-media');
                if (media) { media.innerHTML = `<img src="${itemImg(correctAnswer)}" alt="bandeira">`; media.classList.remove('hidden'); }

                const opts = shuffle(gameState.duel ? duelOpts() : [correctAnswer, ...wrongOptions(countries, 3)]);
                elements.options.classList.remove('hidden');
                elements.options.innerHTML = '';
                elements.options.className = 'options-container shape-options';
                opts.forEach(c => {
                    const w = document.createElement('div'); w.className = 'option-wrapper';
                    const b = document.createElement('div'); b.className = 'flag-option shape-option';
                    b.dataset.codigo = c.codigo; b.dataset.type = 'shape';
                    b.innerHTML = `<img src="assets/shapes/${c.codigo}.svg" alt="" onerror="this.closest('.option-wrapper').remove()">`;
                    b.addEventListener('click', handleOptionClick);
                    w.appendChild(b); elements.options.appendChild(w);
                });
            }
        },
        'Forca': {
            title: "A Lendária Forca",
            setup: () => setupForca()
        },
        'Memoria': {
            title: "Jogo da Memória",
            setup: () => setupMemoryGame()
        }
    };

    // ─── FORCA ───────────────────────────────────────────
    let forcaState = null;
    const FORCA_MAX = 6;
    function stripAccent(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }

    function setupForca() {
        elements.memoryGame.classList.add('hidden');
        elements.options.classList.add('hidden');
        const box = document.getElementById('forca-container');
        box.classList.remove('hidden');
        const media = document.getElementById('question-media');
        if (media) { media.classList.add('hidden'); media.innerHTML = ''; }

        const pool = gameState.availableCountries;
        if (pool.length === 0) { handleLevelComplete(); return; }
        correctAnswer = pickRoundCountry(pool);

        const display = correctAnswer.nome.toUpperCase();
        forcaState = { display, plain: stripAccent(display), guessed: new Set(), wrong: 0 };
        elements.instruction.textContent = 'Adivinhe o país letra por letra';
        const nLetras = display.replace(/\s/g, '').length;
        document.getElementById('forca-hint').textContent =
            `O continente é ${correctAnswer.continente}. Tem ${nLetras} letras.`;
        playAudio('testes/forca_intro');
        renderForca();
    }

    function renderForca() {
        const s = forcaState;
        const svg = document.getElementById('forca-svg');
        if (svg) {
            svg.dataset.wrong = s.wrong;
            svg.querySelectorAll('.fp').forEach(el => {
                const cls = [...el.classList].find(c => /^fp[1-6]$/.test(c));
                const part = cls ? +cls.slice(2) : 9;
                el.style.opacity = part <= s.wrong ? '1' : '0';
            });
        }
        document.getElementById('forca-wrong').textContent = `❌ ${s.wrong}/${FORCA_MAX}`;

        const wordEl = document.getElementById('forca-word');
        wordEl.innerHTML = '';
        [...s.display].forEach((ch, i) => {
            const plain = s.plain[i];
            const sp = document.createElement('span');
            if (ch === ' ') { sp.className = 'fw-space'; }
            else {
                sp.className = 'fw-slot';
                sp.textContent = s.guessed.has(plain) ? ch : '';
                if (s.guessed.has(plain)) sp.classList.add('filled');
            }
            wordEl.appendChild(sp);
        });

        const keys = document.getElementById('forca-keys');
        keys.innerHTML = '';
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(L => {
            const b = document.createElement('button');
            b.className = 'fk'; b.textContent = L;
            const used = s.guessed.has(L);
            if (used) b.classList.add(s.plain.includes(L) ? 'hit' : 'miss'), b.disabled = true;
            if (gameLocked) b.disabled = true;
            b.addEventListener('click', () => forcaGuess(L));
            keys.appendChild(b);
        });
    }

    function forcaGuess(L) {
        const s = forcaState;
        if (!s || gameLocked || s.guessed.has(L)) return;
        s.guessed.add(L);
        const hit = s.plain.includes(L);
        if (window.SFX) window.SFX.play(hit ? 'tap' : 'wrong');
        if (!hit) s.wrong++;

        const solved = [...s.plain].every(ch => ch === ' ' || s.guessed.has(ch));
        const lost = s.wrong >= FORCA_MAX;
        renderForca();

        const responseMs = roundStartAt ? Date.now() - roundStartAt : null;
        if (solved || lost) {
            gameLocked = true;
            updateCountryStats(correctAnswer.codigo, solved, responseMs);
            if (solved) {
                playSound('win'); gameState.streak++;
                const pts = Math.max(2, 12 - s.wrong * 2) + (gameState.streak > 1 ? gameState.streak : 0);
                gameState.score += pts;
                if (gameState.streak === 15) grantBonusPack('streak15', 1, 'Sequência de 15!');
                elements.feedback.textContent = `Boa! ${correctAnswer.nome} (+${pts} pts)`;
                elements.feedback.style.color = '#32CD32';
                if (!correctAnswer._kind) setTimeout(() => playAudio(`nomes_paises/${correctAnswer.nome}`), 250);
                if (!calmMode && typeof confetti !== 'undefined') {
                    confetti({ particleCount: 110, spread: 78, startVelocity: 38, origin: { y: 0.45 } });
                }
            } else {
                playSound('wrong'); gameState.streak = 0;
                if (gameConfig.lives !== 'infinite') gameState.chances--;
                // revela a palavra
                s.guessed = new Set(s.plain.split(''));
                renderForca();
                elements.feedback.textContent = `Era ${correctAnswer.artigo} ${correctAnswer.nome}.`;
                elements.feedback.style.color = '#FF6347';
                queueReview(correctAnswer.codigo);
            }
            if (solved) gameState.availableCountries = gameState.availableCountries.filter(c => c.codigo !== correctAnswer.codigo);
            buttons.hint.classList.add('hidden');
            buttons.next.classList.remove('hidden'); buttons.facts.classList.remove('hidden');
            updateStats(); updateProgressBar();
            if (gameState.chances === 0 && gameConfig.lives !== 'infinite') { setTimeout(() => gameOver(false), 1200); return; }
            if (gameState.availableCountries.length === 0) setTimeout(handleLevelComplete, 1200);
        }
    }

    function setupStandardRound(cb, type) { prepareStandardLogic(cb, type, false); }

    // opções gravadas no desafio (mesmas pros dois jogadores)
    function duelOpts() {
        const q = gameState.duel.questions[gameState.duelIdx] || { opts: [] };
        if (gameConfig.mode === 'ContinentePorPais') return q.opts.slice();
        return q.opts.map(albumItem).filter(Boolean);
    }

    function prepareStandardLogic(cb, type, random) {
        elements.memoryGame.classList.add('hidden');
        let pool = gameState.availableCountries;
        if (!gameState.duel && pool.length === 0) { handleLevelComplete(); return; }

        correctAnswer = (random && !gameState.duel) ? shuffle([...pool])[0] : pickRoundCountry(pool);
        if (!correctAnswer) { finishDuel(); return; }
        const base = gameState._base || countries;
        const opts = gameState.duel ? duelOpts() : [correctAnswer, ...wrongOptions(base, 3)];

        cb(correctAnswer); displayFlagOptions(shuffle(opts), false);
    }

    // --- FLUXO PRINCIPAL ---
    function startGame(conf) {
        gameConfig = conf;
        session = { correct: 0, wrong: 0, mastered: 0, missed: {} };
        document.getElementById('learn-summary').classList.add('hidden');
        showScreen('game');
        screens.game.classList.remove('game-over-view');
        elements.options.classList.remove('hidden');
        const fb = document.getElementById('forca-container');
        if (fb) fb.classList.toggle('hidden', conf.mode !== 'Forca');
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

            // "Qual a Bandeira?" pode usar países, estados do Brasil, ou os dois
            const poolKind = (gameConfig.mode === 'BandeiraPorPais') ? (gameConfig.pool || 'paises') : 'paises';
            let base;
            if (poolKind === 'estados') base = [...ESTADO_ITEMS];
            else if (poolKind === 'ambos') base = [...countries, ...ESTADO_ITEMS];
            else base = [...countries];

            const byLevel = (gameConfig.type === 'Rápido' || gameConfig.type === 'Jornada');
            // estados não têm nível -> entram sempre
            let pool = byLevel ? base.filter(c => c.nivel === sl || c._kind === 'flag') : base;
            if (!pool.length) pool = base;

            gameState = {
                score: 0, streak: 0,
                chances: gameConfig.lives === 'infinite' ? '♾️' : gameConfig.lives,
                currentLevel: sl, availableCountries: pool, totalQuestionsInLevel: pool.length,
                attemptsThisRound: 0, _base: base, roundNum: 0, review: []
            };

            // DESAFIO ENTRE AMIGOS — perguntas fixas
            if (conf.duel) {
                const qs = conf.duel.questions || [];
                gameState.duel = conf.duel;
                gameState.duelIdx = 0;
                gameState.duelTotal = qs.length;
                gameState.availableCountries = qs.map(q => albumItem(q.code)).filter(Boolean);
                gameState.totalQuestionsInLevel = qs.length;
                gameState._base = [...countries, ...ESTADO_ITEMS];
            }
        }
        updateStats(); updateProgressBar(); nextRound();
    }

    function nextRound() {
        if (gameState.chances === 0 && gameConfig.lives !== 'infinite') { gameOver(false); return; }

        gameState.roundNum = (gameState.roundNum || 0) + 1;
        if (gameState.duel) {
            gameState.duelIdx = gameState.roundNum - 1;
            if (gameState.duelIdx >= gameState.duelTotal) { finishDuel(); return; }
        }
        gameState.hintsUsed = 0;
        buttons.facts.classList.add('hidden'); buttons.next.classList.add('hidden');
        buttons.hint.classList.toggle('hidden', !HINT_MODES.includes(gameConfig.mode));
        elements.feedback.textContent = '';
        elements.feedback.className = 'feedback';
        gameLocked = false; gameState.attemptsThisRound = 0;
        roundStartAt = Date.now();

        const replay = document.getElementById('replay-audio-btn');
        if (replay) replay.hidden = ['Memoria', 'NomePorBandeira'].includes(gameConfig.mode);
        const media = document.getElementById('question-media');
        const keepMedia = ['NomePorBandeira', 'Mapa'].includes(gameConfig.mode);
        if (media && !keepMedia) { media.classList.add('hidden'); media.innerHTML = ''; }

        const forcaBox = document.getElementById('forca-container');
        if (forcaBox) forcaBox.classList.toggle('hidden', gameConfig.mode !== 'Forca');
        elements.options.classList.remove('shape-options');

        gameModes[gameConfig.mode].setup();

        if (gameState.duel && gameState.duel.live) { buttons.hint.classList.add('hidden'); startQTimer(); }
    }

    // Clique Opção
    function handleOptionClick(e) {
        if (gameLocked) return;
        const el = e.target.closest('.flag-option') || e.target.closest('.text-option');
        if (!el) return;

        const type = el.dataset.type;
        let isCor;
        if (type === 'flag' || type === 'shape') isCor = el.dataset.codigo === correctAnswer.codigo;
        else if (gameConfig.mode === 'ContinentePorPais') isCor = el.dataset.continente === correctAnswer.continente;
        else isCor = el.dataset.codigo === correctAnswer.codigo; // NomePorBandeira
        const val = el.dataset.codigo || el.dataset.continente;
        const responseMs = roundStartAt ? Date.now() - roundStartAt : null;

        // registra a resposta para o país da rodada (algoritmo de aprendizado)
        if (correctAnswer && correctAnswer.codigo) updateCountryStats(correctAnswer.codigo, isCor, responseMs);
        buttons.hint.classList.add('hidden');

        if (isCor) {
            playSound('win');
            gameLocked = true; gameState.streak++;
            if (gameState.streak === 5 || gameState.streak === 10 || gameState.streak === 20) {
                if (window.SFX) window.SFX.play('streak');
            }
            if (gameState.streak === 15) grantBonusPack('streak15', 1, 'Sequência de 15!');
            let pts = Math.max(1, 10 - (gameState.attemptsThisRound * 2)) + (gameState.streak > 1 ? gameState.streak : 0);
            gameState.score += pts;

            if (!gameState.duel) gameState.availableCountries = gameState.availableCountries.filter(c => c.codigo !== correctAnswer.codigo);
            document.querySelectorAll('.flag-option, .text-option').forEach(x => x.classList.add('disabled'));
            el.classList.remove('disabled'); el.classList.add('correct');

            elements.feedback.textContent = `Boa! (+${pts} pts)`; elements.feedback.style.color = '#32CD32';
            buttons.next.classList.remove('hidden'); buttons.facts.classList.remove('hidden');
            updateStats(); updateProgressBar();

            if (!gameState.duel && gameState.availableCountries.length === 0) setTimeout(handleLevelComplete, 1000);
        } else {
            playSound('wrong'); el.classList.add('wrong', 'disabled'); gameState.streak = 0;
            if (gameConfig.lives !== 'infinite') gameState.chances--;
            gameState.attemptsThisRound++;
            if (correctAnswer && correctAnswer.codigo) queueReview(correctAnswer.codigo);

            if (type === 'shape') {
                document.querySelectorAll('.shape-option').forEach(o => {
                    o.classList.add('disabled');
                    if (o.dataset.codigo === correctAnswer.codigo) o.classList.add('correct');
                });
                elements.feedback.textContent = `Ops! O contorno ${correctAnswer.artigo} ${correctAnswer.nome} é o verde.`;
                buttons.next.classList.remove('hidden');
                gameLocked = true;
            } else if (type === 'flag') {
                document.querySelectorAll('.flag-option').forEach(o => {
                    o.classList.add('disabled');
                    if (o.dataset.codigo === correctAnswer.codigo) o.classList.add('correct');
                });
                const isLive = gameState.duel && gameState.duel.live;
                if (!isLive) {
                    const c = countries.find(x => x.codigo === val);
                    document.getElementById('constructive-img-wrong').src = `assets/flags/${val}.png`;
                    document.getElementById('constructive-name-wrong').textContent = c ? c.nome : 'Desconhecido';
                    document.getElementById('constructive-img-right').src = `assets/flags/${correctAnswer.codigo}.png`;
                    document.getElementById('constructive-name-right').textContent = correctAnswer.nome;
                    const tip = flagTip(correctAnswer.codigo, val);
                    const tipEl = document.getElementById('constructive-text');
                    if (tipEl) tipEl.textContent = tip || 'Repare na diferença entre as duas:';
                    document.getElementById('constructive-feedback-modal').classList.remove('hidden');
                    elements.feedback.textContent = tip ? '💡 Dica pra não errar de novo' : 'Atenção à diferença!';
                } else {
                    elements.feedback.textContent = `Era ${correctAnswer.artigo} ${correctAnswer.nome}.`;
                }
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

            // desafio: uma tentativa por pergunta — trava e mostra "Próxima"
            if (gameState.duel && !gameState.duel.live && type !== 'flag') {
                gameLocked = true;
                document.querySelectorAll('.flag-option, .text-option, .shape-option').forEach(x => x.classList.add('disabled'));
                buttons.next.classList.remove('hidden');
            }

            if (gameState.chances === 0 && gameConfig.lives !== 'infinite') setTimeout(() => gameOver(false), 1000);
            updateStats();
        }

        // DUELO AO VIVO: sem "Próxima", mantém o ritmo — anda sozinho
        if (gameState.duel && gameState.duel.live && !gameState._duelDone) liveAfterAnswer(isCor);
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

        // ajusta a fonte dos nomes pra caber sem quebrar feio
        requestAnimationFrame(() => {
            elements.memoryGrid.querySelectorAll('.memory-text').forEach(t => {
                let size = parseFloat(getComputedStyle(t).fontSize);
                let guard = 0;
                while ((t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1) && size > 6 && guard++ < 12) {
                    size -= 0.7;
                    t.style.fontSize = size + 'px';
                }
            });
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
        markModePlayed(gameConfig.mode);
        if (gameConfig.mode === 'Memoria') grantBonusPack('memoria', 1, 'Tabuleiro da Memória completo!');
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
        buttons.hint.classList.add('hidden');
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

        renderLearnSummary();
        speakText(win ? `Incrível ${currentUser}! Você venceu.` : `Bom jogo ${currentUser}. Tente novamente.`);
        saveGlobalScore(gameState.score);
        // conta como "modo jogado hoje" se realmente jogou (respondeu algo)
        const jogou = (session.correct + session.wrong) > 0 || (typeof memoryMoves === 'number' && memoryMoves > 0);
        if (jogou) markModePlayed(gameConfig.mode);
        if (win) {
            markModeWon(gameConfig.mode);
            // meta "jornada": terminar uma partida nível 3+ com vidas LIMITADAS
            // (5 ou 10 -- infinito não vale). Jornada de verdade é sempre vidas
            // infinitas (forçado no setup), então isso só acontece no Rápido.
            if (typeof gameConfig.lives === 'number' && (gameConfig.level || 0) >= 3) {
                grantBonusPack('jornada', 1, 'Terminou nível 3+ com vidas limitadas!');
            }
        }
    }

    function renderLearnSummary() {
        const box = document.getElementById('learn-summary');
        if (!box) return;
        const tot = session.correct + session.wrong;
        const missed = Object.entries(session.missed)
            .sort((a, b) => b[1] - a[1]).slice(0, 3)
            .map(([code]) => (albumItem(code) || {}).nome).filter(Boolean);
        box.innerHTML = `
            <h3>O que rolou nesta partida</h3>
            <div class="ls-row">
                <span><b>${session.correct}</b>/${tot} acertos</span>
                ${session.mastered ? `<span class="ls-good"><b>${session.mastered}</b> ${session.mastered === 1 ? 'bandeira dominada' : 'bandeiras dominadas'} 🏅</span>` : ''}
            </div>
            ${missed.length ? `<p class="ls-review">Revisar depois: <b>${missed.join(' · ')}</b></p>` : (tot ? '<p class="ls-review">Sem erros nessa! 👏</p>' : '')}`;
        box.classList.toggle('hidden', tot === 0);
    }

    function showScreen(key) {
        const prev = showScreen._current;
        Object.values(screens).forEach(s => s.classList.add('hidden'));
        screens[key].classList.remove('hidden');
        showScreen._current = key;
        if (!showScreen._navlock && key !== prev) {
            try { history.pushState({ screen: key }, ''); } catch (e) {}
        }
        updateAppNav(key);
        if (key !== 'game') setTimeout(flushAchievementQueue, 350);
        if (key === 'main') refreshHub();
        if (key === 'album' && typeof renderAlbum === 'function') renderAlbum();
        if (showScreen._ready && window.SFX) window.SFX.play('whoosh');
        showScreen._ready = true;
        try { elements.mainContainer.scrollTop = 0; window.scrollTo(0, 0); } catch (e) {}
    }

    // --- BOTÃO "VOLTAR" DO NAVEGADOR: nunca sai do app ---
    (function wireHardwareBack() {
        const BACK_TO = {
            game: 'main', setup: 'main', album: 'main', passport: 'main', trades: 'main', duels: 'main', admin: 'main', live: 'duels',
            kpHost: 'main', kpJoin: 'main', kpCtrl: 'main',
            partyLobbyHost: 'main', partyJoinClient: 'main', partyWaitClient: 'main',
            partyGameHost: 'main', partyGameClient: 'main', partyLeaderboardHost: 'main',
        };
        try { history.replaceState({ screen: showScreen._current || 'profile' }, ''); } catch (e) {}
        // deixa uma entrada "colchão" pra 1ª tela também ter pra onde voltar
        try { history.pushState({ screen: showScreen._current || 'profile' }, ''); } catch (e) {}

        window.addEventListener('popstate', () => {
            // 1) tem modal / zoom aberto? o "voltar" só fecha ele
            const openModal = document.querySelector('.modal-backdrop:not(.hidden), #fig-zoom:not(.hidden)');
            if (openModal) {
                openModal.classList.add('hidden');
                try { history.pushState({ screen: showScreen._current }, ''); } catch (e) {}
                return;
            }
            const cur = showScreen._current;
            const dest = BACK_TO[cur];
            // sair de uma sala "Conhecimento é Poder" pelo voltar do navegador
            if ((cur === 'kpHost' || cur === 'kpCtrl' || cur === 'kpJoin') && typeof _kp !== 'undefined' && _kp) {
                showScreen._navlock = true;
                try { kpLeave(true); } catch (e) { showScreen('main'); }
                showScreen._navlock = false;
                try { history.pushState({ screen: showScreen._current }, ''); } catch (e) {}
                return;
            }
            showScreen._navlock = true;
            if (dest && dest !== cur) {
                showScreen(dest);
            } else {
                showToast('Você já está no início. Toque em "Sair" pra trocar de conta.', 'info', 2600);
            }
            showScreen._navlock = false;
            try { history.pushState({ screen: showScreen._current }, ''); } catch (e) {}
        });
    })();

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
        const adm = document.getElementById('hub-admin-btn');
        if (adm) adm.hidden = !(window.DG_ONLINE && Auth.isAdmin && Auth.isAdmin());

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
            let cur, tot;
            if (gameState.duel) {
                elements.stat3.textContent = `📍 ${Math.min(gameState.roundNum || 1, gameState.duelTotal)}/${gameState.duelTotal}`;
                cur = gameState.duelIdx; tot = gameState.duelTotal;
            } else {
                elements.stat3.textContent = gameConfig.lives === 'infinite' ? `❤️ ∞` : `❤️ ${gameState.chances}`;
                cur = gameState.totalQuestionsInLevel - gameState.availableCountries.length;
                tot = gameState.totalQuestionsInLevel || 1;
            }
            updateProgressBar((cur / tot) * 100);
        }
    }

    function updateProgressBar(p) { if (p > 100) p = 100; elements.progressBar.style.width = `${p}%`; }

    function displayFlagOptions(opts, n) {
        elements.options.innerHTML = '';
        opts.forEach(c => {
            const w = document.createElement('div'); w.className = 'option-wrapper';
            const i = document.createElement('img'); i.src = itemImg(c);
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

    // "vozes" (narradora) — liga/desliga separado dos efeitos
    let voiceOn = true;
    try { voiceOn = localStorage.getItem('dg_voice') !== 'off'; } catch (e) {}

    function playAudio(p, force) {
        lastAudioPath = p;
        if (!voiceOn && !force) return;
        const c = p.toLowerCase().replace(/ /g, '_').replace(/\./g, '');
        const a = new Audio(`assets/audio/${c}.mp3`);
        a.play().catch(e => { });
    }

    (function wireReplayAudio() {
        const btn = document.getElementById('replay-audio-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (lastAudioPath) {
                playAudio(lastAudioPath, true);   // botão "ouvir de novo" = ação explícita
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
        const u = window.DG_ONLINE ? API._sync.ach()
            : (JSON.parse(localStorage.getItem(`detetive_achievements_${currentUser}`)) || []);

        const achs = [
            { id: '1', t: 'Primeiro Passo', desc: 'Acertou sua primeira bandeira! (+1 Pacote)', packs: 1, c: x => Object.values(x).some(v => v.acertos > 0) },
            { id: '10', t: 'Explorador', desc: 'Acertou 10 bandeiras diferentes! (+1 Pacote)', packs: 1, c: x => Object.values(x).filter(v => v.acertos > 0).length >= 10 },
            { id: '50', t: 'Mochileiro', desc: 'Acertou 50 bandeiras diferentes! (+2 Pacotes)', packs: 2, c: x => Object.values(x).filter(v => v.acertos > 0).length >= 50 },
            { id: 'perfect', t: 'Intocável', desc: 'Fez uma sequência de 20 acertos em um país! (+3 Pacotes)', packs: 3, c: x => Object.values(x).some(v => v.streak >= 20) },
            { id: 'master', t: 'Mestre Geográfico', desc: 'Fez 100 acertos no total! (+5 Pacotes)', packs: 5, c: x => Object.values(x).reduce((acc, curr) => acc + curr.acertos, 0) >= 100 }
        ];

        // missão FIXA (não diária, nunca reseta): cada 2 bandeiras DOMINADAS
        // (mastery>=85) rende 1 pacote, pra sempre. Gera ids sintéticos
        // "mastery2","mastery4",... só até o total atual -- cada um dispara UMA
        // vez (o `!u.includes(a.id)` abaixo já garante isso), então reaproveita
        // 100% do armazenamento de conquistas (online e offline) sem nada novo.
        const totalMastered = Object.values(p).filter(v => (v.mastery || 0) >= 85).length;
        for (let n = 2; n <= totalMastered; n += 2) {
            achs.push({
                id: 'mastery' + n, t: 'Colecionador de Bandeiras',
                desc: `Dominou ${n} bandeiras! (+1 Pacote)`, packs: 1, c: () => true,
            });
        }

        achs.forEach(a => {
            if (!u.includes(a.id) && a.c(p)) {
                u.push(a.id);
                if (window.DG_ONLINE) API.addAchievement(a.id);
                else localStorage.setItem(`detetive_achievements_${currentUser}`, JSON.stringify(u));
                if (a.packs > 0 && typeof addPacks === 'function') addPacks(a.packs);
                if (window.SFX) window.SFX.play('achievement');
                if (showScreen._current === 'game') {
                    // não interrompe a partida — avisa com um toast e guarda o modal pro fim
                    showToast(`🏅 Conquista: ${a.t}`, 'success', 3500);
                    _achQueue.push(a);
                } else {
                    _achQueue.push(a);
                    flushAchievementQueue();
                }
            }
        });
    }

    let _achQueue = [];
    function flushAchievementQueue() {
        if (!_achQueue.length || !modals.achievement.classList.contains('hidden')) return;
        const a = _achQueue.shift();
        elements.achievementText.innerHTML = `<strong>${a.t}</strong><br><span style="font-size:0.8em; color:#555;">${a.desc}</span>`;
        modals.achievement.classList.remove('hidden');
        dispararConfetes();
    }

    function dispararConfetes() {
        if (typeof confetti === 'undefined') return;
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

    const SIGNUP_OPEN = !window.DG_ONLINE || (window.DG_CONFIG && window.DG_CONFIG.ALLOW_SIGNUP);
    if (!SIGNUP_OPEN) {
        // esconde a aba "Criar conta"
        authTabs.forEach(t => { if (t.dataset.tab === 'signup') t.style.display = 'none'; });
        const at = document.querySelector('.auth-tabs');
        if (at) at.classList.add('single');
    }

    function setAuthMode(mode) {
        if (mode === 'signup' && !SIGNUP_OPEN) mode = 'login';
        authMode = mode;
        authTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === mode));
        document.querySelectorAll('[data-signup]').forEach(el => el.classList.toggle('hidden', mode !== 'signup'));
        if (authSubmit) authSubmit.textContent = mode === 'signup' ? 'Criar conta e entrar' : 'Entrar';
        if (authPass) authPass.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
        hideAuthError();
        if (mode === 'login' && !SIGNUP_OPEN && window.DG_CONFIG && window.DG_CONFIG.SIGNUP_CLOSED_MSG) {
            const h = document.getElementById('auth-signup-hint');
            if (h) h.textContent = window.DG_CONFIG.SIGNUP_CLOSED_MSG;
        }
    }

    function renderAuthAccounts() {
        const wrap = document.getElementById('auth-accounts');
        if (!wrap) return;
        const accts = Auth.list();
        if (!accts.length) { wrap.innerHTML = ''; wrap.classList.add('hidden'); return; }
        wrap.classList.remove('hidden');
        wrap.innerHTML = `<p class="auth-accounts-label">${window.DG_ONLINE ? 'Entrar de novo como' : 'Contas neste aparelho'}</p>`;
        const row = document.createElement('div');
        row.className = 'auth-accounts-row';
        accts.forEach(a => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'auth-account-chip';
            chip.innerHTML = `<span class="aa-avatar">${a.avatar}</span><span class="aa-name"></span><span class="aa-remove" title="Esquecer">✕</span>`;
            chip.querySelector('.aa-name').textContent = a.name;
            chip.addEventListener('click', (e) => {
                if (e.target.classList.contains('aa-remove')) {
                    const msg = window.DG_ONLINE
                        ? `Esquecer "${a.name}" deste aparelho? (a conta na nuvem continua)`
                        : `Remover "${a.name}" deste aparelho? O progresso salvo aqui será apagado.`;
                    if (confirm(msg)) {
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
        await enterAfterAuth(res.name, res.avatar);
    });

    // porta de entrada: 1º acesso com senha temporária -> obriga a criar a senha
    let _pendAuth = null;
    async function enterAfterAuth(name, avatar) {
        if (window.DG_ONLINE && Auth.needsPasswordChange && Auth.needsPasswordChange()) {
            _pendAuth = { name, avatar };
            document.getElementById('spw-1').value = '';
            document.getElementById('spw-2').value = '';
            document.getElementById('spw-error').classList.add('hidden');
            showScreen('setpw');
            setTimeout(() => document.getElementById('spw-1').focus(), 60);
            return;
        }
        await selectProfile(name, avatar);
    }

    (function wireSetPassword() {
        const b = document.getElementById('spw-save');
        if (!b) return;
        const err = (m) => { const e = document.getElementById('spw-error'); e.textContent = m; e.classList.remove('hidden'); };
        b.addEventListener('click', async () => {
            const p1 = document.getElementById('spw-1').value;
            const p2 = document.getElementById('spw-2').value;
            if (p1.length < 6) return err('A senha precisa ter pelo menos 6 caracteres.');
            if (p1 !== p2) return err('As duas senhas não são iguais.');
            b.disabled = true; b.textContent = 'Salvando…';
            const r = await Auth.changeMyPassword(p1);
            b.disabled = false; b.textContent = 'Salvar e entrar';
            if (r.error) return err(r.error);
            const who = _pendAuth || { name: Auth.currentName(), avatar: '🌍' };
            _pendAuth = null;
            showToast('Senha criada! 🔐', 'success');
            await selectProfile(who.name, who.avatar);
        });
        const cancel = document.getElementById('spw-cancel');
        if (cancel) cancel.addEventListener('click', async () => {
            _pendAuth = null;
            try { await Auth.logout(); } catch (e) {}
            currentUser = null;
            try { localStorage.removeItem('currentUser'); } catch (e) {}
            showScreen('profile');
        });
    })();

    // Menu de som: efeitos e vozes desligáveis separadamente
    (function wireSoundToggle() {
        const btn = document.getElementById('sound-toggle');
        const menu = document.getElementById('sound-menu');
        const cbSfx = document.getElementById('opt-sfx');
        const cbVoice = document.getElementById('opt-voice');
        if (!btn) return;
        const sfxOn = () => !!(window.SFX && window.SFX.enabled);
        const paint = () => {
            btn.textContent = (sfxOn() || voiceOn) ? '🔊' : '🔇';
            btn.classList.toggle('muted', !(sfxOn() || voiceOn));
            if (cbSfx) cbSfx.checked = sfxOn();
            if (cbVoice) cbVoice.checked = voiceOn;
        };
        paint();
        btn.addEventListener('click', e => {
            e.stopPropagation();
            if (menu) menu.classList.toggle('hidden');
        });
        if (cbSfx) cbSfx.addEventListener('change', () => {
            if (window.SFX) window.SFX.enabled = cbSfx.checked;
            if (cbSfx.checked && window.SFX) window.SFX.play('toggle');
            paint();
        });
        if (cbVoice) cbVoice.addEventListener('change', () => {
            voiceOn = cbVoice.checked;
            try { localStorage.setItem('dg_voice', voiceOn ? 'on' : 'off'); } catch (_) {}
            paint();
        });
        document.addEventListener('click', e => {
            if (menu && !menu.classList.contains('hidden') && !e.target.closest('.sound-wrap')) {
                menu.classList.add('hidden');
            }
        });
    })();

    // ─── botão "Instalar app" no hub (Android/Chrome/Edge) ───
    // O navegador dispara "beforeinstallprompt" quando o PWA já cumpre os
    // requisitos (manifest + service worker + https) e ainda não tá instalado.
    // Guardamos o evento e só mostramos o botão nesse momento -- sem isso,
    // não tem como abrir o prompt nativo de instalação na hora que a pessoa
    // quiser (só dá uma vez, tem que ser direto no clique do usuário).
    // iOS Safari não dispara esse evento (Apple não suporta) -- por isso o
    // botão nunca aparece lá; nesse caso a pessoa instala pelo menu
    // "Compartilhar → Adicionar à Tela de Início" mesmo, manual.
    (function wireInstallApp() {
        const btn = document.getElementById('install-app-btn');
        if (!btn) return;
        let deferredPrompt = null;
        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            deferredPrompt = e;
            btn.hidden = false;
        });
        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            btn.hidden = true;
            showToast('App instalado! Já pode abrir pelo ícone. 🎉', 'success');
        });
        btn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            btn.disabled = true;
            deferredPrompt.prompt();
            try { await deferredPrompt.userChoice; } catch (e) {}
            deferredPrompt = null;
            btn.hidden = true;
            btn.disabled = false;
        });
    })();

    // Botão "Sair" (no menu principal) → volta para o login
    buttons.changeProfile.addEventListener('click', () => {
        Auth.logout();
        localStorage.removeItem('currentUser');
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

    if(buttons.backToMenu) buttons.backToMenu.addEventListener('click', () => {
        // no duelo ao vivo, sair no meio = desistir (o adversário vence)
        if (_live && (_live.phase === 'playing' || _live.phase === 'countdown') && !_live.iAmDone && !_live.resultShown) {
            if (!confirm('Sair agora conta como derrota no duelo. Sair mesmo?')) return;
            // só sai — o cliente do adversário detecta e vence por W.O.
            liveCleanup();
            elements.mainContainer.classList.remove('memory-mode');
            showScreen('duels'); renderLiveDuels();
            return;
        }
        if (_live) { liveCleanup(); }
        elements.mainContainer.classList.remove('memory-mode'); showScreen('main');
    });
    
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
    if(buttons.hint) buttons.hint.addEventListener('click', useHint);
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
    buttons.closeAchievement.addEventListener('click', () => {
        modals.achievement.classList.add('hidden');
        setTimeout(flushAchievementQueue, 250);
    });
    buttons.closeRanking.addEventListener('click', () => modals.ranking.classList.add('hidden'));

    // rede de segurança: tocar na área escura fecha qualquer modal;
    // Esc também. (o pacote e o zoom têm regras próprias e ficam de fora)
    const MODAL_KEEP_OPEN = ['pack-modal', 'fig-zoom', 'avatar-picker-modal'];
    document.querySelectorAll('.modal-backdrop').forEach(bd => {
        if (MODAL_KEEP_OPEN.includes(bd.id)) return;
        bd.addEventListener('click', e => {
            if (e.target !== bd) return;
            bd.classList.add('hidden');
            setTimeout(flushAchievementQueue, 250);
        });
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(bd => {
            if (!MODAL_KEEP_OPEN.includes(bd.id)) bd.classList.add('hidden');
        });
        setTimeout(flushAchievementQueue, 250);
    });

    // Passaporte e Ranking
    let rankFilter = 'Todos';
    let rankPeriod = 'sempre';
    async function renderRanking(filter, period) {
        rankFilter = filter || 'Todos';
        if (period) rankPeriod = period;
        let raw = [];
        try { raw = await API.getRanking(rankFilter); } catch (e) {}
        if (!raw || !raw.length) raw = JSON.parse(localStorage.getItem('ranking_global')) || [];
        const modes = [...new Set(raw.map(r => r.mode).filter(Boolean))];

        // chips de filtro (modo + período)
        const fbox = document.getElementById('ranking-filter');
        if (fbox) {
            const periodChips = [['sempre', 'Sempre'], ['semana', '7 dias'], ['hoje', 'Hoje']].map(([k, lab]) =>
                `<button class="rk-chip rk-chip-p${k === rankPeriod ? ' on' : ''}" data-p="${k}">${lab}</button>`).join('');
            fbox.innerHTML = periodChips + '<span class="rk-sep"></span>'
                + ['Todos', ...modes].map(m =>
                    `<button class="rk-chip${m === rankFilter ? ' on' : ''}" data-m="${m}">${m === 'Todos' ? 'Geral' : m}</button>`).join('');
            fbox.querySelectorAll('.rk-chip[data-m]').forEach(b => b.onclick = () => renderRanking(b.dataset.m));
            fbox.querySelectorAll('.rk-chip[data-p]').forEach(b => b.onclick = () => renderRanking(rankFilter, b.dataset.p));
        }

        const cut = rankPeriod === 'hoje' ? Date.now() - 864e5
            : rankPeriod === 'semana' ? Date.now() - 7 * 864e5 : 0;
        let scoped = raw.filter(r => (rankFilter === 'Todos' || r.mode === rankFilter)
            && (!cut || new Date(r.played_at || 0).getTime() >= cut));
        // 1 linha por jogador: guarda só a melhor pontuação
        const best = {};
        scoped.forEach(r => { if (!best[r.nome] || r.score > best[r.nome].score) best[r.nome] = r; });
        const l = Object.values(best).sort((a, b) => b.score - a.score);

        const podium = document.getElementById('rk-podium');
        const list = document.getElementById('ranking-list');
        if (!l.length) {
            if (podium) podium.innerHTML = '';
            list.innerHTML = '<p class="rk-empty">Nenhum detetive nesta categoria ainda. Jogue uma partida!</p>';
            return;
        }
        const medal = ['🥇', '🥈', '🥉'];
        if (podium) {
            podium.innerHTML = l.slice(0, 3).map((r, i) =>
                `<div class="rk-pod rk-pod-${i + 1}${r.nome === currentUser ? ' me' : ''}">
                    <span class="rk-medal">${medal[i]}</span>
                    <span class="rk-pod-name">${r.nome}</span>
                    <span class="rk-pod-score">${r.score}</span>
                </div>`).join('');
        }
        list.innerHTML = l.slice(3, 30).map((r, i) =>
            `<div class="rk-row${r.nome === currentUser ? ' me' : ''}">
                <span class="rk-pos">${i + 4}</span>
                <span class="rk-name">${r.nome}</span>
                <span class="rk-score">${r.score}</span>
            </div>`).join('') || '';
        // se você não está no top 30, mostra sua melhor posição
        const myIdx = l.findIndex(r => r.nome === currentUser);
        if (myIdx >= 30) {
            const r = l[myIdx];
            list.innerHTML += `<div class="rk-row me rk-far"><span class="rk-pos">${myIdx + 1}</span><span class="rk-name">${r.nome} (você)</span><span class="rk-score">${r.score}</span></div>`;
        }
    }

    function openRanking() {
        renderRanking('Todos');
        modals.ranking.classList.remove('hidden');
    }
    if (buttons.showRanking) buttons.showRanking.addEventListener('click', openRanking);

    // ─── PASSAPORTE (dashboard de aprendizado) ────────────
    let ppCont = null;
    function ppState(s) {
        if (!s || !s.acertos) return 'lock';
        const m = s.mastery || 0;
        if (m >= 85 || (s.acertos >= 5 && (s.erros || 0) < 2)) return 'gold';
        if (m >= 40) return 'learn';
        return 'new';
    }

    async function openPassport() {
        if (!_cache.progress && currentUser) {
            try { _cache.progress = await API.getProgress(currentUser); } catch (e) { _cache.progress = {}; }
        }
        if (!ppCont) ppCont = CONTINENTS_ORDER[0];
        renderPassport();
        showScreen('passport');
    }

    function renderPassport() {
        const p = loadPlayerProgress();
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

        let disc = 0, gold = 0, learn = 0;
        countries.forEach(c => {
            const st = ppState(p[c.codigo]);
            if (st !== 'lock') disc++;
            if (st === 'gold') gold++;
            if (st === 'learn') learn++;
        });
        set('passport-count', disc); set('pp-total', countries.length);
        set('pp-dominadas', gold);
        set('pp-aprendendo', learn);
        set('pp-descobrir', countries.length - disc);
        const fill = document.getElementById('pp-fill');
        if (fill) fill.style.width = `${Math.round(disc / countries.length * 100)}%`;

        // mais difíceis
        const hard = countries
            .map(c => ({ c, s: p[c.codigo] || {} }))
            .filter(o => (o.s.erros || 0) > 0 && ppState(o.s) !== 'gold')
            .sort((a, b) => (b.s.erros - b.s.acertos) - (a.s.erros - a.s.acertos))
            .slice(0, 6);
        const hw = document.getElementById('pp-hard-wrap');
        const hbox = document.getElementById('pp-hard');
        if (hard.length && hbox) {
            hw.classList.remove('hidden');
            hbox.innerHTML = hard.map(o =>
                `<button class="pp-hard-item" data-code="${o.c.codigo}" title="${o.c.nome}">
                    <img src="assets/flags/${o.c.codigo}.png" alt=""><span>${o.c.nome}</span>
                </button>`).join('');
            hbox.querySelectorAll('[data-code]').forEach(b => b.onclick = () => openFigZoom(b.dataset.code));
        } else if (hw) hw.classList.add('hidden');

        // nav de continentes
        const nav = document.getElementById('pp-cont-nav');
        if (nav) {
            nav.innerHTML = '';
            CONTINENTS_ORDER.filter(c => CONTINENT_META[c] && ['AMS', 'AMN', 'AMC', 'EUR', 'ASI', 'AFR', 'OCE'].includes(CONTINENT_META[c].sigla)).forEach(cont => {
                const meta = CONTINENT_META[cont];
                const list = countries.filter(c => c.continente === cont);
                const have = list.filter(c => ppState(p[c.codigo]) !== 'lock').length;
                const btn = document.createElement('button');
                btn.className = 'continent-tab' + (cont === ppCont ? ' active' : '');
                btn.style.setProperty('--tab-accent', meta.accent);
                btn.innerHTML = `<span class="ct-emoji">${meta.emoji}</span><span class="ct-name">${cont}</span><span class="ct-count">${have}/${list.length}</span>`;
                btn.onclick = () => { ppCont = cont; renderPassport(); };
                nav.appendChild(btn);
            });
        }

        const meta = CONTINENT_META[ppCont] || {};
        const grid = elements.passportGrid;
        grid.innerHTML = '';
        const inCont = countries.filter(c => c.continente === ppCont);
        inCont.forEach(c => {
            const st = ppState(p[c.codigo]);
            const el = document.createElement('button');
            el.className = `pp-stamp pp-${st}`;
            el.title = `${c.nome}${st === 'lock' ? ' — não descoberta' : ''}`;
            el.dataset.code = c.codigo;
            el.innerHTML = `<img src="assets/flags/${c.codigo}.png" alt="${c.nome}" loading="lazy">`
                + (st === 'gold' ? '<span class="pp-seal">★</span>' : '');
            el.onclick = () => openFigZoom(c.codigo);
            grid.appendChild(el);
        });
        set('pp-cont-name', `${meta.emoji || ''} ${ppCont}`);
        const ppc = document.getElementById('pp-cont-count');
        if (ppc) ppc.textContent = `${inCont.filter(c => ppState(p[c.codigo]) !== 'lock').length}/${inCont.length}`;
    }
    if (buttons.showPassport) buttons.showPassport.addEventListener('click', openPassport);

    // ═══════════════════════════════════════════════════════
    // ÁLBUM DE FIGURINHAS  (modelo: colada + pilha)
    // ═══════════════════════════════════════════════════════
    // 'shiny' = figurinha brilhante (10% dos sorteios); acima da comum, abaixo das lendas
    const RARITY_ORDER = ['base', 'shiny', 'roxa', 'bronze', 'prata', 'ouro'];
    const LEGEND_RARS = ['roxa', 'bronze', 'prata', 'ouro'];
    const RARITY_LABELS = {
        ouro: { text: 'LENDA DOURADA ✨' }, prata: { text: 'LENDA PRATA 🥈' },
        bronze: { text: 'LENDA BRONZE 🥉' }, roxa: { text: 'LENDA ROXA 💜' },
        shiny: { text: 'BRILHANTE ✨' },
        base: { text: 'NOVA! 🌍' },
    };
    const SHINY_CHANCE = 0.10;   // 10% de qualquer figurinha sair brilhante no pacote (todos os livros)
    function isShinyRar(rar) { return rar === 'shiny'; }

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
            // no modo online a fonte da verdade é o Supabase (via selectProfile);
            // não cai pro localStorage legado, que se mistura com o modo local
            _cache.packsCount = window.DG_ONLINE
                ? 0
                : Number(localStorage.getItem(`detetive_packs_${currentUser}`) || 0);
        }
        return _cache.packsCount;
    }
    function savePacks(n) {
        n = Math.max(0, Number(n) || 0);
        const changed = _cache.packsCount !== n;
        _cache.packsCount = n;
        localStorage.setItem(`detetive_packs_${currentUser}`, n);
        document.querySelectorAll('#packs-count').forEach(el => el.textContent = n);
        const btn = document.getElementById('open-pack-btn');
        if (btn) btn.classList.toggle('has-packs', n > 0);
        if (changed && currentUser && window.DG_ONLINE) API.savePacks(currentUser, n);
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

    // --- COLEÇÕES (estados, capitais) como "países sintéticos" ---
    const COLLECTION_ITEMS = [];
    if (window.COLLECTIONS) {
        [['estados', 'Estados do Brasil'], ['capitais', 'Capitais do Brasil']].forEach(([key, secName]) => {
            const sec = window.COLLECTIONS[key];
            if (!sec) return;
            (sec.itens || []).forEach(it => {
                COLLECTION_ITEMS.push({
                    codigo: it.codigo, nome: it.nome, continente: secName,
                    fixedShiny: !!it.fixedShiny, artigo: it.artigo || 'de',
                    capital: it.capital || '', _img: it.src, _kind: sec.tipo, _sub: it.sub || '',
                });
            });
        });
    }
    // só os estados do Brasil (bandeiras) — usados também no modo "Qual a Bandeira?"
    const ESTADO_ITEMS = COLLECTION_ITEMS.filter(x => x._kind === 'flag');

    // --- SEÇÕES ILUSTRADAS (figurinhas_data.js) como "países sintéticos" ---
    // mesma normalização de nome que o estúdio de prompts usa pra nomear o arquivo
    function slugName(s) {
        return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    // figurinhas "brilhantes fixas" por seção (casadas pelo fim do código)
    const FIG_SHINY = {
        // 40 craques mais conhecidos mundialmente (por slugName do nome)
        lendas: [
            'pele', 'garrincha', 'ronaldo', 'ronaldinho-gaucho', 'romario', 'rivaldo', 'neymar', 'cafu',
            'diego-maradona', 'lionel-messi', 'alfredo-di-stefano',
            'franz-beckenbauer', 'gerd-muller', 'lothar-matthaus',
            'paolo-maldini', 'roberto-baggio', 'paolo-rossi',
            'zinedine-zidane', 'michel-platini', 'kylian-mbappe',
            'johan-cruyff', 'marco-van-basten', 'ruud-gullit',
            'eusebio', 'cristiano-ronaldo',
            'bobby-charlton',
            'andres-iniesta', 'xavi-hernandez',
            'ferenc-puskas', 'lev-yashin', 'hristo-stoichkov', 'gheorghe-hagi',
            'luka-modric', 'andriy-shevchenko', 'zlatan-ibrahimovic', 'robert-lewandowski',
            'erling-haaland', 'george-weah', 'didier-drogba', 'mohamed-salah',
        ],
        // 7 frutas
        frutas: ['abacaxi', 'banana', 'uva', 'morango', 'melancia', 'coco', 'acai'],
        // todo clube que já ganhou pelo menos um torneio continental de clubes
        // (UEFA Champions/European Cup, Libertadores, AFC/CAF/CONCACAF/OFC Champions)
        clubes: [
            // UEFA
            'real-madrid', 'milan', 'bayern', 'liverpool', 'barcelona', 'ajax', 'inter',
            'man-united', 'juventus', 'benfica', 'porto', 'chelsea', 'nottingham-forest',
            'celtic', 'feyenoord', 'aston-villa', 'psv', 'steaua', 'estrela-vermelha',
            'marseille', 'dortmund', 'man-city', 'psg',
            // CONMEBOL (Libertadores)
            'independiente', 'boca-juniors', 'penarol', 'river-plate', 'estudiantes', 'olimpia',
            'nacional-uru', 'sao-paulo', 'gremio', 'santos', 'atletico-nacional', 'cruzeiro',
            'internacional', 'palmeiras', 'flamengo', 'racing', 'argentinos-juniors', 'colo-colo',
            'velez', 'corinthians', 'atletico-mineiro', 'san-lorenzo', 'ldu-quito', 'botafogo',
            'fluminense',
            // AFC
            'al-hilal', 'al-ittihad', 'al-nassr', 'urawa-reds', 'pohang-steelers', 'jeonbuk',
            'kashima-antlers', 'gamba-osaka', 'ulsan-hd', 'al-sadd', 'esteghlal', 'al-ain',
            // CAF
            'al-ahly', 'zamalek', 'esperance', 'wydad', 'raja', 'tp-mazembe', 'mamelodi-sundowns',
            'enyimba', 'asec-mimosas', 'js-kabylie', 'etoile-sahel', 'orlando-pirates',
            // CONCACAF
            'club-america', 'cruz-azul', 'chivas', 'monterrey', 'tigres', 'la-galaxy',
            'dc-united', 'seattle-sounders',
            // OFC
            'auckland-city', 'team-wellington', 'hekari-united',
        ],
    };
    // fundo de continente (assets/img/bg) pelo país do craque/clube
    const _CONT_SIG = {
        'América do Sul': 'ams', 'América do Norte': 'amn', 'América Central': 'amc',
        'Europa': 'eur', 'Ásia': 'asi', 'África': 'afr', 'Oceania': 'oce',
    };
    function bgForCode(code) {
        // caminho ABSOLUTO: usado em url() de custom property (resolve pela raiz, não pelo /css/)
        if (['sct', 'wls', 'cy'].includes(code)) return '/assets/img/bg/eur.jpg';
        const p = countries.find(x => x.codigo === code);
        const s = p && _CONT_SIG[p.continente];
        return s ? `/assets/img/bg/${s}.jpg` : '';
    }
    // caminho da bandeirinha do país (sct/wls têm arquivo próprio)
    function flagPath(code) {
        if (code === 'sct') return 'assets/flags/gb-sct.png';
        if (code === 'wls') return 'assets/flags/gb-wls.png';
        return `assets/flags/${code}.png`;
    }
    // tabela periódica: cor + rótulo por categoria de elemento
    const ELEM_CAT_META = {
        'metal-alcalino':          { label: 'Metal alcalino',          color: '#ef4444' },
        'metal-alcalino-terroso':  { label: 'Metal alcalino-terroso',  color: '#f97316' },
        'metal-de-transicao':      { label: 'Metal de transição',      color: '#eab308' },
        'metal-pos-transicao':     { label: 'Metal pós-transição',     color: '#84cc16' },
        'semimetal':               { label: 'Semimetal',               color: '#22c55e' },
        'nao-metal':               { label: 'Não-metal',               color: '#14b8a6' },
        'halogenio':               { label: 'Halogênio',               color: '#06b6d4' },
        'gas-nobre':               { label: 'Gás nobre',               color: '#3b82f6' },
        'lantanideo':              { label: 'Lantanídeo',              color: '#8b5cf6' },
        'actinideo':               { label: 'Actinídeo',               color: '#d946ef' },
    };

    // seção -> como montar cada figurinha sintética
    const FIG_SECTIONS = [
        { key: 'frutas', book: 'Frutas', dir: 'frutas', pre: 'fru',
          file: it => it.slug, name: it => it.n, sub: () => '',
          paises: it => it.paises || [] },
        { key: 'animais', book: 'Animais em extinção', dir: 'animais', pre: 'ani',
          file: it => it.slug, name: it => it.n, sub: () => '',
          paises: it => it.paises || [] },
        { key: 'legumes', book: 'Legumes e hortaliças', dir: 'legumes', pre: 'leg',
          file: it => it.slug, name: it => it.n, sub: () => '',
          paises: it => it.paises || [] },
        { key: 'comidas', book: 'Comidas típicas', dir: 'comidas', pre: 'com',
          file: it => it.code, name: it => it.nome, sub: () => '',
          paises: it => [it.code] },
        { key: 'lendas', book: 'Lendas do futebol', dir: 'lendas', pre: 'len',
          file: it => it.code + '-' + slugName(it.nome), name: it => it.nome,
          sub: it => `${it.pais}${it.num ? ' · #' + it.num : ''}`,
          bg: it => bgForCode(it.code), flag: it => flagPath(it.code) },
        { key: 'clubes', book: 'Clubes', dir: 'clubes', pre: 'clu',
          file: it => it.slug, name: it => it.nome, sub: it => it.liga || '',
          bg: it => bgForCode(it.code), flag: it => flagPath(it.code) },
        { key: 'elementos', book: 'Tabela periódica', dir: 'elementos', pre: 'ele',
          file: it => it.slug, name: it => it.n,
          sub: it => (ELEM_CAT_META[it.cat] || {}).label || '',
          paises: it => it.paises || [] },
    ];
    if (window.FIG_DATA) {
        FIG_SECTIONS.forEach(sc => {
            const sec = window.FIG_DATA[sc.key];
            if (!sec || !sec.itens) return;
            const shinySet = new Set(FIG_SHINY[sc.key] || []);
            sec.itens.forEach(it => {
                const f = sc.file(it);
                if (!f) return;
                const codigo = sc.pre + '-' + f;
                COLLECTION_ITEMS.push({
                    codigo, nome: sc.name(it), continente: sc.book,
                    fixedShiny: shinySet.has(f) || shinySet.has(slugName(sc.name(it))),
                    _img: `assets/stickers/${sc.dir}/${f}.webp`,
                    _kind: 'fig', _sec: sc.key, _sub: sc.sub(it), _cur: it.cur || '',
                    _bg: sc.bg ? sc.bg(it) : '',
                    _flag: sc.flag ? sc.flag(it) : '',
                    // bandeirinhas do zoom: usa it.paises (frutas/animais/legumes) e,
                    // se não tiver, cai pro país de origem (comidas têm it.code)
                    _paises: (Array.isArray(it.paises) && it.paises.length) ? it.paises
                             : (sc.paises ? sc.paises(it) : (it.code ? [it.code] : [])),
                    // só a tabela periódica usa isso (posição na grade + categoria)
                    _z: it.z, _grupo: it.grupo, _periodo: it.periodo, _cat: it.cat, _simbolo: it.simbolo,
                    _status: it.status,   // grau de ameaça (só animais)
                });
            });
        });
    }

    // tudo que aparece no álbum (países + coleções + seções ilustradas)
    const ALBUM_ITEMS = [...countries, ...COLLECTION_ITEMS];
    function albumItem(code) { return ALBUM_ITEMS.find(x => x.codigo === code); }
    function itemImg(c) { return (c && c._img) || `assets/flags/${c.codigo}.png`; }
    // fundo de continente no card (foto), quando a figurinha tem _bg
    function figBgClass(c) { return (c && c._bg) ? ' has-bgimg' : ''; }
    function applyFigBg(el, c) { if (c && c._bg) el.style.setProperty('--fig-bg-img', `url('${c._bg}')`); }
    // classe extra do card conforme o formato da imagem da seção
    function figKindClass(c) {
        if (!c) return '';
        if (c._sec === 'clubes') return 'is-crest';
        if (c._sec === 'lendas') return 'is-portrait';
        return '';
    }

    // selo de grau de ameaça (animais) — anel redondo que enche 3/3 crítico,
    // 2/3 em perigo, 1/3 vulnerável/quase ameaçado. Só aparece pra quem já tem
    // a figurinha (mesma regra de segredo do resto).
    const THREAT_META = {
        CR: { pct: 100, color: '#ef4444', label: 'Criticamente em perigo' },
        EN: { pct: 66, color: '#f97316', label: 'Em perigo' },
        VU: { pct: 33, color: '#eab308', label: 'Vulnerável' },
        NT: { pct: 33, color: '#eab308', label: 'Quase ameaçado' },
    };
    function threatBadgeHTML(c, big) {
        const t = c && c._status && THREAT_META[c._status];
        if (!t) return '';
        return `<span class="threat-badge${big ? ' big' : ''}" style="--tb-pct:${t.pct};--tb-color:${t.color}" title="${t.label}"></span>`;
    }
    function itemShape(c, cls) {
        return (c && c._img) ? '' :
            `<img class="fig-shape ${cls || ''}" src="assets/shapes/${c.codigo}.svg" alt="" loading="lazy" onerror="this.remove()">`;
    }

    // --- CONTINENTES / CÓDIGO DE FIGURINHA ---
    const CONTINENTS_ORDER = [
        'América do Sul', 'América do Norte', 'América Central',
        'Europa', 'Ásia', 'África', 'Oceania',
        'Estados do Brasil', 'Capitais do Brasil',
        'Frutas', 'Lendas do futebol', 'Clubes',
        'Animais em extinção', 'Legumes e hortaliças', 'Comidas típicas',
        'Tabela periódica'   // sempre o último livro do álbum
    ];
    const CONTINENT_META = {
        'América do Sul':   { emoji: '🌎', accent: '#34d399', sigla: 'AMS' },
        'América do Norte': { emoji: '🗽', accent: '#60a5fa', sigla: 'AMN' },
        'América Central':  { emoji: '🏝️', accent: '#c084fc', sigla: 'AMC' },
        'Europa':           { emoji: '🏰', accent: '#818cf8', sigla: 'EUR' },
        'Ásia':             { emoji: '⛩️', accent: '#f87171', sigla: 'ASI' },
        'África':           { emoji: '🦁', accent: '#fbbf24', sigla: 'AFR' },
        'Oceania':          { emoji: '🐨', accent: '#22d3ee', sigla: 'OCE' },
        'Estados do Brasil':  { emoji: '🇧🇷', flag: 'assets/flags/br.png', accent: '#22c55e', sigla: 'BRA' },
        'Capitais do Brasil': { emoji: '🏙️', accent: '#f59e0b', sigla: 'CAP' },
        'Frutas':             { emoji: '🍍', accent: '#f472b6', sigla: 'FRU' },
        'Lendas do futebol':  { emoji: '⚽', accent: '#38bdf8', sigla: 'LEN' },
        'Clubes':             { emoji: '🛡️', accent: '#a78bfa', sigla: 'CLU' },
        'Animais em extinção':  { emoji: '🐾', accent: '#a3e635', sigla: 'ANI' },
        'Legumes e hortaliças': { emoji: '🥕', accent: '#16a34a', sigla: 'LEG' },
        'Comidas típicas':    { emoji: '🍲', accent: '#fb923c', sigla: 'COM' },
        'Tabela periódica':   { emoji: '⚛️', accent: '#6366f1', sigla: 'ELE' },
    };
    let currentContinent = null;

    const STICKER_CODE = (() => {
        const map = {};
        CONTINENTS_ORDER.forEach(cont => {
            const sig = (CONTINENT_META[cont] || {}).sigla || 'XXX';
            const list = ALBUM_ITEMS.filter(c => c.continente === cont);
            const w = Math.max(2, String(list.length).length);
            list.forEach((c, i) => { map[c.codigo] = `${sig}-${String(i + 1).padStart(w, '0')}`; });
        });
        return map;
    })();
    function stickerCode(codigo) { return STICKER_CODE[codigo] || '—'; }

    function continentStats(cont) {
        const list = ALBUM_ITEMS.filter(c => c.continente === cont);
        const have = list.filter(c => isColada(c.codigo)).length;
        return { have, total: list.length };
    }

    // codigos (na ordem do livro) que dá pra colar agora (nova ou upgrade de
    // Legend) — base tanto do selo do continente quanto do navegador flutuante.
    function gluableCodesInBook(cont) {
        const out = [];
        ALBUM_ITEMS.forEach(c => {
            if (cont && c.continente !== cont) return;
            if (!pilhaOf(c.codigo).length) return;
            const col = coladaRarity(c.codigo);
            let can = !col;
            if (col) {
                const best = bestPilha(c.codigo);
                can = best && RARITY_ORDER.indexOf(best) > RARITY_ORDER.indexOf(col);
            }
            if (can) out.push(c.codigo);
        });
        return out;
    }

    // quantas figurinhas dá pra colar (nova ou upgrade de Legend) num continente
    function gluableInfo(cont) {
        const codes = gluableCodesInBook(cont);
        return { count: codes.length, firstCode: codes[0] || null };
    }

    // ─── navegador flutuante ▲/▼: pula pra próxima/anterior figurinha colável
    // dentro do livro aberto — livros grandes (Lendas, 485 itens) espalham as
    // repetidas longe umas das outras; sem isso é rolar a tela toda vez.
    // Sensível à ROLAGEM DE VERDADE (não a um índice memorizado): ▼ só existe
    // se tiver colável abaixo do que está visível agora; ▲ pula pra colável
    // acima, e se não tiver nenhuma acima vira "voltar ao topo da seção". ───
    function glueCardEl(code) {
        return (elements.albumGrid && elements.albumGrid.querySelector(`[title^="${stickerCode(code)} "]`))
            || document.querySelector(`.pt-cell[data-code="${code}"]`);
    }
    // varre os coláveis do livro e acha, pela posição real na tela AGORA,
    // o próximo abaixo da área visível e o mais próximo acima dela
    function glueNavTargets() {
        const codes = gluableCodesInBook(currentContinent);
        if (!codes.length) return { codes, below: null, above: null };
        const vh = window.innerHeight || document.documentElement.clientHeight;
        let below = null, above = null;
        codes.forEach(code => {
            const el = glueCardEl(code);
            if (!el) return;
            const r = el.getBoundingClientRect();
            if (r.top >= vh) { if (below === null) below = code; }
            else if (r.bottom <= 0) { above = code; }
        });
        return { codes, below, above };
    }
    function glueNavGoTop() {
        const head = document.querySelector('.album-page-head');
        const target = (head && head.getBoundingClientRect().top < 0) ? head : elements.albumGrid;
        if (!target) return;
        try { target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } catch (e) {}
    }
    function updateGlueNav() {
        const nav = document.getElementById('album-glue-nav');
        if (!nav) return;
        const { codes, below, above } = glueNavTargets();
        nav.classList.toggle('hidden', codes.length === 0);
        const countEl = document.getElementById('glue-nav-count');
        if (countEl) countEl.textContent = codes.length;
        const prevBtn = document.getElementById('glue-nav-prev');
        const nextBtn = document.getElementById('glue-nav-next');
        if (nextBtn) nextBtn.hidden = !below;
        if (prevBtn) {
            prevBtn.hidden = false;
            prevBtn.textContent = above ? '▲' : '⤒';
            prevBtn.title = above ? 'Figurinha anterior pra colar' : 'Voltar ao topo desta seção';
        }
        nav.dataset.below = below || '';
        nav.dataset.above = above || '';
    }
    // depois de rolar (rolagem suave leva um tempinho), reconfere -- clicar de
    // novo rápido antes da rolagem terminar não pode repetir o mesmo alvo
    function glueNavResync() { setTimeout(updateGlueNav, 450); }
    function glueNavPrevClick() {
        const nav = document.getElementById('album-glue-nav');
        const above = nav && nav.dataset.above;
        if (above) scrollToCard(above, true); else glueNavGoTop();
        glueNavResync();
    }
    function glueNavNextClick() {
        const nav = document.getElementById('album-glue-nav');
        const below = nav && nav.dataset.below;
        if (below) scrollToCard(below, true);
        glueNavResync();
    }

    function scrollToCard(code, glow) {
        // lista normal (título "COD · Nome") ou, se o livro é a tabela periódica
        // em modo grade, a célula correspondente (não tem título, é achada pelo
        // data-code direto).
        const card = (elements.albumGrid && elements.albumGrid.querySelector(`[title^="${stickerCode(code)} "]`))
            || document.querySelector(`.pt-cell[data-code="${code}"]`);
        if (!card) return;
        try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        if (glow) { card.classList.add('point-here'); setTimeout(() => card.classList.remove('point-here'), 2800); }
    }

    async function goColarNoAlbum(code) {
        const c = albumItem(code);
        await openAlbum();
        if (c && c.continente !== currentContinent) { currentContinent = c.continente; renderAlbum(); }
        setTimeout(() => scrollToCard(code, true), 160);
    }

    function buildContinentNav() {
        const nav = document.getElementById('continent-nav');
        if (!nav) return;
        nav.innerHTML = '';
        CONTINENTS_ORDER.forEach(cont => {
            const meta = CONTINENT_META[cont] || { emoji: '🌐', accent: '#94a3b8' };
            const st = continentStats(cont);
            const g = gluableInfo(cont);
            const btn = document.createElement('button');
            btn.className = 'continent-tab' + (cont === currentContinent ? ' active' : '');
            btn.style.setProperty('--tab-accent', meta.accent);
            const icon = meta.flag
                ? `<img class="ct-flag" src="${meta.flag}" alt="" loading="lazy">`
                : `<span class="ct-emoji">${meta.emoji}</span>`;
            btn.innerHTML = `${icon}<span class="ct-name">${cont}</span><span class="ct-count">${st.have}/${st.total}</span>`
                + (g.count ? `<span class="ct-todo" title="${g.count} pra colar">${g.count}</span>` : '');
            btn.addEventListener('click', () => {
                const already = currentContinent === cont;
                if (!already) { currentContinent = cont; animatePageTurn(); renderAlbum(); }
                const info = gluableInfo(cont);
                if (info.firstCode) setTimeout(() => scrollToCard(info.firstCode, true), already ? 0 : 130);
            });
            nav.appendChild(btn);
        });
    }

    // aproxima a figurinha pra ver detalhes (não tira do álbum, só amplia)
    // opts.reveal = mostra a imagem de verdade mesmo sem estar colada (ex.: prêmio da máquina)
    function openFigZoom(code, opts) {
        opts = opts || {};
        const c = albumItem(code);
        if (!c) return;
        const box = document.getElementById('fig-zoom');
        const cardEl = document.getElementById('fig-zoom-card');
        const info = document.getElementById('fig-zoom-info');
        if (!box || !cardEl || !info) return;

        const colada = coladaRarity(code);
        const pilha = pilhaOf(code);
        // você "tem" a figurinha se colou, se tem cópia na pilha, ou se pediu pra revelar
        const owned = !!colada || pilha.length > 0 || opts.reveal;

        if (owned) {
            cardEl.innerHTML = figCardHTML(c, colada || 'base');
        } else {
            const acc = (CONTINENT_META[c.continente] || {}).accent || '#60a5fa';
            cardEl.innerHTML = `<div class="fig-card missing locked ${c._img ? 'is-collection' : ''} ${figKindClass(c)}" style="--acc:${acc}">
                <div class="fig"><span class="fig-bg dim"></span>
                <span class="fz-qmark">?</span>
                <div class="fig-foot"><span class="fig-name fig-name-locked">???</span></div></div></div>`;
        }
        cardEl.querySelectorAll('img').forEach(i => i.loading = 'eager');

        // bandeirinha ao lado do "onde" (associação objeto ↔ bandeira)
        const FLAG = p => `<img class="fz-flag" src="${p}" alt="" onerror="this.style.display='none'">`;
        let ufBra = '';
        if (c.codigo.indexOf('cap-') === 0) ufBra = c.codigo.slice(4);
        else if (c.codigo.indexOf('uf-') === 0) ufBra = c.codigo.slice(3);

        // "onde"/bandeiras/curiosidade só aparecem se você já viu a figurinha
        // (colada, na pilha, ou reveal do pacote) -- senão é segredo total até desbloquear
        let where = '';
        if (!owned) where = '🔒 Figurinha bloqueada';
        else if (c._sec === 'lendas' || c._sec === 'clubes') where = FLAG(c._flag) + ` ${c._sub || c.continente}`;
        else if (c._kind === 'fig') where = `${(CONTINENT_META[c.continente] || {}).emoji || '🎴'} ${c._sub || c.continente}`;
        else if (ufBra) where = FLAG(`assets/stickers/bra/${ufBra}.png`) + ` ${c._sub || ('Capital: ' + c.capital)}`;
        else if (c._kind === 'img') where = `📍 ${c._sub}`;
        else if (c._kind === 'flag') where = `🏛️ Capital: ${c.capital}`;
        else where = `🌎 ${c.continente} · capital: ${c.capital}`;
        const canGlueHere = !colada && (pilha.length > 0 || opts.reveal);
        const rarTxt = colada
            ? (isShinyRar(colada, c) ? '✨ Figurinha brilhante'
               : colada === 'base' ? 'Figurinha comum'
               : (RARITY_LABELS[colada] || {}).text)
            : canGlueHere ? '📥 Na sua pilha — falta colar no álbum'
            : '🔒 Você ainda não tem essa figurinha';

        // frutas/legumes/comidas/animais: bandeirinha(s) centralizadas embaixo (sem nomes)
        const FZ_FLAG_LBL = {
            frutas: 'Onde são mais consumidas?', legumes: 'Onde são mais consumidos?',
            comidas: 'De qual país é?', animais: 'Onde ainda vive?', elementos: 'Onde é produzido?',
        };
        const fpais = (owned && ['frutas', 'legumes', 'comidas', 'animais', 'elementos'].includes(c._sec) && Array.isArray(c._paises))
            ? c._paises.slice(0, 5) : [];
        const fpaisHTML = fpais.length ? `
            <div class="fz-flags">
              <span class="fz-flags-lbl">${FZ_FLAG_LBL[c._sec] || 'Onde é encontrado?'}</span>
              <div class="fz-flags-row">${fpais.map(cd =>
                `<img src="${flagPath(cd)}" alt="" onerror="this.style.display='none'">`).join('')}</div>
            </div>` : '';

        // "Saber mais": história da bandeira / paisagem / curiosidade do país
        // (só existe se você já conhece a figurinha -- senão fica tudo em segredo)
        const saiba = owned ? figZoomSaibaMais(c) : { text: '', audio: '' };

        // grau de ameaça (animais) -- selo grande + texto, só se já conhece
        const threat = owned && c._status && THREAT_META[c._status];
        const threatHTML = threat ? `
            <div class="fz-threat">${threatBadgeHTML(c, true)}<span>Grau de ameaça: <b>${threat.label}</b></span></div>` : '';

        info.innerHTML = `
            <h3>${owned ? c.nome : '???'}</h3>
            <span class="fz-code">${stickerCode(code)}</span>
            <p>${where}</p>
            <p class="fz-rar">${rarTxt}${pilha.length ? ` · ${pilha.length} na pilha` : ''}</p>
            ${threatHTML}
            ${canGlueHere ? `<button class="fz-glue-btn" type="button">Colar no álbum →</button>` : ''}
            ${fpaisHTML}
            ${saiba.text ? `<button class="fz-more-btn" type="button">Saber mais ✨</button>
              <div class="fz-more hidden"><p>${saiba.text}</p>
              ${saiba.audio ? `<button class="fz-play" type="button">🔊 Ouvir</button>` : ''}</div>` : ''}`;

        const glueBtn = info.querySelector('.fz-glue-btn');
        // cola de verdade (antes só navegava pro álbum e ficava esperando você
        // tocar de novo no "+" -- na tabela periódica isso nem tinha "+" visível
        // fora do grão da célula, então parecia que não colava nada).
        if (glueBtn) glueBtn.addEventListener('click', () => {
            doGlue(code, null, glueBtn);
            closeFigZoom();
        });
        const moreBtn = info.querySelector('.fz-more-btn');
        if (moreBtn) moreBtn.addEventListener('click', () => {
            info.querySelector('.fz-more').classList.remove('hidden');
            moreBtn.classList.add('hidden');
            if (saiba.audio) playAudio(saiba.audio);   // narradora (só se "Vozes" ligado)
        });
        const playBtn = info.querySelector('.fz-play');
        if (playBtn) playBtn.addEventListener('click', () => { playAudio(saiba.audio, true); });

        box.classList.remove('hidden');
        requestAnimationFrame(() => fitFigNames(cardEl));
        if (window.SFX) window.SFX.play('tap');
    }

    function figZoomSaibaMais(c) {
        if (c._kind === 'fig') {
            let audio = '';
            if (c._sec === 'lendas') audio = 'lendas/' + c.codigo.replace('len-', '');
            else if (c._sec === 'frutas') audio = 'frutas/' + c.codigo.replace('fru-', '');
            else if (c._sec === 'clubes') audio = 'clubes/' + c.codigo.replace('clu-', '');
            else if (c._sec === 'animais') audio = 'animais/' + c.codigo.replace('ani-', '');
            else if (c._sec === 'legumes') audio = 'legumes/' + c.codigo.replace('leg-', '');
            else if (c._sec === 'comidas') audio = 'comidas/' + c.codigo.replace('com-', '');
            else if (c._sec === 'elementos') audio = 'elementos/' + c.codigo.replace('ele-', '');
            return { text: c._cur || '', audio };
        }
        const BR = window.CURIOSITIES_BR || { bandeiras: {}, paisagens: {} };
        if (c._kind === 'flag') {
            const uf = (c.uf || c.codigo.replace('uf-', '')).toUpperCase();
            return { text: BR.bandeiras[uf] || '', audio: `br/bandeira_${uf.toLowerCase()}` };
        }
        if (c._kind === 'img') {
            const uf = (c.uf || c.codigo.replace('cap-', '')).toUpperCase();
            return { text: BR.paisagens[uf] || '', audio: `br/paisagem_${uf.toLowerCase()}` };
        }
        const all = (typeof curiosities !== 'undefined') ? curiosities : {};
        const facts = all[c.codigo];
        if (!facts || !facts.length) return { text: '', audio: '' };
        const idx = Math.floor(Math.random() * facts.length);
        return { text: facts[idx], audio: `curiosidades/${c.codigo}_${idx}` };
    }
    function closeFigZoom() {
        const box = document.getElementById('fig-zoom');
        if (box) box.classList.add('hidden');
    }

    // encolhe o nome da figurinha até caber (a figurinha NUNCA muda de largura)
    function fitFigNames(root) {
        (root || document).querySelectorAll('.fig-name').forEach(t => {
            t.style.fontSize = '';
            let size = parseFloat(getComputedStyle(t).fontSize), guard = 0;
            while (t.scrollHeight > t.clientHeight + 1 && size > 5.5 && guard++ < 16) {
                size -= 0.6;
                t.style.fontSize = size + 'px';
            }
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

    // Tabela periódica: livro "Tabela periódica" tem 2 visualizações — lista (igual
    // aos outros livros, padrão no celular) e a grade real da tabela (padrão no
    // desktop; no celular precisa tocar pra trocar). Preferência fica só na sessão.
    let elementosView = null;
    function elementosDefaultView() {
        try { return window.matchMedia('(min-width: 768px)').matches ? 'tabela' : 'lista'; }
        catch (e) { return 'lista'; }
    }

    function renderPeriodicTable(meta) {
        const wrap = document.getElementById('album-pt-grid');
        if (!wrap) return;
        const gridEl = wrap.querySelector('.pt-grid');
        const legendEl = wrap.querySelector('.pt-legend');
        const itens = ALBUM_ITEMS.filter(c => c.continente === 'Tabela periódica');
        gridEl.innerHTML = itens.map(c => {
            const colada = coladaRarity(c.codigo);
            const pilha = pilhaOf(c.codigo);
            const known = !!colada || pilha.length > 0;
            const gluable = !colada && pilha.length > 0;
            const catMeta = ELEM_CAT_META[c._cat] || { color: meta.accent };
            // segredo total: enquanto não conhece o elemento, a célula fica
            // vazia (nem número atômico nem símbolo, nem a cor da categoria
            // -- senão já entrega de graça a tabela toda) -- só a posição.
            // Ao ganhar a figurinha (colar OU cair na pilha), revela os dois.
            const content = known ? `<span class="pt-z">${c._z}</span><span class="pt-s">${c._simbolo}</span>` : '';
            return `<div class="pt-cell${known ? ' known' : ''}${gluable ? ' gluable' : ''}" data-code="${c.codigo}"
                style="grid-column:${c._grupo};grid-row:${c._periodo};--pt-c:${catMeta.color}">
                ${content}
            </div>`;
        }).join('');
        legendEl.innerHTML = Object.values(ELEM_CAT_META).map(m =>
            `<span><i style="background:${m.color}"></i>${m.label}</span>`).join('');
        // igual à lista: tocar num elemento com pilha pronta (e ainda não colado)
        // cola na hora; senão abre o zoom. Antes só abria o zoom -- sem "+" na
        // grade da tabela não tinha NENHUM jeito de colar por aqui.
        gridEl.querySelectorAll('.pt-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const code = cell.dataset.code;
                if (cell.classList.contains('gluable')) {
                    if (glueSticker(code)) {
                        if (window.SFX) window.SFX.play('sticker_paste');
                        if (!calmMode && typeof confetti !== 'undefined') {
                            const r = cell.getBoundingClientRect();
                            confetti({ particleCount: 45, spread: 55, startVelocity: 24,
                                origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight } });
                        }
                        renderAlbum();
                        refreshHub();
                    }
                    return;
                }
                openFigZoom(code);
            });
        });
    }

    function renderAlbum() {
        const grid = elements.albumGrid;
        if (!grid) return;
        if (!currentContinent) currentContinent = CONTINENTS_ORDER[0];
        const meta = CONTINENT_META[currentContinent] || { emoji: '🌐', accent: '#94a3b8', sigla: 'ams' };
        const screen = document.getElementById('album-menu');
        if (screen) {
            screen.style.setProperty('--cont-accent', meta.accent);
            const hasBg = ['AMS', 'AMN', 'AMC', 'EUR', 'ASI', 'AFR', 'OCE'].includes(meta.sigla);
            screen.style.setProperty('--cont-bg', hasBg ? `url("/assets/img/bg/${meta.sigla.toLowerCase()}.jpg")` : 'none');
        }

        const isElemBook = currentContinent === 'Tabela periódica';
        const toggleBtn = document.getElementById('elem-view-toggle');
        const ptWrap = document.getElementById('album-pt-grid');
        if (isElemBook && elementosView === null) elementosView = elementosDefaultView();
        if (toggleBtn) {
            toggleBtn.hidden = !isElemBook;
            toggleBtn.textContent = elementosView === 'tabela' ? '📋 Ver em lista' : '🔲 Ver tabela periódica';
        }
        const showTable = isElemBook && elementosView === 'tabela';
        grid.classList.toggle('hidden', showTable);
        if (ptWrap) ptWrap.classList.toggle('hidden', !showTable);
        if (showTable) renderPeriodicTable(meta);

        if (!showTable) {
        grid.innerHTML = '';
        ALBUM_ITEMS.filter(c => c.continente === currentContinent).forEach(c => {
            const code = stickerCode(c.codigo);
            const colada = coladaRarity(c.codigo);
            const pilha = pilhaOf(c.codigo);
            const item = document.createElement('div');

            item.style.setProperty('--acc', meta.accent);
            applyFigBg(item, c);

            // "conhecida" = já colada ou já tem cópia na pilha (você já viu ao abrir o pacote);
            // nunca vista = segredo total (sem nome/curiosidade/áudio), só a silhueta como pista
            const known = !!colada || pilha.length > 0;
            const subline = c._sub ? `<span class="fig-sub">${c._sub}</span>` : '';
            const foot = known
                ? `<div class="fig-foot"><span class="fig-name">${c.nome}</span>${subline}<span class="fig-code">${code}</span></div>`
                : `<div class="fig-foot"><span class="fig-name fig-name-locked">???</span><span class="fig-code">${code}</span></div>`;

            if (!colada) {
                const canGlue = pilha.length > 0;
                item.className = 'album-card fig-card missing' + (canGlue ? ' has-pilha' : '') + (c._img ? ' is-collection' : '') + (figKindClass(c) ? ' ' + figKindClass(c) : '') + figBgClass(c);
                item.innerHTML = `
                    <div class="fig">
                        <span class="fig-bg dim"></span>
                        ${itemShape(c, 'big')}
                        ${canGlue ? `<button class="ac-plus" data-glue="${c.codigo}" aria-label="Colar">+</button>` : ''}
                        ${foot}
                    </div>`;
            } else {
                const shiny = isShinyRar(colada, c);
                const legend = LEGEND_RARS.includes(colada);
                const better = bestPilha(c.codigo);
                const canUp = better && RARITY_ORDER.indexOf(better) > RARITY_ORDER.indexOf(colada);
                item.className = `album-card fig-card collected rarity-${colada}`
                    + (shiny ? ' shiny' : '') + (legend ? ' legend' : '') + (c._img ? ' is-collection' : '') + (figKindClass(c) ? ' ' + figKindClass(c) : '') + (legend ? '' : figBgClass(c));
                const badge = pilha.length ? `<span class="fig-count" title="Na pilha">×${pilha.length}</span>` : '';
                const up = canUp ? `<button class="fig-up" data-glue="${c.codigo}" data-rar="${better}" title="Colar a versão ${better}">⬆</button>` : '';
                item.innerHTML = `
                    <div class="fig">
                        <span class="fig-bg"></span>
                        ${itemShape(c)}
                        <span class="fig-foil"></span>
                        ${threatBadgeHTML(c)}
                        <div class="fig-flagwrap"><img class="fig-flag" src="${itemImg(c)}" alt="${c.nome}" loading="lazy"></div>
                        ${foot}
                        ${badge}${up}
                    </div>`;
            }
            item.title = known ? `${code} · ${c.nome}` : code;
            item.dataset.code = c.codigo;
            grid.appendChild(item);
        });

        grid.querySelectorAll('[data-glue]').forEach(b => {
            b.addEventListener('click', e => {
                e.stopPropagation();
                doGlue(b.dataset.glue, b.dataset.rar, b);
            });
        });

        // tocar na figurinha:
        //  - falta e tem cópia na pilha  -> cola direto (clique em qualquer área)
        //  - já colada / sem cópia       -> abre o zoom pra ver detalhes
        grid.querySelectorAll('.album-card').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.closest('[data-glue]')) return;
                const glueBtn = card.querySelector('.ac-plus[data-glue]');
                if (glueBtn) { doGlue(glueBtn.dataset.glue, glueBtn.dataset.rar, glueBtn); return; }
                openFigZoom(card.dataset.code);
            });
        });
        requestAnimationFrame(() => fitFigNames(grid));
        }

        const st = continentStats(currentContinent);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('album-continent-name', `${meta.emoji} ${currentContinent}`);
        set('album-continent-count', `${st.have}/${st.total}`);

        const totalHave = loadStickers().filter(s => s.colada).length;
        const pct = Math.round((totalHave / ALBUM_ITEMS.length) * 100);
        set('album-progress', `${pct}%`);
        set('album-count', `${totalHave}/${ALBUM_ITEMS.length}`);
        const fill = document.getElementById('album-overall-fill');
        if (fill) fill.style.width = `${pct}%`;

        const reps = totalPilha();
        set('repeats-count', reps);
        const tb = document.getElementById('open-trades-btn');
        if (tb) tb.classList.toggle('has-repeats', reps > 0);

        buildContinentNav();
        updateGlueNav();
    }

    // cola com animação (a figurinha "desce" e gruda) + confete + som
    // curiosidade curta pra mostrar ao colar (país -> curiosities.js; seções -> _cur)
    function stickerFact(code) {
        const c = albumItem(code);
        if (c && c._cur) return c._cur;
        const all = (typeof curiosities !== 'undefined') ? curiosities : {};
        const list = all[code];
        return (list && list.length) ? list[Math.floor(Math.random() * list.length)] : '';
    }

    function doGlue(code, rar, btn) {
        const frame = btn.closest('.fig-frame') || btn.closest('.fig');
        if (glueSticker(code, rar)) {
            if (window.SFX) window.SFX.play('sticker_paste');
            // curiosidade NÃO aparece sozinha ao colar — só quando a pessoa
            // abre a figurinha e toca em "Saber mais"
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
    const albumHomeBtn = document.getElementById('album-home');
    if (albumHomeBtn) albumHomeBtn.addEventListener('click', () => showScreen('main'));

    // navegador ▲/▼ (próxima/anterior figurinha colável, sensível à rolagem
    // de verdade) + botão "voltar ao topo"
    (function wireAlbumFloatingNav() {
        const prevBtn = document.getElementById('glue-nav-prev');
        const nextBtn = document.getElementById('glue-nav-next');
        if (prevBtn) prevBtn.addEventListener('click', glueNavPrevClick);
        if (nextBtn) nextBtn.addEventListener('click', glueNavNextClick);

        const topBtn = document.getElementById('album-top-btn');
        const albumScreen = document.getElementById('album-menu');
        if (!topBtn || !albumScreen || !elements.mainContainer) return;
        // conforme a largura da tela, quem rola é o #main-container OU a
        // janela (o resto do app já reseta os dois em showScreen — segue o
        // mesmo padrão aqui em vez de assumir um só).
        const scrollY = () => Math.max(elements.mainContainer.scrollTop, window.scrollY || document.documentElement.scrollTop || 0);
        let ticking = false;
        const onScroll = () => {
            const visible = !albumScreen.classList.contains('hidden');
            topBtn.classList.toggle('hidden', !(visible && scrollY() > 320));
            // ▲/▼ do navegador de colar reagem à rolagem real, não só ao gluear
            // (getBoundingClientRect força layout -- joga num rAF pra não
            // recalcular a cada pixel rolado)
            if (visible && !ticking) {
                ticking = true;
                requestAnimationFrame(() => { updateGlueNav(); ticking = false; });
            }
        };
        elements.mainContainer.addEventListener('scroll', onScroll);
        window.addEventListener('scroll', onScroll, { passive: true });
        topBtn.addEventListener('click', () => {
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const behavior = reduce ? 'auto' : 'smooth';
            elements.mainContainer.scrollTo({ top: 0, behavior });
            window.scrollTo({ top: 0, behavior });
        });
    })();

    // ─── TROCA ENTRE CONTAS ──────────────────────────────
    const ALL_CODES = countries.map(c => c.codigo);
    let tradeOther = null, tradeGive = null, tradeGet = null;

    // ═══════════════ DESAFIO ENTRE AMIGOS (assíncrono) ═══════════════
    const DUEL_Q = 10;
    const DUEL_PACE = { rapido: 8000, normal: 13000, calmo: 20000 };
    let duelUnsub = null;

    // pool só faz sentido pra "Qual a Bandeira?" (os outros modos são de país)
    const DUEL_POOL_MODE = 'BandeiraPorPais';

    function buildDuelQuestions(mode, difficulty, n, poolKind) {
        n = Math.max(5, Math.min(30, n || DUEL_Q));
        poolKind = (mode === DUEL_POOL_MODE && poolKind) ? poolKind : 'paises';

        const estados = (typeof ESTADO_ITEMS !== 'undefined') ? ESTADO_ITEMS : [];
        let base;
        if (poolKind === 'estados') base = estados.slice();
        else if (poolKind === 'ambos') base = [...countries, ...estados];
        else base = countries.slice();

        // por nível só filtra os países (estados não têm nível)
        let pool = base.filter(c => c._kind === 'flag' || c.nivel === difficulty);
        if (pool.length < n + 4) pool = base.filter(c => c._kind === 'flag' || c.nivel <= Math.max(2, difficulty));
        if (pool.length < n) pool = base.slice();

        const picks = shuffle([...pool]).slice(0, n);
        const conts = [...new Set(countries.map(c => c.continente))];
        const distractPool = poolKind === 'estados' ? estados : (poolKind === 'ambos' ? base : countries);
        return picks.map(c => {
            if (mode === 'ContinentePorPais') {
                const wrong = shuffle(conts.filter(x => x !== c.continente)).slice(0, 3);
                return { code: c.codigo, opts: shuffle([c.continente, ...wrong]) };
            }
            const same = shuffle(distractPool.filter(x => x.codigo !== c.codigo && x.continente === c.continente));
            const other = shuffle(distractPool.filter(x => x.codigo !== c.codigo && x.continente !== c.continente));
            const wrong = [...same, ...other].slice(0, 3).map(x => x.codigo);
            return { code: c.codigo, opts: shuffle([c.codigo, ...wrong]) };
        });
    }

    function playDuel(d) {
        if (modals.duelCompose) modals.duelCompose.classList.add('hidden');
        startGame({
            mode: d.mode, type: null, level: d.difficulty, lives: 'infinite', pool: 'paises',
            duel: { id: d.id, mode: d.mode, difficulty: d.difficulty, questions: d.questions },
        });
    }

    async function finishDuel() {
        if (!gameState.duel || gameState._duelDone) return;
        gameState._duelDone = true;
        const d = gameState.duel;
        // meta: jogar 1 partida online por dia -- não importa se ganha, empata
        // ou perde, então concede aqui, sempre, antes de saber o resultado.
        grantBonusPack('online', 1, 'Jogou uma partida online!');
        clearQTimer();
        gameLocked = true;
        buttons.next.classList.add('hidden'); buttons.facts.classList.add('hidden');
        buttons.hint.classList.add('hidden'); buttons.playAgain.classList.add('hidden');
        elements.options.classList.add('hidden');
        const media = document.getElementById('question-media');
        if (media) { media.classList.add('hidden'); media.innerHTML = ''; }
        document.getElementById('live-timer')?.classList.add('hidden');
        screens.game.classList.add('game-over-view');
        document.getElementById('learn-summary').classList.add('hidden');

        if (d.live) { finishLiveDuel(); return; }

        elements.instruction.textContent = 'Você terminou o desafio!';
        elements.feedback.textContent = `${gameState.score} pontos · enviando…`;
        elements.feedback.style.color = '#32CD32';
        if (!calmMode && typeof confetti !== 'undefined') confetti({ particleCount: 90, spread: 70, origin: { y: .5 } });
        markModePlayed(gameConfig.mode);

        let res = null;
        if (window.OnlineDuels) { try { res = await OnlineDuels.submitScore(d.id, gameState.score); } catch (e) {} }
        if (res && res.error) elements.feedback.textContent = `${gameState.score} pontos (não deu pra enviar: ${res.error})`;
        setTimeout(() => { openDuels(); if (res && !res.error) duelOutcomeToast(d, res); }, 1900);
    }

    function duelOutcomeToast(d, res) {
        if (res.status !== 'completo') {
            showToast('Desafio enviado! Você já vê o resultado quando o amigo jogar.', 'info', 4000);
            return;
        }
        claimDuelReward({ ...d, status: 'completo', from_score: res.from_score, to_score: res.to_score }, true);
    }

    // paga o pacote do vencedor/empate — funciona pra quem jogou primeiro também
    // (chamado ao ver o desafio já resolvido na lista). Marcador permanente.
    function claimDuelReward(d, loud) {
        if (d.status !== 'completo' || d.from_score == null || d.to_score == null) return;
        const key = 'dg_duelclaim_' + d.id;
        if (localStorage.getItem(key)) return;
        const meFrom = window.OnlineDuels && OnlineDuels.myUid() === d.from_user;
        const my = meFrom ? d.from_score : d.to_score;
        const their = meFrom ? d.to_score : d.from_score;
        try { localStorage.setItem(key, '1'); } catch (e) {}
        if (my > their) grantBonusPack('duel-' + d.id, 2, `Você venceu o desafio ${my} a ${their}!`);
        else if (my === their) grantBonusPack('duel-' + d.id, 1, `Empate no desafio (${my} a ${my})!`);
        else if (loud) showToast(`Você perdeu o desafio ${my} a ${their}. Revanche? 😤`, 'info', 4500);
    }

    function duelRole(d) {
        const me = window.OnlineDuels ? OnlineDuels.myUid() : null;
        const meFrom = d.from_user === me;
        return {
            meFrom,
            myDone: meFrom ? d.from_done : d.to_done,
            myScore: meFrom ? d.from_score : d.to_score,
            theirScore: meFrom ? d.to_score : d.from_score,
            theirName: (meFrom ? d.to_username : d.from_username) || 'alguém',
            isMural: !d.to_user && !meFrom,
        };
    }

    function duelCardHTML(d) {
        const m = MODE_META[d.mode] || { icon: '⚔️', label: d.mode };
        const r = duelRole(d);
        let line, btn = '';
        if (d.status === 'cancelado') {
            line = '<span class="dc-mut">Cancelado</span>';
        } else if (d.status === 'completo') {
            const win = r.myScore > r.theirScore, tie = r.myScore === r.theirScore;
            line = `<b class="${win ? 'dc-win' : tie ? '' : 'dc-lose'}">${win ? '🏆 Você venceu' : tie ? '🤝 Empate' : 'Você perdeu'}</b>
                    <span class="dc-mut">${r.myScore} × ${r.theirScore} · ${r.theirName}</span>`;
        } else if (!r.myDone) {
            line = r.isMural
                ? `<span class="dc-mut">Mural · desafio de ${d.from_username}</span>`
                : `<span class="dc-mut">${r.meFrom ? 'Você desafiou' : 'Desafio de'} ${r.theirName}</span>`;
            btn = `<button class="btn-primary dc-play" data-duel="${d.id}">▶ ${r.isMural ? 'Aceitar e jogar' : 'Jogar'}</button>`;
        } else {
            line = `<span class="dc-mut">Você fez ${r.myScore} · aguardando ${r.theirName}</span>`;
            if (r.meFrom && !d.to_done) btn = `<button class="tm-btn dc-cancel" data-duel="${d.id}">Cancelar</button>`;
        }
        return `<div class="dc-card"><div class="dc-top"><span class="dc-icon">${m.icon}</span>
            <span class="dc-mode">${m.label}<small> · nível ${d.difficulty}</small></span></div>
            <div class="dc-line">${line}</div>${btn}</div>`;
    }

    async function renderDuels() {
        const mineBox = document.getElementById('duel-mine-list');
        const muralBox = document.getElementById('duel-mural-list');
        if (!mineBox) return;
        mineBox.innerHTML = '<p class="ot-empty">carregando…</p>';
        const [mine, mural] = await Promise.all([OnlineDuels.mine(), OnlineDuels.mural()]);
        mine.forEach(d => { if (d.status === 'completo') claimDuelReward(d, false); });
        mineBox.innerHTML = mine.length ? mine.map(duelCardHTML).join('')
            : '<p class="ot-empty">Nenhum desafio ainda. Toque em “Novo desafio”.</p>';
        muralBox.innerHTML = mural.length ? mural.map(duelCardHTML).join('')
            : '<p class="ot-empty">Nenhum desafio no mural agora.</p>';

        const pend = mine.filter(d => d.status === 'aberto' && !duelRole(d).myDone).length;
        const badge = document.getElementById('duel-mine-badge');
        if (badge) { badge.hidden = !pend; badge.textContent = pend; }
        const hubB = document.getElementById('btn-duels');
        if (hubB) hubB.classList.toggle('has-pend', pend > 0);

        const wire = (box) => box.querySelectorAll('[data-duel]').forEach(b => b.addEventListener('click', async () => {
            const all = [...mine, ...mural];
            const d = all.find(x => x.id === b.dataset.duel);
            if (!d) return;
            if (b.classList.contains('dc-cancel')) { await OnlineDuels.cancel(d.id); renderDuels(); return; }
            b.disabled = true;
            const fresh = await OnlineDuels.get(d.id) || d;
            playDuel(fresh);
        }));
        wire(mineBox); wire(muralBox);
    }

    function duelSubscribe() {
        if (duelUnsub || !window.OnlineDuels) return;
        duelUnsub = OnlineDuels.subscribe((payload) => {
            const d = payload.new || {};
            if (showScreen._current === 'duels') { renderDuels(); return; }
            if (d.status === 'completo') showToast('⚔️ Um desafio seu terminou! Veja quem ganhou.', 'success', 4000);
            else if (d.to_done || d.from_done) showToast('⚔️ Seu adversário jogou o desafio!', 'info', 3500);
        });
    }

    async function openDuels() {
        const on = window.DG_ONLINE && window.OnlineDuels;
        document.getElementById('duels-offline-hint').hidden = !!on;
        ['duel-new'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = on ? '' : 'none'; });
        document.querySelectorAll('#duels-menu .duel-tabs, #duels-menu .ot-pane')
            .forEach(el => el.style.display = on ? '' : 'none');
        showScreen('duels');
        if (on) { renderDuels(); renderLiveDuels(); duelSubscribe(); }
    }

    // tabs meus / ao vivo / mural
    document.querySelectorAll('#duels-menu [data-dt]').forEach(t => t.addEventListener('click', () => {
        const k = t.dataset.dt;
        document.querySelectorAll('#duels-menu [data-dt]').forEach(x => x.classList.toggle('active', x === t));
        document.getElementById('duel-meus').classList.toggle('hidden', k !== 'meus');
        document.getElementById('duel-live').classList.toggle('hidden', k !== 'live');
        document.getElementById('duel-mural').classList.toggle('hidden', k !== 'mural');
        if (k === 'live') renderLiveDuels();
    }));

    // ---- modal "Novo desafio" ----
    let dcmKind = 'async', dcmMode = null, dcmLvl = null, dcmTarget = null;
    let dcmCount = DUEL_Q, dcmPool = 'paises', dcmPace = 'normal';
    const dcmStart = document.getElementById('dcm-start');
    const dcmErr = document.getElementById('dcm-error');
    function dcmRefresh() {
        const friendOk = dcmTarget !== 'direto' || document.getElementById('dcm-friend').value.trim().length >= 2;
        dcmStart.disabled = !(dcmMode && dcmLvl && dcmTarget && friendOk);
        dcmStart.textContent = dcmKind === 'live' ? 'Criar sala e esperar' : 'Montar e jogar';
        // pool só pra "Qual a Bandeira?"; ritmo só pro ao vivo
        const poolOn = dcmMode === DUEL_POOL_MODE;
        document.getElementById('dcm-pool').hidden = !poolOn;
        document.getElementById('dcm-pool-label').hidden = !poolOn;
        if (!poolOn) dcmPool = 'paises';
        const paceOn = dcmKind === 'live';
        document.getElementById('dcm-pace').hidden = !paceOn;
        document.getElementById('dcm-pace-label').hidden = !paceOn;
    }
    function showDcmError(m) { dcmErr.textContent = m; dcmErr.classList.remove('hidden'); }
    document.querySelectorAll('#dcm-kind .dcm-mode').forEach(b => b.addEventListener('click', () => {
        dcmKind = b.dataset.kind;
        document.querySelectorAll('#dcm-kind .dcm-mode').forEach(x => x.classList.toggle('sel', x === b));
        const muralBtn = document.querySelector('#dcm-target .dcm-mode[data-target="mural"]');
        if (muralBtn) muralBtn.textContent = dcmKind === 'live' ? '🌐 Sala aberta' : '📌 Mural (qualquer amigo)';
        dcmRefresh();
    }));
    document.querySelectorAll('#dcm-modes .dcm-mode').forEach(b => b.addEventListener('click', () => {
        dcmMode = b.dataset.mode;
        document.querySelectorAll('#dcm-modes .dcm-mode').forEach(x => x.classList.toggle('sel', x === b));
        dcmRefresh();
    }));
    document.querySelectorAll('#dcm-pool .dcm-mode').forEach(b => b.addEventListener('click', () => {
        dcmPool = b.dataset.pool;
        document.querySelectorAll('#dcm-pool .dcm-mode').forEach(x => x.classList.toggle('sel', x === b));
    }));
    document.querySelectorAll('#dcm-count .dcm-lvl').forEach(b => b.addEventListener('click', () => {
        dcmCount = +b.dataset.count;
        document.querySelectorAll('#dcm-count .dcm-lvl').forEach(x => x.classList.toggle('sel', x === b));
    }));
    document.querySelectorAll('#dcm-pace .dcm-mode').forEach(b => b.addEventListener('click', () => {
        dcmPace = b.dataset.pace;
        document.querySelectorAll('#dcm-pace .dcm-mode').forEach(x => x.classList.toggle('sel', x === b));
    }));
    document.querySelectorAll('#dcm-levels .dcm-lvl').forEach(b => b.addEventListener('click', () => {
        dcmLvl = +b.dataset.lvl;
        document.querySelectorAll('#dcm-levels .dcm-lvl').forEach(x => x.classList.toggle('sel', x === b));
        dcmRefresh();
    }));
    document.querySelectorAll('#dcm-target .dcm-mode').forEach(b => b.addEventListener('click', () => {
        dcmTarget = b.dataset.target;
        document.querySelectorAll('#dcm-target .dcm-mode').forEach(x => x.classList.toggle('sel', x === b));
        document.getElementById('dcm-friend-row').classList.toggle('hidden', dcmTarget !== 'direto');
        dcmRefresh();
    }));
    document.getElementById('dcm-friend').addEventListener('input', dcmRefresh);
    document.getElementById('dcm-close').addEventListener('click', () => modals.duelCompose.classList.add('hidden'));
    document.getElementById('duel-new').addEventListener('click', () => {
        dcmErr.classList.add('hidden');
        modals.duelCompose.classList.remove('hidden');
    });
    dcmStart.addEventListener('click', async () => {
        dcmErr.classList.add('hidden');
        dcmStart.disabled = true; dcmStart.textContent = 'Montando…';
        let toUser = null;
        if (dcmTarget === 'direto') {
            toUser = await OnlineDuels.findUser(document.getElementById('dcm-friend').value);
            if (!toUser) { showDcmError('Não achei esse usuário.'); dcmStart.disabled = false; dcmStart.textContent = 'Montar e jogar'; return; }
            if (toUser.id === OnlineDuels.myUid()) { showDcmError('Escolha um amigo, não você.'); dcmStart.disabled = false; dcmStart.textContent = 'Montar e jogar'; return; }
        }
        const questions = buildDuelQuestions(dcmMode, dcmLvl, dcmCount, dcmPool);
        const r = dcmKind === 'live'
            ? await OnlineDuels.createLive(dcmMode, dcmLvl, questions, toUser)
            : await OnlineDuels.create(dcmMode, dcmLvl, questions, toUser);
        dcmStart.disabled = false; dcmRefresh();
        if (r.error) { showDcmError(r.error); return; }
        modals.duelCompose.classList.add('hidden');
        if (dcmKind === 'live') openLiveRoom(r.duel, true, DUEL_PACE[dcmPace] || LIVE_Q_MS);
        else playDuel(r.duel);
    });
    document.getElementById('duels-back').addEventListener('click', () => showScreen('main'));
    const btnDuels = document.getElementById('btn-duels');
    if (btnDuels) btnDuels.addEventListener('click', openDuels);

    // ═══════════════ DUELO AO VIVO ═══════════════
    let _live = null;      // sala/partida em andamento
    let _qTimer = null;    // timer da pergunta (só no ao vivo)
    const LIVE_Q_MS = 13000, LIVE_COUNT = 3, LIVE_FORFEIT_MS = 14000;

    function clearQTimer() { if (_qTimer) { clearInterval(_qTimer); _qTimer = null; } }
    function startQTimer() {
        clearQTimer();
        const bar = document.getElementById('live-timer');
        const fill = document.getElementById('live-timer-fill');
        if (bar) bar.classList.remove('hidden');
        const dur = (_live && _live.pace) || LIVE_Q_MS;
        const t0 = Date.now();
        _qTimer = setInterval(() => {
            const left = Math.max(0, dur - (Date.now() - t0));
            const pct = left / dur * 100;
            if (fill) { fill.style.width = pct + '%'; fill.classList.toggle('lt-low', pct < 30); }
            if (left <= 0) { clearQTimer(); liveForceTimeout(); }
        }, 80);
    }
    function liveForceTimeout() {
        if (gameLocked || gameState._duelDone) return;
        gameLocked = true;
        if (correctAnswer && correctAnswer.codigo) { updateCountryStats(correctAnswer.codigo, false); queueReview(correctAnswer.codigo); }
        gameState.streak = 0;
        document.querySelectorAll('.flag-option, .text-option, .shape-option').forEach(x => {
            x.classList.add('disabled');
            if (x.dataset.codigo === correctAnswer.codigo || x.dataset.continente === correctAnswer.continente) x.classList.add('correct');
        });
        elements.feedback.textContent = '⏱ Tempo esgotado!';
        elements.feedback.style.color = '#f59e0b';
        if (window.SFX) window.SFX.play('wrong');
        updateStats();
        liveAfterAnswer(false);
    }
    function liveAfterAnswer(isCor) {
        clearQTimer();
        buttons.next.classList.add('hidden'); buttons.facts.classList.add('hidden');
        if (_live && _live.room) {
            _live.room.send('progress', { q: gameState.roundNum, score: gameState.score, correct: !!isCor });
        }
        updateLiveHud();
        setTimeout(() => {
            if (!gameState.duel || !gameState.duel.live || gameState._duelDone) return;
            if (gameState.roundNum >= gameState.duelTotal) finishDuel();
            else nextRound();
        }, isCor ? 750 : 1150);
    }

    function updateLiveHud() {
        if (!_live) return;
        const set = (id, v) => { const e = document.getElementById(id); if (e != null && v != null) e.textContent = v; };
        set('lh-me-score', gameState && typeof gameState.score === 'number' ? gameState.score : 0);
        set('lh-opp-score', _live.oppScore || 0);
        set('lh-opp-name', _live.oppName || '?');
        set('lh-opp-av', _live.oppAvatar || '❓');
        const q = document.getElementById('lh-opp-q');
        if (q) q.textContent = _live.oppDone ? '✅' : (_live.oppQ ? 'Q' + _live.oppQ : '');
        const fill = document.getElementById('lh-bar-fill');
        if (fill) {
            const me = (gameState && gameState.score) || 0, op = _live.oppScore || 0, tot = Math.max(1, me + op);
            fill.style.width = (me / tot * 100) + '%';
        }
    }

    // ---- sala de espera / pronto ----
    function openLiveRoom(duel, isHost, pace) {
        liveCleanup();
        const meUid = OnlineDuels.myUid();
        const oppFromRow = () => isHost
            ? { id: duel.guest_user, name: duel.guest_name, av: duel.guest_avatar }
            : { id: duel.host_user, name: duel.host_name, av: duel.host_avatar };
        _live = {
            id: duel.id, isHost, phase: 'room',
            mode: duel.mode, difficulty: duel.difficulty, questions: duel.questions,
            pace: pace || LIVE_Q_MS,
            iReady: false, oppReady: false, oppPresent: false,
            oppName: oppFromRow().name, oppAvatar: oppFromRow().av || '❓', oppUid: oppFromRow().id,
            oppScore: 0, oppQ: 0, oppDone: false, iAmDone: false,
            room: null, foTimer: null, resultShown: false,
        };
        const m = MODE_META[duel.mode] || { icon: '⚡', label: duel.mode };
        const nq = (duel.questions || []).length;
        const paceLbl = { 8000: ' · ⚡ rápido', 13000: '', 20000: ' · 🐢 calmo' }[_live.pace] || '';
        document.getElementById('lr-me-av').textContent = Auth.avatarOf(currentUser) || '🌍';
        document.getElementById('lr-me-name').textContent = currentUser || 'você';
        document.getElementById('lr-me-status').textContent = '…';
        document.getElementById('lr-mode').textContent = `${m.icon} ${m.label} · nível ${duel.difficulty} · ${nq} perguntas${paceLbl}`;
        document.getElementById('lr-ready').classList.remove('hidden');
        document.getElementById('lr-ready').disabled = false;
        document.getElementById('lr-start').classList.add('hidden');
        document.getElementById('lr-countdown').classList.add('hidden');
        refreshLiveRoomOpp();

        _live.room = OnlineDuels.liveRoom(duel.id, {
            onPresence: (keys) => {
                _live.oppPresent = _live.oppUid ? keys.includes(_live.oppUid) : (keys.length > 1);
                if (_live.oppPresent && _live.foTimer) { clearTimeout(_live.foTimer); _live.foTimer = null; }
                refreshLiveRoomOpp();
            },
            onLeave: (keys) => {
                if (_live.oppUid && keys.length && !keys.includes(_live.oppUid)) return;
                _live.oppPresent = false;
                refreshLiveRoomOpp();
                if (_live.foTimer) return;
                if (_live.phase === 'playing' || _live.phase === 'countdown' || _live.phase === 'waiting') {
                    _live.foTimer = setTimeout(async () => {
                        if (!_live || _live.oppPresent || _live.resultShown) return;
                        await OnlineDuels.forfeitLive(_live.id);
                        showLiveResult({ forfeit: true });
                    }, LIVE_FORFEIT_MS);
                }
            },
            onMsg: (ev, p) => handleLiveMsg(ev, p),
        });

        showScreen('live');
    }

    function refreshLiveRoomOpp() {
        if (!_live) return;
        const av = document.getElementById('lr-opp-av');
        const nm = document.getElementById('lr-opp-name');
        const st = document.getElementById('lr-opp-status');
        const hint = document.getElementById('lr-hint');
        if (_live.oppUid) {
            av.textContent = _live.oppAvatar || '🌍';
            nm.textContent = _live.oppName || 'adversário';
            st.textContent = _live.oppReady ? 'pronto ✓' : (_live.oppPresent ? 'conectado' : 'entrou');
            if (hint) hint.textContent = 'Os dois aqui! Aperta "Estou pronto".';
        } else {
            av.textContent = '❓';
            nm.textContent = 'aguardando…';
            st.textContent = _live.isHost ? 'chame um amigo pelo "Ao vivo" ou "Um amigo"' : '';
            if (hint) hint.textContent = _live.isHost
                ? 'O amigo entra pela aba "⚡ Ao vivo". Ou fecha e cria de novo escolhendo "Um amigo".'
                : 'Conectando…';
        }
        document.getElementById('lr-me-status').textContent = _live.iReady ? 'pronto ✓' : '…';
        // host + os dois prontos -> botão "Começar"
        const canStart = _live.isHost && _live.iReady && _live.oppReady && _live.oppUid;
        document.getElementById('lr-start').classList.toggle('hidden', !canStart);
        document.getElementById('lr-ready').classList.toggle('hidden', _live.iReady);
    }

    function handleLiveMsg(ev, p) {
        if (!_live) return;
        if (ev === 'ready') { _live.oppReady = true; refreshLiveRoomOpp(); }
        else if (ev === 'go') {
            if (p && p.pace) _live.pace = p.pace;
            if (_live.phase === 'room') startLiveCountdown();
        }
        else if (ev === 'progress') {
            _live.oppScore = p.score || 0; _live.oppQ = p.q || _live.oppQ;
            if (window.SFX) window.SFX.play('tick');
            updateLiveHud();
        }
        else if (ev === 'done') {
            _live.oppDone = true; _live.oppScore = p.score != null ? p.score : _live.oppScore;
            updateLiveHud();
            if (_live.iAmDone) settleLiveDuel();
            else showToast(`${_live.oppName} terminou com ${_live.oppScore}! Corre! 🏃`, 'info', 3000);
        }
        else if (ev === 'rematch') showToast(`${_live.oppName} quer revanche!`, 'info', 4000);
    }

    document.getElementById('lr-ready').addEventListener('click', () => {
        if (!_live) return;
        _live.iReady = true;
        _live.room.send('ready', {});
        refreshLiveRoomOpp();
        if (!_live.isHost) document.getElementById('lr-hint').textContent = 'Pronto! Esperando o anfitrião começar…';
    });
    document.getElementById('lr-start').addEventListener('click', async () => {
        if (!_live || !_live.isHost) return;
        const b = document.getElementById('lr-start');
        b.disabled = true; b.textContent = 'Começando…';
        const r = await OnlineDuels.startLive(_live.id);
        b.disabled = false; b.textContent = 'Começar o duelo!';
        if (r && r.error) { showToast(r.error, 'error'); return; }
        _live.room.send('go', { pace: _live.pace });
        startLiveCountdown();
    });
    document.getElementById('lr-cancel').addEventListener('click', () => leaveLiveRoom(true));
    document.getElementById('lr-back').addEventListener('click', () => leaveLiveRoom(true));

    async function leaveLiveRoom(userInitiated) {
        if (_live && _live.isHost && userInitiated && (_live.phase === 'room')) {
            try { await OnlineDuels.cancelLive(_live.id); } catch (e) {}
        }
        liveCleanup();
        showScreen('duels');
        renderLiveDuels();
    }

    function startLiveCountdown() {
        if (!_live) return;
        _live.phase = 'countdown';
        const cd = document.getElementById('lr-countdown');
        const span = cd.querySelector('span');
        document.getElementById('lr-ready').classList.add('hidden');
        document.getElementById('lr-start').classList.add('hidden');
        document.getElementById('lr-cancel').classList.add('hidden');
        cd.classList.remove('hidden');
        let n = LIVE_COUNT;
        const tick = () => {
            span.textContent = n > 0 ? n : 'VAI!';
            span.classList.remove('cd-pop'); void span.offsetWidth; span.classList.add('cd-pop');
            if (window.SFX) window.SFX.play(n > 0 ? 'tick' : 'streak');
            if (n < 0) { cd.classList.add('hidden'); beginLiveGame(); return; }
            n--; setTimeout(tick, 1000);
        };
        tick();
    }

    function beginLiveGame() {
        if (!_live) return;
        _live.phase = 'playing';
        document.getElementById('live-hud').classList.remove('hidden');
        _live.iAmDone = false;
        updateLiveHud();
        startGame({
            mode: _live.mode, type: null, level: _live.difficulty, lives: 'infinite', pool: 'paises',
            duel: { id: _live.id, live: true, mode: _live.mode, difficulty: _live.difficulty, questions: _live.questions },
        });
    }

    async function finishLiveDuel() {
        if (!_live) return;
        _live.iAmDone = true;
        _live.phase = 'waiting';
        elements.options.classList.add('hidden');
        document.getElementById('live-timer').classList.add('hidden');
        elements.instruction.textContent = `Você fez ${gameState.score} pontos!`;
        elements.feedback.textContent = _live.oppDone ? 'apurando…' : `aguardando ${_live.oppName} terminar…`;
        elements.feedback.style.color = 'var(--text-muted)';
        updateLiveHud();
        _live.room.send('done', { score: gameState.score });
        const r = await OnlineDuels.finishLive(_live.id, gameState.score);
        if (r && r.error) { elements.feedback.textContent = 'erro ao enviar: ' + r.error; return; }
        _live.serverRes = r;
        if (r.status === 'terminado' || _live.oppDone) settleLiveDuel();
    }

    async function settleLiveDuel() {
        if (!_live || _live.resultShown) return;
        // confirma no servidor
        let r = _live.serverRes;
        if (!r || r.status !== 'terminado') {
            for (let i = 0; i < 4 && (!r || r.status !== 'terminado'); i++) {
                await new Promise((res) => setTimeout(res, 500));
                r = await OnlineDuels.getLive(_live.id);
                if (r) r = { status: r.status, winner: r.winner, host_score: r.host_score, guest_score: r.guest_score, host_user: r.host_user };
            }
        }
        showLiveResult(r || {});
    }

    function showLiveResult(r) {
        if (!_live || _live.resultShown) return;
        _live.resultShown = true;
        _live.phase = 'done';
        clearQTimer();
        const id = _live.id;
        const meUid = OnlineDuels.myUid();
        const myScore = (gameState && gameState.score) || 0;
        let oppScore = _live.oppScore || 0;
        let iWon, tie;
        if (r.forfeit) { iWon = true; tie = false; oppScore = _live.oppScore || 0; }
        else if (r.winner) { iWon = r.winner === meUid; tie = false; }
        else { tie = myScore === oppScore; iWon = myScore > oppScore; }

        screens.game.classList.add('game-over-view');
        elements.options.classList.add('hidden');
        document.getElementById('live-hud').classList.add('hidden');
        document.getElementById('live-timer').classList.add('hidden');
        const rb = document.getElementById('replay-audio-btn'); if (rb) rb.hidden = true;
        buttons.next.classList.add('hidden'); buttons.facts.classList.add('hidden'); buttons.hint.classList.add('hidden');
        buttons.playAgain.classList.add('hidden');

        const head = r.forfeit ? '🏆 Você venceu!' : iWon ? '🏆 VOCÊ VENCEU!' : tie ? '🤝 EMPATE!' : '😤 Você perdeu';
        elements.instruction.textContent = head;
        elements.feedback.innerHTML = r.forfeit
            ? `${_live.oppName} caiu da partida.`
            : `<b>${currentUser}</b> ${myScore} &nbsp;×&nbsp; ${oppScore} <b>${_live.oppName}</b>`;
        elements.feedback.style.color = iWon || r.forfeit ? '#4ade80' : tie ? '#fbbf24' : '#f87171';

        if ((iWon || tie) && !calmMode && typeof confetti !== 'undefined') {
            confetti({ particleCount: iWon ? 160 : 90, spread: 90, startVelocity: 42, origin: { y: .4 } });
        }
        if (window.SFX) window.SFX.play(iWon || r.forfeit ? 'victory' : tie ? 'levelup' : 'defeat');

        // pacote: vitória +3, empate +2 (marcador permanente)
        try {
            if (!localStorage.getItem('dg_liveclaim_' + id)) {
                localStorage.setItem('dg_liveclaim_' + id, '1');
                if (iWon || r.forfeit) grantBonusPack('live-' + id, 3, 'Vitória no duelo ao vivo!');
                else if (tie) grantBonusPack('live-' + id, 2, 'Empate no duelo ao vivo!');
            }
        } catch (e) {}
        markModePlayed(_live.mode);

        // botões de fim
        const wrap = document.getElementById('learn-summary');
        if (wrap) {
            wrap.classList.remove('hidden');
            wrap.innerHTML = `<div class="live-end-actions">
                <button id="live-rematch" class="btn-primary">Revanche ⚡</button>
                <button id="live-exit" class="pack-end-more">Voltar</button></div>`;
            const oppUid = _live.oppUid, oppName = _live.oppName, mode = _live.mode, diff = _live.difficulty;
            const nq = (_live.questions || []).length || DUEL_Q, pace = _live.pace || LIVE_Q_MS;
            document.getElementById('live-rematch').addEventListener('click', async () => {
                if (_live && _live.room) _live.room.send('rematch', {});
                liveCleanup();
                const qs = buildDuelQuestions(mode, diff, nq);
                const rr = await OnlineDuels.createLive(mode, diff, qs, oppUid ? { id: oppUid, username: oppName } : null);
                if (rr.error) { showToast(rr.error, 'error'); showScreen('duels'); return; }
                openLiveRoom(rr.duel, true, pace);
            });
            document.getElementById('live-exit').addEventListener('click', () => { liveCleanup(); showScreen('duels'); renderLiveDuels(); });
        }
    }

    function liveCleanup() {
        clearQTimer();
        if (_live) {
            if (_live.foTimer) clearTimeout(_live.foTimer);
            try { _live.room && _live.room.leave(); } catch (e) {}
            try { _live.pgUnsub && _live.pgUnsub(); } catch (e) {}
        }
        _live = null;
        document.getElementById('live-hud')?.classList.add('hidden');
        document.getElementById('live-timer')?.classList.add('hidden');
    }

    // paga o pacote do vencedor ao vivo mesmo se ele não viu a tela de resultado
    function claimLiveReward(row) {
        if (!row || row.status !== 'terminado') return;
        const me = OnlineDuels.myUid();
        if (row.host_user !== me && row.guest_user !== me) return;
        const key = 'dg_liveclaim_' + row.id;
        try {
            if (localStorage.getItem(key)) return;
            localStorage.setItem(key, '1');
        } catch (e) { return; }
        const myS = row.host_user === me ? row.host_score : row.guest_score;
        const opS = row.host_user === me ? row.guest_score : row.host_score;
        const won = row.winner === me || (myS != null && opS != null && myS > opS);
        const tie = !row.winner && myS === opS;
        if (won) grantBonusPack('live-' + row.id, 3, 'Vitória no duelo ao vivo!');
        else if (tie) grantBonusPack('live-' + row.id, 2, 'Empate no duelo ao vivo!');
    }

    // ---- lista de duelos ao vivo (aba) ----
    let _liveInviteShownFor = null;
    async function renderLiveDuels() {
        const box = document.getElementById('duel-live-list');
        if (!box || !window.OnlineDuels) return;
        box.innerHTML = '<p class="ot-empty">carregando…</p>';
        const [mine, lobby] = await Promise.all([OnlineDuels.myLive(), OnlineDuels.liveLobby()]);
        const all = [...mine, ...lobby.filter(l => !mine.some(m => m.id === l.id))];
        const meUid = OnlineDuels.myUid();
        box.innerHTML = all.length ? all.map(d => {
            const m = MODE_META[d.mode] || { icon: '⚡', label: d.mode };
            const host = d.host_user === meUid;
            const who = host ? (d.guest_name || (d.invited_user ? 'convidado' : 'sala aberta')) : d.host_name;
            const label = d.status === 'jogando' ? 'em jogo' : d.status === 'pronto' ? 'pronto pra começar' : 'esperando';
            return `<div class="dc-card"><div class="dc-top"><span class="dc-icon">${m.icon}</span>
                <span class="dc-mode">${m.label}<small> · nível ${d.difficulty} · ao vivo</small></span></div>
                <div class="dc-line"><span class="dc-mut">${host ? 'sua sala' : 'de ' + d.host_name} · ${label}</span></div>
                <button class="btn-primary dc-play" data-live="${d.id}" data-host="${host ? 1 : 0}">
                    ${host ? '▶ Entrar na sala' : '⚡ Entrar e jogar'}</button></div>`;
        }).join('') : '<p class="ot-empty">Nenhum duelo ao vivo agora. Toque em “Novo desafio” → “Ao vivo”.</p>';

        const badge = document.getElementById('duel-live-badge');
        const pend = all.filter(d => d.host_user !== meUid || d.guest_user).length;
        if (badge) { badge.hidden = !all.length; badge.textContent = all.length; }

        box.querySelectorAll('[data-live]').forEach(b => b.addEventListener('click', async () => {
            b.disabled = true;
            const isHost = b.dataset.host === '1';
            if (isHost) {
                const d = await OnlineDuels.getLive(b.dataset.live);
                if (d) openLiveRoom(d, true);
            } else {
                const r = await OnlineDuels.joinLive(b.dataset.live);
                if (r.error) { showToast(r.error, 'error'); b.disabled = false; return; }
                openLiveRoom(r.duel, false);
            }
        }));
    }

    // convite ao vivo -> modal
    function maybeShowLiveInvite(row) {
        if (!row || row.status !== 'aguardando' || row.invited_user !== OnlineDuels.myUid()) return;
        if (_liveInviteShownFor === row.id) return;
        _liveInviteShownFor = row.id;
        const m = MODE_META[row.mode] || { icon: '⚡', label: row.mode };
        document.getElementById('lim-from').textContent = row.host_name;
        document.getElementById('lim-mode').textContent = `${m.icon} ${m.label} · nível ${row.difficulty}`;
        const modal = document.getElementById('live-invite-modal');
        modal.classList.remove('hidden');
        if (window.SFX) window.SFX.play('achievement');
        const accept = document.getElementById('lim-accept');
        const decline = document.getElementById('lim-decline');
        const close = () => modal.classList.add('hidden');
        accept.onclick = async () => {
            close();
            const r = await OnlineDuels.joinLive(row.id);
            if (r.error) { showToast(r.error, 'error'); return; }
            openLiveRoom(r.duel, false);
        };
        decline.onclick = close;
    }
    document.getElementById('lim-decline')?.addEventListener('click', () => document.getElementById('live-invite-modal').classList.add('hidden'));

    // escuta convites/entradas ao vivo o tempo todo (depois do login)
    let _liveNotifUnsub = null;
    function liveNotifSubscribe() {
        if (_liveNotifUnsub || !window.OnlineDuels) return;
        _liveNotifUnsub = OnlineDuels.subscribeLive((payload) => {
            const row = payload.new;
            if (!row) return;
            // convite pra mim
            maybeShowLiveInvite(row);
            if (row.status === 'terminado') claimLiveReward(row);
            if (_live && row.id === _live.id) {
                if (row.status === 'cancelado' && _live.phase === 'room') {
                    showToast('O duelo foi cancelado.', 'info'); leaveLiveRoom(); return;
                }
                // host começou -> guest entra na contagem (backup do broadcast 'go')
                if (row.status === 'jogando' && _live.phase === 'room') { startLiveCountdown(); return; }
                // adversário entrou na minha sala
                const opp = _live.isHost
                    ? { id: row.guest_user, name: row.guest_name, av: row.guest_avatar }
                    : { id: row.host_user, name: row.host_name, av: row.host_avatar };
                if (opp.id && opp.id !== _live.oppUid) {
                    _live.oppUid = opp.id; _live.oppName = opp.name; _live.oppAvatar = opp.av || '❓';
                    if (window.SFX) window.SFX.play('coin');
                    refreshLiveRoomOpp();
                }
            }
            if (showScreen._current === 'duels') renderLiveDuels();
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  FASE 34C — SALA "Conhecimento é Poder" (telão + celulares)
    // ═══════════════════════════════════════════════════════════════════
    let _kp = null;
    let _kpTimer = null, _kpSabInt = null;
    const KP_Q_MS = 12000, KP_REVEAL_MS = 3600, KP_BOARD_MS = 3200, KP_SAB_MS = 12000;
    const KP_POWERS = { borrao: '🖊️ Borrão', embaralha: '🔀 Embaralha', congela: '❄️ Congela' };
    const KP_POWER_LABEL = { borrao: 'um borrão 🖊️', embaralha: 'o embaralha 🔀', congela: 'o congela ❄️' };

    function kpClearTimers() {
        if (_kpTimer) { clearInterval(_kpTimer); _kpTimer = null; }
        if (_kpSabInt) { clearInterval(_kpSabInt); _kpSabInt = null; }
    }
    function kpv(id) { // mostra uma sub-view do telão / controle
        const root = _kp && _kp.role === 'host' ? 'kp-host' : 'kp-ctrl';
        document.querySelectorAll(`#${root} > .kph-view, #${root} > .kpc-view`).forEach(v => v.classList.add('hidden'));
        const el = document.getElementById(id); if (el) el.classList.remove('hidden');
    }

    // monta as N rodadas (auto-contidas: cada uma já traz tudo pra renderizar)
    function kpBuildRounds(mode, diff, n) {
        const raw = buildDuelQuestions(mode, diff, n, 'paises');
        return raw.map(q => {
            const c = albumItem(q.code) || countries.find(x => x.codigo === q.code) || {};
            if (mode === 'ContinentePorPais') {
                return { correctKey: c.continente, instruction: `Qual o continente ${c.artigo || 'de'} ${c.nome}?`,
                    media: null, opts: q.opts.map(x => ({ k: x, label: x })) };
            }
            if (mode === 'NomePorBandeira') {
                return { correctKey: c.codigo, instruction: 'De qual país é esta bandeira?',
                    media: itemImg(c), opts: q.opts.map(code => ({ k: code, label: (albumItem(code) || {}).nome || code })) };
            }
            const instr = mode === 'PaisPorCapital'
                ? `De qual país é a capital ${c.capital}?`
                : `Qual é a bandeira ${c.artigo || 'de'} ${c.nome}?`;
            return { correctKey: c.codigo, instruction: instr, media: null,
                opts: q.opts.map(code => { const o = albumItem(code) || {}; return { k: code, label: o.nome || code, img: itemImg(o) }; }) };
        });
    }

    // ---------- ANFITRIÃO (telão) ----------
    async function openKpHost() {
        if (!(window.DG_ONLINE && window.OnlineParty && OnlineParty.isLogged())) {
            showToast('Entre com sua conta pra criar uma sala.', 'info'); return;
        }
        kpCleanup();
        const cfg = { mode: 'BandeiraPorPais', difficulty: 2, rounds: 10 };
        const r = await OnlineParty.createRoom(cfg);
        if (r.error) { showToast(r.error, 'error'); return; }
        _kp = {
            role: 'host', code: r.code, roomId: r.id, config: cfg,
            players: {}, questions: [], round: 0, phase: 'lobby',
            answers: {}, sabotages: {}, sabCasts: {}, room: null,
        };
        document.getElementById('kph-code').textContent = r.code;
        document.getElementById('kph-mode').value = cfg.mode;
        document.getElementById('kph-diff').value = String(cfg.difficulty);
        document.getElementById('kph-rounds').value = String(cfg.rounds);
        renderKpPlayers();
        showScreen('kpHost');
        kpv('kph-lobby');

        _kp.room = OnlineParty.joinChannel(r.code, { name: currentUser, avatar: Auth.avatarOf(currentUser) || '🌍', role: 'host' }, {
            onPresence: (list) => kpHostPresence(list),
            onLeave: () => {},
            onMsg: (ev, p) => kpHostMsg(ev, p),
        });
    }

    function kpHostPresence(list) {
        if (!_kp || _kp.role !== 'host') return;
        const hostPid = _kp.room ? _kp.room.pid : OnlineParty.myPid();
        const seen = new Set();
        list.forEach(pp => {
            if (pp.role === 'host' || pp.pid === hostPid) return;
            seen.add(pp.pid);
            if (!_kp.players[pp.pid]) _kp.players[pp.pid] = { pid: pp.pid, name: pp.name || 'jogador', avatar: pp.avatar || '🙂', score: 0, streak: 0 };
            else { _kp.players[pp.pid].name = pp.name || _kp.players[pp.pid].name; _kp.players[pp.pid].avatar = pp.avatar || _kp.players[pp.pid].avatar; }
        });
        // remove quem saiu (só no lobby; durante o jogo mantém o placar)
        if (_kp.phase === 'lobby') {
            Object.keys(_kp.players).forEach(pid => { if (!seen.has(pid)) delete _kp.players[pid]; });
        }
        renderKpPlayers();
        _kp.room && _kp.room.send('lobby', { players: kpPlayerList(), phase: _kp.phase });
    }

    function kpPlayerList() {
        return Object.values(_kp.players).map(p => ({ pid: p.pid, name: p.name, avatar: p.avatar, score: p.score }));
    }
    function renderKpPlayers() {
        const box = document.getElementById('kph-players');
        const ps = Object.values(_kp.players);
        box.innerHTML = ps.length
            ? ps.map(p => `<span class="kph-player"><span class="kph-pav">${p.avatar}</span><b>${p.name}</b></span>`).join('')
            : '<p class="kph-empty">Esperando os jogadores entrarem…</p>';
        const start = document.getElementById('kph-start');
        if (start) { start.disabled = ps.length < 1; start.textContent = ps.length < 2 ? `Começar (${ps.length} jogador${ps.length === 1 ? '' : 'es'})` : `Começar — ${ps.length} jogadores`; }
    }

    function kpHostMsg(ev, p) {
        if (!_kp || _kp.role !== 'host') return;
        if (ev === 'answer') {
            if (_kp.phase !== 'question' || !_kp.players[p.pid] || _kp.answers[p.pid]) return;
            _kp.answers[p.pid] = { choice: p.choice, ms: p.ms || KP_Q_MS };
            renderKpAnswered();
            if (Object.keys(_kp.answers).length >= Object.keys(_kp.players).length) { kpClearTimers(); setTimeout(kpReveal, 350); }
        } else if (ev === 'sabotage-cast') {
            if (_kp.phase !== 'sabotage') return;
            _kp.sabCasts[p.pid] = p.skip ? { skip: true } : { target: p.target, power: p.power };
            if (Object.keys(_kp.sabCasts).length >= Object.keys(_kp.players).length) { kpClearTimers(); kpResolveSabotage(); }
        }
    }

    document.getElementById('kph-back').addEventListener('click', () => kpLeave(true));
    document.getElementById('kph-mode').addEventListener('change', e => { if (_kp) _kp.config.mode = e.target.value; });
    document.getElementById('kph-diff').addEventListener('change', e => { if (_kp) _kp.config.difficulty = +e.target.value; });
    document.getElementById('kph-rounds').addEventListener('change', e => { if (_kp) _kp.config.rounds = +e.target.value; });
    document.getElementById('kph-start').addEventListener('click', () => {
        if (!_kp || Object.keys(_kp.players).length < 1) return;
        _kp.questions = kpBuildRounds(_kp.config.mode, _kp.config.difficulty, _kp.config.rounds);
        _kp.round = 0; _kp.phase = 'playing';
        Object.values(_kp.players).forEach(pl => { pl.score = 0; pl.streak = 0; });
        OnlineParty.setRoomStatus(_kp.roomId, 'playing');
        _kp.room.send('start', { mode: _kp.config.mode, rounds: _kp.config.rounds });
        kpNextRound();
    });

    function kpNextRound() {
        if (!_kp) return;
        _kp.round++;
        if (_kp.round > _kp.config.rounds) { kpPodium(); return; }
        // fase de sabotagem antes das rodadas 3, 5, 7, …
        if (_kp.round >= 3 && _kp.round % 2 === 1) { kpSabotagePhase(); return; }
        kpShowQuestion();
    }

    function kpShowQuestion() {
        _kp.phase = 'question';
        _kp.answers = {};
        const q = _kp.questions[_kp.round - 1];
        const payload = {
            round: _kp.round, total: _kp.config.rounds, mode: _kp.config.mode,
            instruction: q.instruction, media: q.media || null,
            opts: shuffle(q.opts.map(o => ({ k: o.k, label: o.label, img: o.img || null }))),
            sabotages: _kp.sabotages,
        };
        _kp.curCorrect = q.correctKey;
        _kp.curOpts = payload.opts;
        _kp.sabotages = {};
        _kp.room.send('question', payload);
        renderKpHostQuestion(payload);

        const t0 = Date.now();
        kpClearTimers();
        _kpTimer = setInterval(() => {
            const left = Math.max(0, KP_Q_MS - (Date.now() - t0));
            const fill = document.getElementById('kph-timer-fill');
            if (fill) fill.style.width = (left / KP_Q_MS * 100) + '%';
            _kp.room.send('tick', { left });
            if (left <= 0) { kpClearTimers(); kpReveal(); }
        }, 120);
    }

    function renderKpHostQuestion(p) {
        kpv('kph-play');
        document.getElementById('kph-round').textContent = `${p.round}/${p.total}`;
        document.getElementById('kph-phase').textContent = 'Respondam no celular!';
        document.getElementById('kph-question').textContent = p.instruction;
        const media = document.getElementById('kph-media');
        media.innerHTML = p.media ? `<img src="${p.media}" alt="">` : '';
        media.classList.toggle('hidden', !p.media);
        const opts = document.getElementById('kph-options');
        opts.className = 'kph-options' + (p.opts[0] && p.opts[0].img ? ' is-flags' : ' is-text');
        opts.innerHTML = p.opts.map(o => o.img
            ? `<div class="kph-opt" data-k="${o.k}"><img src="${o.img}" alt=""></div>`
            : `<div class="kph-opt kph-opt-text" data-k="${o.k}">${o.label}</div>`).join('');
        document.getElementById('kph-answered').innerHTML = '';
        const fill = document.getElementById('kph-timer-fill'); if (fill) fill.style.width = '100%';
    }
    function renderKpAnswered() {
        const box = document.getElementById('kph-answered');
        if (!box) return;
        box.innerHTML = Object.keys(_kp.answers).map(pid => {
            const pl = _kp.players[pid] || {};
            return `<span class="kph-ans-av" title="${pl.name}">${pl.avatar || '🙂'}</span>`;
        }).join('') + `<span class="kph-ans-count">${Object.keys(_kp.answers).length}/${Object.keys(_kp.players).length}</span>`;
    }

    function kpReveal() {
        if (!_kp || _kp.phase === 'reveal') return;
        _kp.phase = 'reveal';
        kpClearTimers();
        const results = [];
        Object.values(_kp.players).forEach(pl => {
            const a = _kp.answers[pl.pid];
            const correct = a && a.choice === _kp.curCorrect;
            let pts = 0;
            if (correct) {
                const speed = Math.max(0, Math.round((1 - (a.ms / KP_Q_MS)) * 8));
                pl.streak = (pl.streak || 0) + 1;
                pts = 10 + speed + Math.min(6, (pl.streak - 1) * 2);
            } else { pl.streak = 0; }
            pl.score += pts;
            results.push({ pid: pl.pid, correct: !!correct, pts, score: pl.score });
        });
        results.sort((x, y) => y.score - x.score).forEach((r, i) => r.place = i + 1);
        _kp.room.send('reveal', { correct: _kp.curCorrect, results });
        renderKpHostReveal(results);
        setTimeout(kpBoard, KP_REVEAL_MS);
    }
    function renderKpHostReveal(results) {
        document.getElementById('kph-phase').textContent = 'Resposta!';
        document.querySelectorAll('#kph-options .kph-opt').forEach(el => {
            el.classList.toggle('kph-correct', el.dataset.k === _kp.curCorrect);
            el.classList.toggle('kph-dim', el.dataset.k !== _kp.curCorrect);
        });
        const byId = {}; results.forEach(r => byId[r.pid] = r);
        document.getElementById('kph-answered').innerHTML = Object.values(_kp.players).map(pl => {
            const r = byId[pl.pid] || {};
            return `<span class="kph-ans-av ${r.correct ? 'ok' : 'no'}" title="${pl.name}">${pl.avatar}${r.pts ? `<i>+${r.pts}</i>` : ''}</span>`;
        }).join('');
        if (window.SFX) window.SFX.play('reveal_common');
    }

    function kpBoard() {
        if (!_kp) return;
        _kp.phase = 'board';
        const list = Object.values(_kp.players).map(p => ({ pid: p.pid, name: p.name, avatar: p.avatar, score: p.score }))
            .sort((a, b) => b.score - a.score);
        _kp.room.send('scoreboard', { list, round: _kp.round, total: _kp.config.rounds });
        kpv('kph-board');
        document.getElementById('kph-board-title').textContent = `Placar — rodada ${_kp.round}/${_kp.config.rounds}`;
        document.getElementById('kph-board-list').innerHTML = list.map((p, i) =>
            `<div class="kph-brow ${i === 0 ? 'lead' : ''}"><span class="kph-bpos">${i + 1}</span>
             <span class="kph-pav">${p.avatar}</span><b>${p.name}</b><span class="kph-bscore">${p.score}</span></div>`).join('');
        const nextIsSab = (_kp.round + 1) >= 3 && (_kp.round + 1) % 2 === 1 && (_kp.round + 1) <= _kp.config.rounds;
        document.getElementById('kph-board-next').textContent = _kp.round >= _kp.config.rounds ? 'Última rodada!' : (nextIsSab ? '⚡ Vem sabotagem!' : 'Próxima rodada…');
        setTimeout(kpNextRound, KP_BOARD_MS);
    }

    function kpSabotagePhase() {
        _kp.phase = 'sabotage';
        _kp.sabCasts = {};
        const players = Object.values(_kp.players).map(p => ({ pid: p.pid, name: p.name, avatar: p.avatar }));
        _kp.room.send('sabotage-open', { players, durationMs: KP_SAB_MS });
        kpv('kph-play');
        document.getElementById('kph-round').textContent = `Rodada ${_kp.round}`;
        document.getElementById('kph-phase').textContent = '⚡ SABOTAGEM — escolham no celular!';
        document.getElementById('kph-question').textContent = 'Quem vai atrapalhar quem? 😈';
        document.getElementById('kph-media').classList.add('hidden');
        document.getElementById('kph-options').innerHTML = Object.keys(KP_POWERS).map(k => `<div class="kph-opt kph-opt-text">${KP_POWERS[k]}</div>`).join('');
        document.getElementById('kph-answered').innerHTML = '';
        const t0 = Date.now();
        kpClearTimers();
        _kpSabInt = setInterval(() => {
            const left = Math.max(0, KP_SAB_MS - (Date.now() - t0));
            const fill = document.getElementById('kph-timer-fill');
            if (fill) fill.style.width = (left / KP_SAB_MS * 100) + '%';
            if (left <= 0) { kpClearTimers(); kpResolveSabotage(); }
        }, 150);
    }
    function kpResolveSabotage() {
        if (!_kp || _kp.phase !== 'sabotage') return;
        kpClearTimers();
        _kp.sabotages = {};
        const hits = [];
        Object.keys(_kp.sabCasts).forEach(casterPid => {
            const c = _kp.sabCasts[casterPid];
            if (c.skip || !c.target || !c.power) return;
            _kp.sabotages[c.target] = c.power;
            const cn = (_kp.players[casterPid] || {}).name || 'alguém';
            const tn = (_kp.players[c.target] || {}).name || 'alguém';
            hits.push({ from: cn, to: tn, power: c.power });
        });
        _kp.phase = 'sabreveal';
        _kp.room.send('sabotage-hit', { hits });
        // telão mostra quem sabotou quem por uns segundos
        document.getElementById('kph-phase').textContent = '😈 Sabotagens!';
        document.getElementById('kph-question').textContent = hits.length ? 'Olha o que vem por aí…' : 'Ninguém sabotou ninguém 😇';
        document.getElementById('kph-options').innerHTML = hits.length
            ? hits.map(h => `<div class="kph-opt kph-opt-text kph-sabhit">${h.from} → <b>${KP_POWERS[h.power]}</b> → ${h.to}</div>`).join('')
            : '';
        document.getElementById('kph-answered').innerHTML = '';
        if (window.SFX) window.SFX.play('wrong');
        setTimeout(() => { if (_kp && _kp.phase === 'sabreveal') { _kp.phase = 'playing'; kpShowQuestion(); } }, hits.length ? 3400 : 1400);
    }

    function kpPodium() {
        _kp.phase = 'podium';
        kpClearTimers();
        const rank = Object.values(_kp.players).map(p => ({ pid: p.pid, name: p.name, avatar: p.avatar, score: p.score }))
            .sort((a, b) => b.score - a.score);
        rank.forEach((r, i) => r.place = i + 1);
        _kp.room.send('gameover', { rank });
        OnlineParty.setRoomStatus(_kp.roomId, 'done', rank);
        kpv('kph-podium');
        const top = rank.slice(0, 3);
        document.getElementById('kph-podium-box').innerHTML = top.map((p, i) =>
            `<div class="kph-pod kph-pod-${i + 1}"><span class="kph-pmedal">${['🥇', '🥈', '🥉'][i]}</span>
             <span class="kph-pav">${p.avatar}</span><b>${p.name}</b><span>${p.score} pts</span></div>`).join('');
        document.getElementById('kph-podium-rest').innerHTML = rank.slice(3).map((p, i) =>
            `<div class="kph-brow"><span class="kph-bpos">${i + 4}</span><span class="kph-pav">${p.avatar}</span><b>${p.name}</b><span class="kph-bscore">${p.score}</span></div>`).join('');
        if (!calmMode && typeof confetti !== 'undefined') confetti({ particleCount: 180, spread: 100, origin: { y: .3 } });
        if (window.SFX) window.SFX.play('victory');
    }
    document.getElementById('kph-again').addEventListener('click', () => {
        if (!_kp) return;
        _kp.round = 0; _kp.phase = 'lobby';
        Object.values(_kp.players).forEach(p => { p.score = 0; p.streak = 0; });
        OnlineParty.setRoomStatus(_kp.roomId, 'lobby');
        renderKpPlayers();
        kpv('kph-lobby');
        _kp.room.send('lobby', { players: kpPlayerList(), phase: 'lobby' });
    });
    document.getElementById('kph-close').addEventListener('click', () => kpLeave(true));

    // ---------- CONTROLE (celular) ----------
    async function openKpJoin() {
        if (!(window.DG_ONLINE && window.OnlineParty)) { showToast('Precisa de internet.', 'info'); return; }
        kpCleanup();
        const logged = OnlineParty.isLogged();
        document.getElementById('kpj-name-row').hidden = logged;
        document.getElementById('kpj-name').value = logged ? currentUser : '';
        document.getElementById('kpj-error').classList.add('hidden');
        document.getElementById('kpj-code').value = '';
        showScreen('kpJoin');
        setTimeout(() => document.getElementById('kpj-code').focus(), 80);
    }
    document.getElementById('kpj-code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    document.getElementById('kpj-back').addEventListener('click', () => showScreen('main'));
    document.getElementById('kpj-go').addEventListener('click', async () => {
        const code = document.getElementById('kpj-code').value.trim().toUpperCase();
        const err = (m) => { const e = document.getElementById('kpj-error'); e.textContent = m; e.classList.remove('hidden'); };
        const name = OnlineParty.isLogged() ? currentUser : document.getElementById('kpj-name').value.trim();
        if (code.length !== 4) return err('O código tem 4 letras.');
        if (!name || name.length < 2) return err('Digite seu nome.');
        const btn = document.getElementById('kpj-go');
        btn.disabled = true; btn.textContent = 'Entrando…';
        const room = await OnlineParty.findRoom(code);
        btn.disabled = false; btn.textContent = 'Entrar na sala';
        if (!room) return err('Não achei essa sala. Confere o código com quem tá no telão.');
        if (room.status === 'done') return err('Esse jogo já acabou.');

        const avatar = OnlineParty.isLogged() ? (Auth.avatarOf(currentUser) || '🌍') : ['🦊', '🐼', '🐸', '🦁', '🐵', '🐙', '🦄', '🐧'][Math.floor(Math.random() * 8)];
        _kp = { role: 'player', code, roomId: room.id, name, avatar, myPid: OnlineParty.myPid(), phase: 'wait', mode: room.config && room.config.mode, answered: false, room: null };
        document.getElementById('kpc-me-av').textContent = avatar;
        document.getElementById('kpc-me-name').textContent = name;
        showScreen('kpCtrl');
        kpv('kpc-wait');
        document.getElementById('kpc-wait-msg').textContent = 'Você está na sala! Olha o telão. ⏳';

        _kp.room = OnlineParty.joinChannel(code, { name, avatar, role: 'player' }, {
            onPresence: (list) => {
                _kp.myPid = _kp.room ? _kp.room.pid : OnlineParty.myPid();
                const hostThere = list.some(x => x.role === 'host');
                if (!hostThere && _kp.phase !== 'over') {
                    kpv('kpc-done'); _kp.phase = 'over';
                    document.getElementById('kpc-done-msg').textContent = 'O telão saiu — a sala fechou.';
                }
                renderKpCtrlPlayers(list.filter(x => x.role !== 'host'));
            },
            onLeave: () => {},
            onMsg: (ev, p) => kpCtrlMsg(ev, p),
        });
    });
    document.getElementById('kpc-leave').addEventListener('click', () => kpLeave(true));
    document.getElementById('kpc-done-leave').addEventListener('click', () => kpLeave(true));
    document.getElementById('kpc-sab-skip').addEventListener('click', () => kpCastSabotage(null, null));

    function renderKpCtrlPlayers(list) {
        const box = document.getElementById('kpc-players');
        if (box) box.innerHTML = list.map(p => `<span class="kpc-pchip">${p.avatar || '🙂'} ${p.name || ''}</span>`).join('');
    }

    function kpCtrlMsg(ev, p) {
        if (!_kp || _kp.role !== 'player') return;
        if (ev === 'lobby') {
            if (_kp.phase === 'wait') renderKpCtrlPlayers((p.players || []).map(x => ({ name: x.name, avatar: x.avatar })));
        } else if (ev === 'start') {
            _kp.mode = p.mode; _kp.phase = 'playing';
            document.getElementById('kpc-wait-msg').textContent = 'Começou! Preparado? 🔥';
        } else if (ev === 'question') {
            kpCtrlQuestion(p);
        } else if (ev === 'reveal') {
            kpCtrlReveal(p);
        } else if (ev === 'scoreboard') {
            if (_kp.phase !== 'sabotage') { kpv('kpc-done'); document.getElementById('kpc-done-msg').textContent = kpMyBoardLine(p); }
        } else if (ev === 'sabotage-open') {
            kpCtrlSabotage(p);
        } else if (ev === 'sabotage-hit') {
            const mine = (p.hits || []).find(h => h.to === _kp.name);
            if (mine && _kp.phase !== 'question') {
                kpv('kpc-done');
                document.getElementById('kpc-done-msg').textContent = `😱 ${mine.from} te jogou ${KP_POWER_LABEL[mine.power] || 'uma sabotagem'}! Prepara…`;
            }
        } else if (ev === 'gameover') {
            kpCtrlGameover(p);
        }
    }

    function kpMyBoardLine(p) {
        const me = (p.list || []).find(x => x.pid === _kp.myPid);
        const pos = (p.list || []).findIndex(x => x.pid === _kp.myPid) + 1;
        return me ? `Você está em ${pos}º com ${me.score} pts` : 'Placar no telão…';
    }

    function kpCtrlQuestion(p) {
        _kp.phase = 'question'; _kp.answered = false; _kp.qStart = Date.now();
        _kp.curOpts = p.opts;
        kpv('kpc-answer');
        document.getElementById('kpc-feedback').textContent = '';
        document.getElementById('kpc-q').textContent = p.instruction || 'Responde aí! 👇';
        const wrap = document.getElementById('kpc-options');
        wrap.className = 'kpc-options' + (p.opts[0] && p.opts[0].img ? ' is-flags' : ' is-text');
        wrap.innerHTML = p.opts.map(o => o.img
            ? `<button class="kpc-opt" data-k="${o.k}"><img src="${o.img}" alt=""></button>`
            : `<button class="kpc-opt kpc-opt-text" data-k="${o.k}">${o.label}</button>`).join('');
        wrap.querySelectorAll('.kpc-opt').forEach(b => b.addEventListener('click', () => kpAnswer(b.dataset.k)));
        // sabotagem contra mim?
        _kp.myPid = _kp.myPid || (_kp.room && _kp.room.pid) || OnlineParty.myPid();
        const sab = p.sabotages && p.sabotages[_kp.myPid];
        kpApplySabotage(sab);
    }

    function kpAnswer(k) {
        if (!_kp || _kp.answered) return;
        _kp.answered = true;
        const ms = Date.now() - _kp.qStart;
        document.querySelectorAll('#kpc-options .kpc-opt').forEach(b => { b.disabled = true; b.classList.toggle('picked', b.dataset.k === k); });
        document.getElementById('kpc-feedback').textContent = 'Resposta enviada ✓ — olha o telão';
        if (window.SFX) window.SFX.play('tap');
        _kp.room.send('answer', { pid: _kp.myPid, choice: k, ms });
        clearInterval(_kp.sabIntetval);
    }

    function kpApplySabotage(power) {
        const wrap = document.getElementById('kpc-options');
        const ov = document.getElementById('kpc-sab-overlay');
        ov.className = 'kpc-sab-overlay hidden'; ov.innerHTML = '';
        wrap.classList.remove('sab-blur');
        if (_kp.sabIntetval) { clearInterval(_kp.sabIntetval); _kp.sabIntetval = null; }
        if (!power) return;
        if (window.SFX) window.SFX.play('wrong');
        if (power === 'borrao') {
            ov.className = 'kpc-sab-overlay';
            ov.innerHTML = Array.from({ length: 4 }, () => {
                const x = 5 + Math.random() * 60, y = 5 + Math.random() * 60, s = 60 + Math.random() * 90;
                return `<span class="kpc-blob" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px"></span>`;
            }).join('') + '<span class="kpc-sab-tag">🖊️ te borraram!</span>';
        } else if (power === 'congela') {
            ov.className = 'kpc-sab-overlay';
            ov.innerHTML = '<span class="kpc-sab-tag big">❄️ CONGELADO</span>';
            wrap.querySelectorAll('.kpc-opt').forEach(b => b.disabled = true);
            setTimeout(() => {
                if (!_kp || _kp.answered) return;
                ov.className = 'kpc-sab-overlay hidden';
                wrap.querySelectorAll('.kpc-opt').forEach(b => b.disabled = false);
            }, 4200);
        } else if (power === 'embaralha') {
            ov.className = 'kpc-sab-overlay'; ov.innerHTML = '<span class="kpc-sab-tag">🔀 embaralhando!</span>';
            _kp.sabIntetval = setInterval(() => {
                if (!_kp || _kp.answered) { clearInterval(_kp.sabIntetval); _kp.sabIntetval = null; return; }
                const kids = [...wrap.children];
                wrap.appendChild(kids[Math.floor(Math.random() * kids.length)]);
            }, 1200);
        }
    }

    function kpCtrlReveal(p) {
        const r = (p.results || []).find(x => x.pid === _kp.myPid);
        if (_kp.sabIntetval) { clearInterval(_kp.sabIntetval); _kp.sabIntetval = null; }
        document.querySelectorAll('#kpc-options .kpc-opt').forEach(b => {
            b.disabled = true;
            b.classList.toggle('kpc-right', b.dataset.k === p.correct);
        });
        const fb = document.getElementById('kpc-feedback');
        if (!r) fb.textContent = '';
        else if (r.correct) { fb.textContent = `✅ Acertou! +${r.pts}  ·  ${r.score} pts`; fb.style.color = '#4ade80'; if (window.SFX) window.SFX.play('correct'); }
        else { fb.textContent = `❌ Errou  ·  ${r.score} pts`; fb.style.color = '#f87171'; }
    }

    function kpCtrlSabotage(p) {
        _kp.phase = 'sabotage';
        kpv('kpc-sabotage');
        const targets = (p.players || []).filter(x => x.pid !== _kp.myPid);
        _kp.sabTarget = null; _kp.sabPickedPower = null;
        const tbox = document.getElementById('kpc-sab-targets');
        tbox.innerHTML = targets.map(t => `<button class="kpc-sab-t" data-pid="${t.pid}">${t.avatar || '🙂'} ${t.name}</button>`).join('')
            || '<p class="kpc-sab-hint">Sem ninguém pra sabotar 🤷</p>';
        tbox.querySelectorAll('.kpc-sab-t').forEach(b => b.addEventListener('click', () => {
            _kp.sabTarget = b.dataset.pid;
            tbox.querySelectorAll('.kpc-sab-t').forEach(x => x.classList.toggle('sel', x === b));
        }));
        document.querySelectorAll('#kpc-sab-powers button').forEach(b => {
            b.disabled = false;
            b.onclick = () => {
                if (!_kp.sabTarget) { showToast('Escolhe quem primeiro 👆', 'info', 1800); return; }
                kpCastSabotage(_kp.sabTarget, b.dataset.power);
            };
        });
    }
    function kpCastSabotage(target, power) {
        if (!_kp || _kp.phase !== 'sabotage') return;
        _kp.phase = 'playing';
        _kp.room.send('sabotage-cast', { pid: _kp.myPid, target, power, skip: !target });
        kpv('kpc-done');
        document.getElementById('kpc-done-msg').textContent = target ? 'Sabotagem armada 😈 — olha o telão' : 'Você passou. Olha o telão.';
    }

    function kpCtrlGameover(p) {
        _kp.phase = 'over';
        kpClearTimers();
        const me = (p.rank || []).find(x => x.pid === _kp.myPid);
        const place = me ? me.place : null;
        kpv('kpc-done');
        const msg = document.getElementById('kpc-done-msg');
        if (place === 1) msg.textContent = `🥇 VOCÊ GANHOU! ${me.score} pts`;
        else if (place) msg.textContent = `${['', '🥇', '🥈', '🥉'][place] || place + 'º'} ${place}º lugar · ${me.score} pts`;
        else msg.textContent = 'Fim de jogo! Placar no telão.';
        if (place && place <= 3 && OnlineParty.isLogged()) {
            try {
                const key = 'dg_partyclaim_' + _kp.roomId;
                if (!localStorage.getItem(key)) {
                    localStorage.setItem(key, '1');
                    grantBonusPack('party-' + _kp.roomId, [3, 2, 1][place - 1], `${place}º lugar na sala!`);
                }
            } catch (e) {}
        }
        if (window.SFX) window.SFX.play(place === 1 ? 'victory' : 'levelup');
    }

    // ---------- comum ----------
    async function kpLeave(toMenu) {
        if (_kp && _kp.role === 'host' && _kp.roomId) {
            try { _kp.room && _kp.room.send('bye', {}); } catch (e) {}
            try { await OnlineParty.setRoomStatus(_kp.roomId, 'closed'); } catch (e) {}
        }
        kpCleanup();
        if (toMenu) showScreen('main');
    }
    function kpCleanup() {
        kpClearTimers();
        if (_kp) {
            if (_kp.sabIntetval) clearInterval(_kp.sabIntetval);
            try { _kp.room && _kp.room.leave(); } catch (e) {}
        }
        _kp = null;
    }
    const btnKpHost = document.getElementById('btn-kp-host');
    const btnKpJoin = document.getElementById('btn-kp-join');
    if (btnKpHost) btnKpHost.addEventListener('click', openKpHost);
    if (btnKpJoin) btnKpJoin.addEventListener('click', openKpJoin);

    // ═══════════════ PAINEL DE CONTAS (dono do jogo) ═══════════════
    function admMsg(text, kind) {
        const el = document.getElementById('adm-msg');
        if (!el) return;
        el.textContent = text; el.className = 'adm-msg ' + (kind || 'info');
        el.classList.toggle('hidden', !text);
    }

    async function renderAdminList() {
        const box = document.getElementById('adm-list');
        if (!box) return;
        box.innerHTML = '<p class="ot-empty">carregando…</p>';
        const r = await Auth.admin.list();
        if (r.error) { box.innerHTML = `<p class="ot-empty">${r.error}</p>`; return; }
        const users = r.users || [];
        const badge = document.getElementById('adm-count');
        if (badge) { badge.hidden = !users.length; badge.textContent = users.length; }
        if (!users.length) { box.innerHTML = '<p class="ot-empty">Nenhuma conta ainda.</p>'; return; }
        box.innerHTML = users.map(u => {
            const last = u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('pt-BR') : 'nunca entrou';
            const tag = u.must_change ? '<span class="adm-tag">senha temporária</span>' : '';
            const me = Auth.currentName && Auth.currentName() === u.username;
            return `<div class="adm-item">
                <div class="adm-item-main"><b>${u.username}</b>${me ? ' <span class="adm-tag adm-you">você</span>' : ''} ${tag}
                    <span class="adm-item-sub">último acesso: ${last}</span></div>
                ${me ? '' : `<button class="tm-btn adm-reset" data-id="${u.id}" data-user="${u.username}">Resetar senha</button>`}
            </div>`;
        }).join('');
        box.querySelectorAll('.adm-reset').forEach(b => b.addEventListener('click', () => admReset(b.dataset.id, b.dataset.user)));
    }

    async function admReset(id, username) {
        const tmp = prompt(`Nova senha temporária para "${username}":`, 'detetive123');
        if (tmp === null) return;
        if (tmp.length < 6) { admMsg('A senha temporária precisa de pelo menos 6 caracteres.', 'error'); return; }
        admMsg('resetando…', 'info');
        const r = await Auth.admin.reset(id, tmp);
        if (r.error) { admMsg(r.error, 'error'); return; }
        admMsg(`Pronto! Passe pra ${username}: usuário "${username}" · senha "${tmp}". O progresso NÃO foi tocado.`, 'ok');
        renderAdminList();
    }

    async function openAdmin() {
        if (!(window.DG_ONLINE && Auth.isAdmin && Auth.isAdmin())) { showScreen('main'); return; }
        admMsg('', '');
        document.getElementById('adm-user').value = '';
        document.getElementById('adm-pass').value = 'detetive123';
        showScreen('admin');
        renderAdminList();
    }

    (function wireAdmin() {
        const back = document.getElementById('admin-back');
        if (back) back.addEventListener('click', () => showScreen('main'));
        const hb = document.getElementById('hub-admin-btn');
        if (hb) hb.addEventListener('click', openAdmin);
        const create = document.getElementById('adm-create');
        if (create) create.addEventListener('click', async () => {
            const u = document.getElementById('adm-user').value.trim();
            const p = document.getElementById('adm-pass').value;
            if (u.length < 2) { admMsg('Digite o usuário do amigo.', 'error'); return; }
            if (p.length < 6) { admMsg('A senha temporária precisa de pelo menos 6 caracteres.', 'error'); return; }
            create.disabled = true; create.textContent = 'Criando…';
            const r = await Auth.admin.create(u, p);
            create.disabled = false; create.textContent = 'Criar';
            if (r.error) { admMsg(r.error, 'error'); return; }
            admMsg(`Conta "${r.username}" criada! Passe pro amigo: usuário "${r.username}" · senha "${p}". Ele troca a senha no 1º acesso.`, 'ok');
            document.getElementById('adm-user').value = '';
            renderAdminList();
        });
    })();

    function openTrades() {
        tradeOther = tradeGive = tradeGet = null;
        document.getElementById('trades-panel').classList.add('hidden');
        if (!machineBusy) {
            machineDeposit = [];
            buildReels(null);
            hidePrizeActions();
        }
        if (modals.tmPicker) modals.tmPicker.classList.add('hidden');
        renderMachine();

        const ot = window.DG_ONLINE && window.OnlineTrades;
        document.getElementById('online-trades').classList.toggle('hidden', !ot);
        document.getElementById('trades-local-hint').classList.toggle('hidden', !!ot);
        document.getElementById('trades-accounts').classList.toggle('hidden', !!ot);
        if (ot) { otRefresh(); showScreen('trades'); return; }

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
        const c = albumItem(codigo) || { nome: codigo, codigo };
        const el = document.createElement('button');
        el.className = 'trade-chip' + (selected ? ' selected' : '');
        el.dataset.codigo = codigo;
        el.innerHTML = `<img src="${itemImg(c)}" alt=""><span>${c.nome}</span>${count > 1 ? `<b>×${count}</b>` : ''}`;
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

    document.getElementById('elem-view-toggle').addEventListener('click', () => {
        elementosView = elementosView === 'tabela' ? 'lista' : 'tabela';
        renderAlbum();
    });

    // ═══════════════ TROCAS ONLINE (mural + direto) ═══════════════
    let otTab = 'mural', otUnsub = null;

    function otMiniCard(codigo) {
        const c = albumItem(codigo);
        const nome = c ? c.nome : codigo;
        const img = c ? itemImg(c) : '';
        return `<span class="ot-mini"><img src="${img}" alt="" onerror="this.style.display='none'"><b>${nome}</b></span>`;
    }
    function otItemHTML(x) {
        if (x && x.any) return `<span class="ot-mini ot-wild"><span class="ot-wild-ic">🎲</span><b>qualquer<br>que falta</b></span>`;
        if (x && x.sec) {
            const m = CONTINENT_META[x.sec] || {};
            return `<span class="ot-mini ot-wild"><span class="ot-wild-ic">${m.emoji || '📚'}</span><b>qualquer<br>${x.sec}</b></span>`;
        }
        return otMiniCard(x.codigo);
    }
    function otItemsHTML(arr) {
        return (arr || []).map(otItemHTML).join('<span class="ot-plus">+</span>');
    }
    // as figurinhas repetidas minhas que atendem um pedido (wildcard ou específico)
    function eligibleForRequest(x) {
        let pool = loadStickers().filter(s => depositable(s) > 0).map(s => albumItem(s.codigo)).filter(Boolean);
        if (x && x.codigo) return pool.filter(c => c.codigo === x.codigo);
        if (x && x.sec) return pool.filter(c => c.continente === x.sec);
        return pool; // any
    }

    async function otRefresh() {
        setOtTab(otTab);
        if (otUnsub) { otUnsub(); otUnsub = null; }
        otUnsub = OnlineTrades.subscribe(() => { otRefresh(); refreshHub(); });
        const mine = await OnlineTrades.mine();
        const abertas = mine.filter(t => t.status === 'aberta');
        const badge = document.getElementById('ot-mine-badge');
        if (badge) { badge.textContent = abertas.length; badge.hidden = !abertas.length; }
    }

    function setOtTab(tab) {
        otTab = tab;
        document.querySelectorAll('.ot-tab').forEach(b => b.classList.toggle('active', b.dataset.ot === tab));
        document.getElementById('ot-mural').classList.toggle('hidden', tab !== 'mural');
        document.getElementById('ot-minhas').classList.toggle('hidden', tab !== 'minhas');
        if (tab === 'mural') renderOtMural(); else renderOtMine();
    }

    let _otTrades = [];
    const otTrade = (id) => _otTrades.find(t => t.id === id);

    async function renderOtMural() {
        const box = document.getElementById('ot-mural-list');
        box.innerHTML = '<p class="ot-empty">Carregando…</p>';
        const list = await OnlineTrades.mural();
        _otTrades = list.slice();
        if (!list.length) { box.innerHTML = '<p class="ot-empty">Nenhuma oferta no mural agora. Crie a sua!</p>'; return; }
        box.innerHTML = list.map(t => `
            <div class="ot-card" data-id="${t.id}">
                <div class="ot-card-head"><span class="ot-who">${t.from_username}</span></div>
                <div class="ot-swap">
                    <div class="ot-side"><span class="ot-side-lbl">dá</span>${otItemsHTML(t.offer)}</div>
                    <span class="ot-arrow">⇄</span>
                    <div class="ot-side"><span class="ot-side-lbl">quer</span>${otItemsHTML(t.request)}</div>
                </div>
                <button class="ot-accept" data-id="${t.id}">Topar troca</button>
            </div>`).join('');
        box.querySelectorAll('.ot-accept').forEach(b => b.onclick = () => otDoAccept(b.dataset.id, b));
    }

    async function renderOtMine() {
        const box = document.getElementById('ot-mine-list');
        box.innerHTML = '<p class="ot-empty">Carregando…</p>';
        const list = await OnlineTrades.mine();
        _otTrades = _otTrades.filter(t => !list.some(x => x.id === t.id)).concat(list);
        if (!list.length) { box.innerHTML = '<p class="ot-empty">Você ainda não tem trocas.</p>'; return; }
        const rot = { aberta: '⏳ aberta', aceita: '✅ aceita', recusada: '❌ recusada', cancelada: '🚫 cancelada', expirada: '⌛ expirada' };
        box.innerHTML = list.map(t => {
            const sou = OnlineTrades.myName();
            const ehMinha = t.from_username === sou;
            const alvo = ehMinha ? (t.to_username || 'mural') : t.from_username;
            const podeAceitar = !ehMinha && t.status === 'aberta';
            const podeCancelar = ehMinha && t.status === 'aberta';
            const podeRecusar = !ehMinha && t.status === 'aberta' && t.kind === 'direto';
            return `<div class="ot-card" data-id="${t.id}">
                <div class="ot-card-head"><span class="ot-who">${ehMinha ? 'você → ' + alvo : alvo + ' → você'}</span><span class="ot-status">${rot[t.status] || t.status}</span></div>
                <div class="ot-swap">
                    <div class="ot-side"><span class="ot-side-lbl">${ehMinha ? 'você dá' : alvo + ' dá'}</span>${otItemsHTML(t.offer)}</div>
                    <span class="ot-arrow">⇄</span>
                    <div class="ot-side"><span class="ot-side-lbl">${ehMinha ? 'você quer' : 'você dá'}</span>${otItemsHTML(t.request)}</div>
                </div>
                ${podeAceitar ? `<button class="ot-accept" data-id="${t.id}">Topar</button>` : ''}
                ${podeRecusar ? `<button class="ot-reject" data-id="${t.id}">Recusar</button>` : ''}
                ${podeCancelar ? `<button class="ot-cancel" data-id="${t.id}">Cancelar</button>` : ''}
            </div>`;
        }).join('');
        box.querySelectorAll('.ot-accept').forEach(b => b.onclick = () => otDoAccept(b.dataset.id, b));
        box.querySelectorAll('.ot-reject').forEach(b => b.onclick = async () => { await OnlineTrades.reject(b.dataset.id); otRefresh(); });
        box.querySelectorAll('.ot-cancel').forEach(b => b.onclick = async () => { await OnlineTrades.cancel(b.dataset.id); otRefresh(); });
    }

    async function otDoAccept(id, btn) {
        const t = otTrade(id);
        const req = (t && t.request) || [];
        const wildcards = req.filter(x => !x.codigo);
        if (wildcards.length) {
            const fulfill = await pickFulfillment(wildcards);
            if (!fulfill) return;              // cancelou
            return finishAccept(id, btn, fulfill);
        }
        return finishAccept(id, btn, []);
    }
    async function finishAccept(id, btn, fulfill) {
        btn.disabled = true; btn.textContent = 'Trocando…';
        const r = await OnlineTrades.accept(id, fulfill);
        if (r.error) { showToast(r.error, 'error'); btn.disabled = false; btn.textContent = 'Topar'; return; }
        showToast('Troca feita! 🤝', 'success');
        _cache.stickers = await API.getStickers(currentUser);
        otRefresh(); refreshHub();
    }

    // pergunta ao aceitante qual figurinha concreta dá pra cada pedido curinga
    function pickFulfillment(wildcards) {
        return new Promise((resolve) => {
            const chosen = [];
            let step = 0;
            const modal = document.getElementById('ot-compose-modal');
            const title = document.getElementById('otc-title');
            const grid = document.getElementById('otc-want');
            // reaproveita o modal: esconde tudo menos o grid
            ['otc-to-field'].forEach(i => { const e = document.getElementById(i); if (e) e.hidden = true; });
            document.getElementById('otc-give').innerHTML = '';
            document.querySelector('.otc-want-modes').style.display = 'none';
            document.getElementById('otc-want-secao').classList.add('hidden');
            document.getElementById('otc-want-summary').textContent = '';
            document.getElementById('otc-send').style.display = 'none';
            grid.classList.remove('hidden');

            function renderStep() {
                const w = wildcards[step];
                title.textContent = `O que você dá? (${step + 1}/${wildcards.length})`;
                const pool = eligibleForRequest(w).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
                grid.innerHTML = pool.length
                    ? pool.map(c => `<button class="otc-opt" data-code="${c.codigo}">${otMiniCard(c.codigo)}</button>`).join('')
                    : '<p class="ot-empty">Você não tem repetida que sirva. Não dá pra topar essa.</p>';
                grid.querySelectorAll('.otc-opt').forEach(b => b.onclick = () => {
                    chosen.push({ codigo: b.dataset.code, rarity: 'base' });
                    step++;
                    if (step >= wildcards.length) { cleanup(); resolve(chosen); }
                    else renderStep();
                });
            }
            function cleanup() {
                modal.classList.add('hidden');
                document.querySelector('.otc-want-modes').style.display = '';
                document.getElementById('otc-send').style.display = '';
                document.getElementById('otc-close').onclick = null;
            }
            document.getElementById('otc-close').onclick = () => { cleanup(); resolve(null); };
            renderStep();
            modal.classList.remove('hidden');
        });
    }

    document.querySelectorAll('.ot-tab').forEach(b => b.addEventListener('click', () => setOtTab(b.dataset.ot)));

    // ---- compor oferta ----
    // otcWant = { codigo } (específica) | { sec } (qualquer de um livro) | { any:true }
    const otcModal = document.getElementById('ot-compose-modal');
    let otcGive = null, otcWant = { any: true }, otcKind = 'mural', otcWantMode = 'qualquer', otcWantSec = null;

    function secLabel(book) {
        const m = CONTINENT_META[book] || {};
        return `${m.flag ? '🇧🇷' : (m.emoji || '')} ${book}`.trim();
    }
    function otcWantText() {
        if (otcWantMode === 'any') return 'qualquer figurinha que você não tem';
        if (otcWantMode === 'secao') return otcWantSec ? `qualquer de "${otcWantSec}" que você não tem` : '';
        const c = otcWant && otcWant.codigo && albumItem(otcWant.codigo);
        return c ? c.nome : '';
    }
    function otcRefreshSend() {
        document.getElementById('otc-want-summary').textContent = otcWantText() ? '→ ' + otcWantText() : '';
        const need = otcKind === 'direto' ? document.getElementById('otc-to').value.trim() : true;
        const wantOk = otcWantMode === 'qualquer'
            || (otcWantMode === 'secao' && otcWantSec)
            || (otcWantMode === 'especifica' && otcWant && otcWant.codigo);
        document.getElementById('otc-send').disabled = !(otcGive && wantOk && need);
    }

    function setWantMode(mode) {
        otcWantMode = mode;
        document.querySelectorAll('.otc-wm').forEach(b => b.classList.toggle('active', b.dataset.wm === (mode === 'qualquer' ? 'qualquer' : mode)));
        const chips = document.getElementById('otc-want-secao');
        const grid = document.getElementById('otc-want');
        chips.classList.toggle('hidden', mode !== 'secao' && mode !== 'especifica');
        grid.classList.toggle('hidden', mode !== 'especifica');
        if (mode === 'qualquer') { otcWant = { any: true }; }
        if (mode === 'secao') { otcWant = otcWantSec ? { sec: otcWantSec } : null; }
        if (mode === 'especifica') { otcWant = null; renderWantGrid(); }
        otcRefreshSend();
    }
    function renderSecChips() {
        const chips = document.getElementById('otc-want-secao');
        chips.innerHTML = CONTINENTS_ORDER.map(book => {
            const n = ALBUM_ITEMS.filter(c => c.continente === book && !isColada(c.codigo)).length;
            return `<button class="otc-sc${book === otcWantSec ? ' on' : ''}" data-book="${book}" ${n ? '' : 'disabled'}>${secLabel(book)} <b>${n}</b></button>`;
        }).join('');
        chips.querySelectorAll('.otc-sc').forEach(b => b.onclick = () => {
            otcWantSec = b.dataset.book;
            chips.querySelectorAll('.otc-sc').forEach(x => x.classList.toggle('on', x === b));
            if (otcWantMode === 'secao') otcWant = { sec: otcWantSec };
            if (otcWantMode === 'especifica') renderWantGrid();
            otcRefreshSend();
        });
    }
    function renderWantGrid() {
        const grid = document.getElementById('otc-want');
        let falta = ALBUM_ITEMS.filter(c => !isColada(c.codigo));
        if (otcWantSec) falta = falta.filter(c => c.continente === otcWantSec);
        falta = falta.sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).slice(0, 300);
        grid.innerHTML = falta.length
            ? falta.map(c => `<button class="otc-opt" data-code="${c.codigo}">${otMiniCard(c.codigo)}</button>`).join('')
            : '<p class="ot-empty">Escolha um livro acima.</p>';
        grid.querySelectorAll('.otc-opt').forEach(b => b.onclick = () => {
            otcWant = { codigo: b.dataset.code };
            grid.querySelectorAll('.otc-opt').forEach(x => x.classList.toggle('on', x === b));
            otcRefreshSend();
        });
    }

    function openCompose(kind) {
        otcKind = kind; otcGive = null; otcWantMode = 'qualquer'; otcWant = { any: true }; otcWantSec = null;
        document.getElementById('otc-title').textContent = kind === 'direto' ? 'Oferecer pra alguém' : 'Criar oferta no mural';
        document.getElementById('otc-to-field').hidden = kind !== 'direto';
        document.getElementById('otc-to').value = '';
        // "você dá" = repetidas suas
        const give = document.getElementById('otc-give');
        const reps = loadStickers().filter(s => depositable(s) > 0)
            .map(s => albumItem(s.codigo)).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
        give.innerHTML = reps.length ? reps.map(c => `<button class="otc-opt" data-code="${c.codigo}">${otMiniCard(c.codigo)}</button>`).join('')
            : '<p class="ot-empty">Você não tem repetidas de sobra.</p>';
        give.querySelectorAll('.otc-opt').forEach(b => b.onclick = () => {
            otcGive = b.dataset.code;
            give.querySelectorAll('.otc-opt').forEach(x => x.classList.toggle('on', x === b));
            otcRefreshSend();
        });
        renderSecChips();
        setWantMode('qualquer');
        otcModal.classList.remove('hidden');
    }
    document.getElementById('ot-new').addEventListener('click', () => openCompose('mural'));
    const otNewDirect = document.getElementById('ot-new-direct');
    if (otNewDirect) otNewDirect.addEventListener('click', () => openCompose('direto'));
    document.querySelectorAll('.otc-wm').forEach(b => b.addEventListener('click', () => setWantMode(b.dataset.wm)));
    document.getElementById('otc-close').addEventListener('click', () => otcModal.classList.add('hidden'));
    otcModal.addEventListener('click', e => { if (e.target === otcModal) otcModal.classList.add('hidden'); });
    document.getElementById('otc-to').addEventListener('input', otcRefreshSend);
    document.getElementById('otc-send').addEventListener('click', async () => {
        const btn = document.getElementById('otc-send');
        btn.disabled = true; btn.textContent = 'Enviando…';
        let toUser = null;
        if (otcKind === 'direto') {
            toUser = await OnlineTrades.findUser(document.getElementById('otc-to').value);
            if (!toUser) { showToast('Usuário não encontrado.', 'error'); btn.disabled = false; btn.textContent = 'Enviar oferta'; return; }
        }
        const offer = [{ codigo: otcGive, rarity: 'base' }];
        const request = [otcWant];
        const r = await OnlineTrades.create(otcKind, toUser, offer, request);
        btn.textContent = otcKind === 'direto' ? 'Enviar oferta' : 'Publicar oferta';
        if (r.error) { showToast(r.error, 'error'); btn.disabled = false; return; }
        showToast(otcKind === 'direto' ? 'Oferta enviada! 📨' : 'Oferta no mural! 📌', 'success');
        otcModal.classList.add('hidden');
        otRefresh();
    });

    function renderPacksHelp() {
        const list = document.getElementById('packs-help-list');
        if (!list) return;
        const dp = _cache.dailyProgress || loadDailyProgress(currentUser);
        const b = dp.bonus || {};
        const streak = _cache.loginStreak || 0;
        const ac = dp.acertos || 0;
        const trocas = dpTrocas(dp);
        const wonN = Object.keys(dp.modes.__won || {}).length;
        const nextStreak = streakReward(streak + 1);

        const rows = [
            { done: _cache.freePacksDay === packDayKey(), label: `<b>${DAILY_FREE_PACKS} pacotes grátis</b> às 6h da manhã`, prog: '' },
            { done: wonN >= 2, label: '<b>Vencer</b> uma partida em pelo menos <b>2 modos</b> diferentes → +2 pacotes', prog: `${Math.min(wonN, 2)}/2` },
            { done: !!b.acertos20 || ac >= 20, label: 'Acertar <b>20</b> no dia', prog: `${Math.min(ac, 20)}/20` },
            { done: !!b.acertos50 || ac >= 50, label: 'Acertar <b>50</b> no dia', prog: `${Math.min(ac, 50)}/50` },
            { done: !!b.streak15, label: '<b>Sequência de 15</b> numa partida', prog: '' },
            { done: !!b.jornada, label: 'Terminar uma partida nível <b>3+</b> com vidas <b>5 ou 10</b> (infinito não vale)', prog: '' },
            { done: !!b.troca || trocas >= 3, label: 'Fazer <b>3 trocas</b> de figurinha', prog: `${Math.min(trocas, 3)}/3` },
            { done: !!b.online, label: 'Jogar <b>1 partida online</b> (ganhando ou perdendo)', prog: '' },
            {
                done: !!b['streak' + streak] && streakReward(streak).qty > 0,
                label: streak >= 2
                    ? `Login <b>${streak} dias seguidos</b> — amanhã: +${nextStreak.qty || 0} 🔥`
                    : `<b>Login todo dia</b>: 2 dias +1 · 3+ dias +2 · a cada 10 dias +5`,
                prog: `${streak} 🔥`,
            },
        ];
        list.innerHTML = rows.map(r => `
            <div class="ph-row${r.done ? ' done' : ''}">
                <span class="ph-check">${r.done ? '✓' : ''}</span>
                <span class="ph-label">${r.label}</span>
                ${r.prog ? `<span class="ph-prog">${r.prog}</span>` : ''}
            </div>`).join('');
    }

    (function wirePacksHelp() {
        const btn = document.getElementById('packs-help-btn');
        const modal = document.getElementById('packs-help-modal');
        if (!btn || !modal) return;
        btn.addEventListener('click', () => { renderPacksHelp(); modal.classList.remove('hidden'); });
        modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
        document.getElementById('packs-help-close').addEventListener('click', () => modal.classList.add('hidden'));
    })();

    (function wireFigZoom() {
        const box = document.getElementById('fig-zoom');
        if (!box) return;
        box.addEventListener('click', e => { if (e.target === box) closeFigZoom(); });
        document.getElementById('fig-zoom-close').addEventListener('click', closeFigZoom);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFigZoom(); });
    })();
    document.getElementById('trades-confirm').addEventListener('click', () => {
        if (!tradeGive || !tradeGet || !tradeOther) return;
        const gname = (albumItem(tradeGive) || {}).nome;
        const rname = (albumItem(tradeGet) || {}).nome;
        const res = Trades.execute(currentUser, tradeOther, tradeGive, tradeGet);
        if (res.error) { showToast(res.error, 'error'); return; }
        _cache.stickers = Trades._read(currentUser);
        if (window.SFX) window.SFX.play('trade');
        // meta: 3 trocas no dia (não é mais na 1ª)
        const dp = _cache.dailyProgress || (_cache.dailyProgress = loadDailyProgress(currentUser));
        if (dp.day !== packDayKey()) { _cache.dailyProgress = loadDailyProgress(currentUser); }
        if (!dp.bonus) dp.bonus = {};
        dp.bonus._trocas = (dp.bonus._trocas || 0) + 1;
        saveDailyProgress();
        if (dp.bonus._trocas >= 3) grantBonusPack('troca', 1, '3 trocas hoje!');
        showToast(`Troca feita! Você deu ${gname} e recebeu ${rname}.`, 'success');
        if (!calmMode && typeof confetti !== 'undefined') confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        tradeGive = tradeGet = null;
        selectTradePartner(tradeOther);
    });

    // ─── MÁQUINA DE TROCA (7 repetidas escolhidas -> 1 nova) ──
    let machineDeposit = []; // [codigo, codigo, ...] (só reserva; a pilha só é consumida ao puxar)
    let machineBusy = false;
    const MACHINE_COST = 7;
    const REEL_TILE = 58;      // altura de cada slot do rolo (px) — bandeira + folga fixa
    const REEL_WIN = 200;      // altura da janela
    const REEL_WON_IDX = 40;   // posicao da bandeira sorteada (bem no fundo, pra rodar bastante)
    const REEL_LEN = 48;

    function reservedCount(code) { return machineDeposit.filter(c => c === code).length; }
    function reelsBuilt() { const r = document.getElementById('tm-reel-0'); return r && r.childElementCount > 0; }

    function buildReels(wonCode) {
        for (let r = 0; r < 3; r++) {
            const strip = document.getElementById('tm-reel-' + r);
            if (!strip) continue;
            strip.style.transition = 'none';
            strip.style.transform = 'translateY(0)';
            strip.innerHTML = '';
            const pool = shuffle([...countries]);
            for (let i = 0; i < REEL_LEN; i++) {
                const c = (i === REEL_WON_IDX && wonCode)
                    ? (albumItem(wonCode) || pool[0])
                    : pool[i % pool.length];
                const t = document.createElement('div');
                t.className = 'reel-tile';
                t.innerHTML = `<img src="${itemImg(c)}" alt="">`;
                strip.appendChild(t);
            }
        }
    }

    function renderMachine() {
        const n = machineDeposit.length;
        const cnt = document.getElementById('tm-count');
        if (cnt) cnt.textContent = `${n} / ${MACHINE_COST}`;
        const fill = document.getElementById('tm-progress');
        if (fill) fill.style.width = `${(n / MACHINE_COST) * 100}%`;
        const pull = document.getElementById('tm-pull');
        if (pull) pull.disabled = n < MACHINE_COST || machineBusy;
        const add = document.getElementById('tm-add');
        if (add) add.disabled = machineBusy;
        const slot = document.getElementById('tm-slot');
        if (slot) slot.classList.toggle('ready', n >= MACHINE_COST && !machineBusy);
        if (!reelsBuilt()) buildReels(null);
        renderMachineSlots();
    }

    // quantas cópias dá pra jogar na máquina: as que sobram além da que você guarda pra colar
    function depositable(s) {
        const col = coladaRarity(s.codigo);
        return (s.pilha || []).length - reservedCount(s.codigo) - (col ? 0 : 1);
    }

    function weakestRar(code) {
        const s = loadStickers().find(x => x.codigo === code);
        if (!s || !s.pilha || !s.pilha.length) return 'base';
        return [...s.pilha].sort((a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b))[0];
    }

    // um mini card de figurinha, igual à prévia do álbum
    function figCardHTML(c, rarity, extra) {
        const legend = LEGEND_RARS.includes(rarity);
        const shiny = isShinyRar(rarity, c);
        const acc = (CONTINENT_META[c.continente] || {}).accent || '#60a5fa';
        const cls = 'fig-card ' + (legend ? 'legend rarity-' + rarity : (shiny ? 'shiny rarity-base' : 'rarity-base'))
            + (c._img ? ' is-collection' : '') + (figKindClass(c) ? ' ' + figKindClass(c) : '') + (legend ? '' : figBgClass(c)) + (extra ? ' ' + extra : '');
        const bgv = (!legend && c._bg) ? `;--fig-bg-img:url('${c._bg}')` : '';
        return `<div class="${cls}" style="--acc:${acc}${bgv}">
            <div class="fig">
                <span class="fig-bg"></span>
                ${itemShape(c)}
                <span class="fig-foil"></span>
                ${threatBadgeHTML(c)}
                <div class="fig-flagwrap"><img class="fig-flag" src="${itemImg(c)}" alt="${c.nome}"></div>
                <div class="fig-foot"><span class="fig-name">${c.nome}</span><span class="fig-code">${stickerCode(c.codigo)}</span></div>
            </div>
        </div>`;
    }

    // os 7 espacos da maquina, com a previa das figurinhas escolhidas
    function renderMachineSlots() {
        const box = document.getElementById('tm-slots');
        if (!box) return;
        box.innerHTML = Array.from({ length: MACHINE_COST }, (_, i) => {
            const code = machineDeposit[i];
            if (!code) return `<span class="tm-mini empty"></span>`;
            const c = albumItem(code);
            return c ? `<div class="tm-mini">${figCardHTML(c, weakestRar(code), 'nano')}</div>` : '<span class="tm-mini empty"></span>';
        }).join('');
        requestAnimationFrame(() => fitFigNames(box));
    }

    // ---- modal flutuante pra escolher as repetidas ----
    function openPickerModal() {
        if (machineBusy) return;
        renderPickerModal();
        modals.tmPicker.classList.remove('hidden');
    }
    function closePickerModal() { modals.tmPicker.classList.add('hidden'); }

    // junta 7 repetidas sozinho, priorizando as de raridade menor (comum → ouro)
    function autoFillMachine() {
        if (machineBusy) return;
        hidePrizeActions();
        const copies = [];
        loadStickers().forEach(s => {
            const avail = (s.pilha || []).length - (coladaRarity(s.codigo) ? 0 : 1);
            if (avail <= 0) return;
            const sorted = [...(s.pilha || [])].sort((a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b));
            for (let i = 0; i < avail; i++) copies.push({ codigo: s.codigo, rar: sorted[i] || 'base' });
        });
        copies.sort((a, b) => RARITY_ORDER.indexOf(a.rar) - RARITY_ORDER.indexOf(b.rar));
        machineDeposit = copies.slice(0, MACHINE_COST).map(c => c.codigo);
        if (window.SFX) window.SFX.play(machineDeposit.length === MACHINE_COST ? 'tick' : 'error_soft');
        if (machineDeposit.length < MACHINE_COST) {
            showToast(`Você só tem ${machineDeposit.length} repetida(s) de sobra pra máquina.`, 'error');
        }
        renderMachine();
    }

    function renderPickerModal() {
        const grid = document.getElementById('tmp-grid');
        if (!grid) return;
        const stk = loadStickers()
            .filter(s => depositable(s) + reservedCount(s.codigo) > 0)
            .map(s => ({ s, c: albumItem(s.codigo) }))
            .filter(o => o.c)
            .sort((a, b) => a.c.nome.localeCompare(b.c.nome, 'pt'));

        const full = machineDeposit.length >= MACHINE_COST;
        grid.innerHTML = stk.map(({ s, c }) => {
            const total = depositable(s) + reservedCount(c.codigo);
            const picked = reservedCount(c.codigo);
            return `<button class="tmp-pick${picked ? ' on' : ''}" data-code="${c.codigo}" ${(!picked && full) ? 'disabled' : ''}>
                ${figCardHTML(c, weakestRar(c.codigo))}
                <span class="tmp-total">×${total}</span>
                ${picked ? `<span class="tmp-badge">${picked}</span>` : ''}
            </button>`;
        }).join('') || '<p class="tmp-empty">Você não tem figurinhas repetidas de sobra pra máquina.</p>';

        grid.querySelectorAll('[data-code]').forEach(b => b.onclick = () => pickToggle(b.dataset.code));

        document.getElementById('tmp-selcount').textContent = machineDeposit.length;
        const conf = document.getElementById('tmp-confirm');
        if (conf) conf.disabled = machineDeposit.length !== MACHINE_COST;
        requestAnimationFrame(() => fitFigNames(grid));
    }

    // toque: +1; se já está no máximo dessa figurinha, volta a 0
    function pickToggle(code) {
        if (machineBusy) return;
        const s = loadStickers().find(x => x.codigo === code);
        if (!s) return;
        const maxHere = depositable(s) + reservedCount(code);
        if (reservedCount(code) >= maxHere || machineDeposit.length >= MACHINE_COST) {
            // tira todas dessa figurinha
            machineDeposit = machineDeposit.filter(x => x !== code);
            if (window.SFX) window.SFX.play('tap');
        } else {
            machineDeposit.push(code);
            if (window.SFX) window.SFX.play('tick');
        }
        renderMachine(); renderPickerModal();
    }

    function machinePull() {
        if (machineBusy || machineDeposit.length < MACHINE_COST) return;
        machineBusy = true;
        hidePrizeActions();

        // consome as 7 repetidas escolhidas (a mais fraca de cada figurinha)
        const stickers = loadStickers();
        machineDeposit.forEach(code => {
            const s = stickers.find(x => x.codigo === code);
            if (s && s.pilha.length) {
                s.pilha.sort((a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b));
                s.pilha.shift();
            }
        });
        saveStickers(stickers);

        closePickerModal();
        renderMachine();

        // prioriza figurinha que falta no livro atual, senão qualquer que falte colar
        const missCur = ALBUM_ITEMS.filter(c => c.continente === currentContinent && !isColada(c.codigo));
        const missAny = ALBUM_ITEMS.filter(c => !isColada(c.codigo));
        const pool = missCur.length ? missCur : (missAny.length ? missAny : countries);
        const won = shuffle([...pool])[0];

        buildReels(won.codigo);
        const slot = document.getElementById('tm-slot');
        const prize = document.getElementById('tm-prize');
        if (prize) { prize.className = 'tray-card'; prize.innerHTML = ''; }
        if (slot) slot.classList.remove('ready');
        if (window.SFX) window.SFX.play('whoosh');

        // roda rapidinho, depois cada rolo DESACELERA por mais tempo ate parar na sorteada
        const centerOffset = (REEL_WIN - REEL_TILE) / 2;
        const target = REEL_WON_IDX * REEL_TILE - centerOffset;
        [0, 1, 2].forEach(r => {
            const strip = document.getElementById('tm-reel-' + r);
            if (!strip) return;
            strip.classList.add('spinning');
            const decelAt = 700;
            const decelDur = 1700 + r * 650;   // 1.7s / 2.35s / 3.0s de desaceleracao
            setTimeout(() => {
                const cur = getComputedStyle(strip).transform;
                strip.classList.remove('spinning');
                strip.style.transition = 'none';
                strip.style.transform = cur;
                void strip.offsetWidth;
                strip.style.transition = `transform ${decelDur}ms cubic-bezier(.11,.62,.14,1)`;
                strip.style.transform = `translateY(-${target}px)`;
                setTimeout(() => { if (window.SFX) window.SFX.play('tick'); }, decelDur - 60);
            }, decelAt);
        });

        setTimeout(() => finishPull(won), 700 + 1700 + 2 * 650 + 350);
    }

    function finishPull(won) {
        const e = stickerEntry(won.codigo, true);
        e.pilha.push('base');
        saveStickers(loadStickers());
        machineDeposit = [];
        machineBusy = false;

        const flash = document.getElementById('tm-flash');
        if (flash) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
        const prize = document.getElementById('tm-prize');
        if (prize) {
            prize.innerHTML = figCardHTML(won, 'base', 'nano');
            prize.className = 'tray-card show';
        }
        if (window.SFX) { window.SFX.play('coin'); setTimeout(() => window.SFX.play('reveal_common'), 260); }
        if (!calmMode && typeof confetti !== 'undefined') {
            const slot = document.getElementById('tm-slot');
            const rect = slot ? slot.getBoundingClientRect() : null;
            confetti({
                particleCount: 80, spread: 75, startVelocity: 32,
                origin: rect ? { x: (rect.left + rect.width / 2) / innerWidth, y: (rect.bottom - 10) / innerHeight } : { y: 0.6 },
            });
        }
        showToast(`🎰 Saiu: ${won.nome}! Toque na figurinha pra ver e colar.`, 'success');
        showPrizeActions(won);
        renderMachine();
    }

    // ---- prêmio: ver de perto / colar / trocar mais ----
    let _lastPrize = null;
    function showPrizeActions(won) {
        _lastPrize = won;
        const box = document.getElementById('tm-prize-actions');
        if (box) box.classList.remove('hidden');
        const prize = document.getElementById('tm-prize');
        if (prize) prize.classList.add('clickable');
    }
    function hidePrizeActions() {
        _lastPrize = null;
        const box = document.getElementById('tm-prize-actions');
        if (box) box.classList.add('hidden');
        const prize = document.getElementById('tm-prize');
        if (prize) { prize.classList.remove('clickable', 'show'); prize.innerHTML = ''; }
    }
    (function wirePrizeActions() {
        const prize = document.getElementById('tm-prize');
        if (prize) prize.addEventListener('click', () => { if (_lastPrize) openFigZoom(_lastPrize.codigo, { reveal: true }); });
        const glueB = document.getElementById('tm-prize-glue');
        if (glueB) glueB.addEventListener('click', () => {
            if (!_lastPrize) return;
            doGlue(_lastPrize.codigo, 'base', glueB);
            hidePrizeActions();
            renderMachine();
        });
        const moreB = document.getElementById('tm-prize-more');
        if (moreB) moreB.addEventListener('click', () => { hidePrizeActions(); renderMachine(); });
    })();

    // puxa a alavanca com o movimentinho e então roda a máquina
    function pullWithLeverAnim() {
        if (machineBusy || machineDeposit.length < MACHINE_COST) return;
        const lever = document.getElementById('tm-lever');
        if (lever) {
            lever.style.setProperty('--pull', '1');
            setTimeout(() => lever.style.setProperty('--pull', '0'), 260);
        }
        if (window.SFX) window.SFX.play('toggle');
        setTimeout(machinePull, 200);
    }

    document.getElementById('tm-add').addEventListener('click', openPickerModal);
    document.getElementById('tm-pull').addEventListener('click', pullWithLeverAnim);
    const tmAuto = document.getElementById('tm-auto');
    if (tmAuto) tmAuto.addEventListener('click', autoFillMachine);
    document.getElementById('tmp-close').addEventListener('click', closePickerModal);
    document.getElementById('tmp-confirm').addEventListener('click', () => {
        if (machineDeposit.length === MACHINE_COST) { closePickerModal(); renderMachine(); }
    });
    document.getElementById('tmp-clear').addEventListener('click', () => {
        machineDeposit = []; if (window.SFX) window.SFX.play('tap');
        renderMachine(); renderPickerModal();
    });
    modals.tmPicker.addEventListener('click', e => { if (e.target === modals.tmPicker) closePickerModal(); });

    // alavanca: arrastar pra baixo OU só tocar puxa
    (function wireLever() {
        const lever = document.getElementById('tm-lever');
        if (!lever) return;
        let dragging = false, startY = 0, moved = 0;
        const setPull = f => { f = Math.max(0, Math.min(1, f)); lever.style.setProperty('--pull', f.toFixed(2)); return f; };
        lever.addEventListener('pointerdown', e => {
            if (machineBusy || machineDeposit.length < MACHINE_COST) return;
            dragging = true; startY = e.clientY; moved = 0;
            lever.classList.add('grabbing');
            try { lever.setPointerCapture(e.pointerId); } catch (_) {}
        });
        lever.addEventListener('pointermove', e => {
            if (!dragging) return;
            moved = e.clientY - startY;
            setPull(moved / 90);
        });
        const release = () => {
            if (!dragging) return;
            dragging = false;
            lever.classList.remove('grabbing');
            const f = parseFloat(lever.style.getPropertyValue('--pull')) || 0;
            lever.style.setProperty('--pull', '0');
            if (f >= 0.55) { if (window.SFX) window.SFX.play('toggle'); setTimeout(machinePull, 120); }
            else pullWithLeverAnim();   // tap simples também puxa
        };
        lever.addEventListener('pointerup', release);
        lever.addEventListener('pointercancel', () => { dragging = false; lever.classList.remove('grabbing'); lever.style.setProperty('--pull', '0'); });
    })();

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
        if (pw) {
            pw.classList.remove('tearing');
            pw.style.setProperty('--tear', '0');
            pw.style.setProperty('--rx', '0deg'); pw.style.setProperty('--ry', '0deg');
            pw.style.setProperty('--mx', '50%'); pw.style.setProperty('--my', '40%');
        }
        const endActions = document.getElementById('pack-end-actions');
        if (endActions) endActions.classList.add('hidden');
        modals.pack.classList.remove('hidden');
    }
    if (buttons.openPack) buttons.openPack.addEventListener('click', openPackModal);
    if (buttons.openMore) buttons.openMore.addEventListener('click', openPackModal);

    // categoria de uma figurinha pro sorteio do pacote: "pais" = qualquer bandeira
    // (país do mundo, estado ou capital do BR — tudo sem _sec); senão a seção
    // ilustrada dela (frutas/lendas/clubes/animais/legumes/elementos/...).
    function albumCategoryOf(c) { return (c && c._sec) || 'pais'; }
    let _albumByCategory = null;
    function albumByCategory() {
        if (_albumByCategory) return _albumByCategory;
        const map = {};
        ALBUM_ITEMS.forEach(c => {
            const k = albumCategoryOf(c);
            (map[k] = map[k] || []).push(c);
        });
        _albumByCategory = map;
        return map;
    }

    // sorteia o pacote e joga tudo na PILHA (o jogador decide o que colar depois).
    // Peso por CATEGORIA (10/09): cada uma das 4 figurinhas vem de uma categoria
    // diferente — "país" (bandeira, qualquer livro) conta como 1 categoria só,
    // cada seção ilustrada é outra. Sem repetir categoria dentro do MESMO pacote;
    // o próximo pacote sorteia as categorias de novo, do zero.
    function drawPack() {
        const stickers = loadStickers();
        const results = [];
        const byCat = albumByCategory();
        const cats = shuffle(Object.keys(byCat)).slice(0, PACK_SIZE);
        for (let i = 0; i < PACK_SIZE; i++) {
            const cat = cats[i] || cats[i % cats.length]; // salvaguarda se um dia tiver < PACK_SIZE categorias
            const pool = byCat[cat];
            const drawn = pool[Math.floor(Math.random() * pool.length)];
            let rarity = rollRarity();
            // não caiu lenda -> 10% de chance de sair brilhante (qualquer figurinha, qualquer livro)
            if (rarity === 'base' && Math.random() < SHINY_CHANCE) rarity = 'shiny';
            let e = stickers.find(s => s.codigo === drawn.codigo);
            if (!e) { e = { codigo: drawn.codigo, colada: null, pilha: [] }; stickers.push(e); }
            const isNew = !e.colada;
            e.pilha.push(rarity);
            results.push({ country: drawn, rarity, isNew });
        }
        saveStickers(stickers);
        return results;
    }

    // impacto reservado pra prata/ouro: flash de tela + tremor + vibração forte
    // + confete extra — chamado bem no instante em que a melhor carta "pousa".
    function triggerBestImpact() {
        const flash = document.getElementById('impact-flash');
        const content = document.querySelector('#pack-modal .pack-content');
        if (!calmMode && flash) { flash.classList.remove('hit'); void flash.offsetWidth; flash.classList.add('hit'); }
        if (!calmMode && content) { content.classList.remove('impact-shake'); void content.offsetWidth; content.classList.add('impact-shake'); }
        if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18, 40, 70]); } catch (e) {} }
        if (!calmMode && typeof confetti !== 'undefined') confetti({ particleCount: 90, spread: 100, startVelocity: 42, origin: { y: 0.45 } });
    }

    function runPackOpen() {
        if (elements.packAnimationContainer.classList.contains('opening')) return;
        if (!removePack()) { showToast('Você não tem pacotes!', 'error'); return; }

        elements.packAnimationContainer.classList.add('opening');
        if (window.SFX) window.SFX.play('pack_tear');

        setTimeout(() => {
            const results = drawPack();
            // guarda de onde o envelope "explodiu" na tela — as cartas vão
            // voar dali até o lugar delas na grade (GSAP), não só nascer prontas.
            const originRect = elements.packAnimationContainer.getBoundingClientRect();
            const originX = originRect.left + originRect.width / 2;
            const originY = originRect.top + originRect.height / 2;
            elements.packAnimationContainer.classList.add('hidden');
            elements.openedStickers.innerHTML = '';
            elements.openedStickers.classList.remove('hidden');
            elements.openedStickers.classList.remove('gsap-driven');

            const best = results.reduce((b, r) => Math.max(b, RARITY_ORDER.indexOf(r.rarity)), 0);
            if (window.SFX) {
                const rev = best >= 4 ? 'reveal_legend' : best >= 2 ? 'reveal_rare' : 'reveal_common';
                setTimeout(() => window.SFX.play(rev), 200);
            }

            // revela do pior pro melhor — a melhor figurinha do pacote sempre
            // fecha o pacote, com uma pausa dramática antes dela (clímax).
            const shown = results.slice().sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
            const bestIdx = shown.length - 1;
            let bestDelayMs = 0;
            shown.forEach((r, i) => {
                const card = document.createElement('div');
                const legend = LEGEND_RARS.includes(r.rarity);
                const shiny = isShinyRar(r.rarity, r.country);
                const isBest = i === bestIdx;
                card.className = `pack-card fig-card rarity-${r.rarity}` + (r.isNew ? ' is-new' : '')
                    + (shiny ? ' shiny' : '') + (legend ? ' legend' : '') + (isBest ? ' pc-best' : '')
                    + (r.country._img ? ' is-collection' : '') + (figKindClass(r.country) ? ' ' + figKindClass(r.country) : '')
                    + (legend ? '' : figBgClass(r.country));
                const delay = i * 0.16 + (isBest ? 0.4 : 0);
                if (isBest) bestDelayMs = delay * 1000 + (calmMode ? 200 : 560);
                card.style.animationDelay = `${delay}s`;
                card.style.setProperty('--acc', (CONTINENT_META[r.country.continente] || {}).accent || '#60a5fa');
                if (!legend) applyFigBg(card, r.country);
                card.innerHTML = `
                    <div class="fig">
                        <span class="fig-bg"></span>
                        ${itemShape(r.country)}
                        <span class="fig-foil"></span>
                        ${r.isNew ? '<span class="pc-star">★</span>' : ''}
                        <div class="fig-flagwrap"><img class="fig-flag" src="${itemImg(r.country)}" alt="${r.country.nome}"></div>
                        <div class="fig-foot"><span class="fig-name">${r.country.nome}</span></div>
                        <div class="pc-tag">${r.isNew ? (RARITY_LABELS[r.rarity] || RARITY_LABELS.base).text : 'repetida'}</div>
                    </div>`;
                elements.openedStickers.appendChild(card);
            });

            if (!calmMode && typeof confetti !== 'undefined') {
                const n = best >= 4 ? 140 : best >= 2 ? 80 : best >= 1 ? 60 : 45;
                confetti({ particleCount: n, spread: 75, origin: { y: 0.5 } });
            }

            // ─── GSAP: as cartas voam de onde o envelope rasgou até a vaga delas
            // na grade (posição real calculada, não fixa) — clímax com pausa +
            // "back.out" de verdade na melhor carta. Sem GSAP/reduced-motion:
            // cai pro fallback CSS (@keyframes packCardIn), já testado sozinho.
            const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const cardEls = [...elements.openedStickers.children];
            if (window.gsap && !calmMode && !reduceMotion && cardEls.length) {
                elements.openedStickers.classList.add('gsap-driven');
                const tl = gsap.timeline();
                cardEls.forEach((el, i) => {
                    el.style.animationDelay = '';
                    const r = el.getBoundingClientRect();
                    const dx = originX - (r.left + r.width / 2);
                    const dy = originY - (r.top + r.height / 2);
                    const isBest = el.classList.contains('pc-best');
                    gsap.set(el, {
                        x: dx, y: dy, scale: .48, opacity: 0,
                        rotateY: i % 2 ? -125 : -105, rotateZ: (Math.random() * 20 - 10),
                        transformPerspective: 700,
                    });
                    const pos = isBest ? '+=0.38' : (i === 0 ? 0 : '-=0.28');
                    tl.to(el, {
                        x: 0, y: 0, scale: 1, opacity: 1, rotateY: 0, rotateZ: 0,
                        duration: isBest ? 0.85 : 0.5,
                        ease: isBest ? 'back.out(2.4)' : 'back.out(1.5)',
                    }, pos);
                    if (isBest) tl.call(() => {
                        if (best >= 4) triggerBestImpact();
                        else if (best >= 2 && navigator.vibrate) { try { navigator.vibrate(22); } catch (e) {} }
                    }, [], '-=0.18');
                });
            } else if (best >= 4) {
                setTimeout(triggerBestImpact, bestDelayMs);
            } else if (best >= 2 && navigator.vibrate) {
                setTimeout(() => { try { navigator.vibrate(22); } catch (e) {} }, bestDelayMs);
            }

            buildDecideList(shown);
            const endActions = document.getElementById('pack-end-actions');
            if (endActions) endActions.classList.remove('hidden');
            if (buttons.openMore) {
                const left = getPacksCount();
                buttons.openMore.disabled = left <= 0;
                buttons.openMore.textContent = left > 0 ? `🎁 Abrir mais (${left})` : 'Sem pacotes';
            }
            requestAnimationFrame(() => fitFigNames(elements.openedStickers));
        }, 650);
    }

    // ─── tensão sonora do rasgo — sintetizada na hora (Web Audio), sem
    // arquivo — sobe suave conforme o rasgo avança + um brilho fino "quase lá"
    // perto do fim. Triângulo (não serra — nada de zumbido áspero de alarme),
    // volume baixo, some se "modo calmo"/SFX off.
    const TearFX = (function () {
        let ctx = null, osc = null, osc2 = null, gain = null, gain2 = null, filter = null, active = false;
        function ensureCtx() {
            if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            return ctx;
        }
        function start() {
            if (active || calmMode || !(window.SFX && window.SFX.enabled)) return;
            const c = ensureCtx(); if (!c) return;
            osc = c.createOscillator(); osc.type = 'triangle';
            filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 0.6; filter.frequency.value = 220;
            gain = c.createGain(); gain.gain.value = 0;
            osc.connect(filter); filter.connect(gain); gain.connect(c.destination);
            osc.frequency.value = 68;
            // 2ª onda, bem baixinha: só um brilho de "tá quase" no fim do rasgo
            osc2 = c.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 640;
            gain2 = c.createGain(); gain2.gain.value = 0;
            osc2.connect(gain2); gain2.connect(c.destination);
            try { osc.start(); osc2.start(); active = true; } catch (e) {}
        }
        function update(frac) {
            if (!active || !ctx) return;
            const t = ctx.currentTime;
            osc.frequency.setTargetAtTime(68 + frac * 150, t, 0.05);
            filter.frequency.setTargetAtTime(200 + frac * 1100, t, 0.05);
            gain.gain.setTargetAtTime(Math.min(0.055, 0.014 + frac * 0.045), t, 0.05);
            const shimmer = Math.max(0, (frac - 0.72) / 0.28); // só nos últimos 28% do rasgo
            osc2.frequency.setTargetAtTime(640 + frac * 460, t, 0.08);
            gain2.gain.setTargetAtTime(shimmer * 0.03, t, 0.08);
        }
        function stop(fast) {
            if (!active) return;
            active = false;
            const c = ctx, o = osc, o2 = osc2, g = gain, g2 = gain2;
            if (c) {
                if (g) { try { g.gain.setTargetAtTime(0, c.currentTime, fast ? 0.03 : 0.12); } catch (e) {} }
                if (g2) { try { g2.gain.setTargetAtTime(0, c.currentTime, fast ? 0.03 : 0.12); } catch (e) {} }
            }
            setTimeout(() => { try { o.stop(); } catch (e) {} try { o2.stop(); } catch (e) {} }, fast ? 120 : 220);
            osc = null; osc2 = null; gain = null; gain2 = null; filter = null;
        }
        return { start, update, stop };
    })();

    // ─── farpas de papel voando na direção do rasgo (DOM, sem canvas) ───
    function spawnPaperBits(wrap, xFrac, yFrac, n) {
        if (calmMode) return;
        for (let i = 0; i < n; i++) {
            const bit = document.createElement('span');
            bit.className = 'paper-bit';
            const ang = -70 + Math.random() * 140; // tende pra cima
            const dist = 36 + Math.random() * 64;
            const rad = ang * Math.PI / 180;
            bit.style.setProperty('--dx', (Math.sin(rad) * dist).toFixed(1) + 'px');
            bit.style.setProperty('--dy', (-Math.cos(rad) * dist).toFixed(1) + 'px');
            bit.style.setProperty('--rot', (Math.random() * 360 - 180).toFixed(0) + 'deg');
            bit.style.left = (xFrac * 100).toFixed(1) + '%';
            bit.style.top = (yFrac * 100).toFixed(1) + '%';
            wrap.appendChild(bit);
            bit.addEventListener('animationend', () => bit.remove());
            setTimeout(() => bit.remove(), 900); // salvaguarda se o animationend não disparar
        }
    }

    // ─── ENVELOPE: rasgo guiado seguindo o cursor + inclinação 3D + brilho ───
    (function wirePackTear() {
        const stage = elements.packAnimationContainer;
        if (!stage) return;
        const wrap = () => stage.querySelector('.pack-wrapper');
        let dragging = false, moved = false, w = null, lastBitStep = -1;

        const setTear = f => { f = Math.max(0, Math.min(1, f)); if (w) w.style.setProperty('--tear', f.toFixed(3)); return f; };

        // inclina o envelope + move o brilho especular conforme o ponteiro
        // (hover no desktop antes de rasgar, e durante o próprio arrasto)
        const updateTilt = (el, clientX, clientY) => {
            const r = el.getBoundingClientRect();
            const nx = (clientX - r.left) / r.width;   // 0..1
            const ny = (clientY - r.top) / r.height;   // 0..1
            el.style.setProperty('--ry', ((nx - 0.5) * 18).toFixed(2) + 'deg');
            el.style.setProperty('--rx', ((0.5 - ny) * 14).toFixed(2) + 'deg');
            el.style.setProperty('--mx', (nx * 100).toFixed(1) + '%');
            el.style.setProperty('--my', (ny * 100).toFixed(1) + '%');
            return { nx, ny };
        };
        const resetTilt = el => {
            el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
            el.style.setProperty('--mx', '50%'); el.style.setProperty('--my', '40%');
        };
        // hover no desktop antes de tocar (não faz nada se já estiver rasgando)
        stage.addEventListener('pointermove', e => {
            if (dragging || stage.classList.contains('opening')) return;
            const el = wrap(); if (!el) return;
            updateTilt(el, e.clientX, e.clientY);
        });
        stage.addEventListener('pointerleave', () => { const el = wrap(); if (el && !dragging) resetTilt(el); });

        stage.addEventListener('pointerdown', e => {
            if (stage.classList.contains('opening')) return;
            w = wrap(); if (!w) return;
            dragging = true; moved = false; lastBitStep = -1;
            w.classList.add('tearing');
            const r = w.getBoundingClientRect();
            setTear((e.clientX - r.left) / r.width);
            updateTilt(w, e.clientX, e.clientY);
            TearFX.start();
            try { stage.setPointerCapture(e.pointerId); } catch (_) {}
        });
        stage.addEventListener('pointermove', e => {
            if (!dragging || !w) return;
            moved = true;
            const r = w.getBoundingClientRect();
            const { ny } = updateTilt(w, e.clientX, e.clientY);
            const f = setTear((e.clientX - r.left) / r.width);
            TearFX.update(f);
            const step = Math.floor(f * 12);
            if (step > lastBitStep && f > 0.05) { lastBitStep = step; spawnPaperBits(w, f, ny, 1); }
            if (f >= 0.62) finishTear();
        });
        const cancelTear = () => {
            if (!dragging) return;
            dragging = false;
            TearFX.stop(true);
            if (w) { w.classList.remove('tearing'); w.style.setProperty('--tear', '0'); resetTilt(w); }
        };
        const finishTear = () => {
            if (!dragging) return;
            dragging = false;
            TearFX.stop();
            if (navigator.vibrate) { try { navigator.vibrate(16); } catch (e) {} }
            if (w) { w.classList.remove('tearing'); spawnPaperBits(w, 0.5, 0.15, 9); }
            runPackOpen();
        };
        stage.addEventListener('pointerup', () => { if (dragging) cancelTear(); });
        stage.addEventListener('pointercancel', cancelTear);

        // toque simples NAO abre: mostra o gesto (chacoalha + risco atravessa)
        stage.addEventListener('click', () => {
            if (moved) { moved = false; return; }
            const el = wrap(); if (!el || stage.classList.contains('opening')) return;
            el.classList.remove('hinting'); void el.offsetWidth; el.classList.add('hinting');
            if (window.SFX) window.SFX.play('tap');
            setTimeout(() => el.classList.remove('hinting'), 900);
        });
    })();

    // ─── holo interativo nas cartas raras da revelação (segue o dedo/mouse) ───
    (function wirePackHolo() {
        const grid = elements.openedStickers;
        if (!grid) return;
        const holoCard = el => el && el.closest && el.closest('.pack-card.shiny, .pack-card.legend');
        grid.addEventListener('pointermove', e => {
            const card = holoCard(e.target); if (!card) return;
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
            card.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
            card.classList.add('holo-active');
        });
        grid.addEventListener('pointerleave', e => {
            const card = holoCard(e.target); if (card) card.classList.remove('holo-active');
        }, true);
    })();

    // "o que fazer com as novas" — uma de cada vez, com botão "Próxima"
    let _decideQueue = [];
    function buildDecideList(results) {
        const box = document.getElementById('pack-decide');
        const list = document.getElementById('pack-decide-list');
        list.innerHTML = '';
        // dedup por código (se veio 2x a mesma nova)
        const seen = new Set();
        _decideQueue = results.filter(r => {
            if (!r.isNew || seen.has(r.country.codigo)) return false;
            seen.add(r.country.codigo); return true;
        });
        box.removeAttribute('data-total');
        if (!_decideQueue.length) { box.classList.add('hidden'); return; }
        box.classList.remove('hidden');
        renderDecideStep();
    }

    function renderDecideStep() {
        const box = document.getElementById('pack-decide');
        const list = document.getElementById('pack-decide-list');
        const total = box.dataset.total ? +box.dataset.total : (box.dataset.total = _decideQueue.length, _decideQueue.length);
        if (!_decideQueue.length) {
            box.classList.add('hidden');
            box.removeAttribute('data-total');
            list.innerHTML = '';
            refreshHub();
            return;
        }
        const r = _decideQueue[0];
        const done = total - _decideQueue.length + 1;
        list.innerHTML = `
            <div class="decide-one">
                <span class="decide-step">${done} de ${total}</span>
                <img class="decide-one-img" src="${itemImg(r.country)}" alt="">
                <span class="decide-one-name">${r.country.nome}</span>
                <div class="decide-one-btns">
                    <button class="decide-glue">✅ Colar no álbum</button>
                    <button class="decide-keep">📦 Guardar na pilha</button>
                </div>
            </div>`;
        requestAnimationFrame(() => fitFigNames(list));
        const advance = () => { _decideQueue.shift(); renderDecideStep(); };
        list.querySelector('.decide-glue').addEventListener('click', (e) => {
            const ok = glueSticker(r.country.codigo, r.rarity);
            if (window.SFX) window.SFX.play(ok ? 'sticker_paste' : 'tap');
            if (ok && !calmMode && typeof confetti !== 'undefined') {
                const b = e.currentTarget.getBoundingClientRect();
                confetti({ particleCount: 40, spread: 50, startVelocity: 24,
                    origin: { x: (b.left + b.width / 2) / innerWidth, y: (b.top + b.height / 2) / innerHeight } });
            }
            advance();
        });
        list.querySelector('.decide-keep').addEventListener('click', advance);
    }

    if (buttons.closePack) buttons.closePack.addEventListener('click', () => {
        modals.pack.classList.add('hidden');
        openAlbum();
    });

    // Eventos Multiplayer — modo antigo PeerJS (substituído pela sala "Conhecimento é
    // Poder" em cima do Supabase; o wiring segue só se as telas antigas existirem)
    if (buttons.btnHostParty) {
        buttons.btnHostParty.addEventListener('click', initPartyHostMode);
        buttons.btnJoinParty.addEventListener('click', () => {
            const profiles = JSON.parse(localStorage.getItem('detetive_profiles')) || [];
            if (!currentUser) { showToast("Você precisa criar um perfil na tela principal antes de jogar online!", "error"); return; }
            profiles.forEach(name => { const opt = document.createElement('option'); opt.value = opt.textContent = name; elements.joinPlayerName.appendChild(opt); });
            showScreen('partyJoinClient');
        });
        buttons.joinRoomBtn.addEventListener('click', joinPartyRoom);
        buttons.startPartyBtn.addEventListener('click', startPartyGame);
        buttons.partyHostBackMenu.addEventListener('click', () => { partyCleanup(); showScreen('main'); });
        buttons.partyHostPlayAgain.addEventListener('click', startPartyGame);
        const cancelParty = document.getElementById('cancel-party-btn');
        if (cancelParty) cancelParty.addEventListener('click', partyCleanup);
    }

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
        if (gameState.duel) { nextRound(); return; }
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
        PaisPorCapital:    { icon: '🏛️', label: 'De qual país é esta capital?' },
        ContinentePorPais: { icon: '🌎', label: 'Qual o Continente?' },
        Mapa:              { icon: '🗺️', label: 'Que Formato é?' },
        Forca:             { icon: '🪢', label: 'A Lendária Forca' },
        Memoria:           { icon: '🃏', label: 'Jogo da Memória' },
    };
    const setupEl = document.getElementById('game-setup');

    function openSetup(mode) {
        gameConfig = { mode, type: null, level: null, lives: 'infinite', pool: 'paises' };
        const meta = MODE_META[mode] || { icon: '🎮', label: mode };
        document.getElementById('setup-mode-icon').textContent = meta.icon;
        document.getElementById('setup-mode-name').textContent = meta.label;
        setupEl.querySelectorAll('.setup-opt.selected').forEach(o => o.classList.remove('selected'));
        const poolDefault = setupEl.querySelector('.setup-opt[data-setup="pool"][data-value="paises"]');
        if (poolDefault) poolDefault.classList.add('selected');
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
        const secPool = document.getElementById('setup-sec-pool');
        if (secPool) secPool.classList.toggle('hidden', gameConfig.mode !== 'BandeiraPorPais');

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
        } else if (kind === 'pool') {
            gameConfig.pool = raw;
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

    document.querySelectorAll('#main-menu .mode-button[data-gamemode]').forEach(b => b.addEventListener('click', () => {
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

    (Auth.onReady ? Auth.onReady() : Promise.resolve()).then(() => {
        renderAuthAccounts();
        updateOfflineBanner();
        const online = window.DG_ONLINE;
        const who = online ? (Auth.currentName && Auth.currentName())
            : (currentUser && Auth.list().some(a => a.name === currentUser) ? currentUser : null);
        if (who) {
            enterAfterAuth(who, Auth.avatarOf(who));
        } else {
            if (!online) { Auth.logout(); currentUser = null; }
            showScreen('profile');
        }
    });

    window.addEventListener('online', updateOfflineBanner);
    window.addEventListener('offline', updateOfflineBanner);
    function updateOfflineBanner() {
        const on = !Auth.isOnline || Auth.isOnline();
        let b = document.getElementById('offline-banner');
        if (on) { if (b) b.remove(); return; }
        if (!b) {
            b = document.createElement('div');
            b.id = 'offline-banner';
            b.textContent = '📴 Sem internet — jogando offline. Sincroniza ao voltar.';
            document.body.appendChild(b);
        }
    }
});

    