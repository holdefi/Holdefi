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

contract("Collateralize", function([owner,ownerChanger,user1,user2,user3,user4,user5,user6]){
	
	describe("Collateralize ERC20", async() =>{
		beforeEach(async() => {
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await assignToken(owner, user5, SampleToken1);
			this.userBalanceBefore = await SampleToken1.balanceOf(user5);
		})

		it('Token collateralized',async () =>{	
			let getCollateralBefore = await Holdefi.collateralAssets(SampleToken1.address);	
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, SampleToken1.address);
			assert.equal(getAccountCollateral.balance.toString() ,decimal18.multipliedBy(20).toString(), 'Balance increased');

			let getCollateralAfter = await Holdefi.collateralAssets(SampleToken1.address);
			assert.equal(getCollateralAfter.totalCollateral.toString(), decimal18.multipliedBy(20).plus(getCollateralBefore.totalCollateral).toString(), 'Total collateral increased');

			let allowance = await SampleToken1.allowance(user5, Holdefi.address);
			assert.equal(allowance.toString(), decimal18.multipliedBy(780).toString(), 'Allowance decreased');
		
			let userBalanceAfter = await SampleToken1.balanceOf(user5);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(decimal18.multipliedBy(20)).toString(), 'User Balance increased correctly');
		})

		it('Collateralize if one month passed after pause',async () =>{
			await Holdefi.pause(2, {from: owner});
			await time.increase(time.duration.days(30));
			
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(2), {from:user5});
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5,SampleToken1.address);
			assert.equal(getAccountCollateral.balance.toString(), decimal18.multipliedBy(2).toString(), 'Balance increased');

		})

		it('Fail if collateralize was paused and call collateralize before one month',async () =>{
			await Holdefi.pause(2, {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(2), {from:user5}),
				"Pausable: paused");
		})

		it('Fail if market was not active',async () =>{
			await HoldefiSettings.removeCollateral(SampleToken1.address,{from:owner});
			await expectRevert(Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5}),
				"Collateral asset is not active");
		})

		it('Fail if supplyAsset = 0x',async () =>{
			await expectRevert(Holdefi.methods['collateralize(address,uint256)'](constants.ZERO_ADDRESS, decimal18.multipliedBy(20), {from:user5}),
				"Collateral asset should not be zero address");
		})

		it('Fail if balance < collateral amount',async () =>{
			await SampleToken1.mint(user6, decimal18.multipliedBy(40), {from: owner});
			await SampleToken1.approve(Holdefi.address, constants.MAX_UINT256, {from: user6});

			await expectRevert(Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(45), {from:user6}),
				"revert");		
		})

		it('Fail if allowance < collateral amount',async () =>{
			await SampleToken1.mint(user6, decimal18.multipliedBy(40), {from: owner});
			await SampleToken1.approve(Holdefi.address, decimal18.multipliedBy(30), {from: user6});

			await expectRevert(Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(35), {from:user6}),
				"revert");		
		})
	})

	describe("Collateralize ETH", async() =>{
		beforeEach(async() => {
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			this.userBalanceBefore = await web3.eth.getBalance(user5);
		})

		it('ETH collateralize',async () =>{
			let getCollateralBefore = await Holdefi.collateralAssets(constants.ZERO_ADDRESS);	
			let tx = await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(2)});
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
			assert.equal(getAccountCollateral.balance.toString(), decimal18.multipliedBy(2).toString(), 'Balance increased');

			let getCollateralAfter = await Holdefi.collateralAssets(constants.ZERO_ADDRESS);
			assert.equal(getCollateralAfter.totalCollateral.toString(), decimal18.multipliedBy(2).plus(getCollateralBefore.totalCollateral).toString(), 'Total collateral increased');
			
			let userBalanceAfter = await web3.eth.getBalance(user5);
			let txFee = gasPrice.multipliedBy(tx.receipt.gasUsed);
			assert.equal(userBalanceAfter.toString(), bigNumber(userBalanceBefore).minus(txFee).minus(decimal18.multipliedBy(2)).toString(), 'User Balance increased correctly');
		})

		it('Collateralize if one month passed after pause',async () =>{
			await Holdefi.pause(2, {from: owner});
			await time.increase(time.duration.days(30));
			
			await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(2)});
			let getAccountCollateral = await Holdefi.getAccountCollateral(user5,constants.ZERO_ADDRESS);
			assert.equal(getAccountCollateral.balance.toString(), decimal18.multipliedBy(2).toString(), 'Balance increased');

		})

		it('Fail if collateralize was paused and call collateralize before one month',async () =>{
			await Holdefi.pause(2, {from: owner});
			await time.increase(time.duration.days(29));
			await expectRevert(Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(2)}),
				"Pausable: paused");
		})		

		it('Fail if market was not active',async () =>{
			await HoldefiSettings.removeCollateral(constants.ZERO_ADDRESS, {from:owner});
			await expectRevert(Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(2)}),
				"Collateral asset is not active");
		})


		it('Fail if balance < collateral amount',async () =>{
			await expectRevert(Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(2000)}),
				"sender doesn't have enough funds to send tx");		
		})
	})
})
