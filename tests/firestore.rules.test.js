const assert = require('node:assert/strict')
const test = require('node:test')
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing')
const { doc, deleteDoc, getDoc, setDoc, updateDoc } = require('firebase/firestore')
const fs = require('node:fs')
const path = require('node:path')

const projectId = 'taskflow-rules-test'
const users = { a: 'user-a', b: 'user-b' }
const collections = ['tasks', 'incidents', 'notes']
let testEnv

function userDoc(db, uid, collection, id = 'fixture') {
  return doc(db, 'users', uid, collection, id)
}

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'),
    },
  })
})

test.after(async () => {
  await testEnv.cleanup()
})

test.beforeEach(async () => {
  await testEnv.clearFirestore()
})

test('rules compile and load in the Firestore emulator', async () => {
  const db = testEnv.authenticatedContext(users.a).firestore()
  await assertSucceeds(setDoc(userDoc(db, users.a, 'tasks', 'compile-check'), { title: 'ok' }))
})

test('unauthenticated requests are denied', async () => {
  const db = testEnv.unauthenticatedContext().firestore()
  for (const collection of collections) {
    const ref = userDoc(db, users.a, collection)
    await assertFails(getDoc(ref))
    await assertFails(setDoc(ref, { title: 'blocked' }))
    await assertFails(updateDoc(ref, { title: 'blocked' }))
    await assertFails(deleteDoc(ref))
  }
})

test('a user can create, read, update, and delete their own documents', async () => {
  const db = testEnv.authenticatedContext(users.a).firestore()
  for (const collection of collections) {
    const ref = userDoc(db, users.a, collection, `${collection}-own`)
    await assertSucceeds(setDoc(ref, { title: 'created' }))
    await assertSucceeds(getDoc(ref))
    await assertSucceeds(updateDoc(ref, { title: 'updated' }))
    await assertSucceeds(deleteDoc(ref))
  }
})

test('a user cannot access another user\'s documents', async () => {
  const ownerDb = testEnv.authenticatedContext(users.a).firestore()
  const otherDb = testEnv.authenticatedContext(users.b).firestore()
  for (const collection of collections) {
    const ownerRef = userDoc(ownerDb, users.a, collection, `${collection}-private`)
    const otherRef = userDoc(otherDb, users.a, collection, `${collection}-private`)
    await assertSucceeds(setDoc(ownerRef, { title: 'private' }))
    await assertFails(getDoc(otherRef))
    await assertFails(setDoc(otherRef, { title: 'overwrite' }))
    await assertFails(updateDoc(otherRef, { title: 'overwrite' }))
    await assertFails(deleteDoc(otherRef))
  }
})

test('unrecognised paths are denied', async () => {
  const db = testEnv.authenticatedContext(users.a).firestore()
  const ref = doc(db, 'users', users.a, 'unknown', 'document')
  await assertFails(getDoc(ref))
  await assertFails(setDoc(ref, { blocked: true }))
})
