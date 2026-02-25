import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateTrackerId, validateBody } from '../shared/validate.mjs';

// ─── validateTrackerId ─────────────────────────────────────────────────────

describe('validateTrackerId', () => {
  test('accepts every known tracker', () => {
    const valid = ['leetcode', 'activity', 'jobs', 'gaming', 'resume'];
    for (const id of valid) {
      assert.doesNotThrow(() => validateTrackerId(id), `expected "${id}" to be valid`);
    }
  });

  test('throws 400 for an unknown tracker', () => {
    try {
      validateTrackerId('admin');
      assert.fail('should have thrown');
    } catch (e) {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /Invalid tracker/);
    }
  });

  test('throws 400 for an empty string', () => {
    try {
      validateTrackerId('');
      assert.fail('should have thrown');
    } catch (e) {
      assert.equal(e.statusCode, 400);
    }
  });

  test('throws 400 for undefined', () => {
    try {
      validateTrackerId(undefined);
      assert.fail('should have thrown');
    } catch (e) {
      assert.equal(e.statusCode, 400);
    }
  });

  test('is case-sensitive — rejects "LeetCode"', () => {
    try {
      validateTrackerId('LeetCode');
      assert.fail('should have thrown');
    } catch (e) {
      assert.equal(e.statusCode, 400);
    }
  });
});

// ─── validateBody ──────────────────────────────────────────────────────────

describe('validateBody', () => {
  test('accepts a plain object', () => {
    assert.doesNotThrow(() => validateBody({ problem: 'Two Sum', difficulty: 'Easy' }));
  });

  test('accepts an empty object', () => {
    assert.doesNotThrow(() => validateBody({}));
  });

  test('throws 400 for an array', () => {
    try {
      validateBody([1, 2, 3]);
      assert.fail('should have thrown');
    } catch (e) {
      assert.equal(e.statusCode, 400);
    }
  });

  test('throws 400 for a string', () => {
    try {
      validateBody('hello');
      assert.fail('should have thrown');
    } catch (e) {
      assert.equal(e.statusCode, 400);
    }
  });

  test('throws 400 for null', () => {
    try {
      validateBody(null);
      assert.fail('should have thrown');
    } catch (e) {
      assert.equal(e.statusCode, 400);
    }
  });

  test('throws 400 when body exceeds 10 KB', () => {
    const big = { notes: 'x'.repeat(10_001) };
    try {
      validateBody(big);
      assert.fail('should have thrown');
    } catch (e) {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /byte limit/);
    }
  });

  test('accepts a body right at the 10 KB limit', () => {
    // JSON.stringify({ notes: '...' }) adds 12 chars of structure: '{"notes":"' + '"}'
    // So value length = 10_000 - 12 = 9_988 produces exactly 10,000 chars (not > limit)
    const notes = 'x'.repeat(9_988);
    assert.doesNotThrow(() => validateBody({ notes }));
  });
});
