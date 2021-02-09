# Holdefi #
Holdefi is a lending platform, where users can hold their assets and receive interest or borrow tokens and repay it after a while. There are two principal roles: supplier and borrower.
In Holdefi, the borrowing rate for each market is determined by the administrator. The interest received from the borrowers is distributed among the suppliers according to the amount they have supplied. Therefore, the supply rate is calculated automatically based on the total supply in the protocol. Admin can also increase the supply rate through the promotion rate. To do this, the admin must have no debt to the promotion.
Borrowers have to add collateral before borrowing any token. The collateral value should be more than the value of the assets they want to borrow. This collateral is, in fact, a guarantee that they will repay the borrowed asset. The backing of each loan can only be one specific collateral asset, but each collateral can be used to borrow several different assets.
Each user earns POWER when depositing collateral, and this POWER is directly related to the price and the number of deposited collateral and collateral’s value to loan rate (VTL). The collateral remains intact until the debt is fully paid or it’s liquidated. User collateral will not receive any interest in this protocol.
## Contracts in Holdefi ##
### Holdefi.sol ###
Holdefi main contract that all the main functions are in this contact and users interact with this contract.
### HoldefiCollaterals.sol ###
All collateral held in this contract.
### HoldefiOwnable.sol ###
Contract module which provides a basic access control mechanism, where there is an account (an owner) that can be granted exclusive access to specific functions.
### HoldefiPausableOwnable.sol ###
Base contract which allows children to implement an emergency stop mechanism.
### HoldefiPrices.sol ###
This contract uses Chainlink Price Oracle for getting tokens price.
### HoldefiSettings.sol ###
This contract is for Holdefi settings implementation such as adding new markets and collaterals, setting rates, etc.
## License ##
The Holdefi protocol in under SPDX License: UNLICENSED
## Discussion  ##
For more info contact with business@holdefi.com

