import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export const orgs = ['farmers', 'logistics', 'retail', 'regulator'];
const root = resolve(import.meta.dirname), generated = resolve(root, 'generated');
await mkdir(generated, { recursive: true });
const services = {}, volumes = {};
for (const [i, org] of [...orgs, 'orderer'].entries()) {
  services[`ca-${org}`] = { image: 'hyperledger/fabric-ca:1.5.15', profiles: ['ca'], environment: { FABRIC_CA_HOME: '/etc/hyperledger/fabric-ca-server', FABRIC_CA_SERVER_CA_NAME: `ca-${org}`, FABRIC_CA_SERVER_PORT: '7054' }, command: 'sh -c "fabric-ca-server start -b admin:adminpw"', ports: [`127.0.0.1:${7054 + i * 1000}:7054`], volumes: [`ca-${org}:/etc/hyperledger/fabric-ca-server`], networks: ['fabric'] };
  volumes[`ca-${org}`] = {};
}
for (const [i, org] of orgs.entries()) {
  const mspId = org[0].toUpperCase() + org.slice(1) + 'MSP', host = `peer0.${org}.agritrace`;
  services[`couchdb-${org}`] = { image: 'couchdb:3.4.2', profiles: ['network'], environment: { COUCHDB_USER: 'admin', COUCHDB_PASSWORD: 'agritrace-dev-only' }, volumes: [`couchdb-${org}:/opt/couchdb/data`], networks: ['fabric'] };
  volumes[`couchdb-${org}`] = {}; volumes[`peer-${org}`] = {};
  services[host] = { image: 'hyperledger/fabric-peer:2.5.12', profiles: ['network'], hostname: host, environment: {
    CORE_PEER_ID: host, CORE_PEER_ADDRESS: `${host}:7051`, CORE_PEER_LISTENADDRESS: '0.0.0.0:7051', CORE_PEER_CHAINCODEADDRESS: `${host}:7052`, CORE_PEER_CHAINCODELISTENADDRESS: '0.0.0.0:7052', CORE_PEER_LOCALMSPID: mspId, CORE_PEER_MSPCONFIGPATH: '/etc/hyperledger/fabric/msp',
    CORE_PEER_TLS_ENABLED: 'true', CORE_PEER_TLS_CERT_FILE: '/etc/hyperledger/fabric/tls/signcerts/cert.pem', CORE_PEER_TLS_KEY_FILE: '/etc/hyperledger/fabric/tls/key.pem', CORE_PEER_TLS_ROOTCERT_FILE: '/etc/hyperledger/fabric/tls/ca.pem', CORE_PEER_GOSSIP_EXTERNALENDPOINT: `${host}:7051`, CORE_PEER_GOSSIP_USELEADERELECTION: 'true', CORE_PEER_GOSSIP_ORGLEADER: 'false',
    CORE_LEDGER_STATE_STATEDATABASE: 'CouchDB', CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS: `couchdb-${org}:5984`, CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME: 'admin', CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD: 'agritrace-dev-only', CORE_VM_ENDPOINT: 'unix:///host/var/run/docker.sock', CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE: 'agritrace_net', FABRIC_LOGGING_SPEC: 'INFO'
  }, ports: [`127.0.0.1:${7051 + i * 1000}:7051`], volumes: [`../identities/${org}/peer/msp:/etc/hyperledger/fabric/msp:ro`, `../identities/${org}/peer/tls:/etc/hyperledger/fabric/tls:ro`, '/var/run/docker.sock:/host/var/run/docker.sock', `peer-${org}:/var/hyperledger/production`], depends_on: [`couchdb-${org}`], networks: ['fabric'] };
}
services['orderer.agritrace'] = { image: 'hyperledger/fabric-orderer:2.5.12', profiles: ['network'], hostname: 'orderer.agritrace', environment: {
  ORDERER_GENERAL_LISTENADDRESS: '0.0.0.0', ORDERER_GENERAL_LISTENPORT: '7050', ORDERER_GENERAL_LOCALMSPID: 'OrdererMSP', ORDERER_GENERAL_LOCALMSPDIR: '/var/hyperledger/orderer/msp', ORDERER_GENERAL_BOOTSTRAPMETHOD: 'none', ORDERER_CHANNELPARTICIPATION_ENABLED: 'true',
  ORDERER_GENERAL_TLS_ENABLED: 'true', ORDERER_GENERAL_TLS_PRIVATEKEY: '/var/hyperledger/orderer/tls/key.pem', ORDERER_GENERAL_TLS_CERTIFICATE: '/var/hyperledger/orderer/tls/signcerts/cert.pem', ORDERER_GENERAL_TLS_ROOTCAS: '[/var/hyperledger/orderer/tls/ca.pem]',
  ORDERER_ADMIN_LISTENADDRESS: '0.0.0.0:7053', ORDERER_ADMIN_TLS_ENABLED: 'true', ORDERER_ADMIN_TLS_CERTIFICATE: '/var/hyperledger/orderer/tls/signcerts/cert.pem', ORDERER_ADMIN_TLS_PRIVATEKEY: '/var/hyperledger/orderer/tls/key.pem', ORDERER_ADMIN_TLS_CLIENTAUTHREQUIRED: 'true', ORDERER_ADMIN_TLS_CLIENTROOTCAS: '[/var/hyperledger/orderer/tls/ca.pem]', FABRIC_LOGGING_SPEC: 'INFO'
}, ports: ['127.0.0.1:7050:7050', '127.0.0.1:7053:7053'], volumes: ['../identities/orderer/peer/msp:/var/hyperledger/orderer/msp:ro', '../identities/orderer/peer/tls:/var/hyperledger/orderer/tls:ro', 'orderer-data:/var/hyperledger/production/orderer'], networks: ['fabric'] };
volumes['orderer-data'] = {};
await writeFile(resolve(generated, 'compose.json'), JSON.stringify({ name: 'agritrace-fabric', services, volumes, networks: { fabric: { name: 'agritrace_net' } } }, null, 2));
const signature = rule => ({ Type: 'Signature', Rule: rule }), meta = rule => ({ Type: 'ImplicitMeta', Rule: rule });
const organization = (org, orderer = false) => {
  const id = org[0].toUpperCase() + org.slice(1) + 'MSP';
  return { Name: id, ID: id, MSPDir: resolve(root, `identities/${org}/msp`), Policies: { Readers: signature(orderer ? `OR('${id}.member')` : `OR('${id}.admin', '${id}.peer', '${id}.client')`), Writers: signature(orderer ? `OR('${id}.member')` : `OR('${id}.admin', '${id}.client')`), Admins: signature(`OR('${id}.admin')`), Endorsement: signature(`OR('${id}.peer')`) }, ...(orderer ? {} : { AnchorPeers: [{ Host: `peer0.${org}.agritrace`, Port: 7051 }] }) };
};
const channelPolicies = { Readers: meta('ANY Readers'), Writers: meta('ANY Writers'), Admins: meta('MAJORITY Admins') };
const tlsCert = resolve(root, 'identities/orderer/peer/tls/signcerts/cert.pem');
const profile = { Policies: channelPolicies, Capabilities: { V2_0: true }, Orderer: { OrdererType: 'etcdraft', Addresses: ['orderer.agritrace:7050'], EtcdRaft: { Consenters: [{ Host: 'orderer.agritrace', Port: 7050, ClientTLSCert: tlsCert, ServerTLSCert: tlsCert }] }, BatchTimeout: '2s', BatchSize: { MaxMessageCount: 10, AbsoluteMaxBytes: '99 MB', PreferredMaxBytes: '512 KB' }, Organizations: [organization('orderer', true)], Policies: { ...channelPolicies, BlockValidation: meta('ANY Writers') }, Capabilities: { V2_0: true } }, Application: { Organizations: orgs.map(org => organization(org)), Policies: { ...channelPolicies, LifecycleEndorsement: meta('MAJORITY Endorsement'), Endorsement: meta('MAJORITY Endorsement') }, Capabilities: { V2_0: true } } };
await writeFile(resolve(generated, 'configtx.yaml'), JSON.stringify({ Profiles: { AgriTrace: profile } }, null, 2));
console.log('Generated four-organization Fabric development network and channel configuration.');
