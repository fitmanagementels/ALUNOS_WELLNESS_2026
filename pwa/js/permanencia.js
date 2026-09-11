(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.XSteamPermanencia = api;
}(typeof window !== 'undefined' ? window : this, function () {
  var BAND_LABELS = [
    'Até 3 meses', '4–6 meses', '7–12 meses', '13–24 meses', '25 meses ou mais'
  ];
  var MONTH_LABELS = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];

  function normalize(value) {
    return String(value == null ? '' : value).trim().toLocaleLowerCase('pt-BR')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function parseBrazilianDate(value) {
    var match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || '').trim());
    if (!match) return null;
    var day = Number(match[1]);
    var month = Number(match[2]);
    var year = Number(match[3]);
    var date = new Date(year, month - 1, day, 12);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return date;
  }

  function monthsCompleted(value, now) {
    var start = parseBrazilianDate(value);
    var end = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
    if (!start) return null;
    var months = (end.getFullYear() - start.getFullYear()) * 12 +
      end.getMonth() - start.getMonth();
    if (end.getDate() < start.getDate()) months -= 1;
    return Math.max(0, months);
  }

  function relationshipLabel(months) {
    if (months == null || !isFinite(Number(months))) return 'Sem data';
    months = Math.max(0, Math.floor(Number(months)));
    var years = Math.floor(months / 12);
    var remainder = months % 12;
    var parts = [];
    if (years) parts.push(years + (years === 1 ? ' ano' : ' anos'));
    if (remainder || !years) parts.push(remainder + (remainder === 1 ? ' mês' : ' meses'));
    return parts.join(' e ');
  }

  function relationshipBand(months) {
    months = Number(months);
    if (!isFinite(months)) return 'Sem data';
    if (months <= 3) return BAND_LABELS[0];
    if (months <= 6) return BAND_LABELS[1];
    if (months <= 12) return BAND_LABELS[2];
    if (months <= 24) return BAND_LABELS[3];
    return BAND_LABELS[4];
  }

  function cohortKey(value) {
    var date = parseBrazilianDate(value);
    if (!date) return '';
    return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0');
  }

  function cohortLabel(key) {
    var match = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
    if (!match) return 'Sem coorte';
    return MONTH_LABELS[Number(match[2]) - 1] + '/' + match[1];
  }

  function isEnrolled(status) {
    return ['ativo', 'bloqueado', 'licenca', 'em licenca'].indexOf(normalize(status)) !== -1;
  }

  function uniqueIds(items) {
    var seen = Object.create(null);
    return (items || []).map(function (item) { return String(item.id || ''); })
      .filter(function (id) {
        if (!id || seen[id]) return false;
        seen[id] = true;
        return true;
      });
  }

  function median(values) {
    if (!values.length) return null;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function packagesById(contracts) {
    var result = Object.create(null);
    var seen = Object.create(null);
    (contracts || []).forEach(function (contract) {
      var id = String(contract.id || '');
      if (!id) return;
      var key = String(contract.chave || '').trim() || [
        id, contract.contrato || '', Number(contract.valor) || 0, contract.vencimento || ''
      ].join('|');
      if (seen[key]) return;
      seen[key] = true;
      (result[id] || (result[id] = [])).push({
        name: String(contract.contrato || contract.frequencia || ''),
        value: Number(contract.valor) || 0
      });
    });
    return result;
  }

  function latestEventSummary(events) {
    var valid = (events || []).map(function (event) {
      return { event: event, date: parseBrazilianDate(event.dataReferencia) };
    }).filter(function (item) { return item.date; });
    if (!valid.length) {
      return { newStudents: 0, absent: 0, statusChanges: 0 };
    }
    var latestTime = Math.max.apply(null, valid.map(function (item) { return item.date.getTime(); }));
    var latest = valid.filter(function (item) { return item.date.getTime() === latestTime; })
      .map(function (item) { return String(item.event.tipo || ''); });
    return {
      newStudents: latest.filter(function (type) { return type === 'NOVO_ALUNO'; }).length,
      absent: latest.filter(function (type) { return type === 'AUSENTE_NO_LOTE'; }).length,
      statusChanges: latest.filter(function (type) { return type === 'ALTERACAO_STATUS'; }).length
    };
  }

  function buildAnalysis(input, now) {
    input = input || {};
    var permanence = input.permanence || [];
    var currentIds = uniqueIds(input.currentStudents || []);
    var permanenceById = permanence.reduce(function (map, item) {
      var id = String(item.id || '');
      if (id) map[id] = item;
      return map;
    }, Object.create(null));
    var packageMap = packagesById(input.contracts || []);
    function rowFor(id, item) {
      item = item || { id: id };
      var months = monthsCompleted(item.clienteDesde, now);
      var cohort = cohortKey(item.clienteDesde);
      return {
        id: id,
        aluno: String(item.aluno || ''),
        clienteDesde: String(item.clienteDesde || ''),
        months: months,
        relationship: relationshipLabel(months),
        band: relationshipBand(months),
        cohort: cohort,
        cohortLabel: cohortLabel(cohort),
        status: String(item.status || ''),
        historicalContracts: Number(item.quantidadeContratos) || 0,
        packages: packageMap[id] || []
      };
    }
    function sortRows(a, b) {
      var monthsA = a.months == null ? -1 : a.months;
      var monthsB = b.months == null ? -1 : b.months;
      return monthsB - monthsA || a.aluno.localeCompare(b.aluno, 'pt-BR');
    }
    var rows = currentIds.map(function (id) {
      return rowFor(id, permanenceById[id]);
    }).sort(sortRows);
    var historicalRows = permanence.map(function (item) {
      return rowFor(String(item.id || ''), item);
    }).filter(function (row) { return row.id; }).sort(sortRows);

    var withDate = rows.filter(function (row) { return row.months != null; });
    var bands = BAND_LABELS.map(function (label, index) {
      var ids = rows.filter(function (row) { return row.band === label; })
        .map(function (row) { return row.id; });
      return { key: String(index + 1), label: label, value: ids.length, ids: ids };
    });
    var cohortMap = Object.create(null);
    permanence.forEach(function (item) {
      var key = cohortKey(item.clienteDesde);
      var id = String(item.id || '');
      if (!key || !id) return;
      var cohort = cohortMap[key] || (cohortMap[key] = {
        key: key, label: cohortLabel(key), total: 0, enrolled: 0, cancelled: 0, ids: []
      });
      cohort.total += 1;
      cohort.ids.push(id);
      if (isEnrolled(item.status)) cohort.enrolled += 1;
      else cohort.cancelled += 1;
    });
    var cohorts = Object.keys(cohortMap).sort().map(function (key) {
      var cohort = cohortMap[key];
      cohort.observedRetentionPercent = cohort.total
        ? Math.round((cohort.enrolled / cohort.total) * 1000) / 10 : 0;
      return cohort;
    });
    var eventSummary = latestEventSummary(input.events || []);
    return {
      kpis: {
        currentStudents: currentIds.length,
        withStartDate: withDate.length,
        coveragePercent: currentIds.length
          ? Math.round((withDate.length / currentIds.length) * 1000) / 10 : 0,
        medianMonths: median(withDate.map(function (row) { return row.months; })),
        newInLastBatch: eventSummary.newStudents,
        absentInLastBatch: eventSummary.absent,
        statusChangesInLastBatch: eventSummary.statusChanges
      },
      bands: bands,
      cohorts: cohorts,
      rows: rows,
      historicalRows: historicalRows
    };
  }

  return {
    monthsCompleted: monthsCompleted,
    relationshipLabel: relationshipLabel,
    relationshipBand: relationshipBand,
    cohortKey: cohortKey,
    isEnrolled: isEnrolled,
    buildAnalysis: buildAnalysis
  };
}));
