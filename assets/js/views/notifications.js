/* ===== iThrive — Notification centre ===== */
(function (g) {
  const Notifs = { tab: 'all' };

  const TYPE_META = {
    mention: { icon: 'atSign', color: '#e5484d', label: 'Mention' },
    message: { icon: 'chat', color: '#12a583', label: 'Message' },
    thread: { icon: 'chats', color: '#12a583', label: 'Thread' },
    task: { icon: 'tasks', color: '#17a34a', label: 'Task' },
    meeting: { icon: 'video', color: '#ff7a45', label: 'Meeting' },
    call: { icon: 'phone', color: '#2e7cf6', label: 'Call' },
    file: { icon: 'folder', color: '#0ea5b7', label: 'File' },
    announcement: { icon: 'megaphone', color: '#eab308', label: 'Announcement' },
    reaction: { icon: 'smile', color: '#7c5cff', label: 'Reaction' },
    invite: { icon: 'userPlus', color: '#7c5cff', label: 'Invitation' },
    group: { icon: 'users', color: '#7c5cff', label: 'Group' }
  };

  Notifs.render = function (main) {
    main.className = 'main plain';
    const unread = Store.unreadNotifs();
    main.innerHTML =
      '<div class="view-head"><div class="vh-main"><h2>' + icon('bell') + 'Notifications</h2>' +
      '<div class="vh-sub">' + (unread ? unread + ' unread' : 'You are all caught up') + '</div></div>' +
      '<div class="vh-actions">' +
      '<button class="btn" data-n="read">' + icon('check') + 'Mark all read</button>' +
      '<button class="btn" data-n="settings">' + icon('sliders') + 'Preferences</button></div></div>' +
      '<div class="view-toolbar">' +
      ['all', 'unread', 'mentions', 'smart'].map(t => '<button class="chip' + (Notifs.tab === t ? ' on' : '') + '" data-tab="' + t + '">' +
        (t === 'smart' ? icon('sparkles') + 'Smart priority' : U.cap(t)) + '</button>').join('') +
      '<span class="grow"></span>' +
      '<button class="chip" data-n="dnd">' + icon('moon') + (Store.state.dnd ? 'Do Not Disturb is on' : 'Pause notifications') + '</button>' +
      '</div>' +
      '<div class="view-scroll"><div class="view-pad" id="n-body"></div></div>';

    const body = main.querySelector('#n-body');
    UI.withLoading(body, draw, 180);
    main.querySelector('[data-n="read"]').onclick = () => { Store.markAllNotifsRead(); draw(); App.renderShell(); UI.toast('All notifications marked as read.', 'success'); };
    main.querySelector('[data-n="settings"]').onclick = () => App.route('#/settings/notifications');
    main.querySelector('[data-n="dnd"]').onclick = () => Modals.dnd();
    U.qsa('[data-tab]', main).forEach(b => b.onclick = function () {
      Notifs.tab = b.dataset.tab;
      U.qsa('[data-tab]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      draw();
    });

    function draw() {
      let items = Store.state.notifications.slice();
      if (Notifs.tab === 'unread') items = items.filter(n => !n.read);
      if (Notifs.tab === 'mentions') items = items.filter(n => n.type === 'mention' || n.type === 'thread');
      if (Notifs.tab === 'smart') {
        const ranked = AI.prioritise(items);
        body.innerHTML = smartHTML(ranked);
        bind(); return;
      }
      if (!items.length) {
        UI.emptyInto(body, {
          icon: 'bell', tone: 'neutral',
          title: Notifs.tab === 'unread' ? 'Nothing unread' : Notifs.tab === 'mentions' ? 'No mentions' : 'No notifications',
          desc: 'When someone messages you, mentions you or assigns you something, it will appear here.'
        });
        return;
      }
      const groups = U.groupBy(items, n => U.dayLabel(n.ts));
      body.innerHTML = Object.keys(groups).map(function (day) {
        return '<div class="mb-5"><div class="section-title"><h4>' + U.esc(day) + '</h4></div>' +
          '<div class="mini-list card">' + groups[day].map(rowHTML).join('') + '</div></div>';
      }).join('');
      bind();
    }

    function smartHTML(ranked) {
      const tiers = [
        { id: 'now', label: 'Needs your attention now', desc: 'Direct mentions, urgent items and anything from your manager.' },
        { id: 'soon', label: 'Worth a look soon', desc: 'Messages and tasks that are not blocking anyone.' },
        { id: 'later', label: 'Can wait for your digest', desc: 'Reactions, low-priority updates and already-read items.' }
      ];
      return '<div class="banner brand mb-4">' + icon('sparkles') +
        '<div class="b-body"><strong>Smart priority is on</strong>Thrive AI ranks notifications by who sent them, how urgent the language is, and how long they have been waiting. Ordering only — nothing is hidden.</div></div>' +
        tiers.map(function (t) {
          const items = ranked.filter(n => n._tier === t.id);
          if (!items.length) return '';
          return '<div class="mb-5"><div class="section-title"><h4>' + t.label + '</h4>' +
            '<span class="tiny muted">' + items.length + '</span></div>' +
            '<div class="tiny muted mb-2">' + t.desc + '</div>' +
            '<div class="mini-list card">' + items.map(rowHTML).join('') + '</div></div>';
        }).join('');
    }

    function rowHTML(n) {
      const m = TYPE_META[n.type] || TYPE_META.message;
      return '<div class="lrow notif-row' + (n.read ? '' : ' unread') + '" data-notif="' + n.id + '">' +
        '<span class="n-ic" style="background:' + m.color + '18;color:' + m.color + '">' + icon(m.icon) + '</span>' +
        UI.avatar(n.actorId, 32) +
        '<span class="grow min0"><span class="md truncate block"><b>' + U.esc(Store.person(n.actorId).name) + '</b> ' + U.esc(n.text) + '</span>' +
        '<span class="tiny muted truncate block">' + U.esc(n.preview || '') + '</span></span>' +
        (n.read ? '' : '<span class="dot"></span>') +
        '<span class="tiny subtle">' + U.esc(U.agoShort(n.ts)) + '</span>' +
        '<div class="lrow-actions"><button class="icon-btn sm" data-nmenu="' + n.id + '">' + icon('moreH') + '</button></div></div>';
    }

    function bind() {
      U.qsa('[data-notif]', body).forEach(function (r) {
        r.onclick = function (e) { if (!e.target.closest('[data-nmenu]')) App.openNotification(r.dataset.notif); };
      });
      U.qsa('[data-nmenu]', body).forEach(b => b.onclick = function (e) {
        e.stopPropagation();
        const n = Store.state.notifications.find(x => x.id === b.dataset.nmenu);
        UI.menu(b, [
          { label: 'Open', icon: 'externalLink', onClick: () => App.openNotification(n.id) },
          { label: n.read ? 'Mark as unread' : 'Mark as read', icon: 'check', onClick: () => { n.read = !n.read; Store.persist(); Store.emit('badges'); draw(); App.renderShell(); } },
          { sep: true },
          { label: 'Mute this conversation', icon: 'moon', onClick: () => { if (n.target && Store.conv(n.target.id)) { Store.toggleMute(n.target.id); UI.toast('Conversation muted.', 'success'); } } },
          { label: 'Turn off ' + (TYPE_META[n.type] || {}).label + ' notifications', icon: 'sliders', onClick: () => App.route('#/settings/notifications') },
          { label: 'Remove', icon: 'trash', danger: true, onClick: function () {
            Store.state.notifications = Store.state.notifications.filter(x => x.id !== n.id);
            Store.persist(); Store.emit('badges'); draw(); App.renderShell();
          } }
        ], { align: 'right' });
      });
    }
  };

  Notifs.TYPE_META = TYPE_META;
  g.NotifsView = Notifs;
})(window);
