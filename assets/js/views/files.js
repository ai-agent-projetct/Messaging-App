/* ===== iThrive — Files & documents ===== */
(function (g) {
  const Files = { tab: 'all', view: 'list', folder: null, sort: 'modified', type: 'all', q: '' };

  Files.render = function (main) {
    main.className = 'main plain';
    main.innerHTML =
      '<div class="view-head">' +
      '<div class="vh-main"><h2>' + icon('folder') + 'Files</h2>' +
      '<div class="vh-sub" id="f-sub"></div></div>' +
      '<div class="vh-actions">' +
      '<button class="btn" data-f="folder">' + icon('folderPlus') + 'New folder</button>' +
      '<button class="btn primary" data-f="upload">' + icon('upload') + 'Upload</button>' +
      '</div></div>' +
      '<div class="view-toolbar">' +
      '<div class="input-wrap" style="max-width:320px">' + icon('search') + '<input class="input" id="f-search" placeholder="Search files — or describe one"></div>' +
      '<button class="chip" data-f="aisearch">' + icon('sparkles') + 'Smart search</button>' +
      '<span class="divider-v"></span>' +
      ['all', 'mine', 'shared', 'recent', 'starred'].map(t =>
        '<button class="chip' + (Files.tab === t ? ' on' : '') + '" data-tab="' + t + '">' +
        ({ all: 'All files', mine: 'My files', shared: 'Shared with me', recent: 'Recent', starred: 'Favourites' })[t] + '</button>').join('') +
      '<span class="grow"></span>' +
      '<button class="chip" data-f="type">' + icon('filter') + '<span id="f-type-l">All types</span></button>' +
      '<button class="chip" data-f="sort">' + icon('sort') + '<span id="f-sort-l">Last modified</span></button>' +
      '<div class="segmented"><button data-view="list" class="' + (Files.view === 'list' ? 'on' : '') + '">' + icon('list') + '</button>' +
      '<button data-view="grid" class="' + (Files.view === 'grid' ? 'on' : '') + '">' + icon('grid') + '</button></div>' +
      '</div>' +
      '<div class="view-scroll"><div class="view-pad" id="files-body"></div></div>';

    const body = main.querySelector('#files-body');
    UI.withLoading(body, () => draw(body, main));

    main.querySelector('[data-f="upload"]').onclick = () => Modals.uploadFile(Files.folder, () => draw(body, main));
    main.querySelector('[data-f="folder"]').onclick = function () {
      UI.prompt({ title: 'New folder', label: 'Folder name', icon: 'folderPlus', placeholder: 'e.g. Q2 Planning' })
        .then(v => { if (v) { Store.addFolder(v, Files.folder); UI.toast('Folder created.', 'success'); draw(body, main); } });
    };
    main.querySelector('[data-f="aisearch"]').onclick = function () {
      UI.prompt({ title: 'Smart file search', label: 'Describe the file', icon: 'sparkles', placeholder: 'the spreadsheet with the load test numbers', confirmLabel: 'Search' })
        .then(function (v) { if (v) { main.querySelector('#f-search').value = v; Files.q = v; Files.smart = true; draw(body, main); } });
    };
    U.qsa('[data-tab]', main).forEach(b => b.onclick = function () {
      Files.tab = b.dataset.tab; Files.folder = null;
      U.qsa('[data-tab]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      draw(body, main);
    });
    U.qsa('[data-view]', main).forEach(b => b.onclick = function () {
      Files.view = b.dataset.view;
      U.qsa('[data-view]', main).forEach(x => x.classList.remove('on')); b.classList.add('on');
      draw(body, main);
    });
    main.querySelector('#f-search').addEventListener('input', U.debounce(function (e) {
      Files.q = e.target.value.trim(); Files.smart = false; draw(body, main);
    }, 160));
    main.querySelector('[data-f="type"]').onclick = (e) => UI.menu(e.currentTarget,
      [['all', 'All types'], ['document', 'Documents'], ['image', 'Images'], ['video', 'Videos'], ['audio', 'Audio'], ['archive', 'Archives']].map(t => ({
        label: t[1], icon: t[0] === 'all' ? 'grid' : (t[0] === 'image' ? 'image' : t[0] === 'video' ? 'video' : t[0] === 'audio' ? 'volume' : t[0] === 'archive' ? 'archive' : 'fileText'),
        on: Files.type === t[0],
        onClick: () => { Files.type = t[0]; main.querySelector('#f-type-l').textContent = t[1]; draw(body, main); }
      })));
    main.querySelector('[data-f="sort"]').onclick = (e) => UI.menu(e.currentTarget,
      [['modified', 'Last modified'], ['name', 'Name'], ['size', 'Size'], ['owner', 'Owner']].map(t => ({
        label: t[1], on: Files.sort === t[0],
        onClick: () => { Files.sort = t[0]; main.querySelector('#f-sort-l').textContent = t[1]; draw(body, main); }
      })));
  };

  function list() {
    let files = Store.state.files.slice();
    const me = Store.state.meId;
    if (Files.tab === 'mine') files = files.filter(f => f.ownerId === me);
    if (Files.tab === 'shared') files = files.filter(f => f.ownerId !== me);
    if (Files.tab === 'starred') files = files.filter(f => f.starred);
    if (Files.tab === 'recent') files = U.sortBy(files, f => f.modifiedAt, 'desc').slice(0, 14);
    if (Files.folder) files = files.filter(f => f.folderId === Files.folder);
    if (Files.type !== 'all') files = files.filter(f => U.fileKind(f.name) === Files.type);
    if (Files.q) files = Files.smart ? AI.findFiles(Files.q) : files.filter(f => f.name.toLowerCase().includes(Files.q.toLowerCase()) || Store.person(f.ownerId).name.toLowerCase().includes(Files.q.toLowerCase()));
    if (!Files.q || !Files.smart) {
      const key = { modified: f => f.modifiedAt, name: f => f.name.toLowerCase(), size: f => f.size, owner: f => Store.person(f.ownerId).name };
      files = U.sortBy(files, key[Files.sort], Files.sort === 'modified' || Files.sort === 'size' ? 'desc' : 'asc');
    }
    return files;
  }

  function draw(body, main) {
    const files = list();
    const folders = Files.tab === 'all' && !Files.q ? Store.state.folders.filter(f => f.parentId === Files.folder) : [];
    const totalSize = Store.state.files.reduce((n, f) => n + f.size, 0);
    main.querySelector('#f-sub').innerHTML = U.plural(Store.state.files.length, 'file') + ' · ' + U.bytes(totalSize) + ' of ' + U.bytes(DATA.ORG.storageTotal) + ' used';

    let h = '';
    if (Files.folder) {
      const f = Store.state.folders.find(x => x.id === Files.folder);
      h += '<div class="crumbs"><button data-crumb="">' + icon('folder') + 'Files</button>' + icon('chevronRight') +
        '<span class="semi">' + U.esc(f ? f.name : '') + '</span></div>';
    }
    if (!files.length && !folders.length) {
      body.innerHTML = h + UI.empty({
        icon: Files.q ? 'search' : 'folder', tone: Files.q ? 'neutral' : '',
        title: Files.q ? 'No files match “' + Files.q + '”' : 'No files here yet',
        desc: Files.q ? 'Try a different word, or use smart search to describe the file you are thinking of.'
          : 'Upload a document, or share a file in any conversation and it will appear here automatically.',
        actions: Files.q ? [{ label: 'Smart search', icon: 'sparkles', onClick: () => main.querySelector('[data-f="aisearch"]').click() }]
          : [{ label: 'Upload a file', icon: 'upload', onClick: () => Modals.uploadFile(Files.folder, () => draw(body, main)) },
             { label: 'New folder', icon: 'folderPlus', variant: 'ghost', onClick: () => main.querySelector('[data-f="folder"]').click() }]
      });
      UI.bindEmpty(body, { actions: [] });
      bind(body, main);
      return;
    }

    if (folders.length) {
      h += '<div class="section-title"><h4>Folders</h4></div><div class="grid grid-auto mb-6">' +
        folders.map(function (f) {
          const n = Store.state.files.filter(x => x.folderId === f.id).length;
          return '<button class="folder-card" data-folder="' + f.id + '">' +
            '<span class="fc-ic" style="background:' + f.color + '18;color:' + f.color + '">' + icon('folder') + '</span>' +
            '<span class="grow text-left min0"><span class="semi md block truncate">' + U.esc(f.name) + '</span>' +
            '<span class="tiny muted">' + U.plural(n, 'file') + '</span></span>' +
            '<span class="icon-btn sm" data-fomenu="' + f.id + '">' + icon('moreH') + '</span></button>';
        }).join('') + '</div>';
    }

    h += '<div class="section-title"><h4>' + (Files.q ? 'Results' : 'Files') + '</h4><span class="tiny muted">' + U.plural(files.length, 'file') + '</span></div>';
    if (Files.view === 'grid') {
      h += '<div class="grid grid-auto">' + files.map(gridCard).join('') + '</div>';
    } else {
      h += '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th style="width:44%">Name</th><th>Owner</th><th>Modified</th><th class="num">Size</th><th style="width:110px"></th>' +
        '</tr></thead><tbody>' + files.map(rowHTML).join('') + '</tbody></table></div>';
    }
    body.innerHTML = h;
    bind(body, main);
  }

  function gridCard(f) {
    const kind = U.fileKind(f.name);
    const thumb = f.url ? '<span class="fg-thumb" style="background-image:url(' + f.url + ')"></span>'
      : '<span class="fg-thumb ph" style="background:' + U.fileMeta(f.name).color + '14;color:' + U.fileMeta(f.name).color + '">' + icon(U.fileMeta(f.name).icon) + '</span>';
    return '<div class="file-card" data-file="' + f.id + '">' + thumb +
      '<div class="fc-body"><div class="row gap-2"><div class="semi md truncate grow">' + U.esc(f.name) + '</div>' +
      '<button class="icon-btn sm" data-fact="more">' + icon('moreH') + '</button></div>' +
      '<div class="tiny muted truncate">' + U.esc(Store.person(f.ownerId).first) + ' · ' + U.bytes(f.size) + ' · ' + U.esc(U.ago(f.modifiedAt)) + '</div>' +
      (f.starred ? '<span class="fc-star">' + icon('star') + '</span>' : '') + '</div></div>';
  }

  function rowHTML(f) {
    return '<tr data-file="' + f.id + '">' +
      '<td><div class="row gap-3 min0">' + UI.fileGlyph(f.name, 32) +
      '<div class="min0"><div class="semi md truncate">' + U.esc(f.name) + (f.starred ? ' ' + icon('star', 'star-on') : '') + '</div>' +
      '<div class="tiny subtle truncate">' + (f.source && Store.conv(f.source) ? 'Shared in ' + U.esc(Store.convTitle(Store.conv(f.source))) : 'Uploaded') +
      (f.versions > 1 ? ' · v' + f.versions : '') + '</div></div></div></td>' +
      '<td><div class="row gap-2">' + UI.avatar(f.ownerId, 22) + '<span class="tiny truncate">' + U.esc(Store.person(f.ownerId).name) + '</span></div></td>' +
      '<td class="tiny muted">' + U.esc(U.ago(f.modifiedAt)) + '</td>' +
      '<td class="num tiny muted">' + U.bytes(f.size) + '</td>' +
      '<td><div class="row gap-1 justify-end">' +
      '<button class="icon-btn sm" data-fact="preview" data-tip="Preview">' + icon('eye') + '</button>' +
      '<button class="icon-btn sm" data-fact="download" data-tip="Download">' + icon('download') + '</button>' +
      '<button class="icon-btn sm" data-fact="more" data-tip="More">' + icon('moreH') + '</button></div></td></tr>';
  }

  function bind(body, main) {
    U.qsa('[data-folder]', body).forEach(b => b.onclick = function (e) {
      if (e.target.closest('[data-fomenu]')) return;
      Files.folder = b.dataset.folder; draw(body, main);
    });
    U.qsa('[data-fomenu]', body).forEach(b => b.onclick = function (e) {
      e.stopPropagation();
      const id = b.dataset.fomenu;
      UI.menu(b, [
        { label: 'Open', icon: 'folder', onClick: () => { Files.folder = id; draw(body, main); } },
        { label: 'Rename', icon: 'edit', onClick: () => UI.prompt({ title: 'Rename folder', value: (Store.state.folders.find(f => f.id === id) || {}).name }).then(v => { if (v) { Store.state.folders.find(f => f.id === id).name = v; Store.persist(); draw(body, main); UI.toast('Folder renamed.', 'success'); } }) },
        { label: 'Share', icon: 'share', onClick: () => Modals.shareFile(null, id) },
        { sep: true },
        { label: 'Delete folder', icon: 'trash', danger: true, onClick: function () {
          UI.confirm({ title: 'Delete this folder?', body: 'Files inside will move to the top level. This cannot be undone.', danger: true, confirmLabel: 'Delete folder' })
            .then(function (ok) {
              if (!ok) return;
              Store.state.files.forEach(f => { if (f.folderId === id) f.folderId = null; });
              Store.state.folders = Store.state.folders.filter(f => f.id !== id);
              Store.persist(); draw(body, main); UI.toast('Folder deleted.', 'success');
            });
        } }
      ], { align: 'right' });
    });
    U.qsa('[data-crumb]', body).forEach(b => b.onclick = () => { Files.folder = null; draw(body, main); });
    U.qsa('[data-file]', body).forEach(function (r) {
      r.onclick = function (e) {
        const a = e.target.closest('[data-fact]');
        if (!a) return Modals.filePreview(r.dataset.file);
        e.stopPropagation();
        if (a.dataset.fact === 'preview') Modals.filePreview(r.dataset.file);
        if (a.dataset.fact === 'download') Modals.downloadFile(r.dataset.file);
        if (a.dataset.fact === 'more') Modals.fileMenu(a, r.dataset.file, () => draw(body, main));
      };
    });
  }

  g.FilesView = Files;
})(window);
