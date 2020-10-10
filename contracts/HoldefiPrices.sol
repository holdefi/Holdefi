// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./HoldefiOwnable.sol";

interface ETHMedianizerInterface {

   function read() external view returns(uint256 price);
}

 //This contract will be changed before adding ERC20 tokens that are not stable coin
contract HoldefiPrices is HoldefiOwnable {

    using SafeMath for uint256;

    address constant public ethAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    uint256 constant public priceDecimal = 10**18;
   
    mapping(address => uint) public assetPrices;

    ETHMedianizerInterface public ethMedianizer;

    event PriceChanged(address asset, uint256 newPrice);

    constructor(address newOwnerChanger, ETHMedianizerInterface ethMedianizerContract) public HoldefiOwnable(newOwnerChanger) {
        ethMedianizer = ethMedianizerContract;
    }

    // Returns price of selected asset
    function getPrice(address asset) external view returns(uint256 price) {
    	if (asset == ethAddress){
    		price = uint(ethMedianizer.read());
    	}
        else {
            price = assetPrices[asset];
        }
    }

     // TODO: This function should be internal for the first version of priceFeed
    function setPrice(address asset, uint256 newPrice) public onlyOwner {
        require (asset != ethAddress,'Price of ETH can not be changed');

        assetPrices[asset] = newPrice;
        emit PriceChanged(asset, newPrice);
    }

    // Called by owner to add new stable token at 1$ price
    function addStableCoin(address asset) public onlyOwner {
        setPrice(asset, priceDecimal);
    }
    
    receive() external payable {
        revert();
    }
}