/* ===== iThrive — Calls, meetings and the in-call stage ===== */
(function (g) {
  const Calls = {};
  let session = null;
  const root = () => document.getElementById('overlay-root');

  const CAPTION_LINES = [
    ['So where are we on the go/no-go criteria?', 0],
    ['All four functions have signed off except localisation.', 1],
    ['The German translation lands tomorrow morning, so that clears.', 2],
    ['Load test came in at 412 milliseconds p95 at three times peak.', 1],
    ['That is comfortably inside the budget we set.', 0],
    ['Rollback is a single feature flag, tested twice this week.', 3],
    ['Then I am comfortable calling it a go, subject to the translation.', 0],
    ['Agreed. I will write the decision into the launch document.', 2]
  ];

  /* ------------------------------------------------------------------ */
  Calls.start = function (opts) {
    opts = opts || {};
    let peerIds = opts.peerIds;
    let title = opts.title;
    const conv = opts.cid ? Store.conv(opts.cid) : null;
    if (!peerIds && conv) {
      peerIds = conv.kind === 'dm' ? [conv.peerId] : conv.memberIds.filter(id => id !== Store.state.meId).slice(0, 8);
      title = Store.convTitle(conv);
    }
    peerIds = peerIds || [];
    if (!peerIds.length) { UI.toast('Add at least one person to call.', 'warn'); return; }

    session = {
      id: U.uid('call'), kind: opts.kind || 'video', peerIds: peerIds,
      title: title || (peerIds.length === 1 ? Store.person(peerIds[0]).name : U.plural(peerIds.length + 1, 'participant')),
      cid: opts.cid || null, meetingId: opts.meetingId || null,
      state: opts.meetingId ? 'lobby' : 'ringing',
      muted: false, camera: opts.kind === 'video', sharing: false, recording: false,
      captions: false, blur: false, background: null, hand: false,
      layout: 'gallery', started: null, elapsed: 0, chat: [], reactions: [],
      participants: [], pinned: null, speaking: null, breakouts: null, notes: '',
      isMeeting: !!opts.meetingId, presenting: false
    };
    session.participants = [Store.state.meId].concat(peerIds).map(function (id, i) {
      return { id: id, muted: i !== 0 && Math.random() > 0.6, camera: i === 0 ? session.camera : Math.random() > 0.35, hand: false, speaking: false, host: i === 0 || id === opts.hostId };
    });

    render();
    if (session.state === 'ringing') simulateRinging();
    else renderLobby();
  };

  Calls.joinMeeting = function (meetingId) {
    const m = Store.meeting(meetingId);
    if (!m) { UI.toast('Meeting not found.', 'error'); return; }
    Calls.start({ meetingId: meetingId, kind: 'video', peerIds: m.participantIds.filter(id => id !== Store.state.meId), title: m.title, hostId: m.organizerId });
  };

  Calls.active = () => !!session;

  /* ------------------------------------------------------------------ */
  function render() {
    if (!session) { root().innerHTML = ''; return; }
    if (session.state === 'ringing') return renderRinging();
    if (session.state === 'lobby') return renderLobby();
    if (session.state === 'failed') return renderFailed();
    if (session.state === 'ended') return;
    renderStage();
  }

  /* ---------------- Ringing ---------------- */
  function renderRinging() {
    const one = session.peerIds.length === 1 ? Store.person(session.peerIds[0]) : null;
    root().innerHTML = '<div class="call-overlay ringing">' +
      '<div class="ring-card">' +
      '<div class="ring-av">' + (one ? UI.avatar(one, 108, { presence: false }) : UI.avatarStack(session.peerIds, 4, 64)) + '</div>' +
      '<h2 class="mt-4">' + U.esc(session.title) + '</h2>' +
      '<div class="muted md mt-1" data-ringstate>Calling…</div>' +
      '<div class="ring-actions mt-6">' +
      '<button class="call-btn danger lg" data-c="cancel" data-tip="Cancel">' + icon('phoneOff') + '</button>' +
      '</div>' +
      '<div class="row gap-2 center mt-6">' +
      '<button class="btn ghost sm" data-c="switch">' + icon(session.kind === 'video' ? 'phone' : 'video') + 'Switch to ' + (session.kind === 'video' ? 'audio' : 'video') + '</button>' +
      '<button class="btn ghost sm" data-c="msg">' + icon('chat') + 'Send a message instead</button>' +
      '</div></div></div>';
    bindCommon();
  }

  function simulateRinging() {
    const el = () => root().querySelector('[data-ringstate]');
    let n = 0;
    session.ringTimer = setInterval(function () {
      if (!session || session.state !== 'ringing') { clearInterval(session && session.ringTimer); return; }
      n++;
      if (el()) el().textContent = n % 2 ? 'Ringing…' : 'Calling…';
      if (n === 5) {
        clearInterval(session.ringTimer);
        const peer = Store.person(session.peerIds[0]);
        if (session.peerIds.length === 1 && ['offline', 'dnd'].includes(peer.presence)) {
          session.state = 'failed';
          session.failReason = peer.presence === 'dnd' ? (peer.first + ' has Do Not Disturb turned on.') : (peer.first + ' is offline and did not pick up.');
          render();
        } else connect();
      }
    }, 1100);
  }

  function connect() {
    session.state = 'live';
    session.started = Date.now();
    render();
    startTicks();
    UI.toast('Connected.', 'success', { duration: 1600 });
  }

  /* ---------------- Failed ---------------- */
  function renderFailed() {
    root().innerHTML = '<div class="call-overlay ringing">' +
      '<div class="ring-card">' +
      '<div class="e-art danger" style="width:84px;height:84px;border-radius:26px;display:grid;place-items:center;background:var(--danger-100);color:var(--danger-500);margin:0 auto">' + icon('phoneMissed') + '</div>' +
      '<h2 class="mt-4">Call not connected</h2>' +
      '<div class="muted md mt-2">' + U.esc(session.failReason || 'The call could not be connected.') + '</div>' +
      '<div class="row gap-2 center mt-6 wrap">' +
      '<button class="btn primary" data-c="retry">' + icon('refresh') + 'Try again</button>' +
      '<button class="btn" data-c="msg">' + icon('chat') + 'Send a message</button>' +
      '<button class="btn" data-c="schedule">' + icon('calendarPlus') + 'Schedule instead</button>' +
      '<button class="btn ghost" data-c="close">Close</button>' +
      '</div></div></div>';
    bindCommon();
  }

  /* ---------------- Lobby / waiting room ---------------- */
  function renderLobby() {
    const m = session.meetingId ? Store.meeting(session.meetingId) : null;
    root().innerHTML = '<div class="call-overlay lobby">' +
      '<div class="lobby-grid">' +
      '<div class="lobby-preview">' +
      '<div class="preview-tile" id="preview-tile">' +
      (session.camera ? '<video id="preview-video" autoplay muted playsinline></video><div class="preview-fallback">' + UI.avatar(Store.me(), 96, { presence: false }) + '</div>'
        : '<div class="preview-off">' + UI.avatar(Store.me(), 96, { presence: false }) + '<div class="tiny muted mt-3">Your camera is off</div></div>') +
      '<div class="preview-controls">' +
      ctrl('mic', session.muted ? 'micOff' : 'mic', session.muted, 'Microphone') +
      ctrl('cam', session.camera ? 'video' : 'videoOff', !session.camera, 'Camera') +
      ctrl('blur', 'sparkles', session.blur, 'Background blur') +
      ctrl('settings', 'settings', false, 'Device settings') +
      '</div></div>' +
      '</div>' +
      '<div class="lobby-side">' +
      '<div class="badge brand mb-3">' + icon('video') + 'Meeting lobby</div>' +
      '<h2>' + U.esc(m ? m.title : session.title) + '</h2>' +
      (m ? '<div class="muted md mt-2">' + U.esc(U.dayLabel(m.start)) + ' · ' + U.esc(U.time(m.start)) + ' – ' + U.esc(U.time(m.end)) + ' · ' + U.esc(U.dur(m.durationMin)) + '</div>' : '') +
      (m ? '<div class="row gap-2 mt-3">' + UI.avatarStack(m.participantIds, 6, 26) + '<span class="tiny muted">' + U.plural(m.participantIds.length, 'invitee') + '</span></div>' : '') +
      '<div class="lobby-waiting mt-5"><div class="panel-title">Already here</div>' +
      (session.peerIds.slice(0, 4).map(id => '<div class="row gap-2 mt-2">' + UI.avatar(id, 26) + '<span class="md">' + U.esc(Store.person(id).name) + '</span>' + (id === (m && m.organizerId) ? '<span class="badge brand">Host</span>' : '') + '</div>').join('')) +
      '</div>' +
      '<div class="col gap-2 mt-6">' +
      '<button class="btn primary xl block" data-c="join">' + icon('video') + 'Join now</button>' +
      '<button class="btn block" data-c="joinaudio">' + icon('phone') + 'Join with audio only</button>' +
      '<button class="btn ghost block" data-c="close">Leave</button>' +
      '</div>' +
      '<div class="banner info mt-4">' + icon('shield') + '<div class="b-body">The host has the lobby enabled. You may wait briefly before being admitted.</div></div>' +
      '</div></div></div>';
    bindCommon();
    if (session.camera) tryCamera('preview-video');
  }
  function ctrl(id, ic, off, tip) {
    return '<button class="call-btn' + (off ? ' off' : '') + '" data-c="' + id + '" data-tip="' + tip + '">' + icon(ic) + '</button>';
  }

  /* ---------------- Live stage ---------------- */
  function renderStage() {
    const isSolo = session.participants.length <= 2;
    root().innerHTML = '<div class="call-overlay stage' + (session.minimized ? ' minimized' : '') + '">' +
      '<div class="stage-top">' +
      '<div class="row gap-3 min0">' +
      '<span class="rec-badge' + (session.recording ? '' : ' hide') + '">' + '<i></i>REC</span>' +
      '<div class="min0"><div class="semi md truncate">' + U.esc(session.title) + '</div>' +
      '<div class="tiny" style="color:rgba(255,255,255,.6)"><span data-elapsed>00:00</span> · ' + U.plural(session.participants.length, 'participant') + (session.isMeeting ? ' · Meeting' : '') + '</div></div>' +
      '</div>' +
      '<div class="row gap-1">' +
      '<button class="stage-btn" data-c="layout" data-tip="Change layout">' + icon(session.layout === 'gallery' ? 'grid' : 'layout') + '</button>' +
      '<button class="stage-btn" data-c="minimize" data-tip="Minimise">' + icon('minimize') + '</button>' +
      '<button class="stage-btn" data-c="fullscreen" data-tip="Full screen">' + icon('maximize') + '</button>' +
      '</div></div>' +

      '<div class="stage-main">' +
      '<div class="stage-video" id="stage-video">' + stageContent() + '</div>' +
      (session.panel ? sidePanel() : '') +
      '</div>' +

      (session.captions ? '<div class="captions" id="captions"></div>' : '') +
      '<div class="reaction-layer" id="reaction-layer"></div>' +

      '<div class="stage-bar">' +
      '<div class="bar-group">' +
      ctrl('mic', session.muted ? 'micOff' : 'mic', session.muted, session.muted ? 'Unmute (M)' : 'Mute (M)') +
      ctrl('cam', session.camera ? 'video' : 'videoOff', !session.camera, session.camera ? 'Stop video' : 'Start video') +
      ctrl('share', 'screenShare', false, 'Share your screen') +
      '</div>' +
      '<div class="bar-group">' +
      ctrl('hand', 'hand', false, 'Raise hand') +
      ctrl('react', 'smile', false, 'Send a reaction') +
      ctrl('chat', 'chat', false, 'Meeting chat') +
      ctrl('people', 'users', false, 'Participants') +
      ctrl('more', 'moreH', false, 'More options') +
      '</div>' +
      '<div class="bar-group">' +
      '<button class="call-btn danger wide" data-c="end">' + icon('phoneOff') + '<span>' + (session.isMeeting ? 'Leave' : 'End') + '</span></button>' +
      '</div></div>' +
      '</div>';
    bindCommon();
    bindStage();
    if (session.camera) tryCamera('me-video');
    if (session.captions) runCaptions();
  }

  function stageContent() {
    if (session.sharing || session.presenting) {
      return '<div class="share-view">' +
        '<div class="share-frame">' +
        (session.shareStream ? '<video id="share-video" autoplay playsinline muted></video>' :
          '<div class="share-mock"><div class="share-mock-bar"><i></i><i></i><i></i><span>Apollo — Launch readiness.pptx</span></div>' +
          '<div class="share-mock-body"><h3>Apollo GA — readiness</h3>' +
          '<ul><li>Load test: p95 412 ms at 3× peak</li><li>RC3 green on all environments</li><li>Rollback: single feature flag</li><li>Open: German translation (lands tomorrow)</li></ul>' +
          '<div class="mock-chart">' + [62, 78, 91, 84, 96, 88].map(v => '<i style="height:' + v + '%"></i>').join('') + '</div></div></div>') +
        '<div class="share-label">' + icon('screenShare') + (session.sharing ? 'You are presenting' : U.esc(Store.person(session.peerIds[0]).first) + ' is presenting') + '</div>' +
        '</div>' +
        '<div class="share-strip">' + session.participants.slice(0, 6).map(tile).join('') + '</div>' +
        '</div>';
    }
    const n = session.participants.length;
    const cls = session.layout === 'speaker' ? 'speaker' : ('grid g' + Math.min(9, n));
    if (session.layout === 'speaker') {
      const active = session.participants.find(p => p.id === (session.pinned || session.speaking)) || session.participants[1] || session.participants[0];
      return '<div class="tiles speaker">' + tile(active, true) +
        '<div class="speaker-strip">' + session.participants.filter(p => p.id !== active.id).map(p => tile(p)).join('') + '</div></div>';
    }
    return '<div class="tiles ' + cls + '">' + session.participants.map(p => tile(p)).join('') + '</div>';
  }

  function tile(p, big) {
    const person = Store.person(p.id);
    const me = p.id === Store.state.meId;
    return '<div class="v-tile' + (p.speaking ? ' speaking' : '') + (big ? ' big' : '') + '" data-tile="' + p.id + '">' +
      (p.camera
        ? (me ? '<video id="me-video" autoplay muted playsinline></video><div class="tile-fallback">' + UI.avatar(person, big ? 96 : 56, { presence: false }) + '</div>'
              : '<div class="sim-video" style="background:' + U.avColor(p.id) + '"><span class="sim-noise"></span>' + UI.avatar(person, big ? 96 : 56, { presence: false }) + '</div>')
        : '<div class="tile-off">' + UI.avatar(person, big ? 96 : 56, { presence: false }) + '</div>') +
      '<div class="tile-bar">' +
      (p.muted ? '<span class="t-mic off">' + icon('micOff') + '</span>' : '<span class="t-mic">' + icon('mic') + '</span>') +
      '<span class="t-name truncate">' + U.esc(me ? 'You' : person.name) + '</span>' +
      (p.host ? '<span class="badge brand">Host</span>' : '') +
      '</div>' +
      (p.hand ? '<span class="t-hand">' + icon('hand') + '</span>' : '') +
      '<button class="t-menu" data-tmenu="' + p.id + '">' + icon('moreH') + '</button>' +
      '</div>';
  }

  function sidePanel() {
    const tab = session.panel;
    const head = '<div class="sp-head"><div class="tabs pill">' +
      [['chat', 'Chat'], ['people', 'People'], ['notes', 'Notes'], ['more', 'Tools']].map(t =>
        '<button data-sp="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') +
      '</div><button class="stage-btn" data-c="closepanel">' + icon('x') + '</button></div>';
    let body = '';
    if (tab === 'chat') {
      body = '<div class="sp-body" id="call-chat">' + (session.chat.length ? session.chat.map(function (m) {
        return '<div class="cc-msg"><div class="row gap-2"><span class="semi tiny">' + U.esc(Store.person(m.authorId).first) + '</span>' +
          '<span class="tiny subtle">' + U.esc(U.time(m.ts)) + '</span></div><div class="md">' + U.renderRich(m.text) + '</div></div>';
      }).join('') : '<div class="empty" style="padding:24px"><p class="muted tiny">No messages yet. Chat here is shared with everyone in the call.</p></div>') + '</div>' +
        '<div class="sp-foot"><div class="input-wrap grow">' + icon('chat') + '<input class="input" data-ccinput placeholder="Message everyone…"></div>' +
        '<button class="btn primary sm" data-ccsend>' + icon('send') + '</button></div>';
    } else if (tab === 'people') {
      body = '<div class="sp-body">' +
        '<div class="row between mb-3"><span class="panel-title" style="margin:0">' + U.plural(session.participants.length, 'participant') + '</span>' +
        '<button class="btn sm soft" data-c="invite">' + icon('userPlus') + 'Invite</button></div>' +
        session.participants.map(function (p) {
          const person = Store.person(p.id);
          return '<div class="lrow">' + UI.avatar(person, 30) +
            '<span class="grow min0"><span class="semi md block truncate">' + U.esc(p.id === Store.state.meId ? person.name + ' (you)' : person.name) + '</span>' +
            '<span class="tiny muted truncate">' + U.esc(person.title) + '</span></span>' +
            (p.hand ? '<span class="badge warning">' + icon('hand') + '</span>' : '') +
            (p.host ? '<span class="badge brand">Host</span>' : '') +
            '<button class="icon-btn sm" data-pmute="' + p.id + '" data-tip="' + (p.muted ? 'Muted' : 'Mute') + '">' + icon(p.muted ? 'micOff' : 'mic') + '</button>' +
            '<button class="icon-btn sm" data-tmenu="' + p.id + '">' + icon('moreH') + '</button></div>';
        }).join('') +
        '<div class="divider"></div>' +
        '<div class="panel-title">Waiting in the lobby</div>' +
        '<div class="lrow">' + UI.avatar('p47', 30) + '<span class="grow min0"><span class="semi md block">Ryan Novak</span><span class="tiny muted">External Collaborator</span></span>' +
        '<button class="btn sm soft" data-admit="p47">Admit</button><button class="btn sm ghost" data-deny="p47">Deny</button></div>' +
        '</div>';
    } else if (tab === 'notes') {
      body = '<div class="sp-body">' +
        '<div class="row between mb-2"><span class="panel-title" style="margin:0">Shared meeting notes</span>' +
        '<button class="btn sm soft" data-c="ainotes">' + icon('sparkles') + 'AI notes</button></div>' +
        '<textarea class="textarea" data-notes style="min-height:280px" placeholder="Everyone in the meeting can edit these notes…">' + U.esc(session.notes) + '</textarea>' +
        '<div class="tiny subtle mt-2">Notes are saved to the meeting and shared with all participants when it ends.</div></div>';
    } else {
      body = '<div class="sp-body">' +
        toolRow('whiteboard', 'whiteboard', 'Whiteboard', 'Sketch together on a shared canvas') +
        toolRow('poll', 'poll', 'Poll', 'Ask everyone a quick question') +
        toolRow('breakout', 'breakout', 'Breakout rooms', 'Split into smaller groups') +
        toolRow('transcript', 'captions', 'Live transcript', 'Automatic transcription with speaker labels') +
        toolRow('bg', 'image', 'Virtual background', 'Blur or replace what is behind you') +
        toolRow('devices', 'settings', 'Devices', 'Microphone, camera and speaker selection') +
        toolRow('summary', 'sparkles', 'AI meeting summary', 'Generate notes, decisions and action items') +
        '</div>';
    }
    return '<div class="stage-panel">' + head + body + '</div>';
  }
  function toolRow(id, ic, t, d) {
    return '<button class="tool-row" data-tool2="' + id + '"><span class="tr-ic">' + icon(ic) + '</span>' +
      '<span class="grow"><span class="semi md block">' + t + '</span><span class="tiny muted">' + d + '</span></span>' + icon('chevronRight') + '</button>';
  }

  /* ---------------- Behaviour ---------------- */
  function bindCommon() {
    U.qsa('[data-c]', root()).forEach(function (b) {
      b.onclick = function () { action(b.dataset.c, b); };
    });
  }

  function bindStage() {
    U.qsa('[data-sp]', root()).forEach(b => b.onclick = () => { session.panel = b.dataset.sp; render(); });
    U.qsa('[data-tmenu]', root()).forEach(b => b.onclick = (e) => { e.stopPropagation(); participantMenu(b, b.dataset.tmenu); });
    U.qsa('[data-pmute]', root()).forEach(b => b.onclick = function () {
      const p = session.participants.find(x => x.id === b.dataset.pmute);
      p.muted = !p.muted; render();
      if (p.id !== Store.state.meId) UI.toast(p.muted ? Store.person(p.id).first + ' has been muted.' : 'Asked ' + Store.person(p.id).first + ' to unmute.', 'success');
    });
    U.qsa('[data-tool2]', root()).forEach(b => b.onclick = () => tool(b.dataset.tool2));
    U.qsa('[data-admit]', root()).forEach(b => b.onclick = function () {
      session.participants.push({ id: b.dataset.admit, muted: true, camera: false, hand: false, host: false });
      session.peerIds.push(b.dataset.admit);
      render(); UI.toast('Ryan Novak was admitted.', 'success');
    });
    U.qsa('[data-deny]', root()).forEach(b => b.onclick = () => { UI.toast('Ryan Novak was not admitted.', 'info'); b.closest('.lrow').remove(); });
    const cci = root().querySelector('[data-ccinput]');
    if (cci) {
      const send = function () {
        if (!cci.value.trim()) return;
        session.chat.push({ authorId: Store.state.meId, ts: new Date().toISOString(), text: cci.value.trim() });
        cci.value = ''; render();
        setTimeout(function () {
          if (!session || Math.random() > 0.6) return;
          session.chat.push({ authorId: session.peerIds[0], ts: new Date().toISOString(), text: U.sample(['Good point.', 'Agreed 👍', 'Can you drop the link here?', 'Noted — I will follow up after.']) });
          render();
        }, 2200);
      };
      cci.onkeydown = e => { if (e.key === 'Enter') send(); };
      const sb = root().querySelector('[data-ccsend]'); if (sb) sb.onclick = send;
      cci.focus();
    }
    const notes = root().querySelector('[data-notes]');
    if (notes) notes.addEventListener('input', () => { session.notes = notes.value; });
    U.qsa('[data-tile]', root()).forEach(function (t) {
      t.ondblclick = function () { session.pinned = session.pinned === t.dataset.tile ? null : t.dataset.tile; session.layout = session.pinned ? 'speaker' : 'gallery'; render(); };
    });
    if (session.shareStream) {
      const v = root().querySelector('#share-video');
      if (v) v.srcObject = session.shareStream;
    }
  }

  function action(a, btn) {
    switch (a) {
      case 'cancel': case 'close': end(true); break;
      case 'retry': session.state = 'ringing'; render(); simulateRinging(); break;
      case 'msg': { const cid = session.cid || (session.peerIds[0] ? Store.openDM(session.peerIds[0]).id : null); end(true); if (cid) App.route('#/messages/' + cid); break; }
      case 'schedule': { const ids = session.peerIds.slice(); end(true); Modals.scheduleMeeting({ participantIds: ids }); break; }
      case 'switch': session.kind = session.kind === 'video' ? 'audio' : 'video'; session.camera = session.kind === 'video'; render(); break;
      case 'join': session.camera = true; connect(); break;
      case 'joinaudio': session.camera = false; connect(); break;
      case 'mic': session.muted = !session.muted; me().muted = session.muted; render(); break;
      case 'cam': session.camera = !session.camera; me().camera = session.camera; render(); break;
      case 'blur': session.blur = !session.blur; UI.toast(session.blur ? 'Background blur on.' : 'Background blur off.', 'success'); render(); break;
      case 'settings': case 'devices': deviceSettings(); break;
      case 'share': toggleShare(); break;
      case 'hand': raiseHand(); break;
      case 'react': reactionMenu(btn); break;
      case 'chat': session.panel = session.panel === 'chat' ? null : 'chat'; render(); break;
      case 'people': session.panel = session.panel === 'people' ? null : 'people'; render(); break;
      case 'closepanel': session.panel = null; render(); break;
      case 'layout': session.layout = session.layout === 'gallery' ? 'speaker' : 'gallery'; render(); break;
      case 'minimize': session.minimized = !session.minimized; render(); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'more': moreMenu(btn); break;
      case 'invite': inviteToCall(); break;
      case 'ainotes': aiNotes(); break;
      case 'end': endConfirm(); break;
    }
  }
  function me() { return session.participants.find(p => p.id === Store.state.meId); }

  function moreMenu(btn) {
    UI.menu(btn, [
      { label: session.recording ? 'Stop recording' : 'Start recording', icon: 'record', onClick: toggleRecording },
      { label: session.captions ? 'Turn off live captions' : 'Turn on live captions', icon: 'captions', onClick: () => { session.captions = !session.captions; render(); UI.toast(session.captions ? 'Live captions on.' : 'Live captions off.', 'success'); } },
      { label: 'Live transcript', icon: 'fileText', onClick: () => tool('transcript') },
      { sep: true },
      { label: 'Whiteboard', icon: 'whiteboard', onClick: () => tool('whiteboard') },
      { label: 'Create a poll', icon: 'poll', onClick: () => tool('poll') },
      { label: 'Breakout rooms', icon: 'breakout', onClick: () => tool('breakout') },
      { label: 'Shared notes', icon: 'edit', onClick: () => { session.panel = 'notes'; render(); } },
      { sep: true },
      { label: 'Virtual background', icon: 'image', onClick: () => tool('bg') },
      { label: 'Device settings', icon: 'settings', onClick: deviceSettings },
      { label: 'Meeting details', icon: 'info', onClick: meetingDetails },
      { label: 'Copy join link', icon: 'link', onClick: () => UI.copyToast('https://meet.ithrive.app/' + session.id, 'Meeting link copied.') }
    ], { align: 'right', width: 250 });
  }

  function toggleRecording() {
    session.recording = !session.recording;
    render();
    if (session.recording) {
      UI.toast('Recording started. Everyone has been notified.', 'success');
      session.chat.push({ authorId: Store.state.meId, ts: new Date().toISOString(), text: 'Recording started — this meeting is being recorded.' });
    } else UI.toast('Recording stopped. It will appear in Files when processed.', 'success');
  }

  function raiseHand() {
    session.hand = !session.hand;
    me().hand = session.hand;
    render();
    if (session.hand) {
      UI.toast('Hand raised. The host has been notified.', 'success');
      setTimeout(function () {
        if (!session) return;
        const other = session.participants.find(p => p.id !== Store.state.meId);
        if (other && Math.random() > 0.4) { other.hand = true; render(); }
      }, 3000);
    }
  }

  function reactionMenu(btn) {
    const emojis = ['👍', '👏', '🎉', '❤️', '😂', '😮', '🙌', '💡'];
    const pop = UI.menu(btn, [], { align: 'right', width: 220 });
    pop.el.innerHTML = '<div class="emoji-grid" style="padding:6px">' + emojis.map(e => '<button class="emoji-btn" data-re="' + e + '">' + e + '</button>').join('') + '</div>';
    U.qsa('[data-re]', pop.el).forEach(b => b.onclick = function () { flyReaction(b.dataset.re); UI.closeMenu(); });
  }
  function flyReaction(e) {
    const layer = root().querySelector('#reaction-layer'); if (!layer) return;
    const n = U.el('span', { class: 'fly-react' }, e);
    n.style.left = (30 + Math.random() * 40) + '%';
    layer.appendChild(n);
    setTimeout(() => n.remove(), 2600);
    setTimeout(function () {
      if (!session) return;
      const layer2 = root().querySelector('#reaction-layer'); if (!layer2) return;
      const n2 = U.el('span', { class: 'fly-react' }, U.sample(['👍', '🎉', '👏']));
      n2.style.left = (20 + Math.random() * 60) + '%';
      layer2.appendChild(n2); setTimeout(() => n2.remove(), 2600);
    }, 700);
  }

  function toggleShare() {
    if (session.sharing) {
      session.sharing = false;
      if (session.shareStream) { session.shareStream.getTracks().forEach(t => t.stop()); session.shareStream = null; }
      render(); UI.toast('You stopped sharing.', 'info');
      return;
    }
    const go = function (stream) {
      session.sharing = true; session.shareStream = stream || null;
      render();
      UI.toast('You are now sharing your screen.', 'success');
      if (stream) stream.getVideoTracks()[0].addEventListener('ended', function () { session.sharing = false; session.shareStream = null; render(); });
    };
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia({ video: true }).then(go).catch(function () {
        UI.toast('Screen sharing was not permitted — showing a simulated share for the demo.', 'warn');
        go(null);
      });
    } else go(null);
  }

  function tryCamera(id) {
    const v = root().querySelector('#' + id);
    if (!v) return;
    if (session.stream) { v.srcObject = session.stream; return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(function (s) { session.stream = s; const el = root().querySelector('#' + id); if (el) { el.srcObject = s; el.parentElement.classList.add('has-video'); } })
      .catch(function () { /* fall back to the avatar tile silently */ });
  }

  function runCaptions() {
    const box = root().querySelector('#captions'); if (!box) return;
    let i = 0;
    clearInterval(session.capTimer);
    session.capTimer = setInterval(function () {
      if (!session || !session.captions) { clearInterval(session && session.capTimer); return; }
      const line = CAPTION_LINES[i % CAPTION_LINES.length];
      const speaker = Store.person(session.participants[line[1] % session.participants.length].id);
      const b = root().querySelector('#captions');
      if (!b) { clearInterval(session.capTimer); return; }
      b.innerHTML = '<span class="cap-speaker">' + U.esc(speaker.first) + '</span> ' + U.esc(line[0]);
      /* highlight the speaker */
      session.participants.forEach(p => p.speaking = false);
      const sp = session.participants[line[1] % session.participants.length];
      sp.speaking = true; session.speaking = sp.id;
      U.qsa('.v-tile', root()).forEach(t => t.classList.toggle('speaking', t.dataset.tile === sp.id));
      i++;
    }, 3600);
  }

  function startTicks() {
    clearInterval(session.tick);
    session.tick = setInterval(function () {
      if (!session || session.state !== 'live') { clearInterval(session && session.tick); return; }
      session.elapsed = Math.floor((Date.now() - session.started) / 1000);
      const e = root().querySelector('[data-elapsed]');
      if (e) e.textContent = U.durSec(session.elapsed);
      /* simulate speaking */
      if (!session.captions && session.elapsed % 4 === 0) {
        session.participants.forEach(p => p.speaking = false);
        const sp = U.sample(session.participants);
        sp.speaking = true; session.speaking = sp.id;
        U.qsa('.v-tile', root()).forEach(t => t.classList.toggle('speaking', t.dataset.tile === sp.id));
      }
    }, 1000);
  }

  function participantMenu(btn, id) {
    const p = session.participants.find(x => x.id === id);
    const person = Store.person(id);
    const isMe = id === Store.state.meId;
    UI.menu(btn, [
      { label: 'Pin to main view', icon: 'pin', onClick: () => { session.pinned = id; session.layout = 'speaker'; render(); } },
      { label: 'View profile', icon: 'contacts', disabled: isMe, onClick: () => Modals.personProfile(id) },
      { label: 'Send a direct message', icon: 'chat', disabled: isMe, onClick: () => { const c = Store.openDM(id); end(true); App.route('#/messages/' + c.id); } },
      { sep: true },
      { label: p.muted ? 'Ask to unmute' : 'Mute participant', icon: 'micOff', disabled: isMe, onClick: () => { p.muted = !p.muted; render(); UI.toast(p.muted ? person.first + ' was muted.' : 'Asked ' + person.first + ' to unmute.', 'success'); } },
      { label: 'Make host', icon: 'shield', disabled: isMe, onClick: () => { session.participants.forEach(x => x.host = false); p.host = true; render(); UI.toast(person.first + ' is now the host.', 'success'); } },
      { label: 'Move to breakout room', icon: 'breakout', disabled: isMe, onClick: () => tool('breakout') },
      { label: 'Remove from call', icon: 'userX', danger: true, disabled: isMe, onClick: function () {
        UI.confirm({ title: 'Remove ' + person.name + '?', body: 'They will be disconnected immediately and cannot rejoin unless invited again.', danger: true, confirmLabel: 'Remove' })
          .then(function (ok) {
            if (!ok) return;
            session.participants = session.participants.filter(x => x.id !== id);
            session.peerIds = session.peerIds.filter(x => x !== id);
            render(); UI.toast(person.first + ' was removed from the call.', 'success');
          });
      } }
    ], { align: 'right' });
  }

  function inviteToCall() {
    const exclude = session.participants.map(p => p.id);
    const picker = UI.peoplePicker({ exclude: exclude, placeholder: 'Search people to invite…' });
    UI.modal({
      icon: 'userPlus', title: 'Invite to this call', sub: session.title, body: picker.el,
      actions: [
        { label: 'Copy join link', variant: 'ghost', close: false, onClick: () => UI.copyToast('https://meet.ithrive.app/' + session.id, 'Join link copied.') },
        { label: 'Invite', variant: 'primary', onClick: function () {
          const ids = picker.get();
          if (!ids.length) { UI.toast('Choose at least one person.', 'warn'); return false; }
          ids.forEach(id => { session.participants.push({ id: id, muted: true, camera: false, hand: false, host: false }); session.peerIds.push(id); });
          render(); UI.toast(U.plural(ids.length, 'person', 'people') + ' invited.', 'success');
        } }
      ]
    });
  }

  function deviceSettings() {
    const body = U.el('div', { class: 'col gap-4' });
    body.innerHTML =
      UI.field('Microphone', '<select class="select"><option>MacBook Pro Microphone (built-in)</option><option>Jabra Evolve2 65</option><option>Studio USB Mic</option></select>') +
      '<div class="row gap-2 tiny muted">' + icon('mic') + '<div class="progress grow"><i style="width:42%"></i></div><span>Input level</span></div>' +
      UI.field('Speaker', '<select class="select"><option>MacBook Pro Speakers</option><option>Jabra Evolve2 65</option><option>Studio Display</option></select>') +
      UI.field('Camera', '<select class="select"><option>FaceTime HD Camera</option><option>Logitech Brio 4K</option><option>None</option></select>') +
      '<div class="divider"></div>' +
      UI.switchRow('Noise suppression', 'Filter keyboard and background noise', true, 'ns') +
      UI.switchRow('Echo cancellation', 'Recommended when not using headphones', true, 'ec') +
      UI.switchRow('Automatically join muted', 'Every meeting starts with your mic off', false, 'jm') +
      UI.switchRow('High definition video', 'Uses more bandwidth', true, 'hd');
    UI.modal({ icon: 'settings', title: 'Device settings', size: 'sm', body: body, actions: [{ label: 'Test speaker', variant: 'ghost', close: false, onClick: () => UI.toast('Playing test tone…', 'info') }, { label: 'Done', variant: 'primary' }] });
    UI.bindSwitches(body);
  }

  function meetingDetails() {
    const m = session.meetingId ? Store.meeting(session.meetingId) : null;
    UI.modal({
      icon: 'info', title: 'Meeting details', size: 'sm',
      body: '<div class="col gap-3 md">' +
        detailRow('Title', m ? m.title : session.title) +
        detailRow('Started', session.started ? U.time(new Date(session.started)) : '—') +
        detailRow('Duration', U.durSec(session.elapsed)) +
        detailRow('Participants', String(session.participants.length)) +
        detailRow('Recording', session.recording ? 'In progress' : 'Off') +
        detailRow('Join link', 'meet.ithrive.app/' + session.id) +
        detailRow('Dial-in', '+351 21 000 4821 · PIN 449 201#') +
        '</div>',
      actions: [{ label: 'Copy link', variant: 'ghost', onClick: () => UI.copyToast('https://meet.ithrive.app/' + session.id, 'Link copied.') }, { label: 'Close', variant: 'primary' }]
    });
  }
  function detailRow(k, v) { return '<div class="row between gap-4"><span class="muted">' + U.esc(k) + '</span><span class="semi text-right">' + U.esc(v) + '</span></div>'; }

  /* ---------------- Tools ---------------- */
  function tool(id) {
    if (id === 'whiteboard') return whiteboard();
    if (id === 'poll') return Modals.createPoll(null, function (p) {
      session.chat.push({ authorId: Store.state.meId, ts: new Date().toISOString(), text: '📊 Poll: ' + p.question });
      session.panel = 'chat'; render(); UI.toast('Poll launched to all participants.', 'success');
    });
    if (id === 'breakout') return breakouts();
    if (id === 'transcript') return transcript();
    if (id === 'bg') return backgrounds();
    if (id === 'devices') return deviceSettings();
    if (id === 'summary') return aiNotes();
  }

  function whiteboard() {
    const body = U.el('div');
    body.innerHTML = '<div class="whiteboard"><canvas id="wb-canvas" width="900" height="480"></canvas>' +
      '<div class="wb-tools">' +
      '<button class="icon-btn active" data-wb="pen" data-tip="Pen">' + icon('edit') + '</button>' +
      '<button class="icon-btn" data-wb="erase" data-tip="Eraser">' + icon('minus') + '</button>' +
      '<input type="color" value="#12a583" data-wbcolor class="wb-color">' +
      '<button class="icon-btn" data-wb="clear" data-tip="Clear">' + icon('trash') + '</button>' +
      '</div></div><div class="tiny subtle mt-2">Everyone in the meeting can draw. The board is saved to the meeting notes when it ends.</div>';
    UI.modal({ icon: 'whiteboard', title: 'Whiteboard', size: 'xl', body: body, actions: [{ label: 'Save to notes', variant: 'ghost', onClick: () => UI.toast('Whiteboard saved to the meeting notes.', 'success') }, { label: 'Close', variant: 'primary' }] });
    const cv = body.querySelector('#wb-canvas');
    const ctx = cv.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3;
    let drawing = false, mode = 'pen', color = '#12a583';
    function pos(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) }; }
    cv.addEventListener('mousedown', e => { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
    cv.addEventListener('mousemove', function (e) {
      if (!drawing) return; const p = pos(e);
      ctx.strokeStyle = mode === 'erase' ? '#ffffff' : color;
      ctx.lineWidth = mode === 'erase' ? 22 : 3;
      ctx.lineTo(p.x, p.y); ctx.stroke();
    });
    window.addEventListener('mouseup', () => drawing = false);
    U.qsa('[data-wb]', body).forEach(b => b.onclick = function () {
      if (b.dataset.wb === 'clear') { ctx.clearRect(0, 0, cv.width, cv.height); return; }
      mode = b.dataset.wb;
      U.qsa('[data-wb]', body).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
    body.querySelector('[data-wbcolor]').addEventListener('input', e => color = e.target.value);
    /* seed a friendly starting sketch */
    ctx.strokeStyle = '#12a583'; ctx.lineWidth = 3;
    ctx.strokeRect(60, 60, 200, 90); ctx.strokeRect(360, 60, 200, 90); ctx.strokeRect(660, 60, 180, 90);
    ctx.beginPath(); ctx.moveTo(260, 105); ctx.lineTo(360, 105); ctx.moveTo(560, 105); ctx.lineTo(660, 105); ctx.stroke();
    ctx.fillStyle = '#0b6e59'; ctx.font = '600 16px Inter, sans-serif';
    ctx.fillText('Dispatch event', 100, 110); ctx.fillText('Routing service', 400, 110); ctx.fillText('Read model', 700, 110);
  }

  function breakouts() {
    const body = U.el('div', { class: 'col gap-4' });
    const rooms = session.breakouts || [
      { name: 'Room 1 — Readiness', members: session.participants.slice(0, Math.ceil(session.participants.length / 2)).map(p => p.id) },
      { name: 'Room 2 — Comms', members: session.participants.slice(Math.ceil(session.participants.length / 2)).map(p => p.id) }
    ];
    function draw() {
      body.innerHTML = '<div class="tiny muted">Participants are assigned automatically. You can move anyone between rooms before opening them.</div>' +
        rooms.map(function (r, i) {
          return '<div class="card pad"><div class="row between mb-2"><span class="semi md">' + U.esc(r.name) + '</span>' +
            '<span class="badge">' + U.plural(r.members.length, 'person', 'people') + '</span></div>' +
            '<div class="chip-row">' + r.members.map(id => '<span class="chip">' + UI.avatar(id, 18, { presence: false }) + U.esc(Store.person(id).first) + '</span>').join('') + '</div></div>';
        }).join('') +
        '<button class="btn ghost block" data-addroom>' + icon('plus') + 'Add a room</button>';
      body.querySelector('[data-addroom]').onclick = function () {
        rooms.push({ name: 'Room ' + (rooms.length + 1), members: [] }); draw();
      };
    }
    draw();
    UI.modal({
      icon: 'breakout', title: 'Breakout rooms', sub: rooms.length + ' rooms · ' + session.participants.length + ' participants', body: body,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Open rooms', variant: 'primary', onClick: function () {
        session.breakouts = rooms;
        UI.toast('Breakout rooms opened. Everyone has been moved.', 'success', { action: 'Close rooms', onAction: () => { session.breakouts = null; UI.toast('Everyone is back in the main room.', 'success'); } });
      } }]
    });
  }

  function transcript() {
    const m = session.meetingId ? Store.meeting(session.meetingId) : { title: session.title, durationMin: Math.max(1, Math.round(session.elapsed / 60)), participantIds: session.participants.map(p => p.id), start: new Date(session.started || Date.now()).toISOString() };
    const body = U.el('div');
    body.innerHTML = '<div class="ai-block"><div class="row gap-2 mb-3">' + icon('captions') + '<span class="semi md">Live transcript</span><span class="badge success">Recording</span></div>' +
      '<div class="transcript" data-tx></div></div>';
    UI.modal({ icon: 'captions', title: 'Live transcript', sub: m.title, size: 'lg', body: body, actions: [{ label: 'Download .txt', variant: 'ghost', onClick: () => UI.toast('Transcript downloaded.', 'success') }, { label: 'Close', variant: 'primary' }] });
    const box = body.querySelector('[data-tx]');
    const lines = AI.transcript(m);
    let i = 0;
    const iv = setInterval(function () {
      if (i >= lines.length || !document.body.contains(box)) { clearInterval(iv); return; }
      const l = lines[i++];
      box.insertAdjacentHTML('beforeend', '<div class="tx-line"><span class="tx-at mono tiny">' + l.at + '</span>' +
        UI.avatar(l.speakerId, 22) + '<span class="semi tiny">' + U.esc(Store.person(l.speakerId).first) + '</span>' +
        '<span class="md">' + U.esc(l.text) + '</span></div>');
      box.scrollTop = box.scrollHeight;
    }, 420);
  }

  function backgrounds() {
    const opts = [
      { id: 'none', label: 'None', style: 'background:var(--surface-3)' },
      { id: 'blur', label: 'Blur', style: 'background:linear-gradient(135deg,#cbd5e1,#94a3b8);filter:blur(1px)' },
      { id: 'office', label: 'Lisbon office', style: 'background:linear-gradient(135deg,#12a583,#0b483d)' },
      { id: 'studio', label: 'Studio', style: 'background:linear-gradient(135deg,#1e2a3c,#0b131d)' },
      { id: 'warm', label: 'Warm', style: 'background:linear-gradient(135deg,#ff7a45,#c2451a)' },
      { id: 'aurora', label: 'Aurora', style: 'background:linear-gradient(135deg,#7c5cff,#12a583)' }
    ];
    const body = U.el('div');
    body.innerHTML = '<div class="bg-grid">' + opts.map(o =>
      '<button class="bg-tile' + (session.background === o.id || (!session.background && o.id === 'none') ? ' on' : '') + '" data-bg="' + o.id + '">' +
      '<span class="bg-swatch" style="' + o.style + '"></span><span class="tiny semi">' + o.label + '</span></button>').join('') + '</div>' +
      '<button class="btn ghost block mt-3" data-upbg>' + icon('upload') + 'Upload your own image</button>';
    UI.modal({ icon: 'image', title: 'Virtual background', size: 'sm', body: body, actions: [{ label: 'Done', variant: 'primary' }] });
    U.qsa('[data-bg]', body).forEach(b => b.onclick = function () {
      session.background = b.dataset.bg; session.blur = b.dataset.bg === 'blur';
      U.qsa('[data-bg]', body).forEach(x => x.classList.remove('on')); b.classList.add('on');
      UI.toast('Background updated.', 'success');
    });
    body.querySelector('[data-upbg]').onclick = () => UI.toast('Choose an image from your device in production.', 'info');
  }

  function aiNotes() {
    const m = session.meetingId ? Store.meeting(session.meetingId) : {
      id: session.id, title: session.title, organizerId: Store.state.meId,
      participantIds: session.participants.map(p => p.id), durationMin: Math.max(1, Math.round(session.elapsed / 60)),
      description: '', start: new Date(session.started || Date.now()).toISOString()
    };
    Modals.meetingSummary(m, session.notes);
  }

  /* ---------------- Ending ---------------- */
  function endConfirm() {
    const host = me().host;
    if (session.isMeeting && host) {
      UI.menu(root().querySelector('[data-c="end"]'), [
        { label: 'Leave the meeting', icon: 'logout', onClick: () => end() },
        { label: 'End meeting for everyone', icon: 'phoneOff', danger: true, onClick: () => end() }
      ], { align: 'right' });
    } else end();
  }

  function end(silent) {
    if (!session) return;
    const s = session;
    clearInterval(s.tick); clearInterval(s.ringTimer); clearInterval(s.capTimer);
    if (s.stream) s.stream.getTracks().forEach(t => t.stop());
    if (s.shareStream) s.shareStream.getTracks().forEach(t => t.stop());
    session = null;
    root().innerHTML = '';
    if (silent || s.state !== 'live') { if (s.state === 'ringing') Store.logCall({ kind: s.kind, direction: 'out', peerIds: s.peerIds, durationSec: 0, missed: true }); return; }

    Store.logCall({ kind: s.kind, direction: 'out', peerIds: s.peerIds, durationSec: s.elapsed, recorded: s.recording });
    if (s.cid) {
      Store.sendMessage(s.cid, { text: '', callInfo: { kind: s.kind, durationSec: s.elapsed, missed: false, participants: s.participants.length } });
    }
    App.renderShell();
    UI.toast('Call ended · ' + U.durSec(s.elapsed), 'success', {
      action: s.elapsed > 30 ? 'AI summary' : null,
      onAction: function () {
        Modals.meetingSummary({
          id: s.id, title: s.title, organizerId: Store.state.meId, participantIds: s.participants.map(p => p.id),
          durationMin: Math.max(1, Math.round(s.elapsed / 60)), description: '', start: new Date(s.started).toISOString()
        }, s.notes);
      }
    });
  }

  function toggleFullscreen() {
    const el = root().querySelector('.call-overlay');
    if (!document.fullscreenElement) { el.requestFullscreen && el.requestFullscreen().catch(() => UI.toast('Full screen was blocked by the browser.', 'warn')); }
    else document.exitFullscreen();
  }

  /* Keyboard shortcuts while in a call */
  document.addEventListener('keydown', function (e) {
    if (!session || session.state !== 'live') return;
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'm' || e.key === 'M') { action('mic'); }
    if (e.key === 'v' || e.key === 'V') { action('cam'); }
    if (e.key === 'h' || e.key === 'H') { action('hand'); }
  });

  /* Simulated incoming call, used by the demo trigger in the top bar */
  Calls.incoming = function (fromId) {
    const p = Store.person(fromId || 'p10');
    const el = U.el('div', { class: 'incoming-call' });
    el.innerHTML = '<div class="ic-inner">' + UI.avatar(p, 46) +
      '<div class="grow min0"><div class="semi md truncate">' + U.esc(p.name) + '</div>' +
      '<div class="tiny muted">Incoming video call · ' + U.esc(p.title) + '</div></div>' +
      '<button class="call-btn danger sm" data-ic="decline" data-tip="Decline">' + icon('phoneOff') + '</button>' +
      '<button class="call-btn go sm" data-ic="accept" data-tip="Accept">' + icon('video') + '</button></div>';
    document.body.appendChild(el);
    const kill = setTimeout(function () {
      el.remove();
      Store.pushNotification({ type: 'call', actorId: p.id, target: { kind: 'dm', id: 'd-' + p.id }, text: 'missed video call', preview: p.name + ' tried to reach you' });
      UI.toast('Missed call from ' + p.first + '.', 'warn');
    }, 12000);
    el.querySelector('[data-ic="decline"]').onclick = () => { clearTimeout(kill); el.remove(); UI.toast('Call declined.', 'info'); };
    el.querySelector('[data-ic="accept"]').onclick = function () {
      clearTimeout(kill); el.remove();
      Calls.start({ peerIds: [p.id], kind: 'video', cid: 'd-' + p.id });
      setTimeout(connect, 200);
    };
  };

  g.Calls = Calls;
})(window);
