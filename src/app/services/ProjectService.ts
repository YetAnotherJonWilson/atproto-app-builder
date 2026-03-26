/**
 * PDS project persistence — CRUD operations for wizard project records.
 *
 * Each project is stored as a record in the user's PDS under the
 * `com.thelexfiles.appwizard.project` collection.
 */

import { getAgent, getSession } from '../auth/AuthService';
import type { WizardState } from '../../types/wizard';

const COLLECTION = 'com.thelexfiles.appwizard.project';

export interface ProjectSummary {
  rkey: string;
  projectName: string;
  updatedAt: string;
  createdAt: string;
}

export interface ProjectRecord {
  rkey: string;
  projectName: string;
  wizardState: WizardState;
  createdAt: string;
  updatedAt: string;
}

/**
 * List all projects in the user's PDS without deserializing wizardState.
 * Returns summaries sorted by updatedAt descending (most recent first).
 */
export async function listProjects(): Promise<ProjectSummary[]> {
  const agent = getAgent();
  const session = getSession();
  if (!agent || !session) throw new Error('Not authenticated');

  const result = await agent.com.atproto.repo.listRecords({
    repo: session.sub,
    collection: COLLECTION,
    limit: 100,
  });

  const summaries: ProjectSummary[] = result.data.records.map((record) => {
    const val = record.value as Record<string, unknown>;
    const rkey = record.uri.split('/').pop()!;
    return {
      rkey,
      projectName: (val.projectName as string) || 'Untitled Project',
      updatedAt: (val.updatedAt as string) || '',
      createdAt: (val.createdAt as string) || '',
    };
  });

  summaries.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return summaries;
}

/**
 * Load a single project by rkey, deserializing the wizardState.
 */
export async function loadProject(rkey: string): Promise<ProjectRecord> {
  const agent = getAgent();
  const session = getSession();
  if (!agent || !session) throw new Error('Not authenticated');

  const result = await agent.com.atproto.repo.getRecord({
    repo: session.sub,
    collection: COLLECTION,
    rkey,
  });

  const val = result.data.value as Record<string, unknown>;
  const stateJson = val.wizardState as string;

  let wizardState: WizardState;
  try {
    wizardState = JSON.parse(stateJson);
  } catch {
    throw new Error('Failed to parse project data');
  }

  return {
    rkey,
    projectName: (val.projectName as string) || 'Untitled Project',
    wizardState,
    createdAt: (val.createdAt as string) || '',
    updatedAt: (val.updatedAt as string) || '',
  };
}

/**
 * Save a project to PDS. If rkey is provided, updates the existing record.
 * Otherwise creates a new record. Returns the rkey.
 */
export async function saveProject(
  state: WizardState,
  rkey?: string | null,
): Promise<string> {
  const agent = getAgent();
  const session = getSession();
  if (!agent || !session) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const projectName = state.appInfo.appName.trim() || 'Untitled Project';
  const wizardStateJson = JSON.stringify(state);

  // Check size limit (500KB)
  if (new Blob([wizardStateJson]).size > 500000) {
    throw new Error(
      'Project too large to save to your PDS. You can continue working locally.',
    );
  }

  const record = {
    $type: COLLECTION,
    projectName,
    wizardState: wizardStateJson,
    createdAt: now,
    updatedAt: now,
  };

  // If no rkey provided, check PDS for an existing project with the same name
  // to avoid creating duplicates when localStorage tracking is lost.
  if (!rkey) {
    try {
      const existing = await listProjects();
      const match = existing.find((p) => p.projectName === projectName);
      if (match) {
        rkey = match.rkey;
      }
    } catch {
      // If listing fails, proceed with creating a new record
    }
  }

  if (rkey) {
    // Update existing — preserve original createdAt
    try {
      const existing = await agent.com.atproto.repo.getRecord({
        repo: session.sub,
        collection: COLLECTION,
        rkey,
      });
      const existingVal = existing.data.value as Record<string, unknown>;
      record.createdAt = (existingVal.createdAt as string) || now;
    } catch {
      // If we can't read the existing record, just use now for createdAt
    }

    await agent.com.atproto.repo.putRecord({
      repo: session.sub,
      collection: COLLECTION,
      rkey,
      record,
    });
    return rkey;
  } else {
    // Create new
    const result = await agent.com.atproto.repo.createRecord({
      repo: session.sub,
      collection: COLLECTION,
      record,
    });
    return result.data.uri.split('/').pop()!;
  }
}

/**
 * Delete a project from PDS.
 */
export async function deleteProject(rkey: string): Promise<void> {
  const agent = getAgent();
  const session = getSession();
  if (!agent || !session) throw new Error('Not authenticated');

  await agent.com.atproto.repo.deleteRecord({
    repo: session.sub,
    collection: COLLECTION,
    rkey,
  });
}
