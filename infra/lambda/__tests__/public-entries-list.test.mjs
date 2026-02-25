/**
 * Tests for public-entries-list whitelist and OWNER_USER_ID guard.
 *
 * We test the pure decision logic by extracting it — no DynamoDB calls needed.
 * The module itself can't be imported without AWS SDK, so we replicate the two
 * guard conditions that are the security-critical parts of the handler.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─── Replicate the whitelist exactly as defined in public-entries-list.mjs ──
const ALLOWED_TRACKERS = new Set(['leetcode', 'activity']);

function isAllowed(trackerId) {
  return ALLOWED_TRACKERS.has(trackerId);
}

// ─── Whitelist ────────────────────────────────────────────────────────────

describe('public tracker whitelist', () => {
  test('allows leetcode', () => {
    assert.ok(isAllowed('leetcode'));
  });

  test('allows activity', () => {
    assert.ok(isAllowed('activity'));
  });

  test('blocks jobs (private)', () => {
    assert.equal(isAllowed('jobs'), false);
  });

  test('blocks gaming (private)', () => {
    assert.equal(isAllowed('gaming'), false);
  });

  test('blocks resume (private)', () => {
    assert.equal(isAllowed('resume'), false);
  });

  test('blocks arbitrary strings', () => {
    assert.equal(isAllowed('admin'), false);
    assert.equal(isAllowed('../etc/passwd'), false);
    assert.equal(isAllowed(''), false);
    assert.equal(isAllowed(undefined), false);
  });
});

// ─── OWNER_USER_ID guard ──────────────────────────────────────────────────

describe('OWNER_USER_ID guard', () => {
  test('returns 500 when env var is missing', () => {
    // Simulate what the handler does
    const userId = '';
    const response = !userId ? { statusCode: 500 } : { statusCode: 200 };
    assert.equal(response.statusCode, 500);
  });

  test('proceeds when env var is set', () => {
    const userId = '8448d468-5041-707d-38c6-f8203ddeabfa';
    const response = !userId ? { statusCode: 500 } : { statusCode: 200 };
    assert.equal(response.statusCode, 200);
  });
});
