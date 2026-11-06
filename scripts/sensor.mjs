import mqtt from 'mqtt';
const base = process.env.API_URL || 'http://127.0.0.1:4000';
const batchId = process.argv[2] || 'AGR-2026-001';
const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: process.env.SENSOR_ACCOUNT || 'transporter-1', password: process.env.SENSOR_PASSWORD || 'agritrace-demo' }) });
if (!response.ok) throw new Error('Sensor sign-in failed');
const { token } = await response.json();
const reading = { batchId, temperature: +(6 + Math.random() * 14).toFixed(1), humidity: +(65 + Math.random() * 30).toFixed(1), deviceId: 'SIM-TRUCK-07', location: { name: 'Noida, simulated checkpoint', lat: 28.5355, lng: 77.391 } };
if (process.env.MQTT_URL) {
  const client = await mqtt.connectAsync(process.env.MQTT_URL);
  // Gateway credentials stay in its environment; never put bearer tokens into MQTT messages.
  await client.publishAsync(`agritrace/sensors/${batchId}`, JSON.stringify(reading), { qos: 1 }); await client.endAsync(); console.log('Published a simulated MQTT reading for ' + batchId);
} else {
  const result = await fetch(`${base}/api/batches/${encodeURIComponent(batchId)}/sensor`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(reading) });
  if (!result.ok) throw new Error((await result.json()).error); console.log('Recorded simulated reading: ' + reading.temperature + '°C, ' + reading.humidity + '%');
}
