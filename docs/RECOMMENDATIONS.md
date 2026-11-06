# Possible additions for approval

These are recommendations only. They were not added to the application without approval.

1. **Lot splitting and merging with genealogy.** Track links between parent and child batches, conserve weights, and propagate recalls through all descendants. This would make mandi and processing workflows more realistic.
2. **Two-party handover acceptance.** Let the sender propose and the receiver confirm weight, quality and price before custody changes. This reduces mistaken or disputed assignments.
3. **Hindi and regional-language screens.** Add Hindi first, then languages used by the intended farmer group. Pair large touch controls with a simpler farmer flow.
4. **Offline farmer capture.** Save a signed draft harvest on the device and submit it when connectivity returns; clearly distinguish uncommitted drafts from ledger records.
5. **Verified certificates and devices.** Check issuer signatures or accreditation registries; authenticate physical sensors, preserve calibration evidence and deduplicate measurements.
6. **SMS/WhatsApp recall and excursion alerts.** Notify affected holders after verified contact enrollment and opt-in, instead of relying only on dashboard inspection.
7. **Independent organizational gateways and private data.** Separate each organization's signing service and add private data collections for commercial prices or personal records where required.
8. **Search index and measured performance.** Add the synopsis's MongoDB read index when data volume justifies it, then measure throughput and response times against the live four-org network.

For the next project increment, start with lot genealogy and receiver acceptance. First validate the supplied Fabric network and the existing IPFS/anchor integrations on a Docker-capable machine so new work builds on a demonstrated backend.
