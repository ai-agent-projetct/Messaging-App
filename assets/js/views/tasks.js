/* ===== iThrive — Tasks ===== */
(function (g) {
  const Tasks = { view: 'board', filter: 'mine', q: '', group: 'status' };
  const COLS = [
    { id: 'todo', label: 'To Do', color: '#94a3b8' },
    { id: 'inprogress', label: 'In Progress', color: '#2e7cf6' },
    { id: 'review', label: 'Review', color: '#eab308' },
    { id: 'done', label: 'Completed', color: '#17a34a' }
  ];

  Tasks.render = function (main) {
    main.className = 'main plain';
    main.innerHTML =
      '<div class="view-head"><div class="vh-main"><h2>' + icon('tasks') + 'Tasks</h2>' +
      '<div class="vh-sub" id="t-sub"></div></div>' +
      '<div class="vh-actions">' +
      '<button class="btn" data-t="ai">' + icon('sparkles') + 'Find action items</button>' +
      '<button class="btn primary" data-t="new">' + icon('plus') + 'New task</button></div></div>' +
      '<div class="view-toolbar">' +
      '<div class="input-wrap" style="max-width:280px">' + icon('search') + '<input class="input" id="t-search" placeholder="Search tasks"></div>' +
      ['mine', 'assigned', 'all', 'overdue'].map(f => '<button class="chip' + (Tasks.filter === f ? ' on' : '') + '" data-filter="' + f + '">' +
        ({ mine: 'Assigned to me', assigned: 'Created by me', all: 'All tasks', overdue: 'Overdue' })[f] + '</button>').join('') +
      '<span class="grow"></span>' +
      '<div class="segmented"><button data-v="board" class="' + (Tasks.view === 'board' ? 'on' : '') + '">' + icon('breakout') + ' Board</button>' +
      '<button data-v="list" class="' + (Tasks.view === 'list' ? 'on' : '') + '">' + icon('list') + ' List</button></div>' +
      '</div>' +
      '<div class="view-scroll"><div class="view-pad" id="tasks-body"></div></div>';

    const body = main.querySelector('#tasks-body');
    UI.withLoading(body, () => draw(body, main));
    main.querySelector('[data-t="new"]').onclick = () => Modals.createTask({}, () => draw(body, main));
    main.querySelector('[data-t="ai"]').onclick = () => AIPanel.open();
    U.qsa('[data-filter]', main).forEach(b => b.onclick = function () {
      Tasks.filter = b.dataset.filter;
      U.qsa('[data-filter]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      draw(body, main);
    });
    U.qsa('[data-v]', main).forEach(b => b.onclick = function () {
      Tasks.view = b.dataset.v;
      U.qsa('[data-v]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      draw(body, main);
    });
    main.querySelector('#t-search').addEventListener('input', U.debounce(function (e) { Tasks.q = e.target.value.trim().toLowerCase(); draw(body, main); }, 150));
    Store.on('tasks:update', () => { if (document.body.contains(body)) draw(body, main); });
  };

  function list() {
    let t = Store.state.tasks.slice();
    const me = Store.state.meId;
    if (Tasks.filter === 'mine') t = t.filter(x => x.assigneeId === me);
    if (Tasks.filter === 'assigned') t = t.filter(x => x.creatorId === me);
    if (Tasks.filter === 'overdue') t = t.filter(x => x.status !== 'done' && new Date(x.due) < Date.now());
    if (Tasks.q) t = t.filter(x => (x.title + ' ' + x.description + ' ' + (x.labels || []).join(' ')).toLowerCase().includes(Tasks.q));
    return t;
  }

  function draw(body, main) {
    const items = list();
    const open = items.filter(t => t.status !== 'done').length;
    const late = items.filter(t => t.status !== 'done' && new Date(t.due) < Date.now()).length;
    main.querySelector('#t-sub').innerHTML = U.plural(open, 'open task') + (late ? ' · <span class="danger-text semi">' + late + ' overdue</span>' : '') + ' · ' + items.filter(t => t.status === 'done').length + ' completed';

    if (!items.length) {
      UI.emptyInto(body, {
        icon: 'tasks', title: Tasks.q ? 'No tasks match your search' : 'No tasks yet',
        desc: Tasks.q ? 'Try a different word or clear the search.' : 'Create a task, or let Thrive AI pull action items out of your conversations.',
        actions: [{ label: 'Create a task', icon: 'plus', onClick: () => Modals.createTask({}, () => draw(body, main)) },
        { label: 'Find action items with AI', icon: 'sparkles', variant: 'ghost', onClick: () => AIPanel.open() }]
      });
      return;
    }
    body.innerHTML = Tasks.view === 'board' ? boardHTML(items) : listHTML(items);
    bind(body, main);
  }

  function boardHTML(items) {
    return '<div class="board">' + COLS.map(function (c) {
      const col = items.filter(t => t.status === c.id);
      return '<div class="board-col" data-col="' + c.id + '">' +
        '<div class="bc-head"><span class="bc-dot" style="background:' + c.color + '"></span>' +
        '<span class="semi md">' + c.label + '</span><span class="count muted">' + col.length + '</span>' +
        '<button class="icon-btn sm" data-addcol="' + c.id + '" data-tip="Add task">' + icon('plus') + '</button></div>' +
        '<div class="bc-body" data-drop="' + c.id + '">' +
        (col.length ? col.map(cardHTML).join('') : '<div class="bc-empty">Drop a task here</div>') +
        '</div></div>';
    }).join('') + '</div>';
  }

  function cardHTML(t) {
    const late = t.status !== 'done' && new Date(t.due) < Date.now();
    const doneSubs = (t.subtasks || []).filter(s => s.done).length;
    return '<div class="task-tile" draggable="true" data-task="' + t.id + '">' +
      '<div class="row between gap-2 mb-2">' + UI.priorityBadge(t.priority) +
      '<button class="icon-btn sm" data-tmenu="' + t.id + '">' + icon('moreH') + '</button></div>' +
      '<div class="semi md">' + U.esc(t.title) + '</div>' +
      (t.description ? '<div class="tiny muted clamp-2 mt-1">' + U.esc(t.description) + '</div>' : '') +
      ((t.labels || []).length ? '<div class="chip-row mt-2">' + t.labels.map(l => '<span class="chip tiny">' + U.esc(l) + '</span>').join('') + '</div>' : '') +
      ((t.subtasks || []).length ? '<div class="mt-2"><div class="tiny muted mb-1">' + doneSubs + ' of ' + t.subtasks.length + ' subtasks</div>' +
        '<div class="progress thin"><i style="width:' + U.pct(doneSubs, t.subtasks.length) + '%"></i></div></div>' : '') +
      '<div class="row between mt-3">' +
      '<span class="row gap-2">' + UI.avatar(t.assigneeId, 22) + '<span class="tiny muted truncate">' + U.esc(Store.person(t.assigneeId).first) + '</span></span>' +
      '<span class="tiny ' + (late ? 'danger-text semi' : 'subtle') + '">' + icon('clock') + ' ' + U.esc(U.dateShort(t.due)) + '</span>' +
      '</div>' +
      (t.source && Store.conv(t.source) ? '<div class="tiny subtle mt-2 truncate">' + icon('chat') + ' ' + U.esc(Store.convTitle(Store.conv(t.source))) + '</div>' : '') +
      '</div>';
  }

  function listHTML(items) {
    const groups = U.groupBy(items, t => t.status);
    return COLS.map(function (c) {
      const arr = groups[c.id] || [];
      if (!arr.length) return '';
      return '<div class="mb-6"><div class="section-title"><h4><span class="bc-dot" style="background:' + c.color + '"></span> ' + c.label + '</h4>' +
        '<span class="tiny muted">' + U.plural(arr.length, 'task') + '</span></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th style="width:40px"></th><th>Task</th><th>Assignee</th><th>Due</th><th>Priority</th><th>Labels</th><th style="width:40px"></th></tr></thead><tbody>' +
        U.sortBy(arr, t => t.due).map(function (t) {
          const late = t.status !== 'done' && new Date(t.due) < Date.now();
          return '<tr data-task="' + t.id + '">' +
            '<td><button class="check' + (t.status === 'done' ? ' on' : '') + '" data-tdone="' + t.id + '">' + icon('check') + '</button></td>' +
            '<td><div class="semi md">' + U.esc(t.title) + '</div>' + (t.description ? '<div class="tiny muted truncate">' + U.esc(t.description) + '</div>' : '') + '</td>' +
            '<td><div class="row gap-2">' + UI.avatar(t.assigneeId, 22) + '<span class="tiny truncate">' + U.esc(Store.person(t.assigneeId).first) + '</span></div></td>' +
            '<td class="tiny ' + (late ? 'danger-text semi' : 'muted') + '">' + U.esc(U.dateShort(t.due)) + '</td>' +
            '<td>' + UI.priorityBadge(t.priority) + '</td>' +
            '<td><div class="chip-row">' + (t.labels || []).slice(0, 2).map(l => '<span class="chip tiny">' + U.esc(l) + '</span>').join('') + '</div></td>' +
            '<td><button class="icon-btn sm" data-tmenu="' + t.id + '">' + icon('moreH') + '</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }).join('');
  }

  function bind(body, main) {
    U.qsa('[data-task]', body).forEach(function (el) {
      el.onclick = function (e) {
        if (e.target.closest('[data-tmenu],[data-tdone]')) return;
        Modals.taskDetail(el.dataset.task, () => draw(body, main));
      };
      el.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', el.dataset.task);
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
    });
    U.qsa('[data-drop]', body).forEach(function (zone) {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('over'));
      zone.addEventListener('drop', function (e) {
        e.preventDefault(); zone.classList.remove('over');
        const id = e.dataTransfer.getData('text/plain');
        const t = Store.task(id);
        if (t && t.status !== zone.dataset.drop) {
          Store.updateTask(id, { status: zone.dataset.drop });
          UI.toast('Moved to ' + (COLS.find(c => c.id === zone.dataset.drop) || {}).label + '.', 'success');
        }
        draw(body, main);
      });
    });
    U.qsa('[data-addcol]', body).forEach(b => b.onclick = (e) => { e.stopPropagation(); Modals.createTask({ status: b.dataset.addcol }, () => draw(body, main)); });
    U.qsa('[data-tdone]', body).forEach(b => b.onclick = function (e) {
      e.stopPropagation();
      const t = Store.task(b.dataset.tdone);
      Store.updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' });
      draw(body, main);
    });
    U.qsa('[data-tmenu]', body).forEach(b => b.onclick = function (e) {
      e.stopPropagation();
      const t = Store.task(b.dataset.tmenu);
      UI.menu(b, [
        { label: 'Open task', icon: 'externalLink', onClick: () => Modals.taskDetail(t.id, () => draw(body, main)) },
        { label: 'Edit', icon: 'edit', onClick: () => Modals.createTask(t, () => draw(body, main)) },
        { sep: true },
        { label: 'Move to…', header: true },
        ...COLS.filter(c => c.id !== t.status).map(c => ({ label: c.label, icon: 'arrowRight', onClick: () => { Store.updateTask(t.id, { status: c.id }); draw(body, main); } })),
        { sep: true },
        { label: 'Reassign', icon: 'userPlus', onClick: () => reassign(t, () => draw(body, main)) },
        { label: 'Share to a conversation', icon: 'send', onClick: () => Modals.shareTask(t.id) },
        { label: 'Duplicate', icon: 'copy', onClick: () => { Store.createTask(Object.assign({}, t, { id: undefined, title: t.title + ' (copy)' })); draw(body, main); UI.toast('Task duplicated.', 'success'); } },
        { label: 'Delete task', icon: 'trash', danger: true, onClick: function () {
          UI.confirm({ title: 'Delete this task?', body: '“' + t.title + '” will be removed permanently.', danger: true, confirmLabel: 'Delete' })
            .then(ok => { if (ok) { Store.deleteTask(t.id); draw(body, main); UI.toast('Task deleted.', 'success'); } });
        } }
      ], { align: 'right' });
    });
  }

  function reassign(t, cb) {
    const picker = UI.peoplePicker({ selected: [t.assigneeId], max: 1, exclude: [] });
    UI.modal({
      icon: 'userPlus', title: 'Reassign task', sub: t.title, body: picker.el,
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Assign', variant: 'primary', onClick: function () {
        const ids = picker.get();
        if (!ids.length) { UI.toast('Choose someone to assign this to.', 'warn'); return false; }
        Store.updateTask(t.id, { assigneeId: ids[0] });
        UI.toast('Task assigned to ' + Store.person(ids[0]).name + '.', 'success');
        cb && cb();
      } }]
    });
  }
  Tasks.reassign = reassign;

  g.TasksView = Tasks;
})(window);
