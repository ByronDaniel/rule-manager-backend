import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3010';
const token = __ENV.K6_TOKEN;
const test = __ENV.TEST || 'load';
const rateLimited = new Counter('responses_429');
const serverErrors = new Counter('responses_5xx');
const networkErrors = new Counter('responses_network_error');

if (!token) throw new Error('K6_TOKEN is required');

const scenarios = {
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '1m', target: 0 },
    ],
    gracefulRampDown: '10s',
  },
  baseline: {
    executor: 'constant-vus',
    vus: 50,
    duration: '30s',
    gracefulStop: '0s',
  },
  spike: {
    executor: 'ramping-vus',
    startTime: '30s',
    startVUs: 0,
    stages: [
      { duration: '0s', target: 500 },
      { duration: '1m', target: 500 },
      { duration: '0s', target: 0 },
    ],
    gracefulRampDown: '0s',
  },
  recovery: {
    executor: 'constant-vus',
    vus: 1,
    duration: '1m',
    startTime: '1m40s',
  },
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '3s',
  },
};

if (!['load', 'spike', 'smoke'].includes(test)) throw new Error('TEST must be load, spike, or smoke');

export const options = {
  scenarios: test === 'spike' ? { baseline: scenarios.baseline, spike: scenarios.spike, recovery: scenarios.recovery } : { [test]: scenarios[test] },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>0.99'],
    ...(test === 'spike' ? {
      'http_req_failed{scenario:baseline}': ['rate<0.01'],
      'http_req_duration{scenario:baseline}': ['p(95)<1000'],
      'http_reqs{scenario:baseline}': ['count>0'],
      'http_req_failed{scenario:spike}': ['rate<0.01'],
      'http_req_duration{scenario:spike}': ['p(95)<1000'],
      'http_reqs{scenario:spike}': ['count>0'],
      'responses_429{scenario:spike}': ['count>=0'],
      'responses_5xx{scenario:spike}': ['count>=0'],
      'responses_network_error{scenario:spike}': ['count>=0'],
      'http_req_failed{scenario:recovery}': ['rate<0.01'],
      'http_req_duration{scenario:recovery}': ['p(95)<1000'],
      'http_reqs{scenario:recovery}': ['count>0'],
    } : {}),
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export default function () {
  const response = http.get(`${baseUrl}/api/v1/change-requests?page=0&size=20`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: '10s',
    tags: { name: 'list_change_requests' },
  });
  rateLimited.add(response.status === 429 ? 1 : 0);
  serverErrors.add(response.status >= 500 ? 1 : 0);
  networkErrors.add(response.status === 0 ? 1 : 0);
  check(response, { 'status is 200': result => result.status === 200 });
  sleep(1);
}