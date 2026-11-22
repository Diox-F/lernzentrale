/* Übergänge für jede Interaktion (Version 8):
   1. Die Karte wird zur Seite: erst blendet die Seite an Ort und Stelle über die Karte, dann wächst sie gleichmäßig auf.
      Zurück geht sie genauso in die Karte zurück. 2. Menüs starten an ihrem Knopf.
   3. Reiterwechsel: der neue Reiter kommt immer von links, der alte gleitet nach rechts weg und blendet aus.
   4. Alles andere: Was sich nach einem Tippen verschiebt, gleitet an seine neue Stelle; wirklich Neues blendet weich ein.
   Milchglas wird nur über die Deckkraft eingeblendet (nie über die Unschärfe), das bleibt auch am Handy flüssig.
   An der Bedienung ändert sich nichts: alles passiert sofort, nur das Bild gleitet. Bei „Bewegung reduzieren“ ist alles aus. */
(function () {
  if (window.Uebergang || !Element.prototype.animate) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  /* Kurven: WEICH beginnt sanft und landet sanft (für Bewegungen), AUF blendet zügig und weich ein, ZU für das Schließen */
  var WEICH = 'cubic-bezier(.4,0,.16,1)', AUF = 'cubic-bezier(.22,.6,.3,1)', ZU = 'cubic-bezier(.45,0,.2,1)';
  var DAUER = 1300, ZU_DAUER = 1000, MENU_DAUER = 900, REITER = 1000, REITER_WEG = 400;
  var FENSTER = '.modal, [data-uebergang]';
  var MENUS = '#skyMenu, [role="menu"], [data-uebergang="menu"]';
  var QUELLE = 'button, a, [role="button"], [role="option"], [data-u-key], li, [tabindex]';
  var tipp = null, scrollBeiTipp = null;

  function aus() { return !!(mq && mq.matches) || document.hidden; }
  function merke(e) {
    scrollBeiTipp = window.scrollY;
    var t = e.target, q = t && t.closest ? t.closest(QUELLE) : null;
    if (!q) return;
    tipp = { el: q, t: Date.now() };
  }
  document.addEventListener('pointerdown', merke, true);
  document.addEventListener('click', merke, true);
  function sichtbar(r) { return r && r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }
  function frischeQuelle() {
    if (!tipp || Date.now() - tipp.t > 900 || !tipp.el.isConnected) return null;
    var r = tipp.el.getBoundingClientRect();
    return sichtbar(r) ? { el: tipp.el, rect: r } : null;
  }
  function radius(el) { var v = parseFloat(getComputedStyle(el).borderTopLeftRadius); return isFinite(v) ? v : 0; }
  function karteVon(z) {
    if (z.tagName === 'DIALOG' || z.matches(MENUS)) return z;
    var k = z.querySelector(':scope > .modal-card') || firstSichtbaresKind(z);
    return k || z;
  }
  function firstSichtbaresKind(z) {
    for (var c = z.firstElementChild; c; c = c.nextElementSibling) if (!c.hasAttribute('data-u-schleier')) return c;
    return null;
  }
  function stopp(el) { if (el && el.getAnimations) el.getAnimations({ subtree: false }).forEach(function (a) { a.cancel(); }); }
  function ani(el, kf, opt) { try { return el.animate(kf, opt); } catch (e) { return null; } }

  /* ---------- Milchglas ---------- */
  function glas(el) {
    try { var cs = getComputedStyle(el), b = cs.backdropFilter || cs.webkitBackdropFilter || 'none'; return b && b !== 'none' ? b : null; } catch (e) { return null; }
  }
  function glasIn(root, max) {
    var set = [], alle = root.querySelectorAll('*');
    for (var i = 0; i < alle.length && i < (max || 2500); i++) if (glas(alle[i])) set.push(alle[i]);
    return set;
  }
  /* Ziele zum Ein- oder Ausblenden: nie die Deckkraft eines Bereichs ändern, der Glas enthält (sonst springt das Glas am Ende),
     sondern die Glasflächen und die übrigen Teile darunter einzeln */
  function blendZiele(root) {
    var gl = glasIn(root);
    if (!gl.length) return [root];
    var ziele = [];
    (function geh(el) {
      for (var c = el.firstElementChild; c && ziele.length < 260; c = c.nextElementSibling) {
        if (gl.indexOf(c) >= 0) { ziele.push(c); continue; }
        var drin = false; for (var j = 0; j < gl.length; j++) if (c.contains(gl[j])) { drin = true; break; }
        if (drin) geh(c); else ziele.push(c);
      }
    })(root);
    return ziele;
  }
  function sanftEin(root, start, dauer, verzoegerung, opDauer, opVerzug) {
    var opt = { duration: dauer, delay: verzoegerung || 0, easing: WEICH, fill: 'backwards' };
    var oOpt = { duration: opDauer || dauer, delay: (verzoegerung || 0) + (opVerzug || 0), easing: AUF, fill: 'backwards' };
    if (start) ani(root, [{ translate: start }, { translate: '0px 0px' }], opt);
    blendZiele(root).forEach(function (z) { ani(z, [{ opacity: 0 }, { opacity: 1 }], oOpt); });
  }

  /* ---------- Fenster-Hintergrund ---------- */
  /* <dialog>: der abgedunkelte Hintergrund (::backdrop) blendet über die Deckkraft */
  function hintergrund(z, auf, dauer) {
    if (z.tagName !== 'DIALOG') return;
    if (z.__uBg) { z.__uBg.cancel(); z.__uBg = null; }
    z.__uBg = ani(z, auf ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
      { duration: dauer, easing: auf ? AUF : ZU, fill: auf ? 'none' : 'forwards', pseudoElement: '::backdrop' });
  }
  /* .modal: Farbe und Milchglas des Hintergrunds liegen für die Dauer des Fensters auf einer eigenen Ebene (Schleier),
     die nur über die Deckkraft blendet. Das Bild ist am Ende genau wie vorher. */
  var SCHLEIER_PROPS = ['background-color', 'background-image', 'backdrop-filter', '-webkit-backdrop-filter', 'isolation'];
  function schleier(z) {
    if (z.__uSchleier && z.__uSchleier.el.isConnected) return z.__uSchleier;
    var cs = getComputedStyle(z), farbe = cs.backgroundColor, bild = cs.backgroundImage, b = glas(z);
    if (!b && (!bild || bild === 'none') && (/rgba\(.*,\s*0\)$/.test(farbe) || farbe === 'transparent')) return null;
    var s = document.createElement('div');
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('data-u-schleier', '');
    s.style.cssText = 'position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;background-color:' + farbe +
      (bild && bild !== 'none' ? ';background-image:' + bild : '') + (b ? ';-webkit-backdrop-filter:' + b + ';backdrop-filter:' + b : '');
    var alt = {};
    SCHLEIER_PROPS.forEach(function (p) { alt[p] = [z.style.getPropertyValue(p), z.style.getPropertyPriority(p)]; });
    z.style.setProperty('background-color', 'transparent', 'important');
    z.style.setProperty('background-image', 'none', 'important');
    z.style.setProperty('backdrop-filter', 'none', 'important');
    z.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
    z.style.setProperty('isolation', 'isolate', 'important'); /* damit der Schleier (z-index -1) sicher hinter der Karte und vor der Seite liegt */
    z.insertBefore(s, z.firstChild);
    var info = {
      el: s,
      weg: function () {
        if (s.parentNode) s.parentNode.removeChild(s);
        SCHLEIER_PROPS.forEach(function (p) { if (alt[p][0]) z.style.setProperty(p, alt[p][0], alt[p][1]); else z.style.removeProperty(p); });
        if (z.__uSchleier === info) z.__uSchleier = null;
      }
    };
    z.__uSchleier = info;
    return info;
  }
  function schleierAuf(z, dauer) {
    var s = schleier(z); if (!s) return;
    stopp(s.el); ani(s.el, [{ opacity: 0 }, { opacity: 1 }], { duration: dauer, easing: AUF, fill: 'backwards' });
    /* Glasflächen im Fenster (außer der Karte, die sich schon bewegt) blenden ebenfalls über die Deckkraft */
    var k = karteVon(z);
    glasIn(z, 400).forEach(function (g) { if (g !== k && g !== s.el && !k.contains(g)) ani(g, [{ opacity: 0 }, { opacity: 1 }], { duration: dauer, easing: AUF, fill: 'backwards' }); });
  }
  function schleierZu(z, dauer) {
    var s = z.__uSchleier; if (!s || !s.el.isConnected) return;
    stopp(s.el); ani(s.el, [{ opacity: 1 }, { opacity: 0 }], { duration: dauer, easing: ZU, fill: 'forwards' });
  }
  function schleierWeg(z) { if (z.__uSchleier) z.__uSchleier.weg(); }

  /* ---------- Karte ↔ Seite: k liegt an seiner echten Stelle kr, q ist die Stelle der Karte ---------- */
  function bildA(k, q, kr) {
    var s = q.width / kr.width, tx = q.left - kr.left, ty = q.top - kr.top;
    var sichtH = q.height / s, unten = Math.max(0, kr.height - sichtH);
    return { transformOrigin: '0 0', transform: 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')', clipPath: 'inset(0px 0px ' + unten + 'px 0px round ' + (q.r / s) + 'px)', opacity: 0 };
  }
  function bildB(k) { return { transformOrigin: '0 0', transform: 'none', clipPath: 'inset(0px 0px 0px 0px round ' + radius(k) + 'px)', opacity: 1 }; }
  /* Auf: in den ersten Augenblicken blendet die Seite an Ort und Stelle über die Karte, dann wächst sie gleichmäßig auf */
  function seiteAuf(k, q, kr, dauer) {
    var a = bildA(k, q, kr), b = bildB(k);
    k.style.willChange = 'transform, opacity';
    var an = ani(k, [a, { opacity: 1, offset: 0.16 }, b], { duration: dauer || DAUER, easing: WEICH });
    if (an) an.onfinish = an.oncancel = function () { k.style.willChange = ''; };
    return an;
  }
  /* Zu: die Seite schrumpft gleichmäßig in die Karte und blendet erst ganz am Ende in sie über */
  function seiteZu(k, q, kr) {
    var a = bildA(k, q, kr), b = bildB(k);
    return ani(k, [b, { opacity: 1, offset: 0.8 }, a], { duration: ZU_DAUER, easing: ZU, fill: 'forwards' });
  }
  /* Menü wächst aus seinem Knopf */
  function menuBild(k, q, kr) {
    var ox = q.left + q.width / 2 - kr.left, oy = q.top + q.height / 2 - kr.top;
    return { transformOrigin: ox + 'px ' + oy + 'px', transform: 'scale(.6)', opacity: 0 };
  }
  function menuAuf(k, q, kr) {
    var m = menuBild(k, q, kr);
    return ani(k, [m, { opacity: 1, offset: 0.3 }, { transformOrigin: m.transformOrigin, transform: 'none', opacity: 1 }], { duration: MENU_DAUER, easing: WEICH });
  }
  function menuZu(k, q, kr) {
    var m = menuBild(k, q, kr);
    return ani(k, [{ transformOrigin: m.transformOrigin, transform: 'none', opacity: 1 }, { opacity: 1, offset: 0.55 }, m], { duration: MENU_DAUER * 0.8, easing: ZU, fill: 'forwards' });
  }

  function oeffnen(z, quelle) {
    var k = karteVon(z), kr = k.getBoundingClientRect();
    if (!kr.width || !kr.height) return;
    z.__uAufAt = Date.now();
    stopp(k); if (z !== k) stopp(z);
    if (quelle) {
      var q = { left: quelle.rect.left, top: quelle.rect.top, width: quelle.rect.width, height: quelle.rect.height, r: radius(quelle.el) };
      z.__uQuelle = quelle.el;
      if (z.matches(MENUS)) { menuAuf(k, q, kr); return; }
      seiteAuf(k, q, kr);
    } else {
      /* ohne Ausgangspunkt (z. B. per Tastatur geöffnet): steigt leicht auf und blendet ein */
      z.__uQuelle = null;
      ani(k, [{ opacity: 0, transform: 'translateY(14px) scale(.985)' }, { opacity: 1, offset: 0.4 }, { opacity: 1, transform: 'none' }], { duration: 900, easing: WEICH });
    }
    hintergrund(z, true, DAUER);
    if (z !== k) schleierAuf(z, DAUER);
  }
  /* Ausgangskarte wiederfinden, falls die Liste inzwischen neu gezeichnet wurde (gleiche Art, gleiche data-Werte) */
  function ersatz(el) {
    if (!el) return null;
    if (el.isConnected) return el;
    try {
      var d = el.dataset, sel = el.tagName.toLowerCase();
      var keys = Object.keys(d || {}); if (!keys.length) return null;
      keys.slice(0, 3).forEach(function (key) { sel += '[data-' + key.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }) + '="' + String(d[key]).replace(/"/g, '\\"') + '"]'; });
      return document.querySelector(sel);
    } catch (e) { return null; }
  }
  /* Vor dem Schließen messen, solange noch alles sichtbar ist */
  function vorSchliessen(z) {
    var k = karteVon(z), kr = k.getBoundingClientRect();
    if (!kr.width || !kr.height) return null;
    var qEl = ersatz(z.__uQuelle), qr = qEl ? qEl.getBoundingClientRect() : null;
    var q = sichtbar(qr) ? { left: qr.left, top: qr.top, width: qr.width, height: qr.height, r: radius(qEl) } : null;
    return { k: k, kr: kr, q: q, disp: getComputedStyle(z).display };
  }
  function zuAnimation(z, info) {
    stopp(info.k); if (z !== info.k) stopp(z);
    var a, d = info.q ? ZU_DAUER : 650;
    if (info.q && z.matches(MENUS)) a = menuZu(info.k, info.q, info.kr);
    else if (info.q) a = seiteZu(info.k, info.q, info.kr);
    else a = ani(info.k, [{ opacity: 1, transform: 'none' }, { opacity: 1, offset: 0.3 }, { opacity: 0, transform: 'translateY(10px) scale(.985)' }], { duration: d, easing: ZU, fill: 'forwards' });
    if (z !== info.k) schleierZu(z, d);
    hintergrund(z, false, d);
    return a;
  }

  /* ---------- Reiterwechsel ---------- */
  /* Ein Reiter/eine Ansicht: breit und entweder hoch oder als Ansicht erkennbar (auch wenn sie gerade fast leer ist) */
  function istAnsicht(el) {
    var id = el.id || '', kl = typeof el.className === 'string' ? el.className : '';
    return /^(SECTION|MAIN|ARTICLE)$/.test(el.tagName) || el.getAttribute('role') === 'tabpanel' ||
      /^(v-|view|tab|page|seite|screen)/i.test(id) || /(^|\s)(view|page|tab-?pane|tab-?panel|screen|seite|ansicht)(\s|$)/i.test(kl);
  }
  function grosserBereich(el, r) { return !!r && r.width >= innerWidth * 0.55 && (r.height >= innerHeight * 0.3 || istAnsicht(el)); }
  /* Der alte Reiter bleibt kurz an seiner Stelle sichtbar, gleitet nach rechts und blendet aus (ohne die App zu stören:
     für sie ist er schon versteckt, er nimmt keine Tipps an und keinen Platz ein) */
  function altAus(weg, neu) {
    var el = weg.el;
    if (!el.isConnected || !HD.get.call(el)) return;
    var nr = neu.getBoundingClientRect();
    var docTop = nr.top + window.scrollY;
    var T = docTop - (scrollBeiTipp == null ? window.scrollY : scrollBeiTipp);
    var oben = Math.max(0, T), hoehe = innerHeight - oben;
    if (hoehe < 40 || nr.width < 40) return;
    var alt = el.getAttribute('style');
    el.setAttribute('data-u-weg', '');
    el.style.cssText = (alt ? alt + ';' : '') + 'position:fixed;left:' + nr.left + 'px;top:' + oben + 'px;width:' + nr.width + 'px;height:' + hoehe +
      'px;max-height:none;overflow:hidden;margin:0;pointer-events:none;z-index:0;box-sizing:border-box';
    el.style.setProperty('display', weg.disp || 'block', 'important');
    if (T < 0) el.scrollTop = -T;
    var anis = [], fertig = function () {
      if (el.__uWegAus !== fertig) return; el.__uWegAus = null;
      anis.forEach(function (a) { if (a) a.cancel(); });
      el.removeAttribute('data-u-weg');
      if (alt === null) el.removeAttribute('style'); else el.setAttribute('style', alt);
      el.scrollTop = 0;
    };
    el.__uWegAus = fertig;
    anis.push(ani(el, [{ translate: '0px 0px' }, { translate: '28px 0px' }], { duration: REITER_WEG, easing: WEICH, fill: 'forwards' }));
    blendZiele(el).forEach(function (z) { anis.push(ani(z, [{ opacity: 1 }, { opacity: 0 }], { duration: REITER_WEG, easing: 'cubic-bezier(.2,.55,.4,1)', fill: 'forwards' })); });
    var letzte = anis[0]; if (letzte) letzte.onfinish = fertig;
    setTimeout(fertig, REITER_WEG + 250);
  }
  function reiterWechsel(el, weg) {
    el.__uEinAt = Date.now();
    sanftEin(el, '-28px 0px', REITER, 0, REITER * 0.65, 90);
    altAus(weg, el);
  }

  /* ---------- 4) Alle anderen Interaktionen ---------- */
  var KANDIDAT = 'li, tr, article, section, .card, .tile, .item, .row, .chip, .pill, .tcard, .pc, .mrow, .entry, .stat, button, [data-u-key], [data-n]';
  var zuletzt = 0, vorher = null, geplant = false, neu = [], klasseNeu = [];
  var VERSTECKT = /(^|\s)(hide|hidden|is-hidden|d-none|collapsed|closed|off|inactive)(\s|$)/;
  function frisch() { return Date.now() - zuletzt < 1500; }
  /* Anfang des Texts (ohne den ganzen Text großer Bereiche zu lesen) */
  function textAnfang(el) {
    var s = '', w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode()) && s.length < 90) s += n.nodeValue;
    return s.replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  function sig(el) { return el.tagName + '|' + (typeof el.className === 'string' ? el.className : '') + '|' + textAnfang(el); }
  function schnapp() {
    vorher = null;
    if (aus()) return;
    var pos = new Map(), sigs = new Map(), n = 0, H = innerHeight;
    var els = document.querySelectorAll(KANDIDAT);
    for (var i = 0; i < els.length && n < 450; i++) {
      var e = els[i], r = e.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < -40 || r.top > H + 40) continue;
      pos.set(e, r); var k = sig(e); if (!sigs.has(k)) sigs.set(k, []); sigs.get(k).push(r); n++;
    }
    vorher = { pos: pos, sigs: sigs };
  }
  /* Momentaufnahme erst beim echten Tippen (click), nicht schon beim Berühren: Scrollen bleibt so frei von Arbeit */
  function interaktion(e) {
    if (e.type === 'keydown') {
      if (e.key !== 'Enter' && e.key !== 'Escape' && e.key !== ' ') return;
      var t = e.target; if (e.key === ' ' && t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
    }
    zuletzt = Date.now(); schnapp();
  }
  document.addEventListener('click', interaktion, true);
  document.addEventListener('keydown', interaktion, true);
  function gleite(el, dx, dy) { ani(el, [{ translate: dx + 'px ' + dy + 'px' }, { translate: '0px 0px' }], { duration: 900, easing: 'cubic-bezier(.3,.7,.2,1)' }); }
  function ein(el, i) { sanftEin(el, '0px 8px', 850, Math.min(i * 60, 480), 700); }
  function ausgenommen(el) { return !!(el && el.closest && el.closest('[data-u-aus], [data-u-weg], [data-u-schleier]')); }
  function kuerzlich(el) {
    if (ausgenommen(el)) return true;
    var jetzt = Date.now();
    for (var p = el, i = 0; p && i < 40; p = p.parentElement, i++) {
      if ((p.__uEinAt && jetzt - p.__uEinAt < 1500) || (p.__uAufAt && jetzt - p.__uAufAt < 1500)) return true;
    }
    return false;
  }
  function nachher() {
    geplant = false;
    var v = vorher, liste = neu, klassen = klasseNeu; neu = []; klasseNeu = [];
    if (!v || aus()) return;
    /* Bereiche, die per Klasse sichtbar wurden (z. B. „hide“ entfernt), blenden ein */
    klassen.forEach(function (el) {
      if (!el.isConnected || kuerzlich(el)) return;
      var r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return;
      el.__uEinAt = Date.now(); ein(el, 0);
    });
    var H = innerHeight, bewegte = [], animiert = new Set();
    function vorfahr(el) { for (var p = el.parentElement, i = 0; p && i < 12; p = p.parentElement, i++) if (animiert.has(p)) return true; return false; }
    /* a) Gebliebene Elemente gleiten an ihre neue Stelle */
    v.pos.forEach(function (alt, el) {
      if (!el.isConnected || ausgenommen(el)) return;
      var r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      var dx = alt.left - r.left, dy = alt.top - r.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      if (Math.abs(dy) > H || Math.abs(dx) > innerWidth) return;
      bewegte.push([el, dx, dy]);
    });
    /* Fast alles um denselben Betrag verschoben: das war Scrollen oder ein Seitenwechsel, nicht animieren */
    if (bewegte.length > 5) {
      var zaehl = {}, max = 0;
      bewegte.forEach(function (b) { var k = Math.round(b[1] / 3) + ',' + Math.round(b[2] / 3); zaehl[k] = (zaehl[k] || 0) + 1; if (zaehl[k] > max) max = zaehl[k]; });
      if (max > bewegte.length * 0.7) bewegte = [];
    }
    bewegte.forEach(function (b) { if (kuerzlich(b[0]) || vorfahr(b[0])) return; animiert.add(b[0]); gleite(b[0], b[1], b[2]); });
    /* b) Neu Eingefügtes: gab es das vorher schon (neu gezeichnet), gleitet es von dort; sonst blendet es ein */
    var oben = liste.filter(function (el) { return el.isConnected && !/^(SCRIPT|STYLE|LINK|META|TEMPLATE)$/i.test(el.tagName); });
    oben = oben.filter(function (el) { return !oben.some(function (o) { return o !== el && o.contains(el); }); }).slice(0, 80);
    var nr = 0;
    oben.forEach(function (top) {
      if (kuerzlich(top) || vorfahr(top) || !top.getBoundingClientRect) return;
      var tr = top.getBoundingClientRect();
      if (!tr.width || !tr.height || tr.bottom < 0 || tr.top > H) return;
      var teile = [top].concat(Array.prototype.slice.call(top.querySelectorAll(KANDIDAT), 0, 120)), passend = false;
      teile.forEach(function (el) {
        if (!el.matches || !el.matches(KANDIDAT) || vorfahr(el)) return;
        var l2 = v.sigs.get(sig(el)); if (!l2 || !l2.length) return;
        var alt = l2.shift(), r = el.getBoundingClientRect();
        passend = true;
        var dx = alt.left - r.left, dy = alt.top - r.top;
        animiert.add(el);
        if ((Math.abs(dx) >= 2 || Math.abs(dy) >= 2) && Math.abs(dy) < H) gleite(el, dx, dy);
      });
      if (!passend && top instanceof HTMLElement) { animiert.add(top); ein(top, nr++); }
    });
  }
  try {
    new MutationObserver(function (recs) {
      if (!vorher || !frisch() || aus()) return;
      for (var i = 0; i < recs.length; i++) {
        var rc = recs[i];
        if (rc.type === 'attributes') {
          var alt = rc.oldValue || '', jetzt = typeof rc.target.className === 'string' ? rc.target.className : '';
          if (VERSTECKT.test(alt) && !VERSTECKT.test(jetzt)) klasseNeu.push(rc.target);
          continue;
        }
        var a = rc.addedNodes; for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1 && !a[j].hasAttribute('data-u-schleier')) neu.push(a[j]);
      }
      if (!geplant && (neu.length || klasseNeu.length)) { geplant = true; requestAnimationFrame(nachher); }
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  } catch (e) {}
  /* Knöpfe geben beim Drücken leicht nach (eigene Eigenschaft „scale“, stört vorhandene transform-Werte nicht) */
  try {
    var st = document.createElement('style');
    st.textContent = '@media (prefers-reduced-motion: no-preference){:where(button,a[href],[role="button"],summary,.chip,.tile,.tcard,.pc,.mrow):active{scale:.985}:where(button,a[href],[role="button"],summary,.chip,.tile,.tcard,.pc,.mrow){transition-property:scale,background-color,color,border-color,box-shadow,opacity;transition-duration:.45s;transition-timing-function:cubic-bezier(.22,1,.36,1)}}';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  /* ---------- 5) Festes Format: kein Zoomen, kein seitliches Verschieben, kein Gummiband ---------- */
  try {
    var festeAnsicht = function () {
      var vp = document.querySelector('meta[name="viewport"]');
      if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; vp.content = 'width=device-width,initial-scale=1,viewport-fit=cover'; (document.head || document.documentElement).appendChild(vp); }
      if (!/maximum-scale/.test(vp.content)) vp.setAttribute('content', vp.content + ', maximum-scale=1, user-scalable=no');
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', festeAnsicht); else festeAnsicht();
    var st2 = document.createElement('style');
    st2.textContent = 'html{touch-action:pan-x pan-y;overscroll-behavior:none;-webkit-text-size-adjust:100%;text-size-adjust:100%}html,body{overflow-x:clip;max-width:100%}@supports not (overflow-x:clip){html,body{overflow-x:hidden}}body{overscroll-behavior:none}';
    (document.head || document.documentElement).appendChild(st2);
    var zoomErlaubt = function (t) { return !!(t && t.closest && t.closest('canvas, [data-zoom-ok]')); };
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (typ) {
      document.addEventListener(typ, function (e) { if (!zoomErlaubt(e.target)) e.preventDefault(); }, { passive: false });
    });
    document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1 && !zoomErlaubt(e.target)) e.preventDefault(); }, { passive: false });
    /* Doppeltipp-Zoom ist durch touch-action: pan-x pan-y schon aus; schnelle Doppeltipps auf Knöpfe bleiben erhalten */
  } catch (e) {}

  /* 1) Fenster, Menüs und Reiter, die über hidden auf- und zugehen */
  var HD = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
  if (HD && HD.set) {
    Object.defineProperty(HTMLElement.prototype, 'hidden', {
      configurable: true, enumerable: HD.enumerable, get: HD.get,
      set: function (v) {
        var el = this;
        if (el.__uWegAus && !v) el.__uWegAus();
        if (aus() || !el.matches) return HD.set.call(el, v);
        if (!(el.matches(FENSTER) || el.matches(MENUS))) {
          var vorher0 = !!HD.get.call(el), eltern = el.parentElement;
          /* Ein großer Bereich verschwindet nach einem Tippen: merken, damit er beim Reiterwechsel noch ausblenden kann */
          if (!vorher0 && v && frisch() && eltern) {
            var r0 = el.getBoundingClientRect();
            eltern.__uWeg = { el: el, t: Date.now(), gross: grosserBereich(el, r0), disp: r0.width ? getComputedStyle(el).display : 'block' };
          }
          HD.set.call(el, v);
          if (vorher0 && !v && frisch() && !ausgenommen(el)) {
            el.__uEinAt = Date.now();
            /* Kurz warten, bis die App den alten Bereich auch ausgeblendet hat (Reihenfolge ist je nach App verschieden) */
            Promise.resolve().then(function () {
              var weg = eltern && eltern.__uWeg;
              if (weg && weg.el !== el && Date.now() - weg.t < 400 && HD.get.call(weg.el)) {
                eltern.__uWeg = null;
                if (weg.gross) reiterWechsel(el, weg); else ein(el, 0);
              } else ein(el, 0);
            });
          }
          return;
        }
        var war = !!HD.get.call(el), wird = !!v;
        if (el.__uZu) { el.__uZu(); }
        if (!war && wird) {
          var info = vorSchliessen(el);
          HD.set.call(el, v);
          if (!info) { schleierWeg(el); return; }
          /* Bild noch kurz zeigen, obwohl das Fenster für die App schon zu ist */
          el.style.setProperty('display', info.disp, 'important'); el.style.pointerEvents = 'none';
          var a = zuAnimation(el, info), fertig = function () {
            if (el.__uZu !== fertig) return; el.__uZu = null;
            stopp(info.k); if (el !== info.k) stopp(el);
            schleierWeg(el);
            el.style.removeProperty('display'); el.style.pointerEvents = '';
          };
          el.__uZu = fertig; if (a) a.onfinish = fertig; setTimeout(fertig, ZU_DAUER + 400); /* falls die Seite im Hintergrund ist */
          return;
        }
        HD.set.call(el, v);
        if (war && !wird) {
          var q = frischeQuelle();
          if (q && q.el !== el && !el.contains(q.el)) oeffnen(el, q);
          else if (frisch() && !el.matches(MENUS)) oeffnen(el, null);
        }
      }
    });
  }

  /* 2) <dialog>: showModal und close */
  if (window.HTMLDialogElement) {
    var P = HTMLDialogElement.prototype, SM = P.showModal, CL = P.close;
    P.showModal = function () {
      if (this.__uZu) this.__uZu();
      var r = SM.apply(this, arguments);
      if (!aus()) {
        var q = frischeQuelle();
        if (q && !this.contains(q.el)) oeffnen(this, q); else if (frisch()) oeffnen(this, null);
      }
      return r;
    };
    P.close = function () {
      var d = this, args = arguments;
      if (d.__uZu) { d.__uZu(); return; }
      if (aus() || !d.open) return CL.apply(d, args);
      var info = vorSchliessen(d);
      if (!info) return CL.apply(d, args);
      d.style.pointerEvents = 'none';
      var a = zuAnimation(d, info), fertig = function () {
        if (d.__uZu !== fertig) return; d.__uZu = null;
        d.style.pointerEvents = '';
        CL.apply(d, args);
        stopp(d);
        if (d.__uBg) { d.__uBg.cancel(); d.__uBg = null; }
      };
      d.__uZu = fertig; if (a) a.onfinish = fertig; setTimeout(fertig, ZU_DAUER + 400);
    };
  }

  /* 3) Für Seitenwechsel ohne Fenster (z. B. Thema öffnen): die neue Seite wächst aus der alten Karte,
        beim Zurück wächst die Karte aus der Seite zurück in ihre Stelle */
  window.Uebergang = {
    aus: aus,
    rechteck: function (el) { var r = el && el.getBoundingClientRect(); return sichtbar(r) ? { left: r.left, top: r.top, width: r.width, height: r.height, r: radius(el) } : null; },
    seite: function (ziel, vonRechteck) {
      if (aus() || !ziel || !vonRechteck) return;
      var kr = ziel.getBoundingClientRect(); if (!kr.width || !kr.height) return;
      ziel.__uEinAt = Date.now(); stopp(ziel); seiteAuf(ziel, vonRechteck, kr);
    },
    zurueck: function (karte, vonRechteck) {
      if (aus() || !karte || !vonRechteck) return;
      var kr = karte.getBoundingClientRect(); if (!sichtbar(kr)) return;
      karte.__uEinAt = Date.now(); stopp(karte);
      var a = bildA(karte, vonRechteck, kr), b = bildB(karte);
      a.opacity = 0.2;
      ani(karte, [a, b], { duration: DAUER, easing: WEICH });
    },
    /* Läuft gerade ein Auf- oder Zugehen in diesem Bereich? (z. B. damit große Fotos erst danach getauscht werden) */
    ruhig: function (el) {
      var box = el && el.closest ? el.closest('dialog, ' + FENSTER) : null;
      if (!box) return Promise.resolve();
      var laufend = box.getAnimations({ subtree: true }).filter(function (a) {
        var t = a.effect && a.effect.target, ende = a.effect ? a.effect.getComputedTiming().endTime : 0;
        return a.playState === 'running' && isFinite(ende) && t && t.tagName !== 'IMG' && !(a.effect.pseudoElement === '::after');
      });
      return Promise.all(laufend.map(function (a) { return a.finished.catch(function () {}); }));
    }
  };
})();
