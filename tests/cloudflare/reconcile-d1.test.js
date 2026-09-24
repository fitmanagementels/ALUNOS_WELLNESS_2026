const test = require('node:test');
const assert = require('node:assert/strict');

const { reconcileMetrics } = require('../../scripts/reconcile-d1');

test('reconciliação compara totais, IDs e valores sem expor identificadores no relatório', () => {
  const report = reconcileMetrics({
    students: { ids: ['1', '2'], valueCents: 0 },
    contracts: { ids: ['c1', 'c2'], valueCents: 170000 },
    churns: { ids: ['1'], valueCents: 85000 },
    newStudents: { ids: ['3|2026-09-10'], valueCents: 70000 },
    profiles: { ids: ['1'], valueCents: 0 }
  }, {
    students: { ids: ['1', '2'], valueCents: 0 },
    contracts: { ids: ['c1', 'c2'], valueCents: 170000 },
    churns: { ids: ['1'], valueCents: 85000 },
    newStudents: { ids: ['3|2026-09-10'], valueCents: 70000 },
    profiles: { ids: ['1'], valueCents: 0 }
  });
  assert.equal(report.ok, true);
  assert.equal(report.tables.contracts.missingCount, 0);
  assert.equal(report.tables.contracts.valueCents.matches, true);
  assert.equal(JSON.stringify(report).includes('c1'), false);
});

test('reconciliação falha quando há IDs ou soma financeira divergentes', () => {
  const report = reconcileMetrics({
    students: { ids: ['1', '2'], valueCents: 0 },
    contracts: { ids: ['c1'], valueCents: 100 },
    churns: { ids: [], valueCents: 0 }, newStudents: { ids: [], valueCents: 0 }, profiles: { ids: [], valueCents: 0 }
  }, {
    students: { ids: ['1', '9'], valueCents: 0 },
    contracts: { ids: ['c1'], valueCents: 101 },
    churns: { ids: [], valueCents: 0 }, newStudents: { ids: [], valueCents: 0 }, profiles: { ids: [], valueCents: 0 }
  });
  assert.equal(report.ok, false);
  assert.equal(report.tables.students.missingCount, 1);
  assert.equal(report.tables.students.extraCount, 1);
  assert.equal(report.tables.contracts.valueCents.matches, false);
  assert.equal(report.tables.students.missingIdHashes.length, 1);
  assert.match(report.tables.students.missingIdHashes[0], /^[a-f0-9]{12}$/);
});
