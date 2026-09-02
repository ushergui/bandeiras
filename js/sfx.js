/* ═══════════════════════════════════════════════════════
   SFX — efeitos sonoros do Detetive Global
   UI: pacote Kenney "Interface Sounds" (CC0)
   Feedback de jogo: sintetizados (tools/make_sfx.py)
   ═══════════════════════════════════════════════════════ */
window.SFX = (function () {
  const BASE = 'assets/audio/effects/';

  const FILES = {
    // ---- interface (Kenney CC0) ----
    click: 'ui/click.mp3',
    tap: 'ui/tap.mp3',
    back: 'ui/back.mp3',
    toggle: 'ui/toggle.mp3',
    tick: 'ui/tick.mp3',
    card_flip: 'ui/card_flip.mp3',
    modal_open: 'ui/modal_open.mp3',
    modal_close: 'ui/modal_close.mp3',
    error_soft: 'ui/error_soft.mp3',
    // ---- feedback de jogo (sintetizados) ----
    correct: 'sfx/correct.mp3',
    wrong: 'sfx/wrong.mp3',
    streak: 'sfx/streak.mp3',
    levelup: 'sfx/levelup.mp3',
    victory: 'sfx/victory.mp3',
    defeat: 'sfx/defeat.mp3',
    coin: 'sfx/coin.mp3',
    whoosh: 'sfx/whoosh.mp3',
    pack_tear: 'sfx/pack_tear.mp3',
    reveal_common: 'sfx/reveal_common.mp3',
    reveal_rare: 'sfx/reveal_rare.mp3',
    reveal_legend: 'sfx/reveal_legend.mp3',
    sticker_paste: 'sfx/sticker_paste.mp3',
    achievement: 'sfx/achievement.mp3',
    trade: 'sfx/trade.mp3',
    card_match: 'ui/card_match.mp3',
  };

  const VOL = {
    click: 0.30, tap: 0.28, back: 0.32, toggle: 0.30, tick: 0.45,
    card_flip: 0.35, card_match: 0.55, modal_open: 0.35, modal_close: 0.32,
    whoosh: 0.35, correct: 0.6, wrong: 0.55, streak: 0.5, levelup: 0.6,
    victory: 0.65, defeat: 0.55, coin: 0.55, pack_tear: 0.6,
    reveal_common: 0.5, reveal_rare: 0.6, reveal_legend: 0.7,
    sticker_paste: 0.5, achievement: 0.65, trade: 0.55, error_soft: 0.4,
  };

  // sons "bruscos" silenciados no modo calmo
  const CALM_MUTE = new Set(['wrong', 'defeat', 'error_soft', 'pack_tear']);

  const cache = {};
  let enabled = true;
  try { enabled = localStorage.getItem('dg_sfx') !== 'off'; } catch (e) {}
  let calm = false;
  let unlocked = false;

  function base(key) {
    if (!cache[key]) {
      const a = new Audio(BASE + FILES[key]);
      a.preload = 'auto';
      cache[key] = a;
    }
    return cache[key];
  }

  function play(key, opts) {
    opts = opts || {};
    if (!enabled || !FILES[key]) return;
    if (calm && CALM_MUTE.has(key)) return;
    try {
      const a = base(key).cloneNode(true);
      a.volume = Math.min(1, (VOL[key] != null ? VOL[key] : 0.6) * (opts.vol || 1));
      const p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  // destrava o áudio no 1º toque (política de autoplay dos navegadores)
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      const a = base('tap').cloneNode(true);
      a.volume = 0;
      const p = a.play();
      if (p && p.then) p.then(function () { a.pause(); }).catch(function () {});
    } catch (e) {}
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, unlock, { once: true, passive: true });
  });

  // clique sonoro automático nos controles comuns
  document.addEventListener('click', function (e) {
    const el = e.target.closest(
      'button, .mode-button, .setup-opt, .nav-item, .continent-tab, .auth-tab, .trade-account, .trade-chip, .album-card.collected'
    );
    if (!el || el.dataset.nosfx != null || el.disabled) return;
    if (el.classList.contains('setup-back') || el.classList.contains('trades-back') ||
        el.id === 'setup-back' || el.classList.contains('back-button') ||
        el.classList.contains('game-exit') || el.id === 'change-profile-btn') {
      play('back');
    } else {
      play('tap');
    }
  }, true);

  return {
    play: play,
    preload: function () {
      Object.keys(FILES).forEach(function (k) { try { base(k); } catch (e) {} });
    },
    get enabled() { return enabled; },
    set enabled(v) {
      enabled = !!v;
      try { localStorage.setItem('dg_sfx', v ? 'on' : 'off'); } catch (e) {}
    },
    set calm(v) { calm = !!v; },
    get calm() { return calm; },
  };
})();
