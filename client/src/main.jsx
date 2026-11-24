import { batchLabel, sampleText, tracePath, featuredBatchId, SEPOLIA_SAMPLE_ID } from './sampleBatch.mjs';
import { readApiResponse, retryStartupRead } from './apiResponse.mjs';
import { WalletStatus, submitWalletTransaction } from './wallet.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeSVG } from 'qrcode.react';
import L from 'leaflet';
import { Leaf, LayoutDashboard, Boxes, Route, Thermometer, ShieldCheck, ArrowUpRight, Plus, Search, ArrowRight, X, LogOut, MapPin, Check, AlertTriangle, FileCheck2, QrCode, Clock3, Download, RefreshCw, Users, Wallet, Sprout } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import '@fontsource-variable/manrope';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import '@fontsource-variable/plus-jakarta-sans';
import { AnimatedNumber, JourneyVisual, LoadingScreen } from './components/visuals.jsx';
import { PerformanceDashboard, TransactionNotice } from './components/Transactions.jsx';
import { TamperDemo } from './components/TamperDemo.jsx';
import { operationFor } from './transactionModel.mjs';
import { LoginView } from './components/LoginView.jsx';
import './styles.css';
import './modern.css';
import './stitch.css';
import './blockchain-tools.css';
import './polish.css';

const format = n => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
const date = d => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const today = () => new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);
const labels = { farmer: 'Farmer', aggregator: 'Mandi agent', transporter: 'Transporter', processor: 'Processor / warehouse', retailer: 'Retailer', regulator: 'Regulator' };
const statusLabel = b => b.status === 'recalled' ? 'Recalled' : b.holder.role === 'retailer' ? 'At retailer' : b.holder.role === 'transporter' ? 'In transit' : b.holder.role === 'farmer' ? 'Harvested' : 'In custody';
const sensors = b => b.events.filter(e => e.type === 'SENSOR');
const hasAlert = b => sensors(b).some(e => e.data.alert);
const cropEmoji = name => /rice|grain|wheat/i.test(name) ? '🌾' : /spinach|leaf|lettuce/i.test(name) ? '🥬' : /mango/i.test(name) ? '🥭' : '🍅';
let token = sessionStorage.getItem('agritrace-token');
let openDialogs = 0, previousBodyOverflow = '';
async function api(path, options = {}) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  if (options.body && !(options.body instanceof FormData)) { headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(options.body); }
  let response;
  try {
    const signal = options.signal ?? (!options.method || options.method === 'GET' ? AbortSignal.timeout(25000) : undefined);
    response = await fetch('/api' + path, { ...options, headers, signal });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('The service took too long to respond. Please try again.');
    throw new Error('Could not reach the service. Check your connection and try again.');
  }
  const result = await readApiResponse(response);
  if (result.walletTransaction) return submitWalletTransaction(result.walletTransaction, api, operationFor(path));
  return result;
}
function Pill({ children, tone = 'green' }) { return <span className={`pill ${tone}`}><span className="dot" />{children}</span>; }
function Field({ label, children, wide = false }) { return <label className={wide ? 'field wide' : 'field'}><span>{label}</span>{children}</label>; }
function Modal({ title, children, close, large = false }) {
  const ref = useRef();
  useEffect(() => {
    if (openDialogs++ === 0) { previousBodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    const previous = document.activeElement; ref.current.focus();
    const key = e => {
      if ([...document.querySelectorAll('[role="dialog"]')].at(-1) !== ref.current) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const focusables = [...ref.current.querySelectorAll('button,input,select,textarea,a[href]')].filter(e => !e.disabled);
        const first = focusables[0], last = focusables.at(-1);
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); if (--openDialogs === 0) document.body.style.overflow = previousBodyOverflow; previous?.focus(); };
  }, []);
  return <div className="overlay" onMouseDown={e => e.target === e.currentTarget && close()}><section tabIndex={-1} ref={ref} className={`modal ${large ? 'large' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="icon-btn" onClick={close} aria-label="Close dialog"><X size={20}/></button></header>{children}</section></div>;
}
function MapView({ events, origin, batchId }) {
  const div = useRef();
  useEffect(() => {
    const points = [origin, ...events.map(e => e.data.location).filter(Boolean)];
    const map = L.map(div.current, { scrollWheelZoom: false }).setView([origin.lat, origin.lng], 9);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    points.forEach((p, i) => { const label = document.createElement('span'); label.textContent = sampleText(batchId, p.name); L.circleMarker([p.lat, p.lng], { radius: i === 0 ? 8 : 6, color: '#fff', weight: 2, fillColor: '#276346', fillOpacity: 1 }).addTo(map).bindTooltip(label); });
    L.polyline(points.map(p => [p.lat, p.lng]), { color: '#397553', weight: 3, dashArray: '5 7' }).addTo(map);
    if (points.length > 1) map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])), { padding: [24, 24], maxZoom: 12 });
    const timer = setTimeout(() => map.invalidateSize(), 100); return () => { clearTimeout(timer); map.remove(); };
  }, [events, origin, batchId]);
  return <div ref={div} className="journey-map" aria-label="Map of recorded batch locations"/>;
}
function Login({ onLogin, health, healthError, retryHealth, healthWaiting }) {
  const [accounts, setAccounts] = useState([]), [id, setId] = useState('farmer-1'), [password, setPassword] = useState(''), [busy, setBusy] = useState(false);
  const [accountError, setAccountError] = useState(''), [loginError, setLoginError] = useState('');
  const [accountWaiting, setAccountWaiting] = useState(false);
  const [accountAttempt, setAccountAttempt] = useState(0);
  useEffect(() => {
    if (!['demo', 'ethereum'].includes(health?.ledgerMode)) return;
    let active = true;
    setAccountError('');
    retryStartupRead(() => active ? api('/demo/accounts') : undefined, () => { if (active) setAccountWaiting(true); })
      .then(result => { if (active) setAccounts(result); })
      .catch(error => { if (active) setAccountError(error.message); })
      .finally(() => { if (active) setAccountWaiting(false); });
    return () => { active = false; };
  }, [health?.ledgerMode, accountAttempt]);
  const submit = async event => {
    event.preventDefault();
    if (!health?.ledgerMode || busy) return;
    setLoginError('');
    setBusy(true);
    try {
      const result = await api('/auth/login', { method: 'POST', body: { id, password } });
      token = result.token;
      sessionStorage.setItem('agritrace-token', token);
      onLogin(result.user);
    } catch (error) { setLoginError(error.message); }
    finally { setBusy(false); }
  };
  return <LoginView accounts={accounts} id={id} setId={setId} password={password} setPassword={setPassword} busy={busy} submit={submit} health={health} loginError={loginError}
    connectionWaiting={healthWaiting || accountWaiting}
    connectionError={healthError || accountError}
    retryConnection={healthError ? retryHealth : () => setAccountAttempt(attempt => attempt + 1)}/>;
}
function BatchForm({ submit, busy }) {
  const [gps, setGps] = useState({ lat: '28.9845', lng: '77.7064' });
  return <form onSubmit={e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); submit({ id: f.id, crop: f.crop, quantity: +f.quantity, price: +f.price, harvestDate: f.harvestDate, organic: f.organic === 'true', location: { name: f.location, lat: +gps.lat, lng: +gps.lng }, limits: { minTemp: +f.minTemp, maxTemp: +f.maxTemp, maxHumidity: +f.maxHumidity } }); }}><p className="muted">Start a traceable journey with the details of your harvest.</p><div className="form-grid"><Field label="Batch ID"><input name="id" defaultValue={`AGR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`} required pattern="[A-Za-z0-9-]+" maxLength={64}/></Field><Field label="Crop name"><input name="crop" placeholder="e.g. Tomatoes" required maxLength={160}/></Field><Field label="Quantity (kg)"><input name="quantity" type="number" step="0.001" min="0.001" required/></Field><Field label="Farm price (₹ / kg)"><input name="price" type="number" step="0.01" min="0" required/></Field><Field label="Harvest date"><input name="harvestDate" type="date" defaultValue={today()} max={today()} required/></Field><Field label="Organic declaration"><select name="organic"><option value="false">Conventional</option><option value="true">Organic (self-declared)</option></select></Field><Field label="Farm / village" wide><input name="location" placeholder="Farm name, district, state" required maxLength={160}/></Field><Field label="Latitude"><input type="number" min="-90" max="90" step="any" value={gps.lat} onChange={e => setGps({ ...gps, lat: e.target.value })} required/></Field><Field label="Longitude"><input type="number" min="-180" max="180" step="any" value={gps.lng} onChange={e => setGps({ ...gps, lng: e.target.value })} required/></Field><Field label="Minimum temperature (°C)"><input name="minTemp" type="number" step="0.1" defaultValue="2" min="-50" max="80" required/></Field><Field label="Maximum temperature (°C)"><input name="maxTemp" type="number" step="0.1" defaultValue="15" min="-50" max="80" required/></Field><Field label="Maximum humidity (%)"><input name="maxHumidity" type="number" defaultValue="90" min="0" max="100" required/></Field></div><p className="small muted">Your organic declaration is recorded as a claim. A certificate can be attached separately.</p><button className="button primary" disabled={busy}>{busy ? 'Registering…' : 'Register batch'}<ArrowRight size={16}/></button></form>;
}
function ActionForm({ type, batch, participants, submit, busy, ipfsConfigured }) {
  const [file, setFile] = useState();
  const latestLocation = [...batch.events].reverse().find(e => e.data.location)?.data.location || batch.origin;
  const locationFields = <><Field label="Location name" wide><input name="location" defaultValue={latestLocation.name} required/></Field><Field label="Latitude"><input name="lat" type="number" step="any" min="-90" max="90" defaultValue={latestLocation.lat} required/></Field><Field label="Longitude"><input name="lng" type="number" step="any" min="-180" max="180" defaultValue={latestLocation.lng} required/></Field></>;
  return <form onSubmit={e => {
    e.preventDefault(); const form = new FormData(e.currentTarget), f = Object.fromEntries(form);
    if (type === 'certificate') { if (!file) return; form.set('file', file); submit(form); return; }
    const location = { name: f.location, lat: +f.lat, lng: +f.lng };
    if (type === 'transfer') submit({ recipientId: f.recipientId, quantity: +f.quantity, price: +f.price, grade: f.grade, note: f.note, location, ...(f.shelfLifeDate ? { shelfLifeDate: f.shelfLifeDate } : {}) });
    if (type === 'sensor') submit({ temperature: +f.temperature, humidity: +f.humidity, deviceId: f.deviceId, location });
    if (type === 'recall') submit({ reason: f.reason });
    if (type === 'complaint') submit({ message: f.message });
    if (type === 'resolveComplaint') submit({ id: f.id, resolution: f.resolution });
  }}><div className="form-grid">
    {type === 'transfer' && <><Field label="Receive into custody" wide><select name="recipientId" required><option value="">Select a registered partner</option>{participants.filter(p => p.id !== batch.holder.id && !['farmer', 'regulator'].includes(p.role)).map(p => <option key={p.id} value={p.id}>{p.name} · {labels[p.role]}</option>)}</select></Field><Field label="Received weight (kg)"><input name="quantity" type="number" min="0.001" max={batch.quantity} step="0.001" defaultValue={batch.quantity} required/></Field><Field label="Price (₹ / kg)"><input name="price" type="number" min="0" step="0.01" required/></Field><Field label="Grade"><input name="grade" defaultValue="A" maxLength={40} required/></Field><Field label="Shelf life / best before (optional)"><input name="shelfLifeDate" type="date" min={today()}/></Field>{locationFields}<Field label="Handover notes" wide><textarea name="note" placeholder="Packing, processing or delivery details" maxLength={1000}/></Field></>}
    {type === 'sensor' && <><Field label="Temperature (°C)"><input name="temperature" type="number" step="0.1" min="-80" max="100" required/></Field><Field label="Humidity (%)"><input name="humidity" type="number" step="0.1" min="0" max="100" required/></Field><Field label="Sensor / device ID" wide><input name="deviceId" placeholder="SIM-TRUCK-07" maxLength={80} required/></Field>{locationFields}</>}
    {type === 'certificate' && <><div className="wide demo-note">{ipfsConfigured ? 'The file will be pinned to IPFS. Its CID and SHA-256 digest will be recorded in the ledger. Certificate contents become public on IPFS.' : 'IPFS is not configured. Start the supplied IPFS service and set IPFS_API before uploading.'}</div><Field label="Certificate title" wide><input name="name" required maxLength={160}/></Field><Field label="Type"><select name="type"><option>Lab test</option><option>Organic certificate</option><option>Pesticide declaration</option></select></Field><Field label="Issuing organization"><input name="issuer" required maxLength={160}/></Field><Field label="PDF or image · up to 5 MB" wide><input type="file" accept="application/pdf,image/png,image/jpeg" required onChange={e => setFile(e.target.files[0])}/></Field></>}
    {type === 'recall' && <><div className="wide alert-box">Recalling stops further handovers and makes a warning visible to consumers. The recall remains in the event history.</div><Field label="Reason for recall" wide><textarea name="reason" required maxLength={2000}/></Field></>}
    {type === 'complaint' && <Field label="Describe the issue" wide><textarea name="message" required maxLength={2000}/></Field>}
    {type === 'resolveComplaint' && <><Field label="Open complaint" wide><select name="id" required>{batch.complaints.filter(c => c.status === 'open').map(c => <option key={c.id} value={c.id}>{c.message}</option>)}</select></Field><Field label="Resolution / audit finding" wide><textarea name="resolution" maxLength={2000} required/></Field></>}
  </div><button className={`button ${type === 'recall' ? 'danger' : 'primary'}`} disabled={busy || (type === 'certificate' && !ipfsConfigured)}>{busy ? 'Recording…' : 'Record ' + (type === 'resolveComplaint' ? 'resolution' : type)}<ArrowRight size={16}/></button></form>;
}
function TraceDetail({ batch, verification, consumer = false, onAction, user, health, notify }) {
  const [tab, setTab] = useState(() => consumer ? ({ verification: 'Verification', performance: 'Performance' }[new URLSearchParams(window.location.search).get('view')] || 'Journey') : 'Journey'), [showQR, setShowQR] = useState(false), [anchorResult, setAnchorResult] = useState(''), [anchorBusy, setAnchorBusy] = useState(false);
  const currentHolder = user?.id === batch.holder.id && batch.status === 'active';
  const url = `${window.location.origin}${tracePath(batch.id)}`;
  const temperatures = sensors(batch), prices = batch.events.filter(e => ['HARVEST', 'TRANSFER'].includes(e.type));
  const verifyAnchor = async (write = false) => {
    setAnchorBusy(true);
    try {
      if (!window.ethereum) throw new Error('Install MetaMask to use the Sepolia anchor.');
      const { BrowserProvider, Contract, id } = await import('ethers');
      const provider = new BrowserProvider(window.ethereum);
      if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error('Select Ethereum Sepolia in MetaMask.');
      const contract = new Contract(health.anchorAddress, ['function anchor(bytes32,bytes32,uint256)', 'function roots(bytes32,uint256) view returns (bytes32)'], write ? await provider.getSigner() : provider);
      if (write) { const tx = await contract.anchor(id(batch.id), '0x' + batch.root, batch.events.length); setAnchorResult('Transaction submitted. Waiting for Sepolia confirmation…'); await tx.wait(); }
      const root = await contract.roots(id(batch.id), batch.events.length);
      setAnchorResult(root.toLowerCase() === '0x' + batch.root ? `Sepolia anchor matches this ${batch.events.length}-event snapshot.` : 'No matching anchor for the current snapshot. Older snapshots may still be anchored.');
    } catch (e) { setAnchorResult(e.shortMessage || e.message); } finally { setAnchorBusy(false); }
  };
  return <div className="trace-detail"><div className="detail-heading"><div className="crop-big">{cropEmoji(batch.crop)}</div><div><div className="eyebrow">{batchLabel(batch.id)}</div><h2>{sampleText(batch.id, batch.crop)}</h2><p className="muted"><MapPin size={14}/> {sampleText(batch.id, batch.origin.name)}</p></div><div className="detail-status">{batch.id === SEPOLIA_SAMPLE_ID && <Pill tone="neutral">Sepolia testnet · Simulated data</Pill>}<Pill tone={batch.status === 'recalled' ? 'red' : 'green'}>{statusLabel(batch)}</Pill><button className="button secondary small" onClick={() => setShowQR(true)}><QrCode size={16}/>Batch QR</button></div></div>
    {batch.status === 'recalled' && <div className="alert-box"><AlertTriangle size={20}/><div><strong>This batch has been recalled.</strong><p>{sampleText(batch.id, batch.recallReason)}</p></div></div>}
    <div className="detail-facts"><div><span>Current quantity</span><strong>{format(batch.quantity)} kg</strong></div><div><span>Harvested</span><strong>{batch.harvestDate}</strong></div><div><span>Current holder</span><strong>{batch.holder.name}</strong></div><div><span>Growing method</span><strong>{batch.organic ? 'Organic · self-declared' : 'Conventional'}</strong></div></div>
    {!consumer && <div className="action-bar">{currentHolder && <><button className="button primary small" onClick={() => onAction('transfer')}>Transfer custody<ArrowRight size={15}/></button>{['transporter', 'processor', 'retailer'].includes(user.role) && <button className="button secondary small" onClick={() => onAction('sensor')}><Thermometer size={15}/>Log reading</button>}<button className="button secondary small" onClick={() => onAction('certificate')}><FileCheck2 size={15}/>Add certificate</button></>}<button className="button secondary small" onClick={() => onAction('complaint')}>Report issue</button>{user?.role === 'regulator' && <>{batch.status !== 'recalled' && <button className="button danger small" onClick={() => onAction('recall')}>Recall batch</button>}{batch.complaints.some(c => c.status === 'open') && <button className="button secondary small" onClick={() => onAction('resolveComplaint')}>Resolve complaint</button>}</>}</div>}
    <div className="tabs" role="tablist">{['Journey', 'Cold chain', 'Prices', 'Certificates', 'Verification', ...(health?.ledgerMode === 'ethereum' ? ['Performance'] : []), ...(!consumer ? ['Audit'] : [])].map(t => <button role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)}>{t}</button>)}</div>
    {tab === 'Journey' && <div className="journey-grid"><div className="timeline">{batch.events.map(e => <div className="timeline-event" key={e.txId}><span className={`event-marker ${e.data.alert || e.type === 'RECALL' ? 'warning' : ''}`}><Check size={12}/></span><div><span className="small muted">{date(e.timestamp)}</span><h4>{{ HARVEST: 'Harvest registered', TRANSFER: 'Custody transferred', SENSOR: e.data.alert ? 'Cold-chain limit exceeded' : 'Conditions recorded', CERTIFICATE: 'Certificate attached', RECALL: 'Batch recalled', COMPLAINT: 'Issue reported', COMPLAINT_RESOLVED: 'Complaint resolved' }[e.type]}</h4><p>{e.actor.name} · {labels[e.actor.role]}</p>{e.type === 'TRANSFER' && <p>To {e.data.to.name} · ₹{format(e.data.price)}/kg · {format(e.data.quantity)} kg</p>}{e.type === 'SENSOR' && <p>{e.data.temperature}°C · {e.data.humidity}% humidity</p>}{e.data.location && <span className="small muted">{sampleText(batch.id, e.data.location.name)}</span>}{e.data.note && <p>{sampleText(batch.id, e.data.note)}</p>}{e.type === 'RECALL' && <p>{sampleText(batch.id, e.data.reason)}</p>}<details><summary>Transaction record</summary><code className="hash">{e.txId}</code><a className="text-link" href={`/api/trace/${encodeURIComponent(batch.id)}/proof/${e.index}`} target="_blank" rel="noreferrer">Open Merkle proof <ArrowUpRight size={13}/></a></details></div></div>)}</div><div><MapView events={batch.events} origin={batch.origin} batchId={batch.id}/><div className="map-note"><Route size={17}/><p>Lines connect recorded checkpoints; they do not represent live GPS tracking.</p></div></div></div>}
    {tab === 'Cold chain' && <div><div className="section-intro"><h3>Conditions along the way</h3><p className="muted">Batch limits: {batch.limits.minTemp}–{batch.limits.maxTemp}°C · humidity ≤ {batch.limits.maxHumidity}%</p></div>{temperatures.length ? <><div className="temperature-chart" aria-label="Recorded temperature chart">{temperatures.map((e, i) => <div key={e.txId} className="temp-column"><span>{e.data.temperature}°</span><div style={{ height: `${Math.min(160, Math.max(8, (e.data.temperature + 20) * 3))}px`, background: e.data.alert ? '#c76c3c' : '#568767' }}/><small>{i + 1}</small></div>)}</div><div className="table-scroll"><table><thead><tr><th>Recorded</th><th>Device</th><th>Temperature</th><th>Humidity</th><th>Result</th></tr></thead><tbody>{temperatures.map(e => <tr key={e.txId}><td>{date(e.timestamp)}</td><td>{e.data.deviceId}</td><td>{e.data.temperature}°C</td><td>{e.data.humidity}%</td><td><Pill tone={e.data.alert ? 'amber' : 'green'}>{e.data.alert ? 'Limit exceeded' : 'Within limits'}</Pill></td></tr>)}</tbody></table></div></> : <Empty title="No readings yet" text="The current cold-chain holder can log a sensor reading."/>}</div>}
    {tab === 'Prices' && <div><div className="section-intro"><h3>From farm price to shelf price</h3><p className="muted">Recorded prices per kilogram in INR. Changes show price differences, not net profit.</p></div>{prices.map((e, i) => <div className="price-row" key={e.txId}><span className="price-number">{String(i + 1).padStart(2, '0')}</span><div><strong>{e.type === 'HARVEST' ? 'Farm gate' : labels[e.data.to.role]}</strong><p className="muted small">{e.type === 'HARVEST' ? e.actor.name : e.data.to.name}</p></div><div className="price-track"><div style={{ width: `${Math.max(4, e.data.price / Math.max(1, ...prices.map(p => p.data.price)) * 100)}%` }}/></div><strong>₹{format(e.data.price)}</strong><span className="muted small">{i ? `${e.data.price - prices[i - 1].data.price >= 0 ? '+' : ''}₹${format(e.data.price - prices[i - 1].data.price)}` : 'Starting price'}</span></div>)}</div>}
    {tab === 'Certificates' && <div className="section-intro"><h3>Documents behind the declaration</h3><p className="muted">A digest verifies file integrity. It does not establish that an issuer or an organic claim is authentic.</p>{batch.certificates.length ? batch.certificates.map(c => <article className="certificate" key={c.sha256}><FileCheck2/><div><h4>{c.name}</h4><p>{c.type} · {c.issuer}</p><code className="hash">SHA-256: {c.sha256}</code><a className="text-link" href={`https://ipfs.io/ipfs/${c.cid}`} target="_blank" rel="noreferrer">View on IPFS <ArrowUpRight size={13}/></a><label className="text-link">Check a local copy<input className="small" type="file" onChange={async e => { const f = e.target.files[0]; if (!f) return; const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await f.arrayBuffer()))].map(x => x.toString(16).padStart(2, '0')).join(''); notify(digest === c.sha256 ? 'File matches the recorded certificate digest.' : 'File does not match the recorded certificate digest.'); }}/></label></div></article>) : <Empty title="No certificates attached" text="The organic label is a farmer declaration until supporting documents are provided."/>}</div>}
    {tab === 'Verification' && <div className="section-intro"><h3><ShieldCheck size={21}/> Check the record</h3><WalletStatus health={health}/>{health?.ethereum && <p className="hash">Contract: {health.ethereum.contract}</p>}<Pill tone={verification.valid ? 'green' : 'red'}>{verification.valid ? 'Event history and batch data match' : 'Integrity check failed'}</Pill><p className="muted">{verification.ledgerMode === 'demo' ? 'Local integrity check only. A local administrator could rewrite the entire local history; this is not independent proof or Fabric consensus.' : verification.ledgerMode === 'ethereum' ? 'Records read from the Ethereum contract on the configured network. Registered wallets submit changes authorized by the API validator; The configured network confirms the transactions.' : 'Records read from Hyperledger Fabric. Membership identities sign writes and peers enforce chaincode rules.'}</p><label className="field"><span>Current Merkle root · {batch.events.length} events</span><code className="hash root-hash">{batch.root}</code></label><button className="button secondary small" onClick={() => { const blob = new Blob([JSON.stringify({ batch, verification }, null, 2)], { type: 'application/json' }); const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = `${batch.id}-trace.json`; a.click(); URL.revokeObjectURL(href); }}><Download size={15}/>Export trace and root</button><TamperDemo key={batch.id + batch.root} batch={batch}/>{verification.blockchain && <p className="hash">Confirmed in block {verification.blockchain.blockNumber} · Transaction {verification.blockchain.chainId === 11155111 ? <a href={'https://sepolia.etherscan.io/tx/' + verification.blockchain.transactionHash} target="_blank" rel="noreferrer">{verification.blockchain.transactionHash}</a> : verification.blockchain.transactionHash}</p>}{verification.ledgerMode !== 'ethereum' && <div className="anchor-box"><Wallet size={22}/><div><h4>Public Ethereum anchor</h4><p className="muted">{health.anchorAddress ? 'Check the current snapshot against Sepolia, or anchor it with an authorized wallet. Anchoring uses test ETH.' : 'No Sepolia contract configured. Deploy BatchAnchor.sol, authorize an anchoring wallet, and set ANCHOR_ADDRESS to enable this.'}</p>{health.anchorAddress && <><button className="button secondary small" disabled={anchorBusy} onClick={() => verifyAnchor(false)}>Verify on Sepolia</button>{user?.role === 'regulator' && <button className="button primary small" disabled={anchorBusy} onClick={() => verifyAnchor(true)}>Anchor snapshot</button>}</>}<p role="status">{anchorResult}</p></div></div>}</div>}
    {tab === 'Performance' && <PerformanceDashboard health={health} suggestedHash={verification.blockchain?.transactionHash}/>}
    {tab === 'Audit' && <div className="section-intro"><h3>Complaints & audit trail</h3>{batch.complaints.length ? batch.complaints.map(c => <article className="complaint" key={c.id}><Pill tone={c.status === 'open' ? 'amber' : 'green'}>{c.status}</Pill><p>{sampleText(batch.id, c.message)}</p>{c.resolution && <p><strong>Resolution:</strong> {sampleText(batch.id, c.resolution)}</p>}</article>) : <Empty title="No complaints recorded" text="Registered participants can report issues for regulator review."/>}</div>}
    {showQR && <Modal title="A story in one scan" close={() => setShowQR(false)}><div className="qr-panel"><QRCodeSVG value={url} size={220} level="M" marginSize={3}/><h3>{sampleText(batch.id, batch.crop)}</h3><code>{batchLabel(batch.id)}</code><p className="muted">Anyone with this link can read the batch journey.</p><a className="text-link" href={url} target="_blank" rel="noreferrer">Open consumer page <ArrowUpRight size={15}/></a><button className="button secondary" onClick={() => window.print()}>Print batch label</button><p className="small muted">For scanning from a phone, serve AgriTrace at an address reachable by that phone; a localhost QR only works on this computer.</p></div></Modal>}
  </div>;
}
function Empty({ title, text }) { return <div className="empty"><Sprout size={30}/><h3>{title}</h3><p>{text}</p></div>; }
function Consumer({ id, health, notify }) {
  const [result, setResult] = useState(), [error, setError] = useState(''), [lookup, setLookup] = useState(id === SEPOLIA_SAMPLE_ID ? '' : id || '');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id) return;
    let active = true;
    setError('');
    api(`/trace/${encodeURIComponent(id)}`)
      .then(data => { if (active) setResult(data); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [id, attempt]);
  return <div className="consumer-page"><header><a href="/" className="brand"><span className="brand-icon"><Leaf/></span>agri<span>trace</span></a><span className="small muted">Know your food. Follow its story.</span><a className="text-link" href="/">Partner sign in <ArrowUpRight size={15}/></a></header><main><span className="eyebrow">FARM TO YOU</span><h1>Every harvest has a story.</h1><p className="muted">Trace the people, places, and conditions behind your produce.</p><form className="lookup" onSubmit={e => { e.preventDefault(); if (lookup.trim()) window.location.href = tracePath(lookup.trim()); }}><input aria-label="Batch ID" placeholder="Enter batch ID" value={lookup} onChange={e => setLookup(e.target.value)} required/><button className="button primary">Trace batch <ArrowRight size={16}/></button></form>{health.ledgerMode === 'demo' && <div className="demo-note">Local practice data · Stored in a file on this computer.</div>}{error && <div className="alert-box"><div><p role="alert">{error}</p><button type="button" className="button secondary small" onClick={() => setAttempt(value => value + 1)}>Retry batch lookup</button></div></div>}{result ? <div className="card"><TraceDetail {...result} consumer health={health} notify={notify}/></div> : id && !error ? <p>Loading batch journey…</p> : !error && <Empty title="Start with a batch ID" text="Find it on your produce label or scan an AgriTrace QR code."/>}</main><footer>AgriTrace · A clearer path from farm to shelf.</footer></div>;
}
function App() {
  const [health, setHealth] = useState({}), [user, setUser] = useState(), [loading, setLoading] = useState(true), [batches, setBatches] = useState([]), [participants, setParticipants] = useState([]), [page, setPage] = useState('Overview'), [search, setSearch] = useState(''), [filter, setFilter] = useState('all'), [modal, setModal] = useState(), [detail, setDetail] = useState(), [busy, setBusy] = useState(false), [toast, setToast] = useState(''), [loadError, setLoadError] = useState('');
  const signOut = () => { token = null; sessionStorage.removeItem('agritrace-token'); setUser(null); setDetail(null); setModal(null); setBatches([]); setPage('Overview'); setSearch(''); setFilter('all'); setLoadError(''); };
  const notify = message => setToast(message);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 6500); return () => clearTimeout(t); } }, [toast]);
  const [healthError, setHealthError] = useState('');
  const [healthWaiting, setHealthWaiting] = useState(false);
  const retryHealth = () => {
    setHealthError('');
    retryStartupRead(() => api('/health'), () => setHealthWaiting(true))
      .then(setHealth)
      .catch(error => setHealthError(error.message))
      .finally(() => setHealthWaiting(false));
  };
  useEffect(() => {
    retryHealth();
    if (token) api('/me').then(setUser).catch(() => { token = null; sessionStorage.removeItem('agritrace-token'); }).finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  const refresh = async () => { try { const [b, p] = await Promise.all([api('/batches'), api('/participants')]); setBatches(b); setParticipants(p); setLoadError(''); } catch (e) { setLoadError(e.message); } };
  useEffect(() => { if (user) refresh(); }, [user]);
  const openBatch = async id => { try { setDetail(await api(`/trace/${encodeURIComponent(id)}`)); } catch (e) { notify(e.message); } };
  const submit = async body => { setBusy(true); try {
    const endpoint = modal.type === 'create' ? '/batches' : `/batches/${encodeURIComponent(detail.batch.id)}/${modal.type === 'certificate' ? 'certificates' : modal.type}`;
    const result = await api(endpoint, { method: 'POST', body });
    setModal(null); await refresh(); await openBatch(result.id); notify('Recorded successfully. The batch history has been updated.');
  } catch (e) { notify(e.message); } finally { setBusy(false); } };
  const consumerPath = window.location.pathname.match(/^\/trace(?:\/(.*))?$/);
  const toastView = <>{toast && <div className="toast" role="status"><span>{toast}</span><button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={16}/></button></div>}<TransactionNotice health={health}/></>;
  if (consumerPath) return <><Consumer id={consumerPath[1] ? decodeURIComponent(consumerPath[1]) : featuredBatchId(new URLSearchParams(window.location.search).get('batch'))} health={health} notify={notify}/>{toastView}</>;
  if (loading) return <LoadingScreen/>;
  if (!user) return <><Login onLogin={setUser} health={health} healthError={healthError} retryHealth={retryHealth} healthWaiting={healthWaiting}/>{toastView}</>;
  const nav = [{ name: 'Overview', icon: LayoutDashboard }, { name: 'Batches', icon: Boxes }, { name: 'Cold chain', icon: Thermometer }, { name: 'Partners', icon: Users }, ...(health.ledgerMode === 'ethereum' ? [{ name: 'Performance', icon: Clock3 }] : []), ...(user.role === 'regulator' ? [{ name: 'Regulator', icon: ShieldCheck }] : [])];
  const alerts = batches.filter(hasAlert), recalled = batches.filter(b => b.status === 'recalled'), mine = batches.filter(b => b.holder.id === user.id);
  const filtered = batches.filter(b => `${b.id} ${batchLabel(b.id)} ${b.crop} ${sampleText(b.id, b.crop)} ${b.origin.name} ${b.holder.name}`.toLowerCase().includes(search.toLowerCase())).filter(b => filter === 'all' || (filter === 'mine' ? b.holder.id === user.id : filter === 'alerts' ? hasAlert(b) : b.status === 'recalled'));
  const readings = batches.flatMap(b => sensors(b).map(e => ({ ...e, batch: b })));
  const totalEvents = batches.reduce((s,b) => s + b.events.length, 0);
  const table = <div className="table-scroll"><table><thead><tr><th>Produce / batch</th><th>Origin</th><th>Quantity</th><th>Current holder</th><th>Status</th><th><span className="sr-only">Open batch</span></th></tr></thead><tbody>{filtered.map(b => <tr key={b.id}><td><button className="produce-cell" onClick={() => openBatch(b.id)}><span className="crop-icon">{cropEmoji(b.crop)}</span><span><strong>{sampleText(b.id, b.crop)}</strong><small>{batchLabel(b.id)}</small></span></button></td><td>{sampleText(b.id, b.origin.name)}</td><td>{format(b.quantity)} <span className="muted">kg</span></td><td><strong className="regular">{b.holder.name}</strong><small>{labels[b.holder.role]}</small></td><td><Pill tone={b.status === 'recalled' ? 'red' : b.holder.role === 'transporter' ? 'blue' : 'green'}>{statusLabel(b)}</Pill>{hasAlert(b) && <span className="row-alert"><AlertTriangle size={12}/>Cold-chain alert</span>}</td><td><button className="icon-btn" aria-label={`View ${batchLabel(b.id)}`} onClick={() => openBatch(b.id)}><ArrowUpRight size={18}/></button></td></tr>)}</tbody></table>{!filtered.length && <Empty title="No batches found" text="Try another search or register your first harvest."/>}</div>;
  return <div className="app-shell"><aside className="sidebar"><a href="/" className="brand"><span className="brand-icon"><Leaf size={24}/></span>agri<span>trace</span></a><div className="workspace-label">SUPPLY CHAIN WORKSPACE</div><nav>{nav.map(({ name, icon: Icon }) => <button key={name} className={page === name ? 'selected' : ''} onClick={() => { setPage(name); setSearch(''); setFilter('all'); }}><Icon size={19}/>{name}{name === 'Cold chain' && alerts.length > 0 && <span className="nav-count">{alerts.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="trace-callout"><div className="callout-icon"><QrCode size={23}/></div><strong>Trust starts with a trace.</strong><p>See the journey through your customer’s eyes.</p><a href="/trace" target="_blank" rel="noreferrer">Consumer portal <ArrowUpRight size={15}/></a></div><WalletStatus health={health}/><div className="network-state"><span className="dot"/>{health.ledgerMode === 'ethereum' ? 'Ethereum contract connected' : health.ledgerMode === 'fabric' ? 'Fabric gateway configured' : 'Local practice workspace'}<span className="small">{health.ledgerMode === 'ethereum' ? 'Wallet-confirmed transactions' : health.ledgerMode === 'fabric' ? 'Hyperledger Fabric' : 'Not a distributed blockchain'}</span></div><button className="profile" onClick={signOut}><span className="avatar">{user.name.split(' ').map(n => n[0]).join('')}</span><span><strong>{user.name}</strong><small>{labels[user.role]} · Sign out</small></span><LogOut size={15}/></button></div></aside>
    <div className="main-shell"><header className="topbar"><div><span className="muted">Workspace</span><span className="slash">/</span><strong>{page}</strong></div><div className="topbar-right"><span className="today">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span className="divider"/><Pill tone="neutral">{labels[user.role]}</Pill><button className="icon-btn" aria-label="Refresh records" onClick={refresh}><RefreshCw size={17}/></button><button className="icon-btn mobile-signout" aria-label="Sign out" onClick={signOut}><LogOut size={17}/></button></div></header>
    <main className="dashboard" key={page}><div className="page-heading"><div><span className="eyebrow">YOUR HARVEST, CONNECTED</span><h1>{page === 'Performance' ? 'Blockchain performance' : page === 'Overview' ? 'Supply chain overview' : page === 'Regulator' ? 'Regulator workspace' : page === 'Batches' ? 'Every batch. One clear record.' : page === 'Cold chain' ? 'Keep freshness in the picture.' : 'People behind the produce.'}</h1><p className="muted">{page === 'Performance' ? 'Measured receipts, gas costs and wallet transaction history.' : page === 'Overview' ? 'A clearer view of your produce, from the first harvest to the final shelf.' : page === 'Regulator' ? 'Review exceptions, investigate complaints, and recall individual batches.' : page === 'Cold chain' ? 'Recorded temperature and humidity, with every excursion visible.' : page === 'Partners' ? 'Verified workspace identities across your supply chain.' : 'Register, hand over, and follow the story of your produce.'}</p></div>{user.role === 'farmer' && <button className="button primary" onClick={() => setModal({ type: 'create' })}><Plus size={18}/>Register batch</button>}</div>
    {loadError && <div className="alert-box" role="alert">{loadError}<button className="text-link" onClick={refresh}>Try again</button></div>}
    {page === 'Overview' && <><section className="hero-banner"><div className="hero-copy"><span className="hero-kicker"><span className="status-spark"/> GROWING TRUST, TOGETHER</span><h2>Every harvest.<br/><em>Accounted for.</em></h2><p>Follow the people, places, and conditions behind your produce. A clearer journey starts here.</p><div className="hero-actions"><button onClick={() => { setPage('Batches'); setFilter('all'); }} className="hero-link">Explore batches <ArrowUpRight size={17}/></button><a href="/trace" className="hero-secondary" target="_blank" rel="noreferrer">Consumer view <ArrowRight size={15}/></a></div><div className="hero-principles"><span><Check size={12}/> Traceable origins</span><span><Check size={12}/> Shared history</span></div></div><JourneyVisual batches={batches}/></section><section className="stats-grid">{[{ label: 'Registered batches', value: batches.length, icon: Boxes, note: `${batches.filter(b=>b.status==='active').length} active in the supply chain`, color: 'green' }, { label: 'In your custody', value: mine.length, icon: Route, note: 'Ready for your next step', color: 'blue' }, { label: 'Cold-chain alerts', value: alerts.length, icon: Thermometer, note: `${readings.length} sensor readings recorded`, color: 'amber' }, { label: 'Recorded events', value: totalEvents, icon: ShieldCheck, note: `${recalled.length} recalled ${recalled.length === 1 ? 'batch' : 'batches'}`, color: 'green' }].map((s,i) => <article className={`stat-card stat-${s.color}`} key={s.label}><div><span>{s.label}</span><span className={`stat-icon ${s.color}`}><s.icon size={19}/></span></div><div className="stat-main"><strong className="stat-value"><AnimatedNumber value={s.value}/></strong><span className="stat-serial">0{i + 1}</span></div><p><span className="dot"/>{s.note}</p></article>)}</section></>}
    {['Overview', 'Batches', 'Regulator'].includes(page) && <section className="card batches-card"><div className="section-heading"><div><h2>{page === 'Regulator' ? 'Batch audit register' : page === 'Overview' ? 'Produce in motion' : 'Batch register'}</h2><p className="muted small">{batches.length} registered batches · select a batch to view its journey</p></div><label className="search"><Search size={16}/><input aria-label="Search batches" placeholder="Search produce, batch, origin…" value={search} onChange={e => setSearch(e.target.value)}/></label></div><div className="filter-bar">{[['all','All batches'], ['mine','In my custody'], ['alerts','Cold-chain alerts'], ['recalled','Recalled']].map(([key,label])=><button className={filter === key ? 'active' : ''} key={key} onClick={()=>setFilter(key)}>{label}{key === 'all' && <span>{batches.length}</span>}</button>)}</div>{table}</section>}
    {page === 'Overview' && <div className="bottom-grid"><section className="card"><div className="section-heading"><h2>Latest activity</h2><Clock3 size={17} className="muted"/></div><div className="activity-list">{batches.flatMap(b => b.events.map(e => ({...e,batch:b}))).sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,4).map(e=><button className="activity-item" key={e.txId} onClick={()=>openBatch(e.batch.id)}><span className={`activity-icon ${e.data.alert ? 'amber' : ''}`}>{e.type === 'SENSOR' ? <Thermometer size={17}/> : <Route size={17}/>}</span><span><strong>{e.type === 'TRANSFER' ? 'Custody handed over' : e.type === 'SENSOR' ? 'Sensor reading recorded' : e.type.replaceAll('_',' ').toLowerCase()}</strong><small>{batchLabel(e.batch.id)} · {e.actor.name}</small></span><span className="small muted">{new Date(e.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span></button>)}{!batches.length && <Empty title="Your story starts here" text="Register a batch to begin."/>}</div></section><section className="card assurance-card"><span className="assurance-icon"><Leaf size={28}/></span><span className="eyebrow">GROWN WITH CARE. SHARED WITH CLARITY.</span><h2>A little more transparency.<br/>A lot more confidence.</h2><p className="muted">Your customer sees the origin, handovers, and conditions behind each batch. Simply scan and follow along.</p><a href="/trace" className="text-link" target="_blank" rel="noreferrer">Explore the consumer experience <ArrowUpRight size={16}/></a></section></div>}
    {page === 'Performance' && <PerformanceDashboard health={health}/>}
    {page === 'Cold chain' && <section className="card"><div className="section-heading"><h2>Sensor log</h2><Pill tone={readings.some(r=>r.data.alert)?'amber':'green'}>{readings.filter(r=>r.data.alert).length} recorded excursions</Pill></div>{readings.length ? <div className="table-scroll"><table><thead><tr><th>Batch</th><th>Device</th><th>Recorded</th><th>Temperature</th><th>Humidity</th><th>Status</th></tr></thead><tbody>{readings.map(r=><tr key={r.txId}><td><button className="text-link" onClick={()=>openBatch(r.batch.id)}>{batchLabel(r.batch.id)}</button></td><td>{r.data.deviceId}</td><td>{date(r.timestamp)}</td><td>{r.data.temperature}°C</td><td>{r.data.humidity}%</td><td><Pill tone={r.data.alert?'amber':'green'}>{r.data.alert?'Limit exceeded':'Within limits'}</Pill></td></tr>)}</tbody></table></div> : <Empty title="No sensor readings yet" text="Open a batch in your custody to record its conditions."/>}</section>}
    {page === 'Partners' && <section className="partner-grid">{participants.map(p=><article className="card partner-card" key={p.id}><span className="avatar">{p.name.split(' ').map(n=>n[0]).join('')}</span><Pill tone="neutral">{labels[p.role]}</Pill><h3>{p.name}</h3><p className="muted">{p.organization}</p><code className="small">{p.id}</code><span className="small muted">{batches.filter(b=>b.holder.id===p.id).length} batches in custody</span></article>)}</section>}
    {page === 'Regulator' && <section className="card"><div className="section-heading"><h2>Open complaints</h2></div>{batches.some(b=>b.complaints.some(c=>c.status==='open')) ? batches.flatMap(b=>b.complaints.filter(c=>c.status==='open').map(c=><button className="complaint-row" key={c.id} onClick={()=>openBatch(b.id)}><AlertTriangle size={19}/><span><strong>{batchLabel(b.id)} · {sampleText(b.id, b.crop)}</strong><p>{sampleText(b.id, c.message)}</p></span><ArrowUpRight size={18}/></button>)) : <Empty title="All clear" text="There are no open complaints in the register."/>}</section>}
    <footer className="dashboard-footer"><span>AgriTrace · Every harvest has a story.</span><span>{health.ledgerMode === 'demo' ? 'Local practice · Seeded records' : health.ledgerMode === 'ethereum' ? 'Ethereum blockchain workspace' : 'Hyperledger Fabric workspace'}</span></footer></main></div>
    {detail && <Modal title="Batch journey" large close={() => { if (!busy) { setDetail(null); setModal(null); } }}><TraceDetail {...detail} user={user} health={health} notify={notify} onAction={type=>setModal({type})}/></Modal>}
    {modal && <Modal title={{create:'Register a harvest',transfer:'Transfer custody',sensor:'Record conditions',certificate:'Attach a certificate',recall:'Recall this batch',complaint:'Report a batch issue',resolveComplaint:'Resolve a complaint'}[modal.type]} close={()=>!busy&&setModal(null)}>{modal.type === 'create' ? <BatchForm submit={submit} busy={busy}/> : <ActionForm key={modal.type} type={modal.type} batch={detail.batch} participants={participants} submit={submit} busy={busy} ipfsConfigured={health.ipfsConfigured}/>}</Modal>}{toastView}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
