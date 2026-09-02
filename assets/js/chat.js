/* ===== iThrive — Conversation view ===== */
(function (g) {
  const Chat = { cid: null, composer: null, panelTab: 'info', searchQuery: '' };

  const REACT_QUICK = ['👍', '🎉', '❤️', '😄', '👀', '✅'];

  /* ------------------------------------------------------------------ */
  Chat.open = function (cid, opts) {
    opts = opts || {};
    if (!Store.conv(cid)) { App.route('#/messages'); return; }
    Chat.cid = cid;
    Store.markRead(cid);
    App.renderShell();
    if (opts.highlight) setTimeout(() => Chat.highlight(opts.highlight), 260);
  };

  Chat.render = function (main) {
    const cid = Chat.cid;
    const c = Store.conv(cid);
    if (!c) { main.innerHTML = UI.empty({ icon: 'chat', title: 'Conversation not found', desc: 'It may have been archived or you no longer have access.' }); return; }

    main.className = 'main';
    main.innerHTML =
      header(c) +
      bookmarkBar(c) +
      pinnedBar(c) +
      '<div class="msg-scroll scroll-y" id="msg-scroll"><div class="msg-list" id="msg-list"></div></div>' +
      '<div class="typing-row" id="typing-row" hidden></div>' +
      '<div class="quick-replies" id="quick-replies" hidden></div>' +
      '<div class="composer-host" id="composer-host"></div>';

    bindHeader(main, c);
    const list = main.querySelector('#msg-list');
    const scroller = main.querySelector('#msg-scroll');

    /* brief skeleton so loading is honest on first paint of a big channel */
    const msgs = Store.msgs(cid);
    if (msgs.length > 12 && !Chat._warm) {
      list.innerHTML = UI.skeletonList(7, { pad: '18px 20px' });
      setTimeout(() => { Chat._warm = true; paint(); }, 200);
    } else paint();

    function paint() {
      list.innerHTML = renderMessages(c);
      bindMessages(list, c);
      U.scrollBottom(scroller);
      renderQuickReplies(c);
    }

    Chat.composer = Composer.mount(main.querySelector('#composer-host'), {
      cid: cid,
      onSend: function (payload) {
        const m = Store.sendMessage(cid, payload);
        paint();
        U.scrollBottom(scroller, true);
        maybeReply(c, m);
      },
      onEditLast: function (m) { Chat.editMessage(m); }
    });

    Chat._unsub && Chat._unsub();
    const offs = [
      Store.on('message:update', () => { if (Chat.cid === cid) { list.innerHTML = renderMessages(c); bindMessages(list, c); } }),
      Store.on('message:status', () => { if (Chat.cid === cid) updateStatuses(list, c); }),
      Store.on('thread:new', () => { if (Chat.cid === cid) { list.innerHTML = renderMessages(c); bindMessages(list, c); } })
    ];
    Chat._unsub = () => offs.forEach(f => f());
  };

  /* ------------------------------------------------------------------ */
  /* Header                                                             */
  /* ------------------------------------------------------------------ */
  function header(c) {
    let title, sub, av;
    if (c.kind === 'dm') {
      const p = Store.person(c.peerId);
      av = UI.avatar(p, 38);
      title = U.esc(p.name) + (p.role === 'Guest' ? ' <span class="badge warning">Guest</span>' : '');
      sub = '<span class="pres-dot ' + p.presence + '"></span>' + U.esc(UI.presenceLabel(p.presence)) +
        (p.statusText ? ' · ' + U.esc((p.statusEmoji || '') + ' ' + p.statusText) : '') +
        ' · ' + U.esc(p.title);
    } else if (c.kind === 'group') {
      av = UI.convAvatar(c, 38);
      title = U.esc(c.name) + (c.type === 'private' ? ' ' + icon('lock', 'inline-ic') : '');
      sub = U.plural(c.memberIds.length, 'member') + (c.description ? ' · ' + U.esc(c.description) : '');
    } else {
      av = UI.convAvatar(c, 38);
      title = '#' + U.esc(c.name) +
        (c.archived ? ' <span class="badge">Archived</span>' : '') +
        (c.type === 'announcement' ? ' <span class="badge solar">Announcements</span>' : '') +
        (c.type === 'temporary' ? ' <span class="badge warning">Temporary</span>' : '');
      sub = U.plural(c.memberIds.length, 'member') + (c.topic ? ' · ' + U.esc(c.topic) : '');
    }
    const onlineCount = c.memberIds.filter(id => ['available', 'busy', 'meeting'].includes(Store.person(id).presence)).length;

    return '<div class="view-head chat-head">' +
      '<button class="icon-btn mobile-only" data-act="back">' + icon('arrowLeft') + '</button>' +
      '<div class="chat-head-id" data-act="info">' + av +
      '<div class="vh-main"><h2>' + title + '</h2><div class="vh-sub truncate">' + sub + '</div></div></div>' +
      '<div class="vh-actions">' +
      (c.kind !== 'dm' ? '<div class="head-members" data-act="members" data-tip="' + onlineCount + ' online">' + UI.avatarStack(c.memberIds.slice(0, 4), 4, 24) + '<span class="tiny semi">' + c.memberIds.length + '</span></div>' : '') +
      hbtn('search', 'search', 'Search in conversation') +
      hbtn('call', 'phone', 'Start an audio call') +
      hbtn('video', 'video', 'Start a video call') +
      hbtn('ai', 'sparkles', 'Thrive AI', 'ai') +
      hbtn('panel', 'panelRight', 'Details') +
      hbtn('more', 'moreV', 'More actions') +
      '</div></div>' +
      '<div class="chat-search" id="chat-search" hidden>' +
      '<div class="input-wrap grow">' + icon('search') + '<input class="input" id="cs-input" placeholder="Search this conversation…"></div>' +
      '<span class="tiny muted" id="cs-count"></span>' +
      '<button class="icon-btn" id="cs-prev" data-tip="Previous">' + icon('chevronUp') + '</button>' +
      '<button class="icon-btn" id="cs-next" data-tip="Next">' + icon('chevronDown') + '</button>' +
      '<button class="icon-btn" id="cs-close">' + icon('x') + '</button></div>';
  }
  function hbtn(act, ic, tip, cls) {
    return '<button class="icon-btn ' + (cls || '') + '" data-act="' + act + '" data-tip="' + tip + '">' + icon(ic) + '</button>';
  }

  function bindHeader(main, c) {
    const act = (name, fn) => { const b = main.querySelector('[data-act="' + name + '"]'); if (b) b.onclick = fn; };
    act('back', () => App.route('#/messages'));
    act('info', () => App.togglePanel(true, 'info'));
    act('members', () => App.togglePanel(true, 'members'));
    act('call', () => Calls.start({ cid: c.id, kind: 'audio' }));
    act('video', () => Calls.start({ cid: c.id, kind: 'video' }));
    act('panel', () => App.togglePanel());
    act('ai', (e) => openAIMenu(e.currentTarget, c));
    act('search', () => {
      const bar = main.querySelector('#chat-search');
      bar.hidden = !bar.hidden;
      if (!bar.hidden) { bar.querySelector('#cs-input').focus(); }
      else { Chat.searchQuery = ''; U.qsa('.msg.search-hit', main).forEach(x => x.classList.remove('search-hit')); }
    });
    act('more', (e) => moreMenu(e.currentTarget, c));

    const csIn = main.querySelector('#cs-input');
    if (csIn) {
      let hits = [], pos = 0;
      const run = U.debounce(function () {
        const q = csIn.value.trim().toLowerCase();
        Chat.searchQuery = q;
        U.qsa('.msg', main).forEach(x => x.classList.remove('search-hit'));
        hits = [];
        if (q) {
          U.qsa('.msg', main).forEach(function (el) {
            const txt = el.querySelector('.msg-text');
            if (txt && txt.textContent.toLowerCase().includes(q)) { el.classList.add('search-hit'); hits.push(el); }
          });
        }
        pos = 0;
        main.querySelector('#cs-count').textContent = q ? (hits.length ? '1 of ' + hits.length : 'No matches') : '';
        if (hits.length) hits[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 180);
      csIn.addEventListener('input', run);
      const step = (d) => {
        if (!hits.length) return;
        pos = (pos + d + hits.length) % hits.length;
        main.querySelector('#cs-count').textContent = (pos + 1) + ' of ' + hits.length;
        hits[pos].scrollIntoView({ block: 'center', behavior: 'smooth' });
        hits.forEach(h => h.classList.remove('search-active'));
        hits[pos].classList.add('search-active');
      };
      main.querySelector('#cs-next').onclick = () => step(1);
      main.querySelector('#cs-prev').onclick = () => step(-1);
      main.querySelector('#cs-close').onclick = () => { main.querySelector('#chat-search').hidden = true; csIn.value = ''; run(); };
      csIn.addEventListener('keydown', e => { if (e.key === 'Enter') step(e.shiftKey ? -1 : 1); if (e.key === 'Escape') main.querySelector('#cs-close').click(); });
    }

    U.qsa('[data-bookmark]', main).forEach(b => b.onclick = () => UI.toast('Opening “' + b.dataset.bookmarkLabel + '”…', 'info'));
    const addBm = main.querySelector('[data-add-bookmark]');
    if (addBm) addBm.onclick = () => UI.prompt({ title: 'Add a bookmark', label: 'Label', placeholder: 'Launch doc', icon: 'bookmark' })
      .then(v => { if (v) { Store.addBookmark(c.id, v); App.renderShell(); UI.toast('Bookmark added.', 'success'); } });

    const pinBar = main.querySelector('[data-pinned-open]');
    if (pinBar) pinBar.onclick = () => App.togglePanel(true, 'pinned');
  }

  function openAIMenu(anchor, c) {
    UI.menu(anchor, [
      { label: 'Thrive AI', header: true },
      { label: 'Summarise this conversation', icon: 'bookOpen', onClick: () => AIPanel.summarize(c.id) },
      { label: 'What did I miss?', icon: 'clock', onClick: () => AIPanel.summarize(c.id, { sinceHours: 24 }) },
      { label: 'Extract action items', icon: 'listChecks', onClick: () => AIPanel.actions(c.id) },
      { label: 'Ask about this conversation', icon: 'aiChat', onClick: () => AIPanel.ask(c.id) },
      { sep: true },
      { label: 'Translate conversation', icon: 'translate', onClick: () => translateConv(c.id) },
      { label: 'Open Thrive AI assistant', icon: 'sparkles', onClick: () => AIPanel.open() }
    ], { align: 'right', width: 250 });
  }

  function translateConv(cid) {
    UI.menu(document.querySelector('[data-act="ai"]'), AI.languages.map(l => ({
      label: l, icon: 'globe',
      onClick: function () {
        Chat.translateTo = Chat.translateTo === l ? null : l;
        App.renderShell();
        UI.toast(Chat.translateTo ? ('Conversation translated to ' + l + '. Original text is available on each message.') : 'Translation turned off.', 'success');
      }
    })).concat([{ sep: true }, { label: 'Turn off translation', icon: 'x', onClick: () => { Chat.translateTo = null; App.renderShell(); } }]), { align: 'right' });
  }

  function moreMenu(anchor, c) {
    const isFav = c.kind === 'channel' ? c.favorite : c.pinned;
    const items = [
      { label: isFav ? 'Remove from favourites' : 'Add to favourites', icon: 'star', onClick: () => { Store.toggleFavorite(c.id); App.renderShell(); UI.toast(isFav ? 'Removed from favourites.' : 'Added to favourites.', 'success'); } },
      { label: c.muted ? 'Unmute notifications' : 'Mute notifications', icon: c.muted ? 'bell' : 'moon', onClick: () => { const m = Store.toggleMute(c.id); UI.toast(m ? 'Notifications muted.' : 'Notifications on.', 'success'); App.renderShell(); } },
      { label: 'Notification preferences', icon: 'sliders', onClick: () => Modals.convNotifications(c.id) },
      { sep: true },
      { label: 'View pinned messages', icon: 'pin', onClick: () => App.togglePanel(true, 'pinned') },
      { label: 'View files and media', icon: 'folder', onClick: () => App.togglePanel(true, 'files') },
      { label: 'View threads', icon: 'chats', onClick: () => App.togglePanel(true, 'threads') }
    ];
    if (c.kind !== 'dm') {
      items.push({ sep: true },
        { label: 'Add people', icon: 'userPlus', onClick: () => Modals.addMembers(c.id) },
        { label: 'Manage members', icon: 'users', onClick: () => App.togglePanel(true, 'members') });
      if (c.kind === 'channel') {
        items.push({ label: 'Edit channel', icon: 'edit', onClick: () => Modals.editChannel(c.id) },
          { label: 'Channel analytics', icon: 'chart', onClick: () => Modals.channelAnalytics(c.id) });
      } else {
        items.push({ label: 'Edit group', icon: 'edit', onClick: () => Modals.editGroup(c.id) });
      }
    }
    items.push({ sep: true },
      { label: 'Copy link to conversation', icon: 'link', onClick: () => UI.copyToast('https://northbeam.ithrive.app/' + c.id, 'Conversation link copied.') },
      { label: 'Export conversation', icon: 'download', onClick: () => Modals.exportConv(c.id) },
      { label: c.archived ? 'Unarchive' : 'Archive conversation', icon: 'archive', onClick: () => { const a = Store.archiveConv(c.id); UI.toast(a ? 'Conversation archived.' : 'Conversation restored.', 'success'); App.renderShell(); } });
    if (c.kind !== 'dm') {
      items.push({ label: 'Leave ' + (c.kind === 'channel' ? 'channel' : 'group'), icon: 'logout', danger: true, onClick: function () {
        UI.confirm({ title: 'Leave ' + Store.convTitle(c) + '?', body: 'You will stop receiving messages and will need an invitation to rejoin if it is private.', confirmLabel: 'Leave', danger: true })
          .then(ok => { if (ok) { Store.leaveConv(c.id); UI.toast('You left ' + Store.convTitle(c) + '.', 'success'); App.route('#/messages'); } });
      } });
    }
    UI.menu(anchor, items, { align: 'right', width: 250 });
  }

  /* ------------------------------------------------------------------ */
  function bookmarkBar(c) {
    if (c.kind !== 'channel') return '';
    const bm = c.bookmarks || [];
    return '<div class="bookmark-bar">' +
      bm.map(b => '<button class="bm-chip" data-bookmark="' + b.id + '" data-bookmark-label="' + U.attr(b.label) + '">' + icon(b.icon || 'link') + U.esc(b.label) + '</button>').join('') +
      '<button class="bm-chip add" data-add-bookmark>' + icon('plus') + 'Add bookmark</button>' +
      '</div>';
  }

  function pinnedBar(c) {
    const pins = (Store.msgs(c.id) || []).filter(m => m.pinned && !m.deleted);
    if (!pins.length) return '';
    const last = pins[pins.length - 1];
    return '<button class="pinned-bar" data-pinned-open>' + icon('pin') +
      '<span class="tiny semi">' + pins.length + ' pinned</span>' +
      '<span class="tiny muted truncate grow">' + U.esc(Store.person(last.authorId).first) + ': ' + U.esc(U.esc(last.text).slice(0, 120)) + '</span>' +
      icon('chevronRight') + '</button>';
  }

  /* ------------------------------------------------------------------ */
  /* Message list                                                       */
  /* ------------------------------------------------------------------ */
  function renderMessages(c) {
    const msgs = (Store.msgs(c.id) || []);
    if (!msgs.length) return emptyConv(c);
    let html = convIntro(c);
    let lastDay = null, lastAuthor = null, lastTs = 0;
    msgs.forEach(function (m, i) {
      const d = new Date(m.ts);
      const dayKey = d.toDateString();
      if (dayKey !== lastDay) {
        html += '<div class="day-sep"><span>' + U.esc(U.dayLabel(d)) + '</span></div>';
        lastDay = dayKey; lastAuthor = null;
      }
      if (m.system) { html += systemMsg(m); lastAuthor = null; return; }
      const grouped = m.authorId === lastAuthor && (d - lastTs) < 5 * 60000 && !m.replyTo;
      html += messageHTML(m, c, grouped);
      lastAuthor = m.authorId; lastTs = d;
    });
    return html;
  }

  function convIntro(c) {
    if (c.kind === 'dm') {
      const p = Store.person(c.peerId);
      return '<div class="conv-intro">' + UI.avatar(p, 64) +
        '<h3>' + U.esc(p.name) + '</h3>' +
        '<p class="muted md">' + U.esc(p.title) + ' · ' + U.esc(Store.dept(p.deptId).name) + '</p>' +
        '<p class="tiny subtle mt-1">' + U.esc(p.location) + ' · ' + U.esc(p.tz) + '</p>' +
        '<div class="row gap-2 mt-4 center">' +
        '<button class="btn sm" data-intro="profile">' + icon('contacts') + 'View profile</button>' +
        '<button class="btn sm" data-intro="meet">' + icon('calendarPlus') + 'Schedule</button>' +
        '<button class="btn sm" data-intro="call">' + icon('video') + 'Call</button>' +
        '</div><div class="divider mt-4"></div></div>';
    }
    if (c.kind === 'group') {
      return '<div class="conv-intro">' + UI.convAvatar(c, 64) +
        '<h3>' + U.esc(c.name) + '</h3>' +
        '<p class="muted md">' + U.esc(c.description || 'No description yet.') + '</p>' +
        '<p class="tiny subtle mt-1">Created by ' + U.esc(Store.person(c.createdBy).name) + ' · ' + U.plural(c.memberIds.length, 'member') + '</p>' +
        '<div class="row gap-2 mt-4 center"><button class="btn sm" data-intro="add">' + icon('userPlus') + 'Add people</button>' +
        '<button class="btn sm" data-intro="edit">' + icon('edit') + 'Edit group</button></div><div class="divider mt-4"></div></div>';
    }
    return '<div class="conv-intro">' + UI.convAvatar(c, 64) +
      '<h3>#' + U.esc(c.name) + '</h3>' +
      '<p class="muted md">' + U.esc(c.purpose || c.topic || 'This is the very beginning of the channel.') + '</p>' +
      '<p class="tiny subtle mt-1">Created by ' + U.esc(Store.person(c.createdBy).name) + ' on ' + U.esc(U.dateShort(c.createdAt)) + ' · ' + U.plural(c.memberIds.length, 'member') + '</p>' +
      '<div class="row gap-2 mt-4 center"><button class="btn sm" data-intro="add">' + icon('userPlus') + 'Add people</button>' +
      '<button class="btn sm" data-intro="edit">' + icon('edit') + 'Edit channel</button></div><div class="divider mt-4"></div></div>';
  }

  function emptyConv(c) {
    return convIntro(c) + UI.empty({
      icon: 'chat', title: 'No messages yet',
      desc: c.kind === 'dm' ? 'Say hello — this conversation is just between the two of you.' : 'Start the conversation. Everything posted here stays searchable for the whole team.'
    });
  }

  function systemMsg(m) {
    const s = m.system || '';
    let text = '';
    if (s === 'created') text = Store.person(m.authorId).name + ' created this channel.';
    else if (s === 'group-created') text = Store.person(m.authorId).name + ' created this group.';
    else if (s.startsWith('added:')) {
      const ids = s.slice(6).split(',');
      text = Store.person(m.authorId).first + ' added ' + ids.map(i => Store.person(i).name).join(', ') + '.';
    } else if (s.startsWith('removed:')) {
      text = Store.person(m.authorId).first + ' removed ' + Store.person(s.slice(8)).name + '.';
    } else if (s.startsWith('call:')) text = s.slice(5);
    else text = s;
    return '<div class="sys-msg">' + icon('info') + '<span>' + U.esc(text) + '</span><span class="tiny subtle">' + U.esc(U.time(m.ts)) + '</span></div>';
  }

  function messageHTML(m, c, grouped) {
    const p = Store.person(m.authorId);
    const mine = m.authorId === Store.state.meId;
    if (m.deleted) {
      return '<div class="msg deleted" data-mid="' + m.id + '"><div class="msg-gutter"></div>' +
        '<div class="msg-body"><span class="tiny subtle">' + icon('trash') + ' This message was deleted</span></div></div>';
    }
    let text = m.text || '';
    let translated = false;
    if (Chat.translateTo && text) { text = AI.translate(text, Chat.translateTo); translated = true; }

    const bigEmoji = U.emojiOnly(m.text) && !(m.files || []).length;
    const cls = ['msg'];
    if (grouped) cls.push('grouped');
    if (mine) cls.push('mine');
    if (m.pinned) cls.push('pinned');
    if (Store.state.savedIds.includes(m.id)) cls.push('saved');

    let h = '<div class="' + cls.join(' ') + '" data-mid="' + m.id + '" id="m-' + m.id + '">';
    h += '<div class="msg-gutter">' + (grouped ? '<span class="hover-time tiny subtle">' + U.time24(m.ts) + '</span>' : UI.avatar(p, 36)) + '</div>';
    h += '<div class="msg-body">';
    if (!grouped) {
      h += '<div class="msg-head"><button class="msg-author" data-person-open="' + p.id + '">' + U.esc(p.name) + '</button>' +
        (p.role === 'Guest' || p.role === 'External Collaborator' ? '<span class="badge warning">' + (p.role === 'Guest' ? 'Guest' : 'External') + '</span>' : '') +
        (p.id === Store.me().managerId ? '<span class="badge info">Your manager</span>' : '') +
        '<span class="msg-time tiny subtle">' + U.esc(U.time(m.ts)) + '</span>' +
        (m.edited ? '<span class="tiny subtle">(edited)</span>' : '') +
        (m.pinned ? '<span class="badge brand">' + icon('pin') + 'Pinned</span>' : '') +
        (m.forwarded ? '<span class="badge">' + icon('forward') + 'Forwarded</span>' : '') +
        '</div>';
    }
    if (m.replyTo) {
      const src = (Store.msgs(c.id) || []).find(x => x.id === m.replyTo);
      if (src) {
        h += '<button class="reply-ref" data-jump="' + src.id + '">' + icon('reply') +
          '<span class="semi tiny">' + U.esc(Store.person(src.authorId).first) + '</span>' +
          '<span class="tiny muted truncate">' + U.esc((src.text || 'Attachment').slice(0, 110)) + '</span></button>';
      }
    }
    if (text) {
      h += '<div class="msg-text' + (bigEmoji ? ' big-emoji' : '') + '">' + U.renderRich(text) + '</div>';
      if (translated) h += '<button class="tiny link translate-note" data-show-original="' + m.id + '">' + icon('translate') + ' Translated from English · show original</button>';
    }
    if (m.voice) h += voiceHTML(m);
    if ((m.files || []).length) h += attachmentsHTML(m);
    if (m.poll) h += pollHTML(m);
    if (m.task) h += taskCardHTML(m);
    if (m.callInfo) h += callCardHTML(m);
    h += reactionsHTML(m);
    if (m.threadCount) {
      h += '<button class="thread-strip' + (m.resolved ? ' resolved' : '') + '" data-thread="' + m.id + '">' +
        UI.avatarStack(m.threadParticipants || [], 3, 20) +
        '<span class="semi tiny brand-text">' + U.plural(m.threadCount, 'reply', 'replies') + '</span>' +
        (m.resolved ? '<span class="badge success">' + icon('check') + 'Resolved</span>' : '') +
        '<span class="tiny subtle">Last reply ' + U.esc(U.ago(m.threadLast || m.ts)) + '</span>' +
        icon('chevronRight') + '</button>';
    }
    if (mine) h += '<div class="msg-status tiny subtle" data-status="' + m.id + '">' + statusIcon(m.status) + '</div>';
    h += '</div>';
    h += '<div class="msg-actions">' +
      REACT_QUICK.slice(0, 3).map(e => '<button class="ma-btn emoji" data-react="' + e + '" data-tip="React ' + e + '">' + e + '</button>').join('') +
      '<button class="ma-btn" data-ma="react" data-tip="Add reaction">' + icon('smile') + '</button>' +
      '<button class="ma-btn" data-ma="thread" data-tip="Reply in thread">' + icon('chats') + '</button>' +
      '<button class="ma-btn" data-ma="reply" data-tip="Reply">' + icon('reply') + '</button>' +
      '<button class="ma-btn" data-ma="save" data-tip="Save for later">' + icon('bookmark') + '</button>' +
      '<button class="ma-btn" data-ma="more" data-tip="More actions">' + icon('moreH') + '</button>' +
      '</div>';
    h += '</div>';
    return h;
  }

  function statusIcon(s) {
    if (s === 'failed') return '<span class="failed-status">' + icon('alertCircle') + ' Not delivered · <button class="link" data-retry-send>Retry</button></span>';
    if (s === 'sent') return icon('check') + ' Sent';
    if (s === 'delivered') return icon('check') + ' Delivered';
    return icon('checkCircle') + ' Read';
  }
  function updateStatuses(list, c) {
    (Store.msgs(c.id) || []).forEach(function (m) {
      const el = list.querySelector('[data-status="' + m.id + '"]');
      if (el && m.authorId === Store.state.meId) el.innerHTML = statusIcon(m.status);
    });
  }

  function reactionsHTML(m) {
    const keys = Object.keys(m.reactions || {}).filter(k => m.reactions[k].length);
    if (!keys.length) return '';
    return '<div class="reactions">' + keys.map(function (e) {
      const ids = m.reactions[e];
      const mine = ids.includes(Store.state.meId);
      const names = ids.slice(0, 6).map(i => Store.person(i).first).join(', ') + (ids.length > 6 ? ' and ' + (ids.length - 6) + ' more' : '');
      return '<button class="rx' + (mine ? ' mine' : '') + '" data-rx="' + e + '" data-tip="' + U.attr(names + ' reacted with ' + e) + '">' + e + '<b>' + ids.length + '</b></button>';
    }).join('') + '<button class="rx add" data-ma="react" data-tip="Add reaction">' + icon('smile') + '</button></div>';
  }

  function attachmentsHTML(m) {
    const files = (m.files || []).map(id => Store.file(id)).filter(Boolean);
    if (!files.length) return '';
    const images = files.filter(f => U.fileKind(f.name) === 'image');
    const others = files.filter(f => U.fileKind(f.name) !== 'image');
    let h = '';
    if (images.length) {
      h += '<div class="img-grid c' + Math.min(4, images.length) + '">' + images.map(function (f) {
        const bg = f.url ? 'background-image:url(' + f.url + ')' :
          (f.gif ? 'background:' + f.gif.grad : 'background:' + U.avColor(f.id));
        return '<button class="img-tile" data-preview="' + f.id + '" style="' + bg + '">' +
          (!f.url ? '<span class="img-ph">' + (f.gif ? f.gif.emoji : icon('image')) + '</span>' : '') +
          '<span class="img-meta">' + U.esc(f.name) + '</span></button>';
      }).join('') + '</div>';
    }
    if (others.length) {
      h += '<div class="file-atts">' + others.map(function (f) {
        return '<div class="file-att" data-preview="' + f.id + '">' + UI.fileGlyph(f.name, 40) +
          '<div class="grow min0"><div class="semi md truncate">' + U.esc(f.name) + '</div>' +
          '<div class="tiny muted">' + U.esc(U.fileMeta(f.name).label) + ' · ' + U.bytes(f.size) + (f.versions > 1 ? ' · v' + f.versions : '') + '</div></div>' +
          '<button class="icon-btn sm" data-fdl="' + f.id + '" data-tip="Download">' + icon('download') + '</button>' +
          '<button class="icon-btn sm" data-fmore="' + f.id + '" data-tip="More">' + icon('moreH') + '</button></div>';
      }).join('') + '</div>';
    }
    return h;
  }

  function voiceHTML(m) {
    const w = m.voice.wave || [];
    return '<div class="voice-msg" data-voice="' + m.id + '">' +
      '<button class="vm-play">' + icon('play') + '</button>' +
      '<div class="vm-wave">' + w.map(v => '<i style="height:' + Math.round(v * 100) + '%"></i>').join('') + '</div>' +
      '<span class="mono tiny">' + U.durSec(m.voice.seconds) + '</span>' +
      '<button class="icon-btn sm" data-vtranscribe="' + m.id + '" data-tip="Transcribe with AI">' + icon('captions') + '</button>' +
      '</div>';
  }

  function pollHTML(m) {
    const p = m.poll;
    const total = p.options.reduce((n, o) => n + o.votes.length, 0);
    const voted = p.options.some(o => o.votes.includes(Store.state.meId));
    return '<div class="poll-card">' +
      '<div class="row between"><div class="semi md">' + icon('poll') + ' ' + U.esc(p.question) + '</div>' +
      '<span class="tiny muted">' + (p.anonymous ? 'Anonymous · ' : '') + U.plural(total, 'vote') + '</span></div>' +
      '<div class="poll-opts">' + p.options.map(function (o, i) {
        const pct = total ? Math.round(o.votes.length / total * 100) : 0;
        const mine = o.votes.includes(Store.state.meId);
        return '<button class="poll-opt' + (mine ? ' mine' : '') + '" data-vote="' + m.id + ':' + i + '">' +
          '<span class="po-bar" style="width:' + (voted ? pct : 0) + '%"></span>' +
          '<span class="po-label">' + (mine ? icon('checkCircle') : icon('plus')) + U.esc(o.text) + '</span>' +
          (voted ? '<span class="po-pct tiny semi">' + pct + '%</span>' : '') + '</button>';
      }).join('') + '</div>' +
      (p.multi ? '<div class="tiny subtle mt-2">Multiple choices allowed</div>' : '') +
      '</div>';
  }

  function taskCardHTML(m) {
    const t = Store.task(m.task.id);
    if (!t) return '';
    return '<div class="task-card" data-task-open="' + t.id + '">' +
      '<div class="row gap-2"><span class="tc-ic">' + icon('tasks') + '</span>' +
      '<div class="grow min0"><div class="semi md truncate">' + U.esc(t.title) + '</div>' +
      '<div class="tiny muted">' + U.esc(Store.person(t.assigneeId).name) + ' · due ' + U.esc(U.dateShort(t.due)) + '</div></div>' +
      UI.statusBadge(t.status) + '</div></div>';
  }

  function callCardHTML(m) {
    const ci = m.callInfo;
    return '<div class="call-card">' + icon(ci.missed ? 'phoneMissed' : (ci.kind === 'video' ? 'video' : 'phone')) +
      '<div class="grow"><div class="semi md">' + (ci.missed ? 'Missed ' : '') + U.cap(ci.kind) + ' call</div>' +
      '<div class="tiny muted">' + (ci.missed ? 'No answer' : U.durSec(ci.durationSec) + ' · ' + U.plural(ci.participants || 2, 'participant')) + '</div></div>' +
      '<button class="btn sm" data-callback>' + icon('phone') + 'Call back</button></div>';
  }

  /* ------------------------------------------------------------------ */
  /* Message interactions                                               */
  /* ------------------------------------------------------------------ */
  function bindMessages(list, c) {
    U.qsa('[data-intro]', list).forEach(function (b) {
      b.onclick = function () {
        const k = b.dataset.intro;
        if (k === 'profile') Modals.personProfile(c.peerId);
        if (k === 'meet') Modals.scheduleMeeting({ participantIds: [c.peerId] });
        if (k === 'call') Calls.start({ cid: c.id, kind: 'video' });
        if (k === 'add') Modals.addMembers(c.id);
        if (k === 'edit') c.kind === 'channel' ? Modals.editChannel(c.id) : Modals.editGroup(c.id);
      };
    });
    U.qsa('[data-person-open]', list).forEach(b => b.onclick = () => Modals.personProfile(b.dataset.personOpen));
    U.qsa('[data-jump]', list).forEach(b => b.onclick = () => Chat.highlight(b.dataset.jump));
    U.qsa('[data-thread]', list).forEach(b => b.onclick = () => Threads.open(c.id, b.dataset.thread));
    U.qsa('[data-preview]', list).forEach(b => b.onclick = () => Modals.filePreview(b.dataset.preview));
    U.qsa('[data-fdl]', list).forEach(b => b.onclick = (e) => { e.stopPropagation(); Modals.downloadFile(b.dataset.fdl); });
    U.qsa('[data-fmore]', list).forEach(b => b.onclick = (e) => { e.stopPropagation(); Modals.fileMenu(b, b.dataset.fmore); });
    U.qsa('[data-task-open]', list).forEach(b => b.onclick = () => Modals.taskDetail(b.dataset.taskOpen));
    U.qsa('[data-callback]', list).forEach(b => b.onclick = () => Calls.start({ cid: c.id, kind: 'audio' }));
    U.qsa('[data-show-original]', list).forEach(function (b) {
      b.onclick = function () {
        const m = Store.msgs(c.id).find(x => x.id === b.dataset.showOriginal);
        UI.modal({ icon: 'translate', title: 'Original message', size: 'sm', body: '<div class="msg-text">' + U.renderRich(m.text) + '</div>', actions: [{ label: 'Close', variant: 'ghost' }] });
      };
    });
    U.qsa('[data-vtranscribe]', list).forEach(function (b) {
      b.onclick = function () {
        const m = Store.msgs(c.id).find(x => x.id === b.dataset.vtranscribe);
        const body = U.el('div');
        body.innerHTML = '<div class="ai-block"><div class="row gap-2 mb-2">' + icon('sparkles') + '<span class="semi md">Transcribing…</span></div><div class="md" data-tx></div></div>';
        UI.modal({ icon: 'captions', title: 'Voice message transcript', sub: U.durSec(m.voice.seconds) + ' · recorded ' + U.ago(m.ts), body: body, actions: [{ label: 'Close', variant: 'ghost' }] });
        AI.think(700).then(function () {
          body.querySelector('.semi').textContent = 'Transcript';
          AI.stream(body.querySelector('[data-tx]'), 'Quick thought on the routing work — I think we should pre-warm the graph per region rather than globally. It costs a little more but the first dispatch of the day is where dispatchers judge us. I will write it up properly in the RFC.');
        });
      };
    });

    U.qsa('.msg', list).forEach(function (el) {
      const mid = el.dataset.mid;
      const m = Store.msgs(c.id).find(x => x.id === mid);
      if (!m) return;
      U.qsa('[data-react]', el).forEach(b => b.onclick = (e) => { e.stopPropagation(); Store.toggleReaction(c.id, mid, b.dataset.react); });
      U.qsa('[data-rx]', el).forEach(b => b.onclick = (e) => { e.stopPropagation(); Store.toggleReaction(c.id, mid, b.dataset.rx); });
      U.qsa('[data-vote]', el).forEach(function (b) {
        b.onclick = function () {
          const [, i] = b.dataset.vote.split(':');
          votePoll(c.id, m, +i);
        };
      });
      U.qsa('[data-ma]', el).forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          const a = b.dataset.ma;
          if (a === 'react') return reactPicker(b, c.id, mid);
          if (a === 'thread') return Threads.open(c.id, mid);
          if (a === 'reply') return Chat.composer && Chat.composer.setReply(m);
          if (a === 'save') { const s = Store.toggleSave(mid); UI.toast(s ? 'Saved to Saved Items.' : 'Removed from Saved Items.', 'success'); App.renderShell(); return; }
          if (a === 'more') return msgMenu(b, c, m);
        };
      });
      el.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        msgMenu(null, c, m, { x: e.clientX, y: e.clientY });
      });
      const vm = el.querySelector('.vm-play');
      if (vm) vm.onclick = () => playVoice(el, m);
      const retry = el.querySelector('[data-retry-send]');
      if (retry) retry.onclick = () => { m.status = 'sent'; Store.emit('message:status', m); UI.toast('Message resent.', 'success'); };
    });
  }

  function votePoll(cid, m, i) {
    const p = m.poll;
    const me = Store.state.meId;
    if (!p.multi) p.options.forEach((o, j) => { if (j !== i) o.votes = o.votes.filter(v => v !== me); });
    const o = p.options[i];
    const at = o.votes.indexOf(me);
    if (at >= 0) o.votes.splice(at, 1); else o.votes.push(me);
    Store.emit('message:update', m); Store.persist();
  }

  function playVoice(el, m) {
    const btn = el.querySelector('.vm-play');
    const bars = U.qsa('.vm-wave i', el);
    if (el._vplay) { clearInterval(el._vplay); el._vplay = null; btn.innerHTML = icon('play'); bars.forEach(b => b.classList.remove('played')); return; }
    btn.innerHTML = icon('pause');
    let i = 0;
    el._vplay = setInterval(function () {
      if (i >= bars.length) { clearInterval(el._vplay); el._vplay = null; btn.innerHTML = icon('play'); bars.forEach(b => b.classList.remove('played')); return; }
      bars[i++].classList.add('played');
    }, Math.max(60, (m.voice.seconds * 1000) / bars.length));
  }

  function reactPicker(anchor, cid, mid) {
    const items = [];
    Object.keys(DATA.EMOJI_SETS).forEach(function (k) {
      items.push({ label: k, header: true });
      DATA.EMOJI_SETS[k].slice(0, 12).forEach(e => items.push({ label: e + '  ' + '', emoji: e, onClick: () => Store.toggleReaction(cid, mid, e) }));
    });
    const pop = UI.menu(anchor, [], { align: 'right', width: 268 });
    pop.el.innerHTML = '<div class="pop-body" style="max-height:300px;overflow:auto">' +
      Object.keys(DATA.EMOJI_SETS).map(k => '<div class="emoji-group"><div class="panel-title">' + k + '</div><div class="emoji-grid">' +
        DATA.EMOJI_SETS[k].map(e => '<button class="emoji-btn" data-e="' + e + '">' + e + '</button>').join('') + '</div></div>').join('') + '</div>';
    U.qsa('[data-e]', pop.el).forEach(b => b.onclick = () => { Store.toggleReaction(cid, mid, b.dataset.e); UI.closeMenu(); });
  }

  function msgMenu(anchor, c, m, pos) {
    const mine = m.authorId === Store.state.meId;
    const saved = Store.state.savedIds.includes(m.id);
    const items = [
      { label: 'Reply in thread', icon: 'chats', onClick: () => Threads.open(c.id, m.id) },
      { label: 'Reply inline', icon: 'reply', onClick: () => Chat.composer && Chat.composer.setReply(m) },
      { label: 'Forward…', icon: 'forward', onClick: () => Modals.forwardMessage(c.id, m.id) },
      { label: 'Quote in composer', icon: 'quote', onClick: () => Chat.composer && Chat.composer.setText('> ' + (m.text || '').split('\n').join('\n> ') + '\n\n') },
      { sep: true },
      { label: saved ? 'Remove from saved' : 'Save for later', icon: 'bookmark', onClick: () => { Store.toggleSave(m.id); UI.toast(saved ? 'Removed from Saved Items.' : 'Saved.', 'success'); App.renderShell(); } },
      { label: m.pinned ? 'Unpin from conversation' : 'Pin to conversation', icon: 'pin', onClick: () => { const p = Store.togglePin(c.id, m.id); UI.toast(p ? 'Message pinned.' : 'Message unpinned.', 'success'); App.renderShell(); } },
      { label: 'Copy text', icon: 'copy', onClick: () => UI.copyToast(m.text, 'Message copied.') },
      { label: 'Copy link', icon: 'link', onClick: () => UI.copyToast('https://northbeam.ithrive.app/' + c.id + '/' + m.id, 'Message link copied.') },
      { sep: true },
      { label: 'Create a task from this', icon: 'tasks', onClick: () => Modals.createTask({ title: U.esc(m.text).slice(0, 90).replace(/&#39;/g, "'"), source: c.id, description: 'Created from a message by ' + Store.person(m.authorId).name + ' in ' + Store.convTitle(c) + '.' }) },
      { label: 'Summarise with AI', icon: 'sparkles', onClick: () => AIPanel.summarizeMessage(c.id, m.id) },
      { label: 'Translate this message', icon: 'translate', onClick: () => translateOne(c.id, m) },
      { label: 'Remind me about this', icon: 'clock', onClick: () => Modals.reminder(c.id, m.id) }
    ];
    if (mine) {
      items.push({ sep: true },
        { label: 'Edit message', icon: 'edit', onClick: () => Chat.editMessage(m) },
        { label: 'Delete message', icon: 'trash', danger: true, onClick: function () {
          UI.confirm({ title: 'Delete this message?', body: 'This removes it for everyone in the conversation. This cannot be undone.', confirmLabel: 'Delete', danger: true })
            .then(ok => { if (ok) { Store.deleteMessage(c.id, m.id); UI.toast('Message deleted.', 'success'); } });
        } });
    } else {
      items.push({ sep: true }, { label: 'Report message', icon: 'flag', danger: true, onClick: () => Modals.reportMessage(c.id, m.id) });
    }
    UI.menu(anchor, items, Object.assign({ align: 'right', width: 250 }, pos ? { x: pos.x, y: pos.y } : {}));
  }

  function translateOne(cid, m) {
    UI.menu(null, AI.languages.map(l => ({ label: l, icon: 'globe', onClick: function () {
      UI.modal({ icon: 'translate', title: 'Translated to ' + l, size: 'sm',
        body: '<div class="ai-block"><div class="msg-text">' + U.renderRich(AI.translate(m.text, l)) + '</div></div>' +
              '<div class="tiny subtle">Original: ' + U.esc(m.text) + '</div>',
        actions: [{ label: 'Copy translation', variant: 'ghost', onClick: () => UI.copyToast(AI.translate(m.text, l), 'Translation copied.') }, { label: 'Close', variant: 'primary' }] });
    } })), { x: window.innerWidth / 2 - 120, y: 120 });
  }

  Chat.editMessage = function (m) {
    UI.prompt({ title: 'Edit message', label: 'Message', multiline: true, value: m.text, icon: 'edit', confirmLabel: 'Save changes' })
      .then(function (v) {
        if (v == null) return;
        if (!v.trim()) { UI.toast('Message cannot be empty. Delete it instead.', 'warn'); return; }
        Store.editMessage(m.convId, m.id, v);
        UI.toast('Message updated.', 'success');
      });
  };

  Chat.highlight = function (mid) {
    const el = document.getElementById('m-' + mid);
    if (!el) { UI.toast('That message is not in the current view.', 'info'); return; }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1600);
  };

  /* ------------------------------------------------------------------ */
  /* Quick replies + simulated peer activity                            */
  /* ------------------------------------------------------------------ */
  function renderQuickReplies(c) {
    const host = document.getElementById('quick-replies');
    if (!host) return;
    if (!Store.state.prefs.aiSummaries) { host.hidden = true; return; }
    const msgs = (Store.msgs(c.id) || []).filter(m => !m.system && !m.deleted);
    const last = msgs[msgs.length - 1];
    if (!last || last.authorId === Store.state.meId || !last.text) { host.hidden = true; return; }
    const opts = suggestReplies(last.text);
    host.hidden = false;
    host.innerHTML = '<span class="qr-label tiny">' + icon('sparkles') + 'Suggested</span>' +
      opts.map(o => '<button class="qr-chip" data-qr="' + U.attr(o) + '">' + U.esc(o) + '</button>').join('') +
      '<button class="qr-chip ghost" data-qr-more>' + icon('edit') + 'Draft with AI</button>';
    U.qsa('[data-qr]', host).forEach(b => b.onclick = () => { Chat.composer.setText(b.dataset.qr); host.hidden = true; });
    host.querySelector('[data-qr-more]').onclick = function () {
      Chat.composer.setText(AI.draft('reply', { cid: c.id }));
      host.hidden = true;
    };
  }
  function suggestReplies(text) {
    const l = text.toLowerCase();
    if (/\?$/.test(text.trim())) {
      if (/when|what time|deadline|by when/.test(l)) return ['Let me check and confirm today.', 'End of this week works.', 'Can we say Thursday?'];
      if (/can you|could you|would you|are you able/.test(l)) return ['Yes, I can take that.', 'Yes — I will have it by tomorrow.', 'Not this week, but I can next.'];
      if (/should we|do you think|thoughts|opinion/.test(l)) return ['Agreed, let us do that.', 'I would go the other way — happy to explain.', 'Let me think and come back to you.'];
      return ['Yes, that works.', 'Let me check and get back to you.', 'Can we discuss on a quick call?'];
    }
    if (/thank|thanks|appreciate/.test(l)) return ['Anytime.', 'Happy to help.', 'Thank you too.'];
    if (/done|finished|complete|shipped|merged|deployed|green/.test(l)) return ['Great work.', 'Excellent — thank you.', 'Nice one 🎉'];
    if (/blocked|risk|issue|failing|delay|problem/.test(l)) return ['What do you need from me to unblock it?', 'Let us get on a call.', 'Understood — I will escalate.'];
    if (/sorry|apolog/.test(l)) return ['No problem at all.', 'Thanks for flagging it.'];
    return ['Thanks — noted.', 'Sounds good.', 'Let me take a look and come back.'];
  }

  const PEER_REPLIES = {
    question: ['Good question — let me check and come back to you within the hour.', 'Yes, that is right. I will put the detail in the doc so it is searchable.', 'I think so, but let me confirm with the team before you rely on it.'],
    thanks: ['Anytime.', 'Happy to help.', 'No trouble at all.'],
    ack: ['Got it, thank you.', 'Noted — I will pick that up.', 'Understood. I will update the plan.'],
    positive: ['That is great news.', 'Excellent — thanks for the update.', 'Really pleased with that.'],
    default: ['Thanks — I will take a look shortly.', 'Makes sense to me.', 'Agreed. I will follow up in the thread.', 'Understood. Anything you need from my side?']
  };

  function maybeReply(c, myMsg) {
    if (c.kind !== 'dm') return;
    const peer = Store.person(c.peerId);
    if (['offline', 'dnd'].includes(peer.presence)) return;
    if (Math.random() > 0.72) return;
    const typing = document.getElementById('typing-row');
    if (!typing) return;
    setTimeout(function () {
      if (Chat.cid !== c.id) return;
      typing.hidden = false;
      typing.innerHTML = UI.avatar(peer, 22) + '<span class="tiny muted">' + U.esc(peer.first) + ' is typing</span><span class="dots"><i></i><i></i><i></i></span>';
      setTimeout(function () {
        typing.hidden = true;
        if (Chat.cid !== c.id) return;
        const l = (myMsg.text || '').toLowerCase();
        const bucket = /\?$/.test((myMsg.text || '').trim()) ? 'question' :
          /thank|thanks/.test(l) ? 'thanks' :
            /done|shipped|great|nice|congrat/.test(l) ? 'positive' :
              /ok|okay|sure|will do|noted/.test(l) ? 'ack' : 'default';
        const text = U.sample(PEER_REPLIES[bucket]);
        const m = {
          id: U.uid('m'), convId: c.id, authorId: c.peerId, ts: new Date().toISOString(),
          text: text, files: [], reactions: {}, status: 'read', threadCount: 0, threadParticipants: []
        };
        Store.msgs(c.id).push(m);
        Store.persist();
        if (Chat.cid === c.id) {
          const list = document.getElementById('msg-list');
          if (list) { list.innerHTML = renderMessages(c); bindMessages(list, c); U.scrollBottom(document.getElementById('msg-scroll'), true); renderQuickReplies(c); }
        }
      }, 1500 + Math.random() * 1800);
    }, 900 + Math.random() * 1200);
  }

  /* ------------------------------------------------------------------ */
  /* Right contextual panel                                             */
  /* ------------------------------------------------------------------ */
  Chat.panel = function (host, tab) {
    const c = Store.conv(Chat.cid);
    if (!c) { host.innerHTML = ''; return; }
    Chat.panelTab = tab || Chat.panelTab || 'info';
    const tabs = [
      { id: 'info', label: 'About', icon: 'info' },
      { id: 'members', label: 'People', icon: 'users' },
      { id: 'files', label: 'Files', icon: 'folder' },
      { id: 'pinned', label: 'Pinned', icon: 'pin' },
      { id: 'threads', label: 'Threads', icon: 'chats' }
    ];
    host.innerHTML =
      '<div class="rp-head"><h4>' + U.esc(Store.convTitle(c)) + '</h4>' +
      '<button class="icon-btn" data-rp-close>' + icon('x') + '</button></div>' +
      '<div class="rp-tabs">' + tabs.map(t => '<button class="rp-tab' + (t.id === Chat.panelTab ? ' on' : '') + '" data-rptab="' + t.id + '" data-tip="' + t.label + '">' + icon(t.icon) + '</button>').join('') + '</div>' +
      '<div class="rp-body" id="rp-body"></div>';
    host.querySelector('[data-rp-close]').onclick = () => App.togglePanel(false);
    U.qsa('[data-rptab]', host).forEach(b => b.onclick = () => Chat.panel(host, b.dataset.rptab));
    const body = host.querySelector('#rp-body');
    ({ info: panelInfo, members: panelMembers, files: panelFiles, pinned: panelPinned, threads: panelThreads }[Chat.panelTab] || panelInfo)(body, c);
  };

  function panelInfo(body, c) {
    let h = '';
    if (c.kind === 'dm') {
      const p = Store.person(c.peerId);
      h += '<div class="panel-section text-center">' + UI.avatar(p, 76) +
        '<h4 class="mt-3">' + U.esc(p.name) + '</h4>' +
        '<div class="md muted">' + U.esc(p.title) + '</div>' +
        (p.statusText ? '<div class="chip mt-2" style="margin:8px auto 0">' + (p.statusEmoji || '') + ' ' + U.esc(p.statusText) + '</div>' : '') +
        '<div class="row gap-2 center mt-4">' +
        '<button class="btn sm" data-p="call">' + icon('phone') + 'Call</button>' +
        '<button class="btn sm" data-p="video">' + icon('video') + 'Video</button>' +
        '<button class="btn sm" data-p="meet">' + icon('calendarPlus') + 'Schedule</button>' +
        '</div></div>' +
        '<div class="panel-section"><div class="panel-title">Contact</div>' +
        kv('Department', Store.dept(p.deptId).name) + kv('Team', (Store.team(p.teamId) || {}).name || '—') +
        kv('Manager', p.managerId ? Store.person(p.managerId).name : '—') +
        kv('Location', p.location) + kv('Time zone', p.tz) +
        kv('Email', p.email) + kv('Phone', p.phone) +
        '</div>' +
        '<div class="panel-section"><div class="panel-title">Skills</div><div class="chip-row">' +
        (p.skills || []).map(s => '<span class="chip">' + U.esc(s) + '</span>').join('') + '</div></div>';
    } else {
      h += '<div class="panel-section">' +
        '<div class="panel-title">' + (c.kind === 'channel' ? 'Topic' : 'Description') + '</div>' +
        '<p class="md">' + U.esc((c.kind === 'channel' ? c.topic : c.description) || 'Not set yet.') + '</p>' +
        (c.purpose ? '<p class="tiny muted mt-2">' + U.esc(c.purpose) + '</p>' : '') +
        '<button class="btn sm ghost mt-3" data-p="edit">' + icon('edit') + 'Edit</button></div>' +
        '<div class="panel-section"><div class="panel-title">Details</div>' +
        kv('Type', U.titleCase(c.type || c.kind)) +
        kv('Created', U.dateShort(c.createdAt) + ' by ' + Store.person(c.createdBy).first) +
        kv('Members', String(c.memberIds.length)) +
        kv('Messages', String((Store.msgs(c.id) || []).length)) +
        (c.expiresAt ? kv('Expires', U.dateShort(c.expiresAt)) : '') +
        (c.deptId ? kv('Department', Store.dept(c.deptId).name) : '') +
        '</div>';
    }
    h += '<div class="panel-section"><div class="panel-title">Thrive AI</div>' +
      '<button class="btn soft block" data-p="summary">' + icon('sparkles') + 'Summarise this conversation</button>' +
      '<button class="btn ghost block mt-2" data-p="actions">' + icon('listChecks') + 'Extract action items</button>' +
      '<button class="btn ghost block mt-2" data-p="ask">' + icon('aiChat') + 'Ask a question about it</button></div>';
    h += '<div class="panel-section"><div class="panel-title">Settings</div>' +
      UI.switchRow('Mute notifications', 'Stop desktop and mobile alerts', c.muted, 'mute') +
      UI.switchRow(c.kind === 'channel' ? 'Favourite' : 'Pin to top', 'Keep it at the top of your sidebar', c.kind === 'channel' ? c.favorite : c.pinned, 'fav') +
      '</div>';
    if (c.kind !== 'dm') {
      h += '<div class="panel-section"><button class="btn danger-ghost block" data-p="leave">' + icon('logout') + 'Leave ' + (c.kind === 'channel' ? 'channel' : 'group') + '</button></div>';
    }
    body.innerHTML = h;
    UI.bindSwitches(body, function (k) {
      if (k === 'mute') Store.toggleMute(c.id);
      if (k === 'fav') Store.toggleFavorite(c.id);
      App.renderSidebar();
    });
    U.qsa('[data-p]', body).forEach(function (b) {
      b.onclick = function () {
        const k = b.dataset.p;
        if (k === 'call') Calls.start({ cid: c.id, kind: 'audio' });
        if (k === 'video') Calls.start({ cid: c.id, kind: 'video' });
        if (k === 'meet') Modals.scheduleMeeting({ participantIds: c.kind === 'dm' ? [c.peerId] : c.memberIds.slice(0, 8) });
        if (k === 'edit') c.kind === 'channel' ? Modals.editChannel(c.id) : Modals.editGroup(c.id);
        if (k === 'summary') AIPanel.summarize(c.id);
        if (k === 'actions') AIPanel.actions(c.id);
        if (k === 'ask') AIPanel.ask(c.id);
        if (k === 'leave') {
          UI.confirm({ title: 'Leave ' + Store.convTitle(c) + '?', body: 'You will stop receiving messages from this conversation.', confirmLabel: 'Leave', danger: true })
            .then(ok => { if (ok) { Store.leaveConv(c.id); App.route('#/messages'); } });
        }
      };
    });
  }
  function kv(k, v) {
    return '<div class="kv"><span class="tiny muted">' + U.esc(k) + '</span><span class="md semi text-right">' + U.esc(v) + '</span></div>';
  }

  function panelMembers(body, c) {
    const admins = c.adminIds || [];
    const sorted = U.sortBy(c.memberIds, id => (admins.includes(id) ? 0 : 1) + Store.person(id).name);
    body.innerHTML = '<div class="panel-section">' +
      '<div class="row between mb-3"><div class="panel-title" style="margin:0">' + U.plural(c.memberIds.length, 'member') + '</div>' +
      (c.kind !== 'dm' ? '<button class="btn sm soft" data-add>' + icon('userPlus') + 'Add</button>' : '') + '</div>' +
      '<div class="input-wrap mb-3">' + icon('search') + '<input class="input" data-msearch placeholder="Search members"></div>' +
      '<div data-mlist>' + sorted.map(memberRow).join('') + '</div></div>';
    function memberRow(id) {
      const p = Store.person(id);
      return '<div class="lrow member-row" data-member="' + id + '">' + UI.avatar(p, 32) +
        '<div class="grow min0"><div class="semi md truncate">' + U.esc(p.name) + (id === Store.state.meId ? ' <span class="tiny subtle">(you)</span>' : '') + '</div>' +
        '<div class="tiny muted truncate">' + U.esc(p.title) + '</div></div>' +
        (admins.includes(id) ? '<span class="badge brand">Admin</span>' : '') +
        '<button class="icon-btn sm" data-mmenu="' + id + '">' + icon('moreH') + '</button></div>';
    }
    const add = body.querySelector('[data-add]');
    if (add) add.onclick = () => Modals.addMembers(c.id);
    body.querySelector('[data-msearch]').addEventListener('input', function (e) {
      const q = e.target.value.toLowerCase();
      body.querySelector('[data-mlist]').innerHTML = sorted.filter(id => Store.person(id).name.toLowerCase().includes(q) || Store.person(id).title.toLowerCase().includes(q)).map(memberRow).join('');
      bindRows();
    });
    function bindRows() {
      U.qsa('[data-member]', body).forEach(function (r) {
        r.onclick = (e) => { if (!e.target.closest('[data-mmenu]')) Modals.personProfile(r.dataset.member); };
      });
      U.qsa('[data-mmenu]', body).forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          const id = b.dataset.mmenu;
          const isAdmin = admins.includes(id);
          const canManage = c.kind !== 'dm' && admins.includes(Store.state.meId);
          UI.menu(b, [
            { label: 'View profile', icon: 'contacts', onClick: () => Modals.personProfile(id) },
            { label: 'Send a message', icon: 'chat', onClick: () => App.openDM(id) },
            { label: 'Start a call', icon: 'phone', onClick: () => Calls.start({ peerIds: [id], kind: 'audio' }) },
            { sep: true },
            { label: isAdmin ? 'Remove as admin' : 'Make admin', icon: 'shield', disabled: !canManage, onClick: () => { const a = Store.toggleAdmin(c.id, id); UI.toast(a ? 'Promoted to admin.' : 'Admin rights removed.', 'success'); Chat.panel(body.closest('.rpanel'), 'members'); } },
            { label: 'Remove from ' + (c.kind === 'channel' ? 'channel' : 'group'), icon: 'userX', danger: true, disabled: !canManage || id === Store.state.meId, onClick: function () {
              UI.confirm({ title: 'Remove ' + Store.person(id).name + '?', body: 'They will lose access to this conversation and its history.', confirmLabel: 'Remove', danger: true })
                .then(ok => { if (ok) { Store.removeMember(c.id, id); UI.toast('Member removed.', 'success'); App.renderShell(); } });
            } }
          ], { align: 'right' });
        };
      });
    }
    bindRows();
  }

  function panelFiles(body, c) {
    const ids = U.uniq((Store.msgs(c.id) || []).flatMap(m => m.files || []));
    const files = ids.map(id => Store.file(id)).filter(Boolean).reverse();
    const cats = [
      { id: 'all', label: 'All' }, { id: 'image', label: 'Images' }, { id: 'video', label: 'Videos' },
      { id: 'document', label: 'Docs' }, { id: 'audio', label: 'Audio' }, { id: 'link', label: 'Links' }
    ];
    let cat = 'all';
    function draw() {
      const links = [];
      (Store.msgs(c.id) || []).forEach(function (m) {
        (String(m.text || '').match(/https?:\/\/[^\s]+/g) || []).forEach(u => links.push({ url: u, m }));
      });
      let inner;
      if (cat === 'link') {
        inner = links.length ? '<div class="mini-list">' + links.map(l =>
          '<a class="lrow" href="' + U.attr(l.url) + '" target="_blank" rel="noopener">' + icon('link') +
          '<span class="grow min0"><span class="md semi truncate block">' + U.esc(l.url.replace(/^https?:\/\//, '')) + '</span>' +
          '<span class="tiny muted">' + U.esc(Store.person(l.m.authorId).first) + ' · ' + U.esc(U.ago(l.m.ts)) + '</span></span></a>').join('') + '</div>'
          : UI.empty({ icon: 'link', title: 'No links shared', desc: 'Links posted in this conversation will collect here.', tone: 'neutral' });
      } else {
        const list = cat === 'all' ? files : files.filter(f => U.fileKind(f.name) === cat);
        if (!list.length) {
          inner = UI.empty({ icon: 'folder', title: 'Nothing here yet', desc: 'Files shared in this conversation appear here, grouped by type.', tone: 'neutral' });
        } else if (cat === 'image') {
          inner = '<div class="media-grid">' + list.map(f => '<button class="media-tile" data-preview="' + f.id + '" style="' + (f.url ? 'background-image:url(' + f.url + ')' : 'background:' + U.avColor(f.id)) + '">' + (!f.url ? '<span>' + icon('image') + '</span>' : '') + '</button>').join('') + '</div>';
        } else {
          inner = '<div class="mini-list">' + list.map(f => UI.fileRow(f)).join('') + '</div>';
        }
      }
      body.innerHTML = '<div class="panel-section"><div class="chip-row mb-3">' +
        cats.map(x => '<button class="chip' + (x.id === cat ? ' on' : '') + '" data-cat="' + x.id + '">' + x.label + '</button>').join('') +
        '</div>' + inner + '</div>';
      U.qsa('[data-cat]', body).forEach(b => b.onclick = () => { cat = b.dataset.cat; draw(); });
      U.qsa('[data-preview]', body).forEach(b => b.onclick = () => Modals.filePreview(b.dataset.preview));
      U.qsa('[data-file]', body).forEach(function (r) {
        r.onclick = (e) => {
          const a = e.target.closest('[data-fact]');
          if (!a) { Modals.filePreview(r.dataset.file); return; }
          if (a.dataset.fact === 'preview') Modals.filePreview(r.dataset.file);
          if (a.dataset.fact === 'download') Modals.downloadFile(r.dataset.file);
          if (a.dataset.fact === 'more') Modals.fileMenu(a, r.dataset.file);
        };
      });
    }
    draw();
  }

  function panelPinned(body, c) {
    const pins = (Store.msgs(c.id) || []).filter(m => m.pinned && !m.deleted);
    if (!pins.length) {
      UI.emptyInto(body, { icon: 'pin', title: 'Nothing pinned yet', desc: 'Pin decisions, links and key context so new members can find them instantly.', tone: 'neutral' });
      return;
    }
    body.innerHTML = '<div class="panel-section">' + pins.map(function (m) {
      return '<div class="pin-card" data-jump="' + m.id + '">' +
        '<div class="row gap-2 mb-2">' + UI.avatar(m.authorId, 24) +
        '<span class="semi tiny">' + U.esc(Store.person(m.authorId).name) + '</span>' +
        '<span class="tiny subtle">' + U.esc(U.dateShort(m.ts)) + '</span>' +
        '<button class="icon-btn sm" style="margin-left:auto" data-unpin="' + m.id + '" data-tip="Unpin">' + icon('x') + '</button></div>' +
        '<div class="md clamp-3">' + U.renderRich(m.text) + '</div>' +
        ((m.files || []).length ? '<div class="tiny muted mt-2">' + icon('paperclip') + ' ' + U.plural(m.files.length, 'attachment') + '</div>' : '') +
        '</div>';
    }).join('') + '</div>';
    U.qsa('[data-jump]', body).forEach(b => b.onclick = (e) => { if (!e.target.closest('[data-unpin]')) Chat.highlight(b.dataset.jump); });
    U.qsa('[data-unpin]', body).forEach(b => b.onclick = (e) => { e.stopPropagation(); Store.togglePin(c.id, b.dataset.unpin); App.renderShell(); UI.toast('Message unpinned.', 'success'); });
  }

  function panelThreads(body, c) {
    const threads = (Store.msgs(c.id) || []).filter(m => m.threadCount > 0);
    if (!threads.length) {
      UI.emptyInto(body, { icon: 'chats', title: 'No threads yet', desc: 'Threads keep detailed discussion out of the main channel. Hover any message and choose “Reply in thread”.', tone: 'neutral' });
      return;
    }
    body.innerHTML = '<div class="panel-section">' + threads.map(function (m) {
      return '<button class="thread-card" data-topen="' + m.id + '">' +
        '<div class="row gap-2 mb-2">' + UI.avatar(m.authorId, 24) +
        '<span class="semi tiny">' + U.esc(Store.person(m.authorId).first) + '</span>' +
        (m.resolved ? '<span class="badge success">Resolved</span>' : '') +
        (m.following ? '<span class="badge">Following</span>' : '') +
        '<span class="tiny subtle" style="margin-left:auto">' + U.esc(U.ago(m.threadLast || m.ts)) + '</span></div>' +
        '<div class="md clamp-2 text-left">' + U.esc(m.text) + '</div>' +
        '<div class="row gap-2 mt-2">' + UI.avatarStack(m.threadParticipants || [], 3, 18) +
        '<span class="tiny brand-text semi">' + U.plural(m.threadCount, 'reply', 'replies') + '</span></div></button>';
    }).join('') + '</div>';
    U.qsa('[data-topen]', body).forEach(b => b.onclick = () => Threads.open(c.id, b.dataset.topen));
  }

  g.Chat = Chat;
})(window);
