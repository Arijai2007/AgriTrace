# AgriTrace

**Live demo:** [https://agritrace-5ldg.onrender.com](https://agritrace-5ldg.onrender.com)

**Every harvest has a story.** Farm-to-shelf agricultural traceability with role-controlled custody, cold-chain evidence, consumer QR journeys, and regulator audits.

AgriTrace is an original implementation based on the supplied project synopsis. The three reference repositories informed the review of participant roles, custody and sensor tracking; this is not a renamed pharmaceutical application. See [REFERENCES.md](docs/REFERENCES.md).

## Deploy the college demo

**Recommended: one Render web service for both the website and API.** The included free-plan Blueprint builds the app, loads sample batches on first startup, and provides one HTTPS URL for sign-in and consumer QR links.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Arihant2007/AgriTrace)

Choose a demo password when Render prompts for `DEMO_PASSWORD`; use it for all six demonstration accounts. No wallet key is needed. This deployment runs the explicitly labelled **demo ledger**, not a live Fabric network.

**Free-hosting limitation:** records reset when Render restarts, redeploys or spins down; the sample batches are seeded again. Keep your viva's custom batch flow within one session, open the app beforehand to allow startup, and keep a local copy as a backup. Persistent demo records require a paid disk or a separately configured database. The Blueprint creates no paid resources. See [the full Render deployment guide](docs/DEPLOYMENT.md).

## Run the project

Install **Node.js 22 or 24 LTS**. In this directory:

```sh
npm ci
npm run seed
npm run build
npm start
```

Open **http://127.0.0.1:4000**. Select any demo account and enter **`agritrace-demo`**. The seed is safe to rerun: it does not erase existing records.

For development, use `npm run dev` and open the Vite URL (normally http://127.0.0.1:5173). The API runs on port 4000. Run commands from the repository root; a single root lockfile installs the web, API, and test dependencies without requiring Windows directory links.

### Two explicit ledger modes

| Mode | What runs | What it proves |
|---|---|---|
| `demo` (default) | Local JSON persistence, the same domain rules used by chaincode, JWT accounts | Role/custody workflow, hash-chain consistency, Merkle inclusion, cold-chain exceptions. **Not distributed consensus or independent immutability.** |
| `fabric` | Fabric Gateway, CA-enrolled X.509 identities, Node chaincode, four peer organizations, Raft ordering, CouchDB | Signed transactions and chaincode enforcement on the configured Fabric network. Requires Docker and Fabric binaries. |

The demo is deliberately labelled in the UI. It never silently falls back from Fabric to local records. Demo credentials and seeded names/readings are for classroom use only.

## Included functionality

- Farmer registration: unique batch ID, crop, harvest date, quantity, GPS checkpoint, farm price, organic declaration, and cold-chain limits.
- Custody: current holder alone can transfer to a registered participant, recording received weight, grade, price, location, notes and optional shelf-life date. Weight cannot increase during a handover.
- Cold-chain log: temperature and humidity readings, recorded device IDs, and threshold alerts. Includes one-shot and MQTT sensor simulators.
- Certificates: PDF/image upload to a configured Kubo IPFS node; CID and SHA-256 digest stored in the ledger. Consumer-side file digest checking.
- Public consumer page: QR label, farm origin, recorded checkpoint map, complete event timeline, price history, certificates and recall warnings.
- Regulator workspace: audit register, complaints and resolutions, targeted recalls; recalled batches are blocked from further custody/condition/certificate changes.
- Integrity: canonical SHA-256 event hashing, previous-event links, Merkle roots and per-event inclusion proofs; exported trace data.
- Public anchoring: `BatchAnchor.sol`, compiler/deployment scripts, authorized wallet publishers, immutable versioned commitments, and MetaMask verification/publishing on Sepolia.
- Responsive React interface, PWA manifest, accessible forms/dialogs, API validation, password hashing, expiring JWTs and request rate limits.

The PWA manifest supports a standalone presentation on compatible browsers. There is no offline transaction queue or offline ledger: network connectivity is required.

## Try an end-to-end demonstration

1. Sign in as **Kavita Sharma · Farmer**, register a crop batch and inspect its journey.
2. Transfer it to **Arjun Mehta · Mandi agent** with the received quantity, grade and INR/kg price.
3. Sign out, sign in as Arjun and transfer it to **Ravi Singh · Transporter**.
4. Sign in as Ravi and log a reading. Try 25°C against the default 2–15°C limit: the reading is retained and flagged.
5. Transfer to **Neha Verma · Processor / warehouse**, record packing/storage notes, then transfer to **Aditi Rao · Retailer** with a shelf-life date and price.
6. Open **Batch QR** and follow its public consumer URL. A phone needs a hosted/LAN address it can reach; localhost on a QR refers to the scanning device itself.
7. Sign in as **Vikram Gupta · Regulator** to review a reported issue, resolve it or recall that batch. The public trace now displays the recall.

Seeded batch `AGR-2026-001` is already in Ravi’s custody; `AGR-2026-002` is at the retailer; `AGR-2026-003` has a cold-chain excursion and open complaint.

## External integrations

Copy `.env.example` to `.env` for local configuration. `.env`, keys, enrollment materials, runtime ledgers and generated builds are excluded from Git.

- [Fabric setup and four-organization network](docs/FABRIC.md)
- [Render deployment and viva checklist](docs/DEPLOYMENT.md)
- [IPFS, MQTT, Sepolia and wallet setup](docs/INTEGRATIONS.md)
- [Architecture, scope mapping and limitations](docs/ARCHITECTURE.md)
- [API reference and example requests](docs/API.md)
- [Suggested future additions — not implemented](docs/RECOMMENDATIONS.md)
- [Validation results](docs/VALIDATION.md)

## Checks

```sh
npm test
npm run build
npm run anchor:compile
```

The tests cover domain authorization, invalid input, recalls, certificate metadata, immutable complaint history, event tampering, odd/even Merkle proofs, concurrent writes, public reads, protected mutations, role impersonation and the full API journey. Fabric contract tests use a stub context; they are **not** a substitute for starting peers and checking real endorsements. Solidity is compiled by the suite; live Sepolia deployment is separate.

## Project layout

```text
client/             React/Vite portal and public consumer view
server/             Express API, authentication, demo ledger and Fabric Gateway
chaincode/          Node Fabric contract and shared deterministic domain rules
contracts/          Solidity public snapshot anchor
infra/              Four-org Fabric generator, CA enrollment, deployment and optional services
scripts/            Sensors, MQTT oracle, Solidity compilation/deployment
tests/              Node test-runner domain, contract and HTTP tests
docs/               Setup, API, architecture, validation and recommendations
```

## Prototype boundaries

This is an academic prototype, not a certified food-safety service. Organic declarations and uploaded certificate issuer names are unverified claims; file hashing does not authenticate an issuer. Sensor values can be simulated and are not hardware-attested. Checkpoint lines are not live routes. Price differences are not net profit. Read the limitations in the architecture document before making claims about real-world trust or deployment readiness.

No additional product features have been added beyond the synopsis. Future ideas are listed separately for approval. The supplied four-org Fabric setup has not been executed on a machine with Docker during initial development; IPFS, MQTT and Sepolia must be configured and validated before describing those services as live.
