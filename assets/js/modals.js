/* ===== iThrive — Modal flows ===== */
(function (g) {
  const M = {};
  const el = U.el;

  /* ------------------------------------------------------------------ */
  /* Messaging                                                          */
  /* ------------------------------------------------------------------ */
  M.newMessage = function (preselect) {
    const picker = UI.peoplePicker({ selected: preselect || [], placeholder: 'Search colleagues by name, title or department…' });
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML = '<div class="tiny muted">Choose one person for a direct message, or several to start a group.</div>';
    wrap.appendChild(picker.el);
    const msg = el('div', { class: 'field' });
    msg.innerHTML = '<label>First message (optional)</label><textarea class="textarea" data-first placeholder="Write your first message…" style="min-height:70px"></textarea>';
    wrap.appendChild(msg);

    UI.modal({
      icon: 'edit', title: 'New message', sub: 'Start a conversation with anyone in the workspace', body: wrap,
      actions: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Start conversation', variant: 'primary', icon: 'send', onClick: function () {
          const ids = picker.get();
          if (!ids.length) { UI.toast('Choose at least one person.', 'warn'); return false; }
          const text = wrap.querySelector('[data-first]').value.trim();
          let conv;
          if (ids.length === 1) conv = Store.openDM(ids[0]);
          else conv = Store.createGroup({ name: ids.map(i => Store.person(i).first).slice(0, 3).join(', ') + (ids.length > 3 ? ' +' + (ids.length - 3) : ''), memberIds: ids, type: 'private', emoji: '💬' });
          if (text) Store.sendMessage(conv.id, { text: text });
          App.route('#/messages/' + conv.id);
          UI.toast(ids.length === 1 ? 'Conversation opened.' : 'Group created.', 'success');
        } }
      ]
    });
  };

  M.createChannel = function (cb) {
    const wrap = el('div', { class: 'col gap-4' });
    const types = [
      ['public', 'Public', 'Anyone in the workspace can find and join', 'hash'],
      ['private', 'Private', 'Only invited people can see it', 'lock'],
      ['announcement', 'Announcement', 'Only admins and managers can post', 'megaphone'],
      ['project', 'Project', 'Time-boxed work with a clear goal', 'target'],
      ['department', 'Department', 'Linked to a department in your org', 'building'],
      ['temporary', 'Temporary', 'Auto-archives on a date you choose', 'clock']
    ];
    wrap.innerHTML =
      UI.field('Channel name', '<div class="input-wrap">' + icon('hash') + '<input class="input" data-name placeholder="e.g. project-atlas" data-autofocus></div>', 'Lower case, no spaces. People will see #your-channel-name.', true) +
      UI.field('Topic', '<input class="input" data-topic placeholder="What is this channel for?">', 'Shown in the header so people know where they are.') +
      UI.field('Purpose (optional)', '<textarea class="textarea" data-purpose placeholder="A longer description for new members" style="min-height:64px"></textarea>') +
      '<div><div class="label mb-2">Channel type</div><div class="pick-grid" data-types>' +
      types.map((t, i) => '<button class="pick-card' + (i === 0 ? ' on' : '') + '" data-type="' + t[0] + '">' +
        '<span class="p-ic">' + icon(t[3]) + '</span><span><span class="p-t">' + t[1] + '</span><span class="p-d">' + t[2] + '</span></span></button>').join('') +
      '</div></div>' +
      '<div data-deptwrap hidden>' + UI.field('Department', '<select class="select" data-dept>' + DATA.DEPARTMENTS.map(d => '<option value="' + d.id + '">' + U.esc(d.name) + '</option>').join('') + '</select>') + '</div>' +
      '<div data-expwrap hidden>' + UI.field('Auto-archive on', '<input class="input" type="date" data-expires>') + '</div>' +
      '<div><div class="label mb-2">Add people</div><div data-picker></div></div>';

    const picker = UI.peoplePicker({ placeholder: 'Search people to add…' });
    wrap.querySelector('[data-picker]').appendChild(picker.el);
    let type = 'public';
    U.qsa('[data-type]', wrap).forEach(b => b.onclick = function () {
      type = b.dataset.type;
      U.qsa('[data-type]', wrap).forEach(x => x.classList.remove('on')); b.classList.add('on');
      wrap.querySelector('[data-deptwrap]').hidden = type !== 'department';
      wrap.querySelector('[data-expwrap]').hidden = type !== 'temporary';
    });
    const nameIn = wrap.querySelector('[data-name]');
    nameIn.addEventListener('input', () => { nameIn.value = nameIn.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-'); });

    UI.modal({
      icon: 'hash', title: 'Create a channel', sub: 'Channels keep a topic, its files and its decisions in one searchable place', size: 'lg', body: wrap,
      actions: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Create channel', variant: 'primary', icon: 'plus', onClick: function () {
          const name = nameIn.value.trim();
          if (!name) { nameIn.classList.add('err'); UI.toast('Give the channel a name.', 'error'); return false; }
          if (Store.convs().some(c => c.kind === 'channel' && c.name === name)) { UI.toast('A channel called #' + name + ' already exists.', 'error'); return false; }
          const c = Store.createChannel({
            name: name, topic: wrap.querySelector('[data-topic]').value.trim(),
            purpose: wrap.querySelector('[data-purpose]').value.trim(), type: type,
            deptId: type === 'department' ? wrap.querySelector('[data-dept]').value : null,
            memberIds: picker.get()
          });
          if (type === 'temporary') { const d = wrap.querySelector('[data-expires]').value; if (d) c.expiresAt = d; }
          App.renderSidebar(); App.route('#/messages/' + c.id);
          UI.toast('#' + name + ' created with ' + U.plural(c.memberIds.length, 'member') + '.', 'success');
          cb && cb(c);
        } }
      ]
    });
  };

  M.createGroup = function (cb) {
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      '<div class="row gap-4 wrap">' +
      '<button class="group-emoji" data-emoji>💬</button>' +
      '<div class="grow" style="min-width:220px">' +
      UI.field('Group name', '<input class="input" data-name placeholder="e.g. Apollo Core Squad" data-autofocus>', null, true) +
      '</div></div>' +
      UI.field('Description', '<textarea class="textarea" data-desc placeholder="What is this group for?" style="min-height:64px"></textarea>') +
      '<div><div class="label mb-2">Visibility</div>' +
      '<div class="col gap-2">' +
      '<label class="radio-card on" data-vis="private"><span class="check radio on"></span><span><span class="semi md block">Private group</span><span class="tiny muted">Only members can see it and its history</span></span></label>' +
      '<label class="radio-card" data-vis="public"><span class="check radio"></span><span><span class="semi md block">Public group</span><span class="tiny muted">Anyone in the workspace can find and join</span></span></label>' +
      '</div></div>' +
      '<div><div class="label mb-2">Members</div><div data-picker></div></div>';
    const picker = UI.peoplePicker({ placeholder: 'Search people to add…' });
    wrap.querySelector('[data-picker]').appendChild(picker.el);
    let vis = 'private', emoji = '💬';
    U.qsa('[data-vis]', wrap).forEach(r => r.onclick = function () {
      vis = r.dataset.vis;
      U.qsa('[data-vis]', wrap).forEach(x => { x.classList.remove('on'); x.querySelector('.check').classList.remove('on'); });
      r.classList.add('on'); r.querySelector('.check').classList.add('on');
    });
    wrap.querySelector('[data-emoji]').onclick = () => M.pickEmoji(function (e) { emoji = e; wrap.querySelector('[data-emoji]').textContent = e; });

    UI.modal({
      icon: 'users', title: 'Create a group', sub: 'Groups are for a set of people rather than a topic', size: 'lg', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Create group', variant: 'primary', icon: 'plus', onClick: function () {
        const name = wrap.querySelector('[data-name]').value.trim();
        if (!name) { UI.toast('Give the group a name.', 'error'); return false; }
        if (!picker.get().length) { UI.toast('Add at least one other person.', 'warn'); return false; }
        const c = Store.createGroup({ name: name, description: wrap.querySelector('[data-desc]').value.trim(), memberIds: picker.get(), type: vis, emoji: emoji });
        App.renderSidebar(); App.route('#/messages/' + c.id);
        UI.toast('Group created with ' + U.plural(c.memberIds.length, 'member') + '.', 'success');
        cb && cb(c);
      } }]
    });
  };

  M.editChannel = function (cid) {
    const c = Store.conv(cid);
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Channel name', '<div class="input-wrap">' + icon('hash') + '<input class="input" data-name value="' + U.attr(c.name) + '"></div>') +
      UI.field('Topic', '<input class="input" data-topic value="' + U.attr(c.topic || '') + '">') +
      UI.field('Purpose', '<textarea class="textarea" data-purpose style="min-height:70px">' + U.esc(c.purpose || '') + '</textarea>') +
      UI.field('Type', '<select class="select" data-type>' + ['public', 'private', 'announcement', 'project', 'department', 'temporary'].map(t =>
        '<option value="' + t + '"' + (c.type === t ? ' selected' : '') + '>' + U.cap(t) + '</option>').join('') + '</select>') +
      '<div class="divider"></div>' +
      UI.switchRow('Read-only channel', 'Only admins and managers can post', !!c.readOnly, 'ro') +
      UI.switchRow('Archived', 'Hidden from the sidebar, history preserved', !!c.archived, 'arch');
    UI.bindSwitches(wrap);
    UI.modal({
      icon: 'edit', title: 'Edit channel', sub: '#' + c.name, body: wrap,
      actions: [
        { label: 'Delete channel', variant: 'danger-ghost', close: false, onClick: function () {
          UI.confirm({ title: 'Delete #' + c.name + '?', danger: true, confirmLabel: 'Delete channel',
            body: 'All ' + (Store.msgs(cid) || []).length + ' messages and their files will be removed for every member. This cannot be undone.' })
            .then(function (ok) {
              if (!ok) return;
              Store.deleteConv(cid); UI.closeMenu();
              document.querySelectorAll('.modal-scrim').forEach(s => s.remove());
              document.body.style.overflow = '';
              App.route('#/messages'); UI.toast('Channel deleted.', 'success');
            });
        } },
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Save changes', variant: 'primary', onClick: function () {
          Store.updateConv(cid, {
            name: wrap.querySelector('[data-name]').value.trim().toLowerCase().replace(/\s+/g, '-'),
            topic: wrap.querySelector('[data-topic]').value.trim(),
            purpose: wrap.querySelector('[data-purpose]').value.trim(),
            type: wrap.querySelector('[data-type]').value,
            readOnly: wrap.querySelector('[data-switch="ro"]').classList.contains('on'),
            archived: wrap.querySelector('[data-switch="arch"]').classList.contains('on')
          });
          App.renderShell(); UI.toast('Channel updated.', 'success');
        } }
      ]
    });
  };

  M.editGroup = function (cid) {
    const c = Store.conv(cid);
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      '<div class="row gap-4"><button class="group-emoji" data-emoji>' + (c.emoji || '💬') + '</button>' +
      '<div class="grow">' + UI.field('Group name', '<input class="input" data-name value="' + U.attr(c.name) + '">') + '</div></div>' +
      UI.field('Description', '<textarea class="textarea" data-desc style="min-height:70px">' + U.esc(c.description || '') + '</textarea>') +
      UI.field('Visibility', '<select class="select" data-vis><option value="private"' + (c.type === 'private' ? ' selected' : '') + '>Private</option><option value="public"' + (c.type === 'public' ? ' selected' : '') + '>Public</option></select>');
    let emoji = c.emoji || '💬';
    wrap.querySelector('[data-emoji]').onclick = () => M.pickEmoji(e => { emoji = e; wrap.querySelector('[data-emoji]').textContent = e; });
    UI.modal({
      icon: 'edit', title: 'Edit group', sub: c.name, body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Save', variant: 'primary', onClick: function () {
        Store.updateConv(cid, { name: wrap.querySelector('[data-name]').value.trim(), description: wrap.querySelector('[data-desc]').value.trim(), type: wrap.querySelector('[data-vis]').value, emoji: emoji });
        App.renderShell(); UI.toast('Group updated.', 'success');
      } }]
    });
  };

  M.editTopic = function (cid) {
    const c = Store.conv(cid);
    UI.prompt({ title: 'Set the channel topic', label: 'Topic', value: c.topic || '', icon: 'edit', confirmLabel: 'Save' })
      .then(v => { if (v != null) { Store.updateConv(cid, { topic: v }); App.renderShell(); UI.toast('Topic updated.', 'success'); } });
  };

  M.addMembers = function (cid) {
    const c = Store.conv(cid);
    const picker = UI.peoplePicker({ exclude: c.memberIds, placeholder: 'Search people to add…' });
    UI.modal({
      icon: 'userPlus', title: 'Add people', sub: 'to ' + Store.convTitle(c), body: picker.el,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Add', variant: 'primary', onClick: function () {
        const ids = picker.get();
        if (!ids.length) { UI.toast('Choose at least one person.', 'warn'); return false; }
        Store.addMembers(cid, ids);
        App.renderShell();
        UI.toast(U.plural(ids.length, 'person', 'people') + ' added to ' + Store.convTitle(c) + '.', 'success');
      } }]
    });
  };

  M.browseChannels = function () {
    const wrap = el('div');
    wrap.innerHTML = '<div class="input-wrap mb-3">' + icon('search') + '<input class="input" data-bq placeholder="Search channels" data-autofocus></div>' +
      '<div class="chip-row mb-3" data-bfilter>' +
      ['all', 'public', 'private', 'project', 'department', 'archived'].map((t, i) => '<button class="chip' + (i === 0 ? ' on' : '') + '" data-bf="' + t + '">' + U.cap(t) + '</button>').join('') +
      '</div><div data-blist class="scroll-y" style="max-height:420px"></div>';
    let filter = 'all', q = '';
    function draw() {
      let list = Store.convs().filter(c => c.kind === 'channel');
      if (filter === 'archived') list = list.filter(c => c.archived); else list = list.filter(c => !c.archived);
      if (['public', 'private', 'project', 'department'].includes(filter)) list = list.filter(c => c.type === filter);
      if (q) list = list.filter(c => (c.name + ' ' + (c.topic || '')).toLowerCase().includes(q));
      const box = wrap.querySelector('[data-blist]');
      if (!list.length) { box.innerHTML = '<div class="empty" style="padding:28px"><p class="muted">No channels match.</p></div>'; return; }
      box.innerHTML = list.map(function (c) {
        const joined = c.memberIds.includes(Store.state.meId);
        return '<div class="lrow"><span class="ci-hash">' + icon(UI.channelIcon(c)) + '</span>' +
          '<span class="grow min0"><span class="semi md block truncate">#' + U.esc(c.name) + '</span>' +
          '<span class="tiny muted truncate block">' + U.plural(c.memberIds.length, 'member') + (c.topic ? ' · ' + U.esc(c.topic) : '') + '</span></span>' +
          '<button class="btn sm ' + (joined ? '' : 'soft') + '" data-join="' + c.id + '">' + (joined ? 'Open' : 'Join') + '</button></div>';
      }).join('');
      U.qsa('[data-join]', box).forEach(b => b.onclick = function () {
        const c = Store.conv(b.dataset.join);
        if (!c.memberIds.includes(Store.state.meId)) { c.memberIds.push(Store.state.meId); Store.persist(); UI.toast('You joined #' + c.name + '.', 'success'); }
        document.querySelectorAll('.modal-scrim').forEach(s => s.remove()); document.body.style.overflow = '';
        App.route('#/messages/' + c.id);
      });
    }
    wrap.querySelector('[data-bq]').addEventListener('input', U.debounce(e => { q = e.target.value.trim().toLowerCase(); draw(); }, 140));
    U.qsa('[data-bf]', wrap).forEach(b => b.onclick = function () {
      filter = b.dataset.bf;
      U.qsa('[data-bf]', wrap).forEach(x => x.classList.remove('on')); b.classList.add('on'); draw();
    });
    draw();
    UI.modal({ icon: 'hash', title: 'Browse channels', sub: Store.convs().filter(c => c.kind === 'channel').length + ' channels in this workspace', size: 'lg', body: wrap,
      actions: [{ label: 'Create a channel', variant: 'ghost', onClick: () => M.createChannel() }, { label: 'Close', variant: 'primary' }] });
  };

  M.pickConversation = function (list, cb) {
    const wrap = el('div');
    wrap.innerHTML = '<div class="input-wrap mb-3">' + icon('search') + '<input class="input" data-pq placeholder="Search conversations" data-autofocus></div><div data-pl class="scroll-y" style="max-height:400px"></div>';
    function draw(q) {
      const items = list.filter(c => !q || Store.convTitle(c).toLowerCase().includes(q));
      wrap.querySelector('[data-pl]').innerHTML = items.map(c =>
        '<button class="lrow" data-pc="' + c.id + '">' + UI.convAvatar(c, 30) +
        '<span class="grow min0 text-left"><span class="semi md block truncate">' + U.esc(Store.convTitle(c)) + '</span>' +
        '<span class="tiny muted">' + U.plural((Store.msgs(c.id) || []).length, 'message') + '</span></span></button>').join('') ||
        '<div class="tiny muted" style="padding:16px">No matches.</div>';
      U.qsa('[data-pc]', wrap).forEach(b => b.onclick = function () { m.close(); cb(b.dataset.pc); });
    }
    draw('');
    wrap.querySelector('[data-pq]').addEventListener('input', U.debounce(e => draw(e.target.value.trim().toLowerCase()), 130));
    const m = UI.modal({ icon: 'chat', title: 'Choose a conversation', body: wrap, actions: [{ label: 'Cancel', variant: 'ghost' }] });
  };

  M.forwardMessage = function (cid, mid, msgObj) {
    const msg = msgObj || (Store.msgs(cid) || []).find(x => x.id === mid);
    const wrap = el('div', { class: 'col gap-3' });
    wrap.innerHTML = '<div class="quote-preview"><div class="row gap-2 mb-1">' + UI.avatar(msg.authorId, 22) +
      '<span class="semi tiny">' + U.esc(Store.person(msg.authorId).name) + '</span></div>' +
      '<div class="md clamp-3">' + U.renderRich(msg.text || 'Attachment') + '</div></div>' +
      '<div class="label">Forward to</div><div data-fl class="scroll-y" style="max-height:280px"></div>' +
      UI.field('Add a note (optional)', '<textarea class="textarea" data-note style="min-height:60px" placeholder="Say why you are forwarding this…"></textarea>');
    const targets = Store.convs().filter(c => !c.archived && c.id !== cid);
    const sel = new Set();
    function draw() {
      wrap.querySelector('[data-fl]').innerHTML = targets.map(c =>
        '<button class="lrow" data-ft="' + c.id + '">' + UI.checkbox(sel.has(c.id)) + UI.convAvatar(c, 28) +
        '<span class="grow min0 text-left semi md truncate">' + U.esc(Store.convTitle(c)) + '</span></button>').join('');
      U.qsa('[data-ft]', wrap).forEach(b => b.onclick = function () {
        if (sel.has(b.dataset.ft)) sel.delete(b.dataset.ft); else sel.add(b.dataset.ft);
        draw();
      });
    }
    draw();
    UI.modal({
      icon: 'forward', title: 'Forward message', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Forward', variant: 'primary', icon: 'send', onClick: function () {
        if (!sel.size) { UI.toast('Choose at least one conversation.', 'warn'); return false; }
        const note = wrap.querySelector('[data-note]').value.trim();
        sel.forEach(function (target) {
          if (note) Store.sendMessage(target, { text: note });
          Store.sendMessage(target, { text: msg.text, files: (msg.files || []).slice(), forwarded: { from: Store.convTitle(Store.conv(cid)), authorId: msg.authorId } });
        });
        UI.toast('Forwarded to ' + U.plural(sel.size, 'conversation') + '.', 'success');
        App.renderShell();
      } }]
    });
  };

  M.reportMessage = function (cid, mid) {
    const wrap = el('div', { class: 'col gap-3' });
    wrap.innerHTML = '<div class="label">Reason</div>' +
      ['Harassment or bullying', 'Inappropriate content', 'Spam', 'Confidential information shared', 'Security concern', 'Something else']
        .map((r, i) => '<label class="radio-card' + (i === 0 ? ' on' : '') + '" data-rr="' + i + '"><span class="check radio' + (i === 0 ? ' on' : '') + '"></span><span class="semi md">' + r + '</span></label>').join('') +
      UI.field('Details (optional)', '<textarea class="textarea" data-detail placeholder="Anything that would help the review" style="min-height:70px"></textarea>') +
      '<div class="banner info">' + icon('shield') + '<div class="b-body">Reports go to People & Culture and IT Security. The person reported is not told who reported them.</div></div>';
    U.qsa('[data-rr]', wrap).forEach(r => r.onclick = function () {
      U.qsa('[data-rr]', wrap).forEach(x => { x.classList.remove('on'); x.querySelector('.check').classList.remove('on'); });
      r.classList.add('on'); r.querySelector('.check').classList.add('on');
    });
    UI.modal({ icon: 'flag', title: 'Report a message', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Submit report', variant: 'danger', onClick: () => UI.toast('Report submitted. You will hear back within two business days.', 'success') }] });
  };

  M.convNotifications = function (cid) {
    const c = Store.conv(cid);
    const wrap = el('div', { class: 'col gap-3' });
    wrap.innerHTML = ['All new messages', 'Mentions only (recommended)', 'Nothing'].map((r, i) =>
      '<label class="radio-card' + (i === 1 ? ' on' : '') + '" data-cn="' + i + '"><span class="check radio' + (i === 1 ? ' on' : '') + '"></span>' +
      '<span class="semi md">' + r + '</span></label>').join('') +
      '<div class="divider"></div>' +
      UI.switchRow('Mute this conversation', 'No notifications at all', !!c.muted, 'mute') +
      UI.switchRow('Include in my email digest', '', true, 'digest');
    UI.bindSwitches(wrap, k => { if (k === 'mute') { Store.toggleMute(cid); App.renderSidebar(); } });
    U.qsa('[data-cn]', wrap).forEach(r => r.onclick = function () {
      U.qsa('[data-cn]', wrap).forEach(x => { x.classList.remove('on'); x.querySelector('.check').classList.remove('on'); });
      r.classList.add('on'); r.querySelector('.check').classList.add('on');
    });
    UI.modal({ icon: 'bell', title: 'Notification preferences', sub: Store.convTitle(c), size: 'sm', body: wrap, actions: [{ label: 'Done', variant: 'primary', onClick: () => UI.toast('Preferences saved.', 'success') }] });
  };

  M.exportConv = function (cid) {
    const c = Store.conv(cid);
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Date range', '<select class="select"><option>All time</option><option selected>Last 90 days</option><option>Last 30 days</option><option>Custom…</option></select>') +
      UI.field('Format', '<select class="select"><option selected>JSON (complete, machine readable)</option><option>CSV (messages only)</option><option>PDF (formatted transcript)</option><option>HTML archive</option></select>') +
      '<div class="col gap-1">' +
      UI.switchRow('Include files and attachments', 'Adds roughly 240 MB', true, 'incf') +
      UI.switchRow('Include thread replies', '', true, 'inct') +
      UI.switchRow('Include deleted messages', 'Administrators only', false, 'incd') +
      '</div>' +
      '<div class="banner info">' + icon('info') + '<div class="b-body">Exports are logged in the audit trail. You will receive a download link by email within a few minutes.</div></div>';
    UI.bindSwitches(wrap);
    UI.modal({ icon: 'download', title: 'Export conversation', sub: Store.convTitle(c) + ' · ' + U.plural((Store.msgs(cid) || []).length, 'message'), body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Start export', variant: 'primary', icon: 'download', onClick: () => UI.toast('Export started. We will email you when it is ready.', 'success') }] });
  };

  M.channelAnalytics = function (cid) {
    const c = Store.conv(cid);
    const msgs = Store.msgs(cid) || [];
    const byAuthor = U.groupBy(msgs.filter(m => !m.system), m => m.authorId);
    const top = U.sortBy(Object.keys(byAuthor), k => byAuthor[k].length, 'desc').slice(0, 6);
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = U.addDays(new Date(), -(13 - i));
      return msgs.filter(m => U.isSameDay(m.ts, d)).length;
    });
    const max = Math.max(1, Math.max.apply(null, days));
    const wrap = el('div', { class: 'col gap-5' });
    wrap.innerHTML =
      '<div class="grid grid-3">' +
      '<div class="stat"><span class="s-val">' + msgs.length + '</span><span class="s-lbl">Messages</span></div>' +
      '<div class="stat"><span class="s-val">' + c.memberIds.length + '</span><span class="s-lbl">Members</span></div>' +
      '<div class="stat"><span class="s-val">' + msgs.filter(m => m.threadCount).length + '</span><span class="s-lbl">Threads</span></div>' +
      '</div>' +
      '<div><div class="panel-title">Messages per day (last 14 days)</div>' +
      '<div class="bars">' + days.map(v => '<div class="bcol" data-tip="' + v + ' messages"><div class="b" style="height:' + U.pct(v, max) + '%"></div></div>').join('') + '</div></div>' +
      '<div><div class="panel-title">Most active people</div>' +
      top.map(function (id) {
        return '<div class="mb-3"><div class="row between mb-1"><span class="row gap-2">' + UI.avatar(id, 22) +
          '<span class="md">' + U.esc(Store.person(id).name) + '</span></span><span class="tiny semi">' + byAuthor[id].length + '</span></div>' +
          '<div class="progress thin"><i style="width:' + U.pct(byAuthor[id].length, byAuthor[top[0]].length) + '%"></i></div></div>';
      }).join('') + '</div>' +
      '<div><div class="panel-title">Content</div><div class="grid grid-3">' +
      '<div class="stat"><span class="s-val">' + U.uniq(msgs.flatMap(m => m.files || [])).length + '</span><span class="s-lbl">Files shared</span></div>' +
      '<div class="stat"><span class="s-val">' + msgs.filter(m => m.pinned).length + '</span><span class="s-lbl">Pinned</span></div>' +
      '<div class="stat"><span class="s-val">' + msgs.reduce((n, m) => n + Object.values(m.reactions || {}).reduce((a, b) => a + b.length, 0), 0) + '</span><span class="s-lbl">Reactions</span></div>' +
      '</div></div>';
    UI.modal({ icon: 'chart', title: 'Channel analytics', sub: Store.convTitle(c), size: 'lg', body: wrap, actions: [{ label: 'Export', variant: 'ghost', onClick: () => UI.toast('Analytics exported as CSV.', 'success') }, { label: 'Close', variant: 'primary' }] });
  };

  /* ------------------------------------------------------------------ */
  /* Polls, tasks, reminders                                            */
  /* ------------------------------------------------------------------ */
  M.createPoll = function (cid, cb) {
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Question', '<input class="input" data-q placeholder="What should we decide?" data-autofocus>', null, true) +
      '<div><div class="label mb-2">Options</div><div class="col gap-2" data-opts></div>' +
      '<button class="btn ghost sm mt-2" data-addopt>' + icon('plus') + 'Add option</button></div>' +
      '<div class="col gap-1">' +
      UI.switchRow('Allow multiple choices', '', false, 'multi') +
      UI.switchRow('Anonymous votes', 'Hide who voted for what', false, 'anon') +
      UI.switchRow('Allow people to add options', '', false, 'addopts') +
      '</div>';
    UI.bindSwitches(wrap);
    const opts = wrap.querySelector('[data-opts]');
    function addOpt(val) {
      const row = el('div', { class: 'row gap-2' });
      row.innerHTML = '<input class="input grow" placeholder="Option ' + (opts.children.length + 1) + '" value="' + U.attr(val || '') + '">' +
        '<button class="icon-btn" data-rm>' + icon('x') + '</button>';
      row.querySelector('[data-rm]').onclick = () => { if (opts.children.length > 2) row.remove(); else UI.toast('A poll needs at least two options.', 'warn'); };
      opts.appendChild(row);
    }
    addOpt(); addOpt();
    wrap.querySelector('[data-addopt]').onclick = () => addOpt();
    UI.modal({
      icon: 'poll', title: 'Create a poll', sub: cid ? 'in ' + Store.convTitle(Store.conv(cid)) : 'for this meeting', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Post poll', variant: 'primary', icon: 'send', onClick: function () {
        const q = wrap.querySelector('[data-q]').value.trim();
        const values = U.qsa('input', opts).map(i => i.value.trim()).filter(Boolean);
        if (!q) { UI.toast('Write the question first.', 'error'); return false; }
        if (values.length < 2) { UI.toast('Add at least two options.', 'error'); return false; }
        const poll = {
          question: q, options: values.map(v => ({ text: v, votes: [] })),
          multi: wrap.querySelector('[data-switch="multi"]').classList.contains('on'),
          anonymous: wrap.querySelector('[data-switch="anon"]').classList.contains('on')
        };
        if (cb) cb(poll);
        else if (cid) { Store.sendMessage(cid, { text: q, poll: poll }); App.renderMain(); }
        UI.toast('Poll posted.', 'success');
      } }]
    });
  };

  M.createTask = function (data, cb) {
    data = data || {};
    const editing = !!data.id;
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Title', '<input class="input" data-title value="' + U.attr(data.title || '') + '" placeholder="What needs to be done?" data-autofocus>', null, true) +
      UI.field('Description', '<textarea class="textarea" data-desc placeholder="Add context, links or acceptance criteria" style="min-height:80px">' + U.esc(data.description || '') + '</textarea>') +
      '<div class="row gap-3">' +
      UI.field('Status', '<select class="select" data-status>' + [['todo', 'To Do'], ['inprogress', 'In Progress'], ['review', 'Review'], ['done', 'Completed']].map(s =>
        '<option value="' + s[0] + '"' + ((data.status || 'todo') === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select>') +
      UI.field('Priority', '<select class="select" data-priority>' + ['low', 'medium', 'high', 'urgent'].map(p =>
        '<option value="' + p + '"' + ((data.priority || 'medium') === p ? ' selected' : '') + '>' + U.cap(p) + '</option>').join('') + '</select>') +
      '</div>' +
      '<div class="row gap-3">' +
      UI.field('Assignee', '<select class="select" data-assignee>' + Store.people().map(p =>
        '<option value="' + p.id + '"' + ((data.assigneeId || Store.state.meId) === p.id ? ' selected' : '') + '>' + U.esc(p.name) + '</option>').join('') + '</select>') +
      UI.field('Due date', '<input class="input" type="date" data-due value="' + (data.due ? new Date(data.due).toISOString().slice(0, 10) : U.addDays(new Date(), 3).toISOString().slice(0, 10)) + '">') +
      '</div>' +
      UI.field('Labels', '<input class="input" data-labels value="' + U.attr((data.labels || []).join(', ')) + '" placeholder="Apollo, Launch">', 'Separate labels with commas') +
      '<div><div class="label mb-2">Checklist</div>' +
      '<div class="col gap-2" data-subs></div>' +
      '<button class="btn ghost sm mt-2" data-addsub>' + icon('plus') + 'Add a subtask</button></div>';
    const subs = wrap.querySelector('[data-subs]');
    (data.subtasks || []).forEach(s => addSub(s.title, s.done));
    function addSub(title, done) {
      const row = el('div', { class: 'row gap-2' });
      row.innerHTML = '<button class="check' + (done ? ' on' : '') + '" data-sd>' + icon('check') + '</button>' +
        '<input class="input grow" value="' + U.attr(title || '') + '" placeholder="Subtask"><button class="icon-btn" data-rm>' + icon('x') + '</button>';
      row.querySelector('[data-sd]').onclick = function () { this.classList.toggle('on'); };
      row.querySelector('[data-rm]').onclick = () => row.remove();
      subs.appendChild(row);
    }
    wrap.querySelector('[data-addsub]').onclick = () => addSub();

    UI.modal({
      icon: 'tasks', title: editing ? 'Edit task' : 'Create a task',
      sub: data.source && Store.conv(data.source) ? 'from ' + Store.convTitle(Store.conv(data.source)) : 'Tasks can be created from any message',
      size: 'lg', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: editing ? 'Save task' : 'Create task', variant: 'primary', icon: editing ? 'check' : 'plus', onClick: function () {
        const title = wrap.querySelector('[data-title]').value.trim();
        if (!title) { UI.toast('Give the task a title.', 'error'); return false; }
        const payload = {
          title: title,
          description: wrap.querySelector('[data-desc]').value.trim(),
          status: wrap.querySelector('[data-status]').value,
          priority: wrap.querySelector('[data-priority]').value,
          assigneeId: wrap.querySelector('[data-assignee]').value,
          due: new Date(wrap.querySelector('[data-due]').value + 'T17:00:00').toISOString(),
          labels: wrap.querySelector('[data-labels]').value.split(',').map(s => s.trim()).filter(Boolean),
          subtasks: U.qsa('.row', subs).map(r => ({ id: U.uid('st'), title: r.querySelector('input').value.trim(), done: r.querySelector('.check').classList.contains('on') })).filter(s => s.title),
          source: data.source || null
        };
        let t;
        if (editing) t = Store.updateTask(data.id, payload);
        else t = Store.createTask(payload);
        UI.toast(editing ? 'Task updated.' : 'Task created and assigned to ' + Store.person(t.assigneeId).first + '.', 'success', {
          action: editing ? null : 'View', onAction: () => App.route('#/tasks')
        });
        if (!editing && t.assigneeId !== Store.state.meId) {
          Store.pushNotification({ type: 'task', actorId: Store.state.meId, target: { kind: 'task', id: t.id }, text: 'assigned a task to ' + Store.person(t.assigneeId).first, preview: t.title });
        }
        cb && cb(t);
      } }]
    });
  };

  M.taskDetail = function (id, cb) {
    const t = Store.task(id);
    if (!t) { UI.toast('Task not found.', 'error'); return; }
    const wrap = el('div', { class: 'col gap-4' });
    function draw() {
      wrap.innerHTML =
        '<div class="row gap-2 wrap">' + UI.statusBadge(t.status) + UI.priorityBadge(t.priority) +
        (t.labels || []).map(l => '<span class="chip tiny">' + U.esc(l) + '</span>').join('') + '</div>' +
        (t.description ? '<p class="md">' + U.renderRich(t.description) + '</p>' : '<p class="tiny subtle">No description.</p>') +
        '<div class="grid grid-2">' +
        '<div><div class="tiny muted mb-1">Assignee</div><div class="row gap-2">' + UI.avatar(t.assigneeId, 28) + '<span class="semi md">' + U.esc(Store.person(t.assigneeId).name) + '</span></div></div>' +
        '<div><div class="tiny muted mb-1">Created by</div><div class="row gap-2">' + UI.avatar(t.creatorId, 28) + '<span class="semi md">' + U.esc(Store.person(t.creatorId).name) + '</span></div></div>' +
        '<div><div class="tiny muted mb-1">Due</div><div class="semi md ' + (new Date(t.due) < Date.now() && t.status !== 'done' ? 'danger-text' : '') + '">' + U.esc(U.dateLong(t.due)) + '</div></div>' +
        '<div><div class="tiny muted mb-1">Created</div><div class="semi md">' + U.esc(U.dateShort(t.createdAt)) + '</div></div>' +
        '</div>' +
        (t.source && Store.conv(t.source) ? '<button class="lrow" data-src><span class="ci-hash">' + icon('chat') + '</span>' +
          '<span class="grow text-left"><span class="tiny muted block">Created from</span><span class="semi md">' + U.esc(Store.convTitle(Store.conv(t.source))) + '</span></span>' + icon('chevronRight') + '</button>' : '') +
        ((t.subtasks || []).length ? '<div><div class="panel-title">Checklist · ' + t.subtasks.filter(s => s.done).length + ' of ' + t.subtasks.length + '</div>' +
          '<div class="progress thin mb-3"><i style="width:' + U.pct(t.subtasks.filter(s => s.done).length, t.subtasks.length) + '%"></i></div>' +
          t.subtasks.map((s, i) => '<label class="check-row" data-sub="' + i + '"><span class="check' + (s.done ? ' on' : '') + '">' + icon('check') + '</span>' +
            '<span class="md ' + (s.done ? 'subtle' : '') + '" style="' + (s.done ? 'text-decoration:line-through' : '') + '">' + U.esc(s.title) + '</span></label>').join('') + '</div>' : '') +
        '<div><div class="panel-title">Comments</div>' +
        ((t.comments || []).length ? t.comments.map(c => '<div class="row-start gap-2 mb-3">' + UI.avatar(c.authorId, 26) +
          '<div class="grow"><div class="row gap-2"><span class="semi tiny">' + U.esc(Store.person(c.authorId).name) + '</span>' +
          '<span class="tiny subtle">' + U.esc(U.ago(c.ts)) + '</span></div><div class="md">' + U.esc(c.text) + '</div></div></div>').join('')
          : '<div class="tiny subtle mb-3">No comments yet.</div>') +
        '<div class="row gap-2"><input class="input grow" data-comment placeholder="Add a comment…"><button class="btn primary sm" data-post>' + icon('send') + '</button></div></div>';
      bind();
    }
    function bind() {
      U.qsa('[data-sub]', wrap).forEach(l => l.onclick = function () {
        const i = +l.dataset.sub; t.subtasks[i].done = !t.subtasks[i].done;
        Store.persist(); Store.emit('tasks:update'); draw();
      });
      const src = wrap.querySelector('[data-src]');
      if (src) src.onclick = () => { m.close(); App.route('#/messages/' + t.source); };
      const post = function () {
        const v = wrap.querySelector('[data-comment]').value.trim();
        if (!v) return;
        t.comments = t.comments || [];
        t.comments.push({ id: U.uid('tc'), authorId: Store.state.meId, ts: new Date().toISOString(), text: v });
        Store.persist(); Store.emit('tasks:update'); draw();
      };
      wrap.querySelector('[data-post]').onclick = post;
      wrap.querySelector('[data-comment]').onkeydown = e => { if (e.key === 'Enter') post(); };
    }
    draw();
    const m = UI.modal({
      icon: 'tasks', title: t.title, sub: 'Task · ' + U.cap(t.priority) + ' priority', size: 'lg', body: wrap,
      actions: [
        { label: 'Delete', variant: 'danger-ghost', close: false, onClick: function () {
          UI.confirm({ title: 'Delete this task?', body: '“' + t.title + '” will be removed permanently.', danger: true, confirmLabel: 'Delete' })
            .then(ok => { if (ok) { Store.deleteTask(t.id); m.close(); cb && cb(); UI.toast('Task deleted.', 'success'); } });
        } },
        { label: 'Edit', variant: 'ghost', onClick: () => M.createTask(t, cb) },
        { label: t.status === 'done' ? 'Reopen' : 'Mark complete', variant: 'primary', icon: 'check', onClick: function () {
          Store.updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' });
          UI.toast(t.status === 'done' ? 'Task completed.' : 'Task reopened.', 'success'); cb && cb();
        } }
      ]
    });
  };

  M.shareTask = function (id) {
    const t = Store.task(id);
    M.pickConversation(Store.convs().filter(c => !c.archived), function (cid) {
      Store.sendMessage(cid, { text: 'Sharing a task: **' + t.title + '** — assigned to ' + Store.person(t.assigneeId).first + ', due ' + U.dateShort(t.due), task: { id: t.id } });
      App.route('#/messages/' + cid);
      UI.toast('Task shared.', 'success');
    });
  };

  M.actionItems = function (actions, cid) {
    const wrap = el('div');
    if (!actions.length) {
      wrap.innerHTML = UI.empty({ icon: 'listChecks', title: 'No action items found', desc: 'Thrive AI could not find anything that reads like a commitment or request in this conversation.', tone: 'neutral' });
      UI.modal({ icon: 'sparkles', title: 'Action items', body: wrap, actions: [{ label: 'Close', variant: 'ghost' }] });
      return;
    }
    const chosen = new Set(actions.map((_, i) => i));
    function draw() {
      wrap.innerHTML = '<div class="tiny muted mb-3">' + icon('sparkles') + ' Thrive AI found ' + U.plural(actions.length, 'possible action item') + '. Review the owner and date before creating tasks.</div>' +
        actions.map(function (a, i) {
          return '<div class="action-row"><button class="check' + (chosen.has(i) ? ' on' : '') + '" data-ck="' + i + '">' + icon('check') + '</button>' +
            '<div class="grow min0"><div class="md semi">' + U.esc(a.text) + '</div>' +
            '<div class="row gap-2 mt-2 wrap">' +
            '<select class="select sm" data-as="' + i + '" style="height:28px;font-size:var(--fs-sm);width:auto">' +
            Store.people().map(p => '<option value="' + p.id + '"' + ((a.assigneeId || Store.state.meId) === p.id ? ' selected' : '') + '>' + U.esc(p.name) + '</option>').join('') + '</select>' +
            '<input class="input" type="date" data-du="' + i + '" value="' + new Date(a.due).toISOString().slice(0, 10) + '" style="height:28px;font-size:var(--fs-sm);width:auto">' +
            '<select class="select" data-pr="' + i + '" style="height:28px;font-size:var(--fs-sm);width:auto">' +
            ['low', 'medium', 'high', 'urgent'].map(p => '<option value="' + p + '"' + (a.priority === p ? ' selected' : '') + '>' + U.cap(p) + '</option>').join('') + '</select>' +
            '</div></div></div>';
        }).join('');
      U.qsa('[data-ck]', wrap).forEach(b => b.onclick = function () {
        const i = +b.dataset.ck;
        if (chosen.has(i)) chosen.delete(i); else chosen.add(i);
        b.classList.toggle('on');
      });
    }
    draw();
    UI.modal({
      icon: 'sparkles', title: 'Action items detected', sub: cid ? Store.convTitle(Store.conv(cid)) : 'Your workspace', size: 'lg', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Create selected tasks', variant: 'primary', icon: 'tasks', onClick: function () {
        if (!chosen.size) { UI.toast('Select at least one action item.', 'warn'); return false; }
        let n = 0;
        chosen.forEach(function (i) {
          const a = actions[i];
          Store.createTask({
            title: a.text,
            assigneeId: wrap.querySelector('[data-as="' + i + '"]').value,
            due: new Date(wrap.querySelector('[data-du="' + i + '"]').value + 'T17:00:00').toISOString(),
            priority: wrap.querySelector('[data-pr="' + i + '"]').value,
            source: cid, labels: ['AI-extracted'],
            description: 'Extracted by Thrive AI from ' + (cid ? Store.convTitle(Store.conv(cid)) : 'a conversation') + '.'
          });
          n++;
        });
        UI.toast(U.plural(n, 'task') + ' created.', 'success', { action: 'View tasks', onAction: () => App.route('#/tasks') });
      } }]
    });
  };

  M.reminder = function (cid, mid) {
    const opts = [['30 minutes', 30], ['1 hour', 60], ['3 hours', 180], ['Tomorrow morning', 60 * 16], ['Next week', 60 * 24 * 7]];
    const wrap = el('div', { class: 'col gap-2' });
    wrap.innerHTML = opts.map((o, i) => '<button class="lrow" data-rem="' + o[1] + '">' + icon('clock') +
      '<span class="grow text-left md semi">' + o[0] + '</span><span class="tiny muted">' + U.time(U.addMin(new Date(), o[1])) + '</span></button>').join('') +
      '<div class="divider"></div>' + UI.field('Custom note', '<input class="input" data-note placeholder="What is this about?">');
    const m = UI.modal({ icon: 'clock', title: 'Remind me about this', sub: cid ? Store.convTitle(Store.conv(cid)) : '', size: 'sm', body: wrap, actions: [{ label: 'Cancel', variant: 'ghost' }] });
    U.qsa('[data-rem]', wrap).forEach(b => b.onclick = function () {
      m.close();
      UI.toast('Reminder set for ' + U.time(U.addMin(new Date(), +b.dataset.rem)) + '.', 'success');
      Store.pushNotification({ type: 'message', actorId: Store.state.meId, target: { kind: 'dm', id: cid }, text: 'set a reminder', preview: wrap.querySelector('[data-note]').value || 'Follow up on this conversation' });
    });
  };

  /* ------------------------------------------------------------------ */
  /* Files                                                              */
  /* ------------------------------------------------------------------ */
  M.uploadFile = function (folderId, cb) {
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      '<div class="upload-zone" data-zone>' + icon('upload') +
      '<div class="semi md">Drop files here, or click to browse</div>' +
      '<div class="tiny muted mt-1">Up to 250 MB per file. Blocked types: .exe, .bat, .cmd, .scr, .js</div></div>' +
      '<div data-queue class="col gap-2"></div>' +
      UI.field('Folder', '<select class="select" data-folder><option value="">No folder</option>' +
        Store.state.folders.map(f => '<option value="' + f.id + '"' + (folderId === f.id ? ' selected' : '') + '>' + U.esc(f.name) + '</option>').join('') + '</select>') +
      UI.field('Also share to', '<select class="select" data-share><option value="">Do not share</option></select>');
    const shareSel = wrap.querySelector('[data-share]') || wrap.querySelectorAll('select')[1];
    shareSel.innerHTML = '<option value="">Do not share to a conversation</option>' + Store.convs().filter(c => !c.archived).map(c => '<option value="' + c.id + '">' + U.esc(Store.convTitle(c)) + '</option>').join('');

    const input = el('input', { type: 'file', multiple: 'true', style: 'display:none' });
    wrap.appendChild(input);
    const queue = [];
    const zone = wrap.querySelector('[data-zone]');
    zone.onclick = () => input.click();
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag'); Array.from(e.dataTransfer.files).forEach(add); });
    input.addEventListener('change', () => Array.from(input.files).forEach(add));

    function add(file) {
      const blocked = ['exe', 'bat', 'cmd', 'scr', 'js'];
      const item = { name: file.name, size: file.size, progress: 0, state: 'uploading' };
      if (blocked.includes(U.ext(file.name))) { item.state = 'blocked'; item.progress = 100; }
      else if (file.size > 250 * 1024 * 1024) { item.state = 'toobig'; item.progress = 100; }
      else if (file.type.startsWith('image/')) { try { item.url = URL.createObjectURL(file); } catch (e) {} }
      queue.push(item); drawQueue();
      if (item.state !== 'uploading') return;
      const iv = setInterval(function () {
        item.progress = Math.min(100, item.progress + 9 + Math.random() * 18);
        if (item.progress >= 100) { item.state = 'done'; clearInterval(iv); }
        drawQueue();
      }, 140);
    }
    function drawQueue() {
      wrap.querySelector('[data-queue]').innerHTML = queue.map(function (q, i) {
        if (q.state === 'blocked' || q.state === 'toobig') {
          return '<div class="att-chip failed">' + icon('alertCircle') +
            '<div class="grow min0"><div class="semi tiny truncate">' + U.esc(q.name) + '</div>' +
            '<div class="tiny">' + (q.state === 'blocked' ? 'Blocked by your organisation\'s file policy' : 'Larger than the 250 MB limit') + '</div></div>' +
            '<button class="icon-btn sm" data-qrm="' + i + '">' + icon('x') + '</button></div>';
        }
        return '<div class="att-chip">' + (q.url ? '<span class="att-thumb" style="background-image:url(' + q.url + ')"></span>' : UI.fileGlyph(q.name, 32)) +
          '<div class="grow min0"><div class="semi tiny truncate">' + U.esc(q.name) + '</div>' +
          '<div class="tiny muted">' + U.bytes(q.size) + (q.state === 'uploading' ? ' · ' + Math.round(q.progress) + '%' : ' · ready') + '</div>' +
          (q.state === 'uploading' ? '<div class="progress thin mt-1"><i style="width:' + q.progress + '%"></i></div>' : '') + '</div>' +
          '<button class="icon-btn sm" data-qrm="' + i + '">' + icon('x') + '</button></div>';
      }).join('');
      U.qsa('[data-qrm]', wrap).forEach(b => b.onclick = () => { queue.splice(+b.dataset.qrm, 1); drawQueue(); });
    }

    UI.modal({
      icon: 'upload', title: 'Upload files', sub: 'Files are scanned for malware and encrypted at rest', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Upload', variant: 'primary', icon: 'upload', onClick: function () {
        const good = queue.filter(q => q.state === 'done');
        if (!good.length) { UI.toast('Add at least one valid file.', 'warn'); return false; }
        const share = shareSel.value;
        const ids = good.map(q => Store.addFile({ name: q.name, size: q.size, folderId: wrap.querySelector('[data-folder]').value || null, url: q.url, source: share || null }).id);
        if (share) Store.sendMessage(share, { text: '', files: ids });
        UI.toast(U.plural(good.length, 'file') + ' uploaded' + (share ? ' and shared to ' + Store.convTitle(Store.conv(share)) : '') + '.', 'success');
        cb && cb();
        App.renderMain();
      } }]
    });
  };

  M.filePreview = function (id) {
    const f = Store.file(id);
    if (!f) { UI.toast('File not found.', 'error'); return; }
    const kind = U.fileKind(f.name);
    const meta = U.fileMeta(f.name);
    const wrap = el('div', { class: 'file-preview' });
    let viewer;
    if (kind === 'image' && f.url) viewer = '<div class="fp-stage"><img src="' + U.attr(f.url) + '" alt="' + U.attr(f.name) + '"></div>';
    else if (kind === 'image') viewer = '<div class="fp-stage ph" style="background:' + U.avColor(f.id) + '"><span>' + icon('image') + '</span></div>';
    else if (kind === 'video') viewer = '<div class="fp-stage dark"><div class="fp-video"><button class="call-btn lg">' + icon('play') + '</button>' +
      '<div class="fp-vbar"><span class="mono tiny">00:00</span><div class="progress thin grow"><i style="width:0%"></i></div><span class="mono tiny">04:12</span></div></div></div>';
    else if (kind === 'audio') viewer = '<div class="fp-stage"><div class="voice-msg" style="width:100%;max-width:420px"><button class="vm-play">' + icon('play') + '</button>' +
      '<div class="vm-wave">' + Array.from({ length: 40 }, () => '<i style="height:' + (20 + Math.random() * 70) + '%"></i>').join('') + '</div><span class="mono tiny">2:14</span></div></div>';
    else viewer = '<div class="fp-stage doc"><div class="doc-page">' + docPreview(f) + '</div></div>';

    wrap.innerHTML = viewer +
      '<div class="fp-side">' +
      '<div class="row gap-3 mb-4">' + UI.fileGlyph(f.name, 44) +
      '<div class="min0"><div class="semi md truncate">' + U.esc(f.name) + '</div>' +
      '<div class="tiny muted">' + meta.label + ' · ' + U.bytes(f.size) + '</div></div></div>' +
      '<div class="col gap-3 md">' +
      kvRow('Owner', Store.person(f.ownerId).name) +
      kvRow('Modified', U.dateLong(f.modifiedAt)) +
      kvRow('Created', U.dateShort(f.createdAt)) +
      kvRow('Version', 'v' + f.versions) +
      kvRow('Shared in', f.source && Store.conv(f.source) ? Store.convTitle(Store.conv(f.source)) : 'Not shared') +
      kvRow('Access', f.permission === 'restricted' ? 'Restricted' : 'Everyone in the organisation') +
      kvRow('Downloads', String(f.downloads)) +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="panel-title">Activity</div>' +
      '<div class="col gap-2">' +
      activity('viewed this file', f.ownerId, 40) +
      activity('shared it in a conversation', f.ownerId, 320) +
      activity('uploaded version ' + f.versions, f.ownerId, 900) +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="col gap-2">' +
      '<button class="btn soft block" data-fp="ai">' + icon('sparkles') + 'Summarise this document</button>' +
      '<button class="btn block" data-fp="share">' + icon('share') + 'Share</button>' +
      '<button class="btn block" data-fp="download">' + icon('download') + 'Download</button>' +
      '<button class="btn ghost block" data-fp="versions">' + icon('clock') + 'Version history</button>' +
      '<button class="btn ghost block" data-fp="perms">' + icon('lock') + 'Permissions</button>' +
      '</div></div>';

    const m = UI.modal({ icon: meta.icon, title: f.name, sub: meta.label + ' · ' + U.bytes(f.size), size: 'xl', body: wrap, actions: false });
    m.modal.classList.add('preview-modal');
    U.qsa('[data-fp]', wrap).forEach(b => b.onclick = function () {
      const a = b.dataset.fp;
      if (a === 'download') M.downloadFile(f.id);
      if (a === 'share') M.shareFile(f.id);
      if (a === 'versions') M.fileVersions(f.id);
      if (a === 'perms') M.filePermissions(f.id);
      if (a === 'ai') M.summariseDoc(f.id);
    });
    const vp = wrap.querySelector('.vm-play, .call-btn');
    if (vp) vp.onclick = () => UI.toast('Playback starts here in the full application.', 'info');
  };
  function kvRow(k, v) { return '<div class="row between gap-3"><span class="muted tiny">' + U.esc(k) + '</span><span class="semi tiny text-right">' + U.esc(v) + '</span></div>'; }
  function activity(text, who, mins) {
    return '<div class="row gap-2">' + UI.avatar(who, 22) + '<span class="tiny"><b>' + U.esc(Store.person(who).first) + '</b> ' + U.esc(text) + ' <span class="subtle">· ' + U.esc(U.ago(DATA.t(mins))) + '</span></span></div>';
  }
  function docPreview(f) {
    const ext = U.ext(f.name);
    if (['xlsx', 'csv'].includes(ext)) {
      return '<div class="sheet"><div class="sheet-row head"><span>A</span><span>B</span><span>C</span><span>D</span></div>' +
        [['Depot', 'Dispatches', 'p95 (ms)', 'Errors'], ['Lisbon', '12,480', '389', '0.01%'], ['Porto', '8,214', '402', '0.02%'],
        ['Madrid', '15,902', '412', '0.02%'], ['Lyon', '6,733', '377', '0.01%'], ['Total', '43,329', '412', '0.02%']]
          .map((r, i) => '<div class="sheet-row' + (i === 0 ? ' bold' : '') + '">' + r.map(c => '<span>' + c + '</span>').join('') + '</div>').join('') + '</div>';
    }
    if (ext === 'pptx') {
      return '<div class="slide"><h3>Apollo GA — readiness</h3><ul><li>Load test: p95 412 ms at 3× peak</li>' +
        '<li>RC3 green on all environments</li><li>Rollback: a single feature flag</li>' +
        '<li>Open risk: German translation</li></ul><div class="slide-foot">Northbeam Technologies · Confidential</div></div>';
    }
    if (['sql', 'json', 'md'].includes(ext)) {
      return '<pre class="code-page">' + U.esc(ext === 'sql'
        ? 'CREATE TABLE dispatch_events (\n  id           uuid PRIMARY KEY,\n  depot_id     uuid NOT NULL,\n  driver_id    uuid,\n  occurred_at  timestamptz NOT NULL,\n  event_type   text NOT NULL,\n  payload      jsonb NOT NULL\n);\n\nCREATE INDEX ON dispatch_events (depot_id, occurred_at DESC);'
        : '{\n  "color": {\n    "brand": "#0b8a6e",\n    "surface": "#ffffff"\n  },\n  "radius": { "md": "11px" },\n  "space": { "4": "16px" }\n}') + '</pre>';
    }
    return '<div class="doc-text"><h3>' + U.esc(f.name.replace(/\.[^.]+$/, '')) + '</h3>' +
      '<p>This document is part of the ' + (f.source && Store.conv(f.source) ? Store.convTitle(Store.conv(f.source)) : 'Northbeam') + ' workstream. ' +
      'It was last updated by ' + U.esc(Store.person(f.ownerId).name) + ' ' + U.esc(U.ago(f.modifiedAt)) + '.</p>' +
      '<p>Apollo reaches general availability on 12 April. The routing service has passed load testing at three times peak traffic with a p95 of 412 milliseconds, comfortably inside the 600 millisecond budget agreed with the platform team.</p>' +
      '<p>Two items remain open: the German translation of the launch assets, and the in-app tour script from Customer Success. Both are tracked in the launch checklist with named owners.</p>' +
      '<p class="doc-note">Preview shows the first page. Download the file to see everything.</p></div>';
  }

  M.summariseDoc = function (id) {
    const f = Store.file(id);
    const body = el('div');
    body.innerHTML = '<div class="ai-block"><div class="row gap-2 mb-3">' + icon('sparkles') + '<span class="semi md">Reading ' + U.esc(f.name) + '…</span><span class="spinner"></span></div><div data-o></div></div>';
    UI.modal({ icon: 'sparkles', title: 'Document summary', sub: f.name, body: body, actions: [{ label: 'Close', variant: 'ghost' }] });
    AI.think(900).then(function () {
      body.querySelector('.row').innerHTML = icon('sparkles') + '<span class="semi md">Summary</span><span class="badge aurora">Thrive AI</span>';
      const out = body.querySelector('[data-o]');
      out.innerHTML = '<div class="ai-headline">' + U.esc(f.name.replace(/\.[^.]+$/, '')) + ' — ' + U.bytes(f.size) + ', last updated ' + U.esc(U.ago(f.modifiedAt)) + ' by ' + U.esc(Store.person(f.ownerId).name) + '</div>';
      const txt = el('div', { class: 'md mt-3' });
      out.appendChild(txt);
      AI.stream(txt, 'This document covers Apollo general availability readiness. The key numbers are a p95 latency of 412 milliseconds at three times peak traffic and a 0.02% error rate, both inside the agreed budget. Rollback is a single feature flag and has been tested twice. Two open items remain: the German translation of launch assets, and the in-app tour script from Customer Success. The recommended decision is to proceed with the 12 April date, contingent on the translation landing.', { speed: 8 })
        .then(function () {
          out.insertAdjacentHTML('beforeend', '<div class="row gap-2 mt-4"><button class="btn sm" data-c2>' + icon('copy') + 'Copy</button>' +
            '<button class="btn sm" data-t2>' + icon('tasks') + 'Create follow-up task</button></div>');
          out.querySelector('[data-c2]').onclick = () => UI.copyToast(txt.textContent, 'Summary copied.');
          out.querySelector('[data-t2]').onclick = () => M.createTask({ title: 'Follow up on ' + f.name, description: txt.textContent.slice(0, 200) });
        });
    });
  };

  M.downloadFile = function (id) {
    const f = Store.file(id);
    const close = UI.toast('Downloading ' + f.name + '…', 'info', { duration: 1600 });
    Store.updateFile(id, { downloads: (f.downloads || 0) + 1 });
    setTimeout(() => UI.toast(f.name + ' downloaded (' + U.bytes(f.size) + ').', 'success'), 1300);
  };

  M.shareFile = function (id, folderId) {
    const f = id ? Store.file(id) : null;
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      '<div class="row gap-3 mb-1">' + (f ? UI.fileGlyph(f.name, 40) : icon('folder')) +
      '<div class="min0"><div class="semi md truncate">' + U.esc(f ? f.name : (Store.state.folders.find(x => x.id === folderId) || {}).name || 'Folder') + '</div>' +
      '<div class="tiny muted">' + (f ? U.bytes(f.size) : 'Folder') + '</div></div></div>' +
      '<div><div class="label mb-2">Share with people</div><div data-picker></div></div>' +
      UI.field('Their permission', '<select class="select" data-perm><option value="view">Can view</option><option value="comment">Can comment</option><option value="edit" selected>Can edit</option><option value="full">Can edit and share</option></select>') +
      '<div class="divider"></div>' +
      '<div><div class="label mb-2">Or share to a conversation</div>' +
      '<select class="select" data-conv><option value="">Choose a conversation…</option>' +
      Store.convs().filter(c => !c.archived).map(c => '<option value="' + c.id + '">' + U.esc(Store.convTitle(c)) + '</option>').join('') + '</select></div>' +
      '<div class="divider"></div>' +
      '<div class="link-share"><div class="row between mb-2"><span class="semi md">Link sharing</span>' +
      '<button class="switch on" data-switch="link"></button></div>' +
      '<div class="row gap-2"><input class="input grow mono tiny" readonly value="https://northbeam.ithrive.app/f/' + U.attr(id || folderId || 'x') + '">' +
      '<button class="btn sm" data-copy>' + icon('copy') + 'Copy</button></div>' +
      '<div class="tiny subtle mt-2">' + icon('lock') + ' Anyone in Northbeam Technologies with the link can view. External sharing is disabled by your administrator.</div></div>';
    const picker = UI.peoplePicker({ placeholder: 'Search people…' });
    wrap.querySelector('[data-picker]').appendChild(picker.el);
    UI.bindSwitches(wrap);
    wrap.querySelector('[data-copy]').onclick = () => UI.copyToast(wrap.querySelector('.link-share input').value, 'Link copied.');
    UI.modal({
      icon: 'share', title: 'Share', size: 'lg', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Share', variant: 'primary', icon: 'send', onClick: function () {
        const ids = picker.get(), conv = wrap.querySelector('[data-conv]').value;
        if (!ids.length && !conv) { UI.toast('Choose people or a conversation.', 'warn'); return false; }
        if (conv && f) { Store.sendMessage(conv, { text: '', files: [f.id] }); App.renderMain(); }
        if (ids.length && f) Store.updateFile(f.id, { sharedWith: U.uniq((f.sharedWith || []).concat(ids)) });
        UI.toast('Shared with ' + (ids.length ? U.plural(ids.length, 'person', 'people') : Store.convTitle(Store.conv(conv))) + '.', 'success');
      } }]
    });
  };

  M.fileVersions = function (id) {
    const f = Store.file(id);
    const wrap = el('div');
    const versions = Array.from({ length: f.versions }, (_, i) => ({
      v: f.versions - i,
      ts: DATA.t(i * 1800 + 20),
      by: i === 0 ? f.ownerId : U.sample(Store.people()).id,
      size: Math.round(f.size * (1 - i * 0.06)),
      note: i === 0 ? 'Current version' : ['Incorporated review comments', 'Updated the numbers', 'Fixed formatting', 'First draft'][Math.min(3, i - 1)] || 'Revision'
    }));
    wrap.innerHTML = '<div class="mini-list">' + versions.map(v =>
      '<div class="lrow"><span class="ver-badge">v' + v.v + '</span>' +
      '<span class="grow min0"><span class="semi md block">' + U.esc(v.note) + '</span>' +
      '<span class="tiny muted">' + U.esc(Store.person(v.by).name) + ' · ' + U.esc(U.ago(v.ts)) + ' · ' + U.bytes(v.size) + '</span></span>' +
      (v.v === f.versions ? '<span class="badge success">Current</span>' :
        '<button class="btn sm" data-restore="' + v.v + '">Restore</button>') +
      '<button class="icon-btn sm" data-vdl="' + v.v + '" data-tip="Download">' + icon('download') + '</button></div>').join('') + '</div>';
    UI.modal({ icon: 'clock', title: 'Version history', sub: f.name, body: wrap, actions: [{ label: 'Close', variant: 'ghost' }] });
    U.qsa('[data-restore]', wrap).forEach(b => b.onclick = function () {
      UI.confirm({ title: 'Restore version ' + b.dataset.restore + '?', body: 'The current version is kept in history, so you can undo this.', confirmLabel: 'Restore' })
        .then(ok => { if (ok) { Store.updateFile(id, { versions: f.versions + 1 }); UI.toast('Version ' + b.dataset.restore + ' restored as v' + (f.versions + 1) + '.', 'success'); } });
    });
    U.qsa('[data-vdl]', wrap).forEach(b => b.onclick = () => UI.toast('Downloading version ' + b.dataset.vdl + '…', 'info'));
  };

  M.filePermissions = function (id) {
    const f = Store.file(id);
    const wrap = el('div', { class: 'col gap-4' });
    const people = U.uniq([f.ownerId].concat(f.sharedWith || [], ['p10', 'p21', 'p6']));
    wrap.innerHTML =
      UI.field('General access', '<select class="select" data-gen>' +
        '<option value="org"' + (f.permission === 'org' ? ' selected' : '') + '>Everyone in Northbeam Technologies</option>' +
        '<option value="restricted"' + (f.permission === 'restricted' ? ' selected' : '') + '>Restricted — only people with access</option>' +
        '<option value="channel">People in the channel it was shared to</option></select>') +
      '<div><div class="label mb-2">People with access</div><div class="mini-list">' +
      people.map(function (pid, i) {
        return '<div class="lrow">' + UI.avatar(pid, 30) +
          '<span class="grow min0"><span class="semi md block truncate">' + U.esc(Store.person(pid).name) + '</span>' +
          '<span class="tiny muted">' + U.esc(Store.person(pid).email) + '</span></span>' +
          (pid === f.ownerId ? '<span class="badge brand">Owner</span>' :
            '<select class="select" style="width:130px;height:30px;font-size:var(--fs-sm)"><option>Can view</option><option>Can comment</option><option selected>Can edit</option><option>Can share</option></select>') +
          '</div>';
      }).join('') + '</div></div>' +
      '<div class="col gap-1">' +
      UI.switchRow('Allow downloads', 'Turn off to make the file view-only', true, 'dl') +
      UI.switchRow('Allow copying and printing', '', true, 'cp') +
      UI.switchRow('Watermark previews', 'Shows the viewer\'s name across the preview', f.permission === 'restricted', 'wm') +
      UI.switchRow('Expire access', 'Automatically remove access after 30 days', false, 'exp') +
      '</div>';
    UI.bindSwitches(wrap);
    UI.modal({ icon: 'lock', title: 'Permissions', sub: f.name, size: 'lg', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Save', variant: 'primary', onClick: function () {
        Store.updateFile(id, { permission: wrap.querySelector('[data-gen]').value });
        UI.toast('Permissions updated.', 'success');
      } }] });
  };

  M.fileMenu = function (anchor, id, cb) {
    const f = Store.file(id);
    UI.menu(anchor, [
      { label: 'Preview', icon: 'eye', onClick: () => M.filePreview(id) },
      { label: 'Download', icon: 'download', onClick: () => M.downloadFile(id) },
      { label: 'Share', icon: 'share', onClick: () => M.shareFile(id) },
      { label: 'Copy link', icon: 'link', onClick: () => UI.copyToast('https://northbeam.ithrive.app/f/' + id, 'File link copied.') },
      { sep: true },
      { label: f.starred ? 'Remove from favourites' : 'Add to favourites', icon: 'star', onClick: () => { Store.updateFile(id, { starred: !f.starred }); cb && cb(); UI.toast(f.starred ? 'Added to favourites.' : 'Removed from favourites.', 'success'); } },
      { label: 'Rename', icon: 'edit', onClick: () => UI.prompt({ title: 'Rename file', label: 'File name', value: f.name }).then(v => { if (v) { Store.updateFile(id, { name: v }); cb && cb(); UI.toast('File renamed.', 'success'); } }) },
      { label: 'Move to folder…', icon: 'folder', onClick: () => moveFile(id, cb) },
      { label: 'Make a copy', icon: 'copy', onClick: () => { Store.addFile(Object.assign({}, f, { id: undefined, name: f.name.replace(/(\.[^.]+)?$/, ' (copy)$1'), versions: 1 })); cb && cb(); UI.toast('Copy created.', 'success'); } },
      { sep: true },
      { label: 'Summarise with AI', icon: 'sparkles', onClick: () => M.summariseDoc(id) },
      { label: 'Version history', icon: 'clock', onClick: () => M.fileVersions(id) },
      { label: 'Permissions', icon: 'lock', onClick: () => M.filePermissions(id) },
      { sep: true },
      { label: 'Delete', icon: 'trash', danger: true, onClick: function () {
        UI.confirm({ title: 'Delete ' + f.name + '?', body: 'The file is removed from every conversation it was shared in. This cannot be undone.', danger: true, confirmLabel: 'Delete file' })
          .then(ok => { if (ok) { Store.deleteFile(id); cb && cb(); App.renderMain(); UI.toast('File deleted.', 'success'); } });
      } }
    ], { align: 'right' });
  };
  function moveFile(id, cb) {
    const wrap = el('div');
    wrap.innerHTML = '<div class="mini-list">' +
      '<button class="lrow" data-mv="">' + icon('folder') + '<span class="grow text-left md">No folder (top level)</span></button>' +
      Store.state.folders.map(f => '<button class="lrow" data-mv="' + f.id + '">' +
        '<span class="fc-ic sm" style="background:' + f.color + '18;color:' + f.color + '">' + icon('folder') + '</span>' +
        '<span class="grow text-left md semi">' + U.esc(f.name) + '</span></button>').join('') + '</div>';
    const m = UI.modal({ icon: 'folder', title: 'Move to folder', size: 'sm', body: wrap, actions: [{ label: 'Cancel', variant: 'ghost' }] });
    U.qsa('[data-mv]', wrap).forEach(b => b.onclick = function () {
      Store.updateFile(id, { folderId: b.dataset.mv || null });
      m.close(); cb && cb(); UI.toast('File moved.', 'success');
    });
  }

  /* ------------------------------------------------------------------ */
  /* Meetings                                                           */
  /* ------------------------------------------------------------------ */
  M.instantMeeting = function () {
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Meeting name', '<input class="input" data-title value="Quick sync — ' + U.time(new Date()) + '" data-autofocus>') +
      '<div><div class="label mb-2">Invite people</div><div data-picker></div></div>' +
      '<div class="col gap-1">' +
      UI.switchRow('Turn on my camera', '', true, 'cam') +
      UI.switchRow('Enable the lobby', 'People wait until you admit them', false, 'lobby') +
      UI.switchRow('Record this meeting', '', false, 'rec') +
      '</div>';
    const picker = UI.peoplePicker({ placeholder: 'Search people to invite…' });
    wrap.querySelector('[data-picker]').appendChild(picker.el);
    UI.bindSwitches(wrap);
    UI.modal({
      icon: 'video', title: 'Start an instant meeting', sub: 'Everyone gets a notification and a join link', body: wrap,
      actions: [
        { label: 'Copy link only', variant: 'ghost', close: false, onClick: () => UI.copyToast('https://meet.ithrive.app/' + U.uid('').slice(1, 9), 'Meeting link copied.') },
        { label: 'Start meeting', variant: 'primary', icon: 'video', onClick: function () {
          const ids = picker.get();
          if (!ids.length) { UI.toast('Invite at least one person.', 'warn'); return false; }
          const m = Store.createMeeting({
            title: wrap.querySelector('[data-title]').value.trim() || 'Quick sync',
            participantIds: [Store.state.meId].concat(ids), start: new Date().toISOString(),
            end: U.addMin(new Date(), 30).toISOString(), durationMin: 30, status: 'live',
            recording: wrap.querySelector('[data-switch="rec"]').classList.contains('on')
          });
          Calls.start({ meetingId: m.id, kind: 'video', peerIds: ids, title: m.title, hostId: Store.state.meId });
        } }
      ]
    });
  };

  M.scheduleMeeting = function (data, cb) {
    data = data || {};
    const editing = !!data.id;
    const start = data.start ? new Date(data.start) : U.addMin(new Date(), 60 - new Date().getMinutes());
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Title', '<input class="input" data-title value="' + U.attr(data.title || '') + '" placeholder="e.g. Apollo weekly review" data-autofocus>', null, true) +
      '<div class="row gap-3">' +
      UI.field('Date', '<input class="input" type="date" data-date value="' + start.toISOString().slice(0, 10) + '">') +
      UI.field('Start', '<input class="input" type="time" data-time value="' + U.time24(start) + '">') +
      UI.field('Duration', '<select class="select" data-dur>' + [15, 30, 45, 60, 90, 120].map(d =>
        '<option value="' + d + '"' + ((data.durationMin || 30) === d ? ' selected' : '') + '>' + U.dur(d) + '</option>').join('') + '</select>') +
      '</div>' +
      UI.field('Description', '<textarea class="textarea" data-desc placeholder="What is this meeting for?" style="min-height:70px">' + U.esc(data.description || '') + '</textarea>') +
      '<div><div class="label mb-2">Participants</div><div data-picker></div><div class="tiny muted mt-2" data-conflict></div></div>' +
      '<div class="row gap-3">' +
      UI.field('Recurrence', '<select class="select" data-rec><option>Does not repeat</option><option>Every weekday</option><option>Weekly</option><option>Every two weeks</option><option>Monthly</option></select>') +
      UI.field('Location', '<select class="select" data-loc><option>iThrive Meeting</option><option>Lisbon HQ — Tagus Room</option><option>Lisbon HQ — Douro Room</option><option>Bengaluru — Nilgiri Room</option><option>No location</option></select>') +
      '</div>' +
      '<div><div class="row between mb-2"><span class="label">Agenda</span>' +
      '<button class="btn sm soft" data-genagenda>' + icon('sparkles') + 'Generate with AI</button></div>' +
      '<div class="col gap-2" data-agenda></div>' +
      '<button class="btn ghost sm mt-2" data-additem>' + icon('plus') + 'Add agenda item</button></div>' +
      '<div class="col gap-1">' +
      UI.switchRow('Enable the lobby', 'Participants wait until admitted', true, 'lobby') +
      UI.switchRow('Record automatically', '', false, 'rec') +
      UI.switchRow('Generate AI notes and summary', '', true, 'ainotes') +
      UI.switchRow('Send a reminder 10 minutes before', '', true, 'remind') +
      '</div>';
    const picker = UI.peoplePicker({ selected: (data.participantIds || []).filter(i => i !== Store.state.meId), placeholder: 'Search colleagues to invite…', onChange: checkConflicts });
    wrap.querySelector('[data-picker]').appendChild(picker.el);
    UI.bindSwitches(wrap);
    const agenda = wrap.querySelector('[data-agenda]');
    (data.agenda || []).forEach(a => addItem(typeof a === 'string' ? a : a.text, a.minutes));
    function addItem(text, mins) {
      const row = el('div', { class: 'row gap-2' });
      row.innerHTML = '<input class="input grow" value="' + U.attr(text || '') + '" placeholder="Agenda item">' +
        '<input class="input" style="width:74px" value="' + (mins || 10) + '" type="number" min="1"> <span class="tiny muted" style="align-self:center">min</span>' +
        '<button class="icon-btn" data-rm>' + icon('x') + '</button>';
      row.querySelector('[data-rm]').onclick = () => row.remove();
      agenda.appendChild(row);
    }
    wrap.querySelector('[data-additem]').onclick = () => addItem();
    wrap.querySelector('[data-genagenda]').onclick = function () {
      const b = this; b.classList.add('loading');
      AI.think(700).then(function () {
        b.classList.remove('loading');
        agenda.innerHTML = '';
        AI.generateAgenda(wrap.querySelector('[data-title]').value || 'Team meeting', picker.get(), +wrap.querySelector('[data-dur]').value)
          .forEach(i => addItem(i.text, i.minutes));
        UI.toast('Agenda generated. Edit anything you like.', 'success');
      });
    };
    function checkConflicts() {
      const ids = picker.get();
      const d = wrap.querySelector('[data-date]').value, tm = wrap.querySelector('[data-time]').value;
      if (!d || !tm) return;
      const s = new Date(d + 'T' + tm);
      const e = U.addMin(s, +wrap.querySelector('[data-dur]').value);
      const conflicts = [];
      ids.forEach(function (id) {
        Store.state.meetings.forEach(function (m) {
          if (!m.participantIds.includes(id)) return;
          if (new Date(m.start) < e && new Date(m.end) > s) conflicts.push({ id, m });
        });
      });
      const box = wrap.querySelector('[data-conflict]');
      if (!conflicts.length) { box.innerHTML = ids.length ? '<span class="success-text">' + icon('checkCircle') + ' Everyone is free at that time.</span>' : ''; return; }
      box.innerHTML = '<span class="warn-text">' + icon('alertTriangle') + ' ' + U.plural(U.uniq(conflicts.map(c => c.id)).length, 'person', 'people') + ' already busy: ' +
        U.uniq(conflicts.map(c => Store.person(c.id).first + ' (' + c.m.title + ')')).slice(0, 3).join(', ') + '</span>';
    }
    ['[data-date]', '[data-time]', '[data-dur]'].forEach(s => wrap.querySelector(s).addEventListener('change', checkConflicts));

    UI.modal({
      icon: 'calendarPlus', title: editing ? 'Edit meeting' : 'Schedule a meeting', size: 'lg', body: wrap,
      sub: 'Invitations go out immediately with a join link and calendar entry',
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: editing ? 'Save meeting' : 'Schedule', variant: 'primary', icon: 'calendarPlus', onClick: function () {
        const title = wrap.querySelector('[data-title]').value.trim();
        if (!title) { UI.toast('Give the meeting a title.', 'error'); return false; }
        const s = new Date(wrap.querySelector('[data-date]').value + 'T' + wrap.querySelector('[data-time]').value);
        const dur = +wrap.querySelector('[data-dur]').value;
        const payload = {
          title: title, description: wrap.querySelector('[data-desc]').value.trim(),
          start: s.toISOString(), end: U.addMin(s, dur).toISOString(), durationMin: dur,
          participantIds: U.uniq([Store.state.meId].concat(picker.get())),
          location: wrap.querySelector('[data-loc]').value,
          lobby: wrap.querySelector('[data-switch="lobby"]').classList.contains('on'),
          recording: wrap.querySelector('[data-switch="rec"]').classList.contains('on'),
          agenda: U.qsa('.row', agenda).map(r => ({ text: r.querySelector('input').value.trim(), minutes: +r.querySelectorAll('input')[1].value })).filter(a => a.text)
        };
        const m = editing ? Store.updateMeeting(data.id, payload) : Store.createMeeting(payload);
        UI.toast(editing ? 'Meeting updated and participants notified.' : 'Meeting scheduled. ' + U.plural(m.participantIds.length - 1, 'invitation') + ' sent.', 'success', {
          action: 'View', onAction: () => App.route('#/calendar')
        });
        cb && cb(m);
        App.renderMain();
      } }]
    });
    setTimeout(checkConflicts, 100);
  };

  M.meetingDetail = function (id, cb) {
    const m = Store.meeting(id);
    if (!m) return;
    const isPast = new Date(m.end).getTime() < Date.now();
    const live = new Date(m.start) <= Date.now() && !isPast;
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      (live ? '<div class="banner success">' + icon('video') + '<div class="b-body"><strong>This meeting is happening now</strong>' + U.plural(m.participantIds.length, 'person', 'people') + ' invited.</div></div>' : '') +
      '<div class="grid grid-2">' +
      dRow('When', U.dateLong(m.start)) + dRow('Time', U.time(m.start) + ' – ' + U.time(m.end) + ' (' + U.dur(m.durationMin) + ')') +
      dRow('Organiser', Store.person(m.organizerId).name) + dRow('Location', m.location) +
      dRow('Type', U.cap(m.type)) + dRow('Recurrence', m.recurringRule || 'Does not repeat') +
      '</div>' +
      (m.description ? '<div><div class="panel-title">Description</div><p class="md">' + U.esc(m.description) + '</p></div>' : '') +
      ((m.agenda || []).length ? '<div><div class="panel-title">Agenda</div><ol class="agenda-list">' +
        m.agenda.map(a => '<li><span class="grow">' + U.esc(typeof a === 'string' ? a : a.text) + '</span>' +
          (a.minutes ? '<span class="tiny muted">' + a.minutes + ' min</span>' : '') + '</li>').join('') + '</ol></div>' : '') +
      '<div><div class="panel-title">Participants · ' + m.participantIds.length + '</div>' +
      '<div class="mini-list">' + m.participantIds.map(function (pid) {
        const rsvp = pid === m.organizerId ? 'Organiser' : (U.hashInt(pid + m.id) % 5 === 0 ? 'No response' : (U.hashInt(pid) % 7 === 0 ? 'Declined' : 'Accepted'));
        return '<div class="lrow">' + UI.avatar(pid, 30) +
          '<span class="grow min0"><span class="semi md block truncate">' + U.esc(Store.person(pid).name) + '</span>' +
          '<span class="tiny muted truncate">' + U.esc(Store.person(pid).title) + '</span></span>' +
          '<span class="badge ' + (rsvp === 'Accepted' ? 'success' : rsvp === 'Declined' ? 'danger' : rsvp === 'Organiser' ? 'brand' : '') + '">' + rsvp + '</span></div>';
      }).join('') + '</div></div>' +
      '<div class="link-share"><div class="row gap-2"><input class="input grow mono tiny" readonly value="' + U.attr(m.link) + '">' +
      '<button class="btn sm" data-copy>' + icon('copy') + 'Copy</button></div>' +
      '<div class="tiny subtle mt-2">Dial-in: +351 21 000 4821 · PIN 449 201#</div></div>';

    const actions = [];
    if (isPast) {
      actions.push({ label: 'AI summary', variant: 'ghost', icon: 'sparkles', onClick: () => M.meetingSummary(m) });
      if (m.recording) actions.push({ label: 'Recording', variant: 'ghost', icon: 'play', onClick: () => M.playRecording(m.id) });
      actions.push({ label: 'Close', variant: 'primary' });
    } else {
      actions.push({ label: 'Cancel meeting', variant: 'danger-ghost', close: false, onClick: function () {
        UI.confirm({ title: 'Cancel this meeting?', body: 'All participants will be notified that “' + m.title + '” has been cancelled.', danger: true, confirmLabel: 'Cancel meeting' })
          .then(ok => { if (ok) { Store.deleteMeeting(m.id); document.querySelectorAll('.modal-scrim').forEach(s => s.remove()); document.body.style.overflow = ''; cb && cb(); App.renderMain(); UI.toast('Meeting cancelled.', 'success'); } });
      } });
      actions.push({ label: 'Edit', variant: 'ghost', icon: 'edit', onClick: () => M.scheduleMeeting(m, cb) });
      actions.push({ label: live ? 'Join now' : 'Join', variant: 'primary', icon: 'video', onClick: () => Calls.joinMeeting(m.id) });
    }
    UI.modal({ icon: 'video', title: m.title, sub: U.dayLabel(m.start) + ' · ' + U.time(m.start), size: 'lg', body: wrap, actions: actions });
    wrap.querySelector('[data-copy]').onclick = () => UI.copyToast(m.link, 'Meeting link copied.');
  };
  function dRow(k, v) { return '<div><div class="tiny muted mb-1">' + U.esc(k) + '</div><div class="semi md">' + U.esc(v) + '</div></div>'; }

  M.meetingAgenda = function (id) {
    const m = Store.meeting(id);
    const body = el('div');
    body.innerHTML = '<div class="ai-block"><div class="row gap-2 mb-3">' + icon('sparkles') + '<span class="semi md">Building an agenda…</span><span class="spinner"></span></div><div data-o></div></div>';
    UI.modal({ icon: 'sparkles', title: 'Meeting agenda', sub: m.title, body: body, actions: [{ label: 'Close', variant: 'ghost' }] });
    AI.think(760).then(function () {
      const items = (m.agenda && m.agenda.length) ? m.agenda.map(a => typeof a === 'string' ? { text: a, minutes: Math.round(m.durationMin / m.agenda.length) } : a)
        : AI.generateAgenda(m.title, m.participantIds, m.durationMin);
      body.querySelector('.row').innerHTML = icon('sparkles') + '<span class="semi md">Suggested agenda</span><span class="badge aurora">Thrive AI</span>';
      const out = body.querySelector('[data-o]');
      out.innerHTML = '<ol class="agenda-list">' + items.map(i => '<li><span class="grow">' + U.esc(i.text) + '</span><span class="tiny muted">' + i.minutes + ' min</span></li>').join('') + '</ol>' +
        '<div class="tiny subtle mt-3">Total ' + U.dur(items.reduce((n, i) => n + i.minutes, 0)) + ' for a ' + U.dur(m.durationMin) + ' meeting.</div>' +
        '<div class="row gap-2 mt-4"><button class="btn sm" data-save>' + icon('check') + 'Save to meeting</button>' +
        '<button class="btn sm" data-send>' + icon('send') + 'Send to participants</button>' +
        '<button class="btn sm ghost" data-copy2>' + icon('copy') + 'Copy</button></div>';
      out.querySelector('[data-save]').onclick = function () { Store.updateMeeting(m.id, { agenda: items }); UI.toast('Agenda saved to the meeting.', 'success'); };
      out.querySelector('[data-send]').onclick = function () { UI.toast('Agenda sent to all ' + m.participantIds.length + ' participants.', 'success'); };
      out.querySelector('[data-copy2]').onclick = () => UI.copyToast(items.map((i, n) => (n + 1) + '. ' + i.text + ' (' + i.minutes + ' min)').join('\n'), 'Agenda copied.');
    });
  };

  M.meetingSummary = function (m, notes) {
    const body = el('div');
    body.innerHTML = '<div class="ai-block"><div class="ai-status row gap-2 mb-3">' + icon('sparkles') +
      '<span class="semi md">Processing the meeting…</span><span class="spinner"></span></div><div data-o></div></div>';
    const modal = UI.modal({ icon: 'sparkles', title: 'Meeting summary', sub: m.title, size: 'lg', body: body, actions: [{ label: 'Close', variant: 'ghost' }] });
    modal.modal.classList.add('ai-modal');
    AI.think(950).then(function () {
      const s = AI.meetingSummary(m);
      body.querySelector('.ai-status').innerHTML = icon('sparkles') + '<span class="semi md">Summary and notes</span><span class="badge aurora">Thrive AI</span>';
      const out = body.querySelector('[data-o]');
      out.innerHTML =
        '<div class="ai-headline">' + U.esc(s.headline) + '</div>' +
        '<p class="md mt-2">' + U.esc(s.overview) + '</p>' +
        (notes ? '<div class="ai-section"><div class="panel-title">Shared notes taken during the meeting</div><p class="md">' + U.esc(notes) + '</p></div>' : '') +
        (s.keyPoints.length ? '<div class="ai-section"><div class="panel-title">Key points</div><ul class="ai-list">' +
          s.keyPoints.map(k => '<li>' + UI.avatar(k.authorId, 18) + '<span>' + U.esc(k.text) + '</span></li>').join('') + '</ul></div>' : '') +
        (s.decisions.length ? '<div class="ai-section"><div class="panel-title">Decisions</div><ul class="ai-list">' +
          s.decisions.map(d => '<li>' + icon('checkCircle') + '<span>' + U.esc(d) + '</span></li>').join('') + '</ul></div>' : '') +
        (s.actions.length ? '<div class="ai-section"><div class="panel-title">Action items</div><ul class="ai-list">' +
          s.actions.map((a, i) => '<li>' + icon('listChecks') + '<span>' + U.esc(a.text) + '<span class="tiny muted"> — ' + U.esc(Store.person(a.assigneeId || Store.state.meId).first) + ', due ' + U.esc(U.dateShort(a.due)) + '</span></span>' +
            '<button class="btn sm soft" data-mk="' + i + '">Create task</button></li>').join('') + '</ul></div>' : '') +
        '<div class="ai-section"><div class="panel-title">Next steps</div><ul class="ai-list">' +
        s.nextSteps.map(n => '<li>' + icon('arrowRight') + '<span>' + U.esc(n) + '</span></li>').join('') + '</ul></div>' +
        '<div class="ai-section"><div class="panel-title">Attendance</div><div class="chip-row">' +
        s.attendance.map(a => '<span class="chip">' + UI.avatar(a.id, 18, { presence: false }) + U.esc(a.name) + '</span>').join('') + '</div></div>' +
        '<div class="row gap-2 mt-4 wrap">' +
        '<button class="btn sm" data-copy3>' + icon('copy') + 'Copy notes</button>' +
        '<button class="btn sm" data-share3>' + icon('send') + 'Share with participants</button>' +
        '<button class="btn sm" data-tasks3>' + icon('tasks') + 'Create all tasks</button>' +
        '<button class="btn sm ghost" data-tx3>' + icon('captions') + 'View transcript</button>' +
        '</div>' +
        '<div class="ai-disclaimer">' + icon('info') + 'Generated from the meeting, its agenda and related messages. Check anything you plan to act on.</div>';
      U.qsa('[data-mk]', out).forEach(b => b.onclick = function () {
        const a = s.actions[+b.dataset.mk];
        Store.createTask({ title: a.text, assigneeId: a.assigneeId || Store.state.meId, due: new Date(a.due).toISOString(), priority: a.priority, labels: ['Meeting'], description: 'From “' + m.title + '”.' });
        b.outerHTML = '<span class="badge success">' + icon('check') + 'Created</span>';
      });
      out.querySelector('[data-copy3]').onclick = () => UI.copyToast(out.innerText, 'Meeting notes copied.');
      out.querySelector('[data-share3]').onclick = function () { UI.toast('Notes sent to all ' + m.participantIds.length + ' participants.', 'success'); };
      out.querySelector('[data-tasks3]').onclick = function () {
        s.actions.forEach(a => Store.createTask({ title: a.text, assigneeId: a.assigneeId || Store.state.meId, due: new Date(a.due).toISOString(), priority: a.priority, labels: ['Meeting'] }));
        UI.toast(U.plural(s.actions.length, 'task') + ' created.', 'success');
      };
      out.querySelector('[data-tx3]').onclick = () => M.transcript(m);
    });
  };

  M.transcript = function (m) {
    const lines = AI.transcript(m);
    const wrap = el('div');
    wrap.innerHTML = '<div class="input-wrap mb-3">' + icon('search') + '<input class="input" data-txq placeholder="Search the transcript"></div>' +
      '<div class="transcript" data-txbody>' + lines.map(l => '<div class="tx-line"><span class="tx-at mono tiny">' + l.at + '</span>' +
        UI.avatar(l.speakerId, 22) + '<span class="semi tiny">' + U.esc(Store.person(l.speakerId).first) + '</span>' +
        '<span class="md">' + U.esc(l.text) + '</span></div>').join('') + '</div>';
    UI.modal({ icon: 'captions', title: 'Transcript', sub: m.title, size: 'lg', body: wrap,
      actions: [{ label: 'Download', variant: 'ghost', onClick: () => UI.toast('Transcript downloaded as .txt', 'success') }, { label: 'Close', variant: 'primary' }] });
    wrap.querySelector('[data-txq]').addEventListener('input', function (e) {
      const q = e.target.value.toLowerCase();
      U.qsa('.tx-line', wrap).forEach(l => { l.style.display = !q || l.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    });
  };

  M.meetingNotes = function (id) {
    const m = Store.meeting(id);
    const wrap = el('div');
    wrap.innerHTML = '<textarea class="textarea" data-notes style="min-height:280px" placeholder="Shared notes for this meeting…">' +
      U.esc(m.notes || 'Attendees: ' + m.participantIds.map(p => Store.person(p).first).join(', ') + '\n\nDiscussion:\n• \n\nDecisions:\n• \n\nActions:\n• ') + '</textarea>' +
      '<div class="tiny subtle mt-2">Notes are visible to everyone invited to this meeting.</div>';
    UI.modal({ icon: 'fileText', title: 'Meeting notes', sub: m.title, size: 'lg', body: wrap,
      actions: [{ label: 'Generate with AI', variant: 'ghost', icon: 'sparkles', close: false, onClick: () => M.meetingSummary(m) },
      { label: 'Save notes', variant: 'primary', onClick: function () { Store.updateMeeting(id, { notes: wrap.querySelector('[data-notes]').value }); UI.toast('Notes saved and shared with participants.', 'success'); } }] });
  };

  M.playRecording = function (id, call) {
    const m = id ? Store.meeting(id) : null;
    const title = m ? m.title : 'Call recording';
    const dur = m ? m.durationMin * 60 : (call ? call.durationSec : 900);
    const wrap = el('div');
    wrap.innerHTML = '<div class="fp-stage dark" style="min-height:320px"><div class="fp-video">' +
      '<button class="call-btn lg" data-play>' + icon('play') + '</button>' +
      '<div class="fp-vbar"><span class="mono tiny" data-cur>00:00</span><div class="progress thin grow" data-bar><i style="width:0%"></i></div>' +
      '<span class="mono tiny">' + U.durSec(dur) + '</span></div></div></div>' +
      '<div class="row gap-2 mt-3 wrap"><button class="btn sm" data-tx4>' + icon('captions') + 'Transcript</button>' +
      '<button class="btn sm" data-sum4>' + icon('sparkles') + 'AI summary</button>' +
      '<button class="btn sm" data-dl4>' + icon('download') + 'Download</button>' +
      '<button class="btn sm ghost" data-sh4>' + icon('share') + 'Share</button></div>' +
      '<div class="tiny subtle mt-2">Recorded ' + U.esc(m ? U.dateLong(m.start) : U.dateLong(call.start)) + ' · retained for 90 days</div>';
    UI.modal({ icon: 'play', title: title, sub: 'Recording · ' + U.durSec(dur), size: 'lg', body: wrap, actions: [{ label: 'Close', variant: 'ghost' }] });
    let playing = false, t = 0, iv;
    wrap.querySelector('[data-play]').onclick = function () {
      playing = !playing;
      this.innerHTML = icon(playing ? 'pause' : 'play');
      if (playing) {
        iv = setInterval(function () {
          t += 1;
          if (t > dur) { clearInterval(iv); return; }
          wrap.querySelector('[data-cur]').textContent = U.durSec(t);
          wrap.querySelector('[data-bar] i').style.width = U.pct(t, dur) + '%';
        }, 120);
      } else clearInterval(iv);
    };
    wrap.querySelector('[data-tx4]').onclick = () => M.transcript(m || { title: title, durationMin: Math.round(dur / 60), participantIds: call ? call.peerIds.concat([Store.state.meId]) : [], start: new Date().toISOString() });
    wrap.querySelector('[data-sum4]').onclick = () => M.meetingSummary(m || { id: 'x', title: title, organizerId: Store.state.meId, participantIds: call ? call.peerIds.concat([Store.state.meId]) : [], durationMin: Math.round(dur / 60), description: '', start: new Date().toISOString() });
    wrap.querySelector('[data-dl4]').onclick = () => UI.toast('Recording download started (1.2 GB).', 'success');
    wrap.querySelector('[data-sh4]').onclick = () => UI.copyToast('https://northbeam.ithrive.app/rec/' + (id || 'call'), 'Recording link copied.');
  };

  M.newCall = function (kind) {
    const picker = UI.peoplePicker({ placeholder: 'Search people to call…' });
    UI.modal({
      icon: kind === 'video' ? 'video' : 'phone', title: 'New ' + kind + ' call', sub: 'Call one person, or several for a group call', body: picker.el,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Start call', variant: 'primary', icon: kind === 'video' ? 'video' : 'phone', onClick: function () {
        const ids = picker.get();
        if (!ids.length) { UI.toast('Choose at least one person.', 'warn'); return false; }
        Calls.start({ peerIds: ids, kind: kind, cid: ids.length === 1 ? Store.openDM(ids[0]).id : null });
      } }]
    });
  };

  M.deviceSettings = function () {
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Microphone', '<select class="select"><option>MacBook Pro Microphone (built-in)</option><option>Jabra Evolve2 65</option><option>Studio USB Mic</option></select>') +
      '<div class="row gap-2 tiny muted">' + icon('mic') + '<div class="progress grow"><i style="width:38%"></i></div><span>Input level</span></div>' +
      UI.field('Speaker', '<select class="select"><option>MacBook Pro Speakers</option><option>Jabra Evolve2 65</option></select>') +
      UI.field('Camera', '<select class="select"><option>FaceTime HD Camera</option><option>Logitech Brio 4K</option></select>') +
      '<div class="divider"></div>' +
      UI.switchRow('Noise suppression', 'Filter keyboard and background noise', true, 'ns') +
      UI.switchRow('Echo cancellation', '', true, 'ec') +
      UI.switchRow('Automatically adjust microphone level', '', true, 'agc');
    UI.bindSwitches(wrap);
    UI.modal({ icon: 'settings', title: 'Device settings', size: 'sm', body: wrap,
      actions: [{ label: 'Test speaker', variant: 'ghost', close: false, onClick: () => UI.toast('Playing a test tone…', 'info') }, { label: 'Done', variant: 'primary' }] });
  };

  /* ------------------------------------------------------------------ */
  /* People, status, account                                            */
  /* ------------------------------------------------------------------ */
  M.personProfile = function (id) {
    const p = Store.person(id);
    const me = p.id === Store.state.meId;
    const reports = Store.people().filter(x => x.managerId === p.id);
    const sharedChannels = Store.convs().filter(c => c.kind !== 'dm' && c.memberIds.includes(p.id) && c.memberIds.includes(Store.state.meId));
    const wrap = el('div', { class: 'profile-modal' });
    wrap.innerHTML =
      '<div class="pm-hero">' + UI.avatar(p, 84) +
      '<div class="grow min0"><h3>' + U.esc(p.name) + (p.pronouns ? ' <span class="tiny subtle">(' + U.esc(p.pronouns) + ')</span>' : '') + '</h3>' +
      '<div class="md muted">' + U.esc(p.title) + '</div>' +
      '<div class="row gap-2 mt-2 wrap">' + UI.roleBadge(p.role) +
      '<span class="badge"><i class="pres-dot ' + p.presence + '"></i>' + U.esc(UI.presenceLabel(p.presence)) + '</span>' +
      (p.suspended ? '<span class="badge danger">Suspended</span>' : '') + '</div>' +
      (p.statusText ? '<div class="chip mt-3">' + U.esc((p.statusEmoji || '') + ' ' + p.statusText) + '</div>' : '') +
      '</div></div>' +
      (me ? '' : '<div class="row gap-2 mt-4 wrap">' +
        '<button class="btn primary" data-pa="msg">' + icon('chat') + 'Message</button>' +
        '<button class="btn" data-pa="call">' + icon('phone') + 'Call</button>' +
        '<button class="btn" data-pa="video">' + icon('video') + 'Video</button>' +
        '<button class="btn" data-pa="meet">' + icon('calendarPlus') + 'Schedule</button>' +
        '<button class="btn ghost" data-pa="group">' + icon('userPlus') + 'Add to a group</button>' +
        '</div>') +
      '<div class="divider"></div>' +
      '<div class="grid grid-2">' +
      dRow('Department', Store.dept(p.deptId).name) +
      dRow('Team', (Store.team(p.teamId) || {}).name || '—') +
      dRow('Manager', p.managerId ? Store.person(p.managerId).name : '—') +
      dRow('Location', p.location) +
      dRow('Time zone', p.tz + ' · ' + localTime(p)) +
      dRow('Working hours', p.workingHours) +
      dRow('Email', p.email) +
      dRow('Phone', p.phone) +
      dRow('Joined', U.dateLong(p.joined)) +
      dRow('Employee ID', 'NB-' + p.id.toUpperCase().replace('P', '00')) +
      '</div>' +
      ((p.skills || []).length ? '<div><div class="panel-title">Skills</div><div class="chip-row">' +
        p.skills.map(s => '<span class="chip">' + U.esc(s) + '</span>').join('') + '</div></div>' : '') +
      (reports.length ? '<div><div class="panel-title">Direct reports · ' + reports.length + '</div><div class="chip-row">' +
        reports.map(r => '<button class="chip" data-open-person="' + r.id + '">' + UI.avatar(r.id, 18, { presence: false }) + U.esc(r.name) + '</button>').join('') + '</div></div>' : '') +
      (sharedChannels.length ? '<div><div class="panel-title">You are both in</div><div class="chip-row">' +
        sharedChannels.slice(0, 8).map(c => '<button class="chip" data-open-conv="' + c.id + '">' + icon(c.kind === 'channel' ? 'hash' : 'users') + U.esc(c.kind === 'channel' ? c.name : c.name) + '</button>').join('') + '</div></div>' : '') +
      '<div><div class="panel-title">Recent activity</div><div class="col gap-2">' +
      recentActivity(p.id) + '</div></div>';

    const actions = me
      ? [{ label: 'Edit my profile', variant: 'primary', icon: 'edit', onClick: () => App.route('#/settings/profile') }]
      : [{ label: 'More actions', variant: 'ghost', close: false, onClick: (api, btn) => M.personMenu(btn, id) }, { label: 'Close', variant: 'primary' }];
    UI.modal({ icon: 'contacts', title: 'Profile', sub: p.name + ' · ' + Store.dept(p.deptId).name, size: 'lg', body: wrap, actions: actions });

    U.qsa('[data-pa]', wrap).forEach(b => b.onclick = function () {
      const a = b.dataset.pa;
      document.querySelectorAll('.modal-scrim').forEach(s => s.remove()); document.body.style.overflow = '';
      if (a === 'msg') App.openDM(id);
      if (a === 'call') Calls.start({ peerIds: [id], kind: 'audio', cid: 'd-' + id });
      if (a === 'video') Calls.start({ peerIds: [id], kind: 'video', cid: 'd-' + id });
      if (a === 'meet') M.scheduleMeeting({ participantIds: [id] });
      if (a === 'group') M.addToGroup(id);
    });
    U.qsa('[data-open-person]', wrap).forEach(b => b.onclick = () => M.personProfile(b.dataset.openPerson));
    U.qsa('[data-open-conv]', wrap).forEach(b => b.onclick = function () {
      document.querySelectorAll('.modal-scrim').forEach(s => s.remove()); document.body.style.overflow = '';
      App.route('#/messages/' + b.dataset.openConv);
    });
  };
  function localTime(p) {
    const m = /GMT([+-]\d+)(?::(\d+))?/.exec(p.tz);
    if (!m) return '';
    const off = parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
    const d = new Date(Date.now() + (off + new Date().getTimezoneOffset()) * 60000);
    return U.time(d) + ' local';
  }
  function recentActivity(id) {
    const out = [];
    Object.keys(Store.state.messages).forEach(function (cid) {
      const c = Store.conv(cid); if (!c || c.kind === 'dm') return;
      Store.state.messages[cid].forEach(m => { if (m.authorId === id && m.text) out.push({ m, c }); });
    });
    out.sort((a, b) => new Date(b.m.ts) - new Date(a.m.ts));
    if (!out.length) return '<div class="tiny subtle">No recent public activity.</div>';
    return out.slice(0, 4).map(x => '<div class="row-start gap-2"><span class="tiny subtle" style="width:64px;flex:none">' + U.agoShort(x.m.ts) + '</span>' +
      '<span class="tiny"><b>' + U.esc(Store.convTitle(x.c)) + '</b> — ' + U.esc(x.m.text.slice(0, 110)) + '</span></div>').join('');
  }

  M.personMenu = function (anchor, id) {
    const p = Store.person(id);
    UI.menu(anchor, [
      { label: 'View full profile', icon: 'contacts', onClick: () => M.personProfile(id) },
      { label: 'Send a message', icon: 'chat', onClick: () => App.openDM(id) },
      { label: 'Audio call', icon: 'phone', onClick: () => Calls.start({ peerIds: [id], kind: 'audio' }) },
      { label: 'Video call', icon: 'video', onClick: () => Calls.start({ peerIds: [id], kind: 'video' }) },
      { label: 'Schedule a meeting', icon: 'calendarPlus', onClick: () => M.scheduleMeeting({ participantIds: [id] }) },
      { sep: true },
      { label: 'Add to a group', icon: 'userPlus', onClick: () => M.addToGroup(id) },
      { label: 'Add to a channel', icon: 'hash', onClick: () => M.addToChannel(id) },
      { label: 'Copy email address', icon: 'copy', onClick: () => UI.copyToast(p.email, 'Email copied.') },
      { label: 'View their calendar', icon: 'calendar', onClick: () => { App.route('#/calendar'); UI.toast('Showing your calendar — availability for ' + p.first + ' is shown when scheduling.', 'info'); } },
      Store.isAdmin() ? { sep: true } : null,
      Store.isAdmin() ? { label: 'Change role', icon: 'shield', onClick: () => M.changeRole(id) } : null,
      Store.isAdmin() ? { label: p.suspended ? 'Reactivate account' : 'Suspend account', icon: 'userX', danger: !p.suspended, onClick: () => { Store.suspendUser(id); App.renderMain(); UI.toast(p.name + (p.suspended ? ' suspended.' : ' reactivated.'), 'success'); } } : null
    ].filter(Boolean), { align: 'right' });
  };

  M.addToGroup = function (pid) {
    const groups = Store.convs().filter(c => (c.kind === 'group' || c.kind === 'channel') && !c.memberIds.includes(pid) && !c.archived);
    const wrap = el('div');
    wrap.innerHTML = '<div class="mini-list scroll-y" style="max-height:380px">' + groups.map(c =>
      '<button class="lrow" data-ag="' + c.id + '">' + UI.convAvatar(c, 30) +
      '<span class="grow min0 text-left"><span class="semi md block truncate">' + U.esc(Store.convTitle(c)) + '</span>' +
      '<span class="tiny muted">' + U.plural(c.memberIds.length, 'member') + '</span></span>' + icon('plus') + '</button>').join('') + '</div>';
    const m = UI.modal({ icon: 'userPlus', title: 'Add ' + Store.person(pid).first + ' to…', body: wrap, actions: [{ label: 'Cancel', variant: 'ghost' }] });
    U.qsa('[data-ag]', wrap).forEach(b => b.onclick = function () {
      Store.addMembers(b.dataset.ag, [pid]); m.close(); App.renderShell();
      UI.toast(Store.person(pid).first + ' added to ' + Store.convTitle(Store.conv(b.dataset.ag)) + '.', 'success');
    });
  };
  M.addToChannel = M.addToGroup;

  M.setStatus = function () {
    const wrap = el('div', { class: 'col gap-4' });
    const sugg = AI.suggestStatus();
    wrap.innerHTML =
      '<div class="row gap-2"><button class="btn" data-emoji style="width:52px;font-size:20px">' + (Store.state.myStatus.emoji || '😀') + '</button>' +
      '<input class="input grow" data-text value="' + U.attr(Store.state.myStatus.text || '') + '" placeholder="What is your status?" data-autofocus></div>' +
      '<div><div class="label mb-2">' + icon('sparkles') + ' Suggested for you</div><div class="col gap-2">' +
      sugg.map((s, i) => '<button class="lrow" data-sug="' + i + '"><span style="font-size:18px">' + s.emoji + '</span>' +
        '<span class="grow text-left md">' + U.esc(s.text) + '</span><span class="badge"><i class="pres-dot ' + s.presence + '"></i>' + UI.presenceLabel(s.presence) + '</span></button>').join('') + '</div></div>' +
      UI.field('Clear after', '<select class="select" data-clear><option>Do not clear</option><option>30 minutes</option><option>1 hour</option><option>4 hours</option><option selected>Today</option><option>This week</option></select>') +
      '<div class="divider"></div>' +
      '<div><div class="label mb-2">Availability</div><div class="row gap-2 wrap">' +
      ['available', 'busy', 'meeting', 'away', 'dnd', 'offline'].map(p =>
        '<button class="pres-opt' + (Store.state.myPresence === p ? ' on' : '') + '" data-pres="' + p + '"><i class="pres-dot ' + p + '"></i>' + UI.presenceLabel(p) + '</button>').join('') + '</div></div>';
    let emoji = Store.state.myStatus.emoji || '😀';
    let presence = Store.state.myPresence;
    wrap.querySelector('[data-emoji]').onclick = () => M.pickEmoji(e => { emoji = e; wrap.querySelector('[data-emoji]').textContent = e; });
    U.qsa('[data-sug]', wrap).forEach(b => b.onclick = function () {
      const s = sugg[+b.dataset.sug];
      emoji = s.emoji; presence = s.presence;
      wrap.querySelector('[data-emoji]').textContent = emoji;
      wrap.querySelector('[data-text]').value = s.text;
      U.qsa('[data-pres]', wrap).forEach(x => x.classList.toggle('on', x.dataset.pres === presence));
    });
    U.qsa('[data-pres]', wrap).forEach(b => b.onclick = function () {
      presence = b.dataset.pres;
      U.qsa('[data-pres]', wrap).forEach(x => x.classList.remove('on')); b.classList.add('on');
    });
    UI.modal({
      icon: 'smile', title: 'Set your status', body: wrap,
      actions: [
        { label: 'Clear status', variant: 'ghost', onClick: () => { Store.setStatus('', ''); App.renderShell(); UI.toast('Status cleared.', 'success'); } },
        { label: 'Save', variant: 'primary', onClick: function () {
          Store.setStatus(wrap.querySelector('[data-text]').value.trim(), emoji);
          Store.setPresence(presence);
          App.renderShell(); UI.toast('Status updated.', 'success');
        } }
      ]
    });
  };

  M.pickEmoji = function (cb) {
    const wrap = el('div');
    wrap.innerHTML = Object.keys(DATA.EMOJI_SETS).map(k =>
      '<div class="emoji-group"><div class="panel-title">' + k + '</div><div class="emoji-grid">' +
      DATA.EMOJI_SETS[k].map(e => '<button class="emoji-btn" data-pe="' + e + '">' + e + '</button>').join('') + '</div></div>').join('');
    const m = UI.modal({ icon: 'smile', title: 'Choose an emoji', size: 'sm', body: wrap, actions: [{ label: 'Cancel', variant: 'ghost' }] });
    U.qsa('[data-pe]', wrap).forEach(b => b.onclick = function () { cb(b.dataset.pe); m.close(); });
  };

  M.dnd = function () {
    const opts = [['30 minutes', 30], ['1 hour', 60], ['2 hours', 120], ['Until tomorrow', 60 * 16], ['Until I turn it off', 0]];
    const wrap = el('div', { class: 'col gap-2' });
    wrap.innerHTML = opts.map(o => '<button class="lrow" data-dnd="' + o[1] + '">' + icon('moon') +
      '<span class="grow text-left md semi">' + o[0] + '</span>' +
      (o[1] ? '<span class="tiny muted">until ' + U.time(U.addMin(new Date(), o[1])) + '</span>' : '') + '</button>').join('') +
      (Store.state.dnd ? '<div class="divider"></div><button class="btn block" data-off>' + icon('bell') + 'Turn off Do Not Disturb</button>' : '');
    const m = UI.modal({ icon: 'moon', title: 'Pause notifications', sub: 'Urgent mentions can still reach you if Thrive AI thinks it matters', size: 'sm', body: wrap, actions: [{ label: 'Cancel', variant: 'ghost' }] });
    U.qsa('[data-dnd]', wrap).forEach(b => b.onclick = function () {
      Store.state.dnd = true; Store.setPresence('dnd'); Store.persist();
      m.close(); App.renderShell();
      UI.toast('Notifications paused' + (+b.dataset.dnd ? ' until ' + U.time(U.addMin(new Date(), +b.dataset.dnd)) : '') + '.', 'success');
    });
    const off = wrap.querySelector('[data-off]');
    if (off) off.onclick = function () { Store.state.dnd = false; Store.setPresence('available'); Store.persist(); m.close(); App.renderShell(); UI.toast('Notifications resumed.', 'success'); };
  };

  M.changePhoto = function () {
    const wrap = el('div');
    wrap.innerHTML = '<div class="upload-zone" data-zone>' + icon('camera') +
      '<div class="semi md">Drop an image, or click to browse</div>' +
      '<div class="tiny muted mt-1">Square images work best. JPG or PNG up to 5 MB.</div></div>' +
      '<div class="row gap-3 mt-4 center" data-prev></div>';
    const input = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    wrap.appendChild(input);
    wrap.querySelector('[data-zone]').onclick = () => input.click();
    input.addEventListener('change', function () {
      const f = input.files[0]; if (!f) return;
      const url = URL.createObjectURL(f);
      wrap.querySelector('[data-prev]').innerHTML = '<img src="' + url + '" style="width:110px;height:110px;border-radius:50%;object-fit:cover">' +
        '<div class="tiny muted">' + U.esc(f.name) + ' · ' + U.bytes(f.size) + '</div>';
    });
    UI.modal({ icon: 'camera', title: 'Change your photo', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Save photo', variant: 'primary', onClick: () => UI.toast('Profile photo updated.', 'success') }] });
  };

  M.changePassword = function () {
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Current password', '<input class="input" type="password" data-autofocus>') +
      UI.field('New password', '<input class="input" type="password" data-np>', 'At least 14 characters with a number and a symbol') +
      UI.field('Confirm new password', '<input class="input" type="password" data-np2>');
    UI.modal({ icon: 'key', title: 'Change your password', size: 'sm', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Update password', variant: 'primary', onClick: function () {
        const a = wrap.querySelector('[data-np]').value, b = wrap.querySelector('[data-np2]').value;
        if (a.length < 14) { UI.toast('New password must be at least 14 characters.', 'error'); return false; }
        if (a !== b) { UI.toast('The two passwords do not match.', 'error'); return false; }
        UI.toast('Password updated. Other sessions have been signed out.', 'success');
      } }] });
  };

  M.backupCodes = function () {
    const codes = Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6));
    const wrap = el('div');
    wrap.innerHTML = '<div class="banner warn mb-3">' + icon('alertTriangle') + '<div class="b-body"><strong>Store these somewhere safe</strong>Each code works once. They are the only way in if you lose your authenticator.</div></div>' +
      '<div class="codes-grid">' + codes.map(c => '<code>' + c + '</code>').join('') + '</div>';
    UI.modal({ icon: 'key', title: 'Backup codes', size: 'sm', body: wrap,
      actions: [{ label: 'Copy all', variant: 'ghost', close: false, onClick: () => UI.copyToast(codes.join('\n'), 'Backup codes copied.') },
      { label: 'Download', variant: 'ghost', close: false, onClick: () => UI.toast('Backup codes downloaded.', 'success') },
      { label: 'Done', variant: 'primary' }] });
  };

  M.shortcuts = function () {
    const groups = [
      ['Navigation', [['Ctrl / ⌘ K', 'Search everything'], ['Ctrl / ⌘ /', 'Keyboard shortcuts'], ['G then H', 'Go to Home'], ['G then M', 'Go to Messages'], ['G then C', 'Go to Channels'], ['G then T', 'Go to Tasks'], ['G then N', 'Go to Notifications'], ['Esc', 'Close panel or dialog']]],
      ['Messaging', [['Enter', 'Send message'], ['Shift + Enter', 'New line'], ['↑', 'Edit your last message'], ['Ctrl / ⌘ B', 'Bold'], ['Ctrl / ⌘ I', 'Italic'], ['@', 'Mention someone'], ['#', 'Link a channel'], ['/', 'Slash commands']]],
      ['Calls', [['M', 'Mute or unmute'], ['V', 'Camera on or off'], ['H', 'Raise hand'], ['Ctrl / ⌘ Shift S', 'Share screen']]],
      ['Other', [['Ctrl / ⌘ Shift A', 'Ask Thrive AI'], ['Ctrl / ⌘ Shift U', 'Catch me up'], ['Ctrl / ⌘ Shift D', 'Toggle dark mode'], ['Ctrl / ⌘ Shift N', 'New message']]]
    ];
    const wrap = el('div', { class: 'grid grid-2' });
    wrap.innerHTML = groups.map(g2 => '<div><div class="panel-title">' + g2[0] + '</div>' +
      g2[1].map(k => '<div class="row between gap-3 mb-2"><span class="md muted">' + U.esc(k[1]) + '</span><span class="kbd">' + U.esc(k[0]) + '</span></div>').join('') + '</div>').join('');
    UI.modal({ icon: 'command', title: 'Keyboard shortcuts', size: 'lg', body: wrap, actions: [{ label: 'Close', variant: 'primary' }] });
  };

  M.aiHistory = function () {
    const wrap = el('div');
    const items = [
      ['Summarised #project-apollo', 'clock', 12], ['Extracted 5 action items from a thread', 'listChecks', 90],
      ['Drafted a reply to Priya Raghunathan', 'edit', 220], ['Answered “what happened with the load test?”', 'aiChat', 300],
      ['Generated an agenda for Apollo GA go/no-go', 'calendarPlus', 700], ['Translated a message to Portuguese', 'translate', 1400],
      ['Summarised the Q1 all-hands recording', 'video', 2200]
    ];
    wrap.innerHTML = '<div class="mini-list">' + items.map(i =>
      '<div class="lrow">' + icon(i[1]) + '<span class="grow md">' + U.esc(i[0]) + '</span>' +
      '<span class="tiny subtle">' + U.esc(U.ago(DATA.t(i[2]))) + '</span></div>').join('') + '</div>' +
      '<div class="tiny subtle mt-3">Your AI activity is stored for 30 days so you can review what was generated. It is never used for training.</div>';
    UI.modal({ icon: 'clock', title: 'Your Thrive AI activity', body: wrap,
      actions: [{ label: 'Clear history', variant: 'danger-ghost', onClick: () => UI.toast('AI activity history cleared.', 'success') }, { label: 'Close', variant: 'primary' }] });
  };

  /* ------------------------------------------------------------------ */
  /* Announcements                                                      */
  /* ------------------------------------------------------------------ */
  M.createAnnouncement = function (existing, cb) {
    const a = existing || {};
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Title', '<input class="input" data-title value="' + U.attr(a.title || '') + '" placeholder="A clear, specific headline" data-autofocus>', null, true) +
      '<div class="row gap-3">' +
      UI.field('Type', '<select class="select" data-type>' + ['Company', 'Policy', 'Event', 'Department', 'Emergency'].map(t =>
        '<option' + (a.type === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>') +
      UI.field('Audience', '<select class="select" data-aud><option>Everyone</option>' +
        DATA.DEPARTMENTS.map(d => '<option' + (a.audience === d.name ? ' selected' : '') + '>' + U.esc(d.name) + '</option>').join('') +
        '<option>Lisbon office</option><option>Managers only</option></select>') +
      UI.field('Priority', '<select class="select" data-pri><option value="normal">Normal</option><option value="high"' + (a.priority === 'high' ? ' selected' : '') + '>Important</option></select>') +
      '</div>' +
      UI.field('Message', '<textarea class="textarea" data-body style="min-height:170px" placeholder="Write the announcement. Use **bold** and blank lines for paragraphs.">' + U.esc(a.body || '') + '</textarea>') +
      '<div class="row gap-2"><button class="btn sm soft" data-aiwrite>' + icon('sparkles') + 'Improve with AI</button>' +
      '<button class="btn sm ghost" data-attach>' + icon('paperclip') + 'Attach a file</button></div>' +
      '<div class="col gap-1">' +
      UI.switchRow('Require read confirmation', 'People must acknowledge they have read it', !!a.requireRead, 'ack') +
      UI.switchRow('Pin to the top', '', !!a.pinned, 'pin') +
      UI.switchRow('Also post to #announcements', '', true, 'post') +
      UI.switchRow('Send an email as well', '', false, 'email') +
      UI.switchRow('Schedule for later', '', !!a.scheduledFor, 'sched') +
      '</div>' +
      '<div data-schedwrap ' + (a.scheduledFor ? '' : 'hidden') + '>' +
      '<div class="row gap-3">' + UI.field('Publish date', '<input class="input" type="date" data-sdate value="' + (a.scheduledFor ? new Date(a.scheduledFor).toISOString().slice(0, 10) : U.addDays(new Date(), 1).toISOString().slice(0, 10)) + '">') +
      UI.field('Time', '<input class="input" type="time" data-stime value="09:00">') + '</div></div>';
    UI.bindSwitches(wrap, function (k, v) { if (k === 'sched') wrap.querySelector('[data-schedwrap]').hidden = !v; });
    const audSel = wrap.querySelectorAll('select')[1];
    wrap.querySelector('[data-aiwrite]').onclick = function () {
      const b = this, ta = wrap.querySelector('[data-body]');
      if (!ta.value.trim()) { UI.toast('Write a first draft and AI will improve it.', 'warn'); return; }
      b.classList.add('loading');
      AI.think(700).then(function () {
        b.classList.remove('loading');
        const before = ta.value;
        ta.value = AI.rewrite(before, 'formal') + '\n\nIf you have questions, reply in #announcements or contact the author directly.';
        UI.toast('Improved by Thrive AI.', 'success', { action: 'Undo', onAction: () => ta.value = before });
      });
    };
    wrap.querySelector('[data-attach]').onclick = () => UI.toast('Attach files from your device or the workspace in production.', 'info');

    UI.modal({
      icon: 'megaphone', title: existing ? 'Edit announcement' : 'New announcement',
      sub: 'Announcements reach everyone in the audience you choose', size: 'lg', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' },
      { label: 'Save as draft', variant: 'ghost', onClick: () => UI.toast('Draft saved.', 'success') },
      { label: existing ? 'Save' : 'Publish', variant: 'primary', icon: 'send', onClick: function () {
        const title = wrap.querySelector('[data-title]').value.trim();
        const body = wrap.querySelector('[data-body]').value.trim();
        if (!title) { UI.toast('Give the announcement a title.', 'error'); return false; }
        if (!body) { UI.toast('Write the announcement body.', 'error'); return false; }
        const sched = wrap.querySelector('[data-switch="sched"]').classList.contains('on');
        const payload = {
          title: title, body: body, type: wrap.querySelector('[data-type]').value,
          audience: audSel.value, priority: wrap.querySelector('[data-pri]').value,
          requireRead: wrap.querySelector('[data-switch="ack"]').classList.contains('on'),
          pinned: wrap.querySelector('[data-switch="pin"]').classList.contains('on'),
          draft: sched, scheduledFor: sched ? new Date(wrap.querySelector('[data-sdate]').value + 'T' + wrap.querySelector('[data-stime]').value).toISOString() : null
        };
        if (existing) { Object.assign(existing, payload); Store.persist(); }
        else {
          const an = Store.createAnnouncement(payload);
          if (wrap.querySelector('[data-switch="post"]').classList.contains('on') && !sched) {
            Store.sendMessage('c-announcements', { text: '**' + title + '**\n' + body.split('\n\n')[0] });
          }
        }
        UI.toast(sched ? 'Announcement scheduled for ' + U.dateShort(payload.scheduledFor) + '.' : 'Announcement published to ' + payload.audience + '.', 'success');
        cb && cb();
      } }]
    });
  };

  M.announcementDetail = function (id, cb) {
    const a = Store.state.announcements.find(x => x.id === id);
    if (!a) return;
    const unread = !a.readBy.includes(Store.state.meId);
    const wrap = el('div');
    wrap.innerHTML =
      '<div class="row gap-2 mb-3 wrap"><span class="badge brand">' + U.esc(a.type) + '</span>' +
      (a.priority === 'high' ? '<span class="badge danger">Important</span>' : '') +
      (a.pinned ? '<span class="badge">' + icon('pin') + 'Pinned</span>' : '') +
      '<span class="tiny muted">to ' + U.esc(a.audience) + '</span></div>' +
      '<div class="row gap-2 mb-4">' + UI.avatar(a.authorId, 34) +
      '<div><div class="semi md">' + U.esc(Store.person(a.authorId).name) + '</div>' +
      '<div class="tiny muted">' + U.esc(Store.person(a.authorId).title) + ' · ' + U.esc(U.dateLong(a.createdAt)) + '</div></div></div>' +
      '<div class="ann-full md">' + U.renderRich(a.body) + '</div>' +
      ((a.attachments || []).length ? '<div class="file-atts mt-4">' + a.attachments.map(function (fid) {
        const f = Store.file(fid); if (!f) return '';
        return '<div class="file-att" data-preview="' + f.id + '">' + UI.fileGlyph(f.name, 40) +
          '<div class="grow min0"><div class="semi md truncate">' + U.esc(f.name) + '</div><div class="tiny muted">' + U.bytes(f.size) + '</div></div>' +
          '<button class="icon-btn sm">' + icon('download') + '</button></div>';
      }).join('') + '</div>' : '') +
      '<div class="divider"></div>' +
      '<div class="row between"><span class="tiny muted">' + a.readBy.length + ' of ' + Store.people().length + ' have read this</span>' +
      '<div>' + UI.avatarStack(a.readBy.slice(0, 8), 8, 22) + '</div></div>';
    const actions = [];
    if (a.authorId === Store.state.meId || Store.isAdmin()) actions.push({ label: 'Read receipts', variant: 'ghost', onClick: () => M.readReceipts(id) });
    actions.push({ label: 'Share', variant: 'ghost', icon: 'send', onClick: () => M.shareAnnouncement(id) });
    if (a.requireRead && unread) actions.push({ label: 'Acknowledge', variant: 'primary', icon: 'check', onClick: () => { Store.confirmRead(id); UI.toast('Acknowledged.', 'success'); cb && cb(); } });
    else actions.push({ label: 'Close', variant: 'primary' });
    UI.modal({ icon: 'megaphone', title: a.title, size: 'lg', body: wrap, actions: actions });
    U.qsa('[data-preview]', wrap).forEach(b => b.onclick = () => M.filePreview(b.dataset.preview));
    if (!unread) return;
    if (!a.requireRead) Store.confirmRead(id);
  };

  M.readReceipts = function (id) {
    const a = Store.state.announcements.find(x => x.id === id);
    const read = a.readBy, unread = Store.people().filter(p => !read.includes(p.id));
    const wrap = el('div');
    wrap.innerHTML = UI.tabs([{ id: 'read', label: 'Read', count: read.length }, { id: 'unread', label: 'Not read', count: unread.length }], 'read') +
      '<div data-rr class="mt-3 scroll-y" style="max-height:360px"></div>';
    function draw(tab) {
      const list = tab === 'read' ? read.map(i => Store.person(i)) : unread;
      wrap.querySelector('[data-rr]').innerHTML = list.length ? '<div class="mini-list">' + list.map(p =>
        '<div class="lrow">' + UI.avatar(p, 28) + '<span class="grow min0"><span class="semi md block truncate">' + U.esc(p.name) + '</span>' +
        '<span class="tiny muted">' + U.esc(Store.dept(p.deptId).name) + '</span></span>' +
        (tab === 'read' ? '<span class="badge success">' + icon('check') + '</span>' : '<button class="btn sm ghost" data-nudge="' + p.id + '">Nudge</button>') + '</div>').join('') + '</div>'
        : '<div class="tiny muted" style="padding:20px">Nobody in this list.</div>';
      U.qsa('[data-nudge]', wrap).forEach(b => b.onclick = () => UI.toast('Reminder sent to ' + Store.person(b.dataset.nudge).first + '.', 'success'));
    }
    draw('read');
    UI.bindTabs(wrap, draw);
    UI.modal({ icon: 'eye', title: 'Read receipts', sub: a.title, body: wrap,
      actions: [{ label: 'Remind everyone who has not read it', variant: 'ghost', onClick: () => UI.toast('Reminder sent to ' + unread.length + ' people.', 'success') }, { label: 'Close', variant: 'primary' }] });
  };

  M.shareAnnouncement = function (id) {
    const a = Store.state.announcements.find(x => x.id === id);
    M.pickConversation(Store.convs().filter(c => !c.archived), function (cid) {
      Store.sendMessage(cid, { text: '📣 **' + a.title + '**\n' + a.body.split('\n\n')[0] });
      App.route('#/messages/' + cid);
      UI.toast('Announcement shared.', 'success');
    });
  };

  /* ------------------------------------------------------------------ */
  /* Admin flows                                                        */
  /* ------------------------------------------------------------------ */
  M.inviteUser = function (cb) {
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Email addresses', '<textarea class="textarea" data-emails placeholder="name@northbeam.io, another@northbeam.io" style="min-height:80px" data-autofocus></textarea>', 'Separate several with commas or new lines') +
      '<div class="row gap-3">' +
      UI.field('Role', '<select class="select" data-role>' + ['Employee', 'Manager', 'Team Lead', 'Admin', 'Guest', 'External Collaborator'].map(r => '<option>' + r + '</option>').join('') + '</select>') +
      UI.field('Department', '<select class="select" data-dept><option value="">Not set</option>' + DATA.DEPARTMENTS.map(d => '<option value="' + d.id + '">' + U.esc(d.name) + '</option>').join('') + '</select>') +
      '</div>' +
      '<div><div class="label mb-2">Add them to these channels</div><div class="chip-row" data-chans>' +
      ['c-general', 'c-announcements', 'c-random', 'c-people-ops'].map((c, i) => {
        const cv = Store.conv(c);
        return '<button class="chip' + (i < 2 ? ' on' : '') + '" data-ch="' + c + '">#' + U.esc(cv ? cv.name : c) + '</button>';
      }).join('') + '</div></div>' +
      UI.field('Personal note (optional)', '<textarea class="textarea" data-note style="min-height:60px" placeholder="Welcome to the team!"></textarea>') +
      '<div class="col gap-1">' +
      UI.switchRow('Send a welcome email', '', true, 'welcome') +
      UI.switchRow('Require them to set up two-factor authentication', '', true, 'tfa') +
      '</div>';
    UI.bindSwitches(wrap);
    U.qsa('[data-ch]', wrap).forEach(b => b.onclick = () => b.classList.toggle('on'));
    UI.modal({
      icon: 'userPlus', title: 'Invite people', sub: 'They will receive an email with a secure join link', size: 'lg', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' },
      { label: 'Copy join link', variant: 'ghost', close: false, onClick: () => UI.copyToast('https://northbeam.ithrive.app/join/NB-4K92-XZ71', 'Join link copied.') },
      { label: 'Send invitations', variant: 'primary', icon: 'send', onClick: function () {
        const emails = wrap.querySelector('[data-emails]').value.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
        if (!emails.length) { UI.toast('Enter at least one email address.', 'error'); return false; }
        const bad = emails.filter(e => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
        if (bad.length) { UI.toast('These addresses do not look valid: ' + bad.slice(0, 2).join(', '), 'error'); return false; }
        emails.forEach(e => Store.inviteUser({ email: e, name: '', role: wrap.querySelector('[data-role]').value, deptId: wrap.querySelector('[data-dept]').value || null }));
        UI.toast(U.plural(emails.length, 'invitation') + ' sent.', 'success');
        cb && cb();
      } }]
    });
  };

  M.bulkInvite = function (cb) {
    const wrap = el('div');
    wrap.innerHTML = '<div class="upload-zone">' + icon('upload') +
      '<div class="semi md">Drop a CSV file, or click to browse</div>' +
      '<div class="tiny muted mt-1">Columns: email, first_name, last_name, role, department</div></div>' +
      '<button class="btn sm ghost mt-3" data-tmpl>' + icon('download') + 'Download the template</button>';
    UI.modal({ icon: 'upload', title: 'Bulk invite from CSV', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Upload and preview', variant: 'primary', onClick: () => UI.toast('Choose a CSV file to continue.', 'info') }] });
  };

  M.changeRole = function (pid, cb) {
    const p = Store.person(pid);
    const roles = ['Owner', 'Super Admin', 'Admin', 'Manager', 'Team Lead', 'Employee', 'Guest', 'External Collaborator'];
    const wrap = el('div', { class: 'col gap-2' });
    wrap.innerHTML = roles.map(r => '<label class="radio-card' + (p.role === r ? ' on' : '') + '" data-role="' + r + '">' +
      '<span class="check radio' + (p.role === r ? ' on' : '') + '"></span>' +
      '<span><span class="semi md block">' + r + '</span><span class="tiny muted">' + roleDesc(r) + '</span></span></label>').join('');
    let sel = p.role;
    U.qsa('[data-role]', wrap).forEach(r => r.onclick = function () {
      sel = r.dataset.role;
      U.qsa('[data-role]', wrap).forEach(x => { x.classList.remove('on'); x.querySelector('.check').classList.remove('on'); });
      r.classList.add('on'); r.querySelector('.check').classList.add('on');
    });
    UI.modal({ icon: 'shield', title: 'Change role', sub: p.name + ' · currently ' + p.role, body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Change role', variant: 'primary', onClick: function () {
        if (sel === p.role) { UI.toast('No change made.', 'info'); return; }
        Store.setUserRole(pid, sel);
        UI.toast(p.name + ' is now ' + sel + '.', 'success'); cb && cb();
      } }] });
  };
  function roleDesc(r) {
    return {
      'Owner': 'Full control including billing and workspace deletion',
      'Super Admin': 'Everything except billing',
      'Admin': 'Users, channels, security and audit logs',
      'Manager': 'Announcements, their department and team analytics',
      'Team Lead': 'Their team channels and members',
      'Employee': 'Messaging, files, meetings and tasks',
      'Guest': 'Only the channels they are invited to',
      'External Collaborator': 'Scoped project access, no directory'
    }[r] || '';
  }

  M.changeDept = function (pid, cb) {
    const p = Store.person(pid);
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Department', '<select class="select" data-d>' + DATA.DEPARTMENTS.map(d => '<option value="' + d.id + '"' + (p.deptId === d.id ? ' selected' : '') + '>' + U.esc(d.name) + '</option>').join('') + '</select>') +
      UI.field('Team', '<select class="select" data-t><option value="">None</option>' + DATA.TEAMS.map(t => '<option value="' + t.id + '"' + (p.teamId === t.id ? ' selected' : '') + '>' + U.esc(t.name) + '</option>').join('') + '</select>') +
      UI.field('Manager', '<select class="select" data-m><option value="">None</option>' + Store.people().filter(x => x.id !== pid).map(x => '<option value="' + x.id + '"' + (p.managerId === x.id ? ' selected' : '') + '>' + U.esc(x.name) + '</option>').join('') + '</select>') +
      '<div class="banner info">' + icon('info') + '<div class="b-body">Changing department also updates their department channel membership.</div></div>';
    UI.modal({ icon: 'building', title: 'Change department', sub: p.name, body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Save', variant: 'primary', onClick: function () {
        p.deptId = wrap.querySelector('[data-d]').value;
        p.teamId = wrap.querySelector('[data-t]').value || null;
        p.managerId = wrap.querySelector('[data-m]').value || null;
        Store.persist(); UI.toast(p.name + ' moved to ' + Store.dept(p.deptId).name + '.', 'success'); cb && cb();
      } }] });
  };

  M.connectIntegration = function (id, cb) {
    const i = Store.state.integrations.find(x => x.id === id);
    const wrap = el('div');
    wrap.innerHTML =
      '<div class="row gap-3 mb-4"><span class="int-ic lg" style="background:' + i.color + '18;color:' + i.color + '">' + icon(i.glyph) + '</span>' +
      '<div><h4>' + U.esc(i.name) + '</h4><div class="tiny muted">' + U.esc(i.category) + ' · ' + U.numFull(i.installs) + ' organisations use this</div></div></div>' +
      '<p class="md mb-4">' + U.esc(i.desc) + '</p>' +
      '<div class="panel-title">This integration will be able to</div>' +
      '<div class="mini-list mb-4">' + i.scopes.map(s => '<div class="lrow">' + icon('checkCircle') + '<span class="md">' + U.esc(s) + '</span></div>').join('') + '</div>' +
      '<div class="banner warn">' + icon('shield') + '<div class="b-body"><strong>Connecting affects the whole workspace</strong>Everyone will be able to use ' + U.esc(i.name) + '. You can disconnect at any time from the admin dashboard.</div></div>';
    UI.modal({ icon: 'plug', title: 'Connect ' + i.name, body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Authorise and connect', variant: 'primary', icon: 'plug', onClick: function () {
        Store.toggleIntegration(id);
        UI.toast(i.name + ' connected to your workspace.', 'success'); cb && cb();
      } }] });
  };

  M.integrationDetail = function (id, cb) {
    const i = Store.state.integrations.find(x => x.id === id);
    const wrap = el('div');
    wrap.innerHTML =
      '<div class="row gap-3 mb-4"><span class="int-ic lg" style="background:' + i.color + '18;color:' + i.color + '">' + icon(i.glyph) + '</span>' +
      '<div class="grow"><h4>' + U.esc(i.name) + '</h4><div class="tiny muted">' + U.esc(i.category) + '</div></div>' +
      (i.connected ? '<span class="badge success">' + icon('checkCircle') + 'Connected</span>' : '') + '</div>' +
      '<p class="md mb-4">' + U.esc(i.desc) + '</p>' +
      '<div class="grid grid-2 mb-4">' +
      dRow('Installs', U.numFull(i.installs)) + dRow('Category', i.category) +
      (i.connected ? dRow('Connected by', Store.person(i.connectedBy).name) : '') +
      (i.connected ? dRow('Connected', U.dateShort(i.connectedAt)) : '') +
      '</div>' +
      '<div class="panel-title">Permissions</div>' +
      '<div class="mini-list mb-4">' + i.scopes.map(s => '<div class="lrow">' + icon('check') + '<span class="md">' + U.esc(s) + '</span></div>').join('') + '</div>' +
      (i.connected ? '<div class="panel-title">Recent activity</div><div class="mini-list">' +
        ['Synced 42 items', 'Posted 3 notifications', 'Refreshed the access token'].map((t, n) =>
          '<div class="lrow">' + icon('activity') + '<span class="grow md">' + t + '</span><span class="tiny subtle">' + U.ago(DATA.t(30 + n * 400)) + '</span></div>').join('') + '</div>' : '');
    UI.modal({ icon: 'plug', title: i.name, size: 'lg', body: wrap,
      actions: [{ label: 'Close', variant: 'ghost' },
      { label: i.connected ? 'Disconnect' : 'Connect', variant: i.connected ? 'danger' : 'primary', onClick: function () {
        if (i.connected) { Store.toggleIntegration(id); UI.toast(i.name + ' disconnected.', 'success'); cb && cb(); }
        else M.connectIntegration(id, cb);
      } }] });
  };

  M.ssoConfig = function () {
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Identity provider', '<select class="select"><option selected>Okta</option><option>Microsoft Entra ID</option><option>Google Workspace</option><option>OneLogin</option><option>Custom SAML 2.0</option></select>') +
      UI.field('Sign-in URL', '<input class="input mono tiny" value="https://northbeam.okta.com/app/ithrive/sso/saml">') +
      UI.field('Issuer (Entity ID)', '<input class="input mono tiny" value="http://www.okta.com/exk1a2b3c4d5">') +
      UI.field('X.509 certificate', '<textarea class="textarea mono tiny" style="min-height:90px">-----BEGIN CERTIFICATE-----\nMIIDpDCCAoygAwIBAgIGAX1kQ2xvMA0GCSqGSIb3DQEBCwUAMIGSMQswCQYDVQQG\n…\n-----END CERTIFICATE-----</textarea>', 'Expires 12 November 2026') +
      '<div class="col gap-1">' +
      UI.switchRow('Enforce SSO for all members', 'Password sign-in is disabled', true, 'force') +
      UI.switchRow('Just-in-time provisioning', 'Create accounts on first sign-in', true, 'jit') +
      UI.switchRow('SCIM user and group sync', '', true, 'scim') +
      '</div>';
    UI.bindSwitches(wrap);
    UI.modal({ icon: 'key', title: 'Single sign-on configuration', size: 'lg', body: wrap,
      actions: [{ label: 'Test connection', variant: 'ghost', close: false, onClick: () => UI.toast('SSO test succeeded — assertion validated.', 'success') },
      { label: 'Cancel', variant: 'ghost' }, { label: 'Save', variant: 'primary', onClick: () => UI.toast('SSO configuration saved.', 'success') }] });
  };

  M.passwordPolicy = function () {
    const wrap = el('div', { class: 'col gap-4' });
    wrap.innerHTML =
      UI.field('Minimum length', '<select class="select"><option>8</option><option>12</option><option selected>14</option><option>16</option></select>') +
      '<div class="col gap-1">' +
      UI.switchRow('Require a number', '', true, 'num') +
      UI.switchRow('Require a symbol', '', true, 'sym') +
      UI.switchRow('Require mixed case', '', true, 'case') +
      UI.switchRow('Block common and breached passwords', '', true, 'breach') +
      UI.switchRow('Prevent reuse of the last 5 passwords', '', true, 'reuse') +
      '</div>' +
      UI.field('Password expiry', '<select class="select"><option selected>Never (recommended)</option><option>90 days</option><option>180 days</option><option>1 year</option></select>');
    UI.bindSwitches(wrap);
    UI.modal({ icon: 'lock', title: 'Password policy', body: wrap,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Save policy', variant: 'primary', onClick: () => UI.toast('Password policy updated. Members will be asked to update at next sign-in.', 'success') }] });
  };

  M.joinWorkspace = function () {
    const wrap = el('div', { class: 'col gap-3' });
    wrap.innerHTML = '<div class="org-list">' + DATA.WORKSPACES.map(w =>
      '<button class="org-card" data-jw="' + w.id + '"><span class="oc-logo" style="background:' + w.color + '">' + w.short + '</span>' +
      '<span class="grow"><span class="oc-name" style="display:block">' + U.esc(w.name) + '</span>' +
      '<span class="oc-meta">' + U.esc(w.role) + ' · ' + U.plural(w.members, 'member') + '</span></span>' +
      (w.id === Store.state.workspaceId ? '<span class="badge success">Current</span>' : icon('chevronRight')) + '</button>').join('') + '</div>' +
      '<div class="divider"></div>' +
      UI.field('Join with a code', '<div class="row gap-2"><input class="input grow" placeholder="NB-4K92-XZ71"><button class="btn" data-jcode>Join</button></div>');
    const m = UI.modal({ icon: 'grid', title: 'Your workspaces', body: wrap, actions: [{ label: 'Close', variant: 'ghost' }] });
    U.qsa('[data-jw]', wrap).forEach(b => b.onclick = function () { m.close(); App.switchWorkspace(b.dataset.jw); });
    wrap.querySelector('[data-jcode]').onclick = () => UI.toast('Invitation code accepted — request sent to the workspace owner.', 'success');
  };

  g.Modals = M;
})(window);
