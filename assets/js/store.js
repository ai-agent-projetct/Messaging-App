/* ===== iThrive — Application state store ===== */
(function (g) {
  const D = g.DATA;
  const SEED_VERSION = 'v1.0.0';

  const listeners = {};
  const Store = {
    state: null,

    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return () => Store.off(evt, fn); },
    off(evt, fn) { if (listeners[evt]) listeners[evt] = listeners[evt].filter(f => f !== fn); },
    emit(evt, payload) {
      (listeners[evt] || []).forEach(f => { try { f(payload); } catch (e) { console.error(e); } });
      if (evt !== '*') (listeners['*'] || []).forEach(f => { try { f(evt, payload); } catch (e) {} });
    }
  };

  /* ---------------- Build seed state ---------------- */
  function buildConversations() {
    const convs = {};
    D.DMS.forEach(function (dm) {
      const peer = D.PMAP[dm.peerId];
      convs[dm.id] = {
        id: dm.id, kind: 'dm', peerId: dm.peerId, name: peer.name,
        memberIds: [D.ME, dm.peerId], pinned: dm.pinned, muted: false,
        unread: 0, mentions: 0, typing: false, draft: '', lastRead: null, archived: false
      };
    });
    D.GROUPS.forEach(function (grp) {
      convs[grp.id] = {
        id: grp.id, kind: 'group', name: grp.name, description: grp.description,
        memberIds: grp.memberIds.slice(), adminIds: grp.adminIds.slice(), type: grp.type,
        emoji: grp.emoji, createdAt: grp.createdAt, createdBy: grp.createdBy,
        pinned: false, muted: false, unread: 0, mentions: 0, draft: '', archived: false
      };
    });
    D.CHANNELS.forEach(function (ch) {
      convs[ch.id] = {
        id: ch.id, kind: 'channel', name: ch.name, type: ch.type, topic: ch.topic,
        purpose: ch.purpose, deptId: ch.deptId, memberIds: ch.memberIds.slice(),
        adminIds: ch.adminIds.slice(), createdBy: ch.createdBy, createdAt: ch.createdAt,
        favorite: !!ch.favorite, muted: !!ch.muted, archived: !!ch.archived,
        readOnly: !!ch.readOnly, expiresAt: ch.expiresAt || null,
        unread: 0, mentions: 0, draft: '', bookmarks: defaultBookmarks(ch.id)
      };
    });
    return convs;
  }

  function defaultBookmarks(cid) {
    const map = {
      'c-apollo': [
        { id: 'bm1', label: 'Launch doc', icon: 'fileText' },
        { id: 'bm2', label: 'Architecture RFC', icon: 'code' },
        { id: 'bm3', label: 'Beta dashboard', icon: 'chart' }
      ],
      'c-launch': [
        { id: 'bm4', label: 'Checklist', icon: 'listChecks' },
        { id: 'bm5', label: 'Press kit', icon: 'megaphone' }
      ],
      'c-engineering': [{ id: 'bm6', label: 'Runbooks', icon: 'bookOpen' }],
      'c-design': [{ id: 'bm7', label: 'Design system', icon: 'palette' }]
    };
    return map[cid] || [];
  }

  function buildMessages() {
    const msgs = {};
    const threads = {};
    Object.keys(D.SCRIPTS).forEach(function (cid) {
      msgs[cid] = D.SCRIPTS[cid].map(function (row, i) {
        const extra = row[3] || {};
        const id = cid + '_m' + i;
        const m = {
          id: id, convId: cid, authorId: row[0], ts: D.t(row[1]),
          text: row[2] || '', files: (extra.files || []).slice(),
          reactions: extra.reactions ? JSON.parse(JSON.stringify(extra.reactions)) : {},
          pinned: !!extra.pinned, saved: false, edited: false, deleted: false,
          replyTo: extra.replyTo || null, poll: extra.poll || null, task: extra.task || null,
          system: extra.system || null, callInfo: extra.call || null,
          status: 'read', threadCount: 0, threadParticipants: [], forwarded: extra.forwarded || null,
          voice: extra.voice || null
        };
        return m;
      });
    });
    Object.keys(D.THREAD_SCRIPTS).forEach(function (key) {
      const parts = key.split(':');
      const cid = parts[0], idx = parseInt(parts[1], 10);
      const list = msgs[cid];
      if (!list || !list[idx]) return;
      const parent = list[idx];
      const replies = D.THREAD_SCRIPTS[key].map(function (row, i) {
        return {
          id: parent.id + '_t' + i, convId: cid, parentId: parent.id, authorId: row[0],
          ts: D.t(row[1]), text: row[2] || '', files: (row[3] && row[3].files) || [],
          reactions: (row[3] && row[3].reactions) || {}, edited: false, deleted: false
        };
      });
      threads[parent.id] = replies;
      parent.threadCount = replies.length;
      parent.threadParticipants = U.uniq(replies.map(r => r.authorId));
      parent.threadLast = replies[replies.length - 1].ts;
      parent.resolved = false;
      parent.following = replies.some(r => r.authorId === D.ME) || parent.authorId === D.ME;
    });
    /* Generated filler for channels without explicit scripts */
    Object.keys(msgs).forEach(function (cid) {
      msgs[cid].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    });
    return { msgs, threads };
  }

  function buildUnread(state) {
    const cfg = {
      'd-p10': { unread: 2, mentions: 0 }, 'd-p8': { unread: 1, mentions: 0 },
      'd-p21': { unread: 1, mentions: 0 }, 'd-p28': { unread: 1, mentions: 0 },
      'c-apollo': { unread: 6, mentions: 1 }, 'c-engineering': { unread: 3, mentions: 0 },
      'c-general': { unread: 2, mentions: 0 }, 'c-launch': { unread: 4, mentions: 1 },
      'g-launch-war': { unread: 2, mentions: 0 }, 'c-design': { unread: 2, mentions: 0 },
      'c-feedback': { unread: 1, mentions: 1 }, 'c-wins': { unread: 3, mentions: 0 },
      'c-random': { unread: 5, mentions: 0 }, 'g-apollo': { unread: 1, mentions: 0 }
    };
    Object.keys(cfg).forEach(function (id) {
      if (state.conversations[id]) {
        state.conversations[id].unread = cfg[id].unread;
        state.conversations[id].mentions = cfg[id].mentions;
      }
    });
  }

  function buildSeed() {
    const built = buildMessages();
    const state = {
      seed: SEED_VERSION,
      meId: D.ME,
      workspaceId: 'org_northbeam',
      conversations: buildConversations(),
      messages: built.msgs,
      threads: built.threads,
      people: JSON.parse(JSON.stringify(D.PEOPLE)),
      tasks: JSON.parse(JSON.stringify(D.TASKS)),
      files: JSON.parse(JSON.stringify(D.FILES)),
      folders: JSON.parse(JSON.stringify(D.FOLDERS)),
      meetings: JSON.parse(JSON.stringify(D.MEETINGS)),
      events: JSON.parse(JSON.stringify(D.PERSONAL_EVENTS)),
      calls: JSON.parse(JSON.stringify(D.CALLS)),
      announcements: JSON.parse(JSON.stringify(D.ANNOUNCEMENTS)),
      notifications: JSON.parse(JSON.stringify(D.NOTIFICATIONS)),
      integrations: JSON.parse(JSON.stringify(D.INTEGRATIONS)),
      audit: JSON.parse(JSON.stringify(D.AUDIT)),
      sessions: JSON.parse(JSON.stringify(D.SESSIONS)),
      invitations: JSON.parse(JSON.stringify(D.INVITATIONS)),
      savedIds: ['c-apollo_m4', 'c-design_m2', 'd-p10_m6'],
      recentSearches: ['apollo load test', 'benefits enrolment', 'from:Priya routing', 'dispatch board v4'],
      myPresence: 'available',
      myStatus: { text: 'Shipping Apollo v2', emoji: '🚀', until: null },
      dnd: false,
      prefs: {
        theme: 'light', accent: 'jade', density: 'default',
        desktopNotif: true, mobileNotif: true, emailNotif: false, sound: true,
        notifSchedule: { enabled: false, from: '08:00', to: '20:00' },
        enterToSend: true, showPreviews: true, compactSidebar: false,
        aiSummaries: true, aiSmartNotif: true, aiTranslate: true, language: 'English (UK)',
        readReceipts: true, animations: true
      },
      onboarded: false,
      unreadThreads: ['c-apollo_m2', 'c-engineering_m3'],
      pendingUploads: []
    };
    buildUnread(state);
    return state;
  }

  /* ---------------- Persistence ---------------- */
  const KEY = 'state';
  function persist() {
    try { U.store.set(KEY, Store.state); } catch (e) { console.warn('persist failed', e); }
  }
  Store.persist = U.debounce(persist, 400);

  Store.load = function () {
    const saved = U.store.get(KEY, null);
    if (saved && saved.seed === SEED_VERSION) {
      Store.state = saved;
    } else {
      Store.state = buildSeed();
      persist();
    }
    return Store.state;
  };
  Store.reset = function () {
    U.store.del(KEY);
    Store.state = buildSeed();
    persist();
    Store.emit('reset');
  };

  /* ---------------- Selectors ---------------- */
  Store.me = () => Store.state.people.find(p => p.id === Store.state.meId);
  Store.person = (id) => Store.state.people.find(p => p.id === id) || { id: id, name: 'Unknown', initials: '?', title: '', presence: 'offline' };
  Store.people = () => Store.state.people;
  Store.conv = (id) => Store.state.conversations[id];
  Store.convs = () => Object.values(Store.state.conversations);
  Store.msgs = (cid) => Store.state.messages[cid] || (Store.state.messages[cid] = []);
  Store.thread = (mid) => Store.state.threads[mid] || [];
  Store.dept = (id) => D.DEPARTMENTS.find(d => d.id === id) || { name: '—', color: '#64748b', icon: 'briefcase' };
  Store.team = (id) => D.TEAMS.find(x => x.id === id);
  Store.file = (id) => Store.state.files.find(f => f.id === id);
  Store.task = (id) => Store.state.tasks.find(x => x.id === id);
  Store.meeting = (id) => Store.state.meetings.find(m => m.id === id);

  Store.lastMsg = function (cid) {
    const m = Store.state.messages[cid];
    return m && m.length ? m[m.length - 1] : null;
  };
  Store.convTitle = function (c) {
    if (!c) return '';
    if (c.kind === 'dm') return Store.person(c.peerId).name;
    if (c.kind === 'channel') return '#' + c.name;
    return c.name;
  };
  Store.totalUnread = function () {
    return Store.convs().reduce((n, c) => n + (c.archived ? 0 : c.unread), 0);
  };
  Store.unreadNotifs = () => Store.state.notifications.filter(n => !n.read).length;
  Store.myTasks = () => Store.state.tasks.filter(t => t.assigneeId === Store.state.meId);
  Store.upcomingMeetings = function (limit) {
    const now = Date.now();
    return Store.state.meetings
      .filter(m => new Date(m.end).getTime() > now)
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, limit || 50);
  };
  Store.mentionsFeed = function () {
    return Store.state.notifications.filter(n => n.type === 'mention' || n.type === 'thread');
  };
  Store.savedMessages = function () {
    const out = [];
    Store.state.savedIds.forEach(function (id) {
      Object.keys(Store.state.messages).forEach(function (cid) {
        const m = Store.state.messages[cid].find(x => x.id === id);
        if (m) out.push(m);
      });
    });
    return out.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  };
  Store.canPost = function (c) {
    if (!c) return false;
    if (c.archived) return false;
    if (c.kind === 'channel' && c.readOnly) {
      const me = Store.me();
      return ['Owner', 'Super Admin', 'Admin', 'Manager'].includes(me.role) || (c.adminIds || []).includes(me.id);
    }
    return true;
  };
  Store.isAdmin = function () {
    return ['Owner', 'Super Admin', 'Admin'].includes(Store.me().role);
  };

  /* ---------------- Mutations ---------------- */
  Store.sendMessage = function (cid, payload) {
    const m = Object.assign({
      id: U.uid('m'), convId: cid, authorId: Store.state.meId, ts: new Date().toISOString(),
      text: '', files: [], reactions: {}, pinned: false, saved: false, edited: false,
      deleted: false, replyTo: null, poll: null, task: null, system: null,
      status: 'sent', threadCount: 0, threadParticipants: [], voice: null, forwarded: null
    }, payload || {});
    Store.msgs(cid).push(m);
    const c = Store.conv(cid);
    if (c) { c.unread = 0; c.mentions = 0; c.draft = ''; }
    Store.emit('message:new', m);
    Store.emit('conv:update', cid);
    Store.persist();
    /* Simulated delivery lifecycle */
    setTimeout(() => { m.status = 'delivered'; Store.emit('message:status', m); }, 550);
    setTimeout(() => { m.status = 'read'; Store.emit('message:status', m); Store.persist(); }, 1900);
    return m;
  };

  Store.editMessage = function (cid, mid, text) {
    const m = Store.msgs(cid).find(x => x.id === mid);
    if (!m) return;
    m.text = text; m.edited = true; m.editedAt = new Date().toISOString();
    Store.emit('message:update', m); Store.persist();
  };
  Store.deleteMessage = function (cid, mid) {
    const m = Store.msgs(cid).find(x => x.id === mid);
    if (!m) return;
    m.deleted = true; m.text = ''; m.files = []; m.reactions = {}; m.poll = null;
    Store.emit('message:update', m); Store.persist();
  };
  Store.toggleReaction = function (cid, mid, emoji) {
    const list = Store.msgs(cid);
    let m = list.find(x => x.id === mid);
    if (!m) { // maybe a thread reply
      Object.keys(Store.state.threads).forEach(k => {
        const r = Store.state.threads[k].find(x => x.id === mid); if (r) m = r;
      });
    }
    if (!m) return;
    m.reactions = m.reactions || {};
    const me = Store.state.meId;
    const arr = m.reactions[emoji] || (m.reactions[emoji] = []);
    const i = arr.indexOf(me);
    if (i >= 0) { arr.splice(i, 1); if (!arr.length) delete m.reactions[emoji]; }
    else arr.push(me);
    Store.emit('message:update', m); Store.persist();
  };
  Store.togglePin = function (cid, mid) {
    const m = Store.msgs(cid).find(x => x.id === mid); if (!m) return;
    m.pinned = !m.pinned; Store.emit('message:update', m); Store.emit('conv:update', cid); Store.persist();
    return m.pinned;
  };
  Store.toggleSave = function (mid) {
    const i = Store.state.savedIds.indexOf(mid);
    if (i >= 0) Store.state.savedIds.splice(i, 1); else Store.state.savedIds.push(mid);
    Store.emit('saved:update'); Store.persist();
    return i < 0;
  };
  Store.replyInThread = function (parentId, cid, payload) {
    const t = Store.state.threads[parentId] || (Store.state.threads[parentId] = []);
    const r = Object.assign({
      id: U.uid('tr'), convId: cid, parentId: parentId, authorId: Store.state.meId,
      ts: new Date().toISOString(), text: '', files: [], reactions: {}, edited: false, deleted: false
    }, payload || {});
    t.push(r);
    const parent = Store.msgs(cid).find(x => x.id === parentId);
    if (parent) {
      parent.threadCount = t.length;
      parent.threadParticipants = U.uniq(t.map(x => x.authorId));
      parent.threadLast = r.ts;
      parent.following = true;
    }
    Store.emit('thread:new', { parentId, reply: r });
    Store.emit('message:update', parent);
    Store.persist();
    return r;
  };
  Store.resolveThread = function (cid, parentId, val) {
    const parent = Store.msgs(cid).find(x => x.id === parentId);
    if (parent) { parent.resolved = val; Store.emit('message:update', parent); Store.persist(); }
  };

  Store.markRead = function (cid) {
    const c = Store.conv(cid); if (!c) return;
    if (c.unread || c.mentions) { c.unread = 0; c.mentions = 0; Store.emit('conv:update', cid); Store.emit('badges'); Store.persist(); }
  };
  Store.setDraft = function (cid, text) {
    const c = Store.conv(cid); if (!c) return;
    c.draft = text; Store.persist();
  };

  Store.createChannel = function (data) {
    const id = 'c-' + data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.floor(Math.random() * 900 + 100);
    const c = {
      id: id, kind: 'channel', name: data.name, type: data.type || 'public',
      topic: data.topic || '', purpose: data.purpose || '', deptId: data.deptId || null,
      memberIds: U.uniq([Store.state.meId].concat(data.memberIds || [])),
      adminIds: [Store.state.meId], createdBy: Store.state.meId, createdAt: new Date().toISOString(),
      favorite: false, muted: false, archived: false, readOnly: data.type === 'announcement',
      unread: 0, mentions: 0, draft: '', bookmarks: []
    };
    Store.state.conversations[id] = c;
    Store.state.messages[id] = [{
      id: id + '_s0', convId: id, authorId: Store.state.meId, ts: new Date().toISOString(),
      text: '', system: 'created', files: [], reactions: {}, status: 'read', threadCount: 0
    }];
    if (data.topic) {
      Store.state.messages[id].push({
        id: id + '_s1', convId: id, authorId: Store.state.meId, ts: new Date().toISOString(),
        text: data.topic, files: [], reactions: {}, pinned: true, status: 'read', threadCount: 0
      });
    }
    Store.emit('conv:create', c); Store.persist();
    return c;
  };
  Store.createGroup = function (data) {
    const id = 'g-' + U.uid('').slice(1, 7);
    const c = {
      id: id, kind: 'group', name: data.name, description: data.description || '',
      memberIds: U.uniq([Store.state.meId].concat(data.memberIds || [])),
      adminIds: [Store.state.meId], type: data.type || 'private', emoji: data.emoji || '💬',
      createdAt: new Date().toISOString(), createdBy: Store.state.meId,
      pinned: false, muted: false, unread: 0, mentions: 0, draft: '', archived: false
    };
    Store.state.conversations[id] = c;
    Store.state.messages[id] = [{
      id: id + '_s0', convId: id, authorId: Store.state.meId, ts: new Date().toISOString(),
      text: '', system: 'group-created', files: [], reactions: {}, status: 'read', threadCount: 0
    }];
    Store.emit('conv:create', c); Store.persist();
    return c;
  };
  Store.openDM = function (peerId) {
    const existing = Store.convs().find(c => c.kind === 'dm' && c.peerId === peerId);
    if (existing) return existing;
    const id = 'd-' + peerId;
    const c = {
      id: id, kind: 'dm', peerId: peerId, name: Store.person(peerId).name,
      memberIds: [Store.state.meId, peerId], pinned: false, muted: false,
      unread: 0, mentions: 0, draft: '', archived: false
    };
    Store.state.conversations[id] = c;
    Store.state.messages[id] = Store.state.messages[id] || [];
    Store.emit('conv:create', c); Store.persist();
    return c;
  };
  Store.addMembers = function (cid, ids) {
    const c = Store.conv(cid); if (!c) return;
    const added = ids.filter(i => !c.memberIds.includes(i));
    c.memberIds = c.memberIds.concat(added);
    if (added.length) {
      Store.msgs(cid).push({
        id: U.uid('m'), convId: cid, authorId: Store.state.meId, ts: new Date().toISOString(),
        text: '', system: 'added:' + added.join(','), files: [], reactions: {}, status: 'read', threadCount: 0
      });
    }
    Store.emit('conv:update', cid); Store.emit('message:new', {}); Store.persist();
    return added;
  };
  Store.removeMember = function (cid, id) {
    const c = Store.conv(cid); if (!c) return;
    c.memberIds = c.memberIds.filter(x => x !== id);
    c.adminIds = (c.adminIds || []).filter(x => x !== id);
    Store.msgs(cid).push({
      id: U.uid('m'), convId: cid, authorId: Store.state.meId, ts: new Date().toISOString(),
      text: '', system: 'removed:' + id, files: [], reactions: {}, status: 'read', threadCount: 0
    });
    Store.emit('conv:update', cid); Store.emit('message:new', {}); Store.persist();
  };
  Store.toggleAdmin = function (cid, id) {
    const c = Store.conv(cid); if (!c) return;
    c.adminIds = c.adminIds || [];
    const i = c.adminIds.indexOf(id);
    if (i >= 0) c.adminIds.splice(i, 1); else c.adminIds.push(id);
    Store.emit('conv:update', cid); Store.persist();
    return i < 0;
  };
  Store.leaveConv = function (cid) {
    const c = Store.conv(cid); if (!c) return;
    c.memberIds = c.memberIds.filter(x => x !== Store.state.meId);
    c.left = true;
    Store.emit('conv:update', cid); Store.persist();
  };
  Store.archiveConv = function (cid, val) {
    const c = Store.conv(cid); if (!c) return;
    c.archived = val == null ? !c.archived : val;
    Store.emit('conv:update', cid); Store.persist();
    return c.archived;
  };
  Store.deleteConv = function (cid) {
    delete Store.state.conversations[cid];
    delete Store.state.messages[cid];
    Store.emit('conv:delete', cid); Store.persist();
  };
  Store.toggleFavorite = function (cid) {
    const c = Store.conv(cid); if (!c) return;
    if (c.kind === 'dm' || c.kind === 'group') c.pinned = !c.pinned;
    else c.favorite = !c.favorite;
    Store.emit('conv:update', cid); Store.persist();
    return c.favorite || c.pinned;
  };
  Store.toggleMute = function (cid) {
    const c = Store.conv(cid); if (!c) return;
    c.muted = !c.muted; Store.emit('conv:update', cid); Store.persist();
    return c.muted;
  };
  Store.updateConv = function (cid, patch) {
    const c = Store.conv(cid); if (!c) return;
    Object.assign(c, patch); Store.emit('conv:update', cid); Store.persist();
  };
  Store.addBookmark = function (cid, label, icon) {
    const c = Store.conv(cid); if (!c) return;
    c.bookmarks = c.bookmarks || [];
    c.bookmarks.push({ id: U.uid('bm'), label: label, icon: icon || 'link' });
    Store.emit('conv:update', cid); Store.persist();
  };

  /* Tasks */
  Store.createTask = function (data) {
    const t = Object.assign({
      id: U.uid('tk'), title: '', description: '', status: 'todo', priority: 'medium',
      assigneeId: Store.state.meId, creatorId: Store.state.meId, due: null,
      labels: [], subtasks: [], comments: [], source: null, createdAt: new Date().toISOString()
    }, data || {});
    Store.state.tasks.unshift(t);
    Store.emit('tasks:update'); Store.persist();
    return t;
  };
  Store.updateTask = function (id, patch) {
    const t = Store.task(id); if (!t) return;
    Object.assign(t, patch); Store.emit('tasks:update'); Store.persist(); return t;
  };
  Store.deleteTask = function (id) {
    Store.state.tasks = Store.state.tasks.filter(t => t.id !== id);
    Store.emit('tasks:update'); Store.persist();
  };

  /* Files */
  Store.addFile = function (data) {
    const f = Object.assign({
      id: U.uid('f'), name: 'Untitled', size: 0, ownerId: Store.state.meId,
      folderId: null, createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString(),
      source: null, starred: false, sharedWith: [], versions: 1, permission: 'org', downloads: 0
    }, data || {});
    Store.state.files.unshift(f);
    Store.emit('files:update'); Store.persist();
    return f;
  };
  Store.updateFile = function (id, patch) {
    const f = Store.file(id); if (!f) return;
    Object.assign(f, patch, { modifiedAt: new Date().toISOString() });
    Store.emit('files:update'); Store.persist(); return f;
  };
  Store.deleteFile = function (id) {
    Store.state.files = Store.state.files.filter(f => f.id !== id);
    Store.emit('files:update'); Store.persist();
  };
  Store.addFolder = function (name, parentId) {
    const f = { id: U.uid('fo'), name: name, parentId: parentId || null, color: '#12a583', ownerId: Store.state.meId };
    Store.state.folders.push(f); Store.emit('files:update'); Store.persist(); return f;
  };

  /* Meetings */
  Store.createMeeting = function (data) {
    const m = Object.assign({
      id: U.uid('mt'), title: 'New meeting', organizerId: Store.state.meId,
      participantIds: [Store.state.meId], start: new Date().toISOString(),
      end: new Date(Date.now() + 1800000).toISOString(), durationMin: 30, type: 'meeting',
      description: '', recording: false, location: 'iThrive Meeting', agenda: [],
      link: 'https://meet.ithrive.app/' + U.uid('').slice(1, 9), lobby: true, status: 'scheduled', rsvp: {}
    }, data || {});
    Store.state.meetings.push(m);
    Store.emit('meetings:update'); Store.persist();
    return m;
  };
  Store.updateMeeting = function (id, patch) {
    const m = Store.meeting(id); if (!m) return;
    Object.assign(m, patch); Store.emit('meetings:update'); Store.persist(); return m;
  };
  Store.deleteMeeting = function (id) {
    Store.state.meetings = Store.state.meetings.filter(m => m.id !== id);
    Store.emit('meetings:update'); Store.persist();
  };

  /* Announcements */
  Store.createAnnouncement = function (data) {
    const a = Object.assign({
      id: U.uid('an'), title: '', body: '', authorId: Store.state.meId, audience: 'Everyone',
      type: 'Company', createdAt: new Date().toISOString(), pinned: false, requireRead: false,
      readBy: [], attachments: [], priority: 'normal'
    }, data || {});
    Store.state.announcements.unshift(a);
    Store.emit('announcements:update'); Store.persist();
    return a;
  };
  Store.confirmRead = function (id) {
    const a = Store.state.announcements.find(x => x.id === id);
    if (a && !a.readBy.includes(Store.state.meId)) { a.readBy.push(Store.state.meId); Store.emit('announcements:update'); Store.persist(); }
  };

  /* Calls */
  Store.logCall = function (data) {
    Store.state.calls.unshift(Object.assign({
      id: U.uid('cl'), kind: 'video', direction: 'out', peerIds: [], start: new Date().toISOString(),
      durationSec: 0, missed: false, recorded: false
    }, data || {}));
    Store.emit('calls:update'); Store.persist();
  };

  /* Notifications */
  Store.markNotifRead = function (id) {
    const n = Store.state.notifications.find(x => x.id === id);
    if (n) { n.read = true; Store.emit('notifs:update'); Store.emit('badges'); Store.persist(); }
  };
  Store.markAllNotifsRead = function () {
    Store.state.notifications.forEach(n => n.read = true);
    Store.emit('notifs:update'); Store.emit('badges'); Store.persist();
  };
  Store.pushNotification = function (n) {
    Store.state.notifications.unshift(Object.assign({ id: U.uid('n'), ts: new Date().toISOString(), read: false }, n));
    Store.emit('notifs:update'); Store.emit('badges'); Store.persist();
  };

  /* Presence & prefs */
  Store.setPresence = function (p) {
    Store.state.myPresence = p;
    const me = Store.me(); if (me) me.presence = p;
    Store.emit('presence'); Store.persist();
  };
  Store.setStatus = function (text, emoji, until) {
    Store.state.myStatus = { text: text, emoji: emoji, until: until || null };
    const me = Store.me(); if (me) { me.statusText = text; me.statusEmoji = emoji; }
    Store.emit('presence'); Store.persist();
  };
  Store.setPref = function (k, v) {
    Store.state.prefs[k] = v; Store.emit('prefs', k); Store.persist();
  };
  Store.updateMe = function (patch) {
    Object.assign(Store.me(), patch); Store.emit('profile'); Store.persist();
  };

  /* Admin */
  Store.inviteUser = function (data) {
    const iv = Object.assign({ id: U.uid('iv'), sentAt: new Date().toISOString(), status: 'pending', invitedBy: Store.state.meId }, data);
    Store.state.invitations.unshift(iv);
    Store.state.audit.unshift({ id: U.uid('au'), ts: new Date().toISOString(), actorId: Store.state.meId, action: 'user.invited', target: iv.email + ' — ' + (Store.dept(iv.deptId).name || 'No department'), ip: '49.207.11.90', severity: 'normal' });
    Store.emit('admin:update'); Store.persist();
    return iv;
  };
  Store.revokeInvite = function (id) {
    Store.state.invitations = Store.state.invitations.filter(i => i.id !== id);
    Store.emit('admin:update'); Store.persist();
  };
  Store.setUserRole = function (pid, role) {
    const p = Store.person(pid); if (!p) return;
    const old = p.role; p.role = role;
    Store.state.audit.unshift({ id: U.uid('au'), ts: new Date().toISOString(), actorId: Store.state.meId, action: 'role.changed', target: p.name + ': ' + old + ' → ' + role, ip: '49.207.11.90', severity: 'normal' });
    Store.emit('admin:update'); Store.persist();
  };
  Store.suspendUser = function (pid, val) {
    const p = Store.person(pid); if (!p) return;
    p.suspended = val == null ? !p.suspended : val;
    if (p.suspended) p.presence = 'offline';
    Store.state.audit.unshift({ id: U.uid('au'), ts: new Date().toISOString(), actorId: Store.state.meId, action: p.suspended ? 'user.suspended' : 'user.reactivated', target: p.email, ip: '49.207.11.90', severity: 'high' });
    Store.emit('admin:update'); Store.persist();
    return p.suspended;
  };
  Store.toggleIntegration = function (id) {
    const i = Store.state.integrations.find(x => x.id === id); if (!i) return;
    i.connected = !i.connected;
    if (i.connected) { i.connectedBy = Store.state.meId; i.connectedAt = new Date().toISOString(); }
    Store.state.audit.unshift({ id: U.uid('au'), ts: new Date().toISOString(), actorId: Store.state.meId, action: i.connected ? 'integration.connected' : 'integration.disconnected', target: i.name, ip: '49.207.11.90', severity: 'normal' });
    Store.emit('integrations:update'); Store.persist();
    return i.connected;
  };
  Store.revokeSession = function (id) {
    Store.state.sessions = Store.state.sessions.filter(s => s.id !== id);
    Store.emit('admin:update'); Store.persist();
  };

  Store.addRecentSearch = function (q) {
    if (!q) return;
    Store.state.recentSearches = U.uniq([q].concat(Store.state.recentSearches)).slice(0, 8);
    Store.persist();
  };

  g.Store = Store;
})(window);
