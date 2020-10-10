// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "./SafeMath.sol";
import "./HoldefiOwnable.sol";
import "./HoldefiPausableOwnable.sol";

// File: contracts/HoldefiPrices.sol
interface HoldefiPricesInterface {
	function getPrice(address token) external view returns(uint256 price);	
}

// File: contracts/HoldefiSettings.sol
interface HoldefiSettingsInterface {
	function getInterests(address market, uint256 totalSupply, uint256 totalBorrow) external view returns(uint256 borrowRate, uint256 supplyRate);
	function isMarketActive(address market) external view returns(bool isActive);
	function getCollateral(address collateral) external view returns(bool isActive, uint256 valueToLoanRate, uint256 penaltyRate, uint256 bonusRate);
	function getMarketsList() external view returns(address[] memory marketsList);
}

// File: contracts/HoldefiCollaterals.sol
interface HoldefiCollateralsInterface {
	function withdraw(address collateral, address payable recipient, uint256 amount) external;
}

interface ERC20 {
    function transfer(address recipient, uint256 amount) external returns(bool success);
    function transferFrom(address sender, address recipient, uint256 amount) external returns(bool success);
}



 // Main Holdefi contract.
 // The address of ETH asset considered as 0x00 in this contract.
contract Holdefi is HoldefiPausableOwnable {

	using SafeMath for uint256;

	address constant public ethAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

	// All rates in this contract are scaled by rateDecimals.
	uint256 constant public rateDecimals = 10 ** 4;

	// All Indexes in this contract are scaled by (secondsPerYear * rateDecimals) 
	uint256 constant public secondsPerYear = 31536000;

	uint256 constant public maxPromotionRate = 3000;

	// Markets are assets that can be supplied and borrowed
	struct Market {
		uint256 totalSupply;
		uint256 supplyIndex;      //Scaled by: secondsPerYear * rateDecimals
		uint256 supplyIndexUpdateTime;

		uint256 totalBorrow;
		uint256 borrowIndex;      //Scaled by: secondsPerYear * rateDecimals
		uint256 borrowIndexUpdateTime;

		uint256 promotionRate;
		uint256 promotionReserveScaled; //Scaled by: secondsPerYear * rateDecimals
		uint256 promotionReserveLastUpdateTime;
		uint256 promotionDebtScaled;    //Scaled by: secondsPerYear * rateDecimals
		uint256 promotionDebtLastUpdateTime;
	}

	// Collaterals are assets that can be use only as collateral (no interest)
	struct Collateral {
		uint256 totalCollateral;
		uint256 totalLiquidatedCollateral;
	}

	// Users profile for each market
	struct MarketAccount {
		uint256 balance;
		uint256 accumulatedInterest; 
		uint256 lastInterestIndex; //Scaled by: secondsPerYear * rateDecimals
	}
	// Users profile for each collateral
	struct CollateralAccount {
		uint256 balance;
		uint256 lastUpdateTime;
	}

	// Markets: marketAddress => Market
	mapping (address => Market) public marketAssets;

	// Collaterals: collateralAddress => Collateral
	mapping (address => Collateral) public collateralAssets;

	// Users Supplies: userAddress => marketAddress => supplyDetails
	mapping (address => mapping (address => MarketAccount)) private supplies;

	// Users Borrows: userAddress => collateralAddress => marketAddress => borrowDetails 
	mapping (address => mapping (address => mapping (address => MarketAccount))) private borrows;

	// Users Collaterals: userAddress => collateralAddress => collateralDetails 
	mapping (address => mapping (address => CollateralAccount)) private collaterals;
	
	// Markets Debt after liquidation: collateralAddress => marketAddress => marketDebtBalance 
	mapping (address => mapping (address => uint)) public marketDebt;


	// Contract for getting markets supply rate and borrow rate 
	HoldefiSettingsInterface public holdefiSettings;

	// Contract for getting token price 
	HoldefiPricesInterface public holdefiPrices;

	// Wallet Contract for Collaterals 
	HoldefiCollateralsInterface public holdefiCollaterals;

	// Price contract can be unchangeable
	bool public fixPrices = false;

	// ----------- Events -----------

	event Supply(address supplier, address market, uint256 amount);

	event WithdrawSupply(address supplier, address market, uint256 amount);

	event Collateralize(address collateralizer, address collateral, uint256 amount);

	event WithdrawCollateral(address collateralizer, address collateral, uint256 amount);

	event Borrow(address borrower, address market, address collateral, uint256 amount);

	event RepayBorrow(address borrower, address market, address collateral, uint256 amount);

	event UpdateSupplyIndex(address market, uint256 newSupplyIndex, uint256 supplyRate);

	event UpdateBorrowIndex(address market, uint256 newBorrowIndex);

	event CollateralLiquidated(address borrower, address collateral, uint256 amount);

	event NewMarketDebt(address borrower, address market, address collateral, uint256 amount);

	event BuyLiquidatedCollateral(address market, address collateral, uint256 marketAmount);

	event PromotionRateChanged(address market, uint256 newRate);

	event HoldefiPricesContractChanged(HoldefiPricesInterface newAddress, HoldefiPricesInterface oldAddress);
	
	constructor (address newOwnerChanger, HoldefiCollateralsInterface holdefiCollateralsAddress, HoldefiSettingsInterface holdefiSettingsAddress, HoldefiPricesInterface holdefiPricesAddress) HoldefiPausableOwnable(newOwnerChanger) public {
		holdefiCollaterals = holdefiCollateralsAddress;
		holdefiSettings = holdefiSettingsAddress;
		holdefiPrices = holdefiPricesAddress;
	}

	modifier isNotETHAddress(address asset) {
        require (asset != ethAddress, "Asset should not be ETH address");
        _;
    }
	
	function supplyInternal (address market, uint256 amount) internal {
		(uint256 balance,uint256 interest,uint256 currentSupplyIndex) = getAccountSupply(msg.sender, market);
		
		supplies[msg.sender][market].accumulatedInterest = interest;
		supplies[msg.sender][market].balance = balance.add(amount);
		supplies[msg.sender][market].lastInterestIndex = currentSupplyIndex;

		updatePromotion(market);
		
		marketAssets[market].totalSupply = marketAssets[market].totalSupply.add(amount);

		emit Supply(msg.sender, market, amount);
	}

	// Deposit ERC20 assets for supplying (except ETH).
	function supply (address market, uint256 amount) external isNotETHAddress(market) whenNotPaused(0) {
		bool isActive = holdefiSettings.isMarketActive(market);
		require (isActive,'Market is not active');

		transferToHoldefi(address(this), market, amount);

		supplyInternal(market, amount);
	}

	// Deposit ETH for supplying
	function supply () payable external whenNotPaused(0) {
		address market = ethAddress;
		uint256 amount = msg.value;
		bool isActive = holdefiSettings.isMarketActive(market);
		require (isActive, 'Market is not active');
		
		supplyInternal(market, amount);
	}

	// Withdraw ERC20 assets from a market (include interests).
	function withdrawSupply (address market, uint256 amount) external whenNotPaused(1) {
		(uint256 balance,uint256 interest,uint256 currentSupplyIndex) = getAccountSupply(msg.sender, market);
		
		uint256 transferAmount;
		uint256 totalSuppliedBalance = balance.add(interest);

		require (totalSuppliedBalance != 0, 'Total balance should not be zero');
		if (amount <= totalSuppliedBalance){
			transferAmount = amount;
		}
		else {
			transferAmount = totalSuppliedBalance;
		}

		uint256 remaining;
		if (transferAmount <= interest) {
			supplies[msg.sender][market].accumulatedInterest = interest.sub(transferAmount);
		}
		else {
			remaining = transferAmount.sub(interest);
			supplies[msg.sender][market].accumulatedInterest = 0;
			supplies[msg.sender][market].balance = balance.sub(remaining);
		}
		supplies[msg.sender][market].lastInterestIndex = currentSupplyIndex;

		updatePromotion(market);
		
		marketAssets[market].totalSupply = marketAssets[market].totalSupply.sub(remaining);	

		transferFromHoldefi(msg.sender, market, transferAmount);
	
		emit WithdrawSupply(msg.sender, market, transferAmount);
	}

	function collateralizeInternal (address collateral, uint256 amount) internal {
		collaterals[msg.sender][collateral].balance = collaterals[msg.sender][collateral].balance.add(amount);
		collaterals[msg.sender][collateral].lastUpdateTime = block.timestamp;

		collateralAssets[collateral].totalCollateral = collateralAssets[collateral].totalCollateral.add(amount);	
		
		emit Collateralize(msg.sender, collateral, amount);
	}

	// Deposit ERC20 assets as collateral(except ETH) 
	function collateralize (address collateral, uint256 amount) external isNotETHAddress(collateral) whenNotPaused(2) {
		(bool isActive,,,) = holdefiSettings.getCollateral(collateral);
		require (isActive, 'Collateral asset is not active');

		transferToHoldefi(address(holdefiCollaterals), collateral, amount);

		collateralizeInternal(collateral, amount);
	}

	// Deposit ETH as collateral
	function collateralize () payable external whenNotPaused(2) {
		address collateral = ethAddress;
		uint256 amount = msg.value;
		(bool isActive,,,) = holdefiSettings.getCollateral(collateral);
		require (isActive, 'Collateral asset is not active');

		transferFromHoldefi(address(holdefiCollaterals), collateral, amount);

		collateralizeInternal(collateral, amount);
	}

	// Withdraw collateral assets
	function withdrawCollateral (address collateral, uint256 amount) external whenNotPaused(3) {
		(uint256 balance, ,uint256 borrowPowerValue,uint256 totalBorrowValue,) = getAccountCollateral(msg.sender, collateral);	
		require (borrowPowerValue != 0, 'Borrow power should not be zero');

		uint256 maxWithdraw;
		if (totalBorrowValue == 0) {
			maxWithdraw = balance;
		}
		else {
			uint256 collateralPrice = holdefiPrices.getPrice(collateral);
			(,uint256 valueToLoanRate,,) = holdefiSettings.getCollateral(collateral);
			uint256 totalCollateralValue = totalBorrowValue.mul(valueToLoanRate).div(rateDecimals);	
			uint256 collateralNedeed = totalCollateralValue.div(collateralPrice);

			maxWithdraw = balance.sub(collateralNedeed);
		}

		uint256 transferAmount;
		if (amount < maxWithdraw){
			transferAmount = amount;
		}
		else {
			transferAmount = maxWithdraw;
		}

		collaterals[msg.sender][collateral].balance = balance.sub(transferAmount);
		collaterals[msg.sender][collateral].lastUpdateTime = block.timestamp;

		collateralAssets[collateral].totalCollateral = collateralAssets[collateral].totalCollateral.sub(transferAmount);

		holdefiCollaterals.withdraw(collateral, msg.sender, transferAmount);

		emit WithdrawCollateral(msg.sender, collateral, transferAmount);
	}

	// Borrow a `market` asset based on a `collateral` power 
	function borrow (address market, address collateral, uint256 amount) external whenNotPaused(4) {
		bool isActiveMarket = holdefiSettings.isMarketActive(market);
		(bool isActiveCollateral,,,) = holdefiSettings.getCollateral(collateral);
		require (isActiveMarket && isActiveCollateral
				,'Market or Collateral asset is not active');

		uint256 maxAmount = marketAssets[market].totalSupply.sub(marketAssets[market].totalBorrow);
		require (amount <= maxAmount, 'Amount should be less than cash');

		(,,uint256 borrowPowerValue,,) = getAccountCollateral(msg.sender, collateral);	
		uint256 assetToBorrowPrice = holdefiPrices.getPrice(market);
		uint256 assetToBorrowValue = amount.mul(assetToBorrowPrice);
		require (borrowPowerValue > assetToBorrowValue, 'Borrow power should be more than new borrow value');

		(,uint256 interest,uint256 currentBorrowIndex) = getAccountBorrow(msg.sender, market, collateral);
		
		borrows[msg.sender][collateral][market].accumulatedInterest = interest;
		borrows[msg.sender][collateral][market].balance = borrows[msg.sender][collateral][market].balance.add(amount);
		borrows[msg.sender][collateral][market].lastInterestIndex = currentBorrowIndex;
		collaterals[msg.sender][collateral].lastUpdateTime = block.timestamp;

		updateSupplyIndex(market);
		updatePromotionReserve(market);

		marketAssets[market].totalBorrow = marketAssets[market].totalBorrow.add(amount);

		transferFromHoldefi(msg.sender, market, amount);

		emit Borrow(msg.sender, market, collateral, amount);
	}

	function repayBorrowInternal (address market, address collateral, uint256 amount) internal {
		(uint256 balance,uint256 interest,uint256 currentBorrowIndex) = getAccountBorrow(msg.sender, market, collateral);
		
		uint256 remaining;
		if (amount <= interest) {
			borrows[msg.sender][collateral][market].accumulatedInterest = interest.sub(amount);
		}
		else {
			remaining = amount.sub(interest);
			borrows[msg.sender][collateral][market].accumulatedInterest = 0;
			borrows[msg.sender][collateral][market].balance = balance.sub(remaining);
		}
		borrows[msg.sender][collateral][market].lastInterestIndex = currentBorrowIndex;
		collaterals[msg.sender][collateral].lastUpdateTime = block.timestamp;

		updateSupplyIndex(market);
		updatePromotionReserve(market);
		
		marketAssets[market].totalBorrow = marketAssets[market].totalBorrow.sub(remaining);	

		emit Borrow (msg.sender, market, collateral, amount);
	}

	// Repay borrow a `market` token based on a `collateral` power
	function repayBorrow (address market, address collateral, uint256 amount) external isNotETHAddress(market) whenNotPaused(5) {
		(uint256 balance, uint256 interest,) = getAccountBorrow(msg.sender, market, collateral);
		
		uint256 transferAmount;
		uint256 totalBorrowedBalance = balance.add(interest);
		require (totalBorrowedBalance != 0, 'Total balance should not be zero');
		if (amount <= totalBorrowedBalance){
			transferAmount = amount;
		}
		else {
			transferAmount = totalBorrowedBalance;
		}

		transferToHoldefi(address(this), market, transferAmount);

		repayBorrowInternal(market, collateral, transferAmount);
	}

	// Repay borrow ETH based on a `collateral` power
	function repayBorrow (address collateral) payable external whenNotPaused(5) {
		address market = ethAddress;
		uint256 amount = msg.value;		

		(uint256 balance,uint256 interest,) = getAccountBorrow(msg.sender, market, collateral);
		
		uint256 transferAmount;
		uint256 totalBorrowedBalance = balance.add(interest);
		require (totalBorrowedBalance != 0, 'Total balance should not be zero');
		if (amount <= totalBorrowedBalance) {
			transferAmount = amount;
		}
		else {
			transferAmount = totalBorrowedBalance;
			uint256 extra = amount.sub(totalBorrowedBalance);
			transferFromHoldefi(msg.sender, ethAddress, extra);
		}

		repayBorrowInternal(market, collateral, transferAmount);
	}

	function clearDebts (address borrower, address collateral) internal {
		address market;
		uint256 borrowBalance;
		uint256 borrowInterest;
		uint256 borrowInterestIndex;
		uint256 totalBorrowedBalance;
		address[] memory marketsList = holdefiSettings.getMarketsList();
		for (uint256 i=0; i<marketsList.length; i++) {
			market = marketsList[i];
			
			(borrowBalance,borrowInterest,borrowInterestIndex) = getAccountBorrow(borrower, market, collateral);
			totalBorrowedBalance = borrowBalance.add(borrowInterest);
			if (totalBorrowedBalance > 0) {
				borrows[borrower][collateral][market].balance = 0;
				borrows[borrower][collateral][market].accumulatedInterest = 0;
				borrows[borrower][collateral][market].lastInterestIndex = borrowInterestIndex;
				updateSupplyIndex(market);
				updatePromotionReserve(market);		
				marketAssets[market].totalBorrow = marketAssets[market].totalBorrow.sub(borrowBalance);
				marketDebt[collateral][market] = marketDebt[collateral][market].add(totalBorrowedBalance);
				emit NewMarketDebt(borrower, market, collateral, totalBorrowedBalance);
			}
		}
	}
	
	// Liquidate borrower's collateral
	function liquidateBorrowerCollateral (address borrower, address collateral) external whenNotPaused(6) {
		(,uint256 timeSinceLastActivity,,uint256 totalBorrowValue, bool underCollateral) = getAccountCollateral(borrower, collateral);
		
		require (underCollateral || (timeSinceLastActivity > secondsPerYear), 'User should be under collateral or time is over');

		uint256 collateralPrice = holdefiPrices.getPrice(collateral);
		(,,uint256 penaltyRate,) = holdefiSettings.getCollateral(collateral);
		uint256 liquidatedCollateralValue = totalBorrowValue.mul(penaltyRate).div(rateDecimals);
		uint256 liquidatedCollateral = liquidatedCollateralValue.div(collateralPrice);

		if (liquidatedCollateral > collaterals[borrower][collateral].balance) {
			liquidatedCollateral = collaterals[borrower][collateral].balance;
		}

		collaterals[borrower][collateral].balance = collaterals[borrower][collateral].balance.sub(liquidatedCollateral);
		collateralAssets[collateral].totalCollateral = collateralAssets[collateral].totalCollateral.sub(liquidatedCollateral);
		collateralAssets[collateral].totalLiquidatedCollateral = collateralAssets[collateral].totalLiquidatedCollateral.add(liquidatedCollateral);
		collaterals[msg.sender][collateral].lastUpdateTime = block.timestamp;

		clearDebts(borrower, collateral);

		emit CollateralLiquidated(borrower, collateral, liquidatedCollateral);	
	}

	function buyLiquidatedCollateralInternal (address market, address collateral, uint256 marketAmount, uint256 collateralAmountWithDiscount) internal {
		collateralAssets[collateral].totalLiquidatedCollateral = collateralAssets[collateral].totalLiquidatedCollateral.sub(collateralAmountWithDiscount);
		marketDebt[collateral][market] = marketDebt[collateral][market].sub(marketAmount);

		holdefiCollaterals.withdraw(collateral, msg.sender, collateralAmountWithDiscount);

		emit BuyLiquidatedCollateral(market, collateral, marketAmount);
	}

	// Buy `collateral` in exchange for `market` token
	function buyLiquidatedCollateral (address market, address collateral, uint256 marketAmount) external isNotETHAddress(market) whenNotPaused(7) {
		require (marketAmount <= marketDebt[collateral][market], 'Amount should be less than total liquidated assets');

		uint256 collateralAmountWithDiscount = getDiscountedCollateralAmount(market, collateral, marketAmount);

		require (collateralAmountWithDiscount <= collateralAssets[collateral].totalLiquidatedCollateral, 'Collateral amount with discount should be less than total liquidated assets');

		transferToHoldefi(address(this), market, marketAmount);

		buyLiquidatedCollateralInternal(market, collateral, marketAmount, collateralAmountWithDiscount);
	}

	// Buy `collateral` in exchange for ETH 
	function buyLiquidatedCollateral (address collateral) external payable whenNotPaused(7) {
		address market = ethAddress;
		uint256 marketAmount = msg.value;

		require (marketAmount <= marketDebt[collateral][market], 'Amount should be less than total liquidated assets');

		uint256 collateralAmountWithDiscount = getDiscountedCollateralAmount(market, collateral, marketAmount);

		require (collateralAmountWithDiscount <= collateralAssets[collateral].totalLiquidatedCollateral, 'Collateral amount with discount should be less than total liquidated assets');

		buyLiquidatedCollateralInternal(market, collateral, marketAmount, collateralAmountWithDiscount);
	}

	// Returns amount of discounted collateral that buyer can buy by paying `market` asset
	function getDiscountedCollateralAmount (address market, address collateral, uint256 marketAmount) public view returns(uint256 collateralAmountWithDiscount) {
		uint256 marketPrice = holdefiPrices.getPrice(market);
		uint256 marketValue = marketAmount.mul(marketPrice);

		uint256 collateralPrice = holdefiPrices.getPrice(collateral);
		(,,,uint256 bonusRate) = holdefiSettings.getCollateral(collateral);
		uint256 collateralValue = marketValue.mul(bonusRate).div(rateDecimals);
		collateralAmountWithDiscount = collateralValue.div(collateralPrice);
	}
	
	// Returns supply and borrow index for a given `market` at current time 
	function getCurrentInterestIndex (address market) public view returns(uint256 supplyIndex, uint256 supplyRate, uint256 borrowIndex, uint256 borrowRate, uint256 currentTime) {
		uint256 supplyRateBase;
		(borrowRate,supplyRateBase) = holdefiSettings.getInterests(market, marketAssets[market].totalSupply, marketAssets[market].totalBorrow);
		
		currentTime = block.timestamp;
		supplyRate = supplyRateBase.add(marketAssets[market].promotionRate);

		uint256 deltaTimeSupply = currentTime.sub(marketAssets[market].supplyIndexUpdateTime);

		uint256 deltaTimeBorrow = currentTime.sub(marketAssets[market].borrowIndexUpdateTime);

		uint256 deltaTimeInterest = deltaTimeSupply.mul(supplyRate);
		supplyIndex = marketAssets[market].supplyIndex.add(deltaTimeInterest);

		deltaTimeInterest = deltaTimeBorrow.mul(borrowRate);
		borrowIndex = marketAssets[market].borrowIndex.add(deltaTimeInterest);
	}

	function getCurrentPromotion (address market) public view returns(uint256 promotionReserveScaled, uint256 promotionDebtScaled, uint256 currentTime) {
		(uint256 borrowRate, uint256 supplyRateBase) = holdefiSettings.getInterests(market, marketAssets[market].totalSupply, marketAssets[market].totalBorrow);
		
		currentTime = block.timestamp;
	
		uint256 allSupplyInterest = marketAssets[market].totalSupply.mul(supplyRateBase);
		uint256 allBorrowInterest = marketAssets[market].totalBorrow.mul(borrowRate);

		uint256 deltaTime = currentTime.sub(marketAssets[market].promotionReserveLastUpdateTime);
		uint256 currentInterest = allBorrowInterest.sub(allSupplyInterest);
		uint256 deltaTimeInterest = currentInterest.mul(deltaTime);
		promotionReserveScaled = marketAssets[market].promotionReserveScaled.add(deltaTimeInterest);

		if (marketAssets[market].promotionRate != 0){
			deltaTime = currentTime.sub(marketAssets[market].promotionDebtLastUpdateTime);
			currentInterest = marketAssets[market].totalSupply.mul(marketAssets[market].promotionRate);
			deltaTimeInterest = currentInterest.mul(deltaTime);
			promotionDebtScaled = marketAssets[market].promotionDebtScaled.add(deltaTimeInterest);
		}
		else {
			promotionDebtScaled = marketAssets[market].promotionDebtScaled;
		}
	}

	// Update a `market` supply interest index and promotion reserve
	function updateSupplyIndex (address market) public {
		(uint256 currentSupplyIndex,uint256 supplyRate,,,uint256 currentTime) = getCurrentInterestIndex(market);

		marketAssets[market].supplyIndex = currentSupplyIndex;
		marketAssets[market].supplyIndexUpdateTime = currentTime;

		emit UpdateSupplyIndex(market, currentSupplyIndex, supplyRate);
	}

	// Update a `market` borrow interest index 
	function updateBorrowIndex (address market) public {
		(,,uint256 currentBorrowIndex,,uint256 currentTime) = getCurrentInterestIndex(market);

		marketAssets[market].borrowIndex = currentBorrowIndex;
		marketAssets[market].borrowIndexUpdateTime = currentTime;

		emit UpdateBorrowIndex(market, currentBorrowIndex);
	}

	function updatePromotionReserve(address market) public {
		(uint256 reserveScaled,,uint256 currentTime) = getCurrentPromotion(market);

		marketAssets[market].promotionReserveScaled = reserveScaled;
		marketAssets[market].promotionReserveLastUpdateTime = currentTime;
	}

	// Subtract users promotion from promotionReserve for a `market` and update promotionDebt and promotionRate if needed
	function updatePromotion(address market) public {
		updateSupplyIndex(market);
		updatePromotionReserve(market);
		(uint256 reserveScaled,uint256 debtScaled,uint256 currentTime) = getCurrentPromotion(market);
		if (marketAssets[market].promotionRate != 0){
			marketAssets[market].promotionDebtScaled = debtScaled;
			marketAssets[market].promotionDebtLastUpdateTime = currentTime;

			if (debtScaled > reserveScaled) {
				marketAssets[market].promotionRate = 0;
				emit PromotionRateChanged(market, 0);
			}
		}
	}

	// Returns balance and interest of an `account` for a given `market`
	function getAccountSupply(address account, address market) public view returns(uint256 balance, uint256 interest, uint256 currentSupplyIndex) {
		balance = supplies[account][market].balance;

		(currentSupplyIndex,,,,) = getCurrentInterestIndex(market);

		uint256 deltaInterestIndex = currentSupplyIndex.sub(supplies[account][market].lastInterestIndex);
		uint256 deltaInterestScaled = deltaInterestIndex.mul(balance);
		uint256 deltaInterest = deltaInterestScaled.div(secondsPerYear);
		deltaInterest = deltaInterest.div(rateDecimals);
		
		interest = supplies[account][market].accumulatedInterest.add(deltaInterest);
	}

	// Returns balance and interest of an `account` for a given `market` based on a `collateral` power
	function getAccountBorrow(address account, address market, address collateral) public view returns(uint256 balance, uint256 interest, uint256 currentBorrowIndex) {
		balance = borrows[account][collateral][market].balance;

		(,,currentBorrowIndex,,) = getCurrentInterestIndex(market);

		uint256 deltaInterestIndex = currentBorrowIndex.sub(borrows[account][collateral][market].lastInterestIndex);
		uint256 deltaInterestScaled = deltaInterestIndex.mul(balance);
		uint256 deltaInterest = deltaInterestScaled.div(secondsPerYear);
		deltaInterest = deltaInterest.div(rateDecimals);
		if (balance > 0) {
			deltaInterest = deltaInterest.add(1);
		}

		interest = borrows[account][collateral][market].accumulatedInterest.add(deltaInterest);
	}

	// Returns total borrow value of an `account` based on a `collateral` power
	function getAccountTotalBorrowValue (address account, address collateral) public view returns(uint256 totalBorrowValue) {
		address market;
		uint256 balance;
		uint256 interest;
		uint256 totalDebt;
		uint256 assetPrice;
		uint256 assetValue;
		
		address[] memory marketsList = holdefiSettings.getMarketsList();
		for (uint256 i=0; i<marketsList.length; i++) {
			market = marketsList[i];
			
			(balance, interest,) = getAccountBorrow(account, market, collateral);
			totalDebt = balance.add(interest);

			assetPrice = holdefiPrices.getPrice(market);
			assetValue = totalDebt.mul(assetPrice);

			totalBorrowValue = totalBorrowValue.add(assetValue); //scaled by: 18 (priceDecimal)
		}
	}

	// Returns collateral balance, time since last activity, borrow power and total borrow value of an `account` for a given `collateral` 
	function getAccountCollateral(address account, address collateral) public view returns(uint256 balance, uint256 timeSinceLastActivity, uint256 borrowPowerValue, uint256 totalBorrowValue, bool underCollateral) {
		balance = collaterals[account][collateral].balance;

		uint256 collateralPrice = holdefiPrices.getPrice(collateral);
		uint256 collateralValue = balance.mul(collateralPrice);
		(,uint256 valueToLoanRate,,) = holdefiSettings.getCollateral(collateral);
		uint256 totalBorrowPowerValue = collateralValue.mul(rateDecimals).div(valueToLoanRate);
		uint256 liquidationThresholdRate = valueToLoanRate.sub(500);
		uint256 liquidationThresholdValue = collateralValue.mul(rateDecimals).div(liquidationThresholdRate);

		totalBorrowValue = getAccountTotalBorrowValue(account, collateral);
		if (totalBorrowValue > 0) {
			timeSinceLastActivity = block.timestamp.sub(collaterals[account][collateral].lastUpdateTime);
		}	
		if (totalBorrowValue < totalBorrowPowerValue) {
			borrowPowerValue = totalBorrowPowerValue.sub(totalBorrowValue);
		}	
		if (totalBorrowValue > liquidationThresholdValue) {
			underCollateral = true;
		}
	}

	// Returns liquidation reserve
	function getLiquidationReserve (address collateral) public view returns(uint256 reserve) {
		address market;
		uint256 assetPrice;
		uint256 assetValue;
		uint256 totalDebtValue = 0;

		address[] memory marketsList = holdefiSettings.getMarketsList();
		for (uint256 i=0; i<marketsList.length; i++) {
			market = marketsList[i];

			assetPrice = holdefiPrices.getPrice(market);
			assetValue = marketDebt[collateral][market].mul(assetPrice);

			totalDebtValue = totalDebtValue.add(assetValue); 
		}

		uint256 collateralPrice = holdefiPrices.getPrice(collateral);
		(,,,uint256 bonusRate) = holdefiSettings.getCollateral(collateral);
		uint256 totalDebtCollateralValue = totalDebtValue.mul(bonusRate).div(rateDecimals);
		uint256 liquidatedCollateralNeeded = totalDebtCollateralValue.div(collateralPrice);
		
		if (collateralAssets[collateral].totalLiquidatedCollateral > liquidatedCollateralNeeded) {
			reserve = collateralAssets[collateral].totalLiquidatedCollateral.sub(liquidatedCollateralNeeded);
		}
	}

	// Withdraw liquidation reserve by owner
	function withdrawLiquidationReserve (address collateral, uint256 amount) external onlyOwner {
		uint256 maxWithdraw = getLiquidationReserve(collateral);
		uint256 transferAmount;
		
		if (amount <= maxWithdraw){
			transferAmount = amount;
		}
		else {
			transferAmount = maxWithdraw;
		}

		collateralAssets[collateral].totalLiquidatedCollateral = collateralAssets[collateral].totalLiquidatedCollateral.sub(transferAmount);
		holdefiCollaterals.withdraw(collateral, msg.sender, transferAmount);
	}

	function depositPromotionReserveInternal (address market, uint256 amount) internal {
		(uint256 reserveScaled,uint256 debtScaled,uint256 currentTime) = getCurrentPromotion(market);

		uint256 amountScaled = amount.mul(secondsPerYear).mul(rateDecimals);

		uint256 totalReserve = reserveScaled.add(amountScaled);

		if (totalReserve <= debtScaled) {
			marketAssets[market].promotionReserveScaled = 0;
			marketAssets[market].promotionDebtScaled = debtScaled.sub(totalReserve);	
			if (marketAssets[market].promotionRate != 0) {
				updateSupplyIndex(market);
				marketAssets[market].promotionRate = 0;
				emit PromotionRateChanged(market, 0);
			}
		}
		else {
			marketAssets[market].promotionReserveScaled = totalReserve.sub(debtScaled);
			marketAssets[market].promotionDebtScaled = 0;
		}
		marketAssets[market].promotionReserveLastUpdateTime = currentTime;
		marketAssets[market].promotionDebtLastUpdateTime = currentTime;
	}

	// Deposit ERC20 asset as promotion reserve 
	function depositPromotionReserve (address market, uint256 amount) external isNotETHAddress(market) {
		transferToHoldefi(address(this), market, amount);

		depositPromotionReserveInternal(market, amount);
	}

	// Deposit ETH as promotion reserve
	function depositPromotionReserve () payable external {
		address market = ethAddress;
		uint256 amount = msg.value;

		depositPromotionReserveInternal(market, amount);
	}

	// Withdraw promotion reserve by owner
	function withdrawPromotionReserve (address market, uint256 amount) external onlyOwner {
		(uint256 reserveScaled,uint256 debtScaled,uint256 currentTime) = getCurrentPromotion(market);

		require (reserveScaled > debtScaled, 'Promotion reserve should be more than promotion debt');
		
		uint256 maxWithdrawScaled = reserveScaled.sub(debtScaled);

		uint256 amountScaled = amount.mul(secondsPerYear).mul(rateDecimals);

	    require (amountScaled < maxWithdrawScaled, 'Amount should be less than max');

	    marketAssets[market].promotionReserveScaled = maxWithdrawScaled.sub(amountScaled);
	    marketAssets[market].promotionReserveLastUpdateTime = currentTime;
		marketAssets[market].promotionDebtScaled = 0;
		marketAssets[market].promotionDebtLastUpdateTime = currentTime;	

	    transferFromHoldefi(msg.sender, market, amount);
	}

	// Set promotion rate by owner
	function setPromotionRate (address market, uint256 newPromotionRate) external onlyOwner {
		require (newPromotionRate <= maxPromotionRate, 'Rate should be in allowed range');

		(uint256 reserveScaled,uint256 debtScaled,uint256 currentTime) = getCurrentPromotion(market);

		require (reserveScaled > debtScaled, 'Promotion reserve should be more than promotion debt');
		
		updateSupplyIndex(market);
		marketAssets[market].promotionRate = newPromotionRate;
		marketAssets[market].promotionReserveScaled = reserveScaled.sub(debtScaled);
		marketAssets[market].promotionReserveLastUpdateTime = currentTime;
		marketAssets[market].promotionDebtScaled = 0;
		marketAssets[market].promotionDebtLastUpdateTime = currentTime;

		emit PromotionRateChanged(market, newPromotionRate);
	}

	// Set HoldefiPirce contract 
	function setHoldefiPricesContract (HoldefiPricesInterface newHoldefiPrices) external onlyOwner {
		require (!fixPrices, 'HoldefiPrices is fixed');
		
		HoldefiPricesInterface oldHoldefiPrices = holdefiPrices;
		holdefiPrices = newHoldefiPrices;

		emit HoldefiPricesContractChanged(newHoldefiPrices, oldHoldefiPrices);
	}

	// Fix HoldefiPrice contract 
	function fixHoldefiPricesContract () external onlyOwner {
		fixPrices = true;
	}


	function transferFromHoldefi(address receiver, address asset, uint256 amount) internal {
		bool success = false;
		if (asset == ethAddress){
			(success, ) = receiver.call{value:amount}("");
		}
		else {
			ERC20 token = ERC20(asset);
			success = token.transfer(receiver, amount);
		}
		require (success, "Cannot Transfer");
	}

	function transferToHoldefi(address receiver, address asset, uint256 amount) internal {
		ERC20 token = ERC20(asset);
		bool success = token.transferFrom(msg.sender, receiver, amount);
		require (success, "Cannot Transfer");
	}

    receive() external payable {
        revert();
    }
}