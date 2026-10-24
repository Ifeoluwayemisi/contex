import assert from 'node:assert';
import {
  createUser,
  verifyUserCredentials,
  createSession,
  verifySessionToken,
  revokeSession,
  addSearchHistory,
  getUserHistory,
  deleteUserHistoryItem,
  clearUserHistory,
  addSavedSearch,
  getUserSavedSearches,
  deleteSavedSearch
} from '../server/auth.js';

async function runAuthTests() {
  console.log('🔒 Running ContextKeeper Authentication & User Isolation Tests...\n');
  const runId = Date.now();
  const emailA = `alice_${runId}@example.com`;
  const emailB = `bob_${runId}@example.com`;

  // Test 1: User Registration with password hashing
  console.log('Test 1: User registration and password hashing...');
  const userA = createUser(emailA, 'SecurePass123!');
  assert.ok(userA.id, 'User ID should be generated');
  assert.strictEqual(userA.email, emailA);
  assert.ok(userA.name.startsWith('alice_'));
  console.log('✓ Successfully registered User A');

  // Test 2: Duplicate email rejection
  console.log('Test 2: Duplicate email registration rejection...');
  assert.throws(
    () => createUser(emailA, 'AnotherPassword!'),
    /already exists/i,
    'Should throw error on duplicate email'
  );
  console.log('✓ Duplicate email correctly rejected');

  // Test 3: Credential verification
  console.log('Test 3: Credential verification and timing-safe password validation...');
  const verifiedUser = verifyUserCredentials(emailA, 'SecurePass123!');
  assert.ok(verifiedUser, 'Should verify correct credentials');
  assert.strictEqual(verifiedUser?.id, userA.id);

  const wrongPassUser = verifyUserCredentials(emailA, 'WrongPassword!');
  assert.strictEqual(wrongPassUser, null, 'Should reject incorrect password');

  const unknownUser = verifyUserCredentials(`nobody_${runId}@example.com`, 'SecurePass123!');
  assert.strictEqual(unknownUser, null, 'Should reject non-existent user');
  console.log('✓ Credentials verified accurately');

  // Test 4: Session Tokens
  console.log('Test 4: Cryptographic session token generation & verification...');
  const token = createSession(userA.id);
  assert.ok(token && token.length > 30, 'Session token should be strong');

  const sessionUser = verifySessionToken(token);
  assert.ok(sessionUser, 'Token should resolve to user');
  assert.strictEqual(sessionUser?.id, userA.id);

  revokeSession(token);
  const revokedUser = verifySessionToken(token);
  assert.strictEqual(revokedUser, null, 'Revoked token must be invalid');
  console.log('✓ Session token lifecycle works as expected');

  // Test 5: User History Isolation between User A and User B
  console.log('Test 5: Strict account history isolation...');
  const userB = createUser(emailB, 'BobSecurePass789!');

  const itemA1 = addSearchHistory(userA.id, 'acquisition campaign budget 2026', true, 3, ['Campus Acquisition Campaign.pdf']);
  const itemA2 = addSearchHistory(userA.id, 'campus outreach collegiate societies', true, 1);
  const itemB1 = addSearchHistory(userB.id, 'postgresql replication failover', true, 2);

  const historyA = getUserHistory(userA.id);
  const historyB = getUserHistory(userB.id);

  assert.strictEqual(historyA.length, 2, 'User A should have exactly 2 history entries');
  assert.strictEqual(historyB.length, 1, 'User B should have exactly 1 history entry');

  assert.ok(historyA.some(h => h.id === itemA1.id));
  assert.ok(historyA.some(h => h.id === itemA2.id));
  assert.ok(!historyA.some(h => h.id === itemB1.id), 'User A must NEVER see User B queries');

  assert.ok(historyB.some(h => h.id === itemB1.id));
  assert.ok(!historyB.some(h => h.id === itemA1.id), 'User B must NEVER see User A queries');
  console.log('✓ Account history isolation verified');

  // Test 6: History deletion isolation
  console.log('Test 6: History deletion safety...');
  const deletedItem = deleteUserHistoryItem(userA.id, itemA1.id);
  assert.strictEqual(deletedItem, true);

  const remainingA = getUserHistory(userA.id);
  assert.strictEqual(remainingA.length, 1);
  assert.strictEqual(remainingA[0].id, itemA2.id);

  // User B's history should be untouched
  assert.strictEqual(getUserHistory(userB.id).length, 1);

  // User A trying to delete User B's item must fail
  const unauthorizedDelete = deleteUserHistoryItem(userA.id, itemB1.id);
  assert.strictEqual(unauthorizedDelete, false, 'User A cannot delete User B items');
  console.log('✓ User history deletion boundaries verified');

  // Test 7: Saved Searches
  console.log('Test 7: Saved searches and bookmarking...');
  const savedA = addSavedSearch(
    userA.id,
    'campus outreach collegiate societies',
    'Campus Campaign',
    true
  );
  assert.ok(savedA.id);
  assert.strictEqual(savedA.label, 'Campus Campaign');

  const allSavedA = getUserSavedSearches(userA.id);
  assert.strictEqual(allSavedA.length, 1);
  assert.strictEqual(allSavedA[0].id, savedA.id);

  // User B saved searches should be empty
  const allSavedB = getUserSavedSearches(userB.id);
  assert.strictEqual(allSavedB.length, 0);

  deleteSavedSearch(userA.id, savedA.id);
  assert.strictEqual(getUserSavedSearches(userA.id).length, 0);
  console.log('✓ Saved searches isolation verified');

  console.log('\n🎉 ALL AUTHENTICATION AND HISTORY ISOLATION TESTS PASSED!\n');
}

runAuthTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
