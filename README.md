# AgriTrace

AgriTrace tracks agricultural batches from farm to shelf. Supply-chain partners record custody handovers and cold-chain readings, consumers follow a public QR trace, and regulators review complaints and issue recalls.

[Project workflow and quick start](WORKFLOW.md)

## Live deployment

[Open AgriTrace on Vercel](https://agri-trace-psi.vercel.app/) · [Check the Render API](https://agritrace-5ldg.onrender.com/api/health) · [View the Sepolia ledger contract](https://sepolia.etherscan.io/address/0xA8C778CB9Fedf4e6E70d231e2FA8920DC74adf43)

The React frontend runs on Vercel and forwards API requests to the Express service on Render. The API reads batch records from Ethereum Sepolia and signs approvals for updates. The participant confirms each transaction in MetaMask, and Sepolia validators confirm it on-chain.

The synthetic classroom batch includes four handovers, a simulated temperature excursion, a complaint, a recall and a complaint resolution. Anyone can open the [public batch journey](https://agri-trace-psi.vercel.app/trace?batch=sepolia-sample) and its [verification view](https://agri-trace-psi.vercel.app/trace?batch=sepolia-sample&view=verification). The [validation record](docs/VALIDATION.md) and [nine transaction receipts and inclusion proofs](docs/evidence/sepolia-demo.json) document the verified workflow.

To submit updates on the hosted site, sign in with a registered participant account. Enable test networks in MetaMask, select **Ethereum Sepolia** (chain ID `11155111`), and use **Connect MetaMask** with the wallet registered to that account. The six classroom roles share one owner-controlled test wallet. Sepolia test ETH pays for transactions. Public trace readers can use the site without a wallet. [MetaMask test network instructions](https://support.metamask.io/configure/networks/how-to-view-testnets-in-metamask)

The free Render API can take time to wake. Sepolia records are stored on-chain and survive application restarts.

## Transaction details, performance and integrity check

- **Transaction status:** a wallet update opens a status panel showing approval, pending confirmation, confirmation, rejection or revert. Expand it for the actual transaction hash, block, gas used, fee and explorer link. A receipt-check interruption stays pending until checked again; a rejected wallet prompt is not a blockchain transaction.
- **Performance:** sign in and open **Performance**, or open the public batch's **Performance** tab. The dashboard groups gas usage and observed confirmation times by operation and exports the measurements as JSON. Use **Inspect receipt** to look up an older AgriTrace hash; the lookup reads the configured chain and checks the destination contract.
- **Tamper detection:** open a batch's **Verification** tab and find **Change a copy. Check the proof.** Select an event, simulate an edit or import edited JSON, then restore the original. The browser checks a SHA-256 Merkle proof against the loaded batch root. An uploaded root cannot replace that reference, and the demonstration never writes to the ledger.

Try the [sample batch performance view](https://agri-trace-psi.vercel.app/trace?batch=sepolia-sample&view=performance). To inspect an existing receipt without submitting a transaction, use `0x871495a10d77a1770b1ff3d281e1c7679e12026cadca45f8c13eca769828884d` from the classroom demonstration.

Measurements are stored in this browser, scoped to the chain and contract, with at most 100 attempts retained. Confirmation time is measured from the wallet returning a hash until the active tab observes a mined receipt; it includes RPC/polling delay and excludes time spent approving in MetaMask. Imported or recovered receipts show **Not measured** for historical timing. Gas fees are calculated from receipt gas used and effective gas price; recorded reverted transactions can still incur fees. These samples are not a network throughput benchmark.

## Ledger modes

| `LEDGER_MODE` | Storage and authorization | Use |
| --- | --- | --- |
| `demo` (default) | Local JSON file, app sign-in and the same domain rules used by Fabric chaincode. Integrity checks cover event hashes and Merkle proofs. | Local practice with sample data or a separate Render deployment with a file ledger. A local administrator controls the file. |
| `ethereum` | Solidity ledger on the configured EVM network. The API approves writes and the registered participant wallet submits each transaction. | Local Ethereum development on Ganache, or the hosted application on Sepolia. |
| `fabric` | Hyperledger Fabric Gateway and Node chaincode. The API uses the signed-in participant's enrolled X.509 identity. | Four-organization Fabric development network with its own setup and accounts. |

Open `/api/health` to check the active mode. The response includes the configured chain ID and contract address in Ethereum mode.

## Local setup

Install **Node.js 22.12 or later in the 22.x series, or Node.js 24**. From the repository root, install dependencies using the root lockfile. This installs the React frontend, Express API and development tooling together. Stop the current local API before switching modes so the next one can use port 4000.

```sh
npm ci
```

### Local file ledger

The commands below use the default file ledger and ports. For custom local settings, use [`.env.example`](.env.example) as the template for a root `.env` and set `LEDGER_MODE=demo`. If you override `DATA_FILE`, use the same path when seeding and running the API.

For development, seed the sample batches and start both processes.

```sh
npm run seed
npm run dev
```

Open the Vite URL printed in the terminal, normally [http://127.0.0.1:5173](http://127.0.0.1:5173). The [Express API health endpoint](http://127.0.0.1:4000/api/health) runs on port 4000, and Vite proxies `/api` requests there.

If Node's file watcher fails with `EMFILE`, run `npm start` in one terminal and `npm --prefix client run dev` in another. Run both commands from the repository root and restart the API after server changes.

To try the built application with one local server, run the following from the repository root and open [http://127.0.0.1:4000](http://127.0.0.1:4000).

```sh
npm run build
npm run start:demo
```

Select a classroom account and sign in with the built-in classroom password `agritrace-demo`, or the `DEMO_PASSWORD` you configured locally. The seed commands preserve a ledger that already contains batches. On an initial seed, `AGR-2026-001` is with the transporter, `AGR-2026-002` is with the retailer, and `AGR-2026-003` has a temperature alert and an open complaint.

### Local Ethereum with Ganache

Install the MetaMask browser extension. After `npm ci`, start the local chain from the repository root.

```sh
npm run blockchain
```

Keep this terminal open. The script starts Ganache on `http://127.0.0.1:8545` (chain ID `1337`), deploys or reuses the local Solidity ledger, and generates `.env.ethereum.local` and test accounts under `.local/`. Start the API and Vite frontend in a second terminal at the repository root.

```sh
npm run dev:ethereum
```

Open the Vite URL printed in the terminal. To serve a built frontend from Express, use `npm run build` followed by `npm run start:ethereum` in the second terminal and open [http://127.0.0.1:4000](http://127.0.0.1:4000).

1. Import the farmer's generated test account into MetaMask using the local `.local/wallet-import.txt` file. Keep the generated keys on your machine and use them only with this local chain.
2. Select **Connect MetaMask** and approve the connection and network switch. For manual setup, use network name **AgriTrace Local**, RPC URL `http://127.0.0.1:8545`, chain ID `1337`, and currency symbol `ETH`.
3. Sign in as the farmer with the built-in local password `agritrace-local`, or the `LOCAL_PASSWORD` you set before starting Ganache. Register a new batch, approve the transaction and wait for confirmation.
4. To act as a different participant, sign in as that role and switch MetaMask to its generated account before sending an update.

A new Ganache ledger starts empty. Open `/trace` on the frontend you started and enter the ID of a batch you created. The landing-page Ethereum labels and sample shortcuts refer to Sepolia. Check the wallet panel or `/api/health` to confirm the active local network. See the [Ethereum setup guide](docs/ETHEREUM.md) for local persistence, contract deployment and the wallet approval model.

### Hyperledger Fabric

The development network uses Docker Compose, Fabric CLI and CA tools, four peer organizations, CouchDB, and a single Raft orderer. Follow the [Fabric setup and acceptance checklist](docs/FABRIC.md) to enroll identities, deploy chaincode, configure `LEDGER_MODE=fabric`, and register participants. Sign in with the generated Fabric account IDs and the application password set with `FABRIC_APP_PASSWORD`. The automated suite exercises chaincode with stub contexts. Peer startup and real network endorsements still require the acceptance check.

## Try a custody journey

1. Sign in as **Kavita Sharma** (farmer), register a synthetic crop batch and transfer it to **Arjun Mehta** (mandi agent). Enter the received quantity, grade and price.
2. Sign in as Arjun and transfer to **Ravi Singh** (transporter). Sign in as Ravi and log a reading of 25°C against the default 2–15°C range to flag an excursion.
3. Transfer to **Neha Verma** (processor / warehouse). Sign in as Neha and transfer to **Aditi Rao** (retailer). Add any handling notes and the retailer's shelf-life date during the handovers.
4. Open **Batch QR** and follow the public link. Use **Consumer portal** to look up a batch by ID, and **Verification** to inspect the record. A phone needs a hosted or reachable LAN URL to open a QR link.
5. Report an issue as a participant with access to the batch. Sign in as **Vikram Gupta** (regulator) to review the complaint, record a resolution or recall the batch. The public trace displays the recall warning.

Use the profile button in the desktop sidebar or the sign-out icon in the mobile header to change users. In Ethereum mode, confirm each write in MetaMask with the wallet bound to the signed-in role.

## Deploy the application

### Hosted Sepolia application

1. **Vercel frontend.** Import the repository with its root as the project root and `main` as the production branch. [`vercel.json`](vercel.json) selects Vite, runs `npm ci --include=dev` and `npm run build`, serves `client/dist`, and handles direct visits to `/trace` and batch URLs. Its API rewrite points to the existing Render API. A separate installation must point the rewrite to its own backend. [Vercel setup guide](docs/VERCEL.md)
2. **Render API.** Use a Node web service with the repository root, build command `npm ci --include=dev && npm run build`, start command `npm start`, and health check `/api/health`. Keep `LEDGER_MODE=ethereum`, chain ID `11155111`, the existing contract address and deployment block, and the configured RPC and account file for the live service. Keep the API validator key, JWT secret and other backend secrets on Render. [Sepolia server configuration](docs/ETHEREUM.md#sepolia-deployment-through-a-script)
3. **Verify routing.** Open the Vercel site's `/api/health` and confirm `ledgerMode` is `ethereum` and `ethereum.chainId` is `11155111`. Open the public batch link directly and check its trace. Vercel and Render manage branch connections and automatic deployments separately.

### Separate Render deployment with a file ledger

The [`render.yaml` Blueprint](render.yaml) starts a separate free Node service with `LEDGER_MODE=demo` and `npm run start:demo`. It serves the built React frontend and API on one URL. Use this Blueprint only for a separate practice service. Choose a `DEMO_PASSWORD`, then confirm the new service reports `ledgerMode: "demo"` at `/api/health`. The local ledger file is written to ephemeral storage and can reset after sleep, restart or redeploy. [Render setup guide](docs/DEPLOYMENT.md)

## Tests and build

Run these checks from the repository root after installing dependencies.

```sh
npm test
npm run build
npm run smoke
npm run anchor:compile
```

The tests cover domain rules, custody and recalls, Merkle proofs, API authorization, file persistence, Fabric chaincode with stub identities, and mined Ethereum transactions on a local test chain. The Vite build writes to `client/dist`. Run smoke after building. It uses a disposable local ledger to check the production server, compiled assets, public trace routes and API. The anchor compilation checks the separate `BatchAnchor.sol` contract.

## Features and scope

- **Batch and custody records** capture farm origin, declared organic status, checkpoint coordinates, quantity, grade, notes, shelf life and prices. Only the current holder can transfer custody, and the received quantity cannot exceed the prior quantity.
- **Cold-chain monitoring** records device IDs, temperature and humidity, and flags threshold breaches. Sensor simulators and an MQTT adapter are included.
- **Public trace and integrity** include a QR link, checkpoint map, event timeline, price history, certificate records, recall status, trace exports, event hashes and Merkle inclusion proofs.
- **Certificates and anchoring** are optional integrations. A configured Kubo IPFS node accepts PDF, PNG and JPEG certificate uploads. The ledger stores the CID and SHA-256 digest, which consumers can use to check a file. In local file or Fabric mode, the separate `BatchAnchor.sol` integration can publish a batch snapshot commitment to Sepolia when configured. The hosted Ethereum ledger uses `AgriTraceLedger.sol` for its batch records.
- **Regulator tools** cover audit review, complaint resolution and recalls. A recall blocks further custody, condition and certificate updates.

The hosted Sepolia classroom workflow is the validated submission scope. AgriTrace is an academic prototype. Checkpoint maps show recorded locations, certificate issuers and organic declarations are unverified, and sensor readings can be simulated. Live Kubo and MQTT services, physical sensor attestation and the four-organization Fabric network remain outside the recorded live validation. The PWA manifest supports standalone display on compatible browsers. The app requires access to its API and ledger.

## Repository guide

| Path | Contents |
| --- | --- |
| [`client/`](client/) | React/Vite frontend and consumer trace |
| [`server/`](server/) | Express API, authentication and ledger adapters |
| [`chaincode/`](chaincode/) | Fabric contract and shared domain rules |
| [`contracts/`](contracts/) | Solidity ledger and snapshot anchor |
| [`infra/`](infra/) | Fabric network generation, enrollment and optional services |
| [`scripts/`](scripts/) | Local blockchain, contract tools and sensor simulators |
| [`tests/`](tests/) | Domain, contract and HTTP tests |

See the [architecture and limitations](docs/ARCHITECTURE.md), [API reference](docs/API.md), [optional integrations](docs/INTEGRATIONS.md), and [future work](docs/RECOMMENDATIONS.md).
