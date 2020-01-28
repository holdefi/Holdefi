module.exports = {
	constants,
	balance,
	time,
	expectRevert,
	bigNumber,
	decimal18,
	ratesDecimal,
	secondsPerYear,
	gasPrice,

	HoldefiContract,
	HoldefiSettingsContract,
	MedianizerContract,
	HoldefiPricesContract,
	SampleTokenContract,
	CollateralsWalletContract,	

	initializeContracts,
	assignToken,
	addERC20Market,
	addETHMarket,
	addERC20Collateral,
	scenario
} = require ("../Utils.js");

contract("Buy liquidated collateral", function ([owner, ownerChanger, user1, user2, user3, user4, user5,user6]) {
	
	describe("Buy liquidated collateral (ETH) by ERC20", async() =>{
		beforeEach(async () => {
			await scenario(owner, ownerChanger, user1, user2, user3, user4);
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(13), {from: user5});
			await Medianizer.set(decimal18.multipliedBy(170));
			await Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS);       
			await assignToken(owner, user6, SampleToken1);

			this.getCollateral = await HoldefiSettings.collateralAssets(constants.ZERO_ADDRESS);
			this.collateralPrice = await HoldefiPrices.getPrice(constants.ZERO_ADDRESS);
			this.marketPrice = await HoldefiPrices.getPrice(SampleToken1.address);  

			this.payAmount = decimal18.multipliedBy(10);       	 
			this.collateralAmountWithDiscount = payAmount.multipliedBy(marketPrice).multipliedBy(getCollateral.bonusRate).dividedToIntegerBy(collateralPrice).dividedToIntegerBy(ratesDecimal)
			this.collateralToGet = await Holdefi.getDiscountedCollateralAmount(SampleToken1.address, constants.ZERO_ADDRESS, payAmount);

			this.getLiquidatedMarketBefore = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address); 
			this.getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;                       
			this.ethBalanceBefore = await web3.eth.getBalance(user6)
			this.tokenBalanceBefore = await SampleToken1.balanceOf(user6)  	
		});

		it('Should buy liquidations', async () => {
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, payAmount, {from: user6});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6)   
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6)

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculation');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'marketDebt decreased correctly')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),'liquidatedCollaterals decreased correctly')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).plus(collateralAmountWithDiscount).toString(),'User ETH balance increased correctly')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).minus(payAmount).toString(),'User ERC20 balance decreased correctly')
		});
	
		it('Should buy liquidations if market is removed', async () => {
			await HoldefiSettings.removeMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.removeMarket(constants.ZERO_ADDRESS,{from:owner});
			
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, payAmount, {from: user6});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6);
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6);

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculation');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'marketDebt decreased correctly')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),'liquidatedCollaterals decreased correctly')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).plus(collateralAmountWithDiscount).toString(),'User ETH balance increased correctly')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).minus(payAmount).toString(),'User ERC20 balance decreased correctly')
		});

		it('buyLiquidatedCollateral if one month passed after pause',async () =>{
			await Holdefi.pause(7, {from: owner});
			await time.increase(time.duration.days(30));
			
			await Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(10), {from: user6});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;             
			
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'marketDebt decreased correctly');
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),'liquidatedCollaterals decreased correctly');
		})

		it('Fail if buyLiquidatedCollateral was paused and call buyLiquidatedCollateral before one month',async () =>{
            await Holdefi.pause(7, {from: owner});
            await time.increase(time.duration.days(29));
            await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(10), {from: user6}),
                "Pausable: paused");
        })

		it('Fail if market is zero address ', async () => {
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](constants.ZERO_ADDRESS, SampleToken1.address, decimal18.multipliedBy(0.2), {from: user6}),
				'Market should not be zero address');
		})

		it('Fail if market amount is more than marketDebt', async () => {
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(18), {from: user6}),
				'Amount should be less than total liquidated assets');
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6);
			assert.equal(tokenBalanceBefore.toString(), tokenBalanceAfter.toString());

		})

		it('Fail if collateral amount with discount is more than total liquidated assets', async () => {
			await Medianizer.set(decimal18.multipliedBy(100));
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(13), {from: user6}),
				'Collateral amount with discount should be less than total liquidated assets');
		})   
	}) 
	
	describe("Buy liquidated collateral (ERC20) by ETH", async() =>{
		beforeEach(async () => {
			await scenario(owner, ownerChanger, user1, user2, user3, user4);
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['supply()']({from:user1, value: decimal18.multipliedBy(1)});	        
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
			await Holdefi.borrow(constants.ZERO_ADDRESS, SampleToken1.address, decimal18.multipliedBy(0.65), {from: user5});
			           
			await HoldefiPrices.setPrice(SampleToken1.address, decimal18.multipliedBy(8));   
			await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address);

			this.getCollateral = await HoldefiSettings.collateralAssets(SampleToken1.address);
			this.collateralPrice = await HoldefiPrices.getPrice(SampleToken1.address);
			this.marketPrice = await HoldefiPrices.getPrice(constants.ZERO_ADDRESS);

			this.payAmount = decimal18.multipliedBy(0.5);
			this.collateralAmountWithDiscount = payAmount.multipliedBy(marketPrice).multipliedBy(getCollateral.bonusRate).dividedToIntegerBy(collateralPrice).dividedToIntegerBy(ratesDecimal).toString()
			this.collateralToGet = await Holdefi.getDiscountedCollateralAmount(constants.ZERO_ADDRESS, SampleToken1.address, payAmount);

			this.getLiquidatedMarketBefore = await Holdefi.marketDebt(SampleToken1.address, constants.ZERO_ADDRESS);   	       	 
			this.getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;                       
			this.ethBalanceBefore = await web3.eth.getBalance(user6);
			this.tokenBalanceBefore = await SampleToken1.balanceOf(user6);    
		});
		
		it('Should buy liquidations', async () => {
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: payAmount});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(SampleToken1.address, constants.ZERO_ADDRESS);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6)   
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6)	

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculation');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'marketDebt decreased correctly')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralAmountWithDiscount).toString(),'liquidatedCollaterals decreased correctly')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).minus(payAmount).toString(),'User ETH balance decreased correctly')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).plus(collateralAmountWithDiscount).toString(),'User ERC20 balance increased correctly')
		})

		it('Should buy liquidations if market is removed', async () => {
			await HoldefiSettings.removeMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.removeMarket(constants.ZERO_ADDRESS,{from:owner});
			
			let tx = await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: payAmount});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(SampleToken1.address, constants.ZERO_ADDRESS);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;             
			let ethBalanceAfter = await web3.eth.getBalance(user6)   
			let tokenBalanceAfter = await SampleToken1.balanceOf(user6)	

			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(collateralAmountWithDiscount.toString(), collateralToGet.toString(), 'Discounted collateral calculation');
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'marketDebt decreased correctly')
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralAmountWithDiscount).toString(),'liquidatedCollaterals decreased correctly')       
			assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).minus(payAmount).toString(),'User ETH balance decreased correctly')
			assert.equal(tokenBalanceAfter.toString(), bigNumber(tokenBalanceBefore).plus(collateralAmountWithDiscount).toString(),'User ERC20 balance increased correctly')
		})

		it('buyLiquidatedCollateral if one month passed after pause',async () =>{
			await Holdefi.pause(7, {from: owner});
			await time.increase(time.duration.days(30));
			
			await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: decimal18.multipliedBy(0.5)});
			let getLiquidatedMarketAfter = await Holdefi.marketDebt(SampleToken1.address, constants.ZERO_ADDRESS);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;             
			
			assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).minus(payAmount).toString(),'marketDebt decreased correctly');
			assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).minus(collateralToGet).toString(),'liquidatedCollaterals decreased correctly');
		})

		it('Fail if buyLiquidatedCollateral was paused and call buyLiquidatedCollateral before one month',async () =>{
            await Holdefi.pause(7, {from: owner});
            await time.increase(time.duration.days(29));
            await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: decimal18.multipliedBy(0.5)}),
                "Pausable: paused");
        })
		
		it('Fail if market amount is more than marketDebt', async () => {
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address, {from: user6 , value: decimal18.multipliedBy(5)}),
				'Amount should be less than total liquidated assets');
			// let ethBalanceAfter = await web3.eth.getBalance(user6);
			// let gasUsed = await Holdefi.methods['buyLiquidatedCollateral(address)'].estimateGas(SampleToken1.address, {from: user6 , value: decimal18.multipliedBy(5)});
			// let txFee = gasPrice.multipliedBy(gasUsed);
			
			// assert.equal(ethBalanceAfter.toString() , bigNumber(ethBalanceBefore).minus(txFee).toString())
		})
		
		it('Fail if collateral amount with discount is more than total liquidated assets', async () => {          
			await HoldefiPrices.setPrice(SampleToken1.address, decimal18.multipliedBy(5.2));   
			await expectRevert(Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: decimal18.multipliedBy(0.5)}),
				'Collateral amount with discount should be less than total liquidated assets');
		}) 
	})
})
