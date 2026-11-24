import { batchLabel, sampleText, tracePath, SEPOLIA_SAMPLE_ID } from '../sampleBatch.mjs';
import React, { useEffect, useId, useState } from 'react';
import { Sprout, Store, Truck, Warehouse, ShoppingBag, ShieldCheck, Thermometer } from 'lucide-react';

const stages = [
  { label: 'Farm', role: 'farmer', icon: Sprout, fallback: 'A farmer registers the harvest, origin and starting quantity.' },
  { label: 'Mandi', role: 'aggregator', icon: Store, fallback: 'The mandi agent receives and prices the batch.' },
  { label: 'Transit', role: 'transporter', icon: Truck, fallback: 'The transporter records custody and any condition readings.' },
  { label: 'Storage', role: 'processor', icon: Warehouse, fallback: 'The warehouse records the incoming handover.' },
  { label: 'Retail', role: 'retailer', icon: ShoppingBag, fallback: 'The retailer receives the batch for the consumer journey.' }
];

const format = value => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);

function detailsFor(batch, index) {
  if (!batch) return { title: stages[index].label, description: stages[index].fallback, facts: [] };
  const transfer = batch.events.find(event => event.type === 'TRANSFER' && event.data.to?.role === stages[index].role);
  const event = index === 0 ? batch.events.find(item => item.type === 'HARVEST') : transfer;
  const sensor = index === 2 ? batch.events.find(item => item.type === 'SENSOR') : null;
  const who = index === 0 ? event?.actor?.name : event?.data?.to?.name;
  const title = index === 0 ? `${sampleText(batch.id, batch.crop)} from ${who || 'the farm'}` : `${stages[index].label} · ${who || 'custody stage'}`;
  const description = index === 0
    ? `${format(batch.events[0]?.data?.quantity ?? batch.quantity)} kg registered at ${sampleText(batch.id, batch.origin.name)}. The harvest starts the recorded journey.`
    : event ? `${format(event.data.quantity)} kg handed over at ₹${format(event.data.price)}/kg.${event.data.note ? ` ${sampleText(batch.id, event.data.note)}` : ''}` : stages[index].fallback;
  const facts = [
    { label: 'Recorded by', value: event?.actor?.name || 'Awaiting handover' },
    { label: 'Quantity', value: event ? `${format(index === 0 ? (event.data.quantity ?? batch.quantity) : event.data.quantity)} kg` : '—' },
    { label: 'Condition', value: sensor ? `${sensor.data.temperature}°C · ${sensor.data.humidity}% humidity${sensor.data.alert ? ' · Alert' : ''}` : index === 4 && batch.status === 'recalled' ? 'Recalled' : event ? 'Recorded' : '—' }
  ];
  return { title, description, facts };
}

export function EntryJourney({ health }) {
  const [active, setActive] = useState(0);
  const [batch, setBatch] = useState(null);
  const sampleId = health?.ethereum?.chainId === 11155111 ? SEPOLIA_SAMPLE_ID : health?.ledgerMode === 'demo' ? 'AGR-2026-001' : null;
  const pathId = useId().replace(/:/g, '');
  useEffect(() => {
    if (!sampleId) return;
    const controller = new AbortController();
    fetch(`/api/trace/${sampleId}`, { signal: controller.signal }).then(response => response.ok ? response.json() : null).then(result => result && setBatch(result.batch)).catch(() => {});
    return () => controller.abort();
  }, [sampleId]);
  const detail = detailsFor(batch, active);
  const alert = batch?.events.some(event => event.type === 'SENSOR' && event.data.alert);
  return <section className="entry-route" aria-label="Farm to shelf journey">
    <div className="entry-route-heading"><span><ShieldCheck size={17}/> CUSTODY ROUTE</span><small>Select or tab to inspect a stage</small></div>
    <div className="entry-route-track">
      <svg viewBox="0 0 500 74" preserveAspectRatio="none" aria-hidden="true"><path className="entry-route-base" d="M30 38 C105 12 148 61 250 38 S399 13 470 38"/><path className="entry-route-draw" d="M30 38 C105 12 148 61 250 38 S399 13 470 38"/><path className="entry-route-beam" d="M30 38 C105 12 148 61 250 38 S399 13 470 38"/></svg>
      <div className="entry-route-stages">{stages.map(({ label, icon: Icon }, index) => <button type="button" key={label} className={`entry-stage ${active === index ? 'active' : ''} ${index === 2 && alert ? 'warning' : ''} ${index === 4 && batch?.status === 'recalled' ? 'recalled' : ''}`} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)} aria-pressed={active === index}><span className="entry-stage-icon"><Icon size={18}/></span><strong>{label}</strong><small>{index === 2 && alert ? 'Alert recorded' : index === 4 && batch?.status === 'recalled' ? 'Recalled' : `0${index + 1}`}</small></button>)}</div>
    </div>
    <div className="entry-stage-detail" key={`${pathId}-${active}`}><div className="entry-stage-meta"><span>STAGE 0{active + 1} · {stages[active].label.toUpperCase()}</span>{batch && <small>{batchLabel(batch.id)}</small>}</div><h3>{detail.title}</h3><p>{detail.description}</p>{detail.facts.length > 0 && <div className="entry-stage-facts">{detail.facts.map(fact => <div key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></div>)}</div>}</div>
    <a className="entry-route-link" href={batch ? tracePath(batch.id) : '/trace'}><Thermometer size={15}/> Open the public batch journey <span aria-hidden="true">↗</span></a>
  </section>;
}
