const Holdefi = artifacts.require("Holdefi");
const HoldefiSettings = artifacts.require("HoldefiSettings");
const HoldefiPrices = artifacts.require("HoldefiPrices");

module.exports = function(deployer) {
	deployer.deploy(HoldefiPrices).then(function(){
		return deployer.deploy(HoldefiSettings).then(function(){
    		return deployer.deploy(Holdefi, HoldefiSettings.address, HoldefiPrices.address);
    	})
	})
}