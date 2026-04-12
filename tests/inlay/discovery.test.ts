import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  _resetInlayDiscoveryCache,
  discoverInlayComponents,
  parseInlayComponentRecord,
  resolveDidToPds,
  KNOWN_INLAY_AUTHORS,
} from '../../src/inlay/discovery';
import type { InlayAuthor } from '../../src/inlay/discovery';

const DANABRA: InlayAuthor = {
  handle: 'danabra.mov',
  did: 'did:plc:fpruhuo22xkm5o7ttr2ktxdo',
};
const DANSSHADOW: InlayAuthor = {
  handle: 'dansshadow.bsky.social',
  did: 'did:plc:rm4mmytequowusm6smpw53ez',
};

const DANABRA_PDS = 'https://pds.danabra.example';
const DANSSHADOW_PDS = 'https://pds.dansshadow.example';

function plcResponse(pds: string) {
  return new Response(
    JSON.stringify({
      service: [
        {
          id: '#atproto_pds',
          type: 'AtprotoPersonalDataServer',
          serviceEndpoint: pds,
        },
      ],
    }),
    { status: 200 },
  );
}

function listRecordsResponse(
  records: Array<{ uri: string; cid?: string; value: Record<string, unknown> }>,
  cursor?: string,
) {
  return new Response(
    JSON.stringify({
      records: records.map((r) => ({ cid: 'bafy', ...r })),
      ...(cursor ? { cursor } : {}),
    }),
    { status: 200 },
  );
}

const templateRecord = {
  uri: `at://${DANABRA.did}/at.inlay.component/app.bsky.actor.profile`,
  value: {
    $type: 'at.inlay.component',
    description: 'Profile header',
    body: {
      $type: 'at.inlay.component#bodyTemplate',
      node: { $type: 'at.inlay.element', type: 'org.atsui.Stack' },
    },
    view: {
      $type: 'at.inlay.component#view',
      prop: 'profile',
      accepts: [
        {
          $type: 'at.inlay.component#viewRecord',
          collection: 'app.bsky.actor.profile',
          rkey: 'self',
        },
      ],
    },
  },
};

const externalRecord = {
  uri: `at://${DANSSHADOW.did}/at.inlay.component/app.bsky.feed.post`,
  value: {
    $type: 'at.inlay.component',
    description: 'External post renderer',
    body: {
      $type: 'at.inlay.component#bodyExternal',
      did: 'did:web:example.com',
    },
    view: {
      $type: 'at.inlay.component#view',
      prop: 'post',
      accepts: [
        {
          $type: 'at.inlay.component#viewRecord',
          collection: 'app.bsky.feed.post',
        },
      ],
    },
  },
};

const primitiveViewRecord = {
  uri: `at://${DANABRA.did}/at.inlay.component/org.atsui.Text`,
  value: {
    $type: 'at.inlay.component',
    body: {
      $type: 'at.inlay.component#bodyTemplate',
      node: { $type: 'at.inlay.element', type: 'org.atsui.Text' },
    },
    view: {
      $type: 'at.inlay.component#view',
      prop: 'value',
      accepts: [
        {
          $type: 'at.inlay.component#viewPrimitive',
          type: 'string',
        },
      ],
    },
  },
};

describe('parseInlayComponentRecord', () => {
  it('extracts NSID from the rkey of the AT-URI', () => {
    const parsed = parseInlayComponentRecord(templateRecord, DANABRA);
    expect(parsed?.nsid).toBe('app.bsky.actor.profile');
    expect(parsed?.uri).toBe(templateRecord.uri);
  });

  it('classifies template, external, and primitive body types', () => {
    const template = parseInlayComponentRecord(templateRecord, DANABRA);
    const external = parseInlayComponentRecord(externalRecord, DANSSHADOW);
    const primitive = parseInlayComponentRecord(
      {
        uri: `at://${DANABRA.did}/at.inlay.component/org.atsui.Stack`,
        value: { $type: 'at.inlay.component' },
      },
      DANABRA,
    );
    expect(template?.bodyType).toBe('template');
    expect(external?.bodyType).toBe('external');
    expect(primitive?.bodyType).toBe('primitive');
  });

  it('collects viewRecord collections from view.accepts', () => {
    const parsed = parseInlayComponentRecord(templateRecord, DANABRA);
    expect(parsed?.acceptsCollections).toEqual(['app.bsky.actor.profile']);
    expect(parsed?.acceptsPrimitives).toEqual([]);
    expect(parsed?.viewProp).toBe('profile');
  });

  it('collects viewPrimitive types from view.accepts', () => {
    const parsed = parseInlayComponentRecord(primitiveViewRecord, DANABRA);
    expect(parsed?.acceptsPrimitives).toEqual(['string']);
    expect(parsed?.acceptsCollections).toEqual([]);
  });

  it('captures description and author', () => {
    const parsed = parseInlayComponentRecord(templateRecord, DANABRA);
    expect(parsed?.description).toBe('Profile header');
    expect(parsed?.author).toEqual(DANABRA);
  });

  it('preserves the raw record value', () => {
    const parsed = parseInlayComponentRecord(templateRecord, DANABRA);
    expect(parsed?.raw).toBe(templateRecord.value);
  });

  it('returns null for records without a value', () => {
    const parsed = parseInlayComponentRecord(
      { uri: 'at://did:plc:x/at.inlay.component/foo', value: null as unknown as Record<string, unknown> },
      DANABRA,
    );
    expect(parsed).toBeNull();
  });

  it('returns null for records with a malformed AT-URI', () => {
    const parsed = parseInlayComponentRecord(
      { uri: 'not-an-at-uri', value: { $type: 'at.inlay.component' } },
      DANABRA,
    );
    expect(parsed).toBeNull();
  });
});

describe('resolveDidToPds', () => {
  beforeEach(() => {
    _resetInlayDiscoveryCache();
    vi.restoreAllMocks();
  });

  it('returns the PDS endpoint from the DID document', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(plcResponse(DANABRA_PDS));
    const pds = await resolveDidToPds(DANABRA.did);
    expect(pds).toBe(DANABRA_PDS);
  });

  it('caches subsequent lookups for the same DID', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(plcResponse(DANABRA_PDS));
    await resolveDidToPds(DANABRA.did);
    await resolveDidToPds(DANABRA.did);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('strips a trailing slash from the endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      plcResponse(`${DANABRA_PDS}/`),
    );
    const pds = await resolveDidToPds(DANABRA.did);
    expect(pds).toBe(DANABRA_PDS);
  });

  it('throws when the DID document has no atproto_pds service', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ service: [] }), { status: 200 }),
    );
    await expect(resolveDidToPds(DANABRA.did)).rejects.toThrow(/no #atproto_pds/);
  });

  it('throws when PLC returns a non-OK status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('not found', { status: 404 }),
    );
    await expect(resolveDidToPds(DANABRA.did)).rejects.toThrow(/404/);
  });
});

describe('discoverInlayComponents', () => {
  beforeEach(() => {
    _resetInlayDiscoveryCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    _resetInlayDiscoveryCache();
  });

  function routedFetch(
    routes: Array<{ match: (url: string) => boolean; respond: () => Response }>,
  ) {
    return vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const route = routes.find((r) => r.match(url));
      if (!route) {
        return Promise.reject(new Error(`unmocked fetch: ${url}`));
      }
      return Promise.resolve(route.respond());
    });
  }

  it('parses records from every known author and filters out external-body', async () => {
    vi.stubGlobal(
      'fetch',
      routedFetch([
        {
          match: (u) => u.includes(`plc.directory/${encodeURIComponent(DANABRA.did)}`),
          respond: () => plcResponse(DANABRA_PDS),
        },
        {
          match: (u) =>
            u.includes(`plc.directory/${encodeURIComponent(DANSSHADOW.did)}`),
          respond: () => plcResponse(DANSSHADOW_PDS),
        },
        {
          match: (u) => u.startsWith(DANABRA_PDS),
          respond: () => listRecordsResponse([templateRecord, primitiveViewRecord]),
        },
        {
          match: (u) => u.startsWith(DANSSHADOW_PDS),
          respond: () => listRecordsResponse([externalRecord]),
        },
      ]),
    );

    const result = await discoverInlayComponents();
    expect(result.failures).toEqual([]);
    const nsids = result.components.map((c) => c.nsid).sort();
    expect(nsids).toEqual(['app.bsky.actor.profile', 'org.atsui.Text']);
    expect(result.components.every((c) => c.bodyType !== 'external')).toBe(true);
  });

  it('continues when one author fails, reporting the failure', async () => {
    vi.stubGlobal(
      'fetch',
      routedFetch([
        {
          match: (u) => u.includes(`plc.directory/${encodeURIComponent(DANABRA.did)}`),
          respond: () => plcResponse(DANABRA_PDS),
        },
        {
          match: (u) =>
            u.includes(`plc.directory/${encodeURIComponent(DANSSHADOW.did)}`),
          respond: () => new Response('boom', { status: 500 }),
        },
        {
          match: (u) => u.startsWith(DANABRA_PDS),
          respond: () => listRecordsResponse([templateRecord]),
        },
      ]),
    );

    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await discoverInlayComponents();
    expect(result.components).toHaveLength(1);
    expect(result.components[0].nsid).toBe('app.bsky.actor.profile');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].author).toEqual(DANSSHADOW);
    expect(result.failures[0].error).toMatch(/500/);
  });

  it('paginates listRecords via cursor', async () => {
    let danabraCall = 0;
    vi.stubGlobal(
      'fetch',
      routedFetch([
        {
          match: (u) => u.includes('plc.directory'),
          respond: () => plcResponse(DANABRA_PDS),
        },
        {
          match: (u) => u.startsWith(DANABRA_PDS),
          respond: () => {
            danabraCall += 1;
            if (danabraCall === 1) {
              return listRecordsResponse([templateRecord], 'cursor-1');
            }
            return listRecordsResponse([primitiveViewRecord]);
          },
        },
        {
          match: () => true,
          respond: () => listRecordsResponse([]),
        },
      ]),
    );

    const result = await discoverInlayComponents();
    const danabraComponents = result.components.filter(
      (c) => c.author.did === DANABRA.did,
    );
    expect(danabraComponents.map((c) => c.nsid).sort()).toEqual([
      'app.bsky.actor.profile',
      'org.atsui.Text',
    ]);
  });

  it('caches the first completed result', async () => {
    const fetchMock = routedFetch([
      {
        match: (u) => u.includes('plc.directory'),
        respond: () => plcResponse(DANABRA_PDS),
      },
      {
        match: () => true,
        respond: () => listRecordsResponse([]),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await discoverInlayComponents();
    const callsAfterFirst = fetchMock.mock.calls.length;
    await discoverInlayComponents();
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe('KNOWN_INLAY_AUTHORS', () => {
  it('lists danabra.mov and dansshadow.bsky.social', () => {
    const handles = KNOWN_INLAY_AUTHORS.map((a) => a.handle);
    expect(handles).toContain('danabra.mov');
    expect(handles).toContain('dansshadow.bsky.social');
  });
});
