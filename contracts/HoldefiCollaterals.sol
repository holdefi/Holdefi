// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract HoldefiCollaterals {

	address constant public ethAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

	address public holdefiContract;

	constructor() public {
		holdefiContract = msg.sender;
	}

    modifier onlyHoldefiContract() {
        require (msg.sender == holdefiContract, "Sender should be holdefi contract");
        _;
    }

    receive() external payable onlyHoldefiContract {
	}

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
}