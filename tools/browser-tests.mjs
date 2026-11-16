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

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1280, height: 800 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
    { width: 844, height: 390 }
  ]) {
    const page = await createGamePage(viewport);
    try {
      const measurements = await page.evaluate(() => {
        const timer = document.querySelector('#timeDisplay').getBoundingClientRect();
        const canvas = document.querySelector('#canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const { canvasWidth, canvasHeight, potRadius } = window.__hotpot.state;
        const scaleX = canvasRect.width / canvasWidth;
        const scaleY = canvasRect.height / canvasHeight;
        const pot = {
          left: canvasRect.left + (canvasWidth / 2 - potRadius) * scaleX,
          right: canvasRect.left + (canvasWidth / 2 + potRadius) * scaleX,
          top: canvasRect.top + (canvasHeight / 2 - potRadius) * scaleY,
          bottom: canvasRect.top + (canvasHeight / 2 + potRadius) * scaleY
        };
        const tools = [...document.querySelectorAll('.tool')].map(button => {
          const rect = button.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        });
        return {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          timer: { top: timer.top, bottom: timer.bottom },
          pot,
          tools,
          scrollTop: document.scrollingElement.scrollTop
        };
      });

      assert.ok(measurements.timer.top >= 0 && measurements.timer.bottom <= measurements.innerHeight,
        `timer fits in ${viewport.width}x${viewport.height}: ${JSON.stringify(measurements.timer)}`);
      assert.ok(measurements.pot.left >= 0 && measurements.pot.right <= measurements.innerWidth
        && measurements.pot.top >= 0 && measurements.pot.bottom <= measurements.innerHeight,
      `pot fits in ${viewport.width}x${viewport.height}: ${JSON.stringify(measurements.pot)}`);
      assert.equal(measurements.tools.length, 3, 'all three tool buttons are present');
      for (const [index, tool] of measurements.tools.entries()) {
        assert.ok(tool.left >= 0 && tool.right <= measurements.innerWidth
          && tool.top >= 0 && tool.bottom <= measurements.innerHeight,
        `tool ${index + 1} fits in ${viewport.width}x${viewport.height}: ${JSON.stringify(tool)}`);
      }
      assert.equal(measurements.scrollTop, 0, `page is at scroll top in ${viewport.width}x${viewport.height}`);
      console.log(
        `layout ${viewport.width}x${viewport.height} timerTop=${measurements.timer.top.toFixed(1)} `
        + `potTop=${measurements.pot.top.toFixed(1)} potBottom=${measurements.pot.bottom.toFixed(1)} `
        + `toolsBottom=${Math.max(...measurements.tools.map(tool => tool.bottom)).toFixed(1)} `
        + `innerHeight=${measurements.innerHeight}`
      );
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
