// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Immutable public commitments to AgriTrace batch snapshots.
/// @dev Roots are SHA-256 Merkle roots calculated off chain, not keccak trees.
contract BatchAnchor {
    address public immutable owner;
    mapping(address => bool) public publishers;
    mapping(bytes32 => mapping(uint256 => bytes32)) public roots;
    mapping(bytes32 => uint256) public latestEventCount;
    event PublisherChanged(address indexed publisher, bool authorized);
    event BatchAnchored(bytes32 indexed batchId, bytes32 root, uint256 eventCount, address indexed publisher);

    constructor() { owner = msg.sender; publishers[msg.sender] = true; }

    function setPublisher(address publisher, bool authorized) external {
        require(msg.sender == owner, "Only owner");
        require(publisher != address(0), "Zero publisher");
        publishers[publisher] = authorized;
        emit PublisherChanged(publisher, authorized);
    }

    function anchor(bytes32 batchId, bytes32 root, uint256 eventCount) external {
        require(publishers[msg.sender], "Unauthorized publisher");
        require(batchId != bytes32(0) && root != bytes32(0), "Empty commitment");
        require(eventCount > latestEventCount[batchId], "Snapshot must advance");
        require(roots[batchId][eventCount] == bytes32(0), "Already anchored");
        roots[batchId][eventCount] = root;
        latestEventCount[batchId] = eventCount;
        emit BatchAnchored(batchId, root, eventCount, msg.sender);
    }
}
