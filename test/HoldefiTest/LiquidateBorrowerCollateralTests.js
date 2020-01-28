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

contract("Liquidate Borrower Collateral", function ([owner, ownerChanger, user1, user2, user3, user4, user5, user6]) {
    describe("Liquidate Borrower Collateral (single borrow)", async() =>{
        beforeEach(async () => {
            await scenario(owner, ownerChanger, user1, user2, user3, user4);
            await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
            await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(12), {from: user5});
            this.time1 = await time.latest();
            this.interest_SampleToken1 = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
        
            this.totalCollateralBefore = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalCollateral;
            this.getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;

            this.collateralPrice = await HoldefiPrices.getPrice(constants.ZERO_ADDRESS);
            this.borrowAssetPrice = await HoldefiPrices.getPrice(SampleToken1.address);

            this.getCollateral = await HoldefiSettings.collateralAssets(constants.ZERO_ADDRESS);
            this.getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
            this.getLiquidatedMarketBefore = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);

            this.getAccountBorrowBefore = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
            this.getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
        });
        
        it('Should liquidate borrower collateral when collateral price decreased', async () => {
            await Medianizer.set(decimal18.multipliedBy(150));
            let collateralPrice = await HoldefiPrices.getPrice(constants.ZERO_ADDRESS);
            
            await Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);                  
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);  

            let totalCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(interest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateral = liquidatedMarket.multipliedBy(borrowAssetPrice).multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(collateralPrice).dividedToIntegerBy(ratesDecimal);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),'Collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerScaled.toString(), bigNumber(getAccountCollateralAfter.balance).multipliedBy(collateralPrice).multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate).toString(),'New collateral power');
            assert.equal(getAccountCollateralAfter.totalBorrowValueScaled.toString(), 0,'No total borrow value');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),'Liquidated Collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),'Liquidated Market Debt increased');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'No borrow value');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'No borrow interest');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(),'Total collateral decreased');
        })
        
        it('Should liquidate borrower collateral when market asset price increased', async () => {
            await HoldefiPrices.setPrice(SampleToken1.address, decimal18.multipliedBy(13));
            let borrowAssetPrice = await HoldefiPrices.getPrice(SampleToken1.address);
            
            await Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);                  
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS); 

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);  

            let totalCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(interest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateral = liquidatedMarket.multipliedBy(borrowAssetPrice).multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(collateralPrice).dividedToIntegerBy(ratesDecimal);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),'Collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerScaled.toString(), bigNumber(getAccountCollateralAfter.balance).multipliedBy(collateralPrice).multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate).toString(),'New collateral power');
            assert.equal(getAccountCollateralAfter.totalBorrowValueScaled.toString(), 0,'No total borrow value');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),'Liquidated Collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),'Liquidated Market Debt increase');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'No borrow value');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'No borrow interest');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(),'Total collateral decreased');
       })
        
        it('Should liquidate borrower collateral when 1 year passed', async () => {
            await time.increase(time.duration.days(366));
            
            await Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);                  
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS); 

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);  

            let getCollateralAfter = await HoldefiSettings.collateralAssets(constants.ZERO_ADDRESS);
            let totalCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(interest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateral = liquidatedMarket.multipliedBy(borrowAssetPrice).multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(collateralPrice).dividedToIntegerBy(ratesDecimal);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),'Collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerScaled.toString(), bigNumber(getAccountCollateralAfter.balance).multipliedBy(collateralPrice).multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate).toString(),'New collateral power');
            assert.equal(getAccountCollateralAfter.totalBorrowValueScaled.toString(), 0,'No total borrow value');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),'Liquidated Collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),'Liquidated Market Debt increase');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'No borrow value');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'No borrow interest');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(),'Total collateral decreased');
        })

        it('Should liquidate borrower collateral if interest increased (user become underCollateral)', async () => {
            await Holdefi.withdrawCollateral(constants.ZERO_ADDRESS, decimal18.multipliedBy(0.1), {from:user5});
            await time.increase(time.duration.days(200));
            
            let totalCollateralBefore = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalCollateral;
            let getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;
            let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
        
            await Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);                  
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS); 

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);  

            let getCollateralAfter = await HoldefiSettings.collateralAssets(constants.ZERO_ADDRESS);
            let totalCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(interest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateral = liquidatedMarket.multipliedBy(borrowAssetPrice).multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(collateralPrice).dividedToIntegerBy(ratesDecimal);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),'Collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerScaled.toString(), bigNumber(getAccountCollateralAfter.balance).multipliedBy(collateralPrice).multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate).toString(),'New collateral power');
            assert.equal(getAccountCollateralAfter.totalBorrowValueScaled.toString(), 0,'No total borrow value');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),'Liquidated Collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),'Liquidated Market Debt increased');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'No borrow value');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'No borrow interest');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(),'Total collateral decrease');
        })
        
        it('Should liquidate borrower collateral when VTL rate increased', async () => {
            await time.increase(time.duration.days(10));           
            await HoldefiSettings.setValueToLoanRate(constants.ZERO_ADDRESS, ratesDecimal.multipliedBy(1.55))
            await time.increase(time.duration.days(10));           
            await HoldefiSettings.setValueToLoanRate(constants.ZERO_ADDRESS, ratesDecimal.multipliedBy(1.6))
            await time.increase(time.duration.days(10));           
            await HoldefiSettings.setValueToLoanRate(constants.ZERO_ADDRESS, ratesDecimal.multipliedBy(1.65))
            await time.increase(time.duration.days(10));           
            await HoldefiSettings.setValueToLoanRate(constants.ZERO_ADDRESS, ratesDecimal.multipliedBy(1.7))
            
            let getCollateral = await HoldefiSettings.collateralAssets(constants.ZERO_ADDRESS);
            
            await Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);                  
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);  

            let totalCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(interest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateral = liquidatedMarket.multipliedBy(borrowAssetPrice).multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(collateralPrice).dividedToIntegerBy(ratesDecimal);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),'Collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerScaled.toString(), bigNumber(getAccountCollateralAfter.balance).multipliedBy(collateralPrice).multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate).toString(),'New collateral power');
            assert.equal(getAccountCollateralAfter.totalBorrowValueScaled.toString(), 0,'No total borrow value');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),'Liquidated Collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),'Liquidated Market Debt increased');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'No borrow value');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'No borrow interest');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(),'Total collateral decreased');
        })

        it('Should liquidate borrower collateral when market is removed', async () => {
            await HoldefiSettings.removeMarket(SampleToken1.address,{from:owner});
            await Medianizer.set(decimal18.multipliedBy(150));

            let collateralPrice = await HoldefiPrices.getPrice(constants.ZERO_ADDRESS);

            await Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);                  
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS); 

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);  

            let getCollateralAfter = await HoldefiSettings.collateralAssets(constants.ZERO_ADDRESS);
            let totalCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(interest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateral = liquidatedMarket.multipliedBy(borrowAssetPrice).multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(collateralPrice).dividedToIntegerBy(ratesDecimal);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),'Collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerScaled.toString(), bigNumber(getAccountCollateralAfter.balance).multipliedBy(collateralPrice).multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate).toString(),'New collateral power');
            assert.equal(getAccountCollateralAfter.totalBorrowValueScaled.toString(), 0,'No total borrow value');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),'Liquidated Collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),'Liquidated Market Debt increase');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'No borrow value');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'No borrow interest');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(),'Total collateral decreased');
        })

        it('Should set user balance to zero when collateral value falls too much', async () => {
            await Medianizer.set(decimal18.multipliedBy(100));
            let getCollateral = await HoldefiSettings.collateralAssets(constants.ZERO_ADDRESS);
            let collateralPrice = await HoldefiPrices.getPrice(constants.ZERO_ADDRESS);
            await Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS);
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);

            assert.equal(getAccountCollateralAfter.balance.toString(), 0,'Collateral balance is zero')
            assert.equal(getAccountCollateralAfter.borrowPowerScaled.toString(), 0,'Borrow power is zero')
            assert.equal(getAccountCollateralAfter.totalBorrowValueScaled.toString(), 0,'Borrow value is zero')
        });

        it('liquidateBorrowerCollateral if one month passed after pause',async () =>{
            await time.increase(time.duration.days(366));
            await Holdefi.pause(6, {from: owner});
            await time.increase(time.duration.days(30));
            
            await Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);                  
            let getAccountBorrowAfter = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);

            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;
            let getLiquidatedMarketAfter = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);  

            let totalCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalCollateral;

            let x = bigNumber(time2-time1).multipliedBy(interest_SampleToken1.borrowRate).multipliedBy(getAccountBorrowBefore.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            
            let liquidatedMarket = bigNumber(getAccountBorrowBefore.balance).plus(x);
            let liquidatedCollateral = liquidatedMarket.multipliedBy(borrowAssetPrice).multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(collateralPrice).dividedToIntegerBy(ratesDecimal);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),'Collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerScaled.toString(), bigNumber(getAccountCollateralAfter.balance).multipliedBy(collateralPrice).multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate).toString(),'New collateral power');
            assert.equal(getAccountCollateralAfter.totalBorrowValueScaled.toString(), 0,'No total borrow value');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),'Liquidated Collateral increased');
            assert.equal(getLiquidatedMarketAfter.toString(), bigNumber(getLiquidatedMarketBefore).plus(liquidatedMarket).toString(),'Liquidated Market Debt increased');
            assert.equal(getAccountBorrowAfter.balance.toString(), 0,'No borrow value');
            assert.equal(getAccountBorrowAfter.interest.toString(), 0,'No borrow interest');
            assert.equal(getMarketAfter.totalBorrow.toString(), bigNumber(getMarketBefore.totalBorrow).minus(getAccountBorrowBefore.balance).toString(),'Total borrow decreased');
            assert.equal(totalCollateralAfter.toString(), bigNumber(totalCollateralBefore).minus(liquidatedCollateral).toString(),'Total collateral decreased');
        })

        it('Fail if user borrow before 1 year', async () => {
            await time.increase(time.duration.days(364));
            await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, 1, {from: user5});
            await time.increase(time.duration.days(2));
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS),
                'User should be under collateral or time is over');
        })

        it('Fail if user take repayBorrow before 1 year', async () => {
            await time.increase(time.duration.days(364));
            await SampleToken1.approve(Holdefi.address, decimal18.multipliedBy(100), {from: user5});
            await Holdefi.methods['repayBorrow(address,address,uint256)'](SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(1), {from:user5});
            await time.increase(time.duration.days(2));
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS),
                'User should be under collateral or time is over');
        })

        it('Fail if user collateralize before 1 year', async () => {
            await time.increase(time.duration.days(364));
            await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(1)});
            await time.increase(time.duration.days(2));
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS),
                'User should be under collateral or time is over');
        })

        it('Fail if user withdrawCollateral before 1 year', async () => {
            await time.increase(time.duration.days(364));
            await Holdefi.withdrawCollateral(constants.ZERO_ADDRESS, 1, {from:user5});
            await time.increase(time.duration.days(2));
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS),
                'User should be under collateral or time is over');
        })

        it('Fail if liquidateBorrowerCollateral was paused and call liquidateBorrowerCollateral before one month',async () =>{
            await time.increase(time.duration.days(366));
            await Holdefi.pause(6, {from: owner});
            await time.increase(time.duration.days(29));
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS),
                "Pausable: paused");
        })
        
        it('Fail if user is not under collateral before 1 year', async () => {
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS),
                'User should be under collateral or time is over');
        })
        
        it('Fail if user has no borrow after 1 year', async () => {
            await Holdefi.methods['collateralize()']({from:user6, value: decimal18.multipliedBy(1)});
            await time.increase(time.duration.days(366));
            await expectRevert(Holdefi.liquidateBorrowerCollateral(user6, constants.ZERO_ADDRESS),
                'User should be under collateral or time is over');
        })

        it('Fail if value to loan of borrower between 145% and 150%',async () => {
            await HoldefiPrices.setPrice(SampleToken1.address, decimal18.multipliedBy(11.3));

            let getAccountCollateral = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);
            assert.equal(getAccountCollateral.borrowPowerScaled.toString(), 0, 'Borrow power is zero');

            assert.isFalse(getAccountCollateral.underCollateral, 'User is not under collateral');

            await expectRevert(Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS),
                'User should be under collateral or time is over');
        })
    })
    
    describe("Liquidate Borrower Collateral (multi borrow)", async() =>{
        beforeEach(async () => {
            await scenario(owner, ownerChanger, user1, user2, user3, user4);
            await addERC20Market(owner, SampleToken2.address, ratesDecimal.multipliedBy(0.15), decimal18.multipliedBy(15));
            await assignToken(owner, user2, SampleToken2);
            await Holdefi.methods['supply(address,uint256)'](SampleToken2.address, decimal18.multipliedBy(40), {from:user2});

            await Holdefi.methods['collateralize()']({from:user5, value: decimal18.multipliedBy(2)});
            await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(13), {from: user5});
            this.time11 = await time.latest();
            await Holdefi.borrow(SampleToken2.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(8), {from: user5});
            this.time12 = await time.latest();

            this.interest_SampleToken1 = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
            this.interest_SampleToken2 = await Holdefi.getCurrentInterestIndex(SampleToken2.address);
        });

        it('Should liquidate borrower collateral when collateral price decreased', async () => {    
            await Medianizer.set(decimal18.multipliedBy(170));
            let totalCollateralBefore = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalCollateral;
            let getCollateral = await HoldefiSettings.collateralAssets(constants.ZERO_ADDRESS);
            let collateralPrice = await HoldefiPrices.getPrice(constants.ZERO_ADDRESS);
            let borrowAsset1Price = await HoldefiPrices.getPrice(SampleToken1.address);
            let borrowAsset2Price = await HoldefiPrices.getPrice(SampleToken2.address);

            let getMarket1Before = await Holdefi.marketAssets(SampleToken1.address);
            let getMarket2Before = await Holdefi.marketAssets(SampleToken2.address);
            let getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;
            let getLiquidatedMarket1Before = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);
            let getLiquidatedMarket2Before = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken2.address);

            let getAccountBorrow1Before = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
            let getAccountBorrow2Before = await Holdefi.getAccountBorrow(user5, SampleToken2.address, constants.ZERO_ADDRESS);
            let getAccountCollateralBefore = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);                     
            await Holdefi.liquidateBorrowerCollateral(user5, constants.ZERO_ADDRESS);
            let time2 = await time.latest();
            let getAccountCollateralAfter = await Holdefi.getAccountCollateral(user5, constants.ZERO_ADDRESS);                  
            let getAccountBorrow1After = await Holdefi.getAccountBorrow(user5, SampleToken1.address, constants.ZERO_ADDRESS);
            let getAccountBorrow2After = await Holdefi.getAccountBorrow(user5, SampleToken2.address, constants.ZERO_ADDRESS); 

            let getMarket1After = await Holdefi.marketAssets(SampleToken1.address);
            let getMarket2After = await Holdefi.marketAssets(SampleToken2.address);
            let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalLiquidatedCollateral;
            let getLiquidatedMarket1After = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken1.address);
            let getLiquidatedMarket2After = await Holdefi.marketDebt(constants.ZERO_ADDRESS, SampleToken2.address);   

            let totalCollateralAfter = (await Holdefi.collateralAssets(constants.ZERO_ADDRESS)).totalCollateral;

            let x1 = bigNumber(time2-time11).multipliedBy(interest_SampleToken1.borrowRate).multipliedBy(getAccountBorrow1Before.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);
            let x2 = bigNumber(time2-time12).multipliedBy(interest_SampleToken2.borrowRate).multipliedBy(getAccountBorrow2Before.balance).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal).plus(1);

            let liquidatedMarket1 = bigNumber(getAccountBorrow1Before.balance).plus(x1);
            let liquidatedMarket2 = bigNumber(getAccountBorrow2Before.balance).plus(x2);
            let liquidatedCollateral = (liquidatedMarket1.multipliedBy(borrowAsset1Price)).plus(liquidatedMarket2.multipliedBy(borrowAsset2Price)).multipliedBy(getCollateral.penaltyRate).dividedToIntegerBy(collateralPrice).dividedToIntegerBy(ratesDecimal);

            assert.equal(getAccountCollateralAfter.balance.toString(), bigNumber(getAccountCollateralBefore.balance).minus(liquidatedCollateral).toString(),'Collateral balance decreased');
            assert.equal(getAccountCollateralAfter.borrowPowerScaled.toString(), bigNumber(getAccountCollateralAfter.balance).multipliedBy(collateralPrice).multipliedBy(ratesDecimal).dividedToIntegerBy(getCollateral.valueToLoanRate).toString(),'New collateral power');
            assert.equal(getAccountCollateralAfter.totalBorrowValueScaled.toString(), 0,'No total borrow value');
            assert.equal(getLiquidatedCollateralAfter.toString(), bigNumber(getLiquidatedCollateralBefore).plus(liquidatedCollateral).toString(),'Liquidated Collateral increased');
            
            assert.equal(getLiquidatedMarket1After.toString(), bigNumber(getLiquidatedMarket1Before).plus(liquidatedMarket1).toString(),'Liquidated Market Debt for market1 increased');
            assert.equal(getAccountBorrow1After.balance.toString(), 0,'No borrow value');
            assert.equal(getAccountBorrow1After.interest.toString(), 0,'No borrow interest');
            assert.equal(getMarket1After.totalBorrow.toString(), bigNumber(getMarket1Before.totalBorrow).minus(getAccountBorrow1Before.balance).toString(),'Total borrow for market1 decreased');

            assert.equal(getLiquidatedMarket2After.toString(), bigNumber(getLiquidatedMarket2Before).plus(liquidatedMarket2).toString(),'Liquidated Market Debt for market2 increased');
            assert.equal(getAccountBorrow2After.balance.toString(), 0,'No borrow value');
            assert.equal(getAccountBorrow2After.interest.toString(), 0,'No borrow interest');
            assert.equal(getMarket2After.totalBorrow.toString(), bigNumber(getMarket2Before.totalBorrow).minus(getAccountBorrow2Before.balance).toString(),'Total borrow for market2 decreased');  
        })
    })
})