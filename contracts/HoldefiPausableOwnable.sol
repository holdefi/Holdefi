// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./HoldefiOwnable.sol";

// Taking ideas from Open Zeppelin's Pausable contract
contract HoldefiPausableOwnable is HoldefiOwnable {

    uint256 constant public maxPauseDuration = 2592000;     //seconds per month

    struct Operation {
        bool isValid;
        uint256 pauseEndTime;
    }

    address public pauser;

    mapping(string => Operation) public paused;

    event PauserChanged(address newPauser, address oldPauser);

    event OperationPaused(string operation, uint256 pauseDuration);

    event OperationUnpaused(string operation);
    
    // Define valid operations that can be paused
    constructor () public {
        paused["supply"].isValid = true;
        paused["withdrawSupply"].isValid = true;
        paused["collateralize"].isValid = true;
        paused["withdrawCollateral"].isValid = true;
        paused["borrow"].isValid = true;
        paused["repayBorrow"].isValid = true;
        paused["liquidateBorrowerCollateral"].isValid = true;
        paused["buyLiquidatedCollateral"].isValid = true;
    }

    modifier onlyPausers() {
        require(msg.sender == owner || msg.sender == pauser , "Sender should be owner or pauser");
        _;
    }
    
    modifier whenNotPaused(string memory operation) {
        require(!isPaused(operation), "Operation is paused");
        _;
    }

    modifier whenPaused(string memory operation) {
        require(isPaused(operation), "Operation is unpaused");
        _;
    }

    modifier operationIsValid(string memory operation) {
        require(paused[operation].isValid ,"Operation is not valid");
        _;
    }

    function isPaused(string memory operation) public view returns (bool res) {
        if (block.timestamp > paused[operation].pauseEndTime) {
            res = false;
        }
        else {
            res = true;
        }
    }

    function pause(string memory operation, uint256 pauseDuration)
        public
        onlyPausers
        operationIsValid(operation)
        whenNotPaused(operation)
    {
        require (pauseDuration <= maxPauseDuration, "Duration not in range");
        paused[operation].pauseEndTime = block.timestamp + pauseDuration;
        emit OperationPaused(operation, pauseDuration);
    }

    function unpause(string memory operation)
        public
        onlyOwner
        operationIsValid(operation)
        whenPaused(operation)
    {
        paused[operation].pauseEndTime = 0;
        emit OperationUnpaused(operation);
    }

    function batchPause(string[] memory operations, uint256[] memory pauseDurations) external {
        require (operations.length == pauseDurations.length, "Lists are not equal in length");
        for (uint256 i = 0 ; i < operations.length ; i++) {
            pause(operations[i], pauseDurations[i]);
        }
    }

    function batchUnpause(string[] memory operations) external {
        for (uint256 i = 0 ; i < operations.length ; i++) {
            unpause(operations[i]);
        }
    }

    function setPauser(address newPauser) external onlyOwner {
        emit PauserChanged(newPauser, pauser);
        pauser = newPauser;
    }
}