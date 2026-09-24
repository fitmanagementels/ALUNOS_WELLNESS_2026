const test = require('node:test');
const assert = require('node:assert/strict');

const { createSyncQueue, createMemoryStorage } = require('../../pwa/js/sync-queue.js');

test('persiste uma mutação antes de enviá-la e remove somente após confirmação', async () => {
  const storage = createMemoryStorage();
  const calls = [];
  const queue = createSyncQueue({
    storage,
    send: async item => { calls.push(item); return { ok: true }; },
    now: () => 100
  });

  const pending = await queue.enqueue([{ tipo: 'perfilAluno', valores: { id: '42' } }], 'request-42');
  assert.equal(pending.requestId, 'request-42');
  assert.equal((await storage.list()).length, 1);

  await queue.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].requestId, 'request-42');
  assert.equal((await storage.list()).length, 0);
});

test('mantém FIFO, requestId e retentativa exponencial depois de falha', async () => {
  const storage = createMemoryStorage();
  let now = 1000;
  let attempts = 0;
  const queue = createSyncQueue({
    storage,
    now: () => now,
    send: async () => { attempts += 1; throw new Error('offline'); }
  });

  await queue.enqueue([{ tipo: 'perfilAluno', valores: { id: '1' } }], 'first');
  await queue.enqueue([{ tipo: 'perfilAluno', valores: { id: '2' } }], 'second');
  await queue.flush();

  const failed = await storage.list();
  assert.equal(attempts, 1);
  assert.deepEqual(failed.map(item => item.requestId), ['first', 'second']);
  assert.equal(failed[0].attempts, 1);
  assert.equal(failed[0].nextAttemptAt, 2000);

  now = 1999;
  await queue.flush();
  assert.equal(attempts, 1);

  now = 2000;
  await queue.flush();
  assert.equal(attempts, 2);
  assert.equal((await storage.list())[0].nextAttemptAt, 4000);
});

test('recupera itens persistidos quando uma nova instância é criada', async () => {
  const storage = createMemoryStorage([{
    requestId: 'persisted', patches: [{ tipo: 'configDashboard', valores: {} }],
    createdAt: 1, attempts: 0, nextAttemptAt: 0
  }]);
  const sent = [];
  const queue = createSyncQueue({ storage, now: () => 10, send: async item => sent.push(item) });
  await queue.flush();
  assert.deepEqual(sent.map(item => item.requestId), ['persisted']);
  assert.equal((await storage.list()).length, 0);
});

test('PWA carrega a fila persistente antes do dashboard e o dashboard a usa para salvar sem bloquear', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync('pwa/index.html', 'utf8');
  const dashboard = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(html, /<script src="\.\/js\/sync-queue\.js"><\/script><script src="\.\/js\/student-profiles\.js">/);
  assert.match(dashboard, /XsteamSync\.createSyncQueue/);
  assert.match(dashboard, /syncQueue\.enqueue\(\[patch\]\)/);
  assert.doesNotMatch(dashboard, /state\.failedMutations/);
});
