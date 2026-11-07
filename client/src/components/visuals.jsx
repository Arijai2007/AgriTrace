import React, { useEffect, useId, useRef, useState } from 'react';
import { Sprout, Warehouse, Truck, PackageCheck, Store, ArrowUpRight, ShieldCheck } from 'lucide-react';

const stages = [
  { role: 'farmer', label: 'Farm', icon: Sprout, x: 53, y: 172 },
  { role: 'aggregator', label: 'Mandi', icon: Warehouse, x: 167, y: 105 },
  { role: 'transporter', label: 'Transit', icon: Truck, x: 281, y: 160 },
  { role: 'processor', label: 'Storage', icon: PackageCheck, x: 395, y: 83 },
  { role: 'retailer', label: 'Retail', icon: Store, x: 507, y: 127 }
];

export function JourneyVisual({ batches, illustration = false }) {
  const id = useId().replace(/:/g, '');
  const route = 'M53 172 C108 172 112 105 167 105 S226 160 281 160 S340 83 395 83 S452 127 507 127';
  return <div className="journey-visual">
    <div className="visual-heading"><span><span className="status-spark"/>{illustration ? 'ONE CONNECTED JOURNEY' : 'CUSTODY AT A GLANCE'}</span><span className="visual-index">01 — 05</span></div>
    <svg className="network-illustration" viewBox="0 0 560 280" role="img" aria-label={illustration ? 'Illustration of produce moving from farm through mandi, transit, storage and retail' : 'Current batch counts across farm, mandi, transit, storage and retail'}>
      <defs><linearGradient id={`route-${id}`} x1="0" x2="1"><stop stopColor="#cdfb75"/><stop offset="1" stopColor="#72dcb2"/></linearGradient><pattern id={`grid-${id}`} width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#ffffff" opacity=".12"/></pattern></defs>
      <rect width="560" height="280" fill={`url(#grid-${id})`}/>
      <ellipse className="orbit-line" cx="280" cy="148" rx="236" ry="104"/>
      <ellipse className="orbit-line inner" cx="280" cy="148" rx="199" ry="75"/>
      <path d={route} className="network-route-shadow"/>
      <path d={route} className="network-route" stroke={`url(#route-${id})`}/>
      <path d={route} className="network-route-flow"/>
      {stages.map(({ role, label, icon: Icon, x, y }, i) => {
        const count = (batches || []).filter(b => b.holder.role === role).length;
        return <g key={role} className={`network-station ${count ? 'has-batches' : ''}`}>
          <circle className="station-halo" cx={x} cy={y} r="31"/>
          <circle className="station-disc" cx={x} cy={y} r="23"/>
          <Icon x={x - 10} y={y - 10} width="20" height="20" strokeWidth="1.7"/>
          <text className="station-label" x={x} y={y + 43} textAnchor="middle">{label}</text>
          <text className="station-count" x={x} y={y + 60} textAnchor="middle">{illustration ? `0${i + 1}` : `${count} ${count === 1 ? 'batch' : 'batches'}`}</text>
        </g>;
      })}
    </svg>
    <div className="visual-caption"><ShieldCheck size={14}/><span>{illustration ? 'Origin. Custody. Conditions. All connected.' : 'Where your registered batches are held now.'}</span><ArrowUpRight size={15}/></div>
  </div>;
}

export function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(value), previous = useRef(value);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame, start;
    const from = previous.current; previous.current = value;
    const stop = () => { if (media.matches) { cancelAnimationFrame(frame); setDisplay(value); } };
    if (media.matches || value === from) { setDisplay(value); return; }
    const tick = time => {
      start ??= time;
      const progress = Math.min((time - start) / 700, 1), eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); media.addEventListener('change', stop);
    return () => { cancelAnimationFrame(frame); media.removeEventListener('change', stop); };
  }, [value]);
  const format = n => new Intl.NumberFormat('en-IN').format(n);
  return <span aria-label={format(value)}><span aria-hidden="true">{format(display)}</span></span>;
}

export function LoadingScreen() {
  return <div className="boot" role="status"><div className="loading-mark"><Sprout size={30}/></div><strong>Growing a clearer picture.</strong><span>Opening your AgriTrace workspace…</span><div className="loading-track"><span/></div></div>;
}
