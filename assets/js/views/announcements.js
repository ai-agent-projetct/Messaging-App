/* ===== iThrive — Announcements ===== */
(function (g) {
  const Ann = { tab: 'all' };

  const TYPE_STYLE = {
    Company: { color: '#12a583', icon: 'megaphone' },
    Policy: { color: '#2e7cf6', icon: 'shield' },
    Event: { color: '#ff7a45', icon: 'calendar' },
    Department: { color: '#7c5cff', icon: 'building' },
    Emergency: { color: '#e5484d', icon: 'alertTriangle' }
  };

  Ann.render = function (main) {
    main.className = 'main plain';
    const canPost = ['Owner', 'Super Admin', 'Admin', 'Manager'].includes(Store.me().role);
    const unconfirmed = Store.state.announcements.filter(a => a.requireRead && !a.draft && !a.readBy.includes(Store.state.meId)).length;

    main.innerHTML =
      '<div class="view-head"><div class="vh-main"><h2>' + icon('megaphone') + 'Announcements</h2>' +
      '<div class="vh-sub">' + (unconfirmed ? '<span class="warn-text semi">' + U.plural(unconfirmed, 'announcement') + ' needs your confirmation</span>' : 'Everything is acknowledged') + '</div></div>' +
      '<div class="vh-actions">' +
      (canPost ? '<button class="btn primary" data-a="new">' + icon('plus') + 'New announcement</button>' : '') +
      '</div></div>' +
      '<div class="view-toolbar">' +
      ['all', 'unread', 'pinned', 'drafts'].map(t => '<button class="chip' + (Ann.tab === t ? ' on' : '') + '" data-tab="' + t + '">' + U.cap(t) + '</button>').join('') +
      '<span class="grow"></span>' +
      '<span class="tiny muted">Posted to ' + U.esc(DATA.ORG.name) + '</span>' +
      '</div>' +
      '<div class="view-scroll"><div class="view-pad" id="a-body"></div></div>';

    const body = main.querySelector('#a-body');
    UI.withLoading(body, draw, 180);
    const nb = main.querySelector('[data-a="new"]');
    if (nb) nb.onclick = () => Modals.createAnnouncement(null, () => Ann.render(main));
    U.qsa('[data-tab]', main).forEach(b => b.onclick = function () {
      Ann.tab = b.dataset.tab;
      U.qsa('[data-tab]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      draw();
    });

    function draw() {
      let items = Store.state.announcements.slice();
      if (Ann.tab === 'all') items = items.filter(a => !a.draft);
      if (Ann.tab === 'unread') items = items.filter(a => !a.draft && !a.readBy.includes(Store.state.meId));
      if (Ann.tab === 'pinned') items = items.filter(a => a.pinned && !a.draft);
      if (Ann.tab === 'drafts') items = items.filter(a => a.draft);
      if (!items.length) {
        UI.emptyInto(body, {
          icon: 'megaphone', tone: 'neutral',
          title: Ann.tab === 'drafts' ? 'No scheduled or draft announcements' : Ann.tab === 'unread' ? 'You have read everything' : 'No announcements yet',
          desc: canPost ? 'Announcements reach everyone you choose, with optional read confirmation and scheduled publishing.'
            : 'Company announcements from leadership and your department will appear here.',
          actions: canPost ? [{ label: 'Write an announcement', icon: 'plus', onClick: () => Modals.createAnnouncement(null, () => Ann.render(main)) }] : []
        });
        return;
      }
      body.innerHTML = items.map(cardHTML).join('');
      bind();
    }

    function cardHTML(a) {
      const st = TYPE_STYLE[a.type] || TYPE_STYLE.Company;
      const unread = !a.readBy.includes(Store.state.meId);
      const pct = U.pct(a.readBy.length, Store.people().length);
      return '<div class="ann-card' + (unread && !a.draft ? ' unread' : '') + '" data-ann="' + a.id + '">' +
        '<div class="row between gap-3 mb-3">' +
        '<div class="row gap-3 min0">' +
        '<span class="ann-ic" style="background:' + st.color + '18;color:' + st.color + '">' + icon(st.icon) + '</span>' +
        '<div class="min0"><div class="row gap-2 wrap"><h4 class="truncate">' + U.esc(a.title) + '</h4>' +
        (a.pinned ? '<span class="badge brand">' + icon('pin') + 'Pinned</span>' : '') +
        (a.priority === 'high' ? '<span class="badge danger">Important</span>' : '') +
        (a.draft ? '<span class="badge warning">' + icon('clock') + 'Scheduled ' + U.esc(U.dateShort(a.scheduledFor)) + '</span>' : '') +
        '</div>' +
        '<div class="tiny muted mt-1">' + U.esc(Store.person(a.authorId).name) + ' · ' + U.esc(U.ago(a.createdAt)) + ' · to ' + U.esc(a.audience) + ' · ' + U.esc(a.type) + '</div></div></div>' +
        '<button class="icon-btn sm" data-amenu="' + a.id + '">' + icon('moreH') + '</button></div>' +
        '<div class="ann-body md">' + U.renderRich(a.body.split('\n\n')[0]) + (a.body.split('\n\n').length > 1 ? '<button class="link tiny mt-2" data-expand="' + a.id + '">Read more</button>' : '') + '</div>' +
        ((a.attachments || []).length ? '<div class="file-atts mt-3">' + a.attachments.map(function (fid) {
          const f = Store.file(fid); if (!f) return '';
          return '<div class="file-att" data-preview="' + f.id + '">' + UI.fileGlyph(f.name, 36) +
            '<div class="grow min0"><div class="semi md truncate">' + U.esc(f.name) + '</div><div class="tiny muted">' + U.bytes(f.size) + '</div></div></div>';
        }).join('') + '</div>' : '') +
        '<div class="row between gap-3 mt-4 wrap">' +
        '<div class="row gap-3">' + UI.avatarStack(a.readBy.slice(0, 5), 5, 22) +
        '<span class="tiny muted">' + a.readBy.length + ' read' + (a.requireRead ? ' · ' + pct + '% confirmed' : '') + '</span></div>' +
        '<div class="row gap-2">' +
        (a.requireRead && unread && !a.draft ? '<button class="btn sm primary" data-confirm="' + a.id + '">' + icon('check') + 'Acknowledge</button>' : '') +
        (a.requireRead && !unread ? '<span class="badge success">' + icon('check') + 'Acknowledged</span>' : '') +
        '<button class="btn sm ghost" data-open="' + a.id + '">Open</button>' +
        '</div></div></div>';
    }

    function bind() {
      U.qsa('[data-confirm]', body).forEach(b => b.onclick = function (e) {
        e.stopPropagation(); Store.confirmRead(b.dataset.confirm);
        UI.toast('Acknowledged. Your confirmation has been recorded.', 'success'); Ann.render(main);
      });
      U.qsa('[data-open], [data-expand]', body).forEach(b => b.onclick = function (e) {
        e.stopPropagation(); Modals.announcementDetail(b.dataset.open || b.dataset.expand, () => Ann.render(main));
      });
      U.qsa('[data-preview]', body).forEach(b => b.onclick = (e) => { e.stopPropagation(); Modals.filePreview(b.dataset.preview); });
      U.qsa('[data-ann]', body).forEach(c => c.onclick = function (e) {
        if (e.target.closest('button')) return; Modals.announcementDetail(c.dataset.ann, () => Ann.render(main));
      });
      U.qsa('[data-amenu]', body).forEach(b => b.onclick = function (e) {
        e.stopPropagation();
        const a = Store.state.announcements.find(x => x.id === b.dataset.amenu);
        const mine = a.authorId === Store.state.meId || Store.isAdmin();
        UI.menu(b, [
          { label: 'Open', icon: 'externalLink', onClick: () => Modals.announcementDetail(a.id, () => Ann.render(main)) },
          { label: 'Copy link', icon: 'link', onClick: () => UI.copyToast('https://northbeam.ithrive.app/announcements/' + a.id, 'Link copied.') },
          { label: 'Share to a channel', icon: 'send', onClick: () => Modals.shareAnnouncement(a.id) },
          { sep: true },
          { label: a.pinned ? 'Unpin' : 'Pin to top', icon: 'pin', disabled: !mine, onClick: () => { a.pinned = !a.pinned; Store.persist(); Ann.render(main); } },
          { label: 'View read receipts', icon: 'eye', disabled: !mine, onClick: () => Modals.readReceipts(a.id) },
          { label: 'Edit', icon: 'edit', disabled: !mine, onClick: () => Modals.createAnnouncement(a, () => Ann.render(main)) },
          { label: 'Delete', icon: 'trash', danger: true, disabled: !mine, onClick: function () {
            UI.confirm({ title: 'Delete this announcement?', body: '“' + a.title + '” will be removed for everyone. This cannot be undone.', danger: true, confirmLabel: 'Delete' })
              .then(function (ok) {
                if (!ok) return;
                Store.state.announcements = Store.state.announcements.filter(x => x.id !== a.id);
                Store.persist(); Ann.render(main); UI.toast('Announcement deleted.', 'success');
              });
          } }
        ], { align: 'right' });
      });
    }
  };

  Ann.TYPE_STYLE = TYPE_STYLE;
  g.AnnouncementsView = Ann;
})(window);
