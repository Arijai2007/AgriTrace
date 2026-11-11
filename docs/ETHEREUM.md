# Real Ethereum mode

This mode stores the full current batch snapshot in a Solidity contract. Earlier snapshots remain in mined transaction input. Each create, transfer, sensor reading, certificate, complaint, resolution and recall requires a transaction from the participant's registered wallet. Preparation and wallet connection alone never save a batch.

## Run locally on Windows

Install Node.js 22 or 24 and the MetaMask browser extension. From this project directory:

```powershell
npm ci
npm run blockchain
```

Keep that terminal open. It starts a real local Ethereum-compatible Ganache node on `127.0.0.1:8545`, chain ID `1337`, deploys AgriTraceLedger, and saves its database and random development identities under `.local`. No sample crops are inserted. Restarting the command reuses the chain and contract.

In a second terminal:

```powershell
npm run build
npm run start:ethereum
```

Open http://127.0.0.1:4000 in the browser containing MetaMask.

1. Open `.local/wallet-import.txt` locally. Import the farmer's **local test private key** into MetaMask using its account import option. These generated test accounts are funded only on your local chain. Do not send real funds to them or use them on public networks.
2. Click **Connect MetaMask**. Approve connection and adding/switching to AgriTrace Local. If adding manually: RPC `http://127.0.0.1:8545`, chain ID `1337`, currency `ETH`.
3. Select the farmer account in AgriTrace and sign in with `agritrace-local`. Set `LOCAL_PASSWORD` before starting the blockchain command to choose a different local password.
4. Register your own batch. Approve the contract transaction in MetaMask. The app waits for mining before showing success.
5. Transfer to the transporter. Approve using the farmer wallet. Import/switch to the transporter's key and sign in as that participant to log a reading or transfer onward.
6. In **Verification**, inspect the contract address, confirmed block and actual transaction hash. Consumer QR reads come from the smart contract. Local transactions do not appear on Etherscan; use the local RPC or MetaMask activity.

Rejecting a wallet request leaves blockchain state unchanged. If a transaction confirms but the app loses connection, refresh and inspect the batch before submitting again. The latest submitted hash is retained in session storage. A concurrent change rejects an older approval; reload and retry.

## Trust and cost

This is a hybrid permissioned application on Ethereum. The API validates the existing agricultural business rules and signs a ten-minute approval bound to the exact record, wallet, chain, contract and previous state. Solidity verifies that approval and enforces version ordering and replay protection. The participant signs the actual transaction with MetaMask; the server does not hold participant keys at runtime. The server validator remains trusted for business correctness. Those rules are not independently enforced in Solidity.

Local Ganache is a real EVM blockchain for development, controlled by its operator. It does not provide independent public validators. Restarting with the same database preserves records; deleting the database destroys the local network. The Ganache development dependency has legacy transitive security advisories and must remain local-only, bound to loopback; it is not part of the hosted production runtime.

Full batch snapshots are public and limited to 64 KiB. Repeated snapshots are expensive on public networks; use small synthetic records on Sepolia. Never enter personal or confidential data. Event `txId` values are application event identifiers; actual Ethereum hashes and blocks are shown separately in Verification.

## Sepolia deployment through MetaMask

Run `npm run setup:sepolia` on your own computer and open the local URL printed by the command in the browser containing MetaMask. This local page compiles the actual ledger contract, connects your wallet, switches to Sepolia and lets you review and approve contract creation. It never requests your wallet private key or recovery phrase.

Use a separate test wallet funded with Sepolia test ETH. The local command generates a separate API validator key under `.local/sepolia/validator.json`; that key is used for server approvals, not wallet gas payments, and must later be configured as a Render secret. Do not delete it after deploying the contract: the contract's validator address is immutable.

After a deployment confirms, the local helper checks the actual transaction input and receipt on Sepolia and saves its public details in `.local/sepolia/deployment.json`. A pending transaction hash is saved in browser local storage so you can use **Check submitted deployment** after a reload. The helper does not itself change Render or bind participant wallets. Those steps follow after a successful deployment.

The local page binds only to `127.0.0.1:4317`, rejects other Host/Origin values, and requires a per-run token for its API. Do not expose this setup server through a public tunnel. If the default public RPC is unavailable, set `ETH_RPC_URL` before running the command.

## Sepolia deployment through a script

Use a separate test wallet funded with Sepolia test ETH. Do not reuse the generated local keys. Compile with `npm run ledger:compile`, then deploy using:

```powershell
node --env-file=.env.sepolia scripts/deploy-ledger.mjs
```

The deployment environment requires `ETH_RPC_URL` (Sepolia HTTPS RPC), `DEPLOYER_PRIVATE_KEY` (test wallet), and `ETH_VALIDATOR_KEY` (separate server approval key). The script checks chain ID 11155111. It prints the contract address and mined deployment transaction.

Configure the server environment with `LEDGER_MODE=ethereum`, `ETH_CHAIN_ID=11155111`, `ETH_RPC_URL`, `ETH_LEDGER_ADDRESS`, `ETH_DEPLOYMENT_BLOCK` (the deployment receipt block), `ETH_VALIDATOR_KEY`, a random `JWT_SECRET` of at least 32 characters and `ACCOUNTS_FILE`. The accounts JSON uses the existing id/name/role/organization fields plus the registered wallet address and password `salt`/`hash` generated with `passwordHash` in `server/accounts.mjs`. Wallet bindings are trusted administrator configuration, never accepted from submitted form data.

Start with `npm start` after setting these environment values; do not use `start:demo` or `start:ethereum` (the latter explicitly loads the generated local environment). Configure the host and proxy settings for the deployment as described in DEPLOYMENT.md. The old Render Blueprint continues to run demo mode until its command and environment are changed. No public deployment happens automatically.

The hosted server must have an RPC capable of reading contract logs from deployment onward. Receipt lookup scans backward in windows of at most 5,000 blocks, starting from the configured deployment block. Larger deployments should use an indexer. If the RPC is unavailable, Ethereum mode fails rather than switching to JSON storage.
