# Validation record

## Live Ethereum validation — 12 November 2026

- The Render service runs `LEDGER_MODE=ethereum` against Sepolia contract `0xA8C778CB9Fedf4e6E70d231e2FA8920DC74adf43`.
- The owner approved using one MetaMask test wallet for all six classroom role logins. Role separation is enforced by the API validator; this is not six independent organizations signing with separate keys.
- The owner approved the first real harvest transaction for `AGR-DEMO-20261112-001`: `0xc8e4220198d572b6b54fb8f1ab83946542d190fbd9cb5c20d13cc6d7ea9dd7c0`, block 12117890.
- The farmer-to-mandi transfer was mined in block 12117898: `0xa32b5f043d85131efaf7ae2d13c299cb5548e0448777f1baeb97be35b52b13f5`. The public trace read the updated holder and passed integrity validation.
- An authenticated transfer request by the former farmer holder was rejected with HTTP 403 before wallet submission.
- Four handovers through farmer, mandi, transporter, warehouse and retailer are confirmed on Sepolia. The retailer holds 99 kg after a recorded 1 kg handling loss. A manually entered simulated reading of 25 C and 94% humidity is preserved with `alert: true`; the retailer complaint is also confirmed. Seven committed snapshots and all seven inclusion proofs were independently checked. Recall and resolution acceptance checks are still awaiting owner wallet approval. No MQTT or physical sensor acquisition is claimed by this test.
- A non-regulator recall request was rejected with HTTP 403. A desktop sidebar scrolling issue discovered during role switching was fixed and the production bundle rebuilt.

## Locally exercised

- **20 automated tests passed in the latest local run**. The local-only Ganache development dependency has legacy transitive security advisories; do not describe the current dependency audit as clean. The pinned solc temporary-file override remains in place.
- React production bundle builds successfully using Vite.
- `BatchAnchor.sol` compiles with solc 0.8.38 using the Paris EVM target.
- Node tests exercise batch registration, authorization, quantity/date/coordinate bounds, CA-derived Fabric roles, registered recipients, custody transfer, cold-chain alerts, certificate metadata validation, final recalls, complaint resolution, immutable event contents, projection tampering, canonical hashes and Merkle inclusion proofs.
- HTTP tests run a complete farmer → mandi → transporter → retailer journey, query the public trace without a login, reject unauthenticated writes and forged recipient roles, recall the batch and block later handovers.
- Persistence tests reload records from disk, reject edited data, and serialize concurrent duplicate registrations.
- Missing IPFS configuration is reported instead of producing invented uploads.
- The four-org generator produces a Compose description and channel configuration with four peers, four CouchDB instances, five Fabric CAs and one orderer.
- Browser checks cover sign-in, dashboard data, batch timeline, verification disclosure and the generated QR dialog. Mobile browser registration and a custody handover were exercised.
- The resulting handover was verified on the public consumer page. The 390px mobile consumer view has no document-level horizontal overflow; the wide batch register scrolls inside its own container.
- Render deployment checks exercise production settings, an external data-file path, safe reseeding, record/session preservation across process restart, and rejection of seeding in Fabric mode. `npm run smoke` also verifies the built frontend, compiled assets, consumer deep links and API on a single production-mode server.
- The refreshed UI was reviewed on desktop and at a 390px viewport: sign-in, real custody counts, mobile navigation, harvest dialog and consumer journey. Self-hosted fonts, decorative route motion, number transitions and dialog entrances are included. CSS and number animations respect the reduced-motion preference; browser emulation of that preference was not performed because access was declined.
- Map requests use the documented OpenStreetMap tile hostname and an origin-preserving referrer policy. The checkpoint map was visually verified loading after the correction, and the production smoke check covers the response policy.

The authoritative commands are `npm test`, `npm run build` and `npm run anchor:compile`. Check the CI run on the repository for the exact committed version's result. Unit and API tests create and remove their own temporary records; they do not clear the demo ledger.

## Not yet validated against live external infrastructure

- Docker/Fabric peer startup, CA enrollment, channel creation, endorsement and network restart. Docker and Fabric CLI were unavailable in the initial development environment.
- Real Kubo pinning/public gateway retrieval and real MQTT broker delivery. Adapters and optional service configuration are supplied; their live services must be started separately.
- The separate `BatchAnchor.sol` public Merkle-anchor contract remains unconfigured. The deployed `AgriTraceLedger` and owner-approved Sepolia transactions are documented above; they are a different architecture from Fabric plus a periodic public anchor.
- Physical sensor acquisition or independent attestation of farm/certificate claims.
- Throughput, multi-node fault tolerance, security audit or production deployment.

Do not present a configured adapter, stubbed contract test or successful compiler result as proof that its external network is live. Follow the integration and Fabric acceptance instructions to close those checks.

