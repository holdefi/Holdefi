const { constants, balance, time, expectRevert } = require('@openzeppelin/test-helpers');
const bigNumber = require('bignumber.js');
bigNumber.config({ DECIMAL_PLACES: 0, EXPONENTIAL_AT: 1e+9});
const decimal18  = bigNumber(10**18);
const ratesDecimal = bigNumber(10**4);
const secondsPerYear = bigNumber(31536000);
const gasPrice = bigNumber(20000000000); //from ganache

const HoldefiContract = artifacts.require("Holdefi");
const HoldefiSettingsContract = artifacts.require("HoldefiSettings");
const MedianizerContract = artifacts.require("SimpleMedianizer");
const HoldefiPricesContract = artifacts.require("HoldefiPrices");
const SampleTokenContract = artifacts.require("SampleToken");
const CollateralsWalletContract = artifacts.require("CollateralsWallet");

async function initializeContracts(owner, ownerChanger){
	SampleToken1 = await SampleTokenContract.new("SampleToken1", "ST1", 18,{from: owner});
	SampleToken2 = await SampleTokenContract.new("SampleToken2", "ST2", 18,{from: owner});
	SampleTokenStable = await SampleTokenContract.new("SampleTokenStable", "ST3", 18,{from: owner});
	CollateralsWallet = await CollateralsWalletContract.new({from: owner})	
	Medianizer = await MedianizerContract.new({from: owner})
	HoldefiSettings = await HoldefiSettingsContract.new(ownerChanger, {from: owner});
	HoldefiPrices = await HoldefiPricesContract.new(ownerChanger, Medianizer.address,{from: owner});
	Holdefi = await HoldefiContract.new(ownerChanger, CollateralsWallet.address, HoldefiSettings.address, HoldefiPrices.address, {from: owner});
	await CollateralsWallet.setHoldefiContract(Holdefi.address, {from: owner});
	await HoldefiSettings.setHoldefiContract(Holdefi.address, {from: owner});
}

async function assignToken(owner, user, token){
	await token.mint(user, decimal18.multipliedBy(900), {from: owner});
	await token.approve(Holdefi.address, decimal18.multipliedBy(800), {from: user});
}

async function addERC20Market(owner, tokenAddress, borrowRate, price){
	await HoldefiPrices.setPrice(tokenAddress, price);
	await HoldefiSettings.addMarket(tokenAddress, borrowRate, ratesDecimal.multipliedBy(0.9),{from:owner});
}

async function addStableCoinMarket(owner, tokenAddress, borrowRate){
	await HoldefiPrices.addStableCoin(tokenAddress);
	await HoldefiSettings.addMarket(tokenAddress, borrowRate, ratesDecimal.multipliedBy(0.9),{from:owner});
}

async function addETHMarket(owner, borrowRate){
	await HoldefiSettings.addMarket(constants.ZERO_ADDRESS, borrowRate, ratesDecimal.multipliedBy(0.9), {from:owner});
}

async function addERC20Collateral(owner, tokenAddress, price, liquidationThresholdRate, liquidationPenaltyRate, liquidationBonusRate){
	await HoldefiPrices.setPrice(tokenAddress, price);
	await HoldefiSettings.addCollateral(tokenAddress, liquidationThresholdRate, liquidationPenaltyRate, liquidationBonusRate)
}

async function scenario(owner,ownerChanger,user1,user2,user3,user4) {
	//base 	
	await initializeContracts(owner, ownerChanger);	
	await addERC20Market(owner, SampleToken1.address, ratesDecimal.multipliedBy(0.1), decimal18.multipliedBy(10));
	await addETHMarket(owner, ratesDecimal.multipliedBy(0.1));
	await assignToken(owner, user2, SampleToken1);
	await assignToken(owner, user3, SampleToken1);
	await assignToken(owner, user4, SampleToken1);
	await HoldefiSettings.addCollateral(constants.ZERO_ADDRESS, ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05), {from:owner});
	await addERC20Collateral(owner, SampleToken1.address, decimal18.multipliedBy(10), ratesDecimal.multipliedBy(1.5), ratesDecimal.multipliedBy(1.2), ratesDecimal.multipliedBy(1.05), {from:owner});

	//supply
	await Holdefi.methods['supply()']({from:user1, value: decimal18.multipliedBy(1)});
	await Holdefi.methods['supply(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user2});

	//collateral
	await Holdefi.methods['collateralize()']({from:user3, value: decimal18.multipliedBy(1)});
	await Holdefi.borrow(SampleToken1.address, constants.ZERO_ADDRESS, decimal18.multipliedBy(5), {from: user3});
	await Holdefi.methods['collateralize(address,uint256)'](SampleToken1.address, decimal18.multipliedBy(20), {from:user4});
	await Holdefi.borrow(constants.ZERO_ADDRESS, SampleToken1.address, decimal18.multipliedBy(0.5), {from: user4});
}

module.exports = {
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
}	