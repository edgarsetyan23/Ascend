import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './shared/db.mjs';
import { ok, err } from './shared/response.mjs';

// Only these trackers are safe to expose publicly — Gaming and Jobs are private
const ALLOWED_TRACKERS = new Set(['leetcode', 'activity']);

/**
 * GET /public/trackers/{trackerId}/entries
 *
 * Unauthenticated endpoint — serves the owner's LeetCode and Daily Activity
 * data to recruiters/hiring managers without requiring a login.
 *
 * Security model:
 *  - OWNER_USER_ID is set at deploy time; no user input touches the DynamoDB PK
 *  - Whitelist rejects any tracker not in ALLOWED_TRACKERS (returns 404, not 403,
 *    to avoid leaking which trackers exist)
 *  - IAM: grantReadData only — this function cannot write anything
 */
export async function handler(event) {
  try {
    const { trackerId } = event.pathParameters ?? {};

    // Whitelist check — return 404 (not 403) to avoid leaking tracker names
    if (!ALLOWED_TRACKERS.has(trackerId)) {
      return err(404, 'Not found');
    }

    const userId = process.env.OWNER_USER_ID;
    if (!userId) {
      console.error('OWNER_USER_ID env var is not set');
      return err(500, 'Internal server error');
    }

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':skPrefix': `TRACKER#${trackerId}#ENTRY#`,
        },
        ScanIndexForward: false, // newest first
      }),
    );

    // Strip DynamoDB housekeeping keys — return only the app payload
    const entries = (result.Items ?? [])
      .map((item) => item.data)
      .filter(Boolean);

    return ok(entries);
  } catch (e) {
    console.error('public-entries-list error:', e);
    return err(500, 'Internal server error');
  }
}
