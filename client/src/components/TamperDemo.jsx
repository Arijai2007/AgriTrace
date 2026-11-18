import React, { useMemo, useState } from 'react';
import { eventProof, verifyEventCopy } from '../integrity.mjs';

function download(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

export function TamperDemo({ batch }) {
  const [index, setIndex] = useState(0), [draft, setDraft] = useState(JSON.stringify(batch.events[0], null, 2)), [message, setMessage] = useState('');
  const proof = useMemo(() => eventProof(batch.events, index), [batch.events, index]);
  const result = useMemo(() => {
    try { return verifyEventCopy(JSON.parse(draft), proof, batch.root); }
    catch (error) { return { error: error.message }; }
  }, [draft, proof, batch.root]);
  const reset = () => { setDraft(JSON.stringify(batch.events[index], null, 2)); setMessage(''); };
  const tamper = () => {
    const copy = structuredClone(batch.events[index]);
    if (typeof copy.data.quantity === 'number') copy.data.quantity += 1;
    else copy.data.note = (copy.data.note || '') + ' Edited copy';
    setDraft(JSON.stringify(copy, null, 2)); setMessage('One field was changed in this local copy.');
  };
  return <section className="tamper-demo" aria-labelledby="tamper-title"><div className="section-intro"><span className="eyebrow">TRY THE INTEGRITY CHECK</span><h3 id="tamper-title">Change a copy. Check the proof.</h3><p className="muted">Edit a recorded event below or import an edited event file. Its proof is checked against the root of the batch currently loaded from the ledger. This demo runs in your browser and never submits a transaction.</p></div>
    <label className="field"><span>Recorded event</span><select value={index} onChange={e => { const next = Number(e.target.value); setIndex(next); setDraft(JSON.stringify(batch.events[next], null, 2)); setMessage(''); }}>{batch.events.map((event, i) => <option key={event.txId} value={i}>{i + 1}. {event.type.replaceAll('_', ' ')} · {event.actor.name}</option>)}</select></label>
    <div className="lab-actions"><button className="button secondary small" onClick={tamper}>Simulate an edit</button><button className="button secondary small" onClick={reset}>Restore original</button><button className="button secondary small" onClick={() => download({ event: batch.events[index], proof, root: batch.root }, `${batch.id}-event-${index}.json`)}>Download original event</button><label className="field"><span>Import edited JSON (maximum 1 MB)</span><input type="file" accept=".json,application/json" onChange={async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        if (file.size > 1024 * 1024) throw new Error('Choose a JSON file smaller than 1 MB.');
        const data = JSON.parse(await file.text());
        if (data.batch && data.batch.id !== batch.id) throw new Error('Choose an export for this batch.');
        const event = data.batch ? data.batch.events?.[index] : data.event || data;
        if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('No event found at the selected index.');
        setDraft(JSON.stringify(event, null, 2)); setMessage('Selected event imported. The reference root and proof were kept from the loaded batch.');
      } catch (error) { setMessage(error.message); }
      e.target.value = '';
    }}/></label></div>
    <label className="field"><span>Editable event copy</span><textarea className="event-editor" value={draft} onChange={e => { setDraft(e.target.value); setMessage(''); }} spellCheck="false" maxLength={200000}/></label>
    <div className={`integrity-result ${result.valid ? 'match' : 'mismatch'}`} role="status"><strong>{result.error ? 'Cannot verify this JSON' : result.valid ? 'Proof matches the recorded root' : 'Tampering detected: proof does not match'}</strong><p>{result.error || (result.valid ? 'The selected event is included in the loaded batch history.' : 'This copy differs from the event committed under the recorded root.')}</p>{message && <p>{message}</p>}</div>
    <dl className="proof-values"><div><dt>Reference Merkle root</dt><dd>{batch.root}</dd></div>{result.leaf && <><div><dt>Event SHA-256</dt><dd>{result.leaf}</dd></div><div><dt>Recomputed root</dt><dd>{result.computedRoot}</dd></div></>}</dl><p className="small muted">This checks event inclusion against the loaded reference root. It does not authenticate sensor readings or certificate issuers. An uploaded file cannot replace the reference root.</p>
  </section>;
}
