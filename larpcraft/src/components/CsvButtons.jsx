import React, { useRef, useState } from 'react';
import { useGame, useDispatch, useLibrary } from '../state/store.jsx';
import { CSV_SCHEMAS } from '../data/csvSchemas.js';
import { toCsv, parseCsv, downloadCsv } from '../lib/csv.js';

// Export / Import buttons for one section. Import merges by id: rows with an
// existing id update that record, new ids create records; bad rows are
// skipped with a warning (details in the browser console).
export default function CsvButtons({ coll }) {
  const proj = useGame();
  const lib = useLibrary();
  // Schemas validate references against a merged view: instances (locations,
  // sensors) come from the active game, rules & mechanics from the library.
  const s = { ...proj, mechanics: lib.mechanics };
  const dispatch = useDispatch();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);
  const schema = CSV_SCHEMAS[coll];

  const doExport = () =>
    downloadCsv(`operation-chimera-${schema.filename}`, toCsv(schema.headers, schema.toRows(s)));

  async function doImport(file) {
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    if (!headers.includes('id')) {
      show({ bad: true, text: 'Import failed: no "id" column. Export this section first to see the expected format.' });
      return;
    }
    const warnings = [];
    const entities = {};
    const extraActions = [];
    let created = 0, updated = 0, skipped = 0;
    rows.forEach((row, i) => {
      const id = row.id;
      if (!id) { skipped++; warnings.push(`line ${i + 2}: missing id`); return; }
      const partial = schema.fromRow(row, s, (m) => warnings.push(`line ${i + 2}: ${m}`));
      if (!partial) { skipped++; return; }
      const existing = s[coll][id];
      entities[id] = existing ? { ...existing, ...partial } : { ...schema.blank(id), ...partial };
      existing ? updated++ : created++;
      if (schema.extra) extraActions.push(...schema.extra(row));
    });
    dispatch({ type: 'IMPORT_ENTITIES', coll, entities });
    extraActions.forEach((a) => dispatch(a));
    if (warnings.length) console.warn(`CSV import (${coll}) warnings:`, warnings);
    show({
      text: `Imported: ${created} new, ${updated} updated` +
        (skipped ? `, ${skipped} skipped` : '') +
        (warnings.length ? ` · ${warnings.length} warning(s), see console` : ''),
    });
  }

  function show(m) { setMsg(m); setTimeout(() => setMsg(null), 8000); }

  return (
    <>
      {msg && <span className={`csvmsg${msg.bad ? ' bad' : ''}`}>{msg.text}</span>}
      <button className="btn ghost" onClick={doExport}>Export CSV</button>
      <button className="btn ghost" onClick={() => fileRef.current?.click()}>Import CSV</button>
      <input ref={fileRef} hidden type="file" accept=".csv,text/csv"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
    </>
  );
}
