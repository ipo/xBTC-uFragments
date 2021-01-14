const { contract, web3 } = require('@openzeppelin/test-environment');

const MockDownstream = contract.fromArtifact('MockDownstream');
const MockUFragmentsPolicy = contract.fromArtifact('MockUFragmentsPolicy');
const Orchestrator = contract.fromArtifact('Orchestrator');
const RebaseCallerContract = contract.fromArtifact('RebaseCallerContract');
const ConstructorRebaseCallerContract = contract.fromArtifact('ConstructorRebaseCallerContract');

const BigNumber = web3.utils.BN;
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);
const {expectRevert, expectEvent} = require('@openzeppelin/test-helpers');
const encodeCall = require('zos-lib/lib/helpers/encodeCall').default;
const expect = require('chai').expect;

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

let orchestrator, mockPolicy, mockDownstream;
let r;
let deployer, user;

async function setupContracts () {
  await chain.waitForSomeTime(86400);
  const accounts = await chain.getUserAccounts();
  deployer = accounts[0];
  user = accounts[1];
  mockPolicy = await MockUFragmentsPolicy.new();
  orchestrator = await Orchestrator.new();
  r = await orchestrator.sendTransaction({
    data: encodeCall('initialize', ['address', 'address'], [deployer, mockPolicy.address]),
    from: deployer
  });
  mockDownstream = await MockDownstream.new();
}

describe('Orchestrator', function () {
  before('setup Orchestrator contract', setupContracts);

  describe('when sent ether', async function () {
    it('should reject', async function () {
      expect(
        await chain.isEthException(orchestrator.sendTransaction({ from: user, value: 1 }))
      ).to.be.true;
    });
  });

  describe('when rebase called by a contract', function () {
    it('should fail', async function () {
      const rebaseCallerContract = await RebaseCallerContract.new();
      expect(
        await chain.isEthException(rebaseCallerContract.callRebase(orchestrator.address))
      ).to.be.true;
    });
  });

  describe('when rebase called by a contract which is being constructed', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(ConstructorRebaseCallerContract.new(orchestrator.address))
      ).to.be.true;
    });
  });

  describe('when transaction list is empty', async function () {
    before('calling rebase', async function () {
      r = await orchestrator.rebase();
    });

    it('should have no transactions', async function () {
      (await orchestrator.transactionsSize.call()).toString().should.be.eq('0');
    });

    it('should call rebase on policy', async function () {
      // TODO fix this using web3.eth.abi.decodeLog on the rawLogs, expected events are missing from logs
      // console.log('XXX mockPolicy', r.receipt.rawLogs)
      // console.log('XXX mockPolicy', mockPolicy.abi, r.receipt.rawLogs[0].data, r.receipt.rawLogs[0].topics)
      // console.log('XXX mockPolicy', web3.eth.abi.decodeLog(mockPolicy.abi, r.receipt.rawLogs[0].data, r.receipt.rawLogs[0].topics))

      expectEvent.inTransaction(
        r.tx,
        mockPolicy,
        'FunctionCalled',
        {
          instanceName: 'UFragmentsPolicy',
          functionName: 'rebase',
          caller: orchestrator.address
        }
      );
    });

    it('should not have any subsequent logs', async function () {
      expect(r.receipt.rawLogs.length).to.eq(1);
    });
  });

  describe('when there is a single transaction', async function () {
    before('adding a transaction', async function () {
      const updateOneArgEncoded = mockDownstream.contract.methods.updateOneArg(12345).encodeABI();
      await orchestrator.addTransaction(mockDownstream.address, updateOneArgEncoded, {from: deployer});
      r = await orchestrator.rebase();
    });

    it('should have 1 transaction', async function () {
      (await orchestrator.transactionsSize.call()).toString().should.be.eq('1');
    });

    it('should call rebase on policy', async function () {
      await expectEvent.inTransaction(
        r.tx,
        mockPolicy,
        'FunctionCalled',
        {
          instanceName: 'UFragmentsPolicy',
          functionName: 'rebase',
          caller: orchestrator.address
        }
      );
    });

    it('should call the transaction', async function () {
      await expectEvent.inTransaction(
        r.tx,
        mockDownstream,
        'FunctionCalled',
        {
          instanceName: 'MockDownstream',
          functionName: 'updateOneArg',
          caller: orchestrator.address
        }
      );

      await expectEvent.inTransaction(
        r.tx,
        mockDownstream,
        'FunctionArguments',
        {
          0: ['12345'],
          1: []
        }
      );
    });

    it('should not have any subsequent logs', async function () {
      expect(r.receipt.rawLogs.length).to.eq(3);
    });
  });

  describe('when there are two transactions', async function () {
    before('adding a transaction', async function () {
      const updateTwoArgsEncoded = mockDownstream.contract.methods.updateTwoArgs(12345, 23456).encodeABI();
      orchestrator.addTransaction(mockDownstream.address, updateTwoArgsEncoded, {from: deployer});
      r = await orchestrator.rebase();
    });

    it('should have 2 transactions', async function () {
      (await orchestrator.transactionsSize.call()).toString().should.be.eq('2');
    });

    it('should call rebase on policy', async function () {
      await expectEvent.inTransaction(
        r.tx,
        mockPolicy,
        'FunctionCalled',
        {
          instanceName: 'UFragmentsPolicy',
          functionName: 'rebase',
          caller: orchestrator.address
        }
      );
    });

    it('should call first transaction', async function () {
      await expectEvent.inTransaction(
        r.tx,
        mockDownstream,
        'FunctionCalled',
        {
          instanceName: 'MockDownstream',
          functionName: 'updateOneArg',
          caller: orchestrator.address
        }
      );

      await expectEvent.inTransaction(
        r.tx,
        mockDownstream,
        'FunctionArguments',
        {
          0: ['12345'],
          1: []
        }
      );
    });

    it('should call second transaction', async function () {
      await expectEvent.inTransaction(
        r.tx,
        mockDownstream,
        'FunctionCalled',
        {
          instanceName: 'MockDownstream',
          functionName: 'updateTwoArgs',
          caller: orchestrator.address
        }
      );

      await expectEvent.inTransaction(
        r.tx,
        mockDownstream,
        'FunctionArguments',
        {
          0: ['12345'],
          1: ['23456']
        }
      );
    });

    it('should not have any subsequent logs', async function () {
      expect(r.receipt.rawLogs.length).to.eq(5);
    });
  });

  describe('when 1st transaction is disabled', async function () {
    before('disabling a transaction', async function () {
      orchestrator.setTransactionEnabled(0, false);
      r = await orchestrator.rebase();
    });

    it('should have 2 transactions', async function () {
      (await orchestrator.transactionsSize.call()).toString().should.be.eq('2');
    });

    it('should call rebase on policy', async function () {
      await expectEvent.inTransaction(
        r.tx,
        mockPolicy,
        'FunctionCalled',
        {
          instanceName: 'UFragmentsPolicy',
          functionName: 'rebase',
          caller: orchestrator.address
        }
      );
    });

    it('should call second transaction', async function () {
      await expectEvent.inTransaction(
        r.tx,
        mockDownstream,
        'FunctionCalled',
        {
          instanceName: 'MockDownstream',
          functionName: 'updateTwoArgs',
          caller: orchestrator.address
        }
      );

      await expectEvent.inTransaction(
        r.tx,
        mockDownstream,
        'FunctionArguments',
        {
          0: ['12345'],
          1: ['23456']
        }
      );
    });

    it('should not have any subsequent logs', async function () {
      expect(r.receipt.rawLogs.length).to.eq(3);
    });
  });

  describe('when a transaction is removed', async function () {
    before('removing 1st transaction', async function () {
      orchestrator.removeTransaction(0);
      r = await orchestrator.rebase();
    });

    it('should have 1 transaction', async function () {
      (await orchestrator.transactionsSize.call()).toString().should.be.eq('1');
    });

    it('should call rebase on policy', async function () {
      await expectEvent.inTransaction(
        r.tx,
        mockPolicy,
        'FunctionCalled',
        {
          instanceName: 'UFragmentsPolicy',
          functionName: 'rebase',
          caller: orchestrator.address
        }
      );
    });

    it('should call the transaction', async function () {
      await expectEvent.inTransaction(
        r.tx,
        mockDownstream,
        'FunctionCalled',
        {
          instanceName: 'MockDownstream',
          functionName: 'updateTwoArgs',
          caller: orchestrator.address
        }
      );

      await expectEvent.inTransaction(
        r.tx,
        mockDownstream,
        'FunctionArguments',
        {
          0: ['12345'],
          1: ['23456']
        }
      );
    });

    it('should not have any subsequent logs', async function () {
      expect(r.receipt.rawLogs.length).to.eq(3);
    });
  });

  describe('when all transactions are removed', async function () {
    before('removing 1st transaction', async function () {
      orchestrator.removeTransaction(0);
      r = await orchestrator.rebase();
    });

    it('should have 0 transactions', async function () {
      (await orchestrator.transactionsSize.call()).toString().should.be.eq('0');
    });

    it('should call rebase on policy', async function () {
      await expectEvent.inTransaction(
        r.tx,
        mockPolicy,
        'FunctionCalled',
        {
          instanceName: 'UFragmentsPolicy',
          functionName: 'rebase',
          caller: orchestrator.address
        }
      );
    });

    it('should not have any subsequent logs', async function () {
      expect(r.receipt.rawLogs.length).to.eq(1);
    });
  });

  describe('when a transaction reverts', async function () {
    before('adding 3 transactions', async function () {
      const updateOneArgEncoded = mockDownstream.contract.methods.updateOneArg(123).encodeABI();
      orchestrator.addTransaction(mockDownstream.address, updateOneArgEncoded, {from: deployer});

      const revertsEncoded = mockDownstream.contract.methods.reverts().encodeABI();
      orchestrator.addTransaction(mockDownstream.address, revertsEncoded, {from: deployer});

      const updateTwoArgsEncoded = mockDownstream.contract.methods.updateTwoArgs(12345, 23456).encodeABI();
      orchestrator.addTransaction(mockDownstream.address, updateTwoArgsEncoded, {from: deployer});
      await expectRevert.unspecified(orchestrator.rebase());
    });

    it('should have 3 transactions', async function () {
      (await orchestrator.transactionsSize.call()).toString().should.be.eq('3');
    });
  });

  describe('Access Control', function () {
    describe('addTransaction', async function () {
      it('should be callable by owner', async function () {
        const updateNoArgEncoded = mockDownstream.contract.methods.updateNoArg().encodeABI();
        expect(
          await chain.isEthException(
            orchestrator.addTransaction(mockDownstream.address, updateNoArgEncoded, {from: deployer})
          )
        ).to.be.false;
      });

      it('should be not be callable by others', async function () {
        const updateNoArgEncoded = mockDownstream.contract.methods.updateNoArg().encodeABI();
        expect(
          await chain.isEthException(
            orchestrator.addTransaction(mockDownstream.address, updateNoArgEncoded, {from: user})
          )
        ).to.be.true;
      });
    });

    describe('setTransactionEnabled', async function () {
      it('should be callable by owner', async function () {
        expect((await orchestrator.transactionsSize.call()).gt(new BigNumber(0)));
        expect(
          await chain.isEthException(
            orchestrator.setTransactionEnabled(0, true, {from: deployer})
          )
        ).to.be.false;
      });

      it('should be not be callable by others', async function () {
        expect((await orchestrator.transactionsSize.call()).gt(new BigNumber(0)));
        expect(
          await chain.isEthException(
            orchestrator.setTransactionEnabled(0, true, {from: user})
          )
        ).to.be.true;
      });
    });

    describe('removeTransaction', async function () {
      it('should be not be callable by others', async function () {
        expect((await orchestrator.transactionsSize.call()).gt(new BigNumber(0)));
        expect(
          await chain.isEthException(
            orchestrator.removeTransaction(0, {from: user})
          )
        ).to.be.true;
      });

      it('should be callable by owner', async function () {
        expect((await orchestrator.transactionsSize.call()).gt(new BigNumber(0)));
        expect(
          await chain.isEthException(
            orchestrator.removeTransaction(0, {from: deployer})
          )
        ).to.be.false;
      });
    });

    describe('transferOwnership', async function () {
      it('should transfer ownership', async function () {
        (await orchestrator.owner.call()).toLowerCase().should.eq(deployer.toLowerCase());
        await orchestrator.transferOwnership(user);
        (await orchestrator.owner.call()).toLowerCase().should.eq(user.toLowerCase());
      });
    });
  });
});
