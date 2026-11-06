# REST API

Base URL: `http://127.0.0.1:4000/api`. JSON request/response bodies unless noted. Authenticated routes require `Authorization: Bearer <token>`.

| Method | Route | Access / behavior |
|---|---|---|
| GET | `/health` | Public; ledger mode, IPFS configuration and anchor address |
| GET | `/demo/accounts` | Demo only; public account names/roles, no password hashes |
| POST | `/auth/login` | Account ID + password → two-hour token and public user |
| GET | `/me` | Current authenticated identity |
| GET | `/participants` | Registered recipients from the trusted account directory |
| GET | `/batches` | Authenticated batch register |
| POST | `/batches` | Farmer only; register a batch |
| GET | `/trace/:id` | Public complete batch, integrity result and root |
| GET | `/trace/:id/proof/:eventIndex` | Public event, siblings, root and inclusion result |
| POST | `/batches/:id/transfer` | Current active holder only |
| POST | `/batches/:id/sensor` | Current active cold-chain holder only |
| POST | `/batches/:id/certificates` | Current active holder; multipart file upload to IPFS |
| POST | `/batches/:id/complaint` | Authenticated participant |
| POST | `/batches/:id/resolveComplaint` | Regulator only |
| POST | `/batches/:id/recall` | Regulator only; final recall marker |

## Login

```json
{"id":"farmer-1","password":"agritrace-demo"}
```

In Fabric mode use a configured MSP-prefixed ID, e.g. `FarmersMSP:farmer-1`. A client-provided role is never used to grant permissions.

## Batch registration

```json
{
  "id":"AGR-2026-004",
  "crop":"Tomatoes",
  "quantity":250,
  "price":24,
  "harvestDate":"2026-11-06",
  "organic":true,
  "location":{"name":"Meerut farm","lat":28.9845,"lng":77.7064},
  "limits":{"minTemp":2,"maxTemp":15,"maxHumidity":90}
}
```

Quantities are kilograms, prices are INR/kg, temperatures Celsius and humidity percentage. Batch IDs accept letters, digits and hyphens only. Harvest dates are real dates, not future dates according to the India calendar day (UTC+05:30), calculated deterministically from the transaction timestamp. Maximum batch event count is 5,000. Coordinates are checkpoints supplied by the participant; they are not independently verified GPS observations.

## Handover

```json
{
  "recipientId":"aggregator-1",
  "quantity":248,
  "price":29,
  "grade":"A",
  "note":"Sorted, packed and received at mandi",
  "location":{"name":"Azadpur Mandi","lat":28.7041,"lng":77.1808}
}
```

Optional `shelfLifeDate` is a date on or after the ledger's current India calendar day. The API resolves recipient ID against its trusted accounts; Fabric also resolves it against its participant registry. Client-provided recipient role/name fields cannot change the recipient's chaincode identity. A recipient must be a mandi agent, transporter, processor or retailer. No legal ownership/payment transfer is implied.

## Conditions

```json
{
  "deviceId":"SIM-TRUCK-07",
  "temperature":8.4,
  "humidity":76,
  "location":{"name":"Noida cold storage","lat":28.5355,"lng":77.391}
}
```

Timestamp and submitting actor are taken from the transaction context. Out-of-limit readings are retained and flagged, rather than silently rejected as inconvenient evidence.

## Certificates

`multipart/form-data`: `file` (PDF/PNG/JPEG, max 5 MB), `name`, `type`, `issuer`. The server calculates the digest and obtains the CID from IPFS; clients cannot substitute their own arbitrary digest in this upload endpoint. If IPFS is not configured, the endpoint returns 503 with an explanation.

## Complaints and recall

```json
{"message":"Investigate a temperature excursion"}
```

Resolve a complaint by its ledger transaction ID:

```json
{"id":"complaint-transaction-id","resolution":"Reviewed readings; initiate batch recall"}
```

Recall:

```json
{"reason":"Unsafe storage conditions confirmed"}
```

Successful mutations return the resulting batch. Public trace results explicitly say `ledgerMode: "demo"` or `"fabric"`; `publicAnchor: false` means the API has **not independently checked** an on-chain commitment. The Verification tab queries Sepolia separately when a contract is configured.

## Errors

Errors have the shape `{"error":"explanation"}`. Typical statuses: 400 invalid input or disallowed state, 401 missing/expired sign-in, 403 unauthorized actor, 404 missing batch, 429 request limit, 500 integrity/storage errors, 503 unconfigured IPFS. The server does not print private keys, token values or passwords in responses. Never expose the demo API publicly with default credentials.

