import React from 'react';
import { ArrowRight, ArrowUpRight, Leaf, QrCode, ShieldCheck, Sprout, Store, Truck, Warehouse, ShoppingBag, Scale } from 'lucide-react';
import { WalletStatus } from '../wallet.jsx';
import { EntryEditorial } from './EntryEditorial.jsx';
import { EntryJourney } from './EntryJourney.jsx';

const roles = [
  { role: 'farmer', label: 'Farmer', icon: Sprout },
  { role: 'aggregator', label: 'Mandi agent', icon: Store },
  { role: 'transporter', label: 'Transporter', icon: Truck },
  { role: 'processor', label: 'Warehouse', icon: Warehouse },
  { role: 'retailer', label: 'Retailer', icon: ShoppingBag },
  { role: 'regulator', label: 'Regulator', icon: Scale }
];

export function LoginView({ accounts, id, setId, password, setPassword, busy, submit, health }) {
  const selected = accounts.find(account => account.id === id);
  const sampleUrl = health?.ledgerMode === 'ethereum' ? '/trace/AGR-DEMO-20261112-001' : health?.ledgerMode === 'demo' ? '/trace/AGR-2026-001' : '/trace';
  return <div className="entry-page">
    <header className="entry-header"><div className="entry-header-inner"><a className="entry-brand" href="/"><span className="entry-brand-icon"><Leaf size={21}/></span><span><strong>AgriTrace</strong><small>{health?.ledgerMode === 'ethereum' ? 'SEPOLIA LEDGER' : 'TRACEABILITY'}</small></span></a><nav aria-label="Entry navigation"><a href="/" aria-current="page">Overview</a><a href={sampleUrl}>Batch journey</a><a href={sampleUrl}>Consumer trace</a>{sampleUrl !== '/trace' && <a href={sampleUrl + '?view=verification'}>Verification</a>}</nav><div className="entry-header-right"><span className="entry-network"><span className="entry-network-dot"/>{health?.ledgerMode === 'ethereum' ? 'SEPOLIA TESTNET' : 'AGRI TRACE'}</span><a className="entry-header-cta" href="/trace"><QrCode size={16}/> Consumer portal</a></div></div></header>
    <main id="entry-top" className="entry-main"><div className="entry-grid"><section className="entry-story" id="entry-journey"><div className="entry-overline"><span className="entry-overline-dot"/>{health?.ledgerMode === 'ethereum' ? 'FARM TO SHELF · ETHEREUM SEPOLIA' : 'FARM TO SHELF · TRACEABLE RECORDS'}</div><h1>Know the soil. <em>Trust the harvest.</em></h1><p className="entry-intro">A clear record of where a batch began, who held it, and what happened along the way.</p><EntryJourney health={health}/></section>
      <section className="entry-signin" aria-labelledby="entry-signin-title"><div className="entry-signin-head"><div><span className="entry-kicker">PARTNER WORKSPACE</span><h2 id="entry-signin-title">Participant sign-in</h2></div><span className="entry-role-count">6 roles</span></div><form onSubmit={submit}><fieldset className="entry-role-fieldset"><legend>SELECT YOUR ROLE</legend><div className="entry-role-grid">{roles.map(({ role, label, icon: Icon }) => { const account = accounts.find(item => item.role === role); return <button type="button" key={role} disabled={!account} className={`entry-role ${selected?.role === role ? 'selected' : ''}`} aria-pressed={selected?.role === role} onClick={() => setId(account.id)}><Icon size={18}/><span>{label}</span></button>; })}</div></fieldset><label className="entry-field"><span>REGISTERED ACCOUNT</span>{accounts.length ? <select value={id} onChange={event => setId(event.target.value)}>{accounts.map(account => <option value={account.id} key={account.id}>{account.name} · {roles.find(item => item.role === account.role)?.label || account.role}</option>)}</select> : <input value={id} onChange={event => setId(event.target.value)} autoComplete="username" required/>}</label><label className="entry-field"><span>PASSWORD</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required placeholder="Enter your password"/></label><div className="entry-wallet"><WalletStatus health={health}/>{health?.ledgerMode !== 'ethereum' && <span><ShieldCheck size={17}/> Your role controls which records you can update.</span>}</div><button className="entry-submit" disabled={busy}>{busy ? 'Opening workspace…' : 'Sign in & enter workspace'}<ArrowRight size={17}/></button></form>{health?.ledgerMode === 'demo' && <p className="entry-demo-note">Local demonstration records. Default classroom password: <code>agritrace-demo</code>, unless your team changed it.</p>}<a className="entry-consumer-link" href={sampleUrl}><QrCode size={16}/> View a public batch journey <ArrowUpRight size={15}/></a></section></div>
      <EntryEditorial sampleUrl={sampleUrl}/><div className="entry-bottom"><span><Leaf size={16}/> Origin · Custody · Conditions</span><span>{health?.ledgerMode === 'ethereum' ? 'MetaMask signs batch updates on Sepolia' : 'Trace a batch from farm to shelf'}</span></div></main><footer className="entry-footer"><span>AgriTrace · Every harvest has a story.</span><a href="/trace">Consumer trace <ArrowUpRight size={15}/></a></footer>
  </div>;
}
