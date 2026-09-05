// Combat intent and outcomes share the same state snapshot as the simulation.
export const SPECIES = [
  {
    name: "Glass grazer",
    tip: "A peaceful nutrient competitor. Hunters prey on it.",
    color: "#8aafc8",
  },
  {
    name: "Mantis hunter",
    tip: "Bait the locked charge. Sidestep, then compress against its exposed body. Its rear is softer.",
    color: "#f1a685",
  },
  {
    name: "Siphon anemone",
    tip: "Counter the white flash at the end of inhalation. Evade out of the eruption ring.",
    color: "#cc9ade",
  },
  {
    name: "Cathedral leviathan",
    tip: "Counter the crown’s white flash, then commit quickly. Strike the open heart; evade away from its implosion.",
    color: "#edcf99",
  },
  {
    name: "Prism urchin",
    tip: "Its closed plates deflect attacks. Counter the white flash or dodge the expanding spines, then strike.",
    color: "#b9a5ec",
  },
  {
    name: "Veil ray",
    tip: "Leave the marked cone before it sweeps. Attack while its gills are open, or counter its white flash.",
    color: "#99b6f2",
  },
];
export function stateName(kind, state, pattern = 0, ready = false, locked = 0) {
  if (kind === 0) return "GRAZING · HARMLESS";
  if (state === 3) return "EXPOSED · COMPRESS TO STRIKE";
  if (state === 2)
    return [
      "",
      "CHARGING · SIDESTEP",
      "ERUPTING · EVADE",
      pattern % 2 === 0 ? "IMPLOSION · EVADE" : "LUNGING · SIDESTEP",
      "SPINES · EVADE",
      "SWEEPING · LEAVE THE CONE",
    ][kind];
  if (state === 1)
    return locked > 0
      ? "BRACED · EVADE THIS ATTACK"
      : ready
        ? "WHITE FLASH · RESONATE NOW"
        : "WINDING UP · WAIT FOR WHITE FLASH";
  return "ARMOURED · BAIT AN ATTACK";
}
export class Feedback {
  constructor() {
    this.floats = [];
    this.hit = 0;
    this.target = null;
    this.lastSound = 0;
  }
  reset() {
    this.floats.length = 0;
    this.target = null;
    this.hit = 0;
  }
  event(kind, x, y, value) {
    if (kind === 2) {
      this.hit = Math.min(0.36, this.hit + 0.018 * value);
      const last = this.floats.find((f) => f.kind === 2 && f.age < 0.35);
      if (last) {
        last.value += value;
        last.text = `−${Math.round(last.value)} organisms`;
        return;
      }
    }
    const text =
      kind === 21
        ? `DIGESTED · +${value} NUTRIENTS`
        : kind === 19
          ? "DECOY TAKEN"
          : kind === 20
            ? "GHOST COLONY"
            : kind === 2
              ? `−${Math.round(value)} organisms`
              : kind === 7
                ? `−${Math.round(value)}`
                : kind === 8
                  ? "DEFLECTED"
                  : kind === 9
                    ? "INTERRUPTED · CORE OPEN"
                    : kind === 13
                      ? value > 1
                        ? "BRACED · EVADE"
                        : "TOO EARLY · WAIT FOR WHITE FLASH"
                      : kind === 16
                        ? "GUARD · DEFLECTED"
                        : kind === 0
                          ? `+${Math.round(value)} nutrients`
                          : "";
    if (!text) return;
    const color =
      kind === 19 || kind === 20
        ? "#c4b2ff"
        : kind === 2
          ? "#ffa59e"
          : kind === 8
            ? "#e4c389"
            : kind === 9
              ? "#a3fbd7"
              : kind === 0
                ? "#badfb5"
                : "#e3fff0";
    this.floats.push({ x, y, text, color, age: 0, kind, value });
    if (this.floats.length > 40) this.floats.shift();
  }
  draw(ctx, creatures, camera, zoom, stats, dt, training, lesson, frameMode) {
    const screen = (x, y) => [
      (x - camera.x) * zoom + innerWidth / 2,
      (y - camera.y) * zoom + innerHeight / 2,
    ];
    let best = null,
      score = Infinity;
    for (let i = 0; i < creatures.length; i += 12) {
      const c = creatures.subarray(i, i + 12),
        [x, y] = screen(c[0], c[1]),
        kind = c[2],
        state = c[4],
        age = c[5],
        heading = c[6],
        pattern = c[9];
      if (x < -220 || x > innerWidth + 220 || y < -220 || y > innerHeight + 220)
        continue;
      const distance = Math.hypot(c[0] - stats[4], c[1] - stats[5]);
      if (kind > 0 && distance < 660) {
        const s = distance - (kind === 3 ? 200 : 0);
        if (s < score) {
          best = c;
          score = s;
        }
      }
      if (kind === 0) continue;
      const color =
        state === 3
          ? "#9af1c7"
          : state === 2
            ? "#fa7776"
            : c[8]
              ? "#ffffd9"
              : "#ebbd80";
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(heading);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = color;
      ctx.fillStyle = state === 2 ? "#f77b7314" : "#e8bc8110";
      if (state === 1) {
        ctx.setLineDash([5, 6]);
        ctx.globalAlpha = 0.5 + Math.sin(age * 9) * 0.15;
        if (kind === 1 || (kind === 3 && pattern % 2 === 1)) {
          const len = (kind === 3 ? 330 : 250) * zoom,
            w = (kind === 3 ? 110 : 37) * zoom;
          ctx.beginPath();
          ctx.moveTo(0, -w);
          ctx.lineTo(len, -w);
          ctx.lineTo(len + w, 0);
          ctx.lineTo(len, w);
          ctx.lineTo(0, w);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (kind === 5) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 270 * zoom, -0.67, 0.67);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          const radius = (kind === 3 ? 330 : kind === 2 ? 205 : 250) * zoom;
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2 * Math.min(1, age / c[10]));
          ctx.stroke();
        }
      } else if (state === 2) {
        ctx.globalAlpha = 0.8;
        if (kind === 2 || kind === 4 || (kind === 3 && pattern % 2 === 0)) {
          const r =
            kind === 3
              ? 330 * Math.max(0, 1 - age / 1.8)
              : (age / 1.2) * (kind === 2 ? 205 : 250);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, r * zoom, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (kind === 5) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 270 * zoom, -0.67, 0.67);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else if (state === 3) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([3, 7]);
        ctx.beginPath();
        ctx.arc(0, 0, (kind === 3 ? 112 : 65) * zoom, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      if (distance < 620 && y > 95 && y < innerHeight - 120) {
        const by = y + (kind === 3 ? 165 : kind === 5 ? 90 : 65) * zoom,
          bw = kind === 3 ? 135 : 65;
        ctx.textAlign = "center";
        ctx.font = '8px "DM Sans",sans-serif';
        ctx.letterSpacing = ".6px";
        ctx.fillStyle = color;
        ctx.fillText(
          training && lesson === 2
            ? "PRACTICE HUSK"
            : SPECIES[kind].name.toUpperCase(),
          x,
          by,
        );
        ctx.fillStyle = "#bfe4d425";
        ctx.fillRect(x - bw / 2, by + 8, bw, 3);
        ctx.fillStyle = color;
        ctx.fillRect(x - bw / 2, by + 8, bw * Math.max(0, c[3]), 3);
        ctx.font = '7px "DM Sans",sans-serif';
        ctx.fillText(
          state === 3
            ? "EXPOSED"
            : state === 1
              ? c[8]
                ? "RESONATE NOW"
                : c[7] > 0
                  ? "BRACED · EVADE"
                  : "WAIT FOR FLASH"
              : state === 2
                ? "DANGER"
                : "ARMOURED",
          x,
          by + 25,
        );
      }
    }
    this.target = best;
    // Show the player's reach only when an interrupt is relevant.
    if (
      best &&
      best[4] === 1 &&
      stats[3] <= 0 &&
      stats[2] >= 28 &&
      frameMode !== 3
    ) {
      const [x, y] = screen(stats[4], stats[5]);
      const range = stats[8] & 4 ? 430 : 300;
      ctx.save();
      ctx.strokeStyle = "#9ee8cf35";
      ctx.setLineDash([2, 9]);
      ctx.beginPath();
      ctx.arc(x, y, range * zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '8px "DM Sans",sans-serif';
      ctx.textAlign = "center";
      ctx.fillStyle = "#a7cdbb";
      ctx.fillText("RESONANCE REACH", x, y - range * zoom - 9);
      ctx.restore();
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      let f = this.floats[i];
      f.age += dt;
      if (f.age > 1.4) {
        this.floats.splice(i, 1);
        continue;
      }
      const [x, y] = screen(f.x, f.y);
      ctx.globalAlpha = Math.min(1, (1.4 - f.age) * 2);
      ctx.font = `${f.kind === 9 ? 11 : 10}px "DM Sans",sans-serif`;
      ctx.letterSpacing = ".2px";
      ctx.textAlign = "center";
      ctx.fillStyle = f.color;
      ctx.shadowColor = "#021510";
      ctx.shadowBlur = 5;
      ctx.fillText(f.text, x, y - 30 - f.age * 30);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    this.hit *= Math.exp(-dt * 5);
    if (this.hit > 0.005) {
      const g = ctx.createRadialGradient(
        innerWidth / 2,
        innerHeight / 2,
        innerWidth * 0.25,
        innerWidth / 2,
        innerHeight / 2,
        innerWidth * 0.75,
      );
      g.addColorStop(0, "#ff404000");
      g.addColorStop(1, `rgba(222,60,70,${this.hit})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, innerWidth, innerHeight);
    }
  }
}
