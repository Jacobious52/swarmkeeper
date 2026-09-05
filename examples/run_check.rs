//! An automated, deterministic player completes a real run without granting population.
//! Run with `cargo run --release --example run_check`.
use std::time::Instant;
use swarmkeeper::Swarm;
fn main() {
    let started = Instant::now();
    let seed = std::env::args()
        .nth(1)
        .and_then(|x| x.parse().ok())
        .unwrap_or(9371);
    let mut sim = Swarm::new(seed, false);
    let choices = match std::env::args().nth(2).as_deref() {
        Some("shield") => [0, 7, 8, 4, 3, 2],
        Some("fork") => [1, 6, 8, 7, 0, 4],
        _ => [5, 2, 8, 1, 0, 7],
    };
    let mut max_population = 0.;
    let mut frames = 0;
    let mut recovering = false;
    for tick in 0..36000 {
        let stats = sim.stats();
        max_population = f32::max(max_population, stats[0]);
        if stats[11] == 1. {
            break;
        }
        assert!(
            stats[0] > 0.,
            "Automated player went extinct at {} seconds",
            stats[6]
        );
        if sim.evolution_ready() {
            for choice in choices {
                if sim.evolve(choice) {
                    break;
                }
            }
        }
        let organisms = sim.render();
        let mut target = (stats[4], stats[5]);
        let mut mode = 2;
        let mut surge = false;
        let cs = sim.creature_data();
        if let Some(boss) = cs.as_chunks::<12>().0.iter().find(|r| r[2] == 3.) {
            let dx = stats[4] - boss[0];
            let dy = stats[5] - boss[1];
            let dist = dx.hypot(dy).max(1.);
            if stats[0] < 650. {
                recovering = true;
            } else if stats[0] > 1450. {
                recovering = false;
            }
            if recovering {
                if let Some(food) = organisms
                    .as_chunks::<8>()
                    .0
                    .iter()
                    .filter(|r| r[4] == 1. && (r[0] - boss[0]).hypot(r[1] - boss[1]) > 350.)
                    .min_by(|a, b| {
                        let d = |r: &[f32]| (r[0] - stats[4]).hypot(r[1] - stats[5]);
                        d(*a).total_cmp(&d(*b))
                    })
                {
                    target = (food[0], food[1]);
                }
                surge = boss[4] == 2. && dist < 250. && stats[2] > 35.;
            } else if boss[4] == 3. {
                target = (boss[0], boss[1]);
                mode = 1;
            } else if boss[4] == 2. {
                target = (boss[0] + dx / dist * 470., boss[1] + dy / dist * 470.);
                surge = stats[2] > 30.;
            } else {
                target = (boss[0] + dx / dist * 170., boss[1] + dy / dist * 170.);
                mode = 0;
                if boss[8] == 1. && dist < 300. {
                    sim.pulse();
                }
            }
        } else {
            let nodes = sim.nursery_data();
            let node = nodes.as_chunks::<5>().0.iter().find(|n| n[4] == 0.);
            if let Some(n) = node {
                if stats[0] >= n[2] {
                    target = (n[0], n[1]);
                } else if let Some(food) = organisms
                    .as_chunks::<8>()
                    .0
                    .iter()
                    .filter(|r| r[4] == 1.)
                    .min_by(|a, b| {
                        let d = |r: &[f32]| (r[0] - stats[4]).hypot(r[1] - stats[5]);
                        d(*a).total_cmp(&d(*b))
                    })
                {
                    target = (food[0], food[1]);
                }
            }
        }
        if cs
            .as_chunks::<12>()
            .0
            .iter()
            .any(|c| c[8] == 1. && (c[0] - stats[4]).hypot(c[1] - stats[5]) < 290.)
        {
            sim.pulse();
        }
        if mode == 1 && stats[8] as u32 & 32 != 0 && stats[26] <= 0. {
            sim.lash(target.0, target.1);
        }
        sim.step(1. / 60., target.0, target.1, mode, surge);
        frames += 1;
        if tick % 600 == 0 {
            println!(
                "t={:.0}s population={} nurseries={} evolutions={} boss={} interrupts={}",
                stats[6],
                stats[0],
                stats[9],
                stats[7],
                cs.as_chunks::<12>()
                    .0
                    .iter()
                    .find(|c| c[2] == 3.)
                    .map_or(0., |c| c[3]),
                stats[17]
            );
        }
    }
    let stats = sim.stats();
    println!(
        "Outcome: {} | {:.1}s simulated | {} organisms | peak {} | {:.3} ms/tick native",
        if stats[11] == 1. {
            "VICTORY"
        } else {
            "TIMEOUT"
        },
        stats[6],
        stats[0],
        max_population,
        started.elapsed().as_secs_f64() * 1000. / frames as f64
    );
    assert_eq!(stats[11], 1., "A complete run must be winnable");
    assert_eq!(stats[9], 3.);
}
