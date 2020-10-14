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
    initializeContracts,
    assignToken,
    scenario,
    scenario2
} = require ("../Utils.js");

contract("Supply", function([owner,user1,user2,user3,user4,user5,user6,user7]){

	describe("Supply ERC20", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			userBalanceBefore = await SampleToken1.balanceOf(user5);
		})
		
		it('Token supplied',async () => {
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				await convertToDecimals (SampleToken1, 20),
				referalCode,
				{from:user5}
			);

			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			assert.equal(getAccountSupply.balance.toString(), (await convertToDecimals (SampleToken1, 20)).toString(), 'Balance increased');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalSupply.toString() , (await convertToDecimals (SampleToken1, 20)).plus(getMarketBefore.totalSupply).toString(), 'Total supply increased');
			
			let allowance = await SampleToken1.allowance(user5, Holdefi.address);
			assert.equal(allowance.toString(), (await convertToDecimals (SampleToken1, 780)).toString(), 'Allowance decreased');
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(await convertToDecimals (SampleToken1, 20)).toString(), 'User Balance increased correctly');		
		})

		it('Token supplied for someone else',async () => {
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
				referalCode,
				{from:user5}
			);

			let getUser6AccountSupply = await Holdefi.getAccountSupply(user6,SampleToken1.address);
			assert.equal(getUser6AccountSupply.balance.toString(), (await convertToDecimals (SampleToken1, 20)).toString(), 'User balance increased');
			let getUser5AccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			assert.equal(getUser5AccountSupply.balance.toString(), 0, 'Sender balance not changed');

			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
			assert.equal(getMarketAfter.totalSupply.toString() , (await convertToDecimals (SampleToken1, 20)).plus(getMarketBefore.totalSupply).toString(), 'Total supply increased');
			
			let user6AllowanceAfter = await SampleToken1.allowance(user6, Holdefi.address);
			assert.equal(user6AllowanceAfter.toString(), user6AllowanceBefore.toString(), 'User erc20 allowance not changed');
			let user5AllowanceAfter = await SampleToken1.allowance(user5, Holdefi.address);
			assert.equal(bigNumber(user5AllowanceAfter).plus(amount).toString(), user5AllowanceBefore.toString(), 'Sender erc20 decreased');
	
			let user5BalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(user5BalanceAfter.toString(), bigNumber(user5BalanceBefore).minus(amount).toString(), 'Sender erc20 balance increased correctly');		
			let user6BalanceAfter = await SampleToken1.balanceOf(user6);
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).toString(), 'User erc20 balance not changed');		
		})		

		it('Supplier should get interest',async () => {
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				await convertToDecimals (SampleToken1, 20),
				referalCode,
				{from:user5}
			);

			let time1 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			let time2 = await time.latest();
			
			let marketInterest = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
			
			let x = bigNumber(time2-time1).multipliedBy(marketInterest.supplyRate).multipliedBy(getAccountSupply.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupply.interest.toString() , x.toString());
		})

		it('Supplier should get interest after second supply',async () => {
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				await convertToDecimals (SampleToken1, 20),
				referalCode,
				{from:user5}
			);

			let time1 = await time.latest();
			let getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, SampleToken1.address);

			let marketInterestBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			await time.increase(time.duration.days(5));
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				await convertToDecimals (SampleToken1, 20),
				referalCode,
				{from:user5}
			);

			let time2 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, SampleToken1.address);
			let time3 = await time.latest();

			let marketInterestAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			let x1 = bigNumber(time2-time1).multipliedBy(marketInterestBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let x2 = bigNumber(time3-time2).multipliedBy(marketInterestAfter.supplyRate).multipliedBy(getAccountSupplyAfter.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.plus(x2).toString());
		})

		it('Supply rate should be decreased after supply',async () => {
			let marketInterestBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				await convertToDecimals (SampleToken1, 20),
				referalCode,
				{from:user5}
			);
			let marketInterestAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			assert.isBelow(marketInterestAfter.supplyRate.toNumber(), marketInterestBefore.supplyRate.toNumber());
		})
		
		it('Admin Reserve increased corrcetly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = (await Holdefi.getPromotionReserve(SampleToken1.address)).promotionReserveScaled;
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(SampleToken1.address);
			let marketInterestBefore = await HoldefiSettings.getInterests(SampleToken1.address);
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				await convertToDecimals (SampleToken1, 20),
				referalCode,
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

		it('Promotion rate should be set to zero if promotionDebt > promotionReserve and call supply function',async () => {
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
				referalCode,
				{from:user5}
			);
			let time2 = await time.latest();
			let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address)
			let getMarketSettingsAfter = await HoldefiSettings.marketAssets(SampleToken1.address)
			let marketSupplyInterestAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

			let debtScaled = bigNumber(time2-time1).multipliedBy(getMarketBefore.totalSupply).multipliedBy(ratesDecimal.multipliedBy(0.1));

			assert.equal(marketSupplyInterestAfter.supplyRate.toString(), bigNumber(marketSupplyInterestBefore.supplyRate).minus(getMarketSettingsBefore.promotionRate).toString(), 'Supply rate decreased')
			assert.equal(getMarketSettingsAfter.promotionRate.toString(), 0, 'Promotion rate should be zero after promotion reserve spent')
			assert.equal(debtScaled.toString() , getMarketAfter.promotionDebtScaled.toString(), 'Promotion debt increase correctly');
		})

		it('Supply if one month passed after pause',async () =>{
			await Holdefi.pause("supply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.methods['supply(address,uint256,uint16)'](
				SampleToken1.address,
				await convertToDecimals (SampleToken1, 20),
				referalCode,
				{from:user5}
			);
			let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
			assert.equal(getAccountSupply.balance.toString(), (await convertToDecimals (SampleToken1, 20)).toString(), 'Balance increased');

		})

		it('Fail if supply was paused and call supply before one month',async () =>{
			await Holdefi.pause("supply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(
				Holdefi.methods['supply(address,uint256,uint16)'](
					SampleToken1.address,
					await convertToDecimals (SampleToken1, 20),
					referalCode,
					{from:user5}
				),
				"Operation is paused");
		})

		it('Fail if market was not active',async () =>{
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await expectRevert(
				Holdefi.methods['supply(address,uint256,uint16)'](
					SampleToken1.address,
					await convertToDecimals (SampleToken1, 20),
					referalCode,
					{from:user5}
				),
				"Market is not active");
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
					referalCode,
					{from:user5}
				),
				"Market is not active");
		})


		it('Fail if supplyAsset = eth',async () =>{
			await expectRevert(
				Holdefi.methods['supply(address,uint256,uint16)'](
					ethAddress,
					await convertToDecimals (SampleToken1, 20),
					referalCode,
					{from:user5}
				),
				"Asset should not be ETH address");
		})

		it('Fail if balance < supply amount',async () =>{
			await SampleToken1.mint(user6, await convertToDecimals (SampleToken1, 40), {from: owner});
			await SampleToken1.approve(Holdefi.address, constants.MAX_UINT256, {from: user6});

			await expectRevert(
				Holdefi.methods['supply(address,uint256,uint16)'](
					SampleToken1.address,
					await convertToDecimals (SampleToken1, 45),
					referalCode,
					{from:user6}
				),
				'revert');	
		})

		it('Fail if allowance < supply amount',async () =>{
			await SampleToken1.mint(user6, await convertToDecimals (SampleToken1, 40), {from: owner});
			await SampleToken1.approve(Holdefi.address, await convertToDecimals (SampleToken1, 30), {from: user6});

			await expectRevert(
				Holdefi.methods['supply(address,uint256,uint16)'](
					SampleToken1.address,
					await convertToDecimals (SampleToken1, 35),
					referalCode,
					{from:user6}
				),
				'revert');		
		})
	})
	
	describe("Supply ETH", async() => {
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			userBalanceBefore = await web3.eth.getBalance(user5);
			userBalanceBefore2 = await web3.eth.getBalance(user6);
		})

		it('ETH supplied',async () =>{
			let getMarketBefore = await Holdefi.marketAssets(ethAddress);

			let tx = await Holdefi.methods['supply(uint16)'](
				referalCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			let getAccountSupply = await Holdefi.getAccountSupply(user5,ethAddress);
			assert.equal(getAccountSupply.balance.toString() ,decimal18.multipliedBy(2).toString(), 'Balance increased');

			let getMarketAfter = await Holdefi.marketAssets(ethAddress);
			assert.equal(getMarketAfter.totalSupply.toString() , decimal18.multipliedBy(2).plus(getMarketBefore.totalSupply).toString(), 'Total supply increased');
		
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(decimal18.multipliedBy(2)).toString(), 'User Balance increased correctly');
		})

		it('ETH supplied for someone else',async () =>{
			let amount = decimal18.multipliedBy(2);
			let getMarketBefore = await Holdefi.marketAssets(ethAddress);
			let	user6BalanceBefore = await SampleToken1.balanceOf(user6);

			let tx = await Holdefi.methods['supplyBehalf(address,uint16)'](
				user6,
				referalCode,
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
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(amount).toString(), 'Sender ETH balance decreased correctly');
			let userBalanceAfter2 = await web3.eth.getBalance(user6);
			assert.equal(userBalanceAfter2.toString(), bigNumber(userBalanceBefore2).toString(), 'User ETH balance not changed');
		})

		it('Supplier should get interest',async () => {
			await Holdefi.methods['supply(uint16)'](
				referalCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			let time1 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupply = await Holdefi.getAccountSupply(user5,ethAddress);
			let time2 = await time.latest();
			
			let marketInterest = await Holdefi.getCurrentSupplyIndex(ethAddress);
			
			let x = bigNumber(time2-time1).multipliedBy(marketInterest.supplyRate).multipliedBy(getAccountSupply.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupply.interest.toString() , x.toString());
		})

		it('Supplier should get interest after second supply',async () => {
			await Holdefi.methods['supply(uint16)'](
				referalCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			let time1 = await time.latest();
			let getAccountSupplyBefore = await Holdefi.getAccountSupply(user5, ethAddress);

			let marketInterestBefore = await Holdefi.getCurrentSupplyIndex(ethAddress);

			await time.increase(time.duration.days(5));
			await Holdefi.methods['supply(uint16)'](
				referalCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			let time2 = await time.latest();
			
			await time.increase(time.duration.days(5));
			let getAccountSupplyAfter = await Holdefi.getAccountSupply(user5, ethAddress);
			let time3 = await time.latest();

			let marketInterestAfter = await Holdefi.getCurrentSupplyIndex(ethAddress);

			let x1 = bigNumber(time2-time1).multipliedBy(marketInterestBefore.supplyRate).multipliedBy(getAccountSupplyBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			let x2 = bigNumber(time3-time2).multipliedBy(marketInterestAfter.supplyRate).multipliedBy(getAccountSupplyAfter.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
			
			assert.equal(getAccountSupplyAfter.interest.toString(), x1.plus(x2).toString());
		})

		it('Supply rate should decrease after supply',async () => {
			let marketInterestBefore = await Holdefi.getCurrentSupplyIndex(ethAddress);
			await Holdefi.methods['supply(uint16)'](
				referalCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			let marketInterestAfter = await Holdefi.getCurrentSupplyIndex(ethAddress);

			assert.isBelow(marketInterestAfter.supplyRate.toNumber(), marketInterestBefore.supplyRate.toNumber());
		})

		it('Admin Reserve increased corretly',async () => {
			await time.increase(time.duration.days(1));
			let reserveBefore = (await Holdefi.getPromotionReserve(ethAddress)).promotionReserveScaled;
			let time1 = await time.latest();
	
			await time.increase(time.duration.days(5));
			let marketFeaturesBefore = await Holdefi.marketAssets(ethAddress);
			let marketInterestBefore = await HoldefiSettings.getInterests(ethAddress);
			await Holdefi.methods['supply(uint16)'](
				referalCode,
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

		it('Supply if one month passed after pause',async () =>{
			await Holdefi.pause("supply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.methods['supply(uint16)'](
				referalCode,
				{from:user5, value: decimal18.multipliedBy(2)}
			);
			let getAccountSupply = await Holdefi.getAccountSupply(user5,ethAddress);
			assert.equal(getAccountSupply.balance.toString(), decimal18.multipliedBy(2).toString(), 'Balance increased');

		})

		it('Fail if supply was paused and call supply before one month',async () =>{
			await Holdefi.pause("supply", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(
				Holdefi.methods['supply(uint16)'](
					referalCode,
					{from:user5, value: decimal18.multipliedBy(2)}
				),
				"Operation is paused");
		})		

		it('Fail if market was not active',async () =>{
			await HoldefiSettings.deactivateMarket(ethAddress, {from:owner});
			await expectRevert(
				Holdefi.methods['supply(uint16)'](
					referalCode,
					{from:user5, value: decimal18.multipliedBy(2)}
				),
				"Market is not active");
		})

		it('Fail if balance < supply amount',async () =>{
			await expectRevert(
				Holdefi.methods['supply(uint16)'](
					referalCode,
					{from:user5, value: decimal18.multipliedBy(200000)}
				),
				"sender doesn't have enough funds to send tx");	
		})
	 })
})