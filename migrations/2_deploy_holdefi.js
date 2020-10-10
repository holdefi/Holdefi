const Holdefi = artifacts.require("Holdefi");
const HoldefiSettings = artifacts.require("HoldefiSettings");
const HoldefiPrices = artifacts.require("HoldefiPrices");
const Wallet = artifacts.require("CollateralsWallet");

module.exports = function(deployer) {
	deployer.deploy(HoldefiPrices).then(function(){
		return deployer.deploy(HoldefiSettings).then(function(){
    		return deployer.deploy(Wallet).then(function(){
    			return deployer.deploy(Holdefi, Wallet.address, HoldefiSettings.address, HoldefiPrices.address);
    		})
    	})
	})
}