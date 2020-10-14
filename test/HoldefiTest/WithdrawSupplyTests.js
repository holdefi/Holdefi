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
    initializeContracts,
    assignToken,
    scenario
} = require ("../Utils.js");

contract("Withdraw Supply", function([owner, user1, user2, user3, user4, user5, user6]){
		
	describe("Withdraw Supply ERC20 ", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				await convertToDecimals (SampleToken1, 20),
				referalCode,
				{from:user5}
			);
			time1 = await time.latest();
			getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
            getMarketSupplyInterestsBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
			userBalanceBefore = await SampleToken1.balanceOf(user5);

			await time.increase(time.duration.days(5));
			getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, SampleToken1.address);
		})
	
		it('Withdraw supply more than interest',async () =>{
			let amount = await convertToDecimals(SampleToken1, 20);
			await Holdefi.withdrawSupply(SampleToken1.address, amount, {from:user5});
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);
			let userBalanceAfter = await SampleToken1.balanceOf(user5);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(amount).toString(), 'User Balance increased correctly');
			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 'Balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'Interest decreased (0)');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})

		it('Withdraw supply for someone else',async () =>{
			let user6BalanceBefore = await SampleToken1.balanceOf(user6);
			let amount = await convertToDecimals(SampleToken1, 20);
			await Holdefi.approveWithdrawSupply(user6, SampleToken1.address, amount, {from:user5})
			await Holdefi.withdrawSupplyBehalf(user5, SampleToken1.address, amount, {from:user6});
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let getAccountAllowanceAfter = await Holdefi.getAccountWithdrawSupplyAllowance(user5, user6, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);
			let user5BalanceAfter = await SampleToken1.balanceOf(user5);
			let user6BalanceAfter = await SampleToken1.balanceOf(user6);

			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User withdraw supply allowance decreased');
			assert.equal(user5BalanceAfter.toString(), bigNumber(userBalanceBefore).toString(), 'Sender erc20 balance not changed');
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).plus(amount).toString(), 'User erc20 balance increased correctly');
			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 'User supply balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'User supply interest decreased (0)');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})

		it('Withdraw if market is removed',async () =>{
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

			assert.equal(getAccountSupplyAfterRemove.interest.toString(), getAccountSupplyAfterRemoveAfter30Days.interest.toString(), 'Interest not increasing after removing market')

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(withdrawAmount).toString(), 'User Balance increased correctly');
			assert.equal(getAccountSupplyAfter.balance.toString(), 0, 'Supply balance decreased (0)')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'Interest decreased (0)');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(getAccountSupplyAfterRemove.balance).toString(), 'Total supply decreased');
		})

		it('Should withdraw all amount if withdraw amount is bigger than total balance',async () =>{
			await Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5})
			let time2 = await time.latest();
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
	
			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

			let totalBalanceAfter = bigNumber(getAccountSupplyAfter.balance).plus(getAccountSupplyAfter.interest);
			assert.equal(totalBalanceAfter.toString(), 0, 'Balance decreased');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(getAccountSupplyBefore.balance).toString(), 'Total supply decreased')
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(getAccountSupplyBefore.balance).plus(x1).toString(), 'User Balance increased correctly');		
		})
		
		it('Withdraw less than interest just decreases interest not balance',async () =>{
			let amount = 10;
			await Holdefi.withdrawSupply(SampleToken1.address, amount, {from:user5})
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let userBalanceAfter = await SampleToken1.balanceOf(user5);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(amount).toString(), 'User Balance increased correctly');
			assert.equal(getAccountSupplyBefore.balance.toString(), getAccountSupplyAfter.balance.toString(), 'Balance not changed')
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.minus(amount).toString(), 'Interest decreased');
			assert.equal(getMarketAfter.totalSupply.toString(), getMarketBefore.totalSupply.toString(), 'Total supply not changed')
		})

		it('Should withdraw supply if market is deactivated',async () =>{		
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			amount = await convertToDecimals(SampleToken1, 20);
			await Holdefi.withdrawSupply(SampleToken1.address, amount, {from:user5});
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);

			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 'Balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'Interest decreased (0)');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})

		it('Supply rate should be increased after withdraw supply',async () => {
			await Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5});
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let getMarketSupplyInterestsAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			assert.isAbove(getMarketSupplyInterestsAfter.supplyRate.toNumber(), getMarketSupplyInterestsBefore.supplyRate.toNumber());
		})

		it('Admin Reserve increased corrcetly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = (await Holdefi.getPromotionReserve(SampleToken1.address)).promotionReserveScaled;
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

		it('Promotion rate should be set to zero if promotionDebt > promotionReserve and call withdrawSupply function',async () => {
			await assignToken(owner, owner, SampleToken1);

			await Holdefi.depositPromotionReserve(SampleToken1.address, await convertToDecimals(SampleToken1, 1));
			await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
			let time1 = await time.latest();
			let getMarketSettingsBefore = await HoldefiSettings.marketAssets(SampleToken1.address)
			let marketSupplyInterestBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			await time.increase(time.duration.days(100));
			await Holdefi.withdrawSupply(SampleToken1.address, 0, {from:user5});
			let time2 = await time.latest();
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address)
			let getMarketSettingsAfter = await HoldefiSettings.marketAssets(SampleToken1.address)
			let marketSupplyInterestAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			let debtScaled = bigNumber(time2-time1).multipliedBy(getMarketBefore.totalSupply).multipliedBy(ratesDecimal.multipliedBy(0.1));

			assert.equal(marketSupplyInterestAfter.supplyRate.toString(), bigNumber(marketSupplyInterestBefore.supplyRate).minus(getMarketSettingsBefore.promotionRate).toString(), 'Supply rate decrease')
			assert.equal(getMarketSettingsAfter.promotionRate.toString(), 0, 'Promotion rate should be zero after promotion reserve spent')
			assert.equal(debtScaled.toString() , getMarketAfter.promotionDebtScaled.toString(), 'Promotion debt increased correctly');
		})

		it('Withdraw Supply if one month passed after pause',async () =>{
			await Holdefi.pause("withdrawSupply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5});
			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			assert.equal(getAccountSupply.balance.toString(), 0, 'Balance increased');

		})

		it('Fail Withdraw supply for someone else without approve',async () =>{
			let amount = await convertToDecimals(SampleToken1, 20);
			await expectRevert(Holdefi.withdrawSupplyBehalf(user5, SampleToken1.address, amount, {from:user6}),
 			"Withdraw not allowed");
		})

		it('Fail if withdrawSupply was paused and call withdrawSupply before one month',async () =>{
			await Holdefi.pause("withdrawSupply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				"Operation is paused");
		})

		it('Fail if user not supply at all',async () =>{
			await expectRevert(Holdefi.withdrawSupply(SampleToken1.address, decimal18.multipliedBy(25), {from:user6}),
				"Total balance should not be zero");
		})	

		it('Fail if not enough cash',async () =>{
			await Holdefi.methods['collateralize()']({from:user6, value: decimal18.multipliedBy(10)});	
			await Holdefi.borrow(
				SampleToken1.address,
				ethAddress,
				bigNumber(getMarketBefore.totalSupply).minus(getMarketBefore.totalBorrow),
				referalCode,
				{from: user6}
			);

			await expectRevert(Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				"revert");

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			assert.equal(getAccountSupplyAfter.balance.toString(), getAccountSupplyBefore.balance.toString(), 'User5 balance not changed');
		})

	})

	describe("Withdraw Supply ETH", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await Holdefi.methods['supply(uint16)'](
				referalCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			
			time1 = await time.latest();
			getMarketBefore = await Holdefi.marketAssets(ethAddress);
            getMarketSupplyInterestsBefore = await Holdefi.getCurrentSupplyIndex(ethAddress);
            userBalanceBefore = await web3.eth.getBalance(user5);
			
			await time.increase(time.duration.days(5));
			getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, ethAddress);
		})

		it('Withdraw supply more than interest',async () =>{
			let amount = decimal18.multipliedBy(1);
			let tx = await Holdefi.withdrawSupply(ethAddress, amount, {from:user5})
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);		

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);

			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(amount).toString(), 'User Balance increased correctly');
			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 'Balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'Interest decreased (0)');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})

		it('Withdraw supply more than interest for someone else',async () =>{
			let user6BalanceBefore = await web3.eth.getBalance(user6);
			let amount = decimal18.multipliedBy(1);
			let approve_tx = await Holdefi.approveWithdrawSupply(user6, ethAddress, amount, {from:user5})
			let withdraw_tx = await Holdefi.withdrawSupplyBehalf(user5, ethAddress, amount, {from:user6})
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);
			let getAccountAllowanceAfter = await Holdefi.getAccountWithdrawCollateralAllowance(user5, user6, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);		

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);

			let user5BalanceAfter = await web3.eth.getBalance(user5);
			let user6BalanceAfter = await web3.eth.getBalance(user6);
			let approve_tx_fee = gasPrice.multipliedBy(approve_tx.receipt.gasUsed);
			let withdraw_tx_fee = gasPrice.multipliedBy(withdraw_tx.receipt.gasUsed);

			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User withdraw supply allowance decreased');
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).minus(withdraw_tx_fee).plus(amount).toString(), 'Sender erc20 balance increased correctly');
			assert.equal(user5BalanceAfter.toString(), bigNumber(userBalanceBefore).minus(approve_tx_fee).toString(), 'User erc20 balance not changed');
			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 'User supply balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'User supply interest decreased (0)');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})

		it('Should withdraw all amount if withdraw amount is bigger than total balance',async () => {
			let tx = await Holdefi.withdrawSupply(ethAddress, constants.MAX_UINT256, {from:user5})
			let time2 = await time.latest();
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

			let totalBalanceAfter = bigNumber(getAccountSupplyAfter.balance).plus(getAccountSupplyAfter.interest);
			assert.equal(totalBalanceAfter.toString(), 0, 'Balance decreased');

			let getMarketAfter = await Holdefi.marketAssets(ethAddress);
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(getAccountSupplyBefore.balance).toString(), 'Total supply decreased')

			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(getAccountSupplyBefore.balance).plus(x1).toString(), 'User Balance increased correctly');
		})

		it('Withdraw less than interest just decrease interest not balance',async () =>{
			let amount = bigNumber(getAccountSupplyBefore.interest).minus(10);
			let tx = await Holdefi.withdrawSupply(ethAddress, amount, {from:user5})
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);			

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(amount).toString(), 'User Balance increased correctly');
			assert.equal(getAccountSupplyBefore.balance.toString(), getAccountSupplyAfter.balance.toString(), 'Balance not changed')
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.minus(amount).toString(), 'Interest decreased');
			assert.equal(getMarketAfter.totalSupply.toString(), getMarketBefore.totalSupply.toString(), 'Total supply not changed')
		})

		it('Should withdraw supply if market is deactivated',async () =>{		
			await HoldefiSettings.deactivateMarket(ethAddress,{from:owner});
			let amount = decimal18.multipliedBy(1);
			await Holdefi.withdrawSupply(ethAddress, amount, {from:user5})
			let time2 = await time.latest();
			
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);
			let getMarketAfter = await Holdefi.marketAssets(ethAddress);			

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketSupplyInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);

			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 'Balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'Interest decreased (0)');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})			

		it('Withdraw Supply if one month passed after pause',async () =>{
			await Holdefi.pause("withdrawSupply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.withdrawSupply(ethAddress, constants.MAX_UINT256, {from:user5});
			let getAccountSupply = await Holdefi.getAccountSupply(user5,ethAddress);
			assert.equal(getAccountSupply.balance.toString(), 0, 'Balance increased');

		})

		it('Fail if withdrawSupply was paused and call withdrawSupply before one month',async () =>{
			await Holdefi.pause("withdrawSupply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.withdrawSupply(ethAddress, constants.MAX_UINT256, {from:user5}),
				"Operation is paused");
		})

		it('Fail Withdraw supply for someone else without approve',async () =>{
			let amount = await convertToDecimals(SampleToken1, 20);
			await expectRevert(Holdefi.withdrawSupplyBehalf(user5, ethAddress, amount, {from:user6}),
 			"Withdraw not allowed");
		})

		it('Fail if not enough cash',async () =>{
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
				referalCode,
				{from: user6}
			);

			await expectRevert(Holdefi.withdrawSupply(ethAddress, constants.MAX_UINT256, {from:user5}),
				"revert");

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);
			assert.equal(getAccountSupplyAfter.balance.toString(), getAccountSupplyBefore.balance.toString(), 'User5 balance not changed');
		})	
	})
})

