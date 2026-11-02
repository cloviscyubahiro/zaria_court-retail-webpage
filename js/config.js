/* Settings the Zaria Court team can change without touching the rest of the code. */
window.ZC_CONFIG = {
  /* Upcoming events from a Google Sheet (see README, "Add upcoming events").
     In the sheet: File > Share > Publish to web > pick the Events tab > Comma-separated values (.csv) > Publish,
     then paste the link between the quotes below. Leave it empty to use data/events.js instead. */
  eventsSheetCsvUrl: "",

  /* How the sheet writes a date such as 05/11/2026: "day-month" (5 November) or "month-day" (May 11).
     Dates typed as 2026-11-05 always work, whatever this says. */
  eventsDateOrder: "day-month",

  /* Ticqet booking links for the game areas.
     Pitch A has its own booking link. When Ticqet gives you direct links for pitch B and the court,
     paste them here; until then those buttons open Ticqet, where guests pick Zaria Court under Venues. */
  ticqet: {
    pitchA: "https://ticqet.rw/#/event/MX9KuPLIoNeBGlskCFba/reserve",
    pitchB: "https://ticqet.rw/#/",
    court: "https://ticqet.rw/#/",
    home: "https://ticqet.rw/#/"
  }
};
