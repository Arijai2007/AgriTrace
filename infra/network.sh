#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
export FABRIC_CFG_PATH="$ROOT/infra/generated"
compose=(docker compose -f "$ROOT/infra/generated/compose.json")
for tool in docker peer configtxgen osnadmin fabric-ca-client node; do command -v "$tool" >/dev/null || { echo "Missing prerequisite: $tool"; exit 1; }; done
node infra/generate.mjs
case "${1:-up}" in
  stop) "${compose[@]}" --profile network --profile ca stop; exit 0;;
  up) ;;
  *) echo 'Usage: bash infra/network.sh [up|stop]'; exit 1;;
esac
if [[ -f infra/generated/deployed ]]; then
  "${compose[@]}" --profile network --profile ca up -d
  echo 'Existing network restarted; identities and channel state preserved.'
  exit 0
fi
if [[ -d infra/identities/farmers ]]; then
  echo 'Partial setup detected. Inspect the logs and resume individual steps in docs/FABRIC.md; identities were preserved.'
  exit 1
fi
"${compose[@]}" --profile ca up -d
bash infra/enroll.sh
# configtxgen needs the peer and orderer certificates generated above.
configtxgen -profile AgriTrace -outputBlock "$ROOT/infra/generated/agritrace.block" -channelID agritrace
"${compose[@]}" --profile network up -d
ORDERER_TLS="$ROOT/infra/identities/orderer/peer/tls"
for attempt in {1..30}; do
  if osnadmin channel join --channelID agritrace --config-block "$ROOT/infra/generated/agritrace.block" -o localhost:7053 --ca-file "$ORDERER_TLS/ca.pem" --client-cert "$ORDERER_TLS/signcerts/cert.pem" --client-key "$ORDERER_TLS/key.pem"; then break; fi
  [[ "$attempt" == 30 ]] && exit 1
  sleep 2
done
orgs=(farmers logistics retail regulator)
peer_env() {
  local i="$1" org="${orgs[$1]}"
  export CORE_PEER_LOCALMSPID="${org^}MSP" CORE_PEER_ADDRESS="localhost:$((7051+i*1000))"
  export CORE_PEER_MSPCONFIGPATH="$ROOT/infra/identities/$org/admin/msp"
  export CORE_PEER_TLS_ENABLED=true CORE_PEER_TLS_ROOTCERT_FILE="$ROOT/infra/identities/$org/peer/tls/ca.pem"
  export CORE_PEER_TLS_SERVERHOSTOVERRIDE="peer0.$org.agritrace"
  # Host CLI commands use the standard core.yaml from the installed Fabric distribution.
  export FABRIC_CFG_PATH="${FABRIC_CONFIG_DIR:?Set FABRIC_CONFIG_DIR to the directory containing Fabric core.yaml}"
}
for i in "${!orgs[@]}"; do
  peer_env "$i"
  for attempt in {1..30}; do
    if peer channel join -b "$ROOT/infra/generated/agritrace.block"; then break; fi
    [[ "$attempt" == 30 ]] && exit 1
    sleep 2
  done
done
peer lifecycle chaincode package infra/generated/agritrace.tar.gz --path "$ROOT/chaincode" --lang node --label agritrace_1
package_id="$(peer lifecycle chaincode calculatepackageid infra/generated/agritrace.tar.gz)"
for i in "${!orgs[@]}"; do
  peer_env "$i"
  peer lifecycle chaincode install infra/generated/agritrace.tar.gz
  peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.agritrace --tls --cafile "$ORDERER_TLS/ca.pem" --channelID agritrace --name agritrace --version 1.0 --package-id "$package_id" --sequence 1
done
peer_env 0
peer_args=()
for i in "${!orgs[@]}"; do peer_args+=(--peerAddresses "localhost:$((7051+i*1000))" --tlsRootCertFiles "$ROOT/infra/identities/${orgs[$i]}/peer/tls/ca.pem"); done
# All peer TLS certificates include localhost; every organization endorses the definition.
unset CORE_PEER_TLS_SERVERHOSTOVERRIDE
peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.agritrace --tls --cafile "$ORDERER_TLS/ca.pem" --channelID agritrace --name agritrace --version 1.0 --sequence 1 "${peer_args[@]}"
touch infra/generated/deployed
node infra/accounts.mjs
echo 'Four-org network deployed. Register participants: node --env-file=.env infra/register.mjs'
