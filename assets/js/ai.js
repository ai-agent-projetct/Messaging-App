/* ===== iThrive — Thrive AI engine =====
   Every result below is derived from the live workspace data in the store,
   so summaries, action items and answers change as the workspace changes. */
(function (g) {
  const AI = {};

  const STOP = new Set('a an the and or but if then than that this these those is are was were be been being to of in on at for with from by as it its it\'s we you i they he she them us our your their have has had do does did will would can could should may might must not no yes so just about into over under again more most other some such only own same too very s t don now here there when where why how all any both each few nor own out up down off very'.split(' '));

  function words(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9'\s#@.-]/g, ' ').split(/\s+/).filter(w => w && w.length > 2 && !STOP.has(w));
  }

  /* ------------------------------------------------------------------ */
  /* Signal detection                                                    */
  /* ------------------------------------------------------------------ */
  const DECISION_RX = /\b(decision recorded|decided|we will|let'?s go with|approved|sign(ed)? off|agreed|confirm(ed)?|going with|final|ship it|green light)\b/i;
  const ACTION_RX = /\b(can you|could you|please|i'?ll|i will|we need to|needs? to|todo|to-do|action item|by (monday|tuesday|wednesday|thursday|friday|tomorrow|end of|eod|eow)|due|deadline|owner|assign)\b/i;
  const RISK_RX = /\b(risk|blocked|blocker|at risk|delay|slip|failing|fail|incident|escalat|churn|down \d+%|concern|issue|outage|regression)\b/i;
  const QUESTION_RX = /\?\s*$/;
  const METRIC_RX = /(\d+(?:[.,]\d+)?\s?(?:%|ms|k|m|x|€|\$|hrs?|hours?|days?|min(?:utes)?)\b)/gi;

  function sentences(text) {
    return String(text || '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  }

  function scoreMessage(m, idx, total) {
    let s = 0;
    const txt = m.text || '';
    if (!txt) return -1;
    if (DECISION_RX.test(txt)) s += 6;
    if (RISK_RX.test(txt)) s += 4;
    if (ACTION_RX.test(txt)) s += 3;
    if (m.pinned) s += 5;
    if ((m.files || []).length) s += 2;
    const rc = Object.values(m.reactions || {}).reduce((n, a) => n + a.length, 0);
    s += Math.min(4, rc * 0.7);
    s += Math.min(3, (m.threadCount || 0) * 0.6);
    if (METRIC_RX.test(txt)) s += 2;
    METRIC_RX.lastIndex = 0;
    s += Math.min(2, txt.length / 160);
    s += (idx / Math.max(1, total)) * 2.5;         /* recency bias */
    return s;
  }

  function trim(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    return s.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, '') + '…';
  }

  /* ------------------------------------------------------------------ */
  /* Conversation summary                                                */
  /* ------------------------------------------------------------------ */
  AI.summarizeConversation = function (cid, opts) {
    opts = opts || {};
    const conv = Store.conv(cid);
    let msgs = (Store.msgs(cid) || []).filter(m => !m.deleted && (m.text || (m.files || []).length) && !m.system);
    if (opts.sinceHours) {
      const cut = Date.now() - opts.sinceHours * 3600000;
      const recent = msgs.filter(m => new Date(m.ts).getTime() >= cut);
      if (recent.length >= 3) msgs = recent;
    }
    if (opts.limit) msgs = msgs.slice(-opts.limit);
    if (!msgs.length) return null;

    const scored = msgs.map((m, i) => ({ m, s: scoreMessage(m, i, msgs.length) })).sort((a, b) => b.s - a.s);
    const keyMsgs = scored.slice(0, 5).sort((a, b) => new Date(a.m.ts) - new Date(b.m.ts)).map(x => x.m);

    const decisions = msgs.filter(m => DECISION_RX.test(m.text)).slice(-4);
    const risks = msgs.filter(m => RISK_RX.test(m.text)).slice(-3);
    const questions = msgs.filter(m => QUESTION_RX.test(m.text) && m.authorId !== Store.state.meId).slice(-3);
    const actions = AI.extractActions(msgs);

    const participants = U.uniq(msgs.map(m => m.authorId));
    const files = U.uniq(msgs.flatMap(m => m.files || []));
    const metrics = U.uniq(msgs.flatMap(m => (m.text.match(METRIC_RX) || []))).slice(0, 6);

    const title = Store.convTitle(conv);
    const span = msgs.length > 1 ? U.ago(msgs[0].ts) : U.ago(msgs[msgs.length - 1].ts);

    const headline = buildHeadline(title, msgs, decisions, risks, actions);

    return {
      cid, title,
      headline,
      span: span,
      count: msgs.length,
      participants,
      bullets: keyMsgs.map(m => ({
        authorId: m.authorId, ts: m.ts, id: m.id,
        text: trim(sentences(m.text)[0] || m.text, 160)
      })),
      decisions: decisions.map(m => ({ id: m.id, authorId: m.authorId, ts: m.ts, text: trim(m.text, 150) })),
      risks: risks.map(m => ({ id: m.id, authorId: m.authorId, ts: m.ts, text: trim(m.text, 150) })),
      openQuestions: questions.map(m => ({ id: m.id, authorId: m.authorId, ts: m.ts, text: trim(m.text, 150) })),
      actions: actions,
      files: files,
      metrics: metrics,
      sentiment: sentimentOf(msgs)
    };
  };

  function buildHeadline(title, msgs, decisions, risks, actions) {
    const parts = [];
    parts.push(msgs.length + ' message' + (msgs.length === 1 ? '' : 's') + ' in ' + title);
    if (decisions.length) parts.push(decisions.length + ' decision' + (decisions.length === 1 ? '' : 's') + ' recorded');
    if (actions.length) parts.push(actions.length + ' action item' + (actions.length === 1 ? '' : 's'));
    if (risks.length) parts.push(risks.length + ' risk' + (risks.length === 1 ? '' : 's') + ' raised');
    return parts.join(' · ');
  }

  function sentimentOf(msgs) {
    let pos = 0, neg = 0;
    msgs.forEach(function (m) {
      const rc = Object.keys(m.reactions || {});
      if (rc.some(e => '🎉🚀👏❤️🔥🙌👍✅💡📈🎯'.includes(e))) pos += 1;
      if (RISK_RX.test(m.text)) neg += 1;
      if (/\b(great|excellent|fantastic|congratulations|well done|nice|love|impressive|beautiful|perfect)\b/i.test(m.text)) pos += 1;
    });
    if (pos > neg * 1.6) return { label: 'Positive', tone: 'success', detail: 'Momentum is good — celebrations outnumber concerns.' };
    if (neg > pos * 1.4) return { label: 'Needs attention', tone: 'warning', detail: 'Several risks or blockers are being discussed.' };
    return { label: 'Neutral', tone: '', detail: 'Steady working discussion with a balance of progress and open items.' };
  }

  /* ------------------------------------------------------------------ */
  /* Action item extraction                                              */
  /* ------------------------------------------------------------------ */
  const DAYMAP = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
  function inferDue(text) {
    const l = text.toLowerCase();
    const now = new Date();
    if (/\btoday\b|\beod\b/.test(l)) return U.addDays(now, 0);
    if (/\btomorrow\b/.test(l)) return U.addDays(now, 1);
    if (/\bthis week\b|\beow\b/.test(l)) return U.addDays(now, 5 - now.getDay());
    if (/\bnext week\b/.test(l)) return U.addDays(now, 7);
    for (const d in DAYMAP) {
      if (new RegExp('\\b' + d + '\\b').test(l)) {
        let diff = (DAYMAP[d] - now.getDay() + 7) % 7 || 7;
        return U.addDays(now, diff);
      }
    }
    return U.addDays(now, 3);
  }
  function inferAssignee(text, authorId) {
    const l = text.toLowerCase();
    const mention = text.match(/@([A-Za-z][A-Za-z.\-]+)/);
    if (mention) {
      const key = mention[1].replace('.', ' ').toLowerCase();
      const p = Store.people().find(x => x.name.toLowerCase().startsWith(key) || x.name.toLowerCase().replace(/\s/g, '') === key.replace(/\s/g, ''));
      if (p) return p.id;
    }
    const named = Store.people().find(p => new RegExp('\\b' + p.first.toLowerCase() + '\\b').test(l));
    if (named && /\b(can|could|please|would)\b/.test(l)) return named.id;
    if (/\bi'?ll\b|\bi will\b|\bon it\b|\bdoing it\b/.test(l)) return authorId;
    if (/\bcan you\b|\bcould you\b|\bplease\b/.test(l)) return authorId === Store.state.meId ? null : Store.state.meId;
    return authorId;
  }
  AI.extractActions = function (msgs) {
    const out = [];
    (msgs || []).forEach(function (m) {
      if (!m.text || m.system) return;
      sentences(m.text).forEach(function (s) {
        if (!ACTION_RX.test(s)) return;
        if (s.length < 18) return;
        if (DECISION_RX.test(s) && !/\b(i'?ll|we need to|please|can you)\b/i.test(s)) return;
        const clean = s.replace(/^(so|and|but|also|ok|okay|right),?\s+/i, '');
        out.push({
          text: trim(clean.replace(/\s+/g, ' '), 120),
          sourceId: m.id, convId: m.convId,
          authorId: m.authorId,
          assigneeId: inferAssignee(s, m.authorId),
          due: inferDue(s),
          priority: /\burgent|asap|today|blocking|blocker\b/i.test(s) ? 'urgent' : (/\bimportant|priority|critical\b/i.test(s) ? 'high' : 'medium')
        });
      });
    });
    const seen = new Set();
    return out.filter(a => { const k = a.text.toLowerCase().slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
  };

  /* ------------------------------------------------------------------ */
  /* Thread summary                                                      */
  /* ------------------------------------------------------------------ */
  AI.summarizeThread = function (parentId, cid) {
    const parent = (Store.msgs(cid) || []).find(m => m.id === parentId);
    const replies = Store.thread(parentId);
    if (!parent || !replies.length) return null;
    const all = [parent].concat(replies);
    const decisions = all.filter(m => DECISION_RX.test(m.text));
    const actions = AI.extractActions(all);
    return {
      participants: U.uniq(all.map(m => m.authorId)),
      count: replies.length,
      topic: trim(parent.text, 110),
      outcome: decisions.length ? trim(decisions[decisions.length - 1].text, 170)
        : trim(replies[replies.length - 1].text, 170),
      resolved: decisions.length > 0,
      actions: actions,
      bullets: all.slice(-4).map(m => ({ authorId: m.authorId, text: trim(sentences(m.text)[0] || m.text, 130) }))
    };
  };

  /* ------------------------------------------------------------------ */
  /* Catch-up ("what did I miss")                                        */
  /* ------------------------------------------------------------------ */
  AI.catchUp = function () {
    const convs = Store.convs().filter(c => c.unread > 0 && !c.archived);
    const items = convs.map(function (c) {
      const msgs = (Store.msgs(c.id) || []).filter(m => !m.system && !m.deleted);
      const recent = msgs.slice(-c.unread);
      if (!recent.length) return null;
      const top = recent.map((m, i) => ({ m, s: scoreMessage(m, i, recent.length) })).sort((a, b) => b.s - a.s)[0];
      return {
        convId: c.id, title: Store.convTitle(c), kind: c.kind,
        unread: c.unread, mentions: c.mentions,
        gist: trim(sentences(top.m.text)[0] || top.m.text, 150),
        authorId: top.m.authorId, ts: top.m.ts,
        priority: c.mentions ? 'high' : (RISK_RX.test(top.m.text) ? 'high' : (c.unread > 3 ? 'medium' : 'low'))
      };
    }).filter(Boolean);
    const order = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => order[a.priority] - order[b.priority] || b.unread - a.unread);
    const totalUnread = items.reduce((n, i) => n + i.unread, 0);
    const mentions = items.reduce((n, i) => n + i.mentions, 0);
    return {
      totalUnread, mentions, items,
      headline: totalUnread ? ('You have ' + totalUnread + ' unread message' + (totalUnread === 1 ? '' : 's') + ' across ' + items.length + ' conversation' + (items.length === 1 ? '' : 's') + (mentions ? ', including ' + mentions + ' direct mention' + (mentions === 1 ? '' : 's') : '') + '.') : 'You are fully caught up. Nothing is waiting for you.',
      readTime: Math.max(1, Math.round(totalUnread * 0.4)) + ' min to read'
    };
  };

  /* ------------------------------------------------------------------ */
  /* Smart notification prioritisation                                   */
  /* ------------------------------------------------------------------ */
  AI.prioritise = function (notifs) {
    const weight = { mention: 9, task: 8, call: 8, meeting: 7, thread: 6, message: 6, announcement: 5, file: 4, invite: 4, group: 5, reaction: 2 };
    return notifs.map(function (n) {
      let s = weight[n.type] || 3;
      const actor = Store.person(n.actorId);
      if (['Owner', 'Super Admin'].includes(actor.role)) s += 2;
      if (actor.id === Store.me().managerId) s += 3;
      if (RISK_RX.test(n.preview || '')) s += 3;
      if (/\burgent|blocker|now|today|asap|due\b/i.test(n.preview || '')) s += 2;
      const ageH = (Date.now() - new Date(n.ts)) / 3600000;
      s += Math.max(0, 3 - ageH / 6);
      if (n.read) s -= 5;
      return Object.assign({}, n, { _score: s, _tier: s >= 12 ? 'now' : (s >= 8 ? 'soon' : 'later') });
    }).sort((a, b) => b._score - a._score);
  };

  /* ------------------------------------------------------------------ */
  /* Drafting & rewriting                                                */
  /* ------------------------------------------------------------------ */
  const OPENERS = {
    friendly: ['Hi {name} — ', 'Hey {name}, ', 'Morning {name}! '],
    formal: ['Hello {name},\n\n', 'Dear {name},\n\n'],
    concise: ['', ''],
    direct: ['{name} — ']
  };
  AI.draft = function (intent, ctx) {
    ctx = ctx || {};
    const conv = ctx.cid ? Store.conv(ctx.cid) : null;
    const name = conv && conv.kind === 'dm' ? Store.person(conv.peerId).first : (conv ? 'everyone' : 'team');
    const tone = ctx.tone || 'friendly';
    const opener = (OPENERS[tone] || OPENERS.friendly)[0].replace('{name}', name);
    const recent = conv ? (Store.msgs(conv.id) || []).filter(m => m.text && !m.system).slice(-6) : [];
    /* Pick the most substantive recent sentence from the other side, not just the first */
    const theirs = recent.filter(m => m.authorId !== Store.state.meId);
    let subject = ctx.subject;
    if (!subject) {
      const candidates = theirs.flatMap(m => sentences(m.text))
        .filter(s => s.length > 25 && !/^(thanks|thank you|ok|okay|sure|agreed|perfect|great|nice)\b/i.test(s.trim()));
      const best = candidates.sort((a, b) => scoreSubject(b) - scoreSubject(a))[0];
      subject = best ? trim(best, 90) : 'the current work';
    }

    const templates = {
      reply: opener + 'thanks for this. ' + reflect(subject) + ' I will confirm by ' + relDay(1) + '.',
      followup: opener + 'following up on ' + quoteish(subject) + '. Is there anything blocking a decision? Happy to jump on a quick call if that is faster.',
      status: opener + 'quick status update:\n• Apollo GA is on track for 12 April\n• Load test passed at 3x peak (p95 412ms)\n• One watch item: the billing migration dependency\nNo action needed unless something changes.',
      decline: opener + 'I am not going to be able to take this on this week — I am at capacity with the Apollo launch. Could we revisit on ' + relDay(7) + ', or is there someone else who could pick it up?',
      thanks: opener + 'thank you, genuinely. ' + reflect(subject) + ' It made a real difference.',
      meeting: opener + 'could we find 30 minutes this week to align on ' + quoteish(subject) + '? I have space on ' + relDay(1) + ' and ' + relDay(2) + '.',
      summary: opener + 'summarising where we landed:\n' + summaryLines(recent),
      escalate: opener + 'flagging a risk: ' + quoteish(subject) + '. I would like a decision by ' + relDay(2) + ' so we do not lose the week. Options and trade-offs are in the thread.'
    };
    return templates[intent] || templates.reply;
  };
  function scoreSubject(s) {
    let n = Math.min(40, s.length / 3);
    if (ACTION_RX.test(s)) n += 8;
    if (QUESTION_RX.test(s)) n += 10;
    if (RISK_RX.test(s)) n += 6;
    if (DECISION_RX.test(s)) n += 4;
    return n;
  }
  function reflect(s) {
    if (!s) return 'That makes sense.';
    return 'On ' + quoteish(s) + ' — agreed.';
  }
  function quoteish(s) { return '“' + trim(s, 70).replace(/[.!?]$/, '') + '”'; }
  function relDay(n) { const d = U.addDays(new Date(), n); return U.DAYF[d.getDay()]; }
  function summaryLines(msgs) {
    const key = msgs.filter(m => m.text).slice(-3);
    if (!key.length) return '• (no recent context)';
    return key.map(m => '• ' + Store.person(m.authorId).first + ': ' + trim(sentences(m.text)[0], 90)).join('\n');
  }

  AI.rewrite = function (text, mode) {
    const t = String(text || '').trim();
    if (!t) return t;
    if (mode === 'concise') {
      const s = sentences(t);
      return s.slice(0, Math.max(1, Math.ceil(s.length / 2)))
        .map(x => x.replace(/\b(just|really|actually|basically|kind of|sort of|I think|I feel like|in order to|at this point in time)\b\s*/gi, '')
          .replace(/\s{2,}/g, ' ').trim()).join(' ');
    }
    if (mode === 'formal') {
      let out = t.replace(/\bcan'?t\b/gi, 'cannot').replace(/\bwon'?t\b/gi, 'will not').replace(/\bdon'?t\b/gi, 'do not')
        .replace(/\bdoesn'?t\b/gi, 'does not').replace(/\bisn'?t\b/gi, 'is not').replace(/\bwe'?re\b/gi, 'we are')
        .replace(/\bI'?m\b/gi, 'I am').replace(/\blet'?s\b/gi, 'let us').replace(/\bgonna\b/gi, 'going to')
        .replace(/\bwanna\b/gi, 'want to').replace(/\bhey\b/gi, 'Hello').replace(/\bhi\b/gi, 'Hello')
        .replace(/\bthanks\b/gi, 'Thank you').replace(/\byeah\b/gi, 'Yes').replace(/\bnope\b/gi, 'No')
        .replace(/\b(just|really|actually|basically|kind of|sort of|a bit)\b\s*/gi, '')
        .replace(/!+/g, '.').replace(/\s{2,}/g, ' ').trim();
      return AI.rewrite(out, 'fix');
    }
    if (mode === 'friendly') {
      let out = t.replace(/^(Hello|Dear)\b/i, 'Hi');
      if (!/^(hi|hey|morning)/i.test(out)) out = 'Hi — ' + out.charAt(0).toLowerCase() + out.slice(1);
      if (!/[!?]$/.test(out)) out = out.replace(/\.$/, '') + '. Thanks!';
      return out;
    }
    if (mode === 'expand') {
      const s = sentences(t);
      return s.map(x => x).join(' ') + '\n\nFor context: this relates to the Apollo GA work targeted for 12 April. If this changes the plan, flag it in the thread and I will update the launch doc so the decision stays searchable.';
    }
    if (mode === 'bullets') {
      return sentences(t).map(x => '• ' + x).join('\n');
    }
    if (mode === 'fix') {
      return t.replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' ')
        .replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase())
        .replace(/\bi\b/g, 'I').trim();
    }
    return t;
  };

  /* ------------------------------------------------------------------ */
  /* Translation (demonstration dictionary + structure preservation)     */
  /* ------------------------------------------------------------------ */
  /* Demonstration dictionaries. Substitution is word-level, so output shows the
     shape of a translation rather than production-grade machine translation. */
  const DICT = {
    'Portuguese': {
      hi: 'Olá', hello: 'Olá', hey: 'Olá', thanks: 'obrigado', 'thank you': 'obrigado', yes: 'sim', no: 'não',
      the: 'o', and: 'e', is: 'é', are: 'são', we: 'nós', you: 'você', i: 'eu', will: 'vai', can: 'pode',
      need: 'precisa', with: 'com', for: 'para', from: 'de', this: 'este', that: 'esse', all: 'todos',
      team: 'equipa', meeting: 'reunião', call: 'chamada', message: 'mensagem', tomorrow: 'amanhã', today: 'hoje',
      please: 'por favor', launch: 'lançamento', decision: 'decisão', file: 'ficheiro', week: 'semana', day: 'dia',
      good: 'bom', great: 'ótimo', ready: 'pronto', done: 'concluído', question: 'pergunta', project: 'projeto',
      update: 'atualização', review: 'revisão', morning: 'manhã', time: 'hora', work: 'trabalho', sorry: 'desculpe'
    },
    'Spanish': {
      hi: 'Hola', hello: 'Hola', hey: 'Hola', thanks: 'gracias', 'thank you': 'gracias', yes: 'sí', no: 'no',
      the: 'el', and: 'y', is: 'es', are: 'son', we: 'nosotros', you: 'tú', i: 'yo', will: 'va', can: 'puede',
      need: 'necesita', with: 'con', for: 'para', from: 'de', this: 'este', that: 'ese', all: 'todos',
      team: 'equipo', meeting: 'reunión', call: 'llamada', message: 'mensaje', tomorrow: 'mañana', today: 'hoy',
      please: 'por favor', launch: 'lanzamiento', decision: 'decisión', file: 'archivo', week: 'semana', day: 'día',
      good: 'bueno', great: 'genial', ready: 'listo', done: 'hecho', question: 'pregunta', project: 'proyecto',
      update: 'actualización', review: 'revisión', morning: 'mañana', time: 'hora', work: 'trabajo', sorry: 'perdón'
    },
    'French': {
      hi: 'Bonjour', hello: 'Bonjour', hey: 'Salut', thanks: 'merci', 'thank you': 'merci', yes: 'oui', no: 'non',
      the: 'le', and: 'et', is: 'est', are: 'sont', we: 'nous', you: 'vous', i: 'je', will: 'va', can: 'peut',
      need: 'besoin', with: 'avec', for: 'pour', from: 'de', this: 'ce', that: 'cela', all: 'tous',
      team: 'équipe', meeting: 'réunion', call: 'appel', message: 'message', tomorrow: 'demain', today: "aujourd'hui",
      please: "s'il vous plaît", launch: 'lancement', decision: 'décision', file: 'fichier', week: 'semaine', day: 'jour',
      good: 'bon', great: 'excellent', ready: 'prêt', done: 'terminé', question: 'question', project: 'projet',
      update: 'mise à jour', review: 'revue', morning: 'matin', time: 'heure', work: 'travail', sorry: 'désolé'
    },
    'German': {
      hi: 'Hallo', hello: 'Hallo', hey: 'Hallo', thanks: 'danke', 'thank you': 'danke', yes: 'ja', no: 'nein',
      the: 'die', and: 'und', is: 'ist', are: 'sind', we: 'wir', you: 'Sie', i: 'ich', will: 'wird', can: 'kann',
      need: 'braucht', with: 'mit', for: 'für', from: 'von', this: 'dieses', that: 'das', all: 'alle',
      team: 'Team', meeting: 'Besprechung', call: 'Anruf', message: 'Nachricht', tomorrow: 'morgen', today: 'heute',
      please: 'bitte', launch: 'Einführung', decision: 'Entscheidung', file: 'Datei', week: 'Woche', day: 'Tag',
      good: 'gut', great: 'großartig', ready: 'bereit', done: 'erledigt', question: 'Frage', project: 'Projekt',
      update: 'Aktualisierung', review: 'Überprüfung', morning: 'Morgen', time: 'Zeit', work: 'Arbeit', sorry: 'Entschuldigung'
    },
    'Hindi': {
      hi: 'नमस्ते', hello: 'नमस्ते', hey: 'नमस्ते', thanks: 'धन्यवाद', 'thank you': 'धन्यवाद', yes: 'हाँ', no: 'नहीं',
      the: '', and: 'और', is: 'है', are: 'हैं', we: 'हम', you: 'आप', i: 'मैं', will: 'होगा', can: 'सकते',
      need: 'ज़रूरत', with: 'साथ', for: 'के लिए', from: 'से', this: 'यह', that: 'वह', all: 'सभी',
      team: 'टीम', meeting: 'बैठक', call: 'कॉल', message: 'संदेश', tomorrow: 'कल', today: 'आज',
      please: 'कृपया', launch: 'लॉन्च', decision: 'निर्णय', file: 'फ़ाइल', week: 'सप्ताह', day: 'दिन',
      good: 'अच्छा', great: 'बढ़िया', ready: 'तैयार', done: 'पूर्ण', question: 'प्रश्न', project: 'परियोजना',
      update: 'अपडेट', review: 'समीक्षा', morning: 'सुबह', time: 'समय', work: 'काम', sorry: 'क्षमा करें'
    },
    'Japanese': {
      hi: 'こんにちは', hello: 'こんにちは', hey: 'やあ', thanks: 'ありがとう', 'thank you': 'ありがとうございます', yes: 'はい', no: 'いいえ',
      the: '', and: 'そして', is: 'です', are: 'です', we: '私たち', you: 'あなた', i: '私', will: 'します', can: 'できます',
      need: '必要', with: 'と', for: 'のために', from: 'から', this: 'これ', that: 'それ', all: 'すべて',
      team: 'チーム', meeting: '会議', call: '通話', message: 'メッセージ', tomorrow: '明日', today: '今日',
      please: 'お願いします', launch: 'ローンチ', decision: '決定', file: 'ファイル', week: '週', day: '日',
      good: '良い', great: '素晴らしい', ready: '準備完了', done: '完了', question: '質問', project: 'プロジェクト',
      update: '更新', review: 'レビュー', morning: '朝', time: '時間', work: '仕事', sorry: 'すみません'
    }
  };
  AI.languages = Object.keys(DICT);
  AI.translate = function (text, lang) {
    const d = DICT[lang];
    if (!d) return text;
    let out = String(text);
    Object.keys(d).sort((a, b) => b.length - a.length).forEach(function (k) {
      out = out.replace(new RegExp('\\b' + k + '\\b', 'gi'), function (m) {
        const v = d[k];
        return m[0] === m[0].toUpperCase() ? v.charAt(0).toUpperCase() + v.slice(1) : v;
      });
    });
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* Smart / semantic search                                             */
  /* ------------------------------------------------------------------ */
  AI.parseQuery = function (q) {
    const filters = { from: null, in: null, has: null, before: null, after: null, type: null };
    let text = String(q || '');
    text = text.replace(/\bfrom:\s*([\w.\-]+)/i, (m, v) => { filters.from = v; return ''; });
    text = text.replace(/\bin:\s*#?([\w-]+)/i, (m, v) => { filters.in = v; return ''; });
    text = text.replace(/\bhas:\s*(\w+)/i, (m, v) => { filters.has = v.toLowerCase(); return ''; });
    text = text.replace(/\btype:\s*(\w+)/i, (m, v) => { filters.type = v.toLowerCase(); return ''; });
    /* natural language time hints */
    if (/\btoday\b/i.test(text)) filters.after = U.startOfDay(new Date()).toISOString();
    if (/\bthis week\b/i.test(text)) filters.after = U.addDays(new Date(), -7).toISOString();
    if (/\blast month\b/i.test(text)) filters.after = U.addDays(new Date(), -30).toISOString();
    if (/\bwith (a |an )?(file|attachment)/i.test(text)) filters.has = 'file';
    return { text: text.replace(/\s{2,}/g, ' ').trim(), filters };
  };

  AI.search = function (q, opts) {
    opts = opts || {};
    const parsed = AI.parseQuery(q);
    const terms = words(parsed.text);
    const f = parsed.filters;
    const results = { messages: [], people: [], channels: [], groups: [], files: [], tasks: [], meetings: [], announcements: [] };
    if (!q || !q.trim()) return Object.assign(results, { parsed });

    const fromPerson = f.from ? Store.people().find(p => p.name.toLowerCase().includes(f.from.toLowerCase()) || p.email.startsWith(f.from.toLowerCase())) : null;

    /* Messages */
    Object.keys(Store.state.messages).forEach(function (cid) {
      const conv = Store.conv(cid); if (!conv) return;
      if (f.in && !(conv.name || '').toLowerCase().includes(f.in.toLowerCase())) return;
      Store.state.messages[cid].forEach(function (m) {
        if (m.deleted || m.system) return;
        if (fromPerson && m.authorId !== fromPerson.id) return;
        if (f.has === 'file' && !(m.files || []).length) return;
        if (f.has === 'link' && !/https?:\/\//.test(m.text)) return;
        if (f.after && new Date(m.ts) < new Date(f.after)) return;
        const hay = (m.text || '').toLowerCase();
        let score = 0;
        terms.forEach(function (t) {
          if (hay.includes(t)) score += hay.startsWith(t) ? 3 : 2;
          /* light stemming for near matches */
          else if (t.length > 4 && hay.includes(t.slice(0, t.length - 1))) score += 1;
        });
        if (!terms.length && (fromPerson || f.in || f.has)) score = 1;
        if (score > 0) {
          score += Math.min(2, (m.threadCount || 0) * 0.4);
          score += Object.keys(m.reactions || {}).length * 0.3;
          const ageD = (Date.now() - new Date(m.ts)) / 86400000;
          score += Math.max(0, 2 - ageD / 5);
          results.messages.push({ m, conv, score });
        }
      });
    });
    results.messages.sort((a, b) => b.score - a.score);

    const match = (s) => { const h = String(s || '').toLowerCase(); return terms.length ? terms.some(t => h.includes(t)) : false; };

    Store.people().forEach(function (p) {
      if (match(p.name) || match(p.title) || match(Store.dept(p.deptId).name) || match(p.email) || (p.skills || []).some(match)) results.people.push(p);
    });
    Store.convs().forEach(function (c) {
      if (c.kind === 'channel' && (match(c.name) || match(c.topic))) results.channels.push(c);
      if (c.kind === 'group' && (match(c.name) || match(c.description))) results.groups.push(c);
    });
    Store.state.files.forEach(function (x) { if (match(x.name)) results.files.push(x); });
    Store.state.tasks.forEach(function (x) { if (match(x.title) || match(x.description) || (x.labels || []).some(match)) results.tasks.push(x); });
    Store.state.meetings.forEach(function (x) { if (match(x.title) || match(x.description)) results.meetings.push(x); });
    Store.state.announcements.forEach(function (x) { if (match(x.title) || match(x.body)) results.announcements.push(x); });

    results.parsed = parsed;
    results.total = results.messages.length + results.people.length + results.channels.length +
      results.groups.length + results.files.length + results.tasks.length + results.meetings.length + results.announcements.length;
    return results;
  };

  /* AI answer grounded in workspace content */
  AI.answer = function (question) {
    const res = AI.search(question);
    const top = res.messages.slice(0, 4);
    if (!top.length) {
      return {
        text: 'I could not find anything in this workspace that answers that. Try naming a channel, a person, or a project — for example “What did Priya say about the load test?”',
        sources: [], confidence: 'low'
      };
    }
    const facts = top.map(r => ({
      author: Store.person(r.m.authorId), conv: r.conv, m: r.m,
      line: trim(sentences(r.m.text).find(s => words(question).some(t => s.toLowerCase().includes(t))) || sentences(r.m.text)[0] || r.m.text, 190)
    }));
    let text = 'Based on ' + facts.length + ' message' + (facts.length === 1 ? '' : 's') + ' in this workspace:\n\n';
    facts.forEach(function (f) {
      text += '• ' + f.author.first + ' in ' + Store.convTitle(f.conv) + ' (' + U.ago(f.m.ts) + '): ' + f.line + '\n';
    });
    const decisions = top.filter(r => DECISION_RX.test(r.m.text));
    if (decisions.length) {
      text += '\nThe most recent decision on this: ' + trim(decisions[0].m.text, 190);
    }
    return {
      text: text.trim(),
      sources: facts.map(f => ({ id: f.m.id, convId: f.conv.id, label: Store.convTitle(f.conv), author: f.author.name, ts: f.m.ts })),
      confidence: top[0].score > 6 ? 'high' : (top[0].score > 3 ? 'medium' : 'low')
    };
  };

  /* ------------------------------------------------------------------ */
  /* Meetings                                                            */
  /* ------------------------------------------------------------------ */
  AI.generateAgenda = function (title, participantIds, minutes) {
    const t = String(title || '').toLowerCase();
    const n = participantIds ? participantIds.length : 3;
    let items;
    if (/go\/?no.?go|launch|release|ga\b/.test(t)) {
      items = ['Readiness review by function (5 min each)', 'Open risks and mitigations', 'Rollback criteria', 'Go / no-go vote', 'Communications plan and owners'];
    } else if (/1:1|one.?on.?one/.test(t)) {
      items = ['How are things going?', 'Progress since last time', 'Blockers I can remove', 'Growth and development', 'Anything on your mind'];
    } else if (/standup|daily/.test(t)) {
      items = ['Yesterday', 'Today', 'Blockers'];
    } else if (/retro/.test(t)) {
      items = ['What went well', 'What did not', 'What we will change', 'Action items and owners'];
    } else if (/review|crit/.test(t)) {
      items = ['Context and goals (5 min)', 'Walkthrough', 'Structured feedback round', 'Decisions and next steps'];
    } else if (/kickoff|onboarding/.test(t)) {
      items = ['Introductions', 'Goals and success criteria', 'Scope and timeline', 'Roles and owners', 'Next steps'];
    } else if (/interview/.test(t)) {
      items = ['Introductions (5 min)', 'Background and experience', 'Technical / role-specific discussion', 'Candidate questions', 'Wrap-up'];
    } else {
      items = ['Context and desired outcome', 'Discussion', 'Decisions', 'Owners and deadlines', 'Anything else'];
    }
    const per = Math.max(3, Math.floor((minutes || 30) / items.length));
    return items.map((x, i) => ({ text: x, minutes: i === items.length - 1 ? Math.max(3, (minutes || 30) - per * (items.length - 1)) : per }));
  };

  AI.meetingSummary = function (meeting) {
    const parts = meeting.participantIds.map(id => Store.person(id));
    const related = AI.relatedMessages(meeting);
    const decisions = related.filter(m => DECISION_RX.test(m.text)).slice(0, 3);
    const actions = AI.extractActions(related);
    return {
      headline: meeting.title + ' — ' + U.dur(meeting.durationMin) + ' with ' + parts.length + ' participants',
      overview: buildMeetingOverview(meeting, parts, decisions),
      keyPoints: (related.length ? related : []).slice(-5).map(m => ({ authorId: m.authorId, text: trim(sentences(m.text)[0] || m.text, 150) })),
      decisions: decisions.map(m => trim(m.text, 170)),
      actions: actions.slice(0, 5),
      nextSteps: actions.length ? actions.slice(0, 3).map(a => a.text) : ['Circulate notes to participants', 'Confirm owners for each open item'],
      attendance: parts.map(p => ({ id: p.id, name: p.name, attended: true }))
    };
  };
  function buildMeetingOverview(meeting, parts, decisions) {
    const org = Store.person(meeting.organizerId);
    let s = org.first + ' ran a ' + U.dur(meeting.durationMin) + ' session with ' + parts.length + ' people';
    if (meeting.description) s += ' covering ' + trim(meeting.description.toLowerCase().replace(/\.$/, ''), 90);
    s += '. ';
    s += decisions.length ? (decisions.length + ' decision' + (decisions.length === 1 ? ' was' : 's were') + ' recorded, with owners assigned in the follow-up thread.')
      : 'The discussion was exploratory; no binding decisions were recorded.';
    return s;
  }
  AI.relatedMessages = function (meeting) {
    const key = words(meeting.title).slice(0, 4);
    const out = [];
    Object.keys(Store.state.messages).forEach(function (cid) {
      Store.state.messages[cid].forEach(function (m) {
        if (!m.text || m.system) return;
        const h = m.text.toLowerCase();
        if (key.some(k => h.includes(k))) out.push(m);
      });
    });
    return out.sort((a, b) => new Date(a.ts) - new Date(b.ts)).slice(-12);
  };

  AI.transcript = function (meeting) {
    const parts = meeting.participantIds.slice(0, 5);
    const related = AI.relatedMessages(meeting).slice(-8);
    const start = new Date(meeting.start).getTime();
    const lines = [];
    related.forEach(function (m, i) {
      lines.push({
        at: U.durSec(Math.floor((i + 1) * (meeting.durationMin * 60) / (related.length + 1))),
        speakerId: parts.includes(m.authorId) ? m.authorId : parts[i % parts.length],
        text: trim(m.text.replace(/\n/g, ' '), 220)
      });
    });
    if (!lines.length) {
      parts.forEach(function (p, i) {
        lines.push({ at: U.durSec(i * 90 + 30), speakerId: p, text: 'Discussion of ' + meeting.title.toLowerCase() + ' and next steps.' });
      });
    }
    return lines;
  };

  /* ------------------------------------------------------------------ */
  /* Smart status suggestions                                            */
  /* ------------------------------------------------------------------ */
  AI.suggestStatus = function () {
    const now = new Date();
    const out = [];
    const next = Store.upcomingMeetings(1)[0];
    if (next && new Date(next.start).getTime() - Date.now() < 20 * 60000) {
      out.push({ emoji: '📅', text: 'In ' + trim(next.title, 28), presence: 'meeting', until: next.end });
    }
    const urgent = Store.myTasks().filter(t => t.priority === 'urgent' && t.status !== 'done')[0];
    if (urgent) out.push({ emoji: '🎯', text: 'Focused on ' + trim(urgent.title, 26), presence: 'busy', until: null });
    const h = now.getHours();
    if (h >= 12 && h < 14) out.push({ emoji: '🥪', text: 'At lunch', presence: 'away', until: null });
    if (h >= 18 || h < 8) out.push({ emoji: '🌙', text: 'Outside working hours', presence: 'away', until: null });
    out.push({ emoji: '🚀', text: 'Shipping Apollo v2', presence: 'available', until: null });
    out.push({ emoji: '🎧', text: 'Deep work — async replies', presence: 'busy', until: null });
    out.push({ emoji: '✈️', text: 'Travelling', presence: 'away', until: null });
    return out.slice(0, 6);
  };

  /* ------------------------------------------------------------------ */
  /* Smart file search                                                   */
  /* ------------------------------------------------------------------ */
  AI.findFiles = function (q) {
    const terms = words(q);
    const kindHint = /image|photo|picture|screenshot/i.test(q) ? 'image' :
      /video|recording|clip/i.test(q) ? 'video' :
        /deck|slide|presentation/i.test(q) ? 'pptx' :
          /spreadsheet|sheet|excel|data/i.test(q) ? 'xlsx' :
            /doc|document|report|policy|spec/i.test(q) ? 'document' : null;
    return Store.state.files.map(function (f) {
      let s = 0;
      const h = f.name.toLowerCase();
      terms.forEach(t => { if (h.includes(t)) s += 3; });
      const owner = Store.person(f.ownerId);
      terms.forEach(t => { if (owner.name.toLowerCase().includes(t) || owner.first.toLowerCase() === t) s += 2; });
      if (kindHint === 'image' && U.fileKind(f.name) === 'image') s += 3;
      if (kindHint === 'video' && U.fileKind(f.name) === 'video') s += 3;
      if (kindHint === 'pptx' && U.ext(f.name) === 'pptx') s += 3;
      if (kindHint === 'xlsx' && ['xlsx', 'csv'].includes(U.ext(f.name))) s += 3;
      if (kindHint === 'document' && U.fileKind(f.name) === 'document') s += 2;
      if (/recent|latest|new/i.test(q)) s += Math.max(0, 3 - (Date.now() - new Date(f.modifiedAt)) / 86400000);
      return { f, s };
    }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.f);
  };

  /* ------------------------------------------------------------------ */
  /* Streaming renderer                                                  */
  /* ------------------------------------------------------------------ */
  AI.stream = function (node, text, opts) {
    opts = opts || {};
    const speed = opts.speed || 9;
    let i = 0;
    node.textContent = '';
    node.classList.add('ai-streaming');
    const chunks = String(text).split(/(\s+)/);
    return new Promise(function (resolve) {
      const tick = setInterval(function () {
        if (i >= chunks.length) {
          clearInterval(tick); node.classList.remove('ai-streaming');
          if (opts.html) node.innerHTML = U.renderRich(text);
          opts.onDone && opts.onDone(); resolve(); return;
        }
        node.textContent += chunks[i++];
        if (opts.scroller) U.scrollBottom(opts.scroller);
      }, speed);
    });
  };

  /* Thinking delay so the UI reads as work being done */
  AI.think = function (ms) { return new Promise(r => setTimeout(r, ms == null ? 620 : ms)); };

  g.AI = AI;
})(window);
