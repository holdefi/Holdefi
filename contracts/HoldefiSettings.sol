// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./HoldefiOwnable.sol";


interface HoldefiInterface {

	struct Market {
		uint256 totalSupply;
		uint256 supplyIndex;
		uint256 supplyIndexUpdateTime;

		uint256 totalBorrow;
		uint256 borrowIndex;
		uint256 borrowIndexUpdateTime;

		uint256 promotionReserveScaled;
		uint256 promotionReserveLastUpdateTime;
		uint256 promotionDebtScaled;
		uint256 promotionDebtLastUpdateTime;
	}

	function marketAssets(address market) external view returns (Market memory);

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

	// Used for calculating liquidation threshold 
	// There is 5% gap between value to loan rate and liquidation rate
	uint256 constant private fivePercentLiquidationGap = 500;

	uint256 constant public maxListsLenght = 25;


	struct MarketSettings {
		bool isExist;
		bool isActive;
		uint256 borrowRate;
		uint256 borrowRateUpdateTime;

		uint256 suppliersShareRate;
		uint256 suppliersShareRateUpdateTime;
	}


	struct CollateralSettings {
		bool isExist;
		bool isActive;

		uint256 valueToLoanRate;
		uint256 VTLUpdateTime;

		uint256 penaltyRate;
		uint256 penaltyUpdateTime;

		uint256 bonusRate;
	}

	// Asset address => Market features 
	mapping (address => MarketSettings) public marketAssets;
	address[] public marketsList;

	// Asset address => Collateral features
	mapping (address => CollateralSettings) public collateralAssets;

	HoldefiInterface public holdefiContract;


	event MarketActivationChanged(address market, bool status);

	event CollateralActivationChanged(address collateral, bool status);

	event MarketExistenceChanged(address market, bool status);

	event CollateralExistenceChanged(address collateral, bool status);

	event BorrowRateChanged(address market, uint256 newRate);

	event SuppliersShareRateChanged(address market, uint256 newRate);

	event ValueToLoanRateChanged(address collateral, uint256 newRate);

	event PenaltyRateChanged(address collateral, uint256 newRate);

	event BonusRateChanged(address collateral, uint256 newRate);


	modifier marketIsExist(address market) {
        require (marketAssets[market].isExist, "The market is not exist");
        _;
    }

    modifier collateralIsExist(address collateral) {
        require (collateralAssets[collateral].isExist, "The collateral is not exist");
        _;
    }

	function activateMarket (address market) public onlyOwner marketIsExist(market) {
		marketAssets[market].isActive = true;
		emit MarketActivationChanged(market, true);
	}

	function deactivateMarket (address market) public onlyOwner marketIsExist(market) {
		marketAssets[market].isActive = false;
		emit MarketActivationChanged(market, false);
	}


	function activateCollateral (address collateral) public onlyOwner collateralIsExist(collateral) {
		collateralAssets[collateral].isActive = true;
		emit CollateralActivationChanged(collateral, true);
	}

	function deactivateCollateral (address collateral) public onlyOwner collateralIsExist(collateral) {
		collateralAssets[collateral].isActive = false;
		emit CollateralActivationChanged(collateral, false);
	}

	// Disposable function to Get in touch with Holdefi contract
	function setHoldefiContract(HoldefiInterface holdefiContractAddress) external onlyOwner {
		require (address(holdefiContract) == address(0), "Should be set once");
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
	
	// Owner can set a new borrow rate
	function setBorrowRate (address market, uint256 newBorrowRate) external onlyOwner marketIsExist(market) {
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
	function setSuppliersShareRate (address market, uint256 newSuppliersShareRate) external onlyOwner marketIsExist(market) {
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
		require (marketsList.length < maxListsLenght, "Market list is full");
		require(!marketAssets[market].isExist, "Market exists");
		require (borrowRate <= maxBorrowRate
			&& suppliersShareRate >= minSuppliersShareRate
			&& suppliersShareRate <= rateDecimals
			, 'Rate should be in allowed range');
		
		marketAssets[market].isExist = true;
		marketAssets[market].isActive = true;
		marketAssets[market].borrowRate = borrowRate;
		marketAssets[market].borrowRateUpdateTime = block.timestamp;
		marketAssets[market].suppliersShareRate = suppliersShareRate;
		marketAssets[market].suppliersShareRateUpdateTime = block.timestamp;
	
		marketsList.push(market);
		emit MarketExistenceChanged(market, true);
	}

	// Owner can remove a market asset
	function removeMarket (address market) external onlyOwner marketIsExist(market) {		
		uint256 totalBorrow = holdefiContract.marketAssets(market).totalBorrow;
		require (totalBorrow == 0, "Total borrow is not zero");
		
		holdefiContract.updateBorrowIndex(market);
		holdefiContract.updateSupplyIndex(market);
		holdefiContract.updatePromotionReserve(market);

		for (uint256 i = 0; i < marketsList.length ; i++) {
			if (marketsList[i] == market){
				delete marketsList[i];
				break;
			}
		}

		delete marketAssets[market];
		emit MarketExistenceChanged(market, false);
	}

	// Owner can add a collateral asset with its VTL, penalty and bonus rate
	function addCollateral (address collateral, uint256 valueToLoanRate, uint256 penaltyRate, uint256 bonusRate) external onlyOwner {
		require(!collateralAssets[collateral].isExist, "Collateral exists");		
		require (valueToLoanRate <= maxValueToLoanRate
				&& penaltyRate <= maxPenaltyRate
				&& penaltyRate <= valueToLoanRate
				&& bonusRate <= penaltyRate
				&& bonusRate >= rateDecimals
			,'Rate should be in allowed range');
		
		collateralAssets[collateral].isExist = true;
		collateralAssets[collateral].isActive = true;
		collateralAssets[collateral].valueToLoanRate = valueToLoanRate;
		collateralAssets[collateral].penaltyRate  = penaltyRate;
	    collateralAssets[collateral].bonusRate = bonusRate;
	    collateralAssets[collateral].VTLUpdateTime = block.timestamp;
	    collateralAssets[collateral].penaltyUpdateTime = block.timestamp;

		emit CollateralExistenceChanged(collateral, true);
	}
	
	// Owner can set a new VTL rate (Liquidation threshold) for each collateral asset
	function setValueToLoanRate (address collateral, uint256 newValueToLoanRate) external onlyOwner collateralIsExist(collateral) {
		require (
			newValueToLoanRate <= maxValueToLoanRate &&
			collateralAssets[collateral].penaltyRate.add(fivePercentLiquidationGap) <= newValueToLoanRate
			,'Rate should be in allowed range'
		);
		
		uint256 currentTime = block.timestamp;
		if (newValueToLoanRate > collateralAssets[collateral].valueToLoanRate) {
			uint256 deltaTime = currentTime.sub(collateralAssets[collateral].VTLUpdateTime);
			require (deltaTime >= periodBetweenUpdates,'Increasing rate is not allowed at this time');
			uint256 maxIncrease = collateralAssets[collateral].valueToLoanRate.add(valueToLoanRateMaxIncrease);
			require (newValueToLoanRate <= maxIncrease,'Rate should be increased less than max allowed');
		}
	    collateralAssets[collateral].valueToLoanRate = newValueToLoanRate;
	    collateralAssets[collateral].VTLUpdateTime = currentTime;

	    emit ValueToLoanRateChanged(collateral, newValueToLoanRate);
	}

	// Owner can set penalty rate for each collateral asset
	function setPenaltyRate (address collateral ,uint256 newPenaltyRate) external onlyOwner collateralIsExist(collateral) {
		require (
			newPenaltyRate <= maxPenaltyRate && 
			newPenaltyRate.add(fivePercentLiquidationGap) <= collateralAssets[collateral].valueToLoanRate && 
			collateralAssets[collateral].bonusRate <= newPenaltyRate
			,'Rate should be in allowed range'
		);

		uint256 currentTime = block.timestamp;
		if (newPenaltyRate > collateralAssets[collateral].penaltyRate){
			uint256 deltaTime = currentTime.sub(collateralAssets[collateral].penaltyUpdateTime);
			require (deltaTime >= periodBetweenUpdates,'Increasing rate is not allowed at this time');
			uint256 maxIncrease = collateralAssets[collateral].penaltyRate.add(penaltyRateMaxIncrease);
			require (newPenaltyRate <= maxIncrease,'Rate should be increased less than max allowed');
		}
	    collateralAssets[collateral].penaltyRate = newPenaltyRate;
	    collateralAssets[collateral].penaltyUpdateTime = currentTime;

	    emit PenaltyRateChanged(collateral, newPenaltyRate);
	}

	// Owner can set bonus rate for each collateral asset
	function setBonusRate (address collateral, uint256 newBonusRate) external onlyOwner collateralIsExist(collateral) {
		require (newBonusRate <= collateralAssets[collateral].penaltyRate
				&& newBonusRate >= rateDecimals
				,'Rate should be in allowed range');
		
	    collateralAssets[collateral].bonusRate = newBonusRate;

	    emit BonusRateChanged(collateral, newBonusRate);
	}

	receive() external payable {
        revert();
    }
}
