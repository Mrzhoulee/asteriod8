'use strict';

// Shared mock factory for firebase-admin used by the unit tests.
// Returns an object with reset() so each test can start clean.

function makeAdminMock() {
  const calls = {
    create: [], get: [], update: [], set: [], add: [],
    rtdbSet: [], rtdbPush: [], rtdbOnce: [],
    messagingSend: [],
  };

  // Predefined responses keyed by collection/doc path
  const docState = new Map();   // 'audit_log/{id}' → { exists: bool, data: () => {} }
  const querySnapshots = new Map(); // collection.where(...).get() responses

  function docHandle(collectionName, id) {
    const fullPath = `${collectionName}/${id}`;
    return {
      get: async () => {
        calls.get.push(fullPath);
        const state = docState.get(fullPath);
        return state || { exists: false, data: () => ({}) };
      },
      create: async (data) => {
        calls.create.push({ path: fullPath, data });
        const state = docState.get(fullPath);
        if (state && state.exists) {
          const err = new Error('Document already exists');
          err.code = 6;
          throw err;
        }
        docState.set(fullPath, { exists: true, data: () => data });
      },
      update: async (data) => {
        calls.update.push({ path: fullPath, data });
        const cur = (docState.get(fullPath) || { data: () => ({}) }).data();
        docState.set(fullPath, { exists: true, data: () => ({ ...cur, ...data }) });
      },
      set: async (data, opts) => {
        calls.set.push({ path: fullPath, data, opts });
        const cur = (opts && opts.merge && docState.get(fullPath))
          ? docState.get(fullPath).data()
          : {};
        docState.set(fullPath, { exists: true, data: () => ({ ...cur, ...data }) });
      },
    };
  }

  function collectionHandle(name) {
    return {
      doc: (id) => docHandle(name, id),
      add: async (data) => {
        calls.add.push({ collection: name, data });
        return { id: 'mock-' + Math.random().toString(36).slice(2, 9) };
      },
      where: () => ({
        orderBy: () => ({
          limit: () => ({
            get: async () => querySnapshots.get(name) || { empty: true, docs: [] },
          }),
        }),
        limit: () => ({
          get: async () => querySnapshots.get(name) || { empty: true, docs: [] },
        }),
        get: async () => querySnapshots.get(name) || { empty: true, docs: [] },
      }),
    };
  }

  const firestoreMock = {
    collection: collectionHandle,
    runTransaction: async (fn) => {
      const txn = {
        get: (ref) => ref.get(),
        set: (ref, data, opts) => ref.set(data, opts),
        update: (ref, data) => ref.update(data),
      };
      return fn(txn);
    },
    FieldValue: {
      increment: (n) => ({ _inc: n }),
      serverTimestamp: () => 'SERVER_NOW',
    },
    Timestamp: { fromDate: (d) => ({ toDate: () => d, _date: d }) },
  };

  const rtdbRefHandle = (path) => ({
    set: async (data) => { calls.rtdbSet.push({ path, data }); },
    push: () => { calls.rtdbPush.push({ path }); return { key: 'mock-push-' + Math.random().toString(36).slice(2, 7) }; },
    once: async () => { calls.rtdbOnce.push({ path }); return { val: () => null }; },
    update: async (data) => { calls.rtdbSet.push({ path, data, op: 'update' }); },
  });
  const databaseMock = {
    ref: rtdbRefHandle,
    ServerValue: { TIMESTAMP: 'SERVER_NOW' },
  };

  const messagingMock = {
    send: async (m) => { calls.messagingSend.push(m); },
  };

  const authMock = {
    verifyIdToken: async (token) => ({ uid: 'caller-uid', email: 'caller@example.com' }),
  };

  return {
    admin: {
      initializeApp: () => {},
      firestore: Object.assign(() => firestoreMock, firestoreMock),
      database: Object.assign(() => databaseMock, databaseMock),
      messaging: () => messagingMock,
      auth: () => authMock,
    },
    calls,
    setDoc(fullPath, data) { docState.set(fullPath, { exists: true, data: () => data }); },
    setQuery(name, snapshot) { querySnapshots.set(name, snapshot); },
    reset() {
      Object.keys(calls).forEach((k) => { calls[k].length = 0; });
      docState.clear();
      querySnapshots.clear();
    },
  };
}

// Singleton so the jest.mock factory and the test body share state.
let _singleton = null;
function getMock() {
  if (!_singleton) _singleton = makeAdminMock();
  return _singleton;
}
function resetSingleton() { _singleton = null; }

module.exports = { makeAdminMock, getMock, resetSingleton };
