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

contract("Borrow", function([owner,ownerChanger,user1,user2,user3,user4,user5,user6]){
	describe("ERC20 borrow", async() => {
		beforeEach(async() => {
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await assignToken(owner, user6, SampleToken1);
			await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(100), {from:user6});

			this.userBalanceBefore = await SampleToken1.balanceOf(user5);
		})
		
		it('ERC20 asset borrowed',async () =>{
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(10), {from: user5});
			
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
			assert.equal(getAccountBorrow.balance.toString(), decimal18.multipliedBy(10).toString(), 'Balance increased');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).plus(decimal18.multipliedBy(10)).toString(), 'Total borrow increased');

			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerScaled).isLessThan(getAccountCollateralAfter.borrowPowerScaled), 'Borrow Power increased');
			
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(decimal18.multipliedBy(10)).toString(), 'User Balance increased correctly');
		})
		
		it('Borrower interest should be increased',async () => {
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(10), {from: user5});
			let time1 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
			let time2 = await time.latest();
			
			let marketInterest = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
			
			let x = bigNumber(time2-time1).multipliedBy(marketInterest.borrowRate).multipliedBy(getAccountBorrow.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			
			assert.equal(getAccountBorrow.interest.toString() , x.toString());
		})

		it('Borrower interest should be increased after second borrow',async () => {
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(5), {from: user5});
			let time1 = await time.latest();

			let getAccountBorrowBefore = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			await time.increase(time.duration.days(5));
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(5), {from: user5});
			let time2 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
			let time3 = await time.latest();

			let marketInterestAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(marketInterestBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			let x2 = bigNumber(time3-time2).multipliedBy(marketInterestAfter.borrowRate).multipliedBy(getAccountBorrowAfter.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			
			assert.equal(getAccountBorrowAfter.interest.toString(), x1.plus(x2).toString());
		})

		it('Supply rate should be increased after borrowing',async () => {
			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(10), {from: user5});
			let marketInterestAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			assert.isAbove(marketInterestAfter.supplyRate.toNumber(), marketInterestBefore.supplyRate.toNumber());
		})
		
		it('Admin Reserve increased corretly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = (await Holdefi.getCurrentPromotion(SampleToken1.address)).promotionReserveScaled;
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(5), {from: user5});
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(SampleToken1.address);
			let reserveAfter = bigNumber(marketFeaturesAfter.promotionReserveScaled);	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(marketInterestBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(marketInterestBefore.supplyRate).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);

			assert.equal(adminShare.toString(), x.toString());
		})

		it('Borrow if one month passed after pause',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.pause(4, {from: owner});
			await time.increase(time.duration.days(30));
			
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(10), {from: user5});
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
			assert.equal(getAccountBorrow.balance.toString(), decimal18.multipliedBy(10).toString(), 'Balance increased');
		})

		it('Fail if borrow was paused and call borrow before one month',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.pause(4, {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(10), {from: user5}),
				"Pausable: paused");
		})			

		it('Fail if borrow asset is not active',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await HoldefiSettings.removeMarket(SampleToken1.address,{from:owner});
			await expectRevert(Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(10),{from: user3}),
				"Market or Collateral asset is not active");
		})	

		it('Fail if collateral is not active',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await HoldefiSettings.removeCollateral(constants.ZERO_ADDRESS,{from:owner});
			await expectRevert(Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(10),{from: user3}),
				"Market or Collateral asset is not active");
		})	

		it('Fail if amount is more than cash',async () =>{
			let marketFeatures = await Holdefi.marketAssets(SampleToken1.address);
			let cash = bigNumber(marketFeatures.totalSupply).minus(marketFeatures.totalBorrow);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(3)});

			await expectRevert(Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, cash.plus(1), {from: user5}),
				"Amount should be less than cash");
		})

		it('Fail if user is under collateral',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(10), {from: user5});

			await HoldefiPrices.setPrice(SampleToken1.address, decimal18.multipliedBy(16));

			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
			assert.isTrue(getAccountCollateral.underCollateral, 'User is not under collateral');

			await expectRevert(Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(5), {from: user5}),
				"Borrow power should be more than new borrow value");			
		})

		it('Fail if borrow power less than new borrow value',async () =>{
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});

			await expectRevert(Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(16), {from: user5}),
				"Borrow power should be more than new borrow value");
		})

		it('Fail for second borrow if value to loan of borrower between 145% and 150%',async () => {
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(11), {from: user5});

			await HoldefiPrices.setPrice(SampleToken1.address, decimal18.multipliedBy(12.45));

			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
			assert.equal(getAccountCollateral.borrowPowerScaled.toString(), 0, 'Borrow power is zero');

			assert.isFalse(getAccountCollateral.underCollateral, 'User is not under collateral');

			await expectRevert(Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(2), {from: user5}),
				"Borrow power should be more than new borrow value");
		})

		it('Fail if user not collateralize at all',async () =>{
			await expectRevert(Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(5), {from: user5}),
				"Borrow power should be more than new borrow value");	
		})
	})
	
	describe("ETH borrow", async() => {
		beforeEach(async() => {
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
		})

		it('ETH borrowed',async () =>{
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			let getMarketBefore = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(40), {from:user5});
			let userBalanceBefore = await web3.eth.getBalance(user5);
			let tx = await Holdefi.borrow(constants.ZERO_ADDRESS, SampleToken1.address, decimal18.multipliedBy(0.5), {from: user5});
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, constants.ZERO_ADDRESS, SampleToken1.address)
			assert.equal(getAccountBorrow.balance.toString(), decimal18.multipliedBy(0.5).toString(), 'Balance increased');

			let getMarketAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).plus(decimal18.multipliedBy(0.5)).toString(), 'Total borrow increased');
		
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerScaled).isLessThan(getAccountCollateralAfter.borrowPowerScaled), 'Borrow Power increased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(decimal18.multipliedBy(0.5)).toString(), 'User Balance increased correctly');
		})
	})	
})