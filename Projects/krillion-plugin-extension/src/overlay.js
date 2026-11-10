// Floating suggestion window, styled after krillion.io (VT323, abyss navy panels,
// pixel-cut buttons, cyan accent, the game's tier colours).
// Lives in a closed shadow root attached to <html>, so neither the page's CSS nor
// its React tree can touch it, and it never ends up in document.body.textContent.
(function (root) {
  const TIER_COLORS = {
    plankton: '#8fa3c4',
    schooler: '#4de3ff',
    rare: '#ff5252',
    deepcut: '#9d7bff',
    krillion: '#ffd166',
  };

  // The app's pixel-corner clip, scaled down for small controls.
  const PIXEL = `polygon(0 4px,2px 4px,2px 2px,4px 2px,4px 0,calc(100% - 4px) 0,calc(100% - 4px) 2px,calc(100% - 2px) 2px,calc(100% - 2px) 4px,100% 4px,100% calc(100% - 4px),calc(100% - 2px) calc(100% - 4px),calc(100% - 2px) calc(100% - 2px),calc(100% - 4px) calc(100% - 2px),calc(100% - 4px) 100%,4px 100%,4px calc(100% - 2px),2px calc(100% - 2px),2px calc(100% - 4px),0 calc(100% - 4px))`;

  const CSS = `
    :host { all: initial; }
    .win {
      --op: 0.85;
      position: fixed; z-index: 2147483647; width: 300px; max-width: calc(100vw - 16px);
      box-sizing: border-box;
      font-family: VT323, "VT323 Fallback", ui-monospace, monospace;
      font-size: 19px; line-height: 1.1; color: #e8f1ff;
      background: rgba(8, 15, 28, var(--op));
      box-shadow: 0 0 0 2px #060d1a, 0 0 0 4px rgba(125, 147, 184, 0.28), 0 0 40px rgba(0, 0, 0, 0.45);
      -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
      image-rendering: pixelated;
    }
    .win[hidden] { display: none; }
    .bar {
      display: flex; align-items: center; gap: 6px; padding: 6px 8px; cursor: grab; user-select: none;
      border-bottom: 2px solid rgba(125, 147, 184, 0.22);
      text-transform: uppercase; letter-spacing: 0.14em; font-size: 17px;
    }
    .bar.dragging { cursor: grabbing; }
    .title { color: #4de3ff; }
    .src { flex: 1; min-width: 0; color: #7d93b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    button {
      font: inherit; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border: 0; border-radius: 0;
      color: #dbe5f5; padding: 2px 7px; clip-path: ${PIXEL};
      background: linear-gradient(#24365a 0 3px, #101d33 3px calc(100% - 3px), #070d1a calc(100% - 3px) 100%);
    }
    button:hover { color: #4de3ff; }
    button:active { transform: translateY(1px); }
    button:focus-visible { outline: 2px solid #4de3ff; outline-offset: 1px; }
    .body { padding: 8px 10px 10px; max-height: 62vh; overflow-y: auto; }
    .win.collapsed .body { display: none; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
    .chips[hidden] { display: none; }
    .chips button { min-width: 26px; padding: 1px 4px; }
    .chips button.on { color: #050a14; background: #4de3ff; }
    .q { margin: 0 0 8px; color: #e8f1ff; }
    .list { list-style: none; margin: 0; padding: 0; }
    .list li {
      display: flex; align-items: center; gap: 8px; padding: 3px 6px; cursor: pointer;
      border-left: 2px solid transparent; position: relative;
    }
    .list li:hover { background: rgba(77, 227, 255, 0.12); border-left-color: #4de3ff; }
    .dot { flex: none; width: 8px; height: 8px; background: #3d4f6e; }
    .word { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tier { flex: none; font-size: 15px; letter-spacing: 0.12em; text-transform: uppercase; color: #7d93b8; }
    .list li.copied .tier { color: #4de3ff; }
    .status { margin: 6px 0 0; color: #7d93b8; letter-spacing: 0.08em; }
    .status:empty { display: none; }
    .status.loading::after { content: "..."; animation: blink 0.9s steps(3, end) infinite; }
    .status.error { color: #ff5d8f; }
    /* "playing as <name>": a quiet sign the extension knows whose game this is */
    .me { margin: 8px 0 0; text-align: right; font-size: 15px; letter-spacing: 0.1em; color: #7d93b8; opacity: 0.8; animation: hello 0.8s ease-out; }
    .me[hidden] { display: none; }
    .me::before { content: ""; display: inline-block; width: 6px; height: 6px; margin-right: 7px; vertical-align: middle; background: #4de3ff; }
    .me b { font-weight: 400; color: #e8f1ff; }
    @keyframes hello { from { opacity: 0; } to { opacity: 0.8; } }
    /* a short-lived note, e.g. "game over: learning from it" */
    .flash { margin: 8px 0 0; padding: 4px 6px; font-size: 16px; letter-spacing: 0.06em; color: #e8f1ff; border-left: 2px solid #4de3ff; background: rgba(77, 227, 255, 0.1); }
    .flash[hidden] { display: none; }
    .foot { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .foot button[hidden] { display: none; }
    .foot button:disabled { opacity: 0.45; cursor: default; transform: none; color: #dbe5f5; }
    /* verdict buttons: tiny, flat, only prominent on hover or once chosen */
    .vb {
      flex: none; width: 20px; padding: 0; line-height: 18px; text-align: center; letter-spacing: 0;
      background: none; clip-path: none; color: #4b5f80;
    }
    .vb:hover { background: none; }
    .vb.yes:hover, .vb.yes.on { color: #4de3ff; }
    .vb.no:hover, .vb.no.on { color: #ff5d8f; }
    .list li.good { border-left-color: #4de3ff; }
    .list li.bad { border-left-color: #ff5d8f; }
    .list li.bad .word { text-decoration: line-through; color: #7d93b8; }
    .list li.bad .dot { opacity: 0.4; }
    .list li.taken .word { color: #7d93b8; }
    @keyframes blink { 0% { opacity: 0.2; } 100% { opacity: 1; } }
  `;

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v);
    }
    for (const kid of kids) if (kid) el.append(kid);
    return el;
  }

  function createOverlay(handlers = {}) {
    const host = document.createElement('div');
    host.id = 'krillion-reader';
    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = CSS;

    const btnRefresh = h('button', { type: 'button', title: 'New batch: replaces the list with fresh answers', text: '↻' });
    const btnMin = h('button', { type: 'button', title: 'Collapse / expand', text: '–' });
    const btnOff = h('button', { type: 'button', title: 'Turn the floating window off (Alt+K brings it back)', text: '×' });
    const src = h('span', { class: 'src' });
    const bar = h('div', { class: 'bar' }, h('span', { class: 'title', text: 'Krillion' }), src, btnRefresh, btnMin, btnOff);

    const chips = h('div', { class: 'chips', hidden: '' });
    const q = h('p', { class: 'q' });
    const list = h('ul', { class: 'list' });
    const status = h('p', { class: 'status' });
    const moreBtn = h('button', { type: 'button', hidden: '', title: 'Add more answers (never repeats what is already listed)', text: '+ more' });
    const rarestBtn = h('button', { type: 'button', hidden: '', title: 'Ask the AI for the single rarest valid answer it can find (adds one row, never repeats)', text: 'find rarest' });
    const cfg = h('button', { type: 'button', hidden: '', text: 'Open settings' });
    const flash = h('p', { class: 'flash', hidden: '' });
    let flashTimer = null;
    const me = h('p', { class: 'me', hidden: '', title: 'Recognised from your Krillion session. Shown only here: never stored, recorded or sent to the AI.' });
    const body = h('div', { class: 'body' }, chips, q, list, status, h('div', { class: 'foot' }, moreBtn, rarestBtn, cfg), flash, me);
    const win = h('div', { class: 'win', hidden: '' }, bar, body);
    shadow.append(style, win);

    let pos = null;
    const mount = () => {
      if (host.isConnected) return;
      (document.documentElement || document).append(host);
    };
    mount();

    // ---- position / drag ----
    const clamp = (x, y) => {
      const r = win.getBoundingClientRect();
      const w = r.width || 300;
      const hgt = r.height || 80;
      return {
        x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - w)),
        y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - Math.min(hgt, 40))),
      };
    };
    const place = () => {
      const p = pos || { x: window.innerWidth - 316, y: 16 };
      const c = clamp(p.x, p.y);
      win.style.left = `${c.x}px`;
      win.style.top = `${c.y}px`;
    };
    window.addEventListener('resize', place);

    let drag = null;
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      const r = win.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      bar.classList.add('dragging');
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!drag) return;
      pos = clamp(e.clientX - drag.dx, e.clientY - drag.dy);
      win.style.left = `${pos.x}px`;
      win.style.top = `${pos.y}px`;
    });
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      bar.classList.remove('dragging');
      if (pos && handlers.onMove) handlers.onMove(pos);
    };
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);

    // ---- buttons ----
    btnRefresh.addEventListener('click', () => handlers.onRefresh && handlers.onRefresh());
    btnMin.addEventListener('click', () => api.setCollapsed(!win.classList.contains('collapsed'), true));
    btnOff.addEventListener('click', () => handlers.onPower && handlers.onPower(false));
    cfg.addEventListener('click', () => handlers.onSettings && handlers.onSettings());
    moreBtn.addEventListener('click', () => handlers.onMore && handlers.onMore());
    rarestBtn.addEventListener('click', () => handlers.onRarest && handlers.onRarest());

    // ---- suggestions ----
    async function copy(li, text) {
      const label = li.querySelector('.tier');
      const old = label.textContent;
      let ok = true;
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {
        ok = false;
      }
      li.classList.add('copied');
      label.textContent = ok ? 'copied' : 'copy failed';
      setTimeout(() => {
        li.classList.remove('copied');
        label.textContent = old;
      }, 900);
    }

    // s = {text, tier, why?, v?, act?, out?, as?}   (as: the game's own term when it accepted this as another one)
    //   tier  the model's predicted rarity (the dot)            v   'good' | 'bad': the player's / the game's verdict
    //   act   the rarity the GAME gave it (the label)            out 'accepted' | 'miss' | 'taken': what the game said
    function item(s) {
      const dot = h('span', { class: 'dot' });
      dot.style.background = TIER_COLORS[s.tier] || '#3d4f6e';
      // "≈": the game accepted it, but recorded a different (canonical) term for it.
      const label = s.out === 'miss' ? 'rejected' : s.out === 'taken' ? 'taken' : `${s.act || s.tier || ''}${s.as ? ' ≈' : ''}${s.dict === 'partial' ? ' ◐' : ''}${s.known && !s.out ? ' ◆' : ''}`.trim();
      const copyOn = !handlers.canCopy || handlers.canCopy(); // off: rows are read-only, so answers get typed by hand
      const hint = [
        s.why,
        s.as ? `Accepted: the game counted it as "${s.as}".` : null,
        s.dict === 'partial' ? 'Dictionary: only part of a word, or a form of one (◐).' : s.dict === 'word' ? 'Dictionary: found.' : null,
        s.out === 'miss' ? 'The game rejected this answer.' : s.out === 'taken' ? 'Valid, but already used this round.' : null,
        s.known ? `◆ The game has accepted this on this prompt before (${s.known}×) and rated it ${s.tier}${s.raw ? `; the AI guessed ${s.raw}` : ''}.` : null,
        !s.known && s.raw ? `The AI guessed ${s.raw}; adjusted to ${s.tier} from how the game has rated its labels so far.` : null,
        s.act ? `You predicted ${s.raw || s.tier || '?'}, the game rated it ${s.act}.` : null,
        copyOn ? 'click to copy' : null,
      ].filter(Boolean).join('  ·  ');
      const yes = h('button', { type: 'button', class: `vb yes${s.v === 'good' ? ' on' : ''}`, title: 'Correct: the game accepted it (click again to undo)', text: '✓' });
      const no = h('button', { type: 'button', class: `vb no${s.v === 'bad' ? ' on' : ''}`, title: 'Wrong: the game rejected it (click again to undo)', text: '✗' });
      const tierEl = h('span', { class: 'tier', text: label });
      if (s.out === 'miss') tierEl.style.color = '#ff5d8f';
      else if (s.act && TIER_COLORS[s.act]) tierEl.style.color = TIER_COLORS[s.act]; // the game's own rating, in its colour
      const li = h(
        'li',
        { class: `${s.v || ''}${s.out === 'taken' ? ' taken' : ''}`.trim(), title: hint },
        dot,
        h('span', { class: 'word', text: s.text }),
        tierEl,
        yes,
        no
      );
      const vote = (v) => (e) => {
        e.stopPropagation(); // a verdict is not a copy
        if (handlers.onVerdict) handlers.onVerdict(s, s.v === v ? null : v);
      };
      yes.addEventListener('click', vote('good'));
      no.addEventListener('click', vote('bad'));
      if (copyOn) li.addEventListener('click', () => copy(li, s.text));
      else li.style.cursor = 'default';
      return li;
    }

    const api = {
      setQuestion({ text, label }) {
        q.textContent = text || '';
        src.textContent = label || '';
        list.replaceChildren();
        status.textContent = '';
        status.className = 'status';
        cfg.hidden = true;
        moreBtn.hidden = true;
        rarestBtn.hidden = true;
      },
      setSuggestions(items) {
        list.replaceChildren(...items.map(item));
      },
      addSuggestion(s) {
        list.append(item(s));
      },
      // kind: 'loading' | 'error' | 'info' | 'ok'
      setStatus(kind, message, { settings = false } = {}) {
        status.className = `status ${kind === 'loading' || kind === 'error' ? kind : ''}`;
        status.textContent = kind === 'ok' ? '' : message || '';
        cfg.hidden = !settings;
      },
      // "+ more" button: visible when AI suggestions are active for this question; busy while a request runs.
      setMore({ visible, busy }) {
        moreBtn.hidden = !visible;
        moreBtn.disabled = !!busy;
        rarestBtn.hidden = !visible;
        rarestBtn.disabled = !!busy;
      },
      // items: [{label}], active: index; onSelect(i). Pass null to hide.
      setChips(items, active, onSelect) {
        if (!items || !items.length) {
          chips.hidden = true;
          chips.replaceChildren();
          return;
        }
        chips.hidden = false;
        chips.replaceChildren(
          ...items.map((it, i) => {
            const b = h('button', { type: 'button', class: i === active ? 'on' : '', title: it.title || '', text: it.label });
            b.addEventListener('click', () => onSelect(i));
            return b;
          })
        );
      },
      // A short note that fades away (default 9 s); a new note replaces it. '' hides it now.
      setFlash(text, ms = 9000) {
        clearTimeout(flashTimer);
        if (!text) {
          flash.hidden = true;
          return;
        }
        flash.textContent = text;
        flash.hidden = false;
        flashTimer = setTimeout(() => (flash.hidden = true), ms);
      },
      // The player's username, or '' to hide it.
      setIdentity(name) {
        if (!name) {
          me.hidden = true;
          me.replaceChildren();
          return;
        }
        me.replaceChildren('playing as ', h('b', { text: name }));
        me.hidden = false;
      },
      setOpacity(v) {
        const n = Number(v);
        win.style.setProperty('--op', String(Number.isFinite(n) ? Math.min(1, Math.max(0.2, n)) : 0.85));
      },
      setPosition(p) {
        pos = p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
        place();
      },
      setCollapsed(on, notify) {
        win.classList.toggle('collapsed', !!on);
        if (notify && handlers.onCollapse) handlers.onCollapse(!!on);
      },
      setVisible(on) {
        mount();
        win.hidden = !on;
        if (on) place();
      },
      isVisible: () => !win.hidden,
    };
    api.setOpacity(0.85);
    return api;
  }

  root.KrillionOverlay = { createOverlay, TIER_COLORS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
