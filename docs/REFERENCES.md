# Reference review and attribution

The user supplied these repositories as examples. AgriTrace's application, domain logic, chaincode and anchor contract were written independently for agricultural produce. No source files, images, branding, datasets, compiled artifacts, private keys or sample wallets were copied from the reference projects.

| Reference | Reviewed material | Design lesson |
|---|---|---|
| [faizack/Supply-Chain-Blockchain](https://github.com/faizack/Supply-Chain-Blockchain) | README and `backend/contracts/SupplyChain.sol` | Participant roles, product stages and QR-based tracking. A pharmaceutical/Ethereum lifecycle does not implement the synopsis's Fabric architecture. |
| [aniru-dh21/Blockchain-Based-Supply-Chain](https://github.com/aniru-dh21/Blockchain-Based-Supply-Chain) | README and `contracts/SupplyChain.sol` | Role assignment and staged pharmaceutical distribution. AgriTrace uses identity-bound current custody instead of checking membership in a role alone. |
| [apaonessaa/Blockchain4Supplychain](https://github.com/apaonessaa/Blockchain4Supplychain) | README, `contracts/Actors.sol` and `contracts/Asset.sol` | The distinction between legal ownership and physical custody, plus temperature/GPS evidence. AgriTrace implements physical custody; it does not assert legal title or make ETH payments for produce. |

Implementation references:

- [Fabric test network](https://hyperledger-fabric.readthedocs.io/en/release-2.5/test_network.html): educational Raft/peer setup and its production limitations.
- [Fabric Gateway application tutorial](https://hyperledger-fabric.readthedocs.io/en/release-2.5/write_first_app.html): Node Gateway identities, TLS and transaction submission.
- [Kubo HTTP RPC](https://docs.ipfs.tech/reference/kubo/rpc/#api-v0-add): content upload and pinning.

The provided project synopsis defined functional requirements. Its author names, enrollment numbers and institutional submission metadata are not included in the code or repository.
