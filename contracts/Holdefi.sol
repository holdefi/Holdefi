// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./HoldefiPausableOwnable.sol";
import "./HoldefiCollaterals.sol";

/// @notice File: contracts/HoldefiPrices.sol
interface HoldefiPricesInterface {
	function getAssetValueFromAmount(address asset, uint256 amount) external view returns(uint256 value);
	function getAssetAmountFromValue(address asset, uint256 value) external view returns(uint256 amount);	
}


// File: contracts/HoldefiSettings.sol
interface HoldefiSettingsInterface {

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

	function getInterests(address market)
		external
		view
		returns (uint256 borrowRate, uint256 supplyRateBase, uint256 promotionRate);
	function resetPromotionRate (address market) external;
	function getMarketsList() external view returns(address[] memory marketsList);
	function marketAssets(address market) external view returns(MarketSettings memory);
	function collateralAssets(address collateral) external view returns(CollateralSettings memory);
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

	// For round up borrow interests
	uint256 constant private oneUnit = 1;

	// Used for calculating liquidation threshold 
	// There is 5% gap between value to loan rate and liquidation rate
	uint256 constant private fivePercentLiquidationGap = 500;

	// Markets are assets that can be supplied and borrowed
	struct Market {
		uint256 totalSupply;
		uint256 supplyIndex;      //Scaled by: secondsPerYear * rateDecimals
		uint256 supplyIndexUpdateTime;

		uint256 totalBorrow;
		uint256 borrowIndex;      //Scaled by: secondsPerYear * rateDecimals
		uint256 borrowIndexUpdateTime;

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
	HoldefiCollaterals public holdefiCollaterals;

	// ----------- Events -----------

	event Supply(address supplier, address market, uint256 amount);

	event WithdrawSupply(address supplier, address market, uint256 amount);

	event Collateralize(address collateralizer, address collateral, uint256 amount);

	event WithdrawCollateral(address collateralizer, address collateral, uint256 amount);

	event Borrow(address borrower, address market, address collateral, uint256 amount);

	event RepayBorrow(address borrower, address market, address collateral, uint256 amount);

	event UpdateSupplyIndex(address market, uint256 newSupplyIndex, uint256 supplyRate);

	event UpdateBorrowIndex(address market, uint256 newBorrowIndex);

	event CollateralLiquidated(
		address borrower,
		address market,
		address collateral,
		uint256 marketDebt,
		uint256 liquidatedCollateral
	);

	event BuyLiquidatedCollateral(address market, address collateral, uint256 marketAmount);

	event HoldefiPricesContractChanged(address newAddress, address oldAddress);

	event LiquidationReserveWithdrawn(address collateral, uint256 amount);

	event PromotionReserveWithdrawn(address market, uint256 amount);

	event PromotionReserveDeposited(address market, uint256 amount);

	event PromotionReserveUpdated(address market, uint256 promotionReserve);

	event PromotionDebtUpdated(address market, uint256 promotionDebt);

	constructor(
		HoldefiSettingsInterface holdefiSettingsAddress,
		HoldefiPricesInterface holdefiPricesAddress
	)
		public
	{
		holdefiSettings = holdefiSettingsAddress;
		holdefiPrices = holdefiPricesAddress;
		holdefiCollaterals = new HoldefiCollaterals();
	}

	modifier isNotETHAddress(address asset) {
        require (asset != ethAddress, "Asset should not be ETH address");
        _;
    }

    modifier marketIsActive(address market) {
		require (holdefiSettings.marketAssets(market).isActive, "Market is not active");
        _;
    }

    modifier collateralIsActive(address collateral) {
		require (holdefiSettings.collateralAssets(collateral).isActive, "Collateral is not active");
		_;
    }

	// Deposit ERC20 assets for supplying (except ETH).
	function supply (address market, uint256 amount) external isNotETHAddress(market) {
		supplyInternal(market, amount);
	}

	// Deposit ETH for supplying
	function supply () payable external whenNotPaused("supply") {	
		supplyInternal(ethAddress, msg.value);
	}

	// Withdraw ERC20 assets from a market (include interests).
	function withdrawSupply (address market, uint256 amount) external {
		withdrawSupplyInternal(market, amount);
	}

	// Deposit ERC20 assets as collateral(except ETH) 
	function collateralize (address collateral, uint256 amount) external isNotETHAddress(collateral) {
		collateralizeInternal(collateral, amount);
	}

	// Deposit ETH as collateral
	function collateralize () payable external {
		collateralizeInternal(ethAddress, msg.value);
	}

	// Withdraw collateral assets
	function withdrawCollateral (address collateral, uint256 amount) external {
		withdrawCollateralInternal(collateral, amount);
	}

	// Borrow a `market` asset based on a `collateral` power 
	function borrow (address market, address collateral, uint256 amount) external {
		borrowInternal(market, collateral, amount);
	}

	// Repay borrow a `market` token based on a `collateral` power
	function repayBorrow (address market, address collateral, uint256 amount) external isNotETHAddress(market) {
		repayBorrowInternal(market, collateral, amount);
	}

	// Repay borrow ETH based on a `collateral` power
	function repayBorrow (address collateral) payable external {
		repayBorrowInternal(ethAddress, collateral, msg.value);
	}

	
	// Liquidate borrower's collateral
	function liquidateBorrowerCollateral (address borrower, address market, address collateral)
		external
		whenNotPaused("liquidateBorrowerCollateral")
	{
		(uint256 borrowBalance, uint256 borrowInterest,) = getAccountBorrow(borrower, market, collateral);
		require(borrowBalance > 0, "User should have debt for the market");

		(,uint256 timeSinceLastActivity,,, bool underCollateral) = getAccountCollateral(borrower, collateral);
		require (underCollateral || (timeSinceLastActivity > secondsPerYear),
			"User should be under collateral or time is over"
		);

		uint256 totalBorrowedBalance = borrowBalance.add(borrowInterest);
		uint256 totalBorrowedBalanceValue = holdefiPrices.getAssetValueFromAmount(market, totalBorrowedBalance);
		
		uint256 liquidatedCollateralValue = totalBorrowedBalanceValue
		.mul(holdefiSettings.collateralAssets(collateral).penaltyRate)
		.div(rateDecimals);

		uint256 liquidatedCollateral =
			holdefiPrices.getAssetAmountFromValue(collateral, liquidatedCollateralValue);

		if (liquidatedCollateral > collaterals[borrower][collateral].balance) {
			liquidatedCollateral = collaterals[borrower][collateral].balance;
		}

		collaterals[borrower][collateral].balance =
			collaterals[borrower][collateral].balance.sub(liquidatedCollateral);
		collateralAssets[collateral].totalCollateral =
			collateralAssets[collateral].totalCollateral.sub(liquidatedCollateral);
		collateralAssets[collateral].totalLiquidatedCollateral =
			collateralAssets[collateral].totalLiquidatedCollateral.add(liquidatedCollateral);

		delete borrows[borrower][collateral][market];
		beforeChangeSupplyRate(market);
		marketAssets[market].totalBorrow = marketAssets[market].totalBorrow.sub(borrowBalance);
		marketDebt[collateral][market] = marketDebt[collateral][market].add(totalBorrowedBalance);

		emit CollateralLiquidated(borrower, market, collateral, totalBorrowedBalance, liquidatedCollateral);	
	}

	// Buy `collateral` in exchange for `market` token
	function buyLiquidatedCollateral (address market, address collateral, uint256 marketAmount)
		external
		isNotETHAddress(market)
	{
		buyLiquidatedCollateralInternal(market, collateral, marketAmount);
	}

	function buyLiquidatedCollateral (address collateral) external payable {
		buyLiquidatedCollateralInternal(ethAddress, collateral, msg.value);
	}

	// Returns amount of discounted collateral that buyer can buy by paying `market` asset
	function getDiscountedCollateralAmount (address market, address collateral, uint256 marketAmount) public view returns(uint256 collateralAmountWithDiscount) {
		uint256 marketValue = holdefiPrices.getAssetValueFromAmount(market, marketAmount);
		uint256 bonusRate = holdefiSettings.collateralAssets(collateral).bonusRate;
		uint256 collateralValue = marketValue.mul(bonusRate).div(rateDecimals);
		collateralAmountWithDiscount = holdefiPrices.getAssetAmountFromValue(collateral, collateralValue);
	}
	

	function getCurrentSupplyIndex (address market)
		public
		view
		returns (
			uint256 supplyIndex,
			uint256 supplyRate,
			uint256 currentTime
		)
	{
		(, uint256 supplyRateBase, uint256 promotionRate) = holdefiSettings.getInterests(market);
		
		currentTime = block.timestamp;
		uint256 deltaTimeSupply = currentTime.sub(marketAssets[market].supplyIndexUpdateTime);

		supplyRate = supplyRateBase.add(promotionRate);
		uint256 deltaTimeInterest = deltaTimeSupply.mul(supplyRate);
		supplyIndex = marketAssets[market].supplyIndex.add(deltaTimeInterest);
	}

	function getCurrentBorrowIndex (address market)
		public
		view
		returns (
			uint256 borrowIndex,
			uint256 borrowRate,
			uint256 currentTime
		)
	{
		borrowRate = holdefiSettings.marketAssets(market).borrowRate;
		
		currentTime = block.timestamp;
		uint256 deltaTimeBorrow = currentTime.sub(marketAssets[market].borrowIndexUpdateTime);

		uint256 deltaTimeInterest = deltaTimeBorrow.mul(borrowRate);
		borrowIndex = marketAssets[market].borrowIndex.add(deltaTimeInterest);
	}

	function getPromotionReserve (address market)
		public
		view
		returns (uint256 promotionReserveScaled, uint256 currentTime)
	{
		(uint256 borrowRate, uint256 supplyRateBase,) = holdefiSettings.getInterests(market);
		currentTime = block.timestamp;
	
		uint256 allSupplyInterest = marketAssets[market].totalSupply.mul(supplyRateBase);
		uint256 allBorrowInterest = marketAssets[market].totalBorrow.mul(borrowRate);

		uint256 deltaTime = currentTime.sub(marketAssets[market].promotionReserveLastUpdateTime);
		uint256 currentInterest = allBorrowInterest.sub(allSupplyInterest);
		uint256 deltaTimeInterest = currentInterest.mul(deltaTime);
		promotionReserveScaled = marketAssets[market].promotionReserveScaled.add(deltaTimeInterest);
	}

	function getPromotionDebt (address market)
		public
		view
		returns (uint256 promotionDebtScaled, uint256 currentTime)
	{
		uint256 promotionRate = holdefiSettings.marketAssets(market).promotionRate;

		currentTime = block.timestamp;
		promotionDebtScaled = marketAssets[market].promotionDebtScaled;

		if (promotionRate != 0) {
			uint256 deltaTime = block.timestamp.sub(marketAssets[market].promotionDebtLastUpdateTime);
			uint256 currentInterest = marketAssets[market].totalSupply.mul(promotionRate);
			uint256 deltaTimeInterest = currentInterest.mul(deltaTime);
			promotionDebtScaled = promotionDebtScaled.add(deltaTimeInterest);
		}
	}

	// Update a `market` supply interest index and promotion reserve
	function updateSupplyIndex (address market) public {
		(uint256 currentSupplyIndex, uint256 supplyRate, uint256 currentTime) =
			getCurrentSupplyIndex(market);

		marketAssets[market].supplyIndex = currentSupplyIndex;
		marketAssets[market].supplyIndexUpdateTime = currentTime;

		emit UpdateSupplyIndex(market, currentSupplyIndex, supplyRate);
	}

	// Update a `market` borrow interest index 
	function updateBorrowIndex (address market) public {
		(uint256 currentBorrowIndex,, uint256 currentTime) = getCurrentBorrowIndex(market);

		marketAssets[market].borrowIndex = currentBorrowIndex;
		marketAssets[market].borrowIndexUpdateTime = currentTime;

		emit UpdateBorrowIndex(market, currentBorrowIndex);
	}

	function updatePromotionReserve(address market) public {
		(uint256 reserveScaled,) = getPromotionReserve(market);

		marketAssets[market].promotionReserveScaled = reserveScaled;
		marketAssets[market].promotionReserveLastUpdateTime = block.timestamp;

		emit PromotionReserveUpdated(market, reserveScaled);
	}

	function updatePromotionDebt(address market) internal {
    	(uint256 debtScaled,) = getPromotionDebt(market);
    	if (marketAssets[market].promotionDebtScaled != debtScaled){
      		marketAssets[market].promotionDebtScaled = debtScaled;
      		marketAssets[market].promotionDebtLastUpdateTime = block.timestamp;

      		emit PromotionDebtUpdated(market, debtScaled);
    	}
    	if (marketAssets[market].promotionReserveScaled <= marketAssets[market].promotionDebtScaled) {
      		holdefiSettings.resetPromotionRate(market);
    	}
  	}

  	function beforeChangeSupplyRate (address market) public {
		updateSupplyIndex(market);
		updatePromotionReserve(market);
		updatePromotionDebt(market);
	}

	function beforeChangeBorrowRate (address market) external {
		updateBorrowIndex(market);
		beforeChangeSupplyRate(market);
	}

	// Returns balance and interest of an `account` for a given `market`
	function getAccountSupply(address account, address market) public view returns(uint256 balance, uint256 interest, uint256 currentSupplyIndex) {
		balance = supplies[account][market].balance;

		(currentSupplyIndex,,) = getCurrentSupplyIndex(market);

		uint256 deltaInterestIndex = currentSupplyIndex.sub(supplies[account][market].lastInterestIndex);
		uint256 deltaInterestScaled = deltaInterestIndex.mul(balance);
		uint256 deltaInterest = deltaInterestScaled.div(secondsPerYear).div(rateDecimals);
		
		interest = supplies[account][market].accumulatedInterest.add(deltaInterest);
	}

	// Returns balance and interest of an `account` for a given `market` based on a `collateral` power
	function getAccountBorrow(address account, address market, address collateral) public view returns(uint256 balance, uint256 interest, uint256 currentBorrowIndex) {
		balance = borrows[account][collateral][market].balance;

		(currentBorrowIndex,,) = getCurrentBorrowIndex(market);

		uint256 deltaInterestIndex = currentBorrowIndex.sub(borrows[account][collateral][market].lastInterestIndex);
		uint256 deltaInterestScaled = deltaInterestIndex.mul(balance);
		uint256 deltaInterest = deltaInterestScaled.div(secondsPerYear).div(rateDecimals);
		if (balance > 0) {
			deltaInterest = deltaInterest.add(oneUnit);
		}

		interest = borrows[account][collateral][market].accumulatedInterest.add(deltaInterest);
	}

	// Returns total borrow value of an `account` based on a `collateral` power
	function getAccountTotalBorrowValue (address account, address collateral) public view returns(uint256 totalBorrowValue) {
		address market;
		uint256 balance;
		uint256 interest;
		uint256 totalDebt;
		uint256 assetValue;
		
		totalBorrowValue = 0;
		address[] memory marketsList = holdefiSettings.getMarketsList();
		for (uint256 i = 0 ; i < marketsList.length ; i++) {
			market = marketsList[i];
			
			(balance, interest,) = getAccountBorrow(account, market, collateral);
			totalDebt = balance.add(interest);

			assetValue = holdefiPrices.getAssetValueFromAmount(market, totalDebt);
			totalBorrowValue = totalBorrowValue.add(assetValue);
		}
	}

	// Returns collateral balance, time since last activity, borrow power and total borrow value of an `account` for a given `collateral` 
	function getAccountCollateral(address account, address collateral) public view returns(uint256 balance, uint256 timeSinceLastActivity, uint256 borrowPowerValue, uint256 totalBorrowValue, bool underCollateral) {
		uint256 valueToLoanRate = holdefiSettings.collateralAssets(collateral).valueToLoanRate;
		if (valueToLoanRate == 0) {
			return (0, 0, 0, 0, false);
		}

		balance = collaterals[account][collateral].balance;

		uint256 collateralValue = holdefiPrices.getAssetValueFromAmount(collateral, balance);
		uint256 liquidationThresholdRate = valueToLoanRate.sub(fivePercentLiquidationGap);

		uint256 totalBorrowPowerValue = collateralValue.mul(rateDecimals).div(valueToLoanRate);
		uint256 liquidationThresholdValue = collateralValue.mul(rateDecimals).div(liquidationThresholdRate);

		totalBorrowValue = getAccountTotalBorrowValue(account, collateral);
		if (totalBorrowValue > 0) {
			timeSinceLastActivity = block.timestamp.sub(collaterals[account][collateral].lastUpdateTime);
		}

		borrowPowerValue = 0;
		if (totalBorrowValue < totalBorrowPowerValue) {
			borrowPowerValue = totalBorrowPowerValue.sub(totalBorrowValue);
		}

		underCollateral = false;	
		if (totalBorrowValue > liquidationThresholdValue) {
			underCollateral = true;
		}
	}

	// Returns liquidation reserve
	function getLiquidationReserve (address collateral) public view returns(uint256 reserve) {
		address market;
		uint256 assetValue;
		uint256 totalDebtValue = 0;

		address[] memory marketsList = holdefiSettings.getMarketsList();
		for (uint256 i=0; i<marketsList.length; i++) {
			market = marketsList[i];
			assetValue = holdefiPrices.getAssetValueFromAmount(market, marketDebt[collateral][market]);
			totalDebtValue = totalDebtValue.add(assetValue); 
		}

		uint256 bonusRate = holdefiSettings.collateralAssets(collateral).bonusRate;
		uint256 totalDebtCollateralValue = totalDebtValue.mul(bonusRate).div(rateDecimals);
		uint256 liquidatedCollateralNeeded = holdefiPrices.getAssetAmountFromValue(
			collateral,
			totalDebtCollateralValue
		);
		
		if (collateralAssets[collateral].totalLiquidatedCollateral > liquidatedCollateralNeeded) {
			reserve = collateralAssets[collateral].totalLiquidatedCollateral.sub(liquidatedCollateralNeeded);
		}
	}

	// Withdraw liquidation reserve by owner
	function withdrawLiquidationReserve (address collateral, uint256 amount) external onlyOwner {
		uint256 maxWithdraw = getLiquidationReserve(collateral);
		uint256 transferAmount = amount;
		if (transferAmount > maxWithdraw){
			transferAmount = maxWithdraw;
		}

		collateralAssets[collateral].totalLiquidatedCollateral = collateralAssets[collateral].totalLiquidatedCollateral.sub(transferAmount);
		holdefiCollaterals.withdraw(collateral, msg.sender, transferAmount);

		emit LiquidationReserveWithdrawn(collateral, amount);
	}

	// Deposit ERC20 asset as promotion reserve 
	function depositPromotionReserve (address market, uint256 amount) external isNotETHAddress(market) marketIsActive(market) {
		depositPromotionReserveInternal(market, amount);
	}

	// Deposit ETH as promotion reserve
	function depositPromotionReserve () payable external {
		depositPromotionReserveInternal(ethAddress, msg.value);
	}

	// Withdraw promotion reserve by owner
	function withdrawPromotionReserve (address market, uint256 amount) external onlyOwner {
	    (uint256 reserveScaled,) = getPromotionReserve(market);
	    (uint256 debtScaled,) = getPromotionDebt(market);

	    uint256 amountScaled = amount.mul(secondsPerYear).mul(rateDecimals);
	    uint256 increasedDebtScaled = amountScaled.add(debtScaled);
	    require (reserveScaled > increasedDebtScaled, "Amount should be less than max");

	    marketAssets[market].promotionReserveScaled = reserveScaled.sub(amountScaled);

	    transferFromHoldefi(msg.sender, market, amount);

	    emit PromotionReserveWithdrawn(market, amount);
	}

	function reserveSettlement (address market) external {
		require(msg.sender == address(holdefiSettings), "Sender should be Holdefi Settings contract");
		require(marketAssets[market].promotionReserveScaled > marketAssets[market].promotionDebtScaled, "Not enough promotion reserve");
		
		marketAssets[market].promotionReserveScaled = 
			marketAssets[market].promotionReserveScaled.sub(marketAssets[market].promotionDebtScaled);
		marketAssets[market].promotionDebtScaled = 0;

		marketAssets[market].promotionReserveLastUpdateTime = block.timestamp;
		marketAssets[market].promotionDebtLastUpdateTime = block.timestamp;

		emit PromotionReserveUpdated(market, marketAssets[market].promotionReserveScaled);
		emit PromotionDebtUpdated(market, 0);
	}

	// Set HoldefiPirce contract 
	function setHoldefiPricesContract (HoldefiPricesInterface newHoldefiPrices) external onlyOwner {
		emit HoldefiPricesContractChanged(address(newHoldefiPrices), address(holdefiPrices));
		holdefiPrices = newHoldefiPrices;
	}

	function transferFromHoldefi(address receiver, address asset, uint256 amount) internal {
		bool success = false;
		if (asset == ethAddress){
			(success, ) = receiver.call{value:amount}("");
		}
		else {
			IERC20 token = IERC20(asset);
			success = token.transfer(receiver, amount);
		}
		require (success, "Cannot Transfer");
	}

	function transferToHoldefi(address receiver, address asset, uint256 amount) internal {
		IERC20 token = IERC20(asset);
		bool success = token.transferFrom(msg.sender, receiver, amount);
		require (success, "Cannot Transfer");
	}

	function supplyInternal(address market, uint256 amount)
		internal
		whenNotPaused("supply")
		marketIsActive(market)
	{
		if (market != ethAddress) {
			transferToHoldefi(address(this), market, amount);
		}

		(uint256 balance, uint256 interest, uint256 currentSupplyIndex) = getAccountSupply(msg.sender, market);
		
		supplies[msg.sender][market].accumulatedInterest = interest;
		supplies[msg.sender][market].balance = balance.add(amount);
		supplies[msg.sender][market].lastInterestIndex = currentSupplyIndex;

		beforeChangeSupplyRate(market);
		
		marketAssets[market].totalSupply = marketAssets[market].totalSupply.add(amount);

		emit Supply(msg.sender, market, amount);
	}

	function withdrawSupplyInternal (address market, uint256 amount) 
		internal
		whenNotPaused("withdrawSupply")
	{
		(uint256 balance, uint256 interest, uint256 currentSupplyIndex) = getAccountSupply(msg.sender, market);
		uint256 totalSuppliedBalance = balance.add(interest);
		require (totalSuppliedBalance != 0, "Total balance should not be zero");

		uint256 transferAmount = amount;
		if (transferAmount > totalSuppliedBalance){
			transferAmount = totalSuppliedBalance;
		}

		uint256 remaining = 0;
		if (transferAmount <= interest) {
			supplies[msg.sender][market].accumulatedInterest = interest.sub(transferAmount);
		}
		else {
			remaining = transferAmount.sub(interest);
			supplies[msg.sender][market].accumulatedInterest = 0;
			supplies[msg.sender][market].balance = balance.sub(remaining);
		}
		supplies[msg.sender][market].lastInterestIndex = currentSupplyIndex;

		beforeChangeSupplyRate(market);
		
		marketAssets[market].totalSupply = marketAssets[market].totalSupply.sub(remaining);	
		
		transferFromHoldefi(msg.sender, market, transferAmount);
	
		emit WithdrawSupply(msg.sender, market, transferAmount);
	}

	function collateralizeInternal (address collateral, uint256 amount)
		internal
		whenNotPaused("collateralize")
		collateralIsActive(collateral)
	{
		if (collateral != ethAddress) {
			transferToHoldefi(address(holdefiCollaterals), collateral, amount);
		}
		else {
			transferFromHoldefi(address(holdefiCollaterals), collateral, amount);
		}

		collaterals[msg.sender][collateral].balance = collaterals[msg.sender][collateral].balance.add(amount);
		collaterals[msg.sender][collateral].lastUpdateTime = block.timestamp;

		collateralAssets[collateral].totalCollateral = collateralAssets[collateral].totalCollateral.add(amount);	
		
		emit Collateralize(msg.sender, collateral, amount);
	}

	function withdrawCollateralInternal (address collateral, uint256 amount) 
		internal
		whenNotPaused("withdrawCollateral")
	{
		(uint256 balance,, uint256 borrowPowerValue, uint256 totalBorrowValue,) =
			getAccountCollateral(msg.sender, collateral);

		require (borrowPowerValue != 0, "Borrow power should not be zero");

		uint256 collateralNedeed = 0;
		if (totalBorrowValue != 0) {
			uint256 valueToLoanRate = holdefiSettings.collateralAssets(collateral).valueToLoanRate;
			uint256 totalCollateralValue = totalBorrowValue.mul(valueToLoanRate).div(rateDecimals);
			collateralNedeed = holdefiPrices.getAssetAmountFromValue(collateral, totalCollateralValue);
		}

		uint256 maxWithdraw = balance.sub(collateralNedeed);
		uint256 transferAmount = amount;
		if (transferAmount > maxWithdraw){
			transferAmount = maxWithdraw;
		}

		collaterals[msg.sender][collateral].balance = balance.sub(transferAmount);
		collaterals[msg.sender][collateral].lastUpdateTime = block.timestamp;

		collateralAssets[collateral].totalCollateral =
			collateralAssets[collateral].totalCollateral.sub(transferAmount);

		holdefiCollaterals.withdraw(collateral, msg.sender, transferAmount);

		emit WithdrawCollateral(msg.sender, collateral, transferAmount);
	}

	function borrowInternal (address market, address collateral, uint256 amount)
		internal
		whenNotPaused("borrow")
		marketIsActive(market)
		collateralIsActive(collateral)
	{
		require (
			amount <= (marketAssets[market].totalSupply.sub(marketAssets[market].totalBorrow)),
			"Amount should be less than cash"
		);

		(,, uint256 borrowPowerValue,,) = getAccountCollateral(msg.sender, collateral);	
		uint256 assetToBorrowValue = holdefiPrices.getAssetValueFromAmount(market, amount);
		require (
			borrowPowerValue >= assetToBorrowValue,
			"Borrow power should be more than new borrow value"
		);

		(,uint256 interest, uint256 currentBorrowIndex) = getAccountBorrow(msg.sender, market, collateral);
		
		borrows[msg.sender][collateral][market].accumulatedInterest = interest;
		borrows[msg.sender][collateral][market].balance =
			borrows[msg.sender][collateral][market].balance.add(amount);
		borrows[msg.sender][collateral][market].lastInterestIndex = currentBorrowIndex;
		collaterals[msg.sender][collateral].lastUpdateTime = block.timestamp;

		beforeChangeSupplyRate(market);

		marketAssets[market].totalBorrow = marketAssets[market].totalBorrow.add(amount);

		transferFromHoldefi(msg.sender, market, amount);

		emit Borrow(msg.sender, market, collateral, amount);
	}

	function repayBorrowInternal (address market, address collateral, uint256 amount)
		internal
		whenNotPaused("repayBorrow")
	{
		(uint256 balance, uint256 interest, uint256 currentBorrowIndex) =
			getAccountBorrow(msg.sender, market, collateral);

		uint256 totalBorrowedBalance = balance.add(interest);
		require (totalBorrowedBalance != 0, "Total balance should not be zero");

		uint256 transferAmount = amount;
		if (transferAmount > totalBorrowedBalance) {
			transferAmount = totalBorrowedBalance;
			if (market == ethAddress) {
				uint256 extra = amount.sub(transferAmount);
				transferFromHoldefi(msg.sender, ethAddress, extra);
			}
		}
		
		if (market != ethAddress) {
			transferToHoldefi(address(this), market, transferAmount);
		}

		uint256 remaining = 0;
		if (transferAmount <= interest) {
			borrows[msg.sender][collateral][market].accumulatedInterest = interest.sub(transferAmount);
		}
		else {
			remaining = transferAmount.sub(interest);
			borrows[msg.sender][collateral][market].accumulatedInterest = 0;
			borrows[msg.sender][collateral][market].balance = balance.sub(remaining);
		}
		borrows[msg.sender][collateral][market].lastInterestIndex = currentBorrowIndex;
		collaterals[msg.sender][collateral].lastUpdateTime = block.timestamp;

		beforeChangeSupplyRate(market);
		
		marketAssets[market].totalBorrow = marketAssets[market].totalBorrow.sub(remaining);	

		emit RepayBorrow (msg.sender, market, collateral, transferAmount);
	}

	function buyLiquidatedCollateralInternal (address market, address collateral, uint256 marketAmount)
		internal
		whenNotPaused("buyLiquidatedCollateral")
	{
		require (marketAmount <= marketDebt[collateral][market],
			"Amount should be less than total liquidated assets"
		);

		uint256 collateralAmountWithDiscount =
			getDiscountedCollateralAmount(market, collateral, marketAmount);
		require (
			collateralAmountWithDiscount <= collateralAssets[collateral].totalLiquidatedCollateral,
			"Collateral amount with discount should be less than total liquidated assets"
		);

		if (market != ethAddress) {
			transferToHoldefi(address(this), market, marketAmount);
		}

		collateralAssets[collateral].totalLiquidatedCollateral =
			collateralAssets[collateral].totalLiquidatedCollateral.sub(collateralAmountWithDiscount);
		marketDebt[collateral][market] = marketDebt[collateral][market].sub(marketAmount);

		holdefiCollaterals.withdraw(collateral, msg.sender, collateralAmountWithDiscount);

		emit BuyLiquidatedCollateral(market, collateral, marketAmount);
	}

	function depositPromotionReserveInternal (address market, uint256 amount)
		internal
		marketIsActive(market)
	{
		if (market != ethAddress) {
			transferToHoldefi(address(this), market, amount);
		}
		uint256 amountScaled = amount.mul(secondsPerYear).mul(rateDecimals);

		marketAssets[market].promotionReserveScaled = 
			marketAssets[market].promotionReserveScaled.add(amountScaled);

		emit PromotionReserveDeposited(market, amount);
	}

    receive() external payable {
        revert();
    }
}