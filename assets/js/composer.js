/* ===== iThrive — Message composer ===== */
(function (g) {
  const Composer = {};
  const SLASH = [
    { cmd: '/call', desc: 'Start an audio call in this conversation', icon: 'phone' },
    { cmd: '/meet', desc: 'Start an instant video meeting', icon: 'video' },
    { cmd: '/poll', desc: 'Create a poll', icon: 'poll' },
    { cmd: '/task', desc: 'Create a task from this conversation', icon: 'tasks' },
    { cmd: '/remind', desc: 'Set a reminder for yourself', icon: 'clock' },
    { cmd: '/summary', desc: 'Ask Thrive AI to summarise this conversation', icon: 'sparkles' },
    { cmd: '/status', desc: 'Update your availability and status', icon: 'smile' },
    { cmd: '/invite', desc: 'Add people to this conversation', icon: 'userPlus' },
    { cmd: '/topic', desc: 'Set the channel topic', icon: 'edit' },
    { cmd: '/shrug', desc: 'Append ¯\\_(ツ)_/¯', icon: 'type' },
    { cmd: '/dnd', desc: 'Turn on Do Not Disturb', icon: 'moon' },
    { cmd: '/away', desc: 'Set yourself as away', icon: 'clock' }
  ];

  Composer.mount = function (node, cfg) {
    cfg = cfg || {};
    const cid = cfg.cid;
    const conv = cid ? Store.conv(cid) : null;
    let attachments = [];
    let replyTo = cfg.replyTo || null;
    let recording = null;

    const canPost = cfg.force || !conv || Store.canPost(conv);

    node.innerHTML = '';
    node.className = 'composer-wrap' + (cfg.compact ? ' compact' : '');

    if (!canPost) {
      node.innerHTML = '<div class="composer-locked">' + icon('lock') +
        '<div><div class="semi md">This channel is read-only</div>' +
        '<div class="tiny muted">Only administrators and managers can post in an announcement channel. You can still react and reply in threads.</div></div>' +
        '<button class="btn sm" data-request>Request access</button></div>';
      node.querySelector('[data-request]').onclick = () => UI.toast('Access request sent to the channel administrators.', 'success');
      return { focus() {}, destroy() {} };
    }

    const el = U.frag(
      '<div class="composer">' +
        '<div class="cmp-reply" hidden></div>' +
        '<div class="cmp-attach" hidden></div>' +
        '<div class="cmp-format" hidden>' +
          fmtBtn('bold', 'Bold', 'bold') + fmtBtn('italic', 'Italic', 'italic') +
          fmtBtn('strike', 'Strikethrough', 'type') + fmtBtn('code', 'Inline code', 'code') +
          fmtBtn('block', 'Code block', 'layout') + fmtBtn('quote', 'Quote', 'quote') +
          fmtBtn('link', 'Link', 'link') + fmtBtn('list', 'Bulleted list', 'list') +
        '</div>' +
        '<div class="cmp-main">' +
          '<textarea class="cmp-input" rows="1" placeholder="' + U.attr(cfg.placeholder || placeholderFor(conv)) + '"></textarea>' +
        '</div>' +
        '<div class="cmp-bar">' +
          '<div class="cmp-tools">' +
            tool('attach', 'paperclip', 'Attach a file') +
            tool('image', 'image', 'Photos and videos') +
            tool('emoji', 'smile', 'Emoji') +
            tool('gif', 'gif', 'GIFs') +
            tool('sticker', 'sticker', 'Stickers') +
            tool('mention', 'atSign', 'Mention someone') +
            tool('format', 'type', 'Formatting') +
            tool('more', 'plus', 'More — poll, task, code, location') +
            '<span class="cmp-sep"></span>' +
            tool('ai', 'sparkles', 'Thrive AI — draft, rewrite, translate', 'ai') +
          '</div>' +
          '<div class="cmp-send">' +
            '<span class="cmp-hint tiny subtle"></span>' +
            tool('voice', 'mic', 'Record a voice message') +
            '<button class="btn primary sm cmp-send-btn" data-send>' + icon('send') + '<span>Send</span></button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    node.appendChild(el);

    const input = node.querySelector('.cmp-input');
    const attachBar = node.querySelector('.cmp-attach');
    const replyBar = node.querySelector('.cmp-reply');
    const fmtBar = node.querySelector('.cmp-format');
    const sendBtn = node.querySelector('[data-send]');
    const hint = node.querySelector('.cmp-hint');

    if (conv && conv.draft) input.value = conv.draft;
    updateHint();

    function placeholderFor(c) {
      if (!c) return 'Write a message…';
      if (c.kind === 'dm') return 'Message ' + Store.person(c.peerId).first + '…';
      if (c.kind === 'group') return 'Message ' + c.name + '…';
      return 'Message #' + c.name + '…';
    }
    function fmtBtn(id, tip, ic) { return '<button class="icon-btn sm" data-fmt="' + id + '" data-tip="' + tip + '">' + icon(ic) + '</button>'; }
    function tool(id, ic, tip, cls) { return '<button class="icon-btn ' + (cls || '') + '" data-tool="' + id + '" data-tip="' + tip + '">' + icon(ic) + '</button>'; }

    /* ---------- auto-grow ---------- */
    function grow() {
      input.style.height = 'auto';
      input.style.height = Math.min(220, input.scrollHeight) + 'px';
    }
    function updateHint() {
      const enter = Store.state.prefs.enterToSend;
      hint.textContent = input.value.trim() || attachments.length ? (enter ? 'Enter to send · Shift+Enter for a new line' : 'Ctrl+Enter to send') : '';
      sendBtn.classList.toggle('disabled', !input.value.trim() && !attachments.length);
    }

    input.addEventListener('input', function () {
      grow(); updateHint(); handleAutocomplete();
      if (cid) Store.setDraft(cid, input.value);
      if (cfg.onTyping) cfg.onTyping(input.value);
    });
    input.addEventListener('keydown', function (e) {
      if (ac.open) { if (ac.key(e)) return; }
      const enterSend = Store.state.prefs.enterToSend;
      if (e.key === 'Enter' && !e.shiftKey && (enterSend || e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
      if (e.key === 'Escape') { if (replyTo) { replyTo = null; renderReply(); } }
      if (e.key === 'ArrowUp' && !input.value && cid) {
        const mine = (Store.msgs(cid) || []).filter(m => m.authorId === Store.state.meId && !m.deleted);
        if (mine.length && cfg.onEditLast) { e.preventDefault(); cfg.onEditLast(mine[mine.length - 1]); }
      }
    });
    input.addEventListener('paste', function (e) {
      const items = Array.from(e.clipboardData.items || []);
      const files = items.filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
      if (files.length) { e.preventDefault(); files.forEach(addRealFile); }
    });

    /* ---------- drag and drop ---------- */
    node.addEventListener('dragover', function (e) { e.preventDefault(); node.classList.add('dropping'); });
    node.addEventListener('dragleave', function (e) { if (!node.contains(e.relatedTarget)) node.classList.remove('dropping'); });
    node.addEventListener('drop', function (e) {
      e.preventDefault(); node.classList.remove('dropping');
      Array.from(e.dataTransfer.files || []).forEach(addRealFile);
    });

    /* ---------- attachments ---------- */
    const fileInput = U.el('input', { type: 'file', multiple: 'true', style: 'display:none' });
    const imgInput = U.el('input', { type: 'file', multiple: 'true', accept: 'image/*,video/*', style: 'display:none' });
    node.appendChild(fileInput); node.appendChild(imgInput);
    fileInput.addEventListener('change', () => { Array.from(fileInput.files).forEach(addRealFile); fileInput.value = ''; });
    imgInput.addEventListener('change', () => { Array.from(imgInput.files).forEach(addRealFile); imgInput.value = ''; });

    function addRealFile(file) {
      if (file.size > 250 * 1024 * 1024) {
        UI.toast('“' + file.name + '” is larger than the 250 MB limit.', 'error');
        pushFailedAttachment(file);
        return;
      }
      const a = { id: U.uid('att'), name: file.name, size: file.size, kind: U.fileKind(file.name), progress: 0, state: 'uploading' };
      if (a.kind === 'image' && file.type.startsWith('image/')) { try { a.url = URL.createObjectURL(file); } catch (e) {} }
      attachments.push(a); renderAttachments();
      const iv = setInterval(function () {
        a.progress = Math.min(100, a.progress + 12 + Math.random() * 22);
        if (a.progress >= 100) { a.state = 'done'; clearInterval(iv); }
        renderAttachments();
      }, 130);
    }
    function pushFailedAttachment(file) {
      const a = { id: U.uid('att'), name: file.name, size: file.size, kind: U.fileKind(file.name), progress: 100, state: 'failed' };
      attachments.push(a); renderAttachments();
    }
    function addWorkspaceFile(fid) {
      const f = Store.file(fid); if (!f) return;
      attachments.push({ id: U.uid('att'), name: f.name, size: f.size, kind: U.fileKind(f.name), progress: 100, state: 'done', fileId: fid });
      renderAttachments();
    }
    function renderAttachments() {
      if (!attachments.length) { attachBar.hidden = true; attachBar.innerHTML = ''; updateHint(); return; }
      attachBar.hidden = false;
      attachBar.innerHTML = attachments.map(function (a) {
        if (a.state === 'failed') {
          return '<div class="att-chip failed" data-att="' + a.id + '">' + icon('alertCircle') +
            '<div class="grow min0"><div class="semi tiny truncate">' + U.esc(a.name) + '</div><div class="tiny">Upload failed — file too large</div></div>' +
            '<button class="icon-btn sm" data-retry="' + a.id + '" data-tip="Retry">' + icon('refresh') + '</button>' +
            '<button class="icon-btn sm" data-rm="' + a.id + '">' + icon('x') + '</button></div>';
        }
        const thumb = a.url ? '<span class="att-thumb" style="background-image:url(' + a.url + ')"></span>' : UI.fileGlyph(a.name, 32);
        return '<div class="att-chip" data-att="' + a.id + '">' + thumb +
          '<div class="grow min0"><div class="semi tiny truncate">' + U.esc(a.name) + '</div>' +
          '<div class="tiny muted">' + U.bytes(a.size) + (a.state === 'uploading' ? ' · uploading ' + Math.round(a.progress) + '%' : '') + '</div>' +
          (a.state === 'uploading' ? '<div class="progress thin mt-1"><i style="width:' + a.progress + '%"></i></div>' : '') +
          '</div><button class="icon-btn sm" data-rm="' + a.id + '">' + icon('x') + '</button></div>';
      }).join('');
      U.qsa('[data-rm]', attachBar).forEach(b => b.onclick = () => { attachments = attachments.filter(x => x.id !== b.dataset.rm); renderAttachments(); });
      U.qsa('[data-retry]', attachBar).forEach(b => b.onclick = () => {
        const a = attachments.find(x => x.id === b.dataset.retry);
        if (a) { a.state = 'uploading'; a.progress = 0; renderAttachments();
          const iv = setInterval(() => { a.progress = Math.min(100, a.progress + 20); if (a.progress >= 100) { a.state = 'done'; clearInterval(iv); } renderAttachments(); }, 120); }
      });
      updateHint();
    }

    /* ---------- reply banner ---------- */
    function renderReply() {
      if (!replyTo) { replyBar.hidden = true; replyBar.innerHTML = ''; return; }
      replyBar.hidden = false;
      const p = Store.person(replyTo.authorId);
      replyBar.innerHTML = '<div class="reply-strip">' + icon('reply') +
        '<div class="grow min0"><div class="tiny semi">Replying to ' + U.esc(p.name) + '</div>' +
        '<div class="tiny muted truncate">' + U.esc(replyTo.text || (replyTo.files || []).length + ' attachment(s)') + '</div></div>' +
        '<button class="icon-btn sm" data-cancel-reply>' + icon('x') + '</button></div>';
      replyBar.querySelector('[data-cancel-reply]').onclick = () => { replyTo = null; renderReply(); };
    }
    renderReply();

    /* ---------- formatting ---------- */
    U.qsa('[data-fmt]', fmtBar).forEach(function (b) {
      b.onclick = function () {
        const map = { bold: ['**', '**'], italic: ['_', '_'], strike: ['~~', '~~'], code: ['`', '`'], block: ['```\n', '\n```'], quote: ['> ', ''], link: ['[', '](https://)'], list: ['• ', ''] };
        const [a, z] = map[b.dataset.fmt];
        const s = input.selectionStart, e = input.selectionEnd;
        const sel = input.value.slice(s, e);
        input.value = input.value.slice(0, s) + a + sel + z + input.value.slice(e);
        input.focus(); input.setSelectionRange(s + a.length, s + a.length + sel.length);
        grow(); updateHint();
      };
    });

    /* ---------- tools ---------- */
    U.qsa('[data-tool]', node).forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        const t = b.dataset.tool;
        if (t === 'attach') return openAttachMenu(b);
        if (t === 'image') return imgInput.click();
        if (t === 'emoji') return openEmoji(b);
        if (t === 'gif') return openGif(b);
        if (t === 'sticker') return openSticker(b);
        if (t === 'mention') return insert('@');
        if (t === 'format') { fmtBar.hidden = !fmtBar.hidden; b.classList.toggle('active', !fmtBar.hidden); return; }
        if (t === 'more') return openMore(b);
        if (t === 'ai') return openAI(b);
        if (t === 'voice') return toggleVoice(b);
      };
    });

    function insert(txt) {
      const s = input.selectionStart;
      input.value = input.value.slice(0, s) + txt + input.value.slice(input.selectionEnd);
      input.focus(); input.setSelectionRange(s + txt.length, s + txt.length);
      grow(); updateHint(); handleAutocomplete();
    }

    function openAttachMenu(anchor) {
      UI.menu(anchor, [
        { label: 'Upload from this device', icon: 'upload', onClick: () => fileInput.click() },
        { label: 'Photos and videos', icon: 'image', onClick: () => imgInput.click() },
        { label: 'From workspace files', icon: 'folder', onClick: pickWorkspaceFile },
        { sep: true },
        { label: 'Google Drive', icon: 'cloud', onClick: () => connectedOr('Google Drive') },
        { label: 'OneDrive', icon: 'cloud', onClick: () => connectedOr('OneDrive') },
        { sep: true },
        { label: 'Screen capture', icon: 'screenShare', onClick: captureScreen },
        { label: 'Share my location', icon: 'location', onClick: shareLocation }
      ], { align: 'left' });
    }
    function connectedOr(name) {
      const i = Store.state.integrations.find(x => x.name === name);
      if (i && i.connected) pickWorkspaceFile(name);
      else UI.confirm({ title: 'Connect ' + name + '?', body: name + ' is not connected to this workspace yet. Connecting lets you attach files without downloading them first.', confirmLabel: 'Connect', icon: 'plug' })
        .then(ok => { if (ok && i) { Store.toggleIntegration(i.id); UI.toast(name + ' connected.', 'success'); } });
    }
    function pickWorkspaceFile(source) {
      const files = Store.state.files.slice(0, 40);
      const body = U.el('div', { class: 'col gap-2' });
      body.innerHTML = '<div class="input-wrap">' + icon('search') + '<input class="input" data-fs placeholder="Search files, or describe what you need…"></div>' +
        '<div class="tiny muted">Thrive AI understands descriptions like “the load test spreadsheet” or “Zara\'s latest design file”.</div>' +
        '<div class="file-pick-list scroll-y" data-fl style="max-height:340px"></div>';
      const list = body.querySelector('[data-fl]');
      function draw(items) {
        list.innerHTML = items.length ? items.map(f => '<button class="lrow" data-pf="' + f.id + '">' + UI.fileGlyph(f.name, 32) +
          '<span class="grow min0"><span class="semi md block truncate">' + U.esc(f.name) + '</span>' +
          '<span class="tiny muted">' + U.esc(Store.person(f.ownerId).first) + ' · ' + U.bytes(f.size) + ' · ' + U.ago(f.modifiedAt) + '</span></span></button>').join('')
          : '<div class="empty" style="padding:24px"><p class="muted">No files match that description.</p></div>';
        U.qsa('[data-pf]', list).forEach(b => b.onclick = () => { addWorkspaceFile(b.dataset.pf); m.close(); UI.toast('File attached.', 'success'); });
      }
      draw(files);
      body.querySelector('[data-fs]').addEventListener('input', U.debounce(function (e) {
        const q = e.target.value.trim();
        draw(q ? AI.findFiles(q) : files);
      }, 160));
      const m = UI.modal({ icon: 'folder', title: (source || 'Workspace') + ' files', sub: 'Attach a file that already exists in your workspace', body: body, actions: [{ label: 'Close', variant: 'ghost' }] });
    }
    function captureScreen() {
      UI.toast('Capturing screen…', 'info', { duration: 900 });
      setTimeout(function () {
        attachments.push({ id: U.uid('att'), name: 'Screen capture ' + U.time24(new Date()).replace(':', '-') + '.png', size: 428000 + Math.floor(Math.random() * 400000), kind: 'image', progress: 100, state: 'done', synthetic: 'capture' });
        renderAttachments();
        UI.toast('Screen capture attached.', 'success');
      }, 950);
    }
    function shareLocation() {
      insert('📍 Lisbon HQ — Rua do Alecrim 12, 1200-017 Lisboa (https://maps.example.com/northbeam-hq)');
      UI.toast('Location added to your message.', 'success');
    }

    function openEmoji(anchor) {
      const pop = popover(anchor, 'emoji-pop');
      const sets = DATA.EMOJI_SETS;
      pop.innerHTML = '<div class="pop-head"><div class="input-wrap">' + icon('search') + '<input class="input" data-es placeholder="Search emoji"></div></div>' +
        '<div class="pop-body scroll-y">' + Object.keys(sets).map(k =>
          '<div class="emoji-group"><div class="panel-title">' + k + '</div><div class="emoji-grid">' +
          sets[k].map(e => '<button class="emoji-btn" data-e="' + e + '">' + e + '</button>').join('') + '</div></div>').join('') + '</div>';
      bindEmojiPop(pop);
    }
    function bindEmojiPop(pop) {
      U.qsa('[data-e]', pop).forEach(b => b.onclick = () => { insert(b.dataset.e); });
      const s = pop.querySelector('[data-es]');
      s && s.addEventListener('input', function () {
        const q = s.value.toLowerCase();
        U.qsa('.emoji-group', pop).forEach(gp => {
          const btns = U.qsa('[data-e]', gp);
          let any = false;
          btns.forEach(b => { const ok = !q || b.dataset.e.includes(q); b.style.display = ok ? '' : 'none'; if (ok) any = true; });
          gp.style.display = any ? '' : 'none';
        });
      });
    }
    function openGif(anchor) {
      const pop = popover(anchor, 'gif-pop');
      pop.innerHTML = '<div class="pop-head"><div class="input-wrap">' + icon('search') + '<input class="input" data-gs placeholder="Search GIFs" value="celebrate"></div></div>' +
        '<div class="pop-body scroll-y"><div class="gif-grid">' + DATA.GIFS.map(gf =>
          '<button class="gif-card" data-gif="' + gf.id + '" style="background:' + gf.grad + '"><span>' + gf.emoji + '</span><b>' + gf.label + '</b></button>').join('') + '</div></div>';
      U.qsa('[data-gif]', pop).forEach(b => b.onclick = function () {
        const gf = DATA.GIFS.find(x => x.id === b.dataset.gif);
        attachments.push({ id: U.uid('att'), name: gf.label + '.gif', size: 1240000, kind: 'image', progress: 100, state: 'done', gif: gf });
        renderAttachments(); closePop();
      });
    }
    function openSticker(anchor) {
      const pop = popover(anchor, 'emoji-pop');
      pop.innerHTML = '<div class="pop-head"><div class="semi md">Northbeam sticker pack</div></div>' +
        '<div class="pop-body"><div class="sticker-grid">' + DATA.STICKERS.map(s =>
          '<button class="sticker-btn" data-st="' + s + '">' + s + '</button>').join('') + '</div></div>';
      U.qsa('[data-st]', pop).forEach(b => b.onclick = () => { doSend({ text: b.dataset.st, sticker: true }); closePop(); });
    }
    function openMore(anchor) {
      UI.menu(anchor, [
        { label: 'Create a poll', icon: 'poll', onClick: () => Modals.createPoll(cid, p => doSend({ text: p.question, poll: p })) },
        { label: 'Create a task', icon: 'tasks', onClick: () => Modals.createTask({ source: cid }, t => { doSend({ text: 'Created a task: ' + t.title, task: { id: t.id } }); }) },
        { label: 'Code snippet', icon: 'code', onClick: insertCode },
        { label: 'Quote a message', icon: 'quote', onClick: () => UI.toast('Hover a message and choose Quote.', 'info') },
        { sep: true },
        { label: 'Schedule this message', icon: 'clock', onClick: scheduleSend },
        { label: 'Save as draft', icon: 'save', onClick: () => { Store.setDraft(cid, input.value); UI.toast('Draft saved.', 'success'); } },
        { label: 'Clear composer', icon: 'trash', danger: true, onClick: () => { input.value = ''; attachments = []; renderAttachments(); grow(); updateHint(); } }
      ], { align: 'left' });
    }
    function insertCode() {
      UI.prompt({ title: 'Insert code snippet', label: 'Code', multiline: true, icon: 'code', confirmLabel: 'Insert', placeholder: 'function dispatch() { … }' })
        .then(v => { if (v) insert('\n```\n' + v + '\n```\n'); });
    }
    function scheduleSend() {
      UI.menu(node.querySelector('[data-tool="more"]'), [
        { label: 'In 30 minutes', icon: 'clock', onClick: () => scheduled(30) },
        { label: 'Tomorrow at 09:00', icon: 'clock', onClick: () => scheduled(60 * 14) },
        { label: 'Monday at 09:00', icon: 'calendar', onClick: () => scheduled(60 * 48) },
        { label: 'Custom time…', icon: 'calendarPlus', onClick: () => UI.toast('Custom scheduling opens the date picker in production.', 'info') }
      ], { align: 'left' });
    }
    function scheduled(mins) {
      if (!input.value.trim()) { UI.toast('Write the message first.', 'warn'); return; }
      UI.toast('Message scheduled for ' + U.time(U.addMin(new Date(), mins)) + '.', 'success', { action: 'Undo', onAction: () => UI.toast('Schedule cancelled.', 'info') });
      input.value = ''; grow(); updateHint();
    }

    /* ---------- AI ---------- */
    function openAI(anchor) {
      const has = !!input.value.trim();
      UI.menu(anchor, [
        { label: 'Thrive AI', header: true },
        { label: 'Draft a reply', icon: 'sparkles', onClick: () => aiDraft('reply') },
        { label: 'Draft a follow-up', icon: 'send', onClick: () => aiDraft('followup') },
        { label: 'Draft a status update', icon: 'activity', onClick: () => aiDraft('status') },
        { label: 'Draft a polite decline', icon: 'x', onClick: () => aiDraft('decline') },
        { label: 'Propose a meeting', icon: 'calendarPlus', onClick: () => aiDraft('meeting') },
        { sep: true },
        { label: 'Make it more concise', icon: 'minus', disabled: !has, onClick: () => aiRewrite('concise') },
        { label: 'Make it more formal', icon: 'briefcase', disabled: !has, onClick: () => aiRewrite('formal') },
        { label: 'Make it friendlier', icon: 'smile', disabled: !has, onClick: () => aiRewrite('friendly') },
        { label: 'Expand with context', icon: 'plus', disabled: !has, onClick: () => aiRewrite('expand') },
        { label: 'Convert to bullet points', icon: 'list', disabled: !has, onClick: () => aiRewrite('bullets') },
        { label: 'Fix spelling and grammar', icon: 'check', disabled: !has, onClick: () => aiRewrite('fix') },
        { sep: true },
        { label: 'Translate…', icon: 'translate', disabled: !has, onClick: aiTranslate },
        { label: 'Summarise this conversation', icon: 'bookOpen', onClick: () => AIPanel.summarize(cid) }
      ], { align: 'left', width: 260 });
    }
    function aiDraft(kind) {
      const box = showAIWorking('Drafting…');
      AI.think(700).then(function () {
        const text = AI.draft(kind, { cid: cid });
        box.remove();
        input.value = text; grow(); updateHint(); input.focus();
        UI.toast('Draft written by Thrive AI. Edit before sending.', 'success', { action: 'Undo', onAction: () => { input.value = ''; grow(); updateHint(); } });
      });
    }
    function aiRewrite(mode) {
      const before = input.value;
      const box = showAIWorking('Rewriting…');
      AI.think(560).then(function () {
        box.remove();
        input.value = AI.rewrite(before, mode); grow(); updateHint(); input.focus();
        UI.toast('Rewritten (' + mode + ').', 'success', { action: 'Undo', onAction: () => { input.value = before; grow(); updateHint(); } });
      });
    }
    function aiTranslate() {
      const before = input.value;
      UI.menu(node.querySelector('[data-tool="ai"]'), AI.languages.map(l => ({
        label: 'Translate to ' + l, icon: 'globe',
        onClick: () => { input.value = AI.translate(before, l); grow(); updateHint(); UI.toast('Translated to ' + l + '.', 'success', { action: 'Undo', onAction: () => { input.value = before; grow(); updateHint(); } }); }
      })), { align: 'left' });
    }
    function showAIWorking(label) {
      const b = U.el('div', { class: 'ai-working' }, '<span class="spinner"></span><span>' + U.esc(label) + '</span>');
      node.querySelector('.cmp-main').appendChild(b);
      return b;
    }

    /* ---------- voice ---------- */
    function toggleVoice(btn) {
      if (recording) {
        clearInterval(recording.iv);
        const secs = recording.secs;
        recording.bar.remove(); recording = null;
        btn.classList.remove('recording');
        if (secs < 1) { UI.toast('Recording too short.', 'warn'); return; }
        doSend({ text: '', voice: { seconds: secs, wave: Array.from({ length: 34 }, () => 0.2 + Math.random() * 0.8) } });
        return;
      }
      btn.classList.add('recording');
      const bar = U.el('div', { class: 'voice-bar' });
      bar.innerHTML = '<span class="rec-dot"></span><span class="semi md">Recording</span><span class="mono" data-vt>0:00</span>' +
        '<div class="voice-wave">' + Array.from({ length: 28 }, () => '<i></i>').join('') + '</div>' +
        '<button class="btn ghost sm" data-vcancel>Cancel</button><button class="btn primary sm" data-vstop>' + icon('send') + 'Send</button>';
      node.querySelector('.cmp-main').appendChild(bar);
      recording = { secs: 0, bar: bar };
      recording.iv = setInterval(function () {
        recording.secs++;
        bar.querySelector('[data-vt]').textContent = U.durSec(recording.secs);
        U.qsa('.voice-wave i', bar).forEach(i => i.style.height = (18 + Math.random() * 64) + '%');
        if (recording.secs >= 300) toggleVoice(btn);
      }, 1000);
      bar.querySelector('[data-vcancel]').onclick = function () {
        clearInterval(recording.iv); recording.bar.remove(); recording = null; btn.classList.remove('recording');
        UI.toast('Recording discarded.', 'info');
      };
      bar.querySelector('[data-vstop]').onclick = () => toggleVoice(btn);
    }

    /* ---------- popovers ---------- */
    let curPop = null;
    function closePop() { if (curPop) { curPop.remove(); curPop = null; document.removeEventListener('mousedown', popOut, true); } }
    function popOut(e) { if (curPop && !curPop.contains(e.target) && !e.target.closest('[data-tool]')) closePop(); }
    function popover(anchor, cls) {
      closePop();
      const p = U.el('div', { class: 'popover ' + cls });
      document.getElementById('menu-root').appendChild(p);
      const r = anchor.getBoundingClientRect();
      p.style.left = U.clamp(r.left - 20, 8, window.innerWidth - 340) + 'px';
      p.style.top = Math.max(8, r.top - 366) + 'px';
      curPop = p;
      setTimeout(() => document.addEventListener('mousedown', popOut, true), 0);
      return p;
    }

    /* ---------- autocomplete (@ # /) ---------- */
    const ac = { open: false, idx: 0, items: [], el: null, trigger: null, start: 0 };
    function handleAutocomplete() {
      const pos = input.selectionStart;
      const before = input.value.slice(0, pos);
      const m = before.match(/(^|\s)([@#/])([\w.-]*)$/);
      if (!m) return closeAC();
      const trigger = m[2], q = m[3].toLowerCase();
      ac.start = pos - m[3].length - 1;
      let items = [];
      if (trigger === '@') {
        const pool = conv && conv.kind === 'channel' ? conv.memberIds : (conv ? conv.memberIds : Store.people().map(p => p.id));
        items = pool.map(id => Store.person(id)).filter(p => !q || (p.name + ' ' + p.title).toLowerCase().includes(q))
          .slice(0, 8).map(p => ({ key: '@' + p.name.replace(/\s+/g, '.'), label: p.name, sub: p.title, avatar: p.id }));
        if (!q || 'channel'.startsWith(q)) items.unshift({ key: '@channel', label: '@channel', sub: 'Notify everyone in this conversation', icon: 'megaphone' });
        if (!q || 'here'.startsWith(q)) items.push({ key: '@here', label: '@here', sub: 'Notify everyone currently online', icon: 'zap' });
      } else if (trigger === '#') {
        items = Store.convs().filter(c => c.kind === 'channel' && !c.archived && (!q || c.name.includes(q)))
          .slice(0, 8).map(c => ({ key: '#' + c.name, label: '#' + c.name, sub: c.topic || '', icon: UI.channelIcon(c) }));
      } else {
        items = SLASH.filter(s => !q || s.cmd.slice(1).startsWith(q)).slice(0, 8)
          .map(s => ({ key: s.cmd + ' ', label: s.cmd, sub: s.desc, icon: s.icon, slash: s.cmd }));
      }
      if (!items.length) return closeAC();
      ac.items = items; ac.idx = 0; ac.trigger = trigger;
      drawAC();
    }
    function drawAC() {
      if (!ac.el) { ac.el = U.el('div', { class: 'ac-pop' }); node.appendChild(ac.el); }
      ac.open = true;
      ac.el.innerHTML = ac.items.map(function (it, i) {
        return '<button class="ac-item' + (i === ac.idx ? ' on' : '') + '" data-ac="' + i + '">' +
          (it.avatar ? UI.avatar(it.avatar, 26) : '<span class="ac-ic">' + icon(it.icon || 'hash') + '</span>') +
          '<span class="grow min0"><span class="semi md block truncate">' + U.esc(it.label) + '</span>' +
          (it.sub ? '<span class="tiny muted truncate">' + U.esc(it.sub) + '</span>' : '') + '</span></button>';
      }).join('');
      U.qsa('[data-ac]', ac.el).forEach(b => b.onmousedown = (e) => { e.preventDefault(); pick(+b.dataset.ac); });
    }
    function closeAC() { ac.open = false; if (ac.el) { ac.el.remove(); ac.el = null; } }
    function pick(i) {
      const it = ac.items[i]; if (!it) return;
      if (it.slash) { closeAC(); input.value = input.value.slice(0, ac.start); grow(); runSlash(it.slash); return; }
      const after = input.value.slice(input.selectionStart);
      input.value = input.value.slice(0, ac.start) + it.key + ' ' + after;
      const np = ac.start + it.key.length + 1;
      input.focus(); input.setSelectionRange(np, np);
      closeAC(); grow(); updateHint();
    }
    ac.key = function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); ac.idx = (ac.idx + 1) % ac.items.length; drawAC(); return true; }
      if (e.key === 'ArrowUp') { e.preventDefault(); ac.idx = (ac.idx - 1 + ac.items.length) % ac.items.length; drawAC(); return true; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(ac.idx); return true; }
      if (e.key === 'Escape') { closeAC(); return true; }
      return false;
    };

    function runSlash(cmd) {
      switch (cmd) {
        case '/call': Calls.start({ cid: cid, kind: 'audio' }); break;
        case '/meet': Calls.start({ cid: cid, kind: 'video' }); break;
        case '/poll': Modals.createPoll(cid, p => doSend({ text: p.question, poll: p })); break;
        case '/task': Modals.createTask({ source: cid }); break;
        case '/remind': Modals.reminder(cid); break;
        case '/summary': AIPanel.summarize(cid); break;
        case '/status': Modals.setStatus(); break;
        case '/invite': Modals.addMembers(cid); break;
        case '/topic': Modals.editTopic(cid); break;
        case '/shrug': insert('¯\\_(ツ)_/¯'); break;
        case '/dnd': Store.setPresence('dnd'); UI.toast('Do Not Disturb is on.', 'success'); break;
        case '/away': Store.setPresence('away'); UI.toast('You are set to Away.', 'success'); break;
      }
      updateHint();
    }

    /* ---------- send ---------- */
    function doSend(extra) {
      const payload = Object.assign({
        text: '', files: [], replyTo: replyTo ? replyTo.id : null
      }, extra || {});
      if (cfg.onSend) cfg.onSend(payload);
      replyTo = null; renderReply();
    }
    function send() {
      const text = input.value.trim();
      const pending = attachments.filter(a => a.state === 'uploading');
      if (pending.length) { UI.toast('Wait for uploads to finish.', 'warn'); return; }
      const good = attachments.filter(a => a.state === 'done');
      if (!text && !good.length) return;
      /* register attachments as workspace files */
      const fileIds = good.map(function (a) {
        if (a.fileId) return a.fileId;
        const f = Store.addFile({ name: a.name, size: a.size, source: cid, url: a.url, gif: a.gif, synthetic: a.synthetic });
        return f.id;
      });
      doSend({ text: text, files: fileIds });
      input.value = ''; attachments = []; renderAttachments(); renderReply(); grow(); updateHint();
      if (cid) Store.setDraft(cid, '');
      input.focus();
    }
    sendBtn.onclick = send;

    grow();
    return {
      focus: () => input.focus(),
      setText: (t) => { input.value = t; grow(); updateHint(); input.focus(); },
      getText: () => input.value,
      setReply: (m) => { replyTo = m; renderReply(); input.focus(); },
      attachFileId: addWorkspaceFile,
      destroy: () => { closeAC(); closePop(); if (recording) clearInterval(recording.iv); }
    };
  };

  g.Composer = Composer;
})(window);
