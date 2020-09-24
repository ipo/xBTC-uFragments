const { contract, web3 } = require('@openzeppelin/test-environment');

const UFragments = contract.fromArtifact('UFragments');
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);
const BigNumber = web3.utils.BN;
const encodeCall = require('zos-lib/lib/helpers/encodeCall').default;
const expect = require('chai').expect;

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

function toUFrgDenomination (x) {
  return new BigNumber(x).mul(new BigNumber(10 ** DECIMALS));
}
const DECIMALS = 9;
const INTIAL_SUPPLY = toUFrgDenomination(5042019);
const transferAmount = toUFrgDenomination(10);
const unitTokenAmount = toUFrgDenomination(1);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

let uFragments, b, r, deployer, user, initialSupply;
async function setupContracts () {
  const accounts = await chain.getUserAccounts();
  deployer = accounts[0];
  user = accounts[1];
  uFragments = await UFragments.new();
  r = await uFragments.sendTransaction({
    data: encodeCall('initialize', ['address', 'string', 'string'], [deployer, 'xBTC', 'xBTC']),
    from: deployer
  });
  initialSupply = await uFragments.totalSupply.call();

  const log = r.logs[0];
  expect(log).to.exist;
  expect(log.event).to.eq('OwnershipTransferred');
  expect(log.args.previousOwner.toLowerCase()).to.eq(ZERO_ADDRESS.toLowerCase());
  expect(log.args.newOwner.toLowerCase()).to.eq(deployer.toLowerCase());
}

describe('UFragments', function () {
  before('setup UFragments contract', setupContracts);

  it('should reject any ether sent to it', async function () {
    expect(
      await chain.isEthException(uFragments.sendTransaction({ from: user, value: 1 }))
    ).to.be.true;
  });
});

describe('UFragments:Initialization', function () {
  before('setup UFragments contract', setupContracts);

  it('should transfer ~5M uFragments to the deployer', async function () {
    (await uFragments.balanceOf.call(deployer)).toString().should.be.eq(INTIAL_SUPPLY.toString());
    const log = r.logs[1];
    expect(log).to.exist;
    expect(log.event).to.eq('Transfer');
    expect(log.args.from).to.eq(ZERO_ADDRESS);
    expect(log.args.to.toLowerCase()).to.eq(deployer.toLowerCase());
    log.args.value.toString().should.be.eq(INTIAL_SUPPLY.toString());
  });

  it('should set the totalSupply to ~5M', async function () {
    initialSupply.toString().should.be.eq(INTIAL_SUPPLY.toString());
  });

  it('should set the owner', async function () {
    expect((await uFragments.owner.call()).toLowerCase()).to.eq(deployer.toLowerCase());
  });

  it('should set detailed ERC20 parameters', async function () {
    expect(await uFragments.name.call()).to.eq('xBTC');
    expect(await uFragments.symbol.call()).to.eq('xBTC');
    (await uFragments.decimals.call()).toString().should.be.eq(DECIMALS.toString());
  });

  it('should have 9 decimals', async function () {
    const decimals = await uFragments.decimals.call();
    decimals.toString().should.be.eq(DECIMALS.toString());
  });

  it('should have xBTC symbol', async function () {
    const symbol = await uFragments.symbol.call();
    symbol.should.be.eq('xBTC');
  });
});

describe('UFragments:setMonetaryPolicy', async function () {
  const accounts = await chain.getUserAccounts();

  const policy = accounts[1];

  before('setup UFragments contract', setupContracts);

  it('should set reference to policy contract', async function () {
    await uFragments.setMonetaryPolicy(policy, { from: deployer });
    expect(await uFragments.monetaryPolicy.call()).to.eq(policy);
  });

  it('should emit policy updated event', async function () {
    const r = await uFragments.setMonetaryPolicy(policy, { from: deployer });
    const log = r.logs[0];
    expect(log).to.exist;
    expect(log.event).to.eq('LogMonetaryPolicyUpdated');
    expect(log.args.monetaryPolicy).to.eq(policy);
  });
});

describe('UFragments:setMonetaryPolicy:accessControl', async function () {
  const accounts = await chain.getUserAccounts();

  const policy = accounts[1];

  before('setup UFragments contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(uFragments.setMonetaryPolicy(policy, { from: deployer }))
    ).to.be.false;
  });
});

describe('UFragments:setMonetaryPolicy:accessControl', async function () {
  const accounts = await chain.getUserAccounts();

  const policy = accounts[1];
  const user = accounts[2];

  before('setup UFragments contract', setupContracts);

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(uFragments.setMonetaryPolicy(policy, { from: user }))
    ).to.be.true;
  });
});

describe('UFragments:Rebase:accessControl', function () {
  before('setup UFragments contract', async function () {
    await setupContracts();
    await uFragments.setMonetaryPolicy(user, {from: deployer});
  });

  it('should be callable by monetary policy', async function () {
    expect(
      await chain.isEthException(uFragments.rebase(1, transferAmount, { from: user }))
    ).to.be.false;
  });

  it('should not be callable by others', async function () {
    expect(
      await chain.isEthException(uFragments.rebase(1, transferAmount, { from: deployer }))
    ).to.be.true;
  });
});

describe('UFragments:Rebase:Expansion', async function () {
  const accounts = await chain.getUserAccounts();

  // Rebase +5M (10%), with starting balances A:750 and B:250.
  const A = accounts[2];
  const B = accounts[3];
  const policy = accounts[1];
  const rebaseAmt = INTIAL_SUPPLY / 10;

  before('setup UFragments contract', async function () {
    await setupContracts();
    await uFragments.setMonetaryPolicy(policy, {from: deployer});
    await uFragments.transfer(A, toUFrgDenomination(750), { from: deployer });
    await uFragments.transfer(B, toUFrgDenomination(250), { from: deployer });
    r = await uFragments.rebase(1, rebaseAmt, {from: policy});
  });

  it('should increase the totalSupply', async function () {
    b = await uFragments.totalSupply.call();
    b.toString().should.be.eq(initialSupply.add(new BigNumber(rebaseAmt)).toString());
  });

  it('should increase individual balances', async function () {
    b = await uFragments.balanceOf.call(A);
    b.toString().should.be.eq(toUFrgDenomination(825).toString());

    b = await uFragments.balanceOf.call(B);
    b.toString().should.be.eq(toUFrgDenomination(275).toString());
  });

  it('should emit Rebase', async function () {
    const log = r.logs[0];
    expect(log).to.exist;
    expect(log.event).to.eq('LogRebase');
    log.args.epoch.toString().should.be.eq('1');
    log.args.totalSupply.toString().should.be.eq(initialSupply.add(new BigNumber(rebaseAmt)).toString());
  });

  it('should return the new supply', async function () {
    const returnVal = await uFragments.rebase.call(2, rebaseAmt, {from: policy});
    await uFragments.rebase(2, rebaseAmt, {from: policy});
    const supply = await uFragments.totalSupply.call();
    returnVal.toString().should.be.eq(supply.toString());
  });
});

describe('UFragments:Rebase:Expansion', async function () {
  const accounts = await chain.getUserAccounts();

  const policy = accounts[1];
  const MAX_SUPPLY = new BigNumber(2).pow(new BigNumber(128)).sub(new BigNumber(1));

  describe('when totalSupply is less than MAX_SUPPLY and expands beyond', function () {
    before('setup UFragments contract', async function () {
      await setupContracts();
      await uFragments.setMonetaryPolicy(policy, {from: deployer});
      const totalSupply = await uFragments.totalSupply.call();
      await uFragments.rebase(1, MAX_SUPPLY.sub(totalSupply).sub(toUFrgDenomination(1)), {from: policy});
      r = await uFragments.rebase(2, toUFrgDenomination(2), {from: policy});
    });

    it('should increase the totalSupply to MAX_SUPPLY', async function () {
      b = await uFragments.totalSupply.call();
      b.toString().should.be.eq(MAX_SUPPLY.toString());
    });

    it('should emit Rebase', async function () {
      const log = r.logs[0];
      expect(log).to.exist;
      expect(log.event).to.eq('LogRebase');
      expect(log.args.epoch.toNumber()).to.eq(2);
      log.args.totalSupply.toString().should.be.eq(MAX_SUPPLY.toString());
    });
  });

  describe('when totalSupply is MAX_SUPPLY and expands', function () {
    before(async function () {
      b = await uFragments.totalSupply.call();
      b.toString().should.be.eq(MAX_SUPPLY.toString());
      r = await uFragments.rebase(3, toUFrgDenomination(2), {from: policy});
    });

    it('should NOT change the totalSupply', async function () {
      b = await uFragments.totalSupply.call();
      b.toString().should.be.eq(MAX_SUPPLY.toString());
    });

    it('should emit Rebase', async function () {
      const log = r.logs[0];
      expect(log).to.exist;
      expect(log.event).to.eq('LogRebase');
      expect(log.args.epoch.toNumber()).to.eq(3);
      log.args.totalSupply.toString().should.be.eq(MAX_SUPPLY.toString());
    });
  });
});

describe('UFragments:Rebase:NoChange', async function () {
  const accounts = await chain.getUserAccounts();

  // Rebase (0%), with starting balances A:750 and B:250.
  const A = accounts[2];
  const B = accounts[3];
  const policy = accounts[1];

  before('setup UFragments contract', async function () {
    await setupContracts();
    await uFragments.setMonetaryPolicy(policy, {from: deployer});
    await uFragments.transfer(A, toUFrgDenomination(750), { from: deployer });
    await uFragments.transfer(B, toUFrgDenomination(250), { from: deployer });
    r = await uFragments.rebase(1, 0, {from: policy});
  });

  it('should NOT CHANGE the totalSupply', async function () {
    b = await uFragments.totalSupply.call();
    b.toString().should.be.eq(initialSupply.toString());
  });

  it('should NOT CHANGE individual balances', async function () {
    b = await uFragments.balanceOf.call(A);
    b.toString().should.be.eq(toUFrgDenomination(750).toString());

    b = await uFragments.balanceOf.call(B);
    b.toString().should.be.eq(toUFrgDenomination(250).toString());
  });

  it('should emit Rebase', async function () {
    const log = r.logs[0];
    expect(log).to.exist;
    expect(log.event).to.eq('LogRebase');
    log.args.epoch.toString().should.be.eq('1');
    log.args.totalSupply.toString().should.be.eq(initialSupply.toString());
  });
});

describe('UFragments:Rebase:Contraction', async function () {
  const accounts = await chain.getUserAccounts();

  // Rebase -5M (-10%), with starting balances A:750 and B:250.
  const A = accounts[2];
  const B = accounts[3];
  const policy = accounts[1];
  const rebaseAmt = INTIAL_SUPPLY / 10;

  before('setup UFragments contract', async function () {
    await setupContracts();
    await uFragments.setMonetaryPolicy(policy, {from: deployer});
    await uFragments.transfer(A, toUFrgDenomination(750), { from: deployer });
    await uFragments.transfer(B, toUFrgDenomination(250), { from: deployer });
    r = await uFragments.rebase(1, -rebaseAmt, {from: policy});
  });

  it('should decrease the totalSupply', async function () {
    b = await uFragments.totalSupply.call();
    b.toString().should.be.eq(initialSupply.sub(new BigNumber(rebaseAmt)).toString());
  });

  it('should decrease individual balances', async function () {
    b = await uFragments.balanceOf.call(A);
    b.toString().should.be.eq(toUFrgDenomination(675).toString());

    b = await uFragments.balanceOf.call(B);
    b.toString().should.be.eq(toUFrgDenomination(225).toString());
  });

  it('should emit Rebase', async function () {
    const log = r.logs[0];
    expect(log).to.exist;
    expect(log.event).to.eq('LogRebase');
    log.args.epoch.toString().should.be.eq('1');
    log.args.totalSupply.toString().should.be.eq(initialSupply.sub(new BigNumber(rebaseAmt)).toString());
  });
});

describe('UFragments:Transfer', async function () {
  const accounts = await chain.getUserAccounts();

  const A = accounts[2];
  const B = accounts[3];
  const C = accounts[4];

  before('setup UFragments contract', setupContracts);

  describe('deployer transfers 12 to A', function () {
    it('should have correct balances', async function () {
      const deployerBefore = await uFragments.balanceOf.call(deployer);
      await uFragments.transfer(A, toUFrgDenomination(12), { from: deployer });
      b = await uFragments.balanceOf.call(deployer);
      b.toString().should.be.eq(deployerBefore.sub(toUFrgDenomination(12)).toString());
      b = await uFragments.balanceOf.call(A);
      b.toString().should.be.eq(toUFrgDenomination(12).toString());
    });
  });

  describe('deployer transfers 15 to B', async function () {
    it('should have balances [973,15]', async function () {
      const deployerBefore = await uFragments.balanceOf.call(deployer);
      await uFragments.transfer(B, toUFrgDenomination(15), { from: deployer });
      b = await uFragments.balanceOf.call(deployer);
      b.toString().should.be.eq(deployerBefore.sub(toUFrgDenomination(15)).toString());
      b = await uFragments.balanceOf.call(B);
      b.toString().should.be.eq(toUFrgDenomination(15).toString());
    });
  });

  describe('deployer transfers the rest to C', async function () {
    it('should have balances [0,973]', async function () {
      const deployerBefore = await uFragments.balanceOf.call(deployer);
      await uFragments.transfer(C, deployerBefore, { from: deployer });
      b = await uFragments.balanceOf.call(deployer);
      b.toString().should.be.eq('0');
      b = await uFragments.balanceOf.call(C);
      b.toString().should.be.eq(deployerBefore.toString());
    });
  });

  describe('when the recipient address is the contract address', function () {
    const owner = A;

    it('reverts on transfer', async function () {
      expect(
        await chain.isEthException(uFragments.transfer(uFragments.address, unitTokenAmount, { from: owner }))
      ).to.be.true;
    });

    it('reverts on transferFrom', async function () {
      expect(
        await chain.isEthException(uFragments.transferFrom(owner, uFragments.address, unitTokenAmount, { from: owner }))
      ).to.be.true;
    });
  });

  describe('when the recipient is the zero address', function () {
    const owner = A;

    before(async function () {
      r = await uFragments.approve(ZERO_ADDRESS, transferAmount, { from: owner });
    });
    it('emits an approval event', async function () {
      expect(r.logs.length).to.eq(1);
      expect(r.logs[0].event).to.eq('Approval');
      expect(r.logs[0].args.owner.toLowerCase()).to.eq(owner);
      expect(r.logs[0].args.spender).to.eq(ZERO_ADDRESS);
      r.logs[0].args.value.toString().should.be.eq(transferAmount.toString());
    });

    it('transferFrom should fail', async function () {
      expect(
        await chain.isEthException(uFragments.transferFrom(owner, ZERO_ADDRESS, transferAmount, { from: C }))
      ).to.be.true;
    });
  });
});
