// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockCreateRecord = vi.fn();
const mockGetRecord = vi.fn();
const mockListRecords = vi.fn();
const mockDeleteRecord = vi.fn();
const mockPutRecord = vi.fn();

const mockAgent = {
  com: {
    atproto: {
      repo: {
        createRecord: mockCreateRecord,
        getRecord: mockGetRecord,
        listRecords: mockListRecords,
        deleteRecord: mockDeleteRecord,
        putRecord: mockPutRecord,
      },
    },
  },
};

vi.mock('../../src/app/auth/AuthService', () => ({
  getAgent: vi.fn(() => mockAgent),
  getSession: vi.fn(() => ({ sub: 'did:plc:testuser' })),
}));

import {
  listProjects,
  loadProject,
  saveProject,
  deleteProject,
} from '../../src/app/services/ProjectService';
import type { WizardState } from '../../src/types/wizard';

function makeMinimalState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    lastSaved: '2026-03-25T00:00:00.000Z',
    currentStep: 2,
    activeSection: 'requirements',
    currentRecordTypeIndex: 0,
    appInfo: { appName: 'Test App', domain: '', description: '', authorName: '' },
    recordTypes: [],
    queryMethods: [],
    procedureMethods: [],
    appConfig: { primaryRecordType: '', listDisplayFields: [], outputMethod: 'zip' },
    requirements: [],
    nonDataElements: [],
    components: [],
    views: [{ id: 'v1', name: 'Home', componentIds: [] }],
    hasGenerated: false,
    hasSeenWelcome: true,
    ...overrides,
  };
}

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listProjects', () => {
    it('returns project summaries sorted by updatedAt descending', async () => {
      mockListRecords.mockResolvedValue({
        data: {
          records: [
            {
              uri: 'at://did:plc:testuser/com.thelexfiles.appwizard.project/aaa',
              value: {
                projectName: 'Old Project',
                updatedAt: '2026-03-20T00:00:00.000Z',
                createdAt: '2026-03-18T00:00:00.000Z',
              },
            },
            {
              uri: 'at://did:plc:testuser/com.thelexfiles.appwizard.project/bbb',
              value: {
                projectName: 'New Project',
                updatedAt: '2026-03-25T00:00:00.000Z',
                createdAt: '2026-03-24T00:00:00.000Z',
              },
            },
          ],
        },
      });

      const result = await listProjects();

      expect(result).toHaveLength(2);
      expect(result[0].projectName).toBe('New Project');
      expect(result[0].rkey).toBe('bbb');
      expect(result[1].projectName).toBe('Old Project');
      expect(result[1].rkey).toBe('aaa');
    });

    it('defaults projectName to "Untitled Project" when empty', async () => {
      mockListRecords.mockResolvedValue({
        data: {
          records: [
            {
              uri: 'at://did:plc:testuser/com.thelexfiles.appwizard.project/aaa',
              value: { projectName: '', updatedAt: '2026-03-25T00:00:00.000Z', createdAt: '' },
            },
          ],
        },
      });

      const result = await listProjects();
      expect(result[0].projectName).toBe('Untitled Project');
    });

    it('returns empty array when no records exist', async () => {
      mockListRecords.mockResolvedValue({ data: { records: [] } });

      const result = await listProjects();
      expect(result).toEqual([]);
    });

    it('propagates network errors', async () => {
      mockListRecords.mockRejectedValue(new Error('Network error'));

      await expect(listProjects()).rejects.toThrow('Network error');
    });
  });

  describe('loadProject', () => {
    it('returns deserialized WizardState with metadata', async () => {
      const state = makeMinimalState();
      mockGetRecord.mockResolvedValue({
        data: {
          value: {
            projectName: 'My App',
            wizardState: JSON.stringify(state),
            createdAt: '2026-03-20T00:00:00.000Z',
            updatedAt: '2026-03-25T00:00:00.000Z',
          },
        },
      });

      const result = await loadProject('abc123');

      expect(result.rkey).toBe('abc123');
      expect(result.projectName).toBe('My App');
      expect(result.wizardState.appInfo.appName).toBe('Test App');
      expect(result.createdAt).toBe('2026-03-20T00:00:00.000Z');
    });

    it('throws on invalid JSON in wizardState', async () => {
      mockGetRecord.mockResolvedValue({
        data: {
          value: {
            projectName: 'Bad',
            wizardState: 'not json{{{',
            createdAt: '',
            updatedAt: '',
          },
        },
      });

      await expect(loadProject('abc123')).rejects.toThrow('Failed to parse project data');
    });
  });

  describe('saveProject', () => {
    it('creates a new record when no rkey is provided', async () => {
      mockCreateRecord.mockResolvedValue({
        data: { uri: 'at://did:plc:testuser/com.thelexfiles.appwizard.project/new123' },
      });

      const state = makeMinimalState();
      const rkey = await saveProject(state);

      expect(rkey).toBe('new123');
      expect(mockCreateRecord).toHaveBeenCalledOnce();
      const callArgs = mockCreateRecord.mock.calls[0][0];
      expect(callArgs.repo).toBe('did:plc:testuser');
      expect(callArgs.collection).toBe('com.thelexfiles.appwizard.project');
      expect(callArgs.record.projectName).toBe('Test App');
      expect(JSON.parse(callArgs.record.wizardState).appInfo.appName).toBe('Test App');
    });

    it('updates existing record when rkey is provided', async () => {
      mockGetRecord.mockResolvedValue({
        data: {
          value: { createdAt: '2026-03-20T00:00:00.000Z' },
        },
      });
      mockPutRecord.mockResolvedValue({});

      const state = makeMinimalState();
      const rkey = await saveProject(state, 'existing123');

      expect(rkey).toBe('existing123');
      expect(mockPutRecord).toHaveBeenCalledOnce();
      expect(mockCreateRecord).not.toHaveBeenCalled();
      // Preserves original createdAt
      const callArgs = mockPutRecord.mock.calls[0][0];
      expect(callArgs.record.createdAt).toBe('2026-03-20T00:00:00.000Z');
    });

    it('uses "Untitled Project" when appName is blank', async () => {
      mockCreateRecord.mockResolvedValue({
        data: { uri: 'at://did:plc:testuser/com.thelexfiles.appwizard.project/xyz' },
      });

      const state = makeMinimalState({
        appInfo: { appName: '  ', domain: '', description: '', authorName: '' },
      });
      await saveProject(state);

      const callArgs = mockCreateRecord.mock.calls[0][0];
      expect(callArgs.record.projectName).toBe('Untitled Project');
    });

    it('throws when wizardState exceeds 500KB', async () => {
      const state = makeMinimalState({
        appInfo: {
          appName: 'Big App',
          domain: '',
          description: 'x'.repeat(600000),
          authorName: '',
        },
      });

      await expect(saveProject(state)).rejects.toThrow('too large');
      expect(mockCreateRecord).not.toHaveBeenCalled();
    });

    it('treats null rkey as new project', async () => {
      mockCreateRecord.mockResolvedValue({
        data: { uri: 'at://did:plc:testuser/com.thelexfiles.appwizard.project/new456' },
      });

      const state = makeMinimalState();
      const rkey = await saveProject(state, null);

      expect(rkey).toBe('new456');
      expect(mockCreateRecord).toHaveBeenCalledOnce();
    });
  });

  describe('deleteProject', () => {
    it('calls deleteRecord with correct params', async () => {
      mockDeleteRecord.mockResolvedValue({});

      await deleteProject('del123');

      expect(mockDeleteRecord).toHaveBeenCalledWith({
        repo: 'did:plc:testuser',
        collection: 'com.thelexfiles.appwizard.project',
        rkey: 'del123',
      });
    });

    it('propagates errors', async () => {
      mockDeleteRecord.mockRejectedValue(new Error('Not found'));

      await expect(deleteProject('bad')).rejects.toThrow('Not found');
    });
  });
});

describe('ProjectService — unauthenticated', () => {
  it('throws when not authenticated', async () => {
    // Re-import with null session
    vi.resetModules();
    vi.doMock('../../src/app/auth/AuthService', () => ({
      getAgent: vi.fn(() => null),
      getSession: vi.fn(() => null),
    }));
    const { listProjects: list } = await import('../../src/app/services/ProjectService');
    await expect(list()).rejects.toThrow('Not authenticated');
  });
});
