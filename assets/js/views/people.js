/* ===== iThrive — Employee directory & organisation ===== */
(function (g) {
  const People = { tab: 'directory', q: '', dept: 'all', view: 'grid', presence: 'all' };

  People.render = function (main) {
    main.className = 'main plain';
    main.innerHTML =
      '<div class="view-head"><div class="vh-main"><h2>' + icon('contacts') + 'People</h2>' +
      '<div class="vh-sub">' + U.plural(Store.people().length, 'person', 'people') + ' in this workspace · ' + DATA.ORG.employees + ' employees company-wide</div></div>' +
      '<div class="vh-actions">' +
      (Store.isAdmin() ? '<button class="btn" data-p="invite">' + icon('userPlus') + 'Invite people</button>' : '') +
      '<button class="btn primary" data-p="new">' + icon('chat') + 'New message</button></div></div>' +
      '<div class="view-toolbar">' +
      '<div class="input-wrap" style="max-width:300px">' + icon('search') + '<input class="input" id="p-search" placeholder="Search by name, title, skill or team"></div>' +
      ['directory', 'departments', 'teams', 'hierarchy'].map(t => '<button class="chip' + (People.tab === t ? ' on' : '') + '" data-tab="' + t + '">' + U.cap(t) + '</button>').join('') +
      '<span class="grow"></span>' +
      '<button class="chip" data-p="presence">' + icon('activity') + '<span id="p-pres-l">Any status</span></button>' +
      '<button class="chip" data-p="dept">' + icon('building') + '<span id="p-dept-l">All departments</span></button>' +
      '<div class="segmented"><button data-v="grid" class="' + (People.view === 'grid' ? 'on' : '') + '">' + icon('grid') + '</button>' +
      '<button data-v="list" class="' + (People.view === 'list' ? 'on' : '') + '">' + icon('list') + '</button></div>' +
      '</div>' +
      '<div class="view-scroll"><div class="view-pad" id="p-body"></div></div>';

    const body = main.querySelector('#p-body');
    UI.withLoading(body, draw);
    const inv = main.querySelector('[data-p="invite"]');
    if (inv) inv.onclick = () => Modals.inviteUser();
    main.querySelector('[data-p="new"]').onclick = () => Modals.newMessage();
    main.querySelector('#p-search').addEventListener('input', U.debounce(e => { People.q = e.target.value.trim().toLowerCase(); draw(); }, 150));
    U.qsa('[data-tab]', main).forEach(b => b.onclick = function () {
      People.tab = b.dataset.tab;
      U.qsa('[data-tab]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      draw();
    });
    U.qsa('[data-v]', main).forEach(b => b.onclick = function () {
      People.view = b.dataset.v;
      U.qsa('[data-v]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      draw();
    });
    main.querySelector('[data-p="dept"]').onclick = (e) => UI.menu(e.currentTarget,
      [{ label: 'All departments', on: People.dept === 'all', onClick: () => { People.dept = 'all'; main.querySelector('#p-dept-l').textContent = 'All departments'; draw(); } }]
        .concat(DATA.DEPARTMENTS.map(d => ({ label: d.name, icon: d.icon, on: People.dept === d.id, onClick: () => { People.dept = d.id; main.querySelector('#p-dept-l').textContent = d.name; draw(); } }))));
    main.querySelector('[data-p="presence"]').onclick = (e) => UI.menu(e.currentTarget,
      [['all', 'Any status'], ['available', 'Available'], ['busy', 'Busy'], ['meeting', 'In a meeting'], ['away', 'Away'], ['offline', 'Offline']].map(p => ({
        label: p[1], on: People.presence === p[0],
        onClick: () => { People.presence = p[0]; main.querySelector('#p-pres-l').textContent = p[1]; draw(); }
      })));

    function filtered() {
      let list = Store.people();
      if (People.dept !== 'all') list = list.filter(p => p.deptId === People.dept);
      if (People.presence !== 'all') list = list.filter(p => p.presence === People.presence);
      if (People.q) list = list.filter(p => (p.name + ' ' + p.title + ' ' + p.email + ' ' + Store.dept(p.deptId).name + ' ' + (p.skills || []).join(' ') + ' ' + p.location).toLowerCase().includes(People.q));
      return U.sortBy(list, p => p.name);
    }

    function draw() {
      if (People.tab === 'departments') return drawDepartments();
      if (People.tab === 'teams') return drawTeams();
      if (People.tab === 'hierarchy') return drawHierarchy();
      const list = filtered();
      if (!list.length) {
        UI.emptyInto(body, {
          icon: 'search', tone: 'neutral', title: 'No one matches those filters',
          desc: 'Try clearing the department or status filter, or search for a different name or skill.',
          actions: [{ label: 'Clear filters', onClick: function () { People.q = ''; People.dept = 'all'; People.presence = 'all'; main.querySelector('#p-search').value = ''; main.querySelector('#p-dept-l').textContent = 'All departments'; main.querySelector('#p-pres-l').textContent = 'Any status'; draw(); } }]
        });
        return;
      }
      body.innerHTML = People.view === 'grid'
        ? '<div class="grid grid-auto">' + list.map(cardHTML).join('') + '</div>'
        : '<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Title</th><th>Department</th><th>Location</th><th>Status</th><th style="width:130px"></th></tr></thead><tbody>' +
          list.map(rowHTML).join('') + '</tbody></table></div>';
      bind();
    }

    function cardHTML(p) {
      return '<div class="person-card" data-person="' + p.id + '">' +
        '<div class="row-start gap-3">' + UI.avatar(p, 46) +
        '<div class="grow min0"><div class="semi md truncate">' + U.esc(p.name) + '</div>' +
        '<div class="tiny muted truncate">' + U.esc(p.title) + '</div>' +
        '<div class="tiny subtle truncate mt-1">' + icon('building') + ' ' + U.esc(Store.dept(p.deptId).name) + '</div></div>' +
        (p.suspended ? '<span class="badge danger">Suspended</span>' : '') + '</div>' +
        (p.statusText ? '<div class="pc-status tiny truncate">' + U.esc((p.statusEmoji || '') + ' ' + p.statusText) + '</div>' : '') +
        '<div class="row gap-1 mt-3 pc-actions">' +
        '<button class="btn sm" data-act="msg" data-tip="Message">' + icon('chat') + '</button>' +
        '<button class="btn sm" data-act="call" data-tip="Audio call">' + icon('phone') + '</button>' +
        '<button class="btn sm" data-act="video" data-tip="Video call">' + icon('video') + '</button>' +
        '<button class="btn sm" data-act="meet" data-tip="Schedule">' + icon('calendarPlus') + '</button>' +
        '<button class="btn sm ghost" data-act="more">' + icon('moreH') + '</button>' +
        '</div></div>';
    }
    function rowHTML(p) {
      return '<tr data-person="' + p.id + '">' +
        '<td><div class="row gap-2">' + UI.avatar(p, 28) + '<span class="semi md">' + U.esc(p.name) + '</span>' + (p.role !== 'Employee' ? UI.roleBadge(p.role) : '') + '</div></td>' +
        '<td class="tiny">' + U.esc(p.title) + '</td>' +
        '<td class="tiny">' + U.esc(Store.dept(p.deptId).name) + '</td>' +
        '<td class="tiny muted">' + U.esc(p.location) + '</td>' +
        '<td><span class="row gap-2 tiny"><i class="pres-dot ' + p.presence + '"></i>' + U.esc(UI.presenceLabel(p.presence)) + '</span></td>' +
        '<td><div class="row gap-1 justify-end">' +
        '<button class="icon-btn sm" data-act="msg">' + icon('chat') + '</button>' +
        '<button class="icon-btn sm" data-act="video">' + icon('video') + '</button>' +
        '<button class="icon-btn sm" data-act="more">' + icon('moreH') + '</button></div></td></tr>';
    }

    function drawDepartments() {
      body.innerHTML = '<div class="grid grid-auto-lg">' + DATA.DEPARTMENTS.map(function (d) {
        const members = Store.people().filter(p => p.deptId === d.id);
        const head = Store.person(d.headId);
        return '<div class="card hover pad dept-card" data-dept="' + d.id + '">' +
          '<div class="row gap-3 mb-3"><span class="dept-ic" style="background:' + d.color + '18;color:' + d.color + '">' + icon(d.icon) + '</span>' +
          '<div class="grow"><h4>' + U.esc(d.name) + '</h4><div class="tiny muted">' + d.headcount + ' people company-wide</div></div></div>' +
          '<div class="row gap-2 mb-3">' + UI.avatar(head, 26) + '<span class="tiny"><b>' + U.esc(head.name) + '</b> · Department head</span></div>' +
          '<div class="row gap-2">' + UI.avatarStack(members.map(m => m.id), 6, 24) + '<span class="tiny muted">' + U.plural(members.length, 'member') + ' here</span></div>' +
          '<div class="tiny subtle mt-3">' + U.esc(d.budget) + '</div>' +
          '</div>';
      }).join('') + '</div>';
      U.qsa('[data-dept]', body).forEach(b => b.onclick = function () {
        People.dept = b.dataset.dept; People.tab = 'directory';
        U.qsa('[data-tab]', main).forEach(x => x.classList.toggle('on', x.dataset.tab === 'directory'));
        main.querySelector('#p-dept-l').textContent = Store.dept(b.dataset.dept).name;
        draw();
      });
    }

    function drawTeams() {
      body.innerHTML = '<div class="grid grid-auto-lg">' + DATA.TEAMS.map(function (t) {
        const members = Store.people().filter(p => p.teamId === t.id);
        const lead = Store.person(t.leadId);
        const d = Store.dept(t.deptId);
        return '<div class="card pad">' +
          '<div class="row between mb-3"><h4>' + U.esc(t.name) + '</h4><span class="badge" style="background:' + d.color + '18;color:' + d.color + '">' + U.esc(d.name) + '</span></div>' +
          '<div class="row gap-2 mb-3">' + UI.avatar(lead, 30) + '<div><div class="semi md">' + U.esc(lead.name) + '</div><div class="tiny muted">Team lead</div></div></div>' +
          '<div class="mini-list">' + members.filter(m => m.id !== lead.id).map(m =>
            '<button class="lrow" data-person="' + m.id + '">' + UI.avatar(m, 26) +
            '<span class="grow min0 text-left"><span class="md semi truncate block">' + U.esc(m.name) + '</span>' +
            '<span class="tiny muted truncate">' + U.esc(m.title) + '</span></span></button>').join('') + '</div>' +
          (members.length <= 1 ? '<div class="tiny subtle">No other members in this workspace.</div>' : '') +
          '</div>';
      }).join('') + '</div>';
      bind();
    }

    function drawHierarchy() {
      const roots = Store.people().filter(p => !p.managerId);
      body.innerHTML = '<div class="org-tree">' + roots.map(node).join('') + '</div>';
      bind();
      U.qsa('[data-toggle]', body).forEach(b => b.onclick = function (e) {
        e.stopPropagation();
        b.closest('.org-node').classList.toggle('collapsed');
      });
      function node(p, depth) {
        depth = depth || 0;
        const reports = Store.people().filter(x => x.managerId === p.id);
        return '<div class="org-node' + (depth > 1 ? ' collapsed' : '') + '">' +
          '<div class="org-card2" data-person="' + p.id + '">' +
          (reports.length ? '<button class="icon-btn sm" data-toggle>' + icon('chevronDown') + '</button>' : '<span style="width:26px"></span>') +
          UI.avatar(p, 34) +
          '<div class="grow min0"><div class="semi md truncate">' + U.esc(p.name) + '</div>' +
          '<div class="tiny muted truncate">' + U.esc(p.title) + '</div></div>' +
          (reports.length ? '<span class="badge">' + U.plural(reports.length, 'report') + '</span>' : '') +
          UI.roleBadge(p.role) + '</div>' +
          (reports.length ? '<div class="org-children">' + reports.map(r => node(r, depth + 1)).join('') + '</div>' : '') +
          '</div>';
      }
    }

    function bind() {
      U.qsa('[data-person]', body).forEach(function (el) {
        el.onclick = function (e) {
          const a = e.target.closest('[data-act]');
          const id = el.dataset.person;
          if (!a) return Modals.personProfile(id);
          e.stopPropagation();
          const act = a.dataset.act;
          if (act === 'msg') App.openDM(id);
          if (act === 'call') Calls.start({ peerIds: [id], kind: 'audio', cid: 'd-' + id });
          if (act === 'video') Calls.start({ peerIds: [id], kind: 'video', cid: 'd-' + id });
          if (act === 'meet') Modals.scheduleMeeting({ participantIds: [id] });
          if (act === 'more') Modals.personMenu(a, id);
        };
      });
    }
  };

  g.PeopleView = People;
})(window);
