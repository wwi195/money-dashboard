(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MD = root.MD || {};
    Object.assign(root.MD, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // 列順（支出・収入シート共通）: タイムスタンプ,金額,カテゴリ,メモ,日付（記入日以外の場合）

  function parseAmount(raw, kind) {
    if (raw === null || raw === undefined) return { ok: false, raw: raw };
    var s = String(raw).trim();
    if (s === '' || !/^\d+(\.\d+)?$/.test(s)) return { ok: false, raw: raw };
    var value = parseFloat(s);
    return { ok: true, amount: kind === 'expense' ? -value : value };
  }

  // "YYYY/MM/DD" と "YYYY/MM/DD HH:MM:SS" のどちらも受け付ける。
  // parseIntが日の部分の末尾（空白以降の時刻）を無視するため、
  // タイムスタンプ文字列をそのまま渡しても日付だけが取れる。
  function parseDate(raw) {
    if (!raw) return { ok: false, raw: raw };
    var trimmed = String(raw).trim();
    var segs = trimmed.split('/');
    if (segs.length !== 3) return { ok: false, raw: raw };
    var year = parseInt(segs[0], 10);
    var month = parseInt(segs[1], 10);
    var day = parseInt(segs[2], 10);
    if ([year, month, day].some(function (n) { return isNaN(n); })) return { ok: false, raw: raw };
    if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false, raw: raw };
    return { ok: true, date: new Date(year, month - 1, day) };
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var len = text.length;

    function pushField() {
      row.push(field);
      field = '';
    }
    function pushRow() {
      pushField();
      rows.push(row);
      row = [];
    }

    while (i < len) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i += 1;
            continue;
          }
        } else {
          field += ch;
          i += 1;
          continue;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i += 1;
          continue;
        } else if (ch === ',') {
          pushField();
          i += 1;
          continue;
        } else if (ch === '\r') {
          i += 1;
          continue;
        } else if (ch === '\n') {
          pushRow();
          i += 1;
          continue;
        } else {
          field += ch;
          i += 1;
          continue;
        }
      }
    }

    if (field.length > 0 || row.length > 0) {
      pushRow();
    }

    return rows;
  }

  function normalizeRecord(row, kind) {
    var overrideDate = (row[4] || '').trim();
    var dateRaw = overrideDate !== '' ? overrideDate : row[0];
    return {
      date: parseDate(dateRaw),
      amount: parseAmount(row[1], kind),
      category: (row[2] || '').trim() || '未分類',
      memo: row[3] || '',
      kind: kind
    };
  }

  function normalizeRecords(rows, kind) {
    return rows.map(function (row) { return normalizeRecord(row, kind); });
  }

  return {
    parseAmount: parseAmount,
    parseDate: parseDate,
    parseCsv: parseCsv,
    normalizeRecord: normalizeRecord,
    normalizeRecords: normalizeRecords
  };
});
