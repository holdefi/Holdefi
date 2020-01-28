const {		
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

contract("Withdraw Supply", function([owner,ownerChanger,user1,user2,user3,user4,user5,user6]){
		
	describe("Withdraw Supply ERC20 ", async() =>{
		beforeEach(async() => {
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
			this.time1 = await time.latest();
			this.getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
            this.getMarketInterestsBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
			this.userBalanceBefore = await SampleToken1.balanceOf(user5);

			await time.increase(time.duration.days(5));
			this.getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, SampleToken1.address);
		})
	
		it('Withdraw supply more than interest',async () =>{
			let amount = decimal18.multipliedBy(20);
			await Holdefi.withdrawSupply(SampleToken1.address, amount, {from:user5});
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);
			let userBalanceAfter = await SampleToken1.balanceOf(user5);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(amount).toString(), 'User Balance increased correctly');
			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 'Balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'Interest decreased (0)');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})
		
		it('Should withdraw all amount if withdraw amount is bigger than total balance',async () =>{
			await Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5})
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);

			let totalBalanceAfter = bigNumber(getAccountSupplyAfter.balance).plus(getAccountSupplyAfter.interest);
			assert.equal(totalBalanceAfter.toString(), 0, 'Balance decreased');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(getAccountSupplyBefore.balance).toString(), 'Total supply decreased')
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(getAccountSupplyBefore.balance).plus(getAccountSupplyBefore.interest).toString(), 'User Balance increased correctly');		
		})
		
		it('Withdraw less than interest just decreases interest not balance',async () =>{
			let amount = 10;
			await Holdefi.withdrawSupply(SampleToken1.address, amount, {from:user5})
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let userBalanceAfter = await SampleToken1.balanceOf(user5);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(amount).toString(), 'User Balance increased correctly');
			assert.equal(getAccountSupplyBefore.balance.toString(), getAccountSupplyAfter.balance.toString(), 'Balance not changed')
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.minus(amount).toString(), 'Interest decreased');
			assert.equal(getMarketAfter.totalSupply.toString(), getMarketBefore.totalSupply.toString(), 'Total supply not changed')
		})
		
		it('Should withdraw supply if market is removed',async () =>{		
			await HoldefiSettings.removeMarket(SampleToken1.address,{from:owner});
			amount = decimal18.multipliedBy(20);
			await Holdefi.withdrawSupply(SampleToken1.address, amount, {from:user5});
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);

			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 'Balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'Interest decreased (0)');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})

		it('Supply rate should be increased after withdraw supply',async () => {
			await Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5});
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			assert.isAbove(getMarketInterestsAfter.supplyRate.toNumber(), getMarketInterestsBefore.supplyRate.toNumber());
		})

		it('Admin Reserve increased corrcetly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = (await Holdefi.getCurrentPromotion(SampleToken1.address)).promotionReserveScaled;
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
			await Holdefi.withdrawSupply(SampleToken1.address, decimal18.multipliedBy(10), {from:user5});
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(SampleToken1.address);
			let reserveAfter = marketFeaturesAfter.promotionReserveScaled;	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(marketInterestBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(marketInterestBefore.supplyRate).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);

			assert.equal(adminShare.toString(), x.toString());
		})

		it('Promotion rate should be set to zero if promotionDebt > promotionReserve and call withdrawSupply function',async () => {
			await assignToken(owner, owner, SampleToken1);

			await Holdefi.depositPromotionReserve(SampleToken1.address, decimal18.multipliedBy(1));
			await Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
			let time1 = await time.latest();
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address)
			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			await time.increase(time.duration.days(100));
			await Holdefi.methods['withdrawSupply(address,uint256)'](SampleToken1.address, 0, {from:user5});
			let time2 = await time.latest();
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address)
			let marketInterestAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			let debtScaled = bigNumber(time2-time1).multipliedBy(getMarketBefore.totalSupply).multipliedBy(ratesDecimal.multipliedBy(0.1));

			assert.equal(marketInterestAfter.supplyRate.toString(), bigNumber(marketInterestBefore.supplyRate).minus(getMarketBefore.promotionRate).toString(), 'Supply rate decrease')
			assert.equal(getMarketAfter.promotionRate.toString(), 0, 'Promotion rate should be zero after promotion reserve spent')
			assert.equal(debtScaled.toString() , getMarketAfter.promotionDebtScaled.toString(), 'Promotion debt increased correctly');
		})

		it('Withdraw Supply if one month passed after pause',async () =>{
			await Holdefi.pause(1, {from: owner});
			await time.increase(time.duration.days(30));
			
			await Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5});
			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			assert.equal(getAccountSupply.balance.toString(), 0, 'Balance increased');

		})

		it('Fail if withdrawSupply was paused and call withdrawSupply before one month',async () =>{
			await Holdefi.pause(1, {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				"Pausable: paused");
		})

		it('Fail if user not supply at all',async () =>{
			await expectRevert(Holdefi.withdrawSupply(SampleToken1.address, decimal18.multipliedBy(25), {from:user6}),
				"Total balance should not be zero");
		})	

		it('Fail if not enough cash',async () =>{
			await Holdefi.methods['collateralize()']({from:user6, value: decimal18.multipliedBy(10)});	
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, bigNumber(getMarketBefore.totalSupply).minus(getMarketBefore.totalBorrow), {from: user6});

			await expectRevert(Holdefi.withdrawSupply(SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				"revert");

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			assert.equal(getAccountSupplyAfter.balance.toString(), getAccountSupplyBefore.balance.toString(), 'User5 balance not changed');
		})

	})

	describe("Withdraw Supply ETH", async() =>{
		beforeEach(async() => {
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await Holdefi.methods['supply()']({from:user5, value: decimal18.multipliedBy(1)});
			this.time1 = await time.latest();
			this.getMarketBefore = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
            this.getMarketInterestsBefore = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);
            this.userBalanceBefore = await web3.eth.getBalance(user5);
			
			await time.increase(time.duration.days(5));
			this.getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, constants.ZERO_ADDRESS);
		})

		it('Withdraw supply more than interest',async () =>{
			let amount = decimal18.multipliedBy(1);
			let tx = await Holdefi.withdrawSupply(constants.ZERO_ADDRESS, amount, {from:user5})
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, constants.ZERO_ADDRESS);
			let getMarketAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);			

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);

			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(amount).toString(), 'User Balance increased correctly');
			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 'Balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'Interest decreased (0)');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})

		it('Should withdraw all amount if withdraw amount is bigger than total balance',async () =>{		
			let getMarketBefore = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			let getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, constants.ZERO_ADDRESS);
			let tx = await Holdefi.withdrawSupply(constants.ZERO_ADDRESS, constants.MAX_UINT256, {from:user5})
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, constants.ZERO_ADDRESS);

			let totalBalanceAfter = bigNumber(getAccountSupplyAfter.balance).plus(getAccountSupplyAfter.interest);
			assert.equal(totalBalanceAfter.toString(), 0, 'Balance decreased');

			let getMarketAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(getAccountSupplyBefore.balance).toString(), 'Total supply decreased')

			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(getAccountSupplyBefore.balance).plus(getAccountSupplyBefore.interest).toString(), 'User Balance increased correctly');
		})

		it('Withdraw less than interest just decrease interest not balance',async () =>{
			let amount = bigNumber(getAccountSupplyBefore.interest).minus(10);
			let tx = await Holdefi.withdrawSupply(constants.ZERO_ADDRESS, amount, {from:user5})
			let time2 = await time.latest();

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, constants.ZERO_ADDRESS);
			let getMarketAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);			

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);

			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(amount).toString(), 'User Balance increased correctly');
			assert.equal(getAccountSupplyBefore.balance.toString(), getAccountSupplyAfter.balance.toString(), 'Balance not changed')
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.minus(amount).toString(), 'Interest decreased');
			assert.equal(getMarketAfter.totalSupply.toString(), getMarketBefore.totalSupply.toString(), 'Total supply not changed')
		})

		it('Should withdraw supply if market is removed',async () =>{		
			await HoldefiSettings.removeMarket(constants.ZERO_ADDRESS,{from:owner});
			let amount = decimal18.multipliedBy(1);
			await Holdefi.withdrawSupply(constants.ZERO_ADDRESS, amount, {from:user5})
			let time2 = await time.latest();
			
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, constants.ZERO_ADDRESS);
			let getMarketAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);			

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let balanceChange = amount.minus(x1);

			assert.equal(getAccountSupplyAfter.balance.toString(), bigNumber(getAccountSupplyBefore.balance).minus(balanceChange).toString(), 'Balance decreased')
			assert.equal(getAccountSupplyAfter.interest.toString(), 0, 'Interest decreased (0)');
			assert.equal(getMarketAfter.totalSupply.toString(), bigNumber(getMarketBefore.totalSupply).minus(balanceChange).toString(), 'Total supply decreased');
		})			

		it('Withdraw Supply if one month passed after pause',async () =>{
			await Holdefi.pause(1, {from: owner});
			await time.increase(time.duration.days(30));
			
			await Holdefi.withdrawSupply(constants.ZERO_ADDRESS, constants.MAX_UINT256, {from:user5});
			let getAccountSupply = await Holdefi.getAccountSupply(user5,constants.ZERO_ADDRESS);
			assert.equal(getAccountSupply.balance.toString(), 0, 'Balance increased');

		})

		it('Fail if withdrawSupply was paused and call withdrawSupply before one month',async () =>{
			await Holdefi.pause(1, {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.withdrawSupply(constants.ZERO_ADDRESS, constants.MAX_UINT256, {from:user5}),
				"Pausable: paused");
		})

		it('Fail if not enough cash',async () =>{
			await assignToken(owner, user6, SampleToken1);
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(200), {from:user6});
			await Holdefi.borrow(constants.ZERO_ADDRESS, SampleToken1.address, bigNumber(getMarketBefore.totalSupply).minus(getMarketBefore.totalBorrow), {from: user6});

			await expectRevert(Holdefi.withdrawSupply(constants.ZERO_ADDRESS, constants.MAX_UINT256, {from:user5}),
				"revert");

			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, constants.ZERO_ADDRESS);
			assert.equal(getAccountSupplyAfter.balance.toString(), getAccountSupplyBefore.balance.toString(), 'User5 balance not changed');
		})	
	})
})

