export function hashSeed(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0 || 1;
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6D2B79F5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailyDateTaipei(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}`;
}

export function dailyChallengeDescriptor(search, fallbackDate = dailyDateTaipei()) {
  const params = new URLSearchParams(search);
  const sharedDate = params.get('daily');
  const sharedSeed = Number(params.get('seed'));
  if (/^\d{8}$/.test(sharedDate || '') && Number.isInteger(sharedSeed) && sharedSeed > 0 && sharedSeed <= 0xFFFFFFFF) {
    return { date: sharedDate, seed: sharedSeed >>> 0, shared: true };
  }
  return { date: fallbackDate, seed: hashSeed(`hotpot-filter-daily-${fallbackDate}`), shared: false };
}

export function formatSeed(seed) {
  return (seed >>> 0).toString(36).toUpperCase();
}
