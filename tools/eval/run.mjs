import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from '../server-process.mjs';
import { launchChromium } from '../launch-chromium.mjs';
import { summarize } from './summarize.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const configDir = resolve(repoRoot, 'tools/eval/configs');
const options = parseOptions(process.argv.slice(2));
const runCount = positiveInteger(options.runs, 1);
const parallel = positiveInteger(options.parallel, 4);
const timeoutMs = positiveInteger(options['timeout-ms'], 60_000);
const configs = await loadConfigs(options.config || 'quick');
const tasks = configs.flatMap(config => Array.from({ length: runCount }, (_, run) => ({ config: normalizeConfig(config), run })));
const results = new Array(tasks.length);
const server = await startStaticServer();
let browser;

function parseOptions(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    parsed[key.slice(2)] = value;
  }
  return parsed;
}

function positiveInteger(value, fallback) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`Expected a positive integer, got: ${value}`);
  return number;
}

function normalizeConfig(config) {
  return {
    interval: 600, switchMs: 250, chill: false,
    ...config,
    vp: { width: 1920, height: 1080, ...config.vp }
  };
}

async function readConfig(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function loadConfigs(name) {
  if (name === 'full') {
    const all = [];
    for (const letter of 'ABCDEFG') all.push(...await readConfig(resolve(configDir, `cfg${letter}.json`)));
    return all;
  }
  const path = isAbsolute(name) ? name : resolve(configDir, name.endsWith('.json') ? name : `${name}.json`);
  const configs = await readConfig(path);
  if (!Array.isArray(configs) || configs.length === 0) throw new Error(`Config must contain a non-empty array: ${path}`);
  return configs;
}

function errorRow(task, error) {
  return {
    ...task.config, config: { ...task.config }, run: task.run,
    ended: false, error: { message: error.message, stack: error.stack }
  };
}

async function runOne(task, index) {
  let page;
  try {
    page = await browser.newPage({ viewport: task.config.vp, deviceScaleFactor: 1 });
    const play = (async () => {
      await page.route(/fonts\.(googleapis|gstatic)/, route => route.abort());
      await page.clock.install();
      await page.goto(`${server.origin}/index.html?test=1`, { waitUntil: 'load' });
      await page.addScriptTag({ path: resolve(repoRoot, 'tools/eval/bot.js') });
      await page.evaluate(config => window.__hotpot.start({
        stage: config.stage, rule: config.rule, broth: config.broth, mode: 'challenge'
      }), task.config);
      await page.evaluate(({ strategy, interval, switchMs, chill }) => {
        window.__bot(strategy, interval, switchMs);
        if (chill) setTimeout(() => window.__hotpot.activateChill(), 1000);
      }, task.config);
      let elapsed = 0;
      const limit = 3 * 50_000 + 5_000;
      while (elapsed < limit) {
        await page.clock.runFor(1_000);
        elapsed += 1_000;
        if (await page.evaluate(() => window.__hotpot.state.gameEnded)) break;
      }
      return await page.evaluate(() => {
        const state = window.__hotpot.state;
        return {
          score: state.score,
          simS: Math.round(state.simulationTimeMs / 1000),
          ended: state.gameEnded,
          cleanliness: document.getElementById('cleanliness').textContent,
          cleanlinessPct: state.cleanliness,
          comment: state.resultComment,
          remaining: state.particles.length,
          fails: state.scooped.fail,
          scooped: { ...state.scooped },
          soupMl: Math.round(state.soupLossMl),
          bot: { ...window.__botStats },
          missionResult: state.missionResult,
          endReason: state.endReason,
          ...['waves', 'maxCombo', 'waveClears', 'potEmptyMs', 'unitsInPot'].reduce((extra, key) => {
            if (state[key] !== undefined) extra[key] = state[key];
            return extra;
          }, {})
        };
      });
    })();
    let timeout;
    const timedOut = new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`Game exceeded ${timeoutMs} ms wall-clock timeout`)), timeoutMs);
    });
    const result = await Promise.race([play, timedOut]);
    clearTimeout(timeout);
    console.error(`[${index + 1}/${tasks.length}] ${task.config.stage}/${task.config.rule}/${task.config.strategy}: ${result.ended ? 'ended' : 'not ended'}`);
    return { ...task.config, config: { ...task.config }, run: task.run, ...result };
  } catch (error) {
    await page?.close().catch(() => {});
    console.error(`[${index + 1}/${tasks.length}] ${task.config.stage}/${task.config.rule}/${task.config.strategy}: ERROR ${error.message}`);
    return errorRow(task, error);
  } finally {
    await page?.close().catch(() => {});
  }
}

try {
  try {
    browser = await launchChromium();
  } catch (error) {
    for (let index = 0; index < tasks.length; index++) results[index] = errorRow(tasks[index], error);
    console.error(`Chromium launch failed; recording ${tasks.length} game errors: ${error.message}`);
  }
  if (browser) {
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(parallel, tasks.length) }, async () => {
      while (cursor < tasks.length) {
        const index = cursor++;
        results[index] = await runOne(tasks[index], index);
      }
    }));
  }
  assert.equal(results.length, tasks.length);
  assert.ok(results.every(Boolean), 'every scheduled game must have a result record');
  const outDirectory = isAbsolute(options.out || '') ? options.out : resolve(repoRoot, options.out || 'tools/eval/out');
  await mkdir(outDirectory, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const configName = (options.config || 'quick').split(/[\\/]/).at(-1).replace(/\.json$/, '');
  const jsonFile = resolve(outDirectory, `${configName}-${stamp}.json`);
  const markdownFile = resolve(outDirectory, `${configName}-${stamp}.md`);
  const table = summarize(results);
  await writeFile(jsonFile, `${JSON.stringify(results, null, 2)}\n`);
  await writeFile(markdownFile, `# Evaluation: ${configName}\n\nGames: ${results.length}; recorded errors: ${results.filter(row => row.error).length}.\n\n${table}\n`);
  console.log(`Wrote ${results.length} game records to ${jsonFile}`);
  console.log(`Summary: ${markdownFile}`);
  console.log(table);
} finally {
  await browser?.close();
  await server.stop();
}
