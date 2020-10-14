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
    HoldefiCollateralContract,
    SampleTokenContract,
    AggregatorContract,

    convertToDecimals,
    initializeContracts,
    assignToken,
    scenario,
    scenario2
} = require ("../Utils.js");

contract("Borrow", function([owner,user1,user2,user3,user4,user5,user6,user7]){
	describe("ERC20 borrow", async() => {
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user6, SampleToken1);
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address, 
				await convertToDecimals(SampleToken1, 100),
				referalCode,
				{from:user6}
			);

			userBalanceBefore = await SampleToken1.balanceOf(user5);
			userBalanceBefore2 = await SampleToken1.balanceOf(user6);
		})
		
		it('ERC20 asset borrowed',async () =>{
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

			let borrowAmount = await convertToDecimals(SampleToken1, 10);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referalCode, {from: user5});
			
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			assert.equal(getAccountBorrow.balance.toString(), borrowAmount.toString(), 'Balance increased');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).plus(borrowAmount).toString(), 'Total borrow increased');

			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 'Borrow Power increased');
			
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(borrowAmount).toString(), 'User Balance increased correctly');
		})

		it('ERC20 asset borrowed for someone else',async () =>{
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

			let borrowAmount = await convertToDecimals(SampleToken1, 10);
			await Holdefi.approveBorrow(user6, SampleToken1.address, ethAddress, borrowAmount, {from:user5})
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrowBehalf(user5, SampleToken1.address, ethAddress, borrowAmount, referalCode, {from: user6});
			
			let getAccountAllowanceAfter = await Holdefi.getAccountBorrowAllowance(user5, user6, SampleToken1.address, ethAddress);
			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User borrow allowance decreased');

			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			assert.equal(getAccountBorrow.balance.toString(), borrowAmount.toString(), 'User borrow balance increased');
			let getAccountBorrow2 = await Holdefi.getAccountBorrow(user6, SampleToken1.address, ethAddress);
			assert.equal(getAccountBorrow2.balance.toString(), 0, 'Sender borrow balance not changed');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).plus(borrowAmount).toString(), 'Total borrow increased');

			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 'User borrow Power increased');
			
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).toString(), 'User erc20 balance not changed');
			let userBalanceAfter2 = await SampleToken1.balanceOf(user6);
			assert.equal(userBalanceAfter2.toString(), bigNumber(userBalanceBefore2).plus(borrowAmount).toString(), 'Sender erc20 balance increased correctly');
		})
		
		it('Borrower interest should be increased',async () => {
			let borrowAmount = await convertToDecimals(SampleToken1, 10);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referalCode, {from: user5});
			let time1 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			let time2 = await time.latest();
			
			let marketInterest = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
			
			let x = bigNumber(time2-time1).multipliedBy(marketInterest.borrowRate).multipliedBy(getAccountBorrow.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			
			assert.equal(getAccountBorrow.interest.toString() , x.toString());
		})

		it('Borrower interest should be increased after second borrow',async () => {
			let borrowAmount = await convertToDecimals(SampleToken1, 5);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referalCode, {from: user5});
			let time1 = await time.latest();

			let getAccountBorrowBefore = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			let marketInterestBefore = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);

			await time.increase(time.duration.days(5));
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referalCode, {from: user5});
			let time2 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			let time3 = await time.latest();

			let marketInterestAfter = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(marketInterestBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			let x2 = bigNumber(time3-time2).multipliedBy(marketInterestAfter.borrowRate).multipliedBy(getAccountBorrowAfter.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			
			assert.equal(getAccountBorrowAfter.interest.toString(), x1.plus(x2).toString());
		})

		it('Supply rate should be increased after borrowing',async () => {
			let borrowAmount = await convertToDecimals(SampleToken1, 10);
			let marketInterestBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referalCode, {from: user5});
			let marketInterestAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			assert.isAbove(marketInterestAfter.supplyRate.toNumber(), marketInterestBefore.supplyRate.toNumber());
		})
		
		it('Admin Reserve increased corretly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = (await Holdefi.getPromotionReserve(SampleToken1.address)).promotionReserveScaled;
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			let marketSupplyInterestBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
			let marketBorrowInterestBefore = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);

			let borrowAmount = await convertToDecimals(SampleToken1, 5);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referalCode, {from: user5});
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(SampleToken1.address);
			let reserveAfter = bigNumber(marketFeaturesAfter.promotionReserveScaled);	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(marketBorrowInterestBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(marketSupplyInterestBefore.supplyRate).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);

			assert.equal(adminShare.toString(), x.toString());
		})

		it('Borrow if one month passed after pause',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.pause("borrow", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			let borrowAmount = await convertToDecimals(SampleToken1, 10);
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referalCode, {from: user5});
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			assert.equal(getAccountBorrow.balance.toString(), borrowAmount.toString(), 'Balance increased');
		})

		it('Fail if borrow was paused and call borrow before one month',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.pause("borrow", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address,
					ethAddress,
					await convertToDecimals(SampleToken1, 10),
					referalCode,
					{from: user5}
				),
				"Operation is paused"
			);
		})			

		it('Fail if borrow ERC20 asset for someone else without approve',async () =>{
			let borrowAmount = await convertToDecimals(SampleToken1, 10);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await expectRevert(Holdefi.borrowBehalf(user5, SampleToken1.address, ethAddress, borrowAmount, referalCode, {from: user6}),
 			"Withdraw not allowed");
		})

		it('Fail borrow if market is removed',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			let repayAmount = await convertToDecimals(SampleToken1, 50);
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, repayAmount, {from:user3});
			await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user4, value: decimal18.multipliedBy(20)});
			await HoldefiSettings.removeMarket(SampleToken1.address,{from:owner});			
			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address,
					ethAddress,
					await convertToDecimals(SampleToken1, 10),
					referalCode,
					{from: user5}
				),
				"Market is not active"
			);
		})	

		it('Fail if borrow asset is not active',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address,
					ethAddress,
					await convertToDecimals(SampleToken1, 10),
					referalCode,
					{from: user5}
				),
				"Market is not active"
			);
		})	

		it('Fail if collateral is not active',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await HoldefiSettings.deactivateCollateral(ethAddress,{from:owner});
			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address, 
					ethAddress, 
					await convertToDecimals(SampleToken1, 10),
					referalCode,
					{from: user5}
				),
				"Collateral is not active"
			);
		})	

		it('Fail if amount is more than cash',async () =>{
			let marketFeatures = await Holdefi.marketAssets(SampleToken1.address);
			let cash = bigNumber(marketFeatures.totalSupply).minus(marketFeatures.totalBorrow);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(3)});

			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address, 
					ethAddress, 
					cash.plus(1), 
					referalCode,
					{from: user5}
				),
				"Amount should be less than cash"
			);
		})

		it('Fail if user is under collateral',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(
				SampleToken1.address, 
				ethAddress, 
				await convertToDecimals(SampleToken1, 10), 
				referalCode,
				{from: user5}
			);

			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 16));

			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.isTrue(getAccountCollateral.underCollateral, 'User is collateral');

			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address, 
					ethAddress, 
					await convertToDecimals(SampleToken1, 5),
					referalCode,
					{from: user5}
				),
				"Borrow power should be more than new borrow value"
			);			
		})

		it('Fail if borrow power less than new borrow value',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});

			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address, 
					ethAddress, 
					await convertToDecimals(SampleToken1, 16),
					referalCode,
					{from: user5}),
				"Borrow power should be more than new borrow value"
			);
		})

		it('Fail for second borrow if value to loan of borrower between 145% and 150%',async () => {
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(
				SampleToken1.address,
				ethAddress,
				await convertToDecimals(SampleToken1, 11),
				referalCode,
				{from: user5}
			);

			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 12.45/200));

			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.equal(getAccountCollateral.borrowPowerValue.toString(), 0, 'Borrow power is zero');

			assert.isFalse(getAccountCollateral.underCollateral, 'User is not under collateral');

			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address, 
					ethAddress, 
					await convertToDecimals(SampleToken1, 2),
					referalCode,
					{from: user5}
				),
				"Borrow power should be more than new borrow value");
		})

		it('Fail if user not collateralize at all',async () =>{
			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address,
					ethAddress,
					await convertToDecimals(SampleToken1, 5),
					referalCode,
					{from: user5}
				),
				"Borrow power should be more than new borrow value");	
		})
	})
	
	describe("ETH borrow", async() => {
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
		})

		it('ETH borrowed',async () =>{
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			let getMarketBefore = await Holdefi.marketAssets(ethAddress);
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, await convertToDecimals(SampleToken1, 40), {from:user5});
			let userBalanceBefore = await web3.eth.getBalance(user5);
			let tx = await Holdefi.borrow(ethAddress, SampleToken1.address, decimal18.multipliedBy(0.5), referalCode, {from: user5});
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, ethAddress, SampleToken1.address)
			assert.equal(getAccountBorrow.balance.toString(), decimal18.multipliedBy(0.5).toString(), 'Balance increased');

			let getMarketAfter = await Holdefi.marketAssets(ethAddress);
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).plus(decimal18.multipliedBy(0.5)).toString(), 'Total borrow increased');
		
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 'Borrow Power increased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(decimal18.multipliedBy(0.5)).toString(), 'User Balance increased correctly');
		})

		it('ETH borrowed for someone else',async () =>{
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			let getMarketBefore = await Holdefi.marketAssets(ethAddress);
			await Holdefi.approveBorrow(user6, ethAddress, SampleToken1.address, decimal18.multipliedBy(0.5), {from:user5});
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, await convertToDecimals(SampleToken1, 40), {from:user5});
			let userBalanceBefore = await web3.eth.getBalance(user6);
			let tx = await Holdefi.borrowBehalf(user5, ethAddress, SampleToken1.address, decimal18.multipliedBy(0.5), referalCode, {from: user6});
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, ethAddress, SampleToken1.address)
			assert.equal(getAccountBorrow.balance.toString(), decimal18.multipliedBy(0.5).toString(), 'User borrow balance increased');

			let getAccountAllowanceAfter = await Holdefi.getAccountBorrowAllowance(user5, user6, ethAddress, SampleToken1.address);
			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User borrow allowance decreased');

			let getMarketAfter = await Holdefi.marketAssets(ethAddress);
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).plus(decimal18.multipliedBy(0.5)).toString(), 'Total borrow increased');
		
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 'Borrow Power increased');
			
			let userBalanceAfter = await web3.eth.getBalance(user6);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(decimal18.multipliedBy(0.5)).toString(), 'Sender ETH balance increased correctly');
		})
		it('Fail if borrow ETH  for someone else without approve',async () =>{
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, await convertToDecimals(SampleToken1, 40), {from:user5});
			await expectRevert(Holdefi.borrowBehalf(user5, ethAddress, SampleToken1.address, decimal18.multipliedBy(0.5), referalCode, {from: user6}),
 			"Withdraw not allowed");
		})
	})	

	describe("Borrow scenario 2", async() =>{
		beforeEach(async() => {
			await scenario2(owner,user1,user2,user3,user4,user7);
			userBalanceBefore = await SampleToken1.balanceOf(user7);
		})
		
		it('Should borrow asset',async () =>{
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user7, SampleToken3.address);
			let borrowAmount = await convertToDecimals(SampleToken1, 0.2);
			let getAccountBorrowBefore = await Holdefi.getAccountBorrow(user7, SampleToken1.address, SampleToken3.address);
			await Holdefi.borrow(SampleToken1.address, SampleToken3.address, borrowAmount, referalCode, {from: user7});
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user7, SampleToken3.address);
			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user7, SampleToken1.address, SampleToken3.address);
			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).plus(borrowAmount).toString(), 'Borrow balance is increased');
			let sampleToken1Value = await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, await convertToDecimals(SampleToken1, 0.2));
			assert.equal(getAccountCollateralAfter.totalBorrowValue.toString(), bigNumber(getAccountCollateralBefore.totalBorrowValue).plus(sampleToken1Value).toString() ,'Borrow value is increased');
		})

		it('Fail if borrow value is more than power',async () =>{
			let borrowAmount = await convertToDecimals(SampleToken1, 0.3);
			await expectRevert(Holdefi.borrow(SampleToken1.address, SampleToken3.address, borrowAmount, referalCode, {from: user7}),
				'Borrow power should be more than new borrow value');
		})

	})
})