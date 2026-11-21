(function () {
  'use strict';
  /* ---------- Grundlagen ---------- */
  var $ = function (id) { return document.getElementById(id); };
  /* Am Handy: kein automatisches Fokussieren von Eingabefeldern, sonst öffnet sich die Tastatur und schiebt die Leiste hoch */
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function toTop() { var sc = document.getElementById('scroller'); if (sc) sc.scrollTop = 0; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dstr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return dstr(new Date()); }
  function addDays(s, n) { var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2], 12); d.setDate(d.getDate() + n); return dstr(d); }
  function daysTo(s) { var p = s.split('-'), t = today().split('-'); return Math.round((new Date(+p[0], +p[1] - 1, +p[2], 12) - new Date(+t[0], +t[1] - 1, +t[2], 12)) / 86400000); }
  var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  function fmtDate(s) { var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2], 12); return WD[d.getDay()] + ', ' + p[2] + '.' + p[1] + '.' + p[0]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmtNum(v, e) { return v.toLocaleString('de-DE', { minimumFractionDigits: e === '€' ? 2 : 0, maximumFractionDigits: 2 }); }
  function parseNum(s) {
    s = String(s || '').replace(/[\s€%]|EUR|Mrd\.?/gi, '');
    if (!s) return NaN;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s);
  }
  var toastT = null;
  function toast(t) { var n = $('toast'); n.textContent = t; n.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { n.hidden = true; }, 3400); }
  function svgIcon(path) { var s = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'; var w = el('span'); w.innerHTML = s; return w.firstChild; }

  /* ---------- Daten ---------- */
  var S = { faecher: [], themen: [], termine: [], loaded: { faecher: false, themen: false, termine: false } };
  var P = { items: {}, tage: {}, klausuren: [], frei: {}, pruef: {}, neu: [] };   // Lernstand (privat)
  var CFG = { url: 'https://zqczfssjrukuszvevzcf.supabase.co', key: 'sb_publishable_2Er5-3zhFQZ1BvkNSeTDTg_8c2yilhw' };
  var CODE = null, ME = { name: '', admin: false }, saveT = null, dirty = false, lastRefresh = 0;
  var canSpeak = 'speechSynthesis' in window;
  function K(n) { return 'lz:' + n + ':' + CODE; }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  /* Alle Daten laufen über Funktionen in Supabase, die den persönlichen Code prüfen */
  function rpc(fn, args, keep) {
    return fetch(CFG.url + '/rest/v1/rpc/' + fn, { method: 'POST', keepalive: !!keep, headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) })
      .then(function (r) { return r.text().then(function (t) { var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {} if (!r.ok) { var er = new Error((d && d.message) || ('HTTP ' + r.status)); er.code = d && d.code; throw er; } return d; }); });
  }
  function speak(t) { if (!canSpeak) return; try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(t); u.lang = 'en-GB'; u.rate = 0.95; speechSynthesis.speak(u); } catch (e) {} }
  var BOX_DAYS = [0, 1, 3, 7, 14, 30];

  function fach(id) { for (var i = 0; i < S.faecher.length; i++) if (S.faecher[i].id === id) return S.faecher[i]; return { id: id, name: id, farbe: 'blue' }; }
  function themenVon(fid) { return S.themen.filter(function (t) { return !fid || t.fach === fid; }).sort(function (a, b) { return (a.reihe || 99) - (b.reihe || 99); }); }
  function allItems(t, kinds) {
    var out = [];
    (kinds || ['karten', 'mc', 'rechnen', 'buchung']).forEach(function (k) { (t[k] || []).forEach(function (it) { out.push({ k: k, it: it, t: t }); }); });
    return out;
  }
  function st(id) { return P.items[id] || null; }
  function isDue(id) { var s = st(id); return !s || s.d <= today(); }
  function mastery(t) {
    var all = allItems(t), n = all.length; if (!n) return null;
    var sum = 0; all.forEach(function (x) { var s = st(x.it.id); sum += s ? Math.min(s.b, 4) / 4 : 0; });
    return Math.round(sum / n * 100);
  }
  function dueCount(t, kinds) { return allItems(t, kinds).filter(function (x) { return isDue(x.it.id); }).length; }

  function mark(id, ok, quality) {
    var s = P.items[id] || { b: 0, r: 0, w: 0, d: today() };
    if (ok) { s.r++; s.b = Math.min(5, s.b + (quality === 'fast' ? 0 : 1)); s.d = addDays(today(), quality === 'fast' ? 1 : BOX_DAYS[s.b]); }
    else { s.w++; s.b = 0; s.d = today(); }
    s.l = Date.now();
    P.items[id] = s;
    P.tage[today()] = (P.tage[today()] || 0) + 1;
    queueSave(); renderBadges();
  }
  function normP(o) { o = o || {}; return { items: Object.assign({}, o.items), tage: Object.assign({}, o.tage), klausuren: (o.klausuren || []).slice(), frei: Object.assign({}, o.frei), pruef: Object.assign({}, o.pruef), neu: (o.neu || []).slice() }; }
  function queueSave() { dirty = true; lsSet(K('dirty'), true); lsSet(K('stand'), P); clearTimeout(saveT); saveT = setTimeout(saveNow, 1200); }
  function saveNow() {
    clearTimeout(saveT); saveT = null;
    if (!CODE) return;
    var body = JSON.parse(JSON.stringify(P));
    lsSet(K('stand'), body);
    rpc('lz_save_progress', { p_code: CODE, p_data: body }, true)
      .then(function () { dirty = false; lsSet(K('dirty'), false); setLive('ok', 'Gespeichert'); })
      .catch(function () { setLive('warn', navigator.onLine === false ? 'Offline' : 'Nicht gespeichert'); });
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) { if (saveT) saveNow(); } else { if (dirty && !saveT) saveNow(); refresh(); } });
  window.addEventListener('online', function () { if (dirty) saveNow(); lastRefresh = 0; refresh(); });
  function loadLocal() { var o = lsGet(K('stand'), null); if (o && o.items) P = normP(o); dirty = !!lsGet(K('dirty'), false); }
  function setTermine(list) {
    S.termine = (list || []).map(function (t) { return { id: t.id, fach: t.fach, datum: String(t.datum).slice(0, 10), titel: t.titel, themen: t.themen || [] }; });
    S.loaded.termine = true; lsSet(K('termine'), S.termine); renderBadges();
    if (cur === 'heute' || cur === 'faecher') render(cur);
  }
  function refresh(force) {
    if (!CODE || (!force && Date.now() - lastRefresh < 15000)) return;
    lastRefresh = Date.now();
    rpc('lz_termine_list', { p_code: CODE }).then(setTermine).catch(function () {});
  }
  setInterval(function () { if (!document.hidden) refresh(); }, 60000);
  var LIVE_INFO = { 'Gespeichert': 'Dein Lernstand ist gespeichert.', 'Offline': 'Kein Internet. Dein Lernstand bleibt auf dem Handy und wird gespeichert, sobald wieder Netz da ist.', 'Nicht gespeichert': 'Speichern hat gerade nicht geklappt. Die App versucht es gleich wieder.', 'Verbinde …': 'Die App lädt gerade deinen Lernstand.', 'Speichert …': 'Dein Lernstand wird gerade gespeichert.' };
  function setLive(cls, t) { $('live').className = 'livep ' + cls; $('liveT').textContent = t; $('live').title = LIVE_INFO[t] || t; }
  $('live').addEventListener('click', function () { toast($('live').title || $('liveT').textContent); });

  /* ---------- Navigation ---------- */
  var VIEWS = ['heute', 'lernen', 'karten', 'quiz', 'rechnen', 'buchen', 'erklaeren', 'klausur', 'pruefungen', 'faecher'];
  var cur = 'heute';
  function show(v) {
    if (VIEWS.indexOf(v) < 0) v = 'heute';
    cur = v;
    VIEWS.forEach(function (x) { $('v-' + x).hidden = x !== v; });
    var items = document.querySelectorAll('.gs-item');
    for (var i = 0; i < items.length; i++) {
      var on = items[i].getAttribute('data-v') === v;
      if (on) items[i].setAttribute('aria-current', 'page'); else items[i].removeAttribute('aria-current');
      if (on && window.matchMedia('(max-width: 760px)').matches) { var bar = $('gside'); bar.scrollTo({ left: items[i].offsetLeft - (bar.clientWidth - items[i].offsetWidth) / 2, behavior: 'smooth' }); }
    }
    try { localStorage.setItem('lernzentrale:ansicht', v); } catch (e) {}
    if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
    toTop();
    render(v);
  }
  $('gside').addEventListener('click', function (e) { var b = e.target.closest('.gs-item'); if (b) show(b.getAttribute('data-v')); });
  window.addEventListener('hashchange', function () { var v = location.hash.slice(1); if (v && v !== cur) show(v); });

  function render(v) {
    if (v === 'heute') renderHeute();
    else if (v === 'lernen') renderLernen();
    else if (v === 'karten') renderMode('karten');
    else if (v === 'quiz') renderMode('quiz');
    else if (v === 'rechnen') renderMode('rechnen');
    else if (v === 'buchen') renderMode('buchen');
    else if (v === 'erklaeren') renderMode('erklaeren');
    else if (v === 'klausur') renderKlausur();
    else if (v === 'pruefungen') renderPruefungen();
    else if (v === 'faecher') renderFaecher();
  }

  /* ---------- Badges ---------- */
  function renderBadges() {
    /* Rote Zahl: fällige Wiederholungen plus höchstens 20 neue Karten am Tag */
    var rep = 0, neu = 0; S.themen.forEach(function (t) { (t.karten || []).forEach(function (it) { var s = st(it.id); if (!s) neu++; else if (s.d <= today()) rep++; }); });
    var due = rep + Math.min(neu, 20);
    var a = $('aKarten'); a.hidden = !due; a.textContent = due > 99 ? '99+' : String(due);
    var soon = S.termine.filter(function (t) { var d = daysTo(t.datum); return d >= 0 && d <= 7; }).length;
    var h = $('aHeute'); h.hidden = !soon; h.textContent = String(soon);
  }

  /* ---------- Heute ---------- */
  function upcoming() { return S.termine.filter(function (t) { return daysTo(t.datum) >= 0; }).sort(function (a, b) { return a.datum < b.datum ? -1 : 1; }); }
  function termThemen(tm) { return (tm.themen && tm.themen.length ? S.themen.filter(function (t) { return tm.themen.indexOf(t.id) >= 0; }) : themenVon(tm.fach)); }
  function renderHeute() {
    var h = new Date().getHours();
    $('h-heute').textContent = (h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend') + (ME.name ? ', ' + ME.name : '');
    var up = upcoming();
    $('todayLine').textContent = fmtDate(today()) + (up.length ? ' · nächste Arbeit in ' + daysTo(up[0].datum) + ' Tagen (' + fach(up[0].fach).name + ')' : '');
    var box = $('cdList'); clear(box);
    if (!S.loaded.termine) box.appendChild(el('p', 'empty', 'Termine werden geladen …'));
    else if (!up.length) box.appendChild(el('p', 'empty', 'Keine Klassenarbeit eingetragen. Unter „Fächer“ trägst du Termine ein.'));
    up.slice(0, 6).forEach(function (tm) {
      var d = daysTo(tm.datum), ths = termThemen(tm), m = null, n = 0, sum = 0;
      ths.forEach(function (t) { var x = mastery(t); if (x != null) { sum += x; n++; } });
      if (n) m = Math.round(sum / n);
      var b = el('button', 'cd' + (d <= 3 ? ' now' : d <= 10 ? ' soon' : '')); b.type = 'button';
      var top = el('div', 'cd-top');
      var dd = el('span', 'cd-days', d === 0 ? 'heute' : String(d)); if (d > 0) dd.appendChild(el('small', null, d === 1 ? 'Tag' : 'Tage'));
      top.appendChild(dd); var dot = el('span', 'fdot f-' + (fach(tm.fach).farbe || 'blue')); top.appendChild(dot);
      b.appendChild(top); b.appendChild(el('b', null, tm.titel || fach(tm.fach).name));
      var meta = el('div', 'meta'); meta.appendChild(el('span', null, fmtDate(tm.datum))); meta.appendChild(el('span', null, n ? m + ' % sicher' : 'Stoff fehlt noch')); b.appendChild(meta);
      var bar = el('div', 'bar'); var i = el('i'); if (m != null) { i.style.width = m + '%'; if (m >= 75) i.className = 'ok'; } bar.appendChild(i); b.appendChild(bar);
      b.addEventListener('click', function () { if (!ths.length) { show('faecher'); toast('Für ' + fach(tm.fach).name + ' gibt es noch keinen Stoff. Lade Notizen hoch.'); return; } startKarten({ themen: ths.map(function (t) { return t.id; }), label: tm.titel }); });
      box.appendChild(b);
    });
    // Serie
    var streak = 0, dd2 = today(); if (!P.tage[dd2]) dd2 = addDays(dd2, -1);
    while (P.tage[dd2]) { streak++; dd2 = addDays(dd2, -1); }
    $('stStreak').textContent = streak; $('stToday').textContent = P.tage[today()] || 0;
    $('streakSub').textContent = streak ? 'Weiter so, morgen wieder ein paar Minuten.' : 'Heute ein paar Karten, dann startet die Serie.';
    var wk = $('week'); clear(wk);
    for (var k = 6; k >= 0; k--) { var day = addDays(today(), -k), c = P.tage[day] || 0; var w = el('div', 'wd'); var ii = el('i', (c ? 'on' : '') + (k === 0 ? ' today' : ''), c ? String(c) : ''); w.appendChild(ii); var p = day.split('-'); w.appendChild(el('span', null, WD[new Date(+p[0], +p[1] - 1, +p[2], 12).getDay()])); wk.appendChild(w); }
    // Heute lernen
    var list = $('todoList'); clear(list);
    var plan = todayPlan();
    if (!S.loaded.themen) list.appendChild(el('li', 'empty', 'Lernstoff wird geladen …'));
    else if (!plan.length) list.appendChild(el('li', 'empty', 'Für heute ist alles erledigt. Morgen kommen wieder Karten dran.'));
    plan.slice(0, 6).forEach(function (p) {
      var li = el('li'); li.appendChild(el('span', 'fdot f-' + (fach(p.t.fach).farbe || 'blue')));
      var tx = el('div'); tx.appendChild(el('b', null, p.t.titel)); tx.appendChild(el('small', null, fach(p.t.fach).name + ' · ' + p.due + ' fällig · ' + (p.m == null ? 'neu' : p.m + ' % sicher') + (p.days != null ? ' · Arbeit in ' + p.days + ' T.' : ''))); li.appendChild(tx);
      var acts = el('div', 'chips');
      if (p.t.erkl && p.t.erkl.length) { var rd = el('button', 'chip', 'Lesen'); rd.type = 'button'; rd.addEventListener('click', function () { openTopic(p.t.id); }); acts.appendChild(rd); }
      var go = el('button', 'chip', 'Üben'); go.type = 'button'; go.addEventListener('click', function () { startKarten({ themen: [p.t.id], label: p.t.titel }); }); acts.appendChild(go);
      li.appendChild(acts);
      list.appendChild(li);
    });
    $('bStartToday').disabled = !plan.length;
    renderBadges();
  }
  function todayPlan() {
    var up = upcoming(), rows = [];
    S.themen.forEach(function (t) {
      var due = dueCount(t, ['karten', 'mc', 'rechnen', 'buchung']); if (!due) return;
      var tm = null; up.forEach(function (x) { if (!tm && termThemen(x).indexOf(t) >= 0) tm = x; });
      rows.push({ t: t, due: due, m: mastery(t), days: tm ? daysTo(tm.datum) : null });
    });
    rows.sort(function (a, b) { var da = a.days == null ? 999 : a.days, dbb = b.days == null ? 999 : b.days; if (da !== dbb) return da - dbb; if ((a.m || 0) !== (b.m || 0)) return (a.m || 0) - (b.m || 0); return (a.t.reihe || 99) - (b.t.reihe || 99); });
    return rows;
  }
  $('bStartToday').addEventListener('click', function () { var p = todayPlan().slice(0, 3); if (p.length) startKarten({ themen: p.map(function (x) { return x.t.id; }), label: 'Heute lernen', mixed: true }); });

  /* ---------- Erklärungen ---------- */
  var lern = { fach: '', topic: null };
  function openTopic(id) { lern.topic = id; show('lernen'); }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, text) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  var COL = { o: '#FF9F4A', b: '#60A5FA', g: '#4ADE80', p: '#A78BFA', t: '#2DD4BF', y: '#FBBF24', r: '#F87171', n: '#B9AFA8' };
  /* Feste Schaubilder: Kästen [x, y, b, h, Text, Farbe], Pfeile [x1, y1, x2, y2, Text, tx, ty, gestrichelt] */
  var DIAG = {
    'kreislauf-einfach': { w: 420, h: 300, box: [[10, 115, 120, 60, 'Private|Haushalte', 'o'], [290, 115, 120, 60, 'Unternehmen', 'b']],
      ar: [[40, 115, 40, 40, 0], [40, 40, 380, 40, 0, 'Produktionsfaktoren', 210, 32], [380, 40, 380, 115, 0],
           [350, 115, 350, 80, 1], [350, 80, 70, 80, 1, 'Einkommen', 210, 72], [70, 80, 70, 115, 1],
           [350, 175, 350, 215, 0], [350, 215, 70, 215, 0, 'Güter und Dienstleistungen', 210, 207], [70, 215, 70, 175, 0],
           [40, 175, 40, 255, 1], [40, 255, 380, 255, 1, 'Konsumausgaben', 210, 247], [380, 255, 380, 175, 1]],
      legend: 'Linie = Güterstrom · gestrichelt = Geldstrom' },
    'kreislauf-erweitert': { w: 420, h: 340, box: [[150, 10, 120, 46, 'Staat', 't'], [10, 140, 110, 52, 'Private|Haushalte', 'o'], [300, 140, 110, 52, 'Unter-|nehmen', 'b'], [150, 274, 120, 52, 'Vermögens-|änderung', 'p'], [300, 250, 110, 46, 'Ausland', 'y']],
      ar: [[120, 158, 300, 158, 1, 'Konsumausgaben', 210, 150], [300, 178, 120, 178, 1, 'Einkommen', 210, 194],
           [65, 140, 160, 56, 1, 'Steuern', 82, 92], [260, 56, 355, 140, 1, 'Staatsausgaben', 338, 92],
           [65, 192, 160, 274, 1, 'Sparen', 86, 246], [260, 274, 330, 192, 1, 'Kredite', 280, 222],
           [380, 192, 380, 250, 1, 'Export', 404, 226]],
      legend: 'Vereinfachte Geldströme. Import: Geld fließt ins Ausland.' }
  };
  function drawDiag(id) {
    var d = DIAG[id]; if (id === 'bip-balken') return bipBars(); if (!d) return null;
    var s = sv('svg', { viewBox: '0 0 ' + d.w + ' ' + d.h, role: 'img', 'aria-label': d.legend || id });
    var defs = sv('defs'); var m = sv('marker', { id: 'ah', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }); m.appendChild(sv('path', { d: 'M0 0L10 5L0 10z', fill: '#E7E1DC' })); defs.appendChild(m); s.appendChild(defs);
    d.ar.forEach(function (a) {
      var isEnd = !d.ar.some(function (b) { return b !== a && b[0] === a[2] && b[1] === a[3]; });
      var ln = sv('line', { x1: a[0], y1: a[1], x2: a[2], y2: a[3], stroke: '#E7E1DC', 'stroke-width': 1.6, 'stroke-dasharray': a[4] ? '5 4' : 'none' });
      if (isEnd) ln.setAttribute('marker-end', 'url(#ah)'); s.appendChild(ln);
      if (a[5]) s.appendChild(sv('text', { x: a[6], y: a[7], 'text-anchor': 'middle', class: 'svgl' }, a[5]));
    });
    d.box.forEach(function (b) {
      s.appendChild(sv('rect', { x: b[0], y: b[1], width: b[2], height: b[3], rx: 12, fill: COL[b[5]], 'fill-opacity': .28, stroke: COL[b[5]], 'stroke-width': 1.5 }));
      var lines = b[4].split('|'); lines.forEach(function (t, i) { s.appendChild(sv('text', { x: b[0] + b[2] / 2, y: b[1] + b[3] / 2 + 5 + (i - (lines.length - 1) / 2) * 16, 'text-anchor': 'middle', class: 'svgb' }, t)); });
    });
    return s;
  }
  function bipBars() {
    var rows = [['Verwendung des BIP', [['Privater Konsum', 52.8, 'o'], ['Staat', 22.1, 't'], ['Investitionen', 21.1, 'b'], ['Außenbeitrag', 4.0, 'y']]], ['Verteilung Volkseinkommen', [['Löhne und Gehälter', 74.1, 'g'], ['Gewinne', 25.9, 'p']]]];
    var box = el('div', 'flow');
    rows.forEach(function (r) {
      var row = el('div', 'flow-row'); row.appendChild(el('span', null, r[0]));
      var s = sv('svg', { viewBox: '0 0 420 30', role: 'img', 'aria-label': r[0] + ': ' + r[1].map(function (pt) { return pt[0] + ' ' + pt[1] + ' %'; }).join(', ') });
      var x = 0; r[1].forEach(function (pt, i) {
        var w = pt[1] / 100 * 420; s.appendChild(sv('rect', { x: x + (i ? 1 : 0), y: 0, width: Math.max(0, w - (i ? 1 : 0)), height: 30, fill: COL[pt[2]], 'fill-opacity': .85, rx: 5 }));
        if (w >= 60) s.appendChild(sv('text', { x: x + w / 2, y: 20, 'text-anchor': 'middle', class: 'svgb', fill: '#1d1714', style: 'fill:#1d1714' }, String(pt[1]).replace('.', ',') + ' %'));
        x += w;
      });
      row.appendChild(s);
      var lg = el('div', 'flow-k'); r[1].forEach(function (pt) { var b = el('div', 'fbox ' + pt[2], pt[0] + ': ' + String(pt[1]).replace('.', ',') + ' %'); lg.appendChild(b); }); row.appendChild(lg);
      box.appendChild(row);
    });
    return box;
  }
  function renderBlock(b) {
    if (b.t === 'h') return el('h3', null, b.x);
    if (b.t === 'p') return el('p', null, b.x);
    if (b.t === 'merke') { var m = el('div', 'merke'); m.appendChild(el('b', null, 'Merke:')); m.appendChild(document.createTextNode(b.x)); return m; }
    if (b.t === 'liste') { var u = el('ul'); (b.x || []).forEach(function (x) { u.appendChild(el('li', null, x)); }); return u; }
    if (b.t === 'tabelle') {
      var w = el('div', 'tw'), t = el('table'), hr = el('tr'); (b.kopf || []).forEach(function (x) { hr.appendChild(el('th', null, x)); }); t.appendChild(hr);
      (b.zeilen || []).forEach(function (z) { var tr = el('tr'); z.forEach(function (x) { tr.appendChild(el('td', null, x)); }); t.appendChild(tr); }); w.appendChild(t); return w;
    }
    if (b.t === 'bild') { var svg = drawDiag(b.id); if (!svg) return null; var f = el('figure', 'fig'); f.style.margin = '0'; f.appendChild(svg); var d = DIAG[b.id]; f.appendChild(el('figcaption', null, b.cap || (d && d.legend) || '')); return f; }
    if (b.t === 'ablauf') {
      var fl = el('div', 'fig'), wrap = el('div', 'flow');
      (b.zeilen || []).forEach(function (z) {
        var row = el('div', 'flow-row'); if (z.l) row.appendChild(el('span', null, z.l));
        var ks = el('div', 'flow-k'); (z.k || []).forEach(function (kx, i) { if (i) ks.appendChild(el('span', 'farr', '→')); ks.appendChild(el('div', 'fbox ' + (/^[obgptyrn]$/.test(kx[1]) ? kx[1] : 'n'), kx[0])); });
        row.appendChild(ks); wrap.appendChild(row);
      });
      fl.appendChild(wrap); if (b.cap) fl.appendChild(el('p', 'cap', b.cap)); return fl;
    }
    return null;
  }
  function renderLernen() {
    var body = $('lernBody'); clear(body);
    if (!S.loaded.themen) { body.appendChild(el('p', 'empty', 'Lernstoff wird geladen …')); return; }
    var t = lern.topic && S.themen.filter(function (x) { return x.id === lern.topic; })[0];
    if (t) { body.appendChild(topicPage(t)); return; }
    var chips = el('div', 'chips'); chips.style.marginBottom = '14px';
    var mk = function (id, label) { var c = el('button', 'chip', label); c.type = 'button'; c.setAttribute('aria-pressed', String(lern.fach === id)); c.addEventListener('click', function () { lern.fach = id; renderLernen(); }); chips.appendChild(c); };
    mk('', 'Alle'); S.faecher.slice().sort(function (a, b) { return (a.reihe || 99) - (b.reihe || 99); }).forEach(function (f) { if (themenVon(f.id).length) mk(f.id, f.name); });
    body.appendChild(chips);
    var grid = el('div', 'tgrid'), ths = themenVon(lern.fach);
    if (!ths.length) grid.appendChild(el('p', 'empty', 'Noch keine Themen. Lade Notizen hoch.'));
    ths.forEach(function (x) {
      var c = el('button', 'tcard'); c.type = 'button';
      var top = el('div', 'meta'); top.appendChild(el('span', null, fach(x.fach).name)); top.appendChild(el('span', null, x.erkl && x.erkl.length ? 'Erklärung' : 'nur Fragen')); c.appendChild(top);
      c.appendChild(el('b', null, x.titel));
      var m = mastery(x), bar = el('div', 'bar'), i = el('i'); i.style.width = (m || 0) + '%'; if (m >= 75) i.className = 'ok'; bar.appendChild(i); c.appendChild(bar);
      var meta = el('div', 'meta'); meta.appendChild(el('span', null, (m == null ? 0 : m) + ' % sicher')); meta.appendChild(el('span', null, (x.videos || []).length ? 'mit Videos' : '')); c.appendChild(meta);
      c.addEventListener('click', function () { lern.topic = x.id; renderLernen(); toTop(); });
      grid.appendChild(c);
    });
    body.appendChild(grid);
  }
  function topicPage(t) {
    var wrap = el('div', 'view');
    var nav = el('div', 'row-btns'); var back = el('button', 'chip', '← Alle Themen'); back.type = 'button'; back.addEventListener('click', function () { lern.topic = null; renderLernen(); toTop(); }); nav.appendChild(back); wrap.appendChild(nav);
    var c = el('article', 'card'), doc = el('div', 'doc');
    var hd = el('div'); hd.appendChild(el('h2', null, t.titel)); hd.appendChild(el('p', 'sub', fach(t.fach).name + ' · Quelle: ' + (t.quelle || '–'))); doc.appendChild(hd);
    if (t.erkl && t.erkl.length) t.erkl.forEach(function (b) { var n = renderBlock(b); if (n) doc.appendChild(n); });
    else doc.appendChild(el('p', 'empty', 'Zu diesem Thema gibt es noch keinen Erklärtext. Übe mit den Karten unten.'));
    // Merkkarten als Kurzüberblick
    if ((t.karten || []).length) { var dt = el('details'); dt.appendChild(el('summary', null, 'Alle ' + t.karten.length + ' Merkkarten auf einen Blick')); var u = el('ul'); t.karten.forEach(function (k) { var li = el('li'); li.appendChild(el('b', null, k.v + ' ')); li.appendChild(document.createTextNode(k.r)); u.appendChild(li); }); dt.appendChild(u); doc.appendChild(dt); }
    c.appendChild(doc); wrap.appendChild(c);
    if (t.fach === 'lf8') { var kpb = kontenplanBox(); if (kpb) { var kc = el('div', 'card'); kc.appendChild(kpb); wrap.appendChild(kc); } }
    // Videos
    var vc = el('div', 'card'); vc.appendChild(el('h2', null, 'Videos dazu'));
    vc.appendChild(el('p', 'sub', 'Öffnet die YouTube-Suche in einem neuen Tab. Nimm am besten ein kurzes Video von einer Schule oder einem Lehrkanal.'));
    var vs = el('div', 'vids'), vids = (t.videos && t.videos.length) ? t.videos : [{ titel: t.titel + ' einfach erklärt', q: t.titel + ' einfach erklärt' }];
    vids.forEach(function (v) { var a = el('a'); a.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(v.q); a.target = '_blank'; a.rel = 'noopener'; a.appendChild(el('i', null, '▶')); a.appendChild(document.createTextNode(v.titel)); vs.appendChild(a); });
    vc.appendChild(vs); wrap.appendChild(vc);
    // Weiter üben
    var pr = el('div', 'row-btns');
    var b1 = el('button', 'btn', 'Karteikarten zu diesem Thema'); b1.type = 'button'; b1.addEventListener('click', function () { startKarten({ themen: [t.id], label: t.titel }); }); pr.appendChild(b1);
    if ((t.mc || []).length) { var b2 = el('button', 'btn ghost', 'Quiz zu diesem Thema'); b2.type = 'button'; b2.addEventListener('click', function () { sessions.quiz = buildSession('quiz', { themen: [t.id], label: t.titel }); show('quiz'); }); pr.appendChild(b2); }
    wrap.appendChild(pr);
    return wrap;
  }

  /* ---------- Fach-Filter ---------- */
  var filt = { karten: '', quiz: '', rechnen: '', buchen: '', erklaeren: '' };
  var KIND = { karten: 'karten', quiz: 'mc', rechnen: 'rechnen', buchen: 'buchung', erklaeren: 'frei' };
  function renderFilter(mode) {
    var box = $('f' + mode.charAt(0).toUpperCase() + mode.slice(1)); clear(box);
    var kind = KIND[mode];
    var mk = function (id, label, n) { var c = el('button', 'chip'); c.type = 'button'; c.textContent = label; if (n != null) { var s = el('span', 'n', String(n)); c.appendChild(s); } c.setAttribute('aria-pressed', String(filt[mode] === id)); c.addEventListener('click', function () { filt[mode] = id; sessions[mode] = null; renderMode(mode); }); return c; };
    var total = 0; S.themen.forEach(function (t) { total += (t[kind] || []).length; });
    box.appendChild(mk('', 'Alle', total));
    S.faecher.slice().sort(function (a, b) { return (a.reihe || 99) - (b.reihe || 99); }).forEach(function (f) { var n = 0; themenVon(f.id).forEach(function (t) { n += (t[kind] || []).length; }); box.appendChild(mk(f.id, f.name, n)); });
  }

  /* ---------- Lern-Sitzungen ---------- */
  var sessions = { karten: null, quiz: null, rechnen: null, buchen: null, erklaeren: null };
  function pool(mode, opt) {
    var kind = KIND[mode], ths = opt && opt.themen ? S.themen.filter(function (t) { return opt.themen.indexOf(t.id) >= 0; }) : themenVon(filt[mode]);
    var out = []; ths.forEach(function (t) { (t[kind] || []).forEach(function (it) { out.push({ it: it, t: t }); }); });
    return out;
  }
  function buildSession(mode, opt) {
    var all = pool(mode, opt);
    var due = all.filter(function (x) { return isDue(x.it.id); });
    // nie gesehene und falsche zuerst, dann nach Fälligkeit
    due.sort(function (a, b) { var sa = st(a.it.id), sb = st(b.it.id); return (sa ? sa.b : -1) - (sb ? sb.b : -1); });
    var list = mode === 'karten' ? due.slice(0, 20) : shuffle(due.length ? due : all).slice(0, mode === 'erklaeren' ? 5 : 10);
    if (mode !== 'karten') list = shuffle(list);
    return { list: list, i: 0, right: 0, wrong: 0, label: opt && opt.label, total: all.length, again: [] };
  }
  function startKarten(opt) { sessions.karten = buildSession('karten', opt); show('karten'); }

  function renderMode(mode) {
    renderFilter(mode);
    var stage = $('s' + mode.charAt(0).toUpperCase() + mode.slice(1)); clear(stage);
    if (!S.loaded.themen) { stage.appendChild(el('p', 'empty', 'Lernstoff wird geladen …')); return; }
    if (!sessions[mode]) sessions[mode] = buildSession(mode);
    var s = sessions[mode];
    if (!s.total) { stage.appendChild(emptyFor(mode)); return; }
    if (s.i >= s.list.length) { stage.appendChild(doneBox(mode, s)); return; }
    var head = el('div', 'prog'); head.appendChild(el('span', null, (s.label ? s.label + ' · ' : '') + (s.i + 1) + ' von ' + s.list.length));
    var bar = el('div', 'bar'); var bi = el('i'); bi.style.width = Math.round(s.i / s.list.length * 100) + '%'; bar.appendChild(bi); head.appendChild(bar);
    head.appendChild(el('span', null, '✓ ' + s.right + ' · ✗ ' + s.wrong)); stage.appendChild(head);
    var x = s.list[s.i];
    if (mode === 'karten') stage.appendChild(cardView(s, x, mode));
    else if (mode === 'quiz') stage.appendChild(quizView(s, x, mode));
    else if (mode === 'rechnen') stage.appendChild(calcView(s, x, mode));
    else if (mode === 'buchen') stage.appendChild(bookView(s, x, mode));
    else if (mode === 'erklaeren') stage.appendChild(freeView(s, x, mode));
  }
  function emptyFor(mode) {
    var msg = {
      karten: 'Für diese Auswahl gibt es noch keine Karteikarten.',
      quiz: 'Für diese Auswahl gibt es noch keine Quizfragen.',
      rechnen: 'Für diese Auswahl gibt es noch keine Rechenaufgaben.',
      buchen: 'Noch keine Buchungssätze. Die kommen, sobald LF8 oder Rechnungswesen dran ist.',
      erklaeren: 'Für diese Auswahl gibt es noch keine Erklärfragen.'
    }[mode];
    var d = el('div', 'done-box'); d.appendChild(el('p', 'note', msg));
    d.appendChild(el('p', 'note', 'Neuer Lernstoff kommt dazu, sobald Finn ihn einträgt.'));
    return d;
  }
  function doneBox(mode, s) {
    var d = el('div', 'done-box');
    if (!s.list.length) { d.appendChild(el('p', 'big', '✓')); d.appendChild(el('p', null, 'Alles für heute erledigt. Die nächsten Karten sind morgen fällig.')); }
    else { var pct = Math.round(s.right / Math.max(1, s.right + s.wrong) * 100); d.appendChild(el('p', 'big', pct + ' %')); d.appendChild(el('p', null, s.right + ' richtig, ' + s.wrong + ' falsch')); }
    var r = el('div', 'row-btns');
    var again = el('button', 'btn', mode === 'karten' ? 'Weitere Karten' : 'Neue Runde'); again.type = 'button'; again.addEventListener('click', function () { sessions[mode] = buildSession(mode); renderMode(mode); });
    var home = el('button', 'btn ghost', 'Zu Heute'); home.type = 'button'; home.addEventListener('click', function () { sessions[mode] = null; show('heute'); });
    r.appendChild(again); r.appendChild(home); d.appendChild(r);
    if (mode === 'karten' && !s.list.length) { var all = el('button', 'chip', 'Trotzdem alle Karten üben'); all.type = 'button'; all.addEventListener('click', function () { var p = pool('karten'); sessions.karten = { list: shuffle(p).slice(0, 20), i: 0, right: 0, wrong: 0, total: p.length }; renderMode('karten'); }); d.appendChild(all); }
    return d;
  }
  function next(mode) { var s = sessions[mode]; s.i++; renderMode(mode); renderBadges(); }
  function ergTag(it) { return it.erg ? el('span', 'erg', 'aus dem Rahmenlehrplan ergänzt') : null; }

  /* Karteikarte */
  function cardView(s, x, mode) {
    var w = el('div', 'stage'), it = x.it, f = fach(x.t.fach);
    var en = f.id === 'en' || it.sprache === 'en';
    var rev = en && s.richtung === 'de-en';
    var c = el('button', 'flash'); c.type = 'button'; c.setAttribute('aria-label', 'Karte umdrehen');
    c.appendChild(el('span', 'lab', f.name + ' · ' + x.t.titel));
    c.appendChild(el('span', 'q', rev ? it.r : it.v));
    var tag = ergTag(it); if (tag) c.appendChild(tag);
    var a = el('span', 'a', rev ? it.v : it.r); a.hidden = true; c.appendChild(a);
    var hint = el('span', 'hint', 'Antippen zum Umdrehen'); c.appendChild(hint);
    var rate = el('div', 'rate'); rate.hidden = true;
    var bNo = el('button', 'btn bad', 'Nicht gewusst'), bMid = el('button', 'btn mid', 'Fast'), bOk = el('button', 'btn ok', 'Gewusst');
    [bNo, bMid, bOk].forEach(function (b) { b.type = 'button'; rate.appendChild(b); });
    function flip() { if (!a.hidden) return; a.hidden = false; hint.hidden = true; rate.hidden = false; bOk.focus({ preventScroll: true }); }
    c.addEventListener('click', flip);
    bNo.addEventListener('click', function () { mark(it.id, false); s.wrong++; s.list.push(x); next(mode); });
    bMid.addEventListener('click', function () { mark(it.id, true, 'fast'); s.right++; next(mode); });
    bOk.addEventListener('click', function () { mark(it.id, true); s.right++; next(mode); });
    w.appendChild(c); w.appendChild(rate);
    if (en) {
      var tools = el('div', 'row-btns');
      var dir = el('button', 'chip', rev ? 'Deutsch → Englisch' : 'Englisch → Deutsch'); dir.type = 'button'; dir.addEventListener('click', function () { s.richtung = rev ? 'en-de' : 'de-en'; renderMode(mode); }); tools.appendChild(dir);
      if (canSpeak) { var sp = el('button', 'chip', 'Vorlesen'); sp.type = 'button'; sp.addEventListener('click', function () { speak(it.v); }); tools.appendChild(sp); }
      w.appendChild(tools);
    }
    return w;
  }

  /* Quiz */
  function quizView(s, x, mode) {
    var w = el('div', 'stage'), it = x.it;
    w.appendChild(el('span', 'note', fach(x.t.fach).name + ' · ' + x.t.titel));
    w.appendChild(el('p', 'qq', it.f)); var tag = ergTag(it); if (tag) w.appendChild(tag);
    var order = shuffle(it.o.map(function (o, i) { return i; }));
    var box = el('div', 'opts'), why = el('div', 'why'); why.hidden = true;
    var nx = el('button', 'btn', 'Weiter'); nx.type = 'button'; nx.hidden = true; nx.addEventListener('click', function () { next(mode); });
    order.forEach(function (oi, n) {
      var b = el('button', 'opt'); b.type = 'button'; b.appendChild(el('span', 'k', 'ABCD'.charAt(n))); b.appendChild(el('span', null, it.o[oi]));
      b.addEventListener('click', function () {
        if (box.classList.contains('locked')) return; box.classList.add('locked');
        var ok = oi === it.ok; b.classList.add(ok ? 'right' : 'wrong');
        if (!ok) box.children[order.indexOf(it.ok)].classList.add('right');
        mark(it.id, ok); if (ok) s.right++; else s.wrong++;
        why.className = 'why ' + (ok ? 'ok' : 'bad'); why.textContent = (ok ? 'Richtig. ' : 'Leider falsch. ') + (it.why || ''); why.hidden = false; nx.hidden = false; nx.focus({ preventScroll: true });
      });
      box.appendChild(b);
    });
    w.appendChild(box); w.appendChild(why); w.appendChild(nx);
    return w;
  }

  /* Rechnen */
  function calcView(s, x, mode) {
    var w = el('div', 'stage'), it = x.it;
    w.appendChild(el('span', 'note', fach(x.t.fach).name + ' · ' + x.t.titel));
    w.appendChild(el('p', 'qq', it.a)); var tag = ergTag(it); if (tag) w.appendChild(tag);
    var f = el('form', 'calc-in'); var inp = el('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.id = 'calcIn'; inp.placeholder = 'Ergebnis'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Ergebnis');
    f.appendChild(inp); f.appendChild(el('span', 'unit', it.e || '')); var go = el('button', 'btn', 'Prüfen'); go.type = 'submit'; f.appendChild(go);
    var res = el('div', 'stage'); res.hidden = true;
    f.addEventListener('submit', function (e) {
      e.preventDefault(); if (!res.hidden) return;
      var v = parseNum(inp.value); if (isNaN(v)) { toast('Bitte eine Zahl eintippen, z. B. 74,13'); return; }
      var ok = Math.abs(v - it.w) <= (it.t || 0.01) + 1e-9;
      mark(it.id, ok); if (ok) s.right++; else s.wrong++;
      inp.disabled = true; go.hidden = true;
      var wy = el('div', 'why ' + (ok ? 'ok' : 'bad'), ok ? 'Richtig: ' + fmtNum(it.w, it.e) + ' ' + it.e : 'Nicht ganz. Richtig ist ' + fmtNum(it.w, it.e) + ' ' + it.e + ', du hattest ' + fmtNum(v, it.e) + '.');
      res.appendChild(wy); res.appendChild(el('h3', null, 'Lösungsweg'));
      var ol = el('ol', 'steps'); (it.s || []).forEach(function (t) { ol.appendChild(el('li', null, t)); }); res.appendChild(ol);
      var nx = el('button', 'btn', 'Weiter'); nx.type = 'button'; nx.addEventListener('click', function () { next(mode); }); res.appendChild(nx);
      res.hidden = false; nx.focus({ preventScroll: true });
    });
    w.appendChild(f); w.appendChild(res);
    if (FINE) setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 50);
    return w;
  }

  /* Buchungssatz: it = { g: Geschäftsfall, soll: [{k, n, b}], haben: [{k, n, b}] } */
  function bookView(s, x, mode) {
    var w = el('div', 'stage'), it = x.it;
    w.appendChild(el('span', 'note', fach(x.t.fach).name + ' · ' + x.t.titel));
    w.appendChild(el('p', 'qq', it.g)); var tag = ergTag(it); if (tag) w.appendChild(tag);
    var bk = el('div', 'bk'), sides = {};
    ['soll', 'haben'].forEach(function (side) {
      var col = el('div', 'bk-side'); col.appendChild(el('h3', null, side === 'soll' ? 'Soll' : 'an Haben'));
      sides[side] = [];
      for (var i = 0; i < Math.max(2, (it[side] || []).length); i++) {
        var r = el('div', 'bk-row'); var k = el('input'); k.type = 'text'; k.inputMode = 'numeric'; k.maxLength = 4; k.placeholder = 'Konto (4-stellig)'; k.setAttribute('aria-label', side + ' Konto ' + (i + 1));
        var b = el('input'); b.type = 'text'; b.inputMode = 'decimal'; b.placeholder = 'Betrag in €'; b.setAttribute('aria-label', side + ' Betrag ' + (i + 1));
        r.appendChild(k); r.appendChild(b); col.appendChild(r); sides[side].push([k, b]);
      }
      bk.appendChild(col);
    });
    w.appendChild(bk);
    var go = el('button', 'btn', 'Prüfen'); go.type = 'button'; w.appendChild(go);
    var kpb = kontenplanBox(); if (kpb) w.appendChild(kpb);
    go.addEventListener('click', function () {
      function read(side) { return sides[side].map(function (p) { return { k: p[0].value.trim(), b: parseNum(p[1].value) }; }).filter(function (r) { return r.k; }).sort(function (a, b) { return a.k < b.k ? -1 : 1; }); }
      function want(side) { return (it[side] || []).slice().sort(function (a, b) { return a.k < b.k ? -1 : 1; }); }
      var ok = ['soll', 'haben'].every(function (side) { var a = read(side), b = want(side); return a.length === b.length && a.every(function (r, i) { return r.k === b[i].k && Math.abs(r.b - b[i].b) < 0.01; }); });
      mark(it.id, ok); if (ok) s.right++; else s.wrong++; go.hidden = true;
      var line = function (side) { return (it[side] || []).map(function (r) { return r.k + ' ' + (r.n || '') + ' ' + fmtNum(r.b, '€') + ' €'; }).join(', '); };
      w.appendChild(el('div', 'why ' + (ok ? 'ok' : 'bad'), (ok ? 'Richtig gebucht. ' : 'Richtig wäre: ') + line('soll') + ' an ' + line('haben')));
      if (it.why) w.appendChild(el('p', 'note', it.why));
      var nx = el('button', 'btn', 'Weiter'); nx.type = 'button'; nx.addEventListener('click', function () { next(mode); }); w.appendChild(nx);
    });
    return w;
  }

  /* Erklären: selbst bewerten mit Musterlösung und Kriterien */
  function critBox(it, sel, onChange) {
    var ks = it.k && it.k.length ? it.k : ['Meine Antwort enthält das Wichtigste aus der Musterlösung'];
    var per = it.p / ks.length, box = el('div', 'fb');
    box.appendChild(el('h3', null, 'Musterlösung'));
    box.appendChild(el('p', 'muster', it.m || ''));
    box.appendChild(el('h3', null, 'Hak ab, was in deiner Antwort steht'));
    var list = el('div', 'crit'), sc = el('div', 'score'), b = el('b', null, '0');
    sc.appendChild(b); sc.appendChild(el('span', 'note', 'von ' + it.p + ' Punkten'));
    function pts() { return Math.round(sel.filter(Boolean).length * per * 2) / 2; }
    ks.forEach(function (txt, i) {
      var lab = el('label', 'crit-i'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!sel[i];
      cb.addEventListener('change', function () { sel[i] = cb.checked; var p = pts(); b.textContent = String(p).replace('.', ','); onChange(p); });
      lab.appendChild(cb); lab.appendChild(el('span', null, txt)); list.appendChild(lab);
    });
    b.textContent = String(pts()).replace('.', ',');
    box.appendChild(list); box.appendChild(sc);
    return box;
  }
  function mustBox(it) { var d = el('details'); d.appendChild(el('summary', null, 'Musterlösung anzeigen')); d.appendChild(el('p', 'muster', it.m || '')); return d; }
  function freeView(s, x, mode) {
    var w = el('div', 'stage'), it = x.it;
    var hd = el('div', 'prog'); hd.appendChild(el('span', null, fach(x.t.fach).name + ' · ' + x.t.titel)); hd.appendChild(el('span', 'pill', it.p + ' Punkte')); w.appendChild(hd);
    w.appendChild(el('p', 'qq', it.f)); var tag = ergTag(it); if (tag) w.appendChild(tag);
    var best = P.frei[it.id]; if (best) w.appendChild(el('p', 'note', 'Bisher beste Bewertung: ' + String(best.p).replace('.', ',') + ' von ' + it.p));
    var ta = el('textarea'); ta.id = 'freeIn'; ta.placeholder = 'Deine Antwort in ganzen Sätzen …'; ta.setAttribute('aria-label', 'Deine Antwort'); w.appendChild(ta);
    var btns = el('div', 'row-btns'); var go = el('button', 'btn', 'Mit Musterlösung vergleichen'); go.type = 'button'; var skip = el('button', 'btn ghost', 'Überspringen'); skip.type = 'button';
    btns.appendChild(go); btns.appendChild(skip); w.appendChild(btns);
    var out = el('div', 'stage'); w.appendChild(out);
    skip.addEventListener('click', function () { next(mode); });
    go.addEventListener('click', function () {
      var ans = ta.value.trim(); if (ans.length < 15) { toast('Schreib erst ein paar ganze Sätze, dann vergleichen.'); return; }
      ta.readOnly = true; go.hidden = true; skip.hidden = true;
      var got = 0, sel = [];
      out.appendChild(critBox(it, sel, function (p) { got = p; }));
      var done = el('button', 'btn', 'Fertig, weiter'); done.type = 'button';
      done.addEventListener('click', function () {
        var ok = got >= it.p * 0.6; mark(it.id, ok); if (ok) s.right++; else s.wrong++;
        if (!P.frei[it.id] || got > P.frei[it.id].p) { P.frei[it.id] = { p: got, d: today() }; queueSave(); }
        next(mode);
      });
      out.appendChild(done);
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return w;
  }

  /* ---------- Probeklausur ---------- */
  var EX = null, exTimer = null;
  var KEY = [[92, 1, 'sehr gut'], [81, 2, 'gut'], [67, 3, 'befriedigend'], [50, 4, 'ausreichend'], [30, 5, 'mangelhaft'], [0, 6, 'ungenügend']];
  function noteFor(pct) { for (var i = 0; i < KEY.length; i++) if (pct >= KEY[i][0]) return KEY[i]; return KEY[5]; }
  function renderKlausur() {
    var c = $('exCard'); clear(c);
    if (EX && !EX.done) { renderExam(c); return; }
    if (EX && EX.done) { renderExamResult(c); return; }
    c.appendChild(el('h2', null, 'Neue Probeklausur'));
    var withStoff = S.faecher.filter(function (f) { return themenVon(f.id).some(function (t) { return (t.mc || []).length || (t.rechnen || []).length || (t.frei || []).length; }); });
    if (!S.loaded.themen) { c.appendChild(el('p', 'empty', 'Lernstoff wird geladen …')); return; }
    if (!withStoff.length) { c.appendChild(el('p', 'empty', 'Noch kein Fach mit Aufgaben. Lade zuerst Notizen hoch.')); return; }
    var sel = { fach: withStoff[0].id, min: 45 };
    var up = upcoming(); if (up.length && withStoff.some(function (f) { return f.id === up[0].fach; })) sel.fach = up[0].fach;
    c.appendChild(el('h3', null, 'Fach'));
    var fc = el('div', 'chips'); withStoff.forEach(function (f) { var b = el('button', 'chip', f.name); b.type = 'button'; b.setAttribute('aria-pressed', String(f.id === sel.fach)); b.addEventListener('click', function () { sel.fach = f.id; [].forEach.call(fc.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }); fc.appendChild(b); }); c.appendChild(fc);
    c.appendChild(el('h3', null, 'Zeit'));
    var tc = el('div', 'chips'); [30, 45, 60, 90].forEach(function (m) { var b = el('button', 'chip', m + ' Minuten'); b.type = 'button'; b.setAttribute('aria-pressed', String(m === sel.min)); b.addEventListener('click', function () { sel.min = m; [].forEach.call(tc.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }); tc.appendChild(b); }); c.appendChild(tc);
    c.appendChild(el('p', 'note', 'Etwa 8 Multiple-Choice-Fragen (je 2 Punkte), 2 Rechenaufgaben (je 4 Punkte) und 2 Erklärfragen. Erklärfragen bewertest du am Ende selbst mit der Musterlösung. Hilfsmittel wie in der echten Arbeit: am besten keine.'));
    var go = el('button', 'btn', 'Probeklausur starten'); go.type = 'button'; go.addEventListener('click', function () { startExam(sel); }); c.appendChild(go);
    if (P.klausuren.length) {
      c.appendChild(el('h3', null, 'Bisherige Probeklausuren'));
      var ul = el('div', 'todo'); P.klausuren.slice(-6).reverse().forEach(function (k) { var r = el('div', 'trow'); r.appendChild(el('b', null, fach(k.fach).name + ' · ' + fmtDate(k.datum))); r.appendChild(el('span', 'pill', k.punkte + ' / ' + k.max + ' P.')); r.appendChild(el('span', 'pill ' + (k.note <= 2 ? 'ok' : k.note <= 4 ? 'warn' : 'bad'), 'Note ' + k.note)); ul.appendChild(r); }); c.appendChild(ul);
    }
  }
  function startExam(sel) {
    var ths = themenVon(sel.fach), mc = [], rc = [], fr = [];
    ths.forEach(function (t) { (t.mc || []).forEach(function (it) { mc.push({ it: it, t: t }); }); (t.rechnen || []).forEach(function (it) { rc.push({ it: it, t: t }); }); (t.frei || []).forEach(function (it) { fr.push({ it: it, t: t }); }); });
    var qs = [];
    shuffle(mc).slice(0, rc.length ? 8 : 10).forEach(function (x) { qs.push({ typ: 'mc', x: x, p: 2, order: shuffle(x.it.o.map(function (o, i) { return i; })), a: null }); });
    shuffle(rc).slice(0, 2).forEach(function (x) { qs.push({ typ: 'rechnen', x: x, p: 4, a: '' }); });
    shuffle(fr).slice(0, 2).forEach(function (x) { qs.push({ typ: 'frei', x: x, p: x.it.p, a: '' }); });
    EX = { fach: sel.fach, end: Date.now() + sel.min * 60000, min: sel.min, qs: qs, done: false };
    renderKlausur();
    clearInterval(exTimer); exTimer = setInterval(tickExam, 1000);
  }
  function tickExam() {
    if (!EX || EX.done) { clearInterval(exTimer); return; }
    var left = Math.max(0, EX.end - Date.now()), t = $('exTime');
    if (t) { t.textContent = pad(Math.floor(left / 60000)) + ':' + pad(Math.floor(left / 1000) % 60); t.className = 'timer' + (left < 300000 ? ' low' : ''); }
    if (!left) finishExam();
  }
  function renderExam(c) {
    var hd = el('div', 'vhead'); var l = el('div'); l.appendChild(el('h2', null, 'Probeklausur ' + fach(EX.fach).name)); l.appendChild(el('p', 'sub', EX.qs.length + ' Aufgaben · ' + EX.qs.reduce(function (s, q) { return s + q.p; }, 0) + ' Punkte')); hd.appendChild(l);
    var tm = el('span', 'timer', '--:--'); tm.id = 'exTime'; hd.appendChild(tm); c.appendChild(hd);
    EX.qs.forEach(function (q, qi) {
      var b = el('div', 'ex-q'), it = q.x.it;
      var h = el('div', 'qh'); h.appendChild(el('span', null, 'Aufgabe ' + (qi + 1))); h.appendChild(el('span', null, q.p + ' Punkte')); b.appendChild(h);
      b.appendChild(el('p', 'qq', q.typ === 'mc' ? it.f : q.typ === 'rechnen' ? it.a : it.f));
      if (q.typ === 'mc') {
        var box = el('div', 'opts'); q.order.forEach(function (oi, n) { var o = el('button', 'opt'); o.type = 'button'; o.appendChild(el('span', 'k', 'ABCD'.charAt(n))); o.appendChild(el('span', null, it.o[oi])); if (q.a === oi) o.style.boxShadow = 'inset 0 0 0 2px #fff'; o.addEventListener('click', function () { q.a = oi; [].forEach.call(box.children, function (x) { x.style.boxShadow = ''; }); o.style.boxShadow = 'inset 0 0 0 2px #fff'; }); box.appendChild(o); }); b.appendChild(box);
      } else if (q.typ === 'rechnen') {
        var f = el('div', 'calc-in'); var inp = el('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.placeholder = 'Ergebnis'; inp.value = q.a; inp.setAttribute('aria-label', 'Ergebnis Aufgabe ' + (qi + 1)); inp.addEventListener('input', function () { q.a = inp.value; }); f.appendChild(inp); f.appendChild(el('span', 'unit', it.e || '')); b.appendChild(f);
      } else {
        var ta = el('textarea'); ta.value = q.a; ta.placeholder = 'Antwort in ganzen Sätzen …'; ta.setAttribute('aria-label', 'Antwort Aufgabe ' + (qi + 1)); ta.addEventListener('input', function () { q.a = ta.value; }); b.appendChild(ta);
      }
      c.appendChild(b);
    });
    var r = el('div', 'row-btns'); var fin = el('button', 'btn', 'Abgeben'); fin.type = 'button'; fin.addEventListener('click', finishExam);
    var ab = el('button', 'btn ghost', 'Abbrechen'); ab.type = 'button'; ab.addEventListener('click', function () { if (ab.dataset.armed) { EX = null; clearInterval(exTimer); renderKlausur(); } else { ab.dataset.armed = '1'; ab.textContent = 'Wirklich abbrechen?'; setTimeout(function () { ab.textContent = 'Abbrechen'; delete ab.dataset.armed; }, 3000); } });
    r.appendChild(fin); r.appendChild(ab); c.appendChild(r);
    tickExam();
  }
  function finishExam() {
    if (!EX || EX.done) return;
    EX.done = true; EX.grading = 0; clearInterval(exTimer);
    EX.qs.forEach(function (q) {
      var it = q.x.it;
      if (q.typ === 'mc') { q.got = q.a === it.ok ? q.p : 0; mark(it.id, q.a === it.ok); }
      else if (q.typ === 'rechnen') { var v = parseNum(q.a), ok = !isNaN(v) && Math.abs(v - it.w) <= (it.t || 0.01) + 1e-9; q.got = ok ? q.p : 0; mark(it.id, ok); }
      else if (!q.a.trim()) { q.got = 0; q.fb = { punkte: 0, gut: [], fehlt: ['Keine Antwort'], tipp: '' }; }
      else { q.got = 0; q.sel = []; EX.grading++; }
    });
    if (!EX.grading) saveExam();
    renderKlausur();
  }
  function examScore() { var got = 0, max = 0; EX.qs.forEach(function (q) { max += q.p; got += q.got || 0; }); return { got: got, max: max }; }
  function saveExam() {
    if (EX.saved) return; EX.saved = true;
    var sc = examScore(), n = noteFor(sc.got / sc.max * 100);
    P.klausuren.push({ datum: today(), fach: EX.fach, punkte: sc.got, max: sc.max, note: n[1] }); queueSave();
  }
  function renderExamResult(c) {
    var sc = examScore(), pct = sc.max ? sc.got / sc.max * 100 : 0, n = noteFor(pct);
    var hd = el('div', 'vhead'); var l = el('div'); l.appendChild(el('h2', null, 'Ergebnis ' + fach(EX.fach).name)); l.appendChild(el('p', 'sub', EX.grading ? 'Bewerte unten deine ' + (EX.grading === 1 ? 'Erklärfrage' : EX.grading + ' Erklärfragen') + ' selbst, dann siehst du die Note.' : String(sc.got).replace('.', ',') + ' von ' + sc.max + ' Punkten · ' + Math.round(pct) + ' %')); hd.appendChild(l);
    var nb = el('div'); nb.appendChild(el('span', 'note-big', EX.grading ? '…' : String(n[1]))); nb.appendChild(el('p', 'note', EX.grading ? '' : n[2])); hd.appendChild(nb); c.appendChild(hd);
    var tb = el('table', 'keytab'); KEY.forEach(function (k, i) { var tr = el('tr', !EX.grading && k[1] === n[1] ? 'on' : ''); tr.appendChild(el('td', null, 'Note ' + k[1])); tr.appendChild(el('td', null, k[2])); tr.appendChild(el('td', null, (i ? k[0] + ' bis ' + (KEY[i - 1][0] - 1) : '92 bis 100') + ' %')); tb.appendChild(tr); }); var tw = el('details'); tw.appendChild(el('summary', null, 'IHK-Notenschlüssel')); tw.appendChild(tb); c.appendChild(tw);
    EX.qs.forEach(function (q, qi) {
      var b = el('div', 'ex-q'), it = q.x.it;
      var h = el('div', 'qh'); h.appendChild(el('span', null, 'Aufgabe ' + (qi + 1) + ' · ' + q.x.t.titel)); var pl = el('span', 'pill ' + (q.typ === 'frei' && EX.grading && q.sel ? '' : q.got >= q.p ? 'ok' : q.got > 0 ? 'warn' : 'bad'), String(q.got || 0).replace('.', ',') + ' / ' + q.p); h.appendChild(pl); b.appendChild(h);
      b.appendChild(el('p', 'qq', q.typ === 'rechnen' ? it.a : it.f));
      if (q.typ === 'mc') b.appendChild(el('div', 'why ' + (q.got ? 'ok' : 'bad'), (q.a == null ? 'Keine Antwort. ' : q.got ? 'Richtig. ' : 'Deine Antwort: ' + it.o[q.a] + '. ') + 'Richtig: ' + it.o[it.ok] + '. ' + (it.why || '')));
      else if (q.typ === 'rechnen') { b.appendChild(el('div', 'why ' + (q.got ? 'ok' : 'bad'), 'Deine Antwort: ' + (q.a || '–') + ' · Richtig: ' + fmtNum(it.w, it.e) + ' ' + it.e)); var ol = el('ol', 'steps'); (it.s || []).forEach(function (t) { ol.appendChild(el('li', null, t)); }); b.appendChild(ol); }
      else if (!q.a.trim()) { b.appendChild(el('div', 'why bad', 'Keine Antwort.')); b.appendChild(mustBox(it)); }
      else { b.appendChild(el('p', 'answer-own', q.a)); if (EX.grading) b.appendChild(critBox(it, q.sel, function (p) { q.got = p; pl.textContent = String(p).replace('.', ',') + ' / ' + q.p; })); else b.appendChild(mustBox(it)); }
      c.appendChild(b);
    });
    var r = el('div', 'row-btns');
    if (EX.grading) { var fin = el('button', 'btn ok', 'Bewertung fertig, Note anzeigen'); fin.type = 'button'; fin.addEventListener('click', function () { EX.grading = 0; EX.qs.forEach(function (q) { if (q.typ === 'frei' && q.sel) mark(q.x.it.id, q.got >= q.p * 0.6); }); saveExam(); renderKlausur(); toTop(); }); r.appendChild(fin); }
    var nw = el('button', 'btn' + (EX.grading ? ' ghost' : ''), 'Neue Probeklausur'); nw.type = 'button'; nw.addEventListener('click', function () { EX = null; renderKlausur(); }); r.appendChild(nw); c.appendChild(r);
  }


  /* ---------- Kontenplan (Schulkontenrahmen Großhandel) ---------- */
  function kontenplanBox(open) {
    var kp = (window.LZ_CONTENT || {}).kontenplan; if (!kp) return null;
    var d = el('details', 'kp'); if (open) d.open = true;
    d.appendChild(el('summary', null, 'Kontenplan: ' + kp.titel));
    var q = el('input'); q.type = 'search'; q.placeholder = 'Konto oder Name suchen, z. B. 4400 oder Bank'; q.setAttribute('aria-label', 'Kontenplan durchsuchen'); d.appendChild(q);
    var w = el('div', 'tw'), t = el('table'), hr = el('tr');
    ['Konto', 'Name', 'Klasse'].forEach(function (x) { hr.appendChild(el('th', null, x)); }); t.appendChild(hr);
    var rows = [];
    kp.klassen.forEach(function (k) { k.konten.forEach(function (c) { var tr = el('tr'); tr.appendChild(el('td', 'num', c[0])); tr.appendChild(el('td', null, c[1])); tr.appendChild(el('td', null, k.k + ' · ' + k.name)); t.appendChild(tr); rows.push([tr, (c[0] + ' ' + c[1] + ' ' + k.name).toLowerCase()]); }); });
    w.appendChild(t); d.appendChild(w);
    q.addEventListener('input', function () { var s = q.value.trim().toLowerCase().replace(/skont[oi]/g, 'skont'); rows.forEach(function (r) { r[0].hidden = !!s && r[1].indexOf(s) < 0; }); });
    d.appendChild(el('p', 'note', 'Quelle: ' + kp.quelle + '. Kontonummern sind immer vierstellig, kürzere Nummern werden hinten mit Nullen aufgefüllt (440 wird 4400). Unterkonten erkennt man an der letzten Ziffer: 2001 gehört zu 2000.'));
    return d;
  }

  /* ---------- Prüfungen (Abschlussprüfung Teil 1) ---------- */
  var PZ = { id: null, th: '', ende: 0, tick: null };
  function pzAll() { return ((window.LZ_CONTENT || {}).pruefungen || []).slice().sort(function (a, b) { return (a.reihe || 99) - (b.reihe || 99); }); }
  function pzById(id) { return pzAll().filter(function (e) { return e.id === id; })[0] || null; }
  function pzParts(e) { var o = []; e.aufgaben.forEach(function (a) { a.teile.forEach(function (t) { o.push({ e: e, a: a, t: t }); }); }); return o; }
  function pzGot(e, nr) { var s = P.pruef[e.id]; return s && s.p && s.p[nr] != null ? s.p[nr] : null; }
  function pzStand(e) { var got = 0, max = 0, done = 0, n = 0; pzParts(e).forEach(function (x) { n++; max += x.t.p; var v = pzGot(e, x.t.nr); if (v != null) { done++; got += v; } }); return { got: got, max: max, done: done, n: n }; }
  function pzSet(e, nr, v) { var s = P.pruef[e.id] || (P.pruef[e.id] = { p: {} }); if (!s.p) s.p = {}; if (v == null) delete s.p[nr]; else s.p[nr] = v; s.d = today(); queueSave(); }
  function pzTopics() { var m = {}; pzAll().forEach(function (e) { pzParts(e).forEach(function (x) { m[x.t.th] = (m[x.t.th] || 0) + 1; }); }); return Object.keys(m).sort().map(function (k) { return [k, m[k]]; }); }
  function fmtP(v) { return String(v).replace('.', ','); }
  function stopUhr() { clearInterval(PZ.tick); PZ.tick = null; PZ.ende = 0; }
  function tickUhr() {
    var u = $('pzUhr'); if (!u) { if (cur !== 'pruefungen') stopUhr(); return; }
    var left = Math.max(0, Math.round((PZ.ende - Date.now()) / 1000));
    u.textContent = Math.floor(left / 60) + ':' + pad(left % 60); u.className = 'timer' + (left < 600 ? ' low' : '');
    if (!left) { stopUhr(); toast('Die 90 Minuten sind um. Schau dir jetzt die Lösungen an.'); }
  }

  function renderPruefungen() {
    var c = $('pzBox'); clear(c);
    var e = PZ.id && pzById(PZ.id);
    if (e) { c.appendChild(pzExamPage(e)); return; }
    if (PZ.th) { c.appendChild(pzTopicPage(PZ.th)); return; }
    var all = pzAll();
    if (!all.length) { c.appendChild(el('p', 'empty', 'Noch keine Prüfungen hinterlegt.')); return; }
    var intro = el('div', 'card');
    var hd = el('div'); hd.appendChild(el('h2', null, 'Abschlussprüfung Teil 1')); hd.appendChild(el('p', 'sub', 'Organisieren des Warensortiments und von Dienstleistungen · 90 Minuten · 2 Aufgaben à 20 Punkte'));
    intro.appendChild(hd);
    intro.appendChild(el('p', 'note', 'Echte Prüfungen aus Baden-Württemberg, Aufgaben und Lösungen in eigenen Worten zusammengefasst. Die Originale mit allen Anlagen stehen in deinem Prüfungsbuch. So geht’s: Aufgabe lesen, Antwort aufschreiben, Lösung aufdecken, dir selbst Punkte geben. Am Ende siehst du die Note nach IHK-Schlüssel.'));
    var tc = el('div', 'chips'); tc.setAttribute('role', 'group'); tc.setAttribute('aria-label', 'Nach Thema üben');
    pzTopics().forEach(function (x) { var b = el('button', 'chip'); b.type = 'button'; b.textContent = x[0]; var n = el('span', 'n', String(x[1])); b.appendChild(n); b.addEventListener('click', function () { PZ.th = x[0]; renderPruefungen(); toTop(); }); tc.appendChild(b); });
    intro.appendChild(el('h3', null, 'Nach Thema üben')); intro.appendChild(tc);
    c.appendChild(intro);
    var grid = el('div', 'tgrid');
    all.forEach(function (x) {
      var s = pzStand(x), b = el('button', 'tcard'); b.type = 'button';
      b.appendChild(el('b', null, x.titel));
      b.appendChild(el('span', 'sub', x.art + ' · ' + x.aufgaben.map(function (a) { return a.firma.split(',')[0]; }).join(', ')));
      var m = el('div', 'meta'); m.appendChild(el('span', null, s.done + ' von ' + s.n + ' Teilaufgaben bewertet'));
      if (s.done) { var pct = s.got / s.max * 100; m.appendChild(el('span', 'pill ' + (s.done === s.n ? (pct >= 67 ? 'ok' : pct >= 50 ? 'warn' : 'bad') : ''), s.done === s.n ? 'Note ' + noteFor(pct)[1] : fmtP(s.got) + ' P.')); }
      b.appendChild(m);
      var bar = el('div', 'bar'); var fill = el('i'); fill.style.width = Math.round(s.done / s.n * 100) + '%'; bar.appendChild(fill); b.appendChild(bar);
      b.addEventListener('click', function () { PZ.id = x.id; renderPruefungen(); toTop(); });
      grid.appendChild(b);
    });
    c.appendChild(grid);
  }

  function pzBack(label) {
    var nav = el('div', 'row-btns'); var back = el('button', 'chip', '← ' + label); back.type = 'button';
    back.addEventListener('click', function () { PZ.id = null; PZ.th = ''; stopUhr(); renderPruefungen(); toTop(); }); nav.appendChild(back); return nav;
  }

  function pzPart(e, a, t, withExam, onRate) {
    var b = el('div', 'ex-q pz');
    var h = el('div', 'qh'); h.appendChild(el('span', null, (withExam ? e.titel + ' · Aufgabe ' : '') + t.nr + ' · ' + t.th));
    var pp = el('span', null, t.p + ' Punkte'); h.appendChild(pp); b.appendChild(h);
    if (withExam) b.appendChild(el('p', 'note', a.firma + ': ' + a.lage));
    b.appendChild(el('p', 'pz-f', t.f));
    var tags = el('div', 'row-btns');
    if (t.pg) tags.appendChild(el('span', 'pill', 'Punkte geschätzt'));
    if (t.eig) tags.appendChild(el('span', 'pill v', 'Lösung selbst erstellt'));
    if (tags.firstChild) b.appendChild(tags);
    var ta = el('textarea'); ta.placeholder = 'Deine Antwort (optional, wird nicht gespeichert) …'; ta.setAttribute('aria-label', 'Deine Antwort zu ' + t.nr); b.appendChild(ta);
    var got = pzGot(e, t.nr);
    var show = el('button', 'btn ghost', got == null ? 'Lösung zeigen' : 'Lösung zeigen (bewertet: ' + fmtP(got) + ' von ' + t.p + ')'); show.type = 'button';
    var sol = el('div', 'pz-sol'); sol.hidden = true;
    show.addEventListener('click', function () { sol.hidden = !sol.hidden; show.textContent = sol.hidden ? 'Lösung zeigen' : 'Lösung ausblenden'; });
    b.appendChild(show);
    sol.appendChild(el('h3', null, 'Lösung'));
    sol.appendChild(el('p', 'muster', t.l));
    if (t.tab) sol.appendChild(renderBlock({ t: 'tabelle', kopf: t.tab.kopf, zeilen: t.tab.zeilen }));
    sol.appendChild(el('h3', null, 'Wie viele Punkte gibst du dir?'));
    var rate = el('div', 'chips'); rate.setAttribute('role', 'group'); rate.setAttribute('aria-label', 'Punkte für ' + t.nr);
    for (var v = 0; v <= t.p; v++) (function (v) {
      var r = el('button', 'chip', String(v)); r.type = 'button'; r.setAttribute('aria-pressed', String(pzGot(e, t.nr) === v));
      r.addEventListener('click', function () { var on = pzGot(e, t.nr) === v; pzSet(e, t.nr, on ? null : v); [].forEach.call(rate.children, function (x) { x.setAttribute('aria-pressed', String(!on && x === r)); }); if (onRate) onRate(); });
      rate.appendChild(r);
    })(v);
    sol.appendChild(rate);
    b.appendChild(sol);
    return b;
  }

  function pzExamPage(e) {
    var wrap = el('div', 'view'); wrap.appendChild(pzBack('Alle Prüfungen'));
    var top = el('div', 'card'), hd = el('div', 'vhead'), l = el('div');
    l.appendChild(el('h2', null, e.titel)); l.appendChild(el('p', 'sub', e.art + ' · 90 Minuten · ' + pzStand(e).max + ' Punkte'));
    hd.appendChild(l);
    var uhrBox = el('div', 'row-btns');
    var uhr = el('span', 'timer'); uhr.id = 'pzUhr'; uhr.textContent = '90:00';
    var ub = el('button', 'btn ghost', PZ.tick ? 'Uhr stoppen' : 'Prüfungsuhr starten'); ub.type = 'button';
    ub.addEventListener('click', function () { if (PZ.tick) { stopUhr(); ub.textContent = 'Prüfungsuhr starten'; uhr.textContent = '90:00'; uhr.className = 'timer'; } else { PZ.ende = Date.now() + 90 * 60000; PZ.tick = setInterval(tickUhr, 1000); ub.textContent = 'Uhr stoppen'; tickUhr(); } });
    uhrBox.appendChild(uhr); uhrBox.appendChild(ub); hd.appendChild(uhrBox); top.appendChild(hd);
    if (e.hinweis) top.appendChild(el('p', 'note', 'Hinweis: ' + e.hinweis));
    top.appendChild(el('p', 'note', e.quelle));
    wrap.appendChild(top);
    var sum = el('div', 'card');
    function renderSum() {
      clear(sum); var s = pzStand(e), pct = s.max ? s.got / s.max * 100 : 0, n = noteFor(pct);
      var h2 = el('div', 'vhead'), ll = el('div');
      ll.appendChild(el('h2', null, 'Dein Ergebnis'));
      ll.appendChild(el('p', 'sub', s.done < s.n ? s.done + ' von ' + s.n + ' Teilaufgaben bewertet · bisher ' + fmtP(s.got) + ' Punkte' : fmtP(s.got) + ' von ' + s.max + ' Punkten · ' + Math.round(pct) + ' %'));
      h2.appendChild(ll);
      var nb = el('div'); nb.appendChild(el('span', 'note-big', s.done < s.n ? '…' : String(n[1]))); nb.appendChild(el('p', 'note', s.done < s.n ? 'Note nach allen Teilaufgaben' : n[2])); h2.appendChild(nb);
      sum.appendChild(h2);
      if (s.done) { var rs = el('button', 'chip', 'Bewertung zurücksetzen'); rs.type = 'button'; rs.addEventListener('click', function () { if (!rs.dataset.armed) { rs.dataset.armed = '1'; rs.textContent = 'Wirklich alles zurücksetzen?'; setTimeout(function () { rs.textContent = 'Bewertung zurücksetzen'; delete rs.dataset.armed; }, 3000); return; } delete P.pruef[e.id]; queueSave(); renderPruefungen(); }); var rr = el('div', 'row-btns'); rr.appendChild(rs); sum.appendChild(rr); }
    }
    e.aufgaben.forEach(function (a) {
      var card = el('div', 'card');
      var ah = el('div'); ah.appendChild(el('h2', null, 'Aufgabe ' + a.nr + ' · ' + a.firma)); ah.appendChild(el('p', 'sub', a.teile.reduce(function (s, t) { return s + t.p; }, 0) + ' Punkte'));
      card.appendChild(ah);
      card.appendChild(el('p', 'pz-lage', a.lage));
      a.teile.forEach(function (t) { card.appendChild(pzPart(e, a, t, false, renderSum)); });
      wrap.appendChild(card);
    });
    renderSum(); wrap.appendChild(sum);
    if (PZ.tick) setTimeout(tickUhr, 0);
    return wrap;
  }

  function pzTopicPage(th) {
    var wrap = el('div', 'view'); wrap.appendChild(pzBack('Alle Prüfungen'));
    var top = el('div', 'card'); top.appendChild(el('h2', null, th));
    var list = []; pzAll().forEach(function (e) { pzParts(e).forEach(function (x) { if (x.t.th === th) list.push(x); }); });
    top.appendChild(el('p', 'sub', list.length + ' Teilaufgaben aus allen Prüfungen'));
    wrap.appendChild(top);
    var card = el('div', 'card');
    list.forEach(function (x) { card.appendChild(pzPart(x.e, x.a, x.t, true)); });
    wrap.appendChild(card);
    return wrap;
  }

  /* ---------- Fächer und Termine ---------- */
  function renderFaecher() {
    var box = $('fachList'); clear(box);
    if (!S.loaded.faecher) { box.appendChild(el('p', 'empty', 'Fächer werden geladen …')); return; }
    S.faecher.slice().sort(function (a, b) { return (a.reihe || 99) - (b.reihe || 99); }).forEach(function (f) {
      var c = el('div', 'card'), ths = themenVon(f.id);
      var hd = el('div', 'vhead'); var l = el('div'); var h = el('h2', 'ttl'); var dot = el('span', 'fdot f-' + (f.farbe || 'blue')); h.appendChild(dot); h.appendChild(document.createTextNode(f.name)); l.appendChild(h);
      var ergN = 0, itN = 0; ths.forEach(function (t) { ['karten', 'mc', 'rechnen', 'frei', 'buchung'].forEach(function (k) { (t[k] || []).forEach(function (it) { itN++; if (it.erg) ergN++; }); }); });
      l.appendChild(el('p', 'sub', (f.lang || '') + ' · ' + ths.length + ' Themen · ' + itN + ' Aufgaben' + (ergN ? ' · ' + ergN + ' ergänzt' : ''))); hd.appendChild(l);
      var tm = upcoming().filter(function (x) { return x.fach === f.id; })[0]; if (tm) hd.appendChild(el('span', 'pill ' + (daysTo(tm.datum) <= 7 ? 'warn' : ''), 'Arbeit in ' + daysTo(tm.datum) + ' Tagen'));
      c.appendChild(hd);
      if (!ths.length) c.appendChild(el('p', 'empty', 'Noch kein Stoff. Lade Notizen oder Fotos hoch.'));
      ths.forEach(function (t) {
        var m = mastery(t), r = el('div', 'topic'); var tx = el('div'); tx.appendChild(el('b', null, t.titel)); tx.appendChild(el('small', null, (t.quelle || '') + ' · ' + allItems(t, ['karten', 'mc', 'rechnen', 'frei', 'buchung']).length + ' Aufgaben')); r.appendChild(tx);
        var bar = el('div', 'bar'); var i = el('i'); i.style.width = (m || 0) + '%'; if (m >= 75) i.className = 'ok'; bar.appendChild(i); r.appendChild(bar);
        r.appendChild(el('span', 'pct', (m == null ? '–' : m) + ' %')); c.appendChild(r);
      });
      box.appendChild(c);
    });
    // Termine
    var tl = $('terminList'); clear(tl);
    var all = S.termine.slice().sort(function (a, b) { return a.datum < b.datum ? -1 : 1; });
    if (!all.length) tl.appendChild(el('p', 'empty', 'Noch keine Klassenarbeit eingetragen.'));
    all.forEach(function (tm) {
      var r = el('div', 'trow'); var d = daysTo(tm.datum);
      r.appendChild(el('b', null, (tm.titel || fach(tm.fach).name) + ' · ' + fmtDate(tm.datum)));
      r.appendChild(el('span', 'pill ' + (d < 0 ? '' : d <= 7 ? 'warn' : ''), d < 0 ? 'vorbei' : d === 0 ? 'heute' : 'in ' + d + ' T.'));
      var acts = el('div', 'chips');
      var ed = el('button', 'chip', 'Ändern'); ed.type = 'button'; ed.addEventListener('click', function () { editTermin(tm); }); acts.appendChild(ed);
      var del = el('button', 'chip', 'Löschen'); del.type = 'button';
      del.addEventListener('click', function () { if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Sicher?'; setTimeout(function () { del.textContent = 'Löschen'; delete del.dataset.armed; }, 3000); return; } del.disabled = true; rpc('lz_termin_delete', { p_code: CODE, p_id: tm.id }).then(function () { toast('Termin gelöscht.'); setTermine(S.termine.filter(function (x) { return x.id !== tm.id; })); refresh(true); }).catch(function () { del.disabled = false; toast('Löschen hat nicht geklappt. Bist du online?'); }); });
      acts.appendChild(del); r.appendChild(acts); tl.appendChild(r);
    });
    fillFachSelect($('tfFach'));
  }
  function fillFachSelect(sel) { var v = sel.value; clear(sel); S.faecher.slice().sort(function (a, b) { return (a.reihe || 99) - (b.reihe || 99); }).forEach(function (f) { var o = el('option', null, f.name); o.value = f.id; sel.appendChild(o); }); if (v) sel.value = v; }
  var editId = null;
  function editTermin(tm) {
    editId = tm.id; fillFachSelect($('tfFach')); $('tfFach').value = tm.fach; $('tfDatum').value = tm.datum; $('tfTitel').value = tm.titel || '';
    $('tfSubmit').textContent = 'Änderung speichern'; $('tfCancel').hidden = false; $('terminForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function resetTerminForm() { editId = null; $('tfTitel').value = ''; $('tfDatum').value = ''; $('tfSubmit').textContent = 'Termin eintragen'; $('tfCancel').hidden = true; }
  $('tfCancel').addEventListener('click', resetTerminForm);
  $('terminForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = $('tfFach').value, d = $('tfDatum').value; if (!f || !d) return;
    var old = editId ? S.termine.filter(function (x) { return x.id === editId; })[0] : null;
    var id = editId || (d + '-' + f + '-' + Math.random().toString(36).slice(2, 6));
    var themen = old && old.fach === f ? (old.themen || []) : [];
    var titel = $('tfTitel').value.trim() || fach(f).name + ' Klassenarbeit';
    $('tfSubmit').disabled = true;
    rpc('lz_termin_save', { p_code: CODE, p_id: id, p_fach: f, p_datum: d, p_titel: titel, p_themen: themen })
      .then(function () { toast(editId ? 'Termin geändert.' : 'Termin eingetragen.'); resetTerminForm(); refresh(true); })
      .catch(function () { toast('Speichern hat nicht geklappt. Bist du online?'); })
      .then(function () { $('tfSubmit').disabled = false; });
  });
  function openModal(id) { $(id).hidden = false; var f = $(id).querySelector(FINE ? 'input, select, button' : 'button'); if (f) f.focus({ preventScroll: true }); }
  function closeModal(id) { $(id).hidden = true; }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { ['mSet', 'mHelp'].forEach(closeModal); if (!$('mNeu').hidden) closeNeu(); } });
  $('bHelp').addEventListener('click', function () { openModal('mHelp'); });
  $('heClose').addEventListener('click', function () { closeModal('mHelp'); });
  /* ---------- Neuigkeiten: Fenster mit allem, was seit dem letzten Besuch dazugekommen ist ---------- */
  var neuShown = false, neuPending = [];
  function neuListe() { return ((window.LZ_CONTENT || {}).neu || []).slice().sort(function (a, b) { return a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0; }); }
  function neuOffen() { var seen = P.neu || []; return neuListe().filter(function (n) { return seen.indexOf(n.id) < 0; }).slice(0, 4); }
  function neuGesehen(list) { var seen = (P.neu || []).slice(); list.forEach(function (n) { if (seen.indexOf(n.id) < 0) seen.push(n.id); }); P.neu = seen; queueSave(); }
  function neuGehe(p) {
    if (p.f) { if (p.v === 'lernen') { lern.fach = p.f; lern.topic = null; } else if (p.v in filt) { filt[p.v] = p.f; sessions[p.v] = null; } }
    if (p.v === 'pruefungen') { PZ.id = null; PZ.th = ''; }
    show(p.v);
  }
  function showNeu(list, alle) {
    var box = $('neuList'); clear(box);
    list.forEach(function (n) {
      var d = el('div', 'inner neu-item'), h = el('div', 'neu-h');
      h.appendChild(el('b', null, n.titel)); h.appendChild(el('span', 'pill v', fmtDate(n.datum))); d.appendChild(h);
      var ul = el('ul', 'neu-ul');
      (n.punkte || []).forEach(function (p) {
        var li = el('li'); li.appendChild(el('span', null, p.t + ' '));
        if (p.v) { var b = el('button', 'chip', 'Ansehen'); b.type = 'button'; b.addEventListener('click', function () { closeNeu(); neuGehe(p); }); li.appendChild(b); }
        ul.appendChild(li);
      });
      d.appendChild(ul); box.appendChild(d);
    });
    if (!list.length) box.appendChild(el('p', 'empty', 'Gerade gibt es nichts Neues.'));
    $('neuSub').textContent = alle ? 'Die letzten Änderungen an der Lernzentrale.' : 'Das ist seit deinem letzten Besuch dazugekommen.';
    neuPending = alle ? [] : list;
    openModal('mNeu');
  }
  function closeNeu() { if (neuPending.length) neuGesehen(neuPending); neuPending = []; closeModal('mNeu'); }
  function checkNeu() {
    if (neuShown || !CODE || !$('gate').hidden) return; neuShown = true;
    var l = neuOffen(); if (l.length) showNeu(l, false);
  }
  $('neuClose').addEventListener('click', closeNeu);
  $('heNeu').addEventListener('click', function () { closeModal('mHelp'); showNeu(neuListe().slice(0, 4), true); });

  /* ---------- Einstellungen ---------- */
  $('bSet').addEventListener('click', function () { $('seName').value = ME.name || ''; openModal('mSet'); });
  $('seClose').addEventListener('click', function () { closeModal('mSet'); });
  $('seNameForm').addEventListener('submit', function (e) {
    e.preventDefault(); var n = $('seName').value.trim(); if (!n) return;
    rpc('lz_rename', { p_code: CODE, p_name: n }).then(function () { ME.name = n; lsSet(K('me'), ME); toast('Name gespeichert.'); if (cur === 'heute') render(cur); }).catch(function () { toast('Speichern hat nicht geklappt.'); });
  });
  $('seCopy').addEventListener('click', function () {
    var link = location.origin + location.pathname + '?p=' + encodeURIComponent(CODE);
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { toast('Link kopiert.'); }).catch(function () { window.prompt('Dein Link:', link); });
  });

  /* Mausrad über Seitenleiste und Kopfzeile scrollt trotzdem den Inhalt */
  ['gside', 'dtop'].forEach(function (cls) { var n = document.querySelector('.' + cls); if (n) n.addEventListener('wheel', function (e) { if (cls === 'gside' && n.scrollWidth > n.clientWidth && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; var sc = $('scroller'); if (sc) sc.scrollTop += e.deltaY; }, { passive: true }); });

  /* Kein Zoomen: Zwei-Finger-Zoom am iPhone abfangen (Doppeltipp-Zoom ist per CSS aus) */
  ['gesturestart', 'gesturechange'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });

  /* Beim Tippen am Handy die Leiste ausblenden, damit sie nicht über der Tastatur hängt */
  function isTyping(t) { return t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|number|date|search|email|tel|url)$/.test(t.type))); }
  document.addEventListener('focusin', function (e) { if (isTyping(e.target)) document.body.classList.add('typing'); });
  document.addEventListener('focusout', function () { setTimeout(function () { if (!isTyping(document.activeElement)) document.body.classList.remove('typing'); }, 60); });

  /* ---------- Start ---------- */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  function readCode() {
    var m = /[?&]p=([A-Za-z0-9-]{10,40})/.exec(location.search);
    if (m) { try { localStorage.setItem('lz:code', m[1]); } catch (e) {} return m[1]; }
    try { return localStorage.getItem('lz:code'); } catch (e) { return null; }
  }
  function gate(msg) { $('gateMsg').textContent = msg; $('gate').hidden = false; document.body.classList.add('gated'); }
  var LZ = window.LZ_CONTENT || { faecher: [], themen: [] };
  S.faecher = LZ.faecher; S.themen = LZ.themen; S.loaded.faecher = true; S.loaded.themen = true;
  CODE = readCode();
  if (!CODE) {
    gate('Öffne die Lernzentrale über deinen persönlichen Link. Den bekommst du von Finn.');
  } else {
    if (!/[?&]p=/.test(location.search)) history.replaceState(null, '', location.pathname + '?p=' + encodeURIComponent(CODE) + location.hash);
    loadLocal();
    ME = lsGet(K('me'), ME);
    var tc = lsGet(K('termine'), null); if (tc) { S.termine = tc; S.loaded.termine = true; }
    var startV = (location.hash || '').slice(1);
    if (VIEWS.indexOf(startV) < 0) { try { startV = localStorage.getItem('lernzentrale:ansicht') || 'heute'; } catch (e) { startV = 'heute'; } }
    show(startV);
    setLive('', 'Verbinde …');
    lastRefresh = Date.now();
    rpc('lz_login', { p_code: CODE }).then(function (d) {
      ME = { name: d.name || '', admin: !!d.admin }; lsSet(K('me'), ME);
      if (dirty) saveNow();
      else if (d.progress && d.progress.items) { P = normP(d.progress); lsSet(K('stand'), P); }
      setLive('ok', dirty ? 'Speichert …' : 'Gespeichert');
      setTermine(d.termine);
      render(cur);
      setTimeout(checkNeu, 400);
    }).catch(function (e) {
      if (e && e.code === '28000') { try { localStorage.removeItem('lz:code'); } catch (x) {} gate('Dieser Link ist nicht gültig. Frag Finn nach deinem persönlichen Link.'); return; }
      setLive('warn', 'Offline'); S.loaded.termine = true; render(cur); setTimeout(checkNeu, 400);
    });
  }
})();
