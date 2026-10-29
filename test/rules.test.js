import test from 'node:test';
import assert from 'node:assert/strict';
import { etag, requireMatch } from '../src/shared/etag.js';
import { validateConstraints, validateValue } from '../src/modules/parameters/parameter.rules.js';
import { assertDecision, validateRequest } from '../src/modules/change-requests/change-request.rules.js';

test('validates types, dates and value constraints', () => {
  validateValue('MONEY', '15000.00', { min: 0, max: 20000 });
  validateValue('DATE', '2024-02-29');
  assert.throws(() => validateValue('DATE', '2023-02-29'), { code: 'INVALID_VALUE_TYPE' });
  assert.throws(() => validateValue('INTEGER', 1.5), { code: 'INVALID_VALUE_TYPE' });
  assert.throws(() => validateValue('MONEY', '50001', { max: 50000 }), { code: 'VALUE_OUT_OF_RANGE' });
  assert.throws(() => validateConstraints({ min: 10, max: 1 }), { code: 'INVALID_CONSTRAINTS' });
  assert.throws(() => validateConstraints({ pattern: '[' }), { code: 'INVALID_CONSTRAINTS' });
  assert.doesNotThrow(() => validateConstraints({ pattern: '^A' }));
  assert.throws(() => validateValue('STRING', 'B', { allowedValues: ['A'] }), { code: 'VALUE_NOT_ALLOWED' });
  assert.throws(() => validateValue('STRING', 'B', { pattern: '^A' }), { code: 'VALUE_PATTERN_MISMATCH' });
  assert.throws(() => validateValue('INTEGER', 3, { pattern: '^3' }), { code: 'VALUE_PATTERN_MISMATCH' });
  assert.throws(() => validateValue('PERCENTAGE', '-1', { min: 0 }), { code: 'VALUE_OUT_OF_RANGE' });
  assert.throws(() => validateValue('JSON', null), { code: 'INVALID_VALUE_TYPE' });
  assert.doesNotThrow(() => validateValue('JSON', { enabled: true }));
});

test('checks optimistic concurrency and maker-checker separation', () => {
  const request = { createdBy: 'maker', status: 'PENDING_APPROVAL' };
  assert.throws(() => requireMatch(undefined, request), { status: 428 });
  assert.throws(() => requireMatch('"stale"', request), { status: 412 });
  assert.throws(() => assertDecision(request, 'maker', etag(request)), { code: 'MAKER_CHECKER_VIOLATION' });
  assert.doesNotThrow(() => assertDecision(request, 'checker', etag(request)));
  const decided = { ...request, status: 'APPROVED' };
  assert.throws(() => assertDecision(decided, 'checker', etag(decided)), { code: 'INVALID_STATE_TRANSITION' });
});

test('validates proposals and reactivation', () => {
  const parameter = { status: 'DRAFT', dataType: 'BOOLEAN' };
  assert.throws(() => validateRequest(parameter, { changeType: 'SET_VALUE' }, []), { code: 'VALUE_REQUIRED' });
  assert.throws(() => validateRequest(parameter, { changeType: 'REACTIVATE' }, []), { code: 'INVALID_STATE_TRANSITION' });
  assert.doesNotThrow(() => validateRequest(parameter, { changeType: 'SET_VALUE', proposedValue: false }, []));
  const versions = [{ changeType: 'SET_VALUE' }];
  assert.throws(() => validateRequest(parameter, { changeType: 'SET_VALUE', proposedValue: true }, versions), { code: 'BASE_VERSION_REQUIRED' });
  assert.throws(() => validateRequest(parameter, { changeType: 'DEACTIVATE', baseVersionNumber: 1, proposedValue: true }, versions), { code: 'VALUE_NOT_ALLOWED' });
  assert.throws(() => validateRequest(parameter, { changeType: 'DEACTIVATE', baseVersionNumber: 1 }, versions), { code: 'INVALID_STATE_TRANSITION' });
  assert.doesNotThrow(() => validateRequest({ ...parameter, status: 'INACTIVE' }, { changeType: 'REACTIVATE', baseVersionNumber: 1 }, versions));
  assert.throws(() => validateRequest(parameter, { changeType: 'SET_VALUE', proposedValue: true, effectiveFrom: '2030-01-02T00:00:00Z', effectiveTo: '2030-01-01T00:00:00Z' }, [], new Date('2029-01-01T00:00:00Z')), { code: 'INVALID_EFFECTIVE_PERIOD' });
});