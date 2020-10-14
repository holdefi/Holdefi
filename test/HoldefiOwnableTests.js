const {   
  constants,
  expectRevert,
} = require ("./Utils.js");

const HoldefiOwnableContract = artifacts.require('HoldefiOwnable');

contract('HoldefiOwnable', function([owner, user1, user2]){
    beforeEach(async () => {
        Ownable = await HoldefiOwnableContract.new({from: owner});
    });

    it('Owner should be set', async () => {
        let newOwner = await Ownable.owner()
        assert.equal(newOwner, owner, 'Owner is set in constructor');
    });

    it('Owner should be changed after transfering ownership and accepting transfer ownership by new owner',
        async () => { 
            await Ownable.transferOwnership(user1, {from: owner});
            await Ownable.acceptTransferOwnership({from: user1});
            let newOwner = await Ownable.owner();
            assert.equal(newOwner, user1, 'Owner is changed');
        }
    );

    it('Owner should not be changed after only transfer ownership', async () => {
        await Ownable.transferOwnership(user1, {from: owner});
        let newOwner = await Ownable.owner();
        assert.equal(newOwner, owner, 'Owner is not changed')
    });

    it('Fail if other account accept transfer ownership', async () => {
        await Ownable.transferOwnership(user1, {from: owner});
        await expectRevert(Ownable.acceptTransferOwnership({from: user2}),'Pending owner is not same as sender');
        let newOwner = await Ownable.owner();
        assert.equal(newOwner, owner, 'Owner is not changed');
    });

    it('Fail if no pending owner before acceptTransferOwnership', async () => {
        await expectRevert(Ownable.acceptTransferOwnership ({from: user1}),'Pending owner is empty');
    });

    it('Fail if other accounts changed ownership', async () => {
        await expectRevert(Ownable.transferOwnership(user2, {from: user1}),'Sender should be owner');
    });

    it('Fail if ownership transfered to zero address', async () => {
        await expectRevert(Ownable.transferOwnership(constants.ZERO_ADDRESS),'New owner can not be zero address');
    });
});
