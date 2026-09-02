/* ===== iThrive — Global search & command palette ===== */
(function (g) {
  const Search = { open: false, q: '', filter: 'all', results: null };
  let panel = null, input = null, idx = -1;

  const COMMANDS = [
    { label: 'New message', icon: 'edit', kbd: 'N', run: () => Modals.newMessage() },
    { label: 'Create a channel', icon: 'hash', run: () => Modals.createChannel() },
    { label: 'Create a group', icon: 'users', run: () => Modals.createGroup() },
    { label: 'Start an instant meeting', icon: 'video', run: () => Modals.instantMeeting() },
    { label: 'Schedule a meeting', icon: 'calendarPlus', run: () => Modals.scheduleMeeting() },
    { label: 'Create a task', icon: 'tasks', run: () => Modals.createTask() },
    { label: 'Upload a file', icon: 'upload', run: () => Modals.uploadFile() },
    { label: 'Make an announcement', icon: 'megaphone', run: () => Modals.createAnnouncement() },
    { label: 'Ask Thrive AI', icon: 'sparkles', run: () => AIPanel.ask(null) },
    { label: 'Catch me up', icon: 'clock', run: () => AIPanel.catchUp() },
    { label: 'Set your status', icon: 'smile', run: () => Modals.setStatus() },
    { label: 'Toggle dark mode', icon: 'moon', run: () => App.toggleTheme() },
    { label: 'Open settings', icon: 'settings', run: () => App.route('#/settings') },
    { label: 'Open admin dashboard', icon: 'shield', run: () => App.route('#/admin') },
    { label: 'Keyboard shortcuts', icon: 'command', kbd: '?', run: () => Modals.shortcuts() }
  ];

  Search.mount = function (inputEl) {
    input = inputEl;
    input.addEventListener('focus', () => Search.show());
    input.addEventListener('input', U.debounce(() => Search.run(input.value), 140));
    input.addEventListener('keydown', onKey);
  };

  Search.show = function () {
    if (panel) return;
    document.querySelector('.global-search').classList.add('focused');
    panel = U.el('div', { class: 'search-panel' });
    document.getElementById('menu-root').appendChild(panel);
    position();
    Search.run(input.value);
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
    window.addEventListener('resize', position);
  };
  Search.hide = function () {
    if (!panel) return;
    panel.remove(); panel = null; idx = -1;
    document.querySelector('.global-search').classList.remove('focused');
    document.removeEventListener('mousedown', outside, true);
    window.removeEventListener('resize', position);
  };
  function outside(e) {
    if (panel && !panel.contains(e.target) && e.target !== input) Search.hide();
  }
  function position() {
    if (!panel) return;
    const r = input.getBoundingClientRect();
    panel.style.left = Math.max(8, r.left) + 'px';
    panel.style.top = (r.bottom + 8) + 'px';
    panel.style.width = Math.max(420, r.width) + 'px';
  }

  Search.focus = function () {
    input.focus(); input.select();
  };

  function onKey(e) {
    if (e.key === 'Escape') { input.blur(); Search.hide(); return; }
    if (!panel) return;
    const items = U.qsa('[data-sr]', panel);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      idx = e.key === 'ArrowDown' ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
      items.forEach(i => i.classList.remove('on'));
      if (items[idx]) { items[idx].classList.add('on'); items[idx].scrollIntoView({ block: 'nearest' }); }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (items[idx]) items[idx].click();
      else if (input.value.trim()) { Store.addRecentSearch(input.value.trim()); App.route('#/search/' + encodeURIComponent(input.value.trim())); Search.hide(); input.blur(); }
    }
  }

  Search.run = function (q) {
    if (!panel) return;
    Search.q = q = (q || '').trim();
    idx = -1;
    if (!q) { panel.innerHTML = emptyState(); bind(); return; }

    const isCmd = q.startsWith('>');
    if (isCmd) {
      const term = q.slice(1).trim().toLowerCase();
      const cmds = COMMANDS.filter(c => !term || c.label.toLowerCase().includes(term));
      panel.innerHTML = '<div class="sp-section"><div class="panel-title">Commands</div>' +
        (cmds.length ? cmds.map((c, i) => '<button class="sr" data-sr data-cmd="' + COMMANDS.indexOf(c) + '">' +
          '<span class="sr-ic">' + icon(c.icon) + '</span><span class="grow">' + U.esc(c.label) + '</span>' +
          (c.kbd ? '<span class="kbd">' + c.kbd + '</span>' : '') + '</button>').join('')
          : '<div class="tiny muted" style="padding:8px 10px">No command matches.</div>') + '</div>';
      bind(); return;
    }

    const r = AI.search(q);
    Search.results = r;
    let h = '';
    h += '<div class="sp-section"><button class="sr ai" data-sr data-ai="1">' +
      '<span class="sr-ic aurora">' + icon('sparkles') + '</span>' +
      '<span class="grow"><span class="semi md block">Ask Thrive AI: “' + U.esc(q) + '”</span>' +
      '<span class="tiny muted">Get an answer with sources from your workspace</span></span>' + icon('arrowRight') + '</button></div>';

    if (r.parsed.filters.from || r.parsed.filters.in || r.parsed.filters.has) {
      h += '<div class="sp-section"><div class="chip-row">' +
        (r.parsed.filters.from ? '<span class="chip on">' + icon('contacts') + 'from: ' + U.esc(r.parsed.filters.from) + '</span>' : '') +
        (r.parsed.filters.in ? '<span class="chip on">' + icon('hash') + 'in: ' + U.esc(r.parsed.filters.in) + '</span>' : '') +
        (r.parsed.filters.has ? '<span class="chip on">' + icon('paperclip') + 'has: ' + U.esc(r.parsed.filters.has) + '</span>' : '') +
        '</div></div>';
    }

    h += group('People', r.people.slice(0, 3).map(p =>
      row('person:' + p.id, UI.avatar(p, 28), p.name, p.title + ' · ' + Store.dept(p.deptId).name, UI.presenceLabel(p.presence))));
    h += group('Channels & groups', r.channels.concat(r.groups).slice(0, 4).map(c =>
      row('conv:' + c.id, '<span class="sr-ic">' + icon(c.kind === 'channel' ? UI.channelIcon(c) : 'users') + '</span>', Store.convTitle(c), c.topic || c.description || '', U.plural(c.memberIds.length, 'member'))));
    h += group('Messages', r.messages.slice(0, 5).map(x =>
      row('msg:' + x.conv.id + ':' + x.m.id, UI.avatar(x.m.authorId, 28), Store.person(x.m.authorId).name + ' · ' + Store.convTitle(x.conv), highlight(x.m.text, q), U.agoShort(x.m.ts))));
    h += group('Files', r.files.slice(0, 4).map(f =>
      row('file:' + f.id, UI.fileGlyph(f.name, 28), f.name, Store.person(f.ownerId).name + ' · ' + U.bytes(f.size), U.agoShort(f.modifiedAt))));
    h += group('Tasks', r.tasks.slice(0, 3).map(t =>
      row('task:' + t.id, '<span class="sr-ic">' + icon('tasks') + '</span>', t.title, Store.person(t.assigneeId).name + ' · due ' + U.dateShort(t.due), '')));
    h += group('Meetings', r.meetings.slice(0, 3).map(m =>
      row('meeting:' + m.id, '<span class="sr-ic">' + icon('video') + '</span>', m.title, U.dayLabel(m.start) + ' · ' + U.time(m.start), '')));
    h += group('Announcements', r.announcements.slice(0, 2).map(a =>
      row('ann:' + a.id, '<span class="sr-ic">' + icon('megaphone') + '</span>', a.title, Store.person(a.authorId).name + ' · ' + U.ago(a.createdAt), '')));

    if (!r.total) {
      h += '<div class="sp-section">' + UI.empty({
        icon: 'search', tone: 'neutral', title: 'No results for “' + q + '”',
        desc: 'Try a different spelling, or use filters like from:priya, in:#project-apollo or has:file.'
      }) + '</div>';
    } else {
      h += '<div class="sp-foot"><button class="sr" data-sr data-all="1">' + icon('search') +
        '<span class="grow">See all ' + r.total + ' results for “' + U.esc(q) + '”</span><span class="kbd">Enter</span></button></div>';
    }
    panel.innerHTML = h;
    bind();
  };

  function group(title, rows) {
    if (!rows.length) return '';
    return '<div class="sp-section"><div class="panel-title">' + title + '</div>' + rows.join('') + '</div>';
  }
  function row(key, av, title, sub, meta) {
    return '<button class="sr" data-sr data-key="' + U.attr(key) + '">' + av +
      '<span class="grow min0"><span class="semi md block truncate">' + U.esc(title) + '</span>' +
      '<span class="tiny muted block truncate">' + sub + '</span></span>' +
      (meta ? '<span class="tiny subtle">' + U.esc(meta) + '</span>' : '') + '</button>';
  }
  function highlight(text, q) {
    const terms = q.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    let s = U.esc(String(text).slice(0, 140));
    terms.forEach(function (t) {
      try { s = s.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); } catch (e) {}
    });
    return s;
  }

  function emptyState() {
    const recents = Store.state.recentSearches;
    const suggested = ['from:Priya routing', 'in:#project-apollo decision', 'has:file launch', 'benefits enrolment'];
    return '<div class="sp-section"><div class="panel-title">Recent searches</div>' +
      (recents.length ? recents.slice(0, 5).map(s => '<button class="sr" data-sr data-recent="' + U.attr(s) + '">' + icon('clock') +
        '<span class="grow truncate">' + U.esc(s) + '</span><span class="icon-btn sm" data-delr="' + U.attr(s) + '">' + icon('x') + '</span></button>').join('')
        : '<div class="tiny muted" style="padding:6px 10px">Nothing yet — your recent searches will appear here.</div>') +
      '</div>' +
      '<div class="sp-section"><div class="panel-title">Try searching for</div>' +
      suggested.map(s => '<button class="sr" data-sr data-recent="' + U.attr(s) + '">' + icon('search') + '<span class="grow">' + U.esc(s) + '</span></button>').join('') +
      '</div>' +
      '<div class="sp-section"><div class="panel-title">Quick actions</div>' +
      COMMANDS.slice(0, 5).map((c, i) => '<button class="sr" data-sr data-cmd="' + i + '">' +
        '<span class="sr-ic">' + icon(c.icon) + '</span><span class="grow">' + U.esc(c.label) + '</span>' +
        (c.kbd ? '<span class="kbd">' + c.kbd + '</span>' : '') + '</button>').join('') +
      '</div>' +
      '<div class="sp-tip"><span class="kbd">></span> for commands · <span class="kbd">from:</span> <span class="kbd">in:</span> <span class="kbd">has:</span> to filter</div>';
  }

  function bind() {
    U.qsa('[data-cmd]', panel).forEach(b => b.onclick = function () {
      const c = COMMANDS[+b.dataset.cmd]; Search.hide(); input.blur(); input.value = ''; c.run();
    });
    U.qsa('[data-recent]', panel).forEach(b => b.onclick = function (e) {
      if (e.target.closest('[data-delr]')) {
        Store.state.recentSearches = Store.state.recentSearches.filter(x => x !== b.dataset.recent);
        Store.persist(); Search.run(''); return;
      }
      input.value = b.dataset.recent; Search.run(b.dataset.recent);
    });
    const ai = panel.querySelector('[data-ai]');
    if (ai) ai.onclick = function () { const q = Search.q; Search.hide(); input.blur(); AIPanel.ask(null); setTimeout(() => { const qi = document.querySelector('.ai-chat [data-q]'); if (qi) { qi.value = q; document.querySelector('.ai-chat [data-send]').click(); } }, 260); };
    const all = panel.querySelector('[data-all]');
    if (all) all.onclick = function () { Store.addRecentSearch(Search.q); Search.hide(); input.blur(); App.route('#/search/' + encodeURIComponent(Search.q)); };
    U.qsa('[data-key]', panel).forEach(b => b.onclick = function () {
      Store.addRecentSearch(Search.q);
      Search.hide(); input.blur();
      openResult(b.dataset.key);
    });
  }

  function openResult(key) {
    const [kind, a, b] = key.split(':');
    if (kind === 'person') Modals.personProfile(a);
    if (kind === 'conv') App.route('#/messages/' + a);
    if (kind === 'msg') { App.route('#/messages/' + a); setTimeout(() => Chat.highlight(b), 380); }
    if (kind === 'file') Modals.filePreview(a);
    if (kind === 'task') Modals.taskDetail(a);
    if (kind === 'meeting') Modals.meetingDetail(a);
    if (kind === 'ann') App.route('#/announcements');
  }
  Search.openResult = openResult;

  /* ------------------------------------------------------------------ */
  /* Full results page                                                  */
  /* ------------------------------------------------------------------ */
  Search.renderPage = function (main, q) {
    q = decodeURIComponent(q || '');
    const r = AI.search(q);
    const cats = [
      { id: 'all', label: 'All', count: r.total },
      { id: 'messages', label: 'Messages', count: r.messages.length },
      { id: 'people', label: 'People', count: r.people.length },
      { id: 'channels', label: 'Channels', count: r.channels.length },
      { id: 'groups', label: 'Groups', count: r.groups.length },
      { id: 'files', label: 'Files', count: r.files.length },
      { id: 'tasks', label: 'Tasks', count: r.tasks.length },
      { id: 'meetings', label: 'Meetings', count: r.meetings.length },
      { id: 'announcements', label: 'Announcements', count: r.announcements.length }
    ];
    main.className = 'main plain';
    main.innerHTML =
      '<div class="view-head"><div class="vh-main"><h2>' + icon('search') + 'Search</h2>' +
      '<div class="vh-sub">' + r.total + ' results for “' + U.esc(q) + '”</div></div>' +
      '<div class="vh-actions"><button class="btn soft" data-askai>' + icon('sparkles') + 'Ask Thrive AI</button></div></div>' +
      '<div class="view-toolbar">' + cats.map(c => '<button class="chip' + (c.id === Search.filter ? ' on' : '') + '" data-cat="' + c.id + '">' + c.label + (c.count ? ' <b>' + c.count + '</b>' : '') + '</button>').join('') +
      '<span class="divider-v"></span>' +
      '<button class="chip" data-adv>' + icon('filter') + 'Filters</button>' +
      '<button class="chip" data-sort>' + icon('sort') + 'Most relevant</button>' +
      '</div>' +
      '<div class="view-scroll"><div class="view-pad" id="sr-body"></div></div>';

    const body = main.querySelector('#sr-body');
    draw();
    main.querySelector('[data-askai]').onclick = function () {
      AIPanel.ask(null);
      setTimeout(() => { const qi = document.querySelector('.ai-chat [data-q]'); if (qi) { qi.value = q; document.querySelector('.ai-chat [data-send]').click(); } }, 260);
    };
    U.qsa('[data-cat]', main).forEach(b => b.onclick = function () {
      Search.filter = b.dataset.cat;
      U.qsa('[data-cat]', main).forEach(x => x.classList.remove('on'));
      b.classList.add('on'); draw();
    });
    main.querySelector('[data-adv]').onclick = () => advancedFilters(q);
    main.querySelector('[data-sort]').onclick = (e) => UI.menu(e.currentTarget, [
      { label: 'Most relevant', icon: 'target', on: true, onClick: () => draw() },
      { label: 'Newest first', icon: 'clock', onClick: () => { r.messages.sort((a, b2) => new Date(b2.m.ts) - new Date(a.m.ts)); draw(); } },
      { label: 'Oldest first', icon: 'clock', onClick: () => { r.messages.sort((a, b2) => new Date(a.m.ts) - new Date(b2.m.ts)); draw(); } }
    ]);

    function draw() {
      const f = Search.filter;
      if (!r.total) {
        UI.emptyInto(body, {
          icon: 'search', tone: 'neutral', title: 'No results for “' + q + '”',
          desc: 'Check the spelling, use fewer words, or try a filter such as from:priya, in:#project-apollo or has:file.',
          actions: [{ label: 'Ask Thrive AI instead', icon: 'sparkles', onClick: () => AIPanel.ask(null) }]
        });
        return;
      }
      let h = '';
      if ((f === 'all' || f === 'messages') && r.messages.length) {
        h += sec('Messages', r.messages.slice(0, f === 'all' ? 6 : 60).map(function (x) {
          return '<button class="res-card" data-open="msg:' + x.conv.id + ':' + x.m.id + '">' +
            '<div class="row gap-2 mb-2">' + UI.avatar(x.m.authorId, 26) +
            '<span class="semi md">' + U.esc(Store.person(x.m.authorId).name) + '</span>' +
            '<span class="badge">' + U.esc(Store.convTitle(x.conv)) + '</span>' +
            '<span class="tiny subtle" style="margin-left:auto">' + U.esc(U.ago(x.m.ts)) + '</span></div>' +
            '<div class="md text-left">' + highlight(x.m.text, q) + '</div>' +
            ((x.m.files || []).length ? '<div class="tiny muted mt-2">' + icon('paperclip') + U.plural(x.m.files.length, 'attachment') + '</div>' : '') +
            '</button>';
        }).join(''));
      }
      if ((f === 'all' || f === 'people') && r.people.length) {
        h += sec('People', '<div class="grid grid-auto">' + r.people.slice(0, f === 'all' ? 4 : 60).map(p =>
          '<button class="res-card person" data-open="person:' + p.id + '"><div class="row gap-3">' + UI.avatar(p, 40) +
          '<div class="grow min0 text-left"><div class="semi md truncate">' + U.esc(p.name) + '</div>' +
          '<div class="tiny muted truncate">' + U.esc(p.title) + '</div>' +
          '<div class="tiny subtle truncate">' + U.esc(Store.dept(p.deptId).name) + ' · ' + U.esc(p.location) + '</div></div></div></button>').join('') + '</div>');
      }
      if ((f === 'all' || f === 'channels') && r.channels.length) {
        h += sec('Channels', '<div class="grid grid-auto">' + r.channels.map(c =>
          '<button class="res-card" data-open="conv:' + c.id + '"><div class="row gap-2 mb-1">' + icon(UI.channelIcon(c)) +
          '<span class="semi md">#' + U.esc(c.name) + '</span></div>' +
          '<div class="tiny muted text-left clamp-2">' + U.esc(c.topic || 'No topic') + '</div>' +
          '<div class="tiny subtle mt-2">' + U.plural(c.memberIds.length, 'member') + '</div></button>').join('') + '</div>');
      }
      if ((f === 'all' || f === 'groups') && r.groups.length) {
        h += sec('Groups', '<div class="grid grid-auto">' + r.groups.map(c =>
          '<button class="res-card" data-open="conv:' + c.id + '"><div class="row gap-2 mb-1">' + (c.emoji || '💬') +
          '<span class="semi md">' + U.esc(c.name) + '</span></div>' +
          '<div class="tiny muted text-left clamp-2">' + U.esc(c.description || '') + '</div></button>').join('') + '</div>');
      }
      if ((f === 'all' || f === 'files') && r.files.length) {
        h += sec('Files', '<div class="mini-list card">' + r.files.map(x => UI.fileRow(x)).join('') + '</div>');
      }
      if ((f === 'all' || f === 'tasks') && r.tasks.length) {
        h += sec('Tasks', '<div class="mini-list card">' + r.tasks.map(t =>
          '<button class="lrow" data-open="task:' + t.id + '">' + icon('tasks') +
          '<span class="grow min0 text-left"><span class="semi md block truncate">' + U.esc(t.title) + '</span>' +
          '<span class="tiny muted">' + U.esc(Store.person(t.assigneeId).name) + ' · due ' + U.esc(U.dateShort(t.due)) + '</span></span>' +
          UI.statusBadge(t.status) + '</button>').join('') + '</div>');
      }
      if ((f === 'all' || f === 'meetings') && r.meetings.length) {
        h += sec('Meetings', '<div class="mini-list card">' + r.meetings.map(m =>
          '<button class="lrow" data-open="meeting:' + m.id + '">' + icon('video') +
          '<span class="grow min0 text-left"><span class="semi md block truncate">' + U.esc(m.title) + '</span>' +
          '<span class="tiny muted">' + U.esc(U.dayLabel(m.start)) + ' · ' + U.esc(U.time(m.start)) + ' · ' + U.plural(m.participantIds.length, 'participant') + '</span></span></button>').join('') + '</div>');
      }
      if ((f === 'all' || f === 'announcements') && r.announcements.length) {
        h += sec('Announcements', '<div class="mini-list card">' + r.announcements.map(a =>
          '<button class="lrow" data-open="ann:' + a.id + '">' + icon('megaphone') +
          '<span class="grow min0 text-left"><span class="semi md block truncate">' + U.esc(a.title) + '</span>' +
          '<span class="tiny muted">' + U.esc(Store.person(a.authorId).name) + ' · ' + U.esc(U.ago(a.createdAt)) + '</span></span></button>').join('') + '</div>');
      }
      body.innerHTML = h || UI.empty({ icon: 'search', title: 'Nothing in this category', desc: 'Try “All” to see every result.', tone: 'neutral' });
      U.qsa('[data-open]', body).forEach(b => b.onclick = () => openResult(b.dataset.open));
      U.qsa('[data-file]', body).forEach(function (r2) {
        r2.onclick = function (e) {
          const a = e.target.closest('[data-fact]');
          if (!a || a.dataset.fact === 'preview') return Modals.filePreview(r2.dataset.file);
          if (a.dataset.fact === 'download') Modals.downloadFile(r2.dataset.file);
          if (a.dataset.fact === 'more') Modals.fileMenu(a, r2.dataset.file);
        };
      });
    }
    function sec(title, inner) {
      return '<div class="mb-6"><div class="section-title"><h4>' + title + '</h4></div>' + inner + '</div>';
    }
  };

  function advancedFilters(q) {
    const body = U.el('div', { class: 'col gap-4' });
    body.innerHTML =
      UI.field('From', '<select class="select" data-f-from><option value="">Anyone</option>' + Store.people().map(p => '<option value="' + p.name + '">' + U.esc(p.name) + '</option>').join('') + '</select>') +
      UI.field('In', '<select class="select" data-f-in><option value="">Anywhere</option>' + Store.convs().filter(c => c.kind === 'channel').map(c => '<option value="' + c.name + '">#' + U.esc(c.name) + '</option>').join('') + '</select>') +
      UI.field('Contains', '<select class="select" data-f-has><option value="">Anything</option><option value="file">A file</option><option value="link">A link</option><option value="image">An image</option></select>') +
      '<div class="row gap-3">' +
      UI.field('After', '<input class="input" type="date" data-f-after>') +
      UI.field('Before', '<input class="input" type="date" data-f-before>') +
      '</div>';
    UI.modal({
      icon: 'filter', title: 'Advanced search filters', body: body,
      actions: [{ label: 'Reset', variant: 'ghost', close: false, onClick: () => U.qsa('select,input', body).forEach(i => i.value = '') },
      { label: 'Apply', variant: 'primary', onClick: function () {
        let nq = q.replace(/\b(from|in|has):\S+/g, '').trim();
        const from = body.querySelector('[data-f-from]').value;
        const inn = body.querySelector('[data-f-in]').value;
        const has = body.querySelector('[data-f-has]') ? body.querySelector('[data-f-has]').value : '';
        if (from) nq += ' from:' + from.split(' ')[0];
        if (inn) nq += ' in:#' + inn;
        if (has) nq += ' has:' + has;
        App.route('#/search/' + encodeURIComponent(nq.trim()));
      } }]
    });
  }

  g.Search = Search;
})(window);
