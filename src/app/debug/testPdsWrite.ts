/**
 * Temporary PDS write test — call from browser console after logging in:
 *
 *   testPdsWrite()
 *
 * Creates a test record, reads it back, lists records in the collection,
 * then deletes the test record. Logs results at each step.
 *
 * Remove this file once PDS write access is verified.
 */

import { getAgent, getSession } from '../auth/AuthService';

const TEST_COLLECTION = 'com.thelexfiles.appwizard.project';

async function testPdsWrite(): Promise<void> {
  const agent = getAgent();
  const session = getSession();

  if (!agent || !session) {
    console.error('❌ No active session. Log in first.');
    return;
  }

  const repo = session.sub;
  console.log(`🔑 Authenticated as: ${repo}`);
  console.log(`📦 Collection: ${TEST_COLLECTION}`);
  console.log('---');

  // Step 1: Create a test record
  console.log('1️⃣ Creating test record...');
  let rkey: string;
  try {
    const createResult = await agent.com.atproto.repo.createRecord({
      repo,
      collection: TEST_COLLECTION,
      record: {
        projectName: '__PDS_WRITE_TEST__',
        wizardState: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    rkey = createResult.data.uri.split('/').pop()!;
    console.log(`✅ Created — uri: ${createResult.data.uri}`);
    console.log(`   rkey: ${rkey}`);
  } catch (err: any) {
    console.error('❌ createRecord failed:', err.message || err);
    console.error('   Full error:', err);
    return;
  }

  // Step 2: Read the record back
  console.log('2️⃣ Reading record back...');
  try {
    const getResult = await agent.com.atproto.repo.getRecord({
      repo,
      collection: TEST_COLLECTION,
      rkey,
    });
    console.log('✅ Read back:', getResult.data.value);
  } catch (err: any) {
    console.error('❌ getRecord failed:', err.message || err);
    console.error('   Full error:', err);
  }

  // Step 3: List records in the collection
  console.log('3️⃣ Listing records in collection...');
  try {
    const listResult = await agent.com.atproto.repo.listRecords({
      repo,
      collection: TEST_COLLECTION,
      limit: 10,
    });
    console.log(`✅ Found ${listResult.data.records.length} record(s):`);
    for (const record of listResult.data.records) {
      const val = record.value as any;
      console.log(`   - ${record.uri} → projectName: "${val.projectName}"`);
    }
  } catch (err: any) {
    console.error('❌ listRecords failed:', err.message || err);
    console.error('   Full error:', err);
  }

  // Step 4: Delete the test record
  console.log('4️⃣ Deleting test record...');
  try {
    await agent.com.atproto.repo.deleteRecord({
      repo,
      collection: TEST_COLLECTION,
      rkey,
    });
    console.log('✅ Deleted successfully');
  } catch (err: any) {
    console.error('❌ deleteRecord failed:', err.message || err);
    console.error('   Full error:', err);
  }

  // Step 5: Verify deletion
  console.log('5️⃣ Verifying deletion...');
  try {
    const listResult = await agent.com.atproto.repo.listRecords({
      repo,
      collection: TEST_COLLECTION,
      limit: 10,
    });
    const remaining = listResult.data.records.length;
    if (remaining === 0) {
      console.log('✅ Collection is empty — full round-trip succeeded!');
    } else {
      console.log(`⚠️ ${remaining} record(s) still in collection (may be from previous tests)`);
    }
  } catch (err: any) {
    console.error('❌ listRecords (verify) failed:', err.message || err);
  }

  console.log('---');
  console.log('🏁 PDS write test complete.');
}

// Attach to window so it can be called from the console
(window as any).testPdsWrite = testPdsWrite;
