import { describe, it, expect, afterEach, vi } from 'vitest';

const DID = 'did:plc:fpruhuo22xkm5o7ttr2ktxdo';
const EXPECTED_URL =
  `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(DID)}`;

async function freshRuntime() {
  vi.resetModules();
  return import('../../src/generator/atproto/identity-runtime');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resolveDidToAvatar()', () => {
  it('calls app.bsky.actor.getProfile on public.api.bsky.app and returns avatar URL', async () => {
    const avatar = 'https://cdn.bsky.app/avatar/abc.jpg';
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ avatar }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { resolveDidToAvatar } = await freshRuntime();
    expect(await resolveDidToAvatar(DID)).toBe(avatar);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(1, EXPECTED_URL);
  });

  it('caches the resolved URL — repeated calls for the same DID issue one fetch', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ avatar: 'https://cdn/x.jpg' }))
    );
    vi.stubGlobal('fetch', fetchMock);

    const { resolveDidToAvatar } = await freshRuntime();
    await resolveDidToAvatar(DID);
    await resolveDidToAvatar(DID);
    await resolveDidToAvatar(DID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches different DIDs independently', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const actor = new URL(url).searchParams.get('actor')!;
      return new Response(JSON.stringify({ avatar: `https://cdn/${actor}.jpg` }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resolveDidToAvatar } = await freshRuntime();
    expect(await resolveDidToAvatar('did:plc:a')).toBe('https://cdn/did:plc:a.jpg');
    expect(await resolveDidToAvatar('did:plc:b')).toBe('https://cdn/did:plc:b.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent calls for the same DID into one fetch', async () => {
    let resolveFetch!: (r: Response) => void;
    const pending = new Promise<Response>((r) => { resolveFetch = r; });
    const fetchMock = vi.fn(() => pending);
    vi.stubGlobal('fetch', fetchMock);

    const { resolveDidToAvatar } = await freshRuntime();
    const [a, b] = [resolveDidToAvatar(DID), resolveDidToAvatar(DID)];
    resolveFetch(new Response(JSON.stringify({ avatar: 'https://cdn/a.jpg' })));

    expect(await a).toBe('https://cdn/a.jpg');
    expect(await b).toBe('https://cdn/a.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null when the profile has no avatar field', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ handle: 'user.bsky.social' }))
    );
    vi.stubGlobal('fetch', fetchMock);

    const { resolveDidToAvatar } = await freshRuntime();
    expect(await resolveDidToAvatar(DID)).toBeNull();
  });

  it('returns null when avatar is not a string', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ avatar: 42 }))
    );
    vi.stubGlobal('fetch', fetchMock);

    const { resolveDidToAvatar } = await freshRuntime();
    expect(await resolveDidToAvatar(DID)).toBeNull();
  });

  it('returns null on non-OK response (e.g., 404) and caches the failure', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { resolveDidToAvatar } = await freshRuntime();
    expect(await resolveDidToAvatar(DID)).toBeNull();
    expect(await resolveDidToAvatar(DID)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });

  it('returns null on network error (does not throw)', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('Network failure'); });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { resolveDidToAvatar } = await freshRuntime();
    await expect(resolveDidToAvatar(DID)).resolves.toBeNull();
  });

  it('returns null on malformed JSON response', async () => {
    const fetchMock = vi.fn(async () => new Response('not json'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { resolveDidToAvatar } = await freshRuntime();
    expect(await resolveDidToAvatar(DID)).toBeNull();
  });

  it('caches null results — subsequent calls for a DID that has no avatar do not refetch', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ handle: 'user.bsky.social' }))
    );
    vi.stubGlobal('fetch', fetchMock);

    const { resolveDidToAvatar } = await freshRuntime();
    await resolveDidToAvatar(DID);
    await resolveDidToAvatar(DID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('generateIdentityTs()', () => {
  it('emits the runtime source verbatim so generated apps get the same behavior', async () => {
    const { generateIdentityTs } = await import('../../src/generator/atproto/Identity');
    const src = generateIdentityTs();

    expect(src).toContain('export async function resolveDidToAvatar');
    expect(src).toContain('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile');
    expect(src).toContain('encodeURIComponent(did)');
  });

  it('emitted source imports nothing from @inlay/* or the wizard', async () => {
    const { generateIdentityTs } = await import('../../src/generator/atproto/Identity');
    const src = generateIdentityTs();

    expect(src).not.toMatch(/from\s+['"]@inlay\//);
    expect(src).not.toMatch(/from\s+['"]\.\.\/\.\.\//);
  });
});
