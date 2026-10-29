import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { cpus, freemem, hostname, platform, release, totalmem } from 'node:os';
import { resolve } from 'node:path';
import jwt from 'jsonwebtoken';

const pid = Number(process.env.API_PID);
if (!Number.isInteger(pid) || pid <= 0) throw new Error('Set API_PID to the backend process ID');
const token = process.env.K6_TOKEN || (process.env.JWT_SECRET && jwt.sign(
  { roles: ['CHECKER'] }, process.env.JWT_SECRET,
  { subject: 'checker', issuer: process.env.JWT_ISSUER || 'rma-service', audience: process.env.JWT_AUDIENCE || 'rma-clients', expiresIn: '30m', algorithm: 'HS256' },
));
if (!token) throw new Error('Set K6_TOKEN or JWT_SECRET');

const root = resolve('performance/results');
mkdirSync(root, { recursive: true, mode: 0o700 });
const directory = resolve(root, new Date().toISOString().replaceAll(':', '-'));
mkdirSync(directory, { recursive: false, mode: 0o700 });
const results = {
  startedAt: new Date().toISOString(),
  environment: { pid, hostname: hostname(), platform: platform(), release: release(), cpuCount: cpus().length, cpuModel: cpus()[0]?.model, totalMemoryBytes: totalmem(), node: process.version, baseUrl: process.env.BASE_URL || 'http://127.0.0.1:3010' },
  samples: [],
  scenarios: [],
};
let phase = 'setup';
function sample() {
  const record = { at: new Date().toISOString(), phase, hostFreeMemoryBytes: freemem() };
  try {
    const [cpuPercent, rssKb] = execFileSync('ps', ['-p', String(pid), '-o', '%cpu=,rss='], { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
    record.cpuPercent = cpuPercent;
    record.rssBytes = rssKb * 1024;
  } catch { record.processUnavailable = true; }
  results.samples.push(record);
}
sample();
const interval = setInterval(sample, 5000);
try {
  for (const test of process.env.SMOKE === '1' ? ['smoke'] : ['load', 'spike']) {
    phase = test;
    sample();
    const startedAt = new Date().toISOString();
    const output = createWriteStream(resolve(directory, `${test}.txt`));
    const child = spawn('k6', ['run', '--quiet', '--summary-export', resolve(directory, `${test}-summary.json`), 'performance/load.js'], {
      env: { ...process.env, K6_TOKEN: token, TEST: test }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(output, { end: false });
    child.stderr.pipe(output, { end: false });
    const result = await new Promise((resolveResult, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolveResult({ test, startedAt, endedAt: new Date().toISOString(), code, signal }));
    });
    await new Promise(resolveOutput => output.end(resolveOutput));
    results.scenarios.push(result);
    sample();
    console.log(`${test}: exit=${result.code} results=${directory}`);
  }
} finally {
  clearInterval(interval);
  phase = 'finished';
  sample();
  results.endedAt = new Date().toISOString();
  writeFileSync(resolve(directory, 'resources.json'), JSON.stringify(results, null, 2));
  process.exitCode = results.scenarios.some(result => result.code !== 0) ? 1 : 0;
}