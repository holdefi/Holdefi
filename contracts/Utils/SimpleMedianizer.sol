// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

contract SimpleMedianizer {
    uint price = 200*1000000000000000000;
    function set(uint newPrice) external {
        price = newPrice;
    }
    
    function read() external view returns (uint){
    	return price;
    }
}