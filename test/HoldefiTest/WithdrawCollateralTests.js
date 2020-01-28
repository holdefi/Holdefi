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


contract("Withdraw collateral", function([owner,ownerChanger,user1,user2,user3,user4,user5,user6]){
		
	describe("Withdraw collateral for ERC20", async() =>{
		beforeEach(async() => {
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
		 	await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(35), {from:user5});
			await Holdefi.borrow(constants.ZERO_ADDRESS, SampleToken1.address, decimal18.multipliedBy(0.5), {from: user5});
			this.userBalanceBefore = await SampleToken1.balanceOf(user5);
			this.getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			this.getCollateralBefore = await Holdefi.collateralAssets(SampleToken1.address);
		})
		
		it('Withdraw collateral',async () =>{
			await Holdefi.withdrawCollateral(SampleToken1.address, decimal18.multipliedBy(15), {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.equal(getAccountCollateralAfter.balance.toString(), decimal18.multipliedBy(20).toString(), 'Balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), decimal18.multipliedBy(15).plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');

			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(decimal18.multipliedBy(15)).toString(), 'User Balance increased correctly');
		})
		
		it('Should withdraw max amount if withdraw amount is bigger than total balance',async () =>{
			await Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);

			assert.equal(getAccountCollateralAfter.borrowPowerScaled.toString(), 0, 'Borrow power is zero');
			assert.isFalse(getAccountCollateralAfter.underCollateral, 'User should not be liquidated');

			let amountDecreased = bigNumber(getAccountCollateralBefore.balance).minus(getAccountCollateralAfter.balance);
			assert.equal(getCollateralBefore.totalCollateral.toString(), bigNumber(getCollateralAfter.totalCollateral).plus(amountDecreased).toString(), 'Total collateral decreased');
					
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(amountDecreased).toString(), 'User Balance increased correctly');
		})

		it('Should withdraw collateral if market is removed',async () =>{
			await HoldefiSettings.removeMarket(SampleToken1.address,{from:owner});
			await HoldefiSettings.removeMarket(constants.ZERO_ADDRESS,{from:owner});
			
			await Holdefi.withdrawCollateral(SampleToken1.address, decimal18.multipliedBy(15), {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.equal(getAccountCollateralAfter.balance.toString(), decimal18.multipliedBy(20).toString(), 'Balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), decimal18.multipliedBy(15).plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');
					
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(decimal18.multipliedBy(15)).toString(), 'User Balance increased correctly');
		})

		it('Should withdraw all amount if repayBorrow and withdraw amount is bigger than total balance',async () =>{
			await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value:decimal18.multipliedBy(2)});

			await Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5})
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.equal(getAccountCollateral.balance.toString(), 0, 'Balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralBefore.totalCollateral.toString(), bigNumber(getAccountCollateralBefore.balance).plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');
			
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).plus(getAccountCollateralBefore.balance).toString(), 'User Balance increased correctly');
		})

		it('Withdraw Collateralize if one month passed after pause',async () =>{
			await Holdefi.methods['repayBorrow(address)'](SampleToken1.address, {from:user5, value:decimal18.multipliedBy(2)});
			
			await Holdefi.pause(3, {from: owner});
			await time.increase(time.duration.days(30));
			
			await Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5});
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5,SampleToken1.address);
			assert.equal(getAccountCollateral.balance.toString(), 0, 'Balance decreased');

		})

		it('Fail if Withdraw collateralize was paused and call Withdraw collateralize before one month',async () =>{
			await Holdefi.pause(3, {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				"Pausable: paused");
		})

		it('Fail if user not collateralize at all',async () =>{
			await expectRevert(Holdefi.withdrawCollateral(SampleToken1.address, decimal18.multipliedBy(20), {from:user6}),
				"Borrow power should not be zero");
		})

		it('Fail if user is under collateral',async () =>{
			await HoldefiPrices.setPrice(SampleToken1.address, decimal18.multipliedBy(4));
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.isTrue(getAccountCollateral.underCollateral, 'User is not under collateral');

			await expectRevert(Holdefi.withdrawCollateral(SampleToken1.address, constants.MAX_UINT256, {from:user5}),
				"Borrow power should not be zero");
		})	
	})
	
	describe("Withdraw collateral for ETH", async() =>{
		beforeEach(async() => {
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
		 	await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(2)});
			await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(10), {from: user5});
			this.userBalanceBefore = await web3.eth.getBalance(user5);
			this.getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
			this.getCollateralBefore = await Holdefi.collateralAssets(constants.ZERO_ADDRESS);
		})
		
		it('Withdraw collateral',async () =>{
			let tx = await Holdefi.withdrawCollateral(constants.ZERO_ADDRESS, decimal18.multipliedBy(0.5), {from:user5})
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
			assert.equal(getAccountCollateralAfter.balance.toString(), decimal18.multipliedBy(1.5).toString(), 'Balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(constants.ZERO_ADDRESS);
			assert.equal(getCollateralBefore.totalCollateral.toString(), decimal18.multipliedBy(0.5).plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(decimal18.multipliedBy(0.5)).toString(), 'User Balance increased correctly');
		})
		
		it('Should withdraw max amount if withdraw amount is bigger than total balance',async () =>{
			let tx = await Holdefi.withdrawCollateral(constants.ZERO_ADDRESS, constants.MAX_UINT256, {from:user5});
			let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
			let getCollateralAfter = await Holdefi.collateralAssets(constants.ZERO_ADDRESS);

			assert.equal(getAccountCollateralAfter.borrowPowerScaled.toString(), 0, 'Borrow power is zero');
			assert.isFalse(getAccountCollateralAfter.underCollateral, 'User should not be liquidated');

			let amountDecreased = bigNumber(getAccountCollateralBefore.balance).minus(getAccountCollateralAfter.balance);
			assert.equal(getCollateralBefore.totalCollateral.toString(), bigNumber(getCollateralAfter.totalCollateral).plus(amountDecreased).toString(), 'Total collateral decreased');

			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(amountDecreased).toString(), 'User Balance increased correctly');
		})
 
		it('Should withdraw all amount if repayBorrow and withdraw amount is bigger than total balance',async () =>{
			await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, constants.MAX_UINT256, {from:user5});
			let userBalanceBefore = await web3.eth.getBalance(user5);
			
			let tx = await Holdefi.withdrawCollateral(constants.ZERO_ADDRESS, constants.MAX_UINT256, {from:user5})
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
			assert.equal(getAccountCollateral.balance.toString(), 0, 'Balance decreased');

			let getCollateralAfter = await Holdefi.collateralAssets(constants.ZERO_ADDRESS);
			assert.equal(getCollateralBefore.totalCollateral.toString(), bigNumber(getAccountCollateralBefore.balance).plus(getCollateralAfter.totalCollateral).toString(), 'Total collateral decreased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).plus(getAccountCollateralBefore.balance).toString(), 'User Balance increased correctly');
		})
	})
})
