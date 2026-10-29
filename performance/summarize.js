import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const directory = process.argv[2];
if (!directory) throw new Error('Provide a results directory');
const read = name => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
const resources = read('resources.json');
const report = { environment: resources.environment, startedAt: resources.startedAt, endedAt: resources.endedAt, scenarios: {} };

function summarizeResources(samples) {
  const valid = samples.filter(sample => Number.isFinite(sample.cpuPercent) && Number.isFinite(sample.rssBytes));
  if (!valid.length) return { samples: 0 };
  return {
    samples: valid.length,
    cpuAveragePercent: valid.reduce((sum, sample) => sum + sample.cpuPercent, 0) / valid.length,
    cpuMaxPercent: Math.max(...valid.map(sample => sample.cpuPercent)),
    rssMaxMiB: Math.max(...valid.map(sample => sample.rssBytes)) / 1024 / 1024,
  };
}

for (const scenario of resources.scenarios) {
  const metrics = read(`${scenario.test}-summary.json`).metrics;
  const selected = {};
  for (const [name, value] of Object.entries(metrics)) {
    if (/^(http_req_duration|http_req_failed|http_reqs|responses_429|responses_5xx|responses_network_error|checks|vus|vus_max)(\{|$)/.test(name)) selected[name] = value;
  }
  const samples = resources.samples.filter(sample => sample.phase === scenario.test);
  const phases = { total: summarizeResources(samples) };
  if (scenario.test === 'spike') {
    const start = Date.parse(scenario.startedAt);
    for (const [name, from, to] of [['baseline', 0, 30], ['peak', 30, 90], ['cooldown', 90, 100], ['recovery', 100, 160]]) {
      phases[name] = summarizeResources(samples.filter(sample => {
        const seconds = (Date.parse(sample.at) - start) / 1000;
        return seconds >= from && seconds < to;
      }));
    }
  }
  report.scenarios[scenario.test] = { exitCode: scenario.code, startedAt: scenario.startedAt, endedAt: scenario.endedAt, metrics: selected, resources: phases };
}
console.log(JSON.stringify(report, null, 2));