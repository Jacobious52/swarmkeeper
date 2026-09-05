# Final demo review

Reviewed the Rust simulation and tests, browser input/lifecycle/UI, procedural shaders and geometry, synthesized audio, feedback/telegraphs, and build/serve/playtest scripts on 5 September 2026. This pass keeps the compact nursery-to-leviathan run.

## Highest-impact findings and changes

1. **A permanent triangle fought the swarm fantasy.** The old lance repeatedly imposed exact geometry and delivered periodic thrusts while held. Tidal Fang now releases a travelling curl through individual organisms on each click, delivers one positional impact, then relaxes. Aim is committed for the short gesture; evasion cancels it. Forked Mind contributes two curls. This keeps the simulation expressive without making an attack depend on holding a geometric formation.
2. **Slipstream had no legible cause and effect.** Small rings resembled ordinary decoration and could only distract a hunter when it started a new attack. It now accelerates the escape current, changes the collective to violet, and sheds visible colonies made from sampled cell positions. Hunters can take the bait during the early wind-up, then commit to that position. Distinct sounds and DECOY TAKEN feedback confirm success. Shed too late and the existing charge stays committed.
3. **Progression rewarded menu backlog.** The old three nutrient thresholds could all become ready quickly, yet required the player to notice a prompt. There are now six choices from nine instincts. Every choice pauses the ecosystem automatically, after both feeding and maturation requirements. The first cannot occur before 25 simulated seconds; later choices are separated by at least 22 seconds. Future milestones remain visible in the journal. This is a small, readable progression track rather than a large prerequisite tree grafted onto a short demo.
4. **Learned abilities disappeared into symbols.** Tab, Escape, the HUD inspection button and adaptation chips open a field journal. It records descriptions, controls, limitations, combinations, population capacity and the six unlock milestones. The journal is also accessible while choosing an evolution.
5. **Timing feedback lagged authoritative state.** Creature telegraphs formerly shared the 120 ms HUD refresh. They now receive a fresh snapshot each rendered simulation frame. Braced enemies are labelled as such beside their bodies, rather than being described as awaiting a counter flash.
6. **Combat was an avoidable expense in a food race.** Dissolving an ordinary predator now grants 18 nutrients immediately, alongside its physical food drops. Hunting contributes to the same progression goals as exploration.
7. **Expensive work ran when it could have no effect.** Attacker neighbourhoods are counted only on impact ticks. Guard outlines are calculated only when the guard is present. Creature/escort scratch buffers are reused, nutrient broad-phase checks avoid square roots, and small-cell draw quads cover less empty space. Buffer writes also check capacity. Existing fixed steps, bounded local flocking, instance batching and distant-threat culling remain in place.

## Fluidity and publishing follow-up

The settled circle and straight evasive rectangle came from assigning every cell a fixed geometric slot. The neutral and foraging collective now emerge from soft density pressure, changing eddies, local separation and alignment, with damped shared momentum. Forked Mind keeps two cooperating centres, but their offsets breathe and their organisms are not attached to an outline. Guard cells drift through the outer collective. Escorts use the same principle on a smaller scale.

Evasion follows a short history of the actual movement path. Organisms flow through its bends with varying width and curl, instead of rotating a rectangle when the cursor turns. This retains the attack/feeding lockout and Slipstream's speed and decoy differences. The persistent guard polygons and decoy rings were removed; individual golden organisms, violet ghost cells and impact effects communicate those adaptations.

Upgrade selection now freezes the ecosystem while continuing the music scheduler. The journal still deliberately pauses audio. A real browser regression checks that musical beats and audio time advance during the choice while simulation time does not. The project now includes CI for native checks, a full survival route, the browser regression, and publication of successful `main` builds to GitHub Pages.

## Design decisions for the next phase

- Preserve the short, complete demo. A full game needs distinct regions and encounter objectives before more ability count, menu complexity or longer travel distances.
- Build diversity still needs human testing. An automated player can prove that routes are winnable, but its perfect perception overvalues timed counters and precise attack placement. Human playtests should compare survival, recovery time and enjoyment across different instinct combinations.
- The swarm remains the health pool. Permanent loss, food recovery, a clear capacity limit and visible individual feeding/attack/death motion reinforce that identity.
- A larger evolution tree should introduce mutually meaningful paths and new encounter problems. The current six-choice track deliberately leaves three instincts unchosen each run, retaining decisions without extending the demo into a grind.
- The current engine is single-threaded Bevy ECS plus an instanced WebGL 2 renderer. More biomes and creatures should be added with measured budgets; there is no need to replace that architecture to extend this demo.

See VALIDATION.md for measured results and the limits of automated/browser testing.
