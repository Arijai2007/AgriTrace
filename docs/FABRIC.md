# Four-organization Fabric development network

## Prerequisites

Use Linux or **WSL2 with Docker Desktop integration**, Node 22/24, Docker Compose v2, and the official Fabric **2.5.12** CLI binaries (`peer`, `configtxgen`, `osnadmin`) plus **Fabric CA client 1.5.15** on PATH. Obtain binaries and images using the [official Fabric installation instructions](https://hyperledger-fabric.readthedocs.io/en/release-2.5/install.html). Do not install a second desktop application from a script without reviewing it.

Run the setup on the same Linux host as Docker. Filesystem paths generated here are Linux paths; do not use Windows-generated configuration with Linux CLI binaries. Use an isolated classroom network: the bootstrap CA secrets and CouchDB passwords in these scripts are intentionally development values.

## Topology

| Organization | MSP | API / peer port | Participants |
|---|---|---|---|
| Farmers | FarmersMSP | localhost:7051 | Farmer |
| Logistics | LogisticsMSP | localhost:8051 | Mandi agent, transporter, processor / warehouse |
| Retail | RetailMSP | localhost:9051 | Retailer |
| Regulator | RegulatorMSP | localhost:10051 | Regulator |

Each organization has one peer, one CouchDB instance and its own Fabric CA. A separate ordering organization has its CA and a single Raft orderer. This demonstrates Raft ordering but provides **no orderer fault tolerance**: a production Raft cluster needs multiple orderers. Channel policies require a majority of the four organizations to endorse transactions and lifecycle operations.

Peer/orderer TLS is enabled. The root CAs' HTTP enrollment endpoints bind to loopback and are for isolated development only. Use TLS-enabled CAs and separate protected operators in any deployment beyond this local prototype. The enrollment secrets and database passwords must then be replaced.

## First start

From the repository root in WSL/Linux:

```sh
npm ci
export FABRIC_CONFIG_DIR=/absolute/path/to/fabric-samples/config
export FABRIC_APP_PASSWORD='choose-a-unique-password-at-least-12-characters'
bash infra/network.sh up
```

`FABRIC_CONFIG_DIR` must contain `core.yaml` supplied with the Fabric binaries. The script generates the Compose and channel configuration, starts five local CAs, enrolls node/admin/user identities, starts four peers and the orderer, creates the `agritrace` channel and installs/approves/commits the chaincode. Chaincode is built in Fabric's Node builder image using `chaincode/package-lock.json`.

Generated keys, CA admin material, organization wallets and accounts live under `infra/identities/` and are excluded from Git. Never publish them.

Create a root `.env`:

```dotenv
LEDGER_MODE=fabric
HOST=127.0.0.1
PORT=4000
JWT_SECRET=choose-a-random-secret-with-at-least-32-characters
ACCOUNTS_FILE=./infra/identities/accounts.json
```

Register the CA-bound participants with the chaincode:

```sh
node --env-file=.env infra/register.mjs
npm run build
npm start
```

Sign in using the generated account IDs (for example **`FarmersMSP:farmer-1`**) and your `FABRIC_APP_PASSWORD`. The demo account selector and `/api/demo/accounts` are disabled in Fabric mode. The UI participants screen gets its public account list from the trusted account file; self-registration into the chaincode derives the role/name from the enrollment certificate rather than user JSON.

`infra/accounts.mjs` hashes the application password with a per-account scrypt salt and records absolute key/certificate paths. The API signs each transaction using the **logged-in participant's** enrolled private key, not one shared all-powerful blockchain identity. CA enrollment secrets are separate from API passwords. This is a server-held wallet prototype, not browser-side client signing.

## Stop and restart

```sh
bash infra/network.sh stop
bash infra/network.sh up
```

Stop preserves Docker volumes, ledger state and identities. A successful deployment writes `infra/generated/deployed`; later `up` commands restart containers without creating a new channel.

For a failed first setup, the script stops when it detects partial identity material instead of silently overwriting it. Inspect container logs and the last successful command. Resume the remaining commands from `infra/network.sh` manually. CA registration and channel join steps are not automatically retried across separate script invocations. Do not delete identities while retaining CA/peer volumes: their trust roots must remain aligned.

## Acceptance check on a Docker-capable host

1. Run `docker compose -f infra/generated/compose.json --profile network --profile ca ps`; verify all four peers, four CouchDB instances, five CAs and the orderer are running.
2. Register all six participants; verify certificate-derived IDs match `accounts.json`.
3. Complete the README's farmer → mandi → transporter → warehouse → retailer flow.
4. Submit a transfer as the old holder and verify chaincode rejection.
5. Record out-of-range sensor readings, issue a regulator recall, and confirm the public trace shows both.
6. Restart the network and confirm records persist.
7. Stop an organization and check whether the configured majority endorsement policy still permits writes. Stop two and verify loss of quorum.

The development machine used for initial delivery did not have Docker or the Fabric CLI. Network generation and chaincode behavior were tested locally; **peer startup, CA enrollment, channel creation and endorsement across the generated network remain unverified**. Run this acceptance checklist before presenting a live Fabric demonstration.
