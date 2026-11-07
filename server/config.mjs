import { resolve } from 'node:path';

export function runtimeConfig(env = process.env) {
  const mode = env.LEDGER_MODE || 'demo';
  if (!['demo', 'fabric', 'ethereum'].includes(mode)) throw new Error('LEDGER_MODE must be demo, fabric or ethereum');
  const hosted = env.NODE_ENV === 'production' || env.RENDER === 'true';
  const secret = env.JWT_SECRET;
  if ((hosted || mode !== 'demo') && (!secret || secret.length < 32)) throw new Error('Set JWT_SECRET to at least 32 random characters for hosted or Fabric deployments');
  const port = Number(env.PORT || 4000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid port number');
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 5');
  return { mode, secret, port, trustProxyHops, host: env.HOST || (hosted ? '0.0.0.0' : '127.0.0.1'), dataFile: env.DATA_FILE ? resolve(env.DATA_FILE) : resolve(import.meta.dirname, 'data/ledger.json') };
}
