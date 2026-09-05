// Paste into the console at /?debug after starting open water.
// Uses ordinary intent, feeding, choices and pulse; never grants population.
// Pauses at the leviathan for inspection. Set window.swarmPlaytestFight = true
// before running this script to play the encounter through to its outcome.
(() => {
  const game = window.swarmkeeper;
  if (!game) throw Error("Open /?debug first");
  clearInterval(window.swarmPlaytest);
  window.swarmPlaytestLog = [];
  let lastSecond = -1;
  let recovering = false;
  window.swarmPlaytest = setInterval(() => {
    const s = game.stats;
    if (game.state === "ended") {
      clearInterval(window.swarmPlaytest);
      return;
    }
    if (game.state === "evolution") {
      const wanted = [
        "Tidal Fang",
        "Slipstream",
        "Vast Chorus",
        "Sister Broods",
        "Helix Guard",
        "Forked Mind",
      ][s[7]];
      let cards = [...document.querySelectorAll(".evolution-card")];
      for (
        let page = 0;
        page < 3 && !cards.some((c) => c.textContent.includes(wanted));
        page++
      ) {
        document.getElementById("other-instincts").click();
        cards = [...document.querySelectorAll(".evolution-card")];
      }
      (cards.find((c) => c.textContent.includes(wanted)) || cards[0]).click();
      return;
    }
    if (game.state !== "playing") return;
    const seconds = Math.floor(s[6]);
    if (seconds !== lastSecond) {
      window.swarmPlaytestLog.push({
        seconds,
        population: s[0],
        nurseries: s[9],
        evolution: s[7],
        ...game.metrics,
      });
      lastSecond = seconds;
    }
    const cs = game.creatures;
    for (let i = 0; i < cs.length; i += 12) {
      if (cs[i + 2] === 3) {
        if (!window.swarmPlaytestFight) {
          clearInterval(window.swarmPlaytest);
          game.intent(cs[i], cs[i + 1], 0);
          game.pause();
          return;
        }
        const dx = s[4] - cs[i],
          dy = s[5] - cs[i + 1];
        const dist = Math.max(1, Math.hypot(dx, dy));
        const state = cs[i + 4];
        if (s[0] < 650) recovering = true;
        else if (s[0] > 1450) recovering = false;
        if (recovering) {
          if (s[22] > 0) game.absorb();
          const frame = game.frame;
          let goal = null,
            best = Infinity;
          for (let j = 0; j < frame.length; j += 8) {
            if (
              frame[j + 4] !== 1 ||
              Math.hypot(frame[j] - cs[i], frame[j + 1] - cs[i + 1]) < 350
            )
              continue;
            const d = Math.hypot(frame[j] - s[4], frame[j + 1] - s[5]);
            if (d < best) {
              best = d;
              goal = [frame[j], frame[j + 1]];
            }
          }
          if (goal)
            game.intent(...goal, 2, state === 2 && dist < 250 && s[2] > 35);
        } else if (state === 3) {
          game.intent(cs[i], cs[i + 1], 1);
          if (s[8] & 32 && s[26] <= 0) game.lash(cs[i], cs[i + 1]);
        } else if (state === 2)
          game.intent(
            cs[i] + (dx / dist) * 470,
            cs[i + 1] + (dy / dist) * 470,
            2,
            s[2] > 30,
          );
        else {
          game.intent(
            cs[i] + (dx / dist) * 170,
            cs[i + 1] + (dy / dist) * 170,
            0,
          );
          if (cs[i + 8] === 1 && dist < 300) game.pulse();
        }
        return;
      }
      if (cs[i + 8] === 1 && Math.hypot(cs[i] - s[4], cs[i + 1] - s[5]) < 290)
        game.pulse();
    }
    let goal = null;
    const nodes = game.nodes;
    for (let i = 0; i < nodes.length; i += 5) {
      if (!nodes[i + 4]) {
        if (s[0] >= nodes[i + 2]) goal = [nodes[i], nodes[i + 1]];
        break;
      }
    }
    if (window.swarmPlaytestExplore && s[7] < 6) goal = null;
    if (!goal) {
      let best = Infinity;
      const frame = game.frame;
      for (let i = 0; i < frame.length; i += 8) {
        if (frame[i + 4] !== 1) continue;
        const d = Math.hypot(frame[i] - s[4], frame[i + 1] - s[5]);
        if (d < best) {
          best = d;
          goal = [frame[i], frame[i + 1]];
        }
      }
    }
    if (goal) game.intent(...goal, 2);
  }, 150);
})();
