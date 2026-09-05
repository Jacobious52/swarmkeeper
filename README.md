# Swarmkeeper

**A thousand bodies. One instinct.**

A browser-playable, procedural ecosystem built with Rust, Bevy ECS, WebAssembly, WebGL 2, and Web Audio. Guide a living collective from 160 organisms to a swarm of up to 8,000. Feed, choose up to six adaptations, awaken three nurseries, and survive an ancient leviathan.

[**Play Swarmkeeper**](https://jacobious52.github.io/swarmkeeper/) · [Build and deployment](https://github.com/Jacobious52/swarmkeeper/actions)

## Play locally

The compiled browser build is included. Node.js 18+ is enough to play:

```sh
npm run dev
```

Open **http://localhost:4173**. Click **Enter the nursery** to enable audio and enter five short, protected lessons. Press **Enter** to advance each completed lesson without moving the mouse. Skip or replay lessons from the pause menu. Headphones recommended. The development server binds to the local machine only; set `PORT` to change its port.

No runtime package installation, external requests, account, or backend is required. Fonts are bundled with their OFL licenses. The game is designed primarily for desktop mouse and keyboard; basic touch dragging and the on-screen pulse also work.

## Controls

| Input | Collective behaviour |
| --- | --- |
| Move mouse | Attract the collective toward your intent |
| WASD / arrow keys | Alternative directional movement |
| Hold left mouse | Coordinated bites; Tidal Fang instead sends one curling lash per click |
| Hold right mouse | Spread to forage; Forked Mind widens its two distinct lobes |
| Shift | Evade in a curling wake; overrides attack/spread, disables feeding and resonance |
| Space / on-screen Resonance | Counter the **white flash** late in a wind-up; 4-second cooldown, 28 energy |
| Tab / Escape / adaptation chips | Pause and inspect your adaptations, controls and unlock milestones |
| 1 / 2 / 3 | Choose an offered evolution |
| R, during evolution | Browse the other available adaptations |
| C, with Sister Broods | Absorb escorts for organisms and energy; they hatch again after 24 seconds |
| Enter, in the nursery | Advance a completed lesson |
| Escape, during evolution | Inspect your collective, then return to the choice |
| M | Toggle sound |

Golden nutrients are collected automatically by nearby individual cells. Each adds five organisms. A nursery requires 220, 500, or 900 organisms and four seconds spent within its field. Awakening one adds 130 organisms and draws hunters. All three awaken the leviathan. The Cathedral leviathan alternates a locked lunge with a pulling implosion. Its six articulated arms coil, reach toward a locked target, and recoil; their simulated joints also determine contact damage. Counter its white flash or evade, then commit to the exposed heart. Its fractures release reinforcements. A dedicated, faster score marks the encounter.

Evolution pauses the ecosystem automatically, one choice at a time, while the generative music continues. Six adaptations can coexist, chosen from nine instincts with R / 1 / 2 / 3. Each requires both nutrients and time in open water:

| Awakening | Nutrients | Earliest time |
| --- | ---: | ---: |
| 1 | 75 | 0:25 |
| 2 | 170 | 0:50 |
| 3 | 300 | 1:15 |
| 4 | 460 | 1:40 |
| 5 | 650 | 2:05 |
| 6 | 880 | 2:30 |

Choices are also separated by at least 22 seconds of active play, even when many nutrients are already stored. Paused time never advances maturation. The first choice cannot occur in the opening ten seconds. The HUD and pause journal show the next requirements. Ordinary predators grant 18 nutrients immediately when dissolved, in addition to physical food drops.

Capacity starts at **1,200**, rises by **600 per awakened nursery**, and is always shown below population. **Vast Chorus** adds 5,000 capacity, reaching **8,000** after three nurseries. Capacity creates room; feeding earns the organisms.

## Read the ecosystem

Amber outlines predict an attack. A brief white flash is the resonance counter window. Green cores are exposed. Red means the attack is happening. Health bars, actual damage numbers, deflection messages, and population gain/loss rates show the outcome.

- **Mantis hunters** flank, lock onto an outer cell, coil and snap their jaws through a visible charge corridor, then recover. They retreat when badly wounded. Their rear armour is weaker; Slipstream decoys can draw their charge away.
- **Siphon anemones** inhale, then erupt in an expanding ring. Compression resists the current but makes the eruption dangerous.
- **Prism urchins** launch eight radial spines, then retract their plates. Dodge between the spines or counter the late flash.
- **Veil rays** defend local feeding territories with a marked cone attack. Leave the cone and strike their open gills.
- **Glass grazers** flee predators and provide a nutrient cycle independent of the player.

A ready pulse displays its reach during a nearby wind-up. An early pulse is resisted. A timed counter creates a shorter opening than successfully evading the full attack, and the creature then resists further counters for ten seconds.

Bites land in discrete impacts with cell lunges, recoil, shards and percussive sound. Tidal Fang trades held bites for one committed, armour-piercing curl and lash per click. The swarm relaxes back into a cloud; holding does not repeat it. It rearms in 0.95 seconds, and evasion cancels it. Evasion is exclusive: it cannot be combined with attacks, spreading, feeding or resonance. Release Shift after exhaustion to reset the movement. Feed between encounters to rebuild losses.

## Adaptations

| Instinct | Behaviour |
| --- | --- |
| Helix Guard | Golden guard organisms drift around the changing collective, including both forked lobes. Deflects hunter charges for energy, with no drawn perimeter. |
| Forked Mind | Two individually simulated groups forage on opposite flanks and converge into pincer attacks. Occupying both flanks helps break armour. |
| Tidal Fang | One curling ribbon of organisms per click, positional damage and fluid recoil. Forked Mind sends two curls. |
| Storm Choir | A wider electrical counter pulse with stronger discharges. |
| Velvet Cilia | Feeding filaments draw nearby nutrients toward cells. |
| Echo Brood | Lost cells return gradually: three births per five casualties. |
| Slipstream | A faster violet escape current sheds visible ghost colonies. Hunters can be fooled before their white flash; DECOY TAKEN confirms a locked decoy. |
| Sister Broods | Two 32-cell escort colonies independently engage exposed enemies. C absorbs them into the main swarm; they regrow after 24 seconds. |
| Vast Chorus | Adds 5,000 capacity for a late collective of up to 8,000 organisms. |

## Rebuild the WebAssembly

Install a current Rust toolchain (tested with Rust 1.98.1), then:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.128 --locked
npm run build
```

`Cargo.lock` pins the dependency tree. The `wasm-bindgen` CLI version must match the Rust crate. Bevy ECS is pinned by the lockfile to 0.19.1. The compiled module is included in `web/pkg/`; rebuilding keeps it aligned with the source.

The output is `web/`, ready for any static HTTP host. All paths are relative, including the WASM module and fonts, so a subdirectory deployment works. Serve `.wasm` as `application/wasm`. No cross-origin isolation, workers, WebGPU, or special application server is required. Use HTTP locally rather than opening `index.html` with `file://`.

```sh
npm run package
```

This creates `dist/swarmkeeper-web.zip` with the contents of the static build at its root. Extract it to a static web host's public directory. The GitHub Actions workflow also builds and publishes this directory automatically after every passing push to `main`.

## Continuous integration and deployment

[The workflow](.github/workflows/pages.yml) runs on pull requests and pushes to `main`. It installs Rust 1.98.1 and the matching WASM bindings generator, checks formatting and Clippy, runs all native tests and a complete scripted survival run, rebuilds the static game, and tests it in Chromium. The browser test earns the first evolution through feeding and checks that musical beats continue while simulation time is frozen, then checks journal pause and resume.

Only passing `main` builds deploy to GitHub Pages. The deployment job has separate, minimal Pages permissions. GitHub Actions are pinned to commit SHAs; Rust dependencies and browser tooling are locked. No deployment token or server is needed. For a fork, enable **Settings → Pages → Source → GitHub Actions**, then run the workflow or push to `main`.

## Architecture

- **`src/lib.rs`** — Authoritative Bevy ECS world. Each cell, nutrient, and creature is an entity. A fixed 60 Hz update integrates player attraction, bounded local separation and alignment, soft pressure, changing eddies and biological currents, avoidance, feeding, predation, combat, and evolution. Seeded randomness makes the same input stream reproducible.
- **`web/renderer.js`** — Custom WebGL 2 renderer. Instanced quads carry analytic, animated organism shaders. Faceted polyps, jellyfish, articulated hunters, siphon anemones, prism urchins, veil rays, nursery flowers, glow, and the six-armed leviathan are evaluated from mathematics. CPU-generated line geometry adds swaying sea fans, shockwaves, and electrical arcs. A procedural noise field supplies the water and currents. No image textures or sprite atlases are used.
- **`web/feedback.js`** — Simulation-derived attack telegraphs, nearby creature health and tactics, damage numbers, growth/loss feedback, guard impact feedback, and contextual resonance reach.
- **`web/audio.js`** — Sample-free synthesis. Population adds musical layers, movement changes the water texture, and danger introduces a heartbeat. Oscillator envelopes and filtered synthesized noise give feeding, bites, curling lashes, ghost colonies, evasion, losses, automatic awakenings and encounters distinct voices. The leviathan replaces the ambient score with a 146 BPM bass ostinato, percussion and counterpoint. A seeded stereo convolution impulse and tempo-synced delay create space. Audio begins after a user gesture. Music keeps scheduling during evolution choices; the pause journal and hidden browser tab suspend it.
- **`web/main.js`** — Browser intent, camera, accessible HTML HUD, evolution choices, minimap, event presentation, and lifecycle management. Gameplay authority stays in Rust.

Attacker neighbourhoods are counted only on impact ticks; guard outline work runs only with Helix Guard. Creature telegraphs use fresh frame snapshots. The simulation reuses a dense 22-unit spatial grid, clears only touched buckets, bounds neighbour samples, and culls distant threats before cell-level checks, avoiding all-pairs flocking and per-tick bucket allocation. The renderer batches organisms in one instanced draw, culls off-screen geometry, caps decorative particles, and caps pixel density at 1.5. The hard population limit is 8,000, with capacity unlocked during the run. A frame uses eight floats per drawable instance, borrowed directly from WASM memory without copying the snapshot. Reusable GPU buffers, direct instance writes, and shader interpolation reduce allocation and smooth the fixed simulation step. The fixed-step accumulator limits catch-up work; losing focus pauses the run.

## Verification

```sh
npm test                                  # Native simulation regression tests
cargo run --release --example run_check    # Full deterministic run through victory
npm run check                             # JavaScript syntax
cargo fmt --check                         # Rust formatting
npm ci                                    # Install formatter and browser tests
npm run format:check                      # Authored frontend formatting
npx playwright install chromium
npm run test:browser                      # Real browser startup, evolution audio, pause/resume
```

The automated player in `examples/run_check.rs` uses the same public simulation API as the browser. It earns its population by feeding, chooses evolutions, activates all nurseries, attacks the leviathan, and asserts victory. It does not grant itself cells or skip encounter states. Its precise knowledge and immediate decisions make it substantially faster than human play.

For the extended browser QA route, `scripts/browser-playtest.js` supports `swarmPlaytestExplore = true` (learn six instincts first) and `swarmPlaytestFight = true` (complete the boss).

For browser profiling, open `/?debug`. `window.swarmkeeper` exposes snapshots (`stats`, `frame`, `nodes`, `creatures`, `lesson`, `combat`, `path`), rolling timing (`metrics`), audio state and output RMS (`audio`), and explicit QA helpers (`target`, `intent`, `grow`, `adapt`, `encounter`, `absorb`, `start`, `pause`, `choose`, `pulse`, `lash`). Population grants and adaptation/encounter helpers are only for explicitly isolated QA runs. The helpers are absent from normal URLs. Reload to discard a QA run.

See [REVIEW.md](REVIEW.md) for the final engineering/design review and [VALIDATION.md](VALIDATION.md) for measured verification.

## Scope

This is a compact, complete survival run with a fresh procedural ecosystem on restart. It includes a win state and extinction state. There is no persistence, multiplayer, controller mapping, or native desktop renderer. Local macOS development uses the browser target and native Rust tests.

Code is MIT licensed. The two bundled typefaces retain their included SIL Open Font Licenses. Every in-game visual and all audio are generated by project code at runtime.
