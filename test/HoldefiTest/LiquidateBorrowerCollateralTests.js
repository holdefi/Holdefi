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
    roundNumber,
    initializeContracts,
    assignToken,
    scenario,
    scenario2
} = require ("../Utils.js");

contract("Liquidate Borrower Collateral", function ([owner, user1, user2, user3, user4, user5, user6,user7]) {
    describe("Liquidate Borrower Collateral (single borrow)", async() =>{
        beforeEach(async () => {
            await scenario(owner, user1, user2, user3, user4);
            await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
            await Holdefi.borrow(
                SampleToken1.address,
                ethAddress,
                await convertToDecimals(SampleToken1, 12),
                referralCode,
                {from: user5}
            );
            time1 = await time.latest();
            borrowInterest_SampleToken1 = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
        
            totalCollateralBefore = (await Holdefi.collateralAssets(ethAddress)).totalCollateral;
            getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;

            getCollateral = await HoldefiSettings.collateralAssets(ethAddress);
            getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
            getLiquidatedMarketBefore = await Holdefi.marketDebt(ethAddress, SampleToken1.address);

            getAccountBorrowBefore = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
            getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);
        });
        
        it('The liquidateBorrowerCollateral function work as expected if market price is increased', async () => {
            let HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
            let holdefiCollateralsContractBalanceBefore = await balance.current(HoldefiCollateralsAddress);
            let holdefiContractBalanceBefore = await SampleToken1.balanceOf(Holdefi.address);
            await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 13/200));
            await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress);
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress); 
            let time2 = await time.latest();                 
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress); 

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken1.address);  

            let totalCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(borrowInterest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
                .dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateralValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, liquidatedMarket))
                .multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(ratesDecimal);
            let liquidatedCollateral = await HoldefiPrices.getAssetAmountFromValue(ethAddress, liquidatedCollateralValue);
            let newCollateralPower = bigNumber(await HoldefiPrices.getAssetValueFromAmount(ethAddress, getAccountCollateralAfter.balance))
                .multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),
                'User collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerValue.toString(), newCollateralPower.toString(), 'User borrow power changed');
            assert.equal(getAccountCollateralAfter.totalBorrowValue.toString(), 0,'User total borrow value = 0');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),
                'Liquidated collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(), 'Market debt increased');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'User borrow balance = 0');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'User borrow interest = 0');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),
                'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(), 'Total collateral decreased');
       
            let holdefiCollateralsContractBalanceAfter = await balance.current(HoldefiCollateralsAddress);
            let holdefiContractBalanceAfter = await SampleToken1.balanceOf(Holdefi.address);
            assert.equal(holdefiContractBalanceAfter.toString(), holdefiContractBalanceBefore.toString(), 'Holdefi contract balance not changed');
            assert.equal(holdefiCollateralsContractBalanceAfter.toString(), holdefiCollateralsContractBalanceBefore.toString(), 
                'HoldefiCollaterals contract balance not changed');
       })
        
        it('The liquidateBorrowerCollateral function work as expected if there is no activity on collateral for one year', async () => {
            await time.increase(time.duration.days(366));
            
            await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);                  
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress); 

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken1.address);  

            let getCollateralAfter = await HoldefiSettings.collateralAssets(ethAddress);
            let totalCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(borrowInterest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
                .dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateralValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, liquidatedMarket))
                .multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(ratesDecimal);
            let liquidatedCollateral = await HoldefiPrices.getAssetAmountFromValue(ethAddress, liquidatedCollateralValue);
            let newCollateralPower = bigNumber(await HoldefiPrices.getAssetValueFromAmount(ethAddress, getAccountCollateralAfter.balance))
                .multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),
                'User collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerValue.toString(), newCollateralPower.toString(),'User borrow power changed');
            assert.equal(getAccountCollateralAfter.totalBorrowValue.toString(), 0,'User total borrow value = 0');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),
                'Liquidated collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),'Market debt increased');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'User borrow balance = 0');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'User borrow interest = 0');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),
                'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(), 'Total collateral decreased');
        })

        it('The liquidateBorrowerCollateral function work as expected if borrow interest increased (user become underCollateral)', async () => {
            await Holdefi.withdrawCollateral(ethAddress, decimal18.multipliedBy(0.1), {from:user5});
            await time.increase(time.duration.days(200));
            
            let totalCollateralBefore = (await Holdefi.collateralAssets(ethAddress)).totalCollateral;
            let getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;
            let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);
        
            await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);                  
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress); 

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken1.address);  

            let getCollateralAfter = await HoldefiSettings.collateralAssets(ethAddress);
            let totalCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(borrowInterest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
                .dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateralValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, liquidatedMarket))
                .multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(ratesDecimal);
            let liquidatedCollateral = await HoldefiPrices.getAssetAmountFromValue(ethAddress, liquidatedCollateralValue);
            let newCollateralPower = bigNumber(await HoldefiPrices.getAssetValueFromAmount(ethAddress, getAccountCollateralAfter.balance))
                .multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),
                'User collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerValue.toString(), newCollateralPower.toString(),'User borrow power changed');
            assert.equal(getAccountCollateralAfter.totalBorrowValue.toString(), 0,'User total borrow value = 0');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),
                'Liquidated collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),
                'Market debt increased');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'User borrow balance = 0');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'User borrow interest = 0');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),
                'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(),
                'Total collateral decreased');
        })
        
        it('The liquidateBorrowerCollateral function work as expected if VTL rate increased', async () => {
            await time.increase(time.duration.days(10));           
            await HoldefiSettings.setValueToLoanRate(ethAddress, ratesDecimal.multipliedBy(1.55))
            await time.increase(time.duration.days(10));           
            await HoldefiSettings.setValueToLoanRate(ethAddress, ratesDecimal.multipliedBy(1.6))
            await time.increase(time.duration.days(10));           
            await HoldefiSettings.setValueToLoanRate(ethAddress, ratesDecimal.multipliedBy(1.65))
            await time.increase(time.duration.days(10));           
            await HoldefiSettings.setValueToLoanRate(ethAddress, ratesDecimal.multipliedBy(1.7))
            
            let getCollateral = await HoldefiSettings.collateralAssets(ethAddress);
            
            await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);                  
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken1.address);  

            let totalCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(borrowInterest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
                .dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateralValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, liquidatedMarket))
                .multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(ratesDecimal);
            let liquidatedCollateral = await HoldefiPrices.getAssetAmountFromValue(ethAddress, liquidatedCollateralValue);
            let newCollateralPower = bigNumber(await HoldefiPrices.getAssetValueFromAmount(ethAddress, getAccountCollateralAfter.balance))
                .multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),
                'User collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerValue.toString(), newCollateralPower.toString(),'User borrow power changed');
            assert.equal(getAccountCollateralAfter.totalBorrowValue.toString(), 0,'User total borrow value = 0');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),
                'Liquidated collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),
                'Market debt increased');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'User borrow balance = 0');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'User borrow interest = 0');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),
                'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(),
                'Total collateral decreased');
        })

        it('The liquidateBorrowerCollateral function should work if market is deactivated', async () => {
            await HoldefiSettings.deactivateMarket(SampleToken1.address,{from:owner});
            await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 13/200));

            await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);                  
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress); 

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken1.address);  

            let getCollateralAfter = await HoldefiSettings.collateralAssets(ethAddress);
            let totalCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(borrowInterest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
                .dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateralValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, liquidatedMarket))
                .multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(ratesDecimal);
            let liquidatedCollateral = await HoldefiPrices.getAssetAmountFromValue(ethAddress, liquidatedCollateralValue);
            let newCollateralPower = bigNumber(await HoldefiPrices.getAssetValueFromAmount(ethAddress, getAccountCollateralAfter.balance))
                .multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),
                'User collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerValue.toString(), newCollateralPower.toString(), 'User borrow power changed');
            assert.equal(getAccountCollateralAfter.totalBorrowValue.toString(), 0,'User total borrow value = 0');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),
                'Liquidated collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),
                'Market debt increased');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'User borrow balance = 0');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'User borrow interest = 0');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),
                'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(),
                'Total collateral decreased');
        })

        it('The liquidateBorrowerCollateral function work as expected if market price is increased enormously', async () => {
            await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 100/200));
            let getCollateral = await HoldefiSettings.collateralAssets(ethAddress);
            await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress);
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);

            assert.equal(getAccountCollateralAfter.balance.toString(), 0,'Collateral balance is zero')
            assert.equal(getAccountCollateralAfter.borrowPowerValue.toString(), 0,'Borrow power is zero')
            assert.equal(getAccountCollateralAfter.totalBorrowValue.toString(), 0,'Borrow value is zero')
        });

        it('The liquidateBorrowerCollateral function should not be reverted if calling it a month after pausing',async () =>{
            await time.increase(time.duration.days(366));
            await Holdefi.pause("liquidateBorrowerCollateral", time.duration.days(30), {from: owner});
            await time.increase(time.duration.days(31));
            
            await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);                  
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(ethAddress, SampleToken1.address);  

            let totalCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(borrowInterest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
                .dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateralValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, liquidatedMarket))
                .multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(ratesDecimal);
            let liquidatedCollateral = await HoldefiPrices.getAssetAmountFromValue(ethAddress, liquidatedCollateralValue);
            let newCollateralPower = bigNumber(await HoldefiPrices.getAssetValueFromAmount(ethAddress, getAccountCollateralAfter.balance))
                .multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),
                'Collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerValue.toString(), newCollateralPower.toString(),'User borrow power changed');
            assert.equal(getAccountCollateralAfter.totalBorrowValue.toString(), 0,'User total borrow value = 0');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),
                'Liquidated collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),
                'Market debt increased');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'User borrow balance = 0');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'User borrow interest = 0');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),
                'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(),
                'Total collateral decreased');
        })

        it('Fail if user has activity (borrow) in the past year & borrow power > 0', async () => {
            await time.increase(time.duration.days(364));
            await Holdefi.borrow(SampleToken1.address, ethAddress, 1, referralCode, {from: user5});
            await time.increase(time.duration.days(2));
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress),
                'E06');
        })

        it('Fail if user has activity (repayBorrow) in the past year & borrow power > 0', async () => {
            await time.increase(time.duration.days(364));
            await SampleToken1.approve(Holdefi.address, await convertToDecimals(SampleToken1, 100), {from: user5});
            await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, ethAddress, await convertToDecimals(SampleToken1, 1), 
                {from:user5});
            await time.increase(time.duration.days(2));
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress),
                'E06');
        })

        it('Fail if user has activity (collateralize) in the past year & borrow power > 0', async () => {
            await time.increase(time.duration.days(364));
            await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
            await time.increase(time.duration.days(2));
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress),
                'E06');
        })

        it('Fail if user has activity (withdrawCollateral) in the past year & borrow power > 0', async () => {
            await time.increase(time.duration.days(364));
            await Holdefi.withdrawCollateral(ethAddress, 1, {from:user5});
            await time.increase(time.duration.days(2));
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress),
                'E06');
        })

        it('Fail if liquidateBorrowerCollateral is paused',async () =>{
            await time.increase(time.duration.days(366));
            await Holdefi.pause("liquidateBorrowerCollateral", time.duration.days(30), {from: owner});
            await time.increase(time.duration.days(29));
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress),
                "POE02");
        })
        
        it('Fail if user is not under collateral', async () => {
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress),
                'E06');
        })

        it('Fail if total borrowed balance is zero', async () => {
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, SampleToken2.address, ethAddress),
                'E05');
        })

        it('Fail if borrow power is zero but user is not under collateral',async () => {
            await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 11.3/200));

            let getAccountCollateral = await Holdefi.getAccountCollateral(user5, ethAddress);
            assert.equal(getAccountCollateral.borrowPowerValue.toString(), 0, 'Borrow power is zero');

            assert.isFalse(getAccountCollateral.underCollateral, 'User is not under collateral');

            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress),
                'E06');
        })
    })
    
    describe("Liquidate Borrower Collateral (multi borrow)", async() =>{
        beforeEach(async () => {
            await scenario(owner, user1, user2, user3, user4);
            await HoldefiSettings.addMarket(
                SampleToken2.address,
                ratesDecimal.multipliedBy(0.15),
                ratesDecimal.multipliedBy(0.9),
                {from:owner}
            );
            await SampleToken2PriceAggregator.setPrice(await convertToDecimals(SampleToken2PriceAggregator, 15/200));

            await assignToken(owner, user2, SampleToken2);
            await Holdefi.methods['supply(address,uint256,uint16)'](
                SampleToken2.address, 
                await convertToDecimals(SampleToken2, 40), 
                referralCode,
                {from:user2}
            );

            await Holdefi.methods['collateralize()']( {from:user5, value: decimal18.multipliedBy(2)});
            await Holdefi.borrow(SampleToken1.address, ethAddress, await convertToDecimals(SampleToken1, 13), referralCode, {from: user5});
            time11 = await time.latest();
            await Holdefi.borrow(SampleToken2.address, ethAddress, await convertToDecimals(SampleToken2, 8), referralCode, {from: user5});
            time12 = await time.latest();

            borrowInterest_SampleToken1 = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
            borrowInterest_SampleToken2 = await Holdefi.getCurrentBorrowIndex(SampleToken2.address);
        });

        it('The liquidateBorrowerCollateral function work as expected if market1 and market2 price increased', async () => {
            let HoldefiCollateralsAddress = await Holdefi.holdefiCollaterals.call();
            let holdefiCollateralsContractBalanceBefore = await balance.current(HoldefiCollateralsAddress);
            let holdefiContractBalanceBefore1 = await SampleToken1.balanceOf(Holdefi.address);
            let holdefiContractBalanceBefore2 = await SampleToken2.balanceOf(Holdefi.address); 
            await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 12.5/200));
            await SampleToken2PriceAggregator.setPrice(await convertToDecimals(SampleToken2PriceAggregator, 20/200));
            let totalCollateralBefore = (await Holdefi.collateralAssets(ethAddress)).totalCollateral;
            let getCollateral = await HoldefiSettings.collateralAssets(ethAddress);

            let getMarket1Before = await Holdefi.marketAssets(SampleToken1.address);
            let getMarket2Before = await Holdefi.marketAssets(SampleToken2.address);
            let getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;
            let getLiquidatedMarket1Before = await Holdefi.marketDebt(ethAddress, SampleToken1.address);
            let getLiquidatedMarket2Before = await Holdefi.marketDebt(ethAddress, SampleToken2.address);

            let getAccountBorrow1Before = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
            let getAccountBorrow2Before = await Holdefi.getAccountBorrow(user5, SampleToken2.address, ethAddress);
            let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);                     
            await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress);
            let time21 = await time.latest();

            await Holdefi.liquidateBorrowerCollateral(user5, SampleToken2.address, ethAddress);
            let time22 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);                  
            let getAccountBorrow1After = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
            let getAccountBorrow2After = await Holdefi.getAccountBorrow(user5, SampleToken2.address, ethAddress); 

            let getMarket1After = await Holdefi.marketAssets(SampleToken1.address);
            let getMarket2After = await Holdefi.marketAssets(SampleToken2.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;
            let getLiquidatedMarket1After = await Holdefi.marketDebt(ethAddress, SampleToken1.address);
            let getLiquidatedMarket2After = await Holdefi.marketDebt(ethAddress, SampleToken2.address);   

            let totalCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalCollateral;

            let x1 = bigNumber(time21-time11).multipliedBy(borrowInterest_SampleToken1.borrowRate).multipliedBy(getAccountBorrow1Before.balance)
                .dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            let x2 = bigNumber(time22-time12).multipliedBy(borrowInterest_SampleToken2.borrowRate).multipliedBy(getAccountBorrow2Before.balance)
                .dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

            let liquidatedMarket1 = bigNumber(getAccountBorrow1Before.balance).plus(x1);
            let liquidatedMarket2 = bigNumber(getAccountBorrow2Before.balance).plus(x2);
            let liquidatedCollateralValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, liquidatedMarket1))
                .plus(await HoldefiPrices.getAssetValueFromAmount(SampleToken2.address, liquidatedMarket2))
                .multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(ratesDecimal);
            let liquidatedCollateral = await HoldefiPrices.getAssetAmountFromValue(ethAddress, liquidatedCollateralValue);
            let newCollateralPower = bigNumber(await HoldefiPrices.getAssetValueFromAmount(ethAddress, getAccountCollateralAfter.balance))
                .multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate);


            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),
                'User collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerValue.toString(), newCollateralPower.toString(),'User borrow power changed');
            assert.equal(getAccountCollateralAfter.totalBorrowValue.toString(), 0, 'User total borrow value = 0');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),
                'Liquidated collateral increased');
            
            assert.equal(getLiquidatedMarket1After.toString(), bigNumber(getLiquidatedMarket1Before).plus(liquidatedMarket1).toString(),
                'Market debt for market1 increased');
            assert.equal(getAccountBorrow1After.balance.toString(), 0,'User borrow balance = 0');
            assert.equal(getAccountBorrow1After.interest.toString(), 0,'User borrow interest = 0');
            assert.equal(getMarket1After.totalBorrow.toString(), bigNumber(getMarket1Before.totalBorrow).minus(getAccountBorrow1Before.balance).toString(),
                'Total borrow for market1 decreased');

            assert.equal(getLiquidatedMarket2After.toString(), bigNumber(getLiquidatedMarket2Before).plus(liquidatedMarket2).toString(),
                'Market debt for market2 increased');
            assert.equal(getAccountBorrow2After.balance.toString(), 0,'User borrow balance = 0');
            assert.equal(getAccountBorrow2After.interest.toString(), 0,'User borrow interest = 0');
            assert.equal(getMarket2After.totalBorrow.toString(), bigNumber(getMarket2Before.totalBorrow).minus(getAccountBorrow2Before.balance).toString(),
                'Total borrow for market2 decreased'); 

            let holdefiCollateralsContractBalanceAfter = await balance.current(HoldefiCollateralsAddress);
            let holdefiContractBalanceAfter1 = await SampleToken1.balanceOf(Holdefi.address);
            let holdefiContractBalanceAfter2 = await SampleToken2.balanceOf(Holdefi.address);
            assert.equal(holdefiContractBalanceAfter1.toString(), holdefiContractBalanceBefore1.toString(), 'Holdefi contract balance not changed (market1)');
            assert.equal(holdefiContractBalanceAfter2.toString(), holdefiContractBalanceBefore2.toString(), 'Holdefi contract balance not changed (market2)');
            assert.equal(holdefiCollateralsContractBalanceAfter.toString(), holdefiCollateralsContractBalanceBefore.toString(), 
                'HoldefiCollaterals contract balance not changed');
        }) 

        it('Fail if try to first liquidateBorrowerCollateral for market1 and then for market2 when collateral is enough to cover market2', async () => {    
            await SampleToken1PriceAggregator.setPrice(await convertToDecimals(SampleToken1PriceAggregator, 12.5/200));
            await SampleToken2PriceAggregator.setPrice(await convertToDecimals(SampleToken2PriceAggregator, 15/200));
            let totalCollateralBefore = (await Holdefi.collateralAssets(ethAddress)).totalCollateral;
            let getCollateral = await HoldefiSettings.collateralAssets(ethAddress);

            let getMarket1Before = await Holdefi.marketAssets(SampleToken1.address);
            let getMarket2Before = await Holdefi.marketAssets(SampleToken2.address);
            let getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;
            let getLiquidatedMarket1Before = await Holdefi.marketDebt(ethAddress, SampleToken1.address);
            let getLiquidatedMarket2Before = await Holdefi.marketDebt(ethAddress, SampleToken2.address);

            let getAccountBorrow1Before = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
            let getAccountBorrow2Before = await Holdefi.getAccountBorrow(user5, SampleToken2.address, ethAddress);
            let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, ethAddress);                     
            await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address, ethAddress);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, ethAddress);                  
            let getAccountBorrow1After = await Holdefi.getAccountBorrow(user5, SampleToken1.address, ethAddress);
            let getAccountBorrow2After = await Holdefi.getAccountBorrow(user5, SampleToken2.address, ethAddress); 

            let getMarket1After = await Holdefi.marketAssets(SampleToken1.address);
            let getMarket2After = await Holdefi.marketAssets(SampleToken2.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalLiquidatedCollateral;
            let getLiquidatedMarket1After = await Holdefi.marketDebt(ethAddress, SampleToken1.address);
            let getLiquidatedMarket2After = await Holdefi.marketDebt(ethAddress, SampleToken2.address);   

            let totalCollateralAfter = (await Holdefi.collateralAssets(ethAddress)).totalCollateral;

            let x1 = bigNumber(time2-time11).multipliedBy(borrowInterest_SampleToken1.borrowRate).multipliedBy(getAccountBorrow1Before.balance)
                .dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            let x2 = bigNumber(time2-time12).multipliedBy(borrowInterest_SampleToken2.borrowRate).multipliedBy(getAccountBorrow2Before.balance)
                .dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

            let liquidatedMarket1 = bigNumber(getAccountBorrow1Before.balance).plus(x1);
            let liquidatedCollateralValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, liquidatedMarket1))
                .multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(ratesDecimal);
            let liquidatedCollateral = await HoldefiPrices.getAssetAmountFromValue(ethAddress, liquidatedCollateralValue);


            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),
                'User collateral balance decreased');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),
                'Liquidated collateral increased');
            
            assert.equal(getLiquidatedMarket1After.toString(), bigNumber(getLiquidatedMarket1Before).plus(liquidatedMarket1).toString(),
                'Market debt for market1 increased');
            assert.equal(getAccountBorrow1After.balance.toString(), 0,'User borrow balance = 0');
            assert.equal(getAccountBorrow1After.interest.toString(), 0,'User borrow balance = 0');
            assert.equal(getMarket1After.totalBorrow.toString(), bigNumber(getMarket1Before.totalBorrow).minus(getAccountBorrow1Before.balance).toString(),
                'Total borrow for market1 decreased');

            assert.equal(getAccountBorrow2After.balance.toString(), getAccountBorrow2Before.balance.toString(),'User borrow balance not changed');
            assert.equal(getMarket2After.totalBorrow.toString(), getMarket2Before.totalBorrow.toString(),'Total borrow for market2 not changed');  
            
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, SampleToken2.address, ethAddress),
                "E06"
            );
        })  
    })

   describe("Liquidate Borrower Collateral (multi collateral and multi borrow)", async() =>{
        beforeEach(async () => {
            await scenario2(owner, user1, user2, user3, user4, user7);
        
            borrowInterest_SampleToken1 = await Holdefi.getCurrentBorrowIndex(SampleToken1.address);
        
            totalCollateralBefore = (await Holdefi.collateralAssets(SampleToken3.address)).totalCollateral;
            getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(SampleToken3.address)).totalLiquidatedCollateral;

            getCollateral = await HoldefiSettings.collateralAssets(SampleToken3.address);
            getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
            getLiquidatedMarketBefore = await Holdefi.marketDebt(SampleToken3.address, SampleToken1.address);

            await time.advanceBlock();
            getAccountBorrowBefore = await Holdefi.getAccountBorrow(user7, SampleToken1.address, SampleToken3.address);
            time1 = await time.latest();
            getAccountCollateralBefore = await Holdefi.getAccountCollateral(user7, SampleToken3.address);
        });
    
        it('The liquidateBorrowerCollateral function work as expected if market price is increased', async () => {
            await SampleToken3PriceAggregator.setPrice(await convertToDecimals(SampleToken3PriceAggregator, 0.92/200));
            await Holdefi.liquidateBorrowerCollateral(user7, SampleToken1.address, SampleToken3.address);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user7, SampleToken3.address);
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user7, SampleToken1.address, SampleToken3.address); 

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken3.address)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(SampleToken3.address, SampleToken1.address);  

            let totalCollateralAfter = (await Holdefi.collateralAssets(SampleToken3.address)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(borrowInterest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance)
                .dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(getAccountBorrowBefore.interest).plus(x);
            let liquidatedCollateralValue = bigNumber(await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, liquidatedMarket))
                .multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(ratesDecimal);
            let liquidatedCollateral = await HoldefiPrices.getAssetAmountFromValue(SampleToken3.address, liquidatedCollateralValue);
            let liquidatedMarketValue = await HoldefiPrices.getAssetValueFromAmount(SampleToken1.address, liquidatedMarket)

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),
                'User collateral balance decreased');
            assert.isTrue(bigNumber(getAccountCollateralAfter.totalBorrowValue).isGreaterThanOrEqualTo(
                bigNumber(getAccountCollateralBefore.totalBorrowValue).minus(liquidatedMarketValue)),'User total borrow value not decreased');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),
                'Liquidated collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),
                'Market debt increased');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'User borrow balance = 0');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'User borrow interest = 0');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),
                'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(),'Total collateral decreased');
        })


        it('Fail if market price decreased', async () => {
            await SampleToken3PriceAggregator.setPrice(await convertToDecimals(SampleToken3PriceAggregator, 0.0047));
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user7, SampleToken1.address, SampleToken3.address),
                "E06");
        })
    })
})