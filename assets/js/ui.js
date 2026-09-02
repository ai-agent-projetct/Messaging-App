/* ===== iThrive — UI kit (avatars, modals, menus, toasts, pickers) ===== */
(function (g) {
  const UI = {};
  const modalRoot = () => document.getElementById('modal-root');
  const menuRoot = () => document.getElementById('menu-root');
  const toastRoot = () => document.getElementById('toast-root');

  /* ------------------------------------------------------------------ */
  /* Avatars                                                            */
  /* ------------------------------------------------------------------ */
  UI.avatar = function (person, size, opts) {
    opts = opts || {};
    const p = typeof person === 'string' ? Store.person(person) : person;
    size = size || 36;
    const pres = opts.presence === false ? '' :
      '<i class="presence ' + (p.suspended ? 'offline' : (p.presence || 'offline')) + '"></i>';
    const shape = opts.square ? '' : ' round';
    const fs = Math.max(9, Math.round(size * 0.38));
    return '<span class="avatar' + shape + (opts.cls ? ' ' + opts.cls : '') + '" style="width:' + size + 'px;height:' + size + 'px" data-person="' + U.attr(p.id) + '">' +
      '<span class="av-img" style="background:' + U.avColor(p.id + p.name) + ';font-size:' + fs + 'px">' + U.esc(U.initials(p.name)) + '</span>' +
      pres + '</span>';
  };

  UI.avatarStack = function (ids, max, size) {
    max = max || 4; size = size || 24;
    const shown = ids.slice(0, max), rest = ids.length - shown.length;
    let h = '<span class="avatar-stack">';
    shown.forEach(id => { h += UI.avatar(id, size, { presence: false }); });
    if (rest > 0) h += '<span class="more" style="width:' + size + 'px;height:' + size + 'px">+' + rest + '</span>';
    return h + '</span>';
  };

  UI.convAvatar = function (c, size) {
    size = size || 36;
    if (c.kind === 'dm') return UI.avatar(c.peerId, size);
    if (c.kind === 'group') {
      return '<span class="avatar round" style="width:' + size + 'px;height:' + size + 'px">' +
        '<span class="av-img" style="background:' + U.avColor(c.id) + ';font-size:' + Math.round(size * 0.44) + 'px">' + (c.emoji || '💬') + '</span></span>';
    }
    return '<span class="ci-hash" style="width:' + size + 'px;height:' + size + 'px">' + icon(UI.channelIcon(c)) + '</span>';
  };

  UI.channelIcon = function (c) {
    if (!c) return 'hash';
    if (c.archived) return 'archive';
    if (c.type === 'announcement') return 'megaphone';
    if (c.type === 'private') return 'lock';
    if (c.type === 'project') return 'target';
    if (c.type === 'department') return 'building';
    if (c.type === 'temporary') return 'clock';
    return 'hash';
  };

  const PRESENCE_LABEL = {
    available: 'Available', busy: 'Busy', meeting: 'In a meeting',
    away: 'Away', dnd: 'Do not disturb', offline: 'Offline'
  };
  UI.presenceLabel = (p) => PRESENCE_LABEL[p] || 'Offline';
  UI.presenceDot = (p) => '<i class="pres-dot ' + (p || 'offline') + '"></i>';

  /* ------------------------------------------------------------------ */
  /* Toasts                                                             */
  /* ------------------------------------------------------------------ */
  const TOAST_ICON = { success: 'checkCircle', error: 'alertCircle', warn: 'alertTriangle', info: 'info' };
  UI.toast = function (msg, type, opts) {
    opts = opts || {};
    type = type || 'info';
    const el = U.el('div', { class: 'toast ' + type });
    el.innerHTML = icon(TOAST_ICON[type] || 'info') + '<span>' + U.esc(msg) + '</span>';
    if (opts.action) {
      const b = U.el('button', { class: 't-action' }, U.esc(opts.action));
      b.onclick = () => { opts.onAction && opts.onAction(); close(); };
      el.appendChild(b);
    }
    toastRoot().appendChild(el);
    let tm = setTimeout(close, opts.duration || 3400);
    function close() { clearTimeout(tm); el.classList.add('leaving'); setTimeout(() => el.remove(), 200); }
    el.addEventListener('click', (e) => { if (!e.target.closest('.t-action')) close(); });
    return close;
  };

  /* ------------------------------------------------------------------ */
  /* Modals                                                             */
  /* ------------------------------------------------------------------ */
  UI.modal = function (cfg) {
    cfg = cfg || {};
    const scrim = U.el('div', { class: 'modal-scrim' });
    const modal = U.el('div', { class: 'modal ' + (cfg.size || '') });
    const head = U.el('div', { class: 'modal-head' });
    if (cfg.icon) head.appendChild(U.el('div', { class: 'mh-icon' }, icon(cfg.icon)));
    const titleWrap = U.el('div', { class: 'grow' });
    titleWrap.innerHTML = '<h3>' + U.esc(cfg.title || '') + '</h3>' + (cfg.sub ? '<div class="sub">' + U.esc(cfg.sub) + '</div>' : '');
    head.appendChild(titleWrap);
    const closeBtn = U.el('button', { class: 'icon-btn', 'aria-label': 'Close' }, icon('x'));
    head.appendChild(closeBtn);

    const body = U.el('div', { class: 'modal-body' });
    if (typeof cfg.body === 'string') body.innerHTML = cfg.body;
    else if (cfg.body) body.appendChild(cfg.body);

    modal.appendChild(head); modal.appendChild(body);

    let footEl = null;
    if (cfg.actions !== false) {
      footEl = U.el('div', { class: 'modal-foot' });
      if (cfg.footLeft) { const l = U.el('div', { class: 'left' }); if (typeof cfg.footLeft === 'string') l.innerHTML = cfg.footLeft; else l.appendChild(cfg.footLeft); footEl.appendChild(l); }
      (cfg.actions || []).forEach(function (a) {
        const b = U.el('button', { class: 'btn ' + (a.variant || '') }, (a.icon ? icon(a.icon) : '') + '<span>' + U.esc(a.label) + '</span>');
        if (a.id) b.dataset.action = a.id;
        b.onclick = function () { if (a.onClick) { const r = a.onClick(api, b); if (r !== false && a.close !== false) close(); } else close(); };
        footEl.appendChild(b);
      });
      if (footEl.children.length) modal.appendChild(footEl);
    }

    scrim.appendChild(modal);
    modalRoot().appendChild(scrim);
    document.body.style.overflow = 'hidden';

    function close() {
      scrim.remove();
      if (!modalRoot().children.length) document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      cfg.onClose && cfg.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', onKey);
    closeBtn.onclick = close;
    scrim.addEventListener('mousedown', function (e) { if (e.target === scrim && cfg.dismissable !== false) close(); });

    const api = { close, body, modal, foot: footEl, scrim, setTitle: (t) => { titleWrap.querySelector('h3').textContent = t; } };
    setTimeout(() => {
      const f = body.querySelector('[data-autofocus], input:not([type=hidden]), textarea');
      if (f && !U.isMobile()) f.focus();
      cfg.onMount && cfg.onMount(api);
    }, 30);
    return api;
  };

  UI.confirm = function (cfg) {
    return new Promise(function (resolve) {
      let resolved = false;
      UI.modal({
        size: 'sm',
        icon: cfg.icon || (cfg.danger ? 'alertTriangle' : 'helpCircle'),
        title: cfg.title || 'Are you sure?',
        body: '<p class="md muted" style="line-height:1.6">' + (cfg.html || U.esc(cfg.body || '')) + '</p>' +
              (cfg.detail ? '<div class="banner warn">' + icon('alertTriangle') + '<div class="b-body">' + U.esc(cfg.detail) + '</div></div>' : ''),
        actions: [
          { label: cfg.cancelLabel || 'Cancel', variant: 'ghost', onClick: () => { resolved = true; resolve(false); } },
          { label: cfg.confirmLabel || 'Confirm', variant: cfg.danger ? 'danger' : 'primary', icon: cfg.confirmIcon, onClick: () => { resolved = true; resolve(true); } }
        ],
        onClose: () => { if (!resolved) resolve(false); }
      });
      const m = modalRoot().lastChild;
      if (cfg.danger) m.querySelector('.mh-icon').style.cssText = 'background:var(--danger-100);color:var(--danger-500)';
    });
  };

  UI.prompt = function (cfg) {
    return new Promise(function (resolve) {
      let done = false;
      const wrap = U.el('div', { class: 'field' });
      wrap.innerHTML = (cfg.label ? '<label>' + U.esc(cfg.label) + '</label>' : '') +
        (cfg.multiline ? '<textarea class="textarea" data-autofocus>' + U.esc(cfg.value || '') + '</textarea>'
                       : '<input class="input" data-autofocus value="' + U.attr(cfg.value || '') + '" placeholder="' + U.attr(cfg.placeholder || '') + '">') +
        (cfg.hint ? '<div class="field-hint">' + U.esc(cfg.hint) + '</div>' : '');
      const api = UI.modal({
        size: 'sm', icon: cfg.icon || 'edit', title: cfg.title || 'Edit', sub: cfg.sub,
        body: wrap,
        actions: [
          { label: 'Cancel', variant: 'ghost', onClick: () => { done = true; resolve(null); } },
          { label: cfg.confirmLabel || 'Save', variant: 'primary', onClick: () => { done = true; resolve(wrap.querySelector('.input,.textarea').value.trim()); } }
        ],
        onClose: () => { if (!done) resolve(null); }
      });
      wrap.querySelector('.input,.textarea').addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !cfg.multiline) { done = true; resolve(this.value.trim()); api.close(); }
      });
    });
  };

  /* ------------------------------------------------------------------ */
  /* Drawer / bottom sheet                                              */
  /* ------------------------------------------------------------------ */
  UI.drawer = function (cfg) {
    const scrim = U.el('div', { class: 'drawer-scrim' });
    const dr = U.el('div', { class: 'drawer' + (U.isMobile() ? ' sheet' : '') });
    dr.innerHTML = '<div class="rp-head"><h4>' + U.esc(cfg.title || '') + '</h4><button class="icon-btn" data-close>' + icon('x') + '</button></div>';
    const body = U.el('div', { class: 'rp-body' });
    if (typeof cfg.body === 'string') body.innerHTML = cfg.body; else if (cfg.body) body.appendChild(cfg.body);
    dr.appendChild(body);
    if (cfg.foot) { const f = U.el('div', { class: 'modal-foot' }); if (typeof cfg.foot === 'string') f.innerHTML = cfg.foot; else f.appendChild(cfg.foot); dr.appendChild(f); }
    modalRoot().appendChild(scrim); modalRoot().appendChild(dr);
    function close() { scrim.remove(); dr.remove(); document.removeEventListener('keydown', k); }
    function k(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', k);
    scrim.onclick = close;
    dr.querySelector('[data-close]').onclick = close;
    cfg.onMount && cfg.onMount({ body, close });
    return { close, body };
  };

  /* ------------------------------------------------------------------ */
  /* Context menus                                                      */
  /* ------------------------------------------------------------------ */
  let openMenu = null;
  UI.closeMenu = function () { if (openMenu) { openMenu.remove(); openMenu = null; document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', menuKey, true); } };
  function outside(e) { if (openMenu && !openMenu.contains(e.target)) UI.closeMenu(); }
  function menuKey(e) {
    if (!openMenu) return;
    if (e.key === 'Escape') { e.stopPropagation(); UI.closeMenu(); return; }
    const items = U.qsa('.menu-item:not([disabled])', openMenu);
    const cur = items.findIndex(i => i.classList.contains('focus'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items.forEach(i => i.classList.remove('focus'));
      const next = e.key === 'ArrowDown' ? (cur + 1) % items.length : (cur - 1 + items.length) % items.length;
      items[next].classList.add('focus'); items[next].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && cur >= 0) { e.preventDefault(); items[cur].click(); }
  }

  UI.menu = function (anchor, items, opts) {
    opts = opts || {};
    UI.closeMenu();
    const m = U.el('div', { class: 'menu' + (opts.cls ? ' ' + opts.cls : '') });
    if (opts.width) m.style.minWidth = opts.width + 'px';
    items.forEach(function (it) {
      if (!it) return;
      if (it.sep) { m.appendChild(U.el('div', { class: 'menu-sep' })); return; }
      if (it.label && it.header) { m.appendChild(U.el('div', { class: 'menu-label' }, U.esc(it.label))); return; }
      const b = U.el('button', { class: 'menu-item' + (it.danger ? ' danger' : '') + (it.on ? ' on' : '') });
      if (it.disabled) b.setAttribute('disabled', '');
      b.innerHTML = (it.icon ? icon(it.icon) : (it.emoji ? '<span style="width:15px;text-align:center">' + it.emoji + '</span>' : '')) +
        '<span class="grow truncate">' + U.esc(it.label) + '</span>' +
        (it.kbd ? '<span class="kbd">' + U.esc(it.kbd) + '</span>' : '') +
        (it.check ? icon('check') : '');
      b.onclick = function (e) { e.stopPropagation(); if (it.keepOpen !== true) UI.closeMenu(); it.onClick && it.onClick(e); };
      m.appendChild(b);
    });
    menuRoot().appendChild(m);

    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: opts.x || 0, top: opts.y || 0, bottom: opts.y || 0, right: opts.x || 0, width: 0, height: 0 };
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let x = opts.align === 'right' ? r.right - mw : r.left;
    let y = r.bottom + 6;
    if (opts.x != null) { x = opts.x; y = opts.y; }
    if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
    if (x < 8) x = 8;
    if (y + mh > window.innerHeight - 8) y = Math.max(8, (opts.y != null ? opts.y : r.top) - mh - 6);
    m.style.left = x + 'px'; m.style.top = y + 'px';
    openMenu = m;
    setTimeout(() => {
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', menuKey, true);
    }, 0);
    return { close: UI.closeMenu, el: m };
  };

  /* ------------------------------------------------------------------ */
  /* Tooltips                                                           */
  /* ------------------------------------------------------------------ */
  let ttEl = null, ttTimer = null;
  function showTip(target) {
    const text = target.getAttribute('data-tip'); if (!text) return;
    ttEl = U.el('div', { class: 'tt' }, U.esc(text));
    document.getElementById('tooltip-root').appendChild(ttEl);
    const r = target.getBoundingClientRect();
    const pos = target.getAttribute('data-tip-pos') || 'bottom';
    let x = r.left + r.width / 2 - ttEl.offsetWidth / 2;
    let y = pos === 'top' ? r.top - ttEl.offsetHeight - 7 : r.bottom + 7;
    if (pos === 'right') { x = r.right + 8; y = r.top + r.height / 2 - ttEl.offsetHeight / 2; }
    if (pos === 'left') { x = r.left - ttEl.offsetWidth - 8; y = r.top + r.height / 2 - ttEl.offsetHeight / 2; }
    ttEl.style.left = U.clamp(x, 6, window.innerWidth - ttEl.offsetWidth - 6) + 'px';
    ttEl.style.top = U.clamp(y, 6, window.innerHeight - ttEl.offsetHeight - 6) + 'px';
  }
  function hideTip() { clearTimeout(ttTimer); if (ttEl) { ttEl.remove(); ttEl = null; } }
  UI.initTooltips = function () {
    document.addEventListener('mouseover', function (e) {
      const t = e.target.closest && e.target.closest('[data-tip]');
      if (!t) return;
      clearTimeout(ttTimer); ttTimer = setTimeout(() => showTip(t), 420);
    });
    document.addEventListener('mouseout', function (e) { if (e.target.closest && e.target.closest('[data-tip]')) hideTip(); });
    document.addEventListener('click', hideTip, true);
    window.addEventListener('scroll', hideTip, true);
  };

  /* ------------------------------------------------------------------ */
  /* States                                                             */
  /* ------------------------------------------------------------------ */
  UI.empty = function (cfg) {
    const acts = (cfg.actions || []).map(function (a, i) {
      return '<button class="btn ' + (a.variant || (i === 0 ? 'primary' : 'ghost')) + '" data-empty-action="' + i + '">' + (a.icon ? icon(a.icon) : '') + U.esc(a.label) + '</button>';
    }).join('');
    return '<div class="empty" data-empty>' +
      '<div class="e-art ' + (cfg.tone || '') + '">' + icon(cfg.icon || 'inbox') + '</div>' +
      '<h4>' + U.esc(cfg.title) + '</h4>' +
      '<p>' + U.esc(cfg.desc || '') + '</p>' +
      (acts ? '<div class="e-actions">' + acts + '</div>' : '') +
      '</div>';
  };
  UI.bindEmpty = function (root, cfg) {
    U.qsa('[data-empty-action]', root).forEach(function (b) {
      b.onclick = () => { const a = (cfg.actions || [])[+b.dataset.emptyAction]; a && a.onClick && a.onClick(); };
    });
  };
  UI.emptyInto = function (node, cfg) { node.innerHTML = UI.empty(cfg); UI.bindEmpty(node, cfg); };

  UI.skeletonList = function (n, opts) {
    opts = opts || {};
    let h = '<div class="sk-wrap" style="padding:' + (opts.pad || '12px 14px') + '">';
    for (let i = 0; i < (n || 6); i++) {
      h += '<div class="sk-row"><div class="sk circle" style="width:' + (opts.av || 36) + 'px;height:' + (opts.av || 36) + 'px"></div>' +
        '<div class="grow"><div class="sk title" style="width:' + (40 + (i * 13) % 45) + '%"></div>' +
        '<div class="sk line sm mt-2" style="width:' + (60 + (i * 7) % 30) + '%"></div></div></div>';
    }
    return h + '</div>';
  };
  UI.skeletonCards = function (n) {
    let h = '<div class="grid grid-auto">';
    for (let i = 0; i < (n || 6); i++) h += '<div class="card pad"><div class="sk box" style="height:80px"></div><div class="sk title mt-3" style="width:70%"></div><div class="sk line sm mt-2" style="width:45%"></div></div>';
    return h + '</div>';
  };
  UI.loading = function (label) {
    return '<div class="empty"><div class="spinner lg"></div><p class="mt-3">' + U.esc(label || 'Loading…') + '</p></div>';
  };

  /* Simulated async load so skeletons are visible and honest */
  UI.withLoading = function (node, render, ms) {
    node.innerHTML = UI.skeletonList(6);
    setTimeout(function () { render(); }, ms == null ? 260 : ms);
  };

  /* ------------------------------------------------------------------ */
  /* Form helpers                                                       */
  /* ------------------------------------------------------------------ */
  UI.field = function (label, inner, hint, req) {
    return '<div class="field"><label>' + U.esc(label) + (req ? ' <span class="req">*</span>' : '') + '</label>' + inner +
      (hint ? '<div class="field-hint">' + U.esc(hint) + '</div>' : '') + '</div>';
  };
  UI.switchRow = function (label, desc, on, key) {
    return '<div class="row between gap-4 setting-row"><div class="grow"><div class="semi md">' + U.esc(label) + '</div>' +
      (desc ? '<div class="tiny muted mt-1">' + U.esc(desc) + '</div>' : '') + '</div>' +
      '<button class="switch' + (on ? ' on' : '') + '" data-switch="' + U.attr(key || '') + '" role="switch" aria-checked="' + !!on + '" aria-label="' + U.attr(label) + '"></button></div>';
  };
  UI.bindSwitches = function (root, onChange) {
    U.qsa('[data-switch]', root).forEach(function (s) {
      s.onclick = function () {
        s.classList.toggle('on');
        s.setAttribute('aria-checked', s.classList.contains('on'));
        onChange && onChange(s.dataset.switch, s.classList.contains('on'), s);
      };
    });
  };
  UI.checkbox = (on) => '<span class="check' + (on ? ' on' : '') + '">' + icon('check') + '</span>';

  /* ------------------------------------------------------------------ */
  /* People picker                                                      */
  /* ------------------------------------------------------------------ */
  UI.peoplePicker = function (opts) {
    opts = opts || {};
    const selected = new Set(opts.selected || []);
    const exclude = new Set(opts.exclude || []);
    const wrap = U.el('div', { class: 'picker' });
    wrap.innerHTML =
      '<div class="picker-chips" data-chips></div>' +
      '<div class="input-wrap">' + icon('search') + '<input class="input" data-search placeholder="' + U.attr(opts.placeholder || 'Search people by name, title or department…') + '"></div>' +
      '<div class="picker-list scroll-y" data-list></div>';
    const chips = wrap.querySelector('[data-chips]');
    const list = wrap.querySelector('[data-list]');
    const search = wrap.querySelector('[data-search]');

    function pool() {
      return Store.people().filter(p => p.id !== Store.state.meId && !exclude.has(p.id));
    }
    function renderChips() {
      const arr = Array.from(selected);
      chips.innerHTML = arr.length ? arr.map(id => {
        const p = Store.person(id);
        return '<span class="chip on" data-chip="' + id + '">' + UI.avatar(id, 18, { presence: false }) + U.esc(p.name) + '<span class="x">' + icon('x') + '</span></span>';
      }).join('') : '<span class="tiny subtle">No one selected yet.</span>';
      U.qsa('[data-chip]', chips).forEach(c => c.onclick = () => { selected.delete(c.dataset.chip); renderChips(); renderList(); opts.onChange && opts.onChange(Array.from(selected)); });
    }
    function renderList() {
      const q = search.value.trim().toLowerCase();
      let items = pool();
      if (q) items = items.filter(p => (p.name + ' ' + p.title + ' ' + Store.dept(p.deptId).name + ' ' + p.email).toLowerCase().includes(q));
      items = items.slice(0, 60);
      if (!items.length) { list.innerHTML = '<div class="pad-16 tiny muted text-center">No people match “' + U.esc(q) + '”.</div>'; return; }
      list.innerHTML = items.map(function (p) {
        const on = selected.has(p.id);
        return '<button class="lrow" data-pick="' + p.id + '">' + UI.checkbox(on) + UI.avatar(p.id, 30) +
          '<span class="grow"><span class="semi md block truncate">' + U.esc(p.name) + '</span>' +
          '<span class="tiny muted truncate">' + U.esc(p.title) + ' · ' + U.esc(Store.dept(p.deptId).name) + '</span></span>' +
          (p.role === 'Guest' || p.role === 'External Collaborator' ? '<span class="badge warning">' + U.esc(p.role === 'Guest' ? 'Guest' : 'External') + '</span>' : '') +
          '</button>';
      }).join('');
      U.qsa('[data-pick]', list).forEach(function (b) {
        b.onclick = function () {
          const id = b.dataset.pick;
          if (selected.has(id)) selected.delete(id); else {
            if (opts.max && selected.size >= opts.max) { UI.toast('You can select up to ' + opts.max + ' people.', 'warn'); return; }
            selected.add(id);
          }
          renderChips(); renderList(); opts.onChange && opts.onChange(Array.from(selected));
        };
      });
    }
    search.addEventListener('input', U.debounce(renderList, 120));
    renderChips(); renderList();
    return { el: wrap, get: () => Array.from(selected), set: (ids) => { selected.clear(); ids.forEach(i => selected.add(i)); renderChips(); renderList(); } };
  };

  /* ------------------------------------------------------------------ */
  /* File chips & previews                                              */
  /* ------------------------------------------------------------------ */
  UI.fileGlyph = function (name, size) {
    const m = U.fileMeta(name);
    size = size || 38;
    return '<span class="file-glyph" style="width:' + size + 'px;height:' + size + 'px;background:' + m.color + '18;color:' + m.color + '">' +
      icon(m.icon) + '<i style="background:' + m.color + '">' + m.label + '</i></span>';
  };
  UI.fileRow = function (f, opts) {
    opts = opts || {};
    return '<div class="file-row" data-file="' + U.attr(f.id) + '">' +
      UI.fileGlyph(f.name) +
      '<div class="grow min0"><div class="semi md truncate">' + U.esc(f.name) + '</div>' +
      '<div class="tiny muted truncate">' + U.esc(Store.person(f.ownerId).first) + ' · ' + U.bytes(f.size) + ' · ' + U.ago(f.modifiedAt) + '</div></div>' +
      (opts.actions === false ? '' : '<div class="file-row-actions">' +
        '<button class="icon-btn sm" data-fact="preview" data-tip="Preview">' + icon('eye') + '</button>' +
        '<button class="icon-btn sm" data-fact="download" data-tip="Download">' + icon('download') + '</button>' +
        '<button class="icon-btn sm" data-fact="more" data-tip="More">' + icon('moreH') + '</button></div>') +
      '</div>';
  };

  /* ------------------------------------------------------------------ */
  /* Misc                                                               */
  /* ------------------------------------------------------------------ */
  UI.segmented = function (opts, active, name) {
    return '<div class="segmented" data-seg="' + U.attr(name || '') + '">' +
      opts.map(o => '<button data-val="' + U.attr(o.value) + '" class="' + (o.value === active ? 'on' : '') + '">' + U.esc(o.label) + '</button>').join('') +
      '</div>';
  };
  UI.bindSegmented = function (root, cb) {
    U.qsa('[data-seg]', root).forEach(function (seg) {
      U.qsa('button', seg).forEach(function (b) {
        b.onclick = function () {
          U.qsa('button', seg).forEach(x => x.classList.remove('on'));
          b.classList.add('on');
          cb(b.dataset.val, seg.dataset.seg);
        };
      });
    });
  };
  UI.tabs = function (items, active) {
    return '<div class="tabs" data-tabs>' + items.map(i =>
      '<button data-tab="' + U.attr(i.id) + '" class="' + (i.id === active ? 'on' : '') + '">' +
      (i.icon ? icon(i.icon) : '') + U.esc(i.label) +
      (i.count != null ? '<span class="count muted">' + i.count + '</span>' : '') + '</button>').join('') + '</div>';
  };
  UI.bindTabs = function (root, cb) {
    U.qsa('[data-tabs] [data-tab]', root).forEach(function (b) {
      b.onclick = function () {
        U.qsa('[data-tab]', b.parentElement).forEach(x => x.classList.remove('on'));
        b.classList.add('on'); cb(b.dataset.tab);
      };
    });
  };

  UI.priorityBadge = function (p) {
    const map = { urgent: ['danger', 'Urgent'], high: ['warning', 'High'], medium: ['info', 'Medium'], low: ['', 'Low'] };
    const m = map[p] || map.medium;
    return '<span class="badge ' + m[0] + '">' + m[1] + '</span>';
  };
  UI.statusBadge = function (s) {
    const map = { todo: ['', 'To Do'], inprogress: ['info', 'In Progress'], review: ['warning', 'Review'], done: ['success', 'Completed'] };
    const m = map[s] || map.todo;
    return '<span class="badge ' + m[0] + '">' + m[1] + '</span>';
  };
  UI.roleBadge = function (r) {
    const map = { 'Owner': 'aurora', 'Super Admin': 'brand', 'Admin': 'brand', 'Manager': 'info', 'Team Lead': 'info', 'Guest': 'warning', 'External Collaborator': 'warning' };
    return '<span class="badge ' + (map[r] || '') + '">' + U.esc(r) + '</span>';
  };

  UI.copyToast = function (text, label) {
    U.copy(text);
    UI.toast(label || 'Copied to clipboard', 'success');
  };

  UI.notImplemented = function (what) {
    UI.toast(what + ' — connected to your workspace backend in production.', 'info');
  };

  g.UI = UI;
})(window);
