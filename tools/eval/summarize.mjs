import { readFile } from 'node:fs/promises';

const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const list = values => `[${values.map(value => value ?? '—').join(', ')}]`;
const scoreRange = rows => {
  const scores = rows.map(row => row.score).filter(Number.isFinite).sort((a, b) => a - b);
  if (!scores.length) return '—';
  return `${scores[0]}–${median(scores)}–${scores.at(-1)}`;
};

export function summarize(rows) {
  const groups = new Map();
  for (const row of rows) {
    const viewport = (row.vp?.width ?? row.config?.vp?.width ?? 0) < 500 ? 'M' : 'D';
    const key = [row.stage, row.rule, row.broth, row.strategy, row.interval ?? 600, viewport].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const lines = [
    '| stage | rule | broth | strategy | interval | viewport | n | score min–median–max | cleanliness | median fails | emptyAt s | waves median | potEmpty s (per game) | maxCombo median | simS | soup median mL | mission success | comment | errors |',
    '|---|---|---|---:|---:|:---:|---:|---:|---|---:|---|---:|---|---:|---|---:|---:|---|---:|'
  ];
  for (const [key, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [stage, rule, broth, strategy, interval, viewport] = key.split('|');
    const missions = group.filter(row => typeof row.missionResult === 'boolean');
    const missionCell = missions.length ? `${missions.filter(row => row.missionResult).length}/${missions.length}` : '—';
    const comment = (group.find(row => row.comment)?.comment || group.find(row => row.error)?.error?.message || '—').replaceAll('|', '\\|').replaceAll('\n', ' ').slice(0, 48);
    const clean = list(group.map(row => row.cleanliness ?? 'ERR'));
    const emptyAt = list(group.map(row => row.bot?.emptyAtS ?? null));
    const waves = median(group.map(row => row.waves));
    const potEmptySeconds = list(group.map(row => Number.isFinite(row.potEmptyMs)
      ? Math.round(row.potEmptyMs / 100) / 10
      : null));
    const bestCombo = median(group.map(row => row.maxCombo));
    const simSeconds = list(group.map(row => row.simS ?? null));
    const failures = median(group.map(row => row.fails));
    const soup = median(group.map(row => row.soupMl));
    const errors = group.filter(row => row.error).length;
    lines.push(`| ${stage} | ${rule} | ${broth} | ${strategy} | ${interval} | ${viewport} | ${group.length} | ${scoreRange(group)} | ${clean} | ${failures ?? '—'} | ${emptyAt} | ${waves ?? '—'} | ${potEmptySeconds} | ${bestCombo ?? '—'} | ${simSeconds} | ${soup ?? '—'} | ${missionCell} | ${comment} | ${errors} |`);
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const rows = JSON.parse(await readFile(process.argv[2], 'utf8'));
  console.log(summarize(rows));
}
