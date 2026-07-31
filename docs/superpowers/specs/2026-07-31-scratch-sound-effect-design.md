# Scratch Screen — Paper Scratching Sound Effect

**Date:** 2026-07-31
**Status:** Designed, not yet built.
**Source audio:** `Wedding/paper scratching sound .mov`

## Goal

Play a paper-scratching sound while the guest scratches the silver foil on the
onboarding scratch screen, so the gesture in mockups 2–3 feels physical instead of
silent.

## Source material

`Wedding/paper scratching sound .mov` is audio-only despite the extension: one AAC
track, stereo, 44.1kHz, 3.53s, peak −22 dBFS. The content is continuous rhythmic
scratching — roughly eight strokes, no long gaps — with near-silence only in the
first ~50ms and last ~30ms. That makes it suitable for looping.

`Wedding/` is gitignored, so the source stays out of the repo and only the
converted asset under `assets/` is committed.

## Decisions taken

| Question | Decision |
|---|---|
| Playback behaviour | Loop that follows the finger: starts on the first `pointermove` after touch-down, fades out when the guest lifts or stops moving |
| Idle threshold | 120ms without a `pointermove` counts as "stopped scratching" |
| Playback engine | Web Audio API (`AudioBuffer` + `GainNode`) |
| Volume control | `GainNode` at `VOLUME = 0.6`, not `HTMLMediaElement.volume` |
| Asset format | Mono AAC in `.m4a`, 96kbps, trimmed and normalised |
| Failure behaviour | Silent — scratching and reveal never depend on audio |

### Why Web Audio rather than an `<audio loop>` element

An `<audio>` element would mirror how `#bgm` already works and would be about a
quarter of the code. It was rejected on two counts:

1. **iOS Safari ignores `HTMLMediaElement.volume`.** Assigning to it is a no-op, so
   an element-based effect plays at full volume on iPhone — the primary device for
   a wedding invitation. `GainNode` works there.
2. **The chosen behaviour is built on fades.** `pause()` cuts the waveform mid-cycle
   and clicks; `linearRampToValueAtTime` does not.

A hybrid (`<audio>` routed through `MediaElementAudioSourceNode`) buys nothing for a
42KB clip and was dropped.

Note that `audio.js` already sets `bgm.volume = 0.55`, which is silently ignored on
iOS today. That is pre-existing behaviour and out of scope here.

## Asset build

One-off conversion with macOS `afconvert` (no `ffmpeg` on this machine), producing
`assets/sfx-scratch.m4a`:

- downmix to mono — paper noise gains nothing from stereo and mono halves the size
- trim ~50ms of leading and ~30ms of trailing silence, so the loop seam does not
  dip into a gap
- normalise peak to ≈ −3 dBFS; the source at −22 dBFS is too quiet to be heard
  under a thumb on a phone speaker
- encode AAC 96kbps → roughly 42KB

Playback loudness is set by `VOLUME` in `sfx.js`, so retuning it is a one-number
code change rather than a re-encode. The conversion command is documented in
`README.md` next to the existing image-rebuild instructions.

## Architecture

Three responsibilities, three files. No new dependency, no build step.

```
js/sfx.js         (new)  owns audio: buffer, AudioContext, gain envelope
js/scratch.js   (edited) owns canvas + gesture; reports when scratching is active
js/onboarding.js(edited) wires the two together
assets/sfx-scratch.m4a (new)
```

### `js/sfx.js`

```
makeScratchSfx() -> { start(), stop(), destroy() }
```

Knows nothing about the canvas. Fetches and decodes the clip once, opens a single
`AudioContext`, and on `start()` creates a looping `AudioBufferSourceNode` through a
`GainNode` — 40ms fade in, 150ms fade out on `stop()`. Each `start()` picks a random
offset into the buffer so repeated scratching does not replay an identical take.

`destroy()` stops any live source and closes the context.

`start()` and `stop()` are idempotent and are expected to be called many times in a
single scratch session — every pause and resume of the finger is another pair. Only
the source node is recreated each time; the buffer and context are reused, so a
repeat costs nothing measurable.

### `js/scratch.js`

The signature changes from positional to an options object, since there is now more
than one callback:

```js
makeScratch(canvas, { onReveal, onActive })
```

`onboarding.js:66` is the only call site.

This file already handles `pointerdown` / `pointermove` / `pointerup`, so it is the
only place that knows whether the guest is *actually* scratching. It emits:

- `onActive(true)` on the first `pointermove` of a stroke — not on `pointerdown`,
  because a touch that has not moved yet is not a scratch
- `onActive(false)` on pointer up, pointer cancel, or 120ms with no movement

The canvas erasing, coverage sampling, and resize logic are untouched.

### `js/onboarding.js`

Composes the two, matching the role `main.js` already plays for the app as a whole.
It creates the sfx alongside `makeScratch`, passes `onActive` straight through to
`start`/`stop`, calls `sfx.stop()` in `reveal()`, and disposes it in `destroy()`.

## Loading and unlocking

The buffer is prefetched when onboarding enters the `scratch` state — the moment
after the guest taps the sealed envelope — rather than on the first stroke. That
gives a few hundred milliseconds of head start for 42KB.

`AudioContext` is created and resumed inside a real user gesture (the scratch
`pointerdown`), which satisfies autoplay policy.

If the first stroke arrives before the buffer is ready, `start()` records that
playback is wanted and begins as soon as decoding finishes — but only if the guest
is still scratching at that point.

## Error handling

Every failure path is swallowed and results in no sound: fetch failure, decode
failure, missing `AudioContext`, or a blocked context resume. The scratch
interaction and the reveal transition must work identically with audio broken.

## Interaction with existing audio

`#bgm` starts at `reveal()`. The effect fades out over 150ms at that same moment, so
the two overlap into a short crossfade with no extra coordination.

The `prefers-reduced-motion` path skips the scratch screen entirely
(`onboarding.js:74`), so the effect is never loaded there.

## Verification

- `node tools/flow-check.mjs` and `node tools/flow-check.mjs --reduced` — the
  onboarding flow still completes and the console stays clean
- manual pass at `http://localhost:8099` on a mobile-width viewport, listening for:
  sound starting only once the finger moves, stopping when it rests, no click at
  either end, and a clean handover to the background music at reveal

## Out of scope

- Any mute or volume control for the effect; there is no sound UI before the vinyl
  toggle on HOME, and the effect lasts only a few seconds
- Fixing `bgm.volume` on iOS
- Sound on any other screen
