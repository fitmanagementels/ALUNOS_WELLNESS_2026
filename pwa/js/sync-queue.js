(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.XsteamSync = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  var RETRY_DELAYS = [1000, 2000, 4000, 8000, 30000];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function compare(a, b) { return a.createdAt - b.createdAt || String(a.requestId).localeCompare(String(b.requestId)); }
  function delayFor(attempts) { return RETRY_DELAYS[Math.min(Math.max(0, attempts - 1), RETRY_DELAYS.length - 1)]; }
  function newRequestId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'sync-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function createMemoryStorage(initial) {
    var rows = (initial || []).map(clone);
    return {
      async list() { return rows.slice().sort(compare).map(clone); },
      async put(item) { var index = rows.findIndex(function (row) { return row.requestId === item.requestId; }); if (index === -1) rows.push(clone(item)); else rows[index] = clone(item); },
      async remove(requestId) { rows = rows.filter(function (row) { return row.requestId !== requestId; }); },
      async clear() { rows = []; }
    };
  }

  function createIndexedDbStorage(indexedDb) {
    var database;
    function open() {
      if (database) return Promise.resolve(database);
      return new Promise(function (resolve, reject) {
        var request = indexedDb.open('xsteam-sync-v1', 1);
        request.onupgradeneeded = function () {
          var store = request.result.createObjectStore('outbox', { keyPath: 'requestId' });
          store.createIndex('createdAt', 'createdAt');
        };
        request.onsuccess = function () { database = request.result; resolve(database); };
        request.onerror = function () { reject(request.error || new Error('Não foi possível abrir a fila local.')); };
      });
    }
    function transaction(mode, operation) {
      return open().then(function (db) { return new Promise(function (resolve, reject) {
        var tx = db.transaction('outbox', mode), store = tx.objectStore('outbox'), value;
        tx.oncomplete = function () { resolve(value); };
        tx.onerror = tx.onabort = function () { reject(tx.error || new Error('Não foi possível atualizar a fila local.')); };
        operation(store, function (result) { value = result; });
      }); });
    }
    return {
      list: function () { return transaction('readonly', function (store, done) { var request = store.getAll(); request.onsuccess = function () { done((request.result || []).sort(compare)); }; }); },
      put: function (item) { return transaction('readwrite', function (store) { store.put(clone(item)); }); },
      remove: function (requestId) { return transaction('readwrite', function (store) { store.delete(requestId); }); },
      clear: function () { return transaction('readwrite', function (store) { store.clear(); }); }
    };
  }

  function createSyncQueue(options) {
    options = options || {};
    var storage = options.storage || createIndexedDbStorage(options.indexedDB || indexedDB);
    var send = options.send;
    var now = options.now || Date.now;
    var listeners = [];
    var inFlight = false;
    var lastState = { status: 'saved', pending: 0, error: null };
    if (typeof send !== 'function') throw new Error('A fila precisa de uma função de envio.');

    function publish(next) {
      lastState = Object.assign({}, lastState, next);
      listeners.slice().forEach(function (listener) { listener(lastState); });
    }
    async function status() {
      var pending = (await storage.list()).length;
      publish({ status: pending ? 'pending' : 'saved', pending: pending, error: null });
      return lastState;
    }
    async function enqueue(patches, requestId) {
      if (!Array.isArray(patches) || !patches.length) throw new Error('A alteração não possui campos para salvar.');
      var item = { requestId: requestId || newRequestId(), patches: clone(patches), createdAt: now(), attempts: 0, nextAttemptAt: now() };
      await storage.put(item);
      await status();
      return item;
    }
    async function flush() {
      if (inFlight) return false;
      var entries = await storage.list();
      var entry = entries[0];
      if (!entry) { await status(); return false; }
      if (entry.nextAttemptAt > now()) { publish({ status: 'pending', pending: entries.length, error: null }); return false; }
      inFlight = true;
      publish({ status: 'saving', pending: entries.length, error: null });
      try {
        await send(clone(entry));
        await storage.remove(entry.requestId);
        inFlight = false;
        await status();
        return true;
      } catch (error) {
        entry.attempts += 1;
        entry.nextAttemptAt = now() + delayFor(entry.attempts);
        await storage.put(entry);
        inFlight = false;
        publish({ status: 'pending', pending: entries.length, error: error });
        return false;
      }
    }
    return {
      enqueue: enqueue,
      flush: flush,
      retryNow: async function () { var entries = await storage.list(); if (!entries.length) return false; entries[0].nextAttemptAt = now(); await storage.put(entries[0]); return flush(); },
      subscribe: function (listener) { listeners.push(listener); listener(lastState); return function () { listeners = listeners.filter(function (value) { return value !== listener; }); }; },
      clearForLogout: async function () { await storage.clear(); await status(); },
      status: status
    };
  }

  return { createSyncQueue: createSyncQueue, createMemoryStorage: createMemoryStorage, createIndexedDbStorage: createIndexedDbStorage, RETRY_DELAYS: RETRY_DELAYS };
}));
