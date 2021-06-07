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

contract('HoldefiSetting - Market', function([owner, user1, user2, user3, user4, user5, user6]){
    describe("Add market", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner);
        })

        it('Market should be added if owner calls addMarket',async () =>{
            await HoldefiSettings.addMarket(
                SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8)
            );                  
            let marketFeatures = await HoldefiSettings.marketAssets(SampleToken1.address);  
            assert.isTrue(marketFeatures.isActive);
            assert.equal(marketFeatures.borrowRate.toString(), ratesDecimal.multipliedBy(0.1).toString());
            assert.equal(marketFeatures.suppliersShareRate.toString(), ratesDecimal.multipliedBy(0.8).toString());
        })

        it('Fail if a non-owner account calls addMarket',async () =>{
            await expectRevert(HoldefiSettings.addMarket(
                    SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8),{from: user1}),
                "OE01");                  
        })

        it('Fail if try to call addMarket for already added market',async () =>{
            await HoldefiSettings.addMarket(
                SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8));                  
            await expectRevert(HoldefiSettings.addMarket(
                    SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8)),
                "SE08");                  
        })

        it('Fail if borrowRate > Max',async () =>{
            await expectRevert(HoldefiSettings.addMarket(
                    SampleToken1.address, ratesDecimal.multipliedBy(0.5), ratesDecimal.multipliedBy(0.8),{from: owner}),
                "SE05");                  
        })

        it('Fail if suppliersShareRate < Min',async () =>{
            await expectRevert(HoldefiSettings.addMarket(
                    SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.4),{from: owner}),
                "SE05");                  
        })  

        it('Fail if suppliersShareRate > Max',async () =>{
            await expectRevert(HoldefiSettings.addMarket(
                    SampleToken1.address, ratesDecimal.multipliedBy(0.5), ratesDecimal.multipliedBy(1.1),{from: owner}),
                "SE05");                  
        })   
    })

    describe("Remove market", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner);
            await HoldefiSettings.addMarket(
                SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8));
            await HoldefiSettings.addMarket(
                SampleToken2.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8));
            await HoldefiSettings.addMarket(
                SampleToken3.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8));
        })

        it('Market should be removed if owner calls removeMarket',async () =>{
            let marketList = await HoldefiSettings.getMarketsList();
            lengthBefore = marketList.length;
            await HoldefiSettings.removeMarket(SampleToken1.address); 

            let marketFeatures = await HoldefiSettings.marketAssets(SampleToken1.address);  
            assert.isFalse(marketFeatures.isActive);

            let marketList2 = await HoldefiSettings.getMarketsList();
            lengthAfter = marketList2.length;
            assert.equal(lengthAfter, lengthBefore-1);
        })

        it('Fail if a non-owner account calls removeMarket',async () =>{
            await expectRevert(HoldefiSettings.removeMarket(SampleToken1.address,{from: user1}),
                "OE01");                  
        })

        it('Fail if try to call removeMarket for a market where not added before',async () =>{
            await expectRevert(HoldefiSettings.removeMarket(SampleToken4.address,{from: owner}),
                "SE01");                  
        })

         it('Fail if try to call removeMarket for a market where its totalBorrow != 0',async () =>{
            await scenario(owner,user1,user2,user3,user4);
            await expectRevert(HoldefiSettings.removeMarket(SampleToken1.address,{from: owner}),
                "SE10");                  
        })
       
    })

    describe("Activate market", async() =>{
        beforeEach(async () => {
           await initializeContracts(owner);
           await HoldefiSettings.addMarket(
                SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8));
           await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
        })

        it('Market should be activated if owner calls activateMarket',async () =>{
            await HoldefiSettings.activateMarket(SampleToken1.address,{from:owner});
            let activate = await HoldefiSettings.marketAssets(SampleToken1.address);
            assert.isTrue(activate.isActive);
        })

        it('Fail if a non-owner account calls activateMarket',async () =>{
            await expectRevert(HoldefiSettings.activateMarket(SampleToken1.address,{from:user1}),
                'OE01');
        }) 

        it('Fail if try to call activateMarket for a market where not added before',async () =>{
            await expectRevert(HoldefiSettings.activateMarket(SampleToken4.address,{from:owner}),
                'SE01');
        })
    })

    describe("Deactivate market", async() =>{
        beforeEach(async () => {
            await initializeContracts(owner);
            await HoldefiSettings.addMarket(
                SampleToken1.address, ratesDecimal.multipliedBy(0.1), ratesDecimal.multipliedBy(0.8));
        })

        it('Market should be activated if owner calls deactivateMarket',async () =>{
            await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
            let activate = await HoldefiSettings.marketAssets(SampleToken1.address);
            assert.isFalse(activate.isActive);
        })

        it('Fail if a non-owner account calls deactivateMarket',async () =>{
            await expectRevert(HoldefiSettings.deactivateMarket(SampleToken1.address,{from:user1}),
                'OE01');
        })         

        it('Fail if try to call deactivateMarket for a market where not added before',async () =>{
            await expectRevert(HoldefiSettings.deactivateMarket(SampleToken4.address,{from:owner}),
                'SE01');
        })   
    })

    describe("Set suppliersShareRate", async() =>{
        beforeEach(async () =>{
            await scenario(owner, user1, user2, user3, user4);
            minSuppliersShareRate = bigNumber(5000);
            suppliersShareRateMaxDecrease = bigNumber(500);
            await time.increase(time.duration.days(7));
        })
        
        it('The new suppliersShareRate for a market should be set if is more than the old one', async () => {
            await HoldefiSettings.setSuppliersShareRate(
                SampleToken1.address,
                ratesDecimal.multipliedBy(1),
                {from: owner}
            );
            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            assert.equal(suppliersShareRate.toString(), ratesDecimal.multipliedBy(1).toString());
        });

        it('The new suppliersShareRate for a market should be set if decreased less than the maxDecrease', async () => {
            await HoldefiSettings.setSuppliersShareRate(
                SampleToken1.address,
                ratesDecimal.multipliedBy(0.85),
                {from: owner}
            );
            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            assert.equal(suppliersShareRate.toString(), ratesDecimal.multipliedBy(0.85).toString());
        });

        it('Supply interest should be changed after changing the suppliersShareRate', async () => {
            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            await assignToken(owner, user5, SampleToken1);
            await Holdefi.methods['supply(address,uint256,uint16)'](
                SampleToken1.address,
                await convertToDecimals(SampleToken1, 20),
                referralCode,
                {from:user5}
            );
            let time1 = await time.latest();
            let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getBorrowInterestsBefore = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
            let getSupplyInterestsBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
            await HoldefiSettings.setSuppliersShareRate(
                SampleToken1.address, bigNumber(suppliersShareRate).multipliedBy(1.05), {from: owner});
            let time2 = await time.latest();
            let getBorrowInterestsAfter = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
            let getSupplyInterestsAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
            let time3 = await time.latest();
            await Holdefi.beforeChangeSupplyRate(SampleToken1.address);
            let time4 = await time.latest();
            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);


            let interestScaled1 = bigNumber(time2-time1).multipliedBy(getAccountSupply.balance).multipliedBy(getSupplyInterestsBefore.supplyRate);
            let interestScaled2 = bigNumber(time3-time2).multipliedBy(getAccountSupply.balance).multipliedBy(getSupplyInterestsAfter.supplyRate);
            let totalInterest = interestScaled1.plus(interestScaled2).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

            let reserveInterestScaled1 = bigNumber(time2-time1).multipliedBy((bigNumber(getMarketBefore.totalBorrow).multipliedBy(getBorrowInterestsBefore.borrowRate)).minus(bigNumber(getMarketBefore.totalSupply).multipliedBy(getSupplyInterestsBefore.supplyRate)));
            let reserveInterestScaled2 = bigNumber(time4-time2).multipliedBy((bigNumber(getMarketAfter.totalBorrow).multipliedBy(getBorrowInterestsAfter.borrowRate)).minus(bigNumber(getMarketAfter.totalSupply).multipliedBy(getSupplyInterestsAfter.supplyRate)));
            let totalReserveScaled = bigNumber(getMarketBefore.promotionReserveScaled).plus(reserveInterestScaled1).plus(reserveInterestScaled2)

            let supplyRateAfter = bigNumber(getMarketBefore.totalBorrow).multipliedBy(getBorrowInterestsBefore.borrowRate).multipliedBy(suppliersShareRate).multipliedBy(1.05).dividedToIntegerBy(ratesDecimal).dividedToIntegerBy(getMarketBefore.totalSupply);

            assert.equal(getSupplyInterestsAfter.supplyRate.toString(), supplyRateAfter.toString(), 'Supply Rate increased');
            assert.equal(getAccountSupply.interest.toString(), totalInterest.toString(), 'Supply interest increased correctly');
            assert.equal(getMarketAfter.promotionReserveScaled.toString(),totalReserveScaled.toString(), 'Promotion Reserve increased correctly');
        });


        it('Fail if a non-owner account calls setSuppliersShareRate',async () =>{
            await expectRevert(HoldefiSettings.setSuppliersShareRate(
                SampleToken1.address, ratesDecimal.multipliedBy(0.9), {from: user1}),
            "OE01");
        })
        
        it('Fail if new_suppliersShareRate > MAX', async () => {
            let newSuppliersShareRate = ratesDecimal.plus(10);
            await expectRevert(HoldefiSettings.setSuppliersShareRate(
                SampleToken1.address, newSuppliersShareRate, {from: owner}),
            "SE05");
        })

        it('Fail if new_suppliersShareRate < MIN', async () => {
            let newSuppliersShareRate = bigNumber(minSuppliersShareRate).minus(10);
            await expectRevert(
                HoldefiSettings.setSuppliersShareRate(SampleToken1.address, newSuppliersShareRate, {from: owner}),
            "SE05");
        })
        
        it('Fail if try to decrease suppliersShareRate in less than 7 days', async () => {
            await HoldefiSettings.setSuppliersShareRate(SampleToken1.address, ratesDecimal.multipliedBy(0.9), {from: owner});
            await time.increase(time.duration.days(5));
            await expectRevert(HoldefiSettings.setSuppliersShareRate(
                SampleToken1.address, ratesDecimal.multipliedBy(0.85), {from: owner}),
            "SE11");
        });
        
        it('Fail if new_suppliersShareRate < (suppliersShareRate - maxDecrease)', async () => {
            let suppliersShareRate = ratesDecimal.multipliedBy(0.9);
            await HoldefiSettings.setSuppliersShareRate(SampleToken1.address, suppliersShareRate, {from: owner});
            await time.increase(time.duration.days(7));
            let newSuppliersShareRate = suppliersShareRate.minus(suppliersShareRateMaxDecrease).minus(10);
            await expectRevert(HoldefiSettings.setSuppliersShareRate(
                SampleToken1.address, newSuppliersShareRate, {from: owner}),
            "SE12");
        });   
    })
    
    describe("Set borrowRate", async() =>{
        beforeEach(async () =>{
            await scenario(owner, user1, user2, user3, user4);
            maxBorrowRate = bigNumber(4000);
            borrowRateMaxIncrease = bigNumber(500);
        })

        it('The new borrowRate for a market should be set if is less than the old one', async () => {
            await time.increase(time.duration.days(7));
            await HoldefiSettings.setBorrowRate(SampleToken1.address, ratesDecimal.multipliedBy(0.01), {from: owner});

            let getBorrowInterests = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
            let getSupplyInterests = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
            let getMarket = await Holdefi.marketAssets(SampleToken1.address);
            assert.equal(getBorrowInterests.borrowRate.toString(), ratesDecimal.multipliedBy(0.01).toString(), "Borrow rate set");

            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            let supplyRate = bigNumber(getMarket.totalBorrow).multipliedBy(getBorrowInterests.borrowRate).multipliedBy(suppliersShareRate).dividedToIntegerBy(ratesDecimal).dividedToIntegerBy(getMarket.totalSupply);
            assert.equal(getSupplyInterests.supplyRate.toString(), supplyRate.toString(), "Supply rate set");
        });

        it('The new borrowRate for a market should be set if increased less than the maxIncrease', async () => {
            await time.increase(time.duration.days(7));
            await HoldefiSettings.setBorrowRate(SampleToken1.address, ratesDecimal.multipliedBy(0.15), {from: owner});

            let getBorrowInterests = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
            let getSupplyInterests = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
            let getMarket = await Holdefi.marketAssets(SampleToken1.address);
            assert.equal(getBorrowInterests.borrowRate.toString(), ratesDecimal.multipliedBy(0.15).toString(), "Borrow rate set");

            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            let supplyRate = bigNumber(getMarket.totalBorrow).multipliedBy(getBorrowInterests.borrowRate).multipliedBy(suppliersShareRate).dividedToIntegerBy(ratesDecimal).dividedToIntegerBy(getMarket.totalSupply);
            assert.equal(getSupplyInterests.supplyRate.toString(), supplyRate.toString(), "Supply rate set");
        });

        it('Supply interest should be changed after changing the borrowRate', async () => {
            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            await assignToken(owner, user5, SampleToken1);
            await Holdefi.methods['supply(address,uint256,uint16)'](
                SampleToken1.address,
                await convertToDecimals(SampleToken1, 20),
                referralCode,
                {from:user5}
            );
            let time1 = await time.latest();
            let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getBorrowInterestsBefore = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
            let getSupplyInterestsBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
            await HoldefiSettings.setBorrowRate(
                SampleToken1.address, bigNumber(getBorrowInterestsBefore.borrowRate).multipliedBy(1.05), {from: owner});
            let time2 = await time.latest();
            let getBorrowInterestsAfter = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
            let getSupplyInterestsAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getAccountSupply = await Holdefi.getAccountSupply(user5,SampleToken1.address);
            let time3 = await time.latest();
            await Holdefi.beforeChangeSupplyRate(SampleToken1.address);
            let time4 = await time.latest();
            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

            let interestScaled1 = bigNumber(time2-time1).multipliedBy(getAccountSupply.balance).multipliedBy(getSupplyInterestsBefore.supplyRate);
            let interestScaled2 = bigNumber(time3-time2).multipliedBy(getAccountSupply.balance).multipliedBy(getSupplyInterestsAfter.supplyRate);
            let totalInterest = interestScaled1.plus(interestScaled2).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

            let reserveInterestScaled1 = bigNumber(time2-time1).multipliedBy((bigNumber(getMarketBefore.totalBorrow).multipliedBy(getBorrowInterestsBefore.borrowRate)).minus(bigNumber(getMarketBefore.totalSupply).multipliedBy(getSupplyInterestsBefore.supplyRate)));
            let reserveInterestScaled2 = bigNumber(time4-time2).multipliedBy((bigNumber(getMarketAfter.totalBorrow).multipliedBy(getBorrowInterestsAfter.borrowRate)).minus(bigNumber(getMarketAfter.totalSupply).multipliedBy(getSupplyInterestsAfter.supplyRate)));
            let totalReserveScaled = bigNumber(getMarketBefore.promotionReserveScaled).plus(reserveInterestScaled1).plus(reserveInterestScaled2)
            
            let supplyRateAfter = bigNumber(getMarketBefore.totalBorrow).multipliedBy(getBorrowInterestsBefore.borrowRate).multipliedBy(1.05).multipliedBy(suppliersShareRate).dividedToIntegerBy(ratesDecimal).dividedToIntegerBy(getMarketBefore.totalSupply);

            assert.equal(getSupplyInterestsAfter.supplyRate.toString(), supplyRateAfter.toString(), 'Supply Rate increased');
            assert.equal(getAccountSupply.interest.toString(), totalInterest.toString(), 'Supply interest increased correctly');
            assert.equal(getMarketAfter.promotionReserveScaled.toString(),totalReserveScaled.toString(), 'Promotion Reserve increased correctly')
        });

        it('Borrow interest should be changed after changing the borrowRate', async () => {
            let suppliersShareRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).suppliersShareRate;
            await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
            await Holdefi.borrow(
                SampleToken1.address,
                ethAddress,
                await convertToDecimals(SampleToken1, 5),
                referralCode,
                {from: user5});
            let time1 = await time.latest();
            let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getBorrowInterestsBefore = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
            let getSupplyInterestsBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

            await HoldefiSettings.setBorrowRate(
                SampleToken1.address, bigNumber(getBorrowInterestsBefore.borrowRate).multipliedBy(1.05), {from: owner});
            let time2 = await time.latest();
            let getBorrowInterestsAfter = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
            let getSupplyInterestsAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getAccountBorrow = await Holdefi.getAccountBorrow(user5,SampleToken1.address, ethAddress);
            let time3 = await time.latest();
            await Holdefi.beforeChangeSupplyRate(SampleToken1.address);
            let time4 = await time.latest();
            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

            let interestScaled1 = bigNumber(time2-time1).multipliedBy(getAccountBorrow.balance).multipliedBy(getBorrowInterestsBefore.borrowRate);
            let interestScaled2 = bigNumber(time3-time2).multipliedBy(getAccountBorrow.balance).multipliedBy(getBorrowInterestsAfter.borrowRate);
            let totalInterest = interestScaled1.plus(interestScaled2).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

            let reserveInterestScaled1 = bigNumber(time2-time1).multipliedBy((bigNumber(getMarketBefore.totalBorrow).multipliedBy(getBorrowInterestsBefore.borrowRate)).minus(bigNumber(getMarketBefore.totalSupply).multipliedBy(getSupplyInterestsBefore.supplyRate)));
            let reserveInterestScaled2 = bigNumber(time4-time2).multipliedBy((bigNumber(getMarketAfter.totalBorrow).multipliedBy(getBorrowInterestsAfter.borrowRate)).minus(bigNumber(getMarketAfter.totalSupply).multipliedBy(getSupplyInterestsAfter.supplyRate)));
            let totalReserveScaled = bigNumber(getMarketBefore.promotionReserveScaled).plus(reserveInterestScaled1).plus(reserveInterestScaled2)
            
            let supplyRateAfter = bigNumber(getMarketBefore.totalBorrow).multipliedBy(getBorrowInterestsBefore.borrowRate).multipliedBy(1.05).multipliedBy(suppliersShareRate).dividedToIntegerBy(ratesDecimal).dividedToIntegerBy(getMarketBefore.totalSupply);

            assert.equal(getSupplyInterestsAfter.supplyRate.toString(), supplyRateAfter.toString(), 'Supply Rate increased');
            assert.equal(getAccountBorrow.interest.toString(), totalInterest.toString(), 'Borrow interest increased correctly')
            assert.equal(getMarketAfter.promotionReserveScaled.toString(),totalReserveScaled.toString(), 'Promotion Reserve increased correctly');
        });


        it('Fail if a non-owner account calls setBorrowRate',async () =>{
            await expectRevert(HoldefiSettings.setBorrowRate(
                SampleToken1.address, ratesDecimal.multipliedBy(0.15), {from: user1}),
            "OE01");
        })

        it('Fail if new_borrowRate > MAX', async () => {
            let newBorrowRate = bigNumber(maxBorrowRate).plus(10);
            await expectRevert(
                HoldefiSettings.setBorrowRate(SampleToken1.address, newBorrowRate,{from: owner}),
            "SE05");
        });

        it('Fail if try to increase borrowRate in less than 7 days', async () => {
            await time.increase(time.duration.days(7));
            await HoldefiSettings.setBorrowRate(SampleToken1.address,ratesDecimal.multipliedBy(0.1) ,{from: owner});
            await time.increase(time.duration.days(5));
            await expectRevert(
                HoldefiSettings.setBorrowRate(SampleToken1.address,ratesDecimal.multipliedBy(0.12) ,{from: owner}),
            "SE11");
        });

        it('Fail if new_borrowRate > (borrowRate + maxIncrease)', async () => {
            await time.increase(time.duration.days(7));
            let borrowRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).borrowRate;
            let newBorrowRate = bigNumber(borrowRate).plus(borrowRateMaxIncrease).plus(10);
            await expectRevert(
                HoldefiSettings.setBorrowRate(SampleToken1.address, newBorrowRate, {from: owner}),
            "SE12");
        });
    });

    describe("Set promotionRate", async() =>{
        beforeEach(async () =>{
            await scenario(owner,user1,user2,user3,user4);
            await time.increase(time.duration.days(5));
        })
        
        it('The new promotionRate for a market should be set if promotionReserveScaled > 0 & promotionDebtScaled = 0',async () =>{
            await assignToken(owner, owner, SampleToken1);
            let supplyRateBefore = (await Holdefi.getCurrentSupplyIndex(SampleToken1.address)).supplyRate;            
            let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
            await Holdefi.depositPromotionReserve(SampleToken1.address, await convertToDecimals(SampleToken1, 10));
            await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
            let time1 = await time.latest();
            await time.increase(time.duration.days(7));
        
            let promotionDebt = await Holdefi.getPromotionDebt(SampleToken1.address);  
            let time2 = await time.latest();

            let supplyRateAfter = (await Holdefi.getCurrentSupplyIndex(SampleToken1.address)).supplyRate;
            let promotionRate = (await HoldefiSettings.marketAssets(SampleToken1.address)).promotionRate;

            let debtScaled = bigNumber(time2-time1).multipliedBy(getMarketBefore.totalSupply).multipliedBy(ratesDecimal.multipliedBy(0.1));

            assert.equal(supplyRateAfter.toString(), bigNumber(supplyRateBefore).plus(promotionRate).toString(),'Promotion rate should be added to supply rate')
            assert.equal(promotionRate.toString() , ratesDecimal.multipliedBy(0.1).toString(),'Promotion rate should be set');          
            assert.equal(debtScaled.toString() , promotionDebt.toString(), 'Promotion debt increased correctly');
        })

        it('The new promotionRate for a market should be set if promotionReserveScaled > promotionDebtScaled',async () =>{
            await assignToken(owner, owner, SampleToken1);
            let supplyRateBefore = (await Holdefi.getCurrentSupplyIndex(SampleToken1.address)).supplyRate;            
            let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
            await Holdefi.depositPromotionReserve(SampleToken1.address, await convertToDecimals(SampleToken1, 10));
            await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
            await time.increase(time.duration.days(7));

            await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));

            let currentMarket = await Holdefi.marketAssets(SampleToken1.address);

            let promotionReserveBefore = (await Holdefi.getPromotionReserve(SampleToken1.address));           
            let promotionDebtBefore = await Holdefi.getPromotionDebt(SampleToken1.address); 

            let promotionReserveAfter = currentMarket.promotionReserveScaled;
            let promotionRateAfter = (await HoldefiSettings.marketAssets(SampleToken1.address)).promotionRate;
            let promotionDebtAfter = currentMarket.promotionDebtScaled;
            let supplyRateAfter = (await Holdefi.getCurrentSupplyIndex(SampleToken1.address)).supplyRate;

            assert.equal(supplyRateAfter.toString(), bigNumber(supplyRateBefore).plus(promotionRateAfter).toString(),'Promotion rate should be added to supply rate')
            assert.equal(promotionRateAfter.toString() , ratesDecimal.multipliedBy(0.1).toString(),'Promotion rate should be set');         
            assert.equal(promotionDebtAfter.toString() , 0,'Promotion debt should be 0');
            assert.equal(promotionReserveAfter.toString() , bigNumber(promotionReserveBefore).minus(promotionDebtBefore).toString(),'Promotion debt should be decreased from promotion reserve');
        })

        it('Supply interest should be changed after changing the promotionRate', async () => {
            await assignToken(owner, user5, SampleToken1);
            await Holdefi.methods['supply(address,uint256,uint16)'](
                SampleToken1.address,
                await convertToDecimals(SampleToken1, 20),
                referralCode,
                {from:user5}
            );

            // await Holdefi.beforeChangeSupplyRate(SampleToken1.address);
            let time0 = await time.latest();
            let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
            
            await time.advanceBlock();
            let time1 = await time.latest();
            await time.increase(time.duration.days(40));
            let time2 = await time.latest();

            let getAccountSupply1 = await Holdefi.getAccountSupply(user5,SampleToken1.address);
            let getSupplyInterestsBefore = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
            let getBorrowInterestsBefore = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
            await HoldefiSettings.setPromotionRate(SampleToken1.address, getSupplyInterestsBefore.supplyRate, {from: owner});
            let time3 = await time.latest();
            let getSupplyInterestsAfter = await Holdefi.getCurrentSupplyIndex(SampleToken1.address);
            let getBorrowInterestsAfter = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);

            await time.advanceBlock();
            let time4 = await time.latest();
            await time.increase(time.duration.days(40));
            let time5 = await time.latest();

            await time.advanceBlock();
            let getAccountSupply2 = await Holdefi.getAccountSupply(user5,SampleToken1.address);
            let time6 = await time.latest();
            await Holdefi.beforeChangeSupplyRate(SampleToken1.address);
            let time7 = await time.latest();

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            

            let interestScaled1 = bigNumber(time2-time1).multipliedBy(getAccountSupply2.balance).multipliedBy(getSupplyInterestsBefore.supplyRate);
            let interestScaled2 = bigNumber(time5-time4).multipliedBy(getAccountSupply2.balance).multipliedBy(getSupplyInterestsAfter.supplyRate);

            let interestScaled3 = bigNumber(time3-time0).multipliedBy(getAccountSupply2.balance).multipliedBy(getSupplyInterestsBefore.supplyRate);
            let interestScaled4 = bigNumber(time6-time3).multipliedBy(getAccountSupply2.balance).multipliedBy(getSupplyInterestsAfter.supplyRate);
            let totalInterest = interestScaled3.plus(interestScaled4).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

            let reserveInterestScaled1 = bigNumber(time3-time0).multipliedBy((bigNumber(getMarketBefore.totalBorrow).multipliedBy(getBorrowInterestsBefore.borrowRate)).minus(bigNumber(getMarketBefore.totalSupply).multipliedBy(getSupplyInterestsBefore.supplyRate)));
            let reserveInterestScaled2 = bigNumber(time7-time3).multipliedBy((bigNumber(getMarketAfter.totalBorrow).multipliedBy(getBorrowInterestsAfter.borrowRate)).minus(bigNumber(getMarketAfter.totalSupply).multipliedBy(getSupplyInterestsAfter.supplyRate-getSupplyInterestsBefore.supplyRate)));
            let totalReserveScaled = bigNumber(getMarketBefore.promotionReserveScaled).plus(reserveInterestScaled1).plus(reserveInterestScaled2);

            assert.equal(interestScaled2.toString(), interestScaled1.multipliedBy(2).toString(),'Supplier should earn more interest in the period that includes promotion');
            assert.equal(getAccountSupply2.interest.toString(), totalInterest.toString(), 'Supply interest increased correctly');
            assert.equal(getMarketAfter.promotionReserveScaled.toString(), totalReserveScaled.toString(), 'Promotion Reserve increased correctly')
        });

        it('Fail if new_promotionRate > MAX',async () =>{
            let maxPromotionRate = bigNumber(10000);
            await expectRevert(HoldefiSettings.setPromotionRate(SampleToken1.address, bigNumber(maxPromotionRate).plus(1).toString()),
                "SE05");
        })

        it('Fail if promotionReserveScaled <= promotionDebtScaled',async () =>{
            await HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
            await time.increase(time.duration.days(100));
            await expectRevert(HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.05)),
                "E13");
        })

        it('Fail  if a non-owner account calls setPromotionRate',async () =>{
            await expectRevert(HoldefiSettings.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1), {from: user2}),
                "OE01");
        })
    })
});
