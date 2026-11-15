# AgriTrace

**Every harvest has a story.** Farm-to-shelf agricultural traceability with MetaMask transactions, role-controlled custody, cold-chain records, consumer QR journeys and regulator audits.

**Live website:** [agri-trace-psi.vercel.app](https://agri-trace-psi.vercel.app/)

**Backend:** [Render API health](https://agritrace-5ldg.onrender.com/api/health)

**Repository:** [Arijai2007/AgriTrace](https://github.com/Arijai2007/AgriTrace)

## Live deployment

The React/Vite frontend runs on **Vercel**, and the Express backend runs on **Render**. The frontend forwards `/api/*` requests to Render using the rewrites in `vercel.json`. Authentication, public trace reads and transaction preparation use this API; MetaMask signs blockchain updates.

Vercel is connected to this repository: pushes to `main` automatically build and deploy the frontend. Check the Vercel deployment status before expecting a pushed change to appear on the production URL. Backend code changes require a Render deployment; its repository connection and auto-deploy settings are managed separately.

Keep server secrets, including the API validator key, on Render. The frontend needs no private wallet key. See [Vercel frontend and Render backend setup](docs/VERCEL.md).

The live ledger uses **Ethereum Sepolia**. Contract: [`0xA8C778CB9Fedf4e6E70d231e2FA8920DC74adf43`](https://sepolia.etherscan.io/address/0xA8C778CB9Fedf4e6E70d231e2FA8920DC74adf43). All six classroom role logins are bound to one owner-controlled test wallet. The API validator remains trusted for business-rule approvals; Sepolia validators confirm the transactions. Hosted Sepolia use does not require Ganache. Ganache is available for the local Ethereum workflow in [the Ethereum setup guide](docs/ETHEREUM.md).

Sepolia transactions use test ETH. On-chain records survive application restarts; the free Render backend may take time to wake before the first API request completes.

**Verified classroom batch:** [public batch journey](https://agri-trace-psi.vercel.app/trace/AGR-DEMO-20261112-001) · [verification view](https://agri-trace-psi.vercel.app/trace/AGR-DEMO-20261112-001?view=verification) · [nine Sepolia receipts and inclusion proofs](docs/evidence/sepolia-demo.json). This synthetic batch is intentionally recalled to demonstrate regulator controls. See [validation notes](docs/VALIDATION.md).

## Website navigation

- **Overview:** entrance page with participant sign-in, interactive five-stage custody route and project overview.
- **Batch Journey:** complete public history of the classroom sample batch.
- **Consumer Trace:** public sample trace; the **Consumer portal** opens the batch-ID lookup.
- **Verification:** integrity information for the sample batch.
- **Partner workspace:** sign in using one of the six registered role accounts. Connect MetaMask on Sepolia to submit batch updates.
- **Sign out:** click the profile/name and exit arrow in the workspace header; on mobile, use the initials and exit arrow.

The responsive interface follows the supplied Stitch design, including ivory surfaces, forest-green controls, editorial typography and an agricultural image section. The route shows recorded batch data; its animation is a visual aid, not live GPS or sensor streaming.

## Alternative local demo deployment

The included `render.yaml` is a **file-backed demonstration template**. Do not sync its demo environment settings over the configured live Sepolia backend.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Arijai2007/AgriTrace)

For this alternative deployment, choose a `DEMO_PASSWORD` for the six accounts. Local JSON demo records can reset when ephemeral hosting storage is replaced; this limitation does not apply to the Sepolia contract history. See [the Render demo guide](docs/DEPLOYMENT.md).

## Run the local file-backed demo

Install **Node.js 22 or 24 LTS**. In this directory:

```sh
npm ci
npm run seed
npm run build
npm start
```

Open **http://127.0.0.1:4000**. Select any demo account and enter **`agritrace-demo`**. The seed is safe to rerun: it does not erase existing records.

For development, use `npm run dev` and open the Vite URL (normally http://127.0.0.1:5173). The API runs on port 4000. Run commands from the repository root; a single root lockfile installs the web, API, and test dependencies without requiring Windows directory links.

### Three explicit ledger modes

| Mode | What runs | What it proves |
|---|---|---|
| `demo` (default) | Local JSON persistence, the same domain rules used by chaincode, JWT accounts | Role/custody workflow, hash-chain consistency, Merkle inclusion, cold-chain exceptions. **Not distributed consensus or independent immutability.** |
| `ethereum` | Solidity ledger, registered wallets, MetaMask and an API approval signer | Mined transactions, on-chain event history, wallet authorization and replay protection. Used by the live Sepolia deployment. |
| `fabric` | Fabric Gateway, CA-enrolled X.509 identities, Node chaincode, four peer organizations, Raft ordering, CouchDB | Signed transactions and chaincode enforcement on the configured Fabric network. Requires Docker and Fabric binaries. |

The demo is deliberately labelled in the UI. A blockchain connection failure does not silently switch the app to local records. Demo credentials and seeded names/readings are for classroom use only.

## Included functionality

- Farmer registration: unique batch ID, crop, harvest date, quantity, GPS checkpoint, farm price, organic declaration, and cold-chain limits.
- Custody: current holder alone can transfer to a registered participant, recording received weight, grade, price, location, notes and optional shelf-life date. Weight cannot increase during a handover.
- Cold-chain log: temperature and humidity readings, recorded device IDs, and threshold alerts. Includes one-shot and MQTT sensor simulators.
- Certificates: PDF/image upload to a configured Kubo IPFS node; CID and SHA-256 digest stored in the ledger. Consumer-side file digest checking.
- Public consumer page: QR label, farm origin, recorded checkpoint map, complete event timeline, price history, certificates and recall warnings.
- Regulator workspace: audit register, complaints and resolutions, targeted recalls; recalled batches are blocked from further custody/condition/certificate changes.
- Integrity: canonical SHA-256 event hashing, previous-event links, Merkle roots and per-event inclusion proofs; exported trace data.
- Public anchoring: `BatchAnchor.sol`, compiler/deployment scripts, authorized wallet publishers, immutable versioned commitments, and MetaMask verification/publishing on Sepolia.
- Stitch-styled responsive React interface with interactive custody stages, overview imagery and mobile navigation, PWA manifest, accessible forms/dialogs, API validation, password hashing, expiring JWTs and request rate limits.

The PWA manifest supports a standalone presentation on compatible browsers. There is no offline transaction queue or offline ledger: network connectivity is required.

## Try an end-to-end demonstration

1. Sign in as **Kavita Sharma · Farmer**, register a crop batch and inspect its journey.
2. Transfer it to **Arjun Mehta · Mandi agent** with the received quantity, grade and INR/kg price.
3. Sign out, sign in as Arjun and transfer it to **Ravi Singh · Transporter**.
4. Sign in as Ravi and log a reading. Try 25°C against the default 2–15°C limit: the reading is retained and flagged.
5. Transfer to **Neha Verma · Processor / warehouse**, record packing/storage notes, then transfer to **Aditi Rao · Retailer** with a shelf-life date and price.
6. Open **Batch QR** and follow its public consumer URL. A phone needs a hosted/LAN address it can reach; localhost on a QR refers to the scanning device itself.
7. Sign in as **Vikram Gupta · Regulator** to review a reported issue, resolve it or recall that batch. The public trace now displays the recall.

In the local file-backed demo, seeded batch `AGR-2026-001` is already in Ravi’s custody; `AGR-2026-002` is at the retailer; `AGR-2026-003` has a cold-chain excursion and open complaint.

## External integrations

Copy `.env.example` to `.env` for local configuration. `.env`, keys, enrollment materials, runtime ledgers and generated builds are excluded from Git.

- [Ethereum ledger and MetaMask setup](docs/ETHEREUM.md)
- [Vercel frontend and Render API routing](docs/VERCEL.md)
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
npm run smoke
npm run anchor:compile
```

The tests cover domain authorization, invalid input, recalls, certificate metadata, immutable complaint history, event tampering, odd/even Merkle proofs, concurrent writes, public reads, protected mutations, role impersonation and the full API journey. Fabric contract tests use a stub context; they are **not** a substitute for starting peers and checking real endorsements. Solidity is compiled by the suite; live Sepolia deployment is separate.

## Project layout

```text
client/             React/Vite portal and public consumer view
server/             Express API, authentication, Ethereum ledger, demo ledger and Fabric Gateway
chaincode/          Node Fabric contract and shared deterministic domain rules
contracts/          Solidity Ethereum ledger and public snapshot anchor
infra/              Four-org Fabric generator, CA enrollment, deployment and optional services
scripts/            Sensors, MQTT oracle, Solidity compilation/deployment
tests/              Node test-runner domain, contract and HTTP tests
docs/               Setup, API, architecture, validation and recommendations
vercel.json         Frontend build and Render API rewrites
render.yaml         Alternative file-backed Render demo template
```

## Prototype boundaries

This is an academic prototype, not a certified food-safety service. Organic declarations and uploaded certificate issuer names are unverified claims; file hashing does not authenticate an issuer. Sensor values can be simulated and are not hardware-attested. Checkpoint lines are not live routes. Price differences are not net profit. Read the limitations in the architecture document before making claims about real-world trust or deployment readiness.

The owner confirmed that the live Ethereum Sepolia implementation is the submission scope. Its test transactions are documented in [the validation record](docs/VALIDATION.md). The supplied four-org Fabric setup has not been run on a live network; IPFS and MQTT integrations have not been validated as live services.
