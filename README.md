# Zaria Court Directory

Guest guide to the twelve shops in the Zaria Court retail park, with live opening hours in Kigali time.

## Open it in VS Code

1. Unzip this folder somewhere easy to find, for example `Documents\zaria-court-directory`.
2. In VS Code choose **File > Open Folder...** and pick the `zaria-court-directory` folder.
3. To see the page, double-click `index.html` in File Explorer, or install the **Live Server** extension in VS Code, right-click `index.html` and choose **Open with Live Server**. Live Server reloads the page every time you save.

## What is in the folder

| Path | What it is |
|---|---|
| `index.html` | The page: header, hero, the twelve shop cards, good to know, footer |
| `css/styles.css` | All colours, fonts and layout. Brand colours are the variables at the top (`--navy`, `--red`, `--green`, `--yellow`) |
| `js/directory.js` | Works out Open now / Closing soon / Closed in Kigali time, the live clock and the filter buttons |
| `assets/logos/` | Retailer logos (white square tiles, 400 x 400 px) |
| `assets/brand/` | Zaria Court logos taken from the brand guidelines |
| `assets/fonts/` | Brandon Grotesque Black (headlines) and Hanken Grotesk (body text) |
| `assets/images/hero-dusk.webp` | The photo at the top of the page |
| `qr/` | The QR code as SVG (for printers) and PNG |
| `zaria-court-directory-single-file.html` | The same page as one file with everything built in, easiest to upload to a host |

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

## Before it goes live

- The QR code in `qr/` opens the Claude-hosted version of this page. If you host the page somewhere else (for example on zariacourt.com), the QR code has to be made again for the new address.
- Brandon Grotesque is a paid font. Check that Zaria Court's font licence covers use on a website.
