# Zaria Court Directory

Guest guide to Zaria Court: the twelve shops with live opening hours in Kigali time, upcoming events, and the pitches and court you can book on Ticqet.

## Open it in VS Code

1. Unzip this folder somewhere easy to find, for example `Documents\zaria-court-directory`.
2. In VS Code choose **File > Open Folder...** and pick the `zaria-court-directory` folder.
3. To see the page, install the **Live Server** extension, right-click `index.html` and choose **Open with Live Server**. Live Server reloads the page every time you save. Double-clicking `index.html` in File Explorer also opens it.

## What is in the folder

| Path | What it is |
|---|---|
| `index.html` | The page: top bar and menu, hero, the twelve shop cards, What's on, Play & book, good to know, footer |
| `js/config.js` | Settings the team can change: the Google Sheet link for events and the Ticqet booking links |
| `data/events.js` | Upcoming events, used when no Google Sheet is connected |
| `templates/events-template.csv` | Ready-made events sheet for the marketing team (see below) |
| `css/styles.css` | All colours, fonts and layout. Brand colours are the variables at the top (`--navy`, `--red`, `--green`, `--yellow`) |
| `js/directory.js` | The menu, Open now / Closing soon / Closed in Kigali time, filters, events and booking links |
| `assets/logos/` | Retailer logos (white square tiles, 400 x 400 px) |
| `assets/events/` | Event posters, if you keep them in the site instead of linking to them |
| `assets/brand/` | Zaria Court logos taken from the brand guidelines |
| `assets/fonts/` | Brandon Grotesque Black (headlines) and Hanken Grotesk (body text) |
| `assets/images/hero-dusk.webp` | The photo at the top of the page |
| `qr/` | The QR code as SVG (for printers) and PNG |

## Add upcoming events

Events show in **What's on**, in the menu, and as a "Next up" link at the top of the page. They disappear by themselves once they are over, so nobody has to clean up old ones.

### Option A: a Google Sheet (best for the marketing team, no code)

Set this up once:

1. Open [sheets.google.com](https://sheets.google.com), start a blank sheet and choose **File > Import > Upload**, then pick `templates/events-template.csv` and choose **Replace spreadsheet**.
2. Name the sheet, for example "Zaria Court events", and the tab "Events".
3. Choose **File > Share > Publish to web**. Under **Link**, pick the **Events** tab and **Comma-separated values (.csv)**, then **Publish** and copy the link.
4. Paste the link into `js/config.js` between the quotes of `eventsSheetCsvUrl`, save, then commit and push to GitHub. Netlify updates the site by itself.

After that, the team only edits the sheet. Changes show on the site within about five minutes, with no code and no new upload.

- One row per event. Keep the first row (the column names) as it is.
- **Date**: type it as `2026-11-14`. If the sheet shows dates like `05/11/2026`, check `eventsDateOrder` in `js/config.js` matches (`"day-month"` means 5 November).
- **Start time / End time**: `18:00` or `6:00 pm`. End time is optional. Late events such as 20:00 to 02:00 are fine.
- **Last day**: only for events that run over several days.
- **Short description** is always shown. **More details** opens when guests tap it (line breaks are kept).
- **Link** and **Button text**: for tickets or RSVP, for example `https://...` and `Get tickets`. Only links starting with `https://` or `http://` are used.
- **Image link**: optional. A direct `https://` link to a picture, or a Google Drive share link for a file shared as "Anyone with the link".
- **Publish**: write `no` to hide an event without deleting the row. Rows whose title starts with `EXAMPLE` never show.
- Everything in a published sheet can be read by anyone with the link, so only put public information in it.

A Google Form can feed the same sheet if you prefer a form: name the questions like the columns above (Title, Date, Start time...) and publish the form's response tab instead.

### Option B: edit `data/events.js`

Open `data/events.js`, copy the example block into the square brackets and change the text. Commit and push to update the site. This list is only used while `eventsSheetCsvUrl` in `js/config.js` is empty.

## Ticqet booking links

The **Book** buttons in Play & book, the menu and the footer read their links from `js/config.js`:

- `pitchA` goes straight to the pitch A booking page.
- `pitchB` and `court` open Ticqet's home page for now, where guests choose Zaria Court under Venues, and a short note under the cards says so. When you have the direct links for pitch B and the court, paste them in and the note disappears.

## Common edits

**Change opening hours.** In `index.html`, find the shop's `<li class="shop" ...>` line:

```html
<li class="shop" data-name="Wok Spot" data-open="11:00" data-close="21:00" data-days="023456">
```

- `data-open` and `data-close` use 24-hour time (`21:30` = 9:30 pm).
- `data-days` lists the days the shop opens: `0` Sunday, `1` Monday, `2` Tuesday, `3` Wednesday, `4` Thursday, `5` Friday, `6` Saturday. `0123456` means every day.
- Also update the line people read, a few lines below: `Daily · 11 am to 9 pm`.

**Change a description.** Edit the text inside `<p class="shop__desc">` for that shop.

**Add or swap a logo.** Save a square image (400 x 400 px works well, logo on white) into `assets/logos/`, then point the shop's `<img src="...">` at it. Laza, Wok Spot and Wines & More still show their name instead of a logo: replace their `<figure class="shop__img shop__img--type">...</figure>` with

```html
<figure class="shop__img shop__img--logo"><img src="assets/logos/laza.webp" alt="Laza logo" width="400" height="400"></figure>
```

**Change the menu.** The menu is the `<div class="drawer" id="site-menu">` block near the end of `index.html`. The shop counts next to each category are typed in there, so update them if you add or remove a shop.

## Before it goes live

- The QR code in `qr/` opens the Claude-hosted preview of this page. Once the site is on Netlify (or zariacourt.com), the QR code has to be made again for the new address.
- The Claude-hosted preview cannot read the Google Sheet. Events from the sheet only appear on the Netlify site.
- Brandon Grotesque is a paid font. Check that Zaria Court's font licence covers use on a website.
