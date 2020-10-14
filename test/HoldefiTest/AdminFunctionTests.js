const {		
    constants,
    balance,
    time,
    expectRevert,
    bigNumber,

    ethAddress,
    referalCode,
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
	
	// describe("Setting HoldefiPrices contract", async() =>{
	// 	beforeEach(async () =>{
	// 		await initializeContracts(owner);
	// 	})

	// 	it('HoldefiPrices contract should be set by owner',async () =>{
 //            let NewHoldefiPricesContract = artifacts.require("HoldefiPrices");
 //            NewHoldefiPrices = await HoldefiPricesContract.new({from: owner});
 //            await Holdefi.setHoldefiPricesContract(NewHoldefiPrices.address)
	// 		assert.equal(NewHoldefiPrices.address , await Holdefi.holdefiPrices.call());
	// 	})

	// 	it('Fail if set by other accounts',async () =>{	
	// 		let FakeHoldefiPrices = await HoldefiPricesContract.new({from: owner});
	// 		await expectRevert(
	// 			Holdefi.setHoldefiPricesContract(FakeHoldefiPrices.address,{from: user1}),
	// 			"Sender should be owner");
	// 	})
	// })

	// describe("Update Promotion", async() =>{
	// 	beforeEach(async () =>{
	// 		await scenario(owner,user1,user2,user3,user4);
	// 	})

	// 	it('Update promotion debt and promotion reserve if promotionRate != 0',async () =>{
	// 		await time.increase(time.duration.days(20));
	// 		let getInterests = await HoldefiSettings.getInterests(SampleToken1.address);
	// 		await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.01))
	// 		let time1 = await time.latest();
	// 		await time.increase(time.duration.days(20));
	// 		let marketBefore = await Holdefi.marketAssets(SampleToken1.address);
	// 		await Holdefi.beforeChangeSupplyRate(SampleToken1.address);
	// 		let time2 = await time.latest();
	// 		let marketAfter = await Holdefi.marketAssets(SampleToken1.address);
	// 		let debtScaled = bigNumber(time2-time1).multipliedBy(marketBefore.totalSupply).multipliedBy(ratesDecimal.multipliedBy(0.01));
	// 		let reserveScaled = bigNumber(time2-time1).multipliedBy(
	// 			(bigNumber(marketBefore.totalBorrow).multipliedBy(getInterests.borrowRate))
	// 			.minus(bigNumber(marketBefore.totalSupply).multipliedBy(getInterests.supplyRateBase)));

	// 		assert.equal(marketAfter.promotionDebtScaled.toString(), debtScaled.toString(),'Promotion debt updated')
	// 		assert.equal(bigNumber(marketAfter.promotionReserveScaled).minus(marketBefore.promotionReserveScaled).toString(), reserveScaled.toString(),'Promotion reserve updated')
	// 	})

	// 	it('No promotion debt if promotionRate = 0',async () =>{
	// 		await time.increase(time.duration.days(20));
	// 		await Holdefi.beforeChangeSupplyRate(SampleToken1.address)
	// 		let marketAfter = await Holdefi.marketAssets(SampleToken1.address);

	// 		assert.equal(marketAfter.promotionDebtScaled.toString(), 0,'Promotion debt should be zero')
	// 	})

	// 	it('Set promotionRate to 0 if promotionDebt > promotionReserve',async () =>{
	// 		await time.increase(time.duration.days(20));
	// 		await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1))
	// 		await time.increase(time.duration.days(40));
	// 		await Holdefi.beforeChangeSupplyRate(SampleToken1.address);
	// 		let marketAfter = await HoldefiSettings.marketAssets(SampleToken1.address);
			
	// 		assert.equal(marketAfter.promotionRate.toString(), 0,'Promotion rate should be zero');
	// 	})
	// })

	// describe("Deposit Promotion Reserve for ERC20", async() =>{
	// 	beforeEach(async () =>{
	// 		await scenario(owner,user1,user2,user3,user4);
	// 		await assignToken(owner, owner, SampleToken1);
	// 		await time.increase(time.duration.days(5));
	// 		await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1))
	// 		adminBalanceBefore = await SampleToken1.balanceOf(owner);
	// 	})

	// 	it('Should Deposit reserves',async () =>{
	// 		let depositAmount = await convertToDecimals(SampleToken1, 10);
	// 		await time.advanceBlock();
	// 		let reserveBefore = (await Holdefi.getPromotionReserve(SampleToken1.address)).promotionReserveScaled;
	// 		let debtBefore = (await Holdefi.getPromotionDebt(SampleToken1.address)).promotionDebtScaled;
	// 		await Holdefi.methods['depositPromotionReserve(address,uint256)'](SampleToken1.address, depositAmount);	
	// 		await time.advanceBlock();	
	// 		let reserveAfter = (await Holdefi.getPromotionReserve(SampleToken1.address)).promotionReserveScaled;
	// 		let debtAfter = (await Holdefi.getPromotionDebt(SampleToken1.address)).promotionDebtScaled;

	// 		let amountScaled = depositAmount.multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);	
	// 		let adminBalanceAfter = await SampleToken1.balanceOf(owner);

	// 		assert.equal(debtAfter.toString(), debtBefore.toString(),'Debt should not be changed')
	// 		assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).minus(depositAmount).toString(), 'Admin Balance increased correctly'); 
	// 		assert.equal(
	// 			roundNumber(convertReserve(reserveAfter), SampleToken1.decimals()).toString(),
	// 			roundNumber(convertReserve(bigNumber(reserveBefore).plus(amountScaled)), SampleToken1.decimals()).toString(),
	// 			"Promotion reserve should be increased"
	// 		);
	// 	})

	// 	it('Fail if market is eth address',async () =>{
	// 		await expectRevert(Holdefi.methods['depositPromotionReserve(address,uint256)'](ethAddress, decimal18.multipliedBy(1)),
	// 			'Asset should not be ETH address');	
	// 	})
	// })

	// describe("Deposit Promotion Reserve for ETH", async() =>{
	// 	beforeEach(async () =>{
	// 		await scenario(owner,user1,user2,user3,user4);
	// 		await time.increase(time.duration.days(5));
	// 		await HoldefiSettings.setPromotionRate(ethAddress, ratesDecimal.multipliedBy(0.1))
	// 		adminBalanceBefore = await balance.current(owner);
	// 	})
		
	// 	it('Should Deposit reserves',async () =>{
	// 		let depositAmount = decimal18.multipliedBy(1);
	// 		await time.advanceBlock();
	// 		let reserveBefore = (await Holdefi.getPromotionReserve(ethAddress)).promotionReserveScaled;
	// 		let debtBefore = (await Holdefi.getPromotionDebt(ethAddress)).promotionDebtScaled;
	// 		let tx = await Holdefi.methods['depositPromotionReserve()']({value:depositAmount});			
	// 		let reserveAfter = (await Holdefi.getPromotionReserve(ethAddress)).promotionReserveScaled;
	// 		let debtAfter = (await Holdefi.getPromotionDebt(ethAddress)).promotionDebtScaled;

	// 		let amountScaled = depositAmount.multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);	
	// 		let adminBalanceAfter = await balance.current(owner);

	// 		let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
	// 		assert.equal(debtAfter.toString(), debtBefore.toString(),'Debt should not be changed')
	// 		assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).minus(depositAmount).minus(txFee).toString(), 'Admin Balance increased correctly'); 
	// 		assert.equal(
	// 			roundNumber(convertReserve(reserveAfter), 18).toString(),
	// 			roundNumber(convertReserve(bigNumber(reserveBefore).plus(amountScaled)), 18).toString(),
	// 			"promotion reserve increased"
	// 		);
			 
	// 	})
	// })

	// describe("Withdraw Promotion Reserve", async() =>{
	// 	beforeEach(async () =>{
	// 		await scenario(owner,user1,user2,user3,user4);
	// 		await time.increase(time.duration.days(40));
	// 		await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.01));
	// 		adminBalanceBefore = await SampleToken1.balanceOf(owner);
	// 		await time.increase(time.duration.days(1));
	// 	})
		
	// 	it('Should withdraw reserves',async () =>{
	// 		let withdrawAmount = 10;
	// 		await time.advanceBlock();
	// 		let reserveBefore = (await Holdefi.getPromotionReserve(ethAddress)).promotionReserveScaled;
	// 		let debtBefore = (await Holdefi.getPromotionDebt(ethAddress)).promotionDebtScaled;
	// 		await Holdefi.withdrawPromotionReserve(SampleToken1.address, withdrawAmount);
	// 		let reserveAfter = (await Holdefi.getPromotionReserve(ethAddress)).promotionReserveScaled;
	// 		let debtAfter = (await Holdefi.getPromotionDebt(ethAddress)).promotionDebtScaled;

	// 		let amountScaled = bigNumber(withdrawAmount).multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);	
	// 		let adminBalanceAfter = await SampleToken1.balanceOf(owner);

	// 		assert.equal(adminBalanceBefore.toString(), bigNumber(adminBalanceAfter).minus(withdrawAmount).toString(), 'Admin Balance increased correctly');
	// 		assert.equal(
	// 			roundNumber(convertReserve(reserveAfter).toString(), 18), 
	// 			roundNumber(convertReserve(bigNumber(reserveBefore).minus(debtBefore).minus(amountScaled)), 18).toString(), 
	// 			"Reserve withdrawn"
	// 		);
	// 	})

	// 	it('Fail if debt is more than reserve',async () =>{
	// 		await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
	// 		await time.increase(time.duration.days(100));
	// 		await expectRevert(Holdefi.withdrawPromotionReserve(SampleToken1.address, decimal18.multipliedBy(10), {from: owner}),
	// 			"Amount should be less than max");
	// 	})

	// 	it('Fail if amount more than max',async () =>{
	// 		await expectRevert(Holdefi.withdrawPromotionReserve(SampleToken1.address, decimal18.multipliedBy(1000), {from: owner}),
	// 			"Amount should be less than max");
	// 	})

	// 	it('Fail if called by other accounts',async () =>{
	// 		await expectRevert(Holdefi.withdrawPromotionReserve(SampleToken1.address, 10, {from: user1}),
	// 			"Sender should be owner");
	// 	})
	// })

	// describe("Reset promotion rate", async() =>{
	// 	beforeEach(async () =>{
	// 		await scenario(owner,user1,user2,user3,user4);
	// 	})

	// 	it('Fail if reset promotion by other accounts', async () => {
	// 		await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1),{from: owner});
	// 		await expectRevert(HoldefiSettings.resetPromotionRate(SampleToken1.address, {from: user1}),
	// 			'Sender is not Holdefi contract');
	// 	})

	// })
	
	// describe("Deposit liquidation reserves", async() =>{
	// 	beforeEach(async () => {
	// 		await scenario(owner,user1, user2, user3, user4);
	// 	})

	// 	it('Should deposit liquidation reserves', async () => {
	// 		let depositAmount = await convertToDecimals(SampleToken1, 10);
	// 		let totalLiquidatedCollateralBefore = await Holdefi.collateralAssets(SampleToken1.address);
	// 		await Holdefi.depositLiquidationReserve(SampleToken1.address, depositAmount, {from: user2});
	// 		let totalLiquidatedCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
	// 		assert.equal(totalLiquidatedCollateralAfter.totalLiquidatedCollateral.toString(), bigNumber(totalLiquidatedCollateralBefore.totalLiquidatedCollateral).plus(depositAmount).toString());
	// 	}) 		

	// 	it('Fail if asset is ETH', async () => {
	// 		await expectRevert(Holdefi.depositLiquidationReserve(ethAddress, decimal18.multipliedBy(1), {from: user2}),
	// 			"Asset should not be ETH address");
	// 	}) 
	// })

	describe("Withdraw liquidation reserves", async() =>{
		beforeEach(async () => {
			await scenario(owner,user1, user2, user3, user4);
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['supply(uint16)'](referalCode, {from:user1, value: decimal18.multipliedBy(1)});	        
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, await convertToDecimals(SampleToken1, 20), {from:user5});
			await Holdefi.borrow(ethAddress, SampleToken1.address, decimal18.multipliedBy(0.65), referalCode, {from: user5});
			
			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 9/200));   
			await Holdefi.liquidateBorrowerCollateral(user5, ethAddress, SampleToken1.address);
			adminBalanceBefore = await SampleToken1.balanceOf(owner);
			await time.increase(time.duration.days(1));
		})

		it('Should withdraw liquidation reserves', async () => {
			let getLiquidationReserveBefore = await Holdefi.getLiquidationReserve(SampleToken1.address);
			await Holdefi.withdrawLiquidationReserve(SampleToken1.address, getLiquidationReserveBefore);
			let getLiquidationReserveAfter = await Holdefi.getLiquidationReserve(SampleToken1.address); 
			let adminBalanceAfter = await SampleToken1.balanceOf(owner);

			assert.equal(adminBalanceBefore.toString(), bigNumber(adminBalanceAfter).minus(getLiquidationReserveBefore).toString(), 'Admin Balance increased correctly');   
			assert.equal(getLiquidationReserveAfter.toString(), 0, "Reserve withdrawn")
		})

		it('Should withdraw all liquidatedCollateral if no debt', async () => {
			let marketDebtBefore = await Holdefi.marketDebt(SampleToken1.address, ethAddress);
			await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: marketDebtBefore});
		
			let getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;    
			let getLiquidationReserveBefore = await Holdefi.getLiquidationReserve(SampleToken1.address);
			
			await Holdefi.withdrawLiquidationReserve(SampleToken1.address, bigNumber(getLiquidationReserveBefore).multipliedBy(2));
			let getLiquidationReserveAfter = await Holdefi.getLiquidationReserve(SampleToken1.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;    
			let adminBalanceAfter = await SampleToken1.balanceOf(owner);
			
			assert.equal(adminBalanceBefore.toString(), bigNumber(adminBalanceAfter).minus(getLiquidationReserveBefore).toString(), 'Admin Balance increase correctly');
			assert.equal(getLiquidatedCollateralBefore.toString(), getLiquidationReserveBefore.toString(),'Liquidated collateral and liquidation reserve are equal')
			assert.equal(getLiquidatedCollateralAfter.toString(), 0,'No liquidated collateral')
			assert.equal(getLiquidationReserveAfter.toString(), 0,'No liquidation reserve')
		})

		it('Fail if withdraw collateral reserves by other accounts ', async () => {
			let getLiquidatedCollateral = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;             	        
			await expectRevert(Holdefi.withdrawLiquidationReserve(SampleToken1.address, getLiquidatedCollateral,{from: user1}),
				'Sender should be owner')
		})
	})

// 	describe("Activation assets", async() =>{
// 		beforeEach(async () => {
// 			await scenario(owner,user1, user2, user3, user4);
// 		})

// 		it('Should deactive market if market is active',async () =>{
// 			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
// 			let activate = await HoldefiSettings.marketAssets(SampleToken1.address);
// 	 		assert.isFalse(activate.isActive);
// 		})		

// 		it('Should active market if market is deactive',async () =>{
// 			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
// 			await HoldefiSettings.activateMarket(SampleToken1.address,{from:owner});
// 			let activate = await HoldefiSettings.marketAssets(SampleToken1.address);
// 	 		assert.isTrue(activate.isActive);
// 		})

// 		it('Should deactive collateral if collateral is active',async () =>{
// 			await HoldefiSettings.deactivateCollateral(SampleToken1.address,{from:owner});
// 			let activate = await HoldefiSettings.collateralAssets(SampleToken1.address);
// 	 		assert.isFalse(activate.isActive);
// 		})	

// 		it('Should deactive collateral if collateral is active',async () =>{
// 			await HoldefiSettings.deactivateCollateral(SampleToken1.address,{from:owner});
// 			await HoldefiSettings.activateCollateral(SampleToken1.address,{from:owner});
// 			let activate = await HoldefiSettings.collateralAssets(SampleToken1.address);
// 	 		assert.isTrue(activate.isActive);
// 		})			

// 		it('Should deactive market if market is deactive',async () =>{
// 			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
// 			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
// 			let activate = await HoldefiSettings.marketAssets(SampleToken1.address);
// 	 		assert.isFalse(activate.isActive);
// 		})		

// 		it('Should active market if market is active',async () =>{
// 			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
// 			await HoldefiSettings.activateMarket(SampleToken1.address,{from:owner});
// 			await HoldefiSettings.activateMarket(SampleToken1.address,{from:owner});
// 			let activate = await HoldefiSettings.marketAssets(SampleToken1.address);
// 	 		assert.isTrue(activate.isActive);
// 		})

// 		it('Should deactive collateral if collateral is deactive',async () =>{
// 			await HoldefiSettings.deactivateCollateral(SampleToken1.address,{from:owner});
// 			await HoldefiSettings.deactivateCollateral(SampleToken1.address,{from:owner});
// 			let activate = await HoldefiSettings.collateralAssets(SampleToken1.address);
// 	 		assert.isFalse(activate.isActive);
// 		})	

// 		it('Should active collateral if collateral is active',async () =>{
// 			await HoldefiSettings.deactivateCollateral(SampleToken1.address,{from:owner});
// 			await HoldefiSettings.activateCollateral(SampleToken1.address,{from:owner});
// 			await HoldefiSettings.activateCollateral(SampleToken1.address,{from:owner});
// 			let activate = await HoldefiSettings.collateralAssets(SampleToken1.address);
// 	 		assert.isTrue(activate.isActive);
// 		})	

// 		it('Should deactive market if market is active',async () =>{
// 			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
// 			let activate = await HoldefiSettings.marketAssets(SampleToken1.address);
// 	 		assert.isFalse(activate.isActive);
// 		})

// 		it('Fail active market if market is not exist',async () =>{
// 			await expectRevert(HoldefiSettings.activateMarket(SampleToken4.address,{from:owner}),
// 				'The market is not exist');
// 		})			

// 		it('Fail deactive market if market is not exist',async () =>{
// 			await expectRevert(HoldefiSettings.deactivateMarket(SampleToken4.address,{from:owner}),
// 				'The market is not exist');
// 		})	

// 		it('Fail active collateral if market is not exist',async () =>{
// 			await expectRevert(HoldefiSettings.activateCollateral(SampleToken4.address,{from:owner}),
// 				'The collateral is not exist');
// 		})			

// 		it('Fail deactive collateral if market is not exist',async () =>{
// 			await expectRevert(HoldefiSettings.deactivateCollateral(SampleToken4.address,{from:owner}),
// 				'The collateral is not exist');
// 		})		
// })

// 	describe("add or remove assets", async() =>{
// 		beforeEach(async () => {
// 			await scenario(owner,user1, user2, user3, user4);
// 		})

// 		it('Should add new market asset',async () =>{
// 			await HoldefiSettings.addMarket(SampleToken2.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.9) ,{from:owner});
// 			let activate = await HoldefiSettings.marketAssets(SampleToken1.address);
// 	 		assert.isTrue(activate.isExist);
// 		})				

// 		it('Should add new collateral asset',async () =>{
// 			await HoldefiSettings.addCollateral(SampleToken2.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2),ratesDecimal.multipliedBy(1.05),{from:owner});
// 			let activate = await HoldefiSettings.collateralAssets(SampleToken1.address);
// 	 		assert.isTrue(activate.isExist);
// 		})			

// 		it('Should remove market asset',async () =>{
// 			await HoldefiSettings.addMarket(SampleToken2.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.9) ,{from:owner});
// 			await HoldefiSettings.removeMarket(SampleToken2.address ,{from:owner});
// 			let activate = await HoldefiSettings.marketAssets(SampleToken2.address);
// 	 		assert.isFalse(activate.isExist);
// 		})	

// 		it('Fail add if market asset added before',async () =>{
// 			await expectRevert(HoldefiSettings.addMarket(SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.9) ,{from:owner}),
// 			"The market is exist");
// 			let activate = await HoldefiSettings.marketAssets(SampleToken1.address);
// 	 		assert.isTrue(activate.isExist);
// 		})						

// 		it('Fail add if collateral asset added before',async () =>{
// 			await expectRevert(HoldefiSettings.addCollateral(SampleToken1.address,  ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2),ratesDecimal.multipliedBy(1.05),{from:owner}),
// 			"The collateral is exist");
// 			let activate = await HoldefiSettings.collateralAssets(SampleToken1.address);
// 	 		assert.isTrue(activate.isExist);
// 		})	

// 		it('Fail remove if market asset removed before',async () =>{
// 			await HoldefiSettings.addMarket(SampleToken2.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.9) ,{from:owner});
// 			await HoldefiSettings.removeMarket(SampleToken2.address ,{from:owner});
// 			await expectRevert(HoldefiSettings.removeMarket(SampleToken2.address, {from:owner}),
// 			"The market is not exist");
// 			let activate = await HoldefiSettings.marketAssets(SampleToken2.address);
// 	 		assert.isFalse(activate.isExist);
// 		})			

// 		it('Fail remove market if total borrow is not zero',async () =>{
// 			await expectRevert(HoldefiSettings.removeMarket(SampleToken1.address, {from:owner}),
// 			"Total borrow is not zero");
// 			let activate = await HoldefiSettings.marketAssets(SampleToken1.address);
// 	 		assert.isTrue(activate.isExist);
// 		})			
// 	})
// 	describe("set rates", async() =>{
// 		beforeEach(async () =>{
// 			await scenario(owner,user1,user2,user3,user4);
// 		})

// 		it('Fail if market is not exists on set borrow rate',async () =>{
// 			await expectRevert(HoldefiSettings.setBorrowRate(SampleToken4.address, ratesDecimal.multipliedBy(0.1), {from:owner}),
// 					"The market is not exist");
// 		})		

// 		it('Fail if market is not exists on set suppliers share rate',async () =>{
// 			await expectRevert(HoldefiSettings.setSuppliersShareRate(SampleToken4.address, ratesDecimal.multipliedBy(0.9), {from:owner}),
// 					"The market is not exist");
// 		})		

// 		it('Fail if market is not exists on set VTL rate',async () =>{
// 			await expectRevert(HoldefiSettings.setValueToLoanRate(SampleToken4.address, ratesDecimal.multipliedBy(1.5), {from:owner}),
// 					"The collateral is not exist");
// 		})		

// 		it('Fail if market is not exists on set penalty rate',async () =>{
// 			await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken4.address, ratesDecimal.multipliedBy(1.2), {from:owner}),
// 					"The collateral is not exist");
// 		})		

// 		it('Fail if market is not exists on set bonus rate',async () =>{
// 			await expectRevert(HoldefiSettings.setBonusRate(SampleToken4.address, ratesDecimal.multipliedBy(1.05), {from:owner}),
// 					"The collateral is not exist");
		// })
	// })
})