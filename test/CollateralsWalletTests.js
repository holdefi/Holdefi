const {   
  constants,
  balance,
  time,
  expectRevert,
  bigNumber,
  decimal18,
  ratesDecimal,
  secondsPerYear,

  HoldefiContract,
  SampleTokenContract,
  CollateralsWalletContract,

  initializeContracts
} = require ("./Utils.js");

contract('Collaterals Wallet', function([owner,ownerChanger,user1,user2]){
    beforeEach(async () => {
        await initializeContracts(owner,ownerChanger);
    });

    it('Initialize works as expected', async () => {
        let holdefiContract_collateralsWalletAddress = await Holdefi.holdefiCollaterals.call();
        assert.equal(CollateralsWallet.address, holdefiContract_collateralsWalletAddress);

        let collateralsWallet_holdefiContractAddress = await CollateralsWallet.holdefiContract.call();
        assert.equal(Holdefi.address, collateralsWallet_holdefiContractAddress);
    });

    it('Fail if try to change holdefi contract address', async () => {
        await expectRevert(CollateralsWallet.setHoldefiContract(SampleToken1.address, {from: owner}),
          "Should be set once");
    });

    it('Fail if call withdraw', async () => {
        await expectRevert(CollateralsWallet.withdraw(SampleToken1.address, user1, decimal18.multipliedBy(10)),
          "Sender should be holdefi contract");
    });

    it('Fail if other account send ETH', async () => {
        await expectRevert(CollateralsWallet.send(decimal18.multipliedBy(0.5)),
          "revert");
    });
});