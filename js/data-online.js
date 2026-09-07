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
  });
  const EMAIL_DOMAIN = '@detetiveglobal.app';
  const emailFor = (u) => (u || '').trim().toLowerCase().replace(/\s+/g, '-') + EMAIL_DOMAIN;
  const todayKey = () => new Date().toISOString().slice(0, 10);

  let uid = null, uname = null, uavatar = '🌍';
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
        q.shift(); qSave(q);
      }
      if (!qLoad().length) await pullAll();
    } finally { flushing = false; }
  }

  // ---------- escrita (estado + mirror + push/fila) ----------
  async function put(table, row) {
    row.user_id = uid;
    mirror();
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
      st.progress = {};
      (pr.data || []).forEach((r) => { st.progress[r.code] = mapProg(r); });
      st.stickers = (stk.data || []).map((r) => ({ codigo: r.codigo, colada: r.colada, pilha: r.pilha || [] }));
      if (pk.data) st.packs = { count: pk.data.count, last_daily_at: pk.data.last_daily_at,
        streak_count: pk.data.streak_count, streak_last: pk.data.streak_last };
      st.journey = jr.data ? jr.data.level : 1;
      st.achievements = (ac.data || []).map((r) => r.key);
      st.daily = {};
      (dp.data || []).forEach((r) => {
        st.daily[r.day] = { day: r.day, acertos: r.acertos, masteredToday: r.mastered,
          modes: r.modes || {}, bonus: r.bonus || {} };
      });
      mirror();
    } catch (e) { console.warn('[pullAll]', e); }
  }

  // ---------- sessão ----------
  async function adoptSession(session) {
    if (!session || !session.user) { uid = null; uname = null; return; }
    uid = session.user.id;
    loadMirror();
    // profile (nome/avatar)
    if (online) {
      const { data } = await sb.from('profiles').select('username,avatar').eq('id', uid).maybeSingle();
      if (data) { uname = data.username; uavatar = data.avatar || '🌍'; }
    }
    if (!uname) uname = (session.user.email || '').replace(EMAIL_DOMAIN, '');
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
    if (m.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (m.includes('network') || m.includes('fetch')) return 'Sem internet. Verifique a conexão.';
    return 'Não deu certo. Tente de novo.';
  };

  window.API = {
    async getProfiles() { return []; },
    async createProfile() { return { error: 'indisponível' }; },
    async deleteProfile() {},

    async getProgress() { return st.progress; },
    async saveProgress(_name, data) {
      // upsert só o que mudou
      for (const code of Object.keys(data || {})) {
        const a = data[code], b = st.progress[code];
        if (b && JSON.stringify(a) === JSON.stringify(b)) continue;
        st.progress[code] = a;
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

    async getStickers() { return st.stickers; },
    async saveStickers(_name, arr) {
      const byCode = {}; st.stickers.forEach((s) => (byCode[s.codigo] = s));
      st.stickers = arr;
      for (const s of arr || []) {
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
      return { name: uname, avatar: uavatar };
    },

    async logout() {
      try { await sb.auth.signOut(); } catch (e) {}
      uid = null; uname = null;
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
      await pullAll(); return { ok: true };
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
})();
