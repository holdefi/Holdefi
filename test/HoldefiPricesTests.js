const {   
  expectRevert,
  bigNumber,

  ethAddress,
  decimal18,

  HoldefiContract,
  HoldefiPricesContract,
  SampleTokenContract,
  AggregatorContract,

  convertToDecimals,
  initializeContracts,
} = require ("./Utils.js");


contract('HoldefiPrices', function([owner, user1, user2]){
    beforeEach(async () => {
        await initializeContracts(owner);
    });

   	it('Initialize works as expected', async () => {
        let holdefiContract_holdefiPricesAddress = await Holdefi.holdefiPrices.call();
        assert.equal(HoldefiPrices.address, holdefiContract_holdefiPricesAddress);
    });

    it('Price should be availabe for an asset from getPrice function after calling setPriceAggregator by owner', async () => {
        SampleToken1PriceAggregator = await AggregatorContract.new(18, {from: owner});

        await HoldefiPrices.setPriceAggregator(
            SampleToken1.address,
            await SampleToken1.decimals(),
            SampleToken1PriceAggregator.address,
            {from: owner}
        );

        let price = await convertToDecimals(SampleToken1PriceAggregator, 1/200);
        await SampleToken1PriceAggregator.setPrice(price, {from: owner});
        let priceObject = await HoldefiPrices.getPrice(SampleToken1.address);
        assert.equal(price.toString(), priceObject.price.toString());
    });

    it('Price decimals for an asset should be same as aggregator decimals', async () => {
        SampleToken1PriceAggregator = await AggregatorContract.new(18, {from: owner});

        await HoldefiPrices.setPriceAggregator(
            SampleToken1.address,
            12,
            SampleToken1PriceAggregator.address,
            {from: owner}
        );

        let price = await convertToDecimals(SampleToken1PriceAggregator, 1/200);
        await SampleToken1PriceAggregator.setPrice(price, {from: owner});
        let priceObject = await HoldefiPrices.getPrice(SampleToken1.address);
        assert.equal(priceObject.priceDecimals.toString(), 18);
    });

    it('Price decimals should be read from ERC20 contract if availabe when calling setPriceAggregator by owner', async () => {
        SampleToken1PriceAggregator = await AggregatorContract.new(18, {from: owner});
        let erc20Decimals = await SampleToken1.decimals();
        await HoldefiPrices.setPriceAggregator(
            SampleToken1.address,
            bigNumber(erc20Decimals).minus(1),
            SampleToken1PriceAggregator.address,
            {from: owner}
        );

        holdefiAssetDecimals = (await HoldefiPrices.assets(SampleToken1.address)).decimals;
        assert.equal(erc20Decimals.toString(), holdefiAssetDecimals.toString());
    });

    it('ETH price should be 1', async () => {
        let priceObject = await HoldefiPrices.getPrice(ethAddress);
        assert.equal(priceObject.price.toString(), "1");
    });    

    it('ETH price decimals should be 0', async () => {
        let priceObject = await HoldefiPrices.getPrice(ethAddress);
        assert.equal(priceObject.priceDecimals.toString(), "0");
    });

    it('A valid asset value returend from getAssetValueFromAmount function', async () => {
        SampleToken1PriceAggregator = await AggregatorContract.new(18, {from: owner});

        await HoldefiPrices.setPriceAggregator(
            SampleToken1.address,
            await SampleToken1.decimals(),
            SampleToken1PriceAggregator.address,
            {from: owner}
        );

        let price = await convertToDecimals(SampleToken1PriceAggregator, 1/200);
        await SampleToken1PriceAggregator.setPrice(price, {from: owner});
        let valueDecimals = 30;
        let priceObject = await HoldefiPrices.getPrice(SampleToken1.address);
        let tokenDecimals = await SampleToken1.decimals();
        let dec = bigNumber(valueDecimals).minus(tokenDecimals).minus(priceObject.priceDecimals).toString();
        let dec2 = bigNumber(10).pow(dec);
        let value = await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, await convertToDecimals(SampleToken1, 100));
        assert.equal(bigNumber(price).multipliedBy(await convertToDecimals(SampleToken1, 100)).multipliedBy(dec2).toString(), value.toString());
    });

    it('A valid asset amount returend from getAssetValueFromAmount function', async () => {
        SampleToken1PriceAggregator = await AggregatorContract.new(18, {from: owner});

        await HoldefiPrices.setPriceAggregator(
            SampleToken1.address,
            await SampleToken1.decimals(),
            SampleToken1PriceAggregator.address,
            {from: owner}
        );

        let price = await convertToDecimals(SampleToken1PriceAggregator, 1/200);
        await SampleToken1PriceAggregator.setPrice(price, {from: owner});
        let valueDecimals = 30;
        let priceObject = await HoldefiPrices.getPrice(SampleToken1.address);
        let tokenDecimals = await SampleToken1.decimals();
        let dec = bigNumber(valueDecimals).minus(tokenDecimals).minus(priceObject.priceDecimals).toString();
        let dec2 = bigNumber(10).pow(dec);
        let amount = await HoldefiPrices.getAssetAmountFromValue(
            SampleToken1.address, bigNumber(price).multipliedBy(await convertToDecimals(SampleToken1, 400)).toString()
        );
        assert.equal(bigNumber(await convertToDecimals(SampleToken1, 400)).dividedToIntegerBy(dec2).toString(), amount.toString());
    });

    it('Fail if try to call setPriceAggregator for ETH', async () => {
        PriceAggregator = await AggregatorContract.new(18, {from: owner});
        await expectRevert(
            HoldefiPrices.setPriceAggregator(ethAddress, 18, PriceAggregator.address, {from: owner}),
            "E01");
    });

    it('Fail if a non-owner account calls setPriceAggregator', async () => {
        SampleToken = await SampleTokenContract.new("SampleToken", "ST", 8, {from: owner});
        SampleTokenPriceAggregator = await AggregatorContract.new(18, {from: owner});
        await expectRevert(
            HoldefiPrices.setPriceAggregator(
                SampleToken.address,
                await SampleToken.decimals(),
                SampleTokenPriceAggregator.address,
                {from: user1}
            ),
            "OE01");
    });

    it('Fail if send ETH to contract', async () => {
        await expectRevert(HoldefiPrices.send(decimal18.multipliedBy(0.5)),
          "revert");
    });    

    it('Fail if call getPrice when the price is zero', async () => {
       SampleToken1PriceAggregator = await AggregatorContract.new(18, {from: owner});

        await HoldefiPrices.setPriceAggregator(
            SampleToken1.address,
            await SampleToken1.decimals(),
            SampleToken1PriceAggregator.address,
            {from: owner}
        );
        await SampleToken1PriceAggregator.setPrice(0, {from: owner});
        await expectRevert(HoldefiPrices.getPrice(SampleToken1.address),
          "revert");
    })
});