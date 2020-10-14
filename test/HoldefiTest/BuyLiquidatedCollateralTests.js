module.exports = {
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
			await Holdefi.borrow(SampleToken1.address, ethAddress, await convertToDecimals(SampleToken1, 13), referalCode, {from: user5});
			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 11.5/200));
			await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress);       
			await assignToken(owner, user6, SampleToken1);

			getCollateral = await HoldefiSettings.collateralAssets(ethAddress);  

			payAmount = await convertToDecimals(SampleToken1, 10);       	 
			collateralAmountWithDiscountValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, payAmount)).multipliedBy(getCollateral.bonusRate).dividedToIntegerBy(ratesDecimal)
			collateralAmountWithDiscount = await HoldefiPrices.getAssetAmountFromValue(ethAddress, collateralAmountWithDiscountValue)
			collateralToGet = await Holdefi.getDiscountedCollateralAmount(SampleToken1.address, ethAddress, payAmount);

			getLiquidatedMarketBefore = await Holdefi.marketDebt(ethAddress, SampleToken1.address); 
			getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;                       
			ethBalanceBefore = await web3.eth.getBalance(user6)
			tokenBalanceBefore = await SampleToken1.balanceOf(user6)  	
		});

		it('Should buy liquidations', async () => {
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, ethAddress, payAmount, {from: user6});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken1.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6)   
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6)

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculation');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'marketDebt decreased correctly')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),'liquidatedCollateral decreased correctly')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).plus(collateralAmountWithDiscount).toString(),'User ETH balance increased correctly')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).minus(payAmount).toString(),'User ERC20 balance decreased correctly')
		});
		
		it('Should buy liquidations if market is deactivated', async () => {
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.deactivateMarket(ethAddress,{from:owner});
			
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, ethAddress, payAmount, {from: user6});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken1.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6);
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6);

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculation');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'marketDebt decreased correctly')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),'liquidatedCollateral decreased correctly')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).plus(collateralAmountWithDiscount).toString(),'User ETH balance increased correctly')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).minus(payAmount).toString(),'User ERC20 balance decreased correctly')
		});

		it('buyLiquidatedCollateral if one month passed after pause',async () =>{
			await Holdefi.pause("buyLiquidatedCollateral", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, ethAddress, await convertToDecimals(SampleToken1, 10), {from: user6});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken1.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;             
			
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'marketDebt decreased correctly');
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),'liquidatedCollateral decreased correctly');
		})

		it('Fail if buyLiquidatedCollateral was paused and call buyLiquidatedCollateral before one month',async () =>{
            await Holdefi.pause("buyLiquidatedCollateral", time.duration.days(30), {from: owner});
            await time.increase(time.duration.days(29));
            await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, ethAddress, await convertToDecimals(SampleToken1, 10), {from: user6}),
                "Operation is paused");
        })

		it('Fail if market is zero address ', async () => {
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](ethAddress, SampleToken1.address, decimal18.multipliedBy(0.2), {from: user6}),
				'Asset should not be ETH address');
		})

		it('Fail if market amount is more than marketDebt', async () => {
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, ethAddress, await convertToDecimals(SampleToken1, 18), {from: user6}),
				'Amount should be less than total liquidated assets');
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6);
			assert.equal(tokenBalanceBefore.toString(), tokenBalanceAfter.toString());

		})

		it('Fail if collateral amount with discount is more than total liquidated assets', async () => {
			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 100/200));
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, ethAddress, await convertToDecimals(SampleToken1, 13), {from: user6}),
				'Collateral amount with discount should be less than total liquidated assets');
		})   
	}) 
	
	describe("Buy liquidated collateral (ERC20) by ETH", async() =>{
		beforeEach(async () => {
			await scenario(owner, user1, user2, user3, user4);
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['supply(uint16)'](referalCode, {from:user1, value: decimal18.multipliedBy(1)});	        
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, await convertToDecimals(SampleToken1, 20), {from:user5});
			await Holdefi.borrow(ethAddress, SampleToken1.address, decimal18.multipliedBy(0.65), referalCode, {from: user5});
			           
			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 8/200));  
			await Holdefi.liquidateBorrowerCollateral(user5, ethAddress, SampleToken1.address);

			getCollateral = await HoldefiSettings.collateralAssets(SampleToken1.address);

			payAmount = decimal18.multipliedBy(0.5);
			collateralAmountWithDiscountValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(ethAddress, payAmount)).multipliedBy(getCollateral.bonusRate).dividedToIntegerBy(ratesDecimal)
			collateralAmountWithDiscount = await HoldefiPrices.getAssetAmountFromValue(SampleToken1.address, collateralAmountWithDiscountValue)
			collateralToGet = await Holdefi.getDiscountedCollateralAmount(ethAddress, SampleToken1.address, payAmount);

			getLiquidatedMarketBefore = await Holdefi.marketDebt(SampleToken1.address, ethAddress);   	       	 
			getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;                       
			ethBalanceBefore = await web3.eth.getBalance(user6);
			tokenBalanceBefore = await SampleToken1.balanceOf(user6);    
		});
		
		it('Should buy liquidations', async () => {
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: payAmount});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(SampleToken1.address, ethAddress);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6)   
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6)	

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculation');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'marketDebt decreased correctly')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralAmountWithDiscount).toString(),'liquidatedCollateral decreased correctly')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).minus(payAmount).toString(),'User ETH balance decreased correctly')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).plus(collateralAmountWithDiscount).toString(),'User ERC20 balance increased correctly')
		})

		it('Should buy liquidations if market is deactivated', async () => {
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.deactivateMarket(ethAddress,{from:owner});
			
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: payAmount});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(SampleToken1.address, ethAddress);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6)   
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6)	

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculation');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'marketDebt decreased correctly')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralAmountWithDiscount).toString(),'liquidatedCollateral decreased correctly')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).minus(payAmount).toString(),'User ETH balance decreased correctly')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).plus(collateralAmountWithDiscount).toString(),'User ERC20 balance increased correctly')
		})

		it('buyLiquidatedCollateral if one month passed after pause',async () =>{
			await Holdefi.pause("buyLiquidatedCollateral", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: decimal18.multipliedBy(0.5)});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(SampleToken1.address, ethAddress);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;             
			
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'marketDebt decreased correctly');
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),'liquidatedCollateral decreased correctly');
		})

		it('Fail if buyLiquidatedCollateral was paused and call buyLiquidatedCollateral before one month',async () =>{
            await Holdefi.pause("buyLiquidatedCollateral", time.duration.days(30), {from: owner});
            await time.increase(time.duration.days(29));
            await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: decimal18.multipliedBy(0.5)}),
                "Operation is paused");
        })
		
		it('Fail if market amount is more than marketDebt', async () => {
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address, {from: user6 , value: decimal18.multipliedBy(5)}),
				'Amount should be less than total liquidated assets');
		})		
	})
})
