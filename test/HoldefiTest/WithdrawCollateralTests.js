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


contract("Withdraw collateral", function([owner,user1,user2,user3,user4,user5,user6,user7]){
		
	describe("ERC20 Withdraw Collateral", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			collateralAmount = await convertToDecimals(SampleToken1, 35);
		 	await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, collateralAmount, {from:user5});
			await Holdefi.borrow(ethAddress, SampleToken1.address, decimal18.multipliedBy(0.5), referralCode, {from: user5});
			userBalanceBefore = await SampleToken1.balanceOf(user5);
			getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			getCollateralBefore = await Holdefi.collateralAssets(SampleToken1.address);

			HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
		})
		
		it('The withdrawCollateral function should work as expected',async () =>{
			let withdrawAmount = await convertToDecimals(SampleToken1, 15);
			let contractBalanceBefore = await SampleToken1.balanceOf(HoldefiCollateralsAddress);
			await Holdefi.withdrawCollateral(SampleToken1.address, withdrawAmount, {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.equal(getAccountCollateralAfter.balance.toString(), collateralAmount.minus(withdrawAmount).toString(), 'User collateral balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 
				'Total collateral decreased');

			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(withdrawAmount).toString(), 'User wallet balance increased');

			let contractBalanceAfter = await SampleToken1.balanceOf(HoldefiCollateralsAddress);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(withdrawAmount).toString(),
				'HoldefiCollaterals contract balance increased');
		})

		it('The withdrawCollateralBehalf function should work as expected',async () =>{
			let user6BalanceBefore = await SampleToken1.balanceOf(user6);
			let withdrawAmount = await convertToDecimals(SampleToken1, 15);
			await Holdefi.approveWithdrawCollateral(user6, SampleToken1.address, withdrawAmount, {from:user5})
			await Holdefi.withdrawCollateralBehalf(user5, SampleToken1.address, withdrawAmount, {from:user6})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5,SampleToken1.address);
			let getAccountAllowanceAfter = await Holdefi.getAccountWithdrawCollateralAllowance(user5, user6, SampleToken1.address);

			assert.equal(getAccountCollateralAfter.balance.toString(), collateralAmount.minus(withdrawAmount).toString(), 'User collateral balance decreased');
			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User withdrawCollateral allowance decreased');


			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(),
			 'Total collateral decreased');

			let user5BalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(user5BalanceAfter.toString(), bigNumber(userBalanceBefore).toString(), 'User wallet balance not changed');
			let user6BalanceAfter = await SampleToken1.balanceOf(user6);
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).plus(withdrawAmount).toString(), 'Sender wallet balance increased');
		})

		it('User borrow power should be zero if withdraw amount is bigger than available collateral to withdraw',async () =>{
			await Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);

			assert.equal(getAccountCollateralAfter.borrowPowerValue.toString(), 0, 'Borrow power = 0');
			assert.isFalse(getAccountCollateralAfter.underCollateral, 'User should not be liquidated');

			let amountDecreased = bigNumber(getAccountCollateralBefore.balance).minus(getAccountCollateralAfter.balance);
			assert.equal(getCollateralBefore.totalCollateral.toString(), bigNumber(getCollateralAfter.totalCollateral).plus(amountDecreased).toString(), 
				'Total collateral decreased');
					
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(amountDecreased).toString(), 'User wallet balance increased');
		})

		it('The withdrawCollateral function should work if collateral is deactivated',async () =>{
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.deactivateMarket(ethAddress,{from:owner});
			
			let withdrawAmount = await convertToDecimals(SampleToken1, 15);
			await Holdefi.withdrawCollateral(SampleToken1.address, withdrawAmount, {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.equal(getAccountCollateralAfter.balance.toString(), collateralAmount.minus(withdrawAmount).toString(), 'User collateral balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 
				'Total collateral decreased');
					
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(withdrawAmount).toString(), 'User wallet balance increased');
		})

		it('User collateralized balance should be zero if total borrow value is zero and withdraw amount is bigger than total balance',async () =>{
			await Holdefi.methods['repayBorrow(address)'](
				SampleToken1.address,
				{from:user5, value:decimal18.multipliedBy(2)}
			);

			await Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5})
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.equal(getAccountCollateral.balance.toString(), 0, 'User collateral balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), 
				bigNumber(getAccountCollateralBefore.balance).plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');
			
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(getAccountCollateralBefore.balance).toString(), 
				'User wallet balance increased correctly');
		})

		it('The withdrawCollateral function should not be reverted if calling it a month after pausing',async () =>{
			await Holdefi.methods['repayBorrow(address)'](
				SampleToken1.address,
				{from:user5, value:decimal18.multipliedBy(2)}
			);
			
			await Holdefi.pause("withdrawCollateral", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.withdrawCollateral( SampleToken1.address, constants.MAX_UINT256, {from:user5});
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5,SampleToken1.address);
			assert.equal(getAccountCollateral.balance.toString(), 0, 'User collateral balance decreased');

		})

		it('Fail if withdrawCollateral is paused',async () =>{
			await Holdefi.pause("withdrawCollateral", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				"POE02");
		})

		it('Fail if try to call withdrawCollateralBehalf without having allowance',async () =>{
			let withdrawAmount = await convertToDecimals(SampleToken1, 15);
			await expectRevert(Holdefi.withdrawCollateralBehalf(user5, SampleToken1.address, withdrawAmount, {from:user6}),
				"E14");
		})

		it('Fail if collateralized balance is zero',async () =>{
			await expectRevert(Holdefi.withdrawCollateral(SampleToken1.address, await convertToDecimals(SampleToken1, 20), {from:user6}),
				"E10");
		})

		it('Fail if user is under collateral',async () =>{
			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 4/200));
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, SampleToken1.address);

			assert.isTrue(getAccountCollateral.underCollateral, 'User is not under collateral');

			await expectRevert(Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				"E10");
		})	
	})

	describe("Deflating ERC20 Withdraw Collateral", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken5);
			collateralAmount = await convertToDecimals(SampleToken5, 35);
		 	await Holdefi.methods['collateralize(address,uint256)'](SampleToken5.address, collateralAmount, {from:user5});
			await Holdefi.borrow(ethAddress, SampleToken5.address, decimal18.multipliedBy(0.01), referralCode, {from: user5});
			userBalanceBefore = await SampleToken5.balanceOf(user5);
			getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, SampleToken5.address);
			getCollateralBefore = await Holdefi.collateralAssets(SampleToken5.address);

			HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
		})
		
		it('The withdrawCollateral function should work as expected',async () =>{
			let withdrawAmount = await convertToDecimals(SampleToken5, 15);
			let receivedAmount = withdrawAmount.minus(withdrawAmount.dividedToIntegerBy(100));
			let contractBalanceBefore = await SampleToken5.balanceOf(HoldefiCollateralsAddress);
			await Holdefi.withdrawCollateral(SampleToken5.address, withdrawAmount, {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken5.address);
			assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(withdrawAmount).toString(), 
				'User collateral balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken5.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 
				'Total collateral decreased');

			let userBalanceAfter = await SampleToken5.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(receivedAmount).toString(), 
				'User wallet balance increased');

			let contractBalanceAfter = await SampleToken5.balanceOf(HoldefiCollateralsAddress);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(withdrawAmount).toString(),
				'HoldefiCollaterals contract balance increased');
		})

		it('The withdrawCollateralBehalf function should work as expected',async () =>{
			let user6BalanceBefore = await SampleToken5.balanceOf(user6);
			let withdrawAmount = await convertToDecimals(SampleToken5, 15);
			let receivedAmount = withdrawAmount.minus(withdrawAmount.dividedToIntegerBy(100));
			await Holdefi.approveWithdrawCollateral(user6, SampleToken5.address, withdrawAmount, {from:user5})
			await Holdefi.withdrawCollateralBehalf(user5, SampleToken5.address, withdrawAmount, {from:user6})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5,SampleToken5.address);
			let getAccountAllowanceAfter = await Holdefi.getAccountWithdrawCollateralAllowance(user5, user6, SampleToken5.address);

			assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(withdrawAmount).toString(), 
				'User collateral balance decreased');
			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User withdrawCollateral allowance decreased');


			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken5.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 
				'Total collateral decreased');

			let user5BalanceAfter = await SampleToken5.balanceOf(user5);
			assert.equal(user5BalanceAfter.toString(), bigNumber(userBalanceBefore).toString(), 'User wallet balance not changed');
			let user6BalanceAfter = await SampleToken5.balanceOf(user6);
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).plus(receivedAmount).toString(), 
				'Sender wallet balance increased');
		})
	})
	
	describe("ETH Withdraw Collateral", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			collateralAmount = decimal18.multipliedBy(2);
		 	await Holdefi.methods['collateralize()']({from:user5, value: collateralAmount});
			await Holdefi.borrow(
				SampleToken1.address,
				ethAddress,
				await convertToDecimals(SampleToken1, 10),
				referralCode,
				{from: user5}
			);
			userBalanceBefore = await web3.eth.getBalance(user5);
			getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);
			getCollateralBefore = await Holdefi.collateralAssets(ethAddress);

			HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
		})
		
		it('The withdrawCollateral function should work as expected',async () =>{
			let withdrawAmount = decimal18.multipliedBy(0.5); 
			let contractBalanceBefore = await balance.current(HoldefiCollateralsAddress);
			let tx = await Holdefi.withdrawCollateral(ethAddress, withdrawAmount, {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.equal(getAccountCollateralAfter.balance.toString(), collateralAmount.minus(withdrawAmount).toString(), 'User collateral balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(ethAddress);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 
				'Total collateral decreased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(withdrawAmount).toString(), 
				'User wallet balance increased');

			let contractBalanceAfter = await balance.current(HoldefiCollateralsAddress);
			assert.equal(contractBalanceAfter.toString(), bigNumber(contractBalanceBefore).minus(withdrawAmount).toString(),
				'HoldefiCollaterals contract balance increased');
		})

		it('The withdrawCollateralBehalf function should work as expected',async () =>{
			let user6BalanceBefore = await web3.eth.getBalance(user6);
			let withdrawAmount = decimal18.multipliedBy(0.5); 
			await Holdefi.approveWithdrawCollateral(user6, ethAddress, withdrawAmount, {from:user5})
			let user5BalanceBefore = await web3.eth.getBalance(user5);
			let tx = await Holdefi.withdrawCollateralBehalf(user5, ethAddress, withdrawAmount, {from:user6})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);
			let getAccountAllowanceAfter = await Holdefi.getAccountWithdrawCollateralAllowance(user5, user6, ethAddress);

			assert.equal(getAccountCollateralAfter.balance.toString(), collateralAmount.minus(withdrawAmount).toString(), 'User collateral balance decreased');
			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User withdrawCollateral allowance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(ethAddress);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 
				'Total collateral decreased');
			
			let user5BalanceAfter = await web3.eth.getBalance(user5);
			assert.equal(user5BalanceAfter.toString(), bigNumber(user5BalanceBefore).toString(), 'User wallet balance not changed');
			
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			let user6BalanceAfter = await web3.eth.getBalance(user6);
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).minus(txFee).plus(withdrawAmount).toString(), 
				'Sender wallet balance increased');
		})

		it('Should withdraw max amount if withdraw amount is bigger than total balance',async () =>{
			let tx = await Holdefi.withdrawCollateral(ethAddress, constants.MAX_UINT256, {from:user5});
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);
			let getCollateralAfter = await Holdefi.collateralAssets(ethAddress);

			assert.equal(getAccountCollateralAfter.borrowPowerValue.toString(), 0, 'Borrow power is zero');
			assert.isFalse(getAccountCollateralAfter.underCollateral, 'User should not be liquidated');

			let amountDecreased = bigNumber(getAccountCollateralBefore.balance).minus(getAccountCollateralAfter.balance);
			assert.equal(getCollateralBefore.totalCollateral.toString(), bigNumber(getCollateralAfter.totalCollateral).plus(amountDecreased).toString(), 
				'Total collateral decreased');

			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(amountDecreased).toString(), 
				'User wallet balance increased');
		})
 
		it('Should withdraw all amount if repayBorrow and withdraw amount is bigger than total balance',async () =>{
			let userAllowance = await SampleToken1.allowance(user5, Holdefi.address);
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, userAllowance, {from:user5});
			let userBalanceBefore = await web3.eth.getBalance(user5);
			
			let tx = await Holdefi.withdrawCollateral(ethAddress, constants.MAX_UINT256, {from:user5})
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.equal(getAccountCollateral.balance.toString(), 0, 'User collateral balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(ethAddress);
			assert.equal(getCollateralBefore.totalCollateral.toString(), 
				bigNumber(getAccountCollateralBefore.balance).plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(getAccountCollateralBefore.balance).toString(), 
				'User wallet balance increased');
		})

		it('Fail Withdraw collateral for someone else without approve',async () =>{
			let withdrawAmount = decimal18.multipliedBy(0.5); 
			await expectRevert(Holdefi.withdrawCollateralBehalf(user5, ethAddress, withdrawAmount, {from:user6}),
				"E14");		
		})
	})

	describe("Withdraw Collateral with scenario2", async() =>{
		beforeEach(async() => {
			await scenario2(owner,user1,user2,user3,user4,user7);
		})
		
		it('The withdrawCollateral function should work as expected',async () =>{
			let userBalanceBefore = await SampleToken3.balanceOf(user7);
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user7, SampleToken3.address);
			let getCollateralBefore = await Holdefi.collateralAssets(SampleToken3.address);
			let withdrawAmount = await convertToDecimals(SampleToken3, 3);
			let getAccountCollateralBefore2 = await Holdefi.getAccountCollateral(user7, ethAddress);
			await Holdefi.withdrawCollateral(SampleToken3.address, withdrawAmount, {from:user7})
			let getAccountCollateralAfter2 = await Holdefi.getAccountCollateral(user7, ethAddress);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user7, SampleToken3.address);

			assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(withdrawAmount).toString(), 
				'User collateral balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken3.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 
				'Total collateral decreased');

			let userBalanceAfter = await SampleToken3.balanceOf(user7);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(withdrawAmount).toString(), 
				'User wallet balance increased correctly');
		})	
	})

})
