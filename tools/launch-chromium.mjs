import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

export function launchChromium() {
  const configuredPath = process.env.CHROME_PATH;
  const defaultChrome = '/usr/bin/google-chrome';
  const executablePath = configuredPath || (existsSync(defaultChrome) ? defaultChrome : undefined);
  return chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
}
