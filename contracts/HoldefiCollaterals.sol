// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

interface ERC20 {

    function transfer(address recipient, uint256 amount) external returns (bool);
}

// This contract holds collateralls
contract HoldefiCollaterals {

	address public holdefiContract;

	// Disposable function to Get in touch with Holdefi contract
	function setHoldefiContract(address holdefiContractAddress) external {
		require (holdefiContract == address(0),'Should be set once');
		holdefiContract = holdefiContractAddress;
	}
	
	// Holdefi contract withdraws collateral's tokens from this contract to caller's account
	function withdraw (address collateralAsset, address payable recipient, uint amount) external {
		require (msg.sender == holdefiContract,'Sender should be holdefi contract');
		
		if (collateralAsset == address(0)){
			recipient.transfer(amount);
		}
		else {
			ERC20 token = ERC20(collateralAsset);
			bool success = token.transfer(recipient, amount);
			require (success, 'Cannot Transfer Token');
		}
	}

	receive() external payable {
		require (msg.sender == holdefiContract,'Sender should be holdefi contract');
	}
}