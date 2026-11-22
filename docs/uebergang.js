/* Übergänge für jede Interaktion:
   1. Die Karte wird zur Seite. 2. Zurück geht zurück in die Karte. 3. Menüs starten an ihrem Knopf.
   4. Alles andere: Was sich nach einem Tippen verschiebt, gleitet an seine neue Stelle; neu gezeichnete Listen gleiten statt
      zu springen; wirklich Neues blendet weich ein; Bereiche, die erscheinen, blenden ein; Knöpfe geben beim Drücken leicht nach.
   An der Bedienung ändert sich nichts: alles passiert sofort, nur das Bild gleitet. Bei „Bewegung reduzieren“ ist alles aus. */
(function () {
  if (window.Uebergang || !Element.prototype.animate) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var EASE = 'cubic-bezier(.22,1,.36,1)', ZU = 'cubic-bezier(.45,0,.2,1)', DAUER = 1350, MENU_DAUER = 900, GLAS_DAUER = 1500;
  var FENSTER = '.modal, [data-uebergang]';
  var MENUS = '#skyMenu, [role="menu"], [data-uebergang="menu"]';
  var QUELLE = 'button, a, [role="button"], [role="option"], [data-u-key], li, [tabindex]';
  var tipp = null;

  function aus() { return !!(mq && mq.matches) || document.hidden; }
  function merke(e) {
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
    var k = z.querySelector(':scope > .modal-card') || z.firstElementChild;
    return k || z;
  }
  function stopp(el) { if (el && el.getAnimations) el.getAnimations({ subtree: false }).forEach(function (a) { a.cancel(); }); }
  /* Abgedunkelter Hintergrund eines Fensters (.modal): Farbe und Milchglas ziehen sich langsam auf */
  function hintergrundAuf(z, auf, dauer) {
    try {
      var cs = getComputedStyle(z), farbe = cs.backgroundColor, b = glas(z);
      var leer = { backgroundColor: 'rgba(0, 0, 0, 0)' }, voll = { backgroundColor: farbe };
      if (b) { leer.backdropFilter = leer.webkitBackdropFilter = 'blur(0px)'; voll.backdropFilter = voll.webkitBackdropFilter = b; }
      z.animate(auf ? [leer, voll] : [voll, leer], { duration: auf ? GLAS_DAUER : (dauer || 600), easing: auf ? 'cubic-bezier(.33,1,.68,1)' : ZU, fill: auf ? 'none' : 'forwards' });
      /* Glasflächen im Fenster (außer der Karte, die sich schon bewegt) blenden ebenfalls weich */
      if (auf) glasIn(z, 400).forEach(function (g) { if (g !== karteVon(z)) glasEin(g, 0); });
    } catch (e) {}
  }
  /* Abgedunkelter Hintergrund eines <dialog> blendet mit */
  function hintergrund(z, auf, dauer) {
    if (z.tagName !== 'DIALOG') return;
    if (z.__uBg) { z.__uBg.cancel(); z.__uBg = null; }
    try { z.__uBg = z.animate(auf ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], { duration: dauer, easing: 'ease-out', fill: auf ? 'none' : 'forwards', pseudoElement: '::backdrop' }); } catch (e) {}
  }

  /* Karte ↔ Seite: k liegt an seiner echten Stelle kr, q ist die Stelle der Karte, aus der es kommt */
  function bildA(k, q, kr) {
    var s = q.width / kr.width, tx = q.left - kr.left, ty = q.top - kr.top;
    var sichtH = q.height / s, unten = Math.max(0, kr.height - sichtH);
    return { transformOrigin: '0 0', transform: 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')', clipPath: 'inset(0px 0px ' + unten + 'px 0px round ' + (q.r / s) + 'px)', opacity: 0 };
  }
  function bildB(k) { return { transformOrigin: '0 0', transform: 'none', clipPath: 'inset(0px 0px 0px 0px round ' + radius(k) + 'px)', opacity: 1 }; }
  function seiteAuf(k, q, kr) {
    var a = bildA(k, q, kr), b = bildB(k);
    return k.animate([a, { opacity: 1, offset: 0.45 }, b], { duration: DAUER, easing: EASE });
  }
  function seiteZu(k, q, kr) {
    var a = bildA(k, q, kr), b = bildB(k);
    return k.animate([b, { opacity: 1, offset: 0.55 }, a], { duration: 1000, easing: ZU, fill: 'forwards' });
  }
  /* Menü wächst aus seinem Knopf */
  function menuBild(k, q, kr) {
    var ox = q.left + q.width / 2 - kr.left, oy = q.top + q.height / 2 - kr.top;
    return { transformOrigin: ox + 'px ' + oy + 'px', transform: 'scale(.6)', opacity: 0 };
  }
  function menuAuf(k, q, kr) { return k.animate([menuBild(k, q, kr), { transformOrigin: menuBild(k, q, kr).transformOrigin, transform: 'none', opacity: 1 }], { duration: MENU_DAUER, easing: EASE }); }
  function menuZu(k, q, kr) { var m = menuBild(k, q, kr); return k.animate([{ transformOrigin: m.transformOrigin, transform: 'none', opacity: 1 }, m], { duration: MENU_DAUER * 0.85, easing: ZU, fill: 'forwards' }); }

  function oeffnen(z, quelle) {
    var k = karteVon(z), kr = k.getBoundingClientRect();
    if (!kr.width || !kr.height) return;
    var q = { left: quelle.rect.left, top: quelle.rect.top, width: quelle.rect.width, height: quelle.rect.height, r: radius(quelle.el) };
    z.__uQuelle = quelle.el; z.__uAufAt = Date.now();
    stopp(k); if (z !== k) stopp(z);
    if (z.matches(MENUS)) { menuAuf(k, q, kr); return; }
    seiteAuf(k, q, kr);
    hintergrund(z, true, GLAS_DAUER);
    if (z !== k) hintergrundAuf(z, true);
  }
  /* Vor dem Schließen messen, solange noch alles sichtbar ist */
  function vorSchliessen(z) {
    var k = karteVon(z), kr = k.getBoundingClientRect();
    if (!kr.width || !kr.height) return null;
    var qEl = z.__uQuelle, qr = qEl && qEl.isConnected ? qEl.getBoundingClientRect() : null;
    var q = sichtbar(qr) ? { left: qr.left, top: qr.top, width: qr.width, height: qr.height, r: radius(qEl) } : null;
    return { k: k, kr: kr, q: q, disp: getComputedStyle(z).display };
  }
  function zuAnimation(z, info) {
    stopp(info.k); if (z !== info.k) stopp(z);
    var a;
    if (info.q && z.matches(MENUS)) a = menuZu(info.k, info.q, info.kr);
    else if (info.q) a = seiteZu(info.k, info.q, info.kr);
    else a = info.k.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { duration: 600, easing: ZU, fill: 'forwards' });
    if (z !== info.k) hintergrundAuf(z, false, info.q ? 1000 : 600);
    hintergrund(z, false, info.q ? 1000 : 600);
    return a;
  }

  /* ---------- 4) Alle anderen Interaktionen ---------- */
  var KANDIDAT = 'li, tr, article, section, .card, .tile, .item, .row, .chip, .pill, .tcard, .pc, .mrow, .entry, .stat, button, [data-u-key], [data-n]';
  var zuletzt = 0, vorher = null, geplant = false, neu = [], klasseNeu = [];
  var VERSTECKT = /(^|\s)(hide|hidden|is-hidden|d-none|collapsed|closed|off|inactive)(\s|$)/;
  function frisch() { return Date.now() - zuletzt < 1500; }
  function sig(el) { return el.tagName + '|' + (typeof el.className === 'string' ? el.className : '') + '|' + (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80); }
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
  function interaktion(e) {
    if (e.type === 'keydown') {
      if (e.key !== 'Enter' && e.key !== 'Escape' && e.key !== ' ') return;
      var t = e.target; if (e.key === ' ' && t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
    }
    zuletzt = Date.now(); schnapp();
  }
  document.addEventListener('pointerdown', interaktion, true);
  document.addEventListener('keydown', interaktion, true);
  function gleite(el, dx, dy) { try { el.animate([{ translate: dx + 'px ' + dy + 'px' }, { translate: '0px 0px' }], { duration: 1000, easing: EASE }); } catch (e) {} }
  function ein(el, i) { sanftEin(el, '0px 8px', 900, Math.min(i * 70, 560)); }
  function ausgenommen(el) { return !!(el && el.closest && el.closest('[data-u-aus]')); }
  /* ---------- Milchglas sanft: Glasflächen selbst einblenden, nie ihren Elternbereich ---------- */
  function glas(el) {
    try { var cs = getComputedStyle(el), b = cs.backdropFilter || cs.webkitBackdropFilter || 'none'; return b && b !== 'none' ? b : null; } catch (e) { return null; }
  }
  function glasIn(root, max) {
    var set = [], alle = root.querySelectorAll('*');
    for (var i = 0; i < alle.length && i < (max || 2500); i++) if (glas(alle[i])) set.push(alle[i]);
    return set;
  }
  function glasEin(el, verzoegerung) {
    var b = glas(el), k0 = { opacity: 0 }, k1 = { opacity: 1 };
    if (b) { k0.backdropFilter = 'blur(0px)'; k1.backdropFilter = b; k0.webkitBackdropFilter = 'blur(0px)'; k1.webkitBackdropFilter = b; }
    try { el.animate([k0, k1], { duration: GLAS_DAUER, delay: verzoegerung || 0, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'backwards' }); } catch (e) {}
  }
  /* Bereich einblenden: enthält er Glas, bekommt nur der Bereich die Bewegung und jede Fläche darin ihr eigenes Einblenden */
  function sanftEin(root, start, dauer, verzoegerung) {
    var gl = glasIn(root);
    if (!gl.length && !glas(root)) {
      try { root.animate([{ opacity: 0, translate: start }, { opacity: 1, translate: '0px 0px' }], { duration: dauer, delay: verzoegerung || 0, easing: EASE, fill: 'backwards' }); } catch (e) {}
      return;
    }
    try { root.animate([{ translate: start }, { translate: '0px 0px' }], { duration: dauer, delay: verzoegerung || 0, easing: EASE, fill: 'backwards' }); } catch (e) {}
    if (glas(root) && !gl.length) { glasEin(root, verzoegerung); return; }
    var ziele = [];
    (function geh(el) {
      for (var c = el.firstElementChild; c && ziele.length < 250; c = c.nextElementSibling) {
        if (gl.indexOf(c) >= 0) { ziele.push(c); continue; }
        var drin = false; for (var j = 0; j < gl.length; j++) if (c.contains(gl[j])) { drin = true; break; }
        if (drin) geh(c); else ziele.push(c);
      }
    })(root);
    ziele.forEach(function (z) { glasEin(z, verzoegerung); });
  }
  function wechsel(el, richtung) {
    sanftEin(el, (richtung * 36) + 'px 0px', 1000, 0);
  }
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
      if (!el.isConnected) return;
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
        var a = rc.addedNodes; for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) neu.push(a[j]);
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

  /* 1) Fenster und Menüs, die über hidden auf- und zugehen */
  var HD = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
  if (HD && HD.set) {
    Object.defineProperty(HTMLElement.prototype, 'hidden', {
      configurable: true, enumerable: HD.enumerable, get: HD.get,
      set: function (v) {
        var el = this;
        if (aus() || !el.matches) return HD.set.call(el, v);
        if (!(el.matches(FENSTER) || el.matches(MENUS))) {
          var vorher0 = !!HD.get.call(el), eltern = el.parentElement;
          /* Bereich verschwindet nach einem Tippen: merken, damit der nächste Bereich weiß, woher er kommt */
          if (!vorher0 && v && frisch() && eltern) eltern.__uWeg = { el: el, t: Date.now(), i: Array.prototype.indexOf.call(eltern.children, el) };
          HD.set.call(el, v);
          if (vorher0 && !v && frisch() && !ausgenommen(el)) {
            el.__uEinAt = Date.now();
            /* Kurz warten, bis die App den alten Bereich auch ausgeblendet hat (Reihenfolge ist je nach App verschieden) */
            Promise.resolve().then(function () {
              var weg = eltern && eltern.__uWeg;
              if (weg && weg.el !== el && Date.now() - weg.t < 400) {
                /* Reiter-Wechsel: von rechts, wenn der neue Reiter weiter rechts liegt, sonst von links */
                var richtung = Array.prototype.indexOf.call(eltern.children, el) > weg.i ? 1 : -1;
                wechsel(el, richtung);
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
          if (!info) return;
          /* Bild noch kurz zeigen, obwohl das Fenster für die App schon zu ist */
          el.style.setProperty('display', info.disp, 'important'); el.style.pointerEvents = 'none';
          var a = zuAnimation(el, info), fertig = function () {
            if (el.__uZu !== fertig) return; el.__uZu = null;
            stopp(info.k); if (el !== info.k) stopp(el);
            el.style.removeProperty('display'); el.style.pointerEvents = '';
          };
          el.__uZu = fertig; a.onfinish = fertig; setTimeout(fertig, DAUER + 300); /* falls die Seite im Hintergrund ist */
          return;
        }
        HD.set.call(el, v);
        if (war && !wird) { var q = frischeQuelle(); if (q && q.el !== el && !el.contains(q.el)) oeffnen(el, q); }
      }
    });
  }

  /* 2) <dialog>: showModal und close */
  if (window.HTMLDialogElement) {
    var P = HTMLDialogElement.prototype, SM = P.showModal, CL = P.close;
    P.showModal = function () {
      if (this.__uZu) this.__uZu();
      var r = SM.apply(this, arguments);
      if (!aus()) { var q = frischeQuelle(); if (q && !this.contains(q.el)) oeffnen(this, q); }
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
      d.__uZu = fertig; a.onfinish = fertig; setTimeout(fertig, DAUER + 300);
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
      karte.animate([a, b], { duration: DAUER, easing: EASE });
    }
  };
})();
