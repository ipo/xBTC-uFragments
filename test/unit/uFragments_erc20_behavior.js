/*
  MIT License

  Copyright (c) 2016 Smart Contract Solutions, Inc.
  Copyright (c) 2018 Fragments, Inc.

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

  This file tests if the UFragments contract confirms to the ERC20 specification.
  These test cases are inspired from OpenZepplin's ERC20 unit test.
  https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/test/token/ERC20/ERC20.test.js
*/
const { contract, web3 } = require('@openzeppelin/test-environment');

const UFragments = contract.fromArtifact('UFragments');
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);
const BigNumber = web3.utils.BN;
const expect = require('chai').expect;

const encodeCall = require('zos-lib/lib/helpers/encodeCall').default;

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
function toTokenDenomination (x) {
  return new BigNumber(x).mul(new BigNumber(10 ** DECIMALS));
}
const DECIMALS = 9;
const INITIAL_SUPPLY = new BigNumber('9875509696016110');
const transferAmount = toTokenDenomination(10);
const unitTokenAmount = toTokenDenomination(1);
const overdraftAmount = INITIAL_SUPPLY.add(unitTokenAmount);
const overdraftAmountPlusOne = overdraftAmount.add(unitTokenAmount);
const overdraftAmountMinusOne = overdraftAmount.sub(unitTokenAmount);
const transferAmountPlusOne = transferAmount.add(unitTokenAmount);
const transferAmountMinusOne = transferAmount.sub(unitTokenAmount);

let token, owner, anotherAccount, recipient, r;
async function setupContractAndAccounts (accounts) {
  await chain.waitForSomeTime(86400);
  owner = accounts[0];
  anotherAccount = accounts[8];
  recipient = accounts[9];
  token = await UFragments.new();

  await token.sendTransaction({
    data: encodeCall('initialize', ['address', 'string', 'string'], [owner, 'xBTC', 'xBTC']),
    from: owner
  });
}

describe('UFragments:ERC20', function () {
  before('setup UFragments contract', async function () {
    const accounts = await chain.getUserAccounts();
    await setupContractAndAccounts(accounts);
  });

  describe('totalSupply', function () {
    it('returns the total amount of tokens', async function () {
      (await token.totalSupply.call()).toString().should.be.eq(INITIAL_SUPPLY.toString());
    });
  });

  describe('balanceOf', function () {
    describe('when the requested account has no tokens', function () {
      it('returns zero', async function () {
        (await token.balanceOf.call(anotherAccount)).toString().should.be.eq('0');
      });
    });

    describe('when the requested account has some tokens', function () {
      it('returns the total amount of tokens', async function () {
        (await token.balanceOf.call(owner)).toString().should.be.eq(INITIAL_SUPPLY.toString());
      });
    });
  });
});

describe('UFragments:ERC20:transfer', function () {
  before('setup UFragments contract', async function () {
    const accounts = await chain.getUserAccounts();
    await setupContractAndAccounts(accounts);
  });

  describe('when the sender does NOT have enough balance', function () {
    it('reverts', async function () {
      expect(
        await chain.isEthException(token.transfer(recipient, overdraftAmount, { from: owner }))
      ).to.be.true;
    });
  });

  describe('when the sender has enough balance', function () {
    before(async function () {
      r = await token.transfer(recipient, transferAmount, { from: owner });
    });

    it('should transfer the requested amount', async function () {
      const senderBalance = await token.balanceOf.call(owner);
      const recipientBalance = await token.balanceOf.call(recipient);
      const supply = await token.totalSupply.call();
      supply.sub(transferAmount).toString().should.be.eq(senderBalance.toString());
      recipientBalance.toString().should.be.eq(transferAmount.toString());
    });
    it('should emit a transfer event', async function () {
      expect(r.logs.length).to.eq(1);
      expect(r.logs[0].event).to.eq('Transfer');
      expect(r.logs[0].args.from.toLowerCase()).to.eq(owner);
      expect(r.logs[0].args.to.toLowerCase()).to.eq(recipient);
      r.logs[0].args.value.toString().should.be.eq(transferAmount.toString());
    });
  });

  describe('when the recipient is the zero address', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(token.transfer(ZERO_ADDRESS, transferAmount, { from: owner }))
      ).to.be.true;
    });
  });
});

describe('UFragments:ERC20:transferFrom', function () {
  before('setup UFragments contract', async function () {
    const accounts = await chain.getUserAccounts();

    await setupContractAndAccounts(accounts);
  });

  describe('when the spender does NOT have enough approved balance', function () {
    describe('when the owner does NOT have enough balance', function () {
      it('reverts', async function () {
        await token.approve(anotherAccount, overdraftAmountMinusOne, { from: owner });
        expect(
          await chain.isEthException(token.transferFrom(owner, recipient, overdraftAmount, { from: anotherAccount }))
        ).to.be.true;
      });
    });

    describe('when the owner has enough balance', function () {
      it('reverts', async function () {
        await token.approve(anotherAccount, transferAmountMinusOne, { from: owner });
        expect(
          await chain.isEthException(token.transferFrom(owner, recipient, transferAmount, { from: anotherAccount }))
        ).to.be.true;
      });
    });
  });

  describe('when the spender has enough approved balance', function () {
    describe('when the owner does NOT have enough balance', function () {
      it('should fail', async function () {
        await token.approve(anotherAccount, overdraftAmount, { from: owner });
        expect(
          await chain.isEthException(token.transferFrom(owner, recipient, overdraftAmount, { from: anotherAccount }))
        ).to.be.true;
      });
    });

    describe('when the owner has enough balance', function () {
      let prevSenderBalance, r;
      before(async function () {
        prevSenderBalance = await token.balanceOf.call(owner);
        await token.approve(anotherAccount, transferAmount, { from: owner });
        r = await token.transferFrom(owner, recipient, transferAmount, { from: anotherAccount });
      });

      it('transfers the requested amount', async function () {
        const senderBalance = await token.balanceOf.call(owner);
        const recipientBalance = await token.balanceOf.call(recipient);
        prevSenderBalance.sub(transferAmount).toString().should.be.eq(senderBalance.toString());
        recipientBalance.toString().should.be.eq(transferAmount.toString());
      });
      it('decreases the spender allowance', async function () {
        expect((await token.allowance(owner, anotherAccount)).toString().should.be.eq('0'));
      });
      it('emits a transfer event', async function () {
        expect(r.logs.length).to.eq(1);
        expect(r.logs[0].event).to.eq('Transfer');
        expect(r.logs[0].args.from.toLowerCase()).to.eq(owner);
        expect(r.logs[0].args.to.toLowerCase()).to.eq(recipient);
        r.logs[0].args.value.toString().should.be.eq(transferAmount.toString());
      });
    });
  });
});

describe('UFragments:ERC20:approve', function () {
  before('setup UFragments contract', async function () {
    const accounts = await chain.getUserAccounts();

    await setupContractAndAccounts(accounts);
  });

  describe('when the spender is NOT the zero address', function () {
    describe('when the sender has enough balance', function () {
      describe('when there was no approved amount before', function () {
        before(async function () {
          await token.approve(anotherAccount, 0, { from: owner });
          r = await token.approve(anotherAccount, transferAmount, { from: owner });
        });

        it('approves the requested amount', async function () {
          (await token.allowance(owner, anotherAccount)).toString().should.be.eq(transferAmount.toString());
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.eq(1);
          expect(r.logs[0].event).to.eq('Approval');
          expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
          expect(r.logs[0].args.spender.toLowerCase()).to.eq(anotherAccount);
          r.logs[0].args.value.toString().should.be.eq(transferAmount.toString());
        });
      });

      describe('when the spender had an approved amount', function () {
        before(async function () {
          await token.approve(anotherAccount, toTokenDenomination(1), { from: owner });
          r = await token.approve(anotherAccount, transferAmount, { from: owner });
        });

        it('approves the requested amount and replaces the previous one', async function () {
          (await token.allowance(owner, anotherAccount)).toString().should.be.eq(transferAmount.toString());
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.eq(1);
          expect(r.logs[0].event).to.eq('Approval');
          expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
          expect(r.logs[0].args.spender.toLowerCase()).to.eq(anotherAccount);
          r.logs[0].args.value.toString().should.be.eq(transferAmount.toString());
        });
      });
    });

    describe('when the sender does not have enough balance', function () {
      describe('when there was no approved amount before', function () {
        before(async function () {
          await token.approve(anotherAccount, 0, { from: owner });
          r = await token.approve(anotherAccount, overdraftAmount, { from: owner });
        });

        it('approves the requested amount', async function () {
          (await token.allowance(owner, anotherAccount)).toString().should.be.eq(overdraftAmount.toString());
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.eq(1);
          expect(r.logs[0].event).to.eq('Approval');
          expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
          expect(r.logs[0].args.spender.toLowerCase()).to.eq(anotherAccount);
          r.logs[0].args.value.toString().should.be.eq(overdraftAmount.toString());
        });
      });

      describe('when the spender had an approved amount', function () {
        before(async function () {
          await token.approve(anotherAccount, toTokenDenomination(1), { from: owner });
          r = await token.approve(anotherAccount, overdraftAmount, { from: owner });
        });

        it('approves the requested amount', async function () {
          (await token.allowance(owner, anotherAccount)).toString().should.be.eq(overdraftAmount.toString());
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.eq(1);
          expect(r.logs[0].event).to.eq('Approval');
          expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
          expect(r.logs[0].args.spender.toLowerCase()).to.eq(anotherAccount);
          r.logs[0].args.value.toString().should.be.eq(overdraftAmount.toString());
        });
      });
    });
  });
});

describe('UFragments:ERC20:increaseAllowance', function () {
  before('setup UFragments contract', async function () {
    const accounts = await chain.getUserAccounts();

    await setupContractAndAccounts(accounts);
  });

  describe('when the spender is NOT the zero address', function () {
    describe('when the sender has enough balance', function () {
      describe('when there was no approved amount before', function () {
        before(async function () {
          await token.approve(anotherAccount, 0, { from: owner });
          r = await token.increaseAllowance(anotherAccount, transferAmount, { from: owner });
        });
        it('approves the requested amount', async function () {
          (await token.allowance(owner, anotherAccount)).toString().should.be.eq(transferAmount.toString());
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.eq(1);
          expect(r.logs[0].event).to.eq('Approval');
          expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
          expect(r.logs[0].args.spender.toLowerCase()).to.eq(anotherAccount);
          r.logs[0].args.value.toString().should.be.eq(transferAmount.toString());
        });
      });

      describe('when the spender had an approved amount', function () {
        beforeEach(async function () {
          await token.approve(anotherAccount, unitTokenAmount, { from: owner });
          r = await token.increaseAllowance(anotherAccount, transferAmount, { from: owner });
        });

        it('increases the spender allowance adding the requested amount', async function () {
          (await token.allowance(owner, anotherAccount)).toString().should.be.eq(transferAmountPlusOne.toString());
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.eq(1);
          expect(r.logs[0].event).to.eq('Approval');
          expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
          expect(r.logs[0].args.spender.toLowerCase()).to.eq(anotherAccount);
          r.logs[0].args.value.toString().should.be.eq(transferAmountPlusOne.toString());
        });
      });
    });

    describe('when the sender does not have enough balance', function () {
      describe('when there was no approved amount before', function () {
        before(async function () {
          await token.approve(anotherAccount, 0, { from: owner });
          r = await token.increaseAllowance(anotherAccount, overdraftAmount, { from: owner });
        });

        it('approves the requested amount', async function () {
          (await token.allowance(owner, anotherAccount)).toString().should.be.eq(overdraftAmount.toString());
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.eq(1);
          expect(r.logs[0].event).to.eq('Approval');
          expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
          expect(r.logs[0].args.spender.toLowerCase()).to.eq(anotherAccount);
          r.logs[0].args.value.toString().should.be.eq(overdraftAmount.toString());
        });
      });

      describe('when the spender had an approved amount', function () {
        beforeEach(async function () {
          await token.approve(anotherAccount, unitTokenAmount, { from: owner });
          r = await token.increaseAllowance(anotherAccount, overdraftAmount, { from: owner });
        });

        it('increases the spender allowance adding the requested amount', async function () {
          (await token.allowance(owner, anotherAccount)).toString().should.be.eq(overdraftAmountPlusOne.toString());
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.eq(1);
          expect(r.logs[0].event).to.eq('Approval');
          expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
          expect(r.logs[0].args.spender.toLowerCase()).to.eq(anotherAccount);
          r.logs[0].args.value.toString().should.be.eq(overdraftAmountPlusOne.toString());
        });
      });
    });
  });
});

describe('UFragments:ERC20:decreaseAllowance', function () {
  before('setup UFragments contract', async function () {
    const accounts = await chain.getUserAccounts();

    await setupContractAndAccounts(accounts);
  });

  describe('when the spender is NOT the zero address', function () {
    describe('when the sender does NOT have enough balance', function () {
      describe('when there was no approved amount before', function () {
        before(async function () {
          r = await token.decreaseAllowance(anotherAccount, overdraftAmount, { from: owner });
        });

        it('keeps the allowance to zero', async function () {
          (await token.allowance(owner, anotherAccount)).toString().should.be.eq('0');
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.eq(1);
          expect(r.logs[0].event).to.eq('Approval');
          expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
          expect(r.logs[0].args.spender.toLowerCase()).to.eq(anotherAccount);
          r.logs[0].args.value.toString().should.be.eq('0');
        });
      });

      describe('when the spender had an approved amount', function () {
        before(async function () {
          await token.approve(anotherAccount, overdraftAmountPlusOne, { from: owner });
          r = await token.decreaseAllowance(anotherAccount, overdraftAmount, { from: owner });
        });

        it('decreases the spender allowance subtracting the requested amount', async function () {
          (await token.allowance(owner, anotherAccount)).toString().should.be.eq(unitTokenAmount.toString());
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.eq(1);
          expect(r.logs[0].event).to.eq('Approval');
          expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
          expect(r.logs[0].args.spender.toLowerCase()).to.eq(anotherAccount);
          r.logs[0].args.value.toString().should.be.eq(unitTokenAmount.toString());
        });
      });
    });

    describe('when the sender has enough balance', function () {
      describe('when there was no approved amount before', function () {
        before(async function () {
          await token.approve(anotherAccount, 0, { from: owner });
          r = await token.decreaseAllowance(anotherAccount, transferAmount, { from: owner });
        });

        it('keeps the allowance to zero', async function () {
          (await token.allowance(owner, anotherAccount)).toString().should.be.eq('0');
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.eq(1);
          expect(r.logs[0].event).to.eq('Approval');
          expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
          expect(r.logs[0].args.spender.toLowerCase()).to.eq(anotherAccount);
          r.logs[0].args.value.toString().should.be.eq('0');
        });
      });

      describe('when the spender had an approved amount', function () {
        before(async function () {
          await token.approve(anotherAccount, transferAmountPlusOne, { from: owner });
          r = await token.decreaseAllowance(anotherAccount, transferAmount, { from: owner });
        });

        it('decreases the spender allowance subtracting the requested amount', async function () {
          ((await token.allowance(owner, anotherAccount)).toString()).should.be.eq(unitTokenAmount.toString());
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.eq(1);
          expect(r.logs[0].event).to.eq('Approval');
          expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
          expect(r.logs[0].args.spender.toLowerCase()).to.eq(anotherAccount);
          r.logs[0].args.value.toString().should.be.eq(unitTokenAmount.toString());
        });
      });
    });
  });
});
