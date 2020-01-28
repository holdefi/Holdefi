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

const HoldefiPauserContract = artifacts.require('HoldefiPauser');

contract('HoldefiPauser', function([owner,ownerChanger,pauser,user1,user2]){
    beforeEach(async () => {
        HoldefiPauser = await HoldefiPauserContract.new(ownerChanger,{from: owner});
    });

    it('Should set pauser by owner', async () => {
        await HoldefiPauser.setPauser(pauser)
        let pauserAccount = await HoldefiPauser.pauser();
        assert.equal(pauser,pauserAccount);
    })

    it('Should not be paused after deploy', async () => {
        let paused = await HoldefiPauser.isPause(1);
        assert.isFalse(paused);
    });

    it('Should pause if owner call pause', async () => {
        await HoldefiPauser.pause(1, {from: owner});
        let paused = await HoldefiPauser.isPause(1);
        assert.isTrue(paused);
    });

    it('Should unpause if paused before', async () => {
        await HoldefiPauser.pause(1, {from: owner});    
        await HoldefiPauser.unpause(1, {from: owner});
        let paused = await HoldefiPauser.isPause(1);
        assert.isFalse(paused);
    });

    it('Should pause selected functions by owner', async () => {
        let newPaused1= [1,0,1,0,0,1,1,0];
        await HoldefiPauser.batchPause(newPaused1, {from: owner});
        let newPaused2= [0,1,0,0,0,0,0,1];
        await HoldefiPauser.batchPause(newPaused2, {from: owner});   
        let paused;
        let newPaused
        for (var i = 7; i >= 0; i--) {
          paused = await HoldefiPauser.isPause(i);
          newPaused = (newPaused1[i] || newPaused2[i]); 
          assert.equal(paused, newPaused);
        }
    });

    it('Should pause selected functions by pauser', async () => {
        await HoldefiPauser.setPauser(pauser)    
        let newPaused1= [1,0,1,0,0,1,1,0];
        await HoldefiPauser.batchPause(newPaused1, {from: pauser});
        let newPaused2= [0,1,0,0,0,0,0,1];
        await HoldefiPauser.batchPause(newPaused2, {from: pauser});   
        let paused;
        let newPaused
        for (var i = 7; i >= 0; i--) {
          paused = await HoldefiPauser.isPause(i);
          newPaused = (newPaused1[i] || newPaused2[i]); 
          assert.equal(paused, newPaused);
        }
    });
    
    it('Should unpause selected functions by owner', async () => {
        let newPaused1= [1,0,1,0,0,1,1,0];
        await HoldefiPauser.batchPause(newPaused1, {from: owner});
        let newPaused2= [0,0,0,0,0,1,1,0];
        await HoldefiPauser.batchUnpause(newPaused2, {from: owner});   
        let paused;
        let newPaused
        for (var i = 7; i >= 0; i--) {
          paused = await HoldefiPauser.isPause(i);
          newPaused = (newPaused1[i] !== newPaused2[i]);      
          assert.equal(paused, newPaused);
        }
    });

    it('Should set pause duration', async () => {
      await HoldefiPauser.setPauseDuration(1000000)
      let pauseDuration = await HoldefiPauser.pauseDuration.call()
      assert.equal(pauseDuration, 1000000)
    })

    it('Fail if set pauser by other accounts', async () => {
        await expectRevert(HoldefiPauser.setPauser(pauser,{from: user1}),
          "Sender should be Owner")
    })

    it('Fail if other accounts call pause', async () => {
        await expectRevert(HoldefiPauser.pause(1, {from: user1}),
          "Sender should be Owner");
    });

    it('Fail if other accounts call unpause', async () => {
        await HoldefiPauser.pause(1, {from: owner});
        await expectRevert(HoldefiPauser.unpause(1, {from: user1}),
          "Sender should be Owner");
    });

    it('Fail if pauser call unpause', async () => {
        await HoldefiPauser.pause(1, {from: owner});
        await expectRevert(HoldefiPauser.unpause(1, {from: pauser}),
          "Sender should be Owner");
    });

    it('Fail if other accounts call batchPause', async () => {
        let newPaused = [1,0,1,0,0,1,1,0];
        await expectRevert(HoldefiPauser.batchPause(newPaused, {from: user1}),
          "Sender should be Owner");
    });

    it('Fail if unpause selected functions by other accounts', async () => {
        let newPaused1= [1,0,1,0,0,1,1,0];
        await HoldefiPauser.batchPause(newPaused1, {from: owner});
        let newPaused2= [0,0,0,0,0,1,1,0];
        await expectRevert(HoldefiPauser.batchUnpause(newPaused2, {from: user1}),
          "Sender should be Owner");  
    });

    it('Fail if unpause selected functions by pauser', async () => {
        await HoldefiPauser.setPauser(pauser)    
        let newPaused1= [1,0,1,0,0,1,1,0];
        await HoldefiPauser.batchPause(newPaused1, {from: pauser});
        let newPaused2= [0,0,0,0,0,1,1,0];
        await expectRevert(HoldefiPauser.batchUnpause(newPaused2, {from: pauser}),
          "Sender should be Owner");   
    });

    it('Fail if set pause duration by other accounts', async () => {
        await expectRevert(HoldefiPauser.setPauseDuration(100000, {from: user1}),
          "Sender should be Owner");  
    });    
})