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

contract('HoldefiSettings - Collateral', function([owner, user1, user2, user3, user4, user5, user6]){
    describe("Add collateral", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner);
        })

        it('Collateral should be added if owner calls addCollateral',async () =>{
            await HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05));
            let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.equal(collateralFeatures.valueToLoanRate.toString(), ratesDecimal.multipliedBy(1.5).toString());
            assert.equal(collateralFeatures.penaltyRate.toString(), ratesDecimal.multipliedBy(1.2).toString());
            assert.equal(collateralFeatures.bonusRate.toString(), ratesDecimal.multipliedBy(1.05).toString());
            assert.isTrue(collateralFeatures.isActive);
        })

        it('Fail if a non-owner account calls addCollateral',async () =>{
            await expectRevert(HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05) ,{from: user1}),
            "OE01");
        })

         it('Fail if try to call addCollateral for already added dollateral',async () =>{
            await HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05));
            await expectRevert(HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05)),
                "SE07");
        })

        it('Fail if valueToLoanRate > MAX',async () =>{
            await expectRevert(
                HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(2.1), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05)),
                "SE05");
        })

        it('Fail if penaltyRate > MAX',async () =>{
            await expectRevert(
                HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.4), ratesDecimal.multipliedBy(1.05)),
                "SE05");
        })

        it('Fail if liquidationPenalty > valueToLoanRate',async () =>{
            await expectRevert(
                HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.05)),
                "SE05");
        })

        it('Fail if liquidationBonus > liquidationPenalty',async () =>{
            await expectRevert(
                HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.05), ratesDecimal.multipliedBy(1.2)),
                "SE05");
        })

        it('Fail if ratesDecimal > liquidationBonus',async () =>{
            await expectRevert(
                HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(0.9)),
                "SE05");
        })

    })

    describe("Activate collateral", async() =>{
        beforeEach(async () => {
            await initializeContracts(owner);
            await HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05));
            await HoldefiSettings.deactivateCollateral(SampleToken1.address,{from:owner});
        })

        it('Collateral should be activated if owner calls activateCollateral',async () =>{
            await HoldefiSettings.activateCollateral(SampleToken1.address,{from:owner});
            let activate = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.isTrue(activate.isActive);
        })

        it('Fail if a non-owner account calls activateCollateral',async () =>{
            await expectRevert(HoldefiSettings.activateCollateral(SampleToken1.address,{from:user1}),
                'OE01');
        })           

        it('Fail if try to call activateCollateral for a collateral where not added before',async () =>{
            await expectRevert(HoldefiSettings.activateCollateral(SampleToken4.address,{from:owner}),
                'SE02');
        })          
   
    })

    describe("Deactivate collateral", async() =>{
        beforeEach(async () => {
            await initializeContracts(owner);
            await HoldefiSettings.addCollateral(SampleToken1.address, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05));
        })

        it('Collateral should be dectivated if owner calls deactivateCollateral',async () =>{
            await HoldefiSettings.deactivateCollateral(SampleToken1.address,{from:owner});
            let activate = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.isFalse(activate.isActive);
        }) 

        it('Fail if a non-owner account calls deactivateCollateral',async () =>{
            await expectRevert(HoldefiSettings.deactivateCollateral(SampleToken1.address,{from:user1}),
                'OE01');
        })            

        it('Fail if try to call deactivateCollateral for a collateral where not added before',async () =>{
            await expectRevert(HoldefiSettings.deactivateCollateral(SampleToken4.address,{from:owner}),
                'SE02');
        })      
    })
    
    describe("Set valueToLoanRate", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner);
            maxValueToLoanRate = bigNumber(20000);
            valueToLoanRateMaxIncrease = bigNumber(500);

            valueToLoanRate = ratesDecimal.multipliedBy(1.4);
            penaltyRate = ratesDecimal.multipliedBy(1.2);
            bonusRate = ratesDecimal.multipliedBy(1.05);
            //ETH Collateral: valueToLoanRate = 150%, penaltyRate = 120%, bonusRate = 105%
            await HoldefiSettings.addCollateral(
                SampleToken1.address,
                valueToLoanRate, 
                penaltyRate,
                bonusRate,
                {from:owner}
            );
        })

        it('The new valueToLoanRate should be set if is more less the old one',async () =>{
            await time.increase(time.duration.days(7));        
            await HoldefiSettings.setValueToLoanRate(SampleToken1.address, ratesDecimal.multipliedBy(1.42));
            let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.equal(collateralFeatures.valueToLoanRate.toString(), ratesDecimal.multipliedBy(1.42).toString());
        })

        it('The new valueToLoanRate should be set if increased less than maxIncrease',async () =>{
            await time.increase(time.duration.days(7));        
            await HoldefiSettings.setValueToLoanRate(SampleToken1.address, ratesDecimal.multipliedBy(1.45));
            let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.equal(collateralFeatures.valueToLoanRate.toString(), ratesDecimal.multipliedBy(1.45).toString());
        })

        it('Fail if a non-owner account calls setValueToLoanRate',async () =>{ 
            await time.increase(time.duration.days(7));
            await expectRevert(HoldefiSettings.setValueToLoanRate(SampleToken1.address, ratesDecimal.multipliedBy(1.35), {from: user1}),
                "OE01");
        })

        it('Fail if try to increase valueToLoanRate in less than 7 days',async () =>{
            await time.increase(time.duration.days(6));
            await expectRevert(HoldefiSettings.setValueToLoanRate(SampleToken1.address, ratesDecimal.multipliedBy(1.52)),
                "SE11");        
        })

        it('Fail if new_valueToLoanRate > MAX',async () =>{
            let newVTL = valueToLoanRate;
            while (newVTL.isLessThanOrEqualTo(maxValueToLoanRate)) {
                await time.increase(time.duration.days(7));
                await HoldefiSettings.setValueToLoanRate(SampleToken1.address, newVTL);
                let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
                assert.equal(collateralFeatures.valueToLoanRate.toString(), newVTL.toString());
                newVTL = newVTL.plus(valueToLoanRateMaxIncrease);
            }

            await time.increase(time.duration.days(7));
            await expectRevert(HoldefiSettings.setValueToLoanRate(SampleToken1.address, newVTL),
                "SE05");
        })

        it('Fail if new_valueToLoanRate < penaltyRate',async () =>{
            await time.increase(time.duration.days(7));
            let newVTL = penaltyRate.minus(10);
            await expectRevert(HoldefiSettings.setValueToLoanRate(SampleToken1.address, newVTL),
                "SE05");
        })


        it('Fail if new_valueToLoanRate > (valueToLoanRate + maxIncrease)',async () =>{ 
            await time.increase(time.duration.days(7));
            let newVTL = valueToLoanRate.plus(valueToLoanRateMaxIncrease).plus(10);
            await expectRevert(HoldefiSettings.setValueToLoanRate(SampleToken1.address, newVTL),
                "SE12");       
        })
    
    })
    
    describe("Set penaltyRate", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner);
            maxPenaltyRate = bigNumber(13000);
            penaltyRateMaxIncrease = bigNumber(500);

            valueToLoanRate = ratesDecimal.multipliedBy(1.35);
            penaltyRate = ratesDecimal.multipliedBy(1.2);
            bonusRate = ratesDecimal.multipliedBy(1.05);
            //ETH Collateral: valueToLoanRate = 150%, penaltyRate = 120%, bonusRate = 105%
            await HoldefiSettings.addCollateral(
                SampleToken1.address,
                valueToLoanRate, 
                penaltyRate,
                bonusRate,
                {from:owner}
            );
        })

        it('The new penaltyRate should be set if is less than the old one',async () =>{
            await time.increase(time.duration.days(7));            
            await HoldefiSettings.setPenaltyRate(SampleToken1.address, ratesDecimal.multipliedBy(1.15));
            let collateralAssets = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.equal(collateralAssets.penaltyRate.toString(),ratesDecimal.multipliedBy(1.15).toString())
        })

        it('The new penaltyRate should be set if increased less than maxIncrease',async () =>{
            await time.increase(time.duration.days(7));            
            await HoldefiSettings.setPenaltyRate(SampleToken1.address, ratesDecimal.multipliedBy(1.25));
            let collateralAssets = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.equal(collateralAssets.penaltyRate.toString(),ratesDecimal.multipliedBy(1.25).toString())
        })

        it('Fail if a non-owner account calls setPenaltyRate',async () =>{
            await time.increase(time.duration.days(7));
            await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken1.address, ratesDecimal.multipliedBy(1.15), {from: user1}),
                "OE01");      
        })

        it('Fail if try to increase penaltyRate changed in less than 7 days',async () =>{
            await time.increase(time.duration.days(5));
            await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken1.address, ratesDecimal.multipliedBy(1.3)),
                "SE11");
        })

        it('Fail if new_penaltyRate > MAX',async () =>{
            let newPenaltyRate = penaltyRate;
            while (newPenaltyRate.isLessThanOrEqualTo(maxPenaltyRate)) {
                await time.increase(time.duration.days(7));
                await HoldefiSettings.setPenaltyRate(SampleToken1.address, newPenaltyRate);
                let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
                assert.equal(collateralFeatures.penaltyRate.toString(), newPenaltyRate.toString());
                newPenaltyRate = newPenaltyRate.plus(penaltyRateMaxIncrease);
            }

            await time.increase(time.duration.days(7));
            await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken1.address, newPenaltyRate),
                "SE05");
        })

        it('Fail if new_penaltyRate < bonusRate',async () =>{
            await time.increase(time.duration.days(7));
            let newPenaltyRate = bonusRate.minus(10);
            await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken1.address, newPenaltyRate),
                "SE05");
        })

        it('Fail if new_penaltyRate > valueToLoanRate',async () =>{
            let newPenaltyRate = penaltyRate;
            while (newPenaltyRate.isLessThanOrEqualTo(valueToLoanRate - 500)) {
                await time.increase(time.duration.days(7));
                await HoldefiSettings.setPenaltyRate(SampleToken1.address, newPenaltyRate);
                let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
                assert.equal(collateralFeatures.penaltyRate.toString(), newPenaltyRate.toString());
                newPenaltyRate = newPenaltyRate.plus(penaltyRateMaxIncrease);
            }

            await time.increase(time.duration.days(7));
            await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken1.address, newPenaltyRate),
                "SE05");
        })

        it('Fail if new_penaltyRate > (penaltyRate + maxIncrease)',async () =>{ 
            await time.increase(time.duration.days(7));
            let newPenaltyRate = penaltyRate.plus(penaltyRateMaxIncrease).plus(10);
            await expectRevert(HoldefiSettings.setPenaltyRate(SampleToken1.address, newPenaltyRate),
                "SE12");       
        })      
    })

    describe("Set bonusRate", async() =>{
        beforeEach(async () =>{
            await initializeContracts(owner);

            valueToLoanRate = ratesDecimal.multipliedBy(1.4);
            penaltyRate = ratesDecimal.multipliedBy(1.2);
            bonusRate = ratesDecimal.multipliedBy(1.05);
            //ETH Collateral: valueToLoanRate = 150%, penaltyRate = 120%, bonusRate = 105%
            await HoldefiSettings.addCollateral(
                SampleToken1.address,
                valueToLoanRate, 
                penaltyRate,
                bonusRate,
                {from:owner}
            );
        })
    
        it('The new bonusRate should be set',async () =>{   
            await HoldefiSettings.setBonusRate(SampleToken1.address, ratesDecimal.multipliedBy(1.1));
            let collateralFeatures = await HoldefiSettings.collateralAssets(SampleToken1.address);
            assert.equal(collateralFeatures.bonusRate.toString(), ratesDecimal.multipliedBy(1.1).toString());       
        })

        it('Fail if a non-owner account calls setBonusRate',async () =>{
            await expectRevert(HoldefiSettings.setBonusRate(SampleToken1.address, ratesDecimal.multipliedBy(1.1), {from: user1}),
                "OE01");      
        })

        it('Fail if new_bonusRate > penaltyRate',async () =>{
            let newBonusRate = penaltyRate.plus(10); 
            await expectRevert(HoldefiSettings.setBonusRate(SampleToken1.address, newBonusRate),
                "SE05");   
        })  

        it('Fail if new_bonusRate < ratesDecimal',async () =>{
            let newBonusRate = ratesDecimal.minus(10); 
            await expectRevert(HoldefiSettings.setBonusRate(SampleToken1.address, newBonusRate),
                "SE05");       
        })  
    })
});
