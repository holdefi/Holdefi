const {   
  constants,
  balance,
  time,
  expectRevert,
  bigNumber,
  decimal18,
  ratesDecimal,
  secondsPerYear,

  MedianizerContract,
  HoldefiPricesContract,
  SampleTokenContract,

  initializeContracts
} = require ("./Utils.js");


contract('HoldefiPrices', function([owner,ownerChanger,user1,user2]){
    beforeEach(async () => {
        await initializeContracts(owner,ownerChanger);
    });

   	it('Initialize works as expected', async () => {
        let holdefiContract_holdefiPricesAddress = await Holdefi.holdefiPrices.call();
        assert.equal(HoldefiPrices.address, holdefiContract_holdefiPricesAddress);
    });

    it('Price should be set for a stable coin', async () => {
        await HoldefiPrices.addStableCoin(SampleToken1.address, {from: owner});
        let newAssetPrice = await HoldefiPrices.getPrice(SampleToken1.address);
        assert.equal(newAssetPrice.toString(), decimal18.multipliedBy(1).toString());
    });


    it('ETH price should be same as medianizer ETH price', async () => {
        let ethPrice = await HoldefiPrices.getPrice(constants.ZERO_ADDRESS);
        let med_ethPrice = await Medianizer.read();

        assert.equal(ethPrice.toString(), med_ethPrice.toString(), "Same price for getPrice(ZERO_ADDRESS)");
    });

    it('Fail if try to add ETH as stable coin', async () => {
        await expectRevert(HoldefiPrices.addStableCoin(constants.ZERO_ADDRESS, {from: owner}),
          "Price of ETH can not be changed");
    });

    it('Fail if other accounts add stable coin', async () => {
        await expectRevert(HoldefiPrices.addStableCoin(SampleToken1.address, {from: user1}),
          "Sender should be Owner");
    });

    it('Fail if send ETH to contract', async () =>{
        await expectRevert(HoldefiPrices.send(decimal18.multipliedBy(0.5)),
          "revert");
    });
});