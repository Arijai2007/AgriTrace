# Validation record

## Locally exercised

- **18 automated tests pass**; the root dependency audit reports **zero known vulnerabilities** at initial delivery. solc's pinned temporary-file dependency is overridden to tmp 0.2.7 to include its upstream security fixes.
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
- EVM execution, MetaMask transactions or a deployed Sepolia anchor. Compilation is tested; no test ETH, wallet secret or deployed address was supplied.
- Physical sensor acquisition or independent attestation of farm/certificate claims.
- Throughput, multi-node fault tolerance, security audit or production deployment.

Do not present a configured adapter, stubbed contract test or successful compiler result as proof that its external network is live. Follow the integration and Fabric acceptance instructions to close those checks.

