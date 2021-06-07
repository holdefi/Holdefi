const {   
	expectRevert,
	decimal18,
	HoldefiContract,
	HoldefiCollateralsContract,
	initializeContracts,
} = require ("./Utils.js");

contract('HoldefiCollaterals', function([owner, user1, user2]){
	beforeEach(async () => {
		await initializeContracts(owner);
		HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
		HoldefiCollaterals = await HoldefiCollateralsContract.at(HoldefiCollateralsAddress);
	});

	it('Initialize works as expected', async () => {
		let HoldefiContractAddress = await HoldefiCollaterals.holdefiContract.call();
		assert.equal(Holdefi.address.toString(), HoldefiContractAddress.toString());
	});

	it('Fail if an account call withdraw function', async () => {
		await expectRevert(
			HoldefiCollaterals.withdraw(SampleToken1.address, user1, decimal18.multipliedBy(10)),
			"CE01"
		);
	});

	it('Fail if an account send ETH to contract', async () => {
		await expectRevert(
			HoldefiCollaterals.send(decimal18.multipliedBy(0.5)),
			"CE01");
	});
});