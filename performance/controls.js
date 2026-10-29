import jwt from 'jsonwebtoken';
import { writeFileSync } from 'node:fs';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3010';
const token = process.env.CONSUMER_TOKEN || (process.env.JWT_SECRET && jwt.sign(
  { roles: ['CONSUMER'] }, process.env.JWT_SECRET,
  { subject: 'performance-test', issuer: process.env.JWT_ISSUER || 'rma-service', audience: process.env.JWT_AUDIENCE || 'rma-clients', expiresIn: '10m', algorithm: 'HS256' },
));
if (!token) throw new Error('Set CONSUMER_TOKEN or JWT_SECRET');

const headers = { Authorization: `Bearer ${token}` };
const first = await fetch(`${baseUrl}/api/v1/parameter-values?page=0&size=1`, { headers });
const etag = first.headers.get('etag');
await first.arrayBuffer();
const second = await fetch(`${baseUrl}/api/v1/parameter-values?page=0&size=1`, { headers: { ...headers, 'If-None-Match': etag || '' } });
await second.arrayBuffer();
const loginStatuses = {};
for (let index = 0; index < 21; index++) {
  const response = await fetch(`${baseUrl}/api/v1/auth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'performance-test-unknown-user', password: 'invalid-test-password' }),
  });
  loginStatuses[response.status] = (loginStatuses[response.status] || 0) + 1;
  await response.arrayBuffer();
}
const result = { firstStatus: first.status, etagPresent: Boolean(etag), conditionalStatus: second.status, loginStatuses };
if (process.env.CONTROLS_OUTPUT) writeFileSync(process.env.CONTROLS_OUTPUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (first.status !== 200 || !etag || second.status !== 304 || !loginStatuses[429]) process.exitCode = 1;