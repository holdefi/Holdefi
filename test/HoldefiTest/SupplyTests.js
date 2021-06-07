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
    initializeContracts,
    assignToken,
    scenario,
    scenario2
} = require ("../Utils.js");

contract("Supply", function([owner,user1,user2,user3,user4,user5,user6,user7]){

	describe("ERC20 Supply", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			userBalanceBefore = await SampleToken1.balanceOf(user5);
		})
		
		it('The supply function should work as expected',async () => {
			let amount = await convertToDecimals (SampleToken1, 20);
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
			let contractBalanceBefore = await SampleToken1.balanceOf(Holdefi.address);

			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				amount,
				referralCode,
				{from:user5}
			);

			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			assert.equal(getAccountSupply.balance.toString(), amount.toString(), 'User supply balance increased');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalSupply.toString() , amount.plus(getMarketBefore.totalSupply).toString(), 'Total supply increased');
			
			let allowance = await SampleToken1.allowance(user5, Holdefi.address);
			assert.equal(allowance.toString(), (await convertToDecimals (SampleToken1, 780)).toString(), 'Use ERC20 allowance decreased');
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(amount).toString(), 'User wallet balance decreased');

			let contractBalanceAfter = await SampleToken1.balanceOf(Holdefi.address);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(amount).toString(), 'Holdefi contract balance increased');
		})	

		it('The supplyBehalf function should work as expected',async () => {
			let amount = await convertToDecimals(SampleToken1, 20);
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
			let	user5BalanceBefore = await SampleToken1.balanceOf(user5);
			let	user6BalanceBefore = await SampleToken1.balanceOf(user6);

			let user5AllowanceBefore = await SampleToken1.allowance(user5, Holdefi.address);
			let user6AllowanceBefore = await SampleToken1.allowance(user6, Holdefi.address);

			await Holdefi.methods['supplyBehalf(address,address,uint256,uint16)'](
				user6,
				SampleToken1.address,
				amount,
				referralCode,
				{from:user5}
			);

			let getUser6AccountSupply = await Holdefi.getAccountSupply(user6,SampleToken1.address);
			assert.equal(getUser6AccountSupply.balance.toString(), amount.toString(), 'User supply balance increased');
			let getUser5AccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			assert.equal(getUser5AccountSupply.balance.toString(), 0, 'Sender supply balance not changed');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalSupply.toString() , amount.plus(getMarketBefore.totalSupply).toString(), 'Total supply increased');
			
			let user6AllowanceAfter = await SampleToken1.allowance(user6, Holdefi.address);
			assert.equal(user6AllowanceAfter.toString(), user6AllowanceBefore.toString(), 'User ERC20 allowance not changed');
			let user5AllowanceAfter = await SampleToken1.allowance(user5, Holdefi.address);
			assert.equal(bigNumber(user5AllowanceAfter).plus(amount).toString(), user5AllowanceBefore.toString(), 'Sender ERC20 allowance decreased');
	
			let user5BalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(user5BalanceAfter.toString(), bigNumber(user5BalanceBefore).minus(amount).toString(), 'Sender wallet balance increased');		
			let user6BalanceAfter = await SampleToken1.balanceOf(user6);
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).toString(), 'User wallet balance not changed');		
		})		

		it('Supplier interest should be increased over time',async () => {
			let amount = await convertToDecimals (SampleToken1, 20);
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				amount,
				referralCode,
				{from:user5}
			);

			let time1 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			let time2 = await time.latest();
			
			let marketInterest = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
			
			let x = bigNumber(time2-time1).multipliedBy(marketInterest.supplyRate).multipliedBy(amount)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupply.interest.toString() , x.toString());
		})

		it('Supplier interest should be calculated correctly after second supply',async () => {
			let amount1 = await convertToDecimals (SampleToken1, 20);
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				amount1,
				referralCode,
				{from:user5}
			);

			let time1 = await time.latest();
			let getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, SampleToken1.address);

			let marketInterestBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			let amount2 = await convertToDecimals (SampleToken1, 20);
			await time.increase(time.duration.days(5));
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				amount2,
				referralCode,
				{from:user5}
			);

			let time2 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let time3 = await time.latest();

			let marketInterestAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(marketInterestBefore.supplyRate).multipliedBy(amount1)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let x2 = bigNumber(time3-time2).multipliedBy(marketInterestAfter.supplyRate).multipliedBy(amount1.plus(amount2))
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.plus(x2).toString());
		})

		it('The supplyRate should be decreased after calling supply function',async () => {
			let marketInterestBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				await convertToDecimals (SampleToken1, 20),
				referralCode,
				{from:user5}
			);
			let marketInterestAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			assert.isBelow(marketInterestAfter.supplyRate.toNumber(), marketInterestBefore.supplyRate.toNumber());
		})
		
		it('The promotionReserve should be increased correctly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = await Holdefi.getPromotionReserve(SampleToken1.address);
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			let marketInterestBefore = await HoldefiSettings.getInterests(SampleToken1.address);
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				await convertToDecimals (SampleToken1, 20),
				referralCode,
				{from:user5}
			);
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(SampleToken1.address);
			let reserveAfter = marketFeaturesAfter.promotionReserveScaled;	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(marketInterestBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(marketInterestBefore.supplyRateBase).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);
			assert.equal(adminShare.toString(), x.toString());
		})

		it('Promotion rate should be set to zero after calling supply function if promotionDebt > promotionReserve',async () => {
			await assignToken(owner, owner, SampleToken1);

			await Holdefi.depositPromotionReserve(SampleToken1.address, await convertToDecimals (SampleToken1, 1));
			await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
			let time1 = await time.latest();
			let getMarketSettingsBefore = await HoldefiSettings.marketAssets(SampleToken1.address);
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address)
			let marketSupplyInterestBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			await time.increase(time.duration.days(200));
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				0,
				referralCode,
				{from:user5}
			);
			let time2 = await time.latest();
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address)
			let getMarketSettingsAfter = await HoldefiSettings.marketAssets(SampleToken1.address)
			let marketSupplyInterestAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			let debtScaled = bigNumber(time2-time1).multipliedBy(getMarketBefore.totalSupply).multipliedBy(ratesDecimal.multipliedBy(0.1));

			assert.equal(marketSupplyInterestAfter.supplyRate.toString(), bigNumber(marketSupplyInterestBefore.supplyRate).minus(getMarketSettingsBefore.promotionRate).toString(),
				'Supply rate decreased')
			assert.equal(getMarketSettingsAfter.promotionRate.toString(), 0, 'Promotion rate = 0')
			assert.equal(debtScaled.toString() , getMarketAfter.promotionDebtScaled.toString(), 'Promotion debt increased');
		})

		it('The supply function should not be reverted if calling it a month after pausing',async () =>{
			await Holdefi.pause("supply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				await convertToDecimals (SampleToken1, 20),
				referralCode,
				{from:user5}
			);
			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			assert.equal(getAccountSupply.balance.toString(), (await convertToDecimals (SampleToken1, 20)).toString(), 'User supply balance increased');
		})

		it('Fail if supply function is paused',async () =>{
			await Holdefi.pause("supply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(
				Holdefi.methods['supply(address,uint256,uint16)'](
					SampleToken1.address,
					await convertToDecimals (SampleToken1, 20),
					referralCode,
					{from:user5}
				),
				"POE02");
		})

		it('Fail if market is not active',async () =>{
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await expectRevert(
				Holdefi.methods['supply(address,uint256,uint16)'](
					SampleToken1.address,
					await convertToDecimals (SampleToken1, 20),
					referralCode,
					{from:user5}
				),
				"E02");
		})

		it('Fail if market is removed',async () =>{
			let repayAmount = await convertToDecimals(SampleToken1, 50);
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, repayAmount, {from:user3});
			await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user4, value: decimal18.multipliedBy(20)});
			await HoldefiSettings.removeMarket(SampleToken1.address,{from:owner});
			await expectRevert(
				Holdefi.methods['supply(address,uint256,uint16)'](
					SampleToken1.address,
					await convertToDecimals (SampleToken1, 20),
					referralCode,
					{from:user5}
				),
				"E02");
		})

		it('Fail if market is ETH',async () =>{
			await expectRevert(
				Holdefi.methods['supply(address,uint256,uint16)'](
					ethAddress,
					await convertToDecimals (SampleToken1, 20),
					referralCode,
					{from:user5}
				),
				"E01");
		})

		it('Fail if supply amount is more than user balance',async () =>{
			await SampleToken1.mint(user6, await convertToDecimals (SampleToken1, 40), {from: owner});
			await SampleToken1.approve(Holdefi.address, constants.MAX_UINT256, {from: user6});

			await expectRevert(
				Holdefi.methods['supply(address,uint256,uint16)'](
					SampleToken1.address,
					await convertToDecimals (SampleToken1, 45),
					referralCode,
					{from:user6}
				),
				'revert');	
		})

		it('Fail if supply amount is more than holdefi allowance on specified token',async () =>{
			await SampleToken1.mint(user6, await convertToDecimals (SampleToken1, 40), {from: owner});
			await SampleToken1.approve(Holdefi.address, await convertToDecimals (SampleToken1, 30), {from: user6});

			await expectRevert(
				Holdefi.methods['supply(address,uint256,uint16)'](
					SampleToken1.address,
					await convertToDecimals (SampleToken1, 35),
					referralCode,
					{from:user6}
				),
				'revert');		
		})
	})

	describe("Deflating ERC20 Supply ", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken5);
			userBalanceBefore = await SampleToken5.balanceOf(user5);
		})
		
		it('The supply function should work as expected',async () => {
			let amount = await convertToDecimals (SampleToken5, 20);
			let receivedAmount = amount.minus(amount.dividedToIntegerBy(100));
			let getMarketBefore = await Holdefi.marketAssets(SampleToken5.address);
			let contractBalanceBefore = await SampleToken5.balanceOf(Holdefi.address);

			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken5.address,
				amount,
				referralCode,
				{from:user5}
			);

			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken5.address);
			assert.equal(getAccountSupply.balance.toString(), receivedAmount.toString(), 'User supplu balance increased');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken5.address);
			assert.equal(getMarketAfter.totalSupply.toString(), receivedAmount.plus(getMarketBefore.totalSupply).toString(), 'Total supply increased');
			
			let allowance = await SampleToken5.allowance(user5, Holdefi.address);
			assert.equal(allowance.toString(), (await convertToDecimals (SampleToken5, 780)).toString(), 'User ERC20 allowance decreased');
		
			let userBalanceAfter = await SampleToken5.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(amount).toString(), 'User wallet balance decreased');	

			let contractBalanceAfter = await SampleToken5.balanceOf(Holdefi.address);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(receivedAmount).toString(),
				'Holdefi contract balance increased');	
		})	

		it('The supplyBehalf function should work as expected',async () => {
			let amount = await convertToDecimals(SampleToken5, 20);
			let receivedAmount = amount.minus(amount.dividedToIntegerBy(100));
			let getMarketBefore = await Holdefi.marketAssets(SampleToken5.address);
			let	user5BalanceBefore = await SampleToken5.balanceOf(user5);
			let	user6BalanceBefore = await SampleToken5.balanceOf(user6);

			let user5AllowanceBefore = await SampleToken5.allowance(user5, Holdefi.address);
			let user6AllowanceBefore = await SampleToken5.allowance(user6, Holdefi.address);

			await Holdefi.methods['supplyBehalf(address,address,uint256,uint16)'](
				user6,
				SampleToken5.address,
				amount,
				referralCode,
				{from:user5}
			);

			let getUser6AccountSupply = await Holdefi.getAccountSupply(user6,SampleToken5.address);
			assert.equal(getUser6AccountSupply.balance.toString(), receivedAmount.toString(), 'User supply balance increased');
			let getUser5AccountSupply = await Holdefi.getAccountSupply(user5,SampleToken5.address);
			assert.equal(getUser5AccountSupply.balance.toString(), 0, 'Sender supply balance not changed');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken5.address);
			assert.equal(getMarketAfter.totalSupply.toString() , receivedAmount.plus(getMarketBefore.totalSupply).toString(), 'Total supply increased');
			
			let user6AllowanceAfter = await SampleToken5.allowance(user6, Holdefi.address);
			assert.equal(user6AllowanceAfter.toString(), user6AllowanceBefore.toString(), 'User ERC20 allowance not changed');
			let user5AllowanceAfter = await SampleToken5.allowance(user5, Holdefi.address);
			assert.equal(bigNumber(user5AllowanceAfter).plus(amount).toString(), user5AllowanceBefore.toString(), 'Sender ERC20 allowance decreased');
	
			let user5BalanceAfter = await SampleToken5.balanceOf(user5);
			assert.equal(user5BalanceAfter.toString(), bigNumber(user5BalanceBefore).minus(amount).toString(), 'Sender wallet balance increased');		
			let user6BalanceAfter = await SampleToken5.balanceOf(user6);
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).toString(), 'User wallet balance not changed');		
		})		

		it('Supplier interest should be increased over time',async () => {
			let amount = await convertToDecimals (SampleToken5, 20);
			let receivedAmount = amount.minus(amount.dividedToIntegerBy(100));
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken5.address,
				amount,
				referralCode,
				{from:user5}
			);

			let time1 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken5.address);
			let time2 = await time.latest();
			
			let marketInterest = await Holdefi.getCurrentSupplyIndex(SampleToken5.address);
			
			let x = bigNumber(time2-time1).multipliedBy(marketInterest.supplyRate).multipliedBy(receivedAmount)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupply.interest.toString() , x.toString());
		})

		it('Supplier interest should be calculated correctly after second supply',async () => {
			let amount1 = await convertToDecimals (SampleToken5, 20);
			let receivedAmount1 = amount1.minus(amount1.dividedToIntegerBy(100));
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken5.address,
				amount1,
				referralCode,
				{from:user5}
			);

			let time1 = await time.latest();
			let getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, SampleToken5.address);

			let marketInterestBefore = await Holdefi.getCurrentSupplyIndex(SampleToken5.address);
			let amount2 = await convertToDecimals (SampleToken5, 10);
			let receivedAmount2 = amount2.minus(amount2.dividedToIntegerBy(100));

			await time.increase(time.duration.days(5));
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken5.address,
				amount2,
				referralCode,
				{from:user5}
			);

			let time2 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken5.address);
			let time3 = await time.latest();

			let marketInterestAfter = await Holdefi.getCurrentSupplyIndex(SampleToken5.address);

			let x1 = bigNumber(time2-time1).multipliedBy(marketInterestBefore.supplyRate).multipliedBy(receivedAmount1)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let x2 = bigNumber(time3-time2).multipliedBy(marketInterestAfter.supplyRate).multipliedBy(receivedAmount2)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.plus(x2).toString());
		})
	})
	
	describe("ETH Supply", async() => {
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			userBalanceBefore = await web3.eth.getBalance(user5);
		})

		it('The supply function should work as expected',async () =>{
			let amount = decimal18.multipliedBy(2);
			let contractBalanceBefore = await balance.current(Holdefi.address);
			let getMarketBefore = await Holdefi.marketAssets(ethAddress);

			let tx = await Holdefi.methods['supply(uint16)'](
				referralCode,
				{from:user5, value: amount}
			);
			let getAccountSupply = await Holdefi.getAccountSupply(user5,ethAddress);
			assert.equal(getAccountSupply.balance.toString() ,decimal18.multipliedBy(2).toString(), 'User supply balance increased');

			let getMarketAfter = await Holdefi.marketAssets(ethAddress);
			assert.equal(getMarketAfter.totalSupply.toString() , decimal18.multipliedBy(2).plus(getMarketBefore.totalSupply).toString(),
				'Total supply increased');
		
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(decimal18.multipliedBy(2)).toString(),
				'User wallet balance decreased');

			let contractBalanceAfter = await balance.current(Holdefi.address);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(amount).toString(), 'Holdefi contract balance increased');
		})

		it('The supplyBehalf function should work as expected',async () =>{
			let userBalanceBefore2 = await web3.eth.getBalance(user6);
			let amount = decimal18.multipliedBy(2);
			let getMarketBefore = await Holdefi.marketAssets(ethAddress);
			let	user6BalanceBefore = await SampleToken1.balanceOf(user6);

			let tx = await Holdefi.methods['supplyBehalf(address,uint16)'](
				user6,
				referralCode,
				{from:user5, value: amount}
			);

			let getUser5AccountSupply = await Holdefi.getAccountSupply(user5, ethAddress);
			assert.equal(getUser5AccountSupply.balance.toString(), 0, 'Sender supply balance not changed');
			let getUser6AccountSupply = await Holdefi.getAccountSupply(user6,ethAddress);
			assert.equal(getUser6AccountSupply.balance.toString(), amount.toString(), 'User supply balance increased');

			let getMarketAfter = await Holdefi.marketAssets(ethAddress);
			assert.equal(getMarketAfter.totalSupply.toString(), amount.plus(getMarketBefore.totalSupply).toString(), 'Total supply increased');
		
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(amount).toString(), 'Sender wallet balance decreased');
			let userBalanceAfter2 = await web3.eth.getBalance(user6);
			assert.equal(userBalanceAfter2.toString(), bigNumber(userBalanceBefore2).toString(), 'User wallet balance not changed');
		})

		it('Supplier interest should be increased over time',async () => {
			await Holdefi.methods['supply(uint16)'](
				referralCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			let time1 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupply = await Holdefi.getAccountSupply(user5,ethAddress);
			let time2 = await time.latest();
			
			let marketInterest = await Holdefi.getCurrentSupplyIndex(ethAddress);
			
			let x = bigNumber(time2-time1).multipliedBy(marketInterest.supplyRate).multipliedBy(getAccountSupply.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupply.interest.toString() , x.toString());
		})

		it('Supplier interest should be calculated correctly after second supply',async () => {
			await Holdefi.methods['supply(uint16)'](
				referralCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			let time1 = await time.latest();
			let getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, ethAddress);

			let marketInterestBefore = await Holdefi.getCurrentSupplyIndex(ethAddress);

			await time.increase(time.duration.days(5));
			await Holdefi.methods['supply(uint16)'](
				referralCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			let time2 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);
			let time3 = await time.latest();

			let marketInterestAfter = await Holdefi.getCurrentSupplyIndex(ethAddress);

			let x1 = bigNumber(time2-time1).multipliedBy(marketInterestBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let x2 = bigNumber(time3-time2).multipliedBy(marketInterestAfter.supplyRate).multipliedBy(getAccountSupplyAfter.balance)
				.dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.plus(x2).toString());
		})

		it('The supplyRate should be decreased after calling supply function',async () => {
			let marketInterestBefore = await Holdefi.getCurrentSupplyIndex(ethAddress);
			await Holdefi.methods['supply(uint16)'](
				referralCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			let marketInterestAfter = await Holdefi.getCurrentSupplyIndex(ethAddress);

			assert.isBelow(marketInterestAfter.supplyRate.toNumber(), marketInterestBefore.supplyRate.toNumber());
		})

		it('The promotionReserve should be increased correctly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = await Holdefi.getPromotionReserve(ethAddress);
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(ethAddress);
			let marketInterestBefore = await HoldefiSettings.getInterests(ethAddress);
			await Holdefi.methods['supply(uint16)'](
				referralCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			let time2 = await time.latest();
			let marketFeaturesAfter = await Holdefi.marketAssets(ethAddress);
			let reserveAfter = marketFeaturesAfter.promotionReserveScaled;	

			let x = bigNumber(reserveAfter).minus(reserveBefore);

			let allBorrowInterest = bigNumber(marketInterestBefore.borrowRate).multipliedBy(marketFeaturesBefore.totalBorrow);
			let allSupplyInterest = bigNumber(marketInterestBefore.supplyRateBase).multipliedBy(marketFeaturesBefore.totalSupply);
			let adminShare = allBorrowInterest.minus(allSupplyInterest).multipliedBy(time2-time1);

			assert.equal(adminShare.toString(), x.toString());
		})

		it('Supply function should not be reverted if calling supply function a month after pausing supply function',async () =>{
			await Holdefi.pause("supply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.methods['supply(uint16)'](
				referralCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			let getAccountSupply = await Holdefi.getAccountSupply(user5,ethAddress);
			assert.equal(getAccountSupply.balance.toString(), decimal18.multipliedBy(2).toString(), 'User supply balance increased');

		})

		it('Fail if supply function is paused',async () =>{
			await Holdefi.pause("supply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(
				Holdefi.methods['supply(uint16)'](
					referralCode,
					{from:user5, value: decimal18.multipliedBy(2)}
				),
				"POE02");
		})		

		it('Fail if market is not active',async () =>{
			await HoldefiSettings.deactivateMarket(ethAddress, {from:owner});
			await expectRevert(
				Holdefi.methods['supply(uint16)'](
					referralCode,
					{from:user5, value: decimal18.multipliedBy(2)}
				),
				"E02");
		})

		it('Fail if supply amount is more than user balance',async () =>{
			await expectRevert(
				Holdefi.methods['supply(uint16)'](
					referralCode,
					{from:user5, value: decimal18.multipliedBy(200000)}
				),
				"sender doesn't have enough funds to send tx");	
		})
	 })
})