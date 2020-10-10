// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "./SafeMath.sol";
import "./HoldefiOwnable.sol";


interface HoldefiInterface {

	function updateSupplyIndex(address market) external;

	function updateBorrowIndex(address market) external;

	function updatePromotionReserve(address market) external;
}

// All these settings is callable by only owner
contract HoldefiSettings is HoldefiOwnable {

	using SafeMath for uint256;

	uint256 constant public rateDecimals = 10 ** 4;

	uint256 constant public periodBetweenUpdates = 864000;

	uint256 constant public maxBorrowRate = 4000;				  //40%

	uint256 constant public borrowRateMaxIncrease = 500;		  //5%

	uint256 constant public minSuppliersShareRate = 5000;		  //50%

	uint256 constant public suppliersShareRateMaxDecrease = 500; //5%

	uint256 constant public maxValueToLoanRate = 20000; 		  //200%

	uint256 constant public valueToLoanRateMaxIncrease = 500;	  //5%

	uint256 constant public maxPenaltyRate = 13000; 			  //130%

	uint256 constant public penaltyRateMaxIncrease = 500; 		  //5%

	// Markets Features 
	struct MarketSettings {
		bool isActive;

		uint256 borrowRate;
		uint256 borrowRateUpdateTime;

		uint256 suppliersShareRate;
		uint256 suppliersShareRateUpdateTime;	
	}

	// Collaterals Features
	struct CollateralSettings {
		bool isActive;
		uint256 valueToLoanRate;   // Collateral liquidation threshold
		uint256 VTLUpdateTime;
		uint256 penaltyRate; 		// Portion of collateral being liquidated during liquidation
		uint256 penaltyUpdateTime;
		uint256 bonusRate;		    // Bonus for buyers who buy liquidated collaterals
	}

	// Asset address => Market features 
	mapping (address => MarketSettings) public marketAssets;
	address[] public marketsList;

	// Asset address => Collateral features
	mapping (address => CollateralSettings) public collateralAssets;

	HoldefiInterface public holdefiContract;

	event BorrowRateChanged(address market, uint256 newRate);

	event SuppliersShareRateChanged(address market, uint256 newRate);

	event MarketAdded(address market);

	event MarketRemoved(address market);

	event CollateralAdded(address collateral, uint256 valueToLoanRate, uint256 penaltyRate, uint256 bonusRate);

	event CollateralRemoved(address collateral);

	event ValueToLoanRateChanged(address collateral, uint256 newRate);

	event PenaltyRateChanged(address collateral, uint256 newRate);

	event BonusRateChanged(address collateral, uint256 newRate);
	
	constructor (address ownerChanger) HoldefiOwnable(ownerChanger) public {
	}

	// Disposable function to Get in touch with Holdefi contract
	function setHoldefiContract(HoldefiInterface holdefiContractAddress) external onlyOwner {
		require (address(holdefiContract) == address(0),'Should be set once');
		holdefiContract = holdefiContractAddress;
	}

	// Returns supply rate and borrow rate 
	// supply rate = ((total borrow * Borrow rate * suppliers share rate) / total supply
	function getInterests (address market, uint256 totalSupply, uint256 totalBorrow) external view returns(uint256 borrowRate, uint256 supplyRate) {
		borrowRate = marketAssets[market].borrowRate;
		uint256 suppliersShareRate = marketAssets[market].suppliersShareRate;
		if (totalSupply == 0){
			supplyRate = 0;
		}
		else {
			uint256 totalInterestFromBorrow = totalBorrow.mul(borrowRate);
			uint256 suppliersShare = totalInterestFromBorrow.mul(suppliersShareRate);
			suppliersShare = suppliersShare.div(rateDecimals);
			supplyRate = suppliersShare.div(totalSupply);
		}
	}

	// Returns list of all markets
	function getMarketsList() external view returns (address[] memory res){
		res = marketsList;
	}

	// Returns true if an asset is in the market list
	function isMarketActive(address market) external view returns (bool active){
		active = marketAssets[market].isActive;
	}

	// Returns the features of a collateral (Is active- VTL rate- Penalty rate- Bonus rate)
	function getCollateral(address collateral) external view returns (bool, uint, uint, uint){
		return(
			collateralAssets[collateral].isActive,
			collateralAssets[collateral].valueToLoanRate,
			collateralAssets[collateral].penaltyRate,
			collateralAssets[collateral].bonusRate		
			);
	}
	
	// Owner can set a new borrow rate
	function setBorrowRate (address market, uint256 newBorrowRate) external onlyOwner {
		require (newBorrowRate <= maxBorrowRate,'Rate should be less than max');
		uint256 currentTime = block.timestamp;

		if (newBorrowRate > marketAssets[market].borrowRate){
			uint256 deltaTime = currentTime.sub(marketAssets[market].borrowRateUpdateTime);
			require (deltaTime >= periodBetweenUpdates,'Increasing rate is not allowed at this time');
			uint256 maxIncrease = marketAssets[market].borrowRate.add(borrowRateMaxIncrease);
			require (newBorrowRate <= maxIncrease,'Rate should be increased less than max allowed');
		}

		holdefiContract.updateBorrowIndex(market);
		holdefiContract.updateSupplyIndex(market);
		holdefiContract.updatePromotionReserve(market);
		marketAssets[market].borrowRate = newBorrowRate;
		marketAssets[market].borrowRateUpdateTime = currentTime;

		emit BorrowRateChanged(market, newBorrowRate);
	}

	// Owner can set a new 'suppliers share rate' (Supplier's share of borrower's interest).
	function setSuppliersShareRate (address market, uint256 newSuppliersShareRate) external onlyOwner {
		require (newSuppliersShareRate >= minSuppliersShareRate && newSuppliersShareRate <= rateDecimals,'Rate should be in allowed range');
		uint256 currentTime = block.timestamp;

		if (newSuppliersShareRate < marketAssets[market].suppliersShareRate) {
			uint256 deltaTime = currentTime.sub(marketAssets[market].suppliersShareRateUpdateTime);
			require (deltaTime >= periodBetweenUpdates,'Decreasing rate is not allowed at this time');
			uint256 maxDecrease = marketAssets[market].suppliersShareRate.sub(suppliersShareRateMaxDecrease);
			require (newSuppliersShareRate >= maxDecrease,'Rate should be decreased less than max allowed');
		}

		holdefiContract.updateSupplyIndex(market);
		holdefiContract.updatePromotionReserve(market);
		marketAssets[market].suppliersShareRate = newSuppliersShareRate;
		marketAssets[market].suppliersShareRateUpdateTime = currentTime;

		emit SuppliersShareRateChanged(market, newSuppliersShareRate);
	}

	// Owner can add a new asset as a market.
	function addMarket (address market, uint256 borrowRate, uint256 suppliersShareRate) external onlyOwner {
		require(!marketAssets[market].isActive, "Market exists");
		require (borrowRate <= maxBorrowRate
			&& suppliersShareRate >= minSuppliersShareRate
			&& suppliersShareRate <= rateDecimals
			, 'Rate should be in allowed range');
		
		marketAssets[market].isActive = true;
		marketAssets[market].borrowRate = borrowRate;
		marketAssets[market].borrowRateUpdateTime = block.timestamp;
		marketAssets[market].suppliersShareRate = suppliersShareRate;
		marketAssets[market].suppliersShareRateUpdateTime = block.timestamp;
	
		bool exist = false;
		for (uint256 i=0; i<marketsList.length; i++) {
			if (marketsList[i] == market){
				exist = true;
				break;
			}
		}

		if (!exist) {
			marketsList.push(market);
		}

		emit MarketAdded(market);
	}

	// Owner can remove a market asset
	function removeMarket (address market) external onlyOwner {		
		marketAssets[market].isActive = false;
		emit MarketRemoved(market);
	}

	// Owner can add a collateral asset with its VTL, penalty and bonus rate
	function addCollateral (address collateralAsset, uint256 valueToLoanRate, uint256 penaltyRate, uint256 bonusRate) external onlyOwner {
		require(!collateralAssets[collateralAsset].isActive, "Collateral exists");		
		require (valueToLoanRate <= maxValueToLoanRate
				&& penaltyRate <= maxPenaltyRate
				&& penaltyRate <= valueToLoanRate
				&& bonusRate <= penaltyRate
				&& bonusRate >= rateDecimals
			,'Rate should be in allowed range');
		
		collateralAssets[collateralAsset].isActive = true;
		collateralAssets[collateralAsset].valueToLoanRate = valueToLoanRate;
		collateralAssets[collateralAsset].penaltyRate  = penaltyRate;
	    collateralAssets[collateralAsset].bonusRate = bonusRate;
	    collateralAssets[collateralAsset].VTLUpdateTime = block.timestamp;
	    collateralAssets[collateralAsset].penaltyUpdateTime = block.timestamp;
	    	
		emit CollateralAdded(collateralAsset, valueToLoanRate, penaltyRate, bonusRate);
	}

	// Owner can remove a collateral asset
	function removeCollateral (address collateralAsset) external onlyOwner {
		collateralAssets[collateralAsset].isActive = false;
		emit CollateralRemoved(collateralAsset);
	}
	
	// Owner can set a new VTL rate (Liquidation threshold) for each collateral asset
	function setValueToLoanRate (address collateralAsset, uint256 newValueToLoanRate) external onlyOwner {
		require (newValueToLoanRate <= maxValueToLoanRate
				&& collateralAssets[collateralAsset].penaltyRate <= newValueToLoanRate
				,'Rate should be in allowed range');
		
		uint256 currentTime = block.timestamp;
		if (newValueToLoanRate > collateralAssets[collateralAsset].valueToLoanRate) {
			uint256 deltaTime = currentTime.sub(collateralAssets[collateralAsset].VTLUpdateTime);
			require (deltaTime >= periodBetweenUpdates,'Increasing rate is not allowed at this time');
			uint256 maxIncrease = collateralAssets[collateralAsset].valueToLoanRate.add(valueToLoanRateMaxIncrease);
			require (newValueToLoanRate <= maxIncrease,'Rate should be increased less than max allowed');
		}
	    collateralAssets[collateralAsset].valueToLoanRate = newValueToLoanRate;
	    collateralAssets[collateralAsset].VTLUpdateTime = currentTime;

	    emit ValueToLoanRateChanged(collateralAsset, newValueToLoanRate);
	}

	// Owner can set penalty rate for each collateral asset
	function setPenaltyRate (address collateralAsset ,uint256 newPenaltyRate) external onlyOwner {
		require (newPenaltyRate <= maxPenaltyRate
				&& newPenaltyRate <= collateralAssets[collateralAsset].valueToLoanRate
				&& collateralAssets[collateralAsset].bonusRate <= newPenaltyRate
				,'Rate should be in allowed range');

		uint256 currentTime = block.timestamp;
		if (newPenaltyRate > collateralAssets[collateralAsset].penaltyRate){
			uint256 deltaTime = currentTime.sub(collateralAssets[collateralAsset].penaltyUpdateTime);
			require (deltaTime >= periodBetweenUpdates,'Increasing rate is not allowed at this time');
			uint256 maxIncrease = collateralAssets[collateralAsset].penaltyRate.add(penaltyRateMaxIncrease);
			require (newPenaltyRate <= maxIncrease,'Rate should be increased less than max allowed');
		}
	    collateralAssets[collateralAsset].penaltyRate  = newPenaltyRate;
	    collateralAssets[collateralAsset].penaltyUpdateTime = currentTime;

	    emit PenaltyRateChanged(collateralAsset, newPenaltyRate);
	}

	// Owner can set bonus rate for each collateral asset
	function setBonusRate (address collateralAsset, uint256 newBonusRate) external onlyOwner {
		require (newBonusRate <= collateralAssets[collateralAsset].penaltyRate
				&& newBonusRate >= rateDecimals
				,'Rate should be in allowed range');
		
	    collateralAssets[collateralAsset].bonusRate = newBonusRate;

	    emit BonusRateChanged(collateralAsset, newBonusRate);
	}

	receive() external payable {
        revert();
    }
}
