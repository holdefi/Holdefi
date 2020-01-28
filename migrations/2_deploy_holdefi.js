const Holdefi = artifacts.require("Holdefi");
const HoldefiSettings = artifacts.require("HoldefiSettings");
const Medianizer = artifacts.require("SimpleMedianizer");
const HoldefiPrices = artifacts.require("HoldefiPrices");
const Wallet = artifacts.require("CollateralsWallet");
const SampleToken1 = artifacts.require("SampleToken");
const SampleToken2 = artifacts.require("SampleToken");

module.exports = function(deployer) {
	deployer.deploy(SampleToken1,"SampleToken1", "ST1", 18);
	deployer.deploy(SampleToken2,"SampleToken2", "ST2", 18);
	deployer.deploy(Medianizer).then(function(){
		return deployer.deploy(HoldefiPrices, '0x69a00155916CFdB78103457395c124055214DE01', Medianizer.address).then(function(){
			return deployer.deploy(HoldefiSettings, '0x69a00155916CFdB78103457395c124055214DE01').then(function(){
    			return deployer.deploy(Wallet).then(function(){
    				return deployer.deploy(Holdefi, '0x69a00155916CFdB78103457395c124055214DE01', Wallet.address, HoldefiSettings.address, HoldefiPrices.address);
    			})
    		})
		})
	})
}