// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "./HoldefiOwnable.sol";

// Taking ideas from Open Zeppelin's Pausable contract
contract HoldefiPausableOwnable is HoldefiOwnable {

    uint256 constant public maxPauseDuration = 2592000;     //seconds per month

    address public pauser;

     // '0' -> supply
     // '1' -> withdrawSupply
     // '2' -> collatralize
     // '3' -> withdrawCollateral
     // '4' -> borrow
     // '5' -> repayBorrrow
     // '6' -> liquidateBorrowerCollateral
     // '7' -> buyLiquidatedCollateral
    
    uint256 constant pauseOperationsLength = 8;
    uint256[8] public paused;

    constructor (address ownerChanger) HoldefiOwnable(ownerChanger) public {
    }

    // Modifier to make a function callable only by owner or pauser   
    modifier onlyPausers() {
        require(msg.sender == owner || msg.sender == pauser , 'Sender should be Owner or Pauser');
        _;
    }
    
    // Modifier to make a function callable only when a functions is not paused.
    modifier whenNotPaused(uint256 index) {
        require(!isPaused(index), "Pausable: paused");
        _;
    }

    // Modifier to make a function callable only when a functions is paused.
    modifier whenPaused(uint256 index) {
        require(isPaused(index), "Pausable: not paused");
        _;
    }

    function isPaused(uint256 index) public view returns(bool res) {
        if (block.timestamp > paused[index]) {
            res = false;
        }
        else {
            res = true;
        }
    }
    
    // Called by pausers to pause, triggers stopped state.
    function pause(uint256 index, uint256 pauseDuration) public onlyPausers {
        require (pauseDuration <= maxPauseDuration, "Duration not in range");
        paused[index] = block.timestamp + pauseDuration;
    }

    // Called by owner to unpause, returns to normal state.
    function unpause(uint256 index) public onlyOwner {
        paused[index] = 0;
    }

    // Called by pausers to pause, triggers stopped state for selected functions
    function batchPause(uint256[] memory functionsToPause, uint256[] memory pauseDurations) external onlyPausers {
        require (functionsToPause.length == pauseDurations.length, "Lists are not equal in length");
        for (uint8 i = 0 ; i < functionsToPause.length ; i++) {
            if (functionsToPause[i] < pauseOperationsLength) {
                pause(functionsToPause[i], pauseDurations[i]);
            }
        }
    }

    // Called by pausers to pause, returns to normal state for selected functions
    function batchUnpause(uint256[] memory functionsToUnpause) external onlyOwner {
        for (uint8 i = 0 ; i < functionsToUnpause.length ; i++) {
            if (functionsToUnpause[i] < pauseOperationsLength) {
                unpause(functionsToUnpause[i]);
            }
        }
    }
    // Called by owner to set a new pauser
    function setPauser(address newPauser) external onlyOwner {
        pauser = newPauser;
    }
}