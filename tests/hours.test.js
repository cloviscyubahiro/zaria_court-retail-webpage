'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Hours = require('../js/lib/hours.js');

const EVERY_DAY = '0123456';
const TUESDAY_TO_SUNDAY = '023456';
const MONDAY = 1;
const SATURDAY = 6;
const at = (day, clock) => ({ day, minutes: Hours.parseClock(clock) });
const hours = (open, close, days = EVERY_DAY) => ({ open: Hours.parseClock(open), close: Hours.parseClock(close), days });

test('kigaliNow converts UTC to Kigali time (UTC+2, no daylight saving)', () => {
  // 2026-11-02 16:56 UTC is Monday 18:56 in Kigali
  const now = Hours.kigaliNow(Date.UTC(2026, 10, 2, 16, 56));
  assert.deepEqual(now, { year: 2026, month: 11, date: 2, day: MONDAY, minutes: 18 * 60 + 56 });
  // 23:30 UTC on 31 December is already 1 January in Kigali
  assert.deepEqual(Hours.kigaliNow(Date.UTC(2026, 11, 31, 23, 30)), { year: 2027, month: 1, date: 1, day: 5, minutes: 90 });
});

test('parseClock reads 24-hour times and rejects anything else', () => {
  assert.equal(Hours.parseClock('09:00'), 540);
  assert.equal(Hours.parseClock('21:30'), 1290);
  assert.equal(Hours.parseClock('24:00'), 1440);
  for (const bad of ['', '9', '9am', '25:00', '12:60', '24:30', 'noon']) {
    assert.ok(Number.isNaN(Hours.parseClock(bad)), bad);
  }
});

test('formatClock gives guest-friendly times', () => {
  assert.equal(Hours.formatClock(0), '12 am');
  assert.equal(Hours.formatClock(660), '11 am');
  assert.equal(Hours.formatClock(720), '12 pm');
  assert.equal(Hours.formatClock(1290), '9:30 pm');
  assert.equal(Hours.formatClock(1440), '12 am');
});

test('shopStatus: open, closing soon and closed later today', () => {
  const shop = hours('11:00', '21:30');
  assert.deepEqual(Hours.shopStatus(shop, at(SATURDAY, '12:00')),
    { state: 'open', label: 'Open now', note: 'until 9:30 pm', isOpen: true, minutesUntilOpen: 0 });
  assert.equal(Hours.shopStatus(shop, at(SATURDAY, '20:45')).state, 'soon');
  assert.equal(Hours.shopStatus(shop, at(SATURDAY, '20:44')).state, 'open');
  assert.equal(Hours.shopStatus(shop, at(SATURDAY, '21:30')).state, 'closed');
});

test('shopStatus: before opening says when it opens', () => {
  const status = Hours.shopStatus(hours('08:00', '21:00'), at(SATURDAY, '07:00'));
  assert.equal(status.label, 'Closed');
  assert.equal(status.note, 'opens at 8 am');
  assert.equal(status.minutesUntilOpen, 60);
});

test('shopStatus: after closing points to tomorrow', () => {
  const status = Hours.shopStatus(hours('09:00', '20:00'), at(SATURDAY, '22:00'));
  assert.equal(status.label, 'Closed');
  assert.equal(status.note, 'opens tomorrow at 9 am');
  assert.equal(status.minutesUntilOpen, 120 + 540);
});

test('shopStatus: a shop closed all day (Wok Spot on Monday) opens Tuesday', () => {
  const wokSpot = hours('11:00', '21:00', TUESDAY_TO_SUNDAY);
  const monday = Hours.shopStatus(wokSpot, at(MONDAY, '12:00'));
  assert.equal(monday.label, 'Closed today');
  assert.equal(monday.note, 'opens tomorrow at 11 am');
  const sundayNight = Hours.shopStatus(wokSpot, at(0, '22:00'));
  assert.equal(sundayNight.note, 'opens Tuesday at 11 am');
});
