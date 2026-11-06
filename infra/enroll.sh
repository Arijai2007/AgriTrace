#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
command -v fabric-ca-client >/dev/null || { echo 'Install Fabric CA client 1.5.x first'; exit 1; }
mkdir -p infra/identities
organizations=(farmers logistics retail regulator orderer)
for i in "${!organizations[@]}"; do
  org="${organizations[$i]}"; port=$((7054+i*1000)); base="$ROOT/infra/identities/$org"
  export FABRIC_CA_CLIENT_HOME="$base/ca-admin"
  for attempt in {1..30}; do
    if fabric-ca-client enroll -u "http://admin:adminpw@localhost:$port" --caname "ca-$org"; then break; fi
    if [[ "$attempt" == 30 ]]; then exit 1; fi
    sleep 2
  done
  kind=peer; host="peer0.$org.agritrace"; [[ "$org" == orderer ]] && { kind=orderer; host=orderer.agritrace; }
  # Development-only bootstrap secrets; CAs are bound to loopback and are not production CAs.
  fabric-ca-client register --caname "ca-$org" --id.name node --id.secret nodepw --id.type "$kind"
  fabric-ca-client register --caname "ca-$org" --id.name orgadmin --id.secret orgadminpw --id.type admin
  fabric-ca-client enroll -u "http://node:nodepw@localhost:$port" --caname "ca-$org" -M "$base/peer/msp"
  fabric-ca-client enroll -u "http://node:nodepw@localhost:$port" --caname "ca-$org" -M "$base/peer/tls" --enrollment.profile tls --csr.hosts "$host,localhost,127.0.0.1"
  cp "$base/peer/tls/keystore/"* "$base/peer/tls/key.pem"
  cp "$base/peer/tls/tlscacerts/"* "$base/peer/tls/ca.pem"
  fabric-ca-client enroll -u "http://orgadmin:orgadminpw@localhost:$port" --caname "ca-$org" -M "$base/admin/msp"
  # An organization MSP contains the CA trust roots and the Node OU classifications.
  mkdir -p "$base/msp/cacerts" "$base/msp/tlscacerts"
  cp "$base/peer/msp/cacerts/"* "$base/msp/cacerts/ca.pem"
  cp "$base/peer/tls/ca.pem" "$base/msp/tlscacerts/ca.pem"
  cat > "$base/msp/config.yaml" <<'YAML'
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/ca.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/ca.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/ca.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/ca.pem
    OrganizationalUnitIdentifier: orderer
YAML
  for msp in "$base/peer/msp" "$base/admin/msp"; do
    cp "$base/msp/config.yaml" "$msp/config.yaml"
    cp "$base/msp/cacerts/ca.pem" "$msp/cacerts/ca.pem"
  done
done
# Issue six trusted participant identities. Role attributes are included in enrollment certificates.
while IFS='|' read -r org user role display; do
  [[ -z "$org" ]] && continue
  case "$org" in farmers) port=7054;; logistics) port=8054;; retail) port=9054;; regulator) port=10054;; esac
  base="$ROOT/infra/identities/$org"
  export FABRIC_CA_CLIENT_HOME="$base/ca-admin"
  fabric-ca-client register --caname "ca-$org" --id.name "$user" --id.secret userpw --id.type client --id.attrs "role=$role:ecert,displayName=$display:ecert"
  fabric-ca-client enroll -u "http://$user:userpw@localhost:$port" --caname "ca-$org" -M "$base/users/$user/msp" --enrollment.attrs 'role,displayName,hf.EnrollmentID'
  cp "$base/msp/config.yaml" "$base/users/$user/msp/config.yaml"
  cp "$base/msp/cacerts/ca.pem" "$base/users/$user/msp/cacerts/ca.pem"
done <<'USERS'
farmers|farmer-1|farmer|Kavita Sharma
logistics|aggregator-1|aggregator|Arjun Mehta
logistics|transporter-1|transporter|Ravi Singh
logistics|processor-1|processor|Neha Verma
retail|retailer-1|retailer|Aditi Rao
regulator|regulator-1|regulator|Vikram Gupta
USERS
echo 'Enrollment complete. Private identities are ignored by Git.'
