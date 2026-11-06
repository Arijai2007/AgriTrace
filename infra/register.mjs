import { loadAccounts } from '../server/accounts.mjs';
import { FabricLedger } from '../server/ledger.mjs';
const accounts=await loadAccounts('fabric'), ledger=new FabricLedger(accounts);
for(const account of accounts) { const registered=await ledger.call(account,'RegisterParticipant',[],true); if(registered.id!==account.id || registered.role!==account.role) throw new Error('Account and certificate identity do not match'); console.log('Registered '+registered.id); }
