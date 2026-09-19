import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../shared/db.mjs';
import { handler as privateHandler } from '../entries-list.mjs';
import { handler as publicHandler } from '../public-entries-list.mjs';

const event = (trackerId = 'leetcode') => ({
  pathParameters: { trackerId },
  requestContext: { authorizer: { jwt: { claims: { sub: 'caller' } } } },
});

function owner(t) {
  const previous = process.env.OWNER_USER_ID;
  process.env.OWNER_USER_ID = 'owner';
  t.after(() => {
    if (previous === undefined) delete process.env.OWNER_USER_ID;
    else process.env.OWNER_USER_ID = previous;
  });
}

for (const [name, handler, user] of [
  ['private', privateHandler, 'caller'],
  ['public', publicHandler, 'owner'],
]) {
  test(`${name} list follows all pages, including an empty continuation page`, async (t) => {
    owner(t);
    const keys = [
      { PK: `USER#${user}`, SK: 'TRACKER#leetcode#ENTRY#3' },
      { PK: `USER#${user}`, SK: 'TRACKER#leetcode#ENTRY#2' },
    ];
    const pages = [
      { Items: [{ data: { id: '3' } }], LastEvaluatedKey: keys[0] },
      { Items: [], LastEvaluatedKey: keys[1] },
      { Items: [{ data: { id: '1' } }] },
    ];
    let calls = 0;
    t.mock.method(ddb, 'send', async (command) => {
      assert.ok(command instanceof QueryCommand);
      const { ExclusiveStartKey, ...query } = command.input;
      assert.deepEqual(query, {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${user}`, ':skPrefix': 'TRACKER#leetcode#ENTRY#',
        },
        ScanIndexForward: false,
      });
      assert.deepEqual(ExclusiveStartKey, calls === 0 ? undefined : keys[calls - 1]);
      assert.ok(calls < pages.length, 'must stop at the final page');
      return pages[calls++];
    });
    const response = await handler(event());
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), [{ id: '3' }, { id: '1' }]);
    assert.equal(calls, 3);
  });

  test(`${name} list returns an empty array for an empty final page`, async (t) => {
    owner(t);
    const db = t.mock.method(ddb, 'send', async () => ({}));
    const response = await handler(event());
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), []);
    assert.equal(db.mock.callCount(), 1);
  });

  test(`${name} list returns an error if a later page fails`, async (t) => {
    owner(t);
    let calls = 0;
    const db = t.mock.method(ddb, 'send', async () => {
      if (calls++ === 0) {
        return { Items: [{ data: { id: '3' } }], LastEvaluatedKey: { PK: `USER#${user}`, SK: 'cursor' } };
      }
      throw new Error('Database unavailable');
    });
    const response = await handler(event());
    assert.equal(response.statusCode, 500);
    assert.deepEqual(JSON.parse(response.body), { error: 'Internal server error' });
    assert.equal(db.mock.callCount(), 2);
  });
}

test('private list requires authentication and validates trackers before querying', async (t) => {
  const db = t.mock.method(ddb, 'send', async () => ({}));
  assert.equal((await privateHandler({ ...event(), requestContext: {} })).statusCode, 401);
  assert.equal((await privateHandler(event('admin'))).statusCode, 400);
  assert.equal(db.mock.callCount(), 0);
});

test('public list enforces the allowlist and configured owner before querying', async (t) => {
  owner(t);
  const db = t.mock.method(ddb, 'send', async () => ({}));
  for (const tracker of ['jobs', 'gaming', 'resume', 'admin', '../etc/passwd', '', null]) {
    assert.equal((await publicHandler(event(tracker))).statusCode, 404);
  }
  delete process.env.OWNER_USER_ID;
  assert.equal((await publicHandler(event())).statusCode, 500);
  assert.equal(db.mock.callCount(), 0);
});

test('public activity list still strips housekeeping keys and missing payloads', async (t) => {
  owner(t);
  t.mock.method(ddb, 'send', async () => ({ Items: [
    { PK: 'USER#owner', SK: 'internal', data: { id: 'activity-1' } },
    { PK: 'USER#owner' },
  ] }));
  const response = await publicHandler(event('activity'));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), [{ id: 'activity-1' }]);
});
