/* Live opening status, filters and Kigali clock for the Zaria Court Directory. */
(function(){
  var OFFSET_MIN = 120; /* Kigali is UTC+2 all year, no daylight saving */
  var DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var SOON = 45; /* minutes before closing that count as "closing soon" */
  var shops = Array.prototype.slice.call(document.querySelectorAll(".shop"));
  var sections = Array.prototype.slice.call(document.querySelectorAll(".cat"));
  var chipButtons = Array.prototype.slice.call(document.querySelectorAll("[data-filter]"));
  var openChip = document.getElementById("chip-open");
  var state = {cat:"all", openOnly:false};

  function now(){
    var d = new Date(Date.now() + OFFSET_MIN*60000);
    return {day:d.getUTCDay(), mins:d.getUTCHours()*60 + d.getUTCMinutes()};
  }
  function fmt(m){
    var h = Math.floor(m/60), mm = m%60, ap = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return (mm ? h + ":" + (mm < 10 ? "0" : "") + mm : String(h)) + " " + ap;
  }
  function toMin(v){ var p = String(v).split(":"); return (+p[0]) * 60 + (+(p[1] || 0)); }
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
    var t = now(), openCount = 0;
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
    document.getElementById("strip-label").textContent = openCount === 0 ? "All shops closed right now" : openCount === 1 ? "Shop open right now" : "Shops open right now";
    document.getElementById("strip-time").textContent = DAYS[t.day] + ", " + fmt(t.mins) + " in Kigali";
    var cnt = document.getElementById("strip-count");
    cnt.innerHTML = openCount + "<small>/" + shops.length + "</small>";
    cnt.setAttribute("aria-label", openCount + " of " + shops.length + " shops open");
    document.getElementById("chip-open-count").textContent = openCount;
    applyFilter();
  }

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
    var empty = document.getElementById("empty");
    if (visibleTotal === 0){
      var msg = state.openOnly && firstOpen
        ? "<b>Nothing open here right now</b>" + firstOpen.name + " " + firstOpen.note + "."
        : "<b>Nothing to show</b>Try another category.";
      empty.innerHTML = msg + '<br><button class="chip" type="button" id="reset">Show all twelve</button>';
      empty.hidden = false;
      document.getElementById("reset").onclick = function(){ state = {cat:"all", openOnly:false}; syncChips(); render(); };
    } else {
      empty.hidden = true;
    }
  }

  function syncChips(){
    chipButtons.forEach(function(b){ b.setAttribute("aria-pressed", b.dataset.filter === state.cat ? "true" : "false"); });
    openChip.setAttribute("aria-pressed", state.openOnly ? "true" : "false");
  }

  chipButtons.forEach(function(b){
    b.addEventListener("click", function(){
      state.cat = b.dataset.filter;
      syncChips(); render();
      var top = document.getElementById("directory").getBoundingClientRect().top;
      if (top < 0) document.getElementById("directory").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
    });
  });
  openChip.addEventListener("click", function(){ state.openOnly = !state.openOnly; syncChips(); render(); });

  document.querySelector(".cta").addEventListener("click", function(e){
    e.preventDefault();
    document.getElementById("directory").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
  });

  render();
  (function tick(){ var ms = 60000 - (Date.now() % 60000) + 50; setTimeout(function(){ render(); tick(); }, ms); })();
  document.addEventListener("visibilitychange", function(){ if (!document.hidden) render(); });
})();
