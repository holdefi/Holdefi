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

    it('Owner should be changed after calling transferOwnership by owner and then calling acceptTransferOwnership by the new owner',
        async () => { 
            await Ownable.transferOwnership(user1, {from: owner});
            await Ownable.acceptTransferOwnership({from: user1});
            let newOwner = await Ownable.owner();
            assert.equal(newOwner, user1, 'Owner is changed');
        }
    );

    it('Owner should not be changed just after calling transferOwnership', async () => {
        await Ownable.transferOwnership(user1, {from: owner});
        let newOwner = await Ownable.owner();
        assert.equal(newOwner, owner, 'Owner is not changed')
    });

    it('Fail if a non-pendingOwner account calls acceptTransferOwnership', async () => {
        await Ownable.transferOwnership(user1, {from: owner});
        await expectRevert(Ownable.acceptTransferOwnership({from: user2}),'OE04');
        let newOwner = await Ownable.owner();
        assert.equal(newOwner, owner, 'Owner is not changed');
    });

    it('Fail if calling acceptTransferOwnership before calling transferOwnership', async () => {
        await expectRevert(Ownable.acceptTransferOwnership ({from: user1}),'OE03');
    });

    it('Fail if a non-owner account calls transferOwnership', async () => {
        await expectRevert(Ownable.transferOwnership(user2, {from: user1}),'OE01');
    });

    it('Fail if try to call transferOwnership to zero address', async () => {
        await expectRevert(Ownable.transferOwnership(constants.ZERO_ADDRESS),'OE02');
    });
});
