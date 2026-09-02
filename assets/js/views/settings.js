/* ===== iThrive — Settings ===== */
(function (g) {
  const Settings = { section: 'profile' };

  const SECTIONS = [
    { id: 'profile', label: 'Profile', icon: 'contacts' },
    { id: 'account', label: 'Account', icon: 'key' },
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'messages', label: 'Messages & media', icon: 'chat' },
    { id: 'calls', label: 'Calls & meetings', icon: 'video' },
    { id: 'ai', label: 'Thrive AI', icon: 'sparkles' },
    { id: 'language', label: 'Language & region', icon: 'globe' },
    { id: 'accessibility', label: 'Accessibility', icon: 'eye' },
    { id: 'privacy', label: 'Privacy & security', icon: 'shield' },
    { id: 'devices', label: 'Devices & sessions', icon: 'desktop' },
    { id: 'integrations', label: 'Integrations', icon: 'plug' },
    { id: 'about', label: 'About', icon: 'info' }
  ];

  Settings.render = function (main, section) {
    if (section) Settings.section = section;
    main.className = 'main plain';
    main.innerHTML =
      '<div class="view-head"><div class="vh-main"><h2>' + icon('settings') + 'Settings</h2>' +
      '<div class="vh-sub">Preferences for ' + U.esc(Store.me().name) + ' at ' + U.esc(DATA.ORG.name) + '</div></div></div>' +
      '<div class="settings-wrap">' +
      '<nav class="settings-nav">' + SECTIONS.map(s =>
        '<button class="set-nav-item' + (s.id === Settings.section ? ' on' : '') + '" data-sec="' + s.id + '">' + icon(s.icon) + U.esc(s.label) + '</button>').join('') +
      (Store.isAdmin() ? '<div class="divider"></div><button class="set-nav-item" data-goadmin>' + icon('shield') + 'Admin dashboard</button>' : '') +
      '<div class="divider"></div><button class="set-nav-item danger" data-signout>' + icon('logout') + 'Sign out</button>' +
      '</nav>' +
      '<div class="settings-body scroll-y" id="set-body"></div></div>';

    const body = main.querySelector('#set-body');
    U.qsa('[data-sec]', main).forEach(b => b.onclick = function () {
      Settings.section = b.dataset.sec;
      U.qsa('[data-sec]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      window.location.hash = '#/settings/' + b.dataset.sec;
      draw();
    });
    const ga = main.querySelector('[data-goadmin]');
    if (ga) ga.onclick = () => App.route('#/admin');
    main.querySelector('[data-signout]').onclick = () => App.signOut();

    function draw() {
      const fn = RENDER[Settings.section] || RENDER.profile;
      body.innerHTML = fn();
      body.scrollTop = 0;
      UI.bindSwitches(body, onSwitch);
      bind(body);
    }

    function onSwitch(key, val) {
      const map = {
        desktop: 'desktopNotif', mobile: 'mobileNotif', email: 'emailNotif', sound: 'sound',
        enter: 'enterToSend', previews: 'showPreviews', compact: 'compactSidebar',
        aisum: 'aiSummaries', aismart: 'aiSmartNotif', aitrans: 'aiTranslate',
        receipts: 'readReceipts', anim: 'animations'
      };
      if (map[key]) { Store.setPref(map[key], val); UI.toast('Preference saved.', 'success', { duration: 1400 }); }
      if (key === 'anim') document.documentElement.classList.toggle('no-anim', !val);
      if (key === 'compact') App.renderShell();
    }

    /* ---------------- sections ---------------- */
    const RENDER = {};

    RENDER.profile = function () {
      const me = Store.me();
      return group('Your profile', 'How you appear to everyone in ' + DATA.ORG.name + '.',
        '<div class="row-start gap-5 wrap mb-5">' +
        '<div class="col center gap-2">' + UI.avatar(me, 92, { presence: false }) +
        '<button class="btn sm" data-x="photo">' + icon('camera') + 'Change photo</button></div>' +
        '<div class="grow col gap-4" style="min-width:280px">' +
        '<div class="row gap-3">' + UI.field('Full name', '<input class="input" data-f="name" value="' + U.attr(me.name) + '">', null, true) +
        UI.field('Pronouns', '<input class="input" data-f="pronouns" value="' + U.attr(me.pronouns || '') + '" placeholder="e.g. they/them">') + '</div>' +
        UI.field('Job title', '<input class="input" data-f="title" value="' + U.attr(me.title) + '">') +
        '<div class="row gap-3">' +
        UI.field('Department', '<select class="select" data-f="deptId">' + DATA.DEPARTMENTS.map(d => '<option value="' + d.id + '"' + (d.id === me.deptId ? ' selected' : '') + '>' + U.esc(d.name) + '</option>').join('') + '</select>') +
        UI.field('Team', '<select class="select" data-f="teamId"><option value="">None</option>' + DATA.TEAMS.map(t => '<option value="' + t.id + '"' + (t.id === me.teamId ? ' selected' : '') + '>' + U.esc(t.name) + '</option>').join('') + '</select>') +
        '</div>' +
        UI.field('About', '<textarea class="textarea" data-f="about" placeholder="A short introduction for your colleagues">' + U.esc(me.about || 'Product manager working on Apollo — our next-generation dispatch engine. Based in Bengaluru, usually online 09:00–18:00 IST.') + '</textarea>') +
        '<div class="row gap-3">' +
        UI.field('Email', '<input class="input" value="' + U.attr(me.email) + '" disabled>', 'Managed by your organisation') +
        UI.field('Phone', '<input class="input" data-f="phone" value="' + U.attr(me.phone) + '">') +
        '</div>' +
        '<div class="row gap-3">' +
        UI.field('Location', '<input class="input" data-f="location" value="' + U.attr(me.location) + '">') +
        UI.field('Time zone', '<input class="input" data-f="tz" value="' + U.attr(me.tz) + '">') +
        '</div>' +
        UI.field('Working hours', '<input class="input" data-f="workingHours" value="' + U.attr(me.workingHours) + '">', 'Shown to colleagues in other time zones') +
        '<div><div class="label mb-2">Skills</div><div class="chip-row" data-skills>' +
        (me.skills || []).map(s => '<span class="chip on" data-skill="' + U.attr(s) + '">' + U.esc(s) + '<span class="x">' + icon('x') + '</span></span>').join('') +
        '<button class="chip" data-addskill>' + icon('plus') + 'Add skill</button></div></div>' +
        '<div class="row gap-2"><button class="btn primary" data-x="save">Save changes</button>' +
        '<button class="btn ghost" data-x="preview">Preview my profile</button></div>' +
        '</div></div>') +
        group('Availability', 'Your current status is visible to everyone in the workspace.',
          '<div class="row gap-3 wrap">' +
          ['available', 'busy', 'meeting', 'away', 'dnd', 'offline'].map(p =>
            '<button class="pres-opt' + (Store.state.myPresence === p ? ' on' : '') + '" data-pres="' + p + '"><i class="pres-dot ' + p + '"></i>' + UI.presenceLabel(p) + '</button>').join('') +
          '</div>' +
          '<div class="mt-4">' + UI.field('Custom status', '<div class="row gap-2"><button class="btn" data-x="emoji" style="width:52px">' + (Store.state.myStatus.emoji || '😀') + '</button>' +
            '<input class="input grow" data-f="statusText" value="' + U.attr(Store.state.myStatus.text || '') + '" placeholder="What are you working on?"></div>') + '</div>' +
          '<div class="chip-row mt-3">' + AI.suggestStatus().map((s, i) => '<button class="chip" data-sug="' + i + '">' + s.emoji + ' ' + U.esc(s.text) + '</button>').join('') +
          '</div><div class="tiny subtle mt-2">' + icon('sparkles') + ' Suggested by Thrive AI from your calendar and tasks.</div>');
    };

    RENDER.account = function () {
      const me = Store.me();
      return group('Account', 'Your identity and access within ' + DATA.ORG.name + '.',
        rows([
          ['Email address', me.email, 'Managed by SSO'],
          ['Employee ID', 'NB-' + me.id.toUpperCase().replace('P', '00'), ''],
          ['Role', me.role, ''],
          ['Manager', me.managerId ? Store.person(me.managerId).name : '—', ''],
          ['Joined', U.dateLong(me.joined), ''],
          ['Workspace', DATA.ORG.name + ' · ' + DATA.ORG.plan, '']
        ])) +
        group('Password and sign-in', 'Your organisation enforces SSO with a second factor.',
          '<div class="col gap-3">' +
          settingRow('Change password', 'Last changed 74 days ago', '<button class="btn sm" data-x="pw">Change</button>') +
          settingRow('Two-factor authentication', 'Authenticator app · enforced by your organisation', '<span class="badge success">' + icon('checkCircle') + 'Enabled</span>') +
          settingRow('Backup codes', '8 of 10 codes remaining', '<button class="btn sm" data-x="codes">View codes</button>') +
          settingRow('Single sign-on', 'Okta · SAML 2.0', '<span class="badge brand">Active</span>') +
          '</div>') +
        group('Danger zone', 'These actions affect your access to the workspace.',
          '<div class="col gap-3">' +
          settingRow('Sign out everywhere', 'End all sessions on every device, including this one', '<button class="btn sm" data-x="signoutall">Sign out all</button>') +
          settingRow('Download my data', 'A copy of your messages, files and profile', '<button class="btn sm" data-x="export">Request export</button>') +
          settingRow('Leave this workspace', 'You will lose access to all channels and files', '<button class="btn sm danger-ghost" data-x="leaveorg">Leave workspace</button>') +
          '</div>');
    };

    RENDER.appearance = function () {
      const p = Store.state.prefs;
      const themes = [['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['system', 'Match system', 'desktop']];
      const accents = [['jade', 'Thrive Jade', '#0b8a6e'], ['aurora', 'Aurora Violet', '#6741e6'], ['solar', 'Solar Coral', '#ea5b23'], ['ocean', 'Deep Ocean', '#1c62d6']];
      return group('Theme', 'Choose how iThrive looks on this device.',
        '<div class="theme-grid">' + themes.map(t =>
          '<button class="theme-card' + (p.theme === t[0] ? ' on' : '') + '" data-theme="' + t[0] + '">' +
          '<span class="tc-prev ' + t[0] + '"><i></i><i></i><i></i></span>' +
          '<span class="row gap-2">' + icon(t[2]) + '<span class="semi md">' + t[1] + '</span></span></button>').join('') + '</div>') +
        group('Accent colour', 'Used for highlights, buttons and your own messages.',
          '<div class="row gap-3 wrap">' + accents.map(a =>
            '<button class="accent-opt' + (p.accent === a[0] ? ' on' : '') + '" data-accent="' + a[0] + '">' +
            '<span class="acc-dot" style="background:' + a[2] + '"></span><span class="md semi">' + a[1] + '</span></button>').join('') + '</div>') +
        group('Density and layout', 'Fit more on screen, or give things more room.',
          '<div class="col gap-3">' +
          '<div class="row between"><div><div class="semi md">Message density</div><div class="tiny muted">Affects spacing across the whole app</div></div>' +
          UI.segmented([{ value: 'compact', label: 'Compact' }, { value: 'default', label: 'Default' }, { value: 'comfortable', label: 'Comfortable' }], p.density, 'density') + '</div>' +
          UI.switchRow('Compact sidebar', 'Hide message previews in the conversation list', p.compactSidebar, 'compact') +
          UI.switchRow('Show link previews', 'Expand links posted in conversations', p.showPreviews, 'previews') +
          UI.switchRow('Interface animations', 'Turn off if you prefer reduced motion', p.animations, 'anim') +
          '</div>');
    };

    RENDER.notifications = function () {
      const p = Store.state.prefs;
      return group('Delivery', 'Where notifications reach you.',
        '<div class="col gap-1">' +
        UI.switchRow('Desktop notifications', 'Banner alerts on this computer', p.desktopNotif, 'desktop') +
        UI.switchRow('Mobile push notifications', 'On the iThrive mobile app', p.mobileNotif, 'mobile') +
        UI.switchRow('Email notifications', 'A digest when you have been away', p.emailNotif, 'email') +
        UI.switchRow('Notification sound', 'Play a sound for new messages', p.sound, 'sound') +
        '</div>' +
        '<button class="btn sm mt-3" data-x="testnotif">' + icon('bell') + 'Send a test notification</button>') +
        group('What to notify me about', 'Applies to every conversation unless you override it.',
          '<div class="col gap-3">' +
          radioRow('notifyLevel', 'all', 'All new messages', 'Every message in every channel you have joined') +
          radioRow('notifyLevel', 'smart', 'Smart (recommended)', 'Mentions, direct messages and anything Thrive AI ranks as urgent', true) +
          radioRow('notifyLevel', 'mentions', 'Mentions only', 'Only when someone mentions you directly') +
          radioRow('notifyLevel', 'none', 'Nothing', 'No notifications at all') +
          '</div>') +
        group('Do Not Disturb', 'Pause notifications on a schedule.',
          '<div class="col gap-3">' +
          UI.switchRow('Scheduled quiet hours', 'Pause notifications outside your working hours', p.notifSchedule.enabled, 'sched') +
          '<div class="row gap-3"><div class="field grow"><label>From</label><input class="input" type="time" value="' + p.notifSchedule.from + '" data-f="schedFrom"></div>' +
          '<div class="field grow"><label>To</label><input class="input" type="time" value="' + p.notifSchedule.to + '" data-f="schedTo"></div></div>' +
          '<div class="banner brand">' + icon('sparkles') + '<div class="b-body"><strong>Urgent override</strong>Thrive AI can still notify you outside quiet hours if something is genuinely urgent — a direct mention from your manager, or a P1 incident.</div></div>' +
          '<button class="btn" data-x="dnd">' + icon('moon') + 'Pause notifications now</button>' +
          '</div>') +
        group('Per-type notifications', 'Fine-grained control for each kind of activity.',
          '<div class="col gap-1">' +
          ['Direct messages', 'Mentions', 'Thread replies', 'Channel messages', 'Reactions', 'Task assignments', 'Meeting invitations', 'Missed calls', 'File shares', 'Announcements']
            .map((t, i) => UI.switchRow(t, '', i !== 4, 'type' + i)).join('') +
          '</div>');
    };

    RENDER.messages = function () {
      const p = Store.state.prefs;
      return group('Composing', 'How the message composer behaves.',
        '<div class="col gap-1">' +
        UI.switchRow('Press Enter to send', 'Off means Ctrl+Enter sends and Enter adds a new line', p.enterToSend, 'enter') +
        UI.switchRow('Show read receipts', 'Let others see when you have read their messages', p.readReceipts, 'receipts') +
        UI.switchRow('Show typing indicators', 'Let others see when you are typing', true, 'typing') +
        UI.switchRow('Suggested replies', 'Thrive AI proposes short replies you can send in one click', p.aiSummaries, 'aisum') +
        '</div>') +
        group('Media', 'Downloads and previews.',
          '<div class="col gap-1">' +
          UI.switchRow('Automatically download images', 'On this device', true, 'autoimg') +
          UI.switchRow('Automatically download videos', 'Uses more bandwidth', false, 'autovid') +
          UI.switchRow('Automatically play GIFs', '', true, 'autogif') +
          UI.switchRow('High quality image uploads', 'Uploads at full resolution', true, 'hqimg') +
          '</div>' +
          '<div class="mt-4">' + UI.field('Maximum upload size', '<select class="select"><option>25 MB</option><option>100 MB</option><option selected>250 MB (organisation limit)</option></select>') + '</div>') +
        group('Storage on this device', 'iThrive keeps recent media cached for speed.',
          '<div class="row between mb-2"><span class="md">Cached media</span><span class="semi">1.4 GB</span></div>' +
          '<div class="progress"><i style="width:34%"></i></div>' +
          '<button class="btn sm mt-3" data-x="clearcache">Clear cache</button>');
    };

    RENDER.calls = function () {
      return group('Devices', 'Defaults used when you join a call.',
        '<div class="col gap-4">' +
        UI.field('Microphone', '<select class="select"><option>MacBook Pro Microphone (built-in)</option><option>Jabra Evolve2 65</option></select>') +
        UI.field('Speaker', '<select class="select"><option>MacBook Pro Speakers</option><option>Jabra Evolve2 65</option></select>') +
        UI.field('Camera', '<select class="select"><option>FaceTime HD Camera</option><option>Logitech Brio 4K</option></select>') +
        '<button class="btn sm" data-x="devtest">' + icon('headphones') + 'Test my devices</button>' +
        '</div>') +
        group('Joining meetings', '',
          '<div class="col gap-1">' +
          UI.switchRow('Join with my microphone muted', '', true, 'joinmute') +
          UI.switchRow('Join with my camera off', '', false, 'joincam') +
          UI.switchRow('Always use background blur', '', false, 'alwaysblur') +
          UI.switchRow('Show live captions automatically', '', false, 'autocap') +
          UI.switchRow('Noise suppression', 'Filter keyboard and background noise', true, 'noise') +
          '</div>') +
        group('Recording and notes', '',
          '<div class="col gap-1">' +
          UI.switchRow('Generate AI meeting notes', 'Summary, decisions and action items after every meeting', true, 'ainotes') +
          UI.switchRow('Automatic transcription', 'Transcribe meetings you host', true, 'autotx') +
          UI.switchRow('Notify me before recording starts', '', true, 'recnotify') +
          '</div>' +
          '<div class="banner info mt-4">' + icon('info') + '<div class="b-body">Your organisation retains recordings for 90 days, then deletes them automatically.</div></div>');
    };

    RENDER.ai = function () {
      const p = Store.state.prefs;
      return group('Thrive AI', 'AI features work only on content you already have access to.',
        '<div class="col gap-1">' +
        UI.switchRow('Conversation summaries', 'Summarise long channels and threads on demand', p.aiSummaries, 'aisum') +
        UI.switchRow('Smart notification priority', 'Rank notifications by urgency instead of time', p.aiSmartNotif, 'aismart') +
        UI.switchRow('Automatic translation', 'Offer to translate messages in other languages', p.aiTranslate, 'aitrans') +
        UI.switchRow('Action item extraction', 'Detect tasks in conversations and offer to create them', true, 'aiact') +
        UI.switchRow('Meeting notes and summaries', 'Notes, decisions and follow-ups after meetings', true, 'aimeet') +
        UI.switchRow('Message drafting', 'Draft and rewrite messages in the composer', true, 'aidraft') +
        UI.switchRow('Smart status suggestions', 'Suggest a status from your calendar and tasks', true, 'aistatus') +
        UI.switchRow('Smart file search', 'Find files by describing them', true, 'aifile') +
        '</div>') +
        group('Preferred language for AI', '',
          UI.field('Language', '<select class="select" data-f="ailang">' + ['English (UK)', 'English (US)'].concat(AI.languages).map(l => '<option' + (l === p.language ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>')) +
        group('Data and privacy', 'How your content is used.',
          '<div class="banner brand">' + icon('shield') + '<div class="b-body"><strong>Your workspace content is never used for training</strong>Thrive AI processes your messages only to answer the request you made, and results are not retained beyond your session.</div></div>' +
          '<div class="col gap-1 mt-3">' +
          UI.switchRow('Allow AI to read private channels I am in', 'Turn off to limit AI to public channels only', true, 'aiprivate') +
          UI.switchRow('Allow AI to read my direct messages', '', true, 'aidm') +
          UI.switchRow('Show AI confidence levels', 'Display how certain an answer is', true, 'aiconf') +
          '</div>' +
          '<button class="btn sm mt-4" data-x="aihistory">' + icon('clock') + 'View my AI activity history</button>');
    };

    RENDER.language = function () {
      return group('Language', '',
        UI.field('Display language', '<select class="select"><option selected>English (United Kingdom)</option><option>English (United States)</option><option>Português</option><option>Español</option><option>Français</option><option>Deutsch</option><option>हिन्दी</option><option>日本語</option></select>') +
        '<div class="mt-4">' + UI.field('Spellcheck language', '<select class="select"><option selected>English (United Kingdom)</option><option>English (United States)</option></select>') + '</div>') +
        group('Region and time', '',
          '<div class="col gap-4">' +
          UI.field('Time zone', '<input class="input" value="' + U.attr(Store.me().tz) + '" data-f="tz">') +
          UI.field('Time format', UI.segmented([{ value: '12', label: '12-hour' }, { value: '24', label: '24-hour' }], '12', 'timefmt')) +
          UI.field('First day of the week', '<select class="select"><option selected>Monday</option><option>Sunday</option></select>') +
          UI.field('Date format', '<select class="select"><option selected>31 March 2026</option><option>March 31, 2026</option><option>31/03/2026</option><option>2026-03-31</option></select>') +
          '</div>') +
        group('Translation', '',
          '<div class="col gap-1">' +
          UI.switchRow('Offer to translate messages', 'When a message is not in your language', true, 'transoffer') +
          UI.switchRow('Always translate to my language', 'Translate automatically without asking', false, 'transauto') +
          '</div>');
    };

    RENDER.accessibility = function () {
      return group('Vision', '',
        '<div class="col gap-1">' +
        UI.switchRow('High contrast mode', 'Stronger borders and text contrast', false, 'contrast') +
        UI.switchRow('Reduce transparency', 'Remove blur and translucency effects', false, 'transp') +
        UI.switchRow('Underline links', 'Always show underlines, not just on hover', false, 'underline') +
        UI.switchRow('Larger text', 'Increase the base font size', false, 'bigtext') +
        '</div>') +
        group('Motion', '',
          '<div class="col gap-1">' +
          UI.switchRow('Reduce motion', 'Minimise animations and transitions', !Store.state.prefs.animations, 'reducemotion') +
          UI.switchRow('Pause animated images', 'GIFs play only when you hover them', false, 'pausegif') +
          '</div>') +
        group('Keyboard and screen readers', '',
          '<div class="col gap-1">' +
          UI.switchRow('Always show focus outlines', '', true, 'focusring') +
          UI.switchRow('Announce new messages', 'For screen reader users', true, 'announce') +
          '</div>' +
          '<button class="btn sm mt-4" data-x="shortcuts">' + icon('command') + 'View keyboard shortcuts</button>');
    };

    RENDER.privacy = function () {
      return group('Visibility', 'Who can see what about you.',
        '<div class="col gap-4">' +
        UI.field('Who can see my email address', '<select class="select"><option selected>Everyone in the workspace</option><option>My department only</option><option>Only administrators</option></select>') +
        UI.field('Who can see my phone number', '<select class="select"><option>Everyone in the workspace</option><option selected>My department only</option><option>Only administrators</option></select>') +
        UI.field('Who can send me direct messages', '<select class="select"><option selected>Anyone in the workspace</option><option>Everyone except guests</option><option>Only my department and managers</option></select>') +
        UI.field('Who can add me to channels', '<select class="select"><option selected>Anyone in the workspace</option><option>Only administrators</option></select>') +
        '</div>') +
        group('Activity', '',
          '<div class="col gap-1">' +
          UI.switchRow('Show my online status', '', true, 'showonline') +
          UI.switchRow('Show when I have read a message', '', Store.state.prefs.readReceipts, 'receipts') +
          UI.switchRow('Show my recent activity on my profile', '', true, 'showactivity') +
          UI.switchRow('Share my calendar availability', 'Colleagues can see busy/free, not details', true, 'showcal') +
          '</div>') +
        group('Security', 'Your organisation enforces these settings.',
          '<div class="col gap-3">' +
          settingRow('Two-factor authentication', 'Required for every member', '<span class="badge success">Enforced</span>') +
          settingRow('Session timeout', 'Automatic sign-out after 30 days of inactivity', '<span class="badge">30 days</span>') +
          settingRow('External file sharing', 'Sharing outside the organisation', '<span class="badge danger">Disabled</span>') +
          settingRow('Data retention', 'Messages are retained for 24 months', '<span class="badge">730 days</span>') +
          '</div>' +
          '<button class="btn sm mt-4" data-x="loginhistory">' + icon('clock') + 'View my login history</button>');
    };

    RENDER.devices = function () {
      return group('Active sessions', 'Devices currently signed in to your account.',
        '<div class="mini-list">' + Store.state.sessions.map(s =>
          '<div class="lrow">' +
          '<span class="dev-ic">' + icon(s.device.includes('iPhone') || s.device.includes('iPad') ? 'smartphone' : 'desktop') + '</span>' +
          '<div class="grow min0"><div class="semi md">' + U.esc(s.device) + (s.current ? ' <span class="badge success">This device</span>' : '') + '</div>' +
          '<div class="tiny muted">' + U.esc(s.os) + ' · ' + U.esc(s.browser) + ' · ' + U.esc(s.location) + '</div>' +
          '<div class="tiny subtle">' + U.esc(s.ip) + ' · last active ' + U.esc(U.ago(s.last)) + '</div></div>' +
          (s.current ? '' : '<button class="btn sm danger-ghost" data-revoke="' + s.id + '">Sign out</button>') +
          '</div>').join('') + '</div>' +
        '<button class="btn mt-4" data-x="signoutall">' + icon('logout') + 'Sign out of all other devices</button>') +
        group('Login history', 'The last few sign-ins on your account.',
          '<div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Device</th><th>Location</th><th>IP</th><th>Result</th></tr></thead><tbody>' +
          [[U.ago(DATA.t(1)), 'MacBook Pro 16"', 'Bengaluru, India', '49.207.11.90', 'Success'],
          [U.ago(DATA.t(600)), 'iPhone 15 Pro', 'Bengaluru, India', '49.207.11.90', 'Success'],
          [U.ago(DATA.t(2000)), 'MacBook Pro 16"', 'Bengaluru, India', '49.207.11.90', 'Success'],
          [U.ago(DATA.t(4300)), 'Unknown browser', 'Frankfurt, Germany', '203.0.113.42', 'Blocked'],
          [U.ago(DATA.t(7000)), 'iPad Air', 'Bengaluru, India', '106.51.30.4', 'Success']].map(r =>
            '<tr><td class="tiny">' + U.esc(r[0]) + '</td><td class="tiny">' + U.esc(r[1]) + '</td><td class="tiny">' + U.esc(r[2]) + '</td>' +
            '<td class="tiny mono">' + U.esc(r[3]) + '</td><td>' + (r[4] === 'Success' ? '<span class="badge success">Success</span>' : '<span class="badge danger">Blocked</span>') + '</td></tr>').join('') +
          '</tbody></table></div>');
    };

    RENDER.integrations = function () {
      const connected = Store.state.integrations.filter(i => i.connected);
      return group('Your connected apps', connected.length + ' of ' + Store.state.integrations.length + ' available integrations are connected.',
        '<div class="grid grid-auto">' + connected.map(i => intCard(i)).join('') + '</div>' +
        '<button class="btn mt-4" data-x="marketplace">' + icon('grid') + 'Browse the integration marketplace</button>') +
        group('Personal apps', 'Connect your own accounts — these are visible only to you.',
          '<div class="grid grid-auto">' + Store.state.integrations.filter(i => !i.connected).slice(0, 6).map(i => intCard(i)).join('') + '</div>');
    };
    function intCard(i) {
      return '<div class="int-card"><div class="row gap-3 mb-2">' +
        '<span class="int-ic" style="background:' + i.color + '18;color:' + i.color + '">' + icon(i.glyph) + '</span>' +
        '<div class="grow min0"><div class="semi md truncate">' + U.esc(i.name) + '</div><div class="tiny muted">' + U.esc(i.category) + '</div></div></div>' +
        '<div class="tiny muted clamp-2">' + U.esc(i.desc) + '</div>' +
        '<button class="btn sm block mt-3 ' + (i.connected ? '' : 'soft') + '" data-int="' + i.id + '">' + (i.connected ? 'Disconnect' : 'Connect') + '</button></div>';
    }

    RENDER.about = function () {
      return group('About iThrive Messaging', '',
        '<div class="row gap-4 mb-4"><div class="brand-mark lg">' + icon('thrive') + '</div>' +
        '<div><h3>iThrive Messaging</h3><div class="tiny muted">Version 3.4.1 (build 20260318) · Desktop</div>' +
        '<div class="tiny subtle mt-1">© 2026 iThrive Technologies. All rights reserved.</div></div></div>' +
        rows([
          ['Workspace', DATA.ORG.name],
          ['Plan', DATA.ORG.plan + ' · ' + DATA.ORG.seats + ' seats'],
          ['Data region', 'European Union (Frankfurt)'],
          ['Compliance', 'SOC 2 Type II · ISO 27001 · GDPR'],
          ['Support', 'support@ithrive.app']
        ])) +
        group('Resources', '',
          '<div class="grid grid-auto">' +
          [['Help centre', 'lifeBuoy'], ['Keyboard shortcuts', 'command'], ['What is new', 'gift'], ['Status page', 'activity'], ['Privacy policy', 'shield'], ['Terms of service', 'scale']]
            .map(r => '<button class="tile row gap-2" data-res="' + r[0] + '">' + icon(r[1]) + '<span class="semi md">' + r[0] + '</span></button>').join('') +
          '</div>') +
        group('Demonstration data', 'This workspace is populated with realistic fictional data for Northbeam Technologies.',
          '<div class="banner warn">' + icon('info') + '<div class="b-body"><strong>Resetting will discard your changes</strong>Every message you have sent, task you created and setting you changed in this session will be restored to the original demonstration state.</div></div>' +
          '<button class="btn danger-ghost mt-3" data-x="reset">' + icon('refresh') + 'Reset demonstration data</button>');
    };

    /* ---------------- helpers ---------------- */
    function group(title, desc, inner) {
      return '<section class="set-group"><h3>' + U.esc(title) + '</h3>' +
        (desc ? '<p class="tiny muted mb-4">' + U.esc(desc) + '</p>' : '<div class="mb-3"></div>') + inner + '</section>';
    }
    function rows(list) {
      return '<div class="col gap-3">' + list.map(r =>
        '<div class="row between gap-4"><span class="md muted">' + U.esc(r[0]) + '</span>' +
        '<span class="md semi text-right">' + U.esc(r[1]) + (r[2] ? ' <span class="tiny subtle">(' + U.esc(r[2]) + ')</span>' : '') + '</span></div>').join('') + '</div>';
    }
    function settingRow(title, desc, right) {
      return '<div class="row between gap-4 setting-row"><div class="grow"><div class="semi md">' + U.esc(title) + '</div>' +
        (desc ? '<div class="tiny muted mt-1">' + U.esc(desc) + '</div>' : '') + '</div>' + right + '</div>';
    }
    function radioRow(name, val, title, desc, on) {
      return '<label class="radio-card' + (on ? ' on' : '') + '" data-radio="' + name + ':' + val + '">' +
        '<span class="check radio' + (on ? ' on' : '') + '"></span>' +
        '<span><span class="semi md block">' + U.esc(title) + '</span><span class="tiny muted">' + U.esc(desc) + '</span></span></label>';
    }

    function bind(body) {
      UI.bindSegmented(body, function (val, name) {
        if (name === 'density') { Store.setPref('density', val); document.documentElement.dataset.density = val; UI.toast('Density updated.', 'success'); }
      });
      U.qsa('[data-radio]', body).forEach(r => r.onclick = function () {
        const [name] = r.dataset.radio.split(':');
        U.qsa('[data-radio^="' + name + '"]', body).forEach(x => { x.classList.remove('on'); x.querySelector('.check').classList.remove('on'); });
        r.classList.add('on'); r.querySelector('.check').classList.add('on');
        UI.toast('Notification level updated.', 'success', { duration: 1400 });
      });
      U.qsa('[data-theme]', body).forEach(b => b.onclick = function () {
        Store.setPref('theme', b.dataset.theme); App.applyTheme();
        U.qsa('[data-theme]', body).forEach(x => x.classList.remove('on')); b.classList.add('on');
      });
      U.qsa('[data-accent]', body).forEach(b => b.onclick = function () {
        Store.setPref('accent', b.dataset.accent); App.applyTheme();
        U.qsa('[data-accent]', body).forEach(x => x.classList.remove('on')); b.classList.add('on');
        UI.toast('Accent colour updated.', 'success', { duration: 1400 });
      });
      U.qsa('[data-pres]', body).forEach(b => b.onclick = function () {
        Store.setPresence(b.dataset.pres);
        U.qsa('[data-pres]', body).forEach(x => x.classList.remove('on')); b.classList.add('on');
        App.renderShell(); UI.toast('Status updated.', 'success', { duration: 1400 });
      });
      U.qsa('[data-sug]', body).forEach(b => b.onclick = function () {
        const s = AI.suggestStatus()[+b.dataset.sug];
        Store.setStatus(s.text, s.emoji); Store.setPresence(s.presence);
        Settings.render(main); App.renderShell(); UI.toast('Status updated.', 'success');
      });
      U.qsa('[data-skill]', body).forEach(b => b.onclick = function () {
        const me = Store.me();
        Store.updateMe({ skills: (me.skills || []).filter(s => s !== b.dataset.skill) });
        Settings.render(main);
      });
      const addSkill = body.querySelector('[data-addskill]');
      if (addSkill) addSkill.onclick = () => UI.prompt({ title: 'Add a skill', label: 'Skill', placeholder: 'e.g. Pricing strategy' })
        .then(v => { if (v) { const me = Store.me(); Store.updateMe({ skills: (me.skills || []).concat(v) }); Settings.render(main); } });
      U.qsa('[data-revoke]', body).forEach(b => b.onclick = function () {
        UI.confirm({ title: 'Sign out this device?', body: 'The session will end immediately and the device will need to sign in again.', confirmLabel: 'Sign out', danger: true })
          .then(ok => { if (ok) { Store.revokeSession(b.dataset.revoke); Settings.render(main); UI.toast('Device signed out.', 'success'); } });
      });
      U.qsa('[data-int]', body).forEach(b => b.onclick = function () {
        const i = Store.state.integrations.find(x => x.id === b.dataset.int);
        if (i.connected) {
          UI.confirm({ title: 'Disconnect ' + i.name + '?', body: 'Files and data already shared stay in place, but new activity will stop syncing.', confirmLabel: 'Disconnect', danger: true })
            .then(ok => { if (ok) { Store.toggleIntegration(i.id); Settings.render(main); UI.toast(i.name + ' disconnected.', 'success'); } });
        } else Modals.connectIntegration(i.id, () => Settings.render(main));
      });
      U.qsa('[data-res]', body).forEach(b => b.onclick = function () {
        if (b.dataset.res === 'Keyboard shortcuts') Modals.shortcuts();
        else UI.toast(b.dataset.res + ' opens in your browser.', 'info');
      });
      U.qsa('[data-f]', body).forEach(f => f.addEventListener('change', () => { /* saved on Save */ }));

      U.qsa('[data-x]', body).forEach(b => b.onclick = function () {
        const x = b.dataset.x;
        if (x === 'save') {
          const patch = {};
          U.qsa('[data-f]', body).forEach(f => { if (f.dataset.f !== 'statusText') patch[f.dataset.f] = f.value; });
          Store.updateMe(patch);
          if (patch.statusText != null) Store.setStatus(patch.statusText, Store.state.myStatus.emoji);
          App.renderShell(); UI.toast('Profile saved.', 'success');
        }
        if (x === 'preview') Modals.personProfile(Store.state.meId);
        if (x === 'photo') Modals.changePhoto();
        if (x === 'emoji') Modals.pickEmoji(e => { Store.setStatus(Store.state.myStatus.text, e); Settings.render(main); App.renderShell(); });
        if (x === 'pw') Modals.changePassword();
        if (x === 'codes') Modals.backupCodes();
        if (x === 'signoutall') UI.confirm({ title: 'Sign out everywhere?', body: 'All sessions on all devices will end, including this one. You will need to sign in again.', danger: true, confirmLabel: 'Sign out everywhere' })
          .then(ok => { if (ok) App.signOut(); });
        if (x === 'export') UI.toast('Data export requested. You will receive an email when it is ready.', 'success');
        if (x === 'leaveorg') UI.confirm({ title: 'Leave ' + DATA.ORG.name + '?', body: 'You will lose access to every channel, file and conversation in this workspace. An administrator would need to invite you again.', danger: true, confirmLabel: 'Leave workspace' })
          .then(ok => { if (ok) App.signOut(); });
        if (x === 'testnotif') { UI.toast('Test notification — this is how alerts will appear.', 'info'); Store.pushNotification({ type: 'message', actorId: 'p10', target: { kind: 'dm', id: 'd-p10' }, text: 'sent a test notification', preview: 'This is what a notification looks like.' }); App.renderShell(); }
        if (x === 'dnd') Modals.dnd();
        if (x === 'clearcache') UI.confirm({ title: 'Clear cached media?', body: 'Images and videos will be downloaded again the next time you view them.', confirmLabel: 'Clear cache' })
          .then(ok => { if (ok) UI.toast('1.4 GB of cached media cleared.', 'success'); });
        if (x === 'devtest') Modals.deviceSettings();
        if (x === 'shortcuts') Modals.shortcuts();
        if (x === 'aihistory') Modals.aiHistory();
        if (x === 'loginhistory') { Settings.section = 'devices'; Settings.render(main); }
        if (x === 'marketplace') App.route('#/admin/integrations');
        if (x === 'reset') UI.confirm({ title: 'Reset demonstration data?', body: 'Everything you have changed in this session will be restored to the original state. This cannot be undone.', danger: true, confirmLabel: 'Reset everything' })
          .then(function (ok) { if (ok) { Store.reset(); UI.toast('Demonstration data restored.', 'success'); App.renderShell(); } });
      });
    }

    draw();
  };

  g.SettingsView = Settings;
})(window);
