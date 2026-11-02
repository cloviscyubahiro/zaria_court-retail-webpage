/**
 * Zaria Court Directory: opening-hours logic.
 *
 * Pure functions with no DOM access. The page loads this file as a classic script
 * (window.ZCHours); Node loads it with require() for the unit tests in tests/hours.test.js.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ZCHours = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Kigali is on Central Africa Time, UTC+2, all year (no daylight saving). */
  const KIGALI_OFFSET_MINUTES = 120;
  const MINUTES_PER_DAY = 1440;
  /** A shop that closes within this many minutes shows "Closing soon". */
  const CLOSING_SOON_MINUTES = 45;

  const DAY_NAMES = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const DAY_SHORT = Object.freeze(DAY_NAMES.map((name) => name.slice(0, 3)));
  const MONTH_NAMES = Object.freeze([
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]);
  const NBSP = ' ';

  /**
   * Wall-clock date and time in Kigali.
   * @param {number} [epochMs=Date.now()]
   * @returns {{year: number, month: number, date: number, day: number, minutes: number}}
   *   month is 1-12, day is the weekday (0 = Sunday), minutes are minutes after midnight.
   */
  function kigaliNow(epochMs = Date.now()) {
    const shifted = new Date(epochMs + KIGALI_OFFSET_MINUTES * 60000);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      date: shifted.getUTCDate(),
      day: shifted.getUTCDay(),
      minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    };
  }

  /**
   * Parses a 24-hour clock time such as "09:00" or "21:30".
   * @param {string} value
   * @returns {number} minutes after midnight, or NaN when the value is not a valid time
   */
  function parseClock(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
    if (!match) return NaN;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const total = hours * 60 + minutes;
    return minutes < 60 && total <= MINUTES_PER_DAY ? total : NaN;
  }

  /**
   * Formats minutes after midnight for guests: 660 -> "11 am", 1290 -> "9:30 pm".
   * A non-breaking space keeps "pm" on the same line as the number.
   * @param {number} minutes
   * @returns {string}
   */
  function formatClock(minutes) {
    const hour24 = Math.floor(minutes / 60) % 24;
    const minute = minutes % 60;
    const hour12 = hour24 % 12 || 12;
    const suffix = hour24 >= 12 ? 'pm' : 'am';
    const time = minute ? `${hour12}:${String(minute).padStart(2, '0')}` : String(hour12);
    return `${time}${NBSP}${suffix}`;
  }

  /**
   * Opening status of a shop at a given moment in Kigali.
   * @param {{open: number, close: number, days: string}} hours
   *   open and close in minutes after midnight; days lists the weekdays the shop opens ("0" = Sunday).
   * @param {{day: number, minutes: number}} now  from kigaliNow()
   * @returns {{state: 'open'|'soon'|'closed', label: string, note: string, isOpen: boolean, minutesUntilOpen: number}}
   */
  function shopStatus(hours, now) {
    const { open, close, days } = hours;
    const opensToday = days.includes(String(now.day));

    if (opensToday && now.minutes >= open && now.minutes < close) {
      const minutesLeft = close - now.minutes;
      return minutesLeft <= CLOSING_SOON_MINUTES
        ? { state: 'soon', label: 'Closing soon', note: `closes ${formatClock(close)}`, isOpen: true, minutesUntilOpen: 0 }
        : { state: 'open', label: 'Open now', note: `until ${formatClock(close)}`, isOpen: true, minutesUntilOpen: 0 };
    }

    if (opensToday && now.minutes < open) {
      return {
        state: 'closed', label: 'Closed', note: `opens at ${formatClock(open)}`,
        isOpen: false, minutesUntilOpen: open - now.minutes,
      };
    }

    for (let daysAhead = 1; daysAhead <= 7; daysAhead += 1) {
      const weekday = (now.day + daysAhead) % 7;
      if (days.includes(String(weekday))) {
        const when = daysAhead === 1 ? 'tomorrow' : DAY_NAMES[weekday];
        return {
          state: 'closed',
          label: opensToday ? 'Closed' : 'Closed today',
          note: `opens ${when} at ${formatClock(open)}`,
          isOpen: false,
          minutesUntilOpen: (MINUTES_PER_DAY - now.minutes) + (daysAhead - 1) * MINUTES_PER_DAY + open,
        };
      }
    }

    return { state: 'closed', label: 'Closed', note: '', isOpen: false, minutesUntilOpen: Infinity };
  }

  return Object.freeze({
    KIGALI_OFFSET_MINUTES,
    MINUTES_PER_DAY,
    CLOSING_SOON_MINUTES,
    DAY_NAMES,
    DAY_SHORT,
    MONTH_NAMES,
    kigaliNow,
    parseClock,
    formatClock,
    shopStatus,
  });
}));
