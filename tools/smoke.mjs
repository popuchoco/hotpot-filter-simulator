import assert from 'node:assert/strict';
import { startStaticServer } from './server-process.mjs';
import { launchChromium } from './launch-chromium.mjs';

const viewports = [
  { width: 1920, height: 1080 }, { width: 1280, height: 800 }, { width: 1366, height: 768 },
  { width: 390, height: 844 }, { width: 844, height: 390 }
];
const server = await startStaticServer();
let browser;
try {
  browser = await launchChromium();
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      // Google Fonts is aborted offline; its resource failure is whitelisted until S6.
      if (message.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(message.location()?.url || '')) errors.push(`console: ${message.text()}`);
    });
    await page.route(/fonts\.(googleapis|gstatic)/, route => route.abort());
    try {
      await page.goto(`${server.origin}/?test=1`, { waitUntil: 'load' });
      assert.equal(await page.evaluate(() => Boolean(window.__hotpot)), true, 'test hook is available with ?test=1');
      await page.click('#startBtn');
      await page.waitForFunction(() => window.__hotpot.state.running);
      const before = await page.evaluate(() => JSON.stringify(window.__hotpot.state.scooped));
      await page.evaluate(() => {
        const api = window.__hotpot;
        api.selectTool('strainer');
        const particles = api.state.particles;
        const radius = api.TOOL_CONFIG.strainer.radius;
        // Prefer the meat particle with the fewest wrong-tool neighbours (crowded phone pots may have none clean).
        const badNear = target => particles.filter(other => !['meat', 'debris'].includes(other.type) &&
          Math.hypot(other.x - target.x, other.y - target.y) < radius + other.r).length;
        const meat = particles.filter(particle => particle.type === 'meat').sort((a, b) => badNear(a) - badNear(b))[0];
        api.scoopAt(meat.x, meat.y);
      });
      const after = await page.evaluate(() => JSON.stringify(window.__hotpot.state.scooped));
      assert.notEqual(after, before, `one scoop registers: ${after}`);
      await page.click('#pauseBtn');
      assert.equal(await page.evaluate(() => window.__hotpot.state.running), false, 'pause stops the game');
      await page.click('#pauseBtn');
      assert.equal(await page.evaluate(() => window.__hotpot.state.running), true, 'resume starts the game');
      await page.click('#endBtn');
      await page.waitForSelector('#result:not(.hidden)');
      assert.equal(await page.evaluate(() => window.__hotpot.state.gameEnded), true, 'end shows the result');
      assert.deepEqual(errors, [], `browser errors at ${viewport.width}x${viewport.height}`);
      console.log(`smoke ${viewport.width}x${viewport.height}: passed`);
    } finally {
      await page.close();
    }
  }

  const normalPage = await browser.newPage();
  await normalPage.route(/fonts\.(googleapis|gstatic)/, route => route.abort());
  await normalPage.goto(server.origin, { waitUntil: 'load' });
  assert.equal(await normalPage.evaluate(() => '__hotpot' in window), false, 'test hook is hidden without ?test=1');
  await normalPage.close();
} finally {
  await browser?.close();
  await server.stop();
}
