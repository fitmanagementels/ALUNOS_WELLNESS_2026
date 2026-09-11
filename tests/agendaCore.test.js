const assert = require("node:assert/strict");

require.extensions[".gs"] = require.extensions[".js"];
const core = require("../Appscript/AgendaCore.gs");

const header = [
  "ID",
  "Nome",
  "Dias",
  "Status",
  "Prof1",
  "Dia1",
  "Hora1",
  "Prof2",
  "Dia2",
  "Hora2",
  "Prof3",
  "Dia3",
  "Hora3",
  "Prof4",
  "Dia4",
  "Hora4",
  "Prof5",
  "Dia5",
  "Hora5",
  "Prof6",
  "Dia6",
  "Hora6",
  "Observações",
];

function run() {
  const sheetValues = [
    header,
    [
      "A1",
      "Ana Silva",
      2,
      "Ativo",
      "Prof A",
      "Segunda",
      "05:15",
      "Prof B",
      "Quarta",
      new Date(1899, 11, 30, 15, 30),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Preferencia manhã",
    ],
    [
      "B2",
      "Bruno Costa",
      1,
      "Pausado",
      "Prof A",
      "Segunda-feira",
      new Date(1899, 11, 30, 12, 0),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "C3",
      "Carla Souza",
      0,
      "ativo ",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
  ];

  const appData = core.buildAgendaAppDataFromValues(sheetValues);

  assert.equal(appData.students.length, 3);
  assert.equal(appData.lessons.length, 3);
  assert.deepEqual(appData.statuses, ["Ativo", "Pausado"]);
  assert.deepEqual(appData.professors, ["Prof A", "Prof B"]);
  assert.deepEqual(appData.days, ["Segunda", "Quarta"]);
  assert.deepEqual(appData.times, ["05:15", "12:00", "15:30"]);

  assert.equal(appData.lessons[0].studentId, "A1");
  assert.equal(appData.lessons[0].time, "05:15");
  assert.equal(appData.lessons[1].time, "15:30");
  assert.equal(appData.lessons[2].time, "12:00");

  assert.equal(appData.analytics.totals.students, 3);
  assert.equal(appData.analytics.totals.lessons, 3);
  assert.equal(appData.analytics.totals.activeStudents, 2);
  assert.equal(appData.analytics.bySlot["Segunda|05:15"], 1);
  assert.equal(appData.analytics.bySlot["Segunda|12:00"], 1);
  assert.equal(appData.analytics.byProfessor["Prof A"].totalLessons, 2);
  assert.equal(appData.analytics.byProfessor["Prof A"].byDay.Segunda, 2);
  assert.equal(appData.analytics.byTurn.manha, 1);
  assert.equal(appData.analytics.byTurn.tarde, 2);


  const occupancy = core.buildSlotOccupancy(appData.lessons, 10);
  assert.equal(occupancy["Segunda|05:15"].studentCount, 1);
  assert.equal(occupancy["Segunda|05:15"].professorCount, 1);
  assert.equal(occupancy["Segunda|05:15"].capacity, 10);
  assert.equal(occupancy["Segunda|05:15"].level, "low");

  assert.equal(core.getOccupancyLevel(0, 10), "empty");
  assert.equal(core.getOccupancyLevel(3, 10), "low");
  assert.equal(core.getOccupancyLevel(6, 10), "medium");
  assert.equal(core.getOccupancyLevel(8, 10), "high");
  assert.equal(core.getOccupancyLevel(10, 10), "full");
  assert.equal(core.getOccupancyLevel(12, 10), "over");

  const periods = core.splitTimesByPeriod(["05:15", "12:00", "12:15", "21:15"]);
  assert.deepEqual(periods.morning, ["05:15"]);
  assert.deepEqual(periods.afternoon, ["12:00", "12:15", "21:15"]);
  const manual = core.buildManualRowFromPayload({
    status: "Ativo",
    observations: "Nova obs",
    slots: [
      { professor: "Prof C", day: "Sexta", time: "18:00" },
      { professor: "", day: "", time: "" },
    ],
  });

  assert.equal(manual.length, 20);
  assert.deepEqual(manual.slice(0, 4), ["Ativo", "Prof C", "Sexta", "18:00"]);
  assert.equal(manual[19], "Nova obs");

  assert.throws(
    () => core.buildAgendaAppDataFromValues([["ID", "Nome"], ["1", "A"]]),
    /Cabeçalhos ausentes/,
  );
}

run();
console.log("agendaCore tests passed");
