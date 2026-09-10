import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../shared/db.mjs';
import { handler } from '../entries-update.mjs';

const event = (patch) => ({
  pathParameters: { trackerId: 'jobs', entryId: 'job-1' },
  requestContext: { authorizer: { jwt: { claims: { sub: 'user-1' } } } },
  body: JSON.stringify(patch),
});

// Database boundary fake: interpret the supported DynamoDB SET assignments,
// including whole-attribute replacement, rather than reproducing handler logic.
function mockDatabase(t, item) {
  return t.mock.method(ddb, 'send', async (command) => {
    assert.ok(command instanceof UpdateCommand);
    const input = command.input;
    assert.deepEqual(input.Key, {
      PK: 'USER#user-1', SK: 'TRACKER#jobs#ENTRY#job-1',
    });
    assert.equal(input.ConditionExpression, 'attribute_exists(PK)');
    assert.equal(input.ReturnValues, 'ALL_NEW');
    if (!item) {
      throw Object.assign(new Error('Missing item'), { name: 'ConditionalCheckFailedException' });
    }
    assert.ok(input.UpdateExpression.startsWith('SET '));
    for (const assignment of input.UpdateExpression.slice(4).split(',')) {
      const [path, value] = assignment.trim().split(/\s*=\s*/);
      const keys = path.split('.').map((alias) => {
        assert.ok(Object.hasOwn(input.ExpressionAttributeNames, alias));
        return input.ExpressionAttributeNames[alias];
      });
      let target = item;
      for (const key of keys.slice(0, -1)) target = target[key];
      assert.ok(Object.hasOwn(input.ExpressionAttributeValues, value));
      target[keys.at(-1)] = structuredClone(input.ExpressionAttributeValues[value]);
    }
    return { Attributes: structuredClone(item) };
  });
}

test('Gmail status-only update preserves all saved job details', async (t) => {
  const original = {
    id: 'job-1', company: 'Example Co', role: 'Engineer', status: 'Applied',
    appliedDate: '2026-09-01', interviewDate: '2026-09-12', createdAt: 123,
    updatedAt: 456, source: 'Referral', notes: 'Keep these notes',
    custom: { contact: 'Recruiter', tags: ['remote'] },
  };
  const item = { data: structuredClone(original) };
  const db = mockDatabase(t, item);
  const response = await handler(event({ status: 'Interview' }));
  assert.equal(response.statusCode, 200);
  assert.equal(db.mock.callCount(), 1);
  assert.ok(item.data.updatedAt > original.updatedAt);
  assert.deepEqual(item.data, { ...original, status: 'Interview', updatedAt: item.data.updatedAt });
  assert.deepEqual(JSON.parse(response.body), item.data);
});

test('patch supports literal field names and explicit empty/null values', async (t) => {
  const item = { data: { id: 'job-1', company: 'Example Co', notes: 'Old', custom: 'Old' } };
  mockDatabase(t, item);
  const response = await handler(event({ notes: '', custom: null, 'contact.name': 'Pat', id: 'wrong', updatedAt: 0 }));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(item.data, {
    id: 'job-1', company: 'Example Co', notes: '', custom: null,
    'contact.name': 'Pat', updatedAt: item.data.updatedAt,
  });
  assert.ok(item.data.updatedAt > 0);
});

test('missing entry returns 404 without creating an entry', async (t) => {
  mockDatabase(t, undefined);
  const response = await handler(event({ status: 'Interview' }));
  assert.equal(response.statusCode, 404);
});

test('unauthenticated updates never reach the database', async (t) => {
  const db = mockDatabase(t, undefined);
  const response = await handler({ ...event({ status: 'Interview' }), requestContext: {} });
  assert.equal(response.statusCode, 401);
  assert.equal(db.mock.callCount(), 0);
});
