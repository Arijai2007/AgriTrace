import { resolve } from 'node:path';
import { DemoLedger } from './ledger.mjs';
import { demoAccounts } from './accounts.mjs';
const ledger = new DemoLedger(resolve(import.meta.dirname, 'data/ledger.json'));
if ((await ledger.list()).length) { console.log('Demo ledger already has batches; seed left existing records intact.'); process.exit(0); }
const [farmer, aggregator, transporter, processor, retailer, regulator] = demoAccounts;
const farms = [
  { id: 'AGR-2026-001', crop: 'Organic tomatoes', quantity: 480, organic: true, price: 24, location: { name: 'Green Valley Farms, Meerut', lat: 28.9845, lng: 77.7064 } },
  { id: 'AGR-2026-002', crop: 'Basmati rice', quantity: 1200, organic: false, price: 52, location: { name: 'Karnal, Haryana', lat: 29.6857, lng: 76.9905 }, limits: { minTemp: 5, maxTemp: 30, maxHumidity: 70 } },
  { id: 'AGR-2026-003', crop: 'Fresh spinach', quantity: 160, organic: true, price: 18, location: { name: 'Hapur, Uttar Pradesh', lat: 28.7306, lng: 77.7759 } }
];
for (const input of farms) await ledger.create({ ...input, harvestDate: new Date().toISOString().slice(0, 10) }, farmer);
const handover = (id, from, to, price, location, quantity) => ledger.update(id, 'transfer', { recipient: to, price, location, quantity, grade: 'A', note: 'Seeded demonstration journey' }, from);
const mandi = { name: 'Azadpur Mandi, Delhi', lat: 28.7041, lng: 77.1808 };
const warehouse = { name: 'Noida cold storage', lat: 28.5355, lng: 77.3910 };
await handover(farms[0].id, farmer, aggregator, 29, mandi, 480);
await handover(farms[0].id, aggregator, transporter, 33, mandi, 475);
await ledger.update(farms[0].id, 'sensor', { temperature: 8.4, humidity: 76, deviceId: 'SIM-TRUCK-07', location: warehouse }, transporter);
await handover(farms[1].id, farmer, aggregator, 58, mandi, 1200);
await handover(farms[1].id, aggregator, processor, 64, warehouse, 1190);
await handover(farms[1].id, processor, retailer, 78, { name: 'Fresh Basket, Noida', lat: 28.5706, lng: 77.3272 }, 1190);
await handover(farms[2].id, farmer, transporter, 23, mandi, 160);
await ledger.update(farms[2].id, 'sensor', { temperature: 24.8, humidity: 94, deviceId: 'SIM-TRUCK-12', location: warehouse }, transporter);
await ledger.update(farms[2].id, 'complaint', { message: 'Temperature excursion needs investigation.' }, retailer);
console.log('Seeded 3 example batches. All names and readings are demonstration data.');
