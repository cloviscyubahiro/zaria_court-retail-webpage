/* Live opening status, filters, menu, events and Ticqet links for the Zaria Court Directory.
   Content lives in index.html (shops), data/events.js or the Google Sheet (events) and js/config.js (settings). */
(function(){
  var CFG = window.ZC_CONFIG || {};
  var OFFSET_MIN = 120; /* Kigali is UTC+2 all year, no daylight saving */
  var DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var SOON = 45; /* minutes before closing that count as "closing soon" */
  var CAT_NAMES = {all:"All shops", eat:"Eat", coffee:"Coffee & wine", shop:"Shop", care:"Grooming & wellness"};
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var shops = Array.prototype.slice.call(document.querySelectorAll(".shop"));
  var sections = Array.prototype.slice.call(document.querySelectorAll(".cat"));
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll("[data-filter]"));
  var openOnlyBox = document.getElementById("open-only");
  var state = {cat:"all", openOnly:false};
  var openCount = 0;

  /* ---------- Shop hours ---------- */
  function now(){
    var d = new Date(Date.now() + OFFSET_MIN*60000);
    return {day:d.getUTCDay(), mins:d.getUTCHours()*60 + d.getUTCMinutes()};
  }
  function toMin(v){ var p = String(v).split(":"); return (+p[0]) * 60 + (+(p[1] || 0)); }
  function fmt(m){
    var h = Math.floor(m/60) % 24, mm = m%60, ap = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return (mm ? h + ":" + (mm < 10 ? "0" : "") + mm : String(h)) + " " + ap;
  }
  function statusOf(el, t){
    var open = toMin(el.dataset.open), close = toMin(el.dataset.close), days = el.dataset.days;
    var today = days.indexOf(String(t.day)) > -1;
    if (today && t.mins >= open && t.mins < close){
      var left = close - t.mins;
      return left <= SOON ? {state:"soon", label:"Closing soon", note:"closes " + fmt(close), on:true}
                          : {state:"open", label:"Open now", note:"until " + fmt(close), on:true};
    }
    if (today && t.mins < open) return {state:"closed", label:"Closed", note:"opens at " + fmt(open), on:false, wait:open - t.mins};
    for (var i = 1; i <= 7; i++){
      var d = (t.day + i) % 7;
      if (days.indexOf(String(d)) > -1){
        var when = i === 1 ? "tomorrow" : DAYS[d];
        return {state:"closed", label:today ? "Closed" : "Closed today", note:"opens " + when + " at " + fmt(open), on:false, wait:(1440 - t.mins) + (i-1)*1440 + open};
      }
    }
    return {state:"closed", label:"Closed", note:"", on:false, wait:1e9};
  }

  function render(){
    var t = now(); openCount = 0;
    shops.forEach(function(el){
      var s = statusOf(el, t), box = el.querySelector(".status");
      el._s = s;
      box.hidden = false;
      box.dataset.state = s.state;
      box.querySelector("b").textContent = s.label;
      box.querySelector("span").textContent = s.note;
      el.dataset.on = s.on ? "1" : "0";
      if (s.on) openCount++;
    });
    var when = DAYS[t.day] + ", " + fmt(t.mins) + " in Kigali";
    document.getElementById("strip-label").textContent = openCount === 0 ? "All shops closed right now" : openCount === 1 ? "Shop open right now" : "Shops open right now";
    document.getElementById("strip-time").textContent = when;
    var cnt = document.getElementById("strip-count");
    cnt.innerHTML = openCount + "<small>/" + shops.length + "</small>";
    cnt.setAttribute("aria-label", openCount + " of " + shops.length + " shops open");
    var liveBtn = document.getElementById("live-btn"), menuLive = document.getElementById("menu-live");
    liveBtn.dataset.state = menuLive.parentNode.dataset.state = openCount ? "open" : "closed";
    document.getElementById("live-text").textContent = openCount ? openCount + " open" : "Closed now";
    liveBtn.setAttribute("aria-label", openCount ? openCount + " of " + shops.length + " shops open now. Show them" : "All shops are closed right now. See when they open");
    menuLive.textContent = (openCount ? openCount + " of " + shops.length + " shops open" : "All shops closed") + " · " + when;
    applyFilter();
    renderEvents();
  }

  /* ---------- Filters ---------- */
  function applyFilter(){
    var visibleTotal = 0, firstOpen = null;
    sections.forEach(function(sec){
      var catOk = state.cat === "all" || sec.dataset.cat === state.cat, any = 0;
      Array.prototype.forEach.call(sec.querySelectorAll(".shop"), function(el){
        var ok = catOk && (!state.openOnly || el.dataset.on === "1");
        el.hidden = !ok;
        if (ok) any++;
        if (catOk && el._s && !el._s.on && (!firstOpen || el._s.wait < firstOpen.wait)) firstOpen = {wait:el._s.wait, name:el.dataset.name, note:el._s.note};
      });
      sec.hidden = any === 0;
      visibleTotal += any;
    });
    var desc = (state.cat === "all" ? "All shops" : CAT_NAMES[state.cat]) + (state.openOnly ? " · open now" : "");
    document.getElementById("filter-desc").textContent = desc + " (" + visibleTotal + ")";
    document.getElementById("filter-clear").hidden = state.cat === "all" && !state.openOnly;
    var empty = document.getElementById("empty");
    if (visibleTotal === 0){
      var title = document.createElement("b"), body = document.createElement("span");
      title.textContent = state.openOnly ? "Nothing open here right now" : "Nothing to show";
      body.textContent = state.openOnly && firstOpen ? firstOpen.name + " " + firstOpen.note + "." : "Try another category.";
      empty.replaceChildren(title, body);
      empty.hidden = false;
    } else {
      empty.hidden = true;
    }
  }
  function syncControls(){
    filterButtons.forEach(function(b){ b.setAttribute("aria-pressed", b.dataset.filter === state.cat ? "true" : "false"); });
    openOnlyBox.checked = state.openOnly;
  }
  function clearFilters(){ state = {cat:"all", openOnly:false}; syncControls(); render(); }
  function scrollToId(id, moveFocus){
    var el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({behavior: reduceMotion ? "auto" : "smooth", block: "start"});
    if (moveFocus){
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({preventScroll:true});
    }
  }

  /* ---------- Menu drawer ---------- */
  var drawer = document.getElementById("site-menu");
  var panel = drawer.querySelector(".drawer__panel");
  var menuBtn = document.getElementById("menu-btn");
  var lastFocus = null, closeTimer = null;
  function focusables(){
    return Array.prototype.filter.call(panel.querySelectorAll("a[href],button,input,[tabindex]"), function(el){ return !el.disabled && el.offsetParent !== null; });
  }
  var pageParts = Array.prototype.slice.call(document.querySelectorAll("[data-page]"));
  function setInert(on){ pageParts.forEach(function(p){ if (on) p.setAttribute("inert", ""); else p.removeAttribute("inert"); }); }
  function openMenu(e){
    clearTimeout(closeTimer);
    lastFocus = e && e.currentTarget ? e.currentTarget : document.activeElement;
    drawer.hidden = false;
    void drawer.offsetWidth;
    drawer.classList.add("is-open");
    document.body.classList.add("menu-open");
    menuBtn.setAttribute("aria-expanded", "true");
    setInert(true);
    var current = panel.querySelector('[data-filter][aria-pressed="true"]') || panel.querySelector(".drawer__close");
    setTimeout(function(){ current.focus({preventScroll:true}); }, reduceMotion ? 0 : 60);
  }
  function closeMenu(then){
    if (drawer.hidden) { if (then) then(); return; }
    drawer.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    menuBtn.setAttribute("aria-expanded", "false");
    setInert(false);
    closeTimer = setTimeout(function(){
      drawer.hidden = true;
      if (then) then(); else if (lastFocus && lastFocus.focus) lastFocus.focus({preventScroll:true});
    }, reduceMotion ? 0 : 320);
  }
  menuBtn.addEventListener("click", openMenu);
  document.getElementById("filter-open").addEventListener("click", openMenu);
  drawer.addEventListener("click", function(e){ if (e.target.closest("[data-close]")) closeMenu(); });
  drawer.addEventListener("keydown", function(e){
    if (e.key === "Escape") { e.preventDefault(); closeMenu(); return; }
    if (e.key !== "Tab") return;
    var f = focusables(); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  filterButtons.forEach(function(b){
    b.addEventListener("click", function(){
      state.cat = b.dataset.filter; syncControls(); render();
      closeMenu(function(){ scrollToId("directory", true); });
    });
  });
  openOnlyBox.addEventListener("change", function(){ state.openOnly = openOnlyBox.checked; syncControls(); render(); });
  Array.prototype.forEach.call(drawer.querySelectorAll("[data-nav]"), function(a){
    a.addEventListener("click", function(e){ e.preventDefault(); var id = a.getAttribute("href").slice(1); closeMenu(function(){ scrollToId(id, true); }); });
  });
  document.getElementById("filter-clear").addEventListener("click", clearFilters);
  document.getElementById("live-btn").addEventListener("click", function(){ state.openOnly = true; syncControls(); render(); scrollToId("directory", true); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-scroll]"), function(a){
    a.addEventListener("click", function(e){ e.preventDefault(); scrollToId(a.getAttribute("href").slice(1), a.getAttribute("href") !== "#top"); });
  });

  /* ---------- Ticqet links from js/config.js ---------- */
  var tq = CFG.ticqet || {};
  Array.prototype.forEach.call(document.querySelectorAll("[data-ticqet]"), function(a){ if (/^https?:\/\//.test(tq[a.dataset.ticqet] || "")) a.href = tq[a.dataset.ticqet]; });
  var generic = function(u){ return !u || /ticqet\.rw\/?(#\/?)?$/.test(u); };
  document.getElementById("play-note").hidden = !(generic(tq.pitchB) || generic(tq.court));

  /* ---------- What's on ---------- */
  var events = [], showAllEvents = false, EVENTS_SHOWN = 6, lastSig = null;
  var MON3 = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
  function clean(v){ return v == null ? "" : String(v).trim(); }
  /* Only web links and picture files in the site's own folders are used; Google Drive share links become image links */
  function safeUrl(u){
    u = clean(u);
    if (!u) return "";
    var m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/);
    if (m) return "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w1200";
    if (/^https?:\/\/[^\s"'<>]+$/i.test(u)) return u;
    if (/^[\w-][\w\-./]*\.(webp|jpe?g|png|gif|avif)$/i.test(u) && u.indexOf("..") < 0) return u;
    return "";
  }
  /* Dates: 2026-11-14 always works. 14/11/2026 and 11/14/2026 are worked out from the numbers;
     when both readings are possible (05/11/2026) the rest of the sheet decides, then js/config.js */
  var SLASH_DATE = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/;
  function parseDate(s, order){
    s = clean(s); if (!s) return null;
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/), dt = null;
    if (m) dt = {y:+m[1], m:+m[2], d:+m[3]};
    else if ((m = s.match(SLASH_DATE))){
      var a = +m[1], b = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      var monthFirst = a > 12 ? false : b > 12 ? true : order === "MDY";
      dt = monthFirst ? {y:y, m:a, d:b} : {y:y, m:b, d:a};
    }
    else if ((m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})/i))) dt = {y:+m[3], m:MON3.indexOf(m[2].toLowerCase()) + 1, d:+m[1]};
    else if ((m = s.match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i))) dt = {y:+m[3], m:MON3.indexOf(m[1].toLowerCase()) + 1, d:+m[2]};
    if (!dt || dt.m < 1 || dt.m > 12 || dt.d < 1 || dt.d > 31) return null;
    return dt;
  }
  function detectOrder(values){
    var dmy = 0, mdy = 0;
    values.forEach(function(v){
      var m = clean(v).match(SLASH_DATE);
      if (!m) return;
      if (+m[1] > 12) dmy++;
      if (+m[2] > 12) mdy++;
    });
    if (mdy !== dmy) return mdy > dmy ? "MDY" : "DMY";
    return /^m/i.test(clean(CFG.eventsDateOrder)) ? "MDY" : "DMY";
  }
  /* Times: 18:00, 18h00, 6:30 pm, 6pm, 6:00:00 PM */
  function parseTime(s){
    s = clean(s).toLowerCase(); if (!s) return null;
    var m = s.match(/(\d{1,2})[:h.](\d{2})(?::\d{2})?(?:\s*([ap])\.?\s*m\b)?/) || s.match(/(\d{1,2})()\s*([ap])\.?\s*m\b/) || s.match(/^(\d{1,2})()$/);
    if (!m) return null;
    var h = +m[1], mm = +(m[2] || 0), ap = m[3] || "";
    if (ap === "p" && h < 12) h += 12;
    if (ap === "a" && h === 12) h = 0;
    if (h === 24 && mm === 0) return 1440;
    return h < 24 && mm < 60 ? h*60 + mm : null;
  }
  function kigaliEpoch(dt, mins){ return Date.UTC(dt.y, dt.m - 1, dt.d) + (mins - OFFSET_MIN) * 60000; }
  function sameDay(a, b){ return a.y === b.y && a.m === b.m && a.d === b.d; }
  function normalize(raw, order){
    var title = clean(raw.title);
    var dt = parseDate(raw.date, order);
    if (!title || !dt || /^example\b/i.test(title)) return null;
    if (/^(no|n|false|hide|hidden|draft|0)$/i.test(clean(raw.publish))) return null;
    var start = parseTime(raw.start), end = parseTime(raw.end);
    var endDt = parseDate(raw.endDate, order) || dt;
    if (kigaliEpoch(endDt, 0) < kigaliEpoch(dt, 0)) endDt = dt;
    var startAt = kigaliEpoch(dt, start == null ? 0 : start), endAt;
    if (end != null){
      endAt = kigaliEpoch(endDt, end);
      if (endAt <= startAt) endAt += 864e5; /* runs past midnight */
    } else {
      endAt = kigaliEpoch(endDt, 1440); /* no end time: keep it listed until the end of the day */
    }
    var liveUntil = end != null ? endAt : (start != null && sameDay(dt, endDt) ? startAt + 3*36e5 : endAt);
    return {title:title, dt:dt, endDt:endDt, start:start, end:end, startAt:startAt, endAt:endAt, liveUntil:liveUntil,
            venue:clean(raw.venue), category:clean(raw.category), description:clean(raw.description),
            details:clean(raw.details), price:clean(raw.price), link:safeUrl(raw.link),
            linkLabel:clean(raw.linkLabel) || "More info", image:safeUrl(raw.image)};
  }
  function dayDiff(dt){
    var t = new Date(Date.now() + OFFSET_MIN*60000);
    var today = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
    return Math.round((Date.UTC(dt.y, dt.m - 1, dt.d) - today) / 864e5);
  }
  function weekday(dt){ return new Date(Date.UTC(dt.y, dt.m - 1, dt.d)).getUTCDay(); }
  function tagOf(ev, nowMs){
    var diff = dayDiff(ev.dt);
    if (ev.start != null && ev.startAt <= nowMs && nowMs < ev.liveUntil) return "Happening now";
    if (diff === 0) return "Today";
    if (diff < 0) return "On now";
    if (diff === 1) return "Tomorrow";
    return "";
  }
  function whenText(ev){
    var t = DAYS[weekday(ev.dt)] + " " + ev.dt.d + " " + MONTHS[ev.dt.m - 1];
    if (!sameDay(ev.dt, ev.endDt)) t += " to " + DAYS[weekday(ev.endDt)] + " " + ev.endDt.d + " " + MONTHS[ev.endDt.m - 1];
    if (ev.start != null) t += " · " + fmt(ev.start) + (ev.end != null ? " to " + fmt(ev.end) : "");
    if (ev.venue) t += " · " + ev.venue;
    return t;
  }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var ARROW_SVG = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4 10 10 4M5 4h5v5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  /* Event text comes from the events sheet, so it is only ever set as text, never as HTML */
  function eventCard(ev, tag){
    var li = el("li", "event"), wd = weekday(ev.dt);
    if (ev.image){
      var fig = el("figure", "event__img"), img = el("img");
      img.src = ev.image; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
      img.onerror = function(){ fig.remove(); li.classList.remove("event--img"); };
      fig.appendChild(img); li.appendChild(fig); li.classList.add("event--img");
    }
    var date = el("div", "event__date"); date.setAttribute("aria-hidden", "true");
    date.appendChild(el("span", "", MONTHS[ev.dt.m - 1].slice(0, 3)));
    date.appendChild(el("b", "", String(ev.dt.d)));
    date.appendChild(el("span", "", SHORT[wd]));
    li.appendChild(date);
    var body = el("div", "event__body"), meta = el("p", "event__meta label");
    if (tag) meta.appendChild(el("span", "soon", tag));
    if (ev.category) meta.appendChild(el("span", "", ev.category));
    if (ev.price) meta.appendChild(el("span", "", ev.price));
    if (meta.childNodes.length) body.appendChild(meta);
    body.appendChild(el("h3", "event__title", ev.title));
    body.appendChild(el("p", "event__when", whenText(ev)));
    if (ev.description) body.appendChild(el("p", "event__desc", ev.description));
    if (ev.details){
      var more = el("details", "event__more");
      more.appendChild(el("summary", "", "More details"));
      more.appendChild(el("p", "", ev.details));
      body.appendChild(more);
    }
    if (ev.link){
      var actions = el("div", "event__actions"), a = el("a", "btn-book");
      a.href = ev.link; a.target = "_blank"; a.rel = "noopener";
      a.textContent = ev.linkLabel + " ";
      a.insertAdjacentHTML("beforeend", ARROW_SVG);
      actions.appendChild(a); body.appendChild(actions);
    }
    li.appendChild(body);
    return li;
  }
  function renderEvents(){
    var list = document.getElementById("events-list"), empty = document.getElementById("events-empty");
    var more = document.getElementById("events-more"), nexts = document.querySelectorAll("[data-next]");
    var nowMs = Date.now();
    var upcoming = events.filter(function(ev){ return ev.endAt > nowMs; })
                         .sort(function(a, b){ return a.startAt - b.startAt || a.title.localeCompare(b.title); });
    var shown = showAllEvents ? upcoming : upcoming.slice(0, EVENTS_SHOWN);
    var tags = shown.map(function(ev){ return tagOf(ev, nowMs); });
    document.getElementById("menu-events").textContent = upcoming.length ? upcoming.length + " upcoming" : "Soon";
    list.hidden = upcoming.length === 0;
    empty.hidden = upcoming.length > 0;
    more.hidden = upcoming.length <= EVENTS_SHOWN;
    more.textContent = showAllEvents ? "Show fewer events" : "Show all " + upcoming.length + " events";
    more.setAttribute("aria-expanded", showAllEvents ? "true" : "false");
    var e0 = upcoming[0];
    Array.prototype.forEach.call(nexts, function(n){
      n.hidden = !e0;
      if (!e0) return;
      n.querySelector(".next__label").textContent = tags[0] || "Next up";
      n.querySelector(".next__title").textContent = e0.title;
      n.querySelector(".next__when").textContent = SHORT[weekday(e0.dt)] + " " + e0.dt.d + " " + MONTHS[e0.dt.m - 1].slice(0, 3) + (e0.start != null ? " · " + fmt(e0.start) : "") + (e0.venue ? " · " + e0.venue : "");
    });
    /* rebuild the cards only when something changed, so an open "More details" stays open */
    var sig = shown.map(function(ev, i){ return ev.id + ":" + tags[i]; }).join("|");
    if (sig === lastSig) return;
    lastSig = sig;
    list.replaceChildren.apply(list, shown.map(function(ev, i){ return eventCard(ev, tags[i]); }));
  }
  document.getElementById("events-more").addEventListener("click", function(){
    showAllEvents = !showAllEvents; renderEvents();
    if (!showAllEvents) scrollToId("whats-on");
  });

  /* CSV from a published Google Sheet. Column names are matched loosely, so a Google Form response sheet works too */
  function parseCSV(text){
    var rows = [], row = [], field = "", q = false;
    text = String(text).replace(/^﻿/, "");
    for (var i = 0; i < text.length; i++){
      var c = text[i];
      if (q){
        if (c === '"'){ if (text[i+1] === '"'){ field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ","){ row.push(field); field = ""; }
      else if (c === "\n" || c === "\r"){
        if (c === "\r" && text[i+1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field || row.length){ row.push(field); rows.push(row); }
    return rows.filter(function(r){ return r.some(function(v){ return v.trim(); }); });
  }
  var HEADER_KEYS = {
    title:/^(title|event|eventname|eventtitle|name|nameofevent)$/,
    date:/^(date|startdate|eventdate|day|dateofevent|startday)$/,
    endDate:/^(enddate|lastday|until|finishdate|lastdate)$/,
    start:/^(start|starttime|time|from|doorsopen|begins|eventtime)$/,
    end:/^(end|endtime|to|finish|finishtime|ends)$/,
    venue:/^(venue|location|where|place|area|space)$/,
    category:/^(category|type|kind|eventtype)$/,
    description:/^(description|summary|short|shortdescription|intro|teaser)$/,
    details:/^(details|moredetails|moreinfo|longdescription|fulldetails|fulldescription|info)$/,
    price:/^(price|entry|cost|ticketprice|entryfee|fee)$/,
    link:/^(link|url|tickets?|ticketlink|ticketslink|bookinglink|website|rsvp|registrationlink|registerlink)$/,
    linkLabel:/^(linklabel|buttontext|button|linktext|buttonlabel)$/,
    image:/^(image|imageurl|imagelink|poster|posterlink|photo|picture|flyer)$/,
    publish:/^(publish|show|visible|live|showonpage|status)$/
  };
  function rowsToEvents(rows){
    if (rows.length < 2) return [];
    var seen = {};
    var keys = rows[0].map(function(h){
      var k = h.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z]/g, ""), hit = null;
      for (var name in HEADER_KEYS) if (HEADER_KEYS[name].test(k)){ hit = name; break; }
      if (!hit || seen[hit]) return null;
      seen[hit] = 1; return hit;
    });
    return rows.slice(1).map(function(r){
      var o = {}; keys.forEach(function(k, i){ if (k) o[k] = r[i]; }); return o;
    });
  }
  function setEvents(raw){
    raw = Array.isArray(raw) ? raw : [];
    var dates = [];
    raw.forEach(function(r){ if (r){ dates.push(r.date, r.endDate); } });
    var order = detectOrder(dates);
    events = raw.map(function(r, i){ var ev = r && normalize(r, order); if (ev) ev.id = i; return ev; }).filter(Boolean);
    lastSig = null;
    renderEvents();
  }
  function loadEvents(){
    var url = clean(CFG.eventsSheetCsvUrl);
    setEvents(window.ZC_EVENTS);
    if (!/^https:\/\//.test(url)) return;
    fetch(url, {cache:"no-store"})
      .then(function(r){ if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function(txt){ setEvents(rowsToEvents(parseCSV(txt))); })
      .catch(function(){ /* the sheet could not be read: keep the events from data/events.js */ });
  }

  loadEvents();
  render();
  (function tick(){ var ms = 60000 - (Date.now() % 60000) + 50; setTimeout(function(){ render(); tick(); }, ms); })();
  document.addEventListener("visibilitychange", function(){ if (!document.hidden) render(); });
})();
