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
	function holdefiSettings() external view returns (address contractAddress);
	function beforeChangeSupplyRate (address market) external;
	function beforeChangeBorrowRate (address market) external;
	function reserveSettlement (address market) external;
}


contract HoldefiSettings is HoldefiOwnable {

	using SafeMath for uint256;

	struct MarketSettings {
		bool isExist;		// Market is exist or not
		bool isActive;		// Market is open for deposit or not

		uint256 borrowRate;
		uint256 borrowRateUpdateTime;

		uint256 suppliersShareRate;
		uint256 suppliersShareRateUpdateTime;

		uint256 promotionRate;
	}

	struct CollateralSettings {
		bool isExist;		// Collateral is exist or not
		bool isActive;		// Collateral is open for deposit or not

		uint256 valueToLoanRate;
		uint256 VTLUpdateTime;

		uint256 penaltyRate;
		uint256 penaltyUpdateTime;

		uint256 bonusRate;
	}

	uint256 constant public rateDecimals = 10 ** 4;

	uint256 constant public periodBetweenUpdates = 864000;      	// seconds per ten days

	uint256 constant public maxBorrowRate = 4000;      				// 40%

	uint256 constant public borrowRateMaxIncrease = 500;      		// 5%

	uint256 constant public minSuppliersShareRate = 5000;      		// 50%

	uint256 constant public suppliersShareRateMaxDecrease = 500;	// 5%

	uint256 constant public maxValueToLoanRate = 20000;      		// 200%

	uint256 constant public valueToLoanRateMaxIncrease = 500;      	// 5%

	uint256 constant public maxPenaltyRate = 13000;      			// 130%

	uint256 constant public penaltyRateMaxIncrease = 500;      		// 5%

	uint256 constant public maxPromotionRate = 3000;				// 30%

	uint256 constant public maxListsLenght = 25;
		
	// Used for calculating liquidation threshold 
	// There is 5% gap between value to loan rate and liquidation rate
	uint256 constant private fivePercentLiquidationGap = 500;

	mapping (address => MarketSettings) public marketAssets;
	address[] public marketsList;

	mapping (address => CollateralSettings) public collateralAssets;

	HoldefiInterface public holdefiContract;

	event MarketActivationChanged(address indexed market, bool status);

	event CollateralActivationChanged(address indexed collateral, bool status);

	event MarketExistenceChanged(address indexed market, bool status);

	event CollateralExistenceChanged(address indexed collateral, bool status);

	event BorrowRateChanged(address indexed market, uint256 newRate, uint256 oldRate);

	event SuppliersShareRateChanged(address indexed market, uint256 newRate, uint256 oldRate);

	event PromotionRateChanged(address indexed market, uint256 newRate, uint256 oldRate);

	event ValueToLoanRateChanged(address indexed collateral, uint256 newRate, uint256 oldRate);

	event PenaltyRateChanged(address indexed collateral, uint256 newRate, uint256 oldRate);

	event BonusRateChanged(address indexed collateral, uint256 newRate, uint256 oldRate);


    modifier marketIsExist(address market) {
        require (marketAssets[market].isExist, "The market is not exist");
        _;
    }

    modifier collateralIsExist(address collateral) {
        require (collateralAssets[collateral].isExist, "The collateral is not exist");
        _;
    }

    receive() external payable {
        revert();
    }


	function activateMarket (address market) public onlyOwner marketIsExist(market) {
		activateMarketInternal(market);
	}

	function deactivateMarket (address market) public onlyOwner marketIsExist(market) {
		marketAssets[market].isActive = false;
		emit MarketActivationChanged(market, false);
	}

	function activateCollateral (address collateral) public onlyOwner collateralIsExist(collateral) {
		activateCollateralInternal(collateral);
	}

	function deactivateCollateral (address collateral) public onlyOwner collateralIsExist(collateral) {
		collateralAssets[collateral].isActive = false;
		emit CollateralActivationChanged(collateral, false);
	}

	function getMarketsList() external view returns (address[] memory res){
		res = marketsList;
	}

	function setHoldefiContract(HoldefiInterface holdefiContractAddress) external onlyOwner {
		require (holdefiContractAddress.holdefiSettings() == address(this),
			"Conflict with Holdefi contract address"
		);
		require (address(holdefiContract) == address(0), "Should be set once");
		holdefiContract = holdefiContractAddress;
	}

	function getInterests (address market)
		external
		view
		returns (uint256 borrowRate, uint256 supplyRateBase, uint256 promotionRate)
	{
		uint256 totalBorrow = holdefiContract.marketAssets(market).totalBorrow;
		uint256 totalSupply = holdefiContract.marketAssets(market).totalSupply;
		borrowRate = marketAssets[market].borrowRate;

		if (totalSupply == 0) {
			supplyRateBase = 0;
		}
		else {
			uint256 totalInterestFromBorrow = totalBorrow.mul(borrowRate);
			uint256 suppliersShare = totalInterestFromBorrow.mul(marketAssets[market].suppliersShareRate);
			suppliersShare = suppliersShare.div(rateDecimals);
			supplyRateBase = suppliersShare.div(totalSupply);
		}
		promotionRate = marketAssets[market].promotionRate;
	}

	function setPromotionRate (address market, uint256 newPromotionRate) external onlyOwner {
		require (newPromotionRate <= maxPromotionRate, "Rate should be in allowed range");

		holdefiContract.beforeChangeSupplyRate(market);
		holdefiContract.reserveSettlement(market);

		emit PromotionRateChanged(market, newPromotionRate, marketAssets[market].promotionRate);
		marketAssets[market].promotionRate = newPromotionRate;
	}

	function resetPromotionRate (address market) external {
		require (msg.sender == address(holdefiContract), "Sender is not Holdefi contract");

		emit PromotionRateChanged(market, 0, marketAssets[market].promotionRate);
		marketAssets[market].promotionRate = 0;
	}

	function setBorrowRate (address market, uint256 newBorrowRate)
		external 
		onlyOwner
		marketIsExist(market)
	{
		setBorrowRateInternal(market, newBorrowRate);
	}

	function setSuppliersShareRate (address market, uint256 newSuppliersShareRate)
		external
		onlyOwner
		marketIsExist(market)
	{
		setSuppliersShareRateInternal(market, newSuppliersShareRate);
	}

	function setValueToLoanRate (address collateral, uint256 newValueToLoanRate)
		external
		onlyOwner
		collateralIsExist(collateral)
	{
		setValueToLoanRateInternal(collateral, newValueToLoanRate);
	}

	function setPenaltyRate (address collateral, uint256 newPenaltyRate)
		external
		onlyOwner
		collateralIsExist(collateral)
	{
		setPenaltyRateInternal(collateral, newPenaltyRate);
	}

	function setBonusRate (address collateral, uint256 newBonusRate)
		external
		onlyOwner
		collateralIsExist(collateral)
	{
		setBonusRateInternal(collateral, newBonusRate); 
	}

	function addMarket (address market, uint256 borrowRate, uint256 suppliersShareRate)
		external
		onlyOwner
	{
		require (!marketAssets[market].isExist, "The market is exist");
		require (marketsList.length < maxListsLenght, "Market list is full");
		
		marketsList.push(market);
		marketAssets[market].isExist = true;
		emit MarketExistenceChanged(market, true);

		setBorrowRateInternal(market, borrowRate);
		setSuppliersShareRateInternal(market, suppliersShareRate);
		
		activateMarketInternal(market);		
	}

	function removeMarket (address market) external onlyOwner marketIsExist(market) {
		uint256 totalBorrow = holdefiContract.marketAssets(market).totalBorrow;
		require (totalBorrow == 0, "Total borrow is not zero");
		
		holdefiContract.beforeChangeBorrowRate(market);

		for (uint256 i = 0; i < marketsList.length ; i++) {
			if (marketsList[i] == market){
				delete marketsList[i];
				break;
			}
		}

		delete marketAssets[market];
		emit MarketExistenceChanged(market, false);
	}

	function addCollateral (
		address collateral,
		uint256 valueToLoanRate,
		uint256 penaltyRate,
		uint256 bonusRate
	)
		external
		onlyOwner
	{
		require (!collateralAssets[collateral].isExist, "The collateral is exist");

		collateralAssets[collateral].isExist = true;
		emit CollateralExistenceChanged(collateral, true);

		setValueToLoanRateInternal(collateral, valueToLoanRate);
		setPenaltyRateInternal(collateral, penaltyRate);
		setBonusRateInternal(collateral, bonusRate);

		activateCollateralInternal(collateral);
	}

	function activateMarketInternal (address market) internal {
		marketAssets[market].isActive = true;
		emit MarketActivationChanged(market, true);
	}

	function activateCollateralInternal (address collateral) internal {
		collateralAssets[collateral].isActive = true;
		emit CollateralActivationChanged(collateral, true);
	}

	function setBorrowRateInternal (address market, uint256 newBorrowRate) internal {
		require (newBorrowRate <= maxBorrowRate, "Rate should be less than max");
		uint256 currentTime = block.timestamp;

		if (marketAssets[market].borrowRateUpdateTime != 0) {
			if (newBorrowRate > marketAssets[market].borrowRate) {
				uint256 deltaTime = currentTime.sub(marketAssets[market].borrowRateUpdateTime);
				require (deltaTime >= periodBetweenUpdates, "Increasing rate is not allowed at this time");

				uint256 maxIncrease = marketAssets[market].borrowRate.add(borrowRateMaxIncrease);
				require (newBorrowRate <= maxIncrease, "Rate should be increased less than max allowed");
			}

			holdefiContract.beforeChangeBorrowRate(market);
		}

		emit BorrowRateChanged(market, newBorrowRate, marketAssets[market].borrowRate);

		marketAssets[market].borrowRate = newBorrowRate;
		marketAssets[market].borrowRateUpdateTime = currentTime;
	}

	function setSuppliersShareRateInternal (address market, uint256 newSuppliersShareRate) internal {
		require (
			newSuppliersShareRate >= minSuppliersShareRate && newSuppliersShareRate <= rateDecimals,
			"Rate should be in allowed range"
		);
		uint256 currentTime = block.timestamp;

		if (marketAssets[market].suppliersShareRateUpdateTime != 0) {
			if (newSuppliersShareRate < marketAssets[market].suppliersShareRate) {
				uint256 deltaTime = currentTime.sub(marketAssets[market].suppliersShareRateUpdateTime);
				require (deltaTime >= periodBetweenUpdates, "Decreasing rate is not allowed at this time");

				uint256 decreasedAllowed = newSuppliersShareRate.add(suppliersShareRateMaxDecrease);
				require (
					marketAssets[market].suppliersShareRate <= decreasedAllowed,
					"Rate should be decreased less than max allowed"
				);
			}
			holdefiContract.beforeChangeSupplyRate(market);
		}

		emit SuppliersShareRateChanged(
			market,
			newSuppliersShareRate,
			marketAssets[market].suppliersShareRate
		);

		marketAssets[market].suppliersShareRate = newSuppliersShareRate;
		marketAssets[market].suppliersShareRateUpdateTime = currentTime;
	}

	function setValueToLoanRateInternal (address collateral, uint256 newValueToLoanRate) internal {
		require (
			newValueToLoanRate <= maxValueToLoanRate &&
			collateralAssets[collateral].penaltyRate.add(fivePercentLiquidationGap) <= newValueToLoanRate,
			"Rate should be in allowed range"
		);
		
		uint256 currentTime = block.timestamp;
		if (
			collateralAssets[collateral].VTLUpdateTime != 0 &&
			newValueToLoanRate > collateralAssets[collateral].valueToLoanRate
		) {
			uint256 deltaTime = currentTime.sub(collateralAssets[collateral].VTLUpdateTime);
			require (deltaTime >= periodBetweenUpdates,"Increasing rate is not allowed at this time");
			uint256 maxIncrease = collateralAssets[collateral].valueToLoanRate.add(
				valueToLoanRateMaxIncrease
			);
			require (newValueToLoanRate <= maxIncrease,"Rate should be increased less than max allowed");
		}
		emit ValueToLoanRateChanged(
			collateral,
			newValueToLoanRate,
			collateralAssets[collateral].valueToLoanRate
		);

	    collateralAssets[collateral].valueToLoanRate = newValueToLoanRate;
	    collateralAssets[collateral].VTLUpdateTime = currentTime;
	}

	function setPenaltyRateInternal (address collateral, uint256 newPenaltyRate) internal {
		require (
			newPenaltyRate <= maxPenaltyRate &&
			newPenaltyRate <= collateralAssets[collateral].valueToLoanRate.sub(fivePercentLiquidationGap) &&
			collateralAssets[collateral].bonusRate <= newPenaltyRate,
			"Rate should be in allowed range"
		);

		uint256 currentTime = block.timestamp;
		if (
			collateralAssets[collateral].penaltyUpdateTime != 0 &&
			newPenaltyRate > collateralAssets[collateral].penaltyRate
		) {
			uint256 deltaTime = currentTime.sub(collateralAssets[collateral].penaltyUpdateTime);
			require (deltaTime >= periodBetweenUpdates, "Increasing rate is not allowed at this time");
			uint256 maxIncrease = collateralAssets[collateral].penaltyRate.add(penaltyRateMaxIncrease);
			require (newPenaltyRate <= maxIncrease, "Rate should be increased less than max allowed");
		}

		emit PenaltyRateChanged(collateral, newPenaltyRate, collateralAssets[collateral].penaltyRate);

	    collateralAssets[collateral].penaltyRate  = newPenaltyRate;
	    collateralAssets[collateral].penaltyUpdateTime = currentTime;
	}

	function setBonusRateInternal (address collateral, uint256 newBonusRate) internal {
		require (
			newBonusRate <= collateralAssets[collateral].penaltyRate && newBonusRate >= rateDecimals,
			"Rate should be in allowed range"
		);
		
		emit BonusRateChanged(collateral, newBonusRate, collateralAssets[collateral].bonusRate);
	    collateralAssets[collateral].bonusRate = newBonusRate;    
	}
}
