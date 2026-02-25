/**
 * Extracts the Cognito user sub from the Lambda event's JWT claims.
 * API Gateway HTTP API JWT authorizer populates:
 *   event.requestContext.authorizer.jwt.claims
 *
 * @param {import('aws-lambda').APIGatewayProxyEventV2WithJWTAuthorizer} event
 * @returns {string} Cognito user sub
 */
export function getUserId(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims?.sub) {
    throw new Error('Unauthorized: missing sub claim');
  }
  return claims.sub;
}
