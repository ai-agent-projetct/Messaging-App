/* ===== iThrive — Threads ===== */
(function (g) {
  const Threads = { open: null };
  let host = null, current = null;

  Threads.open = function (cid, parentId) {
    current = { cid, parentId };
    App.setThread(current);
  };
  Threads.close = function () { current = null; App.setThread(null); };
  Threads.current = () => current;

  Threads.render = function (node, ctx) {
    host = node;
    const c = Store.conv(ctx.cid);
    const parent = (Store.msgs(ctx.cid) || []).find(m => m.id === ctx.parentId);
    if (!parent) { node.innerHTML = UI.empty({ icon: 'chats', title: 'Thread unavailable', desc: 'The parent message may have been deleted.' }); return; }
    const replies = Store.thread(parent.id);

    node.className = 'rpanel thread-panel';
    node.innerHTML =
      '<div class="rp-head">' +
      '<div class="grow"><h4>Thread</h4><div class="tiny muted">' + U.esc(Store.convTitle(c)) + '</div></div>' +
      '<button class="icon-btn' + (parent.following ? ' active' : '') + '" data-tfollow data-tip="' + (parent.following ? 'Unfollow thread' : 'Follow thread') + '">' + icon('bell') + '</button>' +
      '<button class="icon-btn" data-tai data-tip="Summarise thread">' + icon('sparkles') + '</button>' +
      '<button class="icon-btn" data-tmore data-tip="More">' + icon('moreV') + '</button>' +
      '<button class="icon-btn" data-tclose data-tip="Close">' + icon('x') + '</button>' +
      '</div>' +
      (parent.resolved ? '<div class="thread-resolved">' + icon('checkCircle') + '<span class="tiny semi">This thread is marked resolved</span><button class="link tiny" data-treopen>Reopen</button></div>' : '') +
      '<div class="rp-body" id="thread-scroll"><div id="thread-list"></div></div>' +
      '<div id="thread-composer"></div>';

    const list = node.querySelector('#thread-list');
    list.innerHTML = parentHTML(parent, c) +
      '<div class="thread-count"><span>' + (replies.length ? U.plural(replies.length, 'reply', 'replies') : 'No replies yet') + '</span></div>' +
      replies.map(r => replyHTML(r, parent)).join('');
    bind(node, c, parent);

    Composer.mount(node.querySelector('#thread-composer'), {
      cid: ctx.cid, compact: true, force: true,
      placeholder: 'Reply in thread…',
      onSend: function (payload) {
        Store.replyInThread(parent.id, ctx.cid, payload);
        Threads.render(node, ctx);
        U.scrollBottom(node.querySelector('#thread-scroll'), true);
        App.renderMain();
      }
    });
    setTimeout(() => U.scrollBottom(node.querySelector('#thread-scroll')), 30);
  };

  function parentHTML(m, c) {
    const p = Store.person(m.authorId);
    return '<div class="thread-parent">' +
      '<div class="row-start gap-3">' + UI.avatar(p, 36) +
      '<div class="grow min0">' +
      '<div class="msg-head"><span class="msg-author">' + U.esc(p.name) + '</span>' +
      '<span class="tiny subtle">' + U.esc(U.time(m.ts)) + ' · ' + U.esc(U.dateShort(m.ts)) + '</span></div>' +
      '<div class="msg-text mt-1">' + U.renderRich(m.text) + '</div>' +
      ((m.files || []).length ? filesMini(m.files) : '') +
      reactionsMini(m) +
      '</div></div></div>';
  }
  function replyHTML(r, parent) {
    const p = Store.person(r.authorId);
    return '<div class="thread-reply" data-rid="' + r.id + '">' +
      UI.avatar(p, 30) +
      '<div class="grow min0">' +
      '<div class="msg-head"><span class="msg-author">' + U.esc(p.name) + '</span>' +
      '<span class="tiny subtle">' + U.esc(U.time(r.ts)) + '</span>' + (r.edited ? '<span class="tiny subtle">(edited)</span>' : '') + '</div>' +
      '<div class="msg-text mt-1">' + U.renderRich(r.text) + '</div>' +
      ((r.files || []).length ? filesMini(r.files) : '') +
      reactionsMini(r) +
      '</div>' +
      '<div class="msg-actions compact">' +
      '<button class="ma-btn emoji" data-rreact="👍" data-rid="' + r.id + '">👍</button>' +
      '<button class="ma-btn emoji" data-rreact="✅" data-rid="' + r.id + '">✅</button>' +
      '<button class="ma-btn" data-rmore="' + r.id + '">' + icon('moreH') + '</button>' +
      '</div></div>';
  }
  function filesMini(ids) {
    const files = ids.map(i => Store.file(i)).filter(Boolean);
    return '<div class="file-atts mt-2">' + files.map(f =>
      '<div class="file-att" data-preview="' + f.id + '">' + UI.fileGlyph(f.name, 32) +
      '<div class="grow min0"><div class="semi tiny truncate">' + U.esc(f.name) + '</div>' +
      '<div class="tiny muted">' + U.bytes(f.size) + '</div></div></div>').join('') + '</div>';
  }
  function reactionsMini(m) {
    const keys = Object.keys(m.reactions || {}).filter(k => m.reactions[k].length);
    if (!keys.length) return '';
    return '<div class="reactions mt-2">' + keys.map(e =>
      '<button class="rx' + (m.reactions[e].includes(Store.state.meId) ? ' mine' : '') + '" data-trx="' + e + '" data-mid="' + m.id + '">' + e + '<b>' + m.reactions[e].length + '</b></button>').join('') + '</div>';
  }

  function bind(node, c, parent) {
    node.querySelector('[data-tclose]').onclick = Threads.close;
    node.querySelector('[data-tfollow]').onclick = function () {
      parent.following = !parent.following;
      Store.persist();
      UI.toast(parent.following ? 'You will be notified about new replies.' : 'You will no longer be notified.', 'success');
      Threads.render(node, current);
    };
    node.querySelector('[data-tai]').onclick = () => summarize(node, c, parent);
    const reopen = node.querySelector('[data-treopen]');
    if (reopen) reopen.onclick = () => { Store.resolveThread(c.id, parent.id, false); Threads.render(node, current); };
    node.querySelector('[data-tmore]').onclick = function (e) {
      UI.menu(e.currentTarget, [
        { label: parent.resolved ? 'Reopen thread' : 'Mark as resolved', icon: 'checkCircle', onClick: () => { Store.resolveThread(c.id, parent.id, !parent.resolved); Threads.render(node, current); App.renderMain(); UI.toast(parent.resolved ? 'Thread reopened.' : 'Thread resolved.', 'success'); } },
        { label: 'Summarise with AI', icon: 'sparkles', onClick: () => summarize(node, c, parent) },
        { label: 'Extract action items', icon: 'listChecks', onClick: () => extract(c, parent) },
        { sep: true },
        { label: 'Also send to ' + Store.convTitle(c), icon: 'send', onClick: () => UI.toast('Next reply will also post to the channel.', 'info') },
        { label: 'Copy thread link', icon: 'link', onClick: () => UI.copyToast('https://northbeam.ithrive.app/' + c.id + '/thread/' + parent.id, 'Thread link copied.') },
        { label: 'Pin parent message', icon: 'pin', onClick: () => { Store.togglePin(c.id, parent.id); App.renderShell(); } }
      ], { align: 'right' });
    };
    U.qsa('[data-preview]', node).forEach(b => b.onclick = () => Modals.filePreview(b.dataset.preview));
    U.qsa('[data-rreact]', node).forEach(b => b.onclick = function () {
      Store.toggleReaction(c.id, b.dataset.rid, b.dataset.rreact);
      Threads.render(node, current);
    });
    U.qsa('[data-trx]', node).forEach(b => b.onclick = function () {
      Store.toggleReaction(c.id, b.dataset.mid, b.dataset.trx);
      Threads.render(node, current);
    });
    U.qsa('[data-rmore]', node).forEach(b => b.onclick = function (e) {
      const rid = b.dataset.rmore;
      const r = Store.thread(parent.id).find(x => x.id === rid);
      const mine = r.authorId === Store.state.meId;
      UI.menu(e.currentTarget, [
        { label: 'Add reaction', icon: 'smile', onClick: () => Store.toggleReaction(c.id, rid, '👍') },
        { label: 'Copy text', icon: 'copy', onClick: () => UI.copyToast(r.text, 'Reply copied.') },
        { label: 'Forward…', icon: 'forward', onClick: () => Modals.forwardMessage(c.id, rid, r) },
        { label: 'Pin this reply', icon: 'pin', onClick: () => UI.toast('Reply pinned to the thread.', 'success') },
        { label: 'Create a task', icon: 'tasks', onClick: () => Modals.createTask({ title: r.text.slice(0, 90), source: c.id }) },
        mine ? { sep: true } : null,
        mine ? { label: 'Edit reply', icon: 'edit', onClick: () => UI.prompt({ title: 'Edit reply', multiline: true, value: r.text }).then(v => { if (v) { r.text = v; r.edited = true; Store.persist(); Threads.render(node, current); } }) } : null,
        mine ? { label: 'Delete reply', icon: 'trash', danger: true, onClick: function () {
          UI.confirm({ title: 'Delete this reply?', body: 'It will be removed for everyone in the thread.', danger: true, confirmLabel: 'Delete' }).then(function (ok) {
            if (!ok) return;
            const t = Store.state.threads[parent.id];
            Store.state.threads[parent.id] = t.filter(x => x.id !== rid);
            parent.threadCount = Store.state.threads[parent.id].length;
            Store.persist(); Threads.render(node, current); App.renderMain();
          });
        } } : null
      ].filter(Boolean), { align: 'right' });
    });
  }

  function summarize(node, c, parent) {
    const body = U.el('div');
    body.innerHTML = '<div class="ai-block"><div class="row gap-2 mb-3">' + icon('sparkles') + '<span class="semi md">Thrive AI is reading the thread…</span><span class="spinner"></span></div><div data-out class="md"></div></div>';
    const m = UI.modal({ icon: 'sparkles', title: 'Thread summary', sub: U.plural(Store.thread(parent.id).length, 'reply', 'replies') + ' in ' + Store.convTitle(c), body: body, actions: [{ label: 'Close', variant: 'ghost' }] });
    AI.think(760).then(function () {
      const s = AI.summarizeThread(parent.id, c.id);
      body.querySelector('.row').innerHTML = icon('sparkles') + '<span class="semi md">Summary</span><span class="badge aurora">Thrive AI</span>';
      if (!s) { body.querySelector('[data-out]').innerHTML = '<p class="muted">There are no replies to summarise yet.</p>'; return; }
      const out = body.querySelector('[data-out]');
      out.innerHTML =
        '<p class="mb-3"><strong>Topic:</strong> ' + U.esc(s.topic) + '</p>' +
        '<p class="mb-3"><strong>Where it landed:</strong> ' + U.esc(s.outcome) + '</p>' +
        '<div class="panel-title">Discussion</div><ul class="ai-list">' +
        s.bullets.map(b => '<li>' + UI.avatar(b.authorId, 18) + '<span>' + U.esc(b.text) + '</span></li>').join('') + '</ul>' +
        (s.actions.length ? '<div class="panel-title mt-4">Action items detected</div><ul class="ai-list">' +
          s.actions.map((a, i) => '<li>' + icon('listChecks') + '<span>' + U.esc(a.text) + ' <span class="tiny muted">— ' + U.esc(Store.person(a.assigneeId || Store.state.meId).first) + ', due ' + U.esc(U.dateShort(a.due)) + '</span></span>' +
            '<button class="btn sm soft" data-mk="' + i + '">Create task</button></li>').join('') + '</ul>' : '') +
        '<div class="row gap-2 mt-4">' +
        '<button class="btn sm" data-copy>' + icon('copy') + 'Copy summary</button>' +
        '<button class="btn sm" data-post>' + icon('send') + 'Post to thread</button>' +
        (s.resolved ? '<button class="btn sm soft" data-resolve>' + icon('checkCircle') + 'Mark resolved</button>' : '') +
        '</div>';
      U.qsa('[data-mk]', out).forEach(b => b.onclick = function () {
        const a = s.actions[+b.dataset.mk];
        Store.createTask({ title: a.text, assigneeId: a.assigneeId || Store.state.meId, due: a.due.toISOString(), priority: a.priority, source: c.id, description: 'Extracted by Thrive AI from a thread in ' + Store.convTitle(c) + '.' });
        UI.toast('Task created and assigned.', 'success');
        b.outerHTML = '<span class="badge success">' + icon('check') + 'Created</span>';
      });
      out.querySelector('[data-copy]').onclick = () => UI.copyToast(out.textContent, 'Summary copied.');
      out.querySelector('[data-post]').onclick = function () {
        Store.replyInThread(parent.id, c.id, { text: '**Thread summary (Thrive AI)**\n' + s.outcome, aiGenerated: true });
        m.close(); Threads.render(node, current); UI.toast('Summary posted to the thread.', 'success');
      };
      const rv = out.querySelector('[data-resolve]');
      if (rv) rv.onclick = () => { Store.resolveThread(c.id, parent.id, true); m.close(); Threads.render(node, current); App.renderMain(); };
    });
  }

  function extract(c, parent) {
    const all = [parent].concat(Store.thread(parent.id));
    const actions = AI.extractActions(all);
    Modals.actionItems(actions, c.id);
  }

  g.Threads = Threads;
})(window);
