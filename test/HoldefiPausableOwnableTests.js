const {
  expectRevert,
} = require ("./Utils.js");

const HoldefiPausableOwnableContract = artifacts.require('HoldefiPausableOwnable');

contract('HoldefiPausableOwnable', function([owner, pauser, user1, duser2]){
    beforeEach(async () => {
        HoldefiPauser = await HoldefiPausableOwnableContract.new({from: owner});
        operations = [
        "supply",
        "withdrawSupply", 
        "collatralize",
        "withdrawCollateral",
        "borrow",
        "repayBorrrow",
        "liquidateBorrowerCollateral",
        "buyLiquidatedCollateral"
        ];
    });

    it('Pauser should be set after calling setPauser by owner', async () => {
        await HoldefiPauser.setPauser(pauser)
        let pauserAccount = await HoldefiPauser.pauser();
        assert.equal(pauser,pauserAccount);
    })

    it('Operations initial state should be unpaused', async () => {
        let paused = await HoldefiPauser.isPaused("supply");
        assert.isFalse(paused);
    });

    it('Single operation should be paused after calling pause function by owner', async () => {
        await HoldefiPauser.pause("supply", 1000, {from: owner});
        let paused = await HoldefiPauser.isPaused("supply");
        assert.isTrue(paused);
    });

    it('Single operation should be paused after calling pause function by pauser', async () => {
        await HoldefiPauser.setPauser(pauser);
        await HoldefiPauser.pause("supply", 1000, {from: pauser});
        let paused = await HoldefiPauser.isPaused("supply");
        assert.isTrue(paused);
    });

    it('Single operation should be unpaused after calling unpause function by owner (if they where paused before)', async () => {
        await HoldefiPauser.pause("supply", 1000, {from: owner});    
        await HoldefiPauser.unpause("supply", {from: owner});
        let paused = await HoldefiPauser.isPaused("supply");
        assert.isFalse(paused);
    });

    it('Operations should be paused after calling batchPause function by owner', async () => {
        let pauseList = ["supply", "borrow", "withdrawCollateral"];
        let pauseDurations = [1000, 1000, 2000];
        await HoldefiPauser.batchPause(pauseList, pauseDurations, {from: owner});
        let paused;
        let index;
        let operation;
        for (index in operations) {
            operation = operations[index];
            paused = await HoldefiPauser.isPaused(operation);
            if (pauseList.includes(operation))
                assert.isTrue(paused);
            else
                assert.isFalse(paused);
        }
    });

    it('Operations should be paused after calling batchPause function by pauser', async () => {
        await HoldefiPauser.setPauser(pauser)
        let pauseList = ["supply", "borrow", "withdrawCollateral"];
        let pauseDurations = [1000, 1000, 2000];
        await HoldefiPauser.batchPause(pauseList, pauseDurations, {from: pauser});
        let paused;
        let index;
        let operation;
        for (index in operations) {
            operation = operations[index];
            paused = await HoldefiPauser.isPaused(operation);
            if (pauseList.includes(operation))
                assert.isTrue(paused);
            else
                assert.isFalse(paused);
        }
    });
    
    it('Operations should be unpaused after calling batchUnpause function by owner', async () => {
        let pauseList = ["supply", "borrow", "withdrawCollateral"];
        let pauseDurations = [1000, 1000, 2000];
        await HoldefiPauser.batchPause(pauseList, pauseDurations, {from: owner});
        let unpauseList =  ["borrow", "withdrawCollateral"];
        await HoldefiPauser.batchUnpause(unpauseList, {from: owner});   
        let paused;
        let index;
        let operation;
        for (index in operations) {
            operation = operations[index];
            paused = await HoldefiPauser.isPaused(operation);
            if (pauseList.includes(operation) && !unpauseList.includes(operation))
                assert.isTrue(paused);
            else
                assert.isFalse(paused);
        }
    });

    it('Fail if a non-owner account calls setPauser', async () => {
        await expectRevert(HoldefiPauser.setPauser(pauser,{from: user1}),
          "OE01")
    })

    it('Fail if a non-owner or non-pauser account calls pause', async () => {
        await expectRevert(HoldefiPauser.pause("supply", 1000, {from: user1}),
          "POE01");
    });

    it('Fail if a non-owner account calls unpause', async () => {
        await HoldefiPauser.pause("supply", 1000, {from: owner});
        await expectRevert(HoldefiPauser.unpause("supply", {from: user1}),
          "OE01");
    });

    it('Fail if pauser calls unpause', async () => {
        await HoldefiPauser.pause("supply", 1000, {from: owner});
        await expectRevert(HoldefiPauser.unpause("supply", {from: pauser}),
          "OE01");
    });

    it('Fail if a non-owner or non-pauser account calls batchPause', async () => {
        let pauseList = ["supply", "borrow", "withdrawCollateral"];
        let pauseDurations = [1000, 1000, 2000];
        await expectRevert(HoldefiPauser.batchPause(pauseList, pauseDurations, {from: user1}),
          "OE01");
    });

    it('Fail if try to call batchPause when operations count is not equal to pauseDurations count', async () => {
        let pauseList = ["supply", "borrow", "withdrawCollateral"];
        let pauseDurations = [1000];
        await expectRevert(HoldefiPauser.batchPause(pauseList, pauseDurations, {from: user1}),
          "OE06");
    });

    it('Fail if a non-owner account calls batchUnpause', async () => {
        let pauseList = ["supply", "borrow", "withdrawCollateral"];
        let pauseDurations = [1000, 1000, 2000];
        await HoldefiPauser.batchPause(pauseList, pauseDurations, {from: owner});
        let unpauseList =  ["borrow", "withdrawCollateral"];
        await expectRevert(HoldefiPauser.batchUnpause(unpauseList, {from: user1}),
          "OE01");  
    });

    it('Fail if pauser calls batchUnpause', async () => {
        await HoldefiPauser.setPauser(pauser)
        let pauseList = ["supply", "borrow", "withdrawCollateral"];
        let pauseDurations = [1000, 1000, 2000];
        await HoldefiPauser.batchPause(pauseList, pauseDurations, {from: owner});
        let unpauseList =  ["borrow", "withdrawCollateral"];
        await expectRevert(HoldefiPauser.batchUnpause(unpauseList, {from: pauser}),
          "OE01");   
    });  

    it('Fail if try to call pause an invalid operation', async () => {
        await expectRevert(HoldefiPauser.pause("sampleOperation", 1000, {from: owner}),
        "POE04");   
    });    

    it('Fail if try to call unpause an invalid operation', async () => {
        await expectRevert(HoldefiPauser.unpause("sampleOperation", {from: owner}),
        "POE04");   
    });

    it('Fail if try to call pause an already paused operation', async () => {
        await HoldefiPauser.pause("supply", 1000, {from: owner});
        await expectRevert(HoldefiPauser.pause("supply", 1000, {from: owner}),
        "POE02");   
    });     

    it('Fail if try to call pause an already unpaused operation', async () => {
        await HoldefiPauser.pause("supply", 1000, {from: owner});    
        await HoldefiPauser.unpause("supply", {from: owner});
        await expectRevert(HoldefiPauser.unpause("supply", {from: owner}),
        "POE03");   
    }); 
})