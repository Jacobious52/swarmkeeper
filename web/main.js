import init, { Swarm } from "./pkg/swarmkeeper.js";
import { Renderer } from "./renderer.js";
import { Feedback, SPECIES, stateName } from "./feedback.js";
import { EcosystemAudio } from "./audio.js";
const $ = (id) => document.getElementById(id),
  show = (id) => $(id).classList.remove("hidden"),
  hide = (id) => $(id).classList.add("hidden");
const audio = new EcosystemAudio();
const feedback = new Feedback();
let wasm,
  creatures = new Float32Array(),
  isTraining = false,
  lessonData = [0, 0, 150, 0],
  lastFeed = 0,
  feedCount = 0;
const lessons = [
  {
    title: "You are the current.",
    copy: "Your cursor is an invitation. Move it toward the diamond and watch the collective follow. You can also use WASD.",
    task: "Guide the swarm into the beacon.",
  },
  {
    title: "Open out. Gather life.",
    copy: "Hold RIGHT MOUSE to spread. You move faster and cover more nutrients, but cannot attack. Golden blooms become new organisms.",
    task: "Hold right mouse and absorb 8 golden nutrients.",
  },
  {
    title: "Close ranks. Strike.",
    copy: "Hold LEFT MOUSE over the open green husk. Compression concentrates your attack, but slows you down and makes area attacks dangerous.",
    task: "Compress over the practice husk until it breaks.",
  },
  {
    title: "Read the warning.",
    copy: "Amber means prepare. Wait for the white flash, then press SPACE inside resonance reach. Too early, and the enemy resists. Green opens only briefly.",
    task: "Counter the white flash with Space.",
  },
  {
    title: "Know when to leave.",
    copy: "Hold SHIFT to pour into a fast, curling wake. Evasion overrides attack and spreading; you cannot strike, feed or resonate until you release Shift.",
    task: "Hold Shift and move for one second.",
  },
  {
    title: "A single will. Many choices.",
    copy: "Bait amber. Counter the white flash or evade. Bite during the green opening. Feed between fights. Six instincts awaken automatically as you feed and mature. Press Tab at any time to inspect your adaptations.",
    task: "Your collective is ready for open water.",
  },
];
function readFrame(prepare = true) {
  if (prepare) sim.prepare_render();
  return new Float32Array(wasm.memory.buffer, sim.frame_ptr(), sim.frame_len());
}
function nextLesson() {
  if (lessonData[0] === 5) {
    start(false);
    return;
  }
  if (sim.advance_lesson()) {
    mouse.active = false;
    mode = 0;
    keys.clear();
    audio.feed();
    updateHUD();
  }
}
function updateLesson() {
  lessonData = sim.lesson_data();
  const n = lessonData[0],
    l = lessons[n];
  $("lesson-step").textContent =
    n === 5
      ? "PROTECTED NURSERY · COMPLETE"
      : `PROTECTED NURSERY · ${n + 1} / 05`;
  $("lesson-title").textContent = l.title;
  $("lesson-copy").textContent = l.copy;
  $("lesson-task").textContent =
    lessonData[1] >= 1 ? "Learned. Press Enter to continue." : l.task;
  $("lesson-fill").style.width = `${n === 5 ? 100 : lessonData[1] * 100}%`;
  $("lesson-next").disabled = n < 5 && lessonData[1] < 1;
  $("lesson-next").textContent =
    n === 5
      ? "ENTER OPEN WATER · ENTER ↵"
      : lessonData[1] >= 1
        ? "CONTINUE · ENTER ↵"
        : "TRY IT IN THE NURSERY";
}

const traits = [
  {
    name: "Helix Guard",
    symbol: "◎",
    type: "DEFENSIVE SYMBIOSIS",
    desc: "Golden guard organisms drift through the outer collective, including both lobes. They deflect charging hunters for 8 energy and soften incoming damage.",
    control: "PASSIVE · A LIVING PERIMETER",
  },
  {
    name: "Forked Mind",
    symbol: "⋔",
    type: "COLLECTIVE INTELLIGENCE",
    desc: "Two distinct collectives share one instinct. They forage on opposite flanks and converge from both sides to bite exposed enemies.",
    control: "RMB · WIDEN / LMB · PINCER",
  },
  {
    name: "Storm Choir",
    symbol: "ϟ",
    type: "BIOELECTRIC RESONANCE",
    desc: "Turn your pulse into an electrical storm. Violet cells conduct a powerful discharge through nearby predators.",
    control: "SPACE · CHAIN DISCHARGE",
  },
  {
    name: "Velvet Cilia",
    symbol: "≋",
    type: "SENSORY ADAPTATION",
    desc: "Every organism grows feeding filaments. Nutrients flow toward your swarm before you even touch them.",
    control: "PASSIVE · DRAW LIFE CLOSER",
  },
  {
    name: "Echo Brood",
    symbol: "❋",
    type: "REGENERATIVE MEMORY",
    desc: "The collective remembers its lost. For every five organisms consumed, three are born again within the swarm.",
    control: "PASSIVE · LIFE FROM LOSS",
  },
  {
    name: "Tidal Fang",
    symbol: "⟡",
    type: "PREDATORY MORPHOLOGY",
    desc: "Click to send a curling ribbon of organisms through your aim, then recoil into a living cloud. Each click is one committed lash. Forked Mind sends two fangs.",
    control: "CLICK LMB · LASH / RELEASE · REARM",
  },
  {
    name: "Slipstream",
    symbol: "⤳",
    type: "EVASIVE MIMICRY",
    desc: "Shift becomes a faster violet current and sheds ghost colonies. Use it while a hunter prepares: it may lock onto your shed colony instead. DECOY TAKEN confirms the trick.",
    control: "SHIFT · FASTER CURRENT + DECOYS",
  },
  {
    name: "Sister Broods",
    symbol: "⁙",
    type: "INDEPENDENT SYMBIONTS",
    desc: "Two small colonies escort you and independently bite exposed enemies. Absorb them for organisms and energy; new escorts hatch after 24 seconds.",
    control: "PASSIVE · ESCORTS / C · ABSORB",
  },
  {
    name: "Vast Chorus",
    symbol: "∞",
    type: "COLLECTIVE EXPANSION",
    desc: "Make room for a colossal collective. Gain 5,000 capacity, reaching 8,000 organisms after the three nurseries awaken. Feed to fill the new space.",
    control: "PASSIVE · +5,000 CAPACITY",
  },
];
const branches = [
  "SURVIVAL",
  "MORPHOLOGY",
  "REFLEX",
  "SURVIVAL",
  "SURVIVAL",
  "MORPHOLOGY",
  "REFLEX",
  "SURVIVAL",
  "MORPHOLOGY",
];
const tradeoffs = [
  "Deflection spends energy you also need for evasion and resonance.",
  "Two flanks cover more ground; bring both sides into contact to pierce armour.",
  "Still needs the white-flash timing. Braced enemies resist interruption.",
  "Feeding reach improves; evading still prevents collection.",
  "Regrowth is gradual. Three return for every five lost; extinction is final.",
  "One strike per click; 0.95 s to rearm. Evading cancels the lash.",
  "Shed early in a hunter’s warning. Its white flash means its aim is committed.",
  "Absorption restores energy and organisms, but leaves you without escorts for 24 s.",
  "Capacity only. Explore and feed to grow into the new space.",
];
let evolutionPath = [],
  pauseReturn = "playing",
  evolutionOpenedAt = 0;
let renderer,
  sim,
  frame = new Float32Array(),
  stats = [],
  state = "intro",
  camera = { x: 0, y: 0 },
  zoom = 1,
  mouse = { x: innerWidth * 0.5, y: innerHeight * 0.5, active: false },
  keys = new Set(),
  mode = 0,
  prevTime = 0,
  elapsed = 0,
  accumulator = 0,
  hudClock = 0,
  toastUntil = 0,
  offered = [],
  choicePage = 0,
  selected = [],
  shake = 0,
  frameTimes = [],
  simTimes = [],
  soundWanted = true,
  holdTarget = null;
let overlay = $("overlay"),
  ctx = overlay.getContext("2d");
function resize() {
  renderer?.resize();
  overlay.width = Math.round(innerWidth * Math.min(devicePixelRatio || 1, 1.5));
  overlay.height = Math.round(
    innerHeight * Math.min(devicePixelRatio || 1, 1.5),
  );
  ctx.setTransform(
    overlay.width / innerWidth,
    0,
    0,
    overlay.height / innerHeight,
    0,
    0,
  );
}
function toast(message, duration = 5) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  toastUntil = performance.now() + duration * 1000;
}
async function enableAudio() {
  try {
    await audio.start();
    $("sound-label").textContent = "SOUND ON";
    $("sound").setAttribute("aria-label", "Mute sound");
  } catch (e) {
    toast("Audio unavailable. The ecosystem is still alive.");
    console.warn(e);
  }
}
function start(training = false) {
  sim?.free();
  isTraining = training;
  const seed = (Date.now() % 4294967295) >>> 0;
  sim = training ? Swarm.training(seed) : new Swarm(seed, false);
  document.body.classList.toggle("training", training);
  if (training) show("lesson-panel");
  else hide("lesson-panel");
  feedback.reset();
  feedCount = 0;
  state = "playing";
  camera = { x: 0, y: 0 };
  zoom = 1;
  keys.clear();
  mode = 0;
  mouse.active = false;
  selected = [];
  offered = [];
  holdTarget = null;
  accumulator = 0;
  elapsed = 0;
  renderer.particles = [];
  renderer.rings = [];
  renderer.bolts = [];
  hide("intro");
  hide("end");
  hide("pause-modal");
  hide("evolution");
  show("hud");
  show("pause");
  document.body.classList.add("playing");
  $("trait-chips").replaceChildren();
  $("spread-label").textContent = "SPREAD";
  $("pulse-label").textContent = "RESONANCE";
  stats = sim.stats();
  evolutionPath = sim.evolution_path();
  frame = readFrame();
  updateHUD();
  if (soundWanted) enableAudio();
  toast(
    training
      ? "A protected space. Take your time; nothing here can harm you."
      : "Open water. Bait amber. Counter white. Evade red. Bite green.",
    6,
  );
}
function renderJournal() {
  stats = sim.stats();
  evolutionPath = sim.evolution_path();
  selected = traits.map((_, i) => i).filter((i) => stats[8] & (1 << i));
  $("journal-summary").textContent =
    `${selected.length} ${selected.length === 1 ? "adaptation" : "adaptations"} · ${Math.round(stats[0]).toLocaleString()} / ${stats[19].toLocaleString()} organisms · ${stats[9]} / 3 nurseries`;
  $("journal-path").innerHTML = Array.from({ length: 6 }, (_, i) => {
    const done = i < stats[7],
      next = i === stats[7];
    return `<div class="path-node ${done ? "complete" : next ? "next" : ""}"><b>${done ? "✓" : String(i + 1).padStart(2, "0")}</b><span>${done ? "AWAKENED" : `${evolutionPath[i * 2]} NUTRIENTS`}</span><small>${done ? "" : `FROM ${formatTime(evolutionPath[i * 2 + 1])}`}</small></div>`;
  }).join("");
  $("journal-next").textContent = isTraining
    ? "Protected nursery · Finish learning to begin progression in open water."
    : evolutionGoal();
  $("journal-owned").innerHTML = selected.length
    ? selected
        .map((i) => {
          const t = traits[i];
          return `<article class="journal-card"><div class="eyebrow">${t.symbol} &nbsp; ${branches[i]}</div><h3>${t.name}</h3><p>${t.desc}</p><div class="card-control">${t.control}</div><small>${tradeoffs[i]}</small></article>`;
        })
        .join("")
    : '<p class="journal-empty">Your collective is still learning. Feed and explore; the first choice arrives after 25 seconds and 75 nutrients. The ecosystem pauses for each choice.</p>';
  $("journal-available").innerHTML = traits
    .map(
      (t, i) =>
        `<span class="${selected.includes(i) ? "owned" : ""}">${selected.includes(i) ? "✓" : t.symbol} ${t.name}</span>`,
    )
    .join("");
  $("journal-synergy").textContent =
    selected.includes(1) && selected.includes(5)
      ? "SHARED INSTINCT · Forked Mind sends two curling fangs. Helix Guard, if learned, protects both shifting lobes."
      : selected.includes(6)
        ? "TRY THIS · Shed a ghost while a mantis winds up, escape sideways, then return to its exposed body."
        : "Six choices can coexist. Mix morphology, survival and reflex instincts to shape this life.";
}
function evolutionGoal() {
  const tier = stats[7];
  if (tier >= 6)
    return "Six instincts awakened. Your collective is complete for this life.";
  const food = Math.max(0, evolutionPath[tier * 2] - stats[1]);
  const wait = Math.max(0, Math.ceil(evolutionPath[tier * 2 + 1] - stats[6]));
  return `NEXT AWAKENING ${tier + 1} / 6 · ${food ? `${food} more nutrients` : "Nutrients gathered"}${wait ? ` · Mature for ${wait}s` : ""} · Opens automatically`;
}
function pause() {
  if (state === "playing" || state === "evolution") {
    pauseReturn = state;
    if (state === "evolution") hide("evolution");
    state = "paused";
    mode = 0;
    keys.clear();
    renderJournal();
    show("pause-modal");
    audio.suspend();
    $("resume").focus();
  } else if (state === "paused") {
    state = pauseReturn;
    hide("pause-modal");
    mouse.active = false;
    if (state === "evolution") show("evolution");
    audio.resume();
  }
}
function pulse() {
  if (state !== "playing" || stats[18] === 3 || keys.has("shift")) return;
  if (sim.pulse()) {
    processEvents(sim.events());
    const s = sim.stats();
    const storm = (s[8] & 4) !== 0;
    renderer.ring(s[4], s[5], storm ? 3 : 0, storm ? 430 : 300);
    renderer.burst(s[4], s[5], 70, storm ? 3 : 0, 220);
    if (storm)
      for (let i = 0; i < frame.length; i += 8) {
        if (
          ((frame[i + 4] >= 3 && frame[i + 4] <= 5) ||
            frame[i + 4] === 9 ||
            frame[i + 4] === 10) &&
          Math.hypot(frame[i] - s[4], frame[i + 1] - s[5]) < 430
        )
          renderer.bolt(s[4], s[5], frame[i], frame[i + 1]);
      }
    audio.pulse(storm);
    shake = 5;
  } else if (stats[3] <= 0 && stats[2] < 28)
    toast("Resonance needs 28 vital energy.", 2);
}
function evolve(cycle = false) {
  if (
    (state !== "playing" && !(cycle && state === "evolution")) ||
    isTraining ||
    !sim.evolution_ready()
  )
    return;
  choicePage = cycle ? choicePage + 1 : 0;
  state = "evolution";
  mode = 0;
  keys.clear();
  if (!cycle) {
    evolutionOpenedAt = performance.now();
    accumulator = 0;
    audio.ready();
    audio.resume();
  }
  const tier = stats[7];
  $("evolution-step").textContent =
    `AWAKENING ${tier + 1} / 6 · THE ECOSYSTEM IS STILL`;
  $("evolution-subtitle").textContent =
    `Choose one instinct for this life. ${6 - tier - 1} further ${6 - tier - 1 === 1 ? "awakening remains" : "awakenings remain"}.`;
  $("evolution-earned").textContent = selected.length
    ? `YOUR COLLECTIVE · ${selected.map((i) => traits[i].name).join(" · ")}`
    : "THE FIRST CHOICE · Shape how your collective lives";
  const preferred = tier === 0 ? [0, 1, 5] : tier === 1 ? [2, 6, 7] : [8, 3, 4];
  const pool = [...new Set([...preferred, ...traits.map((_, i) => i)])].filter(
    (i) => !selected.includes(i),
  );
  const page = choicePage % Math.ceil(pool.length / 3);
  offered = Array.from(
    { length: 3 },
    (_, i) => pool[(page * 3 + i) % pool.length],
  );
  if (offered.length < 3)
    offered.push(
      ...traits
        .map((_, i) => i)
        .filter((i) => !offered.includes(i) && !selected.includes(i))
        .slice(0, 3 - offered.length),
    );
  $("choices").replaceChildren();
  offered.forEach((id, index) => {
    let t = traits[id],
      button = document.createElement("button");
    button.className = "evolution-card";
    button.innerHTML = `<kbd>${index + 1}</kbd><span class="symbol">${t.symbol}</span><span class="card-type">${t.type}</span><h3>${t.name}</h3><p>${t.desc}</p><div class="card-control">${t.control}</div>`;
    button.onclick = () => choose(index);
    $("choices").append(button);
  });
  show("evolution");
  $("choices").firstChild.focus();
}
function choose(index) {
  if (
    state !== "evolution" ||
    offered[index] === undefined ||
    performance.now() - evolutionOpenedAt < 400
  )
    return;
  let id = offered[index];
  if (sim.evolve(id)) {
    selected.push(id);
    stats = sim.stats();
    evolutionPath = sim.evolution_path();
    state = "playing";
    hide("evolution");
    hide("evolve-prompt");
    audio.resume();
    audio.evolve();
    renderer.ring(stats[4], stats[5], id === 2 ? 3 : 0, 330);
    renderer.burst(stats[4], stats[5], 110, id === 2 ? 3 : 0, 160);
    $("trait-chips").innerHTML = selected
      .map(
        (i) =>
          `<button title="${traits[i].name} · inspect with Tab" aria-label="Inspect ${traits[i].name}">${traits[i].symbol}</button>`,
      )
      .join("");
    if (id === 1) $("spread-label").textContent = "DIVIDE";
    if (id === 2) $("pulse-label").textContent = "STORM CHOIR";
    updateHUD();
    mouse.active = false;
    toast(`${traits[id].name} — the collective has changed.`, 5);
  }
}
function finish(won) {
  state = "ended";
  hide("evolution");
  hide("evolve-prompt");
  show("end");
  $("end-kicker").textContent = won
    ? "THE DEEP REMEMBERS YOU"
    : "THE CYCLE CONTINUES";
  $("end-title").innerHTML = won
    ? "A new kind<br>of life."
    : "Nothing living<br>is ever lost.";
  $("end-copy").textContent = won
    ? `Three nurseries awakened. The leviathan quieted. ${Math.round(stats[0]).toLocaleString()} organisms, one extraordinary life. Your ecosystem is reborn.`
    : `Your collective lived for ${formatTime(stats[6])}, absorbed ${stats[1]} nutrients, and awakened ${stats[9]} nurseries. Every life is a new possibility.`;
  if (won) audio.evolve();
  else audio.encounter();
}
function formatTime(s) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
}
function updateHUD() {
  if (!stats.length) return;
  creatures = sim.creature_data();
  if (isTraining) updateLesson();
  const active = stats[18],
    lance = (stats[8] & 32) !== 0,
    fork = (stats[8] & 2) !== 0;
  const formation =
    active === 3
      ? stats[8] & 64
        ? "SLIPSTREAM"
        : "EVADING"
      : lance && stats[25] >= 0
        ? stats[25] < 0.2
          ? "FANG · CURL"
          : stats[25] < 0.43
            ? "FANG · LASH"
            : "FANG · RECOIL"
        : active === 1
          ? fork
            ? "TWIN PINCER"
            : "BITING"
          : active === 2
            ? fork
              ? "TWIN FORAGERS"
              : "SPREAD"
            : fork
              ? "TWIN MINDS"
              : "FLOW";
  $("formation-name").textContent =
    stats[24] && keys.has("shift") ? "RECOVERING" : formation;
  $("attack-label").textContent = lance ? "CLICK · TIDAL FANG" : "HOLD · BITE";
  $("formation-detail").textContent =
    active === 3
      ? stats[8] & 64
        ? `${stats[27]} ghost colonies · shed before the hunter commits`
        : "Fast escape · no strikes, foraging or resonance"
      : lance
        ? stats[26] > 0
          ? `Reforming · ${stats[26].toFixed(1)}s · each click sends one lash`
          : "Fang ready · click to curl, lash and recoil"
        : active === 1
          ? "Short, coordinated bites · vulnerable during attacks"
          : active === 2
            ? "Wide foraging · no attacks"
            : "Bait amber · counter white · strike green";
  $("formation-name").style.color =
    active === 3 ? "#8accff" : active === 1 ? "#efd091" : "#a5f2cc";
  $("capacity-number").textContent =
    `/ ${Math.round(stats[19]).toLocaleString()} capacity`;
  $("capacity-fill").style.width =
    `${Math.min(100, (stats[0] / stats[19]) * 100)}%`;
  $("capacity-note").textContent =
    stats[0] >= stats[19]
      ? "CAPACITY REACHED · awaken / evolve to expand"
      : stats[8] & 256
        ? "VAST CHORUS · ROOM FOR A COLOSSUS"
        : "+600 per nursery · Vast Chorus unlocks 8,000";
  if (stats[8] & 128) {
    show("symbiosis");
    $("absorb").textContent =
      stats[22] > 0
        ? `C · ABSORB ${stats[22]} ESCORTS`
        : `BROODS HATCH IN ${Math.ceil(stats[23])}S`;
    $("absorb").disabled = stats[22] === 0 || active === 3;
  } else hide("symbiosis");
  $("growth-rate").textContent =
    stats[16] > 1 ? `+${Math.round(stats[16])} organisms / sec` : "";
  $("loss-rate").textContent =
    stats[15] > 0.5 ? `LOSING ${Math.round(stats[15])} organisms / sec` : "";
  $("damage-rate").textContent =
    stats[14] > 1 ? `DEALING ${Math.round(stats[14])} damage / sec` : "";
  const target = feedback.target;
  if (target) {
    show("target-panel");
    const kind = target[2],
      st = target[4];
    $("target-name").textContent =
      isTraining && lessonData[0] === 2 ? "Practice husk" : SPECIES[kind].name;
    $("target-state").textContent = stateName(
      kind,
      st,
      target[9],
      target[8],
      target[7],
    );
    $("target-state").style.color =
      st === 3
        ? "#a3edc9"
        : st === 2
          ? "#ff9b91"
          : target[8]
            ? "#fffddd"
            : "#ecc48a";
    $("target-fill").style.width = `${Math.max(0, target[3]) * 100}%`;
    $("target-fill").style.background = st === 3 ? "#a3edc9" : "#ecc48a";
    $("target-health").textContent =
      `${Math.max(0, Math.round(target[3] * target[11]))} / ${Math.round(target[11])} VITALITY`;
    $("target-tip").textContent = SPECIES[kind].tip;
  } else hide("target-panel");
  $("population").textContent = Math.round(stats[0]).toLocaleString();
  const tier = stats[7];
  evolutionPath = sim.evolution_path();
  const high = evolutionPath[tier * 2] || 1;
  const at = evolutionPath[tier * 2 + 1] || 1;
  $("growth-fill").style.width =
    `${tier >= 6 ? 100 : Math.min(100, (stats[1] / high) * 100, (stats[6] / at) * 100)}%`;
  $("stage-label").textContent = `ADAPTATIONS ${tier} / 6`;
  $("evolution-progress").textContent =
    tier >= 6 ? "COMPLETE" : `${Math.min(stats[1], high)} / ${high}`;
  $("next-evolution").textContent = evolutionGoal();
  $("energy-fill").style.width = `${stats[2]}%`;
  $("pulse-fill").style.width = `${100 - (stats[3] / 4) * 100}%`;
  $("pulse").classList.toggle("unready", stats[3] > 0 || stats[2] < 28);
  $("pulse").title =
    stats[3] > 0 ? `Ready in ${stats[3].toFixed(1)}s` : "Resonance · Space";
  $("timer").textContent = formatTime(stats[6]);
  const biome =
    stats[5] < -450
      ? "THE VIOLET VEIL"
      : stats[4] > 700 && stats[5] > 200
        ? "THE EMBER GARDEN"
        : "THE LUMINOUS SHALLOWS";
  $("biome-name").textContent = isTraining ? "THE PROTECTED NURSERY" : biome;
  $("map-label").textContent = biome.replace("THE ", "");
  $("depth").textContent = `DEPTH ${Math.round(
    240 + Math.hypot(stats[4], stats[5]) * 0.22,
  )
    .toString()
    .padStart(4, "0")} M`;
  let title, detail, kicker;
  const nodes = sim.nursery_data();
  const ni = nextNursery(nodes);
  const nearest =
    ni < 0
      ? null
      : {
          x: nodes[ni],
          y: nodes[ni + 1],
          need: nodes[ni + 2],
          charge: nodes[ni + 3],
          distance: Math.hypot(nodes[ni] - stats[4], nodes[ni + 1] - stats[5]),
        };
  let boss = null;
  for (let i = 0; i < creatures.length; i += 12)
    if (creatures[i + 2] === 3) {
      boss = creatures.subarray(i, i + 12);
      break;
    }
  if (boss) {
    show("boss-health");
    $("boss-fill").style.width = `${Math.max(0, boss[3]) * 100}%`;
    $("boss-state").textContent = stateName(
      3,
      boss[4],
      boss[9],
      boss[8],
      boss[7],
    );
  } else hide("boss-health");
  if (stats[13]) {
    kicker = "FINAL INSTINCT / BECOME";
    title = "Break the Cathedral’s heart";
    detail = "Counter white flashes. Evade tendrils. Strike the green core.";
  } else if (stats[0] < 220 && stats[9] === 0) {
    kicker = "INSTINCT 01 / FEED";
    title = "Find the golden blooms";
    detail = "Grow to 220 organisms to awaken a nursery.";
  } else if (nearest) {
    kicker = `INSTINCT 0${Math.min(stats[9] + 2, 4)} / AWAKEN`;
    if (stats[0] < nearest.need) {
      title = `Grow to ${nearest.need} organisms`;
      detail = "Golden nutrients sustain the next nursery.";
    } else if (nearest.distance < 120) {
      title = "A new life is taking root";
      detail = `Stay close · ${Math.round(nearest.charge * 100)}% awakened`;
    } else {
      title = "Breathe life into a nursery";
      detail = "Follow the diamond. Gather close to awaken it.";
    }
  }
  $("objective-kicker").textContent = kicker;
  $("objective-title").textContent = title;
  $("objective-detail").textContent = detail;
  $("nursery-count").textContent = `${stats[9]} / 3 NURSERIES AWAKENED`;
  document
    .querySelectorAll(".nursery-dots i")
    .forEach((e, i) => e.classList.toggle("active", nodes[i * 5 + 4] === 1));
  hide("evolve-prompt");
}
function nextNursery(nodes) {
  let best = -1,
    score = Infinity;
  for (let i = 0; i < nodes.length; i += 5) {
    if (nodes[i + 4]) continue;
    const d =
      Math.hypot(nodes[i] - stats[4], nodes[i + 1] - stats[5]) +
      (nodes[i + 2] > stats[0] ? 100000 + nodes[i + 2] * 10 : 0);
    if (d < score) {
      score = d;
      best = i;
    }
  }
  return best;
}
let drawDt = 0;
function drawOverlay(time) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const screen = (x, y) => [
    (x - camera.x) * zoom + innerWidth / 2,
    (y - camera.y) * zoom + innerHeight / 2,
  ];
  if (state === "intro") {
    const [x, y] = screen(stats[4], stats[5]);
    ctx.strokeStyle = "#94cfb51a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 195 * zoom, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 60; i++) {
      let a = (i / 60) * Math.PI * 2,
        r = 195 * zoom;
      ctx.strokeStyle = i % 5 === 0 ? "#94cfb544" : "#94cfb518";
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(
        x + Math.cos(a) * (r + (i % 5 === 0 ? 7 : 3)),
        y + Math.sin(a) * (r + (i % 5 === 0 ? 7 : 3)),
      );
      ctx.stroke();
    }
    return;
  }
  if (state === "ended") return;
  if (mouse.active && state === "playing") {
    ctx.strokeStyle = mode === 1 ? "#edcc90aa" : "#adeccb88";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, mode === 1 ? 8 : 12, 0, Math.PI * 2);
    ctx.stroke();
    if (stats[8] & 32) {
      ctx.strokeStyle = stats[26] > 0 ? "#e6c78688" : "#efdfaaff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        mouse.x,
        mouse.y,
        24,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * (1 - stats[26] / 0.95),
      );
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.fillStyle = "#c5f4df";
    ctx.fillRect(mouse.x - 1, mouse.y - 1, 2, 2);
    for (let i = 0; i < 4; i++) {
      let a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(mouse.x + Math.cos(a) * 17, mouse.y + Math.sin(a) * 17);
      ctx.lineTo(mouse.x + Math.cos(a) * 21, mouse.y + Math.sin(a) * 21);
      ctx.stroke();
    }
  }
  const nodes = sim.nursery_data();
  const closest = nextNursery(nodes),
    dist =
      closest < 0
        ? 0
        : Math.hypot(nodes[closest] - stats[4], nodes[closest + 1] - stats[5]);
  for (let i = 0; i < nodes.length; i += 5) {
    const [x, y] = screen(nodes[i], nodes[i + 1]);
    if (x < -150 || x > innerWidth + 150 || y < -150 || y > innerHeight + 150)
      continue;
    ctx.textAlign = "center";
    ctx.font = '8px "DM Sans", sans-serif';
    ctx.letterSpacing = "1.4px";
    ctx.fillStyle = nodes[i + 4] ? "#a6eec9" : "#8caa8d";
    ctx.fillText(
      nodes[i + 4] ? "NURSERY AWAKENED" : `NURSERY 0${i / 5 + 1}`,
      x,
      y + 110 * zoom,
    );
    ctx.fillStyle = "#648d79";
    ctx.font = '8px "DM Sans", sans-serif';
    ctx.fillText(
      nodes[i + 4]
        ? "A NEW CURRENT OF LIFE"
        : `${nodes[i + 2]} ORGANISMS TO AWAKEN`,
      x,
      y + 110 * zoom + 17,
    );
    if (nodes[i + 3] > 0 && !nodes[i + 4]) {
      ctx.strokeStyle = "#b5f1b9";
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        98 * zoom,
        -Math.PI / 2,
        -Math.PI / 2 + nodes[i + 3] * Math.PI * 2,
      );
      ctx.stroke();
    }
  }
  if (closest >= 0 && dist > 220 && stats[0] >= nodes[closest + 2]) {
    let [x, y] = screen(nodes[closest], nodes[closest + 1]);
    let dx = x - innerWidth / 2,
      dy = y - innerHeight / 2;
    let scale = Math.min(
      1,
      (innerWidth / 2 - 100) / Math.max(Math.abs(dx), 1),
      (innerHeight / 2 - 150) / Math.max(Math.abs(dy), 1),
    );
    x = innerWidth / 2 + dx * scale;
    y = innerHeight / 2 + dy * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = "#d3daa8bb";
    ctx.strokeRect(-5, -5, 10, 10);
    ctx.restore();
    ctx.textAlign = "center";
    ctx.font = '8px "DM Sans",sans-serif';
    ctx.fillStyle = "#9db697";
    ctx.fillText(`${Math.round(dist)} M`, x, y + 25);
  }
  feedback.draw(
    ctx,
    creatures,
    camera,
    zoom,
    stats,
    state === "playing" ? drawDt : 0,
    isTraining,
    lessonData[0],
    stats[18],
  );
  if (isTraining) {
    if (lessonData[0] === 0 || lessonData[0] === 1 || lessonData[0] === 4) {
      const [x, y] = screen(lessonData[2], lessonData[3]);
      ctx.strokeStyle = "#b9edd390";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 33 + Math.sin(time * 2) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-6, -6, 12, 12);
      ctx.restore();
      ctx.font = '9px "DM Sans",sans-serif';
      ctx.fillStyle = "#b9edd3";
      ctx.textAlign = "center";
      ctx.fillText(
        lessonData[0] === 4
          ? "EVADE TOWARD THE BEACON"
          : "GUIDE THE COLLECTIVE HERE",
        x,
        y - 48,
      );
    }
    return;
  }
  if (innerWidth < 700) return;
  const size = 151,
    mx = innerWidth - (innerWidth <= 1000 ? 25 : 47) - size,
    my = innerHeight - (innerWidth <= 1000 ? 51 : 63) - size;
  ctx.fillStyle = "#061b1880";
  ctx.fillRect(mx, my, size, size);
  ctx.strokeStyle = "#82b79728";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 0.5, my + 0.5, size, size);
  ctx.strokeStyle = "#83b99c13";
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(mx + (i * size) / 4, my);
    ctx.lineTo(mx + (i * size) / 4, my + size);
    ctx.moveTo(mx, my + (i * size) / 4);
    ctx.lineTo(mx + size, my + (i * size) / 4);
    ctx.stroke();
  }
  const map = (x, y) => [
    mx + size / 2 + (x / 5600) * size,
    my + size / 2 + (y / 5600) * size,
  ];
  for (let i = 0; i < frame.length; i += 8) {
    let k = frame[i + 4];
    if (k < 2 || (k > 6 && k !== 9 && k !== 10)) continue;
    let [x, y] = map(frame[i], frame[i + 1]);
    ctx.fillStyle = k === 6 ? "#c3d9a4" : k === 2 ? "#466776" : "#a06b68";
    ctx.fillRect(x - 1, y - 1, k === 6 ? 3 : 2, k === 6 ? 3 : 2);
  }
  const [px, py] = map(stats[4], stats[5]);
  ctx.strokeStyle = "#a5eabe40";
  ctx.strokeRect(
    px - ((innerWidth / zoom / 5600) * size) / 2,
    py - ((innerHeight / zoom / 5600) * size) / 2,
    (innerWidth / zoom / 5600) * size,
    (innerHeight / zoom / 5600) * size,
  );
  ctx.fillStyle = "#afffcd";
  ctx.beginPath();
  ctx.arc(px, py, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#afffcd45";
  ctx.beginPath();
  ctx.arc(px, py, 5 + Math.sin(time * 2), 0, Math.PI * 2);
  ctx.stroke();
}
function processEvents(events) {
  for (let i = 0; i < events.length; i += 4) {
    const k = events[i],
      x = events[i + 1],
      y = events[i + 2];
    if (k <= 3 && Math.hypot(x - stats[4], y - stats[5]) > 750) continue;
    if (k >= 7) {
      if (k === 12) {
        renderer.burst(x, y, Math.min(18, 3 + events[i + 3] / 12), 1, 90);
        audio.impact(events[i + 3], (x - stats[4]) / 450);
        shake = Math.max(shake, Math.min(3.5, events[i + 3] / 90));
      }
      if (k === 14) audio.counterCue();
      if (k === 16) {
        audio.interrupt();
        renderer.ring(x, y, 1, 65);
      }
      if (k === 17) audio.attackWindup(events[i + 3] > 0);
      if (k === 18) audio.evade();
      if (k === 19) {
        audio.decoy();
        renderer.ring(x, y, 3, 80);
      }
      if (k === 20) {
        audio.shed();
      }
      feedback.event(k, x, y, events[i + 3]);
      if (k === 9) {
        renderer.ring(x, y, 0, 110);
        audio.interrupt?.();
      }
      if (k === 10)
        toast("The crown fractures. New organisms answer its call.", 5);
      continue;
    }
    if (k === 0) {
      feedCount += events[i + 3];
      if (performance.now() - lastFeed > 250) {
        feedback.event(0, x, y, feedCount);
        feedCount = 0;
        lastFeed = performance.now();
      }
      renderer.burst(x, y, 5, 1, 55);
      audio.feed((x - stats[4]) / 400);
    } else if (k === 2) {
      feedback.event(2, x, y, events[i + 3]);
      renderer.burst(x, y, Math.min(5, events[i + 3]), 2, 45);
      if (performance.now() - feedback.lastSound > 220) {
        audio.hurt();
        feedback.lastSound = performance.now();
      }
    } else if (k === 3) {
      renderer.burst(x, y, 90, 1, 210);
      renderer.ring(x, y, 0, 140);
      audio.kill();
      shake = 4;
      toast(
        events[i + 3] === 0
          ? "A grazer returns to the nutrient cycle."
          : "Predator dissolved. Reclaim its nutrients.",
        3,
      );
    } else if (k === 4) {
      renderer.burst(x, y, 160, 0, 220);
      renderer.ring(x, y, 0, 450);
      audio.evolve();
      shake = 4;
      toast("A nursery awakens. 130 lives join your collective.", 6);
    } else if (k === 5) {
      audio.encounter();
      shake = 8;
      toast("Something ancient has heard your song.", 7);
    } else if (k === 6) {
      finish(true);
    }
  }
}
function loop(now) {
  const rawDt = (now - prevTime) / 1000 || 0.0167;
  const dt = Math.min(rawDt, 0.05);
  prevTime = now;
  if (document.hidden) {
    requestAnimationFrame(loop);
    return;
  }
  frameTimes.push(rawDt * 1000);
  if (frameTimes.length > 240) frameTimes.shift();
  elapsed += dt;
  drawDt = dt;
  if (state === "intro" || state === "playing") {
    accumulator = Math.min(accumulator + dt, 0.1);
    const begin = performance.now();
    while (accumulator >= 1 / 60) {
      let tx, ty;
      if (state === "intro") {
        tx = Math.sin(elapsed * 0.23) * 90;
        ty = Math.cos(elapsed * 0.31) * 65;
      } else if (holdTarget) {
        tx = holdTarget.x;
        ty = holdTarget.y;
      } else if (
        keys.has("w") ||
        keys.has("a") ||
        keys.has("s") ||
        keys.has("d") ||
        keys.has("arrowup") ||
        keys.has("arrowdown") ||
        keys.has("arrowleft") ||
        keys.has("arrowright")
      ) {
        tx =
          stats[4] +
          ((keys.has("d") || keys.has("arrowright") ? 1 : 0) -
            (keys.has("a") || keys.has("arrowleft") ? 1 : 0)) *
            250;
        ty =
          stats[5] +
          ((keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
            (keys.has("w") || keys.has("arrowup") ? 1 : 0)) *
            250;
      } else if (mouse.active) {
        tx = camera.x + (mouse.x - innerWidth / 2) / zoom;
        ty = camera.y + (mouse.y - innerHeight / 2) / zoom;
      } else {
        tx = stats[4];
        ty = stats[5];
      }
      sim.step(1 / 60, tx, ty, state === "intro" ? 0 : mode, keys.has("shift"));
      stats = sim.stats();
      processEvents(sim.events());
      accumulator -= 1 / 60;
      if (state === "ended") break;
      if (state === "playing" && sim.evolution_ready()) {
        updateHUD();
        evolve();
        break;
      }
    }
    simTimes.push(performance.now() - begin);
    if (simTimes.length > 240) simTimes.shift();
    frame = readFrame();
    creatures = sim.creature_data();
    const z =
      state === "intro"
        ? innerWidth < 700
          ? 1.3
          : Math.min(innerWidth / 1050, 1.7)
        : Math.max(0.65, 1.05 - Math.max(0, stats[0] - 350) / 5500);
    zoom += (z - zoom) * (1 - Math.exp(-dt * 2));
    const offset =
      state === "intro"
        ? innerWidth < 700
          ? innerWidth * 0.35
          : innerWidth * 0.205
        : 0;
    const cx = stats[4] - offset / zoom,
      cy = stats[5] + (state === "intro" ? 25 : 0);
    camera.x += (cx - camera.x) * (1 - Math.exp(-dt * 3));
    camera.y += (cy - camera.y) * (1 - Math.exp(-dt * 3));
    if (state === "playing") {
      hudClock += dt;
      if (hudClock > 0.12) {
        hudClock = 0;
        updateHUD();
      }
      if (stats[0] <= 0) finish(false);
    }
  }
  if (state === "playing" || state === "evolution") {
    audio.update(
      stats[0],
      stats[10],
      state === "playing" && keys.has("shift") ? 1 : 0,
      stats[7],
      stats[13] === 1 && stats[11] !== 1,
    );
  }
  shake *= Math.exp(-dt * 8);
  const displayCamera = {
    x: camera.x + (Math.random() - 0.5) * shake,
    y: camera.y + (Math.random() - 0.5) * shake,
  };
  if (frame.buffer !== wasm.memory.buffer) frame = readFrame(false);
  renderer.interpolation =
    state === "playing" || state === "intro" ? accumulator * 60 : 1;
  renderer.draw(
    frame,
    displayCamera,
    zoom,
    state === "intro" ? elapsed : stats[6],
    state === "paused" || state === "evolution" ? 0 : dt,
  );
  drawOverlay(elapsed);
  if (now > toastUntil) $("toast").classList.remove("visible");
  requestAnimationFrame(loop);
}
$("start").onclick = () => start(true);
$("again").onclick = () => start(false);
$("restart").onclick = () => start(false);
$("learn-again").onclick = () => start(true);
$("lesson-next").onclick = nextLesson;
function absorb() {
  if (state === "playing" && sim.absorb_allies()) {
    audio.evolve();
    renderer.ring(stats[4], stats[5], 3, 220);
    toast(
      "Sister broods join your collective. New escorts hatch in 24 seconds.",
      5,
    );
  }
}
$("absorb").onclick = absorb;
$("lesson-skip").onclick = () => start(false);
$("pause").onclick = pause;
$("resume").onclick = pause;
$("inspect").onclick = pause;
$("trait-chips").onclick = pause;
$("evolution-inspect").onclick = pause;
$("pulse").onclick = pulse;
$("evolve-prompt").onclick = () => evolve();
$("other-instincts").onclick = () => evolve(true);
$("sound").onclick = () => {
  if (audio.enabled) {
    soundWanted = false;
    audio.mute();
    $("sound-label").textContent = "SOUND OFF";
    $("sound").setAttribute("aria-label", "Enable sound");
  } else {
    soundWanted = true;
    enableAudio();
  }
};
window.addEventListener("resize", resize);
window.addEventListener("contextmenu", (e) => {
  if (e.target === $("world")) e.preventDefault();
});
$("world").addEventListener("pointermove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.active = true;
  holdTarget = null;
});
$("world").addEventListener("pointerdown", (e) => {
  if (state !== "playing") return;
  e.preventDefault();
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.active = true;
  holdTarget = null;
  mode = e.button === 2 ? 2 : 1;
  if (e.button === 0 && stats[8] & 32 && !keys.has("shift")) {
    const x = camera.x + (e.clientX - innerWidth / 2) / zoom;
    const y = camera.y + (e.clientY - innerHeight / 2) / zoom;
    if (sim.lash(x, y)) processEvents(sim.events());
  }
  $("world").setPointerCapture(e.pointerId);
});
window.addEventListener("pointerup", () => (mode = 0));
window.addEventListener("pointercancel", () => (mode = 0));
window.addEventListener("keydown", (e) => {
  if (
    [" ", "arrowup", "arrowdown", "arrowleft", "arrowright", "tab"].includes(
      e.key.toLowerCase(),
    ) &&
    state === "playing" &&
    e.key !== "Tab"
  )
    e.preventDefault();
  const k = e.key.toLowerCase();
  keys.add(k);
  if (e.repeat) return;
  if (k === "enter" && isTraining && state === "playing") {
    e.preventDefault();
    nextLesson();
    return;
  }
  if (k === "tab" && (state === "playing" || state === "paused")) {
    e.preventDefault();
    pause();
    return;
  }
  if (k === "c") absorb();
  if (k === "m") $("sound").click();
  else if (k === "escape") pause();
  else if (k === " " && state === "playing") pulse();
  else if (k === "e" && state === "playing") pause();
  else if (k === "r" && state === "evolution") evolve(true);
  else if (state === "evolution" && ["1", "2", "3"].includes(k))
    choose(Number(k) - 1);
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  mode = 0;
  if (state === "playing") pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (state === "playing") pause();
    audio.suspend();
  } else if (state === "intro" || state === "evolution") audio.resume();
});
$("world").addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  if (state === "playing") pause();
  $("error-message").textContent =
    "The graphics context was interrupted. Reload to begin a new life.";
  show("error");
});
try {
  wasm = await init();
  renderer = new Renderer($("world"));
  sim = new Swarm(9371, true);
  // Start with a settled living specimen, not an overlapping spawn burst.
  for (let i = 0; i < 180; i++) {
    const t = i / 60;
    sim.step(
      1 / 60,
      Math.sin(t * 0.23) * 90,
      Math.cos(t * 0.31) * 65,
      0,
      false,
    );
  }
  elapsed = 3;
  stats = sim.stats();
  frame = readFrame();
  camera.x = (-innerWidth * 0.205) / Math.min(innerWidth / 1050, 1.7);
  zoom = Math.min(innerWidth / 1050, 1.7);
  resize();
  $("start").disabled = false;
  $("start-label").textContent = "ENTER THE NURSERY";
  requestAnimationFrame(loop);
  // Opt-in, read-mostly instrumentation for reproducible browser QA.
  if (new URLSearchParams(location.search).has("debug"))
    window.swarmkeeper = {
      get path() {
        return Array.from(sim.evolution_path());
      },
      lash(x, y) {
        if (state === "playing" && !keys.has("shift") && sim.lash(x, y))
          processEvents(sim.events());
      },
      get lesson() {
        return Array.from(sim.lesson_data());
      },
      get creatures() {
        return Array.from(sim.creature_data());
      },
      nextLesson,
      get stats() {
        return Array.from(sim.stats());
      },
      get state() {
        return state;
      },
      get camera() {
        return { ...camera, zoom };
      },
      get metrics() {
        const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
        return {
          fps: 1000 / avg(frameTimes),
          simulationMs: avg(simTimes),
          frameP95: [...frameTimes].sort((a, b) => a - b)[
            Math.floor(frameTimes.length * 0.95)
          ],
          frameP99: [...frameTimes].sort((a, b) => a - b)[
            Math.floor(frameTimes.length * 0.99)
          ],
          visibleInstances: renderer.visibleCount,
          population: stats[0],
          webglError: renderer.gl.getError(),
        };
      },
      get audio() {
        return {
          boss: audio.boss,
          beat: audio.beat,
          time: audio.ctx?.currentTime,
          state: audio.ctx?.state,
          enabled: audio.enabled,
          sampleRate: audio.ctx?.sampleRate,
          rms: audio.rms(),
        };
      },
      target(x, y) {
        holdTarget = { x, y };
      },
      grow(n) {
        sim.benchmark_population(n);
      },
      intent(x, y, formation = 0, surge = false) {
        holdTarget = { x, y };
        mode = formation;
        if (surge) keys.add("shift");
        else keys.delete("shift");
      },
      encounter(kind) {
        sim.benchmark_encounter(kind);
      },
      adapt(id) {
        return sim.benchmark_adaptation(id);
      },
      get shell() {
        return Array.from(sim.shell_data());
      },
      absorb,
      get combat() {
        return feedback.floats.map(({ text, kind }) => ({ text, kind }));
      },
      pulse,
      choose,
      pause,
      start,
      get frame() {
        return Array.from(frame);
      },
      get nodes() {
        return Array.from(sim.nursery_data());
      },
    };
} catch (e) {
  console.error(e);
  $("error-message").textContent =
    e.message ||
    "The ecosystem could not load. Please run the project with the included local server.";
  show("error");
}
