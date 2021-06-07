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

contract("Withdraw Supply", function([owner, user1, user2, user3, user4, user5, user6]){
		
	describe("ERC20 Withdraw Supply", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				await convertToDecimals (SampleToken1, 20),
				referralCode,
				{from:user5}
			);
			time1 = await time.latest();
			getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
            getMarketSupplyInterestsBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
			userBalanceBefore = await SampleToken1.balanceOf(user5);

			await time.increase(time.duration.days(5));
			getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, SampleToken1.address);
		})
	
		it('The withdrawSupply function should work as expected if amount is more than supply interest',async () =>{
			let amount = await convertToDecimals(SampleToken1, 20);
			let contractBalanceBefore = await SampleToken1.balanceOf(Holdefi.address);
			await Holdefi.withdrawSupply(SampleToken1.address, amount, {from:user5});
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			let contractBalanceAfter = await SampleToken1.balanceOf(Holdefi.address);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(amount).toString(), 'User wallet balance increased');
			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 
				'User supply balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'User supply interest = 0');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 
				'Total supply decreased');
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(amount).toString(), 
				'Holdefi contract balance decreased');
		})

		it('The withdrawSupplyBehalf function should work as expected',async () =>{
			let user6BalanceBefore = await SampleToken1.balanceOf(user6);
			let amount = await convertToDecimals(SampleToken1, 20);
			await Holdefi.approveWithdrawSupply(user6, SampleToken1.address, amount, {from:user5})
			await Holdefi.withdrawSupplyBehalf(user5, SampleToken1.address, amount, {from:user6});
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let getAccountAllowanceAfter = await Holdefi.getAccountWithdrawSupplyAllowance(user5, user6, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);
			let user5BalanceAfter = await SampleToken1.balanceOf(user5);
			let user6BalanceAfter = await SampleToken1.balanceOf(user6);

			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User withdrawSupply allowance decreased');
			assert.equal(user5BalanceAfter.toString(), bigNumber(userBalanceBefore).toString(), 'Sender wallet balance not changed');
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).plus(amount).toString(), 'User wallet balance increased');
			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 
				'User supply balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'User supply interest = 0');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})

		it('The withdrawSupply function should work if market is removed',async () =>{
			let repayAmount = await convertToDecimals(SampleToken1, 50);
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, repayAmount, {from:user3});
			await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user4, value: decimal18.multipliedBy(20)});
			await HoldefiSettings.removeMarket(SampleToken1.address,{from:owner});
			let getAccountSupplyAfterRemove = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			
			await time.increase(time.duration.days(30));
			let getAccountSupplyAfterRemoveAfter30Days = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			
			let amount = await convertToDecimals(SampleToken1, 100);
			await Holdefi.withdrawSupply(SampleToken1.address, amount, {from:user5});
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			let withdrawAmount = bigNumber(getAccountSupplyAfterRemove.balance).plus(getAccountSupplyAfterRemove.interest);

			assert.equal(getAccountSupplyAfterRemove.interest.toString(), getAccountSupplyAfterRemoveAfter30Days.interest.toString(), 
				'Supply interest not changed')

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(withdrawAmount).toString(), 'User wallet balance increased');
			assert.equal(getAccountSupplyAfter.balance.toString(), 0, 'User supply balance = 0')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'User supply interest = 0');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(getAccountSupplyAfterRemove.balance).toString(), 
				'Total supply decreased');
		})

		it('User supplied balance should be zero if withdraw amount is bigger than total balance',async () =>{
			await Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5})
			let time2 = await time.latest();
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
	
			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

			let totalBalanceAfter = bigNumber(getAccountSupplyAfter.balance).plus(getAccountSupplyAfter.interest);
			assert.equal(totalBalanceAfter.toString(), 0, 'User supply balance decreased');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(getAccountSupplyBefore.balance).toString(), 
				'Total supply decreased')
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(getAccountSupplyBefore.balance).plus(x1).toString(), 
				'User wallet balance increased');		
		})
		
		it('User supplied balance not changed if withdraw amount is less than interest',async () =>{
			let amount = 10;
			await Holdefi.withdrawSupply(SampleToken1.address, amount, {from:user5})
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let userBalanceAfter = await SampleToken1.balanceOf(user5);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(amount).toString(), 'User wallet balance increased');
			assert.equal(getAccountSupplyBefore.balance.toString(), getAccountSupplyAfter.balance.toString(), 'User supply balance not changed')
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.minus(amount).toString(), 'User supply interest decreased');
			assert.equal(getMarketAfter.totalSupply.toString(), getMarketBefore.totalSupply.toString(), 'Total supply not changed')
		})

		it('The withdrawSupply function should work if market is deactivated',async () =>{		
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			amount = await convertToDecimals(SampleToken1, 20);
			await Holdefi.withdrawSupply(SampleToken1.address, amount, {from:user5});
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);

			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 
				'User supply balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'User supply interest = 0');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})

		it('The supplyRate should be increased after calling withdrawSupply function',async () => {
			await Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5});
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let getMarketSupplyInterestsAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			assert.isAbove(getMarketSupplyInterestsAfter.supplyRate.toNumber(), getMarketSupplyInterestsBefore.supplyRate.toNumber());
		})

		it('The promotionReserve should be increased correctly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = await Holdefi.getPromotionReserve(SampleToken1.address);
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			let marketInterestBefore = await HoldefiSettings.getInterests(SampleToken1.address);
			await Holdefi.withdrawSupply(SampleToken1.address, await convertToDecimals(SampleToken1, 10), {from:user5});
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(SampleToken1.address);
			let reserveAfter = marketFeaturesAfter.promotionReserveScaled;	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(marketInterestBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(marketInterestBefore.supplyRateBase).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);

			assert.equal(adminShare.toString(), x.toString());
		})

		it('Promotion rate should be set to zero after calling withdrawSupply function if promotionDebt > promotionReserve',async () => {
			await assignToken(owner, owner, SampleToken1);

			await Holdefi.depositPromotionReserve(SampleToken1.address, await convertToDecimals(SampleToken1, 1));
			await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
			let time1 = await time.latest();
			let getMarketSettingsBefore = await HoldefiSettings.marketAssets(SampleToken1.address)
			let marketSupplyInterestBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			await time.increase(time.duration.days(100));
			await Holdefi.withdrawSupply(SampleToken1.address, await convertToDecimals (SampleToken1, 10), {from:user5});
			let time2 = await time.latest();
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address)
			let getMarketSettingsAfter = await HoldefiSettings.marketAssets(SampleToken1.address)
			let marketSupplyInterestAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			let debtScaled = bigNumber(time2-time1).multipliedBy(getMarketBefore.totalSupply).multipliedBy(ratesDecimal.multipliedBy(0.1));

			assert.isTrue(bigNumber(marketSupplyInterestBefore.supplyRate).minus(getMarketSettingsBefore.promotionRate).isLessThan(
				marketSupplyInterestAfter.supplyRate), 'Supply rate decrease')
			assert.equal(getMarketSettingsAfter.promotionRate.toString(), 0, 'Promotion rate = 0')
			assert.equal(debtScaled.toString() , getMarketAfter.promotionDebtScaled.toString(), 'Promotion debt increased');
		})

		it('The withdrawSupply function should not be reverted if calling it a month after pausing',async () =>{
			await Holdefi.pause("withdrawSupply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5});
			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			assert.equal(getAccountSupply.balance.toString(), 0, 'User supply balance increased');
		})

		it('Fail if try to call withdrawSupplyBehalf without having allowance',async () =>{
			let amount = await convertToDecimals(SampleToken1, 20);
			await expectRevert(Holdefi.withdrawSupplyBehalf(user5, SampleToken1.address, amount, {from:user6}),
 			"E14");
		})

		it('Fail if withdrawSupply function is paused',async () =>{
			await Holdefi.pause("withdrawSupply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				"POE02");
		})

		it('Fail if supplied balance is zero',async () =>{
			await expectRevert(Holdefi.withdrawSupply(SampleToken1.address, decimal18.multipliedBy(25), {from:user6}),
				"E09");
		})	

		it('Fail if there is no enough cash in contract',async () =>{
			await Holdefi.methods['collateralize()']({from:user6, value: decimal18.multipliedBy(10)});	
			await Holdefi.borrow(
				SampleToken1.address,
				ethAddress,
				bigNumber(getMarketBefore.totalSupply).minus(getMarketBefore.totalBorrow),
				referralCode,
				{from: user6}
			);

			await expectRevert(Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				"revert");

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			assert.equal(getAccountSupplyAfter.balance.toString(), getAccountSupplyBefore.balance.toString(), 'User supply balance not changed');
		})
	})

	describe("Deflating ERC20 Withdraw Supply", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken5);
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken5.address,
				await convertToDecimals (SampleToken5, 20),
				referralCode,
				{from:user5}
			);
			time1 = await time.latest();
			getMarketBefore = await Holdefi.marketAssets(SampleToken5.address);
            getMarketSupplyInterestsBefore = await Holdefi.getCurrentSupplyIndex(SampleToken5.address);
			userBalanceBefore = await SampleToken5.balanceOf(user5);

			await time.increase(time.duration.days(5));
			getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, SampleToken5.address);
		})

		it('The withdrawSupply function should work as expected',async () =>{
			let amount = await convertToDecimals(SampleToken5, 19);
			let receivedAmount = amount.minus(amount.dividedToIntegerBy(100));
			let contractBalanceBefore = await SampleToken5.balanceOf(Holdefi.address);
			await Holdefi.withdrawSupply(SampleToken5.address, amount, {from:user5});
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken5.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken5.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);
			let userBalanceAfter = await SampleToken5.balanceOf(user5);
			let contractBalanceAfter = await SampleToken5.balanceOf(Holdefi.address);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(receivedAmount).toString(), 'User wallet balance increased');
			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 
				'User supply balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'Interest decreased = 0');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(amount).toString(), 'Holdefi contract balance decreased');
		})

		it('The withdrawSupplyBehalf function should work as expected',async () =>{
			let user6BalanceBefore = await SampleToken5.balanceOf(user6);
			let amount = await convertToDecimals(SampleToken5, 19);
			let receivedAmount = amount.minus(amount.dividedToIntegerBy(100));
			await Holdefi.approveWithdrawSupply(user6, SampleToken5.address, amount, {from:user5})
			await Holdefi.withdrawSupplyBehalf(user5, SampleToken5.address, amount, {from:user6});
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken5.address);
			let getAccountAllowanceAfter = await Holdefi.getAccountWithdrawSupplyAllowance(user5, user6, SampleToken5.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken5.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);
			let user5BalanceAfter = await SampleToken5.balanceOf(user5);
			let user6BalanceAfter = await SampleToken5.balanceOf(user6);

			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User withdrawSupply allowance decreased');
			assert.equal(user5BalanceAfter.toString(), bigNumber(userBalanceBefore).toString(), 'Sender wallet balance not changed');
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).plus(receivedAmount).toString(), 
				'User wallet balance increased');
			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 
				'User supply balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'User supply interest = 0');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})
	})

	describe("ETH Withdraw Supply", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await Holdefi.methods['supply(uint16)'](
				referralCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			
			time1 = await time.latest();
			getMarketBefore = await Holdefi.marketAssets(ethAddress);
            getMarketSupplyInterestsBefore = await Holdefi.getCurrentSupplyIndex(ethAddress);
            userBalanceBefore = await web3.eth.getBalance(user5);
			
			await time.increase(time.duration.days(5));
			getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, ethAddress);
		})

		it('The withdrawSupply function should work as expected',async () =>{
			let amount = decimal18.multipliedBy(1);
			let tx = await Holdefi.withdrawSupply(ethAddress, amount, {from:user5})
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);		

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);

			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(amount).toString(), 'User wallet balance increased');
			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 
				'User supply balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'User supply interest = 0');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})

		it('The withdrawSupplyBehalf function should work as expected',async () =>{
			let user6BalanceBefore = await web3.eth.getBalance(user6);
			let amount = decimal18.multipliedBy(1);
			let approve_tx = await Holdefi.approveWithdrawSupply(user6, ethAddress, amount, {from:user5})
			let withdraw_tx = await Holdefi.withdrawSupplyBehalf(user5, ethAddress, amount, {from:user6})
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);
			let getAccountAllowanceAfter = await Holdefi.getAccountWithdrawCollateralAllowance(user5, user6, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);		

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);

			let user5BalanceAfter = await web3.eth.getBalance(user5);
			let user6BalanceAfter = await web3.eth.getBalance(user6);
			let approve_tx_fee = gasPrice.multipliedBy(approve_tx.receipt.gasUsed);
			let withdraw_tx_fee = gasPrice.multipliedBy(withdraw_tx.receipt.gasUsed);

			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User withdrawSupply allowance decreased');
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).minus(withdraw_tx_fee).plus(amount).toString(), 
				'Sender wallet balance increased');
			assert.equal(user5BalanceAfter.toString(), bigNumber(userBalanceBefore).minus(approve_tx_fee).toString(), 'User wallet balance not changed');
			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 
				'User supply balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'User supply interest = 0');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})

		it('User supplied balance should be zero if withdraw amount is bigger than total balance',async () => {
			let tx = await Holdefi.withdrawSupply(ethAddress, constants.MAX_UINT256, {from:user5})
			let time2 = await time.latest();
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

			let totalBalanceAfter = bigNumber(getAccountSupplyAfter.balance).plus(getAccountSupplyAfter.interest);
			assert.equal(totalBalanceAfter.toString(), 0, 'User supply balance decreased');

			let getMarketAfter = await Holdefi.marketAssets(ethAddress);
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(getAccountSupplyBefore.balance).toString(), 
				'Total supply decreased')

			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(getAccountSupplyBefore.balance).plus(x1).toString(), 
				'User wallet balance increased');
		})

		it('User supplied balance not changed if withdraw amount is less than interest',async () =>{
			let amount = bigNumber(getAccountSupplyBefore.interest).minus(10);
			let tx = await Holdefi.withdrawSupply(ethAddress, amount, {from:user5})
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);			

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(amount).toString(), 'User wallet balance increased');
			assert.equal(getAccountSupplyBefore.balance.toString(), getAccountSupplyAfter.balance.toString(), 'User supply balance not changed')
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.minus(amount).toString(), 'User supply interest decreased');
			assert.equal(getMarketAfter.totalSupply.toString(), getMarketBefore.totalSupply.toString(), 'Total supply not changed')
		})

		it('The withdrawSupply function should work if market is deactivated',async () =>{		
			await HoldefiSettings.deactivateMarket(ethAddress,{from:owner});
			let amount = decimal18.multipliedBy(1);
			await Holdefi.withdrawSupply(ethAddress, amount, {from:user5})
			let time2 = await time.latest();
			
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);			

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);

			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 
				'User supply balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'Usr supply interest = 0');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})			

		it('The withdrawSupply function should not be reverted if calling it a month after pausing',async () =>{
			await Holdefi.pause("withdrawSupply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.withdrawSupply(ethAddress, constants.MAX_UINT256, {from:user5});
			let getAccountSupply = await Holdefi.getAccountSupply(user5,ethAddress);
			assert.equal(getAccountSupply.balance.toString(), 0, 'User supply balance increased');

		})

		it('Fail if withdrawSupply function is paused',async () =>{
			await Holdefi.pause("withdrawSupply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.withdrawSupply(ethAddress, constants.MAX_UINT256, {from:user5}),
				"POE02");
		})

		it('Fail if try to call withdrawSupplyBehalf without having allowance',async () =>{
			let amount = await convertToDecimals(SampleToken1, 20);
			await expectRevert(Holdefi.withdrawSupplyBehalf(user5, ethAddress, amount, {from:user6}),
 			"E14");
		})

		it('Fail if there is no enough cash in contract',async () =>{
			await assignToken(owner, user6, SampleToken1);
			await Holdefi.methods['collateralize(address,uint256)'](
				SampleToken1.address,
				await convertToDecimals(SampleToken1, 200),
				{from:user6}
			);
			await Holdefi.borrow(
				ethAddress,
				SampleToken1.address,
				bigNumber(getMarketBefore.totalSupply).minus(getMarketBefore.totalBorrow),
				referralCode,
				{from: user6}
			);

			await expectRevert(Holdefi.withdrawSupply(ethAddress, constants.MAX_UINT256, {from:user5}),
				"revert");

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);
			assert.equal(getAccountSupplyAfter.balance.toString(), getAccountSupplyBefore.balance.toString(), 'User supply balance not changed');
		})	
	})
})

