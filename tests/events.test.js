'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Events = require('../js/lib/events.js');

/** Epoch milliseconds for a Kigali wall-clock time (UTC+2). */
const kigali = (year, month, day, hour = 0, minute = 0) => Date.UTC(year, month - 1, day, hour - 2, minute);

test('parseCSV handles quotes, commas, line breaks, CRLF and a byte order mark', () => {
  const csv = '﻿Title,Details\r\n"Afrobeats night, live","Line-up:\nDJ One\n""Special"" guest"\r\n\r\nPlain,row\r\n';
  assert.deepEqual(Events.parseCSV(csv), [
    ['Title', 'Details'],
    ['Afrobeats night, live', 'Line-up:\nDJ One\n"Special" guest'],
    ['Plain', 'row'],
  ]);
});

test('rowsToRecords matches the template headers and Google Form style headers', () => {
  const template = ['Title', 'Date (YYYY-MM-DD)', 'Start time (24h)', 'End time (24h)', 'Last day (multi-day events only)',
    'Venue', 'Category', 'Short description', 'More details', 'Price', 'Link', 'Button text', 'Image link', 'Publish (yes/no)'];
  const [record] = Events.rowsToRecords([template, template.map((_, i) => `v${i}`)]);
  assert.deepEqual(Object.keys(record), ['title', 'date', 'start', 'end', 'endDate', 'venue', 'category', 'description',
    'details', 'price', 'link', 'linkLabel', 'image', 'publish']);

  const form = [['Timestamp', 'Event title', 'Event date', 'Location', 'Ticket price', 'Ticket link', 'Poster'],
    ['10/28/2026 10:12:00', 'Jazz', '11/14/2026', 'Terrace', 'Free', 'https://example.com', 'https://example.com/p.jpg']];
  assert.deepEqual(Events.rowsToRecords(form)[0], {
    title: 'Jazz', date: '11/14/2026', venue: 'Terrace', price: 'Free', link: 'https://example.com', image: 'https://example.com/p.jpg',
  });
});

test('parseDate reads common formats and rejects impossible dates', () => {
  const nov14 = { year: 2026, month: 11, day: 14 };
  assert.deepEqual(Events.parseDate('2026-11-14'), nov14);
  assert.deepEqual(Events.parseDate('14/11/2026'), nov14);
  assert.deepEqual(Events.parseDate('11/14/2026'), nov14);
  assert.deepEqual(Events.parseDate('14 November 2026'), nov14);
  assert.deepEqual(Events.parseDate('Nov 14th, 2026'), nov14);
  assert.deepEqual(Events.parseDate('05/11/2026'), { year: 2026, month: 11, day: 5 });
  assert.deepEqual(Events.parseDate('05/11/2026', 'MDY'), { year: 2026, month: 5, day: 11 });
  for (const bad of ['', 'soon', '31/11/2026', '2026-02-30', '13/13/2026']) {
    assert.equal(Events.parseDate(bad), null, bad);
  }
});

test('detectDateOrder learns the order from unambiguous dates, then falls back', () => {
  assert.equal(Events.detectDateOrder(['11/14/2026', '11/5/2026']), 'MDY');
  assert.equal(Events.detectDateOrder(['14/11/2026', '5/11/2026'], 'MDY'), 'DMY');
  assert.equal(Events.detectDateOrder(['05/11/2026'], 'MDY'), 'MDY');
  assert.equal(Events.detectDateOrder(['2026-11-05']), 'DMY');
});

test('parseTime reads the usual ways of writing a time', () => {
  const cases = { '18:00': 1080, '18h00': 1080, '6:30 pm': 1110, '6pm': 1080, '6 p.m.': 1080, '6:00:00 PM': 1080,
    '12:30 am': 30, '12pm': 720, '9.15': 555, '18': 1080, '24:00': 1440 };
  for (const [input, minutes] of Object.entries(cases)) assert.equal(Events.parseTime(input), minutes, input);
  for (const bad of ['', 'late', '25:00', '7:75']) assert.equal(Events.parseTime(bad), null, bad);
});

test('safeLink and safeImage only let through safe addresses', () => {
  assert.equal(Events.safeLink('https://ticqet.rw/#/'), 'https://ticqet.rw/#/');
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', '//evil.example/x', 'poster.png', 'https://a b']) {
    assert.equal(Events.safeLink(bad), '', bad);
  }
  assert.equal(Events.safeImage('assets/events/jazz-night.jpg'), 'assets/events/jazz-night.jpg');
  assert.equal(Events.safeImage('https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing'),
    'https://drive.google.com/thumbnail?id=1AbCdEfGhIjK&sz=w1200');
  for (const bad of ['../secret.png', '/abs/path.jpg', 'notes.txt', 'javascript:alert(1)']) {
    assert.equal(Events.safeImage(bad), '', bad);
  }
});

test('normalizeEvent skips example, unpublished and incomplete rows', () => {
  assert.equal(Events.normalizeEvent({ title: 'EXAMPLE - Live music night', date: '2026-11-14' }), null);
  assert.equal(Events.normalizeEvent({ title: 'Draft', date: '2026-11-14', publish: 'No' }), null);
  assert.equal(Events.normalizeEvent({ title: 'No date' }), null);
  assert.equal(Events.normalizeEvent({ date: '2026-11-14' }), null);
  assert.ok(Events.normalizeEvent({ title: 'Shown', date: '2026-11-14', publish: 'yes' }));
});

test('normalizeEvent works out start, end and the "happening now" window', () => {
  const evening = Events.normalizeEvent({ title: 'Jazz', date: '2026-11-14', start: '18:00', end: '22:30' });
  assert.equal(evening.startsAt, kigali(2026, 11, 14, 18));
  assert.equal(evening.endsAt, kigali(2026, 11, 14, 22, 30));
  assert.equal(evening.liveUntil, evening.endsAt);

  const lateNight = Events.normalizeEvent({ title: 'DJ', date: '2026-11-14', start: '22:00', end: '02:00' });
  assert.equal(lateNight.endsAt, kigali(2026, 11, 15, 2));

  const noEnd = Events.normalizeEvent({ title: 'Match', date: '2026-11-25', start: '20:00' });
  assert.equal(noEnd.liveUntil, kigali(2026, 11, 25, 23));
  assert.equal(noEnd.endsAt, kigali(2026, 11, 26, 0));

  const market = Events.normalizeEvent({ title: 'Market', date: '2026-11-07', endDate: '2026-11-08', start: '10:00', end: '18:00' });
  assert.equal(market.endsAt, kigali(2026, 11, 8, 18));
});

test('prepareEvents uses the sheet\'s own date order for ambiguous dates', () => {
  const events = Events.prepareEvents([
    { title: 'Unambiguous', date: '11/14/2026' },
    { title: 'Ambiguous', date: '11/5/2026' },
    null,
  ]);
  assert.deepEqual(events.map((event) => [event.id, event.date.month, event.date.day]), [[0, 11, 14], [1, 11, 5]]);
});

test('upcomingEvents drops finished events and sorts the rest', () => {
  const events = Events.prepareEvents([
    { title: 'Later', date: '2026-11-20', start: '18:00' },
    { title: 'Finished', date: '2026-10-30', start: '18:00', end: '20:00' },
    { title: 'Tonight', date: '2026-11-02', start: '18:00', end: '22:00' },
  ]);
  const now = kigali(2026, 11, 2, 19);
  assert.deepEqual(Events.upcomingEvents(events, now).map((event) => event.title), ['Tonight', 'Later']);
});

test('eventTag labels events relative to now in Kigali', () => {
  const [tonight, tomorrow, nextWeek, market] = Events.prepareEvents([
    { title: 'Tonight', date: '2026-11-02', start: '18:00', end: '22:00' },
    { title: 'Tomorrow', date: '2026-11-03', start: '09:00' },
    { title: 'Next week', date: '2026-11-09' },
    { title: 'Market', date: '2026-11-01', endDate: '2026-11-03' },
  ]);
  assert.equal(Events.eventTag(tonight, kigali(2026, 11, 2, 19)), 'Happening now');
  assert.equal(Events.eventTag(tonight, kigali(2026, 11, 2, 9)), 'Today');
  assert.equal(Events.eventTag(tomorrow, kigali(2026, 11, 2, 23, 59)), 'Tomorrow');
  assert.equal(Events.eventTag(nextWeek, kigali(2026, 11, 2, 12)), '');
  assert.equal(Events.eventTag(market, kigali(2026, 11, 2, 12)), 'On now');
});

test('formatters produce guest-facing text', () => {
  const [single, multi, noTime] = Events.prepareEvents([
    { title: 'Jazz', date: '2026-11-02', start: '18:00', end: '22:30', venue: 'Courtyard terrace' },
    { title: 'Market', date: '2026-11-07', endDate: '2026-11-08' },
    { title: 'Open day', date: '2026-11-09' },
  ]);
  assert.equal(Events.formatDateRange(single), 'Monday 2 November');
  assert.equal(Events.formatTimeRange(single), '6 pm to 10:30 pm');
  assert.equal(Events.formatSummary(single), 'Mon 2 Nov · 6 pm · Courtyard terrace');
  assert.equal(Events.formatDateRange(multi), 'Saturday 7 November to Sunday 8 November');
  assert.equal(Events.formatTimeRange(noTime), '');
});
