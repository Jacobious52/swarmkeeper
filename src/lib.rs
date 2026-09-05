use bevy_ecs::prelude::*;
use std::ops::{Add, AddAssign, Mul, Sub};
use wasm_bindgen::prelude::*;

const MAX_CELLS: usize = 8000;
const WORLD: f32 = 2600.;
const EVOLUTION_FOOD: [u32; 6] = [75, 170, 300, 460, 650, 880];
const EVOLUTION_TIME: [f32; 6] = [25., 50., 75., 100., 125., 150.];
const TAU: f32 = std::f32::consts::TAU;
#[derive(Clone, Copy, Default, Debug)]
struct V {
    x: f32,
    y: f32,
}
impl V {
    fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }
    fn len(self) -> f32 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
    fn len2(self) -> f32 {
        self.x * self.x + self.y * self.y
    }
    fn dot(self, b: Self) -> f32 {
        self.x * b.x + self.y * b.y
    }
    fn norm(self) -> Self {
        self * (1. / self.len().max(0.001))
    }
    fn limit(self, m: f32) -> Self {
        if self.len() > m {
            self.norm() * m
        } else {
            self
        }
    }
    fn angle(a: f32) -> Self {
        Self::new(a.cos(), a.sin())
    }
}
impl Add for V {
    type Output = Self;
    fn add(self, b: Self) -> Self {
        Self::new(self.x + b.x, self.y + b.y)
    }
}
impl Sub for V {
    type Output = Self;
    fn sub(self, b: Self) -> Self {
        Self::new(self.x - b.x, self.y - b.y)
    }
}
impl Mul<f32> for V {
    type Output = Self;
    fn mul(self, b: f32) -> Self {
        Self::new(self.x * b, self.y * b)
    }
}
impl AddAssign for V {
    fn add_assign(&mut self, b: Self) {
        *self = *self + b;
    }
}
#[derive(Component)]
struct Cell {
    p: V,
    v: V,
    phase: f32,
    shell: f32,
    lobe: usize,
    strike: f32,
}
#[derive(Component)]
struct Ally {
    p: V,
    v: V,
    phase: f32,
    colony: usize,
}
struct Wake {
    p: V,
    life: f32,
    heading: f32,
    cells: [V; 48],
}
struct Remnant {
    p: V,
    target: V,
    age: f32,
    phase: f32,
}
struct Arm {
    p: [V; 13],
    v: [V; 13],
}
#[derive(Clone, Copy)]
struct Limb {
    a: V,
    b: V,
    active: bool,
    width: f32,
}
#[derive(Component)]
struct Food {
    p: V,
    phase: f32,
    cooldown: f32,
}
#[derive(Component)]
struct Creature {
    p: V,
    v: V,
    home: V,
    phase: f32,
    kind: u8,
    hp: f32,
    max_hp: f32,
    hurt: f32,
    state: u8,
    age: f32,
    heading: f32,
    target: V,
    report: f32,
    damage: f32,
    pattern: u8,
    stagger_lock: f32,
    practice: bool,
    opening: f32,
    cued: bool,
    decoy: bool,
}
// Perception data is reused across ticks; threats are culled before cell-level checks.
#[derive(Clone, Copy)]
struct Threat {
    p: V,
    kind: u8,
    state: u8,
    age: f32,
    heading: f32,
    pattern: u8,
}
const GRID_SIDE: i32 = 384;
struct SpatialGrid {
    heads: Vec<i32>,
    next: Vec<i32>,
    points: Vec<(V, V)>,
    used: Vec<usize>,
}
impl SpatialGrid {
    fn new() -> Self {
        Self {
            heads: vec![-1; (GRID_SIDE * GRID_SIDE) as usize],
            next: Vec::with_capacity(MAX_CELLS),
            points: Vec::with_capacity(MAX_CELLS),
            used: Vec::with_capacity(MAX_CELLS),
        }
    }
    fn coord(p: V) -> (i32, i32) {
        (
            (p.x / 22.).floor() as i32 + GRID_SIDE / 2,
            (p.y / 22.).floor() as i32 + GRID_SIDE / 2,
        )
    }
    fn reset(&mut self) {
        for &i in &self.used {
            self.heads[i] = -1;
        }
        self.used.clear();
        self.points.clear();
        self.next.clear();
    }
    fn insert(&mut self, p: V, v: V) {
        let (x, y) = Self::coord(p);
        let i = (y.clamp(0, GRID_SIDE - 1) * GRID_SIDE + x.clamp(0, GRID_SIDE - 1)) as usize;
        if self.heads[i] < 0 {
            self.used.push(i);
        }
        self.next.push(self.heads[i]);
        self.heads[i] = self.points.len() as i32;
        self.points.push((p, v));
    }
    #[inline]
    fn visit(&self, p: V, reach: i32, limit: usize, mut f: impl FnMut(V, V)) {
        let (x, y) = Self::coord(p);
        for yy in (y - reach).max(0)..=(y + reach).min(GRID_SIDE - 1) {
            for xx in (x - reach).max(0)..=(x + reach).min(GRID_SIDE - 1) {
                let mut i = self.heads[(yy * GRID_SIDE + xx) as usize];
                let mut n = 0;
                while i >= 0 && n < limit {
                    let (p, v) = self.points[i as usize];
                    f(p, v);
                    i = self.next[i as usize];
                    n += 1;
                }
            }
        }
    }
}
impl Creature {
    fn windup(&self) -> f32 {
        match self.kind {
            1 => 1.15,
            2 => 1.8,
            3 => 2.2,
            4 => 1.4,
            _ => 1.25,
        }
    }
    fn attack_time(&self) -> f32 {
        match self.kind {
            1 => 0.7,
            2 => 1.2,
            3 => {
                if self.pattern.is_multiple_of(2) {
                    1.8
                } else {
                    1.0
                }
            }
            4 => 1.2,
            _ => 1.5,
        }
    }
    fn rest_time(&self) -> f32 {
        self.opening
    }
    fn interruptible(&self) -> bool {
        self.state == 1 && self.stagger_lock <= 0. && self.age >= self.windup() * 0.62
    }
    fn vulnerability(&self, from: V) -> f32 {
        if self.state == 3 {
            return if self.kind == 3 { 1.6 } else { 1.25 };
        }
        if self.kind == 0 {
            return 0.;
        }
        if self.kind == 1 && (from - self.p).norm().dot(V::angle(self.heading)) < -0.35 {
            return 0.65;
        }
        if self.kind == 3 { 0.015 } else { 0.04 }
    }
    fn transition(&mut self, state: u8) {
        self.state = state;
        self.age = 0.;
        self.cued = false;
        if state == 3 {
            self.opening = if self.kind == 3 { 3.2 } else { 2.1 };
        }
    }
}
fn turn_toward(from: f32, to: f32, step: f32) -> f32 {
    let delta = (to - from + std::f32::consts::PI).rem_euclid(TAU) - std::f32::consts::PI;
    from + delta.clamp(-step, step)
}
fn segment_distance(p: V, a: V, b: V) -> f32 {
    let d = b - a;
    (p - (a + d * ((p - a).dot(d) / d.len2().max(0.01)).clamp(0., 1.))).len()
}
fn danger_at(th: Threat, p: V, mode: u32) -> f32 {
    let d = p - th.p;
    let dist2 = d.len2();
    if dist2 > 360. * 360. {
        return 0.;
    }
    let dist = dist2.sqrt();
    let area = if mode == 1 {
        2.3
    } else if mode == 2 {
        0.45
    } else {
        1.
    };
    match th.kind {
        1 => {
            if th.state == 2 && dist < 37. {
                5.5
            } else if dist < 24. {
                0.12
            } else {
                0.
            }
        }
        2 | 4 => {
            let wave = th.age / 1.2 * if th.kind == 2 { 205. } else { 250. };
            let lane = th.kind != 4 || ((d.y.atan2(d.x) - th.heading) * 4.).sin().abs() < 0.35;
            if th.state == 2 && (dist - wave).abs() < 26. && lane {
                2.8 * area
            } else if dist < 25. {
                0.1
            } else {
                0.
            }
        }
        3 => {
            if th.state == 2 {
                if th.pattern.is_multiple_of(2) {
                    let wave = 330. * (1. - th.age / 1.8).max(0.);
                    if (dist - wave).abs() < 45. {
                        6. * area
                    } else {
                        0.
                    }
                } else if dist < 110. {
                    4.5
                } else {
                    0.
                }
            } else if dist < 70. && th.state != 3 {
                0.45
            } else {
                0.
            }
        }
        5 if th.state == 2 && dist < 270. && d.norm().dot(V::angle(th.heading)) > 0.78 => {
            1.0 * area
        }
        _ => 0.,
    }
}
#[derive(Clone)]
struct Nursery {
    p: V,
    need: usize,
    charge: f32,
    awake: bool,
}
#[derive(Clone, Copy)]
struct Event {
    kind: f32,
    p: V,
    value: f32,
}
struct Rng(u32);
impl Rng {
    fn next(&mut self) -> f32 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 17;
        self.0 ^= self.0 << 5;
        self.0 as f32 / u32::MAX as f32
    }
    fn disk(&mut self, r: f32) -> V {
        V::angle(self.next() * TAU) * (self.next().sqrt() * r)
    }
}
/// Bevy ECS is the authoritative simulation. The host only supplies intent and renders snapshots.
#[wasm_bindgen]
pub struct Swarm {
    world: World,
    rng: Rng,
    center: V,
    time: f32,
    population: usize,
    nutrients: u32,
    energy: f32,
    cooldown: f32,
    pulse_age: f32,
    traits: u32,
    evolution: u32,
    nursery: Vec<Nursery>,
    events: Vec<Event>,
    frame: Vec<f32>,
    event_frame: Vec<f32>,
    boss_spawned: bool,
    boss_dead: bool,
    won: bool,
    demo: bool,
    danger: f32,
    lost: u32,
    grid: SpatialGrid,
    threats: Vec<Threat>,
    dead: Vec<Entity>,
    dealt: f32,
    casualties: f32,
    gained: f32,
    interrupted: u32,
    tutorial: bool,
    lesson: u32,
    lesson_progress: f32,
    heading: f32,
    active_mode: u32,
    attack_clock: f32,
    guard_cooldown: f32,
    outlines: [[f32; 32]; 2],
    groups: [V; 2],
    wake_path: [V; 32],
    current: V,
    remnants: Vec<Remnant>,
    arms: Vec<Arm>,
    limbs: Vec<Limb>,
    wakes: Vec<Wake>,
    wake_clock: f32,
    ally_clock: f32,
    absorb_cooldown: f32,
    ally_count: usize,
    benchmark_limit: usize,
    evade_lock: bool,
    attack_held: bool,
    lash_age: f32,
    lash_heading: f32,
    lash_origin: V,
    lash_side: f32,
    lash_cooldown: f32,
    last_evolution: f32,
    foes: Vec<(V, u8)>,
    ally_points: Vec<V>,
}
#[wasm_bindgen]
impl Swarm {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32, demo: bool) -> Self {
        let mut s = Self {
            world: World::new(),
            rng: Rng(seed.max(1)),
            center: V::default(),
            time: 0.,
            population: 0,
            nutrients: 0,
            energy: 100.,
            cooldown: 0.,
            pulse_age: 10.,
            traits: 0,
            evolution: 0,
            nursery: vec![
                Nursery {
                    p: V::new(420., -100.),
                    need: 220,
                    charge: 0.,
                    awake: false,
                },
                Nursery {
                    p: V::new(-880., -620.),
                    need: 500,
                    charge: 0.,
                    awake: false,
                },
                Nursery {
                    p: V::new(1220., 720.),
                    need: 900,
                    charge: 0.,
                    awake: false,
                },
            ],
            events: vec![],
            frame: Vec::with_capacity(70000),
            event_frame: vec![],
            boss_spawned: false,
            boss_dead: false,
            won: false,
            demo,
            danger: 0.,
            lost: 0,
            grid: SpatialGrid::new(),
            threats: Vec::with_capacity(48),
            dead: Vec::with_capacity(MAX_CELLS),
            dealt: 0.,
            casualties: 0.,
            gained: 0.,
            interrupted: 0,
            tutorial: false,
            lesson: 0,
            lesson_progress: 0.,
            heading: 0.,
            active_mode: 0,
            attack_clock: 0.,
            guard_cooldown: 0.,
            outlines: [[80.; 32]; 2],
            groups: [V::default(); 2],
            wake_path: [V::default(); 32],
            current: V::default(),
            remnants: Vec::with_capacity(180),
            arms: vec![],
            limbs: Vec::with_capacity(72),
            wakes: Vec::with_capacity(12),
            wake_clock: 0.,
            ally_clock: 0.,
            absorb_cooldown: 0.,
            ally_count: 0,
            benchmark_limit: 0,
            evade_lock: false,
            attack_held: false,
            lash_age: -1.,
            lash_heading: 0.,
            lash_origin: V::default(),
            lash_side: 1.,
            lash_cooldown: 0.,
            last_evolution: -100.,
            foes: Vec::with_capacity(48),
            ally_points: Vec::with_capacity(64),
        };
        s.grow(if demo { 720 } else { 160 }, V::default());
        for i in 0..125 {
            let p = if i < 20 {
                V::angle(i as f32 * 2.4) * (170. + i as f32 * 27.)
            } else {
                {
                    let mut p = s.rng.disk(WORLD - 140.);
                    if p.len() < 650. {
                        p = p.norm() * 700.;
                    }
                    p
                }
            };
            for _ in 0..14 {
                let f = Food {
                    p: p + s.rng.disk(70.),
                    phase: s.rng.next() * TAU,
                    cooldown: 0.,
                };
                s.world.spawn(f);
            }
        }
        for i in 0..30 {
            let p = if i < 6 {
                V::angle(i as f32 * 1.4) * (620. + i as f32 * 115.)
            } else {
                {
                    let mut p = s.rng.disk(2300.);
                    if p.len() < 850. {
                        p = p.norm() * 900.;
                    }
                    p
                }
            };
            s.spawn_creature(
                p,
                match i % 7 {
                    0 => 2,
                    1 => 4,
                    2 => 5,
                    3 | 4 => 1,
                    _ => 0,
                },
            );
        }
        s
    }
    pub fn step(&mut self, dt: f32, x: f32, y: f32, mode: u32, surge: bool) {
        if self.population == 0 || self.won {
            return;
        }
        let dt = dt.clamp(0., 0.033334);
        self.time += dt;
        self.events.clear();
        self.dealt *= (-dt * 2.).exp();
        self.casualties *= (-dt * 2.).exp();
        self.gained *= (-dt * 2.).exp();
        self.pulse_age += dt;
        self.cooldown = (self.cooldown - dt).max(0.);
        let evade_requested = surge;
        if !evade_requested {
            self.evade_lock = false;
        }
        if self.energy < 2. && evade_requested {
            self.evade_lock = true;
        }
        let surge = evade_requested && self.energy > 1. && !self.evade_lock;
        let lance = self.traits & 32 != 0;
        self.lash_cooldown = (self.lash_cooldown - dt).max(0.);
        let lash_before = self.lash_age;
        if self.lash_age >= 0. {
            self.lash_age += dt;
            if self.lash_age > 0.72 || evade_requested {
                self.lash_age = -1.;
            }
        }
        if mode == 1 && !self.attack_held && !evade_requested && lance {
            self.begin_lash(V::new(x, y));
        }
        self.attack_held = mode == 1;
        let lashing = self.lash_age >= 0.;
        let mode = if surge {
            3
        } else if evade_requested {
            0
        } else if lance && lashing {
            1
        } else if lance && mode == 1 {
            0
        } else {
            mode.min(2)
        };
        if mode != self.active_mode {
            self.attack_clock = 0.;
            if mode == 3 {
                self.events.push(Event {
                    kind: 18.,
                    p: self.center,
                    value: 1.,
                });
            }
        }
        self.active_mode = mode;
        self.guard_cooldown = (self.guard_cooldown - dt).max(0.);
        self.absorb_cooldown = (self.absorb_cooldown - dt).max(0.);
        let period = 0.46;
        let before = self.attack_clock;
        self.attack_clock = (self.attack_clock + dt) % period;
        if mode == 1 && !lance && before < 0.02 && self.attack_clock >= 0.02 {
            self.events.push(Event {
                kind: 17.,
                p: self.center,
                value: 0.,
            });
        }
        let strike_now = mode == 1
            && if lance {
                lash_before < 0.34 && self.lash_age >= 0.34
            } else {
                before < 0.18 && self.attack_clock >= 0.18
            };
        if surge && self.traits & 64 != 0 {
            self.wake_clock -= dt;
            if self.wake_clock <= 0. && self.wakes.len() < 5 {
                let mut cells = [V::default(); 48];
                for (i, c) in self
                    .world
                    .query::<&Cell>()
                    .iter(&self.world)
                    .step_by((self.population / 48).max(1))
                    .take(48)
                    .enumerate()
                {
                    cells[i] = c.p;
                }
                self.wakes.push(Wake {
                    p: self.center,
                    life: 2.6,
                    heading: self.heading,
                    cells,
                });
                self.wake_clock = 0.65;
                self.events.push(Event {
                    kind: 20.,
                    p: self.center,
                    value: 1.,
                });
            }
        } else {
            self.wake_clock = 0.;
        }
        for w in &mut self.wakes {
            w.life -= dt;
        }
        self.wakes.retain(|w| w.life > 0.);
        for r in &mut self.remnants {
            r.age += dt;
            r.p += (r.target - r.p) * dt * 9.;
        }
        self.remnants.retain(|r| r.age < 0.35);
        self.energy = (self.energy + dt * if surge { -24. } else { 9. }).clamp(0., 100.);
        let bound = if self.tutorial { 470. } else { WORLD };
        let aim = V::new(x.clamp(-bound, bound), y.clamp(-bound, bound));
        let desired = aim - self.center;
        if desired.len2() > 144. && !lashing {
            self.heading = turn_toward(self.heading, desired.y.atan2(desired.x), dt * 6.);
        }
        let axis = V::angle(self.heading);
        let side = V::new(-axis.y, axis.x);
        let old = self.center;
        self.center += (aim - self.center).limit(if surge {
            if self.traits & 64 != 0 { 560. } else { 390. }
        } else if mode == 1 {
            155.
        } else if mode == 2 {
            235.
        } else {
            215.
        }) * dt;
        let drift = (self.center - old) * (1. / dt.max(0.0001));
        let n = self.population;
        let radius = (n as f32).sqrt() * 4.0 + 12.;
        let spread = if mode == 1 {
            0.43
        } else if mode == 2 {
            1.8
        } else {
            1.
        };
        let fork = !surge && self.traits & 2 != 0;
        // The wake remembers the route through water instead of rotating a rigid formation.
        self.current += (drift - self.current) * (dt * 3.).min(1.);
        self.wake_path[0] = self.center;
        let spacing = radius * 0.072 + 2.;
        for i in 1..self.wake_path.len() {
            let d = self.wake_path[i - 1] - self.wake_path[i];
            let length = d.len();
            if length > spacing {
                self.wake_path[i] += d * ((length - spacing) / length);
            }
        }
        let lobe_offset = (radius * 0.82 + 65.) * (1. + 0.12 * (self.time * 0.65).sin());
        let wanted = if fork {
            [
                self.center - side * lobe_offset
                    + axis * (radius * 0.22 * (self.time * 0.72).sin()),
                self.center
                    + side * lobe_offset
                    + axis * (radius * 0.19 * (self.time * 0.61 + 2.).sin()),
            ]
        } else {
            [self.center; 2]
        };
        for (g, goal) in self.groups.iter_mut().zip(wanted) {
            *g += (goal - *g) * (dt * 4.).min(1.);
        }
        let shield = self.traits & 1 != 0;
        let cilia = self.traits & 8 != 0;
        let brood = self.traits & 16 != 0;
        let lance = self.traits & 32 != 0;
        self.grid.reset();
        let mut outline = [[0_f32; 32]; 2];
        for c in self.world.query::<&Cell>().iter(&self.world) {
            self.grid.insert(c.p, c.v);
            if shield && c.phase >= 0.7 {
                let group = if fork { c.lobe } else { 0 };
                let d = c.p - self.groups[group];
                let bin = (((d.y.atan2(d.x) + TAU) % TAU) / TAU * 32.) as usize % 32;
                outline[group][bin] = outline[group][bin].max(d.len());
            }
        }
        if shield {
            for (g, row) in outline.iter().enumerate() {
                for i in 0..32 {
                    let local = row[i]
                        .max(row[(i + 1) % 32] * 0.94)
                        .max(row[(i + 31) % 32] * 0.94);
                    let target = local.max(radius * if fork { 0.35 } else { 0.25 }) + 22.;
                    self.outlines[g][i] += (target - self.outlines[g][i]) * (dt * 9.).min(1.);
                }
            }
        }
        self.threats.clear();
        for c in self.world.query::<&Creature>().iter(&self.world) {
            if c.kind > 0 && (c.p - self.center).len2() < (radius * spread + 550.).powi(2) {
                self.threats.push(Threat {
                    p: c.p,
                    kind: c.kind,
                    state: c.state,
                    age: c.age,
                    heading: c.heading,
                    pattern: c.pattern,
                });
            }
        }
        self.foes.clear();
        self.foes.extend(
            self.world
                .query::<&Creature>()
                .iter(&self.world)
                .map(|c| (c.p, c.kind)),
        );
        let foes = &self.foes;
        self.dead.clear();
        let t = self.time;
        let mut attack_targets = self.groups;
        let mut target_distance = [f32::INFINITY; 2];
        for th in &self.threats {
            for g in 0..if fork { 2 } else { 1 } {
                let d = (th.p - self.groups[g]).len2();
                if d < (radius + 230.).powi(2) && d < target_distance[g] {
                    target_distance[g] = d;
                    let flank = if fork {
                        side * if g == 0 { -45. } else { 45. }
                    } else {
                        V::default()
                    };
                    attack_targets[g] = th.p + flank;
                }
            }
        }
        for (entity, mut c) in self
            .world
            .query::<(Entity, &mut Cell)>()
            .iter_mut(&mut self.world)
        {
            let group = if fork { c.lobe } else { 0 };
            let local_radius = radius * if fork { 0.55 } else { 1. };
            let local_spread = if fork {
                if mode == 2 { 1.5 } else { 1. }
            } else {
                spread
            };
            let scale = (local_radius * local_spread).max(24.);
            let rel = c.p - self.groups[group];
            let normalized = rel * (1. / scale);
            // Soft pressure and a divergence-free eddy field. Cells are never assigned polar slots.
            let density = (rel.len2() / (scale * scale)).min(16.);
            let pressure = rel * (-(0.26 + density * 0.62));
            let flow = V::new(
                (normalized.y * 2.3 + t * 0.72 + group as f32).sin()
                    + 0.55 * (normalized.y * 4.1 - t * 0.47).sin(),
                (normalized.x * 2.0 - t * 0.61).cos() - 0.6 * (normalized.x * 3.7 + t * 0.39).cos(),
            ) * (28. + scale * 0.8);
            let driftlet = V::angle(c.phase + t * (0.55 + c.shell * 0.23)) * 26.;
            let mut goal = c.p + (pressure + flow + driftlet) * 0.125;
            c.strike = (c.strike - dt * 7.).max(0.);
            if mode == 1 && target_distance[group].is_finite() && !lance {
                let phase = (self.attack_clock + c.phase * 0.018) / period;
                let bite = ((phase - 0.18 / period) * 12.).cos().max(0.).powi(4);
                goal += (attack_targets[group] - goal) * (0.36 + bite * 0.52);
                if strike_now {
                    c.strike = 1.;
                }
            }
            if shield && c.phase < 0.7 && !surge {
                let a = (rel.y.atan2(rel.x) + TAU).rem_euclid(TAU);
                let bin = (a / TAU * 32.) as usize % 32;
                let boundary =
                    self.outlines[group][bin] * (0.76 + 0.17 * (c.phase * 19. + t * 1.4).sin());
                let correction = V::angle(a) * (boundary - rel.len()) * 0.24;
                goal += correction;
            }
            if lance && lashing {
                // A travelling curl pulls a loose ribbon out of the living body, then lets it recoil.
                let u = c.shell;
                let travel = ((self.lash_age - u * 0.065) / 0.62).clamp(0., 1.);
                let extension = (travel * std::f32::consts::PI).sin().max(0.);
                let handed = self.lash_side * if fork && group == 1 { -1. } else { 1. };
                let lash_axis = V::angle(self.lash_heading);
                let lash_side = V::new(-lash_axis.y, lash_axis.x);
                let curl = (u * 3.8 - travel * 4.5).sin() * (1. - travel) * handed;
                let reach = (radius * 0.8 + 185.).clamp(230., 440.);
                let width = (0.3 + 0.7 * (1. - u)) * local_radius * 0.48;
                let ribbon = self.lash_origin
                    + lash_axis * (u * reach * extension - radius * 0.25)
                    + lash_side
                        * (curl * radius * 0.65 * u
                            + c.phase.sin() * width
                            + if fork {
                                if group == 0 { -38. } else { 38. }
                            } else {
                                0.
                            });
                goal = goal * (1. - extension * 0.93) + ribbon * (extension * 0.93);
                if strike_now {
                    c.strike = 1.;
                }
            }
            if surge {
                let slip = self.traits & 64 != 0;
                let u = c.shell * c.shell;
                let along = u * if slip { 30. } else { 24. };
                let i = along.floor() as usize;
                let f = along.fract();
                let path = self.wake_path[i] * (1. - f) + self.wake_path[i + 1] * f;
                let d = self.wake_path[i] - self.wake_path[(i + 2).min(31)];
                let tangent = if d.len2() > 1. { d.norm() } else { axis };
                let normal = V::new(-tangent.y, tangent.x);
                let taper = (u * std::f32::consts::PI).sin().max(0.).sqrt();
                let width = (local_radius * 0.3 + 12.)
                    * (0.16 + taper * 0.84)
                    * (0.78 + 0.22 * (u * 10. - t * 2.4).sin());
                let curl = (u * 7. - t * if slip { 3.2 } else { 2.1 }).sin() * width * 0.4;
                goal = path
                    + normal * (c.phase.sin() * width + curl)
                    + tangent * (c.phase.cos() * width * 0.25);
            }
            let mut sep = V::default();
            let mut align = V::default();
            let mut count = 0.;
            self.grid.visit(c.p, 1, 18, |p, v| {
                let d = c.p - p;
                let len2 = d.len2();
                if len2 > 0.0001 && len2 < 324. {
                    sep += d * (1. / (len2 + 1.));
                    align += v;
                    count += 1.;
                }
            });
            let stiffness = if surge {
                22.
            } else if mode == 1 {
                if lashing { 65. } else { 15. }
            } else {
                8.
            };
            let mut force = (goal - c.p) * stiffness
                + drift * 3.8
                + self.current * 1.2
                + sep * if surge { 180. } else { 520. };
            if count > 0. {
                force += (align * (1. / count) - c.v) * if surge { 0.7 } else { 1.15 };
            }
            force += V::angle(c.phase * 5. + t * 2.) * 18.;
            let mut danger = 0.;
            for &th in &self.threats {
                let d = c.p - th.p;
                let dist2 = d.len2();
                if dist2 > 360. * 360. {
                    continue;
                }
                let dist = dist2.sqrt();
                if th.state == 1
                    && (th.kind == 2 || (th.kind == 3 && th.pattern.is_multiple_of(2)))
                    && dist < 310.
                {
                    force +=
                        (th.p - c.p).norm() * (310. - dist) * if mode == 1 { 0.7 } else { 2.4 };
                }
                // Flow has instinctive avoidance; attack formation commits to the target.
                if mode != 1 && dist < 70. && th.state != 3 {
                    force += d.norm() * (70. - dist) * 6.;
                }
                danger += danger_at(th, c.p, mode);
            }
            if self.boss_spawned {
                for limb in &self.limbs {
                    if limb.active
                        && (c.p - (limb.a + limb.b) * 0.5).len2() < 4900.
                        && segment_distance(c.p, limb.a, limb.b) < limb.width + 5.
                    {
                        danger += if mode == 1 { 6.5 } else { 3.0 };
                        break; // Adjacent joints are one contact, not stacked hits.
                    }
                }
            }
            if surge {
                danger *= 0.15;
            }
            if !self.demo
                && !self.tutorial
                && danger > 0.
                && self.rng.next() < dt * danger * if shield { 0.65 } else { 1. }
            {
                self.dead.push(entity);
            }
            let damping = if surge {
                5.
            } else if mode == 1 {
                if lashing { 10. } else { 6.5 }
            } else {
                4.5
            };
            c.v = (c.v + force * dt) * (1. / (1. + dt * damping));
            c.v = c.v.limit(if surge {
                if self.traits & 64 != 0 { 790. } else { 610. }
            } else if mode == 1 {
                if lashing { 1050. } else { 680. }
            } else {
                440.
            });
            let vel = c.v;
            c.p += vel * dt;
            c.p.x = c.p.x.clamp(-3800., 3800.);
            c.p.y = c.p.y.clamp(-3800., 3800.);
        }
        let mut food_eaten = 0;
        let mut spawn_at = self.center;
        for mut f in self.world.query::<&mut Food>().iter_mut(&mut self.world) {
            if f.cooldown > 0. {
                f.cooldown -= dt;
                continue;
            }
            let phase = f.phase;
            f.p += V::angle(t * 0.2 + phase) * dt * 2.;
            if foes
                .iter()
                .any(|(p, k)| *k == 0 && (f.p - *p).len2() < 400.)
            {
                f.cooldown = 45.;
                continue;
            }
            if (f.p - self.center).len2() > (radius * spread + 210.).powi(2) {
                continue;
            }
            let mut nearest2 = 100000.;
            let mut toward = V::default();
            let reach = if cilia { 3 } else { 1 };
            self.grid.visit(f.p, reach, 12, |p, _| {
                let d = p - f.p;
                if d.len2() < nearest2 {
                    nearest2 = d.len2();
                    toward = d;
                }
            });
            let nearest = nearest2.sqrt();
            if cilia && nearest < 70. {
                f.p += toward.norm() * dt * 100.;
            }
            if nearest
                < if mode == 1 {
                    7.
                } else if mode == 2 {
                    17.
                } else {
                    13.
                }
                && !self.demo
                && !evade_requested
                && (!self.tutorial || self.lesson == 1 && mode == 2)
            {
                f.cooldown = 38. + self.rng.next() * 28.;
                food_eaten += 1;
                spawn_at = f.p;
                self.events.push(Event {
                    kind: 0.,
                    p: f.p,
                    value: 1.,
                });
            }
        }
        self.danger = 0.;
        let mut killed = vec![];
        let mut drops = vec![];
        let mut boss_reinforcements = vec![];
        for (e, mut c) in self
            .world
            .query::<(Entity, &mut Creature)>()
            .iter_mut(&mut self.world)
        {
            c.hurt = (c.hurt - dt).max(0.);
            c.report -= dt;
            c.stagger_lock = (c.stagger_lock - dt).max(0.);
            let dist = (self.center - c.p).len();
            if c.kind > 0 {
                self.danger = self.danger.max((1. - dist / 540.).max(0.));
            }
            c.age += dt;
            if c.practice {
                c.v = V::default();
                c.heading = (self.center - c.p).y.atan2((self.center - c.p).x);
                if self.lesson == 2 {
                    c.state = 3;
                } else if self.lesson == 3 && self.lesson_progress < 1. {
                    c.state = 1;
                    c.age = c.windup() * 0.78;
                }
            } else if c.kind == 0 {
                if c.state == 1 {
                    let d = c.target - c.p;
                    c.heading = turn_toward(
                        c.heading,
                        d.y.atan2(d.x),
                        dt * if c.kind == 3 { 1.5 } else { 5. },
                    );
                    if c.interruptible() && !c.cued {
                        c.cued = true;
                        if dist < 600. {
                            self.events.push(Event {
                                kind: 14.,
                                p: c.p,
                                value: 1.,
                            });
                        }
                    }
                }
                let mut dest = c.home + V::angle(t * 0.12 + c.phase) * 190.;
                for &(p, k) in foes {
                    if (k == 1 || k == 5) && (c.p - p).len2() < 250. * 250. {
                        dest = c.p + (c.p - p).norm() * 400.;
                    }
                }
                if dist < radius + 100. {
                    dest = c.p + (c.p - self.center).norm() * 300.;
                }
                c.v = (c.v + (dest - c.p).norm() * dt * 85.) * (1. / (1. + dt * 1.6));
                if foes
                    .iter()
                    .any(|(p, k)| *k == 1 && (c.p - *p).len2() < 35. * 35.)
                {
                    c.hp -= dt * 18.;
                    c.hurt = 0.1;
                }
                let v = c.v;
                c.p += v * dt;
                c.heading = turn_toward(c.heading, v.y.atan2(v.x), dt * 2.);
            } else {
                if c.state == 0 {
                    let dwell = if c.kind == 3 {
                        1.3
                    } else {
                        0.85 + c.phase * 0.16
                    };
                    let retreating = c.kind == 1 && c.hp < c.max_hp * 0.28 && dist < 500.;
                    if dist < if c.kind == 3 { 900. } else { 390. } && c.age > dwell && !retreating
                    {
                        c.pattern = c.pattern.wrapping_add(1);
                        c.target = self.center;
                        if c.kind == 1 && !self.grid.points.is_empty() {
                            // Hunters single out an outer organism, rather than blindly aiming at the centroid.
                            let mut score = 0.;
                            for &(p, _) in self.grid.points.iter().step_by(13) {
                                let d = (p - self.center).len2();
                                if d > score && (p - c.p).len2() < 500. * 500. {
                                    score = d;
                                    c.target = p;
                                }
                            }
                        }
                        c.decoy = false;
                        c.transition(1);
                    }
                } else if c.state == 1 && c.age >= c.windup() {
                    c.transition(2);
                } else if c.state == 2 && c.age >= c.attack_time() {
                    c.transition(3);
                } else if c.state == 3 && c.age >= c.rest_time() {
                    c.transition(0);
                }
                if c.kind == 1
                    && c.state == 1
                    && c.age < c.windup() * 0.62
                    && !c.decoy
                    && let Some(w) = self
                        .wakes
                        .iter()
                        .filter(|w| w.life > 0.5 && (w.p - c.p).len2() < 500. * 500.)
                        .min_by(|a, b| (a.p - c.p).len2().total_cmp(&(b.p - c.p).len2()))
                {
                    c.target = w.p;
                    c.decoy = true;
                    self.events.push(Event {
                        kind: 19.,
                        p: c.p,
                        value: 1.,
                    });
                }
                if c.state == 1 {
                    let d = c.target - c.p;
                    c.heading = turn_toward(
                        c.heading,
                        d.y.atan2(d.x),
                        dt * if c.kind == 3 { 1.5 } else { 5. },
                    );
                    if c.interruptible() && !c.cued {
                        c.cued = true;
                        if dist < 600. {
                            self.events.push(Event {
                                kind: 14.,
                                p: c.p,
                                value: 1.,
                            });
                        }
                    }
                }
                let mut dest = c.home + V::angle(t * 0.10 + c.phase) * 150.;
                let mut speed = if c.kind == 2 || c.kind == 4 { 14. } else { 60. };
                if c.kind == 3 {
                    dest = self.center + V::angle(t * 0.13) * 300.;
                    speed = 75.;
                } else if c.kind == 5 {
                    // Rays defend a feeding territory; they do not converge from across the world.
                    let in_territory = (self.center - c.home).len2() < 600. * 600.;
                    dest = if in_territory {
                        self.center + V::angle(t * 0.30 + c.phase) * 290.
                    } else {
                        c.home + V::angle(t * 0.18 + c.phase) * 190.
                    };
                    speed = if in_territory { 115. } else { 45. };
                } else if c.kind == 1 {
                    speed = 100.;
                    let mut nearest = 500.;
                    for &(p, k) in foes {
                        if k == 0 && (p - c.p).len() < nearest {
                            nearest = (p - c.p).len();
                            dest = p;
                        }
                    }
                    if dist < 340. {
                        dest = self.center
                            + V::angle(
                                self.heading
                                    + if c.phase < std::f32::consts::PI {
                                        1.7
                                    } else {
                                        -1.7
                                    },
                            ) * 210.;
                        if c.hp < c.max_hp * 0.28 {
                            dest = c.p + (c.p - self.center).norm() * 320.;
                            speed = 170.;
                        }
                    }
                }
                if c.kind == 2 || c.kind == 4 {
                    dest = c.home;
                    speed = 10.;
                }
                if c.state == 1 || c.state == 3 {
                    speed = if c.kind == 5 { 25. } else { 0. };
                }
                if c.state == 2 && (c.kind == 1 || c.kind == 3 && c.pattern % 2 == 1) {
                    c.v = V::angle(c.heading) * if c.kind == 3 { 300. } else { 355. };
                } else {
                    c.v = (c.v + (dest - c.p).norm() * speed * dt * 3.) * (1. / (1. + dt * 3.));
                }
                let v = c.v;
                c.p += v * dt;
                if c.state == 0 && v.len2() > 100. {
                    c.heading = turn_toward(
                        c.heading,
                        v.y.atan2(v.x),
                        dt * if c.kind == 3 { 0.65 } else { 2.4 },
                    );
                }
                if shield
                    && c.kind == 1
                    && c.state == 2
                    && self.guard_cooldown <= 0.
                    && self.energy > 8.
                {
                    for g in 0..if fork { 2 } else { 1 } {
                        let d = c.p - self.groups[g];
                        let a = (d.y.atan2(d.x) + TAU) % TAU;
                        let boundary = self.outlines[g][(a / TAU * 32.) as usize % 32];
                        if (d.len() - boundary).abs() < 55. {
                            c.v = d.norm() * 300.;
                            c.transition(0);
                            self.guard_cooldown = 1.1;
                            self.energy -= 8.;
                            self.events.push(Event {
                                kind: 16.,
                                p: c.p,
                                value: 1.,
                            });
                            break;
                        }
                    }
                }
                if c.kind == 3 {
                    let tier = if c.hp / c.max_hp < 0.34 {
                        2
                    } else if c.hp / c.max_hp < 0.67 {
                        1
                    } else {
                        0
                    };
                    if tier as f32 > c.phase {
                        c.phase = tier as f32;
                        boss_reinforcements.push(c.p);
                        self.events.push(Event {
                            kind: 10.,
                            p: c.p,
                            value: tier as f32,
                        });
                    }
                }
            }
            if c.kind > 0 && mode == 1 && strike_now && dist < radius * spread + 450. {
                let mut attackers = 0.;
                let mut flanks = [0_u32; 2];
                let hit_radius = if c.kind == 3 { 115. } else { 70. };
                self.grid.visit(c.p, 6, usize::MAX, |p, _| {
                    if (p - c.p).len2() < hit_radius * hit_radius {
                        attackers += 1.;
                        flanks[usize::from((p - c.p).dot(side) > 0.)] += 1;
                    }
                });
                if attackers > 0. {
                    let pincer = fork && flanks[0] >= 6 && flanks[1] >= 6;
                    let vulnerability = if pincer {
                        c.vulnerability(self.center).max(0.38)
                    } else {
                        c.vulnerability(self.center)
                    };
                    let rate = if mode == 1 && strike_now {
                        f32::sqrt(attackers).min(28.) * if lance { 46. } else { 9. }
                    } else {
                        0.
                    };
                    let vulnerability = if lance && mode == 1 {
                        vulnerability.max(0.32)
                    } else {
                        vulnerability
                    };
                    let damage = rate * vulnerability;
                    c.hp -= damage;
                    c.damage += damage;
                    self.dealt += damage * 2.;
                    if damage > 0.12 {
                        c.hurt = 0.12;
                        let recoil =
                            (c.p - self.center).norm() * if c.kind == 3 { 12. } else { 85. };
                        c.v += recoil;
                        self.events.push(Event {
                            kind: 12.,
                            p: c.p,
                            value: damage,
                        });
                    }
                    if strike_now {
                        if c.damage >= 1. || vulnerability < 0.1 {
                            self.events.push(Event {
                                kind: if vulnerability < 0.1 { 8. } else { 7. },
                                p: c.p,
                                value: c.damage,
                            });
                        }
                        c.damage = 0.;
                        c.report = 0.4;
                    }
                }
            }
            if c.hp <= 0. {
                killed.push(e);
                drops.push((c.p, c.kind));
                if c.practice && self.lesson == 2 {
                    self.lesson_progress = 1.;
                }
            }
        }
        self.update_arms(dt);
        self.update_allies(dt, strike_now);
        for p in boss_reinforcements {
            self.spawn_creature(p + V::new(280., 100.), 5);
            self.spawn_creature(p + V::new(-280., -100.), 4);
        }
        let mut lost_this_tick = 0.;
        let mut lost_at = V::default();
        for &e in &self.dead {
            if let Some(c) = self.world.get::<Cell>(e) {
                lost_at += c.p;
                if self.remnants.len() < 180 {
                    let target = self
                        .threats
                        .iter()
                        .min_by(|a, b| (a.p - c.p).len2().total_cmp(&(b.p - c.p).len2()))
                        .map_or(c.p, |th| th.p);
                    self.remnants.push(Remnant {
                        p: c.p,
                        target,
                        age: 0.,
                        phase: c.phase,
                    });
                }
            }
            if self.world.despawn(e) {
                self.population -= 1;
                self.lost += 1;
                lost_this_tick += 1.;
            }
        }
        if lost_this_tick > 0. {
            self.casualties += lost_this_tick * 2.;
            self.events.push(Event {
                kind: 2.,
                p: lost_at * (1. / lost_this_tick),
                value: lost_this_tick,
            });
        }
        for e in killed {
            self.world.despawn(e);
        }
        for (p, kind) in drops {
            if kind > 0 && kind != 3 && !self.tutorial {
                self.nutrients += 18;
                self.events.push(Event {
                    kind: 21.,
                    p,
                    value: 18.,
                });
            }
            self.events.push(Event {
                kind: 3.,
                p,
                value: kind as f32,
            });
            if kind == 3 {
                self.boss_dead = true;
            }
            for _ in 0..if kind == 3 { 120 } else { 24 } {
                let food = Food {
                    p: p + self.rng.disk(85.),
                    phase: self.rng.next() * TAU,
                    cooldown: 0.,
                };
                self.world.spawn(food);
            }
        }
        if food_eaten > 0 {
            self.nutrients += food_eaten;
            self.grow(food_eaten as usize * 5, spawn_at);
            if self.tutorial && self.lesson == 1 {
                self.lesson_progress = (self.nutrients as f32 / 8.).min(1.);
            }
            self.energy = (self.energy + food_eaten as f32 * 0.7).min(100.);
        }
        if brood && self.lost >= 5 && self.population > 0 {
            self.lost -= 5;
            self.grow(3, self.center);
        }
        if self.tutorial {
            if self.lesson == 0 && (self.center - V::new(150., 0.)).len() < 35. {
                self.lesson_progress = 1.;
            }
            if self.lesson == 4 && surge && drift.len() > 100. {
                self.lesson_progress = (self.lesson_progress + dt / 1.0).min(1.);
            }
        }
        let mut blooms = vec![];
        for (i, b) in self.nursery.iter_mut().enumerate() {
            if !b.awake {
                if (b.p - self.center).len() < 120. && self.population >= b.need && !self.demo {
                    b.charge = (b.charge + dt / 4.).min(1.);
                } else {
                    b.charge = (b.charge - dt * 0.08).max(0.);
                }
                if b.charge >= 1. {
                    b.awake = true;
                    blooms.push((i, b.p));
                }
            }
        }
        for (i, p) in blooms {
            self.events.push(Event {
                kind: 4.,
                p,
                value: i as f32,
            });
            self.grow(130, p);
            self.nutrients += 26;
            for j in 0..3 {
                self.spawn_creature(p + V::angle(j as f32 * 2.1) * 450., 1);
            }
        }
        if self.awakened() >= 3 && !self.boss_spawned {
            self.boss_spawned = true;
            self.spawn_creature(self.center + V::new(500., -250.), 3);
            self.events.push(Event {
                kind: 5.,
                p: self.center,
                value: 0.,
            });
        }
        if self.boss_dead && !self.won {
            self.won = true;
            self.events.push(Event {
                kind: 6.,
                p: self.center,
                value: 0.,
            });
        }
    }
    pub fn pulse(&mut self) -> bool {
        if self.cooldown > 0.
            || self.energy < 28.
            || self.population == 0
            || self.won
            || self.active_mode == 3
        {
            return false;
        }
        self.events.clear();
        self.cooldown = 4.;
        self.energy -= 28.;
        self.pulse_age = 0.;
        let storm = self.traits & 4 != 0;
        for mut c in self
            .world
            .query::<&mut Creature>()
            .iter_mut(&mut self.world)
        {
            let d = c.p - self.center;
            if d.len() < if storm { 430. } else { 300. } && c.kind > 0 {
                let interrupt = c.interruptible();
                if interrupt {
                    c.transition(3);
                    c.opening = if c.kind == 3 { 1.35 } else { 1.1 };
                    c.stagger_lock = 10.;
                    self.interrupted += 1;
                    self.events.push(Event {
                        kind: 9.,
                        p: c.p,
                        value: 1.,
                    });
                    if c.practice && self.lesson == 3 {
                        self.lesson_progress = 1.;
                    }
                }
                if c.state == 1 && !interrupt {
                    self.events.push(Event {
                        kind: 13.,
                        p: c.p,
                        value: if c.stagger_lock > 0. { 2. } else { 1. },
                    });
                }
                let damage = if storm { 65. } else { 12. } * c.vulnerability(self.center);
                c.hp -= damage;
                self.dealt += damage * 2.;
                c.hurt = 0.3;
                let push = if c.kind == 3 { 8. } else { 85. };
                c.v += d.norm() * push;
            }
        }
        true
    }
    pub fn evolve(&mut self, choice: u32) -> bool {
        if !self.evolution_ready() || choice > 8 || self.traits & (1 << choice) != 0 {
            return false;
        }
        self.traits |= 1 << choice;
        self.evolution += 1;
        self.last_evolution = self.time;
        self.energy = 100.;
        if choice == 7 {
            self.spawn_allies();
        }
        true
    }
    pub fn evolution_ready(&self) -> bool {
        !self.tutorial
            && !self.won
            && self.population > 0
            && self.evolution < 6
            && self.nutrients >= EVOLUTION_FOOD[self.evolution.min(5) as usize]
            && self.time >= EVOLUTION_TIME[self.evolution.min(5) as usize]
            && self.time - self.last_evolution >= 22.
    }
    /// Per-stage requirements are authoritative here, shared by the HUD and journal.
    pub fn evolution_path(&self) -> Vec<f32> {
        EVOLUTION_FOOD
            .iter()
            .zip(EVOLUTION_TIME)
            .enumerate()
            .flat_map(|(i, (&food, at))| {
                [
                    food as f32,
                    if i == self.evolution as usize {
                        at.max(self.last_evolution + 22.)
                    } else {
                        at
                    },
                ]
            })
            .collect()
    }
    pub fn lash(&mut self, x: f32, y: f32) -> bool {
        self.events.clear();
        if self.active_mode == 3 {
            return false;
        }
        self.begin_lash(V::new(x, y))
    }
    pub fn prepare_render(&mut self) {
        self.frame.clear();
        for c in self.world.query::<&Cell>().iter(&self.world) {
            let angle = c.v.y.atan2(c.v.x);
            let trait_color = if self.traits & 32 != 0 && self.active_mode == 1 {
                5.
            } else if self.traits & 1 != 0 && c.phase < 0.7 {
                1.
            } else if self.traits & 4 != 0 && c.phase > 5.5 {
                2.
            } else if self.traits & 8 != 0 && c.phase > 2. && c.phase < 3. {
                3.
            } else if self.traits & 16 != 0 && c.phase > 4. && c.phase < 5. {
                4.
            } else {
                0.
            };
            self.frame.extend_from_slice(&[
                c.p.x,
                c.p.y,
                3. + c.shell * 1.8,
                angle,
                0.,
                trait_color,
                c.v.len() / 240.,
                c.phase
                    + if self.active_mode == 3 {
                        if self.traits & 64 != 0 { 48. } else { 32. }
                    } else if c.strike > 0.2 {
                        16.
                    } else {
                        0.
                    },
            ]);
        }
        for f in self.world.query::<&Food>().iter(&self.world) {
            if f.cooldown <= 0. {
                self.frame.extend_from_slice(&[
                    f.p.x,
                    f.p.y,
                    4.,
                    f.phase + self.time * 0.2,
                    1.,
                    0.,
                    1.,
                    f.phase,
                ]);
            }
        }
        for c in self.world.query::<&Creature>().iter(&self.world) {
            let size = match c.kind {
                0 => 26.,
                1 => 30.,
                2 => 52.,
                3 => 130.,
                4 => 45.,
                _ => 62.,
            };
            self.frame.extend_from_slice(&[
                c.p.x,
                c.p.y,
                size,
                c.heading,
                match c.kind {
                    4 => 9.,
                    5 => 10.,
                    _ => 2. + c.kind as f32,
                },
                c.state as f32 + c.hurt.min(0.45),
                c.hp / c.max_hp,
                c.age + (c.pattern % 4) as f32 * 16. + if c.stagger_lock > 0. { 64. } else { 0. },
            ]);
        }
        for c in self.world.query::<&Creature>().iter(&self.world) {
            if c.kind == 4 && c.state == 2 {
                for j in 0..8 {
                    let angle = c.heading + j as f32 / 8. * TAU;
                    let p = c.p + V::angle(angle) * (c.age / 1.2 * 250.);
                    self.frame
                        .extend_from_slice(&[p.x, p.y, 7., angle, 16., 0., 1., c.age]);
                }
            }
        }
        for a in self.world.query::<&Ally>().iter(&self.world) {
            self.frame.extend_from_slice(&[
                a.p.x,
                a.p.y,
                3.6,
                a.v.y.atan2(a.v.x),
                11.,
                a.colony as f32,
                1.,
                a.phase,
            ]);
        }
        for r in &self.remnants {
            self.frame.extend_from_slice(&[
                r.p.x,
                r.p.y,
                4.5 * (1. - r.age / 0.35),
                (r.target - r.p).y.atan2((r.target - r.p).x),
                15.,
                0.,
                1. - r.age / 0.35,
                r.phase,
            ]);
        }
        for w in &self.wakes {
            for (i, p) in w.cells.iter().enumerate() {
                let drift = V::angle(i as f32 * 2.4 + self.time) * (2.6 - w.life) * 5.;
                self.frame.extend_from_slice(&[
                    p.x + drift.x,
                    p.y + drift.y,
                    5.5,
                    w.heading,
                    17.,
                    0.,
                    w.life / 2.6,
                    i as f32 * 0.13,
                ]);
            }
            self.frame.extend_from_slice(&[
                w.p.x,
                w.p.y,
                65.,
                w.heading,
                14.,
                0.,
                w.life / 2.6,
                0.,
            ]);
        }
        for limb in &self.limbs {
            let d = limb.b - limb.a;
            let mid = (limb.a + limb.b) * 0.5;
            let half = (d.len() * 0.5).max(1.);
            self.frame.extend_from_slice(&[
                mid.x,
                mid.y,
                half,
                d.y.atan2(d.x),
                12.,
                if limb.active { 2. } else { 0. },
                limb.width / half,
                0.,
            ]);
        }
        for (i, b) in self.nursery.iter().enumerate() {
            self.frame.extend_from_slice(&[
                b.p.x,
                b.p.y,
                88.,
                0.,
                6.,
                if b.awake { 1. } else { 0. },
                b.charge,
                i as f32,
            ]);
        }
    }
    pub fn render(&mut self) -> Vec<f32> {
        self.prepare_render();
        self.frame.clone()
    }
    pub fn frame_ptr(&self) -> *const f32 {
        self.frame.as_ptr()
    }
    pub fn frame_len(&self) -> usize {
        self.frame.len()
    }
    pub fn creature_data(&mut self) -> Vec<f32> {
        let mut data = Vec::with_capacity(500);
        for c in self.world.query::<&Creature>().iter(&self.world) {
            data.extend_from_slice(&[
                c.p.x,
                c.p.y,
                c.kind as f32,
                c.hp / c.max_hp,
                c.state as f32,
                c.age,
                c.heading,
                c.stagger_lock,
                if c.interruptible() { 1. } else { 0. },
                c.pattern as f32,
                c.windup(),
                c.max_hp,
            ]);
        }
        data
    }
    pub fn events(&mut self) -> Vec<f32> {
        self.event_frame.clear();
        for e in &self.events {
            self.event_frame
                .extend_from_slice(&[e.kind, e.p.x, e.p.y, e.value]);
        }
        self.event_frame.clone()
    }
    pub fn stats(&self) -> Vec<f32> {
        vec![
            self.population as f32,
            self.nutrients as f32,
            self.energy,
            self.cooldown,
            self.center.x,
            self.center.y,
            self.time,
            self.evolution as f32,
            self.traits as f32,
            self.awakened() as f32,
            self.danger,
            if self.won { 1. } else { 0. },
            self.pulse_age,
            if self.boss_spawned { 1. } else { 0. },
            self.dealt,
            self.casualties,
            self.gained,
            self.interrupted as f32,
            self.active_mode as f32,
            self.capacity() as f32,
            self.attack_clock,
            self.heading,
            self.ally_count as f32,
            self.absorb_cooldown,
            if self.evade_lock { 1. } else { 0. },
            self.lash_age,
            self.lash_cooldown,
            self.wakes.len() as f32,
        ]
    }
    pub fn capacity(&self) -> usize {
        (1200 + self.awakened() * 600 + if self.traits & 256 != 0 { 5000 } else { 0 })
            .max(self.benchmark_limit)
            .min(MAX_CELLS)
    }
    pub fn absorb_allies(&mut self) -> bool {
        if self.ally_count == 0 || self.active_mode == 3 || self.absorb_cooldown > 0. {
            return false;
        }
        let es: Vec<Entity> = self
            .world
            .query_filtered::<Entity, With<Ally>>()
            .iter(&self.world)
            .collect();
        let count = es.len();
        for e in es {
            self.world.despawn(e);
        }
        self.ally_count = 0;
        self.grow(count * 3, self.center);
        self.energy = (self.energy + 40.).min(100.);
        self.absorb_cooldown = 24.;
        true
    }
    pub fn shell_data(&self) -> Vec<f32> {
        let mut out = Vec::with_capacity(132);
        if self.traits & 1 == 0 || self.active_mode == 3 {
            return out;
        }
        for g in 0..if self.traits & 2 != 0 { 2 } else { 1 } {
            for i in 0..=32 {
                let a = i as f32 / 32. * TAU;
                let p = self.groups[g] + V::angle(a) * self.outlines[g][i % 32];
                out.extend_from_slice(&[p.x, p.y]);
            }
        }
        out
    }
    pub fn nursery_data(&self) -> Vec<f32> {
        self.nursery
            .iter()
            .flat_map(|b| {
                [
                    b.p.x,
                    b.p.y,
                    b.need as f32,
                    b.charge,
                    if b.awake { 1. } else { 0. },
                ]
            })
            .collect()
    }
    pub fn training(seed: u32) -> Self {
        let mut s = Self::new(seed, false);
        s.tutorial = true;
        s.nursery.clear();
        let remove: Vec<Entity> = s
            .world
            .query_filtered::<Entity, Or<(With<Food>, With<Creature>)>>()
            .iter(&s.world)
            .collect();
        for e in remove {
            s.world.despawn(e);
        }
        s
    }
    pub fn lesson_data(&self) -> Vec<f32> {
        let goal = match self.lesson {
            0 => V::new(150., 0.),
            1 => V::new(220., 0.),
            2 => V::new(270., 0.),
            3 => V::new(180., -120.),
            _ => V::new(-160., 100.),
        };
        vec![self.lesson as f32, self.lesson_progress, goal.x, goal.y]
    }
    pub fn advance_lesson(&mut self) -> bool {
        if !self.tutorial || self.lesson_progress < 1. || self.lesson >= 5 {
            return false;
        }
        self.lesson += 1;
        self.lesson_progress = 0.;
        self.energy = 100.;
        self.cooldown = 0.;
        let remove: Vec<Entity> = self
            .world
            .query_filtered::<Entity, Or<(With<Food>, With<Creature>)>>()
            .iter(&self.world)
            .collect();
        for e in remove {
            self.world.despawn(e);
        }
        if self.lesson == 1 {
            self.nutrients = 0;
            for i in 0..12 {
                self.world.spawn(Food {
                    p: V::new(220., 0.) + V::angle(i as f32 * 2.4) * (20. + i as f32 * 2.),
                    phase: i as f32,
                    cooldown: 0.,
                });
            }
        }
        if self.lesson == 2 || self.lesson == 3 {
            let p = if self.lesson == 2 {
                V::new(270., 0.)
            } else {
                V::new(180., -120.)
            };
            self.spawn_creature(p, if self.lesson == 2 { 4 } else { 1 });
            for mut c in self
                .world
                .query::<&mut Creature>()
                .iter_mut(&mut self.world)
            {
                c.practice = true;
                c.hp = if self.lesson == 2 { 170. } else { 300. };
                c.max_hp = c.hp;
                c.state = if self.lesson == 2 { 3 } else { 1 };
            }
        }
        true
    }
    /// Deterministic benchmark entry point; never used by the normal game loop.
    pub fn benchmark_encounter(&mut self, kind: u32) {
        if kind > 5 {
            return;
        }
        self.spawn_creature(self.center + V::new(400., -40.), kind as u8);
        if kind == 3 {
            self.boss_spawned = true;
        }
    }
    pub fn benchmark_adaptation(&mut self, choice: u32) -> bool {
        if choice > 8 {
            return false;
        }
        self.traits |= 1 << choice;
        if choice == 7 {
            self.spawn_allies();
        }
        true
    }
    pub fn benchmark_population(&mut self, n: usize) {
        self.benchmark_limit = n.min(MAX_CELLS);
        self.grow(
            n.saturating_sub(self.population).min(MAX_CELLS),
            self.center,
        );
    }
}
impl Swarm {
    fn begin_lash(&mut self, aim: V) -> bool {
        if self.traits & 32 == 0 || self.lash_cooldown > 0. || self.won || self.population == 0 {
            return false;
        }
        self.lash_age = 0.;
        self.lash_cooldown = 0.95;
        self.lash_origin = self.center;
        let d = aim - self.center;
        self.lash_heading = if d.len2() > 144. {
            d.y.atan2(d.x)
        } else {
            self.heading
        };
        self.lash_side *= -1.;
        self.events.push(Event {
            kind: 17.,
            p: self.center,
            value: 1.,
        });
        true
    }
    fn spawn_allies(&mut self) {
        for i in self.ally_count..64 {
            let colony = i % 2;
            let p = self.center + V::angle(colony as f32 * std::f32::consts::PI + 1.5) * 170.;
            self.world.spawn(Ally {
                p: p + self.rng.disk(30.),
                v: V::default(),
                phase: self.rng.next() * TAU,
                colony,
            });
        }
        self.ally_count = 64;
    }
    fn update_allies(&mut self, dt: f32, strike: bool) {
        if self.traits & 128 == 0 {
            return;
        }
        if self.ally_count == 0 && self.absorb_cooldown <= 0. {
            self.spawn_allies();
        }
        let mut goals = [
            self.center + V::angle(self.heading + 1.8) * 200.,
            self.center + V::angle(self.heading - 1.8) * 200.,
        ];
        let mut nearest = [400_f32; 2];
        for c in self.world.query::<&Creature>().iter(&self.world) {
            if c.kind == 0 || c.state != 3 {
                continue;
            }
            for k in 0..2 {
                let d = (c.p - goals[k]).len();
                if d < nearest[k] {
                    nearest[k] = d;
                    goals[k] = c.p;
                }
            }
        }
        if self.active_mode == 3 {
            goals = [self.center; 2];
        }
        for mut a in self.world.query::<&mut Ally>().iter_mut(&mut self.world) {
            let rel = a.p - goals[a.colony];
            let eddy = V::new(
                (rel.y * 0.055 + self.time * 1.8).sin(),
                (rel.x * 0.063 - self.time * 1.5).cos(),
            ) * 90.;
            let mut separation = V::default();
            for &p in &self.ally_points {
                let d = a.p - p;
                if d.len2() > 0.01 && d.len2() < 100. {
                    separation += d * (110. / (d.len2() + 1.));
                }
            }
            a.v = (a.v + (rel * -14. + eddy + separation) * dt) * (1. / (1. + dt * 5.));
            let v = a.v;
            a.p += v * dt;
        }
        self.ally_points.clear();
        self.ally_points
            .extend(self.world.query::<&Ally>().iter(&self.world).map(|a| a.p));
        let ally_points = &self.ally_points;
        if strike && self.active_mode != 3 {
            for mut c in self
                .world
                .query::<&mut Creature>()
                .iter_mut(&mut self.world)
            {
                if c.kind > 0
                    && c.state == 3
                    && ally_points
                        .iter()
                        .filter(|p| (**p - c.p).len2() < 4900.)
                        .take(6)
                        .count()
                        >= 6
                {
                    c.hp -= 42.;
                    c.hurt = 0.12;
                    self.events.push(Event {
                        kind: 12.,
                        p: c.p,
                        value: 42.,
                    });
                }
            }
        }
        // Escorts also attack independently when the player flows or forages.
        self.ally_clock += dt;
        if self.active_mode != 3 && self.ally_clock > 0.55 {
            self.ally_clock = 0.;
            for mut c in self
                .world
                .query::<&mut Creature>()
                .iter_mut(&mut self.world)
            {
                if c.kind > 0
                    && c.state == 3
                    && ally_points
                        .iter()
                        .filter(|p| (**p - c.p).len2() < 4900.)
                        .take(6)
                        .count()
                        >= 6
                {
                    c.hp -= 28.;
                    c.hurt = 0.3;
                    self.events.push(Event {
                        kind: 12.,
                        p: c.p,
                        value: 28.,
                    });
                }
            }
        }
    }
    fn update_arms(&mut self, dt: f32) {
        let body = self
            .world
            .query::<&Creature>()
            .iter(&self.world)
            .find(|c| c.kind == 3)
            .map(|c| (c.p, c.heading, c.state, c.age, c.pattern, c.target));
        let Some((center, heading, state, age, pattern, target)) = body else {
            self.limbs.clear();
            return;
        };
        if self.arms.is_empty() {
            for j in 0..6 {
                let mut p = [center; 13];
                for (i, point) in p.iter_mut().enumerate() {
                    *point = center + V::angle(j as f32 / 6. * TAU) * (95. + i as f32 * 23.);
                }
                self.arms.push(Arm {
                    p,
                    v: [V::default(); 13],
                });
            }
        }
        self.limbs.clear();
        for (j, arm) in self.arms.iter_mut().enumerate() {
            let angle = j as f32 / 6. * TAU + heading * 0.25;
            let axis = V::angle(angle);
            let side = V::new(-axis.y, axis.x);
            let active = state == 2 && (j + pattern as usize).is_multiple_of(2);
            let root = center + axis * 105.;
            let rest = root
                + axis * (if state == 1 { 135. } else { 245. })
                + side * (self.time * 1.2 + j as f32).sin() * 55.;
            let toward = target - center;
            let aim = V::angle(toward.y.atan2(toward.x) + ((j as f32 / 2.).floor() - 1.) * 0.24);
            let tip = if active {
                center + aim * (toward.len().clamp(180., 440.) + 55.)
            } else {
                rest
            };
            arm.p[0] = root;
            for i in 1..13 {
                let u = i as f32 / 12.;
                let control =
                    root + axis * 165. + side * ((self.time * 1.4 + j as f32).sin() * 65.);
                let desired =
                    root * ((1. - u) * (1. - u)) + control * (2. * u * (1. - u)) + tip * (u * u);
                let reaction = if state == 3 {
                    (self.center - desired).norm() * (-18. * (age * 7. + u * 8.).sin())
                } else {
                    V::default()
                };
                arm.v[i] = (arm.v[i] + (desired + reaction - arm.p[i]) * dt * 70.)
                    * (1. / (1. + dt * 12.));
                arm.p[i] += arm.v[i].limit(620.) * dt;
                let d = arm.p[i] - arm.p[i - 1];
                if d.len2() > 2500. {
                    arm.p[i] = arm.p[i - 1] + d.norm() * 50.;
                }
                self.limbs.push(Limb {
                    a: arm.p[i - 1],
                    b: arm.p[i],
                    active,
                    width: 9. - u * 6.,
                });
            }
        }
    }
    fn grow(&mut self, n: usize, p: V) {
        let count = n.min(self.capacity().saturating_sub(self.population));
        if self.time > 0. {
            self.gained += count as f32 * 2.;
        }
        for _ in 0..count {
            let phase = self.rng.next() * TAU;
            let shell = self.rng.next().sqrt();
            self.world.spawn(Cell {
                p: p + self.rng.disk(45.),
                v: V::angle(phase) * 30.,
                phase,
                shell,
                lobe: self.population % 2,
                strike: 0.,
            });
            self.population += 1;
        }
    }
    fn spawn_creature(&mut self, p: V, kind: u8) {
        let hp = match kind {
            0 => 60.,
            1 => 320.,
            2 => 480.,
            3 => 7200.,
            4 => 380.,
            _ => 420.,
        };
        self.world.spawn(Creature {
            p,
            v: V::default(),
            home: p,
            phase: if kind == 3 { 0. } else { self.rng.next() * TAU },
            kind,
            hp,
            max_hp: hp,
            hurt: 0.,
            state: 0,
            age: 0.,
            heading: 0.,
            target: p,
            report: 0.,
            damage: 0.,
            pattern: 0,
            stagger_lock: 0.,
            practice: false,
            opening: if kind == 3 { 3.2 } else { 2.1 },
            cued: false,
            decoy: false,
        });
    }
    fn awakened(&self) -> usize {
        self.nursery.iter().filter(|b| b.awake).count()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deterministic_and_finite_at_scale() {
        let mut a = Swarm::new(42, false);
        let mut b = Swarm::new(42, false);
        a.benchmark_population(8000);
        b.benchmark_population(8000);
        for i in 0..120 {
            let x = (i as f32 * 0.03).cos() * 300.;
            a.step(1. / 60., x, 0., i % 3, false);
            b.step(1. / 60., x, 0., i % 3, false);
        }
        assert_eq!(a.stats(), b.stats());
        assert_eq!(a.render(), b.render());
        assert!(a.render().iter().all(|v| v.is_finite()));
        assert!(a.population <= MAX_CELLS);
    }
    #[test]
    fn pulse_has_cost_and_cooldown() {
        let mut s = Swarm::new(4, false);
        assert!(s.pulse());
        assert!(!s.pulse());
        assert_eq!(s.energy, 72.);
        for _ in 0..250 {
            s.step(1. / 60., 0., 0., 0, false);
        }
        assert!(s.pulse());
    }
    #[test]
    fn evolution_requires_food_time_and_cannot_stack() {
        let mut s = Swarm::new(4, false);
        s.nutrients = 2000;
        s.time = 24.99;
        assert!(!s.evolve(0), "The first choice must allow time to learn");
        s.time = 25.;
        assert!(s.evolve(0));
        assert!(!s.evolve(0));
        assert!(!s.evolve(1), "Stored nutrients cannot stack choices");
        for (i, &at) in EVOLUTION_TIME.iter().enumerate().skip(1) {
            s.time = at;
            assert!(s.evolve(i as u32));
        }
        assert_eq!(s.evolution, 6);
        s.time = 1000.;
        assert!(!s.evolve(6), "The demo supports six distinct choices");
        let mut late = Swarm::new(5, false);
        late.nutrients = 2000;
        late.time = 200.;
        assert!(late.evolve(1));
        late.time = 221.;
        assert!(!late.evolution_ready());
        late.time = 222.;
        assert!(late.evolution_ready());
    }
    #[test]
    fn feeding_grows_and_nurseries_unlock_boss() {
        let mut s = Swarm::new(22, false);
        s.world.spawn(Food {
            p: V::default(),
            phase: 0.,
            cooldown: 0.,
        });
        s.step(1. / 60., 0., 0., 0, false);
        assert!(s.nutrients > 0);
        assert!(s.population > 160);
        s.benchmark_population(1500);
        for i in 0..3 {
            // Isolate nursery requirements; full-run tests exercise survival during the journey.
            let creatures: Vec<Entity> = s
                .world
                .query_filtered::<Entity, With<Creature>>()
                .iter(&s.world)
                .collect();
            for e in creatures {
                s.world.despawn(e);
            }
            let p = s.nursery[i].p;
            s.center = p;
            for _ in 0..250 {
                s.step(1. / 60., p.x, p.y, 1, false);
            }
        }
        assert_eq!(s.awakened(), 3);
        assert!(s.boss_spawned);
    }
    #[test]
    fn protected_nursery_requires_each_control_and_never_evolves() {
        let mut s = Swarm::training(11);
        assert!(!s.advance_lesson());
        for _ in 0..150 {
            s.step(1. / 60., 150., 0., 0, false);
        }
        assert!(s.advance_lesson());
        for _ in 0..180 {
            s.step(1. / 60., 220., 0., 0, false);
        }
        assert_eq!(s.nutrients, 0, "Foraging lesson requires spreading");
        for _ in 0..300 {
            s.step(1. / 60., 220., 0., 2, false);
        }
        assert!(s.advance_lesson());
        for _ in 0..180 {
            s.step(1. / 60., 270., 0., 2, false);
        }
        assert!(!s.advance_lesson(), "Spreading cannot break the husk");
        for _ in 0..600 {
            s.step(1. / 60., 270., 0., 1, false);
        }
        assert!(s.advance_lesson());
        s.step(1. / 60., 180., -120., 0, false);
        assert!(s.pulse());
        assert_eq!(s.interrupted, 1);
        assert!(s.advance_lesson());
        for _ in 0..150 {
            s.step(1. / 60., -160., 100., 0, true);
        }
        assert!(s.advance_lesson());
        assert_eq!(s.lesson, 5);
        assert!(!s.evolution_ready());
        assert_eq!(s.casualties, 0.);
    }
    fn isolated_urchin(state: u8) -> Swarm {
        let mut s = Swarm::training(12);
        s.tutorial = false;
        s.lesson = 0;
        s.spawn_creature(V::default(), 4);
        for mut c in s.world.query::<&mut Creature>().iter_mut(&mut s.world) {
            c.state = state;
            c.practice = true;
        }
        s
    }
    #[test]
    fn exposed_windows_and_formation_make_a_material_difference() {
        let mut closed = isolated_urchin(0);
        let mut open = isolated_urchin(3);
        let mut spread = isolated_urchin(3);
        for _ in 0..60 {
            closed.step(1. / 60., 0., 0., 1, false);
            open.step(1. / 60., 0., 0., 1, false);
            spread.step(1. / 60., 0., 0., 2, false);
        }
        let hp = |s: &mut Swarm| {
            s.world
                .query::<&Creature>()
                .iter(&s.world)
                .next()
                .unwrap()
                .hp
        };
        let damage_closed = 380. - hp(&mut closed);
        let damage_open = 380. - hp(&mut open);
        assert!(damage_open > damage_closed * 15.);
        assert!(damage_open > 60.);
        assert_eq!(hp(&mut spread), 380.);
    }
    #[test]
    fn pulse_interrupts_windup_but_cannot_chain_stagger() {
        let mut s = isolated_urchin(1);
        assert!(s.pulse());
        assert_eq!(s.interrupted, 0, "An early pulse must not open armour");
        s.cooldown = 0.;
        s.energy = 100.;
        for mut c in s.world.query::<&mut Creature>().iter_mut(&mut s.world) {
            c.age = c.windup() * 0.75;
        }
        assert!(s.pulse());
        assert_eq!(s.interrupted, 1);
        let c = s.world.query::<&Creature>().iter(&s.world).next().unwrap();
        assert_eq!(c.state, 3);
        s.cooldown = 0.;
        s.energy = 100.;
        for mut c in s.world.query::<&mut Creature>().iter_mut(&mut s.world) {
            c.state = 1;
        }
        assert!(s.pulse());
        assert_eq!(s.interrupted, 1);
    }
    #[test]
    fn spread_survives_area_attacks_better_than_compression() {
        let th = Threat {
            p: V::default(),
            kind: 4,
            state: 2,
            age: 0.6,
            heading: 0.,
            pattern: 0,
        };
        let p = V::new(125., 0.);
        assert!(danger_at(th, p, 1) > danger_at(th, p, 2) * 4.);
        let warning = Threat { state: 1, ..th };
        assert_eq!(danger_at(warning, p, 1), 0.);
    }
    #[test]
    fn distant_rays_remain_in_their_territory() {
        let mut s = Swarm::training(91);
        s.tutorial = false;
        s.spawn_creature(V::new(1500., 0.), 5);
        for _ in 0..1800 {
            s.step(1. / 60., 0., 0., 0, false);
        }
        let ray = s.world.query::<&Creature>().iter(&s.world).next().unwrap();
        assert!((ray.p - ray.home).len() < 250.);
        assert_eq!(s.population, 160);
    }
    #[test]
    fn render_view_matches_the_owned_snapshot() {
        let mut s = Swarm::new(12, false);
        s.prepare_render();
        assert!(!s.frame_ptr().is_null());
        let n = s.frame_len();
        assert_eq!(n, s.render().len());
    }
    #[test]
    fn evasion_overrides_attacking_and_foraging() {
        for requested in [1, 2] {
            let mut s = isolated_urchin(3);
            s.world.spawn(Food {
                p: V::default(),
                phase: 0.,
                cooldown: 0.,
            });
            for _ in 0..90 {
                s.step(1. / 60., 300., 0., requested, true);
            }
            assert_eq!(s.active_mode, 3);
            assert_eq!(s.nutrients, 0);
            assert_eq!(
                s.world
                    .query::<&Creature>()
                    .iter(&s.world)
                    .next()
                    .unwrap()
                    .hp,
                380.
            );
            assert!(!s.pulse());
        }
    }
    #[test]
    fn tidal_fang_is_one_lash_per_press_and_relaxes_afterward() {
        let mut s = isolated_urchin(3);
        s.benchmark_adaptation(5);
        for mut c in s.world.query::<&mut Creature>().iter_mut(&mut s.world) {
            c.hp = 10000.;
            c.max_hp = 10000.;
            c.p = V::new(95., 0.);
        }
        let mut impacts = 0;
        for _ in 0..180 {
            s.step(1. / 60., 0., 0., 1, false);
            impacts += s.events.iter().filter(|e| e.kind == 12.).count();
        }
        assert_eq!(impacts, 1, "Holding must not repeat the fang");
        assert_eq!(s.active_mode, 0);
        assert!(s.lash_age < 0.);
        let mut xx = 0.;
        let mut yy = 0.;
        for c in s.world.query::<&Cell>().iter(&s.world) {
            xx += (c.p.x - s.center.x).powi(2);
            yy += (c.p.y - s.center.y).powi(2);
        }
        assert!(
            xx < yy * 2.,
            "The collective relaxes into a cloud, not a static spear"
        );
        s.step(1. / 60., 0., 0., 0, false);
        s.step(1. / 60., 200., 0., 1, false);
        assert!(s.lash_age >= 0., "Release and press rearms the ability");
        s.step(1. / 60., 200., 0., 0, true);
        assert!(s.lash_age < 0., "Evasion cancels a committed attack");
        assert!(!s.lash(200., 0.));
    }
    #[test]
    fn slipstream_is_faster_and_early_decoys_redirect_hunters() {
        let mut plain = Swarm::training(12);
        let mut slip = Swarm::training(12);
        slip.benchmark_adaptation(6);
        plain.tutorial = false;
        slip.tutorial = false;
        for _ in 0..45 {
            plain.step(1. / 60., 2000., 0., 0, true);
            slip.step(1. / 60., 2000., 0., 0, true);
        }
        assert!(slip.center.x > plain.center.x + 30.);
        assert!(!slip.wakes.is_empty());
        assert!(
            slip.render()
                .as_chunks::<8>()
                .0
                .iter()
                .filter(|r| r[4] == 17.)
                .count()
                >= 48
        );
        slip.spawn_creature(slip.center + V::new(80., 0.), 1);
        for mut c in slip
            .world
            .query::<&mut Creature>()
            .iter_mut(&mut slip.world)
        {
            c.state = 1;
            c.age = 0.1;
            c.target = slip.center;
        }
        slip.step(1. / 60., 470., 100., 0, true);
        let c = slip
            .world
            .query::<&Creature>()
            .iter(&slip.world)
            .next()
            .unwrap();
        assert!(c.decoy);
        let target = c.target;
        for _ in 0..30 {
            slip.step(1. / 60., 470., 200., 0, true);
        }
        let c = slip
            .world
            .query::<&Creature>()
            .iter(&slip.world)
            .next()
            .unwrap();
        assert!(
            (c.target - target).len() < 0.01,
            "A fooled hunter stays committed to its decoy"
        );
        assert!(
            slip.events.iter().all(|e| e.kind != 19.),
            "Do not repeat decoy announcements"
        );
    }
    #[test]
    fn fork_forms_two_separated_collectives() {
        let mut s = Swarm::training(15);
        s.benchmark_adaptation(1);
        s.benchmark_population(1000);
        for _ in 0..240 {
            s.step(1. / 60., 0., 0., 2, false);
        }
        let mut centers = [V::default(); 2];
        let mut count = [0_f32; 2];
        for c in s.world.query::<&Cell>().iter(&s.world) {
            centers[c.lobe] += c.p;
            count[c.lobe] += 1.;
        }
        let a = centers[0] * (1. / count[0]);
        let b = centers[1] * (1. / count[1]);
        assert!(
            (a - b).len() > 230.,
            "Forked Mind needs a visible gap between independent lobes"
        );
    }
    #[test]
    fn guard_follows_growth_and_spread() {
        let mut s = Swarm::training(8);
        s.benchmark_adaptation(0);
        for _ in 0..180 {
            s.step(1. / 60., 0., 0., 0, false);
        }
        let small = s
            .shell_data()
            .as_chunks::<2>()
            .0
            .iter()
            .map(|p| p[0].hypot(p[1]))
            .sum::<f32>();
        s.benchmark_population(1800);
        // A living pressure field expands gradually; let the larger population settle.
        for _ in 0..600 {
            s.step(1. / 60., 0., 0., 2, false);
        }
        let large = s
            .shell_data()
            .as_chunks::<2>()
            .0
            .iter()
            .map(|p| p[0].hypot(p[1]))
            .sum::<f32>();
        assert!(
            large > small * 2.,
            "guard boundary small={small}, large={large}"
        );
    }
    #[test]
    fn capacity_unlocks_and_symbionts_can_be_absorbed() {
        let mut s = Swarm::training(3);
        assert_eq!(s.capacity(), 1200);
        s.benchmark_adaptation(8);
        assert_eq!(s.capacity(), 6200);
        s.benchmark_adaptation(7);
        assert_eq!(s.ally_count, 64);
        let before = s.population;
        assert!(s.absorb_allies());
        assert_eq!(s.population, before + 192);
        assert_eq!(s.ally_count, 0);
        assert!(!s.absorb_allies());
        for _ in 0..1450 {
            s.step(1. / 60., 0., 0., 0, false);
        }
        assert_eq!(s.ally_count, 64);
    }
    #[test]
    fn articulated_arms_reach_and_remain_finite() {
        let mut s = Swarm::training(7);
        s.spawn_creature(V::new(250., 0.), 3);
        for mut c in s.world.query::<&mut Creature>().iter_mut(&mut s.world) {
            c.target = V::default();
            c.state = 1;
        }
        for _ in 0..60 {
            s.update_arms(1. / 60.);
        }
        let before = s.arms[0].p[12];
        for mut c in s.world.query::<&mut Creature>().iter_mut(&mut s.world) {
            c.state = 2;
        }
        for _ in 0..60 {
            s.update_arms(1. / 60.);
        }
        assert!((s.arms[0].p[12] - before).len() > 70.);
        assert!(s.limbs.iter().any(|l| l.active));
        assert!(
            s.limbs
                .iter()
                .all(|l| l.a.x.is_finite() && l.b.y.is_finite() && (l.a - l.b).len() < 51.)
        );
        let angle = turn_toward(3.13, -3.13, 0.01);
        assert!(
            (angle - 3.13).abs() < 0.011,
            "Rotation must cross the angle seam smoothly"
        );
    }
    #[test]
    fn exhausted_evade_does_not_flicker_back_into_attack() {
        let mut s = isolated_urchin(3);
        s.energy = 1.;
        for _ in 0..90 {
            s.step(1. / 60., 0., 0., 1, true);
            assert_eq!(s.active_mode, 0);
        }
        assert_eq!(
            s.world
                .query::<&Creature>()
                .iter(&s.world)
                .next()
                .unwrap()
                .hp,
            380.
        );
        s.step(1. / 60., 0., 0., 1, false);
        assert_eq!(s.active_mode, 1);
    }
    #[test]
    fn escorts_attack_without_player_compression() {
        let mut s = isolated_urchin(3);
        s.benchmark_adaptation(7);
        for _ in 0..240 {
            s.step(1. / 60., 0., 0., 0, false);
        }
        let hp = s
            .world
            .query::<&Creature>()
            .iter(&s.world)
            .next()
            .map_or(0., |c| c.hp);
        assert!(hp < 300.);
        assert_eq!(s.active_mode, 0);
    }
    #[test]
    fn evasive_wake_retains_a_bend_instead_of_rotating_as_a_rectangle() {
        let mut s = Swarm::training(41);
        s.benchmark_population(1000);
        for _ in 0..90 {
            s.step(1. / 60., 450., 0., 0, true);
        }
        for _ in 0..70 {
            s.step(1. / 60., 450., 450., 0, true);
        }
        let head = s.wake_path[0];
        let tail = s.wake_path[31];
        let bend = s
            .wake_path
            .iter()
            .map(|&p| segment_distance(p, head, tail))
            .fold(0_f32, f32::max);
        assert!(
            bend > 35.,
            "A turning swarm must preserve its curved route: {bend}"
        );
        assert!(s.render().iter().all(|x| x.is_finite()));
    }
}
