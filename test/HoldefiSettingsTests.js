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
    addStableCoinMarket,
    addETHMarket,
    addERC20Collateral,
    scenario
} = require ("./Utils.js");

contract('HoldefiSettings', function([owner,ownerChanger,user1,user2,user3,user4,user5,user6]){
    
    describe("Set Holdefi Contract", async() =>{
        beforeEach(async () => {
            await initializeContracts(owner,ownerChanger);
        });

        it('Initialize works as expected', async () => {
            let holdefiContract_interestRatesAddress = await Holdefi.holdefiSettings.call();
            assert.equal(HoldefiSettings.address, holdefiContract_interestRatesAddress);

            let interestRates_holdefiContractAddress = await HoldefiSettings.holdefiContract.call();
            assert.equal(Holdefi.address, interestRates_holdefiContractAddress);
        });

        it('Fail if try to change holdefi contract address', async () => {
            await expectRevert(HoldefiSettings.setHoldefiContract(SampleToken1.address, {from: owner}),
                "Should be set once");
        });

        it('Fail if send ETH to contract', async () =>{
            await expectRevert(HoldefiSettings.send(decimal18.multipliedBy(0.5)),
                "revert");
        });
    });
    
    describe("Get interests (supplyRate and borrowRate)", async() =>{
        beforeEach(async () => {
            await initializeContracts(owner,ownerChanger);
            await HoldefiSettings.addMarket(SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8));
            await time.increase(time.duration.days(10));
        });

        it('Supply rate should be 0 if no supply', async () => {
            await HoldefiSettings.setBorrowRate(SampleToken1.address, ratesDecimal.multipliedBy(0.15), {from: owner});

            let interests = await HoldefiSettings.getInterests(SampleToken1.address, 0, 0, {from: owner});
            assert.equal(interests.supplyRate.toString(), 0, "Supply rate set");
        });

        it('Supply rate should be 0 if no borrow', async () => {
            await HoldefiSettings.setBorrowRate(SampleToken1.address, ratesDecimal.multipliedBy(0.15), {from: owner});

            let interests = await HoldefiSettings.getInterests(SampleToken1.address, decimal18.multipliedBy(50), 0, {from: owner});
            assert.equal(interests.supplyRate.toString(), 0, "Supply rate set");
        });

        it('Supply rate should be calculated correctly if suppliersShareRate is 100%', async () => {
            await HoldefiSettings.setBorrowRate(SampleToken1.address, ratesDecimal.multipliedBy(0.15), {from: owner});
            await HoldefiSettings.setSuppliersShareRate(SampleToken1.address, ratesDecimal.multipliedBy(1), {from: owner});
            let totalSupply = decimal18.multipliedBy(50);
            let totalBorrow = decimal18.multipliedBy(20);

            let interests = await HoldefiSettings.getInterests(SampleToken1.address, totalSupply, totalBorrow, {from: owner});
            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;

            let supplyRate = totalBorrow.multipliedBy(interests.borrowRate).dividedToIntegerBy(totalSupply);
            assert.equal(interests.supplyRate.toString(), supplyRate.toString());
        });
    });

    describe("Add market", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner, ownerChanger);
        })

        it('Add market by owner',async () =>{
            await HoldefiSettings.addMarket(SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8));                  
            let marketFeatures = await HoldefiSettings.marketAssets(SampleToken1.address);  
            assert.isTrue(marketFeatures.isActive);
            assert.equal(marketFeatures.borrowRate.toString(), ratesDecimal.multipliedBy(0.1).toString());
            assert.equal(marketFeatures.suppliersShareRate.toString(), ratesDecimal.multipliedBy(0.8).toString());
        })

        it('Fail if market added by other accounts',async () =>{
            await expectRevert(HoldefiSettings.addMarket(SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8),{from: user1}),
                "Sender should be Owner");                  
        })

        it('Fail if market exists',async () =>{
            await HoldefiSettings.addMarket(SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8));                  
            await expectRevert(HoldefiSettings.addMarket(SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8)),
                "Market exists");                  
        })       
    })

    describe("Remove market", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner, ownerChanger);
            await HoldefiSettings.addMarket(SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8));
        })

        it('Remove market by owner',async () =>{
            await HoldefiSettings.removeMarket(SampleToken1.address);                                   
            let marketFeatures = await HoldefiSettings.marketAssets(SampleToken1.address);  
            assert.isFalse(marketFeatures.isActive);
        })

        it('Fail if market removed by other accounts',async () =>{
            await expectRevert(HoldefiSettings.removeMarket(SampleToken1.address,{from: user1}),
                "Sender should be Owner");                  
        })
    })

    describe("Setting suppliersShareRate", async() =>{
        beforeEach(async () =>{
            await scenario(owner,ownerChanger,user1,user2,user3,user4);
            this.minSuppliersShareRate = await HoldefiSettings.minSuppliersShareRate.call();
            this.suppliersShareRateMaxDecrease = await HoldefiSettings.suppliersShareRateMaxDecrease.call();
            await time.increase(time.duration.days(10));
        })
        
        it('suppliersShareRate should be set if increased', async () => {
            await HoldefiSettings.setSuppliersShareRate(SampleToken1.address, ratesDecimal.multipliedBy(1), {from: owner});
            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            assert.equal(suppliersShareRate.toString(), ratesDecimal.multipliedBy(1).toString());
        });

        it('suppliersShareRate should be set if decreased less than maxDecrease', async () => {
            await HoldefiSettings.setSuppliersShareRate(SampleToken1.address, ratesDecimal.multipliedBy(0.85), {from: owner});
            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            assert.equal(suppliersShareRate.toString(), ratesDecimal.multipliedBy(0.85).toString());
        });

        it('Supply interest should be changed after changing suppliersShareRate', async () => {
            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            await assignToken(owner, user5, SampleToken1);
            await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
            let time1 = await time.latest();
            let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getInterestsBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
            await HoldefiSettings.setSuppliersShareRate(SampleToken1.address, bigNumber(suppliersShareRate).multipliedBy(1.05), {from: owner});
            let time2 = await time.latest();
            let getInterestsAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
            let time3 = await time.latest();
            await Holdefi.updatePromotionReserve(SampleToken1.address);
            let time4 = await time.latest();
            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);


            let interestScaled1 = bigNumber(time2-time1).multipliedBy(getAccountSupply.balance).multipliedBy(getInterestsBefore.supplyRate);
            let interestScaled2 = bigNumber(time3-time2).multipliedBy(getAccountSupply.balance).multipliedBy(getInterestsAfter.supplyRate);
            let totalInterest = interestScaled1.plus(interestScaled2).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

            let reserveInterestScaled1 = bigNumber(time2-time1).multipliedBy((bigNumber(getMarketBefore.totalBorrow).multipliedBy(getInterestsBefore.borrowRate)).minus(bigNumber(getMarketBefore.totalSupply).multipliedBy(getInterestsBefore.supplyRate)));
            let reserveInterestScaled2 = bigNumber(time4-time2).multipliedBy((bigNumber(getMarketAfter.totalBorrow).multipliedBy(getInterestsAfter.borrowRate)).minus(bigNumber(getMarketAfter.totalSupply).multipliedBy(getInterestsAfter.supplyRate)));
            let totalReserveScaled = bigNumber(getMarketBefore.promotionReserveScaled).plus(reserveInterestScaled1).plus(reserveInterestScaled2)

            let supplyRateAfter = bigNumber(getMarketBefore.totalBorrow).multipliedBy(getInterestsBefore.borrowRate).multipliedBy(suppliersShareRate).multipliedBy(1.05).dividedToIntegerBy(ratesDecimal).dividedToIntegerBy(getMarketBefore.totalSupply);

            assert.equal(getInterestsAfter.supplyRate.toString(), supplyRateAfter.toString(), 'Supply Rate increased');
            assert.equal(getAccountSupply.interest.toString(), totalInterest.toString(), 'Supply interest increased correctly');
            assert.equal(getMarketAfter.promotionReserveScaled.toString(),totalReserveScaled.toString(), 'Promotion Reserve increased correctly');
        });


        it('Fail if called by other accounts',async () =>{
            await expectRevert(HoldefiSettings.setSuppliersShareRate(SampleToken1.address, ratesDecimal.multipliedBy(0.9), {from: user1}),
                "Sender should be Owner");
        })
        
        it('Fail if new_suppliersShareRate > MAX', async () => {
            let newSuppliersShareRate = ratesDecimal.plus(10);
            await expectRevert(HoldefiSettings.setSuppliersShareRate(SampleToken1.address, newSuppliersShareRate, {from: owner}),
                "Rate should be in allowed range");
        })

        it('Fail if new_suppliersShareRate < MIN', async () => {
            let newSuppliersShareRate = bigNumber(minSuppliersShareRate).minus(10);
            await expectRevert(HoldefiSettings.setSuppliersShareRate(SampleToken1.address, newSuppliersShareRate, {from: owner}),
                "Rate should be in allowed range");
        })
        
        it('Fail if try to decrease suppliersShareRate in less than 10 days', async () => {
            await HoldefiSettings.setSuppliersShareRate(SampleToken1.address, ratesDecimal.multipliedBy(0.9), {from: owner});
            await time.increase(time.duration.days(5));
            await expectRevert(HoldefiSettings.setSuppliersShareRate(SampleToken1.address, ratesDecimal.multipliedBy(0.85), {from: owner}),
                "Decreasing rate is not allowed at this time");
        });
        
        it('Fail if new_suppliersShareRate < (suppliersShareRate - maxDecrease)', async () => {
            let suppliersShareRate = ratesDecimal.multipliedBy(0.9);
            await HoldefiSettings.setSuppliersShareRate(SampleToken1.address, suppliersShareRate, {from: owner});
            await time.increase(time.duration.days(10));
            let newSuppliersShareRate = suppliersShareRate.minus(suppliersShareRateMaxDecrease).minus(10);
            await expectRevert(HoldefiSettings.setSuppliersShareRate(SampleToken1.address, newSuppliersShareRate, {from: owner}),
                "Rate should be decreased less than max allowed");
        });
        
    })
    
    describe("Setting borrowRate", async() =>{
        beforeEach(async () =>{
            await scenario(owner,ownerChanger,user1,user2,user3,user4);
            this.maxBorrowRate = await HoldefiSettings.maxBorrowRate.call();
            this.borrowRateMaxIncrease = await HoldefiSettings.borrowRateMaxIncrease.call();
        })

        it('borrowRate should be set if decreased', async () => {
            await time.increase(time.duration.days(10));
            await HoldefiSettings.setBorrowRate(SampleToken1.address, ratesDecimal.multipliedBy(0.01), {from: owner});

            let getInterests = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
            let getMarket = await Holdefi.marketAssets(SampleToken1.address);
            assert.equal(getInterests.borrowRate.toString(), ratesDecimal.multipliedBy(0.01).toString(), "Borrow rate set");

            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            let supplyRate = bigNumber(getMarket.totalBorrow).multipliedBy(getInterests.borrowRate).multipliedBy(suppliersShareRate).dividedToIntegerBy(ratesDecimal).dividedToIntegerBy(getMarket.totalSupply);
            assert.equal(getInterests.supplyRate.toString(), supplyRate.toString(), "Supply rate set");
        });

        it('borrowRate should be set if increased less than maxIncrease', async () => {
            await time.increase(time.duration.days(10));
            await HoldefiSettings.setBorrowRate(SampleToken1.address, ratesDecimal.multipliedBy(0.15), {from: owner});

            let getInterests = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
            let getMarket = await Holdefi.marketAssets(SampleToken1.address);
            assert.equal(getInterests.borrowRate.toString(), ratesDecimal.multipliedBy(0.15).toString(), "Borrow rate set");

            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            let supplyRate = bigNumber(getMarket.totalBorrow).multipliedBy(getInterests.borrowRate).multipliedBy(suppliersShareRate).dividedToIntegerBy(ratesDecimal).dividedToIntegerBy(getMarket.totalSupply);
            assert.equal(getInterests.supplyRate.toString(), supplyRate.toString(), "Supply rate set");
        });

        it('Supply interest should be changed after changing borrowRate', async () => {
            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            await assignToken(owner, user5, SampleToken1);
            await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
            let time1 = await time.latest();
            let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getInterestsBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
            await HoldefiSettings.setBorrowRate(SampleToken1.address, bigNumber(getInterestsBefore.borrowRate).multipliedBy(1.05), {from: owner});
            let time2 = await time.latest();
            let getInterestsAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
            let time3 = await time.latest();
            await Holdefi.updatePromotionReserve(SampleToken1.address);
            let time4 = await time.latest();
            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

            let interestScaled1 = bigNumber(time2-time1).multipliedBy(getAccountSupply.balance).multipliedBy(getInterestsBefore.supplyRate);
            let interestScaled2 = bigNumber(time3-time2).multipliedBy(getAccountSupply.balance).multipliedBy(getInterestsAfter.supplyRate);
            let totalInterest = interestScaled1.plus(interestScaled2).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

            let reserveInterestScaled1 = bigNumber(time2-time1).multipliedBy((bigNumber(getMarketBefore.totalBorrow).multipliedBy(getInterestsBefore.borrowRate)).minus(bigNumber(getMarketBefore.totalSupply).multipliedBy(getInterestsBefore.supplyRate)));
            let reserveInterestScaled2 = bigNumber(time4-time2).multipliedBy((bigNumber(getMarketAfter.totalBorrow).multipliedBy(getInterestsAfter.borrowRate)).minus(bigNumber(getMarketAfter.totalSupply).multipliedBy(getInterestsAfter.supplyRate)));
            let totalReserveScaled = bigNumber(getMarketBefore.promotionReserveScaled).plus(reserveInterestScaled1).plus(reserveInterestScaled2)
            
            let supplyRateAfter = bigNumber(getMarketBefore.totalBorrow).multipliedBy(getInterestsBefore.borrowRate).multipliedBy(1.05).multipliedBy(suppliersShareRate).dividedToIntegerBy(ratesDecimal).dividedToIntegerBy(getMarketBefore.totalSupply);

            assert.equal(getInterestsAfter.supplyRate.toString(), supplyRateAfter.toString(), 'Supply Rate increased');
            assert.equal(getAccountSupply.interest.toString(), totalInterest.toString(), 'Supply interest increased correctly');
            assert.equal(getMarketAfter.promotionReserveScaled.toString(),totalReserveScaled.toString(), 'Promotion Reserve increased correctly')
        });

        it('Borrow interest should be changed after changing borrowRate', async () => {
            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
            await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(5), {from: user5});
            let time1 = await time.latest();
            let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getInterestsBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
            await HoldefiSettings.setBorrowRate(SampleToken1.address, bigNumber(getInterestsBefore.borrowRate).multipliedBy(1.05), {from: owner});
            let time2 = await time.latest();
            let getInterestsAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getAccountBorrow = await Holdefi.getAccountBorrow(user5,SampleToken1.address, constants.ZERO_ADDRESS);
            let time3 = await time.latest();
            await Holdefi.updatePromotionReserve(SampleToken1.address);
            let time4 = await time.latest();
            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

            let interestScaled1 = bigNumber(time2-time1).multipliedBy(getAccountBorrow.balance).multipliedBy(getInterestsBefore.borrowRate);
            let interestScaled2 = bigNumber(time3-time2).multipliedBy(getAccountBorrow.balance).multipliedBy(getInterestsAfter.borrowRate);
            let totalInterest = interestScaled1.plus(interestScaled2).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

            let reserveInterestScaled1 = bigNumber(time2-time1).multipliedBy((bigNumber(getMarketBefore.totalBorrow).multipliedBy(getInterestsBefore.borrowRate)).minus(bigNumber(getMarketBefore.totalSupply).multipliedBy(getInterestsBefore.supplyRate)));
            let reserveInterestScaled2 = bigNumber(time4-time2).multipliedBy((bigNumber(getMarketAfter.totalBorrow).multipliedBy(getInterestsAfter.borrowRate)).minus(bigNumber(getMarketAfter.totalSupply).multipliedBy(getInterestsAfter.supplyRate)));
            let totalReserveScaled = bigNumber(getMarketBefore.promotionReserveScaled).plus(reserveInterestScaled1).plus(reserveInterestScaled2)
            
            let supplyRateAfter = bigNumber(getMarketBefore.totalBorrow).multipliedBy(getInterestsBefore.borrowRate).multipliedBy(1.05).multipliedBy(suppliersShareRate).dividedToIntegerBy(ratesDecimal).dividedToIntegerBy(getMarketBefore.totalSupply);

            assert.equal(getInterestsAfter.supplyRate.toString(), supplyRateAfter.toString(), 'Supply Rate increased');
            assert.equal(getAccountBorrow.interest.toString(), totalInterest.toString(), 'Borrow interest increased correctly')
            assert.equal(getMarketAfter.promotionReserveScaled.toString(),totalReserveScaled.toString(), 'Promotion Reserve increased correctly');
        });


        it('Fail if called by other accounts',async () =>{
            await expectRevert(HoldefiSettings.setBorrowRate(SampleToken1.address, ratesDecimal.multipliedBy(0.15), {from: user1}),
                "Sender should be Owner");
        })

        it('Fail if new_borrowRate > MAX', async () => {
            let newBorrowRate = bigNumber(maxBorrowRate).plus(10);
            await expectRevert(HoldefiSettings.setBorrowRate(SampleToken1.address, newBorrowRate,{from: owner}),
                "Rate should be less than max");
        });

        it('Fail if try to increase borrowRate in less than 10 days', async () => {
            await time.increase(time.duration.days(10));
            await HoldefiSettings.setBorrowRate(SampleToken1.address,ratesDecimal.multipliedBy(0.1) ,{from: owner});
            await time.increase(time.duration.days(5));
            await expectRevert(HoldefiSettings.setBorrowRate(SampleToken1.address,ratesDecimal.multipliedBy(0.12) ,{from: owner}),
                "Increasing rate is not allowed at this time");
        });

        it('Fail if new_borrowRate > (borrowRate + maxIncrease)', async () => {
            await time.increase(time.duration.days(10));
            let borrowRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).borrowRate;
            let newBorrowRate = bigNumber(borrowRate).plus(borrowRateMaxIncrease).plus(10);
            await expectRevert(HoldefiSettings.setBorrowRate(SampleToken1.address, newBorrowRate, {from: owner}),
                "Rate should be increased less than max allowed");
        });
    });

    describe("Add collateral", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner, ownerChanger);
        })

        it('Add collateral by owner',async () =>{
            await HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05));
            let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.equal(collateralFeatures.valueToLoanRate.toString(), ratesDecimal.multipliedBy(1.5).toString());
            assert.equal(collateralFeatures.penaltyRate.toString(), ratesDecimal.multipliedBy(1.2).toString());
            assert.equal(collateralFeatures.bonusRate.toString(), ratesDecimal.multipliedBy(1.05).toString());
            assert.isTrue(collateralFeatures.isActive);
        })

        it('Fail if collateral added by other accounts',async () =>{
            await expectRevert(HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05) ,{from: user1}),
            "Sender should be Owner");
        })

        it('Fail if valueToLoanRate > MAX',async () =>{
            await expectRevert(
                HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(2.1), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05)),
                "Rate should be in allowed range");
        })

        it('Fail if penaltyRate > MAX',async () =>{
            await expectRevert(
                HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.4), ratesDecimal.multipliedBy(1.05)),
                "Rate should be in allowed range");
        })

        it('Fail if liquidationPenalty > valueToLoanRate',async () =>{
            await expectRevert(
                HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.05)),
                "Rate should be in allowed range");
        })

        it('Fail if liquidationBonus > liquidationPenalty',async () =>{
            await expectRevert(
                HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.05), ratesDecimal.multipliedBy(1.2)),
                "Rate should be in allowed range");
        })

        it('Fail if ratesDecimal > liquidationBonus',async () =>{
            await expectRevert(
                HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(0.9)),
                "Rate should be in allowed range");
        })

         it('Fail if collateral exists',async () =>{
            await HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05));
            await expectRevert(HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05)),
                "Collateral exists");
        })

    })

    describe("Remove collateral", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner, ownerChanger);
            await HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05));
        })

        it('Remove collateral by owner',async () =>{
            await HoldefiSettings.removeCollateral(SampleToken1.address);
            let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.isFalse(collateralFeatures.isActive);                        
        })

        it('Fail if collateral removed by other accounts',async () =>{
            await expectRevert(HoldefiSettings.removeCollateral(SampleToken1.address,{from: user1}),
                "Sender should be Owner");                  
        })
    })
    
    describe("Setting valueToLoanRate", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner, ownerChanger);
            this.maxValueToLoanRate = await HoldefiSettings.maxValueToLoanRate.call();
            this.valueToLoanRateMaxIncrease = await HoldefiSettings.valueToLoanRateMaxIncrease.call();

            this.valueToLoanRate = ratesDecimal.multipliedBy(1.4);
            this.penaltyRate = ratesDecimal.multipliedBy(1.2);
            this.bonusRate = ratesDecimal.multipliedBy(1.05);
            await addERC20Collateral(owner, SampleToken1.address, decimal18.multipliedBy(10), 
                valueToLoanRate, penaltyRate, bonusRate);
        })

        it('valueToLoanRate should be set if decreased',async () =>{
            await time.increase(time.duration.days(10));        
            await HoldefiSettings.setValueToLoanRate(SampleToken1.address, ratesDecimal.multipliedBy(1.22));
            let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.equal(collateralFeatures.valueToLoanRate.toString(), ratesDecimal.multipliedBy(1.22).toString());
        })

        it('valueToLoanRate should be set if increased less than maxIncrease',async () =>{
            await time.increase(time.duration.days(10));        
            await HoldefiSettings.setValueToLoanRate(SampleToken1.address, ratesDecimal.multipliedBy(1.45));
            let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.equal(collateralFeatures.valueToLoanRate.toString(), ratesDecimal.multipliedBy(1.45).toString());
        })

        it('Fail if valueToLoanRate set by other accounts',async () =>{ 
            await time.increase(time.duration.days(10));
            await expectRevert(HoldefiSettings.setValueToLoanRate(SampleToken1.address, ratesDecimal.multipliedBy(1.35), {from: user1}),
                "Sender should be Owner");
        })

        it('Fail if try to increase valueToLoanRate in less than 10 days',async () =>{
            await time.increase(time.duration.days(9));
            await expectRevert(HoldefiSettings.setValueToLoanRate(SampleToken1.address, ratesDecimal.multipliedBy(1.52)),
                "Increasing rate is not allowed at this time");        
        })

        it('Fail if new_valueToLoanRate > MAX',async () =>{
            let newVTL = valueToLoanRate;
            while (newVTL.isLessThanOrEqualTo(maxValueToLoanRate)) {
                await time.increase(time.duration.days(10));
                await HoldefiSettings.setValueToLoanRate(SampleToken1.address, newVTL);
                let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
                assert.equal(collateralFeatures.valueToLoanRate.toString(), newVTL.toString());
                newVTL = newVTL.plus(valueToLoanRateMaxIncrease);
            }

            await time.increase(time.duration.days(10));
            await expectRevert(HoldefiSettings.setValueToLoanRate(SampleToken1.address, newVTL),
                "Rate should be in allowed range");
        })

        it('Fail if new_valueToLoanRate < penaltyRate',async () =>{
            await time.increase(time.duration.days(10));
            let newVTL = penaltyRate.minus(10);
            await expectRevert(HoldefiSettings.setValueToLoanRate(SampleToken1.address, newVTL),
                "Rate should be in allowed range");
        })


        it('Fail if new_valueToLoanRate > (valueToLoanRate + maxIncrease)',async () =>{ 
            await time.increase(time.duration.days(10));
            let newVTL = valueToLoanRate.plus(valueToLoanRateMaxIncrease).plus(10);
            await expectRevert(HoldefiSettings.setValueToLoanRate(SampleToken1.address, newVTL),
                "Rate should be increased less than max allowed");       
        })
    
    })
    
    describe("Setting penaltyRate", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner, ownerChanger);
            this.maxPenaltyRate = await HoldefiSettings.maxPenaltyRate.call();
            this.penaltyRateMaxIncrease = await HoldefiSettings.penaltyRateMaxIncrease.call();

            this.valueToLoanRate = ratesDecimal.multipliedBy(1.4);
            this.penaltyRate = ratesDecimal.multipliedBy(1.2);
            this.bonusRateRate = ratesDecimal.multipliedBy(1.05);
            await addERC20Collateral(owner, SampleToken1.address, decimal18.multipliedBy(10), 
                valueToLoanRate, penaltyRate, bonusRate);
        })

        it('penaltyRate should be set if decreased',async () =>{
            await time.increase(time.duration.days(10));            
            await HoldefiSettings.setPenaltyRate(SampleToken1.address, ratesDecimal.multipliedBy(1.15));
            let collateralAssets = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.equal(collateralAssets.penaltyRate.toString(),ratesDecimal.multipliedBy(1.15).toString())
        })

        it('penaltyRate should be set if increased less than maxIncrease',async () =>{
            await time.increase(time.duration.days(10));            
            await HoldefiSettings.setPenaltyRate(SampleToken1.address, ratesDecimal.multipliedBy(1.25));
            let collateralAssets = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.equal(collateralAssets.penaltyRate.toString(),ratesDecimal.multipliedBy(1.25).toString())
        })

        it('Fail if penaltyRate set by other accounts',async () =>{
            await time.increase(time.duration.days(10));
            await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken1.address, ratesDecimal.multipliedBy(1.15), {from: user1}),
                "Sender should be Owner");      
        })

        it('Fail if try to increase penaltyRate changed less than 10 days',async () =>{
            await time.increase(time.duration.days(9));
            await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken1.address, ratesDecimal.multipliedBy(1.3)),
                "Increasing rate is not allowed at this time");
        })

        it('Fail if new_penaltyRate > MAX',async () =>{
            let newPenaltyRate = penaltyRate;
            while (newPenaltyRate.isLessThanOrEqualTo(maxPenaltyRate)) {
                await time.increase(time.duration.days(10));
                await HoldefiSettings.setValueToLoanRate(SampleToken1.address, newPenaltyRate);
                let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
                assert.equal(collateralFeatures.valueToLoanRate.toString(), newPenaltyRate.toString());
                newPenaltyRate = newPenaltyRate.plus(penaltyRateMaxIncrease);
            }

            await time.increase(time.duration.days(10));
            await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken1.address, newPenaltyRate),
                "Rate should be in allowed range");
        })

        it('Fail if new_penaltyRate < bonusRate',async () =>{
            await time.increase(time.duration.days(10));
            let newPenaltyRate = bonusRate.minus(10);
            await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken1.address, newPenaltyRate),
                "Rate should be in allowed range");
        })

        it('Fail if new_penaltyRate > valueToLoanRate',async () =>{ //temp
            let newPenaltyRate = penaltyRate;
            while (newPenaltyRate.isLessThanOrEqualTo(valueToLoanRate)) {
                await time.increase(time.duration.days(10));
                await HoldefiSettings.setValueToLoanRate(SampleToken1.address, newPenaltyRate);
                let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
                assert.equal(collateralFeatures.valueToLoanRate.toString(), newPenaltyRate.toString());
                newPenaltyRate = newPenaltyRate.plus(penaltyRateMaxIncrease);
            }

            await time.increase(time.duration.days(10));
            await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken1.address, newPenaltyRate),
                "Rate should be in allowed range");
        })

        it('Fail if new_penaltyRate > (penaltyRate + maxIncrease)',async () =>{ 
            await time.increase(time.duration.days(10));
            let newPenaltyRate = penaltyRate.plus(penaltyRateMaxIncrease).plus(10);
            await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken1.address, newPenaltyRate),
                "Rate should be increased less than max allowed");       
        })      
    })

    describe("Setting bonusRate", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner, ownerChanger);

            this.valueToLoanRate = ratesDecimal.multipliedBy(1.4);
            this.penaltyRate = ratesDecimal.multipliedBy(1.2);
            this.bonusRate = ratesDecimal.multipliedBy(1.05);
            await addERC20Collateral(owner, SampleToken1.address, decimal18.multipliedBy(10), 
                valueToLoanRate, penaltyRate, bonusRate);
        })
    
        it('bonusRate should be set',async () =>{   
            await HoldefiSettings.setBonusRate(SampleToken1.address, ratesDecimal.multipliedBy(1.1));
            let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.equal(collateralFeatures.bonusRate.toString(), ratesDecimal.multipliedBy(1.1).toString());       
        })

        it('Fail if bonusRate set by other accounts',async () =>{
            await expectRevert(HoldefiSettings.setBonusRate(SampleToken1.address, ratesDecimal.multipliedBy(1.1), {from: user1}),
                "Sender should be Owner");      
        })

        it('Fail if new_bonusRate > penaltyRate',async () =>{
            let newBonusRate = penaltyRate.plus(10); 
            await expectRevert(HoldefiSettings.setBonusRate(SampleToken1.address, newBonusRate),
                "Rate should be in allowed range");   
        })  

        it('Fail if new_bonusRate < ratesDecimal',async () =>{
            let newBonusRate = ratesDecimal.minus(10); 
            await expectRevert(HoldefiSettings.setBonusRate(SampleToken1.address, newBonusRate),
                "Rate should be in allowed range");       
        })  
    })
});
