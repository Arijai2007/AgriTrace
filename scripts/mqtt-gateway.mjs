import mqtt from 'mqtt';
const base = process.env.API_URL || 'http://127.0.0.1:4000';
let token, expiresAt = 0;
async function getToken() {
  if (token && Date.now() < expiresAt) return token;
  const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: process.env.SENSOR_ACCOUNT || 'transporter-1', password: process.env.SENSOR_PASSWORD || 'agritrace-demo' }) });
  if (!response.ok) throw new Error('Gateway sign-in failed');
  token = (await response.json()).token; expiresAt = Date.now() + 90 * 60_000; return token;
}
const client = await mqtt.connectAsync(process.env.MQTT_URL || 'mqtt://127.0.0.1:1883', { username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD });
await client.subscribeAsync('agritrace/sensors/+', { qos: 1 });
client.on('message', async (topic, payload) => {
  try {
    if (payload.length > 4096) throw new Error('Oversized sensor payload');
    const input = JSON.parse(payload.toString()), batchId = topic.split('/')[2];
    if (input.batchId !== batchId) throw new Error('Topic and batch ID mismatch');
    const result = await fetch(`${base}/api/batches/${encodeURIComponent(batchId)}/sensor`, { method: 'POST', headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (!result.ok) throw new Error((await result.json()).error);
    console.log(`Committed sensor reading for ${batchId}`);
  } catch (e) { console.error('Reading rejected: ' + e.message); }
});
console.log('MQTT oracle listening. Writes use the configured cold-chain holder identity.');
process.on('SIGINT', async () => { await client.endAsync(); process.exit(0); });
