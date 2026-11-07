// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Wallet-submitted, validator-authorized agricultural records.
/// Business validation is trusted to the API validator, not implemented in Solidity.
contract AgriTraceLedger {
    address public immutable validator;
    mapping(bytes32 => bytes32) public heads;
    mapping(bytes32 => string) private records;
    bytes32[] private keys;
    event BatchCommitted(bytes32 indexed key, address indexed actor, bytes32 digest);
    constructor(address validator_) { require(validator_ != address(0)); validator = validator_; }
    function count() external view returns (uint256) { return keys.length; }
    function keyAt(uint256 index) external view returns (bytes32) { return keys[index]; }
    function read(bytes32 key) external view returns (string memory) { return records[key]; }
    function commit(bytes32 key, bytes32 previous, string calldata record, uint256 deadline, bytes calldata signature) external {
        require(block.timestamp <= deadline, "Approval expired");
        require(heads[key] == previous, "Stale record");
        require(bytes(record).length > 0 && bytes(record).length <= 65536, "Record size");
        bytes32 digest = keccak256(bytes(record));
        bytes32 approval = keccak256(abi.encode(block.chainid, address(this), msg.sender, key, previous, digest, deadline));
        require(signature.length == 65, "Signature length");
        bytes32 r; bytes32 s; uint8 v;
        assembly { r := calldataload(signature.offset) s := calldataload(add(signature.offset, 32)) v := byte(0, calldataload(add(signature.offset, 64))) }
        require(uint256(s) <= 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0, "Signature s");
        require(ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", approval)), v, r, s) == validator, "Invalid approval");
        require(digest != previous, "Unchanged record");
        if (previous == bytes32(0)) keys.push(key);
        heads[key] = digest;
        records[key] = record;
        emit BatchCommitted(key, msg.sender, digest);
    }
}
