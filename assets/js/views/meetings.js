/* ===== iThrive — Meetings ===== */
(function (g) {
  const Meetings = { tab: 'upcoming' };

  Meetings.render = function (main) {
    main.className = 'main plain';
    const now = Date.now();
    const upcoming = Store.state.meetings.filter(m => new Date(m.end).getTime() > now).sort((a, b) => new Date(a.start) - new Date(b.start));
    const past = Store.state.meetings.filter(m => new Date(m.end).getTime() <= now).sort((a, b) => new Date(b.start) - new Date(a.start));

    main.innerHTML =
      '<div class="view-head"><div class="vh-main"><h2>' + icon('video') + 'Meetings</h2>' +
      '<div class="vh-sub">' + U.plural(upcoming.length, 'upcoming meeting') + ' · ' + U.plural(past.filter(m => m.recording).length, 'recording') + ' available</div></div>' +
      '<div class="vh-actions">' +
      '<button class="btn" data-m="join">' + icon('link') + 'Join with a code</button>' +
      '<button class="btn" data-m="schedule">' + icon('calendarPlus') + 'Schedule</button>' +
      '<button class="btn primary" data-m="instant">' + icon('video') + 'Start instant meeting</button>' +
      '</div></div>' +
      '<div class="view-toolbar">' +
      ['upcoming', 'past', 'recordings'].map(t => '<button class="chip' + (Meetings.tab === t ? ' on' : '') + '" data-tab="' + t + '">' + U.cap(t) + '</button>').join('') +
      '</div>' +
      '<div class="view-scroll"><div class="view-pad" id="mt-body"></div></div>';

    const body = main.querySelector('#mt-body');
    UI.withLoading(body, draw);
    main.querySelector('[data-m="instant"]').onclick = () => Modals.instantMeeting();
    main.querySelector('[data-m="schedule"]').onclick = () => Modals.scheduleMeeting({}, draw);
    main.querySelector('[data-m="join"]').onclick = function () {
      UI.prompt({ title: 'Join a meeting', label: 'Meeting code or link', icon: 'link', placeholder: 'meet.ithrive.app/apollo-go-no-go', confirmLabel: 'Join' })
        .then(function (v) {
          if (!v) return;
          const m = Store.state.meetings.find(x => x.link.includes(v.split('/').pop())) || Store.upcomingMeetings(1)[0];
          if (m) Calls.joinMeeting(m.id); else UI.toast('No meeting found for that code.', 'error');
        });
    };
    U.qsa('[data-tab]', main).forEach(b => b.onclick = function () {
      Meetings.tab = b.dataset.tab;
      U.qsa('[data-tab]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      draw();
    });

    function draw() {
      let items;
      if (Meetings.tab === 'upcoming') items = upcoming;
      else if (Meetings.tab === 'past') items = past;
      else items = past.filter(m => m.recording);

      if (!items.length) {
        UI.emptyInto(body, {
          icon: Meetings.tab === 'recordings' ? 'record' : 'video',
          title: Meetings.tab === 'upcoming' ? 'No upcoming meetings' : Meetings.tab === 'past' ? 'No past meetings' : 'No recordings yet',
          desc: Meetings.tab === 'upcoming' ? 'Your calendar is clear. Schedule a meeting or start one instantly.'
            : Meetings.tab === 'past' ? 'Meetings you attend will be listed here with their notes and summaries.'
            : 'Recordings appear here once a meeting has been recorded and processed.',
          actions: Meetings.tab === 'upcoming' ? [
            { label: 'Start instant meeting', icon: 'video', onClick: () => Modals.instantMeeting() },
            { label: 'Schedule a meeting', icon: 'calendarPlus', variant: 'ghost', onClick: () => Modals.scheduleMeeting({}, draw) }
          ] : []
        });
        return;
      }

      if (Meetings.tab === 'upcoming') {
        const groups = U.groupBy(items, m => U.dayLabel(m.start));
        body.innerHTML = Object.keys(groups).map(function (day) {
          return '<div class="mb-6"><div class="section-title"><h4>' + U.esc(day) + '</h4>' +
            '<span class="tiny muted">' + U.plural(groups[day].length, 'meeting') + '</span></div>' +
            '<div class="grid grid-auto-lg">' + groups[day].map(cardHTML).join('') + '</div></div>';
        }).join('');
      } else {
        body.innerHTML = '<div class="grid grid-auto-lg">' + items.map(cardHTML).join('') + '</div>';
      }
      bind();
    }

    function cardHTML(m) {
      const live = new Date(m.start) <= Date.now() && new Date(m.end) > Date.now();
      const isPast = new Date(m.end).getTime() <= Date.now();
      const org = Store.person(m.organizerId);
      return '<div class="meet-card' + (live ? ' live' : '') + '" data-meet="' + m.id + '">' +
        '<div class="row between mb-3">' +
        '<span class="badge ' + (live ? 'danger' : isPast ? '' : 'brand') + '">' + (live ? 'Live now' : isPast ? U.ago(m.start) : U.until(m.start)) + '</span>' +
        '<button class="icon-btn sm" data-mmenu="' + m.id + '">' + icon('moreH') + '</button></div>' +
        '<h4 class="truncate">' + U.esc(m.title) + '</h4>' +
        '<div class="tiny muted mt-1">' + U.esc(U.dateMed(m.start)) + ' · ' + U.esc(U.time(m.start)) + ' – ' + U.esc(U.time(m.end)) + ' · ' + U.esc(U.dur(m.durationMin)) + '</div>' +
        (m.description ? '<div class="tiny muted mt-2 clamp-2">' + U.esc(m.description) + '</div>' : '') +
        '<div class="row gap-2 mt-3">' + UI.avatarStack(m.participantIds, 5, 24) +
        '<span class="tiny muted">' + U.esc(org.first) + ' · ' + U.plural(m.participantIds.length, 'participant') + '</span></div>' +
        '<div class="row gap-2 mt-4 wrap">' +
        (isPast
          ? '<button class="btn sm soft" data-summary="' + m.id + '">' + icon('sparkles') + 'AI summary</button>' +
            (m.recording ? '<button class="btn sm" data-rec="' + m.id + '">' + icon('play') + 'Recording</button>' : '') +
            '<button class="btn sm ghost" data-notes="' + m.id + '">' + icon('fileText') + 'Notes</button>'
          : '<button class="btn sm ' + (live ? 'primary' : '') + '" data-join="' + m.id + '">' + icon('video') + (live ? 'Join now' : 'Join') + '</button>' +
            '<button class="btn sm" data-detail="' + m.id + '">Details</button>' +
            '<button class="btn sm ghost" data-agenda="' + m.id + '">' + icon('sparkles') + 'Agenda</button>') +
        '</div></div>';
    }

    function bind() {
      U.qsa('[data-meet]', body).forEach(function (c) {
        c.onclick = function (e) { if (!e.target.closest('button')) Modals.meetingDetail(c.dataset.meet, draw); };
      });
      U.qsa('[data-join]', body).forEach(b => b.onclick = (e) => { e.stopPropagation(); Calls.joinMeeting(b.dataset.join); });
      U.qsa('[data-detail]', body).forEach(b => b.onclick = (e) => { e.stopPropagation(); Modals.meetingDetail(b.dataset.detail, draw); });
      U.qsa('[data-agenda]', body).forEach(b => b.onclick = (e) => { e.stopPropagation(); Modals.meetingAgenda(b.dataset.agenda); });
      U.qsa('[data-summary]', body).forEach(b => b.onclick = (e) => { e.stopPropagation(); Modals.meetingSummary(Store.meeting(b.dataset.summary)); });
      U.qsa('[data-notes]', body).forEach(b => b.onclick = (e) => { e.stopPropagation(); Modals.meetingNotes(b.dataset.notes); });
      U.qsa('[data-rec]', body).forEach(b => b.onclick = (e) => { e.stopPropagation(); Modals.playRecording(b.dataset.rec); });
      U.qsa('[data-mmenu]', body).forEach(b => b.onclick = function (e) {
        e.stopPropagation();
        const m = Store.meeting(b.dataset.mmenu);
        const isPast = new Date(m.end).getTime() <= Date.now();
        UI.menu(b, [
          { label: 'Meeting details', icon: 'info', onClick: () => Modals.meetingDetail(m.id, draw) },
          { label: isPast ? 'AI summary' : 'Generate agenda', icon: 'sparkles', onClick: () => isPast ? Modals.meetingSummary(m) : Modals.meetingAgenda(m.id) },
          { label: 'Copy join link', icon: 'link', onClick: () => UI.copyToast(m.link, 'Join link copied.') },
          { label: 'Message participants', icon: 'chat', onClick: () => Modals.newMessage(m.participantIds.filter(i => i !== Store.state.meId)) },
          { sep: true },
          { label: 'Edit meeting', icon: 'edit', disabled: isPast, onClick: () => Modals.scheduleMeeting(m, draw) },
          { label: 'Cancel meeting', icon: 'trash', danger: true, disabled: isPast, onClick: function () {
            UI.confirm({ title: 'Cancel this meeting?', body: 'All ' + m.participantIds.length + ' participants will be notified that “' + m.title + '” has been cancelled.', danger: true, confirmLabel: 'Cancel meeting' })
              .then(ok => { if (ok) { Store.deleteMeeting(m.id); UI.toast('Meeting cancelled and participants notified.', 'success'); Meetings.render(main); } });
          } }
        ], { align: 'right' });
      });
    }
  };

  g.MeetingsView = Meetings;
})(window);
