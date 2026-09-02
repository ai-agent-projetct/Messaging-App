/* ===== iThrive — Application shell, routing and chrome ===== */
(function (g) {
  const App = {
    state: { view: 'home', cid: null, sub: null, panelOpen: false, panelTab: 'info', thread: null, mobilePane: 'list' }
  };

  const NAV = [
    { id: 'home', label: 'Home', icon: 'home', route: '#/home' },
    { id: 'messages', label: 'Messages', icon: 'chat', route: '#/messages' },
    { id: 'groups', label: 'Groups', icon: 'users', route: '#/groups' },
    { id: 'channels', label: 'Channels', icon: 'hash', route: '#/channels' },
    { sep: true },
    { id: 'meetings', label: 'Meetings', icon: 'video', route: '#/meetings' },
    { id: 'calls', label: 'Calls', icon: 'phone', route: '#/calls' },
    { id: 'files', label: 'Files', icon: 'folder', route: '#/files' },
    { id: 'tasks', label: 'Tasks', icon: 'tasks', route: '#/tasks' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar', route: '#/calendar' },
    { sep: true },
    { id: 'notifications', label: 'Activity', icon: 'bell', route: '#/notifications' },
    { id: 'announcements', label: 'Notices', icon: 'megaphone', route: '#/announcements' },
    { id: 'saved', label: 'Saved', icon: 'bookmark', route: '#/saved' },
    { id: 'contacts', label: 'People', icon: 'contacts', route: '#/contacts' }
  ];

  const CONV_VIEWS = ['messages', 'groups', 'channels'];

  /* ------------------------------------------------------------------ */
  /* Boot                                                               */
  /* ------------------------------------------------------------------ */
  App.boot = function () {
    Store.load();
    App.applyTheme();
    UI.initTooltips();
    bindGlobalKeys();
    window.addEventListener('hashchange', onHash);
    window.addEventListener('resize', U.debounce(() => { if (App.signedIn) App.renderShell(); }, 220));
    window.addEventListener('online', () => { setOffline(false); });
    window.addEventListener('offline', () => { setOffline(true); });

    setTimeout(function () {
      const boot = document.getElementById('boot');
      boot.classList.add('done');
      setTimeout(() => boot.remove(), 500);
      if (U.store.get('session', false)) App.signIn(true, true);
      else Auth.start();
    }, 950);
  };

  App.signIn = function (skipOnboarding, silent) {
    U.store.set('session', true);
    App.signedIn = true;
    document.getElementById('auth-root').hidden = true;
    document.getElementById('auth-root').innerHTML = '';
    document.getElementById('app-root').hidden = false;
    if (!location.hash || location.hash === '#/') location.hash = '#/home';
    onHash();
    if (!Store.state.onboarded && !skipOnboarding) {
      setTimeout(() => Auth.onboarding(function () {
        App.renderShell();
        UI.toast('Welcome to iThrive Messaging. Press Ctrl+K to search anything.', 'success', { duration: 5000 });
      }), 260);
    } else if (!silent) {
      setTimeout(() => UI.toast('Signed in to ' + DATA.ORG.name + '.', 'success'), 400);
    }
  };

  App.signOut = function () {
    UI.confirm({ title: 'Sign out of iThrive?', body: 'You will need to sign in again to reach this workspace.', confirmLabel: 'Sign out' })
      .then(function (ok) {
        if (!ok) return;
        U.store.del('session');
        App.signedIn = false;
        document.getElementById('app-root').hidden = true;
        document.getElementById('app-root').innerHTML = '';
        document.getElementById('overlay-root').innerHTML = '';
        Auth.go('welcome');
        Auth.start();
      });
  };

  /* ------------------------------------------------------------------ */
  /* Theme                                                              */
  /* ------------------------------------------------------------------ */
  App.applyTheme = function () {
    const p = Store.state.prefs;
    const theme = p.theme === 'system'
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : p.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = p.accent || 'jade';
    document.documentElement.dataset.density = p.density || 'default';
    document.documentElement.classList.toggle('no-anim', p.animations === false);
  };
  App.toggleTheme = function () {
    const cur = document.documentElement.dataset.theme;
    Store.setPref('theme', cur === 'dark' ? 'light' : 'dark');
    App.applyTheme();
    UI.toast(cur === 'dark' ? 'Light mode' : 'Dark mode', 'success', { duration: 1200 });
  };
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (Store.state && Store.state.prefs.theme === 'system') App.applyTheme();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Routing                                                            */
  /* ------------------------------------------------------------------ */
  App.route = function (hash) {
    if (location.hash === hash) onHash();
    else location.hash = hash;
  };

  function onHash() {
    if (!App.signedIn) return;
    const parts = (location.hash || '#/home').replace(/^#\//, '').split('/');
    const view = parts[0] || 'home';
    App.state.view = view;
    App.state.sub = parts[1] || null;

    if (CONV_VIEWS.includes(view)) {
      const cid = parts[1] || null;
      if (cid && Store.conv(cid)) {
        App.state.cid = cid;
        Chat.cid = cid;
        Store.markRead(cid);
        App.state.mobilePane = 'main';
      } else {
        App.state.cid = null;
        Chat.cid = null;
        App.state.mobilePane = 'list';
      }
    } else {
      App.state.thread = null;
      App.state.mobilePane = 'main';
    }
    UI.closeMenu();
    App.renderShell();
  }

  /* ------------------------------------------------------------------ */
  /* Shell                                                              */
  /* ------------------------------------------------------------------ */
  App.renderShell = function () {
    const root = document.getElementById('app-root');
    const showSidebar = CONV_VIEWS.includes(App.state.view);
    const mobile = U.isMobile();

    root.innerHTML =
      topbarHTML() +
      '<div class="app-body">' +
      (mobile ? '' : railHTML()) +
      (showSidebar ? '<aside class="sidebar" id="sidebar"></aside>' : '') +
      '<div class="main" id="main"></div>' +
      (App.state.panelOpen || App.state.thread ? '<aside class="rpanel" id="rpanel"></aside>' : '') +
      '</div>' +
      (mobile ? mobileNavHTML() : '') +
      (mobile && CONV_VIEWS.includes(App.state.view) && !App.state.cid ? '<button class="fab" id="fab">' + icon('edit') + '</button>' : '');

    root.dataset.pane = App.state.mobilePane;
    root.classList.toggle('mobile', mobile);
    root.classList.toggle('has-sidebar', showSidebar);

    bindTopbar(root);
    if (!mobile) bindRail(root);
    if (showSidebar) App.renderSidebar();
    App.renderMain();
    if (App.state.panelOpen || App.state.thread) App.renderPanel();
    if (mobile) bindMobileNav(root);
    const fab = root.querySelector('#fab');
    if (fab) fab.onclick = () => Modals.newMessage();
    if (!navigator.onLine) setOffline(true);
  };

  /* ---------------- Topbar ---------------- */
  function topbarHTML() {
    const me = Store.me();
    const ws = DATA.WORKSPACES.find(w => w.id === Store.state.workspaceId) || DATA.WORKSPACES[0];
    const unread = Store.unreadNotifs();
    return '<header class="topbar">' +
      '<div class="tb-left">' +
      '<div class="brand-mark">' + icon('thrive') + '</div>' +
      '<button class="ws-switch" id="ws-switch" data-tip="Switch workspace">' +
      '<span class="ws-logo" style="background:' + ws.color + '">' + ws.short + '</span>' +
      '<span class="grow min0 text-left"><span class="ws-name truncate">' + U.esc(ws.name) + '</span>' +
      '<span class="ws-plan">' + U.esc(ws.plan) + ' · ' + U.esc(ws.role) + '</span></span>' +
      icon('chevronDown') + '</button>' +
      '</div>' +
      '<div class="tb-center"><div class="global-search">' +
      '<span class="gs-icon">' + icon('search') + '</span>' +
      '<input class="gs-input" id="gsearch" placeholder="Search messages, people, files, tasks…" aria-label="Search">' +
      '<span class="gs-kbd"><span class="kbd">Ctrl</span><span class="kbd">K</span></span>' +
      '</div></div>' +
      '<div class="tb-right">' +
      '<button class="tb-btn" data-tb="ai" data-tip="Thrive AI">' + icon('sparkles') + '</button>' +
      '<button class="tb-btn" data-tb="new" data-tip="Quick actions">' + icon('plus') + '</button>' +
      '<button class="tb-btn" data-tb="notifs" data-tip="Notifications">' + icon('bell') +
      (unread ? '<span class="count">' + (unread > 9 ? '9+' : unread) + '</span>' : '') + '</button>' +
      '<button class="tb-btn" data-tb="help" data-tip="Help and shortcuts">' + icon('helpCircle') + '</button>' +
      '<button class="tb-avatar" data-tb="me" data-tip="' + U.attr(me.name) + '">' + UI.avatar(me, 28) + '</button>' +
      '</div></header>';
  }

  function bindTopbar(root) {
    Search.mount(root.querySelector('#gsearch'));
    root.querySelector('#ws-switch').onclick = (e) => workspaceMenu(e.currentTarget);
    U.qsa('[data-tb]', root).forEach(function (b) {
      b.onclick = function (e) {
        const a = b.dataset.tb;
        if (a === 'ai') AIPanel.open();
        if (a === 'new') quickMenu(b);
        if (a === 'notifs') notifPopover(b);
        if (a === 'help') helpMenu(b);
        if (a === 'me') profileMenu(b);
      };
    });
  }

  function workspaceMenu(anchor) {
    const items = [{ label: 'Workspaces', header: true }];
    DATA.WORKSPACES.forEach(function (w) {
      items.push({
        label: w.name + (w.unread ? '  (' + w.unread + ')' : ''),
        emoji: null, icon: w.id === Store.state.workspaceId ? 'checkCircle' : 'building',
        on: w.id === Store.state.workspaceId,
        onClick: () => App.switchWorkspace(w.id)
      });
    });
    items.push({ sep: true },
      { label: 'Organisation dashboard', icon: 'building', onClick: () => App.route('#/org') },
      { label: 'Employee directory', icon: 'contacts', onClick: () => App.route('#/contacts') },
      { label: 'Invite people to ' + DATA.ORG.name, icon: 'userPlus', onClick: () => Modals.inviteUser() });
    if (Store.isAdmin()) items.push({ label: 'Admin dashboard', icon: 'shield', onClick: () => App.route('#/admin') });
    items.push({ sep: true },
      { label: 'Join another workspace', icon: 'plus', onClick: () => Modals.joinWorkspace() },
      { label: 'Create a new organisation', icon: 'building', onClick: () => UI.toast('Creating an organisation opens the setup flow.', 'info') });
    UI.menu(anchor, items, { align: 'left', width: 280 });
  }

  App.switchWorkspace = function (id) {
    if (id === Store.state.workspaceId) { UI.toast('You are already in this workspace.', 'info'); return; }
    const w = DATA.WORKSPACES.find(x => x.id === id);
    UI.toast('Switching to ' + w.name + '…', 'info', { duration: 1200 });
    setTimeout(function () {
      UI.toast(w.name + ' is a demonstration placeholder — the full data set is Northbeam Technologies.', 'warn', { duration: 4000 });
    }, 1200);
  };

  function quickMenu(anchor) {
    UI.menu(anchor, [
      { label: 'Create', header: true },
      { label: 'New message', icon: 'edit', kbd: 'N', onClick: () => Modals.newMessage() },
      { label: 'New group', icon: 'users', onClick: () => Modals.createGroup() },
      { label: 'New channel', icon: 'hash', onClick: () => Modals.createChannel() },
      { sep: true },
      { label: 'Start an instant meeting', icon: 'video', onClick: () => Modals.instantMeeting() },
      { label: 'Schedule a meeting', icon: 'calendarPlus', onClick: () => Modals.scheduleMeeting() },
      { label: 'Start a call', icon: 'phone', onClick: () => Modals.newCall('audio') },
      { sep: true },
      { label: 'Upload a file', icon: 'upload', onClick: () => Modals.uploadFile() },
      { label: 'Create a task', icon: 'tasks', onClick: () => Modals.createTask() },
      { label: 'Make an announcement', icon: 'megaphone', onClick: () => Modals.createAnnouncement() },
      { sep: true },
      { label: 'Ask Thrive AI', icon: 'sparkles', onClick: () => AIPanel.ask(null) }
    ], { align: 'right', width: 250 });
  }

  function helpMenu(anchor) {
    UI.menu(anchor, [
      { label: 'Keyboard shortcuts', icon: 'command', kbd: '?', onClick: () => Modals.shortcuts() },
      { label: 'Help centre', icon: 'lifeBuoy', onClick: () => UI.toast('The help centre opens in your browser.', 'info') },
      { label: 'What is new', icon: 'gift', onClick: () => whatsNew() },
      { label: 'Contact support', icon: 'chat', onClick: () => UI.toast('Support chat opens here in production.', 'info') },
      { sep: true },
      { label: 'Simulate an incoming call', icon: 'phoneIn', onClick: () => Calls.incoming(U.sample(['p10', 'p21', 'p3'])) },
      { label: 'Simulate going offline', icon: 'wifiOff', onClick: () => { setOffline(true); setTimeout(() => setOffline(false), 6000); } },
      { sep: true },
      { label: 'About iThrive Messaging', icon: 'info', onClick: () => App.route('#/settings/about') }
    ], { align: 'right', width: 250 });
  }

  function whatsNew() {
    UI.modal({
      icon: 'gift', title: 'What is new in 3.4', sub: 'Released 18 March 2026', size: 'sm',
      body: '<div class="col gap-3 md">' +
        ['<strong>Thrive AI catch-up</strong> — a prioritised digest of everything you missed, in about forty seconds.',
         '<strong>Action item extraction</strong> — turn commitments in any conversation into assigned tasks.',
         '<strong>Breakout rooms</strong> — split a meeting into smaller groups and bring everyone back.',
         '<strong>Smart file search</strong> — describe a file instead of remembering its name.',
         '<strong>Faster channels</strong> — large channels now scroll about three times faster.']
          .map(t => '<div class="row-start gap-2">' + icon('checkCircle') + '<span>' + t + '</span></div>').join('') + '</div>',
      actions: [{ label: 'Close', variant: 'primary' }]
    });
  }

  function profileMenu(anchor) {
    const me = Store.me();
    const st = Store.state.myStatus;
    const menu = UI.menu(anchor, [], { align: 'right', width: 288 });
    menu.el.innerHTML =
      '<div class="pm-head">' + UI.avatar(me, 44) +
      '<div class="grow min0"><div class="semi md truncate">' + U.esc(me.name) + '</div>' +
      '<div class="tiny muted truncate">' + U.esc(me.title) + '</div></div></div>' +
      '<button class="menu-item status-row" data-pm="status">' + (st.emoji || icon('smile')) +
      '<span class="grow truncate">' + U.esc(st.text || 'Set a status') + '</span>' + icon('chevronRight') + '</button>' +
      '<div class="menu-sep"></div>' +
      '<div class="menu-label">Availability</div>' +
      ['available', 'busy', 'meeting', 'away', 'dnd', 'offline'].map(p =>
        '<button class="menu-item' + (Store.state.myPresence === p ? ' on' : '') + '" data-pres="' + p + '">' +
        '<i class="pres-dot ' + p + '"></i><span class="grow">' + UI.presenceLabel(p) + '</span>' +
        (Store.state.myPresence === p ? icon('check') : '') + '</button>').join('') +
      '<div class="menu-sep"></div>' +
      '<button class="menu-item" data-pm="profile">' + icon('contacts') + '<span class="grow">View my profile</span></button>' +
      '<button class="menu-item" data-pm="settings">' + icon('settings') + '<span class="grow">Settings</span></button>' +
      '<button class="menu-item" data-pm="theme">' + icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon') +
      '<span class="grow">' + (document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode') + '</span><span class="kbd">⇧⌘D</span></button>' +
      '<button class="menu-item" data-pm="dnd">' + icon('moon') + '<span class="grow">Pause notifications</span></button>' +
      (Store.isAdmin() ? '<button class="menu-item" data-pm="admin">' + icon('shield') + '<span class="grow">Admin dashboard</span></button>' : '') +
      '<div class="menu-sep"></div>' +
      '<button class="menu-item danger" data-pm="out">' + icon('logout') + '<span class="grow">Sign out</span></button>';
    U.qsa('[data-pres]', menu.el).forEach(b => b.onclick = function () {
      Store.setPresence(b.dataset.pres); UI.closeMenu(); App.renderShell();
      UI.toast('You are now ' + UI.presenceLabel(b.dataset.pres).toLowerCase() + '.', 'success', { duration: 1600 });
    });
    U.qsa('[data-pm]', menu.el).forEach(b => b.onclick = function () {
      UI.closeMenu();
      const a = b.dataset.pm;
      if (a === 'status') Modals.setStatus();
      if (a === 'profile') Modals.personProfile(Store.state.meId);
      if (a === 'settings') App.route('#/settings');
      if (a === 'theme') App.toggleTheme();
      if (a === 'dnd') Modals.dnd();
      if (a === 'admin') App.route('#/admin');
      if (a === 'out') App.signOut();
    });
  }

  function notifPopover(anchor) {
    const notifs = AI.prioritise(Store.state.notifications).slice(0, 8);
    const menu = UI.menu(anchor, [], { align: 'right', width: 380 });
    menu.el.classList.add('notif-pop');
    menu.el.innerHTML =
      '<div class="np-head"><span class="semi md">Notifications</span>' +
      '<div class="row gap-1"><button class="btn ghost sm" data-np="read">Mark all read</button>' +
      '<button class="icon-btn sm" data-np="settings" data-tip="Preferences">' + icon('sliders') + '</button></div></div>' +
      (notifs.length ? notifs.map(function (n) {
        const meta = NotifsView.TYPE_META[n.type] || NotifsView.TYPE_META.message;
        return '<button class="np-row' + (n.read ? '' : ' unread') + '" data-nid="' + n.id + '">' +
          '<span class="n-ic" style="background:' + meta.color + '18;color:' + meta.color + '">' + icon(meta.icon) + '</span>' +
          UI.avatar(n.actorId, 28) +
          '<span class="grow min0 text-left"><span class="md truncate block"><b>' + U.esc(Store.person(n.actorId).first) + '</b> ' + U.esc(n.text) + '</span>' +
          '<span class="tiny muted truncate block">' + U.esc(n.preview || '') + '</span></span>' +
          '<span class="tiny subtle">' + U.esc(U.agoShort(n.ts)) + '</span></button>';
      }).join('') : '<div class="empty" style="padding:32px"><p class="muted tiny">Nothing new. You are all caught up.</p></div>') +
      '<div class="np-foot"><button class="btn ghost sm block" data-np="all">See all activity' + icon('chevronRight') + '</button></div>';
    U.qsa('[data-nid]', menu.el).forEach(b => b.onclick = function () { UI.closeMenu(); App.openNotification(b.dataset.nid); });
    U.qsa('[data-np]', menu.el).forEach(b => b.onclick = function () {
      const a = b.dataset.np;
      if (a === 'read') { Store.markAllNotifsRead(); UI.closeMenu(); App.renderShell(); UI.toast('All notifications marked as read.', 'success'); }
      if (a === 'all') { UI.closeMenu(); App.route('#/notifications'); }
      if (a === 'settings') { UI.closeMenu(); App.route('#/settings/notifications'); }
    });
  }

  App.openNotification = function (id) {
    const n = Store.state.notifications.find(x => x.id === id);
    if (!n) return;
    Store.markNotifRead(id);
    const t = n.target || {};
    if (t.kind === 'dm' || t.kind === 'channel' || t.kind === 'group') App.route('#/messages/' + t.id);
    else if (t.kind === 'task') Modals.taskDetail(t.id);
    else if (t.kind === 'meeting') Modals.meetingDetail(t.id);
    else if (t.kind === 'file') Modals.filePreview(t.id);
    else if (t.kind === 'announcement') Modals.announcementDetail(t.id);
    else App.route('#/notifications');
    App.renderShell();
  };

  /* ---------------- Rail ---------------- */
  function railHTML() {
    const unreadTotal = Store.totalUnread();
    const dmUnread = Store.convs().filter(c => c.kind === 'dm' && !c.archived).reduce((n, c) => n + c.unread, 0);
    const grpUnread = Store.convs().filter(c => c.kind === 'group' && !c.archived).reduce((n, c) => n + c.unread, 0);
    const chUnread = Store.convs().filter(c => c.kind === 'channel' && !c.archived).reduce((n, c) => n + c.unread, 0);
    const counts = { messages: dmUnread, groups: grpUnread, channels: chUnread, notifications: Store.unreadNotifs() };
    const taskCount = Store.myTasks().filter(t => t.status !== 'done' && new Date(t.due) < Date.now()).length;
    if (taskCount) counts.tasks = taskCount;

    return '<nav class="rail">' + NAV.map(function (n) {
      if (n.sep) return '<span class="rail-sep"></span>';
      const c = counts[n.id];
      return '<button class="rail-item' + (App.state.view === n.id ? ' on' : '') + '" data-nav="' + n.id + '" data-route="' + n.route + '">' +
        icon(n.icon) + '<span>' + n.label + '</span>' +
        (c ? '<span class="count">' + (c > 9 ? '9+' : c) + '</span>' : '') + '</button>';
    }).join('') +
      '<span class="rail-spacer"></span>' +
      (Store.isAdmin() ? '<button class="rail-item' + (App.state.view === 'admin' ? ' on' : '') + '" data-nav="admin" data-route="#/admin">' + icon('shield') + '<span>Admin</span></button>' : '') +
      '<button class="rail-item' + (App.state.view === 'settings' ? ' on' : '') + '" data-nav="settings" data-route="#/settings">' + icon('settings') + '<span>Settings</span></button>' +
      '</nav>';
  }
  function bindRail(root) {
    U.qsa('[data-nav]', root).forEach(b => b.onclick = () => App.route(b.dataset.route));
  }

  /* ---------------- Sidebar ---------------- */
  App.renderSidebar = function () {
    const host = document.getElementById('sidebar');
    if (!host) return;
    const view = App.state.view;
    const titles = { messages: 'Messages', groups: 'Groups', channels: 'Channels' };
    const filters = {
      messages: [['all', 'All'], ['unread', 'Unread'], ['pinned', 'Pinned'], ['guests', 'External']],
      groups: [['all', 'All'], ['unread', 'Unread'], ['private', 'Private'], ['public', 'Public']],
      channels: [['all', 'All'], ['unread', 'Unread'], ['favourites', 'Favourites'], ['projects', 'Projects'], ['archived', 'Archived']]
    }[view];
    App.sbFilter = App.sbFilter || {};
    const active = App.sbFilter[view] || 'all';

    host.innerHTML =
      '<div class="sb-head">' +
      '<div class="sb-title"><h2>' + titles[view] + '</h2>' +
      '<div class="row gap-1">' +
      '<button class="icon-btn" data-sb="ai" data-tip="Catch me up">' + icon('sparkles') + '</button>' +
      '<button class="icon-btn" data-sb="new" data-tip="' + (view === 'messages' ? 'New message' : view === 'groups' ? 'New group' : 'New channel') + '">' + icon('edit') + '</button>' +
      '<button class="icon-btn" data-sb="more" data-tip="More">' + icon('moreH') + '</button>' +
      '</div></div>' +
      '<div class="sb-search">' + icon('search') + '<input class="input" id="sb-q" placeholder="Filter ' + titles[view].toLowerCase() + '"></div>' +
      '<div class="sb-filter">' + filters.map(f => '<button class="chip' + (f[0] === active ? ' on' : '') + '" data-sbf="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>' +
      '</div>' +
      '<div class="sb-body" id="sb-body"></div>';

    drawSidebarList();
    host.querySelector('#sb-q').addEventListener('input', U.debounce(function (e) { App.sbQuery = e.target.value.trim().toLowerCase(); drawSidebarList(); }, 130));
    U.qsa('[data-sbf]', host).forEach(b => b.onclick = function () {
      App.sbFilter[view] = b.dataset.sbf;
      U.qsa('[data-sbf]', host).forEach(x => x.classList.remove('on')); b.classList.add('on');
      drawSidebarList();
    });
    U.qsa('[data-sb]', host).forEach(b => b.onclick = function () {
      const a = b.dataset.sb;
      if (a === 'ai') AIPanel.catchUp();
      if (a === 'new') view === 'messages' ? Modals.newMessage() : view === 'groups' ? Modals.createGroup() : Modals.createChannel();
      if (a === 'more') UI.menu(b, [
        { label: 'Browse all channels', icon: 'hash', onClick: () => Modals.browseChannels() },
        { label: 'Mark everything read', icon: 'check', onClick: () => { Store.convs().forEach(c => Store.markRead(c.id)); App.renderShell(); UI.toast('All conversations marked as read.', 'success'); } },
        { sep: true },
        { label: 'Show archived', icon: 'archive', onClick: () => { App.sbFilter[view] = 'archived'; App.renderSidebar(); } },
        { label: 'Notification preferences', icon: 'sliders', onClick: () => App.route('#/settings/notifications') }
      ], { align: 'right' });
    });
  };

  function drawSidebarList() {
    const body = document.getElementById('sb-body');
    if (!body) return;
    const view = App.state.view;
    const filter = (App.sbFilter && App.sbFilter[view]) || 'all';
    const q = App.sbQuery || '';
    let convs = Store.convs().filter(function (c) {
      if (view === 'messages') return c.kind === 'dm';
      if (view === 'groups') return c.kind === 'group';
      return c.kind === 'channel';
    });
    if (filter === 'archived') convs = convs.filter(c => c.archived);
    else convs = convs.filter(c => !c.archived);
    if (filter === 'unread') convs = convs.filter(c => c.unread > 0);
    if (filter === 'pinned') convs = convs.filter(c => c.pinned);
    if (filter === 'favourites') convs = convs.filter(c => c.favorite);
    if (filter === 'projects') convs = convs.filter(c => c.type === 'project');
    if (filter === 'private') convs = convs.filter(c => c.type === 'private');
    if (filter === 'public') convs = convs.filter(c => c.type === 'public');
    if (filter === 'guests') convs = convs.filter(c => c.kind === 'dm' && ['Guest', 'External Collaborator'].includes(Store.person(c.peerId).role));
    if (q) convs = convs.filter(c => Store.convTitle(c).toLowerCase().includes(q) || (Store.lastMsg(c.id) && (Store.lastMsg(c.id).text || '').toLowerCase().includes(q)));

    convs.sort(function (a, b) {
      const ap = a.pinned || a.favorite ? 1 : 0, bp = b.pinned || b.favorite ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const am = Store.lastMsg(a.id), bm = Store.lastMsg(b.id);
      return new Date(bm ? bm.ts : 0) - new Date(am ? am.ts : 0);
    });

    if (!convs.length) {
      UI.emptyInto(body, {
        icon: q ? 'search' : (view === 'messages' ? 'chat' : view === 'groups' ? 'users' : 'hash'),
        tone: 'neutral',
        title: q ? 'No matches' : filter === 'unread' ? 'Nothing unread' : filter === 'archived' ? 'Nothing archived' : 'Nothing here yet',
        desc: q ? 'Try a different word.' : filter === 'unread' ? 'You have read everything in this list.'
          : view === 'messages' ? 'Start a direct message with anyone in the workspace.'
            : view === 'groups' ? 'Groups are for a set of people rather than a topic.'
              : 'Channels keep a topic and its files in one searchable place.',
        actions: q || filter !== 'all' ? [] : [{
          label: view === 'messages' ? 'New message' : view === 'groups' ? 'Create a group' : 'Create a channel',
          icon: 'plus',
          onClick: () => view === 'messages' ? Modals.newMessage() : view === 'groups' ? Modals.createGroup() : Modals.createChannel()
        }]
      });
      UI.bindEmpty(body, {
        actions: [{ onClick: () => view === 'messages' ? Modals.newMessage() : view === 'groups' ? Modals.createGroup() : Modals.createChannel() }]
      });
      return;
    }

    const pinned = convs.filter(c => c.pinned || c.favorite);
    const rest = convs.filter(c => !(c.pinned || c.favorite));
    let h = '';
    if (pinned.length) h += group(view === 'channels' ? 'Favourites' : 'Pinned', pinned);
    if (rest.length) h += group(pinned.length ? (view === 'channels' ? 'All channels' : 'Recent') : '', rest);
    body.innerHTML = h;

    U.qsa('[data-conv]', body).forEach(function (b) {
      b.onclick = function (e) { if (!e.target.closest('[data-cmenu3]')) App.route('#/' + view + '/' + b.dataset.conv); };
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); convMenu(null, b.dataset.conv, { x: e.clientX, y: e.clientY }); });
    });
    U.qsa('[data-cmenu3]', body).forEach(b => b.onclick = function (e) { e.stopPropagation(); convMenu(b, b.dataset.cmenu3); });
    U.qsa('.sb-group-head', body).forEach(b => b.onclick = () => b.parentElement.classList.toggle('collapsed'));

    function group(title, list) {
      return '<div class="sb-group">' +
        (title ? '<button class="sb-group-head">' + icon('chevronDown', 'caret') + title + '<span class="tiny">' + list.length + '</span></button>' : '') +
        '<div class="sb-group-body">' + list.map(convRow).join('') + '</div></div>';
    }
  }

  function convRow(c) {
    const last = Store.lastMsg(c.id);
    const compact = Store.state.prefs.compactSidebar;
    let sub = '';
    if (last && !compact) {
      const who = last.authorId === Store.state.meId ? 'You' : Store.person(last.authorId).first;
      const body = last.system ? 'updated the conversation'
        : last.deleted ? 'deleted a message'
          : last.text ? last.text
            : (last.files || []).length ? U.plural(last.files.length, 'attachment')
              : last.voice ? 'Voice message' : last.poll ? 'Poll' : 'Attachment';
      sub = (c.kind === 'dm' && last.authorId !== Store.state.meId ? '' : who + ': ') + body;
    }
    return '<button class="conv-item' + (App.state.cid === c.id ? ' on' : '') + (c.unread ? ' unread' : '') + '" data-conv="' + c.id + '">' +
      UI.convAvatar(c, 34) +
      '<span class="ci-main"><span class="ci-top">' +
      '<span class="ci-name">' + U.esc(c.kind === 'channel' ? c.name : c.name) + '</span>' +
      (last ? '<span class="ci-time">' + U.esc(U.agoShort(last.ts)) + '</span>' : '') + '</span>' +
      (sub ? '<span class="ci-sub">' + (c.muted ? icon('moon') : '') + U.esc(sub) + '</span>' : '') +
      '</span>' +
      '<span class="ci-right">' +
      (c.mentions ? '<span class="count">@' + c.mentions + '</span>' : (c.unread ? '<span class="count' + (c.muted ? ' muted' : '') + '">' + c.unread + '</span>' : '')) +
      '<span class="icon-btn sm" data-cmenu3="' + c.id + '">' + icon('moreH') + '</span>' +
      '</span></button>';
  }

  function convMenu(anchor, cid, pos) {
    const c = Store.conv(cid);
    const fav = c.kind === 'channel' ? c.favorite : c.pinned;
    UI.menu(anchor, [
      { label: 'Open', icon: 'externalLink', onClick: () => App.route('#/' + App.state.view + '/' + cid) },
      { label: c.unread ? 'Mark as read' : 'Mark as unread', icon: 'check', onClick: function () {
        if (c.unread) Store.markRead(cid); else { c.unread = 1; Store.persist(); }
        App.renderShell();
      } },
      { label: fav ? (c.kind === 'channel' ? 'Remove from favourites' : 'Unpin') : (c.kind === 'channel' ? 'Add to favourites' : 'Pin to top'), icon: 'star', onClick: () => { Store.toggleFavorite(cid); App.renderSidebar(); } },
      { label: c.muted ? 'Unmute' : 'Mute', icon: 'moon', onClick: () => { Store.toggleMute(cid); App.renderSidebar(); } },
      { sep: true },
      { label: 'Start a call', icon: 'phone', onClick: () => Calls.start({ cid: cid, kind: 'audio' }) },
      { label: 'Start a video call', icon: 'video', onClick: () => Calls.start({ cid: cid, kind: 'video' }) },
      { label: 'Summarise with AI', icon: 'sparkles', onClick: () => AIPanel.summarize(cid) },
      { sep: true },
      c.kind !== 'dm' ? { label: 'Add people', icon: 'userPlus', onClick: () => Modals.addMembers(cid) } : null,
      { label: 'Copy link', icon: 'link', onClick: () => UI.copyToast('https://northbeam.ithrive.app/' + cid, 'Link copied.') },
      { label: c.archived ? 'Unarchive' : 'Archive', icon: 'archive', onClick: () => { Store.archiveConv(cid); App.renderSidebar(); UI.toast(c.archived ? 'Archived.' : 'Restored.', 'success'); } },
      c.kind !== 'dm' ? { label: 'Leave', icon: 'logout', danger: true, onClick: function () {
        UI.confirm({ title: 'Leave ' + Store.convTitle(c) + '?', body: 'You will stop receiving messages from this conversation.', danger: true, confirmLabel: 'Leave' })
          .then(ok => { if (ok) { Store.leaveConv(cid); App.route('#/' + App.state.view); UI.toast('You left ' + Store.convTitle(c) + '.', 'success'); } });
      } } : null
    ].filter(Boolean), Object.assign({ align: 'right', width: 240 }, pos || {}));
  }

  /* ---------------- Main ---------------- */
  App.renderMain = function () {
    const main = document.getElementById('main');
    if (!main) return;
    const v = App.state.view;

    if (CONV_VIEWS.includes(v)) {
      if (App.state.cid) { Chat.cid = App.state.cid; Chat.render(main); }
      else emptyConvPane(main, v);
      return;
    }
    switch (v) {
      case 'home': Home.render(main); break;
      case 'files': FilesView.render(main); break;
      case 'tasks': TasksView.render(main); break;
      case 'calendar': CalendarView.render(main); break;
      case 'meetings': MeetingsView.render(main); break;
      case 'calls': CallsView.render(main); break;
      case 'contacts': PeopleView.render(main); break;
      case 'notifications': NotifsView.render(main); break;
      case 'saved': SavedView.render(main); break;
      case 'announcements': AnnouncementsView.render(main); break;
      case 'settings': SettingsView.render(main, App.state.sub); break;
      case 'admin': AdminView.render(main, App.state.sub); break;
      case 'org': OrgView.render(main); break;
      case 'search': Search.renderPage(main, App.state.sub); break;
      default: notFound(main);
    }
  };

  function emptyConvPane(main, view) {
    main.className = 'main plain';
    const label = view === 'messages' ? 'a conversation' : view === 'groups' ? 'a group' : 'a channel';
    main.innerHTML = '<div class="view-scroll"><div class="view-pad" style="height:100%;display:flex">' + UI.empty({
      icon: view === 'messages' ? 'chat' : view === 'groups' ? 'users' : 'hash',
      title: 'Choose ' + label,
      desc: 'Pick something from the list, or start something new. Everything you post stays searchable for the whole team.',
      actions: [
        { label: view === 'messages' ? 'New message' : view === 'groups' ? 'Create a group' : 'Create a channel', icon: 'plus', onClick: () => view === 'messages' ? Modals.newMessage() : view === 'groups' ? Modals.createGroup() : Modals.createChannel() },
        { label: 'Catch me up', icon: 'sparkles', variant: 'ghost', onClick: () => AIPanel.catchUp() }
      ]
    }) + '</div></div>';
    UI.bindEmpty(main, {
      actions: [
        { onClick: () => view === 'messages' ? Modals.newMessage() : view === 'groups' ? Modals.createGroup() : Modals.createChannel() },
        { onClick: () => AIPanel.catchUp() }
      ]
    });
  }

  function notFound(main) {
    main.className = 'main plain';
    main.innerHTML = '<div class="view-scroll"><div class="view-pad" style="height:100%;display:flex">' + UI.empty({
      icon: 'slash', tone: 'neutral', title: 'Page not found',
      desc: 'That link does not lead anywhere in this workspace. It may have been moved or deleted.',
      actions: [{ label: 'Back to Home', icon: 'home', onClick: () => App.route('#/home') }]
    }) + '</div></div>';
    UI.bindEmpty(main, { actions: [{ onClick: () => App.route('#/home') }] });
  }

  /* ---------------- Right panel ---------------- */
  App.togglePanel = function (open, tab) {
    App.state.thread = null;
    App.state.panelOpen = open == null ? !App.state.panelOpen : open;
    if (tab) App.state.panelTab = tab;
    App.renderShell();
  };
  App.setThread = function (ctx) {
    App.state.thread = ctx;
    if (ctx) App.state.panelOpen = false;
    App.renderShell();
  };
  App.renderPanel = function () {
    const host = document.getElementById('rpanel');
    if (!host) return;
    if (App.state.thread) Threads.render(host, App.state.thread);
    else Chat.panel(host, App.state.panelTab);
  };

  App.openDM = function (peerId) {
    const c = Store.openDM(peerId);
    document.querySelectorAll('.modal-scrim').forEach(s => s.remove());
    document.body.style.overflow = '';
    App.route('#/messages/' + c.id);
  };

  /* ---------------- Mobile ---------------- */
  function mobileNavHTML() {
    const items = [
      { id: 'home', label: 'Home', icon: 'home', route: '#/home' },
      { id: 'messages', label: 'Chats', icon: 'chat', route: '#/messages', count: Store.totalUnread() },
      { id: 'channels', label: 'Channels', icon: 'hash', route: '#/channels' },
      { id: 'meetings', label: 'Meet', icon: 'video', route: '#/meetings' },
      { id: 'more', label: 'More', icon: 'grid', route: null }
    ];
    return '<nav class="mnav">' + items.map(i =>
      '<button class="mnav-item' + (App.state.view === i.id ? ' on' : '') + '" data-mnav="' + i.id + '" data-route="' + (i.route || '') + '">' +
      icon(i.icon) + (i.count ? '<span class="count">' + (i.count > 9 ? '9+' : i.count) + '</span>' : '') +
      '<span>' + i.label + '</span></button>').join('') + '</nav>';
  }
  function bindMobileNav(root) {
    U.qsa('[data-mnav]', root).forEach(b => b.onclick = function () {
      if (b.dataset.mnav === 'more') return moreSheet();
      App.route(b.dataset.route);
    });
  }
  function moreSheet() {
    const items = NAV.filter(n => !n.sep && !['home', 'messages', 'channels', 'meetings'].includes(n.id))
      .concat(Store.isAdmin() ? [{ id: 'admin', label: 'Admin', icon: 'shield', route: '#/admin' }] : [])
      .concat([{ id: 'org', label: 'Organisation', icon: 'building', route: '#/org' }, { id: 'settings', label: 'Settings', icon: 'settings', route: '#/settings' }]);
    const wrap = U.el('div');
    wrap.innerHTML = '<div class="sheet-grid">' + items.map(i =>
      '<button class="sheet-tile" data-ms="' + i.route + '"><span class="st-ic">' + icon(i.icon) + '</span><span class="tiny semi">' + i.label + '</span></button>').join('') + '</div>';
    const d = UI.drawer({ title: 'More', body: wrap });
    U.qsa('[data-ms]', wrap).forEach(b => b.onclick = function () { d.close(); App.route(b.dataset.ms); });
  }

  /* ---------------- Offline banner ---------------- */
  function setOffline(off) {
    let bar = document.getElementById('offline-bar');
    if (off) {
      if (bar) return;
      bar = U.el('div', { class: 'offline-bar', id: 'offline-bar' });
      bar.innerHTML = icon('wifiOff') + '<span class="semi md">You are offline</span>' +
        '<span class="tiny">Messages you send will be queued and delivered when the connection returns.</span>' +
        '<button class="btn sm" data-retry>Retry now</button>';
      document.body.appendChild(bar);
      bar.querySelector('[data-retry]').onclick = function () {
        if (navigator.onLine) { setOffline(false); UI.toast('Back online. Queued messages sent.', 'success'); }
        else UI.toast('Still offline — check your connection.', 'error');
      };
    } else if (bar) {
      bar.remove();
    }
  }

  /* ---------------- Keyboard ---------------- */
  let gPressed = false, gTimer;
  function bindGlobalKeys() {
    document.addEventListener('keydown', function (e) {
      const typing = e.target.matches('input, textarea, [contenteditable]');
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); if (App.signedIn) Search.focus(); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); App.toggleTheme(); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); if (App.signedIn) AIPanel.ask(null); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'u') { e.preventDefault(); if (App.signedIn) AIPanel.catchUp(); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); if (App.signedIn) Modals.newMessage(); return; }
      if (mod && e.key === '/') { e.preventDefault(); Modals.shortcuts(); return; }
      if (typing) return;
      if (e.key === '?') { e.preventDefault(); Modals.shortcuts(); return; }
      if (!App.signedIn) return;

      if (e.key === 'n' || e.key === 'N') { Modals.newMessage(); return; }
      if (e.key === 'Escape') {
        if (App.state.thread) { Threads.close(); return; }
        if (App.state.panelOpen) { App.togglePanel(false); return; }
      }
      if (e.key === 'g' || e.key === 'G') {
        gPressed = true; clearTimeout(gTimer); gTimer = setTimeout(() => gPressed = false, 1200); return;
      }
      if (gPressed) {
        const map = { h: '#/home', m: '#/messages', c: '#/channels', g: '#/groups', t: '#/tasks', f: '#/files', n: '#/notifications', k: '#/calendar', p: '#/contacts', s: '#/settings', a: '#/announcements' };
        const r = map[e.key.toLowerCase()];
        gPressed = false;
        if (r) { e.preventDefault(); App.route(r); }
      }
    });
  }

  /* ---------------- Live badge updates ---------------- */
  Store.on('badges', function () {
    if (!App.signedIn) return;
    const root = document.getElementById('app-root');
    if (!root || root.hidden) return;
    const bell = root.querySelector('[data-tb="notifs"]');
    if (bell) {
      const n = Store.unreadNotifs();
      const c = bell.querySelector('.count');
      if (n && !c) bell.insertAdjacentHTML('beforeend', '<span class="count">' + (n > 9 ? '9+' : n) + '</span>');
      else if (!n && c) c.remove();
      else if (c) c.textContent = n > 9 ? '9+' : n;
    }
  });

  g.App = App;
  document.addEventListener('DOMContentLoaded', App.boot);
})(window);
