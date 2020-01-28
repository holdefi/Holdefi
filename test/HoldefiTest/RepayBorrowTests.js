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
	scenario,
	fiveSecondInterest
} = require ("../Utils.js");

contract("Repay borrow", function([owner,ownerChanger,user1,user2,user3,user4,user5,user6]){
	describe("Repay borrow ERC20", async() => {
		beforeEach(async() => {
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(5), {from: user5});
			this.time1 = await time.latest();

			this.getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
			this.getMarketInterestsBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
			await time.increase(time.duration.days(30));
			this.getAccountBorrowBefore = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
			this.getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
			this.userBalanceBefore = await SampleToken1.balanceOf(user5);
		})
		
		it('Should repay if amount is more than interest',async () =>{
			let repayAmount = decimal18.multipliedBy(5);
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, repayAmount, {from:user5});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);	
			let balanceChange = repayAmount.minus(x1);

			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).minus(balanceChange).toString(), 'Balance decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), 1, 'Interest decreased (1)');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(balanceChange).toString(),'Total Borrow decreased');
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerScaled).isLessThan(getAccountCollateralAfter.borrowPowerScaled), 'Borrow Power increased');
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(repayAmount).toString(), 'User Balance increased correctly');
		})
		
		it('Should repay if amount is less than interest',async () =>{
			let repayAmount = 10;			  								
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, repayAmount, {from:user5});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

			assert.equal(getAccountBorrowBefore.balance.toString(), bigNumber(getAccountBorrowAfter.balance).toString(), 'Balance not decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), x1.minus(repayAmount).plus(1).toString(), 'Interest decreased');
			assert.equal(getMarketAfter.totalBorrow.toString(), getMarketBefore.totalBorrow.toString(), 'Total Borrow not changed');
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(repayAmount).toString(), 'User Balance increased correctly');
		})
		
		it('Should repay all amount if amount is more than total balance',async () =>{
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, constants.MAX_UINT256, {from:user5});
			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS)
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

			assert.equal(getAccountBorrowAfter.balance.toString(), 0, 'Balance decreased (0)');
			assert.equal(getAccountBorrowAfter.interest.toString(), 0, 'Interest decreased (0)');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(), 'Total borrow decreased');
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(getAccountBorrowBefore.balance).minus(getAccountBorrowBefore.interest).toString(), 'User Balance increased correctly');
		})

		it('Should repay if market is removed',async () =>{
			await HoldefiSettings.removeMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.removeMarket(constants.ZERO_ADDRESS,{from:owner});
			let repayAmount = decimal18.multipliedBy(5);
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, repayAmount, {from:user5});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			let balanceChange = repayAmount.minus(x1);

			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).minus(balanceChange).toString(), 'Balance decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), 1, 'Interest decreased (1)');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(balanceChange).toString(),'Total Borrow decreased');
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerScaled).isLessThan(getAccountCollateralAfter.borrowPowerScaled), 'Borrow Power increased');
			
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(repayAmount).toString(), 'User Balance increased correctly');
		})

		it('Supply rate should be decreased after repaying borrow',async () => {
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, constants.MAX_UINT256, {from:user5});
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

			assert.isBelow(getMarketInterestsAfter.supplyRate.toNumber(), getMarketInterestsBefore.supplyRate.toNumber());
		})

		it('Admin Reserve increased corretly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = (await Holdefi.getCurrentPromotion(SampleToken1.address)).promotionReserveScaled;
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, constants.MAX_UINT256, {from:user5});
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(SampleToken1.address);
			let reserveAfter = bigNumber(marketFeaturesAfter.promotionReserveScaled);	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(marketInterestBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(marketInterestBefore.supplyRate).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);

			assert.equal(adminShare.toString(), x.toString());
		})

		it('RepayBorrow if one month passed after pause',async () =>{
			await Holdefi.pause(5, {from: owner});
			await time.increase(time.duration.days(30));
			
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, constants.MAX_UINT256, {from:user5});
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
			assert.equal(getAccountBorrow.balance.toString(), 0, 'Balance decreased');
		})

		it('Fail if repayBorrow was paused and call repayBorrow before one month',async () =>{
			await Holdefi.pause(5, {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, constants.MAX_UINT256, {from:user5}),
				"Pausable: paused");
		})	

		it('Fail if borrow asset is zero',async () =>{
			await expectRevert(Holdefi.methods['repayBorrow(address,address,uint256)'](constants.ZERO_ADDRESS, SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				'Borrow asset should not be zero address');
		})

		it('Fail if user not borrow at all',async () =>{
			await expectRevert(Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(3), {from:user6}),
				'Total balance should not be zero');
		})	
	})	

	describe("Repay borrow ETH", async() => {
		beforeEach(async() => {
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
			await Holdefi.borrow(constants.ZERO_ADDRESS, SampleToken1.address, decimal18.multipliedBy(0.5), {from: user5});
			this.time1 = await time.latest();

			this.getMarketBefore = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			this.getMarketInterestsBefore = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);
			await time.increase(time.duration.days(30));
			this.getAccountBorrowBefore = await Holdefi.getAccountBorrow(user5, constants.ZERO_ADDRESS, SampleToken1.address);
			this.getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			this.userBalanceBefore = await web3.eth.getBalance(user5);
		})

		it('Should repay if amount is more than interest',async () =>{
			let repayAmount = decimal18.multipliedBy(0.5);
			let tx = await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value:repayAmount});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, constants.ZERO_ADDRESS, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			let balanceChange = repayAmount.minus(x1);

			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).minus(balanceChange).toString(), 'Balance decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), 1, 'Interest decreased (1)');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(balanceChange).toString(),'Total Borrow decreased');
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerScaled).isLessThan(getAccountCollateralAfter.borrowPowerScaled), 'Borrow Power increased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(repayAmount).toString(), 'User Balance increased correctly');
		})

		it('Should repay if amount is less than interest',async () =>{
			let repayAmount = 10;				
			let tx = await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value:repayAmount});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, constants.ZERO_ADDRESS, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

			assert.equal(getAccountBorrowBefore.balance.toString(), bigNumber(getAccountBorrowAfter.balance).toString(), 'Balance not decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), x1.minus(repayAmount).plus(1).toString(), 'Interest decreased');
			assert.equal(getMarketAfter.totalBorrow.toString(), getMarketBefore.totalBorrow.toString(), 'Total Borrow not changed');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(repayAmount).toString(), 'User Balance increased correctly');
		})

		it('Should repay all amount if amount is bigger than total balance and return remaining amount if repay more than balance',async () =>{
			let repayAmount = decimal18.multipliedBy(2);
			let tx = await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value:repayAmount});
			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, constants.ZERO_ADDRESS, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);			

			assert.equal(getAccountBorrowAfter.balance.toString(), 0, 'Balance decreased (0)')
			assert.equal(getAccountBorrowAfter.interest.toString(), 0, 'Interest decreased (0)')
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(), 'Total Balance decreased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(getAccountBorrowBefore.balance).minus(getAccountBorrowBefore.interest).toString(), 'User Balance increased correctly');
		})

		it('Should repay if market is removed',async () =>{
			await HoldefiSettings.removeMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.removeMarket(constants.ZERO_ADDRESS,{from:owner});	

			let repayAmount = decimal18.multipliedBy(0.5);
			let tx = await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value:repayAmount});
			let time2 = await time.latest();

			let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, constants.ZERO_ADDRESS, SampleToken1.address);
			let getMarketAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			let getMarketInterestsAfter = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);

			let x1 = bigNumber(time2-time1).multipliedBy(getMarketInterestsBefore.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
			let balanceChange = repayAmount.minus(x1);

			assert.equal(getAccountBorrowAfter.balance.toString(), bigNumber(getAccountBorrowBefore.balance).minus(balanceChange).toString(), 'Balance decreased');
			assert.equal(getAccountBorrowAfter.interest.toString(), 1, 'Interest decreased (1)');
			assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(balanceChange).toString(),'Total Borrow decreased');
			assert.isTrue(bigNumber(getAccountCollateralBefore.borrowPowerScaled).isLessThan(getAccountCollateralAfter.borrowPowerScaled), 'Borrow Power increase');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(repayAmount).toString(), 'User Balance increase correctly');
		})

		it('Admin Reserve increased corretly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = (await Holdefi.getCurrentPromotion(constants.ZERO_ADDRESS)).promotionReserveScaled;
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			let marketInterestBefore = await Holdefi.getCurrentInterestIndex(constants.ZERO_ADDRESS);
			let repayAmount = decimal18.multipliedBy(2);
			await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value:repayAmount});
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);
			let reserveAfter = marketFeaturesAfter.promotionReserveScaled;	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(marketInterestBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(marketInterestBefore.supplyRate).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);

			assert.equal(adminShare.toString(), x.toString());
		})

		it('RepayBorrow if one month passed after pause',async () =>{
			await Holdefi.pause(5, {from: owner});
			await time.increase(time.duration.days(30));
			
			await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value: decimal18.multipliedBy(5)});
			let getAccountBorrow = await Holdefi.getAccountBorrow(user5, constants.ZERO_ADDRESS, SampleToken1.address);
			assert.equal(getAccountBorrow.balance.toString(), 0, 'Balance decreased');
		})

		it('Fail if repayBorrow was paused and call repayBorrow before one month',async () =>{
			await Holdefi.pause(5, {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value: decimal18.multipliedBy(0.5)}),
				"Pausable: paused");
		})

		it('Fail if user not borrow at all',async () =>{
			await expectRevert(Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user6, value: decimal18.multipliedBy(0.5)}),
				'Total balance should not be zero');
		})
	})
})

