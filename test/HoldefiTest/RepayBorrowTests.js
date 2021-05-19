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
    initializeContracts,
    assignToken,
    scenario
} = require ("../Utils.js");

contract("Repay Borrow", function([owner,user1,user2,user3,user4,user5,user6]){
	describe("ERC20 Repay Borrow", async() => {
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			await assignToken(owner, user6, SampleToken1);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, ethAddress, await convertToDecimals(SampleToken1, 5), referralCode, {from: user5});
			time1 = await time.latest();

			getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
			getMarketInterestsBefore = await HoldefiSettings.getInterests(SampleToken1.address);
			await time.increase(time.duration.days(30));
			userBalanceBefore = await SampleToken1.balanceOf(user5);
			userAllowanceBefore = await SampleToken1.allowance(user5, Holdefi.address);
			userBalanceBefore2 = await SampleToken1.balanceOf(user6);
			getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);
			getAccountBorrowBefore = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
		})
		
		it('The repayBorrow function should work as expected if amount is more than borrow interest',async () =>{
			let repayAmount = await convertToDecimals(SampleToken1, 5);
			let contractBalanceBefore = await SampleToken1.balanceOf(Holdefi.address);
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, repayAmount, {from:user5});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);	
			let balanceChange = repayAmount.minus(x1);

			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).minus(balanceChange).toString(), 
				'User borrow balance decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), 1, 'User borrow interest = 1');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(balanceChange).toString(),'Total Borrow decreased');
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 
				'User borrow power increased');
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(repayAmount).toString(), 'User wallet balance decreased');

			let contractBalanceAfter = await SampleToken1.balanceOf(Holdefi.address);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(repayAmount).toString(), 'Holdefi contract balance increased');
		})
		
		it('The repayBorrow function should work as expected if amount is less than borrow interest',async () =>{
			let repayAmount = 10;			  								
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, repayAmount, {from:user5});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

			assert.equal(getAccountBorrowBefore.balance.toString(), bigNumber(getAccountBorrowAfter.balance).toString(), 'User borrow balance not changed');
			assert.equal(getAccountBorrowAfter.interest.toString(), x1.minus(repayAmount).plus(1).toString(), 'User borrow interest decreased');
			assert.equal(getMarketAfter.totalBorrow.toString(), getMarketBefore.totalBorrow.toString(), 'Total Borrow not changed');
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(repayAmount).toString(), 'User wallet balance decreased');
		})
		
		it('The repayBorrow function should work as expected if amount is bigger than total balance',async () =>{
			await Holdefi.methods['repayBorrow(address,address,uint256)']( SampleToken1.address, ethAddress, userAllowanceBefore, {from:user5});
			let time2 = await time.latest();
			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress)
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

			assert.equal(getAccountBorrowAfter.balance.toString(), 0, 'User borrow balance = 0');
			assert.equal(getAccountBorrowAfter.interest.toString(), 0, 'User borrow interest = 0');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(), 
				'Total borrow decreased');
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(getAccountBorrowBefore.balance).minus(x1).toString(), 
				'User wallet balance decreased');
		})

		it('The repayBorrowBehalf function should work as expected',async () =>{
			let repayAmount = await convertToDecimals(SampleToken1, 5);
			await Holdefi.methods['repayBorrowBehalf(address,address,address,uint256)'](user5, SampleToken1.address, ethAddress, repayAmount, {from:user6});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);	
			let balanceChange = repayAmount.minus(x1);

			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).minus(balanceChange).toString(), 
				'User borrow balance decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), 1, 'User borrow interest = 1');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(balanceChange).toString(),'Total Borrow decreased');
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 
				'User borrow power increased');
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), userBalanceBefore.toString(), 'User wallet balance not changed');
			let userBalanceAfter2 = await SampleToken1.balanceOf(user6);
			assert.equal(userBalanceAfter2.toString(), bigNumber(userBalanceBefore2).minus(repayAmount).toString(), 'Sender wallet balance decreased');
		})

		it('The repayBorrow function should work if market is deactivated',async () =>{
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.deactivateMarket(ethAddress,{from:owner});
			let repayAmount = await convertToDecimals(SampleToken1, 5);
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, repayAmount, {from:user5});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			let balanceChange = repayAmount.minus(x1);

			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).minus(balanceChange).toString(), 
				'User borrow balance decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), 1, 'User borrow interest = 1');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(balanceChange).toString(),'Total Borrow decreased');
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 
				'User borrow power increased');
			
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(repayAmount).toString(), 'User wallet balance decreased');
		})

		it('The supplyRate should be decreased after calling withdrawSupply function',async () => {
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, userAllowanceBefore, {from:user5});
			let getMarketInterestsAfter = await HoldefiSettings.getInterests(SampleToken1.address);

			assert.isBelow(getMarketInterestsAfter.supplyRateBase.toNumber(), getMarketInterestsBefore.supplyRateBase.toNumber());
		})

		it('The promotionReserve should be increased correctly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = await Holdefi.getPromotionReserve(SampleToken1.address);
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, userAllowanceBefore, {from:user5});
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(SampleToken1.address);
			let reserveAfter = bigNumber(marketFeaturesAfter.promotionReserveScaled);	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(getMarketInterestsBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(getMarketInterestsBefore.supplyRateBase).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);

			assert.equal(adminShare.toString(), x.toString());
		})

		it('The repayBorrow function should not be reverted if calling it a month after pausing',async () =>{
			await Holdefi.pause("repayBorrow", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, userAllowanceBefore, {from:user5});
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
			assert.equal(getAccountBorrow.balance.toString(), 0, 'User borrow balance decreased');
		})

		it('Fail if repayBorrow is paused',async () =>{
			await Holdefi.pause("repayBorrow", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, userAllowanceBefore, {from:user5}),
				"POE02");
		})	

		it('Fail if market is ETH',async () =>{
			await expectRevert(Holdefi.methods['repayBorrow(address,address,uint256)'](ethAddress, SampleToken1.address, userAllowanceBefore, {from:user5}),
				'E01');
		})

		it('Fail if borrowed balance is zero',async () =>{
			await expectRevert(Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, decimal18.multipliedBy(3), {from:user6}),
				'E09');
		})	
	})

	describe("Deflating ERC20 Repay Borrow", async() => {
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken5);
			await assignToken(owner, user6, SampleToken5);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken5.address, ethAddress, await convertToDecimals(SampleToken5, 5), referralCode, {from: user5});
			time1 = await time.latest();

			getMarketBefore = await Holdefi.marketAssets(SampleToken5.address);
			getMarketInterestsBefore = await HoldefiSettings.getInterests(SampleToken5.address);
			await time.increase(time.duration.days(30));
			userBalanceBefore = await SampleToken5.balanceOf(user5);
			userAllowanceBefore = await SampleToken5.allowance(user5, Holdefi.address);
			userBalanceBefore2 = await SampleToken5.balanceOf(user6);
			getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);
			getAccountBorrowBefore = await Holdefi.getAccountBorrow(user5, SampleToken5.address, ethAddress);
		})
		
		it('The repayBorrow function should work as expected if amount is more than borrow interest',async () =>{
			let repayAmount = await convertToDecimals(SampleToken5, 5);
			let receivedAmount = repayAmount.minus(repayAmount.dividedToIntegerBy(100));
			let contractBalanceBefore = await SampleToken5.balanceOf(Holdefi.address);
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken5.address, ethAddress, repayAmount, {from:user5});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken5.address, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken5.address);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);	
			let balanceChange = receivedAmount.minus(x1);

			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).minus(balanceChange).toString(), 
				'User borrow balance decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), 1, 'User borrow interest = 1');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(balanceChange).toString(),'Total Borrow decreased');
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 
				'User borrow power increased');
		
			let userBalanceAfter = await SampleToken5.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(repayAmount).toString(), 'User wallet balance decreased');

			let contractBalanceAfter = await SampleToken5.balanceOf(Holdefi.address);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(receivedAmount).toString(), 
				'Holdefi contract balance increased');
		})
		
		it('The repayBorrow function should work as expected if amount is less than borrow interest',async () =>{
			let repayAmount = bigNumber(10);
			let receivedAmount = repayAmount.minus(repayAmount.dividedToIntegerBy(100));			  								
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken5.address, ethAddress, repayAmount, {from:user5});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken5.address, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken5.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

			assert.equal(getAccountBorrowBefore.balance.toString(), bigNumber(getAccountBorrowAfter.balance).toString(), 'User borrow balance not changed');
			assert.equal(getAccountBorrowAfter.interest.toString(), x1.minus(receivedAmount).plus(1).toString(), 'User borrow interest decreased');
			assert.equal(getMarketAfter.totalBorrow.toString(), getMarketBefore.totalBorrow.toString(), 'Total Borrow not changed');
		
			let userBalanceAfter = await SampleToken5.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(repayAmount).toString(), 'User wallet balance decreased');
		})
		
		it('The repayBorrow function should work as expected if amount is bigger than total balance',async () =>{
			let repayAmount = await convertToDecimals(SampleToken5, 30);
			let receivedAmount = repayAmount.minus(repayAmount.dividedToIntegerBy(100));
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken5.address, ethAddress, repayAmount, {from:user5});
			let time2 = await time.latest();
			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken5.address, ethAddress)
			let getMarketAfter = await Holdefi.marketAssets(SampleToken5.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

			let sendBackAmount = receivedAmount.minus(getAccountBorrowBefore.balance).minus(x1);
			sendBackAmount = sendBackAmount.minus(sendBackAmount.dividedToIntegerBy(100));

			assert.equal(getAccountBorrowAfter.balance.toString(), 0, 'User borrow balance = 0');
			assert.equal(getAccountBorrowAfter.interest.toString(), 0, 'User borrow interest = 0');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(), 
				'Total borrow decreased');
		
			let userBalanceAfter = await SampleToken5.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(repayAmount).plus(sendBackAmount).toString(), 
				'User wallet balance decreased');
		})

		it('The repayBorrowBehalf function should work as expected',async () =>{
			let repayAmount = await convertToDecimals(SampleToken5, 5);
			let receivedAmount = repayAmount.minus(repayAmount.dividedToIntegerBy(100));
			await Holdefi.methods['repayBorrowBehalf(address,address,address,uint256)'](user5, SampleToken5.address, ethAddress, repayAmount, {from:user6});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken5.address, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken5.address);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);	
			let balanceChange = receivedAmount.minus(x1);

			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).minus(balanceChange).toString(), 
				'User borrow balance decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), 1, 'User borrow interest = 1');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(balanceChange).toString(),'Total Borrow decreased');
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 
				'User borrow power increased');
		
			let userBalanceAfter = await SampleToken5.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), userBalanceBefore.toString(), 'User wallet balance not changed');
			let userBalanceAfter2 = await SampleToken5.balanceOf(user6);
			assert.equal(userBalanceAfter2.toString(), bigNumber(userBalanceBefore2).minus(repayAmount).toString(), 'Sender wallet balance decreased');
		})
	})

	describe("ETH Repay Borrow", async() => {
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			await assignToken(owner, user6, SampleToken1);
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, await convertToDecimals(SampleToken1, 20), {from:user5});
			await Holdefi.borrow(ethAddress, SampleToken1.address, decimal18.multipliedBy(0.5), referralCode, {from: user5});
			time1 = await time.latest();

			getMarketBefore = await Holdefi.marketAssets(ethAddress);
			getMarketInterestsBefore = await HoldefiSettings.getInterests(ethAddress);
			await time.increase(time.duration.days(30));	
			userBalanceBefore = await web3.eth.getBalance(user5);
			getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			getAccountBorrowBefore = await Holdefi.getAccountBorrow(user5, ethAddress, SampleToken1.address);
		})

		it('The repayBorrow function should work as expected if amount is more than borrow interest',async () =>{
			let repayAmount = decimal18.multipliedBy(0.5);
			let contractBalanceBefore = await balance.current(Holdefi.address);
			let tx = await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value:repayAmount});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, ethAddress, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			let balanceChange = repayAmount.minus(x1);

			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).minus(balanceChange).toString(), 
				'User borrow balance decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), 1, 'User interest = 1');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(balanceChange).toString(),'Total Borrow decreased');
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 
				'User borrow power increased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(repayAmount).toString(), 'User wallet balance decreased');
			
			let contractBalanceAfter = await balance.current(Holdefi.address);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(repayAmount).toString(), 'Holdefi contract balance increased');
		})

		it('The repayBorrow function should work as expected if amount is less than borrow interest',async () =>{
			let repayAmount = 10;				
			let tx = await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value:repayAmount});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, ethAddress, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

			assert.equal(getAccountBorrowBefore.balance.toString(), bigNumber(getAccountBorrowAfter.balance).toString(), 'User borrow balance not changed');
			assert.equal(getAccountBorrowAfter.interest.toString(), x1.minus(repayAmount).plus(1).toString(), 'User borrow interest decreased');
			assert.equal(getMarketAfter.totalBorrow.toString(), getMarketBefore.totalBorrow.toString(), 'Total Borrow not changed');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter,bigNumber(userBalanceBefore).minus(txFee).minus(repayAmount).toString(), 'User wallet balance decreased');
		})

		it('The repayBorrow function should work as expected if amount is bigger than total balance',async () =>{
			let repayAmount = decimal18.multipliedBy(2);
			let tx = await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value:repayAmount});
			let time2 = await time.latest();
			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, ethAddress, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);			

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

			assert.equal(getAccountBorrowAfter.balance.toString(), 0, 'User boroow balance = 0')
			assert.equal(getAccountBorrowAfter.interest.toString(), 0, 'User borrow interest = 0')
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(), 
				'Total Balance decreased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(getAccountBorrowBefore.balance).minus(x1).toString(), 
				'User wallet balance decreased');
		})

		it('The repayBorrow function should work if market is deactivated',async () =>{
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.deactivateMarket(ethAddress,{from:owner});	

			let repayAmount = decimal18.multipliedBy(0.5);
			let tx = await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value:repayAmount});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, ethAddress, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			let balanceChange = repayAmount.minus(x1);

			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).minus(balanceChange).toString(), 
				'User borrow balance decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), 1, 'User borrow interest = 1');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(balanceChange).toString(),'Total Borrow decreased');
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 
				'User borrow power increase');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(repayAmount).toString(), 'User borrow balance increased');
		})

		it('The repayBorrowBehalf function should work as expected',async () =>{
			let repayAmount = decimal18.multipliedBy(0.5);
			let user6BalanceBefore= await web3.eth.getBalance(user6);
			let tx = await Holdefi.methods['repayBorrowBehalf(address,address)'](user5, SampleToken1.address, {from:user6, value:repayAmount});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, ethAddress, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			let balanceChange = repayAmount.minus(x1);

			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).minus(balanceChange).toString(), 
				'User borrow balance decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), 1, 'User borrow interest = 1');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(balanceChange).toString(),'Total Borrow decreased');
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerValue).isLessThan(getAccountCollateralAfter.borrowPowerValue), 
				'User borrow power increased');
			
			let user6BalanceAfter = await web3.eth.getBalance(user6);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).minus(txFee).minus(repayAmount).toString(), 
				'Sender wallet balance decreased');
		})

		it('The promotionReserve should be increased correctly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = await Holdefi.getPromotionReserve(ethAddress);
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(ethAddress);
			let repayAmount = decimal18.multipliedBy(2);
			await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value:repayAmount});
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(ethAddress);
			let reserveAfter = marketFeaturesAfter.promotionReserveScaled;	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(getMarketInterestsBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(getMarketInterestsBefore.supplyRateBase).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);

			assert.equal(adminShare.toString(), x.toString());
		})

		it('The repayBorrow function should not be reverted if calling it a month after pausing',async () =>{
			await Holdefi.pause("repayBorrow", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value: decimal18.multipliedBy(5)});
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, ethAddress, SampleToken1.address);
			assert.equal(getAccountBorrow.balance.toString(), 0, 'User borrow balance decreased');
		})

		it('Fail if repayBorrow is paused',async () =>{
			await Holdefi.pause("repayBorrow", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value: decimal18.multipliedBy(0.5)}),
				"POE02");
		})

		it('Fail if borrowed balance is zero',async () =>{
			await expectRevert(Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user6, value: decimal18.multipliedBy(0.5)}),
				'E09');
		})
	})
})

