const {		
    constants,
    balance,
    time,
    expectRevert,
    bigNumber,

    ethAddress,
    referralCode,
    decimal18,
    ratesDecimal,
    secondsPerYear,
    gasPrice,

    HoldefiContract,
    HoldefiSettingsContract,
    HoldefiPricesContract,
    HoldefiCollateralsContract,
    SampleTokenContract,
    AggregatorContract,

    convertToDecimals,
    roundNumber,
    convertReserve,
    initializeContracts,
    assignToken,
    scenario,
} = require ("../Utils.js");

contract("Test Admin functions", function([owner,user1,user2,user3,user4,user5,user6]){
	
	describe("Set HoldefiPrices contract", async() =>{
		beforeEach(async () =>{
			await initializeContracts(owner);
		})

		it('HoldefiPrices contract should be set if owner calls setHoldefiPricesContract',async () =>{
            let NewHoldefiPricesContract = artifacts.require("HoldefiPrices");
            NewHoldefiPrices = await HoldefiPricesContract.new({from: owner});
            await Holdefi.setHoldefiPricesContract(NewHoldefiPrices.address)
			assert.equal(NewHoldefiPrices.address , await Holdefi.holdefiPrices.call());
		})

		it('Fail if a non-owner account calls setHoldefiPricesContract',async () =>{	
			let FakeHoldefiPrices = await HoldefiPricesContract.new({from: owner});
			await expectRevert(
				Holdefi.setHoldefiPricesContract(FakeHoldefiPrices.address,{from: user1}),
				"OE01");
		})

		it('Fail if calling reserveSettlement',async () =>{	
			await expectRevert(
				Holdefi.reserveSettlement(SampleToken1.address,{from: owner}),
				"E15");
		})
	})

	describe("Promotion reserve and debt updates", async() =>{
		beforeEach(async () =>{
			await scenario(owner,user1,user2,user3,user4);
		})

		it('Promotion reserve and debt should be calculated correctly after calling beforeChangeSupplyRate if promotionRate != 0',async () =>{
			await time.increase(time.duration.days(20));
			let getInterests = await HoldefiSettings.getInterests(SampleToken1.address);
			await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.01))
			let time1 = await time.latest();
			await time.increase(time.duration.days(20));
			let marketBefore = await Holdefi.marketAssets(SampleToken1.address);
			await Holdefi.beforeChangeSupplyRate(SampleToken1.address);
			let time2 = await time.latest();
			let marketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let debtScaled = bigNumber(time2-time1).multipliedBy(marketBefore.totalSupply).multipliedBy(ratesDecimal.multipliedBy(0.01));
			let reserveScaled = bigNumber(time2-time1).multipliedBy(
				(bigNumber(marketBefore.totalBorrow).multipliedBy(getInterests.borrowRate))
				.minus(bigNumber(marketBefore.totalSupply).multipliedBy(getInterests.supplyRateBase)));

			assert.equal(marketAfter.promotionDebtScaled.toString(), debtScaled.toString(),'Promotion debt updated')
			assert.equal(bigNumber(marketAfter.promotionReserveScaled).minus(marketBefore.promotionReserveScaled).toString(), reserveScaled.toString(),
				'Promotion reserve updated')
		})

		it('Promotion debt should not be changed after calling beforeChangeSupplyRate if promotionRate = 0',async () =>{
			await time.increase(time.duration.days(20));
			await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1))
			await time.increase(time.duration.days(40));
			await Holdefi.beforeChangeSupplyRate(SampleToken1.address);
			let marketAfter1 = await Holdefi.marketAssets(SampleToken1.address);
			await time.increase(time.duration.days(20));
			let marketAfter2 = await Holdefi.marketAssets(SampleToken1.address);

			assert.equal(marketAfter2.promotionDebtScaled.toString(), marketAfter2.promotionDebtScaled.toString(),'Promotion debt not changed')
		})

		it('The promotionRate should be set to 0 after calling beforeChangeSupplyRate if promotionDebt > promotionReserve',async () =>{
			await time.increase(time.duration.days(20));
			await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1))
			await time.increase(time.duration.days(40));
			await Holdefi.beforeChangeSupplyRate(SampleToken1.address);
			let marketAfter = await HoldefiSettings.marketAssets(SampleToken1.address);
			
			assert.equal(marketAfter.promotionRate.toString(), 0,'Promotion rate = 0');
		})
	})

	describe("Deposit promotion reserve for ERC20", async() =>{
		beforeEach(async () =>{
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, owner, SampleToken1);
			await time.increase(time.duration.days(5));
			await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1))
			await time.increase(time.duration.days(5));
			await Holdefi.beforeChangeSupplyRate(SampleToken1.address);
			adminBalanceBefore = await SampleToken1.balanceOf(owner);
			contractBalanceBefore = await SampleToken1.balanceOf(Holdefi.address);
		})

		it('Promotion reserve should be increased after calling depositPromotionReserve',async () =>{
			let depositAmount = await convertToDecimals(SampleToken1, 10);
			let reserveBefore = (await Holdefi.marketAssets(SampleToken1.address)).promotionReserveScaled;
			let debtBefore = await Holdefi.getPromotionDebt(SampleToken1.address);
			await Holdefi.methods['depositPromotionReserve(address,uint256)'](SampleToken1.address, depositAmount);		
			let reserveAfter = (await Holdefi.marketAssets(SampleToken1.address)).promotionReserveScaled;
			let debtAfter = await Holdefi.getPromotionDebt(SampleToken1.address);

			let amountScaled = depositAmount.multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);	
			let adminBalanceAfter = await SampleToken1.balanceOf(owner);
			let contractBalanceAfter = await SampleToken1.balanceOf(Holdefi.address);

			assert.equal(debtAfter.toString(), debtBefore.toString(),'Market debt not changed')
			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).minus(depositAmount).toString(), 'Owner wallet balance decreased');
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(depositAmount).toString(), 'Holdefi contract balance increased');  
			assert.equal(reserveAfter.toString(), bigNumber(reserveBefore).plus(amountScaled).toString(),	"Promotion reserve increased");
		})

		it('Fail if depositPromotionReserve function is paused',async () =>{
			await Holdefi.pause("depositPromotionReserve", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			let depositAmount = await convertToDecimals(SampleToken1, 10);
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await expectRevert(Holdefi.methods['depositPromotionReserve(address,uint256)'](SampleToken1.address, depositAmount), 'POE02');
		})

		it('Fail if market is not active',async () =>{
			let depositAmount = await convertToDecimals(SampleToken1, 10);
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await expectRevert(Holdefi.methods['depositPromotionReserve(address,uint256)'](SampleToken1.address, depositAmount), 'E02');
		})

		it('Fail if try to call depositPromotionReserve for ETH',async () =>{
			await expectRevert(Holdefi.methods['depositPromotionReserve(address,uint256)'](ethAddress, decimal18.multipliedBy(1)), 'E01');
		})
	})

	describe("Deposit promotion reserve for Deflating ERC20", async() =>{
		beforeEach(async () =>{
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, owner, SampleToken5);
			await time.increase(time.duration.days(5));
			await HoldefiSettings.setPromotionRate(SampleToken5.address, ratesDecimal.multipliedBy(0.1));
			await time.increase(time.duration.days(5));
			await Holdefi.beforeChangeSupplyRate(SampleToken5.address);
			adminBalanceBefore = await SampleToken5.balanceOf(owner);
			contractBalanceBefore = await SampleToken5.balanceOf(Holdefi.address);
		})

		it('Promotion reserve should be increased after calling depositPromotionReserve',async () =>{
			let depositAmount = await convertToDecimals(SampleToken5, 10);
			let receivedAmount = depositAmount.minus(depositAmount.dividedToIntegerBy(100));  
			let reserveBefore = (await Holdefi.marketAssets(SampleToken5.address)).promotionReserveScaled;
			let debtBefore = await Holdefi.getPromotionDebt(SampleToken5.address);
			await Holdefi.methods['depositPromotionReserve(address,uint256)'](SampleToken5.address, depositAmount);		
			let reserveAfter = (await Holdefi.marketAssets(SampleToken5.address)).promotionReserveScaled;
			let debtAfter = await Holdefi.getPromotionDebt(SampleToken5.address);

			let amountScaled = receivedAmount.multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);	
			let adminBalanceAfter = await SampleToken5.balanceOf(owner);
			let contractBalanceAfter = await SampleToken5.balanceOf(Holdefi.address);

			assert.equal(debtAfter.toString(), debtBefore.toString(),'Market debt not changed')
			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).minus(depositAmount).toString(), 'Owner wallet balance decreased');
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(receivedAmount).toString(), 'Holdefi contract balance increased');  
			assert.equal(reserveAfter.toString(), bigNumber(reserveBefore).plus(amountScaled).toString(),	"Promotion reserve increased");
		})
	})

	describe("Deposit promotion reserve for ETH", async() =>{
		beforeEach(async () =>{
			await scenario(owner,user1,user2,user3,user4);
			await time.increase(time.duration.days(5));
			await HoldefiSettings.setPromotionRate(ethAddress, ratesDecimal.multipliedBy(0.1))
			await time.increase(time.duration.days(5));
			await Holdefi.beforeChangeSupplyRate(ethAddress);
			adminBalanceBefore = await balance.current(owner);
			contractBalanceBefore = await balance.current(Holdefi.address);
		})
		
		it('Promotion reserve should be increased after calling depositPromotionReserve',async () =>{
			let depositAmount = decimal18.multipliedBy(1);
			await time.advanceBlock();
			let reserveBefore = (await Holdefi.marketAssets(ethAddress)).promotionReserveScaled;
			let debtBefore = await Holdefi.getPromotionDebt(ethAddress);
			let tx = await Holdefi.methods['depositPromotionReserve()']({value:depositAmount});			
			let reserveAfter = (await Holdefi.marketAssets(ethAddress)).promotionReserveScaled;
			let debtAfter = await Holdefi.getPromotionDebt(ethAddress);

			let amountScaled = depositAmount.multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);	
			let adminBalanceAfter = await balance.current(owner);
			let contractBalanceAfter = await balance.current(Holdefi.address);

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(debtAfter.toString(), debtBefore.toString(),'Market debt not changed');
			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).minus(depositAmount).minus(txFee).toString(), 
				'Owner wallet balance decreased'); 
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(depositAmount).toString(), 'Holdefi contract balance increased');  
			assert.equal(reserveAfter.toString(), bigNumber(reserveBefore).plus(amountScaled).toString(), "Promotion reserve increased"); 
		})

		it('Fail if depositPromotionReserve function is paused',async () =>{
			await Holdefi.pause("depositPromotionReserve", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			let depositAmount = decimal18.multipliedBy(1);
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await expectRevert(Holdefi.methods['depositPromotionReserve()']({value:depositAmount}), 'POE02');
		})

		it('Fail if market is not active',async () =>{
			let depositAmount = decimal18.multipliedBy(1);
			await HoldefiSettings.deactivateMarket(ethAddress,{from:owner});
			await expectRevert(Holdefi.methods['depositPromotionReserve()']({value:depositAmount}), 'E02');
		})
	})

	describe("Withdraw promotion reserve", async() =>{
		beforeEach(async () =>{
			await scenario(owner,user1,user2,user3,user4);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, await convertToDecimals(SampleToken1, 5), referralCode, {from: user5});
			await time.increase(time.duration.days(40));
			await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.01));
			adminBalanceBefore = await SampleToken1.balanceOf(owner);
			contractBalanceBefore = await SampleToken1.balanceOf(Holdefi.address);
			await time.increase(time.duration.days(1));
		})
		
		it('Promotion reserve should be decreased after calling withdrawPromotionReserve',async () =>{
			let withdrawAmount = 10;
			await time.advanceBlock();
			let reserveBefore = await Holdefi.getPromotionReserve(SampleToken1.address);
			let debtBefore = await Holdefi.getPromotionDebt(SampleToken1.address);
			await Holdefi.withdrawPromotionReserve(SampleToken1.address, withdrawAmount);
			let reserveAfter = await Holdefi.getPromotionReserve(SampleToken1.address);
			let debtAfter = await Holdefi.getPromotionDebt(SampleToken1.address);

			let amountScaled = bigNumber(withdrawAmount).multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);	
			let adminBalanceAfter = await SampleToken1.balanceOf(owner);
			let contractBalanceAfter = await SampleToken1.balanceOf(Holdefi.address);

			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).plus(withdrawAmount).toString(), 'Owner wallet balance increased');
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(withdrawAmount).toString(), 
				'Holdefi contract balance decreased');  
			assert.equal(roundNumber(convertReserve(reserveAfter), SampleToken1.decimals()/2).toString(), 
				roundNumber(convertReserve(bigNumber(reserveBefore).minus(amountScaled)), SampleToken1.decimals()/2).toString(), 
				"Promotion reserve decreased");
		})

		it('Fail if promotionDebtScaled > promotionReserveScaled',async () =>{
			await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
			await time.increase(time.duration.days(100));
			await expectRevert(Holdefi.withdrawPromotionReserve(SampleToken1.address, decimal18.multipliedBy(10), {from: owner}),
				"E07");
		})

		it('Fail if withdraw amount is more than Max',async () =>{
			await expectRevert(Holdefi.withdrawPromotionReserve(SampleToken1.address, decimal18.multipliedBy(1000), {from: owner}),
				"E07");
		})

		it('Fail if a non-owner account calls withdrawPromotionReserve',async () =>{
			await expectRevert(Holdefi.withdrawPromotionReserve(SampleToken1.address, 10, {from: user1}),
				"OE01");
		})
	})

	describe("Withdraw promotion reserve for Deflating ERC20", async() =>{
		beforeEach(async () =>{
			await scenario(owner,user1,user2,user3,user4);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken5.address, ethAddress, await convertToDecimals(SampleToken5, 5), referralCode, {from: user5});
			await time.increase(time.duration.days(40));
			await HoldefiSettings.setPromotionRate(SampleToken5.address, ratesDecimal.multipliedBy(0.01));
			adminBalanceBefore = await SampleToken5.balanceOf(owner);
			contractBalanceBefore = await SampleToken5.balanceOf(Holdefi.address);
			await time.increase(time.duration.days(1));
		})
		
		it('Promotion reserve should be decreased after calling withdrawPromotionReserve',async () =>{
			let withdrawAmount = bigNumber(10);
			let receivedAmount = withdrawAmount.minus(withdrawAmount.dividedToIntegerBy(100));  
			await time.advanceBlock();
			let reserveBefore = await Holdefi.getPromotionReserve(SampleToken5.address);
			let debtBefore = await Holdefi.getPromotionDebt(SampleToken5.address);
			await Holdefi.withdrawPromotionReserve(SampleToken5.address, withdrawAmount);
			let reserveAfter = await Holdefi.getPromotionReserve(SampleToken5.address);
			let debtAfter = await Holdefi.getPromotionDebt(SampleToken5.address);

			let amountScaled = bigNumber(withdrawAmount).multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);	
			let adminBalanceAfter = await SampleToken5.balanceOf(owner);
			let contractBalanceAfter = await SampleToken5.balanceOf(Holdefi.address);

			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).plus(receivedAmount).toString(), 'Owner wallet balance increased');
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(withdrawAmount).toString(), 
				'Holdefi contract balance decreased');  
			assert.equal(roundNumber(convertReserve(reserveAfter), SampleToken5.decimals()/2).toString(), 
				roundNumber(convertReserve(bigNumber(reserveBefore).minus(amountScaled)), SampleToken5.decimals()/2).toString(), 
				"Promotion reserve decreased");
		})
	})
	
	describe("Deposit liquidation reserve for ERC20", async() =>{
		beforeEach(async () => {
			await scenario(owner,user1, user2, user3, user4);
			HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
			adminBalanceBefore = await SampleToken1.balanceOf(user2);
			contractBalanceBefore = await SampleToken1.balanceOf(HoldefiCollateralsAddress);
		})

		it('Liquidation reserves should increased after calling depositLiquidationReserve', async () => {
			let depositAmount = await convertToDecimals(SampleToken1, 10);
			let totalLiquidatedCollateralBefore = await Holdefi.collateralAssets(SampleToken1.address);
			await Holdefi.depositLiquidationReserve(SampleToken1.address, depositAmount, {from: user2});
			let totalLiquidatedCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);

			let adminBalanceAfter = await SampleToken1.balanceOf(user2);
			let contractBalanceAfter = await SampleToken1.balanceOf(HoldefiCollateralsAddress);

			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).minus(depositAmount).toString(), 'Owner wallet balance decreased');
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(depositAmount).toString(), 'Holdefi contract balance increased');  
			assert.equal(
				totalLiquidatedCollateralAfter.totalLiquidatedCollateral.toString(), 
				bigNumber(totalLiquidatedCollateralBefore.totalLiquidatedCollateral).plus(depositAmount).toString(),
				'Liquidation reserve increased'
			);
		});

		it('Fail if depositLiquidationReserve function is paused',async () =>{
			await Holdefi.pause("depositLiquidationReserve", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			let depositAmount = await convertToDecimals(SampleToken1, 10);
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await expectRevert(Holdefi.depositLiquidationReserve(SampleToken1.address, depositAmount, {from: user2}), 'POE02');
		})

		it('Fail if collateral is not active',async () =>{
			let depositAmount = await convertToDecimals(SampleToken1, 10);
			await HoldefiSettings.deactivateCollateral(SampleToken1.address,{from:owner});
			await expectRevert(Holdefi.depositLiquidationReserve(SampleToken1.address, depositAmount, {from: user2}), 'E03');
		})	

		it('Fail if try to call depositLiquidationReserve for ETH', async () => {
			await expectRevert(Holdefi.depositLiquidationReserve(ethAddress, decimal18.multipliedBy(1), {from: user2}),
				"E01");
		}) 
	})

	describe("Deposit liquidation reserve for Deflating ERC20", async() =>{
		beforeEach(async () => {
			await scenario(owner,user1, user2, user3, user4);
			HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
			adminBalanceBefore = await SampleToken5.balanceOf(user2);
			contractBalanceBefore = await SampleToken5.balanceOf(HoldefiCollateralsAddress);
		})

		it('Liquidation reserves should increased after calling depositLiquidationReserve', async () => {
			let depositAmount = await convertToDecimals(SampleToken5, 10);
			let receivedAmount = depositAmount.minus(depositAmount.dividedToIntegerBy(100));  
			let totalLiquidatedCollateralBefore = await Holdefi.collateralAssets(SampleToken5.address);
			await Holdefi.depositLiquidationReserve(SampleToken5.address, depositAmount, {from: user2});
			let totalLiquidatedCollateralAfter = await Holdefi.collateralAssets(SampleToken5.address);

			let adminBalanceAfter = await SampleToken5.balanceOf(user2);
			let contractBalanceAfter = await SampleToken5.balanceOf(HoldefiCollateralsAddress);

			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).minus(depositAmount).toString(), 'Owner wallet balance decreased');
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(receivedAmount).toString(), 'HoldefiCollaterals contract balance increased');  
			assert.equal(
				totalLiquidatedCollateralAfter.totalLiquidatedCollateral.toString(), 
				bigNumber(totalLiquidatedCollateralBefore.totalLiquidatedCollateral).plus(receivedAmount).toString(),
				'Liquidation reserve increased'
			);
		})
	})

	describe("Deposit liquidation reserve for ETH", async() =>{
		beforeEach(async () => {
			await scenario(owner,user1, user2, user3, user4);
			HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
			adminBalanceBefore = await balance.current(owner);
			contractBalanceBefore = await balance.current(HoldefiCollateralsAddress);
		})

		it('Liquidation reserves should increased after calling depositLiquidationReserve', async () => {
			let depositAmount = decimal18.multipliedBy(1);
			let totalLiquidatedCollateralBefore = await Holdefi.collateralAssets(ethAddress);
			let tx = await Holdefi.methods['depositLiquidationReserve()']({value:depositAmount});	
			let totalLiquidatedCollateralAfter = await Holdefi.collateralAssets(ethAddress);

			let adminBalanceAfter = await balance.current(owner);
			let contractBalanceAfter = await balance.current(HoldefiCollateralsAddress);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).minus(depositAmount).minus(txFee).toString(), 'Owner wallet balance decreased');
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(depositAmount).toString(), 'HoldefiCollaterals contract balance increased');  
			assert.equal(
				totalLiquidatedCollateralAfter.totalLiquidatedCollateral.toString(), 
				bigNumber(totalLiquidatedCollateralBefore.totalLiquidatedCollateral).plus(depositAmount).toString(),
				'Liquidation reserve increased'
			);
		})

		it('Fail if depositLiquidationReserve function is paused',async () =>{
			await Holdefi.pause("depositLiquidationReserve", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			let depositAmount = decimal18.multipliedBy(1);
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await expectRevert(Holdefi.methods['depositLiquidationReserve()']({value:depositAmount}), 'POE02');
		})

		it('Fail if collateral is not active',async () =>{
			let depositAmount = decimal18.multipliedBy(1);
			await HoldefiSettings.deactivateCollateral(ethAddress,{from:owner});
			await expectRevert(Holdefi.methods['depositLiquidationReserve()']({value:depositAmount}), 'E03');
		})	
	})

	describe("Withdraw liquidation reserve", async() =>{
		beforeEach(async () => {
			await scenario(owner,user1, user2, user3, user4);
			HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['supply(uint16)'](referralCode, {from:user1, value: decimal18.multipliedBy(1)});	        
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, await convertToDecimals(SampleToken1, 20), {from:user5});
			await Holdefi.borrow(ethAddress, SampleToken1.address, decimal18.multipliedBy(0.65), referralCode, {from: user5});
			
			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 9/200));   
			await Holdefi.liquidateBorrowerCollateral(user5, ethAddress, SampleToken1.address);
			adminBalanceBefore = await SampleToken1.balanceOf(owner);
			await time.increase(time.duration.days(1));
		})

		it('Liquidation reserves should decreased after calling withdrawLiquidationReserve', async () => {
			let contractBalanceBefore = await SampleToken1.balanceOf(HoldefiCollateralsAddress);
			let getLiquidationReserveBefore = await Holdefi.getLiquidationReserve(SampleToken1.address);
			await Holdefi.withdrawLiquidationReserve(SampleToken1.address, getLiquidationReserveBefore);
			let getLiquidationReserveAfter = await Holdefi.getLiquidationReserve(SampleToken1.address); 
			let adminBalanceAfter = await SampleToken1.balanceOf(owner);
			let contractBalanceAfter = await SampleToken1.balanceOf(HoldefiCollateralsAddress);

			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).plus(getLiquidationReserveBefore).toString(), 
				'Owner wallet balance increased');   
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(getLiquidationReserveBefore).toString(), 
				'HoldefiCollaterals contract balance decreased');
			assert.equal(getLiquidationReserveAfter.toString(), 0, "Liquidation reserve decreased")
		})

		it('Should withdraw all liquidatedCollateral if there is no marketDebt', async () => {
			let marketDebtBefore = await Holdefi.marketDebt(SampleToken1.address, ethAddress);
			await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: marketDebtBefore});
		
			let contractBalanceBefore = await SampleToken1.balanceOf(HoldefiCollateralsAddress);
			let getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;    
			let getLiquidationReserveBefore = await Holdefi.getLiquidationReserve(SampleToken1.address);
			
			await Holdefi.withdrawLiquidationReserve(SampleToken1.address, bigNumber(getLiquidationReserveBefore).multipliedBy(2));
			let getLiquidationReserveAfter = await Holdefi.getLiquidationReserve(SampleToken1.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;    
			let adminBalanceAfter = await SampleToken1.balanceOf(owner);
			let contractBalanceAfter = await SampleToken1.balanceOf(HoldefiCollateralsAddress);
			
			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).plus(getLiquidationReserveBefore).toString(), 
				'Owner wallet balance increased');
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(getLiquidationReserveBefore).toString(), 
				'HoldefiCollaterals contract balance decreased');
			assert.equal(getLiquidatedCollateralBefore.toString(), getLiquidationReserveBefore.toString(),'Liquidated collateral = Liquidation reserve (before calling withdrawLiquidationReserve)')
			assert.equal(getLiquidatedCollateralAfter.toString(), 0,'Liquidated collateral = 0 (after calling withdrawLiquidationReserve)')
			assert.equal(getLiquidationReserveAfter.toString(), 0,'Liquidation reserve = 0 (after calling withdrawLiquidationReserve)')
		})

		it('Fail if a non-owner account calls withdrawLiquidationReserve', async () => {
			let getLiquidatedCollateral = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;             	        
			await expectRevert(Holdefi.withdrawLiquidationReserve(SampleToken1.address, getLiquidatedCollateral,{from: user1}),
				'OE01')
		})
	})

	describe("Withdraw liquidation reserve for Deflating ERC20", async() =>{
		beforeEach(async () => {
			await scenario(owner,user1, user2, user3, user4);
			HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
			await assignToken(owner, user5, SampleToken5);
			await Holdefi.methods['supply(uint16)'](referralCode, {from:user1, value: decimal18.multipliedBy(1)});	        
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken5.address, await convertToDecimals(SampleToken5, 200), {from:user5});
			await Holdefi.borrow(ethAddress, SampleToken5.address, decimal18.multipliedBy(0.65), referralCode, {from: user5});
			
			await SampleToken5PriceAggregator.setPrice(await convertToDecimals(SampleToken5PriceAggregator, 1/250));   
			await Holdefi.liquidateBorrowerCollateral(user5, ethAddress, SampleToken5.address);
			adminBalanceBefore = await SampleToken5.balanceOf(owner);
			await time.increase(time.duration.days(1));
		})

		it('Liquidation reserves should decreased after calling withdrawLiquidationReserve', async () => {
			let contractBalanceBefore = await SampleToken5.balanceOf(HoldefiCollateralsAddress);
			let getLiquidationReserveBefore = bigNumber(await Holdefi.getLiquidationReserve(SampleToken5.address));
			let receivedAmount = getLiquidationReserveBefore.minus(getLiquidationReserveBefore.dividedToIntegerBy(100));  
			await Holdefi.withdrawLiquidationReserve(SampleToken5.address, getLiquidationReserveBefore);
			let getLiquidationReserveAfter = await Holdefi.getLiquidationReserve(SampleToken5.address); 
			let adminBalanceAfter = await SampleToken5.balanceOf(owner);
			let contractBalanceAfter = await SampleToken5.balanceOf(HoldefiCollateralsAddress);

			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).plus(receivedAmount).toString(), 
				'Owner wallet balance increased');   
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(getLiquidationReserveBefore).toString(), 
				'HoldefiCollaterals contract balance decreased');
			assert.equal(getLiquidationReserveAfter.toString(), 0, "Liquidation reserve decreased")
		})

		it('Should withdraw all liquidatedCollateral if there is no marketDebt', async () => {
			let marketDebtBefore = await Holdefi.marketDebt(SampleToken5.address, ethAddress);
			await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken5.address,  {from: user6 , value: marketDebtBefore});
		
			let contractBalanceBefore = await SampleToken5.balanceOf(HoldefiCollateralsAddress);
			let getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(SampleToken5.address)).totalLiquidatedCollateral;    
			let getLiquidationReserveBefore = bigNumber(await Holdefi.getLiquidationReserve(SampleToken5.address));
			let receivedAmount = getLiquidationReserveBefore.minus(getLiquidationReserveBefore.dividedToIntegerBy(100));
			await Holdefi.withdrawLiquidationReserve(SampleToken5.address, bigNumber(getLiquidationReserveBefore).multipliedBy(2));
			let getLiquidationReserveAfter = await Holdefi.getLiquidationReserve(SampleToken5.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken5.address)).totalLiquidatedCollateral;    
			let adminBalanceAfter = await SampleToken5.balanceOf(owner);
			let contractBalanceAfter = await SampleToken5.balanceOf(HoldefiCollateralsAddress);
			
			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).plus(receivedAmount).toString(), 
				'Owner wallet balance increased');
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(getLiquidationReserveBefore).toString(), 
				'HoldefiCollaterals contract balance decreased');
			assert.equal(getLiquidatedCollateralBefore.toString(), getLiquidationReserveBefore.toString(),'Liquidated collateral = Liquidation reserve (before calling withdrawLiquidationReserve)')
			assert.equal(getLiquidatedCollateralAfter.toString(), 0,'Liquidated collateral = 0 (after calling withdrawLiquidationReserve)')
			assert.equal(getLiquidationReserveAfter.toString(), 0,'Liquidation reserve = 0 (after calling withdrawLiquidationReserve)')
		})
	})
})