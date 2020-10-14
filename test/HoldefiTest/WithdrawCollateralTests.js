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


contract("Withdraw collateral", function([owner,user1,user2,user3,user4,user5,user6,user7]){
		
	describe("Withdraw collateral for ERC20", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			collateralAmount = await convertToDecimals(SampleToken1, 35);
		 	await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, collateralAmount, {from:user5});
			await Holdefi.borrow(ethAddress, SampleToken1.address, decimal18.multipliedBy(0.5), referalCode, {from: user5});
			userBalanceBefore = await SampleToken1.balanceOf(user5);
			getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			getCollateralBefore = await Holdefi.collateralAssets(SampleToken1.address);
		})
		
		it('Withdraw collateral',async () =>{
			let withdrawAmount = await convertToDecimals(SampleToken1, 15);
			await Holdefi.withdrawCollateral(SampleToken1.address, withdrawAmount, {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.equal(getAccountCollateralAfter.balance.toString(), collateralAmount.minus(withdrawAmount).toString(), 'Balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');

			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(withdrawAmount).toString(), 'User Balance increased correctly');
		})
		
		it('Withdraw collateral for someone else',async () =>{
			let user6BalanceBefore = await SampleToken1.balanceOf(user6);
			let withdrawAmount = await convertToDecimals(SampleToken1, 15);
			await Holdefi.approveWithdrawCollateral(user6, SampleToken1.address, withdrawAmount, {from:user5})
			await Holdefi.withdrawCollateralBehalf(user5, SampleToken1.address, withdrawAmount, {from:user6})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5,SampleToken1.address);
			let getAccountAllowanceAfter = await Holdefi.getAccountWithdrawCollateralAllowance(user5, user6, SampleToken1.address);

			assert.equal(getAccountCollateralAfter.balance.toString(), collateralAmount.minus(withdrawAmount).toString(), 'User collateral balance decreased');
			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User withdraw collateral allowance decreased');


			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');

			let user5BalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(user5BalanceAfter.toString(), bigNumber(userBalanceBefore).toString(), 'User erc20 balance not changed');
			let user6BalanceAfter = await SampleToken1.balanceOf(user6);
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).plus(withdrawAmount).toString(), 'Sender erc20 balance increased correctly');
		})

		it('Should withdraw max amount if withdraw amount is bigger than total balance',async () =>{
			await Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);

			assert.equal(getAccountCollateralAfter.borrowPowerValue.toString(), 0, 'Borrow power is zero');
			assert.isFalse(getAccountCollateralAfter.underCollateral, 'User should not be liquidated');

			let amountDecreased = bigNumber(getAccountCollateralBefore.balance).minus(getAccountCollateralAfter.balance);
			assert.equal(getCollateralBefore.totalCollateral.toString(), bigNumber(getCollateralAfter.totalCollateral).plus(amountDecreased).toString(), 'Total collateral decreased');
					
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(amountDecreased).toString(), 'User Balance increased correctly');
		})

		it('Should withdraw collateral if markets is deactivated',async () =>{
			await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.deactivateMarket(ethAddress,{from:owner});
			
			let withdrawAmount = await convertToDecimals(SampleToken1, 15);
			await Holdefi.withdrawCollateral(SampleToken1.address, withdrawAmount, {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.equal(getAccountCollateralAfter.balance.toString(), collateralAmount.minus(withdrawAmount).toString(), 'Balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');
					
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(withdrawAmount).toString(), 'User Balance increased correctly');
		})

		it('Should withdraw all amount if repayBorrow and withdraw amount is bigger than total balance',async () =>{
			await Holdefi.methods['repayBorrow(address)'](
				SampleToken1.address,
				{from:user5, value:decimal18.multipliedBy(2)}
			);

			await Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5})
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.equal(getAccountCollateral.balance.toString(), 0, 'Balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), bigNumber(getAccountCollateralBefore.balance).plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');
			
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(getAccountCollateralBefore.balance).toString(), 'User Balance increased correctly');
		})

		it('Withdraw Collateralize if one month passed after pause',async () =>{
			await Holdefi.methods['repayBorrow(address)'](
				SampleToken1.address,
				{from:user5, value:decimal18.multipliedBy(2)}
			);
			
			await Holdefi.pause("withdrawCollateral", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(31));
			
			await Holdefi.withdrawCollateral( SampleToken1.address, constants.MAX_UINT256, {from:user5});
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5,SampleToken1.address);
			assert.equal(getAccountCollateral.balance.toString(), 0, 'Balance decreased');

		})

		it('Fail if Withdraw collateralize was paused and call Withdraw collateralize before one month',async () =>{
			await Holdefi.pause("withdrawCollateral", time.duration.days(30), {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				"Operation is paused");
		})

		it('Fail Withdraw collateral for someone else without approve',async () =>{
			let withdrawAmount = await convertToDecimals(SampleToken1, 15);
			await expectRevert(Holdefi.withdrawCollateralBehalf(user5, SampleToken1.address, withdrawAmount, {from:user6}),
				"Withdraw not allowed");
		})

		it('Fail if user not collateralize at all',async () =>{
			await expectRevert(Holdefi.withdrawCollateral(SampleToken1.address, await convertToDecimals(SampleToken1, 20), {from:user6}),
				"Borrow power should not be zero");
		})

		it('Fail if user is under collateral',async () =>{
			await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 4/200));
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, SampleToken1.address);

			assert.isTrue(getAccountCollateral.underCollateral, 'User is not under collateral');

			await expectRevert(Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				"Borrow power should not be zero");
		})	
	})
	
	describe("Withdraw collateral for ETH", async() =>{
		beforeEach(async() => {
			await scenario(owner,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			collateralAmount = decimal18.multipliedBy(2);
		 	await Holdefi.methods['collateralize()']({from:user5, value: collateralAmount});
			await Holdefi.borrow(
				SampleToken1.address,
				ethAddress,
				await convertToDecimals(SampleToken1, 10),
				referalCode,
				{from: user5}
			);
			userBalanceBefore = await web3.eth.getBalance(user5);
			getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);
			getCollateralBefore = await Holdefi.collateralAssets(ethAddress);
		})
		
		it('Withdraw collateral',async () =>{
			let withdrawAmount = decimal18.multipliedBy(0.5); 
			let tx = await Holdefi.withdrawCollateral(ethAddress, withdrawAmount, {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.equal(getAccountCollateralAfter.balance.toString(), collateralAmount.minus(withdrawAmount).toString(), 'Balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(ethAddress);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(withdrawAmount).toString(), 'User Balance increased correctly');
		})

		it('Withdraw collateral for someone else',async () =>{
			let user6BalanceBefore = await web3.eth.getBalance(user6);
			let withdrawAmount = decimal18.multipliedBy(0.5); 
			await Holdefi.approveWithdrawCollateral(user6, ethAddress, withdrawAmount, {from:user5})
			let user5BalanceBefore = await web3.eth.getBalance(user5);
			let tx = await Holdefi.withdrawCollateralBehalf(user5, ethAddress, withdrawAmount, {from:user6})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);
			let getAccountAllowanceAfter = await Holdefi.getAccountWithdrawCollateralAllowance(user5, user6, ethAddress);

			assert.equal(getAccountCollateralAfter.balance.toString(), collateralAmount.minus(withdrawAmount).toString(), 'User collateral balance decreased');
			assert.equal(getAccountAllowanceAfter.toString(), 0, 'User withdraw collateral allowance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(ethAddress);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');
			
			let user5BalanceAfter = await web3.eth.getBalance(user5);
			assert.equal(user5BalanceAfter.toString(), bigNumber(user5BalanceBefore).toString(), 'User erc20 balance not changed');
			
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			let user6BalanceAfter = await web3.eth.getBalance(user6);
			assert.equal(user6BalanceAfter.toString(), bigNumber(user6BalanceBefore).minus(txFee).plus(withdrawAmount).toString(), 'Sender erc20 balance increased correctly');
		})

		it('Should withdraw max amount if withdraw amount is bigger than total balance',async () =>{
			let tx = await Holdefi.withdrawCollateral(ethAddress, constants.MAX_UINT256, {from:user5});
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);
			let getCollateralAfter = await Holdefi.collateralAssets(ethAddress);

			assert.equal(getAccountCollateralAfter.borrowPowerValue.toString(), 0, 'Borrow power is zero');
			assert.isFalse(getAccountCollateralAfter.underCollateral, 'User should not be liquidated');

			let amountDecreased = bigNumber(getAccountCollateralBefore.balance).minus(getAccountCollateralAfter.balance);
			assert.equal(getCollateralBefore.totalCollateral.toString(), bigNumber(getCollateralAfter.totalCollateral).plus(amountDecreased).toString(), 'Total collateral decreased');

			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(amountDecreased).toString(), 'User Balance increased correctly');
		})
 
		it('Should withdraw all amount if repayBorrow and withdraw amount is bigger than total balance',async () =>{
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, constants.MAX_UINT256, {from:user5});
			let userBalanceBefore = await web3.eth.getBalance(user5);
			
			let tx = await Holdefi.withdrawCollateral(ethAddress, constants.MAX_UINT256, {from:user5})
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, ethAddress);
			assert.equal(getAccountCollateral.balance.toString(), 0, 'Balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(ethAddress);
			assert.equal(getCollateralBefore.totalCollateral.toString(), bigNumber(getAccountCollateralBefore.balance).plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(getAccountCollateralBefore.balance).toString(), 'User Balance increased correctly');
		})

		it('Fail Withdraw collateral for someone else without approve',async () =>{
			let withdrawAmount = decimal18.multipliedBy(0.5); 
			await expectRevert(Holdefi.withdrawCollateralBehalf(user5, ethAddress, withdrawAmount, {from:user6}),
				"Withdraw not allowed");		
		})
	})

	describe("Withdraw collateral scenario 2", async() =>{
		beforeEach(async() => {
			await scenario2(owner,user1,user2,user3,user4,user7);
		})
		
		it('Withdraw collateral',async () =>{
			let userBalanceBefore = await SampleToken3.balanceOf(user7);
			let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user7, SampleToken3.address);
			let getCollateralBefore = await Holdefi.collateralAssets(SampleToken3.address);
			let withdrawAmount = await convertToDecimals(SampleToken3, 3);
			let getAccountCollateralBefore2 = await Holdefi.getAccountCollateral(user7, ethAddress);
			await Holdefi.withdrawCollateral(SampleToken3.address, withdrawAmount, {from:user7})
			let getAccountCollateralAfter2 = await Holdefi.getAccountCollateral(user7, ethAddress);
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user7, SampleToken3.address);

			assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(withdrawAmount).toString(), 'Balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken3.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), withdrawAmount.plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');

			let userBalanceAfter = await SampleToken3.balanceOf(user7);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(withdrawAmount).toString(), 'User Balance increased correctly');
			
			assert.equal(getAccountCollateralBefore2.borrowPowerValue.toString(), getAccountCollateralAfter2.borrowPowerValue.toString(), 'power on another collateral is not changed');
		

		})	
	})

})
