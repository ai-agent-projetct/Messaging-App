/* ===== iThrive — Organisation dashboard (all members) ===== */
(function (g) {
  const Org = {};

  Org.render = function (main) {
    main.className = 'main plain';
    const o = DATA.ORG;
    const me = Store.me();
    main.innerHTML =
      '<div class="view-head"><div class="vh-main"><h2>' + icon('building') + 'Organisation</h2>' +
      '<div class="vh-sub">' + U.esc(o.name) + ' · ' + U.esc(o.plan) + ' · founded ' + o.founded + '</div></div>' +
      '<div class="vh-actions">' +
      (Store.isAdmin() ? '<button class="btn" data-o="admin">' + icon('shield') + 'Admin dashboard</button>' : '') +
      '<button class="btn primary" data-o="invite">' + icon('userPlus') + 'Invite a colleague</button></div></div>' +
      '<div class="view-scroll"><div class="view-pad" id="org-body"></div></div>';

    const body = main.querySelector('#org-body');
    body.innerHTML =
      '<div class="org-hero">' +
      '<span class="org-logo-big" style="background:' + o.color + '">' + o.short + '</span>' +
      '<div class="grow"><h1>' + U.esc(o.name) + '</h1>' +
      '<p class="muted mt-1">' + U.esc(o.tagline) + '</p>' +
      '<div class="chip-row mt-3">' +
      '<span class="chip">' + icon('globe') + U.esc(o.domain) + '</span>' +
      '<span class="chip">' + icon('location') + U.esc(o.hq) + '</span>' +
      '<span class="chip">' + icon('users') + U.numFull(o.employees) + ' employees</span>' +
      '<span class="chip">' + icon('shield') + 'SOC 2 Type II</span>' +
      (o.verified ? '<span class="chip on">' + icon('checkCircle') + 'Verified organisation</span>' : '') +
      '</div></div></div>' +

      '<div class="grid grid-4 mt-6">' +
      stat('Departments', DATA.DEPARTMENTS.length, 'building') +
      stat('Teams', DATA.TEAMS.length, 'users') +
      stat('Channels', Store.convs().filter(c => c.kind === 'channel' && !c.archived).length, 'hash') +
      stat('People in this workspace', Store.people().length, 'contacts') +
      '</div>' +

      '<div class="dash-grid mt-6">' +
      '<div class="col gap-4">' +
      '<div class="card"><div class="card-head"><h4>' + icon('building') + 'Departments</h4>' +
      '<button class="btn ghost sm" data-o="people">Directory' + icon('chevronRight') + '</button></div>' +
      '<div class="card-body"><div class="grid grid-auto">' + DATA.DEPARTMENTS.map(function (d) {
        return '<button class="tile row gap-3" data-dept="' + d.id + '">' +
          '<span class="dept-ic sm" style="background:' + d.color + '18;color:' + d.color + '">' + icon(d.icon) + '</span>' +
          '<span class="grow text-left min0"><span class="semi md block truncate">' + U.esc(d.name) + '</span>' +
          '<span class="tiny muted">' + d.headcount + ' people · ' + U.esc(Store.person(d.headId).first) + '</span></span></button>';
      }).join('') + '</div></div></div>' +

      '<div class="card"><div class="card-head"><h4>' + icon('users') + 'Leadership</h4></div>' +
      '<div class="card-body"><div class="grid grid-auto">' +
      ['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p43'].map(function (id) {
        const p = Store.person(id);
        return '<button class="tile row gap-3" data-person="' + id + '">' + UI.avatar(p, 38) +
          '<span class="grow text-left min0"><span class="semi md block truncate">' + U.esc(p.name) + '</span>' +
          '<span class="tiny muted truncate block">' + U.esc(p.title) + '</span></span></button>';
      }).join('') + '</div></div></div>' +

      '<div class="card"><div class="card-head"><h4>' + icon('megaphone') + 'Latest company announcements</h4>' +
      '<button class="btn ghost sm" data-o="ann">All' + icon('chevronRight') + '</button></div>' +
      '<div class="mini-list">' + Store.state.announcements.filter(a => !a.draft).slice(0, 4).map(a =>
        '<button class="lrow" data-ann="' + a.id + '">' + icon('megaphone') +
        '<span class="grow min0 text-left"><span class="semi md truncate block">' + U.esc(a.title) + '</span>' +
        '<span class="tiny muted">' + U.esc(Store.person(a.authorId).name) + ' · ' + U.esc(U.ago(a.createdAt)) + '</span></span>' +
        icon('chevronRight') + '</button>').join('') + '</div></div>' +
      '</div>' +

      '<div class="col gap-4">' +
      '<div class="card"><div class="card-head"><h4>' + icon('contacts') + 'Your place in the organisation</h4></div>' +
      '<div class="card-body col gap-3">' +
      (me.managerId ? '<div><div class="tiny muted mb-2">Reports to</div><button class="lrow" data-person="' + me.managerId + '">' + UI.avatar(me.managerId, 32) +
        '<span class="grow min0 text-left"><span class="semi md block">' + U.esc(Store.person(me.managerId).name) + '</span>' +
        '<span class="tiny muted">' + U.esc(Store.person(me.managerId).title) + '</span></span></button></div>' : '') +
      '<div><div class="tiny muted mb-2">You</div><div class="lrow on">' + UI.avatar(me, 32) +
      '<span class="grow min0"><span class="semi md block">' + U.esc(me.name) + '</span>' +
      '<span class="tiny muted">' + U.esc(me.title) + '</span></span>' + UI.roleBadge(me.role) + '</div></div>' +
      (function () {
        const reports = Store.people().filter(p => p.managerId === me.id);
        return reports.length ? '<div><div class="tiny muted mb-2">' + U.plural(reports.length, 'direct report') + '</div>' +
          reports.map(r => '<button class="lrow" data-person="' + r.id + '">' + UI.avatar(r, 28) +
            '<span class="grow min0 text-left"><span class="semi md block">' + U.esc(r.name) + '</span>' +
            '<span class="tiny muted">' + U.esc(r.title) + '</span></span></button>').join('') + '</div>' : '';
      })() +
      '<button class="btn ghost block mt-2" data-o="hierarchy">' + icon('breakout') + 'View the full org chart</button>' +
      '</div></div>' +

      '<div class="card"><div class="card-head"><h4>' + icon('grid') + 'Your workspaces</h4></div>' +
      '<div class="mini-list">' + DATA.WORKSPACES.map(w =>
        '<button class="lrow" data-ws="' + w.id + '"><span class="ws-logo" style="background:' + w.color + ';width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:12px">' + w.short + '</span>' +
        '<span class="grow min0 text-left"><span class="semi md block truncate">' + U.esc(w.name) + '</span>' +
        '<span class="tiny muted">' + U.esc(w.role) + ' · ' + U.plural(w.members, 'member') + '</span></span>' +
        (w.unread ? '<span class="count">' + w.unread + '</span>' : '') +
        (w.id === Store.state.workspaceId ? '<span class="badge success">Current</span>' : '') + '</button>').join('') + '</div>' +
      '<div class="card-foot"><button class="btn sm block" data-o="joinws">' + icon('plus') + 'Join or create a workspace</button></div></div>' +

      '<div class="card"><div class="card-head"><h4>' + icon('lifeBuoy') + 'Useful links</h4></div>' +
      '<div class="mini-list">' +
      [['Employee handbook', 'bookOpen'], ['Benefits guide', 'gift'], ['IT support', 'lifeBuoy'], ['Expense policy', 'dollar'], ['Security policy', 'shield']]
        .map(l => '<button class="lrow" data-link="' + l[0] + '">' + icon(l[1]) + '<span class="grow text-left md">' + l[0] + '</span>' + icon('externalLink') + '</button>').join('') +
      '</div></div>' +
      '</div></div>';

    const adminBtn = main.querySelector('[data-o="admin"]');
    if (adminBtn) adminBtn.onclick = () => App.route('#/admin');
    main.querySelector('[data-o="invite"]').onclick = () => Modals.inviteUser();
    U.qsa('[data-o]', body).forEach(b => b.onclick = function () {
      const o2 = b.dataset.o;
      if (o2 === 'people' || o2 === 'hierarchy') { PeopleView.tab = o2 === 'hierarchy' ? 'hierarchy' : 'directory'; App.route('#/contacts'); }
      if (o2 === 'ann') App.route('#/announcements');
      if (o2 === 'joinws') Modals.joinWorkspace();
    });
    U.qsa('[data-dept]', body).forEach(b => b.onclick = () => { PeopleView.dept = b.dataset.dept; PeopleView.tab = 'directory'; App.route('#/contacts'); });
    U.qsa('[data-person]', body).forEach(b => b.onclick = () => Modals.personProfile(b.dataset.person));
    U.qsa('[data-ann]', body).forEach(b => b.onclick = () => Modals.announcementDetail(b.dataset.ann));
    U.qsa('[data-ws]', body).forEach(b => b.onclick = () => App.switchWorkspace(b.dataset.ws));
    U.qsa('[data-link]', body).forEach(b => b.onclick = () => UI.toast(b.dataset.link + ' opens in your browser.', 'info'));
  };

  function stat(label, val, ic) {
    return '<div class="card pad"><div class="row between mb-2"><span class="st-ic">' + icon(ic) + '</span></div>' +
      '<div class="stat"><span class="s-val">' + U.numFull(val) + '</span><span class="s-lbl">' + U.esc(label) + '</span></div></div>';
  }

  g.OrgView = Org;
})(window);
