/* ===== iThrive — Utilities ===== */
(function (g) {
  const U = {};

  U.uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

  U.esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  U.attr = (s) => U.esc(s);

  U.qs = (sel, root) => (root || document).querySelector(sel);
  U.qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  U.el = function (tag, attrs, html) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'style') n.setAttribute('style', attrs[k]);
      else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    }
    if (html != null) n.innerHTML = html;
    return n;
  };

  U.frag = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };

  U.debounce = function (fn, ms) {
    let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms || 200); };
  };
  U.throttle = function (fn, ms) {
    let last = 0, t;
    return function () { const a = arguments, c = this, now = Date.now();
      if (now - last >= ms) { last = now; fn.apply(c, a); }
      else { clearTimeout(t); t = setTimeout(() => { last = Date.now(); fn.apply(c, a); }, ms - (now - last)); } };
  };

  /* ---------- Time ---------- */
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONF = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const DAYF = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  U.MON = MON; U.MONF = MONF; U.DAY = DAY; U.DAYF = DAYF;

  U.d = (v) => v instanceof Date ? v : new Date(v);

  U.time = function (v) {
    const d = U.d(v); let h = d.getHours(); const m = d.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + ap;
  };
  U.time24 = function (v) { const d = U.d(v); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); };
  U.dateShort = (v) => { const d = U.d(v); return MON[d.getMonth()] + ' ' + d.getDate(); };
  U.dateLong = (v) => { const d = U.d(v); return DAYF[d.getDay()] + ', ' + MONF[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  U.dateMed = (v) => { const d = U.d(v); return DAY[d.getDay()] + ' ' + MON[d.getMonth()] + ' ' + d.getDate(); };
  U.isSameDay = (a, b) => { a = U.d(a); b = U.d(b); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
  U.startOfDay = (v) => { const d = U.d(v); d.setHours(0,0,0,0); return d; };
  U.addDays = (v, n) => { const d = new Date(U.d(v)); d.setDate(d.getDate() + n); return d; };
  U.addMin = (v, n) => new Date(U.d(v).getTime() + n * 60000);

  U.dayLabel = function (v) {
    const d = U.d(v), now = new Date();
    if (U.isSameDay(d, now)) return 'Today';
    if (U.isSameDay(d, U.addDays(now, -1))) return 'Yesterday';
    if (U.isSameDay(d, U.addDays(now, 1))) return 'Tomorrow';
    const diff = Math.abs(now - d) / 86400000;
    if (diff < 6) return DAYF[d.getDay()];
    return DAY[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate();
  };

  U.ago = function (v) {
    const d = U.d(v), s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 45) return 'just now';
    if (s < 90) return '1 min ago';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 7200) return '1 hr ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hrs ago';
    if (s < 172800) return 'yesterday';
    if (s < 604800) return Math.floor(s / 86400) + ' days ago';
    return U.dateShort(d);
  };
  U.agoShort = function (v) {
    const d = U.d(v), s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return U.time(d);
    if (s < 172800) return 'Yest';
    if (s < 604800) return DAY[d.getDay()];
    return U.dateShort(d);
  };
  U.until = function (v) {
    const s = Math.floor((U.d(v).getTime() - Date.now()) / 1000);
    if (s < 0) return 'started';
    if (s < 60) return 'in <1 min';
    if (s < 3600) return 'in ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'in ' + Math.floor(s / 3600) + ' hr';
    return 'in ' + Math.floor(s / 86400) + ' days';
  };
  U.dur = function (mins) {
    if (mins < 60) return mins + ' min';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h + 'h' + (m ? ' ' + m + 'm' : '');
  };
  U.durSec = function (sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2,'0') : m) + ':' + String(s).padStart(2, '0');
  };

  /* ---------- Formatting ---------- */
  U.initials = function (name) {
    const p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  };
  U.hashInt = function (s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const AV_COLORS = [
    'linear-gradient(135deg,#12a583,#0b6e59)', 'linear-gradient(135deg,#7c5cff,#5330c0)',
    'linear-gradient(135deg,#ff7a45,#c2451a)', 'linear-gradient(135deg,#2e7cf6,#164ea9)',
    'linear-gradient(135deg,#e5484d,#9f2d31)', 'linear-gradient(135deg,#eab308,#b45309)',
    'linear-gradient(135deg,#0ea5b7,#0b6d7a)', 'linear-gradient(135deg,#d946ef,#8f27a3)',
    'linear-gradient(135deg,#22c55e,#15803d)', 'linear-gradient(135deg,#64748b,#334155)',
    'linear-gradient(135deg,#f43f5e,#a4133c)', 'linear-gradient(135deg,#8b5cf6,#5b21b6)'
  ];
  U.avColor = (seed) => AV_COLORS[U.hashInt(seed) % AV_COLORS.length];

  U.bytes = function (n) {
    if (n == null) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  };
  U.num = function (n) {
    if (n == null) return '—';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  };
  U.numFull = (n) => String(n == null ? '' : n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  U.pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
  U.plural = (n, s, p) => n + ' ' + (n === 1 ? s : (p || s + 's'));
  U.cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  U.titleCase = (s) => String(s || '').split(/[\s_-]+/).map(U.cap).join(' ');

  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.sample = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.shuffle = function (a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  U.uniq = (a) => Array.from(new Set(a));
  U.groupBy = function (arr, fn) { const o = {}; arr.forEach(x => { const k = fn(x); (o[k] = o[k] || []).push(x); }); return o; };
  U.sortBy = (arr, fn, dir) => arr.slice().sort((a, b) => { const x = fn(a), y = fn(b); return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'desc' ? -1 : 1); });

  /* Deterministic pseudo-random for stable seeded data */
  U.rng = function (seed) {
    let s = U.hashInt(seed) || 1;
    return function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  };

  /* ---------- Files ---------- */
  const FILE_META = {
    pdf:  { label: 'PDF',  color: '#e5484d', icon: 'fileText' },
    docx: { label: 'DOCX', color: '#2e7cf6', icon: 'fileText' },
    doc:  { label: 'DOC',  color: '#2e7cf6', icon: 'fileText' },
    xlsx: { label: 'XLSX', color: '#17a34a', icon: 'chart' },
    csv:  { label: 'CSV',  color: '#12a583', icon: 'chart' },
    pptx: { label: 'PPTX', color: '#ff7a45', icon: 'layout' },
    key:  { label: 'KEY',  color: '#ff7a45', icon: 'layout' },
    png:  { label: 'PNG',  color: '#7c5cff', icon: 'image' },
    jpg:  { label: 'JPG',  color: '#7c5cff', icon: 'image' },
    jpeg: { label: 'JPEG', color: '#7c5cff', icon: 'image' },
    gif:  { label: 'GIF',  color: '#d946ef', icon: 'gif' },
    svg:  { label: 'SVG',  color: '#eab308', icon: 'palette' },
    fig:  { label: 'FIG',  color: '#d946ef', icon: 'palette' },
    mp4:  { label: 'MP4',  color: '#0ea5b7', icon: 'video' },
    mov:  { label: 'MOV',  color: '#0ea5b7', icon: 'video' },
    mp3:  { label: 'MP3',  color: '#8b5cf6', icon: 'volume' },
    wav:  { label: 'WAV',  color: '#8b5cf6', icon: 'volume' },
    zip:  { label: 'ZIP',  color: '#64748b', icon: 'archive' },
    txt:  { label: 'TXT',  color: '#64748b', icon: 'fileText' },
    md:   { label: 'MD',   color: '#64748b', icon: 'fileText' },
    json: { label: 'JSON', color: '#eab308', icon: 'code' },
    sql:  { label: 'SQL',  color: '#0ea5b7', icon: 'database' },
    link: { label: 'LINK', color: '#2e7cf6', icon: 'link' }
  };
  U.ext = (name) => String(name || '').split('.').pop().toLowerCase();
  U.fileMeta = function (name) {
    const e = U.ext(name);
    return FILE_META[e] || { label: (e || 'FILE').toUpperCase().slice(0, 4), color: '#64748b', icon: 'file' };
  };
  U.fileKind = function (name) {
    const e = U.ext(name);
    if (['png','jpg','jpeg','gif','svg','webp','fig'].includes(e)) return 'image';
    if (['mp4','mov','avi','webm'].includes(e)) return 'video';
    if (['mp3','wav','m4a','ogg'].includes(e)) return 'audio';
    if (['zip','rar','7z','tar'].includes(e)) return 'archive';
    return 'document';
  };

  /* ---------- Storage ---------- */
  U.store = {
    get(k, fallback) {
      try { const v = localStorage.getItem('ithrive:' + k); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem('ithrive:' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('ithrive:' + k); } catch (e) {} },
    clearAll() { try { Object.keys(localStorage).filter(k => k.startsWith('ithrive:')).forEach(k => localStorage.removeItem(k)); } catch (e) {} }
  };

  /* ---------- Text helpers ---------- */
  U.highlight = function (text, q) {
    if (!q) return U.esc(text);
    const safe = U.esc(text);
    try {
      const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      return safe.replace(re, '<mark>$1</mark>');
    } catch (e) { return safe; }
  };

  /* Rich text: mentions, channels, links, code, bold, italic, emoji-only */
  U.renderRich = function (text, opts) {
    opts = opts || {};
    let s = U.esc(text);
    s = s.replace(/```([\s\S]*?)```/g, (m, c) => '<pre class="msg-code">' + c.trim() + '</pre>');
    s = s.replace(/`([^`\n]+)`/g, '<code class="msg-inline-code">$1</code>');
    s = s.replace(/(^|\s)\*\*([^*]+)\*\*/g, '$1<strong>$2</strong>');
    s = s.replace(/(^|\s)_([^_]+)_/g, '$1<em>$2</em>');
    s = s.replace(/(^|\s)~~([^~]+)~~/g, '$1<s>$2</s>');
    s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a class="msg-link" href="$1" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|\s)@([A-Za-z][A-Za-z.\-]+)/g, '$1<span class="mention">@$2</span>');
    s = s.replace(/(^|\s)#([a-z0-9-]{2,})/g, '$1<span class="chan-ref">#$2</span>');
    s = s.replace(/\n/g, '<br>');
    return s;
  };

  U.emojiOnly = function (t) {
    const s = String(t || '').trim();
    if (!s || s.length > 12) return false;
    return /^[\p{Extended_Pictographic}‍️\s]+$/u.test(s);
  };

  U.copy = function (text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text); return true; }
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      return true;
    } catch (e) { return false; }
  };

  U.scrollBottom = function (node, smooth) {
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  U.isMobile = () => window.innerWidth < 860;
  U.isTablet = () => window.innerWidth < 1180;

  g.U = U;
})(window);
