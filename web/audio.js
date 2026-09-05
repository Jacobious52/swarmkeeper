// A fully synthesized score: D-minor / suspended harmonies, tidal bass,
// pentatonic organisms, and a danger-driven heartbeat. No samples or downloads.
export class EcosystemAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.nextBeat = 0;
    this.beat = 0;
    this.feedLimit = 0;
    this.intensity = 0;
    this.boss = false;
    this.impactLimit = 0;
    this.cueLimit = 0;
  }
  async start() {
    clearTimeout(this.suspendTimer);
    if (!this.ctx) {
      const A = window.AudioContext || window.webkitAudioContext;
      this.ctx = new A();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.55;
      this.compressor = c.createDynamicsCompressor();
      this.compressor.threshold.value = -20;
      this.compressor.ratio.value = 5;
      this.master.connect(this.compressor);
      this.analyser = c.createAnalyser();
      this.analyser.fftSize = 1024;
      this.samples = new Float32Array(1024);
      this.compressor.connect(this.analyser);
      this.analyser.connect(c.destination);
      this.delay = c.createDelay(1);
      this.delay.delayTime.value = 0.375;
      this.feedback = c.createGain();
      this.feedback.gain.value = 0.32;
      this.wet = c.createGain();
      this.wet.gain.value = 0.19;
      this.delay.connect(this.feedback);
      this.feedback.connect(this.delay);
      this.delay.connect(this.wet);
      this.wet.connect(this.master);
      // Reproducible stereo impulse creates the acoustic space of the deep.
      const impulse = c.createBuffer(2, c.sampleRate * 2.8, c.sampleRate);
      let impulseSeed = 98117;
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
          impulseSeed ^= impulseSeed << 13;
          impulseSeed ^= impulseSeed >>> 17;
          impulseSeed ^= impulseSeed << 5;
          data[i] =
            (((impulseSeed >>> 0) / 4294967296) * 2 - 1) *
            Math.pow(1 - i / data.length, 3);
        }
      }
      this.reverb = c.createConvolver();
      this.reverb.buffer = impulse;
      this.reverbGain = c.createGain();
      this.reverbGain.gain.value = 0.2;
      this.delay.connect(this.reverb);
      this.reverb.connect(this.reverbGain);
      this.reverbGain.connect(this.master);
      this.air = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
      let data = this.air.getChannelData(0),
        last = 0;
      let seed = 81231;
      for (let i = 0; i < data.length; i++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        last = (last + (((seed >>> 0) / 4294967296) * 2 - 1) * 0.018) / 1.015;
        data[i] = last;
      }
      const noise = c.createBufferSource();
      noise.buffer = this.air;
      noise.loop = true;
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 650;
      this.airGain = c.createGain();
      this.airGain.gain.value = 0.22;
      noise.connect(f);
      f.connect(this.airGain);
      this.airGain.connect(this.master);
      noise.start();
      this.nextBeat = c.currentTime;
    }
    await this.ctx.resume();
    this.enabled = true;
    this.master.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.15);
  }
  rms() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    return Math.sqrt(
      this.samples.reduce((sum, v) => sum + v * v, 0) / this.samples.length,
    );
  }
  mute() {
    if (!this.ctx) return;
    this.enabled = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
  }
  tone(
    freq,
    start,
    duration,
    volume = 0.08,
    type = "sine",
    end = null,
    pan = 0,
  ) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx,
      o = c.createOscillator(),
      a = c.createGain(),
      p = c.createStereoPanner();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (end)
      o.frequency.exponentialRampToValueAtTime(
        Math.max(end, 10),
        start + duration,
      );
    a.gain.setValueAtTime(0, start);
    a.gain.linearRampToValueAtTime(
      volume,
      start + Math.min(0.035, duration * 0.2),
    );
    a.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    p.pan.value = Math.max(-1, Math.min(1, pan));
    o.connect(a);
    a.connect(p);
    p.connect(this.master);
    p.connect(this.delay);
    o.start(start);
    o.stop(start + duration + 0.05);
    o.onended = () => {
      o.disconnect();
      a.disconnect();
      p.disconnect();
    };
  }
  update(population, danger, speed, evolution, boss = false) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx,
      t = c.currentTime;
    if (this.boss !== boss) {
      this.boss = boss;
      this.nextBeat = t;
      this.beat = 0;
    }
    if (t > (this.nextAirUpdate || 0)) {
      this.nextAirUpdate = t + 0.1;
      this.airGain.gain.cancelScheduledValues(t);
      this.airGain.gain.setTargetAtTime(
        0.13 + speed * 0.13 + danger * 0.11,
        t,
        0.5,
      );
    }
    if (this.nextBeat < t - 0.5) this.nextBeat = t;
    while (this.nextBeat < t + 0.12) {
      const at = this.nextBeat,
        b = this.beat;
      if (boss) {
        // A separate 146 BPM score: low ostinato, metallic percussion and rising counterpoint.
        const root = [55, 51.913, 58.27, 48.999][Math.floor(b / 16) % 4];
        const riff = [1, 1, 1.5, 1, 1.125, 1, 1.5, 2][b % 8];
        this.tone(root * riff, at, 0.18, 0.095, "triangle", root * riff * 0.99);
        if (b % 2 === 0) {
          this.tone(126, at, 0.16, 0.16, "sine", 34);
          this.noise(at, 0.045, 0.08, 1800);
        }
        if (b % 4 === 2) {
          this.noise(at, 0.14, 0.21, 1100);
          this.tone(190, at, 0.09, 0.035, "triangle", 90);
        }
        if (b % 2 === 1) this.noise(at, 0.028, 0.07, 4200);
        const lead = [4, 3, 4, 4.5, 6, 4.5, 4, 3][b % 8];
        this.tone(
          root * lead,
          at,
          0.27,
          0.029,
          "triangle",
          null,
          Math.sin(b) * 0.5,
        );
        if (b % 8 === 0) {
          this.tone(root * 2, at, 1.5, 0.045, "sawtooth");
          this.tone(root * 3.01, at, 1.2, 0.02, "sine");
        }
        this.beat++;
        this.nextBeat += 0.205;
        continue;
      }
      const roots = [73.416, 65.406, 58.27, 65.406];
      const root = roots[Math.floor(b / 16) % 4];
      if (b % 8 === 0) {
        this.tone(root, at, 5, 0.105, "sine");
        this.tone(root * 2, at, 4.8, 0.037, "triangle");
        this.tone(root * 3, at + 0.12, 4.2, 0.024, "sine", null, -0.3);
        this.tone(root * 4.75, at + 0.25, 3.9, 0.014, "sine", null, 0.4);
      }
      const notes = [1, 1.5, 2, 2.25, 2.667, 3, 4, 4.5];
      if (b % 2 === 0 || population > 600) {
        const n = notes[(b * 5 + Math.floor(b / 16) * 3) % notes.length];
        this.tone(
          root * 4 * n,
          at,
          0.6 + evolution * 0.17,
          0.015 + Math.min(population / 4000, 0.022),
          "sine",
          null,
          Math.sin(b * 2) * 0.65,
        );
      }
      if (danger > 0.18 && b % 2 === 0) {
        this.tone(72, at, 0.18, 0.1 * danger, "sine", 35);
        if (danger > 0.5)
          this.tone(59, at + 0.14, 0.14, 0.06 * danger, "sine", 30);
      }
      if (population > 1100 && b % 4 === 1)
        this.tone(
          root * 8,
          at,
          1.8,
          0.016,
          "triangle",
          null,
          Math.cos(b) * 0.8,
        );
      this.beat++;
      this.nextBeat += 0.375 - danger * 0.055;
    }
  }
  noise(at, duration, volume, frequency = 1000) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx,
      n = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    n.buffer = this.air;
    f.type = "bandpass";
    f.frequency.value = frequency;
    f.Q.value = 0.6;
    g.gain.setValueAtTime(volume * 6, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    n.start(at, 0.5);
    n.stop(at + duration + 0.01);
    n.onended = () => {
      n.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  ready() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [659.25, 880, 1318.51].forEach((f, i) =>
      this.tone(f, t + i * 0.13, 0.85, 0.095, "sine", null, (i - 1) * 0.35),
    );
    this.tone(164.81, t, 0.8, 0.07, "triangle");
  }
  counterCue() {
    if (!this.ctx || this.ctx.currentTime < this.cueLimit) return;
    const t = this.ctx.currentTime;
    this.cueLimit = t + 0.25;
    this.tone(1760, t, 0.075, 0.035, "sine", 1400);
  }
  impact(damage, pan = 0) {
    if (!this.ctx || this.ctx.currentTime < this.impactLimit || damage < 3)
      return;
    const t = this.ctx.currentTime;
    this.impactLimit = t + 0.065;
    const weight = Math.min(1, damage / 180);
    this.tone(
      210 + weight * 100,
      t,
      0.1,
      0.06 + weight * 0.1,
      "triangle",
      55,
      pan,
    );
    this.tone(920, t, 0.045, 0.025, "sine", 250, pan);
    this.noise(t, 0.07, 0.07 + weight * 0.06, 1400);
  }
  attackWindup(lance = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (lance) {
      this.tone(140, t, 0.18, 0.065, "triangle", 580);
      this.noise(t + 0.14, 0.17, 0.14, 1600);
      this.tone(580, t + 0.18, 0.23, 0.04, "sine", 90);
    } else this.noise(t, 0.09, 0.06, 850);
  }
  decoy() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(1046, t, 0.13, 0.06, "sine", 1568);
    this.tone(784, t + 0.09, 0.3, 0.05, "triangle", 392);
  }
  shed() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(440, t, 0.22, 0.04, "sine", 880);
    this.noise(t, 0.12, 0.09, 2200);
  }
  evade() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.25, 0.18, 800);
    this.tone(620, t, 0.25, 0.06, "sine", 110);
  }
  feed(pan = 0) {
    if (!this.ctx || this.ctx.currentTime < this.feedLimit) return;
    const t = this.ctx.currentTime;
    this.feedLimit = t + 0.075;
    const notes = [587.33, 659.25, 783.99, 880, 1174.66];
    const note = notes[this.beat % notes.length];
    this.tone(note, t, 0.22, 0.055, "sine", note * 1.4, pan);
  }
  pulse(storm = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(storm ? 130 : 95, t, 1.2, 0.3, "sine", 28);
    this.tone(450, t, 0.55, 0.08, "triangle", 70);
    this.tone(1200, t, 0.18, 0.03, "sine", 230);
  }
  evolve() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [293.66, 440, 587.33, 880, 1174.66].forEach((f, i) =>
      this.tone(f, t + i * 0.11, 2, 0.075, "sine", null, (i - 2) * 0.3),
    );
  }
  interrupt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(880, t, 0.2, 0.07, "sine", 1320);
    this.tone(440, t + 0.08, 0.4, 0.07, "sine");
  }
  hurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(180, t, 0.11, 0.095, "triangle", 42);
    this.noise(t, 0.095, 0.12, 550);
  }
  kill() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(58, t, 0.65, 0.21, "sine", 23);
    [440, 587, 880].forEach((n, i) => this.tone(n, t + i * 0.08, 0.4, 0.05));
  }
  encounter() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(36.7, t, 4, 0.26, "sine", 29);
    this.tone(77.78, t, 3, 0.08, "triangle", 58);
  }
  suspend(delay = 0) {
    clearTimeout(this.suspendTimer);
    if (!this.ctx) return;
    if (delay)
      this.suspendTimer = setTimeout(() => this.ctx.suspend(), delay * 1000);
    else this.ctx.suspend();
  }
  resume() {
    clearTimeout(this.suspendTimer);
    if (this.ctx && this.enabled) {
      this.ctx.resume();
      this.nextBeat = this.ctx.currentTime;
    }
  }
}
