/* ===== iThrive — Call history ===== */
(function (g) {
  const CallsView = { tab: 'all' };

  CallsView.render = function (main) {
    main.className = 'main plain';
    const missed = Store.state.calls.filter(c => c.missed).length;
    main.innerHTML =
      '<div class="view-head"><div class="vh-main"><h2>' + icon('phone') + 'Calls</h2>' +
      '<div class="vh-sub">' + U.plural(Store.state.calls.length, 'call') + ' · ' + (missed ? '<span class="danger-text semi">' + missed + ' missed</span>' : 'no missed calls') + '</div></div>' +
      '<div class="vh-actions">' +
      '<button class="btn" data-cv="audio">' + icon('phone') + 'New audio call</button>' +
      '<button class="btn primary" data-cv="video">' + icon('video') + 'New video call</button></div></div>' +
      '<div class="view-toolbar">' +
      ['all', 'missed', 'recorded'].map(t => '<button class="chip' + (CallsView.tab === t ? ' on' : '') + '" data-tab="' + t + '">' + U.cap(t) + '</button>').join('') +
      '<span class="grow"></span>' +
      '<button class="chip" data-cv="devices">' + icon('settings') + 'Device settings</button>' +
      '<button class="chip" data-cv="incoming">' + icon('phoneIn') + 'Simulate incoming call</button>' +
      '</div>' +
      '<div class="view-scroll"><div class="view-pad"><div class="dash-grid">' +
      '<div id="calls-body"></div>' +
      '<div class="col gap-4">' + sidePanels() + '</div>' +
      '</div></div></div>';

    const body = main.querySelector('#calls-body');
    UI.withLoading(body, draw);
    main.querySelector('[data-cv="audio"]').onclick = () => Modals.newCall('audio');
    main.querySelector('[data-cv="video"]').onclick = () => Modals.newCall('video');
    main.querySelector('[data-cv="devices"]').onclick = () => Modals.deviceSettings();
    main.querySelector('[data-cv="incoming"]').onclick = () => Calls.incoming(U.sample(['p10', 'p21', 'p3', 'p28']));
    U.qsa('[data-tab]', main).forEach(b => b.onclick = function () {
      CallsView.tab = b.dataset.tab;
      U.qsa('[data-tab]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      draw();
    });
    U.qsa('[data-quick]', main).forEach(b => b.onclick = () => Calls.start({ peerIds: [b.dataset.quick], kind: 'video', cid: 'd-' + b.dataset.quick }));

    function draw() {
      let calls = Store.state.calls.slice();
      if (CallsView.tab === 'missed') calls = calls.filter(c => c.missed);
      if (CallsView.tab === 'recorded') calls = calls.filter(c => c.recorded);
      if (!calls.length) {
        UI.emptyInto(body, {
          icon: 'phone', tone: 'neutral',
          title: CallsView.tab === 'missed' ? 'No missed calls' : CallsView.tab === 'recorded' ? 'No recorded calls' : 'No calls yet',
          desc: 'Start a call from any conversation, or from the employee directory.',
          actions: [{ label: 'Start a call', icon: 'video', onClick: () => Modals.newCall('video') }]
        });
        return;
      }
      const groups = U.groupBy(calls, c => U.dayLabel(c.start));
      body.innerHTML = Object.keys(groups).map(function (day) {
        return '<div class="mb-5"><div class="section-title"><h4>' + U.esc(day) + '</h4></div>' +
          '<div class="mini-list card">' + groups[day].map(rowHTML).join('') + '</div></div>';
      }).join('');
      bind();
    }

    function rowHTML(c) {
      const names = c.peerIds.map(id => Store.person(id).name);
      const ic = c.missed ? 'phoneMissed' : (c.direction === 'in' ? 'phoneIn' : 'phone');
      return '<div class="lrow call-row" data-call="' + c.id + '">' +
        '<span class="call-ic ' + (c.missed ? 'missed' : c.direction) + '">' + icon(ic) + '</span>' +
        (c.peerIds.length === 1 ? UI.avatar(c.peerIds[0], 34) : UI.avatarStack(c.peerIds, 3, 26)) +
        '<span class="grow min0"><span class="semi md truncate block">' + U.esc(names.join(', ')) + '</span>' +
        '<span class="tiny ' + (c.missed ? 'danger-text' : 'muted') + '">' + icon(c.kind === 'video' ? 'video' : 'phone') + ' ' +
        (c.missed ? 'Missed ' + c.kind + ' call' : U.cap(c.direction === 'in' ? 'incoming' : 'outgoing') + ' · ' + U.durSec(c.durationSec)) +
        (c.recorded ? ' · Recorded' : '') + '</span></span>' +
        '<span class="tiny subtle">' + U.esc(U.time(c.start)) + '</span>' +
        '<div class="lrow-actions">' +
        '<button class="icon-btn sm" data-cb="' + c.id + ':audio" data-tip="Audio call">' + icon('phone') + '</button>' +
        '<button class="icon-btn sm" data-cb="' + c.id + ':video" data-tip="Video call">' + icon('video') + '</button>' +
        '<button class="icon-btn sm" data-cmenu="' + c.id + '">' + icon('moreH') + '</button></div></div>';
    }

    function bind() {
      U.qsa('[data-cb]', body).forEach(b => b.onclick = function (e) {
        e.stopPropagation();
        const [id, kind] = b.dataset.cb.split(':');
        const c = Store.state.calls.find(x => x.id === id);
        Calls.start({ peerIds: c.peerIds, kind: kind, cid: c.peerIds.length === 1 ? 'd-' + c.peerIds[0] : null });
      });
      U.qsa('[data-cmenu]', body).forEach(b => b.onclick = function (e) {
        e.stopPropagation();
        const c = Store.state.calls.find(x => x.id === b.dataset.cmenu);
        UI.menu(b, [
          { label: 'Call back', icon: 'phone', onClick: () => Calls.start({ peerIds: c.peerIds, kind: c.kind }) },
          { label: 'Send a message', icon: 'chat', onClick: () => { const cv = Store.openDM(c.peerIds[0]); App.route('#/messages/' + cv.id); } },
          { label: 'View profile', icon: 'contacts', disabled: c.peerIds.length > 1, onClick: () => Modals.personProfile(c.peerIds[0]) },
          c.recorded ? { label: 'Play recording', icon: 'play', onClick: () => Modals.playRecording(null, c) } : null,
          { sep: true },
          { label: 'Remove from history', icon: 'trash', danger: true, onClick: function () {
            Store.state.calls = Store.state.calls.filter(x => x.id !== c.id); Store.persist(); draw(); UI.toast('Removed from call history.', 'success');
          } }
        ].filter(Boolean), { align: 'right' });
      });
    }
  };

  function sidePanels() {
    const frequent = ['p10', 'p21', 'p3', 'p25', 'p13', 'p6'];
    return '<div class="card"><div class="card-head"><h4>' + icon('star') + 'Quick dial</h4></div>' +
      '<div class="card-body"><div class="people-row">' + frequent.map(id =>
        '<button class="person-chip" data-quick="' + id + '">' + UI.avatar(id, 40) +
        '<span class="tiny semi truncate">' + U.esc(Store.person(id).first) + '</span>' +
        '<span class="tiny subtle">' + U.esc(UI.presenceLabel(Store.person(id).presence)) + '</span></button>').join('') + '</div></div></div>' +
      '<div class="card"><div class="card-head"><h4>' + icon('headphones') + 'Call quality</h4></div>' +
      '<div class="card-body col gap-3">' +
      qRow('Network', 'Excellent', 96, 'success') + qRow('Audio', 'Excellent', 92, 'success') +
      qRow('Video', 'Good', 74, '') + qRow('Jitter', '12 ms', 88, 'success') +
      '<div class="tiny subtle">Measured on your last call, 5 hours ago.</div></div></div>' +
      '<div class="card"><div class="card-head"><h4>' + icon('info') + 'Dial-in numbers</h4></div>' +
      '<div class="card-body col gap-2 md">' +
      '<div class="row between"><span class="muted">Portugal</span><span class="semi mono">+351 21 000 4821</span></div>' +
      '<div class="row between"><span class="muted">United Kingdom</span><span class="semi mono">+44 20 7946 0231</span></div>' +
      '<div class="row between"><span class="muted">India</span><span class="semi mono">+91 80 4718 2200</span></div>' +
      '<div class="row between"><span class="muted">United States</span><span class="semi mono">+1 415 555 0184</span></div>' +
      '</div></div>';
  }
  function qRow(label, val, pct, tone) {
    return '<div><div class="row between mb-1"><span class="tiny muted">' + label + '</span><span class="tiny semi">' + val + '</span></div>' +
      '<div class="progress thin"><i style="width:' + pct + '%' + (tone === 'success' ? '' : ';background:var(--warning-500)') + '"></i></div></div>';
  }

  g.CallsView = CallsView;
})(window);
