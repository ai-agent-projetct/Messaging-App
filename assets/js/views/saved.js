/* ===== iThrive — Saved items ===== */
(function (g) {
  const Saved = { tab: 'messages' };

  Saved.render = function (main) {
    main.className = 'main plain';
    const msgs = Store.savedMessages();
    const files = Store.state.files.filter(f => f.starred);
    const convs = Store.convs().filter(c => c.favorite || c.pinned);

    main.innerHTML =
      '<div class="view-head"><div class="vh-main"><h2>' + icon('bookmark') + 'Saved items</h2>' +
      '<div class="vh-sub">' + U.plural(msgs.length, 'message') + ' · ' + U.plural(files.length, 'file') + ' · ' + U.plural(convs.length, 'conversation') + '</div></div>' +
      '<div class="vh-actions"><button class="btn" data-s="clear">' + icon('trash') + 'Clear all</button></div></div>' +
      '<div class="view-toolbar">' +
      [['messages', 'Messages', msgs.length], ['files', 'Files', files.length], ['convs', 'Conversations', convs.length]].map(t =>
        '<button class="chip' + (Saved.tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + ' <b>' + t[2] + '</b></button>').join('') +
      '</div>' +
      '<div class="view-scroll"><div class="view-pad" id="s-body"></div></div>';

    const body = main.querySelector('#s-body');
    draw();
    U.qsa('[data-tab]', main).forEach(b => b.onclick = function () {
      Saved.tab = b.dataset.tab;
      U.qsa('[data-tab]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      draw();
    });
    main.querySelector('[data-s="clear"]').onclick = function () {
      UI.confirm({ title: 'Clear all saved items?', body: 'This removes every saved message, starred file and favourite conversation. Nothing is deleted from the workspace itself.', danger: true, confirmLabel: 'Clear all' })
        .then(function (ok) {
          if (!ok) return;
          Store.state.savedIds = [];
          Store.state.files.forEach(f => f.starred = false);
          Store.convs().forEach(c => { c.favorite = false; c.pinned = false; });
          Store.persist(); Saved.render(main); App.renderSidebar();
          UI.toast('Saved items cleared.', 'success');
        });
    };

    function draw() {
      if (Saved.tab === 'messages') {
        if (!msgs.length) {
          UI.emptyInto(body, {
            icon: 'bookmark', tone: 'neutral', title: 'No saved messages',
            desc: 'Hover any message and choose “Save for later” to keep it here. Saved messages stay searchable and never expire.'
          });
          return;
        }
        body.innerHTML = '<div class="grid grid-auto-lg">' + msgs.map(function (m) {
          const c = Store.conv(m.convId);
          return '<div class="card pad saved-card" data-open="' + m.convId + ':' + m.id + '">' +
            '<div class="row gap-2 mb-2">' + UI.avatar(m.authorId, 26) +
            '<span class="semi md">' + U.esc(Store.person(m.authorId).name) + '</span>' +
            '<span class="badge">' + U.esc(c ? Store.convTitle(c) : 'Unknown') + '</span>' +
            '<button class="icon-btn sm" style="margin-left:auto" data-unsave="' + m.id + '" data-tip="Remove">' + icon('x') + '</button></div>' +
            '<div class="md clamp-3 text-left">' + U.renderRich(m.text) + '</div>' +
            ((m.files || []).length ? '<div class="tiny muted mt-2">' + icon('paperclip') + U.plural(m.files.length, 'attachment') + '</div>' : '') +
            '<div class="tiny subtle mt-2">' + U.esc(U.dateMed(m.ts)) + ' at ' + U.esc(U.time(m.ts)) + '</div></div>';
        }).join('') + '</div>';
        U.qsa('[data-open]', body).forEach(b => b.onclick = function (e) {
          if (e.target.closest('[data-unsave]')) return;
          const [cid, mid] = b.dataset.open.split(':');
          App.route('#/messages/' + cid); setTimeout(() => Chat.highlight(mid), 380);
        });
        U.qsa('[data-unsave]', body).forEach(b => b.onclick = function (e) {
          e.stopPropagation(); Store.toggleSave(b.dataset.unsave); Saved.render(main); UI.toast('Removed from saved items.', 'success');
        });
      } else if (Saved.tab === 'files') {
        if (!files.length) {
          UI.emptyInto(body, { icon: 'star', tone: 'neutral', title: 'No favourite files', desc: 'Star a file from the Files hub or any conversation to keep it here.' });
          return;
        }
        body.innerHTML = '<div class="mini-list card">' + files.map(f => UI.fileRow(f)).join('') + '</div>';
        U.qsa('[data-file]', body).forEach(r => r.onclick = function (e) {
          const a = e.target.closest('[data-fact]');
          if (!a || a.dataset.fact === 'preview') return Modals.filePreview(r.dataset.file);
          if (a.dataset.fact === 'download') Modals.downloadFile(r.dataset.file);
          if (a.dataset.fact === 'more') Modals.fileMenu(a, r.dataset.file, () => Saved.render(main));
        });
      } else {
        if (!convs.length) {
          UI.emptyInto(body, { icon: 'star', tone: 'neutral', title: 'No favourite conversations', desc: 'Favourite a channel or pin a chat to keep it at the top of your sidebar and here.' });
          return;
        }
        body.innerHTML = '<div class="grid grid-auto">' + convs.map(function (c) {
          const last = Store.lastMsg(c.id);
          return '<button class="card hover pad" data-conv="' + c.id + '"><div class="row gap-3">' + UI.convAvatar(c, 40) +
            '<div class="grow min0 text-left"><div class="semi md truncate">' + U.esc(Store.convTitle(c)) + '</div>' +
            '<div class="tiny muted truncate">' + (last ? U.esc(Store.person(last.authorId).first + ': ' + (last.text || 'Attachment')) : 'No messages yet') + '</div></div>' +
            (c.unread ? '<span class="count">' + c.unread + '</span>' : '') + '</div></button>';
        }).join('') + '</div>';
        U.qsa('[data-conv]', body).forEach(b => b.onclick = () => App.route('#/messages/' + b.dataset.conv));
      }
    }
  };

  g.SavedView = Saved;
})(window);
