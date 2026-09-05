import { test, expect } from "@playwright/test";

test("the static build opens, pauses evolution while music continues, and resumes", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?debug");
  await page.getByRole("button", { name: "ENTER THE NURSERY ↗" }).click();
  await expect(page.locator("#lesson-panel")).toBeVisible();
  await page.locator("#lesson-skip").click();
  // Earn the first choice through normal feeding, never grant nutrients or advance time.
  await page.evaluate(() => {
    window.feedTest = setInterval(() => {
      const g = window.swarmkeeper;
      if (g.state !== "playing") {
        clearInterval(window.feedTest);
        return;
      }
      const s = g.stats,
        frame = g.frame;
      let x = s[4],
        y = s[5],
        best = Infinity;
      for (let i = 0; i < frame.length; i += 8) {
        if (frame[i + 4] !== 1) continue;
        const d = (frame[i] - s[4]) ** 2 + (frame[i + 1] - s[5]) ** 2;
        if (d < best) {
          best = d;
          x = frame[i];
          y = frame[i + 1];
        }
      }
      g.intent(x, y, 2);
    }, 100);
  });
  try {
    await expect(page.locator("#evolution")).toBeVisible({ timeout: 120000 });
  } catch (error) {
    console.log(
      "Evolution timeout state:",
      await page.evaluate(() => ({
        state: swarmkeeper.state,
        stats: swarmkeeper.stats,
        metrics: swarmkeeper.metrics,
      })),
    );
    throw error;
  }
  const before = await page.evaluate(() => ({
    time: swarmkeeper.stats[6],
    audio: swarmkeeper.audio,
  }));
  expect(before.time).toBeGreaterThanOrEqual(25);
  expect(before.audio.state).toBe("running");
  expect(before.audio.enabled).toBe(true);
  await expect
    .poll(async () => page.evaluate(() => swarmkeeper.audio.beat))
    .toBeGreaterThan(before.audio.beat + 2);
  const after = await page.evaluate(() => ({
    time: swarmkeeper.stats[6],
    audio: swarmkeeper.audio,
  }));
  expect(after.time).toBe(before.time);
  expect(after.audio.time).toBeGreaterThan(before.audio.time + 0.5);
  expect(after.audio.state).toBe("running");
  await page.keyboard.press("1");
  await expect(page.locator("#evolution")).toBeHidden();
  await page.keyboard.press("Tab");
  await expect(page.locator("#pause-modal")).toBeVisible();
  await expect(page.locator("#journal-owned")).toContainText("Helix Guard");
  await expect
    .poll(() => page.evaluate(() => swarmkeeper.audio.state))
    .toBe("suspended");
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => swarmkeeper.audio.state))
    .toBe("running");
  expect(await page.evaluate(() => swarmkeeper.metrics.webglError)).toBe(0);
  expect(errors).toEqual([]);
});
