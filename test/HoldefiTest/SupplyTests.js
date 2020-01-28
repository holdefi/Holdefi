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

contract("Supply", function([owner,ownerChanger,user1,user2,user3,user4,user5,user6]){

	describe("Supply ERC20", async() =>{
		beforeEach(async() => {
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			this.userBalanceBefore = await SampleToken1.balanceOf(user5);
		})
		
		it('Token supplied',async () => {
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

			await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			assert.equal(getAccountSupply.balance.toString(), decimal18.multipliedBy(20).toString(), 'Balance increased');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalSupply.toString() , decimal18.multipliedBy(20).plus(getMarketBefore.totalSupply).toString(), 'Total supply increased');
			
			let allowance = await SampleToken1.allowance(user5, Holdefi.address);
			assert.equal(allowance.toString(), decimal18.multipliedBy(780).toString(), 'Allowance decreased');
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(decimal18.multipliedBy(20)).toString(), 'User Balance increased correctly');		
		})

		it('Supplier should get interest',async () => {
			await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
			let time1 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			let time2 = await time.latest();
			
			let marketInterest = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
			
			let x = bigNumber(time2-time1).multipliedBy(marketInterest.supplyRate).multipliedBy(getAccountSupply.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupply.interest.toString() , x.toString());
		})

		it('Supplier should get interest after second supply',async () => {
			await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
			let time1 = await time.latest();
			let getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, SampleToken1.address);

			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			await time.increase(time.duration.days(5));
			await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
			let time2 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let time3 = await time.latest();

			let marketInterestAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(marketInterestBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let x2 = bigNumber(time3-time2).multipliedBy(marketInterestAfter.supplyRate).multipliedBy(getAccountSupplyAfter.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.plus(x2).toString());
		})

		it('Supply rate should be decreased after supply',async () => {
			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
			await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
			let marketInterestAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			assert.isBelow(marketInterestAfter.supplyRate.toNumber(), marketInterestBefore.supplyRate.toNumber());
		})
		
		it('Admin Reserve increased corretly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = (await Holdefi.getCurrentPromotion(SampleToken1.address)).promotionReserveScaled;
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
			await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(SampleToken1.address);
			let reserveAfter = marketFeaturesAfter.promotionReserveScaled;	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(marketInterestBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(marketInterestBefore.supplyRate).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);

			assert.equal(adminShare.toString(), x.toString());
		})

		it('Promotion rate should be set to zero if promotionDebt > promotionReserve and call supply function',async () => {
			await assignToken(owner, owner, SampleToken1);

			await Holdefi.depositPromotionReserve(SampleToken1.address, decimal18.multipliedBy(1));
			await Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
			let time1 = await time.latest();
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address)
			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			await time.increase(time.duration.days(200));
			await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, 0, {from:user5});
			let time2 = await time.latest();
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address)
			let marketInterestAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			let debtScaled = bigNumber(time2-time1).multipliedBy(getMarketBefore.totalSupply).multipliedBy(ratesDecimal.multipliedBy(0.1));

			assert.equal(marketInterestAfter.supplyRate.toString(), bigNumber(marketInterestBefore.supplyRate).minus(getMarketBefore.promotionRate).toString(), 'Supply rate decreased')
			assert.equal(getMarketAfter.promotionRate.toString(), 0, 'Promotion rate should be zero after promotion reserve spent')
			assert.equal(debtScaled.toString() , getMarketAfter.promotionDebtScaled.toString(), 'Promotion debt increase correctly');
		})

		it('Supply if one month passed after pause',async () =>{
			await Holdefi.pause(0, {from: owner});
			await time.increase(time.duration.days(30));
			
			await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			assert.equal(getAccountSupply.balance.toString(), decimal18.multipliedBy(20).toString(), 'Balance increased');

		})

		it('Fail if supply was paused and call supply before one month',async () =>{
			await Holdefi.pause(0, {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5}),
				"Pausable: paused");
		})

		it('Fail if market was not active',async () =>{
			await HoldefiSettings.removeMarket(SampleToken1.address,{from:owner});
			await expectRevert(Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5}),
				"Market is not active");
		})

		it('Fail if supplyAsset = 0x',async () =>{
			await expectRevert(Holdefi.methods['supply(address,uint256)'](constants.ZERO_ADDRESS, decimal18.multipliedBy(20), {from:user5}),
				"Supply asset should not be zero address");
		})

		it('Fail if balance < collateral amount',async () =>{
			await SampleToken1.mint(user6, decimal18.multipliedBy(40), {from: owner});
			await SampleToken1.approve(Holdefi.address, constants.MAX_UINT256, {from: user6});

			await expectRevert(Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(45), {from:user6}),
				'revert');	
		})

		it('Fail if allowance < supply amount',async () =>{
			await SampleToken1.mint(user6, decimal18.multipliedBy(40), {from: owner});
			await SampleToken1.approve(Holdefi.address, decimal18.multipliedBy(30), {from: user6});

			await expectRevert(Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(35), {from:user6}),
				'revert');		
		})
	})
	
	describe("Supply ETH", async() => {
		beforeEach(async() => {
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			this.userBalanceBefore = await web3.eth.getBalance(user5);
		})

		it('ETH supplied',async () =>{
			let getMarketBefore = await Holdefi.marketAssets(constants.ZERO_ADDRESS);

			let tx = await Holdefi.methods['supply()']({from:user5, value: decimal18.multipliedBy(2)});
			let getAccountSupply = await Holdefi.getAccountSupply(user5,constants.ZERO_ADDRESS);
			assert.equal(getAccountSupply.balance.toString() ,decimal18.multipliedBy(2).toString(), 'Balance increased');

			let getMarketAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			assert.equal(getMarketAfter.totalSupply.toString() , decimal18.multipliedBy(2).plus(getMarketBefore.totalSupply).toString(), 'Total supply increased');
		
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(decimal18.multipliedBy(2)).toString(), 'User Balance increased correctly');
		})

		it('Supplier should get interest',async () => {
			await Holdefi.methods['supply()']({from:user5, value: decimal18.multipliedBy(2)});
			let time1 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupply = await Holdefi.getAccountSupply(user5,constants.ZERO_ADDRESS);
			let time2 = await time.latest();
			
			let marketInterest = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);
			
			let x = bigNumber(time2-time1).multipliedBy(marketInterest.supplyRate).multipliedBy(getAccountSupply.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupply.interest.toString() , x.toString());
		})

		it('Supplier should get interest after second supply',async () => {
			await Holdefi.methods['supply()']({from:user5, value: decimal18.multipliedBy(2)});
			let time1 = await time.latest();
			let getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, constants.ZERO_ADDRESS);

			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);

			await time.increase(time.duration.days(5));
			await Holdefi.methods['supply()']({from:user5, value: decimal18.multipliedBy(2)});
			let time2 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, constants.ZERO_ADDRESS);
			let time3 = await time.latest();

			let marketInterestAfter = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);

			let x1 = bigNumber(time2-time1).multipliedBy(marketInterestBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let x2 = bigNumber(time3-time2).multipliedBy(marketInterestAfter.supplyRate).multipliedBy(getAccountSupplyAfter.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.plus(x2).toString());
		})

		it('Supply rate should decrease after supply',async () => {
			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);
			await Holdefi.methods['supply()']({from:user5, value: decimal18.multipliedBy(2)});
			let marketInterestAfter = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);

			assert.isBelow(marketInterestAfter.supplyRate.toNumber(), marketInterestBefore.supplyRate.toNumber());
		})

		it('Admin Reserve increased corretly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = (await Holdefi.getCurrentPromotion(constants.ZERO_ADDRESS)).promotionReserveScaled;
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);
			await Holdefi.methods['supply()']({from:user5, value: decimal18.multipliedBy(2)});
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			let reserveAfter = marketFeaturesAfter.promotionReserveScaled;	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(marketInterestBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(marketInterestBefore.supplyRate).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);

			assert.equal(adminShare.toString(), x.toString());
		})

		it('Supply if one month passed after pause',async () =>{
			await Holdefi.pause(0, {from: owner});
			await time.increase(time.duration.days(30));
			
			await Holdefi.methods['supply()']({from:user5, value: decimal18.multipliedBy(2)});
			let getAccountSupply = await Holdefi.getAccountSupply(user5,constants.ZERO_ADDRESS);
			assert.equal(getAccountSupply.balance.toString(), decimal18.multipliedBy(2).toString(), 'Balance increased');

		})

		it('Fail if supply was paused and call supply before one month',async () =>{
			await Holdefi.pause(0, {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.methods['supply()']({from:user5, value: decimal18.multipliedBy(2)}),
				"Pausable: paused");
		})		

		it('Fail if market was not active',async () =>{
			await HoldefiSettings.removeMarket(constants.ZERO_ADDRESS,{from:owner});
			await expectRevert(Holdefi.methods['supply()']({from:user5, value: decimal18.multipliedBy(2)}),
				"Market is not active");
		})

		it('Fail if balance < supply amount',async () =>{
			await expectRevert(Holdefi.methods['supply()']({from:user5, value: decimal18.multipliedBy(2000)}),
				"sender doesn't have enough funds to send tx");	
		})
	})
})