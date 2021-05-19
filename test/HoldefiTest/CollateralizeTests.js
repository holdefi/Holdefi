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
    scenario
} = require ("../Utils.js");

contract("Collateralize", function([owner,user1,user2,user3,user4,user5,user6]){
	
	describe("ERC20 Collateralize", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			userBalanceBefore = await SampleToken1.balanceOf(user5);

			HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
		})

		it('The collateralize function should work as expected',async () =>{	
			let amount = await convertToDecimals(SampleToken1, 20);
			let contractBalanceBefore = await SampleToken1.balanceOf(HoldefiCollateralsAddress);
			let getCollateralBefore = await Holdefi.collateralAssets(SampleToken1.address);	
			await Holdefi.methods['collateralize(address,uint256)'](
				SampleToken1.address,
				amount,
				{from:user5}
			);
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.equal(getAccountCollateral.balance.toString() ,amount.toString(), 'User collateral balance increased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralAfter.totalCollateral.toString(), amount.plus(getCollateralBefore.totalCollateral).toString(),
				'Total collateral increased');

			let allowance = await SampleToken1.allowance(user5, Holdefi.address);
			assert.equal(allowance.toString(), (await convertToDecimals(SampleToken1, 780)).toString(), 'Usr ERC20 allowance decreased');
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(amount).toString(), 'User wallet balance decreased');
		
			let contractBalanceAfter = await SampleToken1.balanceOf(HoldefiCollateralsAddress);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(amount).toString(),
				'HoldefiCollaterals contract balance increased');	
		})

		it('The collateralizeBehalf function should work as expected',async () => {
			let amount = await convertToDecimals(SampleToken1, 20);
			let user6BalanceBefore = await SampleToken1.balanceOf(user6);
			let getCollateralBefore = await Holdefi.collateralAssets(SampleToken1.address);

			let user5AllowanceBefore = await SampleToken1.allowance(user5, Holdefi.address);
			let user6AllowanceBefore = await SampleToken1.allowance(user6, Holdefi.address);

			await Holdefi.methods['collateralizeBehalf(address,address,uint256)'](
				user6,
				SampleToken1.address,
				amount,
				{from:user5}
			);

			let getAccountCollateral = await Holdefi.getAccountCollateral(user6, SampleToken1.address);
			assert.equal(getAccountCollateral.balance.toString() ,amount.toString(), 'User collateral balance increased');
			let getAccountCollateral2 = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.equal(getAccountCollateral2.balance.toString() ,0, 'Sender collateral balance not changed');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralAfter.totalCollateral.toString(), amount.plus(getCollateralBefore.totalCollateral).toString(),
				'Total collateral increased');

			let user5AllowanceAfter = await SampleToken1.allowance(user5, Holdefi.address);
			assert.equal(bigNumber(user5AllowanceAfter).plus(amount).toString(), user5AllowanceBefore.toString(), 'Sender ERC20 allowance decreased');
			let user6AllowanceAfter = await SampleToken1.allowance(user6, Holdefi.address);
			assert.equal(user6AllowanceAfter.toString(), user6AllowanceBefore.toString(), 'User ERC20 allowance not changed');
			
			let user6BalanceAfter = await SampleToken1.balanceOf(user6);
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).toString(), 'User wallet balance not changed');
			let user5BalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(user5BalanceAfter.toString(), bigNumber(userBalanceBefore).minus(amount).toString(), 'Sender wallet balance decreased');
		})

		it('The getAccountCollateral function not reverted if VTL rate is zero',async () =>{
			let getAccountCollateral = await Holdefi.getAccountCollateral(user3, SampleToken3.address);
			assert.equal(getAccountCollateral.balance.toString(), 0);
			assert.equal(getAccountCollateral.timeSinceLastActivity.toString(), 0);
			assert.equal(getAccountCollateral.borrowPowerValue.toString(), 0);
			assert.equal(getAccountCollateral.totalBorrowValue.toString(), 0);
			assert.isFalse(getAccountCollateral.underCollateral);
		})

		it('The collateralize function should not be reverted if calling it a month after pausing',async () =>{
			await Holdefi.pause("collateralize", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));

			let amount = await convertToDecimals(SampleToken1, 2);			
			await Holdefi.methods['collateralize(address,uint256)'](
				SampleToken1.address,
				amount, 
				{from:user5}
			);
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5,SampleToken1.address);
			assert.equal(getAccountCollateral.balance.toString(), amount.toString(), 'User collateral balance increased');
		})

		it('Fail if collateralize function is paused',async () =>{
			await Holdefi.pause("collateralize", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));

			let amount = await convertToDecimals(SampleToken1, 2);
			await expectRevert(
				Holdefi.methods['collateralize(address,uint256)'](
					SampleToken1.address,
					amount,
					{from:user5}
				),
				"POE02");
		})

		it('Fail if collateral is not active',async () =>{
			await HoldefiSettings.deactivateCollateral(SampleToken1.address,{from:owner});

			let amount = await convertToDecimals(SampleToken1, 20);
			await expectRevert(
				Holdefi.methods['collateralize(address,uint256)'](
					SampleToken1.address,
					amount,
					{from:user5}
				),
				"E03");
		})

		it('Fail if collateral is ETH',async () =>{
			await expectRevert(Holdefi.methods['collateralize(address,uint256)'](ethAddress, decimal18.multipliedBy(1), {from:user5}),
				"E01");
		})

		it('Fail if collateral amount is more than user balance',async () =>{
			await SampleToken1.mint(user6, await convertToDecimals(SampleToken1, 40), {from: owner});
			await SampleToken1.approve(Holdefi.address, constants.MAX_UINT256, {from: user6});

			await expectRevert(Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, await convertToDecimals(SampleToken1, 45), {from:user6}),
				"revert");		
		})

		it('Fail if colateral amount is more than holdefi allowance on specified token',async () =>{
			await SampleToken1.mint(user6, await convertToDecimals(SampleToken1, 40), {from: owner});
			await SampleToken1.approve(Holdefi.address, await convertToDecimals(SampleToken1, 30), {from: user6});

			await expectRevert(
				Holdefi.methods['collateralize(address,uint256)'](
					SampleToken1.address,
					await convertToDecimals(SampleToken1, 35),
					{from:user6}
				),
				"revert");	
		})
	})

	describe("Deflating ERC20 Collateralize ", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken5);
			userBalanceBefore = await SampleToken5.balanceOf(user5);

			HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
		})

		it('The collateralize function should work as expected',async () =>{	
			let amount = await convertToDecimals(SampleToken5, 20);
			let receivedAmount = amount.minus(amount.dividedToIntegerBy(100));
			let contractBalanceBefore = await SampleToken5.balanceOf(HoldefiCollateralsAddress);
			let getCollateralBefore = await Holdefi.collateralAssets(SampleToken5.address);	
			await Holdefi.methods['collateralize(address,uint256)'](
				SampleToken5.address,
				amount,
				{from:user5}
			);
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, SampleToken5.address);
			assert.equal(getAccountCollateral.balance.toString() ,receivedAmount.toString(), 'User collateral balance increased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken5.address);
			assert.equal(getCollateralAfter.totalCollateral.toString(), receivedAmount.plus(getCollateralBefore.totalCollateral).toString(),
				'Total collateral increased');

			let allowance = await SampleToken5.allowance(user5, Holdefi.address);
			assert.equal(allowance.toString(), (await convertToDecimals(SampleToken5, 780)).toString(), 'User erc20 allowance decreased');
		
			let userBalanceAfter = await SampleToken5.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(amount).toString(), 'User wallet balance decreased');
		
			let contractBalanceAfter = await SampleToken5.balanceOf(HoldefiCollateralsAddress);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(receivedAmount).toString(),
				'HoldefiCollaterals contract balance increased');
		})

		it('The collateralizeBehalf function should work as expected',async () => {
			let amount = await convertToDecimals(SampleToken5, 20);
			let receivedAmount = amount.minus(amount.dividedToIntegerBy(100));
			let user6BalanceBefore = await SampleToken5.balanceOf(user6);
			let getCollateralBefore = await Holdefi.collateralAssets(SampleToken5.address);

			let user5AllowanceBefore = await SampleToken5.allowance(user5, Holdefi.address);
			let user6AllowanceBefore = await SampleToken5.allowance(user6, Holdefi.address);

			await Holdefi.methods['collateralizeBehalf(address,address,uint256)'](
				user6,
				SampleToken5.address,
				amount,
				{from:user5}
			);

			let getAccountCollateral = await Holdefi.getAccountCollateral(user6, SampleToken5.address);
			assert.equal(getAccountCollateral.balance.toString() ,receivedAmount.toString(), 'User collateral balance increased');
			let getAccountCollateral2 = await Holdefi.getAccountCollateral(user5, SampleToken5.address);
			assert.equal(getAccountCollateral2.balance.toString() ,0, 'Sender collateral balance not changed');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken5.address);
			assert.equal(getCollateralAfter.totalCollateral.toString(), receivedAmount.plus(getCollateralBefore.totalCollateral).toString(),
				'Total collateral increased');

			let user5AllowanceAfter = await SampleToken5.allowance(user5, Holdefi.address);
			assert.equal(bigNumber(user5AllowanceAfter).plus(amount).toString(), user5AllowanceBefore.toString(), 'Sender ERC20 allowance decreased');
			let user6AllowanceAfter = await SampleToken5.allowance(user6, Holdefi.address);
			assert.equal(user6AllowanceAfter.toString(), user6AllowanceBefore.toString(), 'User ERC20 allowance not changed');
			
			let user6BalanceAfter = await SampleToken5.balanceOf(user6);
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).toString(), 'User wallet balance not changed');
			let user5BalanceAfter = await SampleToken5.balanceOf(user5);
			assert.equal(user5BalanceAfter.toString(), bigNumber(userBalanceBefore).minus(amount).toString(), 'Sender wallet balance decreased');
		})
	})

	describe("ETH Collateralize", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			userBalanceBefore = await web3.eth.getBalance(user5);

			HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();		
		})

		it('The collateralize function should work as expected',async () =>{
			let amount = decimal18.multipliedBy(2);
			let getCollateralBefore = await Holdefi.collateralAssets(ethAddress);	
			let contractBalanceBefore = await balance.current(HoldefiCollateralsAddress);
			let tx = await Holdefi.methods['collateralize()']({from:user5, value: amount});
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.equal(getAccountCollateral.balance.toString(), amount.toString(), 'User collateral balance increased');

			let getCollateralAfter = await Holdefi.collateralAssets(ethAddress);
			assert.equal(getCollateralAfter.totalCollateral.toString(), amount.plus(getCollateralBefore.totalCollateral).toString(),
				'Total collateral increased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(amount).toString(),
				'User wallet balance decreased');
		
			let contractBalanceAfter = await balance.current(HoldefiCollateralsAddress);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).plus(amount).toString(), 'HoldefiCollaterals contract balance increased');	
		})

		it('The collateralizeBehalf function should work as expected',async () =>{
			let user6BalanceBefore = await web3.eth.getBalance(user6);
			let getCollateralBefore = await Holdefi.collateralAssets(ethAddress);	

			let tx = await Holdefi.methods['collateralizeBehalf(address)'](user5, {from:user6, value: decimal18.multipliedBy(2)});
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.equal(getAccountCollateral.balance.toString(), decimal18.multipliedBy(2).toString(), 'User collateral balance increased');
			let getAccountCollateral2 = await Holdefi.getAccountCollateral(user6, ethAddress);
			assert.equal(getAccountCollateral2.balance.toString(), 0, 'Sender collateral balance not changed');

			let getCollateralAfter = await Holdefi.collateralAssets(ethAddress);
			assert.equal(getCollateralAfter.totalCollateral.toString(), decimal18.multipliedBy(2).plus(getCollateralBefore.totalCollateral).toString(),
				'Total collateral increased');
			
			let user6BalanceAfter = await web3.eth.getBalance(user6);
			let user5BalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(user5BalanceAfter.toString(), bigNumber(userBalanceBefore).toString(), 'User wallet balance not changed');
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).minus(txFee).minus(decimal18.multipliedBy(2)).toString(),
				'Sender wallet balance decreased');
		})

		it('The collateralize function should not be reverted if calling it a month after pausing',async () =>{
			await Holdefi.pause("collateralize", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(2)});
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5,ethAddress);
			assert.equal(getAccountCollateral.balance.toString(), decimal18.multipliedBy(2).toString(), 'Balance increased');

		})

		it('Fail if collateralize is paused',async () =>{
			await Holdefi.pause("collateralize", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(2)}),
				"POE02");
		})		

		it('Fail if collateral is not active',async () =>{
			await HoldefiSettings.deactivateCollateral(ethAddress, {from:owner});
			await expectRevert(Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(2)}),
				"E03");
		})


		it('Fail if collateral amount is more than user balance',async () =>{
			await expectRevert(Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(200000)}),
				"sender doesn't have enough funds to send tx");		
		})
	})
})
