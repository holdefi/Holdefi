const {   
  constants,
  balance,
  time,
  expectRevert,
  bigNumber,
  decimal18,
  ratesDecimal,
  secondsPerYear,
} = require ("./Utils.js");

const OwnableContract = artifacts.require('Ownable');

contract('Ownable', function([owner, ownerChanger, user1, user2]){
    beforeEach(async () => {
        Ownable = await OwnableContract.new(ownerChanger, {from: owner});
    });

    it('Owner and ownerChanger should be set', async () => {
        let newOwner = await Ownable.owner()
        assert.equal(newOwner, owner, 'Owner is set in constructor');

        let newOwnerChanger = await Ownable.ownerChanger();
        assert.equal(newOwnerChanger, ownerChanger, 'OwnerChanger is set');
    });

    it('Owner should be changed after transfering ownership and accepting transfer ownership by owner changer', async () => { 
        await Ownable.transferOwnership(user1, {from: owner});
        await Ownable.acceptTransferOwnership({from: ownerChanger});
        let newOwner = await Ownable.owner();
        assert.equal(newOwner, user1, 'Owner is changed');
    });

    it('Owner should not be changed after only transfer ownership', async () => {
        await Ownable.transferOwnership(user1, {from: owner});
        let newOwner = await Ownable.owner();
        assert.equal(newOwner, owner, 'Owner is not changed')
    });

    it('Fail if other account accept transfer ownership', async () => {
        await Ownable.transferOwnership(user1, {from: owner});
        await expectRevert(Ownable.acceptTransferOwnership({from: user2}),'Sender should be ownerChanger');
        let newOwner = await Ownable.owner();
        assert.equal(newOwner, owner, 'Owner is not changed');
    });

    it('Fail if no pending owner before acceptTransferOwnership', async () => {     
        await expectRevert(Ownable.acceptTransferOwnership ({from: ownerChanger}),'Pending Owner is empty');
    });

    it('Fail if other accounts changed ownership', async () => {
        await expectRevert(Ownable.transferOwnership(user2, {from: user1}),'Sender should be Owner');
    });

    it('Fail if ownership transfered to zero address', async () => {
        await expectRevert(Ownable.transferOwnership(constants.ZERO_ADDRESS),'New owner can not be zero address');
    });
});
