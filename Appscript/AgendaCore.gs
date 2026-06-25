var AgendaCore = (function () {
  var BLOCK_COUNT = 6;
  var MANUAL_HEADERS = ["Status"];

  for (var headerSlot = 1; headerSlot <= BLOCK_COUNT; headerSlot++) {
    MANUAL_HEADERS.push("Prof" + headerSlot, "Dia" + headerSlot, "Hora" + headerSlot);
  }

  MANUAL_HEADERS.push("Observações");

  var REQUIRED_HEADERS = ["ID", "Nome", "Dias"].concat(MANUAL_HEADERS);

  var DAY_ORDER = {
    segunda: 1,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sabado: 6,
    domingo: 7,
  };

  var DAY_LABELS = {
    segunda: "Segunda",
    terca: "Terça",
    quarta: "Quarta",
    quinta: "Quinta",
    sexta: "Sexta",
    sabado: "Sábado",
    domingo: "Domingo",
  };

  function cleanText(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/\s+/g, " ").trim();
  }

  function normalizeKey(value) {
    return cleanText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function headerKey(value) {
    return normalizeKey(value).replace(/[^a-z0-9]/g, "");
  }

  function createHeaderIndex(headerRow) {
    var index = {};
    for (var i = 0; i < headerRow.length; i++) {
      index[headerKey(headerRow[i])] = i;
    }

    var missing = REQUIRED_HEADERS.filter(function (header) {
      return index[headerKey(header)] === undefined;
    });

    if (missing.length) {
      throw new Error("Cabeçalhos ausentes na aba AGENDA: " + missing.join(", "));
    }

    return index;
  }

  function getCell(row, headerIndex, header) {
    return row[headerIndex[headerKey(header)]];
  }

  function normalizeStatus(value) {
    return cleanText(value) || "Sem status";
  }

  function isActiveStatus(value) {
    var normalized = normalizeKey(value);
    return normalized === "ativo" || normalized === "ativa" || normalized === "activa";
  }

  function normalizeDay(value) {
    var key = normalizeKey(value)
      .replace(/-feira/g, "")
      .replace(/ feira/g, "")
      .replace(/\./g, "");

    if (!key) return "";
    if (key.indexOf("segunda") === 0 || key === "seg" || key === "2" || key === "2a") return "Segunda";
    if (key.indexOf("terca") === 0 || key === "ter" || key === "3" || key === "3a") return "Terça";
    if (key.indexOf("quarta") === 0 || key === "qua" || key === "4" || key === "4a") return "Quarta";
    if (key.indexOf("quinta") === 0 || key === "qui" || key === "5" || key === "5a") return "Quinta";
    if (key.indexOf("sexta") === 0 || key === "sex" || key === "6" || key === "6a") return "Sexta";
    if (key.indexOf("sabado") === 0 || key === "sab" || key === "7" || key === "7a") return "Sábado";
    if (key.indexOf("domingo") === 0 || key === "dom" || key === "1") return "Domingo";
    return cleanText(value);
  }

  function daySortValue(day) {
    return DAY_ORDER[normalizeKey(day)] || 99;
  }

  function pad2(number) {
    return String(number).padStart(2, "0");
  }

  function normalizeTime(value) {
    if (value === null || value === undefined || value === "") return "";

    if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
      return pad2(value.getHours()) + ":" + pad2(value.getMinutes());
    }

    if (typeof value === "number" && isFinite(value)) {
      var totalMinutes = Math.round(value * 24 * 60);
      var hours = Math.floor(totalMinutes / 60) % 24;
      var minutes = totalMinutes % 60;
      return pad2(hours) + ":" + pad2(minutes);
    }

    var text = cleanText(value).replace("h", ":");
    var match = text.match(/^(\d{1,2})(?::(\d{1,2}))?/);
    if (!match) return text;

    var parsedHours = Number(match[1]);
    var parsedMinutes = match[2] === undefined ? 0 : Number(match[2]);
    if (parsedHours > 23 || parsedMinutes > 59) return text;
    return pad2(parsedHours) + ":" + pad2(parsedMinutes);
  }

  function timeToMinutes(time) {
    var normalized = normalizeTime(time);
    var match = normalized.match(/^(\d{2}):(\d{2})$/);
    if (!match) return 99999;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function getTurn(time) {
    var minutes = timeToMinutes(time);
    if (minutes >= 315 && minutes < 720) return "manha";
    if (minutes >= 720 && minutes <= 1260) return "tarde";
    return "fora";
  }

  function uniqueSorted(values, sorter) {
    var seen = {};
    var result = [];
    values.forEach(function (value) {
      var cleaned = cleanText(value);
      if (!cleaned) return;
      var key = normalizeKey(cleaned);
      if (seen[key]) return;
      seen[key] = true;
      result.push(cleaned);
    });
    return result.sort(sorter || function (a, b) { return a.localeCompare(b); });
  }

  function sortDays(a, b) {
    var diff = daySortValue(a) - daySortValue(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  }

  function sortTimes(a, b) {
    return timeToMinutes(a) - timeToMinutes(b);
  }

  function makeEmptyProfessorStats() {
    return {
      totalLessons: 0,
      uniqueStudents: 0,
      byDay: {},
      byTurn: { manha: 0, tarde: 0, fora: 0 },
    };
  }


  function getOccupancyLevel(count, capacity) {
    var safeCapacity = Math.max(1, Number(capacity) || 10);
    var safeCount = Number(count) || 0;
    var ratio = safeCount / safeCapacity;

    if (safeCount <= 0) return "empty";
    if (ratio > 1) return "over";
    if (ratio >= 1) return "full";
    if (ratio >= 0.75) return "high";
    if (ratio >= 0.5) return "medium";
    return "low";
  }

  function buildSlotOccupancy(lessons, capacity) {
    var safeCapacity = Math.max(1, Number(capacity) || 10);
    var grouped = {};

    lessons.forEach(function (lesson) {
      var key = lesson.day + "|" + lesson.time;
      if (!grouped[key]) {
        grouped[key] = {
          key: key,
          day: lesson.day,
          time: lesson.time,
          capacity: safeCapacity,
          lessons: [],
          students: {},
          professors: {},
        };
      }

      grouped[key].lessons.push(lesson);
      grouped[key].students[lesson.studentId] = true;
      grouped[key].professors[lesson.professor] = true;
    });

    Object.keys(grouped).forEach(function (key) {
      var slot = grouped[key];
      slot.studentCount = Object.keys(slot.students).length;
      slot.professorCount = Object.keys(slot.professors).length;
      slot.lessonCount = slot.lessons.length;
      slot.level = getOccupancyLevel(slot.studentCount, slot.capacity);
      delete slot.students;
      delete slot.professors;
    });

    return grouped;
  }

  function splitTimesByPeriod(times) {
    var sorted = uniqueSorted(times, sortTimes);
    return {
      morning: sorted.filter(function (time) {
        var minutes = timeToMinutes(time);
        return minutes >= 315 && minutes < 720;
      }),
      afternoon: sorted.filter(function (time) {
        var minutes = timeToMinutes(time);
        return minutes >= 720 && minutes <= 1275;
      }),
      outside: sorted.filter(function (time) {
        var minutes = timeToMinutes(time);
        return minutes < 315 || minutes > 1275;
      }),
    };
  }
  function buildAnalytics(students, lessons) {
    var bySlot = {};
    var byProfessor = {};
    var byTurn = { manha: 0, tarde: 0, fora: 0 };
    var professorStudentSets = {};

    lessons.forEach(function (lesson) {
      var slotKey = lesson.day + "|" + lesson.time;
      var turn = getTurn(lesson.time);

      bySlot[slotKey] = (bySlot[slotKey] || 0) + 1;
      byTurn[turn] = (byTurn[turn] || 0) + 1;

      if (!byProfessor[lesson.professor]) {
        byProfessor[lesson.professor] = makeEmptyProfessorStats();
        professorStudentSets[lesson.professor] = {};
      }

      byProfessor[lesson.professor].totalLessons += 1;
      byProfessor[lesson.professor].byDay[lesson.day] = (byProfessor[lesson.professor].byDay[lesson.day] || 0) + 1;
      byProfessor[lesson.professor].byTurn[turn] = (byProfessor[lesson.professor].byTurn[turn] || 0) + 1;
      professorStudentSets[lesson.professor][lesson.studentId] = true;
    });

    Object.keys(byProfessor).forEach(function (professor) {
      byProfessor[professor].uniqueStudents = Object.keys(professorStudentSets[professor]).length;
    });

    return {
      totals: {
        students: students.length,
        activeStudents: students.filter(function (student) { return student.isActive; }).length,
        lessons: lessons.length,
        professors: Object.keys(byProfessor).length,
      },
      bySlot: bySlot,
      byProfessor: byProfessor,
      byTurn: byTurn,
    };
  }

  function buildAgendaAppDataFromValues(values) {
    if (!values || values.length === 0) {
      return {
        students: [],
        lessons: [],
        statuses: [],
        professors: [],
        days: [],
        times: [],
        analytics: buildAnalytics([], []),
        occupancy: {},
        periods: { morning: [], afternoon: [], outside: [] },
        generatedAt: new Date().toISOString(),
      };
    }

    var headerIndex = createHeaderIndex(values[0]);
    var students = [];
    var lessons = [];

    for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
      var row = values[rowIndex];
      var id = cleanText(getCell(row, headerIndex, "ID"));
      if (!id) continue;

      var student = {
        id: id,
        rowNumber: rowIndex + 1,
        name: cleanText(getCell(row, headerIndex, "Nome")),
        daysCount: getCell(row, headerIndex, "Dias"),
        status: normalizeStatus(getCell(row, headerIndex, "Status")),
        isActive: isActiveStatus(getCell(row, headerIndex, "Status")),
        observations: cleanText(getCell(row, headerIndex, "Observações")),
        slots: [],
      };

      for (var slotIndex = 1; slotIndex <= BLOCK_COUNT; slotIndex++) {
        var professor = cleanText(getCell(row, headerIndex, "Prof" + slotIndex));
        var day = normalizeDay(getCell(row, headerIndex, "Dia" + slotIndex));
        var time = normalizeTime(getCell(row, headerIndex, "Hora" + slotIndex));
        var slot = {
          index: slotIndex,
          professor: professor,
          day: day,
          time: time,
        };

        student.slots.push(slot);

        if (professor && day && time) {
          lessons.push({
            id: id + "-" + slotIndex,
            studentId: id,
            studentName: student.name,
            studentStatus: student.status,
            professor: professor,
            day: day,
            time: time,
            turn: getTurn(time),
            slotIndex: slotIndex,
          });
        }
      }

      students.push(student);
    }

    return {
      students: students,
      lessons: lessons,
      statuses: uniqueSorted(students.map(function (student) { return student.status; })),
      professors: uniqueSorted(lessons.map(function (lesson) { return lesson.professor; })),
      days: uniqueSorted(lessons.map(function (lesson) { return lesson.day; }), sortDays),
      times: uniqueSorted(lessons.map(function (lesson) { return lesson.time; }), sortTimes),
      analytics: buildAnalytics(students, lessons),
      occupancy: buildSlotOccupancy(lessons, 10),
      periods: splitTimesByPeriod(uniqueSorted(lessons.map(function (lesson) { return lesson.time; }), sortTimes)),
      generatedAt: new Date().toISOString(),
    };
  }

  function buildManualRowFromPayload(payload) {
    var slots = (payload && payload.slots) || [];
    var row = [normalizeStatus(payload && payload.status)];

    for (var i = 0; i < BLOCK_COUNT; i++) {
      var slot = slots[i] || {};
      row.push(cleanText(slot.professor), normalizeDay(slot.day), normalizeTime(slot.time));
    }

    row.push(cleanText(payload && payload.observations));
    return row;
  }

  function buildManualUpdatesFromPayload(payload) {
    var row = buildManualRowFromPayload(payload);
    return MANUAL_HEADERS.map(function (header, index) {
      return { header: header, value: row[index] };
    });
  }

  return {
    BLOCK_COUNT: BLOCK_COUNT,
    REQUIRED_HEADERS: REQUIRED_HEADERS.slice(),
    MANUAL_HEADERS: MANUAL_HEADERS.slice(),
    buildAgendaAppDataFromValues: buildAgendaAppDataFromValues,
    buildManualRowFromPayload: buildManualRowFromPayload,
    buildManualUpdatesFromPayload: buildManualUpdatesFromPayload,
    cleanText: cleanText,
    createHeaderIndex: createHeaderIndex,
    buildSlotOccupancy: buildSlotOccupancy,
    getOccupancyLevel: getOccupancyLevel,
    getTurn: getTurn,
    headerKey: headerKey,
    isActiveStatus: isActiveStatus,
    normalizeDay: normalizeDay,
    normalizeStatus: normalizeStatus,
    normalizeTime: normalizeTime,
    sortDays: sortDays,
    sortTimes: sortTimes,
    splitTimesByPeriod: splitTimesByPeriod,
    timeToMinutes: timeToMinutes,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = AgendaCore;
}