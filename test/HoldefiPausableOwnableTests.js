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

    it('Should set pauser by owner', async () => {
        await HoldefiPauser.setPauser(pauser)
        let pauserAccount = await HoldefiPauser.pauser();
        assert.equal(pauser,pauserAccount);
    })

    it('Should not be paused after deploy', async () => {
        let paused = await HoldefiPauser.isPaused("supply");
        assert.isFalse(paused);
    });

    it('Should pause if owner call pause', async () => {
        await HoldefiPauser.pause("supply", 1000, {from: owner});
        let paused = await HoldefiPauser.isPaused("supply");
        assert.isTrue(paused);
    });

    it('Should unpause if paused before', async () => {
        await HoldefiPauser.pause("supply", 1000, {from: owner});    
        await HoldefiPauser.unpause("supply", {from: owner});
        let paused = await HoldefiPauser.isPaused("supply");
        assert.isFalse(paused);
    });

    it('Should pause selected functions by owner', async () => {
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

    it('Should pause selected functions by pauser', async () => {
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
    
    it('Should unpause selected functions by owner', async () => {
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

    it('Fail if set pauser by other accounts', async () => {
        await expectRevert(HoldefiPauser.setPauser(pauser,{from: user1}),
          "Sender should be owner")
    })

    it('Fail if other accounts call pause', async () => {
        await expectRevert(HoldefiPauser.pause("supply", 1000, {from: user1}),
          "Sender should be owner or pauser");
    });

    it('Fail if other accounts call unpause', async () => {
        await HoldefiPauser.pause("supply", 1000, {from: owner});
        await expectRevert(HoldefiPauser.unpause("supply", {from: user1}),
          "Sender should be owner");
    });

    it('Fail if pauser call unpause', async () => {
        await HoldefiPauser.pause("supply", 1000, {from: owner});
        await expectRevert(HoldefiPauser.unpause("supply", {from: pauser}),
          "Sender should be owner");
    });

    it('Fail if other accounts call batchPause', async () => {
        let pauseList = ["supply", "borrow", "withdrawCollateral"];
        let pauseDurations = [1000, 1000, 2000];
        await expectRevert(HoldefiPauser.batchPause(pauseList, pauseDurations, {from: user1}),
          "Sender should be owner");
    });

    it('Fail if unpause selected functions by other accounts', async () => {
        let pauseList = ["supply", "borrow", "withdrawCollateral"];
        let pauseDurations = [1000, 1000, 2000];
        await HoldefiPauser.batchPause(pauseList, pauseDurations, {from: owner});
        let unpauseList =  ["borrow", "withdrawCollateral"];
        await expectRevert(HoldefiPauser.batchUnpause(unpauseList, {from: user1}),
          "Sender should be owner");  
    });

    it('Fail if unpause selected functions by pauser', async () => {
        await HoldefiPauser.setPauser(pauser)
        let pauseList = ["supply", "borrow", "withdrawCollateral"];
        let pauseDurations = [1000, 1000, 2000];
        await HoldefiPauser.batchPause(pauseList, pauseDurations, {from: owner});
        let unpauseList =  ["borrow", "withdrawCollateral"];
        await expectRevert(HoldefiPauser.batchUnpause(unpauseList, {from: pauser}),
          "Sender should be owner");   
    });  

    it('Fail pause if operation is not valid', async () => {
        await expectRevert(HoldefiPauser.pause("invalid", 1000, {from: owner}),
        "Operation is not valid");   
    });    

    it('Fail unpause if operation is not valid', async () => {
        await expectRevert(HoldefiPauser.unpause("invalid", {from: owner}),
        "Operation is not valid");   
    });

    it('Fail pause if paused before', async () => {
        await HoldefiPauser.pause("supply", 1000, {from: owner});
        await expectRevert(HoldefiPauser.pause("supply", 1000, {from: owner}),
        "Operation is paused");   
    });     

    it('Fail unpause if unpaused before', async () => {
        await HoldefiPauser.pause("supply", 1000, {from: owner});    
        await HoldefiPauser.unpause("supply", {from: owner});
        await expectRevert(HoldefiPauser.unpause("supply", {from: owner}),
        "Operation is unpaused");   
    }); 
})