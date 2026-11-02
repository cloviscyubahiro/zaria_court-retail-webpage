/**
 * Zaria Court Directory: event parsing and formatting.
 *
 * Turns event records (from data/events.js or a published Google Sheet) into clean,
 * validated events. Pure functions with no DOM access. The page loads this file as a
 * classic script (window.ZCEvents) after js/lib/hours.js; Node loads it with require()
 * for the unit tests in tests/events.test.js.
 *
 * Event text is untrusted input: the page only ever sets it as text, and links and
 * images must pass safeLink() / safeImage().
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./hours.js'));
  } else {
    root.ZCEvents = factory(root.ZCHours);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Hours) {
  'use strict';

  const MINUTE_MS = 60000;
  const HOUR_MS = 60 * MINUTE_MS;
  const DAY_MS = 24 * HOUR_MS;
  /** An event with a start time but no end time shows "Happening now" for this long. */
  const ASSUMED_DURATION_MS = 3 * HOUR_MS;
  const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  /**
   * Column names accepted for each field. Headers are compared in lower case with anything in
   * brackets and every non-letter removed, so "Start time (24h)" is read as "starttime".
   */
  const FIELD_ALIASES = Object.freeze({
    title: ['title', 'event', 'eventname', 'eventtitle', 'name', 'nameofevent'],
    date: ['date', 'startdate', 'eventdate', 'day', 'dateofevent', 'startday'],
    endDate: ['enddate', 'lastday', 'until', 'finishdate', 'lastdate'],
    start: ['start', 'starttime', 'time', 'from', 'doorsopen', 'begins', 'eventtime'],
    end: ['end', 'endtime', 'to', 'finish', 'finishtime', 'ends'],
    venue: ['venue', 'location', 'where', 'place', 'area', 'space'],
    category: ['category', 'type', 'kind', 'eventtype'],
    description: ['description', 'summary', 'short', 'shortdescription', 'intro', 'teaser'],
    details: ['details', 'moredetails', 'moreinfo', 'longdescription', 'fulldetails', 'fulldescription', 'info'],
    price: ['price', 'entry', 'cost', 'ticketprice', 'entryfee', 'fee'],
    link: ['link', 'url', 'ticket', 'tickets', 'ticketlink', 'ticketslink', 'bookinglink', 'website', 'rsvp',
      'registrationlink', 'registerlink'],
    linkLabel: ['linklabel', 'buttontext', 'button', 'linktext', 'buttonlabel'],
    image: ['image', 'imageurl', 'imagelink', 'poster', 'posterlink', 'photo', 'picture', 'flyer'],
    publish: ['publish', 'show', 'visible', 'live', 'showonpage', 'status'],
  });
  const HEADER_TO_FIELD = new Map(
    Object.entries(FIELD_ALIASES).flatMap(([field, names]) => names.map((name) => [name, field])),
  );
  /** Values in the publish column that hide a row. */
  const HIDDEN_VALUES = new Set(['no', 'n', 'false', 'hide', 'hidden', 'draft', '0']);

  const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
  const SLASH_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/;
  const DAY_MONTH_NAME = /(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})/i;
  const MONTH_NAME_DAY = /([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i;
  const WEB_URL = /^https?:\/\/[^\s"'<>]+$/i;
  const LOCAL_IMAGE = /^(?!.*\.\.)[\w-][\w\-./]*\.(?:avif|gif|jpe?g|png|webp)$/i;
  const DRIVE_FILE = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/;

  const clean = (value) => (value == null ? '' : String(value).trim());

  /**
   * Parses CSV text (RFC 4180: quoted fields, doubled quotes, line breaks inside quotes).
   * @param {string} text
   * @returns {string[][]} rows of fields; blank rows are dropped
   */
  function parseCSV(text) {
    const source = String(text).replace(/^﻿/, '');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (quoted) {
        if (char === '"' && source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && source[i + 1] === '\n') i += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
  }

  function normalizeHeader(header) {
    return clean(header).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
  }

  /**
   * Maps CSV rows to records keyed by field name, using the first row as headers.
   * Unknown columns (a Google Form "Timestamp", for example) are ignored; for a field that
   * appears twice, the first column wins.
   * @param {string[][]} rows
   * @returns {Object<string, string>[]}
   */
  function rowsToRecords(rows) {
    if (rows.length < 2) return [];
    const seen = new Set();
    const fields = rows[0].map((header) => {
      const field = HEADER_TO_FIELD.get(normalizeHeader(header));
      if (!field || seen.has(field)) return null;
      seen.add(field);
      return field;
    });
    return rows.slice(1).map((cells) => {
      const record = {};
      fields.forEach((field, index) => {
        if (field) record[field] = cells[index];
      });
      return record;
    });
  }

  /**
   * Works out whether dates like 05/11/2026 mean day-month or month-day, from any date in the
   * list that can only be read one way (14/11/2026 or 11/14/2026).
   * @param {Array<*>} values
   * @param {'DMY'|'MDY'} [preferred='DMY']  used when the list does not decide it
   * @returns {'DMY'|'MDY'}
   */
  function detectDateOrder(values, preferred = 'DMY') {
    let dayFirst = 0;
    let monthFirst = 0;
    for (const value of values) {
      const match = SLASH_DATE.exec(clean(value));
      if (!match) continue;
      if (Number(match[1]) > 12) dayFirst += 1;
      if (Number(match[2]) > 12) monthFirst += 1;
    }
    if (dayFirst !== monthFirst) return monthFirst > dayFirst ? 'MDY' : 'DMY';
    return preferred === 'MDY' ? 'MDY' : 'DMY';
  }

  function isValidDate(date) {
    if (!(date.month >= 1 && date.month <= 12 && date.day >= 1)) return false;
    return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDate() === date.day;
  }

  /**
   * Reads a date: 2026-11-14, 14/11/2026, 11/14/2026, 14 November 2026 or November 14, 2026.
   * @param {*} value
   * @param {'DMY'|'MDY'} [order='DMY']  how to read an ambiguous date such as 05/11/2026
   * @returns {{year: number, month: number, day: number} | null}
   */
  function parseDate(value, order = 'DMY') {
    const text = clean(value);
    if (!text) return null;
    let date = null;
    let match = ISO_DATE.exec(text);
    if (match) {
      date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    } else if ((match = SLASH_DATE.exec(text))) {
      const first = Number(match[1]);
      const second = Number(match[2]);
      const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
      let monthFirst = order === 'MDY';
      if (first > 12) monthFirst = false;
      else if (second > 12) monthFirst = true;
      date = monthFirst ? { year, month: first, day: second } : { year, month: second, day: first };
    } else if ((match = DAY_MONTH_NAME.exec(text))) {
      date = { year: Number(match[3]), month: MONTH_ABBR.indexOf(match[2].toLowerCase()) + 1, day: Number(match[1]) };
    } else if ((match = MONTH_NAME_DAY.exec(text))) {
      date = { year: Number(match[3]), month: MONTH_ABBR.indexOf(match[1].toLowerCase()) + 1, day: Number(match[2]) };
    }
    return date && isValidDate(date) ? date : null;
  }

  /**
   * Reads a time: 18:00, 18h00, 6:30 pm, 6pm, 6:00:00 PM or a bare hour such as 18.
   * @param {*} value
   * @returns {number | null} minutes after midnight
   */
  function parseTime(value) {
    const text = clean(value).toLowerCase();
    if (!text) return null;
    const match = /(\d{1,2})[:h.](\d{2})(?::\d{2})?(?:\s*([ap])\.?\s*m\b)?/.exec(text)
      || /(\d{1,2})()\s*([ap])\.?\s*m\b/.exec(text)
      || /^(\d{1,2})()$/.exec(text);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridiem = match[3] || '';
    if (meridiem === 'p' && hour < 12) hour += 12;
    if (meridiem === 'a' && hour === 12) hour = 0;
    if (hour === 24 && minute === 0) return Hours.MINUTES_PER_DAY;
    return hour < 24 && minute < 60 ? hour * 60 + minute : null;
  }

  /** Accepts only http(s) links; anything else (javascript:, data:, relative paths) becomes ''. */
  function safeLink(value) {
    const url = clean(value);
    return WEB_URL.test(url) ? url : '';
  }

  /**
   * Accepts http(s) image links and image files inside the site (assets/events/poster.jpg).
   * Google Drive share links become Drive's image-thumbnail link.
   */
  function safeImage(value) {
    const url = clean(value);
    const drive = DRIVE_FILE.exec(url);
    if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w1200`;
    return WEB_URL.test(url) || LOCAL_IMAGE.test(url) ? url : '';
  }

  /** Epoch milliseconds for a Kigali calendar date and time. */
  function kigaliEpoch(date, minutes) {
    return Date.UTC(date.year, date.month - 1, date.day) + (minutes - Hours.KIGALI_OFFSET_MINUTES) * MINUTE_MS;
  }

  function isSameDay(a, b) {
    return a.year === b.year && a.month === b.month && a.day === b.day;
  }

  /** Weekday of a calendar date, 0 = Sunday. */
  function weekday(date) {
    return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  }

  /**
   * Validates one record and works out when the event starts, ends and counts as "happening now".
   * @param {Object<string, *>} record
   * @param {'DMY'|'MDY'} [order='DMY']
   * @returns {Object | null} null for rows that must not show (no title or date, EXAMPLE rows, publish = no)
   */
  function normalizeEvent(record, order = 'DMY') {
    const title = clean(record.title);
    const date = parseDate(record.date, order);
    if (!title || !date || /^example\b/i.test(title)) return null;
    if (HIDDEN_VALUES.has(clean(record.publish).toLowerCase())) return null;

    const start = parseTime(record.start);
    const end = parseTime(record.end);
    let endDate = parseDate(record.endDate, order) || date;
    if (kigaliEpoch(endDate, 0) < kigaliEpoch(date, 0)) endDate = date;

    const startsAt = kigaliEpoch(date, start ?? 0);
    let endsAt;
    if (end != null) {
      endsAt = kigaliEpoch(endDate, end);
      if (endsAt <= startsAt) endsAt += DAY_MS; // finishes after midnight
    } else {
      endsAt = kigaliEpoch(endDate, Hours.MINUTES_PER_DAY); // stays listed until the end of its last day
    }
    const liveUntil = end == null && start != null && isSameDay(date, endDate)
      ? startsAt + ASSUMED_DURATION_MS
      : endsAt;

    return {
      title,
      date,
      endDate,
      start,
      end,
      startsAt,
      endsAt,
      liveUntil,
      venue: clean(record.venue),
      category: clean(record.category),
      description: clean(record.description),
      details: clean(record.details),
      price: clean(record.price),
      link: safeLink(record.link),
      linkLabel: clean(record.linkLabel) || 'More info',
      image: safeImage(record.image),
    };
  }

  /**
   * Validates a list of records (data/events.js or rowsToRecords()) and gives each event an id.
   * @param {Array<Object>} records
   * @param {'DMY'|'MDY'} [preferredOrder='DMY']
   * @returns {Object[]}
   */
  function prepareEvents(records, preferredOrder = 'DMY') {
    const list = Array.isArray(records) ? records.filter((record) => record && typeof record === 'object') : [];
    const order = detectDateOrder(list.flatMap((record) => [record.date, record.endDate]), preferredOrder);
    return list
      .map((record, index) => {
        const event = normalizeEvent(record, order);
        return event && Object.freeze({ ...event, id: index });
      })
      .filter(Boolean);
  }

  /** Events that have not finished yet, soonest first. */
  function upcomingEvents(events, nowMs = Date.now()) {
    return events
      .filter((event) => event.endsAt > nowMs)
      .sort((a, b) => a.startsAt - b.startsAt || a.title.localeCompare(b.title));
  }

  /** Whole days from today (in Kigali) to a calendar date: 0 = today, 1 = tomorrow, -1 = yesterday. */
  function dayOffset(date, nowMs = Date.now()) {
    const today = Hours.kigaliNow(nowMs);
    const todayUtc = Date.UTC(today.year, today.month - 1, today.date);
    return Math.round((Date.UTC(date.year, date.month - 1, date.day) - todayUtc) / DAY_MS);
  }

  /** "Happening now", "Today", "On now" (multi-day, already started), "Tomorrow" or "". */
  function eventTag(event, nowMs = Date.now()) {
    if (event.start != null && event.startsAt <= nowMs && nowMs < event.liveUntil) return 'Happening now';
    const offset = dayOffset(event.date, nowMs);
    if (offset === 0) return 'Today';
    if (offset < 0) return 'On now';
    if (offset === 1) return 'Tomorrow';
    return '';
  }

  function formatDay(date, style = 'long') {
    const month = Hours.MONTH_NAMES[date.month - 1];
    return style === 'short'
      ? `${Hours.DAY_SHORT[weekday(date)]} ${date.day} ${month.slice(0, 3)}`
      : `${Hours.DAY_NAMES[weekday(date)]} ${date.day} ${month}`;
  }

  /** "Monday 2 November", or "Saturday 7 November to Sunday 8 November" for multi-day events. */
  function formatDateRange(event) {
    const first = formatDay(event.date);
    return isSameDay(event.date, event.endDate) ? first : `${first} to ${formatDay(event.endDate)}`;
  }

  /** "6 pm to 10:30 pm", "6 pm", or "" when no start time is set. */
  function formatTimeRange(event) {
    if (event.start == null) return '';
    const start = Hours.formatClock(event.start);
    return event.end != null ? `${start} to ${Hours.formatClock(event.end)}` : start;
  }

  /** Compact one-line summary: "Mon 2 Nov · 6 pm · Courtyard terrace". */
  function formatSummary(event) {
    const time = event.start != null ? Hours.formatClock(event.start) : '';
    return [formatDay(event.date, 'short'), time, event.venue].filter(Boolean).join(' · ');
  }

  return Object.freeze({
    FIELD_ALIASES,
    parseCSV,
    rowsToRecords,
    detectDateOrder,
    parseDate,
    parseTime,
    safeLink,
    safeImage,
    weekday,
    normalizeEvent,
    prepareEvents,
    upcomingEvents,
    eventTag,
    formatDateRange,
    formatTimeRange,
    formatSummary,
  });
}));
