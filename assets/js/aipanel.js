/* ===== iThrive — Thrive AI assistant surfaces ===== */
(function (g) {
  const AIPanel = {};

  function aiModal(title, sub, onReady, size) {
    const body = U.el('div');
    body.innerHTML = '<div class="ai-block"><div class="ai-status row gap-2 mb-3">' + icon('sparkles') +
      '<span class="semi md">Thrive AI is reading your workspace…</span><span class="spinner"></span></div>' +
      '<div data-out class="ai-out"></div></div>';
    const m = UI.modal({
      icon: 'sparkles', title: title, sub: sub, size: size || 'lg', body: body,
      actions: [{ label: 'Close', variant: 'ghost' }]
    });
    m.modal.classList.add('ai-modal');
    AI.think(700).then(() => {
      body.querySelector('.ai-status').innerHTML = icon('sparkles') + '<span class="semi md">' + U.esc(title) + '</span><span class="badge aurora">Thrive AI</span>' +
        '<span class="tiny subtle" style="margin-left:auto">Generated from ' + U.esc(sub || 'your workspace') + '</span>';
      onReady(body.querySelector('[data-out]'), m);
    });
    return m;
  }

  /* ------------------------------------------------------------------ */
  AIPanel.summarize = function (cid, opts) {
    opts = opts || {};
    const conv = Store.conv(cid);
    aiModal(opts.sinceHours ? 'What you missed' : 'Conversation summary',
      Store.convTitle(conv), function (out, modal) {
        const s = AI.summarizeConversation(cid, opts);
        if (!s) { out.innerHTML = '<p class="muted">There is nothing to summarise in this conversation yet.</p>'; return; }
        out.innerHTML =
          '<div class="ai-headline">' + U.esc(s.headline) + '</div>' +
          '<div class="row gap-2 wrap mt-2 mb-4">' +
          '<span class="badge ' + (s.sentiment.tone || '') + '">' + U.esc(s.sentiment.label) + '</span>' +
          '<span class="badge">' + UI.avatarStack(s.participants.slice(0, 5), 5, 16) + ' ' + U.plural(s.participants.length, 'participant') + '</span>' +
          (s.metrics.length ? '<span class="badge info">' + U.esc(s.metrics.slice(0, 3).join(' · ')) + '</span>' : '') +
          '</div>' +
          section('Key points', s.bullets.map(b =>
            '<li>' + UI.avatar(b.authorId, 18) + '<span>' + U.esc(b.text) + '</span>' +
            '<button class="icon-btn sm" data-jump="' + b.id + '" data-tip="Jump to message">' + icon('externalLink') + '</button></li>').join('')) +
          (s.decisions.length ? section('Decisions', s.decisions.map(d =>
            '<li>' + icon('checkCircle') + '<span>' + U.esc(d.text) + ' <span class="tiny muted">— ' + U.esc(Store.person(d.authorId).first) + ', ' + U.esc(U.ago(d.ts)) + '</span></span></li>').join('')) : '') +
          (s.risks.length ? section('Risks and blockers', s.risks.map(d =>
            '<li>' + icon('alertTriangle') + '<span>' + U.esc(d.text) + '</span></li>').join('')) : '') +
          (s.openQuestions.length ? section('Open questions for you', s.openQuestions.map(d =>
            '<li>' + icon('helpCircle') + '<span>' + U.esc(d.text) + ' <span class="tiny muted">— ' + U.esc(Store.person(d.authorId).first) + '</span></span></li>').join('')) : '') +
          (s.actions.length ? section('Suggested action items', s.actions.map((a, i) =>
            '<li>' + icon('listChecks') + '<span>' + U.esc(a.text) + '<span class="tiny muted"> — ' + U.esc(Store.person(a.assigneeId || Store.state.meId).first) + ', due ' + U.esc(U.dateShort(a.due)) + '</span></span>' +
            '<button class="btn sm soft" data-mk="' + i + '">Create task</button></li>').join('')) : '') +
          (s.files.length ? section('Files shared', s.files.map(fid => {
            const f = Store.file(fid); if (!f) return '';
            return '<li>' + UI.fileGlyph(f.name, 24) + '<span>' + U.esc(f.name) + '</span><button class="btn sm ghost" data-file="' + f.id + '">Open</button></li>';
          }).join('')) : '') +
          '<div class="row gap-2 mt-4 wrap">' +
          '<button class="btn sm" data-copy>' + icon('copy') + 'Copy summary</button>' +
          '<button class="btn sm" data-post>' + icon('send') + 'Post to conversation</button>' +
          '<button class="btn sm" data-tasks>' + icon('tasks') + 'Create all tasks</button>' +
          '<button class="btn sm ghost" data-refresh>' + icon('refresh') + 'Regenerate</button>' +
          '</div>' +
          '<div class="ai-disclaimer">' + icon('info') + 'Generated from ' + s.count + ' messages in this conversation. Always confirm decisions with the people involved.</div>';

        U.qsa('[data-jump]', out).forEach(b => b.onclick = () => { modal.close(); if (Chat.cid !== cid) Chat.open(cid); setTimeout(() => Chat.highlight(b.dataset.jump), 300); });
        U.qsa('[data-file]', out).forEach(b => b.onclick = () => Modals.filePreview(b.dataset.file));
        U.qsa('[data-mk]', out).forEach(b => b.onclick = function () {
          const a = s.actions[+b.dataset.mk];
          makeTask(a, cid);
          b.outerHTML = '<span class="badge success">' + icon('check') + 'Created</span>';
        });
        out.querySelector('[data-copy]').onclick = () => UI.copyToast(out.innerText, 'Summary copied to clipboard.');
        out.querySelector('[data-post]').onclick = function () {
          Store.sendMessage(cid, { text: '**Summary (Thrive AI)**\n' + s.headline + '\n' + s.bullets.map(b => '• ' + b.text).join('\n'), aiGenerated: true });
          modal.close(); App.renderMain(); UI.toast('Summary posted to the conversation.', 'success');
        };
        out.querySelector('[data-tasks]').onclick = function () {
          s.actions.forEach(a => makeTask(a, cid));
          UI.toast(U.plural(s.actions.length, 'task') + ' created.', 'success', { action: 'View tasks', onAction: () => { modal.close(); App.route('#/tasks'); } });
        };
        out.querySelector('[data-refresh]').onclick = () => { modal.close(); AIPanel.summarize(cid, opts); };
      });
  };
  function section(title, inner) {
    if (!inner) return '';
    return '<div class="ai-section"><div class="panel-title">' + U.esc(title) + '</div><ul class="ai-list">' + inner + '</ul></div>';
  }
  function makeTask(a, cid) {
    Store.createTask({
      title: a.text, assigneeId: a.assigneeId || Store.state.meId,
      due: (a.due instanceof Date ? a.due : new Date(a.due)).toISOString(),
      priority: a.priority || 'medium', source: cid,
      description: 'Extracted by Thrive AI from ' + Store.convTitle(Store.conv(cid)) + '.',
      labels: ['AI-extracted']
    });
  }

  /* ------------------------------------------------------------------ */
  AIPanel.summarizeMessage = function (cid, mid) {
    const m = (Store.msgs(cid) || []).find(x => x.id === mid);
    aiModal('Message summary', Store.person(m.authorId).name + ' · ' + U.ago(m.ts), function (out) {
      const sents = String(m.text).split(/(?<=[.!?])\s+/).filter(Boolean);
      const gist = sents.slice(0, 2).join(' ');
      out.innerHTML = '<div class="ai-headline">' + U.esc(gist) + '</div>' +
        (sents.length > 2 ? section('Details', sents.slice(2).map(s => '<li>' + icon('chevronRight') + '<span>' + U.esc(s) + '</span></li>').join('')) : '') +
        section('Suggested next step', '<li>' + icon('listChecks') + '<span>' + U.esc(AI.extractActions([m])[0] ? AI.extractActions([m])[0].text : 'No explicit action was requested in this message.') + '</span></li>');
    }, 'sm');
  };

  /* ------------------------------------------------------------------ */
  AIPanel.actions = function (cid) {
    const msgs = (Store.msgs(cid) || []).filter(m => !m.system && !m.deleted);
    const actions = AI.extractActions(msgs);
    Modals.actionItems(actions, cid);
  };

  /* ------------------------------------------------------------------ */
  AIPanel.ask = function (cid) {
    const body = U.el('div', { class: 'ai-chat' });
    body.innerHTML =
      '<div class="ai-chat-log" data-log>' +
      '<div class="ai-msg bot"><span class="ai-av">' + icon('sparkles') + '</span>' +
      '<div class="ai-bubble">Ask me anything about ' + (cid ? U.esc(Store.convTitle(Store.conv(cid))) : 'this workspace') + '. I answer from your messages, files, tasks and meetings — and I show you where each answer came from.</div></div>' +
      '</div>' +
      '<div class="ai-suggest">' + suggestions(cid).map(s => '<button class="qr-chip" data-sug="' + U.attr(s) + '">' + U.esc(s) + '</button>').join('') + '</div>' +
      '<div class="ai-input-row"><div class="input-wrap grow">' + icon('aiChat') + '<input class="input" data-q placeholder="Ask Thrive AI…" data-autofocus></div>' +
      '<button class="btn primary" data-send>' + icon('send') + '</button></div>';

    const m = UI.modal({ icon: 'sparkles', title: 'Ask Thrive AI', sub: 'Grounded in your workspace content', size: 'lg', body: body, actions: false });
    m.modal.classList.add('ai-modal');
    const log = body.querySelector('[data-log]');
    const input = body.querySelector('[data-q]');

    function ask(q) {
      if (!q.trim()) return;
      input.value = '';
      log.insertAdjacentHTML('beforeend', '<div class="ai-msg me"><div class="ai-bubble">' + U.esc(q) + '</div></div>');
      const holder = U.el('div', { class: 'ai-msg bot' });
      holder.innerHTML = '<span class="ai-av">' + icon('sparkles') + '</span><div class="ai-bubble"><span class="dots"><i></i><i></i><i></i></span></div>';
      log.appendChild(holder);
      U.scrollBottom(log, true);
      AI.think(680).then(function () {
        const a = AI.answer(cid ? (q + ' in:' + (Store.conv(cid).name || '')) : q);
        const bub = holder.querySelector('.ai-bubble');
        bub.innerHTML = '';
        const txt = U.el('div');
        bub.appendChild(txt);
        AI.stream(txt, a.text, { speed: 7, scroller: log }).then(function () {
          txt.innerHTML = U.renderRich(a.text);
          if (a.sources.length) {
            const src = U.el('div', { class: 'ai-sources' });
            src.innerHTML = '<div class="tiny subtle mb-1">Sources</div>' + a.sources.map(s =>
              '<button class="src-chip" data-src="' + s.convId + ':' + s.id + '">' + icon('chat') + U.esc(s.label) + ' · ' + U.esc(s.author) + ' · ' + U.esc(U.ago(s.ts)) + '</button>').join('');
            bub.appendChild(src);
            U.qsa('[data-src]', src).forEach(b => b.onclick = function () {
              const [cv, mid] = b.dataset.src.split(':');
              m.close(); Chat.open(cv, { highlight: mid }); App.route('#/messages/' + cv);
            });
          }
          bub.insertAdjacentHTML('beforeend', '<div class="tiny subtle mt-2">Confidence: ' + a.confidence + '</div>');
          U.scrollBottom(log, true);
        });
      });
    }
    body.querySelector('[data-send]').onclick = () => ask(input.value);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') ask(input.value); });
    U.qsa('[data-sug]', body).forEach(b => b.onclick = () => ask(b.dataset.sug));
  };
  function suggestions(cid) {
    if (cid) {
      const c = Store.conv(cid);
      return ['What was decided here?', 'What is blocking us?', 'Who is working on what?', 'Summarise the last week of ' + Store.convTitle(c)];
    }
    return ['What happened with the Apollo load test?', 'What is at risk for the launch?', 'What did Priya say about routing?', 'Which tasks are due this week?'];
  }

  /* ------------------------------------------------------------------ */
  AIPanel.catchUp = function () {
    aiModal('Your catch-up', 'unread conversations', function (out, modal) {
      const c = AI.catchUp();
      if (!c.items.length) {
        out.innerHTML = UI.empty({ icon: 'checkCircle', title: 'You are all caught up', desc: 'No unread messages anywhere in your workspace. Enjoy it while it lasts.' });
        return;
      }
      out.innerHTML = '<div class="ai-headline">' + U.esc(c.headline) + '</div>' +
        '<div class="tiny muted mb-4">' + U.esc(c.readTime) + ' if you read everything — or about 40 seconds this way.</div>' +
        ['high', 'medium', 'low'].map(function (tier) {
          const items = c.items.filter(i => i.priority === tier);
          if (!items.length) return '';
          const label = tier === 'high' ? 'Needs you now' : tier === 'medium' ? 'Worth a look' : 'Can wait';
          return '<div class="ai-section"><div class="panel-title">' + label + '</div>' +
            items.map(i => '<button class="catchup-row" data-cu="' + i.convId + '">' +
              '<span class="cu-badge ' + tier + '"></span>' +
              '<span class="grow min0"><span class="row gap-2"><span class="semi md truncate">' + U.esc(i.title) + '</span>' +
              '<span class="count' + (i.mentions ? '' : ' muted') + '">' + i.unread + '</span></span>' +
              '<span class="tiny muted truncate block">' + U.esc(Store.person(i.authorId).first) + ': ' + U.esc(i.gist) + '</span></span>' +
              icon('chevronRight') + '</button>').join('') + '</div>';
        }).join('') +
        '<div class="row gap-2 mt-4"><button class="btn sm" data-allread>' + icon('check') + 'Mark everything read</button></div>';
      U.qsa('[data-cu]', out).forEach(b => b.onclick = () => { modal.close(); App.route('#/messages/' + b.dataset.cu); });
      out.querySelector('[data-allread]').onclick = function () {
        Store.convs().forEach(cv => Store.markRead(cv.id));
        modal.close(); App.renderShell(); UI.toast('All conversations marked as read.', 'success');
      };
    });
  };

  /* ------------------------------------------------------------------ */
  AIPanel.open = function () {
    const body = U.el('div', { class: 'ai-hub' });
    const cards = [
      { icon: 'clock', t: 'Catch me up', d: 'A prioritised digest of everything unread.', fn: () => AIPanel.catchUp() },
      { icon: 'aiChat', t: 'Ask a question', d: 'Answers grounded in your messages and files.', fn: () => AIPanel.ask(null) },
      { icon: 'bookOpen', t: 'Summarise a conversation', d: 'Key points, decisions, risks and actions.', fn: pickConv },
      { icon: 'listChecks', t: 'Find my action items', d: 'Scan every conversation for things assigned to you.', fn: myActions },
      { icon: 'search', t: 'Smart file search', d: 'Describe a file instead of remembering its name.', fn: fileSearch },
      { icon: 'calendarPlus', t: 'Generate a meeting agenda', d: 'A structured agenda from a meeting title.', fn: () => Modals.scheduleMeeting({ aiAgenda: true }) },
      { icon: 'edit', t: 'Draft a message', d: 'Replies, follow-ups, status updates and declines.', fn: draftAnywhere },
      { icon: 'translate', t: 'Translate a conversation', d: 'Read any channel in your preferred language.', fn: pickTranslate }
    ];
    body.innerHTML = '<div class="ai-hub-grid">' + cards.map((c, i) =>
      '<button class="ai-hub-card" data-hub="' + i + '"><span class="hc-ic">' + icon(c.icon) + '</span>' +
      '<span class="hc-t">' + c.t + '</span><span class="hc-d">' + c.d + '</span></button>').join('') + '</div>' +
      '<div class="banner brand mt-4">' + icon('shield') + '<div class="b-body"><strong>Your data stays in your workspace</strong>Thrive AI reads only the content you already have access to, and never trains on your organisation\'s messages.</div></div>';
    const m = UI.modal({ icon: 'sparkles', title: 'Thrive AI', sub: 'Assistance grounded in your own workspace', size: 'lg', body: body, actions: [{ label: 'Close', variant: 'ghost' }] });
    U.qsa('[data-hub]', body).forEach(b => b.onclick = () => { m.close(); cards[+b.dataset.hub].fn(); });

    function pickConv() {
      const list = Store.convs().filter(c => !c.archived && (Store.msgs(c.id) || []).length > 2);
      Modals.pickConversation(list, cid => AIPanel.summarize(cid));
    }
    function pickTranslate() {
      const list = Store.convs().filter(c => !c.archived);
      Modals.pickConversation(list, function (cid) {
        UI.menu(null, AI.languages.map(l => ({ label: l, icon: 'globe', onClick: () => { Chat.translateTo = l; App.route('#/messages/' + cid); UI.toast('Conversation translated to ' + l + '.', 'success'); } })), { x: window.innerWidth / 2 - 110, y: 160 });
      });
    }
    function myActions() {
      aiModal('Action items assigned to you', 'across every conversation', function (out) {
        const all = [];
        Object.keys(Store.state.messages).forEach(function (cid) {
          AI.extractActions(Store.state.messages[cid]).forEach(function (a) {
            if (a.assigneeId === Store.state.meId) all.push(Object.assign(a, { cid }));
          });
        });
        if (!all.length) { out.innerHTML = '<p class="muted">Nothing is waiting on you across your conversations.</p>'; return; }
        out.innerHTML = section('Detected across ' + U.plural(U.uniq(all.map(a => a.cid)).length, 'conversation'),
          all.slice(0, 12).map((a, i) => '<li>' + icon('listChecks') + '<span>' + U.esc(a.text) +
            '<span class="tiny muted"> — ' + U.esc(Store.convTitle(Store.conv(a.cid))) + ', due ' + U.esc(U.dateShort(a.due)) + '</span></span>' +
            '<button class="btn sm soft" data-mk2="' + i + '">Create task</button></li>').join(''));
        U.qsa('[data-mk2]', out).forEach(b => b.onclick = function () {
          const a = all[+b.dataset.mk2]; makeTask(a, a.cid);
          b.outerHTML = '<span class="badge success">' + icon('check') + 'Created</span>';
        });
      });
    }
    function fileSearch() {
      const b2 = U.el('div');
      b2.innerHTML = '<div class="input-wrap">' + icon('search') + '<input class="input" data-fq placeholder="e.g. the spreadsheet with the load test numbers" data-autofocus></div><div data-fr class="mt-3"></div>';
      UI.modal({ icon: 'search', title: 'Smart file search', sub: 'Describe the file — you do not need its name', body: b2, actions: [{ label: 'Close', variant: 'ghost' }] });
      const fr = b2.querySelector('[data-fr]');
      fr.innerHTML = '<div class="tiny muted">Try: “Priya\'s architecture doc”, “the launch checklist”, “recent design files”.</div>';
      b2.querySelector('[data-fq]').addEventListener('input', U.debounce(function (e) {
        const q = e.target.value.trim();
        if (!q) { fr.innerHTML = ''; return; }
        const res = AI.findFiles(q).slice(0, 8);
        fr.innerHTML = res.length ? '<div class="mini-list">' + res.map(f => UI.fileRow(f)).join('') + '</div>'
          : '<div class="tiny muted">No file matches that description.</div>';
        U.qsa('[data-file]', fr).forEach(r => r.onclick = () => Modals.filePreview(r.dataset.file));
      }, 200));
    }
    function draftAnywhere() {
      Modals.pickConversation(Store.convs().filter(c => !c.archived), function (cid) {
        App.route('#/messages/' + cid);
        setTimeout(function () {
          if (Chat.composer) { Chat.composer.setText(AI.draft('reply', { cid })); UI.toast('Draft written by Thrive AI.', 'success'); }
        }, 400);
      });
    }
  };

  g.AIPanel = AIPanel;
})(window);
