const {constants, balance, time, expectRevert} = require('@openzeppelin/test-helpers');
const bigNumber = require('bignumber.js');
bigNumber.config({ DECIMAL_PLACES: 0, EXPONENTIAL_AT: 1e+9, ROUNDING_MODE: bigNumber.ROUND_FLOOR});

const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const referralCode = 1234;
const decimal18  = bigNumber(10).pow(18);
const ratesDecimal = bigNumber(10).pow(4);
const secondsPerYear = bigNumber(31536000);
const gasPrice = bigNumber(20000000000); //from ganache

const HoldefiContract = artifacts.require("Holdefi");
const HoldefiSettingsContract = artifacts.require("HoldefiSettings");
const HoldefiPricesContract = artifacts.require("HoldefiPrices");
const HoldefiCollateralsContract = artifacts.require("HoldefiCollaterals");
const AggregatorContract = artifacts.require("Utils/AggregatorV3");
const SampleTokenContract = artifacts.require("Utils/ERC20");
const SampleDeflatingTokenContract = artifacts.require("Utils/DeflatingERC20");


async function convertToDecimals(obejct, amount) {
	let decimals = await obejct.decimals();
	return(bigNumber(10).pow(decimals).multipliedBy(amount));
}

function roundNumber(amount, scale) {
	let x = Math.floor(scale/4)
	let scalePow = bigNumber(10).pow(scale);
	return(bigNumber(amount).dividedBy(scalePow).multipliedBy(scalePow));
}

function convertReserve(amount){
	return(bigNumber(amount).dividedBy(ratesDecimal).dividedBy(secondsPerYear));
}

async function initializeContracts(owner){
	HoldefiSettings = await HoldefiSettingsContract.new({from: owner});
	HoldefiPrices = await HoldefiPricesContract.new({from: owner});
	Holdefi = await HoldefiContract.new(HoldefiSettings.address, HoldefiPrices.address, {from: owner});
	await HoldefiSettings.setHoldefiContract(Holdefi.address, {from: owner});

	SampleToken1 = await SampleTokenContract.new("SampleToken1", "ST1", 8,{from: owner});
	SampleToken2 = await SampleTokenContract.new("SampleToken2", "ST2", 18,{from: owner});
	SampleToken3 = await SampleTokenContract.new("SampleToken3", "ST3", 6,{from: owner});
	SampleToken4 = await SampleTokenContract.new("SampleToken4", "ST4", 10,{from: owner});
	SampleToken5 = await SampleDeflatingTokenContract.new("SampleToken5", "ST5", 18,{from: owner});
}

async function initializePrices(owner) {
	SampleToken1PriceAggregator = await AggregatorContract.new(17, {from: owner});
	SampleToken2PriceAggregator = await AggregatorContract.new(11, {from: owner});
	SampleToken3PriceAggregator = await AggregatorContract.new(9, {from: owner});
	SampleToken4PriceAggregator = await AggregatorContract.new(13, {from: owner});
	SampleToken5PriceAggregator = await AggregatorContract.new(18, {from: owner});

	await HoldefiPrices.setPriceAggregator(
		SampleToken1.address,
		await SampleToken1.decimals(),
		SampleToken1PriceAggregator.address,
		{from: owner}
	);

	await HoldefiPrices.setPriceAggregator(
		SampleToken2.address,
		await SampleToken2.decimals(),
		SampleToken2PriceAggregator.address,
		{from: owner}
	);

	await HoldefiPrices.setPriceAggregator(
		SampleToken3.address,
		await SampleToken3.decimals(),
		SampleToken3PriceAggregator.address,
		{from: owner}
	);

	await HoldefiPrices.setPriceAggregator(
		SampleToken4.address,
		await SampleToken4.decimals(),
		SampleToken4PriceAggregator.address,
		{from: owner}
	);

	await HoldefiPrices.setPriceAggregator(
		SampleToken5.address,
		await SampleToken5.decimals(),
		SampleToken5PriceAggregator.address,
		{from: owner}
	);

	await SampleToken1PriceAggregator.setPrice(
		await convertToDecimals(SampleToken1PriceAggregator, 10/200),
		{from: owner}
	);
	await SampleToken2PriceAggregator.setPrice(
		await convertToDecimals(SampleToken2PriceAggregator, 15/200),
		{from: owner}
	);
	await SampleToken3PriceAggregator.setPrice(
		await convertToDecimals(SampleToken3PriceAggregator, 1/200),
		{from: owner}
	);	
	await SampleToken4PriceAggregator.setPrice(
		await convertToDecimals(SampleToken4PriceAggregator, 1/200),
		{from: owner}
	);
	await SampleToken5PriceAggregator.setPrice(
		await convertToDecimals(SampleToken5PriceAggregator, 1/200),
		{from: owner}
	);
}

async function assignToken(owner, user, token){
	await token.mint(user, await convertToDecimals(token, 900), {from: owner});
	await token.approve(Holdefi.address, await convertToDecimals(token, 800), {from: user});
}

async function scenario(owner, user1, user2, user3, user4) {
	//base 
	await initializeContracts(owner);
	await initializePrices(owner);

	//SampleToken1 Market: borrowRate = 10%, suppliersShareRate = 90%
	await HoldefiSettings.addMarket(
		SampleToken1.address,
		ratesDecimal.multipliedBy(0.1),
		ratesDecimal.multipliedBy(0.9),
		{from:owner}
	);

	//SampleToken5 Market: borrowRate = 10%, suppliersShareRate = 90%
	await HoldefiSettings.addMarket(
		SampleToken5.address,
		ratesDecimal.multipliedBy(0.1),
		ratesDecimal.multipliedBy(0.9),
		{from:owner}
	);

	//ETH Market: borrowRate = 10%, suppliersShareRate = 90%
	await HoldefiSettings.addMarket(
		ethAddress,
		ratesDecimal.multipliedBy(0.1),
		ratesDecimal.multipliedBy(0.9),
		{from:owner}
	);

	//ETH Collateral: valueToLoanRate = 150%, penaltyRate = 120%, bonusRate = 105%
	await HoldefiSettings.addCollateral(
		ethAddress,
		ratesDecimal.multipliedBy(1.5), 
		ratesDecimal.multipliedBy(1.2),
		ratesDecimal.multipliedBy(1.05),
		{from:owner}
	);

	//ERC20 Collateral: valueToLoanRate = 150%, penaltyRate = 120%, bonusRate = 105%
	await HoldefiSettings.addCollateral(
		SampleToken1.address,
		ratesDecimal.multipliedBy(1.5), 
		ratesDecimal.multipliedBy(1.2),
		ratesDecimal.multipliedBy(1.05),
		{from:owner}
	);

	//Deflating ERC20 Collateral: valueToLoanRate = 150%, penaltyRate = 120%, bonusRate = 105%
	await HoldefiSettings.addCollateral(
		SampleToken5.address,
		ratesDecimal.multipliedBy(1.5), 
		ratesDecimal.multipliedBy(1.2),
		ratesDecimal.multipliedBy(1.05),
		{from:owner}
	);

	await assignToken(owner, user2, SampleToken1);
	await assignToken(owner, user2, SampleToken5);
	await assignToken(owner, user3, SampleToken1);
	await assignToken(owner, user4, SampleToken1);

	//supply
	await Holdefi.methods['supply(uint16)'](
		referralCode,
		{from:user1, value: decimal18.multipliedBy(1)}
	);

	await Holdefi.methods['supply(address,uint256,uint16)'](
		SampleToken1.address,
		await convertToDecimals(SampleToken1, 20),
		referralCode,
		{from:user2}
	);

	await Holdefi.methods['supply(address,uint256,uint16)'](
		SampleToken5.address,
		await convertToDecimals(SampleToken5, 200),
		referralCode,
		{from:user2}
	);

	//collateral
	await Holdefi.methods['collateralize()']({from:user3, value: decimal18.multipliedBy(1)});
	await Holdefi.borrow(
		SampleToken1.address,
		ethAddress,
		await convertToDecimals(SampleToken1, 5),
		referralCode,
		{from: user3}
	);
	await Holdefi.methods['collateralize(address,uint256)'](
		SampleToken1.address,
		await convertToDecimals(SampleToken1, 20),
		{from:user4}
	);
	await Holdefi.borrow(
		ethAddress,
		SampleToken1.address,
		decimal18.multipliedBy(0.5),
		referralCode,
		{from: user4}
	);
}

async function scenario2(owner, user1, user2, user3, user4, user7) {
	//base 
	await initializeContracts(owner);
	await initializePrices(owner);

	//SampleToken1 Market: borrowRate = 10%, suppliersShareRate = 90%
	await HoldefiSettings.addMarket(
		ethAddress,
		ratesDecimal.multipliedBy(0.1),
		ratesDecimal.multipliedBy(0.9),
		{from:owner}
	);

	//SampleToken1 Market: borrowRate = 10%, suppliersShareRate = 90%
	await HoldefiSettings.addMarket(
		SampleToken1.address,
		ratesDecimal.multipliedBy(0.1),
		ratesDecimal.multipliedBy(0.9),
		{from:owner}
	);

	//SampleToken1 Market: borrowRate = 10%, suppliersShareRate = 90%
	await HoldefiSettings.addMarket(
		SampleToken2.address,
		ratesDecimal.multipliedBy(0.1),
		ratesDecimal.multipliedBy(0.9),
		{from:owner}
	);

	//ETH Market: borrowRate = 10%, suppliersShareRate = 90%
	await HoldefiSettings.addMarket(
		SampleToken4.address,
		ratesDecimal.multipliedBy(0.1),
		ratesDecimal.multipliedBy(0.9),
		{from:owner}
	);

	//ERC20 Collateral: valueToLoanRate = 150%, penaltyRate = 120%, bonusRate = 105%
	await HoldefiSettings.addCollateral(
		ethAddress,
		ratesDecimal.multipliedBy(1.5), 
		ratesDecimal.multipliedBy(1.2),
		ratesDecimal.multipliedBy(1.05),
		{from:owner}
	);

	//ETH Collateral: valueToLoanRate = 150%, penaltyRate = 120%, bonusRate = 105%
	await HoldefiSettings.addCollateral(
		SampleToken3.address,
		ratesDecimal.multipliedBy(1.6), 
		ratesDecimal.multipliedBy(1.2),
		ratesDecimal.multipliedBy(1.05),
		{from:owner}
	);

	await assignToken(owner, user2, SampleToken1);
	await assignToken(owner, user3, SampleToken2);
	await assignToken(owner, user4, SampleToken4);
	await assignToken(owner, user7, SampleToken3);

	//supply
	await Holdefi.methods['supply(uint16)'](
		referralCode,
		{from:user1, value: decimal18.multipliedBy(1)}
	);

	await Holdefi.methods['supply(address,uint256,uint16)'](
		SampleToken1.address,
		await convertToDecimals(SampleToken1, 40),
		referralCode,
		{from:user2}
	);	

	await Holdefi.methods['supply(address,uint256,uint16)'](
		SampleToken2.address,
		await convertToDecimals(SampleToken2, 40),
		referralCode,
		{from:user3}
	);	

	await Holdefi.methods['supply(address,uint256,uint16)'](
		SampleToken4.address,
		await convertToDecimals(SampleToken4, 40),
		referralCode,
		{from:user4}
	);

	// collateral
	await Holdefi.methods['collateralize()']( {from:user7, value: decimal18.multipliedBy(1)});
	await Holdefi.borrow(
		SampleToken2.address,
		ethAddress,
		await convertToDecimals(SampleToken2, 3),
		referralCode,
		{from: user7}
	);	
	await Holdefi.borrow(
		SampleToken1.address,
		ethAddress,
		await convertToDecimals(SampleToken1, 8),
		referralCode,
		{from: user7}
	);

	await Holdefi.methods['collateralize(address,uint256)'](
		SampleToken3.address,
		await convertToDecimals(SampleToken3, 100),
		{from:user7}
	);
	await Holdefi.borrow(
		SampleToken1.address,
		SampleToken3.address,
		await convertToDecimals(SampleToken1, 2),
		referralCode,
		{from: user7}
	);	
	await Holdefi.borrow(
		SampleToken4.address,
		SampleToken3.address,
		await convertToDecimals(SampleToken4, 40),
		referralCode,
		{from: user7}
	);
}

module.exports = {
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
	convertReserve,
	initializeContracts,
	assignToken,
	scenario,
	scenario2
}	