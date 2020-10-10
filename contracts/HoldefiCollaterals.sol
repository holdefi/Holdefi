// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// This contract holds collateralls
contract HoldefiCollaterals {

	address constant public ethAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

	address public holdefiContract;

	modifier onlyHoldefiContract() {
        require (msg.sender == holdefiContract, "Sender should be holdefi contract");
        _;
    }

	// Disposable function to Get in touch with Holdefi contract
	function setHoldefiContract(address holdefiContractAddress) external {
		require (holdefiContract == address(0),'Should be set once');
		holdefiContract = holdefiContractAddress;
	}
	
	// Holdefi contract withdraws collateral's tokens from this contract to caller's account
	function withdraw (address collateral, address recipient, uint256 amount)
		external
		onlyHoldefiContract
	{
		bool success = false;
		if (collateral == ethAddress){
			(success, ) = recipient.call{value:amount}("");
		}
		else {
			IERC20 token = IERC20(collateral);
			success = token.transfer(recipient, amount);
		}
		require (success, "Cannot Transfer");
	}

	receive() external payable onlyHoldefiContract {
	}
}