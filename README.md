# Zaria Court Directory

Guest guide to Zaria Court Kigali: the twelve shops with live opening hours in Kigali time, upcoming events, and the pitches and court guests can book on Ticqet. It is a static website (HTML, CSS and JavaScript, no framework and no build step), hosted on Netlify.

## Project structure

```
zaria-court-directory/
├── index.html                 Page markup: shops, What's on, Play & book, menu, footer
├── css/styles.css             All styling. Design tokens (colours, corner radius, type) at the top
├── js/
│   ├── config.js              Settings: events Google Sheet link, Ticqet booking links
│   ├── lib/hours.js           Opening-hours logic (pure functions, unit tested)
│   ├── lib/events.js          Event parsing, validation and formatting (pure functions, unit tested)
│   └── directory.js           Page behaviour: menu, filters, live status, event cards, links
├── data/events.js             Events used while no Google Sheet is connected
├── tests/                     Unit tests for js/lib (Node's built-in test runner)
├── templates/events-template.csv   Starting sheet for the marketing team
├── assets/                    Fonts, Zaria Court logos, hero photo, retailer logos, event posters
├── qr/                        QR code (SVG for print, PNG)
├── netlify.toml               Netlify settings and security headers
├── package.json               Test command (no dependencies)
└── .editorconfig, .gitignore
```

Scripts load in this order at the end of `index.html`: `config.js`, `data/events.js`, `lib/hours.js`, `lib/events.js`, `directory.js`.

## Run it locally

1. In VS Code choose **File > Open Folder...** and open this folder.
2. Install the **Live Server** extension, right-click `index.html` and choose **Open with Live Server**. The page reloads every time you save.

## Run the tests

Needs [Node.js](https://nodejs.org) 18 or newer, nothing else to install.

```
npm test
```

The tests cover opening hours (open, closing soon, closed, Wok Spot's Monday closure, Kigali time) and the events pipeline (CSV parsing, sheet column names, date and time formats, unsafe links, hidden rows, late-night and multi-day events). Run them after changing anything in `js/lib/`.

## Deploy

Netlify publishes this folder as it is (see `netlify.toml`). Commit and push to GitHub and Netlify updates the site within a minute or two:

```
git add -A
git commit -m "Describe the change"
git push
```

`netlify.toml` also sends security headers, including a Content-Security-Policy that only allows the site's own files, https images and the Google Sheet. If you add an outside service later (analytics, a chat widget), add its address to that policy, or the browser will block it.

## Code conventions

- **Design tokens.** Colours, corner radius (`--radius-sm` to `--radius-xl`, `--radius-pill`), fonts and spacing are CSS variables at the top of `css/styles.css`. Use them instead of new hard-coded values.
- **Icons.** One SVG sprite at the top of `index.html`. Use an icon with `<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-pin"></use></svg>`, and always put a text label next to it.
- **No inline styles or scripts.** The Content-Security-Policy blocks them; put styles in `css/styles.css` and code in `js/`.
- **Untrusted content.** Event text comes from a sheet, so `directory.js` only inserts it as text (never `innerHTML`), and links and images go through `safeLink()` and `safeImage()` in `js/lib/events.js`.
- **Accessibility.** The menu is a modal dialog (focus stays inside, Esc closes it, focus returns to the button). Links that open a new tab say so to screen readers, and animations respect "reduce motion".

## Add upcoming events

Events show in **What's on**, in the menu, and as a "Next up" link at the top of the page. They disappear by themselves once they are over.

### Option A: a Google Sheet (best for the marketing team, no code)

Set this up once:

1. Open [sheets.google.com](https://sheets.google.com), start a blank sheet and choose **File > Import > Upload**, then pick `templates/events-template.csv` and choose **Replace spreadsheet**.
2. Name the sheet, for example "Zaria Court events", and the tab "Events".
3. Choose **File > Share > Publish to web**. Under **Link**, pick the **Events** tab and **Comma-separated values (.csv)**, then **Publish** and copy the link.
4. Paste the link into `js/config.js` between the quotes of `eventsSheetCsvUrl`, then commit and push.

After that the team only edits the sheet. Changes show on the site within about five minutes.

- One row per event. Keep the first row (the column names) as it is.
- **Date**: type it as `2026-11-14`. If the sheet shows dates like `05/11/2026`, check `eventsDateOrder` in `js/config.js` (`"day-month"` means 5 November).
- **Start time / End time**: `18:00` or `6:00 pm`. End time is optional, and late events such as 20:00 to 02:00 work.
- **Last day**: only for events that run over several days.
- **Short description** always shows. **More details** opens when guests tap it (line breaks are kept).
- **Link** and **Button text**: for tickets or RSVP, for example `https://...` and `Get tickets`. Only `https://` and `http://` links are used.
- **Image link**: optional. A direct `https://` link to a picture, a Google Drive link to a file shared as "Anyone with the link", or a file you put in `assets/events/` (write `assets/events/name.jpg`).
- **Publish**: write `no` to hide an event without deleting it. Rows whose title starts with `EXAMPLE` never show.
- Anyone with the link can read a published sheet, so only put public information in it.

### Option B: edit `data/events.js`

Copy the example block into the square brackets and change the text, then commit and push. This list is only used while `eventsSheetCsvUrl` in `js/config.js` is empty.

## Ticqet booking links

The **Book** buttons read their links from `js/config.js`. `pitchA` goes straight to the pitch A booking page. `pitchB` and `court` open Ticqet's home page for now, where guests choose Zaria Court under Venues, and a note under the cards says so. Paste the direct links when you have them and the note disappears by itself.

## Common edits

**Opening hours.** In `index.html`, find the shop's line:

```html
<li class="shop" data-name="Wok Spot" data-open="11:00" data-close="21:00" data-days="023456">
```

- `data-open` and `data-close` use 24-hour time (`21:30` = 9:30 pm).
- `data-days` lists the days the shop opens: `0` Sunday to `6` Saturday. `0123456` means every day.
- Also update the text guests read a few lines below, for example `Daily · 11 am to 9 pm`.

**Description.** Edit the text inside `<p class="shop__desc">`.

**Logo.** Save a square image (400 x 400 px, logo on white) in `assets/logos/`. Laza, Wok Spot and Wines & More still show their name instead of a logo; replace their `<figure class="shop__logo shop__logo--text" ...>...</figure>` with

```html
<figure class="shop__logo"><img src="assets/logos/laza.webp" alt="Laza logo" width="400" height="400" decoding="async"></figure>
```

**Menu.** The menu is the `<div class="drawer" id="site-menu">` block near the end of `index.html`. The shop counts beside each category are typed there, so update them if a shop is added or removed.

## Before it goes live

- The QR code in `qr/` opens the Claude-hosted preview. Once the Netlify address is final, make the QR code again for that address.
- The Claude-hosted preview cannot read the Google Sheet; events from the sheet only appear on the Netlify site.
- Brandon Grotesque is a paid font. Check that Zaria Court's licence covers use on a website.
