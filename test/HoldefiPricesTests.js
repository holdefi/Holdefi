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

    it('Price should be set for a asset', async () => {
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

    it('Decimals should be read from ERC20 contract', async () => {
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
    it('ETH price should be 1', async () => {
        let priceObject = await HoldefiPrices.getPrice(ethAddress);
        assert.equal(priceObject.price.toString(), "1");
    });    

    it('ETH decimals should be 0', async () => {
        let priceObject = await HoldefiPrices.getPrice(ethAddress);
        assert.equal(priceObject.priceDecimals.toString(), "0");
    });

    it('Should get asset value from amount', async () => {
        SampleToken1PriceAggregator = await AggregatorContract.new(18, {from: owner});

        await HoldefiPrices.setPriceAggregator(
            SampleToken1.address,
            await SampleToken1.decimals(),
            SampleToken1PriceAggregator.address,
            {from: owner}
        );


        let price = await convertToDecimals(SampleToken1PriceAggregator, 1/200);
        await SampleToken1PriceAggregator.setPrice(price, {from: owner});
        let valueDecimals = await HoldefiPrices.valueDecimals();
        let priceObject = await HoldefiPrices.getPrice(SampleToken1.address);
        let tokenDecimals = await SampleToken1.decimals();
        let dec = bigNumber(valueDecimals).minus(tokenDecimals).minus(priceObject.priceDecimals).toString();
        let dec2 = bigNumber(10).pow(dec);
        let value = await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, await convertToDecimals(SampleToken1, 100));
        assert.equal(bigNumber(price).multipliedBy(await convertToDecimals(SampleToken1, 100)).multipliedBy(dec2).toString(), value.toString());
    });

    it('Should get amount from asset value', async () => {
        SampleToken1PriceAggregator = await AggregatorContract.new(18, {from: owner});

        await HoldefiPrices.setPriceAggregator(
            SampleToken1.address,
            await SampleToken1.decimals(),
            SampleToken1PriceAggregator.address,
            {from: owner}
        );


        let price = await convertToDecimals(SampleToken1PriceAggregator, 1/200);
        await SampleToken1PriceAggregator.setPrice(price, {from: owner});
        let valueDecimals = await HoldefiPrices.valueDecimals();
        let priceObject = await HoldefiPrices.getPrice(SampleToken1.address);
        let tokenDecimals = await SampleToken1.decimals();
        let dec = bigNumber(valueDecimals).minus(tokenDecimals).minus(priceObject.priceDecimals).toString();
        let dec2 = bigNumber(10).pow(dec);
        let amount = await HoldefiPrices.getAssetAmountFromValue(SampleToken1.address, bigNumber(price).multipliedBy(await convertToDecimals(SampleToken1, 400)).toString());
        assert.equal(bigNumber(await convertToDecimals(SampleToken1, 400)).dividedToIntegerBy(dec2).toString(), amount.toString());
    });

    it('Fail if try to add ETH', async () => {
        PriceAggregator = await AggregatorContract.new(18, {from: owner});
        await expectRevert(
            HoldefiPrices.setPriceAggregator(ethAddress, 18, PriceAggregator.address, {from: owner}),
            "Asset should not be ETH");
    });

    it('Fail if other accounts set aggregator', async () => {
        SampleToken = await SampleTokenContract.new("SampleToken", "ST", 8, {from: owner});
        SampleTokenPriceAggregator = await AggregatorContract.new(18, {from: owner});
        await expectRevert(
            HoldefiPrices.setPriceAggregator(
                SampleToken.address,
                await SampleToken.decimals(),
                SampleTokenPriceAggregator.address,
                {from: user1}
            ),
            "Sender should be owner");
    });

    it('Fail if send ETH to contract', async () => {
        await expectRevert(HoldefiPrices.send(decimal18.multipliedBy(0.5)),
          "revert");
    });    

    it('Fail if get price of a zero-value token', async () => {
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