/* ═══════════════════════════════════════════════════════════════════
   Detetive Global — camada de dados ONLINE (Supabase) + offline-first
   -------------------------------------------------------------------
   Se window.DG_CONFIG tiver URL+chave e o SDK carregou, este arquivo
   SOBRESCREVE window.API / window.Auth com implementações que:
     • guardam a sessão do Supabase (joga offline depois do 1º login)
     • leem sempre de um estado em memória (espelhado no localStorage)
     • escrevem no estado + localStorage + Supabase; se offline, enfileiram
     • esvaziam a fila e re-sincronizam quando a conexão volta
   Também expõe window.OnlineTrades (mural + oferta direta + realtime).
   Sem config → não faz nada (o jogo fica 100% local, como antes).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  const C = window.DG_CONFIG || {};
  if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY || !window.supabase) {
    window.DG_ONLINE = false;
    return;
  }
  window.DG_ONLINE = true;

  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    // nunca servir leitura do banco pelo cache do navegador — depois de uma
    // troca / abertura de pacote o estado tem que vir fresco na hora
    global: { fetch: (u, o) => fetch(u, { ...o, cache: 'no-store' }) },
  });
  const EMAIL_DOMAIN = '@detetiveglobal.app';
  const emailFor = (u) => (u || '').trim().toLowerCase().replace(/\s+/g, '-') + EMAIL_DOMAIN;
  const todayKey = () => new Date().toISOString().slice(0, 10);

  // cliente sem sessão — pra convidado (sem conta) entrar numa sala de festa
  let _anon = null;
  const sbAnon = () => (_anon || (_anon = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })));

  let uid = null, uname = null, uavatar = '🌍', uIsAdmin = false, uMustChange = false;
  let online = navigator.onLine;
  let readyResolve;
  const ready = new Promise((r) => (readyResolve = r));

  // estado em memória (populado por pullAll ou pelo localStorage)
  const st = {
    progress: {}, stickers: [],
    packs: { count: 0, last_daily_at: null, streak_count: 0, streak_last: null },
    journey: 1, achievements: [], daily: {},
  };

  // ---------- localStorage mirror ----------
  const lkey = (k) => `dgo_${uid}_${k}`;
  function lget(k) { try { return JSON.parse(localStorage.getItem(lkey(k))); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(lkey(k), JSON.stringify(v)); } catch (e) {} }
  function mirror() {
    lset('progress', st.progress); lset('stickers', st.stickers); lset('packs', st.packs);
    lset('journey', st.journey); lset('achievements', st.achievements); lset('daily', st.daily);
  }
  function loadMirror() {
    st.progress = lget('progress') || {};
    st.stickers = lget('stickers') || [];
    st.packs = lget('packs') || { count: 0, last_daily_at: null, streak_count: 0, streak_last: null };
    st.journey = lget('journey') || 1;
    st.achievements = lget('achievements') || [];
    st.daily = lget('daily') || {};
  }

  // ---------- fila de sincronização ----------
  const qkey = () => `dgo_syncq_${uid}`;
  function qLoad() { try { return JSON.parse(localStorage.getItem(qkey())) || []; } catch (e) { return []; } }
  function qSave(a) { try { localStorage.setItem(qkey(), JSON.stringify(a)); } catch (e) {} }
  function pkStr(table, row) {
    if (table === 'country_progress') return row.user_id + '|' + row.code;
    if (table === 'stickers') return row.user_id + '|' + row.codigo;
    if (table === 'daily_progress') return row.user_id + '|' + row.day;
    if (table === 'achievements') return row.user_id + '|' + row.key;
    return row.user_id; // packs, journey
  }
  function enqueue(table, row) {
    const q = qLoad();
    const p = pkStr(table, row);
    const i = q.findIndex((x) => x.table === table && pkStr(x.table, x.row) === p);
    if (i >= 0) q[i] = { table, row }; else q.push({ table, row });
    qSave(q);
  }
  // O Supabase tem uma janela de ~1s em que uma leitura (de outra conexão) ainda
  // vê o valor ANTIGO logo depois de uma escrita. Guardamos quais tabelas foram
  // escritas há pouco pra o pullAll não sobrescrever o estado local bom com um
  // retrato velho do servidor.
  const RECENT_WRITE_MS = 4000;
  const recentWrites = {};
  const wroteNow = (t) => { recentWrites[t] = Date.now(); };
  const wroteRecently = (t) => (Date.now() - (recentWrites[t] || 0)) < RECENT_WRITE_MS;

  let flushing = false;
  async function flush() {
    if (flushing || !online || !uid) return;
    flushing = true;
    try {
      let q = qLoad();
      while (q.length) {
        const { table, row } = q[0];
        const { error } = await sb.from(table).upsert(row);
        if (error) { console.warn('[sync]', table, error.message); break; }
        wroteNow(table);
        q.shift(); qSave(q);
      }
      if (!qLoad().length) { await new Promise((r) => setTimeout(r, 1200)); await pullAll(); }
    } finally { flushing = false; }
  }

  // ---------- escrita (estado + mirror + push/fila) ----------
  async function put(table, row) {
    row.user_id = uid;
    mirror();
    wroteNow(table);
    if (online) {
      const { error } = await sb.from(table).upsert(row);
      if (error) enqueue(table, row);
    } else {
      enqueue(table, row);
    }
  }

  // ---------- pull inicial ----------
  const mapProg = (r) => ({
    acertos: r.acertos, erros: r.erros, streak: r.streak, ease: r.ease, mastery: r.mastery,
    lastSeen: r.last_seen_at ? Date.parse(r.last_seen_at) : undefined,
    nextReview: r.next_review_at ? Date.parse(r.next_review_at) : undefined,
    avgMs: r.avg_ms || undefined, hist: r.hist || [],
  });
  async function pullAll() {
    if (!online || !uid) return;
    try {
      const [pr, stk, pk, jr, ac, dp] = await Promise.all([
        sb.from('country_progress').select('*').eq('user_id', uid),
        sb.from('stickers').select('*').eq('user_id', uid),
        sb.from('packs').select('*').eq('user_id', uid).maybeSingle(),
        sb.from('journey').select('*').eq('user_id', uid).maybeSingle(),
        sb.from('achievements').select('key').eq('user_id', uid),
        sb.from('daily_progress').select('*').eq('user_id', uid).gte('day', todayKey()),
      ]);
      // não adota o retrato do servidor pra tabelas que acabamos de escrever
      // (a leitura pode estar ~1s atrasada e apagaria o progresso recém-feito)
      if (!wroteRecently('country_progress')) {
        st.progress = {};
        (pr.data || []).forEach((r) => { st.progress[r.code] = mapProg(r); });
      }
      if (!wroteRecently('stickers')) {
        st.stickers = (stk.data || []).map((r) => ({ codigo: r.codigo, colada: r.colada, pilha: r.pilha || [] }));
      }
      if (!wroteRecently('packs') && pk.data) {
        st.packs = { count: pk.data.count, last_daily_at: pk.data.last_daily_at,
          streak_count: pk.data.streak_count, streak_last: pk.data.streak_last };
      }
      if (!wroteRecently('journey')) st.journey = jr.data ? jr.data.level : 1;
      if (!wroteRecently('achievements')) st.achievements = (ac.data || []).map((r) => r.key);
      if (!wroteRecently('daily_progress')) {
        st.daily = {};
        (dp.data || []).forEach((r) => {
          st.daily[r.day] = { day: r.day, acertos: r.acertos, masteredToday: r.mastered,
            modes: r.modes || {}, bonus: r.bonus || {} };
        });
      }
      mirror();
    } catch (e) { console.warn('[pullAll]', e); }
  }

  // ---------- sessão ----------
  async function adoptSession(session) {
    if (!session || !session.user) { uid = null; uname = null; uIsAdmin = false; uMustChange = false; return; }
    uid = session.user.id;
    uMustChange = !!(session.user.user_metadata && session.user.user_metadata.must_change);
    loadMirror();
    const fallbackName = (session.user.email || '').replace(EMAIL_DOMAIN, '');
    // profile (nome/avatar) — cria na 1ª vez (contas feitas no painel do Supabase)
    if (online) {
      // is_admin só existe depois de rodar supabase/admin.sql — cai pro select simples se faltar
      const readProfile = async () => {
        let q = await sb.from('profiles').select('username,avatar,is_admin').eq('id', uid).maybeSingle();
        if (q.error) q = await sb.from('profiles').select('username,avatar').eq('id', uid).maybeSingle();
        return q.data;
      };
      let data = await readProfile();
      if (!data) {
        await sb.rpc('bootstrap_profile', { p_username: fallbackName, p_avatar: '🌍' });
        data = await readProfile();
      }
      if (data) { uname = data.username; uavatar = data.avatar || '🌍'; uIsAdmin = data.is_admin === true; }
    }
    if (!uname) uname = fallbackName;
    try { localStorage.setItem('dgo_lastuser', JSON.stringify({ name: uname, avatar: uavatar })); } catch (e) {}
    await pullAll();
    await flush();
  }

  sb.auth.getSession().then(async ({ data }) => {
    await adoptSession(data.session);
    readyResolve();
  });
  sb.auth.onAuthStateChange((_evt, session) => {
    if (session && session.user && session.user.id !== uid) adoptSession(session);
    if (!session) { uid = null; uname = null; }
  });

  window.addEventListener('online', () => { online = true; flush(); });
  window.addEventListener('offline', () => { online = false; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && online) flush(); });

  // ═══════════════ API ═══════════════
  const traduzErro = (m) => {
    m = (m || '').toLowerCase();
    if (m.includes('invalid login')) return 'Usuário ou senha incorretos.';
    if (m.includes('already registered') || m.includes('duplicate')) return 'Esse usuário já existe. Tente entrar.';
    if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Criar conta está fechado. Peça uma conta pro dono do jogo.';
    if (m.includes('email not confirmed')) return 'Ligue "Confirm email = OFF" no Supabase e tente de novo.';
    if (m.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (m.includes('network') || m.includes('fetch') || m.includes('load failed')) return 'Sem internet. Verifique a conexão.';
    return 'Não deu certo. Tente de novo.';
  };

  window.API = {
    async getProfiles() { return []; },
    async createProfile() { return { error: 'indisponível' }; },
    async deleteProfile() {},

    async getProgress() { return JSON.parse(JSON.stringify(st.progress)); },
    async saveProgress(_name, data) {
      // upsert só o que mudou (data é uma cópia; st.progress é o canônico)
      for (const code of Object.keys(data || {})) {
        const a = data[code], b = st.progress[code];
        if (b && JSON.stringify(a) === JSON.stringify(b)) continue;
        st.progress[code] = JSON.parse(JSON.stringify(a));
        await put('country_progress', {
          code,
          acertos: a.acertos | 0, erros: a.erros | 0, streak: a.streak | 0,
          ease: a.ease || 2.3, mastery: a.mastery | 0,
          last_seen_at: a.lastSeen ? new Date(a.lastSeen).toISOString() : null,
          next_review_at: a.nextReview ? new Date(a.nextReview).toISOString() : null,
          avg_ms: a.avgMs || null, hist: a.hist || [],
        });
      }
    },

    async getStickers() { return JSON.parse(JSON.stringify(st.stickers)); },
    async saveStickers(_name, arr) {
      const byCode = {}; st.stickers.forEach((s) => (byCode[s.codigo] = s));
      st.stickers = JSON.parse(JSON.stringify(arr || []));
      for (const s of st.stickers) {
        const old = byCode[s.codigo];
        if (old && old.colada === s.colada && JSON.stringify(old.pilha) === JSON.stringify(s.pilha)) continue;
        await put('stickers', { codigo: s.codigo, colada: s.colada || null, pilha: s.pilha || [] });
      }
    },

    async getPacks() { return { count: st.packs.count, last_daily_at: st.packs.last_daily_at }; },
    async savePacks(_name, count, last_daily_at) {
      st.packs.count = Number(count) || 0;
      if (last_daily_at) st.packs.last_daily_at = last_daily_at;
      await put('packs', { count: st.packs.count, last_daily_at: st.packs.last_daily_at,
        streak_count: st.packs.streak_count, streak_last: st.packs.streak_last });
    },

    async getStreak() { return { count: st.packs.streak_count || 0, last: st.packs.streak_last || null }; },
    async saveStreak(_name, s) {
      st.packs.streak_count = s.count | 0; st.packs.streak_last = s.last || null;
      await put('packs', { count: st.packs.count, last_daily_at: st.packs.last_daily_at,
        streak_count: st.packs.streak_count, streak_last: st.packs.streak_last });
    },

    async getJourney() { return { level: st.journey }; },
    async saveJourney(_name, level) {
      st.journey = Number(level) || 1;
      await put('journey', { level: st.journey });
    },

    async getDaily(_name, day) { return st.daily[day] || null; },
    async saveDaily(_name, day, obj) {
      st.daily[day] = { day, acertos: obj.acertos | 0, masteredToday: obj.masteredToday | 0,
        modes: obj.modes || {}, bonus: obj.bonus || {} };
      mirror();
      await put('daily_progress', {
        day, acertos: obj.acertos | 0, mastered: obj.masteredToday | 0,
        modes: obj.modes || {}, bonus: obj.bonus || {},
      });
    },

    // leituras síncronas do estado (pro código legado que não é async)
    _sync: {
      streak: () => ({ count: st.packs.streak_count || 0, last: st.packs.streak_last || null }),
      daily: (day) => st.daily[day] || null,
      ach: () => st.achievements.slice(),
    },

    async getAchievements() { return st.achievements.slice(); },
    async addAchievement(key) {
      if (st.achievements.includes(key)) return;
      st.achievements.push(key); mirror();
      if (online) { const { error } = await sb.from('achievements').insert({ user_id: uid, key }); if (error) enqueue('achievements', { user_id: uid, key }); }
      else enqueue('achievements', { user_id: uid, key });
    },

    async getRanking() {
      // devolve linhas cruas (renderRanking faz dedup + período)
      if (!online) return (lget('ranking_cache') || []);
      const { data } = await sb.from('ranking').select('username,avatar,score,mode,played_at')
        .order('played_at', { ascending: false }).limit(600);
      const rows = (data || []).map((r) => ({
        nome: r.username, avatar: r.avatar, score: r.score, mode: r.mode, played_at: r.played_at,
      }));
      lset('ranking_cache', rows);
      return rows;
    },
    async addRanking(_nome, score, mode) {
      const row = { user_id: uid, username: uname, avatar: uavatar, score: Number(score) || 0, mode, played_at: new Date().toISOString() };
      if (online) { const { error } = await sb.from('ranking').insert(row); if (error) enqueue('ranking', row); }
      else enqueue('ranking', row);
    },
  };

  // ═══════════════ Auth ═══════════════
  window.Auth = {
    onReady: () => ready,
    isOnline: () => online,
    currentName: () => uname,
    currentUid: () => uid,

    list() {
      try { const l = JSON.parse(localStorage.getItem('dgo_lastuser')); return l ? [l] : []; }
      catch (e) { return []; }
    },
    avatarOf(name) { return name && name === uname ? uavatar : '🌍'; },
    removeAccount() { try { localStorage.removeItem('dgo_lastuser'); } catch (e) {} },

    async signup(name, password, avatar) {
      name = (name || '').trim();
      if (name.length < 2 || name.length > 16) return { error: 'O usuário precisa ter de 2 a 16 caracteres.' };
      if (!/^[\p{L}\p{N} _.\-]+$/u.test(name)) return { error: 'Use letras, números, espaço, ponto ou hífen.' };
      if ((password || '').length < 6) return { error: 'A senha precisa ter pelo menos 6 caracteres.' };
      if (!online) return { error: 'Você precisa de internet pra criar a conta.' };
      const { data, error } = await sb.auth.signUp({ email: emailFor(name), password });
      if (error) return { error: traduzErro(error.message) };
      // pode não vir sessão se "confirm email" estiver ligado — tenta logar
      if (!data.session) {
        const r = await sb.auth.signInWithPassword({ email: emailFor(name), password });
        if (r.error) return { error: 'Conta criada. Desligue "Confirm email" no Supabase e entre.' };
      }
      const { error: e2 } = await sb.rpc('bootstrap_profile', { p_username: name, p_avatar: avatar || '🌍' });
      if (e2 && /duplicate|unique/i.test(e2.message)) { await sb.auth.signOut(); return { error: 'Esse usuário já existe.' }; }
      uavatar = avatar || '🌍';
      await adoptSession((await sb.auth.getSession()).data.session);
      return { name: uname, avatar: uavatar };
    },

    async login(name, password) {
      name = (name || '').trim();
      if (!online) return { error: 'Sem internet — não dá pra entrar agora.' };
      const { error } = await sb.auth.signInWithPassword({ email: emailFor(name), password });
      if (error) return { error: traduzErro(error.message) };
      await adoptSession((await sb.auth.getSession()).data.session);
      return { name: uname, avatar: uavatar, mustChange: uMustChange };
    },

    async logout() {
      try { await sb.auth.signOut(); } catch (e) {}
      uid = null; uname = null; uIsAdmin = false; uMustChange = false;
    },

    // ---- troca de senha obrigatória no 1º acesso ----
    needsPasswordChange: () => uMustChange,
    async changeMyPassword(newPw) {
      if (!online) return { error: 'Precisa de internet.' };
      if ((newPw || '').length < 6) return { error: 'A senha precisa ter pelo menos 6 caracteres.' };
      const { error } = await sb.auth.updateUser({ password: newPw, data: { must_change: false } });
      if (error) return { error: traduzErro(error.message) };
      uMustChange = false;
      return { ok: true };
    },

    // ---- painel do dono (chama a Netlify Function) ----
    isAdmin: () => uIsAdmin,
    admin: {
      async _call(action, extra) {
        if (!online) return { error: 'Precisa de internet.' };
        const { data: s } = await sb.auth.getSession();
        const token = s && s.session && s.session.access_token;
        if (!token) return { error: 'Sessão expirada — entre de novo.' };
        let r;
        try {
          r = await fetch('/.netlify/functions/admin', {
            method: 'POST',
            headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify(Object.assign({ action }, extra || {})),
          });
        } catch (e) { return { error: 'Servidor de contas fora do ar.' }; }
        let j = {};
        try { j = await r.json(); } catch (e) {}
        if (!r.ok) return { error: j.error || ('erro ' + r.status) };
        return j;
      },
      list() { return this._call('list'); },
      create(username, password) { return this._call('create', { username, password }); },
      reset(userId, password) { return this._call('reset', { userId, password }); },
    },
  };

  // ═══════════════ OnlineTrades (mural + direto + realtime) ═══════════════
  window.OnlineTrades = {
    available: true,
    myName: () => uname,
    async findUser(name) {
      if (!online) return null;
      const { data } = await sb.from('profiles').select('id,username,avatar')
        .eq('username_lower', (name || '').trim().toLowerCase()).maybeSingle();
      return data || null;
    },
    async mural() {
      if (!online) return [];
      const { data } = await sb.from('trades').select('*')
        .eq('kind', 'mural').eq('status', 'aberta').neq('from_user', uid)
        .order('created_at', { ascending: false }).limit(60);
      return data || [];
    },
    async mine() {
      if (!online) return [];
      const { data } = await sb.from('trades').select('*')
        .or(`from_user.eq.${uid},to_user.eq.${uid}`)
        .order('created_at', { ascending: false }).limit(60);
      return data || [];
    },
    // offer/request = [{codigo, rarity}]
    async create(kind, toUser, offer, request) {
      if (!online) return { error: 'Sem internet.' };
      const row = {
        kind, from_user: uid, from_username: uname,
        to_user: kind === 'direto' ? (toUser && toUser.id) : null,
        to_username: kind === 'direto' ? (toUser && toUser.username) : null,
        offer, request,
      };
      const { data, error } = await sb.from('trades').insert(row).select().single();
      return error ? { error: error.message } : { ok: true, trade: data };
    },
    async accept(id, fulfill) {
      const { data, error } = await sb.rpc('accept_trade', { p_trade: id, p_fulfill: fulfill || [] });
      if (error) return { error: error.message }; if (data && data.error) return data;
      // a leitura logo após o RPC às vezes ainda vê o estado antigo (lag do
      // pooler/edge) — re-puxa algumas vezes até a troca aparecer resolvida
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => setTimeout(r, i ? 500 : 250));
        await pullAll();
        const done = await sb.from('trades').select('status').eq('id', id).maybeSingle();
        if (done.data && done.data.status !== 'aberta') { await pullAll(); break; }
      }
      return { ok: true };
    },
    async cancel(id) { const { data } = await sb.rpc('cancel_trade', { p_trade: id }); return data || {}; },
    async reject(id) { const { data } = await sb.rpc('reject_trade', { p_trade: id }); return data || {}; },
    subscribe(cb) {
      if (!online) return () => {};
      const ch = sb.channel('trades-' + uid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `to_user=eq.${uid}` }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `from_user=eq.${uid}` }, cb)
        .subscribe();
      return () => { try { sb.removeChannel(ch); } catch (e) {} };
    },
  };

  // ═══════════════ OnlineDuels (desafio assíncrono entre amigos) ═══════════════
  window.OnlineDuels = {
    available: true,
    myUid: () => uid,
    async findUser(name) {
      if (!online) return null;
      const { data } = await sb.from('profiles').select('id,username,avatar')
        .eq('username_lower', (name || '').trim().toLowerCase()).maybeSingle();
      return data || null;
    },
    // toUser = {id, username} ou null (mural). questions = [{code, opts:[...]}]
    async create(mode, difficulty, questions, toUser) {
      if (!online) return { error: 'Precisa de internet pra criar um desafio.' };
      const row = {
        kind: 'async', mode, difficulty: difficulty || 1, questions,
        from_user: uid, from_username: uname,
        to_user: (toUser && toUser.id) || null,
        to_username: (toUser && toUser.username) || null,
      };
      const { data, error } = await sb.from('duels').insert(row).select().single();
      return error ? { error: error.message } : { ok: true, duel: data };
    },
    async mine() {
      if (!online) return [];
      const { data } = await sb.from('duels').select('*')
        .or(`from_user.eq.${uid},to_user.eq.${uid}`)
        .order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    async mural() {
      if (!online) return [];
      const { data } = await sb.from('duels').select('*')
        .is('to_user', null).eq('status', 'aberto').neq('from_user', uid)
        .order('created_at', { ascending: false }).limit(40);
      return data || [];
    },
    async get(id) {
      if (!online) return null;
      const { data } = await sb.from('duels').select('*').eq('id', id).maybeSingle();
      return data || null;
    },
    async submitScore(id, score) {
      if (!online) return { error: 'Sem internet — joga de novo quando voltar.' };
      const { data, error } = await sb.rpc('submit_duel_score', { p_duel: id, p_score: score | 0 });
      if (error) return { error: error.message };
      return data || { ok: true };
    },
    async cancel(id) { const { data } = await sb.rpc('cancel_duel', { p_duel: id }); return data || {}; },
    subscribe(cb) {
      if (!online) return () => {};
      const ch = sb.channel('duels-' + uid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'duels', filter: `to_user=eq.${uid}` }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'duels', filter: `from_user=eq.${uid}` }, cb)
        .subscribe();
      return () => { try { sb.removeChannel(ch); } catch (e) {} };
    },

    // ─────────────── DUELO AO VIVO ───────────────
    myName: () => uname,
    myAvatar: () => uavatar,
    async createLive(mode, difficulty, questions, invited) {
      if (!online) return { error: 'Precisa de internet.' };
      const row = {
        mode, difficulty: difficulty || 1, questions,
        host_user: uid, host_name: uname, host_avatar: uavatar,
        invited_user: (invited && invited.id) || null,
      };
      const { data, error } = await sb.from('live_duels').insert(row).select().single();
      if (error) {
        if (/live_duels/.test(error.message)) return { error: 'O modo ao vivo ainda não foi ativado no servidor.' };
        return { error: error.message };
      }
      return { ok: true, duel: data };
    },
    async getLive(id) {
      if (!online) return null;
      const { data } = await sb.from('live_duels').select('*').eq('id', id).maybeSingle();
      return data || null;
    },
    async myLive() {
      if (!online) return [];
      const { data } = await sb.from('live_duels').select('*')
        .or(`host_user.eq.${uid},guest_user.eq.${uid},invited_user.eq.${uid}`)
        .in('status', ['aguardando', 'pronto', 'jogando'])
        .order('created_at', { ascending: false }).limit(20);
      return data || [];
    },
    async liveLobby() {
      if (!online) return [];
      const { data } = await sb.from('live_duels').select('*')
        .eq('status', 'aguardando').is('guest_user', null).is('invited_user', null)
        .neq('host_user', uid).order('created_at', { ascending: false }).limit(20);
      return data || [];
    },
    async joinLive(id)   { const { data, error } = await sb.rpc('join_live_duel',  { p_id: id });          return error ? { error: error.message } : (data || {}); },
    async startLive(id)  { const { data, error } = await sb.rpc('start_live_duel', { p_id: id });          return error ? { error: error.message } : (data || {}); },
    async finishLive(id, score) { const { data, error } = await sb.rpc('finish_live_duel', { p_id: id, p_score: score | 0 }); return error ? { error: error.message } : (data || {}); },
    async forfeitLive(id) { const { data, error } = await sb.rpc('forfeit_live_duel', { p_id: id });        return error ? { error: error.message } : (data || {}); },
    async cancelLive(id)  { const { data } = await sb.rpc('cancel_live_duel', { p_id: id });                return data || {}; },

    // avisa quando alguém te convida / entra / termina um duelo ao vivo
    subscribeLive(cb) {
      if (!online) return () => {};
      const ch = sb.channel('live-notif-' + uid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_duels', filter: `invited_user=eq.${uid}` }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_duels', filter: `host_user=eq.${uid}` }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_duels', filter: `guest_user=eq.${uid}` }, cb)
        .subscribe();
      return () => { try { sb.removeChannel(ch); } catch (e) {} };
    },

    // sala de tempo real de UM duelo: presença (quem está conectado) + broadcast
    liveRoom(id, handlers) {
      handlers = handlers || {};
      if (!online) return { send() {}, leave() {}, present: () => [] };
      const ch = sb.channel('live-duel-' + id, { config: { presence: { key: uid } } });
      ch.on('presence', { event: 'sync' }, () => {
        const keys = Object.keys(ch.presenceState() || {});
        handlers.onPresence && handlers.onPresence(keys);
      });
      ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        handlers.onLeave && handlers.onLeave((leftPresences || []).map((p) => p.user || p.key));
      });
      ['ready', 'go', 'progress', 'done', 'rematch'].forEach((ev) => {
        ch.on('broadcast', { event: ev }, ({ payload }) => {
          handlers.onMsg && handlers.onMsg(ev, payload || {});
        });
      });
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try { await ch.track({ user: uid, name: uname, avatar: uavatar }); } catch (e) {}
          handlers.onReady && handlers.onReady();
        }
      });
      return {
        send: (event, payload) => { try { ch.send({ type: 'broadcast', event, payload: payload || {} }); } catch (e) {} },
        present: () => Object.keys(ch.presenceState() || {}),
        leave: () => { try { sb.removeChannel(ch); } catch (e) {} },
      };
    },
  };

  // ═══════════════ OnlineParty (sala "Conhecimento é Poder": telão + celulares) ═══════════════
  const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I,O,0,1
  const randCode = () => Array.from({ length: 4 }, () => CODE_ALPHA[Math.floor(Math.random() * CODE_ALPHA.length)]).join('');

  window.OnlineParty = {
    available: true,
    // id do participante: uid se logado, senão um id de convidado estável na aba
    myPid() {
      if (uid) return uid;
      let g = null;
      try { g = sessionStorage.getItem('dg_guestpid'); } catch (e) {}
      if (!g) { g = 'g-' + Math.random().toString(36).slice(2, 9); try { sessionStorage.setItem('dg_guestpid', g); } catch (e) {} }
      return g;
    },
    myName: () => uname,
    myAvatar: () => uavatar,
    isLogged: () => !!uid,

    async createRoom(config) {
      if (!online || !uid) return { error: 'Precisa estar logado pra criar a sala.' };
      for (let i = 0; i < 6; i++) {
        const code = randCode();
        const { data, error } = await sb.from('party_rooms')
          .insert({ code, host_user: uid, host_name: uname, config: config || {} })
          .select().single();
        if (!error) return { ok: true, code, id: data.id };
        if (/party_rooms/.test(error.message)) return { error: 'A sala em grupo ainda não foi ativada no servidor.' };
        if (!/duplicate|unique/i.test(error.message)) return { error: error.message };
      }
      return { error: 'Não deu pra criar a sala. Tenta de novo.' };
    },
    async findRoom(code) {
      code = (code || '').trim().toUpperCase();
      if (!code) return null;
      const cli = sbAnon();
      const { data } = await cli.from('party_rooms').select('id,code,host_name,status,config')
        .eq('code', code).neq('status', 'closed').maybeSingle();
      return data || null;
    },
    async setRoomStatus(id, status, results) {
      if (!online || !uid) return;
      const patch = { status };
      if (results !== undefined) patch.results = results;
      try { await sb.from('party_rooms').update(patch).eq('id', id); } catch (e) {}
    },

    // canal de tempo real da sala. handlers: onPresence(list) / onLeave(pids) / onMsg(ev,payload)
    // events broadcast: lobby, config, start, question, tick, lock, reveal, sabotage-open,
    //                   sabotage-cast, sabotage-hit, scoreboard, gameover, answer, bye
    joinChannel(code, me, handlers) {
      code = (code || '').trim().toUpperCase();
      handlers = handlers || {};
      const cli = uid ? sb : sbAnon();
      const pid = this.myPid();
      const ch = cli.channel('party-' + code, {
        config: { presence: { key: pid }, broadcast: { self: false } },
      });
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState() || {};
        const list = Object.keys(st).map((k) => {
          const p = (st[k] && st[k][0]) || {};
          return { pid: k, name: p.name, avatar: p.avatar, role: p.role };
        });
        handlers.onPresence && handlers.onPresence(list);
      });
      ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        handlers.onLeave && handlers.onLeave((leftPresences || []).map((p) => p.presence_ref ? p.key : (p.key || p.pid)));
      });
      const EVENTS = ['lobby', 'config', 'start', 'question', 'tick', 'lock', 'reveal',
        'sabotage-open', 'sabotage-cast', 'sabotage-hit', 'scoreboard', 'gameover', 'answer', 'bye'];
      EVENTS.forEach((ev) => ch.on('broadcast', { event: ev }, ({ payload }) => {
        handlers.onMsg && handlers.onMsg(ev, payload || {});
      }));
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try { await ch.track({ name: me.name, avatar: me.avatar, role: me.role, pid }); } catch (e) {}
          handlers.onReady && handlers.onReady();
        }
      });
      return {
        pid,
        send: (event, payload) => { try { ch.send({ type: 'broadcast', event, payload: payload || {} }); } catch (e) {} },
        present: () => {
          const st = ch.presenceState() || {};
          return Object.keys(st).map((k) => ({ pid: k, ...((st[k] && st[k][0]) || {}) }));
        },
        leave: () => { try { cli.removeChannel(ch); } catch (e) {} },
      };
    },
  };
})();
