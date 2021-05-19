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
	describe("ERC20 Borrow", async() => {
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user6, SampleToken1);
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address, 
				await convertToDecimals(SampleToken1, 100),
				referralCode,
				{from:user6}
			);
			userBalanceBefore = await SampleToken1.balanceOf(user5);
			userBalanceBefore2 = await SampleToken1.balanceOf(user6);
		})
		
		it('The borrow function should work as expected',async () =>{
			let contractBalanceBefore = await SampleToken1.balanceOf(Holdefi.address);
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

			let borrowAmount = await convertToDecimals(SampleToken1, 10);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referralCode, {from: user5});
			
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			assert.equal(getAccountBorrow.balance.toString(), borrowAmount.toString(), 'User borrow balance increased');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).plus(borrowAmount).toString(), 'Total borrow increased');

			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 
				'User borrow power increased');
			
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(borrowAmount).toString(), 'User wallet balance increased');

			let contractBalanceAfter = await SampleToken1.balanceOf(Holdefi.address);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(borrowAmount).toString(), 'Holdefi contract balance decreased');
		})

		it('The borrowBehalf function should work as expected',async () =>{
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

			let borrowAmount = await convertToDecimals(SampleToken1, 10);
			await Holdefi.approveBorrow(user6, SampleToken1.address, ethAddress, borrowAmount, {from:user5})
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrowBehalf(user5, SampleToken1.address, ethAddress, borrowAmount, referralCode, {from: user6});
			
			let getAccountAllowanceAfter = await Holdefi.getAccountBorrowAllowance(user5, user6, SampleToken1.address, ethAddress);
			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User borrow allowance decreased');

			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			assert.equal(getAccountBorrow.balance.toString(), borrowAmount.toString(), 'User borrow balance increased');
			let getAccountBorrow2 = await Holdefi.getAccountBorrow(user6, SampleToken1.address, ethAddress);
			assert.equal(getAccountBorrow2.balance.toString(), 0, 'Sender borrow balance not changed');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).plus(borrowAmount).toString(), 'Total borrow increased');

			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue),
			 'User borrow power increased');
			
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).toString(), 'User wallet balance not changed');
			let userBalanceAfter2 = await SampleToken1.balanceOf(user6);
			assert.equal(userBalanceAfter2.toString(), bigNumber(userBalanceBefore2).plus(borrowAmount).toString(), 'Sender wallet balance increased');
		})
		
		it('Borrower interest should be increased over time',async () => {
			let borrowAmount = await convertToDecimals(SampleToken1, 10);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referralCode, {from: user5});
			let time1 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			let time2 = await time.latest();
			
			let marketInterest = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
			
			let x = bigNumber(time2-time1).multipliedBy(marketInterest.borrowRate).multipliedBy(borrowAmount)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			
			assert.equal(getAccountBorrow.interest.toString() , x.toString());
		})

		it('Borrower interest should be calculated correctly after second borrow',async () => {
			let borrowAmount = await convertToDecimals(SampleToken1, 5);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referralCode, {from: user5});
			let time1 = await time.latest();

			let getAccountBorrowBefore = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			let marketInterestBefore = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);

			await time.increase(time.duration.days(5));
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referralCode, {from: user5});
			let time2 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			let time3 = await time.latest();

			let marketInterestAfter = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(marketInterestBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			let x2 = bigNumber(time3-time2).multipliedBy(marketInterestAfter.borrowRate).multipliedBy(getAccountBorrowAfter.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			
			assert.equal(getAccountBorrowAfter.interest.toString(), x1.plus(x2).toString());
		})

		it('The supplyRate should be increased after calling borrow function',async () => {
			let borrowAmount = await convertToDecimals(SampleToken1, 10);
			let marketInterestBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referralCode, {from: user5});
			let marketInterestAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			assert.isAbove(marketInterestAfter.supplyRate.toNumber(), marketInterestBefore.supplyRate.toNumber());
		})
		
		it('The promotionReserve should be increased correctly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = await Holdefi.getPromotionReserve(SampleToken1.address);
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			let marketSupplyInterestBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
			let marketBorrowInterestBefore = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);

			let borrowAmount = await convertToDecimals(SampleToken1, 5);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referralCode, {from: user5});
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(SampleToken1.address);
			let reserveAfter = bigNumber(marketFeaturesAfter.promotionReserveScaled);	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(marketBorrowInterestBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(marketSupplyInterestBefore.supplyRate).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);

			assert.equal(adminShare.toString(), x.toString());
		})

		it('The borrow function should not be reverted if calling it a month after pausing',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.pause("borrow", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			let borrowAmount = await convertToDecimals(SampleToken1, 10);
			await Holdefi.borrow(SampleToken1.address, ethAddress, borrowAmount, referralCode, {from: user5});
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			assert.equal(getAccountBorrow.balance.toString(), borrowAmount.toString(), 'User borrow balance increased');
		})

		it('Fail if borrow is paused',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.pause("borrow", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address,
					ethAddress,
					await convertToDecimals(SampleToken1, 10),
					referralCode,
					{from: user5}
				),
				"POE02"
			);
		})			

		it('Fail if try to call borrowBehalf without having allowance',async () =>{
			let borrowAmount = await convertToDecimals(SampleToken1, 10);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await expectRevert(Holdefi.borrowBehalf(user5, SampleToken1.address, ethAddress, borrowAmount, referralCode, {from: user6}),
 			"E14");
		})

		it('Fail if market is removed',async () =>{
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
					referralCode,
					{from: user5}
				),
				"E02"
			);
		})	

		it('Fail if market is not active',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address,
					ethAddress,
					await convertToDecimals(SampleToken1, 10),
					referralCode,
					{from: user5}
				),
				"E02"
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
					referralCode,
					{from: user5}
				),
				"E03"
			);
		})	

		it('Fail if there is no enough cash in contract',async () =>{
			let marketFeatures = await Holdefi.marketAssets(SampleToken1.address);
			let cash = bigNumber(marketFeatures.totalSupply).minus(marketFeatures.totalBorrow);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(3)});

			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address, 
					ethAddress, 
					cash.plus(1), 
					referralCode,
					{from: user5}
				),
				"E11"
			);
		})

		it('Fail if user is under collateral',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(
				SampleToken1.address, 
				ethAddress, 
				await convertToDecimals(SampleToken1, 10), 
				referralCode,
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
					referralCode,
					{from: user5}
				),
				"E12"
			);			
		})

		it('Fail if borrow power will be less than new borrow value',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});

			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address, 
					ethAddress, 
					await convertToDecimals(SampleToken1, 16),
					referralCode,
					{from: user5}),
				"E12"
			);
		})

		it('Fail for second borrow if VTL of borrower is less than collateral VTL and user is not under collateral',async () => {
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(
				SampleToken1.address,
				ethAddress,
				await convertToDecimals(SampleToken1, 11),
				referralCode,
				{from: user5}
			);

			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 12.45/200));

			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.equal(getAccountCollateral.borrowPowerValue.toString(), 0, 'Borrow power = 0');

			assert.isFalse(getAccountCollateral.underCollateral, 'User is not under collateral');

			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address, 
					ethAddress, 
					await convertToDecimals(SampleToken1, 2),
					referralCode,
					{from: user5}
				),
				"E12");
		})

		it('Fail if collateralized balance is zero',async () =>{
			await expectRevert(
				Holdefi.borrow(
					SampleToken1.address,
					ethAddress,
					await convertToDecimals(SampleToken1, 5),
					referralCode,
					{from: user5}
				),
				"E12");	
		})
	})

	describe("Deflating ERC20 Borrow", async() => {
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user6, SampleToken5);

			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken5.address, 
				await convertToDecimals(SampleToken5, 100),
				referralCode,
				{from:user6}
			);
			userBalanceBefore = await SampleToken5.balanceOf(user5);
			userBalanceBefore2 = await SampleToken5.balanceOf(user6);
		})
		
		it('The borrow function should work as expected',async () =>{
			let contractBalanceBefore = await SampleToken5.balanceOf(Holdefi.address);
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);
			let getMarketBefore = await Holdefi.marketAssets(SampleToken5.address);

			let borrowAmount = await convertToDecimals(SampleToken5, 10);
			let receivedAmount = borrowAmount.minus(borrowAmount.dividedToIntegerBy(100));
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken5.address, ethAddress, borrowAmount, referralCode, {from: user5});
			
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken5.address, ethAddress);
			assert.equal(getAccountBorrow.balance.toString(), borrowAmount.toString(), 'User borrow balance increased');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken5.address);
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).plus(borrowAmount).toString(), 'Total borrow increased');

			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 
				'User borrow power increased');
			
			let userBalanceAfter = await SampleToken5.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(receivedAmount).toString(), 
				'User wallet balance increased');

			let contractBalanceAfter = await SampleToken5.balanceOf(Holdefi.address);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(borrowAmount).toString(), 'Holdefi contract balance decreased');
		})

		it('The borrowBehalf function should work as expected',async () =>{
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);
			let getMarketBefore = await Holdefi.marketAssets(SampleToken5.address);

			let borrowAmount = await convertToDecimals(SampleToken5, 10);
			let receivedAmount = borrowAmount.minus(borrowAmount.dividedToIntegerBy(100));
			await Holdefi.approveBorrow(user6, SampleToken5.address, ethAddress, borrowAmount, {from:user5})
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrowBehalf(user5, SampleToken5.address, ethAddress, borrowAmount, referralCode, {from: user6});
			
			let getAccountAllowanceAfter = await Holdefi.getAccountBorrowAllowance(user5, user6, SampleToken5.address, ethAddress);
			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User borrow allowance decreased');

			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken5.address, ethAddress);
			assert.equal(getAccountBorrow.balance.toString(), borrowAmount.toString(), 'User borrow balance increased');
			let getAccountBorrow2 = await Holdefi.getAccountBorrow(user6, SampleToken5.address, ethAddress);
			assert.equal(getAccountBorrow2.balance.toString(), 0, 'Sender borrow balance not changed');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken5.address);
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).plus(borrowAmount).toString(), 'Total borrow increased');

			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue),
			 'User borrow power increased');
			
			let userBalanceAfter = await SampleToken5.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).toString(), 'User wallet balance not changed');
			let userBalanceAfter2 = await SampleToken5.balanceOf(user6);
			assert.equal(userBalanceAfter2.toString(), bigNumber(userBalanceBefore2).plus(receivedAmount).toString(), 
				'Sender wallet balance increased');
		})
		
		it('Borrower interest should be increased over time',async () => {
			let borrowAmount = await convertToDecimals(SampleToken5, 10);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken5.address, ethAddress, borrowAmount, referralCode, {from: user5});
			let time1 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken5.address, ethAddress);
			let time2 = await time.latest();
			
			let marketInterest = await Holdefi.getCurrentBorrowIndex(SampleToken5.address);
			
			let x = bigNumber(time2-time1).multipliedBy(marketInterest.borrowRate).multipliedBy(borrowAmount)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			
			assert.equal(getAccountBorrow.interest.toString() , x.toString());
		})

		it('Borrower interest should be calculated correctly after second borrow',async () => {
			let borrowAmount = await convertToDecimals(SampleToken5, 5);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken5.address, ethAddress, borrowAmount, referralCode, {from: user5});
			let time1 = await time.latest();

			let getAccountBorrowBefore = await Holdefi.getAccountBorrow(user5, SampleToken5.address, ethAddress);
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken5.address);
			let marketInterestBefore = await Holdefi.getCurrentBorrowIndex(SampleToken5.address);

			await time.increase(time.duration.days(5));
			await Holdefi.borrow(SampleToken5.address, ethAddress, borrowAmount, referralCode, {from: user5});
			let time2 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken5.address, ethAddress);
			let time3 = await time.latest();

			let marketInterestAfter = await Holdefi.getCurrentBorrowIndex(SampleToken5.address);

			let x1 = bigNumber(time2-time1).multipliedBy(marketInterestBefore.borrowRate).multipliedBy(borrowAmount)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			let x2 = bigNumber(time3-time2).multipliedBy(marketInterestAfter.borrowRate).multipliedBy(borrowAmount.multipliedBy(2))
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			
			assert.equal(getAccountBorrowAfter.interest.toString(), x1.plus(x2).toString());
		})
	})
	
	describe("ETH Borrow", async() => {
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
		})

		it('The borrow function should work as expected',async () =>{
			let borrowAmount = decimal18.multipliedBy(0.5);
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			let getMarketBefore = await Holdefi.marketAssets(ethAddress);
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, await convertToDecimals(SampleToken1, 40), {from:user5});
			let userBalanceBefore = await web3.eth.getBalance(user5);
			let contractBalanceBefore = await balance.current(Holdefi.address);
			let tx = await Holdefi.borrow(ethAddress, SampleToken1.address, borrowAmount, referralCode, {from: user5});
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, ethAddress, SampleToken1.address)
			assert.equal(getAccountBorrow.balance.toString(), borrowAmount.toString(), 'User borrow balance increased');

			let getMarketAfter = await Holdefi.marketAssets(ethAddress);
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).plus(borrowAmount).toString(), 
				'Total borrow increased');
		
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 
				'User borrow power increased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(borrowAmount).toString(), 
				'User wallet balance increased correctly');
		
			let contractBalanceAfter = await balance.current(Holdefi.address);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(borrowAmount).toString(), 'Holdefi contract balance decreased');
		})

		it('The borrowBehalf function should work as expected',async () =>{
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			let getMarketBefore = await Holdefi.marketAssets(ethAddress);
			await Holdefi.approveBorrow(user6, ethAddress, SampleToken1.address, decimal18.multipliedBy(0.5), {from:user5});
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, await convertToDecimals(SampleToken1, 40), {from:user5});
			let userBalanceBefore = await web3.eth.getBalance(user6);
			let tx = await Holdefi.borrowBehalf(user5, ethAddress, SampleToken1.address, decimal18.multipliedBy(0.5), referralCode, {from: user6});
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, ethAddress, SampleToken1.address)
			assert.equal(getAccountBorrow.balance.toString(), decimal18.multipliedBy(0.5).toString(), 'User borrow balance increased');

			let getAccountAllowanceAfter = await Holdefi.getAccountBorrowAllowance(user5, user6, ethAddress, SampleToken1.address);
			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User borrow allowance decreased');

			let getMarketAfter = await Holdefi.marketAssets(ethAddress);
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).plus(decimal18.multipliedBy(0.5)).toString(), 
				'Total borrow increased');
		
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 
				'User borrow power increased');
			
			let userBalanceAfter = await web3.eth.getBalance(user6);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(decimal18.multipliedBy(0.5)).toString(), 
				'Sender wallet balance increased');
		})

		it('Fail if try to call borrowBehalf without having allowance',async () =>{
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, await convertToDecimals(SampleToken1, 40), {from:user5});
			await expectRevert(Holdefi.borrowBehalf(user5, ethAddress, SampleToken1.address, decimal18.multipliedBy(0.5), referralCode, {from: user6}),
 			"E14");
		})
	})	

	describe("Borrow with scenario2", async() =>{
		beforeEach(async() => {
			await scenario2(owner,user1,user2,user3,user4,user7);
			userBalanceBefore = await SampleToken1.balanceOf(user7);
		})
		
		it('Should borrow asset',async () =>{
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
			let borrowAmount = await convertToDecimals(SampleToken1, 0.2);
			
			let getAccountBorrowBefore = await Holdefi.getAccountBorrow(user7, SampleToken1.address, SampleToken3.address);
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user7, SampleToken3.address);
			await Holdefi.borrow(SampleToken1.address, SampleToken3.address, borrowAmount, referralCode, {from: user7});
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user7, SampleToken3.address);
			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user7, SampleToken1.address, SampleToken3.address);
			
			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).plus(borrowAmount).toString(),
				'User borrow balance is increased');
			// let sampleToken1Value = await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, await convertToDecimals(SampleToken1, 0.2));
			// assert.equal(getAccountCollateralAfter.totalBorrowValue.toString(), bigNumber(getAccountCollateralBefore.totalBorrowValue).plus(sampleToken1Value).toString() ,'Borrow value is increased');
		})

		it('Fail if borrow value is more than power',async () =>{
			let borrowAmount = await convertToDecimals(SampleToken1, 0.3);
			await expectRevert(Holdefi.borrow(SampleToken1.address, SampleToken3.address, borrowAmount, referralCode, {from: user7}),
				'E12');
		})
	})
})