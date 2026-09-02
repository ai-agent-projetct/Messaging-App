/* ===== iThrive — Authentication, organisation join & onboarding ===== */
(function (g) {
  const Auth = { screen: 'welcome', ctx: {} };
  const root = () => document.getElementById('auth-root');

  const FEATURES = [
    { icon: 'chats', t: 'Conversations that keep context', d: 'Messages, threads, files and decisions stay together — and stay searchable.' },
    { icon: 'video', t: 'Meetings built for hybrid teams', d: 'Lobby, breakout rooms, live captions, recording and AI notes as standard.' },
    { icon: 'sparkles', t: 'Thrive AI across the workspace', d: 'Summaries, action items, smart search and drafting, grounded in your own content.' },
    { icon: 'shield', t: 'Enterprise-grade by default', d: 'SSO, SCIM, audit logs, data residency and retention controls.' }
  ];

  function brandPane() {
    return '<aside class="auth-brand">' +
      '<div class="ab-logo"><div class="brand-mark">' + icon('thrive') + '</div>' +
      '<div class="brand-word">iThrive<span>Messaging</span></div></div>' +
      '<div class="ab-mid">' +
      '<h1>The workspace where your company actually gets things done.</h1>' +
      '<p>Messaging, meetings, files, tasks and announcements in one calm, fast, enterprise-ready product.</p>' +
      '<div class="ab-feats">' + FEATURES.map(f =>
        '<div class="ab-feat"><div class="f-ic">' + icon(f.icon) + '</div><div><div class="f-t">' + f.t + '</div><div class="f-d">' + f.d + '</div></div></div>'
      ).join('') + '</div>' +
      '<div class="ab-stats">' +
      '<div class="ab-stat"><b>99.98%</b><span>Uptime last 12 months</span></div>' +
      '<div class="ab-stat"><b>SOC 2</b><span>Type II certified</span></div>' +
      '<div class="ab-stat"><b>18k+</b><span>Teams onboard</span></div>' +
      '</div></div>' +
      '<div class="ab-foot"><span>© 2026 iThrive Technologies</span><span>Privacy · Terms · Status</span></div>' +
      '</aside>';
  }

  function shell(inner, opts) {
    opts = opts || {};
    return brandPane() +
      '<main class="auth-pane"><div class="auth-topbar">' +
      '<div class="a-mini"><div class="brand-mark">' + icon('thrive') + '</div><div class="brand-word" style="color:var(--text)">iThrive<span style="color:var(--brand-text)">Messaging</span></div></div>' +
      '<div style="flex:1"></div>' +
      '<button class="icon-btn" data-theme-toggle data-tip="Toggle theme">' + icon('moon') + '</button>' +
      (opts.help === false ? '' : '<button class="btn ghost sm" data-help>' + icon('helpCircle') + 'Need help?</button>') +
      '</div><div class="auth-body">' + inner + '</div></main>';
  }

  Auth.go = function (screen, ctx) {
    Auth.screen = screen;
    Auth.ctx = Object.assign({}, Auth.ctx, ctx || {});
    Auth.render();
  };

  Auth.start = function () {
    root().hidden = false;
    document.getElementById('app-root').hidden = true;
    Auth.render();
  };

  Auth.render = function () {
    const fn = SCREENS[Auth.screen] || SCREENS.welcome;
    root().innerHTML = shell(fn.html());
    bindCommon();
    fn.bind && fn.bind();
  };

  function bindCommon() {
    const tt = root().querySelector('[data-theme-toggle]');
    if (tt) tt.onclick = () => App.toggleTheme();
    const help = root().querySelector('[data-help]');
    if (help) help.onclick = () => UI.modal({
      icon: 'lifeBuoy', title: 'Getting into your workspace', size: 'sm',
      body: '<div class="col gap-3 md">' +
        '<div><strong>Demo access</strong><div class="muted">Any email and password combination signs you in as Aarav Menon at Northbeam Technologies. The OTP and 2FA codes accept any 6 digits.</div></div>' +
        '<div><strong>Forgotten password</strong><div class="muted">Use the reset link on the password screen — it walks through the full recovery flow.</div></div>' +
        '<div><strong>Locked out entirely</strong><div class="muted">Contact your workspace administrator, or use account recovery from the login screen.</div></div>' +
        '</div>',
      actions: [{ label: 'Got it', variant: 'primary' }]
    });
    root().querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = (e) => { e.preventDefault(); Auth.go(b.dataset.go); };
    });
  }

  function submitBtn(label, id) {
    return '<button class="btn primary lg block" data-submit="' + (id || '') + '">' + label + '</button>';
  }
  function busy(btn, ms, cb) {
    btn.classList.add('loading');
    setTimeout(function () { btn.classList.remove('loading'); cb(); }, ms || 720);
  }

  /* ------------------------------------------------------------------ */
  const SCREENS = {};

  /* --- Welcome --- */
  SCREENS.welcome = {
    html: () => '<div class="auth-card">' +
      '<h2>Welcome to iThrive Messaging</h2>' +
      '<p class="a-sub">Sign in to your organisation, or create a new workspace for your company.</p>' +
      '<div class="auth-form">' +
      '<button class="btn primary lg block" data-go="login">' + icon('arrowRight') + 'Sign in to your workspace</button>' +
      '<button class="btn lg block" data-go="join">' + icon('building') + 'Join an organisation with an invite</button>' +
      '<button class="btn ghost lg block" data-go="createOrg">' + icon('plus') + 'Create a new organisation</button>' +
      '</div>' +
      '<div class="auth-alt">or continue with</div>' +
      ssoGrid() +
      '<div class="auth-legal">By continuing you agree to the iThrive Terms of Service and acknowledge the Privacy Policy. This is a demonstration environment populated with fictional company data.</div>' +
      '</div>',
    bind: bindSSO
  };

  function ssoGrid() {
    return '<div class="sso-grid">' +
      '<button class="sso-btn" data-sso="Google"><span class="g-mark" style="background:#e5484d">G</span>Google</button>' +
      '<button class="sso-btn" data-sso="Microsoft"><span class="g-mark" style="background:#2e7cf6">M</span>Microsoft</button>' +
      '<button class="sso-btn" data-sso="Okta SSO"><span class="g-mark" style="background:#12a583">O</span>Okta SSO</button>' +
      '<button class="sso-btn" data-sso="SAML SSO">' + icon('key') + 'SAML SSO</button>' +
      '</div>';
  }
  function bindSSO() {
    root().querySelectorAll('[data-sso]').forEach(function (b) {
      b.onclick = function () {
        const provider = b.dataset.sso;
        const close = UI.toast('Redirecting to ' + provider + '…', 'info', { duration: 1400 });
        busy(b, 900, function () {
          if (provider.includes('SSO')) Auth.go('sso', { provider: provider });
          else Auth.go('twofa', { provider: provider, email: 'aarav.menon@northbeam.io' });
        });
      };
    });
  }

  /* --- Login (email / phone) --- */
  SCREENS.login = {
    html: function () {
      const mode = Auth.ctx.loginMode || 'email';
      return '<div class="auth-card">' +
        '<a class="auth-back" data-go="welcome">' + icon('arrowLeft') + 'Back</a>' +
        '<h2>Sign in</h2>' +
        '<p class="a-sub">Use your work email or phone number. Your workspace will be detected automatically.</p>' +
        '<div class="auth-form">' +
        '<div class="auth-tabs" data-lmode>' +
        '<button data-m="email" class="' + (mode === 'email' ? 'on' : '') + '">' + icon('atSign') + 'Email</button>' +
        '<button data-m="phone" class="' + (mode === 'phone' ? 'on' : '') + '">' + icon('smartphone') + 'Phone</button>' +
        '</div>' +
        (mode === 'email'
          ? UI.field('Work email', '<div class="input-wrap">' + icon('atSign') + '<input class="input lg" id="a-email" type="email" placeholder="you@company.com" value="aarav.menon@northbeam.io" data-autofocus></div>', 'We support Google Workspace, Microsoft 365 and custom domains.')
          : UI.field('Phone number', '<div class="row gap-2"><select class="select" style="width:112px"><option>+351</option><option selected>+91</option><option>+44</option><option>+1</option></select><input class="input lg grow" id="a-phone" type="tel" placeholder="98765 43210" value="98765 43210" data-autofocus></div>', 'We will send a one-time code by SMS.')) +
        '<div class="row between"><label class="check-row"><span class="check on">' + icon('check') + '</span><span class="md">Keep me signed in</span></label>' +
        '<a class="link md" data-go="recover">Trouble signing in?</a></div>' +
        submitBtn('Continue') +
        '</div>' +
        '<div class="auth-alt">or continue with</div>' + ssoGrid() +
        '<div class="auth-foot">New to iThrive? <a class="link" data-go="signup">Create an account</a></div>' +
        '</div>';
    },
    bind: function () {
      bindSSO();
      root().querySelectorAll('[data-lmode] button').forEach(b => b.onclick = () => Auth.go('login', { loginMode: b.dataset.m }));
      const btn = root().querySelector('[data-submit]');
      const input = root().querySelector('#a-email, #a-phone');
      function go() {
        const v = (input.value || '').trim();
        if (!v) { input.classList.add('err'); UI.toast('Enter your email or phone number to continue.', 'error'); return; }
        if (input.id === 'a-email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { input.classList.add('err'); UI.toast('That email address does not look right.', 'error'); return; }
        busy(btn, 800, function () {
          if (input.id === 'a-phone') Auth.go('otp', { channel: 'phone', dest: v });
          else Auth.go('password', { email: v });
        });
      }
      btn.onclick = go;
      input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      input.addEventListener('input', () => input.classList.remove('err'));
    }
  };

  /* --- Password --- */
  SCREENS.password = {
    html: function () {
      const email = Auth.ctx.email || 'aarav.menon@northbeam.io';
      return '<div class="auth-card">' +
        '<a class="auth-back" data-go="login">' + icon('arrowLeft') + 'Use a different account</a>' +
        '<h2>Enter your password</h2>' +
        '<div class="row gap-2 mt-3" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface-2)">' +
        UI.avatar('p1', 30) + '<div class="grow min0"><div class="semi md truncate">Aarav Menon</div><div class="tiny muted truncate">' + U.esc(email) + '</div></div>' +
        '<span class="badge brand">Northbeam</span></div>' +
        '<div class="auth-form">' +
        UI.field('Password', '<div class="input-wrap">' + icon('lock') + '<input class="input lg" id="a-pw" type="password" placeholder="Your password" value="demo-password" data-autofocus>' +
          '<button class="icon-btn suffix" data-eye>' + icon('eye') + '</button></div>') +
        '<div class="row between"><label class="check-row"><span class="check">' + icon('check') + '</span><span class="md">Trust this device for 30 days</span></label>' +
        '<a class="link md" data-go="forgot">Forgot password?</a></div>' +
        submitBtn('Sign in') +
        '</div>' +
        '<div class="banner info mt-6">' + icon('shield') + '<div class="b-body"><strong>Two-factor authentication is enforced</strong>Your organisation requires a second factor on every new device.</div></div>' +
        '</div>';
    },
    bind: function () {
      const pw = root().querySelector('#a-pw');
      const eye = root().querySelector('[data-eye]');
      eye.onclick = () => { const s = pw.type === 'password'; pw.type = s ? 'text' : 'password'; eye.innerHTML = icon(s ? 'eyeOff' : 'eye'); };
      const btn = root().querySelector('[data-submit]');
      function go() {
        if (!pw.value) { pw.classList.add('err'); UI.toast('Enter your password.', 'error'); return; }
        busy(btn, 900, () => Auth.go('twofa', {}));
      }
      btn.onclick = go;
      pw.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    }
  };

  /* --- OTP / email verification --- */
  function otpScreen(cfg) {
    return {
      html: function () {
        return '<div class="auth-card">' +
          '<a class="auth-back" data-go="' + cfg.back + '">' + icon('arrowLeft') + 'Back</a>' +
          '<h2>' + cfg.title + '</h2>' +
          '<p class="a-sub">' + cfg.sub() + '</p>' +
          '<div class="auth-form">' +
          '<div class="otp-row" data-otp>' + [0,1,2,3,4,5].map(i => '<input inputmode="numeric" maxlength="1" aria-label="Digit ' + (i+1) + '"' + (i === 0 ? ' data-autofocus' : '') + '>').join('') + '</div>' +
          '<div class="otp-hint"><span data-timer>Code expires in 4:59</span><button class="link" data-resend>Resend code</button></div>' +
          submitBtn(cfg.cta) +
          '</div>' +
          (cfg.note ? '<div class="banner brand mt-6">' + icon('info') + '<div class="b-body">' + cfg.note + '</div></div>' : '') +
          '</div>';
      },
      bind: function () {
        const inputs = Array.from(root().querySelectorAll('[data-otp] input'));
        const btn = root().querySelector('[data-submit]');
        inputs.forEach(function (inp, i) {
          inp.addEventListener('input', function () {
            inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
            inp.classList.toggle('filled', !!inp.value);
            if (inp.value && i < 5) inputs[i + 1].focus();
            if (inputs.every(x => x.value)) setTimeout(go, 180);
          });
          inp.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
            if (e.key === 'ArrowLeft' && i > 0) inputs[i - 1].focus();
            if (e.key === 'ArrowRight' && i < 5) inputs[i + 1].focus();
          });
          inp.addEventListener('paste', function (e) {
            e.preventDefault();
            const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6).split('');
            d.forEach((c, j) => { if (inputs[j]) { inputs[j].value = c; inputs[j].classList.add('filled'); } });
            if (d.length === 6) setTimeout(go, 180);
          });
        });
        function go() {
          const code = inputs.map(x => x.value).join('');
          if (code.length < 6) { UI.toast('Enter all six digits.', 'error'); inputs.find(x => !x.value).focus(); return; }
          busy(btn, 900, cfg.next);
        }
        btn.onclick = go;
        let left = 299;
        const timer = root().querySelector('[data-timer]');
        const iv = setInterval(function () {
          if (!document.body.contains(timer)) { clearInterval(iv); return; }
          left--; timer.textContent = left > 0 ? ('Code expires in ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0')) : 'Code expired';
          if (left <= 0) clearInterval(iv);
        }, 1000);
        root().querySelector('[data-resend]').onclick = function () {
          UI.toast('A new code has been sent.', 'success'); left = 299;
          inputs.forEach(x => { x.value = ''; x.classList.remove('filled'); }); inputs[0].focus();
        };
      }
    };
  }

  SCREENS.otp = otpScreen({
    title: 'Verify your phone', back: 'login',
    sub: () => 'We sent a six-digit code to ' + U.esc(Auth.ctx.dest || 'your phone') + '. It expires in five minutes.',
    cta: 'Verify and continue', note: 'In this demonstration any six digits will be accepted.',
    next: () => Auth.go('twofa', {})
  });

  SCREENS.verifyEmail = otpScreen({
    title: 'Verify your email', back: 'signup',
    sub: () => 'We sent a verification code to ' + U.esc(Auth.ctx.email || 'your inbox') + '. Enter it below to activate your account.',
    cta: 'Verify email', note: 'Check your spam folder if it has not arrived within two minutes.',
    next: () => Auth.go('join', {})
  });

  SCREENS.twofa = {
    html: function () {
      const method = Auth.ctx.tfaMethod || 'app';
      return '<div class="auth-card">' +
        '<a class="auth-back" data-go="login">' + icon('arrowLeft') + 'Back to sign in</a>' +
        '<h2>Two-factor authentication</h2>' +
        '<p class="a-sub">' + (method === 'app' ? 'Open your authenticator app and enter the current six-digit code for iThrive.' : 'We sent a six-digit code to the phone ending in ••31.') + '</p>' +
        '<div class="auth-form">' +
        '<div class="otp-row" data-otp>' + [0,1,2,3,4,5].map(i => '<input inputmode="numeric" maxlength="1" aria-label="Digit ' + (i+1) + '"' + (i === 0 ? ' data-autofocus' : '') + '>').join('') + '</div>' +
        '<label class="check-row"><span class="check on">' + icon('check') + '</span><span class="md">Do not ask again on this device for 30 days</span></label>' +
        submitBtn('Verify and sign in') +
        '<div class="row gap-2 center wrap">' +
        '<button class="btn ghost sm" data-alt="app">' + icon('smartphone') + 'Authenticator app</button>' +
        '<button class="btn ghost sm" data-alt="sms">' + icon('inbox') + 'Text message</button>' +
        '<button class="btn ghost sm" data-alt="backup">' + icon('key') + 'Backup code</button>' +
        '</div></div>' +
        '<div class="auth-legal">Lost access to your second factor? <a class="link" data-go="recover">Recover your account</a></div>' +
        '</div>';
    },
    bind: function () {
      const inputs = Array.from(root().querySelectorAll('[data-otp] input'));
      const btn = root().querySelector('[data-submit]');
      inputs.forEach(function (inp, i) {
        inp.addEventListener('input', function () {
          inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
          inp.classList.toggle('filled', !!inp.value);
          if (inp.value && i < 5) inputs[i + 1].focus();
          if (inputs.every(x => x.value)) setTimeout(go, 150);
        });
        inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus(); });
      });
      function go() {
        if (inputs.some(x => !x.value)) { UI.toast('Enter all six digits.', 'error'); return; }
        busy(btn, 1000, function () {
          UI.toast('Welcome back, Aarav.', 'success');
          App.signIn();
        });
      }
      btn.onclick = go;
      root().querySelectorAll('[data-alt]').forEach(b => b.onclick = () => {
        if (b.dataset.alt === 'backup') {
          UI.prompt({ title: 'Use a backup code', label: 'Backup code', placeholder: 'xxxx-xxxx-xxxx', icon: 'key', confirmLabel: 'Verify' })
            .then(v => { if (v) { UI.toast('Backup code accepted.', 'success'); App.signIn(); } });
        } else Auth.go('twofa', { tfaMethod: b.dataset.alt });
      });
    }
  };

  /* --- SSO --- */
  SCREENS.sso = {
    html: () => '<div class="auth-card">' +
      '<a class="auth-back" data-go="login">' + icon('arrowLeft') + 'Back</a>' +
      '<h2>Single sign-on</h2>' +
      '<p class="a-sub">Enter your organisation domain and we will route you to your identity provider.</p>' +
      '<div class="auth-form">' +
      UI.field('Organisation domain', '<div class="input-wrap">' + icon('globe') + '<input class="input lg" id="a-domain" value="northbeam.io" data-autofocus></div>', 'For example: acme.com') +
      submitBtn('Continue to ' + U.esc(Auth.ctx.provider || 'your provider')) +
      '</div>' +
      '<div class="card pad mt-6"><div class="row gap-3">' +
      '<div class="mh-icon" style="width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-text)">' + icon('shield') + '</div>' +
      '<div><div class="semi md">Northbeam Technologies uses Okta</div><div class="tiny muted mt-1">SAML 2.0 · SCIM provisioning enabled · Enforced for all members</div></div></div></div>' +
      '</div>',
    bind: function () {
      const btn = root().querySelector('[data-submit]');
      btn.onclick = () => busy(btn, 1200, function () {
        UI.toast('Authenticated with Okta.', 'success');
        App.signIn();
      });
    }
  };

  /* --- Forgot / reset --- */
  SCREENS.forgot = {
    html: () => '<div class="auth-card">' +
      '<a class="auth-back" data-go="password">' + icon('arrowLeft') + 'Back</a>' +
      '<h2>Reset your password</h2>' +
      '<p class="a-sub">Enter the email on your account and we will send a secure reset link, valid for 30 minutes.</p>' +
      '<div class="auth-form">' +
      UI.field('Work email', '<div class="input-wrap">' + icon('atSign') + '<input class="input lg" id="a-remail" type="email" value="aarav.menon@northbeam.io" data-autofocus></div>') +
      submitBtn('Send reset link') +
      '<button class="btn ghost block" data-go="recover">Try another way to recover</button>' +
      '</div></div>',
    bind: function () {
      const btn = root().querySelector('[data-submit]');
      btn.onclick = () => busy(btn, 900, () => Auth.go('sent', {}));
    }
  };

  SCREENS.sent = {
    html: () => '<div class="auth-card text-center">' +
      '<div class="e-art" style="margin:0 auto 18px;width:76px;height:76px;border-radius:24px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-text)">' + icon('inbox') + '</div>' +
      '<h2>Check your inbox</h2>' +
      '<p class="a-sub">We sent a password reset link to <strong>aarav.menon@northbeam.io</strong>. The link is valid for 30 minutes and can be used once.</p>' +
      '<div class="auth-form">' +
      '<button class="btn primary lg block" data-go="reset">Open the reset link (demo)</button>' +
      '<button class="btn ghost block" data-resend>Resend email</button>' +
      '<button class="btn ghost block" data-go="login">Back to sign in</button>' +
      '</div></div>',
    bind: function () {
      root().querySelector('[data-resend]').onclick = () => UI.toast('Reset email sent again.', 'success');
    }
  };

  SCREENS.reset = {
    html: () => '<div class="auth-card">' +
      '<h2>Choose a new password</h2>' +
      '<p class="a-sub">Your organisation requires at least 14 characters, including a number and a symbol.</p>' +
      '<div class="auth-form">' +
      UI.field('New password', '<div class="input-wrap">' + icon('lock') + '<input class="input lg" id="a-np" type="password" placeholder="New password" data-autofocus><button class="icon-btn suffix" data-eye>' + icon('eye') + '</button></div>' +
        '<div class="pw-meter"><i></i><i></i><i></i><i></i></div>' +
        '<div class="pw-rules">' +
        '<span class="pw-rule" data-rule="len">' + icon('x') + '14+ characters</span>' +
        '<span class="pw-rule" data-rule="num">' + icon('x') + 'A number</span>' +
        '<span class="pw-rule" data-rule="sym">' + icon('x') + 'A symbol</span>' +
        '<span class="pw-rule" data-rule="case">' + icon('x') + 'Upper and lower case</span>' +
        '</div>') +
      UI.field('Confirm password', '<div class="input-wrap">' + icon('lock') + '<input class="input lg" id="a-np2" type="password" placeholder="Repeat password"></div>') +
      submitBtn('Update password and sign in') +
      '</div></div>',
    bind: function () {
      const np = root().querySelector('#a-np'), np2 = root().querySelector('#a-np2');
      const meter = root().querySelectorAll('.pw-meter i');
      const eye = root().querySelector('[data-eye]');
      eye.onclick = () => { const s = np.type === 'password'; np.type = s ? 'text' : 'password'; eye.innerHTML = icon(s ? 'eyeOff' : 'eye'); };
      function rules(v) {
        return { len: v.length >= 14, num: /\d/.test(v), sym: /[^A-Za-z0-9]/.test(v), case: /[a-z]/.test(v) && /[A-Z]/.test(v) };
      }
      np.addEventListener('input', function () {
        const r = rules(np.value);
        const score = Object.values(r).filter(Boolean).length;
        meter.forEach((m, i) => { m.className = i < score ? 'on-' + score : ''; });
        Object.keys(r).forEach(function (k) {
          const el = root().querySelector('[data-rule="' + k + '"]');
          el.classList.toggle('ok', r[k]);
          el.innerHTML = icon(r[k] ? 'check' : 'x') + el.textContent;
        });
      });
      const btn = root().querySelector('[data-submit]');
      btn.onclick = function () {
        const r = rules(np.value);
        if (Object.values(r).filter(Boolean).length < 4) { UI.toast('Your password does not meet the policy yet.', 'error'); np.focus(); return; }
        if (np.value !== np2.value) { np2.classList.add('err'); UI.toast('The two passwords do not match.', 'error'); return; }
        busy(btn, 900, function () { UI.toast('Password updated.', 'success'); App.signIn(); });
      };
    }
  };

  SCREENS.recover = {
    html: () => '<div class="auth-card">' +
      '<a class="auth-back" data-go="login">' + icon('arrowLeft') + 'Back to sign in</a>' +
      '<h2>Account recovery</h2>' +
      '<p class="a-sub">Choose how you would like to recover access. Your administrator can always verify you directly.</p>' +
      '<div class="org-list">' +
      recoverCard('inbox', 'Email a recovery link', 'Sent to aarav.menon@northbeam.io', 'forgot') +
      recoverCard('smartphone', 'Text a code to my phone', 'Sent to the number ending ••31', 'otp') +
      recoverCard('key', 'Use a backup code', 'Ten single-use codes were issued at setup', 'twofa') +
      recoverCard('users', 'Ask an administrator', 'Hassan Yildiz, Head of IT & Security, will verify you', 'admincontact') +
      '</div></div>',
    bind: function () {
      root().querySelectorAll('[data-rec]').forEach(function (c) {
        c.onclick = function () {
          if (c.dataset.rec === 'admincontact') {
            UI.modal({ icon: 'shield', title: 'Request administrator verification', size: 'sm',
              body: '<p class="md muted">A verification request will be sent to Hassan Yildiz (Head of IT & Security). You will be contacted on your registered phone within one business hour.</p>',
              actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Send request', variant: 'primary', onClick: () => UI.toast('Verification request sent to your administrator.', 'success') }] });
          } else Auth.go(c.dataset.rec, {});
        };
      });
    }
  };
  function recoverCard(ic, title, sub, go) {
    return '<button class="org-card" data-rec="' + go + '"><span class="oc-logo" style="background:var(--brand-soft);color:var(--brand-text)">' + icon(ic) + '</span>' +
      '<span class="grow"><span class="oc-name" style="display:block">' + title + '</span><span class="oc-meta">' + sub + '</span></span>' + icon('chevronRight') + '</button>';
  }

  /* --- Sign up --- */
  SCREENS.signup = {
    html: () => '<div class="auth-card">' +
      '<a class="auth-back" data-go="welcome">' + icon('arrowLeft') + 'Back</a>' +
      '<h2>Create your account</h2>' +
      '<p class="a-sub">Use your work email so we can connect you to the right organisation.</p>' +
      '<div class="auth-form">' +
      '<div class="row gap-3">' +
      UI.field('First name', '<input class="input lg" id="s-first" value="Aarav" data-autofocus>') +
      UI.field('Last name', '<input class="input lg" id="s-last" value="Menon">') +
      '</div>' +
      UI.field('Work email', '<div class="input-wrap">' + icon('atSign') + '<input class="input lg" id="s-email" type="email" value="aarav.menon@northbeam.io"></div>', 'We detected an existing organisation for northbeam.io') +
      UI.field('Password', '<div class="input-wrap">' + icon('lock') + '<input class="input lg" id="s-pw" type="password" placeholder="At least 14 characters"></div>') +
      '<label class="check-row"><span class="check on">' + icon('check') + '</span><span class="md">I agree to the Terms of Service and Privacy Policy</span></label>' +
      submitBtn('Create account') +
      '</div>' +
      '<div class="auth-alt">or sign up with</div>' + ssoGrid() +
      '<div class="auth-foot">Already have an account? <a class="link" data-go="login">Sign in</a></div>' +
      '</div>',
    bind: function () {
      bindSSO();
      const btn = root().querySelector('[data-submit]');
      btn.onclick = function () {
        const em = root().querySelector('#s-email').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { UI.toast('Enter a valid work email address.', 'error'); return; }
        busy(btn, 900, () => Auth.go('verifyEmail', { email: em }));
      };
    }
  };

  /* --- Join organisation --- */
  SCREENS.join = {
    html: () => '<div class="auth-card">' +
      '<a class="auth-back" data-go="welcome">' + icon('arrowLeft') + 'Back</a>' +
      '<h2>Join your organisation</h2>' +
      '<p class="a-sub">These workspaces match your email domain, or have invited you directly.</p>' +
      '<div class="org-list">' +
      orgCard('Northbeam Technologies', 'NB', 'linear-gradient(135deg,#12a583,#0b6e59)', '486 members · Your domain matches', 'nb', true) +
      orgCard('Helio Design Studio', 'HD', 'linear-gradient(135deg,#7c5cff,#5330c0)', 'Invited by Claire Dubois · Guest access', 'helio', false) +
      orgCard('Meridian Partners', 'MP', 'linear-gradient(135deg,#ff7a45,#c2451a)', 'Invited by Ryan Novak · External collaborator', 'meridian', false) +
      '</div>' +
      '<div class="auth-alt">or</div>' +
      UI.field('Have an invitation code?', '<div class="row gap-2"><input class="input lg grow" id="j-code" placeholder="e.g. NB-4K92-XZ71"><button class="btn lg" data-code>Join</button></div>') +
      '<div class="auth-foot">Setting up a new company? <a class="link" data-go="createOrg">Create an organisation</a></div>' +
      '</div>',
    bind: function () {
      root().querySelectorAll('[data-org]').forEach(function (c) {
        c.onclick = function () {
          if (c.dataset.org === 'nb') { UI.toast('Joining Northbeam Technologies…', 'info'); setTimeout(() => App.signIn(true), 700); }
          else Auth.go('invitation', { org: c.dataset.org });
        };
      });
      root().querySelector('[data-code]').onclick = function () {
        const v = root().querySelector('#j-code').value.trim();
        if (!v) { UI.toast('Enter your invitation code.', 'error'); return; }
        UI.toast('Invitation code accepted.', 'success');
        setTimeout(() => App.signIn(true), 600);
      };
    }
  };
  function orgCard(name, short, grad, meta, id, primary) {
    return '<button class="org-card" data-org="' + id + '">' +
      '<span class="oc-logo" style="background:' + grad + '">' + short + '</span>' +
      '<span class="grow"><span class="oc-name" style="display:block">' + name + '</span><span class="oc-meta">' + meta + '</span></span>' +
      (primary ? '<span class="badge brand">Recommended</span>' : '') + icon('chevronRight') + '</button>';
  }

  SCREENS.invitation = {
    html: function () {
      const isHelio = Auth.ctx.org === 'helio';
      return '<div class="auth-card">' +
        '<a class="auth-back" data-go="join">' + icon('arrowLeft') + 'Back</a>' +
        '<div class="card pad">' +
        '<div class="row gap-3 mb-4">' +
        '<span class="oc-logo" style="width:48px;height:48px;border-radius:14px;display:grid;place-items:center;color:#fff;font-weight:800;background:' + (isHelio ? 'linear-gradient(135deg,#7c5cff,#5330c0)' : 'linear-gradient(135deg,#ff7a45,#c2451a)') + '">' + (isHelio ? 'HD' : 'MP') + '</span>' +
        '<div><h3 style="font-size:var(--fs-lg)">' + (isHelio ? 'Helio Design Studio' : 'Meridian Partners') + '</h3>' +
        '<div class="tiny muted">' + (isHelio ? '24 members · Business plan' : '61 members · Business plan') + '</div></div></div>' +
        '<div class="divider"></div>' +
        '<div class="col gap-3 md">' +
        row('Invited by', isHelio ? 'Claire Dubois — Design Partner' : 'Ryan Novak — Solutions Consultant') +
        row('Your role', isHelio ? 'Guest' : 'External Collaborator') +
        row('Access expires', isHelio ? '31 March 2026' : 'No expiry') +
        row('Channels you will join', isHelio ? '#brand-projects, #northbeam-collab' : '#migration-2026') +
        '</div>' +
        '<div class="banner warn mt-4">' + icon('info') + '<div class="b-body"><strong>Limited access</strong>Guests can only see the channels they are invited to. They cannot browse the directory or create channels.</div></div>' +
        '</div>' +
        '<div class="auth-form">' +
        '<button class="btn primary lg block" data-accept>Accept invitation</button>' +
        '<button class="btn ghost block" data-go="join">Decline</button>' +
        '</div></div>';
    },
    bind: function () {
      root().querySelector('[data-accept]').onclick = function () {
        UI.toast('Invitation accepted. Opening your workspace…', 'success');
        setTimeout(() => App.signIn(true), 700);
      };
    }
  };
  function row(k, v) {
    return '<div class="row between gap-4"><span class="muted">' + k + '</span><span class="semi text-right">' + v + '</span></div>';
  }

  /* --- Create organisation --- */
  SCREENS.createOrg = {
    html: () => '<div class="auth-card">' +
      '<a class="auth-back" data-go="welcome">' + icon('arrowLeft') + 'Back</a>' +
      '<h2>Create your organisation</h2>' +
      '<p class="a-sub">This becomes your company workspace. You can invite everyone else in a moment.</p>' +
      '<div class="auth-form">' +
      UI.field('Organisation name', '<input class="input lg" id="o-name" placeholder="Acme Logistics" data-autofocus>', null, true) +
      UI.field('Workspace URL', '<div class="row gap-0"><input class="input lg grow" id="o-slug" placeholder="acme" style="border-radius:var(--r-md) 0 0 var(--r-md)"><span class="input lg" style="width:auto;border-left:0;border-radius:0 var(--r-md) var(--r-md) 0;display:flex;align-items:center;color:var(--text-subtle);background:var(--surface-2)">.ithrive.app</span></div>') +
      UI.field('Company size', '<select class="select lg" style="height:44px"><option>1–20 people</option><option>21–100 people</option><option selected>101–500 people</option><option>501–2,000 people</option><option>2,000+ people</option></select>') +
      UI.field('Primary use', '<select class="select lg" style="height:44px"><option>Company-wide collaboration</option><option>Engineering and product</option><option>Sales and customer success</option><option>Operations</option></select>') +
      submitBtn('Create organisation') +
      '</div>' +
      '<div class="auth-legal">Your 30-day Enterprise trial starts immediately. No card required.</div>' +
      '</div>',
    bind: function () {
      const name = root().querySelector('#o-name'), slug = root().querySelector('#o-slug');
      name.addEventListener('input', () => { slug.value = name.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); });
      const btn = root().querySelector('[data-submit]');
      btn.onclick = function () {
        if (!name.value.trim()) { name.classList.add('err'); UI.toast('Give your organisation a name.', 'error'); return; }
        busy(btn, 1100, function () {
          UI.toast('Organisation created. Opening your workspace…', 'success');
          setTimeout(() => App.signIn(true), 500);
        });
      };
    }
  };

  /* ------------------------------------------------------------------ */
  /* First-time onboarding                                              */
  /* ------------------------------------------------------------------ */
  const ONB = {};
  Auth.onboarding = function (done) {
    let step = 0;
    const picks = { interests: new Set(['Product', 'Engineering']), channels: new Set(['c-general', 'c-apollo', 'c-announcements']), people: new Set(['p10', 'p21', 'p6']), notif: 'balanced' };
    const wrap = U.el('div', { class: 'onb-wrap' });
    document.body.appendChild(wrap);

    const steps = [
      { title: 'Welcome to Northbeam, Aarav 👋', sub: 'Let us set your workspace up in four quick steps. You can change any of this later in Settings.', render: stepProfile },
      { title: 'What do you work on?', sub: 'We use this to prioritise what shows up on your Home dashboard.', render: stepInterests },
      { title: 'Join a few channels', sub: 'These are the most active channels for people in Product.', render: stepChannels },
      { title: 'Connect with your team', sub: 'Suggested from your department, your manager and the projects you are on.', render: stepPeople },
      { title: 'How should we notify you?', sub: 'Thrive AI can prioritise what reaches you and hold the rest for a digest.', render: stepNotif }
    ];

    function render() {
      const s = steps[step];
      wrap.innerHTML =
        '<div class="onb-head">' +
        '<div class="row gap-2"><div class="brand-mark">' + icon('thrive') + '</div><div class="brand-word" style="color:var(--text)">iThrive<span style="color:var(--brand-text)">Messaging</span></div></div>' +
        '<div class="onb-progress">' + steps.map((_, i) => '<i class="' + (i <= step ? 'on' : '') + '"></i>').join('') + '</div>' +
        '<button class="btn ghost sm" data-skip>Skip setup</button>' +
        '</div>' +
        '<div class="onb-body"><div class="onb-card"><h2>' + s.title + '</h2><p>' + s.sub + '</p>' + s.render() + '</div></div>' +
        '<div class="onb-foot">' +
        '<button class="btn ghost" data-back ' + (step === 0 ? 'disabled' : '') + '>' + icon('arrowLeft') + 'Back</button>' +
        '<div class="row gap-2"><span class="tiny muted">Step ' + (step + 1) + ' of ' + steps.length + '</span>' +
        '<button class="btn primary" data-next>' + (step === steps.length - 1 ? 'Enter workspace' : 'Continue') + icon('arrowRight') + '</button></div>' +
        '</div>';
      bind();
    }

    function stepProfile() {
      const me = Store.me();
      return '<div class="card pad mt-6"><div class="row gap-4 wrap">' +
        '<div class="col center gap-2">' + UI.avatar(me, 76, { presence: false }) +
        '<button class="btn ghost sm" data-upload>' + icon('camera') + 'Change photo</button></div>' +
        '<div class="grow col gap-3" style="min-width:260px">' +
        UI.field('Display name', '<input class="input" id="ob-name" value="' + U.attr(me.name) + '">') +
        UI.field('Job title', '<input class="input" id="ob-title" value="' + U.attr(me.title) + '">') +
        '<div class="row gap-3">' +
        UI.field('Department', '<select class="select" id="ob-dept">' + DATA.DEPARTMENTS.map(d => '<option value="' + d.id + '"' + (d.id === me.deptId ? ' selected' : '') + '>' + d.name + '</option>').join('') + '</select>') +
        UI.field('Time zone', '<input class="input" id="ob-tz" value="' + U.attr(me.tz) + '">') +
        '</div></div></div></div>';
    }
    function stepInterests() {
      const opts = [
        ['Product', 'target', 'Roadmap, discovery and specs'], ['Engineering', 'code', 'Architecture, incidents and releases'],
        ['Design', 'palette', 'Crits, research and design systems'], ['Sales', 'trendingUp', 'Pipeline, deals and enablement'],
        ['Marketing', 'megaphone', 'Campaigns, content and launches'], ['Customer Success', 'lifeBuoy', 'Onboarding, retention and support'],
        ['People', 'users', 'Hiring, culture and policies'], ['Finance', 'dollar', 'Budget, forecast and reporting']
      ];
      return '<div class="pick-grid">' + opts.map(o =>
        '<button class="pick-card' + (picks.interests.has(o[0]) ? ' on' : '') + '" data-int="' + o[0] + '">' +
        '<span class="p-ic">' + icon(o[1]) + '</span><span><span class="p-t">' + o[0] + '</span><span class="p-d">' + o[2] + '</span></span></button>').join('') + '</div>';
    }
    function stepChannels() {
      const list = ['c-general', 'c-announcements', 'c-apollo', 'c-product', 'c-engineering', 'c-design', 'c-launch', 'c-feedback', 'c-random'];
      return '<div class="pick-grid">' + list.map(function (id) {
        const c = Store.conv(id);
        return '<button class="pick-card' + (picks.channels.has(id) ? ' on' : '') + '" data-chan="' + id + '">' +
          '<span class="p-ic">' + icon(UI.channelIcon(c)) + '</span>' +
          '<span><span class="p-t">#' + U.esc(c.name) + '</span><span class="p-d">' + U.esc(U.plural(c.memberIds.length, 'member')) + ' · ' + U.esc(trimTopic(c.topic)) + '</span></span></button>';
      }).join('') + '</div>';
    }
    function trimTopic(s) { return String(s || '').length > 48 ? s.slice(0, 47) + '…' : (s || 'No topic set'); }
    function stepPeople() {
      const list = ['p10', 'p21', 'p6', 'p25', 'p3', 'p27', 'p13', 'p23'];
      return '<div class="pick-grid">' + list.map(function (id) {
        const p = Store.person(id);
        return '<button class="pick-card' + (picks.people.has(id) ? ' on' : '') + '" data-per="' + id + '">' +
          UI.avatar(id, 34) + '<span><span class="p-t">' + U.esc(p.name) + '</span><span class="p-d">' + U.esc(p.title) + '</span></span></button>';
      }).join('') + '</div>';
    }
    function stepNotif() {
      const opts = [
        ['everything', 'bell', 'Everything', 'Notify me about all activity in channels I have joined.'],
        ['balanced', 'sparkles', 'Smart (recommended)', 'Thrive AI notifies me about mentions, direct messages and anything urgent. Everything else waits for a digest.'],
        ['quiet', 'moon', 'Mentions only', 'Only notify me when someone mentions me directly or sends a DM.']
      ];
      return '<div class="col gap-3 mt-6">' + opts.map(o =>
        '<button class="pick-card' + (picks.notif === o[0] ? ' on' : '') + '" data-notif="' + o[0] + '" style="align-items:center">' +
        '<span class="p-ic">' + icon(o[1]) + '</span><span><span class="p-t">' + o[2] + '</span><span class="p-d">' + o[3] + '</span></span></button>').join('') +
        '<div class="banner brand mt-3">' + icon('sparkles') + '<div class="b-body"><strong>Thrive AI is on</strong>Summaries, action item extraction and smart search are enabled for your account. You can turn these off in Settings → AI.</div></div></div>';
    }

    function bind() {
      const q = (s) => wrap.querySelectorAll(s);
      q('[data-int]').forEach(b => b.onclick = () => { toggle(picks.interests, b.dataset.int); b.classList.toggle('on'); });
      q('[data-chan]').forEach(b => b.onclick = () => { toggle(picks.channels, b.dataset.chan); b.classList.toggle('on'); });
      q('[data-per]').forEach(b => b.onclick = () => { toggle(picks.people, b.dataset.per); b.classList.toggle('on'); });
      q('[data-notif]').forEach(b => b.onclick = () => { picks.notif = b.dataset.notif; render(); });
      const up = wrap.querySelector('[data-upload]');
      if (up) up.onclick = () => UI.toast('Photo upload opens your device library in production.', 'info');
      wrap.querySelector('[data-back]').onclick = () => { if (step > 0) { step--; render(); } };
      wrap.querySelector('[data-skip]').onclick = finish;
      wrap.querySelector('[data-next]').onclick = function () {
        if (step === 0) {
          const n = wrap.querySelector('#ob-name').value.trim();
          const ti = wrap.querySelector('#ob-title').value.trim();
          if (n) Store.updateMe({ name: n, title: ti, deptId: wrap.querySelector('#ob-dept').value, tz: wrap.querySelector('#ob-tz').value });
        }
        if (step < steps.length - 1) { step++; render(); } else finish();
      };
    }
    function toggle(set, v) { if (set.has(v)) set.delete(v); else set.add(v); }

    function finish() {
      Store.state.onboarded = true;
      Store.setPref('aiSmartNotif', picks.notif === 'balanced');
      picks.channels.forEach(id => { const c = Store.conv(id); if (c && !c.memberIds.includes(Store.state.meId)) c.memberIds.push(Store.state.meId); });
      Store.persist();
      wrap.style.transition = 'opacity .3s'; wrap.style.opacity = '0';
      setTimeout(() => { wrap.remove(); done && done(); }, 320);
    }

    render();
  };

  g.Auth = Auth;
})(window);
