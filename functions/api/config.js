const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
    turnstileRequired: env.TURNSTILE_REQUIRED === 'true' && env.MOCK_AI !== 'true',
    googleOAuthClientId: env.GOOGLE_OAUTH_CLIENT_ID || '',
  }), { headers });
}
