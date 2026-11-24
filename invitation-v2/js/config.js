/* ---------------------------------------------------------------
   Edit this file — nothing else — to wire the invitation up.
   --------------------------------------------------------------- */
window.WEDDING = {
  /* 1 ▸ RSVP.  Deploy apps-script/Code.gs as a Web app and paste the
        .../exec URL here.  Leave empty to run the form in demo mode
        (it still validates + thanks the guest, but stores nothing). */
  RSVP_ENDPOINT: '',

  /* 2 ▸ Background music. Drop your file at assets/audio/the-ordinary.mp3
        (or point this at any direct https URL).                      */
  MUSIC_SRC:   'assets/audio/the-ordinary.mp3',
  MUSIC_TITLE: 'The Ordinary',
  MUSIC_VOLUME: 0.55,

  /* 3 ▸ The moment everything counts down to (Asia/Ho_Chi_Minh). */
  EVENT_ISO: '2027-03-28T18:00:00+07:00',

  /* 4 ▸ Venue link behind the map card. */
  MAPS_URL: 'https://www.google.com/maps/search/?api=1&query=Claris+Palace+22+Hiep+Binh+Thu+Duc+HCMC',

  /* 5 ▸ How much of the silver panel must be scratched away (0-1) before the
        rest of it is swept off automatically. Nobody scratches a real card
        clean, so keep this well under half. */
  SCRATCH_THRESHOLD: 0.38
};
