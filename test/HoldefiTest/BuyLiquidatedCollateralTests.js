module.exports = {
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
    initializeContracts,
    assignToken,
    scenario
} = require ("../Utils.js");

contract("Buy liquidated collateral", function ([owner, user1, user2, user3, user4, user5,user6]) {
	
	describe("Buy liquidated collateral (ETH) by ERC20", async() =>{
		beforeEach(async () => {
			await scenario(owner, user1, user2, user3, user4);
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, await convertToDecimals(SampleToken1, 13), referralCode, {from: user5});
			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 11.5/200));
			await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress);       
			await assignToken(owner, user6, SampleToken1);

			getCollateral = await HoldefiSettings.collateralAssets(ethAddress);  

			payAmount = await convertToDecimals(SampleToken1, 10);       	 
			collateralAmountWithDiscountValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, payAmount))
				.multipliedBy(getCollateral.bonusRate).dividedToIntegerBy(ratesDecimal);
			collateralAmountWithDiscount = await HoldefiPrices.getAssetAmountFromValue(ethAddress, collateralAmountWithDiscountValue)
			collateralToGet = await Holdefi.getDiscountedCollateralAmount(SampleToken1.address, ethAddress, payAmount);

			getLiquidatedMarketBefore = await Holdefi.marketDebt(ethAddress, SampleToken1.address); 
			getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;                       
			ethBalanceBefore = await web3.eth.getBalance(user6)
			tokenBalanceBefore = await SampleToken1.balanceOf(user6)  	
		});

		it('The buyLiquidatedCollateral function work as expected', async () => {
			let HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
			let holdefiCollateralsContractBalanceBefore = await balance.current(HoldefiCollateralsAddress);
			let holdefiContractBalanceBefore = await SampleToken1.balanceOf(Holdefi.address);
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, ethAddress, payAmount, {from: user6});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken1.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6)   
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6)

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculated correctly');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'Market debt decreased')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),
				'Liquidated collateral decreased')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).plus(collateralAmountWithDiscount).toString(),
				'User wallet balance (collateral asset) increased')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).minus(payAmount).toString(),'User wallet balance (market asset) decreased');
			
			let holdefiCollateralsContractBalanceAfter = await balance.current(HoldefiCollateralsAddress);
			let holdefiContractBalanceAfter = await SampleToken1.balanceOf(Holdefi.address);
			assert.equal(holdefiContractBalanceAfter.toString(), bigNumber(holdefiContractBalanceBefore).plus(payAmount).toString(), 'Holdefi contract balance increased');
			assert.equal(holdefiCollateralsContractBalanceAfter.toString(), bigNumber(holdefiCollateralsContractBalanceBefore).minus(collateralToGet).toString(), 
				'HoldefiCollaterals contract balance decreased');
		
		});

		it('The buyLiquidatedCollateral function should work if market is deactivated', async () => {
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.deactivateMarket(ethAddress,{from:owner});
			
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, ethAddress, payAmount, {from: user6});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken1.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6);
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6);

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculated correctly');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'Market debt decreased')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),
				'Liquidated collateral decreased')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).plus(collateralAmountWithDiscount).toString(),
				'User wallet balance (collateral asset) increased')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).minus(payAmount).toString(),'User wallet balance (market asset) decreased')
		});

		it('The buyLiquidatedCollateral function should not be reverted if calling it a month after pausing',async () =>{
			await Holdefi.pause("buyLiquidatedCollateral", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			let amount = await convertToDecimals(SampleToken1, 10);
			await Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, ethAddress, amount, {from: user6});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken1.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;             
			
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'Market debt decreased');
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),
				'Liquidated collateral decreased');
		})

		it('Fail if buyLiquidatedCollateral is paused',async () =>{
            await Holdefi.pause("buyLiquidatedCollateral", time.duration.days(30), {from: owner});
            await time.increase(time.duration.days(29));
            let amount = await convertToDecimals(SampleToken1, 10);
            await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, ethAddress, amount, {from: user6}),
                "POE02");
        })

		it('Fail if market is ETH', async () => {
			let amount = decimal18.multipliedBy(0.2);
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](ethAddress, SampleToken1.address, amount, {from: user6}),
				'E01');
		})

		it('Fail if market amount is more than marketDebt', async () => {
			let amount = await convertToDecimals(SampleToken1, 18);
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, ethAddress, amount, {from: user6}),
				'E17');
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6);
			assert.equal(tokenBalanceBefore.toString(), tokenBalanceAfter.toString());

		})

		it('Fail if discounted collateral amount with discount is more than total liquidated asset', async () => {
			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 100/200));
			let amount = await convertToDecimals(SampleToken1, 13);
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, ethAddress, amount, {from: user6}),
				'E16');
		})   
	})

	describe("Buy liquidated collateral (ETH) by deflating ERC20", async() =>{
		beforeEach(async () => {
			await scenario(owner, user1, user2, user3, user4);
			await assignToken(owner, user5, SampleToken5);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken5.address, ethAddress, await convertToDecimals(SampleToken5, 130), referralCode, {from: user5});
			await SampleToken5PriceAggregator.setPrice(await convertToDecimals(SampleToken5PriceAggregator, 1.15/200));
			await Holdefi.liquidateBorrowerCollateral(user5, SampleToken5.address, ethAddress);       
			await assignToken(owner, user6, SampleToken5);

			getCollateral = await HoldefiSettings.collateralAssets(ethAddress);  

			payAmount = await convertToDecimals(SampleToken5, 10);
			receivedAmount = payAmount.minus(payAmount.dividedToIntegerBy(100));   	 
			collateralAmountWithDiscountValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(SampleToken5.address, receivedAmount))
				.multipliedBy(getCollateral.bonusRate).dividedToIntegerBy(ratesDecimal);
			collateralAmountWithDiscount = await HoldefiPrices.getAssetAmountFromValue(ethAddress, collateralAmountWithDiscountValue)
			collateralToGet = await Holdefi.getDiscountedCollateralAmount(SampleToken5.address, ethAddress, receivedAmount);

			getLiquidatedMarketBefore = await Holdefi.marketDebt(ethAddress, SampleToken5.address); 
			getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;                       
			ethBalanceBefore = await web3.eth.getBalance(user6)
			tokenBalanceBefore = await SampleToken5.balanceOf(user6)  	
		});

		it('The buyLiquidatedCollateral function work as expected', async () => {
			let HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
			let holdefiCollateralsContractBalanceBefore = await balance.current(HoldefiCollateralsAddress);
			let holdefiContractBalanceBefore = await SampleToken5.balanceOf(Holdefi.address);
			
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken5.address, ethAddress, payAmount, {from: user6});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken5.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6)   
			let tokenBalanceAfter = await SampleToken5.balanceOf(user6)

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculated correctly');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(receivedAmount).toString(),'Market debt decreased')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),
				'Liquidated collateral decreased')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).plus(collateralAmountWithDiscount).toString(),
				'User wallet balance (collateral asset) increased')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).minus(payAmount).toString(),'User wallet balance (market asset) decreased')
		
			let holdefiCollateralsContractBalanceAfter = await balance.current(HoldefiCollateralsAddress);
			let holdefiContractBalanceAfter = await SampleToken5.balanceOf(Holdefi.address);
			assert.equal(holdefiContractBalanceAfter.toString(), bigNumber(holdefiContractBalanceBefore).plus(receivedAmount).toString(), 'Holdefi contract balance increased');
			assert.equal(holdefiCollateralsContractBalanceAfter.toString(), bigNumber(holdefiCollateralsContractBalanceBefore).minus(collateralToGet).toString(), 
				'HoldefiCollaterals contract balance decreased');
		});
	})
	
	describe("Buy liquidated collateral (ERC20) by ETH", async() =>{
		beforeEach(async () => {
			await scenario(owner, user1, user2, user3, user4);
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['supply(uint16)'](referralCode, {from:user1, value: decimal18.multipliedBy(1)});	        
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, await convertToDecimals(SampleToken1, 20), {from:user5});
			await Holdefi.borrow(ethAddress, SampleToken1.address, decimal18.multipliedBy(0.65), referralCode, {from: user5});
			           
			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 8/200));  
			await Holdefi.liquidateBorrowerCollateral(user5, ethAddress, SampleToken1.address);

			getCollateral = await HoldefiSettings.collateralAssets(SampleToken1.address);

			payAmount = decimal18.multipliedBy(0.5);
			collateralAmountWithDiscountValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(ethAddress, payAmount))
				.multipliedBy(getCollateral.bonusRate).dividedToIntegerBy(ratesDecimal)
			collateralAmountWithDiscount = await HoldefiPrices.getAssetAmountFromValue(SampleToken1.address, collateralAmountWithDiscountValue)
			collateralToGet = await Holdefi.getDiscountedCollateralAmount(ethAddress, SampleToken1.address, payAmount);

			getLiquidatedMarketBefore = await Holdefi.marketDebt(SampleToken1.address, ethAddress);   	       	 
			getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;                       
			ethBalanceBefore = await web3.eth.getBalance(user6);
			tokenBalanceBefore = await SampleToken1.balanceOf(user6);    
		});
		
		it('The buyLiquidatedCollateral function work as expected', async () => {
			let HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
			let holdefiCollateralsContractBalanceBefore = await SampleToken1.balanceOf(HoldefiCollateralsAddress);
			let holdefiContractBalanceBefore = await balance.current(Holdefi.address);
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: payAmount});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(SampleToken1.address, ethAddress);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6)   
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6)	

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculated correctly');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'Market debt decreased')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralAmountWithDiscount).toString(),
				'Liquidated collateral decreased')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).minus(payAmount).toString(),
				'User wallet balance (market asset) decreased')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).plus(collateralAmountWithDiscount).toString(),
				'User wallet balance (collateral asset) increased')

			let holdefiCollateralsContractBalanceAfter = await SampleToken1.balanceOf(HoldefiCollateralsAddress);
			let holdefiContractBalanceAfter = await balance.current(Holdefi.address);
			assert.equal(holdefiContractBalanceAfter.toString(), bigNumber(holdefiContractBalanceBefore).plus(payAmount).toString(), 'Holdefi contract balance increased');
			assert.equal(holdefiCollateralsContractBalanceAfter.toString(), bigNumber(holdefiCollateralsContractBalanceBefore).minus(collateralToGet).toString(), 
				'HoldefiCollaterals contract balance decreased');
		})

		it('The buyLiquidatedCollateral function should work if market is deactivated', async () => {
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.deactivateMarket(ethAddress,{from:owner});
			
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: payAmount});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(SampleToken1.address, ethAddress);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6)   
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6)	

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculated correctly');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'Market Debt decreased')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralAmountWithDiscount).toString(),
				'Liquidated collateral decreased')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).minus(payAmount).toString(),
				'User wallet balance (market asset) decreased')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).plus(collateralAmountWithDiscount).toString(),
				'User wallet balance (collateral asset) increased')
		})

		it('The buyLiquidatedCollateral function should not be reverted if calling it a month after pausing',async () =>{
			await Holdefi.pause("buyLiquidatedCollateral", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: decimal18.multipliedBy(0.5)});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(SampleToken1.address, ethAddress);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;             
			
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'Market debt decreased');
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),
				'Liquidated collateral decreased');
		})

		it('Fail if buyLiquidatedCollateral is paused',async () =>{
            await Holdefi.pause("buyLiquidatedCollateral", time.duration.days(30), {from: owner});
            await time.increase(time.duration.days(29));
            await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: decimal18.multipliedBy(0.5)}),
                "POE02");
        })
		
		it('Fail if market amount is more than marketDebt', async () => {
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address, {from: user6 , value: decimal18.multipliedBy(5)}),
				'E17');
		})		
	})

	describe("Buy liquidated collateral (deflating ERC20) by ETH", async() =>{
		beforeEach(async () => {
			await scenario(owner, user1, user2, user3, user4);
			await assignToken(owner, user5, SampleToken5);
			await Holdefi.methods['supply(uint16)'](referralCode, {from:user1, value: decimal18.multipliedBy(1)});	        
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken5.address, await convertToDecimals(SampleToken5, 200), {from:user5});
			await Holdefi.borrow(ethAddress, SampleToken5.address, decimal18.multipliedBy(0.65), referralCode, {from: user5});
			           
			await SampleToken5PriceAggregator.setPrice(await convertToDecimals(SampleToken5PriceAggregator, 0.8/200));  
			await Holdefi.liquidateBorrowerCollateral(user5, ethAddress, SampleToken5.address);

			getCollateral = await HoldefiSettings.collateralAssets(SampleToken5.address);

			payAmount = decimal18.multipliedBy(0.5);
			collateralAmountWithDiscountValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(ethAddress, payAmount))
				.multipliedBy(getCollateral.bonusRate).dividedToIntegerBy(ratesDecimal)
			collateralAmountWithDiscount = bigNumber(await HoldefiPrices.getAssetAmountFromValue(SampleToken5.address, collateralAmountWithDiscountValue))
			collateralToGet = await Holdefi.getDiscountedCollateralAmount(ethAddress, SampleToken5.address, payAmount);

			getLiquidatedMarketBefore = await Holdefi.marketDebt(SampleToken5.address, ethAddress);   	       	 
			getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(SampleToken5.address)).totalLiquidatedCollateral;                       
			ethBalanceBefore = await web3.eth.getBalance(user6);
			tokenBalanceBefore = await SampleToken5.balanceOf(user6);    
		});
		
		it('The buyLiquidatedCollateral function work as expected', async () => {
			let HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
			let holdefiCollateralsContractBalanceBefore = await SampleToken5.balanceOf(HoldefiCollateralsAddress);
			let holdefiContractBalanceBefore = await balance.current(Holdefi.address);
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken5.address,  {from: user6 , value: payAmount});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(SampleToken5.address, ethAddress);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken5.address)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6)   
			let tokenBalanceAfter = await SampleToken5.balanceOf(user6)	

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			let receivedAmount = collateralAmountWithDiscount.minus(collateralAmountWithDiscount.dividedToIntegerBy(100));

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculated correctly');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'Market debt decreased')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralAmountWithDiscount).toString(),
				'Liquidated collateral decreased')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).minus(payAmount).toString(),
				'User wallet balance (market asset) decreased')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).plus(receivedAmount).toString(),
				'User wallet balance (collateral asset) increased')

			let holdefiCollateralsContractBalanceAfter = await SampleToken5.balanceOf(HoldefiCollateralsAddress);
			let holdefiContractBalanceAfter = await balance.current(Holdefi.address);
			assert.equal(holdefiContractBalanceAfter.toString(), bigNumber(holdefiContractBalanceBefore).plus(payAmount).toString(), 'Holdefi contract balance increased');
			assert.equal(holdefiCollateralsContractBalanceAfter.toString(), bigNumber(holdefiCollateralsContractBalanceBefore).minus(collateralToGet).toString(), 
				'HoldefiCollaterals contract balance decreased');
		})
	})
})
