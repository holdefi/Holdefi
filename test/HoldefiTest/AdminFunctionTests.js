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

contract("Test Admin functions", function([owner,ownerChanger,user1,user2,user3,user4,user5,user6]){
	
	describe("Setting HoldefiPrices contract", async() =>{
		beforeEach(async () =>{
			await initializeContracts(owner, ownerChanger);
		})

		it('HoldefiPrices contract should be set by owner',async () =>{
            let NewHoldefiPricesContract = artifacts.require("HoldefiPrices");
            NewHoldefiPrices = await HoldefiPricesContract.new(ownerChanger, Medianizer.address,{from: owner});
            await Holdefi.setHoldefiPricesContract(NewHoldefiPrices.address)
			assert.equal(NewHoldefiPrices.address , await Holdefi.holdefiPrices.call());
		})

		it('Fail if try to change HoldefiPrices after set it fix',async () =>{
			await Holdefi.fixHoldefiPricesContract({from: owner});
			let FakeHoldefiPrices = await HoldefiPricesContract.new(ownerChanger, Medianizer.address,{from: owner});
			await expectRevert(Holdefi.setHoldefiPricesContract(FakeHoldefiPrices.address,{from: owner}),
				"HoldefiPrices is fixed");
		})

		it('Fail if set by other accounts',async () =>{	
			let FakeHoldefiPrices = await HoldefiPricesContract.new(ownerChanger, Medianizer.address,{from: owner});
			await expectRevert(Holdefi.setHoldefiPricesContract(FakeHoldefiPrices.address,{from: user1}),
				"Sender should be Owner");
		})
	})

	describe("Fix HoldefiPrices contract", async() =>{
		beforeEach(async () =>{
			await initializeContracts(owner, ownerChanger);
		})

		it('HoldefiPrices contract should be fixed by owner',async () =>{
			await Holdefi.fixHoldefiPricesContract({from: owner});
			assert.isTrue(await Holdefi.fixPrices());
		})

		it('Fail if try to fix by other accounts',async () =>{
			await expectRevert(Holdefi.fixHoldefiPricesContract({from: user1}),
				"Sender should be Owner");
		})
	})	

	describe("Set promotion rate", async() =>{
		beforeEach(async () =>{
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await time.increase(time.duration.days(5));
		})
		
		it('Should set promotion rate if promotionDebtScaled = 0',async () =>{
			await assignToken(owner, owner, SampleToken1);
			let supplyRateBefore = (await Holdefi.getCurrentInterestIndex(SampleToken1.address)).supplyRate;			
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
			await Holdefi.depositPromotionReserve(SampleToken1.address, decimal18.multipliedBy(10));
			await Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
			let time1 = await time.latest();
			await time.increase(time.duration.days(10));
		
			let promotionDebt = (await Holdefi.getCurrentPromotion(SampleToken1.address)).promotionDebtScaled;	
			let time2 = await time.latest();

			let supplyRateAfter = (await Holdefi.getCurrentInterestIndex(SampleToken1.address)).supplyRate;
			let promotionRate = (await Holdefi.marketAssets(SampleToken1.address)).promotionRate;

			let debtScaled = bigNumber(time2-time1).multipliedBy(getMarketBefore.totalSupply).multipliedBy(ratesDecimal.multipliedBy(0.1));

			assert.equal(supplyRateAfter.toString(), bigNumber(supplyRateBefore).plus(promotionRate).toString(),'Promotion rate should be added to supply rate')
			assert.equal(promotionRate.toString() , ratesDecimal.multipliedBy(0.1).toString(),'Promotion rate should be set');			
			assert.equal(debtScaled.toString() , promotionDebt.toString(), 'Promotion debt increased correctly');
		})

		it('Should set promotion rate if promotionDebtScaled > 0',async () =>{
			await assignToken(owner, owner, SampleToken1);
			let supplyRateBefore = (await Holdefi.getCurrentInterestIndex(SampleToken1.address)).supplyRate;			
			let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);
			await Holdefi.depositPromotionReserve(SampleToken1.address, decimal18.multipliedBy(10));
			await Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
			let time1 = await time.latest();
			await time.increase(time.duration.days(10));

			let promotionReserveBefore = (await Holdefi.getCurrentPromotion(SampleToken1.address)).promotionReserveScaled;			
			let promotionDebtBefore = (await Holdefi.getCurrentPromotion(SampleToken1.address)).promotionDebtScaled;	

			await Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
			let time2 = await time.latest();

			let promotionReserveAfter = (await Holdefi.marketAssets(SampleToken1.address)).promotionReserveScaled;
			let supplyRateAfter = (await Holdefi.getCurrentInterestIndex(SampleToken1.address)).supplyRate;
			let promotionRateAfter = (await Holdefi.marketAssets(SampleToken1.address)).promotionRate;
			let promotionDebtAfter = (await Holdefi.marketAssets(SampleToken1.address)).promotionDebtScaled;

			assert.equal(supplyRateAfter.toString(), bigNumber(supplyRateBefore).plus(promotionRateAfter).toString(),'Promotion rate should be added to supply rate')
			assert.equal(promotionRateAfter.toString() , ratesDecimal.multipliedBy(0.1).toString(),'Promotion rate should be set');			
			assert.equal(promotionDebtAfter.toString() , 0,'Promotion debt should be 0');
			assert.equal(promotionReserveAfter.toString() , bigNumber(promotionReserveBefore).minus(promotionDebtBefore).toString(),'Promotion debt should be decreased from promotion reserve');
		})

		it('Supply interest should be changed after changing promotionRate', async () => {
            await assignToken(owner, user5, SampleToken1);
            await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
            let time1 = await time.latest();
            let getMarketBefore = await Holdefi.marketAssets(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getAccountSupply1 = await Holdefi.getAccountSupply(user5,SampleToken1.address);
            let getInterestsBefore = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
            await Holdefi.setPromotionRate(SampleToken1.address, getInterestsBefore.supplyRate, {from: owner});
            let time2 = await time.latest();
            let getInterestsAfter = await Holdefi.getCurrentInterestIndex(SampleToken1.address);

            await time.increase(time.duration.days(40));
            let getAccountSupply2 = await Holdefi.getAccountSupply(user5,SampleToken1.address);
            let time3 = await time.latest();
            await Holdefi.updatePromotionReserve(SampleToken1.address);
            let time4 = await time.latest();
            let getMarketAfter = await Holdefi.marketAssets(SampleToken1.address);

            let interestScaled1 = bigNumber(time2-time1).multipliedBy(getAccountSupply2.balance).multipliedBy(getInterestsBefore.supplyRate);
            let interestScaled2 = bigNumber(time3-time2).multipliedBy(getAccountSupply2.balance).multipliedBy(getInterestsAfter.supplyRate);
            let totalInterest = interestScaled1.plus(interestScaled2).dividedToIntegerBy(secondsPerYear).dividedToIntegerBy(ratesDecimal);

            let reserveInterestScaled1 = bigNumber(time2-time1).multipliedBy((bigNumber(getMarketBefore.totalBorrow).multipliedBy(getInterestsBefore.borrowRate)).minus(bigNumber(getMarketBefore.totalSupply).multipliedBy(getInterestsBefore.supplyRate)));
            let reserveInterestScaled2 = bigNumber(time4-time2).multipliedBy((bigNumber(getMarketAfter.totalBorrow).multipliedBy(getInterestsAfter.borrowRate)).minus(bigNumber(getMarketAfter.totalSupply).multipliedBy(getInterestsAfter.supplyRate-getInterestsBefore.supplyRate)));
            let totalReserveScaled = bigNumber(getMarketBefore.promotionReserveScaled).plus(reserveInterestScaled1).plus(reserveInterestScaled2);

            assert.equal(bigNumber(getAccountSupply2.interest).minus(getAccountSupply1.interest).toString(), bigNumber(getAccountSupply1.interest).multipliedBy(2).toString(),'Supplier should earn more interest in the period that includes promotion');
			assert.equal(getAccountSupply2.interest.toString(), totalInterest.toString(), 'Supply interest increased correctly');
            assert.equal(getMarketAfter.promotionReserveScaled.toString(),totalReserveScaled.toString(), 'Promotion Reserve increased correctly')
        });

		it('Fail if promotion rate is more than maxPromotionRate',async () =>{
			let maxPromotionRate = await Holdefi.maxPromotionRate.call();
			await expectRevert(Holdefi.setPromotionRate(SampleToken1.address, bigNumber(maxPromotionRate).plus(1).toString()),
				"Rate should be in allowed range");
		})

		it('Fail if reserve is less than debt',async () =>{
			await Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
			await time.increase(time.duration.days(100));
			await expectRevert(Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.05)),
				"Promotion reserve should be more than promotion debt");
		})

		it('Fail if set by other accounts',async () =>{
			await expectRevert(Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1), {from: user2}),
				"Sender should be Owner");
		})
	})

	describe("Update Promotion", async() =>{
		beforeEach(async () =>{
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
		})

		it('Update promotion debt and promotion reserve if promotionRate != 0',async () =>{
			await time.increase(time.duration.days(20));		
			let getInterests = await Holdefi.getCurrentInterestIndex(SampleToken1.address);
			await Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.01))
			let time1 = await time.latest();
			let getMarket = await Holdefi.marketAssets(SampleToken1.address);
			await time.increase(time.duration.days(20));
			await Holdefi.updatePromotion(SampleToken1.address)
			let time2 = await time.latest();
			let marketAfter = await Holdefi.marketAssets(SampleToken1.address);

			let debtScaled = bigNumber(time2-time1).multipliedBy(getMarket.totalSupply).multipliedBy(ratesDecimal.multipliedBy(0.01));
			let reserveScaled = bigNumber(time2-time1).multipliedBy((bigNumber(getMarket.totalBorrow).multipliedBy(getInterests.borrowRate)).minus(bigNumber(getMarket.totalSupply).multipliedBy(getInterests.supplyRate)));

			assert.equal(marketAfter.promotionDebtScaled.toString(), debtScaled.toString(),'Promotion debt updated')
			assert.equal(bigNumber(marketAfter.promotionReserveScaled).minus(getMarket.promotionReserveScaled).toString(), reserveScaled.toString(),'Promotion reserve updated')
		})

		it('No promotion debt if promotionRate = 0',async () =>{
			await time.increase(time.duration.days(20));
			await Holdefi.updatePromotion(SampleToken1.address)
			let marketAfter = await Holdefi.marketAssets(SampleToken1.address);

			assert.equal(marketAfter.promotionDebtScaled.toString(), 0,'Promotion debt should be zero')
		})

		it('Set promotionRate to 0 if promotionDebt > promotionReserve',async () =>{
			await time.increase(time.duration.days(20));
			await Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1))
			await time.increase(time.duration.days(40));
			await Holdefi.updatePromotion(SampleToken1.address);
			let marketAfter = await Holdefi.marketAssets(SampleToken1.address);
			
			assert.equal(marketAfter.promotionRate.toString(), 0,'Promotion rate should be zero');
		})
	})

	describe("Deposit Promotion Reserve for ERC20", async() =>{
		beforeEach(async () =>{
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await assignToken(owner, owner, SampleToken1);
			await time.increase(time.duration.days(5));
			await Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1))
			this.adminBalanceBefore = await SampleToken1.balanceOf(owner);
		})

		it('Should Deposit reserves if promotionDebt < promotionReserve',async () =>{
			let promotionBefore = await Holdefi.getCurrentPromotion(SampleToken1.address);
			await Holdefi.methods['depositPromotionReserve(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(10));			
			let promotionAfter = await Holdefi.marketAssets(SampleToken1.address);

			let amountScaled = decimal18.multipliedBy(10).multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);	
			let reserveBefore = bigNumber(promotionBefore.promotionReserveScaled)
			let debtBefore = bigNumber(promotionBefore.promotionDebtScaled)
			let reserveAfter = bigNumber(promotionAfter.promotionReserveScaled)
			let debtAfter = bigNumber(promotionAfter.promotionDebtScaled)
			let adminBalanceAfter = await SampleToken1.balanceOf(owner);

			assert.equal(debtAfter.toString(), 0,'Debt should be zero')
			assert.equal(reserveAfter.toString(), reserveBefore.minus(debtBefore).plus(amountScaled).toString(), "(reserves - debt) deposited");
			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).minus(decimal18.multipliedBy(10)).toString(), 'Admin Balance increased correctly');  
		})
		
		it('Should Deposit reserves if promotionDebt > promotionReserve and deposit amount is more than (promotionDebt - promotionReserve)',async () =>{
			await time.increase(time.duration.days(100));
			let promotionBefore = await Holdefi.getCurrentPromotion(SampleToken1.address);
			await Holdefi.methods['depositPromotionReserve(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(10));			
			let promotionAfter = await Holdefi.marketAssets(SampleToken1.address);

			let amountScaled = decimal18.multipliedBy(10).multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);	
			let reserveBefore = bigNumber(promotionBefore.promotionReserveScaled)
			let debtBefore = bigNumber(promotionBefore.promotionDebtScaled)
			let reserveAfter = bigNumber(promotionAfter.promotionReserveScaled)
			let debtAfter = bigNumber(promotionAfter.promotionDebtScaled)

			assert.equal(debtAfter.toString(), 0,'Debt should be zero')
			assert.equal(reserveAfter.toString(), reserveBefore.minus(debtBefore).plus(amountScaled).toString(), "(reserves - debt) deposited");
		})

		it('Should Deposit reserves if promotionDebt > promotionReserve and deposit amount is less than (promotionDebt - promotionReserve)',async () =>{
			await time.increase(time.duration.days(100));
			let promotionBefore = await Holdefi.getCurrentPromotion(SampleToken1.address);
			await Holdefi.methods['depositPromotionReserve(address,uint256)'](SampleToken1.address, 1);			
			let promotionAfter = await Holdefi.marketAssets(SampleToken1.address);

			let amountScaled = bigNumber(1).multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);
			let reserveBefore = bigNumber(promotionBefore.promotionReserveScaled);
			let debtBefore = bigNumber(promotionBefore.promotionDebtScaled);
			let reserveAfter = bigNumber(promotionAfter.promotionReserveScaled);
			let debtAfter = bigNumber(promotionAfter.promotionDebtScaled);
			
			assert.equal(reserveAfter.toString(), 0,'Reserve should be zero')
			assert.equal(promotionAfter.promotionRate.toString(), 0,'Promotion rate should be zero')
			assert.equal(debtAfter.toString(), debtBefore.minus(reserveBefore).minus(amountScaled).toString(), '(debt - reserves) deposited')
		})

		it('Fail if market is zero addres',async () =>{
			await expectRevert(Holdefi.methods['depositPromotionReserve(address,uint256)'](constants.ZERO_ADDRESS, decimal18.multipliedBy(1)),
				'Market asset should not be zero address');	
		})
	})

	describe("Deposit Promotion Reserve for ETH", async() =>{
		beforeEach(async () =>{
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await time.increase(time.duration.days(5));
			await Holdefi.setPromotionRate(constants.ZERO_ADDRESS, ratesDecimal.multipliedBy(0.1))
			this.adminBalanceBefore = await balance.current(owner);
		})
		
		it('Should Deposit reserves if promotionDebt < promotionReserve',async () =>{
			let promotionBefore = await Holdefi.getCurrentPromotion(constants.ZERO_ADDRESS);
			await Holdefi.methods['depositPromotionReserve()']({value:decimal18.multipliedBy(1)});			
			let promotionAfter = await Holdefi.marketAssets(constants.ZERO_ADDRESS);

			let amountScaled = decimal18.multipliedBy(10).multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);	
			let reserveBefore = bigNumber(promotionBefore.promotionReserveScaled)
			let debtBefore = bigNumber(promotionBefore.promotionDebtScaled)
			let reserveAfter = bigNumber(promotionAfter.promotionReserveScaled)
			let debtAfter = bigNumber(promotionAfter.promotionDebtScaled)
			let adminBalanceAfter = await balance.current(owner);

			assert.equal(debtAfter.toString(), 0,'Debt should be zero')
			assert.equal(reserveAfter.minus(debtAfter).toString(), reserveBefore.minus(debtBefore).plus(amountScaled).toString(), "(reserves - debt) deposited");
			assert.equal(adminBalanceAfter.toString(), bigNumber(adminBalanceBefore).minus(decimal18.multipliedBy(1)).toString(), 'Admin Balance increased correctly');  
		})
	})

	describe("Withdraw Promotion Reserve", async() =>{
		beforeEach(async () =>{
			await scenario(owner,ownerChanger,user1,user2,user3,user4);
			await time.increase(time.duration.days(40));
			await Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.01));
			this.adminBalanceBefore = await SampleToken1.balanceOf(owner);
			await time.increase(time.duration.days(1));
		})
		
		it('Should withdraw reserves',async () =>{
			let promotionBefore = await Holdefi.getCurrentPromotion(SampleToken1.address);
			await Holdefi.withdrawPromotionReserve(SampleToken1.address, 10);
			let promotionAfter = await Holdefi.marketAssets(SampleToken1.address);

			let amountScaled = bigNumber(10).multipliedBy(secondsPerYear).multipliedBy(ratesDecimal);	
			let reserveBefore = bigNumber(promotionBefore.promotionReserveScaled)
			let debtBefore = bigNumber(promotionBefore.promotionDebtScaled);
			let reserveAfter = bigNumber(promotionAfter.promotionReserveScaled)
			let adminBalanceAfter = await SampleToken1.balanceOf(owner);

			assert.equal(adminBalanceBefore.toString(), bigNumber(adminBalanceAfter).minus(10).toString(), 'Admin Balance increased correctly');
			assert.equal(reserveAfter.toString(),reserveBefore.minus(debtBefore).minus(amountScaled).toString(), "Reserve withdrawn");
		})

		it('Fail if debt is more than reserve',async () =>{
			await Holdefi.setPromotionRate(SampleToken1.address, ratesDecimal.multipliedBy(0.1));
			await time.increase(time.duration.days(100));
			await expectRevert(Holdefi.withdrawPromotionReserve(SampleToken1.address, decimal18.multipliedBy(10), {from: owner}),
				"Promotion reserve should be more than promotion debt");
		})

		it('Fail if amount more than max',async () =>{
			await expectRevert(Holdefi.withdrawPromotionReserve(SampleToken1.address, decimal18.multipliedBy(1000), {from: owner}),
				"Amount should be less than max");
		})

		it('Fail if called by other accounts',async () =>{
			await expectRevert(Holdefi.withdrawPromotionReserve(SampleToken1.address, 10, {from: user1}),
				"Sender should be Owner");
		})
	})
	
	describe("Withdraw liquidation reserves", async() =>{
		beforeEach(async () => {
			await scenario(owner,ownerChanger,user1, user2, user3, user4);
			await assignToken(owner, user5, SampleToken1);
			await Holdefi.methods['supply()']({from:user1, value: decimal18.multipliedBy(1)});	        
			await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user5});
			await Holdefi.borrow(constants.ZERO_ADDRESS, SampleToken1.address, decimal18.multipliedBy(0.65), {from: user5});
			
			await HoldefiPrices.setPrice(SampleToken1.address, decimal18.multipliedBy(9));   
			await Holdefi.liquidateBorrowerCollateral(user5, SampleToken1.address);
			this.adminBalanceBefore = await SampleToken1.balanceOf(owner);
			await time.increase(time.duration.days(1));
		})

		it('Should withdraw liquidation reserves', async () => {
			let getLiquidationReserveBefore = await Holdefi.getLiquidationReserve(SampleToken1.address);
			await Holdefi.withdrawLiquidationReserve(SampleToken1.address, getLiquidationReserveBefore);
			let getLiquidationReserveAfter = await Holdefi.getLiquidationReserve(SampleToken1.address); 
			let adminBalanceAfter = await SampleToken1.balanceOf(owner);

			assert.equal(adminBalanceBefore.toString(), bigNumber(adminBalanceAfter).minus(getLiquidationReserveBefore).toString(), 'Admin Balance increased correctly');   
			assert.equal(getLiquidationReserveAfter.toString(), 0, "Reserve withdrawn")
		})

		it('Should withdraw all liquidatedCollaterals if no debt', async () => {
			let marketDebtBefore = await Holdefi.marketDebt(SampleToken1.address, constants.ZERO_ADDRESS);
			await Holdefi.methods['buyLiquidatedCollateral(address)'](SampleToken1.address,  {from: user6 , value: marketDebtBefore});
		
			let getLiquidatedCollateralBefore = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;    
			let getLiquidationReserveBefore = await Holdefi.getLiquidationReserve(SampleToken1.address);
			
			await Holdefi.withdrawLiquidationReserve(SampleToken1.address, bigNumber(getLiquidationReserveBefore).multipliedBy(2));
			let getLiquidationReserveAfter = await Holdefi.getLiquidationReserve(SampleToken1.address);
			let getLiquidatedCollateralAfter = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;    
			let adminBalanceAfter = await SampleToken1.balanceOf(owner);
			
			assert.equal(adminBalanceBefore.toString(), bigNumber(adminBalanceAfter).minus(getLiquidationReserveBefore).toString(), 'Admin Balance increase correctly');
			assert.equal(getLiquidatedCollateralBefore.toString(), getLiquidationReserveBefore.toString(),'Liquidated collateral and liquidation reserve are equal')
			assert.equal(getLiquidatedCollateralAfter.toString(), 0,'No liquidated collateral')
			assert.equal(getLiquidationReserveAfter.toString(), 0,'No liquidation reserve')
		})

		it('Fail if withdraw collateral reserves by other accounts ', async () => {
			let getLiquidatedCollateral = (await Holdefi.collateralAssets(SampleToken1.address)).totalLiquidatedCollateral;             	        
			await expectRevert(Holdefi.withdrawLiquidationReserve(SampleToken1.address, getLiquidatedCollateral,{from: user1}),
				'Sender should be Owner')
		})
	}) 
})
