# Deploy AgriTrace for a college demonstration

## Recommended setup

Use **one Render web service** for the built React frontend and the Express API. They share one HTTPS address, so API calls, consumer routes, QR links and certificate digest checks work without cross-origin settings. Vercel and Streamlit are unnecessary for this version.

The repository includes `render.yaml` with the free plan and Singapore region. It creates one web service and no paid resource. It does not deploy Fabric, IPFS, an MQTT broker or an Ethereum contract. The hosted application clearly identifies its demo ledger.

## Deploy from GitHub

1. Open [Deploy AgriTrace to Render](https://render.com/deploy?repo=https://github.com/Arijai2007/AgriTrace), sign in, and select your workspace.
2. Review the Blueprint: one free Node web service. Set `DEMO_PASSWORD` to a password you can share with your project team/examiner. Render generates the independent `JWT_SECRET` automatically.
3. Create the Blueprint and wait for its first deployment to finish. Render chooses an available `onrender.com` address; the repository does not assume a particular hostname.
4. Open the returned URL, choose any account and sign in with the password you provided. The default password shown in the UI applies only if you leave the local default in use; for this deployment use your chosen Render password.
5. Open `/api/health` and confirm `status: "ok"` and `ledgerMode: "demo"`. Open the QR dialog from a batch and scan it using your phone. QR links use the actual public website address automatically.

The service waits for passing GitHub checks before automatic deployments after later commits. Do not add an uptime-pinging service to bypass free-plan sleeping.

## Manual service settings

If you create a web service without a Blueprint, use the repository root (not `client/` or `server/`):

| Setting | Value |
|---|---|
| Runtime | Node |
| Plan | Free |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm run start:demo` |
| Health check | `/api/health` |
| Node version | 22 |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `TRUST_PROXY_HOPS` | `1` |
| `LEDGER_MODE` | `demo` |
| `DATA_FILE` | `/tmp/agritrace/ledger.json` |
| `JWT_SECRET` | A random secret at least 32 characters long; keep it stable across restarts |
| `DEMO_PASSWORD` | Your chosen classroom demo password |

Render supplies `PORT`; leave it to the platform. The seed command and API use the same `DATA_FILE`. Seeding preserves any nonempty existing demo ledger and refuses to run in Fabric mode. Proxy trust is limited to the configured number of hops so rate limits can distinguish visitors behind Render's proxy.

## Record persistence and free-plan limits

Free Render web services sleep after inactivity and use an ephemeral filesystem. Records you add can disappear after sleeping, restarts or redeployments. Startup automatically recreates the three sample batches when the file is absent. This is suitable for a classroom demonstration with synthetic data, not a permanent shared record system.

If you later choose to pay for persistent demo records, upgrade the web service, attach a disk at `/var/data`, and change `DATA_FILE` to `/var/data/agritrace/ledger.json`. Keep one service instance because the file ledger's write queue coordinates only one process. Update your Blueprint's plan/data-file configuration to match before syncing it again; this repository's default remains free. The existing API and seeder already honor this path. Export any important trace before changing storage: upgrading does not migrate previous temporary records automatically.

For a real Fabric deployment, follow `FABRIC.md`, configure external reachable Fabric endpoints and trusted server identities, use `npm start` rather than `npm run start:demo`, and do not set the service to demo mode. Do not publish gateway ports or private keys just to make a classroom website reachable.

## Before your viva

- Open the deployed URL a few minutes early and sign in; free services can take time to wake.
- Register a fresh batch, transfer it through the accounts, record a hot sensor reading, and show the consumer QR timeline.
- Sign in as regulator, report/resolve an issue or recall a batch, and show the public warning.
- Explain that the hosted demo exercises the same domain rules, but does not demonstrate Fabric consensus. Use your separate local Fabric network only after completing its acceptance checks.
- Keep the local version ready (`npm run build`, then `npm run start:demo`) and keep credentials with your team. Internet access is required for map tiles and public phone QR links.

## Verification

`npm test` covers hosted configuration, seeding to a custom path, preservation across restart, stable JWT sessions and refusal to seed Fabric. After building, `npm run smoke` starts a production-mode server with disposable data and checks the HTML, compiled assets, consumer deep links and API on one port. It does not touch your normal demo ledger. GitHub CI runs both checks.

Sources: [Render Blueprint specification](https://render.com/docs/blueprint-spec), [free-instance limitations](https://render.com/docs/free), and [Express deployment](https://render.com/docs/deploy-node-express-app).
