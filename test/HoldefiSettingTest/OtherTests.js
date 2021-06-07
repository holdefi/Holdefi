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

contract('HoldefiSettings', function([owner, user1, user2, user3, user4, user5, user6]){
    
    describe("Set Holdefi Contract Address", async() =>{
        beforeEach(async () => {
            await initializeContracts(owner);
        });

        it('Initialize works as expected', async () => {
            let holdefiContract_interestRatesAddress = await Holdefi.holdefiSettings.call();
            assert.equal(HoldefiSettings.address, holdefiContract_interestRatesAddress);

            let interestRates_holdefiContractAddress = await HoldefiSettings.holdefiContract.call();
            assert.equal(Holdefi.address, interestRates_holdefiContractAddress);
        });

        it('Fail if try to call setHoldefiContract with wrong contract address', async () => {
            HoldefiSettings2 = await HoldefiSettingsContract.new({from: owner});
            Holdefi2 = await HoldefiContract.new(HoldefiSettings2.address, HoldefiPrices.address, {from: owner});

            await expectRevert(HoldefiSettings.setHoldefiContract(Holdefi2.address, {from: owner}),
                "SE03");
        });

        it('Fail if try to call setHoldefiContract more than one time', async () => {
            await expectRevert(HoldefiSettings.setHoldefiContract(Holdefi.address, {from: owner}), "SE04");
        });

        it('Fail if send ETH to contract', async () =>{
            await expectRevert(HoldefiSettings.send(decimal18.multipliedBy(0.5)),
                "revert");
        });
    });
    
    describe("Get interests (supplyRate and borrowRate)", async() =>{
        beforeEach(async () => {
            await scenario(owner,user1,user2,user3,user4);
            await time.increase(time.duration.days(7));
        });

        it('Supply rate should be 0 if there is no supply and borrow', async () => {
            await HoldefiSettings.addMarket(
                SampleToken2.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8));
            
            let interests = await HoldefiSettings.getInterests(SampleToken2.address, {from: owner});
            assert.equal(interests.supplyRateBase.toString(), 0, "Supply rate set");
        });

        it('Supply rate should be calculated correctly if suppliersShareRate is 100%', async () => {
            await HoldefiSettings.setBorrowRate(SampleToken1.address, ratesDecimal.multipliedBy(0.15), {from: owner});
            await HoldefiSettings.setSuppliersShareRate(
                SampleToken1.address, ratesDecimal.multipliedBy(1), {from: owner});
            let getMarket = await Holdefi.marketAssets(SampleToken1.address);

            let interests = await HoldefiSettings.getInterests(SampleToken1.address, {from: owner});

            let supplyRate = bigNumber(getMarket.totalBorrow)
                            .multipliedBy(interests.borrowRate)
                            .dividedToIntegerBy(getMarket.totalSupply);
            assert.equal(interests.supplyRateBase.toString(), supplyRate.toString());
        });
    });

    describe("Reset promotion rate", async() =>{
        beforeEach(async () =>{
            await scenario(owner,user1,user2,user3,user4);
        })

        it('Fail if an account calls setPromotionRate', async () => {
            await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1),{from: owner});
            await expectRevert(HoldefiSettings.resetPromotionRate(SampleToken1.address, {from: user1}),
                'SE06');
        })
    })
});
