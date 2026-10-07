#!/usr/bin/env node
/**
 * Starts the backend and frontend dev servers together, on any platform.
 *
 * This exists instead of a runner dependency so the repository root needs no
 * node_modules of its own, and so Windows users do not need a Bash shell. `start.sh`
 * remains for anyone who prefers it.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const SERVICES = [
  { name: 'backend', colour: '\u001b[34m', url: 'http://localhost:3001' },
  { name: 'frontend', colour: '\u001b[35m', url: 'http://localhost:5173' },
];

const RESET = '\u001b[0m';
const DIM = '\u001b[2m';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 20) fail(`Error: Node.js 20 or newer is required (found ${process.version}).`);

for (const { name } of SERVICES) {
  if (existsSync(join(ROOT, name, 'node_modules'))) continue;
  if (!existsSync(join(ROOT, name, 'package-lock.json'))) {
    fail(
      `Error: ${name}/package-lock.json is missing. Run "npm install" in ${name}/, ` +
        'then start again.',
    );
  }
  process.stdout.write(`Installing ${name} dependencies...\n`);
  const install = spawn(NPM, ['--prefix', join(ROOT, name), 'ci'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const code = await new Promise((done) => install.on('close', done));
  if (code !== 0) fail(`Error: installing ${name} dependencies failed.`);
}

const children = [];
let shuttingDown = false;

function stopAll(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // On Windows a signal does not reach the whole npm -> tsx/vite tree, so the job
    // object is torn down by killing the process group through taskkill.
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill(signal);
    }
  }
}

for (const { name, colour } of SERVICES) {
  const child = spawn(NPM, ['run', 'dev'], {
    cwd: join(ROOT, name),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  children.push(child);

  const label = `${colour}[${name}]${RESET} `;
  const prefix = (stream, target) => {
    let buffered = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffered += chunk;
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';
      for (const line of lines) target.write(`${label}${line}\n`);
    });
  };
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);

  child.on('close', (code) => {
    if (shuttingDown) return;
    process.stderr.write(`\n${label}exited with code ${code}; stopping the other service.\n`);
    stopAll();
    process.exitCode = code ?? 1;
  });

  child.on('error', (err) => {
    process.stderr.write(`${label}failed to start: ${err.message}\n`);
    stopAll();
    process.exitCode = 1;
  });
}

process.stdout.write(
  `\nF1 dashboard starting.\n` +
    SERVICES.map((s) => `  ${s.name.padEnd(9)} ${s.url}\n`).join('') +
    `${DIM}  Press Ctrl+C to stop both services.${RESET}\n\n`,
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopAll(signal);
  });
}
