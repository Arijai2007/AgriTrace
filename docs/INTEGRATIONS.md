# IPFS, sensors and the public anchor

## IPFS certificates

Start the optional services with Docker:

```sh
docker compose -f infra/compose.services.yml up -d
```

Set `IPFS_API=http://127.0.0.1:5001` in `.env` and restart the API. Current holders can upload PDF/PNG/JPEG files of up to 5 MB. The API calculates SHA-256 over the original bytes, pins the file using Kubo `/api/v0/add?pin=true&cid-version=1`, then commits the returned CID and digest to the batch. IPFS and ledger writes cannot form one atomic transaction; a failed ledger commit can leave an unreferenced pin.

An IPFS CID and a file SHA-256 digest are **different values**. The CID identifies the IPFS DAG; the digest here checks the original file bytes. Consumer certificate links use `https://ipfs.io/ipfs/<CID>`. A local Kubo node may take time to make its content reachable through a public gateway. For a local-only check, use `http://127.0.0.1:8080/ipfs/<CID>`.

The UI refuses to pretend that a certificate was uploaded when IPFS is unavailable. Uploading to IPFS makes the document potentially public. Use sample documents without private personal data for the prototype. No certificate authority or accreditation database is consulted.

## Sensor simulator

With the API running and seeded batch `AGR-2026-001` in the transporter's custody:

```sh
npm run sensor -- AGR-2026-001
```

This records one simulated reading through the API. It uses `SENSOR_ACCOUNT` and `SENSOR_PASSWORD`; default demo values are `transporter-1` and `agritrace-demo`. In Fabric mode use `LogisticsMSP:transporter-1` and the configured account password.

For the MQTT path, start the supplied broker, then in two terminals:

```sh
# Terminal 1 (Linux/macOS): gateway commits broker readings through the authenticated API.
MQTT_URL=mqtt://127.0.0.1:1883 npm run mqtt:gateway
# Terminal 2: publish one reading.
MQTT_URL=mqtt://127.0.0.1:1883 npm run sensor -- AGR-2026-001
```

PowerShell sets environment variables as `$env:MQTT_URL='mqtt://127.0.0.1:1883'` before running the command. Gateway and sensor scripts read environment variables; to read your root `.env` explicitly use `node --env-file=.env scripts/mqtt-gateway.mjs` or `node --env-file=.env scripts/sensor.mjs AGR-2026-001`.

Messages use `agritrace/sensors/<batchId>`. The gateway rejects mismatched topics/IDs and oversized payloads. Its server identity must currently hold the batch and have a cold-chain role. Bearer tokens are never sent through MQTT. The local broker permits anonymous clients and binds only to loopback; use authenticated TLS and device authorization for real sensors. QoS 1 can deliver duplicate readings; the prototype does not deduplicate device measurements. A rejected reading is logged, not retried indefinitely. Physical sensor signing, calibration and outage buffering are future work.

## Sepolia public anchor

Compile the anchor:

```sh
npm run anchor:compile
```

Deploy `contracts/BatchAnchor.sol` through Remix with MetaMask on **Sepolia**, or use the script after setting a Sepolia RPC endpoint and a **test wallet** key only in your local environment:

```sh
node --env-file=.env scripts/deploy-anchor.mjs
```

The script refuses non-Sepolia chains. It requires test ETH and prints the deployed address. No deployment or wallet transaction is performed automatically by installing or starting AgriTrace. Do not commit wallet keys, mnemonics, RPC provider credentials or `.env`.

Set `ANCHOR_ADDRESS` to the deployed address and restart the API. The deploying address is the initial authorized publisher. The contract owner can call `setPublisher(wallet, true)` to authorize the regulator's wallet. In the **Verification** tab the regulator can anchor the current snapshot via MetaMask; every consumer can query that snapshot using MetaMask on Sepolia. Wallet requests and testnet gas are explicit wallet actions.

The batch key is `ethers.id(batch.id)` (keccak256 of UTF-8 ID). The commitment is the batch's **SHA-256 Merkle root**, encoded as `0x` plus 64 hex characters. Roots are stored by batch key and event count. Event counts must increase and old roots cannot be replaced, including by the owner. Verify only the exact matching event-count snapshot; a new sensor event produces a new root without invalidating an older snapshot's existing commitment.

Anchoring a demo root freezes a commitment to a local snapshot; it does not turn earlier local events into independently verified Fabric transactions. Authorized publishers can still anchor false statements. The contract checks permission and commitment versioning, not agricultural facts or Fabric consensus proofs.
