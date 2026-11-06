import { readFile } from 'node:fs/promises';
import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
export const demoAccounts = [
  { id: 'farmer-1', name: 'Kavita Sharma', role: 'farmer', organization: 'Green Valley Farms' },
  { id: 'aggregator-1', name: 'Arjun Mehta', role: 'aggregator', organization: 'Azadpur Mandi' },
  { id: 'transporter-1', name: 'Ravi Singh', role: 'transporter', organization: 'FreshRoute Logistics' },
  { id: 'processor-1', name: 'Neha Verma', role: 'processor', organization: 'Harvest Cold Storage' },
  { id: 'retailer-1', name: 'Aditi Rao', role: 'retailer', organization: 'Fresh Basket' },
  { id: 'regulator-1', name: 'Vikram Gupta', role: 'regulator', organization: 'Food Safety Audit · Demo' }
];
export function passwordHash(password, salt = randomBytes(16).toString('hex')) { return { salt, hash: scryptSync(password, salt, 64).toString('hex') }; }
export function passwordMatches(password, account) {
  if (typeof password !== 'string' || password.length > 1024) return false;
  const a = scryptSync(password, account.salt, 64), b = Buffer.from(account.hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
export const publicAccount = ({ id, name, role, organization }) => ({ id, name, role, organization });
export async function loadAccounts(mode) {
  if (mode === 'demo') return demoAccounts.map(a => ({ ...a, ...passwordHash(process.env.DEMO_PASSWORD || 'agritrace-demo') }));
  if (!process.env.ACCOUNTS_FILE) throw new Error('ACCOUNTS_FILE is required in Fabric mode');
  const accounts = JSON.parse(await readFile(process.env.ACCOUNTS_FILE, 'utf8'));
  if (!Array.isArray(accounts) || !accounts.length || accounts.some(a => !a.fabric || !a.hash || !a.salt)) throw new Error('Invalid trusted accounts configuration');
  return accounts;
}
