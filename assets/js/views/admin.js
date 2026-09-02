/* ===== iThrive — Admin dashboard ===== */
(function (g) {
  const Admin = { section: 'overview', userQ: '', userDept: 'all' };

  const SECTIONS = [
    { id: 'overview', label: 'Overview', icon: 'grid' },
    { id: 'analytics', label: 'Analytics', icon: 'chart' },
    { id: 'users', label: 'User management', icon: 'users' },
    { id: 'invitations', label: 'Invitations', icon: 'userPlus' },
    { id: 'structure', label: 'Departments & teams', icon: 'building' },
    { id: 'channels', label: 'Channels & groups', icon: 'hash' },
    { id: 'storage', label: 'Files & storage', icon: 'database' },
    { id: 'security', label: 'Security', icon: 'shield' },
    { id: 'audit', label: 'Audit log', icon: 'listChecks' },
    { id: 'integrations', label: 'Integrations', icon: 'plug' },
    { id: 'org', label: 'Organisation settings', icon: 'settings' }
  ];

  Admin.render = function (main, section) {
    if (section) Admin.section = section;
    if (!Store.isAdmin()) {
      main.className = 'main plain';
      main.innerHTML = '<div class="view-scroll"><div class="view-pad">' + UI.empty({
        icon: 'lock', tone: 'danger', title: 'Permission denied',
        desc: 'The admin dashboard is available to Owners, Super Admins and Admins. Your current role is ' + Store.me().role + '. Ask Hassan Yildiz (Head of IT & Security) if you believe you should have access.',
        actions: [{ label: 'Request access', icon: 'send', onClick: () => UI.toast('Access request sent to your workspace administrators.', 'success') },
        { label: 'Back to Home', variant: 'ghost', onClick: () => App.route('#/home') }]
      }) + '</div></div>';
      UI.bindEmpty(main, { actions: [{ onClick: () => UI.toast('Access request sent to your workspace administrators.', 'success') }, { onClick: () => App.route('#/home') }] });
      return;
    }

    main.className = 'main plain';
    main.innerHTML =
      '<div class="view-head"><div class="vh-main"><h2>' + icon('shield') + 'Admin</h2>' +
      '<div class="vh-sub">' + U.esc(DATA.ORG.name) + ' · ' + DATA.ORG.plan + ' · ' + DATA.ORG.employees + ' employees</div></div>' +
      '<div class="vh-actions">' +
      '<button class="btn" data-a="export">' + icon('download') + 'Export report</button>' +
      '<button class="btn primary" data-a="invite">' + icon('userPlus') + 'Invite people</button></div></div>' +
      '<div class="settings-wrap">' +
      '<nav class="settings-nav">' + SECTIONS.map(s =>
        '<button class="set-nav-item' + (s.id === Admin.section ? ' on' : '') + '" data-sec="' + s.id + '">' + icon(s.icon) + U.esc(s.label) + '</button>').join('') + '</nav>' +
      '<div class="settings-body scroll-y" id="admin-body"></div></div>';

    const body = main.querySelector('#admin-body');
    U.qsa('[data-sec]', main).forEach(b => b.onclick = function () {
      Admin.section = b.dataset.sec;
      U.qsa('[data-sec]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      window.location.hash = '#/admin/' + b.dataset.sec;
      draw();
    });
    main.querySelector('[data-a="invite"]').onclick = () => Modals.inviteUser(() => draw());
    main.querySelector('[data-a="export"]').onclick = () => UI.toast('Workspace report generated and emailed to you.', 'success');

    function draw() {
      body.innerHTML = (RENDER[Admin.section] || RENDER.overview)();
      body.scrollTop = 0;
      UI.bindSwitches(body, () => UI.toast('Setting saved.', 'success', { duration: 1300 }));
      bind();
    }

    /* ---------------- sections ---------------- */
    const RENDER = {};

    RENDER.overview = function () {
      const A = DATA.ANALYTICS;
      const msgs = Object.values(Store.state.messages).reduce((n, m) => n + m.length, 0);
      const stats = [
        ['Total employees', U.numFull(DATA.ORG.employees), '+12 this month', 'up', 'users'],
        ['Active today', U.numFull(A.dau[A.dau.length - 1] * 1), '+6.4% vs last week', 'up', 'activity'],
        ['Messages this week', U.num(A.messages.slice(-7).reduce((a, b) => a + b, 0)), '+9.1%', 'up', 'chat'],
        ['Meeting hours', U.num(A.meetingHours.slice(-7).reduce((a, b) => a + b, 0)), '-3.2%', 'down', 'video'],
        ['Calls this week', U.num(A.calls.slice(-7).reduce((a, b) => a + b, 0)), '+14%', 'up', 'phone'],
        ['Files shared', U.num(A.files.slice(-7).reduce((a, b) => a + b, 0)), '+7%', 'up', 'folder'],
        ['Channels', String(Store.convs().filter(c => c.kind === 'channel').length), '3 created this month', 'up', 'hash'],
        ['Groups', String(Store.convs().filter(c => c.kind === 'group').length), '2 created this month', 'up', 'users']
      ];
      return group('Workspace at a glance', 'Live metrics for ' + DATA.ORG.name + '.',
        '<div class="grid grid-4">' + stats.map(s =>
          '<div class="card pad stat-card"><div class="row between mb-2"><span class="st-ic">' + icon(s[4]) + '</span>' +
          '<span class="s-delta ' + s[3] + '">' + icon(s[3] === 'up' ? 'trendingUp' : 'trendingDown') + '</span></div>' +
          '<div class="stat"><span class="s-val">' + s[1] + '</span><span class="s-lbl">' + s[0] + '</span>' +
          '<span class="s-delta ' + s[3] + '">' + U.esc(s[2]) + '</span></div></div>').join('') + '</div>') +
        group('Storage', U.bytes(DATA.ORG.storageUsed) + ' of ' + U.bytes(DATA.ORG.storageTotal) + ' used across the workspace.',
          '<div class="progress" style="height:10px"><i style="width:' + U.pct(DATA.ORG.storageUsed, DATA.ORG.storageTotal) + '%"></i></div>' +
          '<div class="row gap-4 mt-3 wrap legend">' + DATA.ANALYTICS.storageByType.map(s =>
            '<span><i style="background:' + s.color + '"></i>' + s.label + ' · ' + s.value + ' GB</span>').join('') + '</div>') +
        group('Activity over the last 28 days', 'Daily active users across all clients.',
          barChart(DATA.ANALYTICS.dau, 28)) +
        group('Needs attention', '',
          '<div class="col gap-3">' +
          alertRow('warn', 'alertTriangle', '29% of employees have not completed security training', 'Due 15 April · 138 people remaining', 'Send reminder') +
          alertRow('danger', 'shield', '5 failed sign-in attempts from an unrecognised IP', '203.0.113.42 · Frankfurt, Germany · 2 days ago', 'Review') +
          alertRow('info', 'clock', '2 invitations are about to expire', 'Sent more than 7 days ago', 'Resend') +
          alertRow('warn', 'database', 'Storage is 36% used and growing 4% per month', 'Projected to reach the limit in 16 months', 'Manage storage') +
          '</div>');
    };

    RENDER.analytics = function () {
      const A = DATA.ANALYTICS;
      return group('Engagement', 'How people are using the workspace.',
        '<div class="grid grid-2">' +
        chartCard('Daily active users', A.dau, '#12a583', 'Last 28 days') +
        chartCard('Messages sent', A.messages, '#7c5cff', 'Last 28 days') +
        chartCard('Meeting hours', A.meetingHours, '#ff7a45', 'Last 28 days') +
        chartCard('Calls', A.calls, '#2e7cf6', 'Last 28 days') +
        '</div>') +
        group('Most active channels', '',
          '<div class="table-wrap"><table class="table"><thead><tr><th>Channel</th><th class="num">Messages</th><th class="num">Members</th><th class="num">Growth</th><th>Share</th></tr></thead><tbody>' +
          A.topChannels.map(function (c) {
            const conv = Store.conv(c.id);
            const max = A.topChannels[0].messages;
            return '<tr><td><div class="row gap-2">' + icon(UI.channelIcon(conv)) + '<span class="semi">#' + U.esc(conv ? conv.name : c.id) + '</span></div></td>' +
              '<td class="num">' + U.numFull(c.messages) + '</td><td class="num">' + c.members + '</td>' +
              '<td class="num"><span class="s-delta ' + (c.growth >= 0 ? 'up' : 'down') + '">' + (c.growth >= 0 ? '+' : '') + c.growth + '%</span></td>' +
              '<td style="width:180px"><div class="progress thin"><i style="width:' + U.pct(c.messages, max) + '%"></i></div></td></tr>';
          }).join('') + '</tbody></table></div>') +
        group('Most active teams', '',
          '<div class="table-wrap"><table class="table"><thead><tr><th>Team</th><th class="num">Messages</th><th class="num">Meetings</th><th class="num">Files</th></tr></thead><tbody>' +
          A.topTeams.map(t => '<tr><td class="semi">' + U.esc(t.name) + '</td><td class="num">' + U.numFull(t.messages) + '</td>' +
            '<td class="num">' + t.meetings + '</td><td class="num">' + t.files + '</td></tr>').join('') + '</tbody></table></div>') +
        group('Responsiveness', 'How quickly people reply to each other.',
          '<div class="grid grid-3">' +
          kpi('Median first reply', A.responseTime.median + ' min', 'Across direct messages') +
          kpi('90th percentile', A.responseTime.p90 + ' min', 'Slowest 10% of replies') +
          kpi('Messages outside hours', '4.2%', 'Down from 7.8% last quarter') +
          '</div>' +
          '<div class="banner brand mt-4">' + icon('sparkles') + '<div class="b-body"><strong>Thrive AI observation</strong>Out-of-hours messaging has fallen by nearly half since core collaboration hours were introduced in the remote working policy. Engineering remains the highest at 6.1%.</div></div>');
    };

    RENDER.users = function () {
      let list = Store.people();
      if (Admin.userDept !== 'all') list = list.filter(p => p.deptId === Admin.userDept);
      if (Admin.userQ) list = list.filter(p => (p.name + p.email + p.title).toLowerCase().includes(Admin.userQ));
      return group('User management', U.plural(Store.people().length, 'user') + ' in this workspace.',
        '<div class="row gap-2 mb-4 wrap">' +
        '<div class="input-wrap grow" style="max-width:320px">' + icon('search') + '<input class="input" data-uq value="' + U.attr(Admin.userQ) + '" placeholder="Search users"></div>' +
        '<select class="select" data-udept style="width:200px"><option value="all">All departments</option>' +
        DATA.DEPARTMENTS.map(d => '<option value="' + d.id + '"' + (Admin.userDept === d.id ? ' selected' : '') + '>' + U.esc(d.name) + '</option>').join('') + '</select>' +
        '<button class="btn" data-a2="bulk">' + icon('listChecks') + 'Bulk actions</button>' +
        '<button class="btn primary" data-a2="invite">' + icon('userPlus') + 'Invite</button></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>User</th><th>Role</th><th>Department</th><th>Status</th><th>Last active</th><th style="width:60px"></th></tr></thead><tbody>' +
        list.map(p => '<tr>' +
          '<td><div class="row gap-2">' + UI.avatar(p, 30) + '<div class="min0"><div class="semi md truncate">' + U.esc(p.name) + '</div>' +
          '<div class="tiny muted truncate">' + U.esc(p.email) + '</div></div></div></td>' +
          '<td>' + UI.roleBadge(p.role) + '</td>' +
          '<td class="tiny">' + U.esc(Store.dept(p.deptId).name) + '</td>' +
          '<td>' + (p.suspended ? '<span class="badge danger">Suspended</span>' : '<span class="badge success">Active</span>') + '</td>' +
          '<td class="tiny muted">' + U.esc(p.presence === 'offline' ? U.ago(DATA.t(600 + U.hashInt(p.id) % 4000)) : 'Now') + '</td>' +
          '<td><button class="icon-btn sm" data-umenu="' + p.id + '">' + icon('moreH') + '</button></td></tr>').join('') +
        '</tbody></table></div>' +
        (list.length ? '' : '<div class="tiny muted mt-3">No users match those filters.</div>'));
    };

    RENDER.invitations = function () {
      const inv = Store.state.invitations;
      return group('Pending invitations', inv.filter(i => i.status === 'pending').length + ' pending · ' + inv.filter(i => i.status === 'expired').length + ' expired',
        (inv.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Email</th><th>Role</th><th>Department</th><th>Invited by</th><th>Sent</th><th>Status</th><th style="width:60px"></th></tr></thead><tbody>' +
          inv.map(i => '<tr>' +
            '<td><div class="semi md">' + U.esc(i.email) + '</div>' + (i.name ? '<div class="tiny muted">' + U.esc(i.name) + '</div>' : '') + '</td>' +
            '<td>' + UI.roleBadge(i.role) + '</td>' +
            '<td class="tiny">' + U.esc(i.deptId ? Store.dept(i.deptId).name : '—') + '</td>' +
            '<td class="tiny">' + U.esc(Store.person(i.invitedBy).name) + '</td>' +
            '<td class="tiny muted">' + U.esc(U.ago(i.sentAt)) + '</td>' +
            '<td>' + (i.status === 'pending' ? '<span class="badge warning">Pending</span>' : i.status === 'expired' ? '<span class="badge danger">Expired</span>' : '<span class="badge success">Accepted</span>') + '</td>' +
            '<td><button class="icon-btn sm" data-imenu="' + i.id + '">' + icon('moreH') + '</button></td></tr>').join('') +
          '</tbody></table></div>'
          : UI.empty({ icon: 'userPlus', title: 'No pending invitations', desc: 'Invite colleagues by email, or share a join link with your domain.', tone: 'neutral' })) +
        '<div class="row gap-2 mt-4"><button class="btn primary" data-a2="invite">' + icon('userPlus') + 'Invite people</button>' +
        '<button class="btn" data-a2="link">' + icon('link') + 'Copy join link</button>' +
        '<button class="btn" data-a2="bulkinvite">' + icon('upload') + 'Bulk invite from CSV</button></div>') +
        group('Join settings', 'How people can join ' + DATA.ORG.name + '.',
          '<div class="col gap-1">' +
          UI.switchRow('Anyone with a @northbeam.io email can join', 'Domain-verified sign-up without an invitation', true, 'domainjoin') +
          UI.switchRow('Require admin approval for new members', '', false, 'approve') +
          UI.switchRow('Allow guest accounts', 'External people with limited, channel-scoped access', true, 'guests') +
          UI.switchRow('Guest accounts expire automatically', 'After 90 days of inactivity', true, 'guestexp') +
          '</div>');
    };

    RENDER.structure = function () {
      return group('Departments', DATA.DEPARTMENTS.length + ' departments · ' + DATA.ORG.employees + ' employees',
        '<div class="table-wrap"><table class="table"><thead><tr><th>Department</th><th>Head</th><th class="num">Headcount</th><th>In workspace</th><th>Budget</th><th style="width:60px"></th></tr></thead><tbody>' +
        DATA.DEPARTMENTS.map(function (d) {
          const inWs = Store.people().filter(p => p.deptId === d.id);
          return '<tr><td><div class="row gap-2"><span class="dept-ic sm" style="background:' + d.color + '18;color:' + d.color + '">' + icon(d.icon) + '</span>' +
            '<span class="semi">' + U.esc(d.name) + '</span></div></td>' +
            '<td><div class="row gap-2">' + UI.avatar(d.headId, 24) + '<span class="tiny">' + U.esc(Store.person(d.headId).name) + '</span></div></td>' +
            '<td class="num">' + d.headcount + '</td>' +
            '<td>' + UI.avatarStack(inWs.map(p => p.id), 4, 22) + '</td>' +
            '<td class="tiny muted">' + U.esc(d.budget) + '</td>' +
            '<td><button class="icon-btn sm" data-dmenu="' + d.id + '">' + icon('moreH') + '</button></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<button class="btn mt-4" data-a2="newdept">' + icon('plus') + 'Add a department</button>') +
        group('Teams', DATA.TEAMS.length + ' teams',
          '<div class="grid grid-auto">' + DATA.TEAMS.map(function (t) {
            const d = Store.dept(t.deptId);
            const members = Store.people().filter(p => p.teamId === t.id);
            return '<div class="card pad"><div class="row between mb-2"><span class="semi md">' + U.esc(t.name) + '</span>' +
              '<span class="badge" style="background:' + d.color + '18;color:' + d.color + '">' + U.esc(d.name) + '</span></div>' +
              '<div class="row gap-2 mb-2">' + UI.avatar(t.leadId, 24) + '<span class="tiny">' + U.esc(Store.person(t.leadId).name) + ' · lead</span></div>' +
              '<div class="row gap-2">' + UI.avatarStack(members.map(m => m.id), 5, 22) + '<span class="tiny muted">' + U.plural(members.length, 'member') + '</span></div></div>';
          }).join('') + '</div>' +
          '<button class="btn mt-4" data-a2="newteam">' + icon('plus') + 'Add a team</button>') +
        group('Roles and permissions', 'What each role can do in this workspace.',
          '<div class="table-wrap"><table class="table"><thead><tr><th>Role</th><th>People</th><th>Key permissions</th></tr></thead><tbody>' +
          [['Owner', 'Full control including billing, deletion and ownership transfer'],
          ['Super Admin', 'Everything except billing and deleting the workspace'],
          ['Admin', 'User management, channels, security settings and audit logs'],
          ['Manager', 'Post announcements, manage their department, view team analytics'],
          ['Team Lead', 'Manage their team channels and add members'],
          ['Employee', 'Full messaging, files, meetings and tasks'],
          ['Guest', 'Access only the channels they are invited to'],
          ['External Collaborator', 'Scoped project access, no directory browsing']].map(function (r) {
            const n = Store.people().filter(p => p.role === r[0]).length;
            return '<tr><td>' + UI.roleBadge(r[0]) + '</td><td class="num">' + n + '</td><td class="tiny muted">' + U.esc(r[1]) + '</td></tr>';
          }).join('') + '</tbody></table></div>');
    };

    RENDER.channels = function () {
      const chans = Store.convs().filter(c => c.kind === 'channel');
      const groups = Store.convs().filter(c => c.kind === 'group');
      return group('Channels', chans.length + ' channels · ' + chans.filter(c => c.archived).length + ' archived',
        '<div class="table-wrap"><table class="table"><thead><tr><th>Channel</th><th>Type</th><th class="num">Members</th><th class="num">Messages</th><th>Created</th><th style="width:60px"></th></tr></thead><tbody>' +
        chans.map(c => '<tr>' +
          '<td><div class="row gap-2">' + icon(UI.channelIcon(c)) + '<div><div class="semi md">#' + U.esc(c.name) + '</div>' +
          '<div class="tiny muted truncate" style="max-width:280px">' + U.esc(c.topic || '') + '</div></div></div></td>' +
          '<td><span class="badge">' + U.cap(c.type) + '</span>' + (c.archived ? ' <span class="badge">Archived</span>' : '') + '</td>' +
          '<td class="num">' + c.memberIds.length + '</td>' +
          '<td class="num">' + (Store.msgs(c.id) || []).length + '</td>' +
          '<td class="tiny muted">' + U.esc(U.dateShort(c.createdAt)) + '</td>' +
          '<td><button class="icon-btn sm" data-cmenu2="' + c.id + '">' + icon('moreH') + '</button></td></tr>').join('') +
        '</tbody></table></div>') +
        group('Groups', groups.length + ' groups',
          '<div class="table-wrap"><table class="table"><thead><tr><th>Group</th><th>Type</th><th class="num">Members</th><th>Owner</th><th style="width:60px"></th></tr></thead><tbody>' +
          groups.map(c => '<tr><td class="semi">' + (c.emoji || '') + ' ' + U.esc(c.name) + '</td>' +
            '<td><span class="badge">' + U.cap(c.type) + '</span></td><td class="num">' + c.memberIds.length + '</td>' +
            '<td class="tiny">' + U.esc(Store.person(c.createdBy).name) + '</td>' +
            '<td><button class="icon-btn sm" data-cmenu2="' + c.id + '">' + icon('moreH') + '</button></td></tr>').join('') +
          '</tbody></table></div>') +
        group('Channel policies', '',
          '<div class="col gap-1">' +
          UI.switchRow('Anyone can create public channels', '', true, 'chcreate') +
          UI.switchRow('Anyone can create private channels', '', false, 'chpriv') +
          UI.switchRow('Only admins can create announcement channels', '', true, 'chann') +
          UI.switchRow('Archive channels after 90 days of inactivity', '', false, 'charch') +
          UI.switchRow('Require a topic when creating a channel', '', true, 'chtopic') +
          '</div>');
    };

    RENDER.storage = function () {
      const byOwner = {};
      Store.state.files.forEach(f => { byOwner[f.ownerId] = (byOwner[f.ownerId] || 0) + f.size; });
      const top = U.sortBy(Object.keys(byOwner), k => byOwner[k], 'desc').slice(0, 6);
      return group('Storage usage', U.bytes(DATA.ORG.storageUsed) + ' of ' + U.bytes(DATA.ORG.storageTotal) + ' (' + U.pct(DATA.ORG.storageUsed, DATA.ORG.storageTotal) + '%)',
        '<div class="progress" style="height:12px"><i style="width:' + U.pct(DATA.ORG.storageUsed, DATA.ORG.storageTotal) + '%"></i></div>' +
        '<div class="grid grid-2 mt-4">' +
        '<div class="card pad"><div class="panel-title">By file type</div>' +
        DATA.ANALYTICS.storageByType.map(function (s) {
          const max = DATA.ANALYTICS.storageByType[0].value;
          return '<div class="mb-3"><div class="row between mb-1"><span class="md">' + s.label + '</span><span class="tiny semi">' + s.value + ' GB</span></div>' +
            '<div class="progress thin"><i style="width:' + U.pct(s.value, max) + '%;background:' + s.color + '"></i></div></div>';
        }).join('') + '</div>' +
        '<div class="card pad"><div class="panel-title">Largest contributors (this workspace)</div>' +
        top.map(function (id) {
          const max = byOwner[top[0]];
          return '<div class="mb-3"><div class="row between mb-1"><span class="row gap-2">' + UI.avatar(id, 22) + '<span class="md">' + U.esc(Store.person(id).name) + '</span></span>' +
            '<span class="tiny semi">' + U.bytes(byOwner[id]) + '</span></div>' +
            '<div class="progress thin"><i style="width:' + U.pct(byOwner[id], max) + '%"></i></div></div>';
        }).join('') + '</div></div>') +
        group('File policies', '',
          '<div class="col gap-4">' +
          UI.field('Maximum upload size', '<select class="select"><option>25 MB</option><option>100 MB</option><option selected>250 MB</option><option>1 GB</option></select>') +
          UI.field('Blocked file types', '<input class="input" value=".exe, .bat, .cmd, .scr, .js" >') +
          UI.field('Data retention', '<select class="select"><option>90 days</option><option>1 year</option><option selected>2 years (730 days)</option><option>Forever</option></select>') +
          '<div class="col gap-1">' +
          UI.switchRow('Allow external file sharing', 'Share links with people outside the organisation', false, 'extshare') +
          UI.switchRow('Scan uploads for malware', '', true, 'scan') +
          UI.switchRow('Watermark previews of restricted files', '', true, 'watermark') +
          UI.switchRow('Block downloads on unmanaged devices', '', false, 'blockdl') +
          '</div></div>');
    };

    RENDER.security = function () {
      return group('Authentication', '',
        '<div class="col gap-3">' +
        settingRow('Single sign-on (SSO)', 'Okta · SAML 2.0 · certificate valid until Nov 2026', '<button class="btn sm" data-a2="sso">Configure</button>') +
        settingRow('SCIM provisioning', 'Users and groups sync automatically from Okta', '<span class="badge success">Active</span>') +
        settingRow('Two-factor authentication', 'Required for all members', '<span class="badge success">Enforced</span>') +
        settingRow('Password policy', 'Minimum 14 characters, number and symbol required', '<button class="btn sm" data-a2="pwpolicy">Edit</button>') +
        settingRow('Session timeout', 'Sign out after 30 days of inactivity', '<button class="btn sm" data-a2="timeout">Edit</button>') +
        '</div>') +
        group('Access controls', '',
          '<div class="col gap-1">' +
          UI.switchRow('Restrict access by IP range', 'Only allow sign-in from approved networks', false, 'iprange') +
          UI.switchRow('Require managed devices', 'Only devices enrolled in MDM can sign in', false, 'mdm') +
          UI.switchRow('Block sign-in from new countries', 'Requires admin approval', true, 'geo') +
          UI.switchRow('Allow guests to see the member directory', '', false, 'guestdir') +
          UI.switchRow('Allow external collaborators in private channels', '', false, 'extpriv') +
          '</div>') +
        group('Data protection', '',
          '<div class="col gap-3">' +
          settingRow('Data residency', 'European Union (Frankfurt)', '<span class="badge brand">EU</span>') +
          settingRow('Encryption at rest', 'AES-256', '<span class="badge success">Enabled</span>') +
          settingRow('Encryption in transit', 'TLS 1.3', '<span class="badge success">Enabled</span>') +
          settingRow('Data loss prevention', 'Scan messages for card numbers and credentials', '<span class="badge success">Enabled</span>') +
          settingRow('Legal hold', 'No active holds', '<button class="btn sm" data-a2="hold">Manage</button>') +
          '</div>') +
        group('Compliance', '',
          '<div class="grid grid-auto">' +
          ['SOC 2 Type II', 'ISO 27001', 'GDPR', 'CCPA', 'HIPAA ready'].map(c =>
            '<div class="tile row gap-2">' + icon('checkCircle') + '<span class="semi md">' + c + '</span></div>').join('') + '</div>');
    };

    RENDER.audit = function () {
      return group('Audit log', Store.state.audit.length + ' events · retained for 730 days',
        '<div class="row gap-2 mb-4 wrap">' +
        '<div class="input-wrap grow" style="max-width:300px">' + icon('search') + '<input class="input" data-auditq placeholder="Search events"></div>' +
        '<button class="btn" data-a2="auditexport">' + icon('download') + 'Export CSV</button></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>IP</th><th>Severity</th></tr></thead><tbody data-auditbody>' +
        Store.state.audit.map(auditRow).join('') + '</tbody></table></div>');
    };
    function auditRow(a) {
      const sev = { normal: '', high: 'warning', critical: 'danger' }[a.severity] || '';
      return '<tr><td class="tiny muted">' + U.esc(U.ago(a.ts)) + '</td>' +
        '<td><div class="row gap-2">' + UI.avatar(a.actorId, 22) + '<span class="tiny">' + U.esc(Store.person(a.actorId).first) + '</span></div></td>' +
        '<td class="tiny mono">' + U.esc(a.action) + '</td>' +
        '<td class="tiny">' + U.esc(a.target) + '</td>' +
        '<td class="tiny mono muted">' + U.esc(a.ip) + '</td>' +
        '<td><span class="badge ' + sev + '">' + U.cap(a.severity) + '</span></td></tr>';
    }

    RENDER.integrations = function () {
      const cats = U.uniq(Store.state.integrations.map(i => i.category));
      return group('Integration marketplace', Store.state.integrations.filter(i => i.connected).length + ' of ' + Store.state.integrations.length + ' connected',
        cats.map(function (cat) {
          const items = Store.state.integrations.filter(i => i.category === cat);
          return '<div class="mb-5"><div class="panel-title">' + U.esc(cat) + '</div>' +
            '<div class="grid grid-auto">' + items.map(function (i) {
              return '<div class="int-card"><div class="row gap-3 mb-2">' +
                '<span class="int-ic" style="background:' + i.color + '18;color:' + i.color + '">' + icon(i.glyph) + '</span>' +
                '<div class="grow min0"><div class="semi md truncate">' + U.esc(i.name) + '</div>' +
                '<div class="tiny muted">' + U.numFull(i.installs) + ' installs</div></div>' +
                (i.connected ? '<span class="badge success">' + icon('check') + '</span>' : '') + '</div>' +
                '<div class="tiny muted clamp-2">' + U.esc(i.desc) + '</div>' +
                (i.connected && i.connectedBy ? '<div class="tiny subtle mt-2">Connected by ' + U.esc(Store.person(i.connectedBy).first) + ' · ' + U.esc(U.ago(i.connectedAt)) + '</div>' : '') +
                '<div class="row gap-2 mt-3"><button class="btn sm ' + (i.connected ? '' : 'soft') + ' grow" data-int2="' + i.id + '">' + (i.connected ? 'Disconnect' : 'Connect') + '</button>' +
                '<button class="btn sm ghost" data-intinfo="' + i.id + '">' + icon('info') + '</button></div></div>';
            }).join('') + '</div></div>';
        }).join('')) +
        group('Integration policy', '',
          '<div class="col gap-1">' +
          UI.switchRow('Allow members to install integrations', 'Otherwise only admins can', false, 'intinstall') +
          UI.switchRow('Require admin approval for new integrations', '', true, 'intapprove') +
          UI.switchRow('Allow incoming webhooks', '', true, 'webhooks') +
          '</div>');
    };

    RENDER.org = function () {
      return group('Organisation profile', '',
        '<div class="row-start gap-5 wrap">' +
        '<div class="col center gap-2"><span class="org-logo-big" style="background:' + DATA.ORG.color + '">' + DATA.ORG.short + '</span>' +
        '<button class="btn sm">' + icon('camera') + 'Change logo</button></div>' +
        '<div class="grow col gap-4" style="min-width:280px">' +
        UI.field('Organisation name', '<input class="input" value="' + U.attr(DATA.ORG.name) + '">') +
        UI.field('Workspace URL', '<input class="input" value="northbeam.ithrive.app">') +
        UI.field('Primary domain', '<input class="input" value="' + U.attr(DATA.ORG.domain) + '">') +
        UI.field('Description', '<textarea class="textarea">' + U.esc(DATA.ORG.tagline) + '</textarea>') +
        UI.field('Headquarters', '<input class="input" value="' + U.attr(DATA.ORG.hq) + '">') +
        '<button class="btn primary" data-a2="saveorg">Save organisation profile</button>' +
        '</div></div>') +
        group('Plan and billing', '',
          '<div class="card pad"><div class="row between wrap gap-3">' +
          '<div><div class="badge brand mb-2">' + DATA.ORG.plan + '</div>' +
          '<div class="semi" style="font-size:var(--fs-xl)">€14 per seat / month</div>' +
          '<div class="tiny muted mt-1">' + DATA.ORG.employees + ' of ' + DATA.ORG.seats + ' seats in use · renews 11 April 2026</div></div>' +
          '<div class="row gap-2"><button class="btn">Manage seats</button><button class="btn">Billing history</button></div>' +
          '</div><div class="progress mt-4"><i style="width:' + U.pct(DATA.ORG.employees, DATA.ORG.seats) + '%"></i></div></div>') +
        group('Workspace defaults', '',
          '<div class="col gap-1">' +
          UI.switchRow('New members join #general automatically', '', true, 'autogeneral') +
          UI.switchRow('New members join #announcements automatically', '', true, 'autoann') +
          UI.switchRow('Show the employee directory to all members', '', true, 'showdir') +
          UI.switchRow('Enable Thrive AI for the whole organisation', 'Individuals can still opt out', true, 'orgai') +
          UI.switchRow('Allow message editing', '', true, 'allowedit') +
          UI.switchRow('Allow message deletion', '', true, 'allowdel') +
          '</div>') +
        group('Danger zone', '',
          '<div class="col gap-3">' +
          settingRow('Transfer ownership', 'Currently owned by ' + Store.person(DATA.ORG.ownerId).name, '<button class="btn sm">Transfer</button>') +
          settingRow('Export all workspace data', 'A full archive of messages, files and metadata', '<button class="btn sm">Request export</button>') +
          settingRow('Delete this workspace', 'Permanently removes everything for all 486 members', '<button class="btn sm danger" data-a2="deleteorg">Delete workspace</button>') +
          '</div>');
    };

    /* ---------------- helpers ---------------- */
    function group(title, desc, inner) {
      return '<section class="set-group"><h3>' + U.esc(title) + '</h3>' +
        (desc ? '<p class="tiny muted mb-4">' + U.esc(desc) + '</p>' : '<div class="mb-3"></div>') + inner + '</section>';
    }
    function settingRow(title, desc, right) {
      return '<div class="row between gap-4 setting-row"><div class="grow"><div class="semi md">' + U.esc(title) + '</div>' +
        (desc ? '<div class="tiny muted mt-1">' + U.esc(desc) + '</div>' : '') + '</div>' + right + '</div>';
    }
    function alertRow(tone, ic, title, desc, action) {
      return '<div class="banner ' + tone + '">' + icon(ic) + '<div class="b-body"><strong>' + U.esc(title) + '</strong>' + U.esc(desc) + '</div>' +
        '<button class="btn sm" data-alert="' + U.attr(action) + '">' + U.esc(action) + '</button></div>';
    }
    function kpi(label, val, sub) {
      return '<div class="card pad"><div class="stat"><span class="s-val">' + U.esc(val) + '</span><span class="s-lbl">' + U.esc(label) + '</span></div>' +
        '<div class="tiny subtle mt-2">' + U.esc(sub) + '</div></div>';
    }
    function barChart(series, n) {
      const data = series.slice(-n);
      const max = Math.max.apply(null, data);
      return '<div class="bars">' + data.map((v, i) =>
        '<div class="bcol" data-tip="' + v + ' users"><div class="b" style="height:' + U.pct(v, max) + '%"></div></div>').join('') + '</div>' +
        '<div class="row between tiny subtle mt-2"><span>' + n + ' days ago</span><span>Today</span></div>';
    }
    function chartCard(title, series, color, sub) {
      const data = series.slice(-28);
      const max = Math.max.apply(null, data);
      const last = data[data.length - 1], prev = data[data.length - 8] || last;
      const delta = prev ? Math.round(((last - prev) / prev) * 100) : 0;
      const pts = data.map((v, i) => (i / (data.length - 1)) * 100 + ',' + (100 - U.pct(v, max))).join(' ');
      return '<div class="card pad"><div class="row between mb-2"><div><div class="semi md">' + title + '</div>' +
        '<div class="tiny subtle">' + sub + '</div></div>' +
        '<div class="text-right"><div class="semi" style="font-size:var(--fs-xl)">' + U.num(last) + '</div>' +
        '<div class="s-delta ' + (delta >= 0 ? 'up' : 'down') + '">' + (delta >= 0 ? '+' : '') + delta + '% vs last week</div></div></div>' +
        '<svg class="spark" viewBox="0 0 100 100" preserveAspectRatio="none" style="height:70px">' +
        '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
        '<polyline points="0,100 ' + pts + ' 100,100" fill="' + color + '18" stroke="none"/>' +
        '</svg></div>';
    }

    function bind() {
      U.qsa('[data-a2]', body).forEach(b => b.onclick = function () {
        const a = b.dataset.a2;
        if (a === 'invite') Modals.inviteUser(() => draw());
        if (a === 'link') UI.copyToast('https://northbeam.ithrive.app/join/NB-4K92-XZ71', 'Join link copied.');
        if (a === 'bulkinvite') Modals.bulkInvite(() => draw());
        if (a === 'bulk') UI.toast('Select users with the checkboxes to run a bulk action.', 'info');
        if (a === 'newdept') UI.prompt({ title: 'Add a department', label: 'Department name', icon: 'building' }).then(v => { if (v) { DATA.DEPARTMENTS.push({ id: v.toLowerCase().replace(/\W+/g, '-'), name: v, icon: 'briefcase', color: '#64748b', headId: Store.state.meId, headcount: 0, budget: 'Not set' }); draw(); UI.toast('Department created.', 'success'); } });
        if (a === 'newteam') UI.prompt({ title: 'Add a team', label: 'Team name', icon: 'users' }).then(v => { if (v) { DATA.TEAMS.push({ id: U.uid('tm'), name: v, deptId: DATA.DEPARTMENTS[0].id, leadId: Store.state.meId }); draw(); UI.toast('Team created.', 'success'); } });
        if (a === 'sso') Modals.ssoConfig();
        if (a === 'pwpolicy') Modals.passwordPolicy();
        if (a === 'timeout') UI.toast('Session timeout settings opened.', 'info');
        if (a === 'hold') UI.toast('No legal holds are currently active.', 'info');
        if (a === 'auditexport') UI.toast('Audit log exported as CSV.', 'success');
        if (a === 'saveorg') UI.toast('Organisation profile saved.', 'success');
        if (a === 'deleteorg') UI.confirm({
          title: 'Delete ' + DATA.ORG.name + '?', danger: true, confirmLabel: 'I understand, delete',
          body: 'This permanently deletes every message, file, channel and account for all 486 members. It cannot be undone.',
          detail: 'You would normally be asked to type the workspace name to confirm.'
        }).then(ok => { if (ok) UI.toast('Workspace deletion is disabled in this demonstration.', 'warn'); });
      });
      U.qsa('[data-alert]', body).forEach(b => b.onclick = () => UI.toast(b.dataset.alert + ' — action started.', 'success'));
      const uq = body.querySelector('[data-uq]');
      if (uq) uq.addEventListener('input', U.debounce(e => { Admin.userQ = e.target.value.toLowerCase(); draw(); const f = body.querySelector('[data-uq]'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 250));
      const ud = body.querySelector('[data-udept]');
      if (ud) ud.onchange = e => { Admin.userDept = e.target.value; draw(); };
      U.qsa('[data-umenu]', body).forEach(b => b.onclick = function (e) {
        const p = Store.person(b.dataset.umenu);
        UI.menu(b, [
          { label: 'View profile', icon: 'contacts', onClick: () => Modals.personProfile(p.id) },
          { label: 'Send a message', icon: 'chat', onClick: () => App.openDM(p.id) },
          { sep: true },
          { label: 'Change role…', icon: 'shield', onClick: () => Modals.changeRole(p.id, () => draw()) },
          { label: 'Change department…', icon: 'building', onClick: () => Modals.changeDept(p.id, () => draw()) },
          { label: 'Reset password', icon: 'key', onClick: () => UI.toast('Password reset email sent to ' + p.email + '.', 'success') },
          { label: 'Force sign-out', icon: 'logout', onClick: () => UI.toast(p.first + ' has been signed out of all devices.', 'success') },
          { sep: true },
          { label: p.suspended ? 'Reactivate account' : 'Suspend account', icon: 'userX', danger: !p.suspended, onClick: function () {
            UI.confirm({ title: (p.suspended ? 'Reactivate ' : 'Suspend ') + p.name + '?', danger: !p.suspended, confirmLabel: p.suspended ? 'Reactivate' : 'Suspend',
              body: p.suspended ? 'They will regain access to the workspace immediately.' : 'They will be signed out everywhere and cannot sign in until reactivated. Their messages and files remain.' })
              .then(ok => { if (ok) { Store.suspendUser(p.id); draw(); UI.toast(p.name + (p.suspended ? ' suspended.' : ' reactivated.'), 'success'); } });
          } },
          { label: 'Delete account', icon: 'trash', danger: true, onClick: function () {
            UI.confirm({ title: 'Delete ' + p.name + '?', danger: true, confirmLabel: 'Delete account',
              body: 'Their account is removed and their messages are attributed to a deactivated user. This cannot be undone.',
              detail: 'Consider suspending instead — it is reversible and preserves access history.' })
              .then(ok => { if (ok) UI.toast('Account deletion requires owner approval in this workspace.', 'warn'); });
          } }
        ], { align: 'right' });
      });
      U.qsa('[data-imenu]', body).forEach(b => b.onclick = function () {
        const i = Store.state.invitations.find(x => x.id === b.dataset.imenu);
        UI.menu(b, [
          { label: 'Resend invitation', icon: 'send', onClick: () => { i.sentAt = new Date().toISOString(); i.status = 'pending'; Store.persist(); draw(); UI.toast('Invitation resent to ' + i.email + '.', 'success'); } },
          { label: 'Copy invitation link', icon: 'link', onClick: () => UI.copyToast('https://northbeam.ithrive.app/join/' + i.id, 'Invitation link copied.') },
          { label: 'Edit role', icon: 'shield', onClick: () => UI.toast('Change the role before resending.', 'info') },
          { sep: true },
          { label: 'Revoke invitation', icon: 'trash', danger: true, onClick: () => { Store.revokeInvite(i.id); draw(); UI.toast('Invitation revoked.', 'success'); } }
        ], { align: 'right' });
      });
      U.qsa('[data-dmenu]', body).forEach(b => b.onclick = function () {
        const d = Store.dept(b.dataset.dmenu);
        UI.menu(b, [
          { label: 'View members', icon: 'users', onClick: () => App.route('#/contacts') },
          { label: 'Rename department', icon: 'edit', onClick: () => UI.prompt({ title: 'Rename department', value: d.name }).then(v => { if (v) { d.name = v; draw(); UI.toast('Department renamed.', 'success'); } }) },
          { label: 'Change head', icon: 'userPlus', onClick: () => UI.toast('Choose a new department head from the directory.', 'info') },
          { sep: true },
          { label: 'Delete department', icon: 'trash', danger: true, onClick: () => UI.confirm({ title: 'Delete ' + d.name + '?', body: 'Members will be left without a department until reassigned.', danger: true, confirmLabel: 'Delete' }).then(ok => { if (ok) UI.toast('Departments with members cannot be deleted.', 'warn'); }) }
        ], { align: 'right' });
      });
      U.qsa('[data-cmenu2]', body).forEach(b => b.onclick = function () {
        const c = Store.conv(b.dataset.cmenu2);
        UI.menu(b, [
          { label: 'Open', icon: 'externalLink', onClick: () => App.route('#/messages/' + c.id) },
          { label: 'View analytics', icon: 'chart', onClick: () => Modals.channelAnalytics(c.id) },
          { label: 'Manage members', icon: 'users', onClick: () => { App.route('#/messages/' + c.id); setTimeout(() => App.togglePanel(true, 'members'), 300); } },
          { sep: true },
          { label: c.archived ? 'Unarchive' : 'Archive', icon: 'archive', onClick: () => { Store.archiveConv(c.id); draw(); UI.toast(c.archived ? 'Archived.' : 'Restored.', 'success'); } },
          { label: 'Delete permanently', icon: 'trash', danger: true, onClick: function () {
            UI.confirm({ title: 'Delete ' + Store.convTitle(c) + '?', danger: true, confirmLabel: 'Delete permanently',
              body: 'All ' + (Store.msgs(c.id) || []).length + ' messages and their files will be removed for every member. This cannot be undone.' })
              .then(ok => { if (ok) { Store.deleteConv(c.id); draw(); App.renderSidebar(); UI.toast('Channel deleted.', 'success'); } });
          } }
        ], { align: 'right' });
      });
      U.qsa('[data-int2]', body).forEach(b => b.onclick = function () {
        const i = Store.state.integrations.find(x => x.id === b.dataset.int2);
        if (i.connected) {
          UI.confirm({ title: 'Disconnect ' + i.name + '?', body: 'Everyone in the workspace will lose this integration.', danger: true, confirmLabel: 'Disconnect' })
            .then(ok => { if (ok) { Store.toggleIntegration(i.id); draw(); UI.toast(i.name + ' disconnected.', 'success'); } });
        } else Modals.connectIntegration(i.id, () => draw());
      });
      U.qsa('[data-intinfo]', body).forEach(b => b.onclick = () => Modals.integrationDetail(b.dataset.intinfo, () => draw()));
      const aq = body.querySelector('[data-auditq]');
      if (aq) aq.addEventListener('input', U.debounce(function (e) {
        const q = e.target.value.toLowerCase();
        const rows = Store.state.audit.filter(a => (a.action + a.target + Store.person(a.actorId).name).toLowerCase().includes(q));
        body.querySelector('[data-auditbody]').innerHTML = rows.length ? rows.map(auditRow).join('') : '<tr><td colspan="6" class="tiny muted text-center" style="padding:24px">No events match that search.</td></tr>';
      }, 200));
    }

    draw();
  };

  g.AdminView = Admin;
})(window);
