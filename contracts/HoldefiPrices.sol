// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./HoldefiOwnable.sol";

interface ERC20DecimalInterface {
    function decimals () external view returns(uint256 res);
}

contract HoldefiPrices is HoldefiOwnable {

    using SafeMath for uint256;

    address constant public ethAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    uint256 constant public valueDecimals = 30;

    struct Asset {
        uint256 decimals;
        AggregatorV3Interface priceContract;
    }
   
    mapping(address => Asset) public assets;

    event NewPriceAggregator(address indexed asset, uint256 decimals, address priceAggregator);

    constructor(address ownerChanger) HoldefiOwnable(ownerChanger) public {
        assets[ethAddress].decimals = 18;
    }

    receive() payable external {
        revert();
    }

    function getPrice(address asset) public view returns (uint256 price, uint256 priceDecimals) {
        if (asset == ethAddress){
            price = 1;
            priceDecimals = 0;
        }
        else {
            (,int aggregatorPrice,,,) = assets[asset].priceContract.latestRoundData();
            priceDecimals = assets[asset].priceContract.decimals();
            if (aggregatorPrice > 0) {
                price = uint(aggregatorPrice);
            }
            else {
                revert();
            }
        }
    }

    function setPriceAggregator(address asset, uint256 decimals, AggregatorV3Interface priceContractAddress)
        external
        onlyOwner
    { 
        require (asset != ethAddress, "Asset should not be ETH");
        assets[asset].priceContract = priceContractAddress;

        try ERC20DecimalInterface(asset).decimals() returns (uint256 tokenDecimals) {
            assets[asset].decimals = tokenDecimals;
        }
        catch {
            assets[asset].decimals = decimals;
        }
        emit NewPriceAggregator(asset, decimals, address(priceContractAddress));
    }

    function getAssetValueFromAmount(address asset, uint256 amount) external view returns (uint256 res) {
        uint256 decimalsDiff;
        uint256 decimalsScale;

        (uint256 price, uint256 priceDecimals) = getPrice(asset);
        uint256 calValueDecimals = priceDecimals.add(assets[asset].decimals);
        if (valueDecimals > calValueDecimals){
            decimalsDiff = valueDecimals.sub(calValueDecimals);
            decimalsScale =  10 ** decimalsDiff;
            res = amount.mul(price).mul(decimalsScale);
        }
        else {
            decimalsDiff = calValueDecimals.sub(valueDecimals);
            decimalsScale =  10 ** decimalsDiff;
            res = amount.mul(price).div(decimalsScale);
        }   
    }

    function getAssetAmountFromValue(address asset, uint256 value) external view returns (uint256 res) {
        uint256 decimalsDiff;
        uint256 decimalsScale;

        (uint256 price, uint256 priceDecimals) = getPrice(asset);
        uint256 calValueDecimals = priceDecimals.add(assets[asset].decimals);
        if (valueDecimals > calValueDecimals){
            decimalsDiff = valueDecimals.sub(calValueDecimals);
            decimalsScale =  10 ** decimalsDiff;
            res = value.div(decimalsScale).div(price);
        }
        else {
            decimalsDiff = calValueDecimals.sub(valueDecimals);
            decimalsScale =  10 ** decimalsDiff;
            res = value.mul(decimalsScale).div(price);
        }   
    }
}