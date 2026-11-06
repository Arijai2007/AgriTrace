import { readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { demoAccounts, passwordHash } from '../server/accounts.mjs';
const root=resolve(import.meta.dirname,'identities');
const organizations=['farmers','logistics','retail','regulator'];
const roleOrg={farmer:'farmers',aggregator:'logistics',transporter:'logistics',processor:'logistics',retailer:'retail',regulator:'regulator'};
if (!process.env.FABRIC_APP_PASSWORD || process.env.FABRIC_APP_PASSWORD.length<12) throw new Error('Set FABRIC_APP_PASSWORD (12+ characters) before running setup.');
const accounts=[];
for(const a of demoAccounts){
 const org=roleOrg[a.role],mspId=org[0].toUpperCase()+org.slice(1)+'MSP',base=resolve(root,org,'users',a.id,'msp');
 const keys=await readdir(resolve(base,'keystore'));
 if(keys.length!==1) throw new Error('Expected exactly one enrollment key for '+a.id);
 accounts.push({...a,id:mspId+':'+a.id,...passwordHash(process.env.FABRIC_APP_PASSWORD),fabric:{mspId,certificate:resolve(base,'signcerts/cert.pem'),privateKey:resolve(base,'keystore',keys[0]),tlsCertificate:resolve(root,org,'peer/tls/ca.pem'),endpoint:'localhost:'+(7051+organizations.indexOf(org)*1000),hostAlias:`peer0.${org}.agritrace`,channel:'agritrace',chaincode:'agritrace'}});
}
await writeFile(resolve(root,'accounts.json'),JSON.stringify(accounts,null,2),{mode:0o600});
console.log('Created trusted accounts. Account IDs are MSP:enrollmentID. Keep this file and private keys local.');
