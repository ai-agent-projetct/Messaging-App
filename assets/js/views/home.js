/* ===== iThrive — Home dashboard ===== */
(function (g) {
  const Home = {};

  const QUICK = [
    { id: 'msg', label: 'New message', icon: 'edit', color: '#12a583' },
    { id: 'group', label: 'Create group', icon: 'users', color: '#7c5cff' },
    { id: 'channel', label: 'Create channel', icon: 'hash', color: '#2e7cf6' },
    { id: 'meet', label: 'Start meeting', icon: 'video', color: '#ff7a45' },
    { id: 'upload', label: 'Upload file', icon: 'upload', color: '#0ea5b7' },
    { id: 'schedule', label: 'Schedule meeting', icon: 'calendarPlus', color: '#eab308' },
    { id: 'task', label: 'Create task', icon: 'tasks', color: '#17a34a' },
    { id: 'announce', label: 'Make announcement', icon: 'megaphone', color: '#e5484d' }
  ];

  Home.render = function (main) {
    main.className = 'main plain';
    const me = Store.me();
    const h = new Date().getHours();
    const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const catchUp = AI.catchUp();

    main.innerHTML =
      '<div class="view-head">' +
      '<div class="vh-main"><h2>Home</h2><div class="vh-sub">' + U.esc(U.dateLong(new Date())) + ' · ' + U.esc(me.tz) + '</div></div>' +
      '<div class="vh-actions">' +
      '<button class="btn soft" data-h="catchup">' + icon('sparkles') + 'Catch me up</button>' +
      '<button class="btn primary" data-h="msg">' + icon('plus') + 'New message</button>' +
      '</div></div>' +
      '<div class="view-scroll"><div class="view-pad" id="home-body">' + UI.skeletonCards(4) + '</div></div>';

    const body = main.querySelector('#home-body');
    setTimeout(() => paint(body, greet, catchUp), 220);
    main.querySelector('[data-h="catchup"]').onclick = () => AIPanel.catchUp();
    main.querySelector('[data-h="msg"]').onclick = () => Modals.newMessage();
  };

  function paint(body, greet, catchUp) {
    const me = Store.me();
    body.innerHTML =
      /* Hero */
      '<div class="home-hero">' +
      '<div class="hero-main">' +
      '<h1>' + greet + ', ' + U.esc(me.first) + '</h1>' +
      '<p class="muted">' + U.esc(catchUp.headline) + '</p>' +
      '<div class="row gap-2 mt-4 wrap">' +
      '<button class="btn primary" data-h="catchup">' + icon('sparkles') + 'Catch me up in 40 seconds</button>' +
      '<button class="btn" data-h="ask">' + icon('aiChat') + 'Ask Thrive AI</button>' +
      '</div></div>' +
      '<div class="hero-side">' + nextUp() + '</div>' +
      '</div>' +

      /* Quick actions */
      '<div class="quick-grid">' + QUICK.map(q =>
        '<button class="quick-card" data-q="' + q.id + '"><span class="qc-ic" style="background:' + q.color + '18;color:' + q.color + '">' + icon(q.icon) + '</span>' +
        '<span class="qc-l">' + q.label + '</span></button>').join('') + '</div>' +

      '<div class="dash-grid mt-6">' +
      '<div class="col gap-4">' +
      cardUnread() + cardMentions() + cardActivity() + cardChannels() +
      '</div>' +
      '<div class="col gap-4">' +
      cardSchedule() + cardTasks() + cardAnnouncements() + cardFiles() + cardPeople() +
      '</div></div>';
    bind(body);
  }

  function nextUp() {
    const next = Store.upcomingMeetings(1)[0];
    if (!next) {
      return '<div class="next-card empty-next">' + icon('coffee') +
        '<div><div class="semi md">Nothing scheduled</div><div class="tiny muted">Your calendar is clear for the rest of today.</div></div></div>';
    }
    const mins = Math.round((new Date(next.start) - Date.now()) / 60000);
    const live = mins <= 0;
    return '<div class="next-card' + (live ? ' live' : '') + '">' +
      '<div class="row between mb-2"><span class="badge ' + (live ? 'danger' : 'brand') + '">' + (live ? 'Happening now' : 'Next up · ' + U.until(next.start)) + '</span>' +
      '<button class="icon-btn sm" data-nextmore>' + icon('moreH') + '</button></div>' +
      '<div class="semi" style="font-size:var(--fs-lg)">' + U.esc(next.title) + '</div>' +
      '<div class="tiny muted mt-1">' + U.esc(U.time(next.start)) + ' – ' + U.esc(U.time(next.end)) + ' · ' + U.esc(next.location) + '</div>' +
      '<div class="row gap-2 mt-3">' + UI.avatarStack(next.participantIds, 5, 24) +
      '<span class="tiny muted">' + U.plural(next.participantIds.length, 'participant') + '</span></div>' +
      '<div class="row gap-2 mt-4"><button class="btn primary sm" data-join="' + next.id + '">' + icon('video') + 'Join</button>' +
      '<button class="btn sm" data-mdetail="' + next.id + '">Details</button>' +
      '<button class="btn ghost sm" data-agenda="' + next.id + '">' + icon('sparkles') + 'Agenda</button></div>' +
      '</div>';
  }

  function card(title, icon_, inner, action) {
    return '<div class="card"><div class="card-head"><h4>' + icon(icon_) + U.esc(title) + '</h4>' +
      (action ? '<button class="btn ghost sm" data-more="' + action.id + '">' + U.esc(action.label) + icon('chevronRight') + '</button>' : '') +
      '</div>' + inner + '</div>';
  }

  function cardUnread() {
    const convs = Store.convs().filter(c => c.unread > 0 && !c.archived)
      .sort((a, b) => (b.mentions - a.mentions) || (b.unread - a.unread)).slice(0, 5);
    const inner = convs.length ? '<div class="mini-list">' + convs.map(function (c) {
      const last = Store.lastMsg(c.id);
      return '<button class="lrow" data-conv="' + c.id + '">' + UI.convAvatar(c, 34) +
        '<span class="grow min0 text-left"><span class="row gap-2"><span class="semi md truncate">' + U.esc(Store.convTitle(c)) + '</span>' +
        (c.mentions ? '<span class="badge danger">@' + c.mentions + '</span>' : '') + '</span>' +
        '<span class="tiny muted truncate block">' + (last ? U.esc(Store.person(last.authorId).first + ': ' + (last.text || 'Shared an attachment')) : '') + '</span></span>' +
        '<span class="count">' + c.unread + '</span></button>';
    }).join('') + '</div>'
      : UI.empty({ icon: 'checkCircle', title: 'Inbox zero', desc: 'No unread conversations. Nicely done.', tone: 'neutral' });
    return card('Unread conversations', 'chat', inner, { id: 'messages', label: 'All messages' });
  }

  function cardMentions() {
    const items = Store.mentionsFeed().slice(0, 4);
    const inner = items.length ? '<div class="mini-list">' + items.map(n =>
      '<button class="lrow" data-notif="' + n.id + '">' + UI.avatar(n.actorId, 32) +
      '<span class="grow min0 text-left"><span class="md block truncate"><b>' + U.esc(Store.person(n.actorId).first) + '</b> ' + U.esc(n.text) + '</span>' +
      '<span class="tiny muted truncate block">' + U.esc(n.preview) + '</span></span>' +
      '<span class="tiny subtle">' + U.esc(U.agoShort(n.ts)) + '</span></button>').join('') + '</div>'
      : UI.empty({ icon: 'atSign', title: 'No mentions', desc: 'When someone mentions you it will show up here.', tone: 'neutral' });
    return card('Mentions and replies', 'atSign', inner, { id: 'notifications', label: 'All activity' });
  }

  function cardActivity() {
    const recent = [];
    Object.keys(Store.state.messages).forEach(function (cid) {
      const c = Store.conv(cid); if (!c || c.kind === 'dm') return;
      const msgs = Store.state.messages[cid];
      const m = msgs[msgs.length - 1];
      if (m && !m.system && m.text) recent.push({ m, c });
    });
    recent.sort((a, b) => new Date(b.m.ts) - new Date(a.m.ts));
    const inner = '<div class="mini-list">' + recent.slice(0, 5).map(x =>
      '<button class="lrow" data-jump="' + x.c.id + ':' + x.m.id + '">' + UI.avatar(x.m.authorId, 30) +
      '<span class="grow min0 text-left"><span class="tiny muted block">' + U.esc(Store.person(x.m.authorId).first) + ' in ' + U.esc(Store.convTitle(x.c)) + '</span>' +
      '<span class="md truncate block">' + U.esc(x.m.text) + '</span></span>' +
      '<span class="tiny subtle">' + U.esc(U.agoShort(x.m.ts)) + '</span></button>').join('') + '</div>';
    return card('Team activity', 'activity', inner, { id: 'channels', label: 'Browse channels' });
  }

  function cardChannels() {
    const chans = Store.convs().filter(c => c.kind === 'channel' && !c.archived && c.memberIds.includes(Store.state.meId))
      .sort((a, b) => {
        const am = Store.lastMsg(a.id), bm = Store.lastMsg(b.id);
        return new Date(bm ? bm.ts : 0) - new Date(am ? am.ts : 0);
      }).slice(0, 6);
    const inner = '<div class="card-body"><div class="chip-row">' + chans.map(c =>
      '<button class="chip" data-conv="' + c.id + '">' + icon(UI.channelIcon(c)) + '#' + U.esc(c.name) +
      (c.unread ? '<span class="count">' + c.unread + '</span>' : '') + '</button>').join('') +
      '<button class="chip" data-more="browse">' + icon('plus') + 'Browse all</button></div></div>';
    return card('Recent channels', 'hash', inner);
  }

  function cardSchedule() {
    const today = Store.upcomingMeetings(20).filter(m => U.isSameDay(m.start, new Date())).slice(0, 4);
    const inner = today.length ? '<div class="mini-list">' + today.map(function (m) {
      const live = new Date(m.start) <= Date.now() && new Date(m.end) > Date.now();
      return '<div class="lrow sched-row' + (live ? ' live' : '') + '" data-mdetail="' + m.id + '">' +
        '<span class="sched-time"><b>' + U.esc(U.time24(m.start)) + '</b><i>' + U.dur(m.durationMin) + '</i></span>' +
        '<span class="grow min0"><span class="semi md truncate block">' + U.esc(m.title) + '</span>' +
        '<span class="tiny muted truncate block">' + U.plural(m.participantIds.length, 'participant') + ' · ' + U.esc(m.location) + '</span></span>' +
        '<button class="btn sm ' + (live ? 'primary' : '') + '" data-join="' + m.id + '">' + (live ? 'Join' : icon('video')) + '</button></div>';
    }).join('') + '</div>'
      : UI.empty({ icon: 'calendar', title: 'No meetings today', desc: 'A clear day. Use it well.', tone: 'neutral' });
    return card("Today's calendar", 'calendar', inner, { id: 'calendar', label: 'Open calendar' });
  }

  function cardTasks() {
    const tasks = Store.myTasks().filter(t => t.status !== 'done')
      .sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 5);
    const overdue = tasks.filter(t => new Date(t.due) < Date.now()).length;
    const inner = tasks.length ? '<div class="mini-list">' + tasks.map(function (t) {
      const late = new Date(t.due) < Date.now();
      return '<div class="lrow" data-task="' + t.id + '">' +
        '<button class="check' + (t.status === 'done' ? ' on' : '') + '" data-tdone="' + t.id + '">' + icon('check') + '</button>' +
        '<span class="grow min0"><span class="semi md truncate block">' + U.esc(t.title) + '</span>' +
        '<span class="tiny ' + (late ? 'danger-text' : 'muted') + '">' + (late ? 'Overdue · ' : 'Due ') + U.esc(U.dayLabel(t.due)) + '</span></span>' +
        UI.priorityBadge(t.priority) + '</div>';
    }).join('') + '</div>' + (overdue ? '<div class="card-foot tiny"><span class="danger-text semi">' + U.plural(overdue, 'task') + ' overdue</span></div>' : '')
      : UI.empty({ icon: 'checkCircle', title: 'No open tasks', desc: 'Everything assigned to you is done.', tone: 'neutral' });
    return card('Your tasks', 'tasks', inner, { id: 'tasks', label: 'All tasks' });
  }

  function cardAnnouncements() {
    const anns = Store.state.announcements.filter(a => !a.draft).slice(0, 3);
    const inner = '<div class="mini-list">' + anns.map(function (a) {
      const unread = !a.readBy.includes(Store.state.meId);
      return '<button class="lrow" data-ann="' + a.id + '">' +
        '<span class="ann-dot ' + (a.priority === 'high' ? 'high' : '') + '">' + icon(a.type === 'Policy' ? 'shield' : a.type === 'Event' ? 'calendar' : 'megaphone') + '</span>' +
        '<span class="grow min0 text-left"><span class="semi md truncate block">' + U.esc(a.title) + (unread ? ' <span class="dot"></span>' : '') + '</span>' +
        '<span class="tiny muted truncate block">' + U.esc(Store.person(a.authorId).name) + ' · ' + U.esc(U.ago(a.createdAt)) + '</span></span>' +
        (a.requireRead && unread ? '<span class="badge warning">Confirm</span>' : '') + '</button>';
    }).join('') + '</div>';
    return card('Announcements', 'megaphone', inner, { id: 'announcements', label: 'All announcements' });
  }

  function cardFiles() {
    const files = U.sortBy(Store.state.files, f => f.modifiedAt, 'desc').slice(0, 4);
    const inner = '<div class="mini-list">' + files.map(f => UI.fileRow(f, { actions: false })).join('') + '</div>';
    return card('Recent files', 'folder', inner, { id: 'files', label: 'All files' });
  }

  function cardPeople() {
    const me = Store.me();
    const sug = Store.people().filter(p => p.id !== me.id && (p.deptId === me.deptId || p.managerId === me.managerId || p.id === me.managerId))
      .slice(0, 5);
    const inner = '<div class="card-body"><div class="people-row">' + sug.map(p =>
      '<button class="person-chip" data-person="' + p.id + '">' + UI.avatar(p, 40) +
      '<span class="tiny semi truncate">' + U.esc(p.first) + '</span>' +
      '<span class="tiny subtle truncate">' + U.esc(p.title.split(',')[0].split(' ').slice(-2).join(' ')) + '</span></button>').join('') + '</div></div>';
    return card('People you work with', 'contacts', inner, { id: 'contacts', label: 'Directory' });
  }

  function bind(body) {
    U.qsa('[data-q]', body).forEach(b => b.onclick = function () {
      const a = b.dataset.q;
      if (a === 'msg') Modals.newMessage();
      if (a === 'group') Modals.createGroup();
      if (a === 'channel') Modals.createChannel();
      if (a === 'meet') Modals.instantMeeting();
      if (a === 'upload') Modals.uploadFile();
      if (a === 'schedule') Modals.scheduleMeeting();
      if (a === 'task') Modals.createTask();
      if (a === 'announce') Modals.createAnnouncement();
    });
    U.qsa('[data-h]', body).forEach(b => b.onclick = function () {
      if (b.dataset.h === 'catchup') AIPanel.catchUp();
      if (b.dataset.h === 'ask') AIPanel.ask(null);
    });
    U.qsa('[data-conv]', body).forEach(b => b.onclick = () => App.route('#/messages/' + b.dataset.conv));
    U.qsa('[data-more]', body).forEach(b => b.onclick = function () {
      const m = b.dataset.more;
      if (m === 'browse') Modals.browseChannels();
      else App.route('#/' + m);
    });
    U.qsa('[data-jump]', body).forEach(b => b.onclick = function () {
      const [cid, mid] = b.dataset.jump.split(':');
      App.route('#/messages/' + cid); setTimeout(() => Chat.highlight(mid), 380);
    });
    U.qsa('[data-notif]', body).forEach(b => b.onclick = () => App.openNotification(b.dataset.notif));
    U.qsa('[data-mdetail]', body).forEach(b => b.onclick = (e) => { if (!e.target.closest('[data-join]')) Modals.meetingDetail(b.dataset.mdetail); });
    U.qsa('[data-join]', body).forEach(b => b.onclick = (e) => { e.stopPropagation(); Calls.joinMeeting(b.dataset.join); });
    U.qsa('[data-agenda]', body).forEach(b => b.onclick = () => Modals.meetingAgenda(b.dataset.agenda));
    U.qsa('[data-task]', body).forEach(b => b.onclick = (e) => { if (!e.target.closest('[data-tdone]')) Modals.taskDetail(b.dataset.task); });
    U.qsa('[data-tdone]', body).forEach(b => b.onclick = function (e) {
      e.stopPropagation();
      const t = Store.task(b.dataset.tdone);
      Store.updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' });
      UI.toast(t.status === 'done' ? 'Task completed.' : 'Task reopened.', 'success');
      App.renderMain();
    });
    U.qsa('[data-ann]', body).forEach(b => b.onclick = () => Modals.announcementDetail(b.dataset.ann));
    U.qsa('[data-person]', body).forEach(b => b.onclick = () => Modals.personProfile(b.dataset.person));
    U.qsa('[data-file]', body).forEach(b => b.onclick = () => Modals.filePreview(b.dataset.file));
    const nm = body.querySelector('[data-nextmore]');
    if (nm) nm.onclick = (e) => UI.menu(e.currentTarget, [
      { label: 'Open calendar', icon: 'calendar', onClick: () => App.route('#/calendar') },
      { label: 'Meeting details', icon: 'info', onClick: () => Modals.meetingDetail(Store.upcomingMeetings(1)[0].id) },
      { label: 'Generate agenda with AI', icon: 'sparkles', onClick: () => Modals.meetingAgenda(Store.upcomingMeetings(1)[0].id) }
    ], { align: 'right' });
  }

  g.Home = Home;
})(window);
