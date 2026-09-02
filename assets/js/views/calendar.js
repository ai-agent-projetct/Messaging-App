/* ===== iThrive — Calendar ===== */
(function (g) {
  const Cal = { view: 'week', cursor: new Date(), showDeclined: true };
  const START_H = 7, END_H = 21;

  Cal.render = function (main) {
    main.className = 'main plain';
    main.innerHTML =
      '<div class="view-head"><div class="vh-main"><h2>' + icon('calendar') + 'Calendar</h2>' +
      '<div class="vh-sub" id="c-sub"></div></div>' +
      '<div class="vh-actions">' +
      '<button class="btn" data-c="today">Today</button>' +
      '<button class="icon-btn" data-c="prev">' + icon('chevronLeft') + '</button>' +
      '<button class="icon-btn" data-c="next">' + icon('chevronRight') + '</button>' +
      '<div class="segmented">' + ['day', 'week', 'month', 'agenda'].map(v =>
        '<button data-v="' + v + '" class="' + (Cal.view === v ? 'on' : '') + '">' + U.cap(v) + '</button>').join('') + '</div>' +
      '<button class="btn primary" data-c="new">' + icon('plus') + 'New event</button>' +
      '</div></div>' +
      '<div class="cal-wrap" id="cal-body"></div>';

    const body = main.querySelector('#cal-body');
    draw(body, main);
    main.querySelector('[data-c="today"]').onclick = () => { Cal.cursor = new Date(); draw(body, main); };
    main.querySelector('[data-c="prev"]').onclick = () => { shift(-1); draw(body, main); };
    main.querySelector('[data-c="next"]').onclick = () => { shift(1); draw(body, main); };
    main.querySelector('[data-c="new"]').onclick = () => Modals.scheduleMeeting({}, () => draw(body, main));
    U.qsa('[data-v]', main).forEach(b => b.onclick = function () {
      Cal.view = b.dataset.v;
      U.qsa('[data-v]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      draw(body, main);
    });
    Store.on('meetings:update', () => { if (document.body.contains(body)) draw(body, main); });
  };

  function shift(d) {
    if (Cal.view === 'day') Cal.cursor = U.addDays(Cal.cursor, d);
    else if (Cal.view === 'week' || Cal.view === 'agenda') Cal.cursor = U.addDays(Cal.cursor, d * 7);
    else { const c = new Date(Cal.cursor); c.setMonth(c.getMonth() + d); Cal.cursor = c; }
  }

  function allEvents() {
    const out = Store.state.meetings.map(m => ({
      id: m.id, kind: 'meeting', title: m.title, start: new Date(m.start), end: new Date(m.end),
      participantIds: m.participantIds, location: m.location, type: m.type, meeting: m
    }));
    Store.state.events.forEach(e => out.push({
      id: e.id, kind: e.type === 'company' ? 'company' : (e.type === 'focus' ? 'focus' : 'personal'),
      title: e.title, start: new Date(e.start), end: new Date(e.end), allDay: e.allDay, participantIds: []
    }));
    return out;
  }
  function eventsOn(day) {
    return allEvents().filter(e => U.isSameDay(e.start, day)).sort((a, b) => a.start - b.start);
  }
  function weekStart(d) { const s = U.startOfDay(d); return U.addDays(s, -s.getDay() + 1); }

  function draw(body, main) {
    const sub = main.querySelector('#c-sub');
    if (Cal.view === 'month') sub.textContent = U.MONF[Cal.cursor.getMonth()] + ' ' + Cal.cursor.getFullYear();
    else if (Cal.view === 'day') sub.textContent = U.dateLong(Cal.cursor);
    else { const ws = weekStart(Cal.cursor); sub.textContent = U.dateShort(ws) + ' – ' + U.dateShort(U.addDays(ws, 6)) + ', ' + ws.getFullYear(); }

    if (Cal.view === 'month') body.innerHTML = monthHTML();
    else if (Cal.view === 'agenda') body.innerHTML = agendaHTML();
    else body.innerHTML = gridHTML(Cal.view === 'day' ? 1 : 7);
    bind(body, main);
    const scroller = body.querySelector('.cal-scroll');
    if (scroller) scroller.scrollTop = Math.max(0, (new Date().getHours() - START_H - 1) * 56);
  }

  function gridHTML(days) {
    const start = days === 1 ? U.startOfDay(Cal.cursor) : weekStart(Cal.cursor);
    const cols = Array.from({ length: days }, (_, i) => U.addDays(start, i));
    const hours = [];
    for (let h = START_H; h <= END_H; h++) hours.push(h);
    const now = new Date();

    let head = '<div class="cal-head"><div class="cal-gutter"></div>' + cols.map(function (d) {
      const today = U.isSameDay(d, now);
      return '<div class="cal-daycol' + (today ? ' today' : '') + '">' +
        '<span class="cd-dow">' + U.DAY[d.getDay()] + '</span>' +
        '<span class="cd-num">' + d.getDate() + '</span></div>';
    }).join('') + '</div>';

    let allDayRow = '';
    const allDays = cols.map(d => eventsOn(d).filter(e => e.allDay));
    if (allDays.some(a => a.length)) {
      allDayRow = '<div class="cal-allday"><div class="cal-gutter tiny subtle">All day</div>' +
        allDays.map(list => '<div class="cal-daycol">' + list.map(e => '<button class="ev-chip company" data-ev="' + e.id + '">' + U.esc(e.title) + '</button>').join('') + '</div>').join('') + '</div>';
    }

    let grid = '<div class="cal-scroll"><div class="cal-grid" style="--cols:' + days + '">' +
      '<div class="cal-gutter-col">' + hours.map(h => '<div class="cal-hour"><span>' + String(h).padStart(2, '0') + ':00</span></div>').join('') + '</div>';
    cols.forEach(function (d) {
      const evs = eventsOn(d).filter(e => !e.allDay);
      const today = U.isSameDay(d, now);
      grid += '<div class="cal-col' + (today ? ' today' : '') + '" data-day="' + d.toISOString() + '">' +
        hours.map(h => '<div class="cal-slot" data-hour="' + h + '"></div>').join('') +
        (today && now.getHours() >= START_H && now.getHours() <= END_H
          ? '<div class="now-line" style="top:' + posTop(now) + 'px"><i></i></div>' : '') +
        layout(evs).map(function (x) {
          const e = x.e;
          const top = posTop(e.start), height = Math.max(22, ((e.end - e.start) / 3600000) * 56);
          return '<button class="cal-ev ' + e.kind + ' ' + (e.type || '') + '" data-ev="' + e.id + '" ' +
            'style="top:' + top + 'px;height:' + height + 'px;left:calc(' + (x.col * (100 / x.cols)) + '% + 2px);width:calc(' + (100 / x.cols) + '% - 5px)">' +
            '<span class="ce-t truncate">' + U.esc(e.title) + '</span>' +
            '<span class="ce-m truncate">' + U.time24(e.start) + '–' + U.time24(e.end) + (e.participantIds.length ? ' · ' + e.participantIds.length : '') + '</span>' +
            '</button>';
        }).join('') + '</div>';
    });
    grid += '</div></div>';
    return head + allDayRow + grid;
  }
  function posTop(d) { return ((d.getHours() - START_H) + d.getMinutes() / 60) * 56; }
  function layout(evs) {
    const out = [];
    evs.forEach(function (e) {
      const overlapping = evs.filter(o => o !== e && o.start < e.end && o.end > e.start);
      const cols = overlapping.length + 1;
      const before = overlapping.filter(o => o.start < e.start || (o.start.getTime() === e.start.getTime() && evs.indexOf(o) < evs.indexOf(e))).length;
      out.push({ e, col: Math.min(before, cols - 1), cols: cols });
    });
    return out;
  }

  function monthHTML() {
    const first = new Date(Cal.cursor.getFullYear(), Cal.cursor.getMonth(), 1);
    const startPad = (first.getDay() + 6) % 7;
    const start = U.addDays(first, -startPad);
    const now = new Date();
    let h = '<div class="cal-month"><div class="cm-head">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => '<span>' + d + '</span>').join('') + '</div><div class="cm-grid">';
    for (let i = 0; i < 42; i++) {
      const d = U.addDays(start, i);
      const evs = eventsOn(d);
      const other = d.getMonth() !== Cal.cursor.getMonth();
      h += '<div class="cm-day' + (other ? ' other' : '') + (U.isSameDay(d, now) ? ' today' : '') + '" data-day="' + d.toISOString() + '">' +
        '<div class="cm-num">' + d.getDate() + '</div>' +
        evs.slice(0, 3).map(e => '<button class="ev-chip ' + e.kind + '" data-ev="' + e.id + '">' +
          (e.allDay ? '' : '<b>' + U.time24(e.start) + '</b> ') + U.esc(e.title) + '</button>').join('') +
        (evs.length > 3 ? '<button class="cm-more" data-dayopen="' + d.toISOString() + '">+' + (evs.length - 3) + ' more</button>' : '') +
        '</div>';
    }
    return h + '</div></div>';
  }

  function agendaHTML() {
    const start = weekStart(Cal.cursor);
    let h = '<div class="view-scroll"><div class="view-pad">';
    let any = false;
    for (let i = 0; i < 14; i++) {
      const d = U.addDays(start, i);
      const evs = eventsOn(d);
      if (!evs.length) continue;
      any = true;
      h += '<div class="agenda-day"><div class="ad-head"><span class="ad-dow">' + U.DAYF[d.getDay()] + '</span>' +
        '<span class="ad-date">' + U.dateShort(d) + '</span>' +
        (U.isSameDay(d, new Date()) ? '<span class="badge brand">Today</span>' : '') + '</div>' +
        '<div class="mini-list card">' + evs.map(function (e) {
          const live = e.start <= new Date() && e.end > new Date();
          return '<div class="lrow agenda-row' + (live ? ' live' : '') + '" data-ev="' + e.id + '">' +
            '<span class="sched-time"><b>' + (e.allDay ? 'All day' : U.time24(e.start)) + '</b><i>' + (e.allDay ? '' : U.dur(Math.round((e.end - e.start) / 60000))) + '</i></span>' +
            '<span class="ev-bar ' + e.kind + '"></span>' +
            '<span class="grow min0"><span class="semi md truncate block">' + U.esc(e.title) + '</span>' +
            '<span class="tiny muted truncate block">' + (e.participantIds.length ? U.plural(e.participantIds.length, 'participant') + ' · ' : '') + U.esc(e.location || U.cap(e.kind)) + '</span></span>' +
            (e.participantIds.length ? UI.avatarStack(e.participantIds, 3, 22) : '') +
            (e.kind === 'meeting' ? '<button class="btn sm ' + (live ? 'primary' : '') + '" data-join="' + e.id + '">' + (live ? 'Join' : icon('video')) + '</button>' : '') +
            '</div>';
        }).join('') + '</div></div>';
    }
    if (!any) {
      h += UI.empty({ icon: 'calendar', title: 'Nothing scheduled', desc: 'There are no events in the next two weeks. Schedule a meeting to get started.', actions: [{ label: 'Schedule a meeting', icon: 'calendarPlus', onClick: () => Modals.scheduleMeeting() }] });
    }
    return h + '</div></div>';
  }

  function bind(body, main) {
    U.qsa('[data-ev]', body).forEach(function (b) {
      b.onclick = function (e) {
        if (e.target.closest('[data-join]')) return;
        const id = b.dataset.ev;
        if (id.startsWith('mt') || Store.meeting(id)) Modals.meetingDetail(id, () => draw(body, main));
        else {
          const ev = Store.state.events.find(x => x.id === id);
          UI.modal({ icon: 'calendar', title: ev.title, size: 'sm',
            body: '<div class="col gap-3 md"><div class="row between"><span class="muted">When</span><span class="semi">' + U.esc(U.dateLong(ev.start)) + '</span></div>' +
              '<div class="row between"><span class="muted">Time</span><span class="semi">' + (ev.allDay ? 'All day' : U.time(ev.start) + ' – ' + U.time(ev.end)) + '</span></div>' +
              '<div class="row between"><span class="muted">Type</span><span class="semi">' + U.cap(ev.type) + '</span></div></div>',
            actions: [{ label: 'Delete', variant: 'danger-ghost', onClick: function () {
              Store.state.events = Store.state.events.filter(x => x.id !== id); Store.persist(); draw(body, main); UI.toast('Event deleted.', 'success');
            } }, { label: 'Close', variant: 'primary' }] });
        }
      };
    });
    U.qsa('[data-join]', body).forEach(b => b.onclick = (e) => { e.stopPropagation(); Calls.joinMeeting(b.dataset.join); });
    U.qsa('[data-dayopen]', body).forEach(b => b.onclick = (e) => { e.stopPropagation(); Cal.cursor = new Date(b.dataset.dayopen); Cal.view = 'day'; Cal.render(main.closest('.main') ? main : main); App.renderMain(); });
    U.qsa('.cal-slot', body).forEach(function (s) {
      s.ondblclick = function () {
        const day = new Date(s.closest('[data-day]').dataset.day);
        day.setHours(+s.dataset.hour, 0, 0, 0);
        Modals.scheduleMeeting({ start: day }, () => draw(body, main));
      };
    });
    U.qsa('.cm-day', body).forEach(function (d) {
      d.ondblclick = function (e) {
        if (e.target.closest('[data-ev]')) return;
        const day = new Date(d.dataset.day); day.setHours(10, 0, 0, 0);
        Modals.scheduleMeeting({ start: day }, () => draw(body, main));
      };
    });
  }

  g.CalendarView = Cal;
})(window);
