# Verification notes

Verified locally on macOS on 5 September 2026. See REVIEW.md for the engineering and design findings.

## Fluidity and continuous-music follow-up

- Rebuilt the production WASM after replacing fixed formation slots with local pressure/eddies and a curved movement-history wake. All **20** native regressions pass, including a new assertion that an evasive turn leaves a bent wake. Strict Clippy, Rust formatting, JavaScript syntax and frontend/workflow formatting pass.
- The full native Forked Mind survival route still wins: **149.5 simulated seconds**, 1,247 survivors, peak 2,001, approximately 0.67 ms/tick locally. It earns cells and adaptations through the public simulation API.
- The new Chromium integration test passes against the built static game. It enters the nursery with a real click, skips lessons, feeds normally until the first automatic choice, verifies the 25-second minimum and frozen simulation clock, and observes advancing musical beats/audio time. It chooses with the keyboard, checks that the journal suspends sound and that Escape resumes it, with zero browser/WebGL errors.
- Visually inspected the changing normal and forked lobes, golden guard organisms without perimeter lines, and a curved violet Slipstream turn in the app browser. Formation geometry is now internal to physical behaviour, rather than drawn as a persistent outline.
- CI repeats the native tests, full Forked Mind survival route, production build and browser regression before deploying `main` to GitHub Pages.

The measurements below record the earlier demo-review build; they are retained as historical evidence rather than benchmarks of the new flow model.

## Automated verification

- Production WebAssembly build succeeds with the pinned lockfile. All 19 native regression tests pass. Strict Clippy, Rust formatting, JavaScript syntax and authored frontend formatting pass.
- New checks enforce both time and nutrient evolution gates, six distinct choices, and at least 22 seconds between choices even with stockpiled nutrients. The first cannot occur before 25 seconds.
- Tidal Fang tests verify one impact while holding, relaxation back into a cloud, release/re-press rearming, and evasion cancelling the cast. Damage still requires actual cell proximity.
- Slipstream tests verify increased travel speed, rendered ghost organisms, early hunter redirection, commitment to the decoy position and suppression of repeated success announcements.
- Existing checks cover finite deterministic simulation at 8,000 cells, tutorial gates, feeding/nursery progression, pulse cost/timing/stagger limits, armour and area attacks, territorial rays, forked groups, shield growth, capacity, escort absorption/regrowth/attacks, articulated limbs and evasion exhaustion.
- Native whole-run checks earned their population without grants. The revised Fang route won in 57.1 simulated seconds, the guard route in 79.2 seconds, and the fork route in 161.9 seconds. The latter learned all six adaptations. These scripted players have perfect world knowledge; their completion times are not human playtime estimates.

## Browser playtesting

- Reviewed the previous spear and Slipstream in the protected nursery before changing them. Inspected the replacement's curl, extension, recoil and resting cloud; the violet movement current; shed colonies; and the adaptation journal in the browser.
- A normal feeding opening stayed in play throughout the first ten seconds. Its first automatic evolution paused at 25.016 seconds with 426 nutrients already earned. After choosing, the HUD required another 25 seconds of maturation instead of presenting a backlog.
- Used keyboard selection, Tab inspection and Escape return. Opened the journal during an evolution and returned to that same choice without advancing the simulation.
- An assisted browser run deliberately explored until all six adaptations matured, then awakened all three nurseries and defeated the boss. Its choices arrived at 25, 50, 75, 100, 125 and 150 simulated seconds. It grew naturally to 7,525 organisms and won at 202.39 seconds with 4,045 survivors and 13 counters. No population or trait grants were used in this run. The route included Tidal Fang, Slipstream, Vast Chorus, Sister Broods, Helix Guard and Forked Mind.
- The full-run log is `docs/final-demo-run.json`. Around 7,000 organisms, samples showed approximately 60 fps and 4.7 ms of simulation work per rendered frame. The largest rolling simulation average recorded in that run was 6.45 ms. Boss-fight samples remained near 60 fps with frame-time P99 around 18.4–18.7 ms and zero WebGL errors.
- A separate protected encounter confirmed a mantis taking an early Slipstream decoy at 1.4 seconds: both GHOST COLONY and DECOY TAKEN were emitted, before the white-flash commit window. Evidence is in `docs/final-demo-decoy.json`.
- Verified an enabled, running Web Audio context at 48 kHz with nonzero RMS during the progression run. The boss score switched on. In that earlier build, evolution paused audio after its notification interval and selecting resumed it; the follow-up above replaces this behaviour with continuous music. This verifies synthesis/lifecycle, not a subjective listening assessment.
- The browser input driver is reproducible in `scripts/browser-playtest.js`. Set `swarmPlaytestExplore = true` to exercise all six awakenings before pursuing the nurseries, and `swarmPlaytestFight = true` to complete the boss encounter.

## Ceiling stress test

A separate protected nursery run granted 8,000 organisms, all six adaptations from the browser route, and an articulated boss. This keeps population constant for profiling; it is not normal survival play. Samples are in `docs/final-demo-stress.json`.

| Scenario (6.5 seconds each) | FPS | Simulation ms/frame | Frame P99 |
| --- | ---: | ---: | ---: |
| Flow with two guards and escorts | 60.0 | 6.85 | 17.4 ms |
| Repeated Tidal Fang casts | 60.0 | 6.95 | 17.3 ms |
| Spread | 60.0 | 5.59 | 17.5 ms |
| Slipstream through exhaustion/recovery | 60.0 | 6.79 | 17.6 ms |

All samples reported zero WebGL errors. The last scenario deliberately includes energy exhaustion, so it is not a pure sustained-evasion measurement. A quick browser mouse press/release also initiated a cast immediately (age 0.017 s, cooldown 0.933 s), verifying that short clicks do not disappear between fixed ticks. `docs/final-journal.jpg` records the scrollable journal with six adaptations during this isolated inspection.

## Performance changes

Attacker neighbourhood queries now run only on impact ticks; radial guard-outline work is skipped without Helix Guard. Creature/escort scratch arrays are reused. Nutrient broad-phase checks use squared distance. Small-cell shader quads cover less empty space, and instance writes check buffer capacity. Existing bounded flocking, reused spatial buckets and GPU buffers, WASM views, fixed-step interpolation, distant-threat culling and capped decorative work remain in place. Combat telegraphs receive fresh creature snapshots each rendered simulation frame instead of waiting for the 120 ms HUD refresh.

Local timings are rolling samples, not a hardware-independent guarantee or a controlled before/after benchmark.

## Practical limits

Desktop mouse and keyboard are the intended controls. Touch support is basic. Safari and Firefox have not been individually playtested. The unlockable cap is 8,000; the simulation is single-threaded and rendering uses WebGL 2. Local macOS development uses the browser and native Rust tests, not a native windowed game binary. All visual/audio effects come from project code; fonts are self-hosted. The static build makes no external runtime requests. Human testing of build balance remains important: automated perception and aiming are unusually precise.
