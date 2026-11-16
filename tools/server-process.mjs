import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function freePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolveListen));
  const { port } = server.address();
  await new Promise(resolveClose => server.close(resolveClose));
  return port;
}

export async function startStaticServer() {
  const port = await freePort();
  const child = spawn(process.execPath, [resolve(repoRoot, 'tools/serve.mjs')], {
    cwd: repoRoot, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${origin}/`);
      if (response.ok) { ready = true; break; }
    } catch { /* Wait until the child has bound its port. */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 50));
  }
  if (!ready) {
    child.kill('SIGTERM');
    throw new Error(`Static server did not start: ${stderr}`);
  }
  return {
    origin,
    stop: () => new Promise(resolveStop => {
      if (child.exitCode !== null || child.killed) return resolveStop();
      child.once('exit', resolveStop);
      child.kill('SIGTERM');
    })
  };
}
