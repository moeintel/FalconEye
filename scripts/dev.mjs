import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

if (existsSync('.env')) loadEnvFile('.env');
if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in .env for registration/outreach, or run pnpm dev:web for the browser-only portfolio.');
  process.exit(1);
}

const apiPort = process.env.API_PORT ?? '5000';
const webPort = process.env.WEB_PORT ?? '5173';
const children = [
  spawn('pnpm', ['--filter', '@workspace/api-server', 'run', 'dev'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: apiPort },
  }),
  spawn('pnpm', ['--filter', '@workspace/falcon-eye', 'run', 'dev'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: webPort, API_PORT: apiPort, BASE_PATH: process.env.BASE_PATH ?? '/' },
  }),
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', (error) => { console.error(error.message); stop(1); });
  child.on('exit', (code) => stop(code ?? 1));
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
