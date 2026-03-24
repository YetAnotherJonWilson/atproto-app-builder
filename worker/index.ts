/**
 * Cloudflare Worker entry point.
 *
 * Handles /api/* routes for lexicon publishing.
 * All other requests fall through to the static app assets.
 */

interface Env {
  ASSETS: Fetcher;
  PDS_HANDLE: string;
  PDS_APP_PASSWORD: string;
  CF_ZONE_ID: string;
  CF_DNS_API_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API routes
    if (url.pathname === '/api/publish' && request.method === 'POST') {
      return handlePublish(request, env);
    }

    // Everything else: serve static app assets
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handlePublish(_request: Request, _env: Env): Promise<Response> {
  // TODO: implement — see lexicon-publishing.md spec
  return Response.json({ error: 'Not yet implemented' }, { status: 501 });
}
