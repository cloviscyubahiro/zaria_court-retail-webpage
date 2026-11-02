/**
 * Zaria Court Directory: page behaviour.
 *
 * Connects the markup in index.html to:
 *   js/config.js      window.ZC_CONFIG  settings (events sheet link, Ticqet links)
 *   data/events.js    window.ZC_EVENTS  events used while no sheet is connected
 *   js/lib/hours.js   window.ZCHours    opening-hours logic
 *   js/lib/events.js  window.ZCEvents   event parsing and formatting
 *
 * Everything that comes from the events sheet is inserted as text, never as HTML.
 */
(function () {
  'use strict';

  const Hours = window.ZCHours;
  const Events = window.ZCEvents;
  const CONFIG = window.ZC_CONFIG || {};

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const NEW_TAB_HINT = ' (opens in a new tab)';
  const EVENTS_SHOWN_COLLAPSED = 6;
  const MENU_TRANSITION_MS = 320;
  const CATEGORY_NAMES = Object.freeze({
    all: 'All shops',
    eat: 'Eat',
    coffee: 'Coffee & wine',
    shop: 'Shop',
    care: 'Grooming & wellness',
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');


  /* ---------------------------------------------------------------- helpers */

  const byId = (id) => document.getElementById(id);
  const queryAll = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function createElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /** An icon from the sprite at the top of index.html. */
  function createIcon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
  }

  function scrollBehavior() {
    return reducedMotion.matches ? 'auto' : 'smooth';
  }

  /** Scrolls to a section; moving focus there as well helps keyboard and screen reader users. */
  function goToSection(id, { moveFocus = false } = {}) {
    const target = byId(id);
    if (!target) return;
    target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    if (moveFocus) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  }


  /* ------------------------------------------------------------------ shops */

  const filters = { category: 'all', openOnly: false };

  const shops = queryAll('.shop').map((node) => ({
    node,
    name: node.dataset.name,
    hours: {
      open: Hours.parseClock(node.dataset.open),
      close: Hours.parseClock(node.dataset.close),
      days: node.dataset.days,
    },
    statusBox: node.querySelector('.status'),
    status: null,
  }));

  const categories = queryAll('.category').map((node) => ({
    node,
    key: node.dataset.category,
    shops: shops.filter((shop) => node.contains(shop.node)),
  }));

  /** Updates every shop's Open now / Closing soon / Closed line and returns how many are open. */
  function updateShopStatuses(now) {
    let openCount = 0;
    for (const shop of shops) {
      const status = Hours.shopStatus(shop.hours, now);
      shop.status = status;
      shop.statusBox.dataset.state = status.state;
      shop.statusBox.querySelector('.status__label').textContent = status.label;
      shop.statusBox.querySelector('.status__note').textContent = status.note;
      shop.statusBox.hidden = false;
      if (status.isOpen) openCount += 1;
    }
    return openCount;
  }

  /** The live counts in the top bar, the status strip and the menu. */
  function renderLiveSummary(openCount, now) {
    const total = shops.length;
    const time = `${Hours.DAY_NAMES[now.day]}, ${Hours.formatClock(now.minutes)} in Kigali`;
    const state = openCount > 0 ? 'open' : 'closed';

    let stripLabel = 'Shops open right now';
    if (openCount === 0) stripLabel = 'All shops closed right now';
    else if (openCount === 1) stripLabel = 'Shop open right now';
    byId('strip-label').textContent = stripLabel;
    byId('strip-time').textContent = time;

    const count = byId('strip-count');
    count.replaceChildren(String(openCount), createElement('small', null, `/${total}`));
    count.setAttribute('aria-label', `${openCount} of ${total} shops open`);

    const liveButton = byId('live-btn');
    liveButton.dataset.state = state;
    byId('live-text').textContent = openCount > 0 ? `${openCount} open` : 'Closed now';
    liveButton.setAttribute('aria-label', openCount > 0
      ? `${openCount} of ${total} shops open now. Show them`
      : 'All shops are closed right now. See when they open');

    byId('menu-live-row').dataset.state = state;
    byId('menu-live').textContent = `${openCount > 0 ? `${openCount} of ${total} shops open` : 'All shops closed'} · ${time}`;
  }

  function applyFilters() {
    let visibleCount = 0;
    let nextToOpen = null;

    for (const category of categories) {
      const categoryMatches = filters.category === 'all' || category.key === filters.category;
      let visibleInCategory = 0;
      for (const shop of category.shops) {
        const visible = categoryMatches && (!filters.openOnly || shop.status.isOpen);
        shop.node.hidden = !visible;
        if (visible) visibleInCategory += 1;
        if (categoryMatches && !shop.status.isOpen
          && (!nextToOpen || shop.status.minutesUntilOpen < nextToOpen.status.minutesUntilOpen)) {
          nextToOpen = shop;
        }
      }
      category.node.hidden = visibleInCategory === 0;
      visibleCount += visibleInCategory;
    }

    const name = CATEGORY_NAMES[filters.category] || CATEGORY_NAMES.all;
    byId('filter-desc').textContent = `${name}${filters.openOnly ? ' · open now' : ''} (${visibleCount})`;
    byId('filter-clear').hidden = filters.category === 'all' && !filters.openOnly;

    const empty = byId('empty');
    empty.hidden = visibleCount > 0;
    if (visibleCount === 0) {
      const message = filters.openOnly && nextToOpen
        ? `${nextToOpen.name} ${nextToOpen.status.note}.`
        : 'Try another category.';
      empty.replaceChildren(
        createElement('b', null, filters.openOnly ? 'Nothing open here right now' : 'Nothing to show'),
        createElement('span', null, message),
      );
    }
  }

  function syncFilterControls() {
    for (const button of queryAll('[data-filter]')) {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filters.category));
    }
    byId('open-only').checked = filters.openOnly;
  }

  function setFilters(changes) {
    Object.assign(filters, changes);
    syncFilterControls();
    applyFilters();
  }


  /* ------------------------------------------------------------- menu drawer */

  const drawer = byId('site-menu');
  const panel = drawer.querySelector('.drawer__panel');
  const menuButton = byId('menu-btn');
  const pageRegions = queryAll('[data-page]');
  let returnFocusTo = null;
  let closeTimer = 0;

  /** While the menu is open the rest of the page is inert, so focus and screen readers stay in the menu. */
  function setPageInert(inert) {
    for (const region of pageRegions) region.inert = inert;
  }

  function focusableInPanel() {
    return queryAll('a[href], button:not([disabled]), input:not([disabled])', panel)
      .filter((node) => node.offsetParent !== null);
  }

  function openMenu(event) {
    window.clearTimeout(closeTimer);
    returnFocusTo = event && event.currentTarget ? event.currentTarget : document.activeElement;
    drawer.hidden = false;
    void drawer.offsetWidth; // start the slide-in from the closed position
    drawer.classList.add('is-open');
    document.body.classList.add('is-menu-open');
    menuButton.setAttribute('aria-expanded', 'true');
    setPageInert(true);
    const firstFocus = panel.querySelector('[data-filter][aria-pressed="true"]') || panel.querySelector('.drawer__close');
    window.setTimeout(() => firstFocus.focus({ preventScroll: true }), reducedMotion.matches ? 0 : 60);
  }

  /** @param {Function} [afterClose] runs once the panel has slid away (instead of restoring focus) */
  function closeMenu(afterClose) {
    if (drawer.hidden) {
      if (afterClose) afterClose();
      return;
    }
    drawer.classList.remove('is-open');
    document.body.classList.remove('is-menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
    setPageInert(false);
    closeTimer = window.setTimeout(() => {
      drawer.hidden = true;
      if (afterClose) afterClose();
      else if (returnFocusTo) returnFocusTo.focus({ preventScroll: true });
    }, reducedMotion.matches ? 0 : MENU_TRANSITION_MS);
  }

  function handleMenuKeys(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = focusableInPanel();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }


  /* ------------------------------------------------------------------ events */

  const eventsState = { list: [], showAll: false, renderedKey: null };

  function preferredDateOrder() {
    return /^m/i.test(String(CONFIG.eventsDateOrder || '')) ? 'MDY' : 'DMY';
  }

  function setEvents(records) {
    eventsState.list = Events.prepareEvents(records, preferredDateOrder());
    eventsState.renderedKey = null;
    renderEvents();
  }

  function addFact(list, iconName, label, value) {
    if (!value) return;
    const item = createElement('li');
    const text = createElement('span');
    text.append(createElement('span', 'sr-only', `${label}: `), value);
    item.append(createIcon(iconName), text);
    list.append(item);
  }

  function createEventCard(event, tag) {
    const card = createElement('li', 'event');

    if (event.image) {
      const media = createElement('figure', 'event__media');
      const image = createElement('img');
      image.src = event.image;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => {
        media.remove();
        card.classList.remove('event--has-media');
      }, { once: true });
      media.append(image);
      card.append(media);
      card.classList.add('event--has-media');
    }

    const dateTile = createElement('div', 'event__date');
    dateTile.setAttribute('aria-hidden', 'true');
    dateTile.append(
      createElement('span', 'event__month', Hours.MONTH_NAMES[event.date.month - 1].slice(0, 3)),
      createElement('span', 'event__day', String(event.date.day)),
      createElement('span', 'event__weekday', Hours.DAY_SHORT[Events.weekday(event.date)]),
    );
    card.append(dateTile);

    const body = createElement('div', 'event__body');
    if (tag || event.category) {
      const labels = createElement('p', 'event__labels');
      if (tag) labels.append(createElement('span', 'badge', tag));
      if (event.category) labels.append(createElement('span', 'label event__category', event.category));
      body.append(labels);
    }
    body.append(createElement('h3', 'event__title', event.title));

    const facts = createElement('ul', 'info-list event__facts');
    addFact(facts, 'calendar', 'Date', Events.formatDateRange(event));
    addFact(facts, 'clock', 'Time', Events.formatTimeRange(event));
    addFact(facts, 'pin', 'Venue', event.venue);
    addFact(facts, 'ticket', 'Entry', event.price);
    body.append(facts);

    if (event.description) body.append(createElement('p', 'event__desc', event.description));

    if (event.details) {
      const more = createElement('details', 'event__more');
      more.append(createElement('summary', null, 'More details'), createElement('p', null, event.details));
      body.append(more);
    }

    if (event.link) {
      const actions = createElement('div', 'event__actions');
      const link = createElement('a', 'btn btn--primary');
      link.href = event.link;
      link.target = '_blank';
      link.rel = 'noopener';
      link.append(event.linkLabel, createElement('span', 'sr-only', NEW_TAB_HINT), createIcon('arrow-up-right'));
      actions.append(link);
      body.append(actions);
    }

    card.append(body);
    return card;
  }

  function renderNextUp(event, tag) {
    for (const link of queryAll('[data-next]')) {
      link.hidden = !event;
      if (!event) continue;
      link.querySelector('.next__label').textContent = tag || 'Next up';
      link.querySelector('.next__title').textContent = event.title;
      link.querySelector('.next__when').textContent = Events.formatSummary(event);
    }
  }

  function renderEvents() {
    const nowMs = Date.now();
    const upcoming = Events.upcomingEvents(eventsState.list, nowMs);
    const shown = eventsState.showAll ? upcoming : upcoming.slice(0, EVENTS_SHOWN_COLLAPSED);
    const tags = shown.map((event) => Events.eventTag(event, nowMs));

    byId('menu-events').textContent = upcoming.length ? `${upcoming.length} upcoming` : 'Soon';
    byId('events-list').hidden = upcoming.length === 0;
    byId('events-empty').hidden = upcoming.length > 0;

    const moreButton = byId('events-more');
    moreButton.hidden = upcoming.length <= EVENTS_SHOWN_COLLAPSED;
    moreButton.textContent = eventsState.showAll ? 'Show fewer events' : `Show all ${upcoming.length} events`;
    moreButton.setAttribute('aria-expanded', String(eventsState.showAll));

    renderNextUp(upcoming[0], tags[0]);

    // Rebuild the cards only when something visible changed, so an open "More details" stays open.
    const key = shown.map((event, index) => `${event.id}:${tags[index]}`).join('|');
    if (key === eventsState.renderedKey) return;
    eventsState.renderedKey = key;
    byId('events-list').replaceChildren(...shown.map((event, index) => createEventCard(event, tags[index])));
  }

  /** Events come from the published Google Sheet when one is set in js/config.js, otherwise from data/events.js. */
  async function loadEvents() {
    setEvents(window.ZC_EVENTS);
    const sheetUrl = String(CONFIG.eventsSheetCsvUrl || '').trim();
    if (!/^https:\/\//.test(sheetUrl)) return;
    try {
      const response = await fetch(sheetUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Events sheet returned HTTP ${response.status}`);
      setEvents(Events.rowsToRecords(Events.parseCSV(await response.text())));
    } catch (error) {
      // The page keeps showing data/events.js; the console note helps whoever maintains the sheet.
      console.warn('Zaria Court Directory: could not load the events sheet.', error);
    }
  }


  /* ------------------------------------------------------------ Ticqet links */

  function applyTicqetLinks() {
    const links = CONFIG.ticqet || {};
    for (const anchor of queryAll('[data-ticqet]')) {
      const url = Events.safeLink(links[anchor.dataset.ticqet]);
      if (url) anchor.href = url;
    }
    // Until pitch B and the court have their own links, guests land on Ticqet's home page; the note explains it.
    const isHomePage = (url) => !url || /ticqet\.rw\/?(#\/?)?$/.test(url);
    byId('play-note').hidden = !(isHomePage(links.pitchB) || isHomePage(links.court));
  }


  /* -------------------------------------------------------------- wiring */

  function bindEvents() {
    menuButton.addEventListener('click', openMenu);
    byId('filter-open').addEventListener('click', openMenu);
    drawer.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) closeMenu();
    });
    drawer.addEventListener('keydown', handleMenuKeys);

    for (const button of queryAll('[data-filter]')) {
      button.addEventListener('click', () => {
        setFilters({ category: button.dataset.filter });
        closeMenu(() => goToSection('directory', { moveFocus: true }));
      });
    }
    byId('open-only').addEventListener('change', (event) => setFilters({ openOnly: event.target.checked }));
    byId('filter-clear').addEventListener('click', () => setFilters({ category: 'all', openOnly: false }));
    byId('live-btn').addEventListener('click', () => {
      setFilters({ openOnly: true });
      goToSection('directory', { moveFocus: true });
    });

    for (const link of queryAll('[data-nav]')) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const id = link.hash.slice(1);
        closeMenu(() => goToSection(id, { moveFocus: true }));
      });
    }
    for (const link of queryAll('[data-scroll]')) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const id = link.hash.slice(1);
        goToSection(id, { moveFocus: id !== 'top' });
      });
    }

    byId('events-more').addEventListener('click', () => {
      eventsState.showAll = !eventsState.showAll;
      renderEvents();
      if (!eventsState.showAll) goToSection('whats-on');
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refresh();
    });
  }

  function refresh() {
    const now = Hours.kigaliNow();
    const openCount = updateShopStatuses(now);
    renderLiveSummary(openCount, now);
    applyFilters();
    renderEvents();
  }

  /** Re-renders at the start of every minute so the statuses and clock stay current. */
  function scheduleMinuteTick() {
    const msToNextMinute = 60000 - (Date.now() % 60000) + 50;
    window.setTimeout(() => {
      refresh();
      scheduleMinuteTick();
    }, msToNextMinute);
  }

  applyTicqetLinks();
  bindEvents();
  refresh();
  loadEvents();
  scheduleMinuteTick();
}());
