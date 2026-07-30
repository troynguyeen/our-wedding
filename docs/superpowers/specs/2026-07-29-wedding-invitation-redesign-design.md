# Wedding Invitation — UI Redesign

**Date:** 2026-07-29
**Status:** Built. Several decisions here were superseded during the build —
see the [iteration log](./2026-07-30-home-screen-iteration-log.md) for what
actually shipped, and for the non-obvious bugs worth knowing about.
**Source of truth:** `Wedding/Wedding Invitation Flow/` (8 numbered mockups), photos from `Wedding/SOURCE HÌNH/`, artwork from `Wedding/Material/`

## Goal

Rebuild the entire UI of the wedding invitation site to match the 8 numbered flow
mockups, with the smoothest possible motion and a layout that never breaks on
mobile.

## Decisions taken

| Question | Decision |
|---|---|
| Page structure | Three screens (HOME / OUR STORY / WEDDING DETAIL) plus an onboarding overlay, with the `‹ ›` nav bar from mockup 7 |
| Scratch-to-reveal (mockups 2–3) | Build it for real, as a canvas interaction |
| Venue and date | Keep **Claris Palace Hall, 22 Hiệp Bình, Thủ Đức, TP.HCM** on **07.03.2027**. The mockups' "Unique Wedding & Event / 38 Đặng Văn Bi" and the boarding pass's "05.03.2027" are not used |
| Priority | Mobile-first; layout must not overflow at any handset width |

## Architecture

Single HTML document, no build step, so the current static hosting keeps working.

```
index.html
css/    tokens.css  onboarding.css  home.css  story.css  detail.css
js/     main.js  router.js  onboarding.js  scratch.js
        reveal.js  countdown.js  audio.js  rsvp.js
assets/         existing decorative art (unchanged)
assets/photos/  generated WebP derivatives of SOURCE HÌNH
tools/          image generation + mobile audit scripts (not shipped)
```

Scripts load as ES modules (`<script type="module">`), which needs no bundler and
keeps each file focused on one job.

### Router

Routes are `#/home`, `#/story`, `#/detail`. `router.js` owns which screen has the
`is-active` class and nothing else.

A screen change is a cross-dissolve, not a page load: 200ms fade out with a 12px
lift, then 320ms fade in. Scroll position resets to top on entry, and the previous
screen's scroll position is discarded (guests move forward through the invitation,
not back into a half-read page).

Single-document is what makes the whole thing smooth: no white flash between
screens, background music survives navigation, and every asset stays in cache.

On touch, a horizontal swipe over 60px moves between screens in nav-bar order:
`story ← home → detail`. Vertical intent wins ties, so swiping never fights scroll.

## Screen 1 — Onboarding (mockups 1–5)

One element tree driven by a five-state machine in `onboarding.js`.

1. **Sealed** — `envelope-closed.webp` on the blurred green background. "a love
   letter from / Thành & Trinh" sits on the flap, wax seal below it. The seal
   breathes (scale 1 → 1.04, 2.4s), caption reads "Chạm để mở thiệp".
2. **Scratch** — on tap the Save-the-date card rises out of the envelope top and a
   silver foil canvas covers it. The flap caption swaps to "scratch to see details".
3. **Revealed** — once 55% of the foil is cleared, the remainder dissolves over
   400ms, leaving the card readable: lace edge, "Chí Thành & Ngọc Trinh", "07.03.27".
4. **Closing** — the card slides back down into the envelope, seal returns.
5. **Open** — the flap opens on a perspective `rotateX`, card and polaroid fan out
   to match mockup 5, then the whole group scales up and cross-fades into HOME.

A "Bỏ qua" skip control fades in after 4s so a guest who does not realise they
should scratch is never stuck.

### Scratch implementation

`scratch.js` exposes one function that takes a container and a completion callback.

- Canvas is sized from `getBoundingClientRect()` multiplied by `devicePixelRatio`.
- Brush is a round `destination-out` stroke, interpolated between pointer samples
  so a fast swipe leaves a continuous line rather than dots.
- Coverage is measured by drawing the canvas into an offscreen 64×64 copy and
  counting transparent pixels, at most every 120ms.
- `touch-action: none` is set on the canvas only, so the rest of the page still
  scrolls normally.
- On `resize` and `orientationchange` the canvas is re-measured and the existing
  scratched mask is redrawn scaled, so progress is never lost.

## Screen 2 — HOME (mockup 6)

Fixed blurred forest-green photo background, white orchid sprigs bleeding in at
section edges.

- **Photo card** — rounded card with a white border over a blurred couple photo.
  Script names overlay. The vinyl "click to play" button sits top-right and spins
  while audio plays. Inside the card sit the torn-paper invitation note and the
  envelope-with-polaroid collage, plus the **Our Story** wax seal button.

  > **Superseded during build.** Every piece of this collage now comes from the
  > designer's own artwork in `Wedding/Material/`, cut into `home-card`,
  > `home-names`, `home-note` and `home-envelope` rather than rebuilt in CSS.
  > See the iteration log, section 3.
- **Countdown band** — WE'RE GETTING MARRIED / MEET US ON / *Sunday, 07 March 2027*
  / count down & join with us. / `223 : 00 : 04 : 30` over DAYS HOURS MINUTES SECONDS.
- **Invitation ledger** — "a special invitation from / Thành & Trinh", then three
  hairline-separated rows with a large value on the left and a label on the right:
  `07.03.2027 | Save the date`, `18:00 | Meet us on`, `CLARIS | celebrate with us at`.
  Each row wipes in on scroll.
- **Details plate** — silk ribbon, porcelain plate and cutlery holding the
  "Our Wedding Details / Click to see more" card, which opens WEDDING DETAIL.
  Built from `Wedding/Material/plate wedding.png` as a single image, so it
  carries the silk bow and the engraved cutlery that a CSS build could not.
- Monogram footer.

Countdown target is `2027-03-07T18:00:00+07:00`, pinned to that offset so the
number is identical for a guest in any timezone.

## Screen 3 — OUR STORY (mockup 7)

Cream background, wine accents, `‹ HOME · WEDDING DETAIL ›` nav bar.

- **Intro card** — two columns. Left: Nguyễn Chí Thành / *Gia Trưởng* / (Trưởng Nam),
  "Xin chào, mình là… / bạn này dễ thương quá, chắc hong tên đâu", DevOps Engineer
  *"người trên núi"*. Right: Nguyễn Minh Như Ngọc Trinh / *Thứ Dữ* / (Thứ Nữ),
  "Xin chào, mình là… / chắc quen chơi thôi, tuần sau trap cho dở mệt",
  Product Branding *"người trên trời"*. Portrait under each column.
- **Timeline** — alternating left/right entries on a hairline rail with wine dots:
  Nov 2024 *When Two Opposites Attract* → Jan 2025 *Officially Started Dating* →
  May 2026 *She Said Yes* → March 2027 *And Now… We're Getting Married!*, with
  circle-masked bouquet and ring photos between entries.
- **Closing** — script "Thành & Trinh" beside the "Looking back, we're so grateful…"
  paragraph and the tuxedo photo.

## Screen 4 — WEDDING DETAIL (mockup 8)

- **Heart hero** — a maroon heart drawn as SVG, script names, `07 / 03 / 27` stacked
  with hairline rules, and "we can't wait to see you" set on a curved `textPath`.
  `couple-cutout.webp` overlaps the heart's left edge.
- **Torn edge** transition into cream.
- **Schedule timeline** — 17:30 Welcome & Gathering · 18:00 Ceremony Begins ·
  18:30 Dinner Begins · 19:00 Icebreakers & Fun · 20:30 Bouquet Toss & Wrap-Up,
  alternating alignment. On the right, the boarding pass slides out of a printer
  slot as the section scrolls, above a strip of clipped photos. Closing line:
  "Thank you for being a precious part of our happiest chapter!"
- **Map** — deep maroon velvet, lace doily framing the Google map of Claris Palace,
  two doves at the edges, address and a "Chỉ đường" link.
- **RSVP** — white card inside the lace border on velvet. Same fields and the same
  localStorage-only behaviour as the current site; no backend is introduced.
- Monogram footer.

## Motion system

`reveal.js` runs one `IntersectionObserver` for the whole site. Any `[data-reveal]`
element fades in and rises 22px over 600ms on `cubic-bezier(.22,.61,.36,1)`, with a
`--d` custom property for stagger. Elements are unobserved once revealed.

Parallax applies only to decorative layers, through a single rAF-throttled scroll
handler writing `translate3d` — never a layout-triggering property.

Under `prefers-reduced-motion: reduce`, all reveals resolve instantly, parallax is
disabled, the vinyl stops spinning, and the onboarding jumps from Sealed straight to
Open. The scratch interaction is skipped entirely in that mode.

## Background music

The track starts the moment the guest finishes scratching the foil, not on page
load — browsers block unprompted playback, and music that starts by itself is not
what a guest expects. The scratch happens after the guest has already tapped the
envelope, so the browser's sticky activation still covers the play call.

Under `prefers-reduced-motion` there is no scratch step, so `openEnvelope()` starts
the track instead; otherwise that guest would never hear it. `play()` returns early
when the track is already running, so calling it from both places is safe.

## Typography

All four families ship a Vietnamese subset, which is verified and required — names
like "Ngọc Trinh" and "Nguyễn" need glyphs outside latin-ext.

| Role | Family |
|---|---|
| Script names, script dates | Great Vibes |
| Editorial headings, timeline dates | Playfair Display |
| Body serif, ledger numerals | Cormorant Garamond |
| UI, labels, form controls | Be Vietnam Pro |

## Photos

`tools/build-images.mjs` generates `assets/photos/*.webp` from `SOURCE HÌNH` at
640 / 1080 / 1600 wide, wired up with `srcset` and `sizes`. Hero backgrounds are
blurred at generation time, so the browser never pays for a runtime `filter: blur()`
on a large image.

Every `<img>` carries explicit `width` and `height` so nothing shifts as images
arrive, `loading="lazy"` below the fold, and `decoding="async"`.

HEIC sources are decoded through `sips` into a temp JPEG before Pillow reads them,
because Pillow cannot open HEIC. `IMG_7946.heic` becomes the "She Said Yes" ring
photo and `IMG_7996.HEIC` supplies the beach proposal frame. All 40 source photos
are usable; none are excluded.

### Known deviation

No source photo has an alpha channel, so the OUR STORY portraits cannot be true
cutouts the way the mockup shows. They use soft arch masks with a feathered bottom
that melts into the cream background, which reads as an intentional treatment rather
than a failed cutout.

If transparent PNGs are later placed at `assets/photos/cut-groom.png` and
`assets/photos/cut-bride.png`, the CSS picks them up with no other change.

`assets/couple-cutout.webp` already has real transparency and is used as a genuine
cutout in the WEDDING DETAIL heart hero.

## Mobile

Base CSS is written for 360px. Media queries only widen the layout for tablet and
desktop; there is no desktop-down direction anywhere.

### Overflow containment

Global `overflow-x: hidden` is not used as a fix, because it hides bugs rather than
preventing them. Instead:

- Every absolutely-positioned decoration lives inside its own
  `position: relative; overflow: clip` stage, so orchids, doves, silk and the
  boarding pass can bleed past an edge without ever creating horizontal scroll.
- No fixed pixel widths. Containers are `width: min(100% - 2 * var(--pad), 34rem)`.
- Every `font-size` is a `clamp()` with a floor no lower than 13px.

### Elements that need specific handling

- **Countdown** is the widest row on the site. It uses
  `grid-template-columns: repeat(4, 1fr)` with the colons as pseudo-elements
  between cells, so it cannot overflow at any width, plus `tabular-nums` to stop
  digits jittering as they tick.
- **Ledger rows** collapse from two columns to stacked below 380px.
- **Heart and curved text** share one SVG using `textPath`, so the text scales
  locked to the heart and can never drift off the curve.
- **Boarding pass and photo strip** become narrower decorative layers that bleed
  off the right edge inside a clipping stage.
- **Vietnamese prose** uses `overflow-wrap: anywhere` so long unbroken strings
  cannot push a container wide.

### Platform specifics

- `dvh` and `svh` instead of `vh`, because the Safari URL bar makes `vh` wrong.
- `env(safe-area-inset-*)` padding on the nav bar and footer for notch and home bar.
- RSVP inputs at `font-size: 16px`; anything smaller makes Safari zoom into the form.
- Touch targets of at least 44×44 for the seal, vinyl, nav arrows, plate and submit.

## Verification

Chrome's `--dump-dom` hangs in Chrome 150, so both tools drive the browser over the
DevTools Protocol instead. Node 24 ships a global `WebSocket`, so neither tool needs
anything installed.

`tools/audit.mjs` sets device metrics for a width, loads each screen, and reports
`document.documentElement.scrollWidth` plus every element whose bounding box crosses
the viewport edge (skipping any with a clipping ancestor, since those are contained
by design). With `--shots` it also captures screenshots, scrolling the page once
first — `captureBeyondViewport` does not rasterise content that never entered the
viewport, so without that pass the screenshots omit images the real page shows.

`tools/flow-check.mjs` drives the actual interaction with synthetic pointer events:
tap, scratch the foil in a serpentine until the reveal threshold trips, then assert
the run through closing → open → HOME, that the music starts on the reveal, both
navigation buttons, the countdown, and an RSVP submission. `--reduced` re-runs it
under `prefers-reduced-motion: reduce`.

Taps are dispatched with CDP's `userGesture: true`. Without it Chrome does not treat
the call as a user activation, the autoplay policy blocks the music, and the audio
assertion fails on correct code.

Both run against `python3 -m http.server 8099` from the repo root.

Results:

1. **No horizontal overflow** at 320, 360, 390, 414, 430 and landscape 844×390, on
   all three screens plus onboarding — `overflow=0` on every combination.
2. **15 of 15 flow checks pass**, and 12 of 12 under reduced motion.
3. **No console errors** on load or on any navigation.
4. Screenshots at 390 reviewed against all eight mockups.
5. 59 asset references resolve; no generated image is left unused.

The map iframe stays blank in headless captures because the sandbox has no route to
Google Maps. That is a capture artifact, not a page defect.

## Out of scope

- No RSVP backend. Submissions stay in localStorage exactly as they do today.
- No CMS, framework or build pipeline. The image script is a one-off tool, not a
  build step.
- No changes to the music track or to the existing decorative art.
