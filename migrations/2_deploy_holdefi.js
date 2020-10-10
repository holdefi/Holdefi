const Holdefi = artifacts.require("Holdefi");
const HoldefiSettings = artifacts.require("HoldefiSettings");
const HoldefiPrices = artifacts.require("HoldefiPrices");
const Wallet = artifacts.require("CollateralsWallet");

module.exports = function(deployer) {
	deployer.deploy(HoldefiPrices, '0x69a00155916CFdB78103457395c124055214DE01', Medianizer.address).then(function(){
		return deployer.deploy(HoldefiSettings, '0x69a00155916CFdB78103457395c124055214DE01').then(function(){
    		return deployer.deploy(Wallet).then(function(){
    			return deployer.deploy(Holdefi, '0x69a00155916CFdB78103457395c124055214DE01', Wallet.address, HoldefiSettings.address, HoldefiPrices.address);
    		})
    	})
	})
}