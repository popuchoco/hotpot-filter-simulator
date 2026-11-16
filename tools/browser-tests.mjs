import assert from 'node:assert/strict';
import { startStaticServer } from './server-process.mjs';
import { launchChromium } from './launch-chromium.mjs';

const server = await startStaticServer();
let browser;
try {
  browser = await launchChromium();

  async function createGamePage(viewport = { width: 1280, height: 800 }) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.route(/fonts\.(googleapis|gstatic)/, route => route.abort());
    await page.goto(`${server.origin}/?test=1`, { waitUntil: 'load' });
    assert.equal(await page.evaluate(() => Boolean(window.__hotpot)), true, 'test hook is available with ?test=1');
    await page.click('#startBtn');
    await page.waitForFunction(() => window.__hotpot.state.running);
    return page;
  }

  {
    const page = await createGamePage();
    try {
      await page.locator('#pauseBtn').focus();
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => window.__hotpot.state.running), false, 'Space activates the focused pause button');
      assert.equal(await page.evaluate(() => window.__hotpot.state.scoopAttempts), 0, 'focused button Space does not scoop');
    } finally {
      await page.close();
    }
  }

  {
    const page = await createGamePage();
    try {
      await page.locator('#endBtn').focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('#result:not(.hidden)');
      assert.equal(await page.evaluate(() => window.__hotpot.state.gameEnded), true, 'Enter activates the focused end button');
    } finally {
      await page.close();
    }
  }

  {
    const page = await createGamePage();
    try {
      await page.locator('#canvas').focus();
      const before = await page.evaluate(() => window.__hotpot.state.scoopAttempts);
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => window.__hotpot.state.scoopAttempts), before + 1, 'canvas Space attempts a scoop');
    } finally {
      await page.close();
    }
  }

  {
    const page = await createGamePage();
    try {
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal(await page.evaluate(() => window.__hotpot.state.running), false, 'hidden visibility pauses the game');
      const pausedRemainingMs = await page.evaluate(() => window.__hotpot.state.remainingMs);
      assert.match(await page.locator('#hint').textContent(), /已暫停/);
      await page.waitForTimeout(1_000);
      assert.equal(await page.evaluate(() => window.__hotpot.state.remainingMs), pausedRemainingMs, 'paused time does not count down');
    } finally {
      await page.close();
    }
  }

  {
    const page = await createGamePage({ width: 1920, height: 1080 });
    try {
      const outsideFraction = () => page.evaluate(() => {
        const { particles, canvasWidth, canvasHeight, potRadius } = window.__hotpot.state;
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const outside = particles.filter(particle => Math.hypot(particle.x - centerX, particle.y - centerY) > potRadius).length;
        return outside / particles.length;
      });
      const before = await outsideFraction();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => window.__hotpot.state.canvasWidth < 600);
      const after = await outsideFraction();
      assert.ok(after <= before + 1e-12, `outside-pot fraction did not increase (${before} -> ${after})`);
    } finally {
      await page.close();
    }
  }

  console.log('browser tests: passed');
} finally {
  await browser?.close();
  await server.stop();
}
