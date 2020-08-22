const UFragmentsPolicy = artifacts.require('UFragmentsPolicy.sol');
const MockUFragments = artifacts.require('MockUFragments.sol');
const MockOracle = artifacts.require('MockOracle.sol');

const encodeCall = require('zos-lib/lib/helpers/encodeCall').default;
const BigNumber = web3.utils.BN;
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

let uFragmentsPolicy, mockUFragments, mockMarketOracle, mockCpiOracle;
let r, prevEpoch, prevTime;
let deployer, user, orchestrator;

const MAX_RATE = new BigNumber(1)
  .mul(new BigNumber(10).pow(new BigNumber(6)))
  .mul(new BigNumber(10).pow(new BigNumber(18)));
const MAX_SUPPLY = (new BigNumber(2).pow(new BigNumber(255)).sub(new BigNumber(1))).div(MAX_RATE);
const BASE_CPI = new BigNumber(10).pow(new BigNumber(19)); // TODO set me to 10**18 ??
const INITIAL_CPI = new BigNumber(251712).mul(new BigNumber(10).pow(new BigNumber(15)));
const INITIAL_CPI_25P_MORE = INITIAL_CPI.mul(new BigNumber(125)).div(new BigNumber(100));
const INITIAL_CPI_25P_LESS = INITIAL_CPI.mul(new BigNumber(77)).div(new BigNumber(100));
const INITIAL_RATE = INITIAL_CPI.mul(new BigNumber(10).pow(new BigNumber(18))).div(BASE_CPI);
const INITIAL_RATE_30P_MORE = INITIAL_RATE.mul(new BigNumber(130)).div(new BigNumber(100));
const INITIAL_RATE_60P_LESS = INITIAL_RATE.mul(new BigNumber(40)).div(new BigNumber(100));
const INITIAL_RATE_30P_LESS = INITIAL_RATE.mul(new BigNumber(70)).div(new BigNumber(100));
const INITIAL_RATE_5P_MORE = INITIAL_RATE.mul(new BigNumber(105)).div(new BigNumber(100));
const INITIAL_RATE_5P_LESS = INITIAL_RATE.mul(new BigNumber(95)).div(new BigNumber(100));
const INITIAL_RATE_60P_MORE = INITIAL_RATE.mul(new BigNumber(160)).div(new BigNumber(100));
const INITIAL_RATE_2X = INITIAL_RATE.mul(new BigNumber(2));

async function setupContracts () {
  await chain.waitForSomeTime(86400);
  const accounts = await chain.getUserAccounts();
  deployer = accounts[0];
  user = accounts[1];
  orchestrator = accounts[2];
  mockUFragments = await MockUFragments.new();
  mockMarketOracle = await MockOracle.new('MarketOracle');
  mockCpiOracle = await MockOracle.new('CpiOracle');
  uFragmentsPolicy = await UFragmentsPolicy.new();
  await uFragmentsPolicy.sendTransaction({
    data: encodeCall('initialize', ['address', 'address', 'uint256'],
      [deployer, mockUFragments.address, BASE_CPI.toString()]),
    from: deployer
  });
  await uFragmentsPolicy.setMarketOracle(mockMarketOracle.address);
  await uFragmentsPolicy.setDominusOracle(mockCpiOracle.address);
  await uFragmentsPolicy.setOrchestrator(orchestrator);
}

async function setupContractsWithOpenRebaseWindow () {
  await setupContracts();
  await uFragmentsPolicy.setRebaseTimingParameters(60, 0, 60);
}

async function mockExternalData (rate, cpi, uFragSupply, rateValidity = true, cpiValidity = true) {
  await mockMarketOracle.storeData(rate);
  await mockMarketOracle.storeValidity(rateValidity);
  await mockCpiOracle.storeData(cpi);
  await mockCpiOracle.storeValidity(cpiValidity);
  await mockUFragments.storeSupply(uFragSupply);
}

contract('UFragmentsPolicy', function (accounts) {
  before('setup UFragmentsPolicy contract', setupContracts);

  it('should reject any ether sent to it', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.sendTransaction({ from: user, value: 1 }))
    ).to.be.true;
  });
});

contract('UFragmentsPolicy:initialize', async function (accounts) {
  describe('initial values set correctly', function () {
    before('setup UFragmentsPolicy contract', setupContracts);

    it('deviationThreshold', async function () {
      (await uFragmentsPolicy.deviationThreshold.call()).toString().should.be.eq(new BigNumber(10).pow(new BigNumber(16)).mul(new BigNumber(5)).toString());
    });
    it('rebaseLag', async function () {
      (await uFragmentsPolicy.rebaseLag.call()).toString().should.be.eq('30');
    });
    it('minRebaseTimeIntervalSec', async function () {
      (await uFragmentsPolicy.minRebaseTimeIntervalSec.call()).toString().should.be.eq(new BigNumber(24 * 60 * 60).toString());
    });
    it('epoch', async function () {
      (await uFragmentsPolicy.epoch.call()).toString().should.be.eq('0');
    });
    it('rebaseWindowOffsetSec', async function () {
      (await uFragmentsPolicy.rebaseWindowOffsetSec.call()).toString().should.be.eq('72000');
    });
    it('rebaseWindowLengthSec', async function () {
      (await uFragmentsPolicy.rebaseWindowLengthSec.call()).toString().should.be.eq('900');
    });
    it('should set owner', async function () {
      expect((await uFragmentsPolicy.owner.call()).toLowerCase()).to.eq(deployer.toLowerCase());
    });
    it('should set reference to uFragments', async function () {
      expect((await uFragmentsPolicy.uFrags.call()).toLowerCase()).to.eq(mockUFragments.address.toLowerCase());
    });
  });
});

contract('UFragmentsPolicy:setMarketOracle', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContracts);

  it('should set marketOracle', async function () {
    await uFragmentsPolicy.setMarketOracle(deployer);
    expect((await uFragmentsPolicy.marketOracle.call()).toLowerCase()).to.eq(deployer.toLowerCase());
  });
});

contract('UFragments:setMarketOracle:accessControl', function (accounts) {
  before('setup UFragmentsPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.setMarketOracle(deployer, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.setMarketOracle(deployer, { from: user }))
    ).to.be.true;
  });
});

contract('UFragmentsPolicy:setDominusOracle', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContracts);

  it('should set cpiOracle', async function () {
    await uFragmentsPolicy.setDominusOracle(deployer);
    expect((await uFragmentsPolicy.dominusOracle.call()).toLowerCase()).to.eq(deployer.toLowerCase());
  });
});

contract('UFragments:setDominusOracle:accessControl', function (accounts) {
  before('setup UFragmentsPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.setDominusOracle(deployer, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.setDominusOracle(deployer, { from: user }))
    ).to.be.true;
  });
});

contract('UFragmentsPolicy:setOrchestrator', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContracts);

  it('should set orchestrator', async function () {
    await uFragmentsPolicy.setOrchestrator(user, {from: deployer});
    expect((await uFragmentsPolicy.orchestrator.call()).toLowerCase()).to.eq(user.toLowerCase());
  });
});

contract('UFragments:setOrchestrator:accessControl', function (accounts) {
  before('setup UFragmentsPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.setOrchestrator(deployer, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.setOrchestrator(deployer, { from: user }))
    ).to.be.true;
  });
});

contract('UFragmentsPolicy:setDeviationThreshold', async function (accounts) {
  let prevThreshold, threshold;
  before('setup UFragmentsPolicy contract', async function () {
    await setupContracts();
    prevThreshold = await uFragmentsPolicy.deviationThreshold.call();
    threshold = prevThreshold.add(new BigNumber(10).pow(new BigNumber(16)));
    await uFragmentsPolicy.setDeviationThreshold(threshold);
  });

  it('should set deviationThreshold', async function () {
    (await uFragmentsPolicy.deviationThreshold.call()).toString().should.be.eq(threshold.toString());
  });
});

contract('UFragments:setDeviationThreshold:accessControl', function (accounts) {
  before('setup UFragmentsPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.setDeviationThreshold(0, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.setDeviationThreshold(0, { from: user }))
    ).to.be.true;
  });
});

contract('UFragmentsPolicy:setRebaseLag', async function (accounts) {
  let prevLag;
  before('setup UFragmentsPolicy contract', async function () {
    await setupContracts();
    prevLag = await uFragmentsPolicy.rebaseLag.call();
  });

  describe('when rebaseLag is more than 0', async function () {
    it('should setRebaseLag', async function () {
      const lag = prevLag.add(new BigNumber(1));
      await uFragmentsPolicy.setRebaseLag(lag);
      (await uFragmentsPolicy.rebaseLag.call()).toString().should.be.eq(lag.toString());
    });
  });

  describe('when rebaseLag is 0', async function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(uFragmentsPolicy.setRebaseLag(0))
      ).to.be.true;
    });
  });
});

contract('UFragments:setRebaseLag:accessControl', function (accounts) {
  before('setup UFragmentsPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.setRebaseLag(1, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.setRebaseLag(1, { from: user }))
    ).to.be.true;
  });
});

contract('UFragmentsPolicy:setRebaseTimingParameters', async function (accounts) {
  before('setup UFragmentsPolicy contract', async function () {
    await setupContracts();
  });

  describe('when interval=0', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(uFragmentsPolicy.setRebaseTimingParameters(0, 0, 0))
      ).to.be.true;
    });
  });

  describe('when offset > interval', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(uFragmentsPolicy.setRebaseTimingParameters(300, 3600, 300))
      ).to.be.true;
    });
  });

  describe('when params are valid', function () {
    it('should setRebaseTimingParameters', async function () {
      await uFragmentsPolicy.setRebaseTimingParameters(600, 60, 300);
      (await uFragmentsPolicy.minRebaseTimeIntervalSec.call()).toString().should.be.eq('600');
      (await uFragmentsPolicy.rebaseWindowOffsetSec.call()).toString().should.be.eq('60');
      (await uFragmentsPolicy.rebaseWindowLengthSec.call()).toString().should.be.eq('300');
    });
  });
});

contract('UFragments:setRebaseTimingParameters:accessControl', function (accounts) {
  before('setup UFragmentsPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.setRebaseTimingParameters(600, 60, 300, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(uFragmentsPolicy.setRebaseTimingParameters(600, 60, 300, { from: user }))
    ).to.be.true;
  });
});

contract('UFragmentsPolicy:Rebase:accessControl', async function (accounts) {
  beforeEach('setup UFragmentsPolicy contract', async function () {
    await setupContractsWithOpenRebaseWindow();
    await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true);
    await chain.waitForSomeTime(60);
  });

  describe('when rebase called by orchestrator', function () {
    it('should succeed', async function () {
      expect(
        await chain.isEthException(uFragmentsPolicy.rebase({from: orchestrator}))
      ).to.be.false;
    });
  });

  describe('when rebase called by non-orchestrator', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(uFragmentsPolicy.rebase({from: user}))
      ).to.be.true;
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when minRebaseTimeIntervalSec has NOT passed since the previous rebase', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1010);
      await chain.waitForSomeTime(60);
      await uFragmentsPolicy.rebase({from: orchestrator});
    });

    it('should fail', async function () {
      expect(
        await chain.isEthException(uFragmentsPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when rate is within deviationThreshold', function () {
    before(async function () {
      await uFragmentsPolicy.setRebaseTimingParameters(60, 0, 60);
    });

    it('should return 0', async function () {
      await mockExternalData(INITIAL_RATE.sub(new BigNumber(1)), INITIAL_CPI, 1000);
      await chain.waitForSomeTime(60);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.toString().should.be.eq('0');
      await chain.waitForSomeTime(60);

      await mockExternalData(INITIAL_RATE.add(new BigNumber(1)), INITIAL_CPI, 1000);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.toString().should.be.eq('0');
      await chain.waitForSomeTime(60);

      await mockExternalData(INITIAL_RATE_5P_MORE.sub(new BigNumber(2)), INITIAL_CPI, 1000);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.toString().should.be.eq('0');
      await chain.waitForSomeTime(60);

      await mockExternalData(INITIAL_RATE_5P_LESS.add(new BigNumber(2)), INITIAL_CPI, 1000);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.toString().should.be.eq('0');
      await chain.waitForSomeTime(60);
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when rate is more than MAX_RATE', function () {
    it('should return same supply delta as delta for MAX_RATE', async function () {
      // Any exchangeRate >= (MAX_RATE=100x) would result in the same supply increase
      await mockExternalData(MAX_RATE, INITIAL_CPI, 1000);
      await chain.waitForSomeTime(60);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
      const supplyChange = r.logs[0].args.requestedSupplyAdjustment;

      await chain.waitForSomeTime(60);

      await mockExternalData(MAX_RATE.add(new BigNumber(10).pow(new BigNumber(10))), INITIAL_CPI, 1000);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.toString().should.be.eq(supplyChange.toString());

      await chain.waitForSomeTime(60);

      await mockExternalData(MAX_RATE.mul(new BigNumber(2)), INITIAL_CPI, 1000);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.toString().should.be.eq(supplyChange.toString());
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when uFragments grows beyond MAX_SUPPLY', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_2X, INITIAL_CPI, MAX_SUPPLY.sub(new BigNumber(1)));
      await chain.waitForSomeTime(60);
    });

    it('should apply SupplyAdjustment {MAX_SUPPLY - totalSupply}', async function () {
      // Supply is MAX_SUPPLY-1, exchangeRate is 2x; resulting in a new supply more than MAX_SUPPLY
      // However, supply is ONLY increased by 1 to MAX_SUPPLY
      r = await uFragmentsPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.toString().should.be.eq('1');
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when uFragments supply equals MAX_SUPPLY and rebase attempts to grow', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_2X, INITIAL_CPI, MAX_SUPPLY);
      await chain.waitForSomeTime(60);
    });

    it('should not grow', async function () {
      r = await uFragmentsPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.toString().should.be.eq('0');
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when the market oracle returns invalid data', function () {
    it('should fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, false);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(uFragmentsPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when the market oracle returns valid data', function () {
    it('should NOT fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(uFragmentsPolicy.rebase({from: orchestrator}))
      ).to.be.false;
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when the cpi oracle returns invalid data', function () {
    it('should fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true, false);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(uFragmentsPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when the cpi oracle returns valid data', function () {
    it('should NOT fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true, true);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(uFragmentsPolicy.rebase({from: orchestrator}))
      ).to.be.false;
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('positive rate and no change CPI', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000);
      await uFragmentsPolicy.setRebaseTimingParameters(60, 0, 60);
      await chain.waitForSomeTime(60);
      await uFragmentsPolicy.rebase({from: orchestrator});
      await chain.waitForSomeTime(59);
      prevEpoch = await uFragmentsPolicy.epoch.call();
      prevTime = await uFragmentsPolicy.lastRebaseTimestampSec.call();
      await mockExternalData(INITIAL_RATE_60P_MORE, INITIAL_CPI, 1010);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
    });

    it('should increment epoch', async function () {
      const epoch = await uFragmentsPolicy.epoch.call();
      expect(prevEpoch.add(new BigNumber(1)).toString().should.be.eq(epoch.toString()));
    });

    it('should update lastRebaseTimestamp', async function () {
      const time = await uFragmentsPolicy.lastRebaseTimestampSec.call();
      expect(time.sub(prevTime).toString().should.be.eq('60'));
    });

    it('should emit Rebase with positive requestedSupplyAdjustment', async function () {
      // Setting: maxPositiveRateChangePercentage = 100
      // Setting: maxNegativeRateChangePercentage = 100
      // Setting: DECIMALS = 18
      // Setting: MAX_RATE =                                             1000000000000000000000000
      // Setting: rebaseLag = 30
      // Setting: baseDominus/baseCPI =      10000000000000000000
      // Setting: dominus = oracleCPI = INITIAL_CPI = 251712000000000000000
      // Derived: targetRate = dominus.mul(10 ** DECIMALS).div(baseDominus) = 25171200000000000000
      // Setting: exchangeRate = oracleRate = INITIAL_RATE_30P_MORE =         32722560000000000000
      // Setting: totalSupply = 1000
      // Derived: supplyDelta = totalSupply * (exchangeRate - targetRate) / targetRate = 300
      // Derived: supplyDelta = supplyDelta / rebaseLag = 10
      // Derived: supplyDelta = smin(supplyDelta, (totalSupply * maxPositiveRateChangePercentage) / 100) = 10
      // Derived: supplyDelta = smax(supplyDelta, -(totalSupply * maxNegativeRateChangePercentage) / 100) = 10
      // *rebase happens*
      // Expect:  supplyAfterRebase = 1010
      //
      // Setting: totalSupply = 1010
      // Setting: exchangeRate = oracleRate = INITIAL_RATE_60P_MORE = 40273920000000000000
      // Derived: targetRate = dominus.mul(10 ** DECIMALS).div(baseDominus) = 25171200000000000000
      // Derived: supplyDelta = totalSupply * (exchangeRate - targetRate) / targetRate = 606
      // Derived: supplyDelta = supplyDelta / rebaseLag = 20
      // Derived: supplyDelta = smin(supplyDelta, (totalSupply * maxPositiveRateChangePercentage) / 100) = 20
      // Derived: supplyDelta = smax(supplyDelta, -(totalSupply * maxNegativeRateChangePercentage) / 100) = 20
      // *rebase happens*
      // Expect:  supplyAfterRebase = 1030

      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      expect(log.args.epoch.toString().should.be.eq(prevEpoch.add(new BigNumber(1)).toString()));
      log.args.exchangeRate.toString().should.be.eq(INITIAL_RATE_60P_MORE.toString());
      log.args.dominus.toString().should.be.eq(INITIAL_CPI.toString());
      log.args.requestedSupplyAdjustment.toString().should.be.eq('20');
    });

    it('should call getData from the market oracle', async function () {
      const fnCalled = mockMarketOracle.FunctionCalled().formatter(r.receipt.logs[2]);
      expect(fnCalled.args.instanceName).to.eq('MarketOracle');
      expect(fnCalled.args.functionName).to.eq('getData');
      expect(fnCalled.args.caller).to.eq(uFragmentsPolicy.address);
    });

    it('should call getData from the cpi oracle', async function () {
      const fnCalled = mockCpiOracle.FunctionCalled().formatter(r.receipt.logs[0]);
      expect(fnCalled.args.instanceName).to.eq('CpiOracle');
      expect(fnCalled.args.functionName).to.eq('getData');
      expect(fnCalled.args.caller).to.eq(uFragmentsPolicy.address);
    });

    it('should call uFrag Rebase', async function () {
      prevEpoch = await uFragmentsPolicy.epoch.call();
      const fnCalled = mockUFragments.FunctionCalled().formatter(r.receipt.logs[4]);
      expect(fnCalled.args.instanceName).to.eq('UFragments');
      expect(fnCalled.args.functionName).to.eq('rebase');
      expect(fnCalled.args.caller).to.eq(uFragmentsPolicy.address);
      const fnArgs = mockUFragments.FunctionArguments().formatter(r.receipt.logs[5]);
      const parsedFnArgs = Object.keys(fnArgs.args).reduce((m, k) => {
        return fnArgs.args[k].map(d => d.toNumber()).concat(m);
      }, [ ]);
      expect(parsedFnArgs).to.include.members([prevEpoch.toNumber(), 20]);
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('negative rate', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_30P_LESS, INITIAL_CPI, 1000);
      await chain.waitForSomeTime(60);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
    });

    it('should emit Rebase with negative requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.toString().should.be.eq('-10');
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when cpi increases', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE, INITIAL_CPI_25P_MORE, 1000);
      await chain.waitForSomeTime(60);
      await uFragmentsPolicy.setDeviationThreshold(0);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
    });

    it('should emit Rebase with negative requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.toString().should.be.eq('-6');
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when cpi decreases', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE, INITIAL_CPI_25P_LESS, 1000);
      await chain.waitForSomeTime(60);
      await uFragmentsPolicy.setDeviationThreshold(0);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
    });

    it('should emit Rebase with positive requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.toString().should.be.eq('9');
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  before('setup UFragmentsPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('rate=TARGET_RATE', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      await uFragmentsPolicy.setDeviationThreshold(0);
      await chain.waitForSomeTime(60);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
    });

    it('should emit Rebase with 0 requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.toString().should.be.eq('0');
    });
  });
});

contract('UFragmentsPolicy:Rebase', async function (accounts) {
  let rbTime, rbWindow, minRebaseTimeIntervalSec, now, prevRebaseTime, nextRebaseWindowOpenTime,
    timeToWait, lastRebaseTimestamp;

  beforeEach('setup UFragmentsPolicy contract', async function () {
    await setupContracts();
    await uFragmentsPolicy.setRebaseTimingParameters(86400, 72000, 900);
    rbTime = await uFragmentsPolicy.rebaseWindowOffsetSec.call();
    rbWindow = await uFragmentsPolicy.rebaseWindowLengthSec.call();
    minRebaseTimeIntervalSec = await uFragmentsPolicy.minRebaseTimeIntervalSec.call();
    now = new BigNumber(await chain.currentTime());
    prevRebaseTime = now.sub(now.mod(minRebaseTimeIntervalSec)).add(rbTime);
    nextRebaseWindowOpenTime = prevRebaseTime.add(minRebaseTimeIntervalSec);
  });

  describe('when its 5s after the rebase window closes', function () {
    it('should fail', async function () {
      timeToWait = nextRebaseWindowOpenTime.sub(now).add(rbWindow).add(new BigNumber(5));
      await chain.waitForSomeTime(timeToWait.toNumber());
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      expect(await uFragmentsPolicy.inRebaseWindow.call()).to.be.false;
      expect(
        await chain.isEthException(uFragmentsPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when its 5s before the rebase window opens', function () {
    it('should fail', async function () {
      timeToWait = nextRebaseWindowOpenTime.sub(now).sub(new BigNumber(5));
      await chain.waitForSomeTime(timeToWait.toNumber());
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      expect(await uFragmentsPolicy.inRebaseWindow.call()).to.be.false;
      expect(
        await chain.isEthException(uFragmentsPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when its 5s after the rebase window opens', function () {
    it('should NOT fail', async function () {
      timeToWait = nextRebaseWindowOpenTime.sub(now).add(new BigNumber(5));
      await chain.waitForSomeTime(timeToWait.toNumber());
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      expect(await uFragmentsPolicy.inRebaseWindow.call()).to.be.true;
      expect(
        await chain.isEthException(uFragmentsPolicy.rebase({from: orchestrator}))
      ).to.be.false;
      lastRebaseTimestamp = await uFragmentsPolicy.lastRebaseTimestampSec.call();
      expect(lastRebaseTimestamp.toString().should.be.eq(nextRebaseWindowOpenTime.toString()));
    });
  });

  describe('when its 5s before the rebase window closes', function () {
    it('should NOT fail', async function () {
      timeToWait = nextRebaseWindowOpenTime.sub(now).add(rbWindow).sub(new BigNumber(5));
      await chain.waitForSomeTime(timeToWait.toNumber());
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      expect(await uFragmentsPolicy.inRebaseWindow.call()).to.be.true;
      expect(
        await chain.isEthException(uFragmentsPolicy.rebase({from: orchestrator}))
      ).to.be.false;
      lastRebaseTimestamp = await uFragmentsPolicy.lastRebaseTimestampSec.call();
      expect(lastRebaseTimestamp.toString().should.be.eq(nextRebaseWindowOpenTime.toString()));
    });
  });
});

contract('UFragmentsPolicy:RebaseWithLimit', async function (accounts) {
  before('setup UFragmentsPolicy contract with limits', setupContractsWithOpenRebaseWindow);

  describe('positive rate and no change CPI', function () {
    before(async function () {
      await uFragmentsPolicy.setRateChangeMaximums(1, 100);
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000);
      await uFragmentsPolicy.setRebaseTimingParameters(60, 0, 60);
      await chain.waitForSomeTime(60);
      await uFragmentsPolicy.rebase({from: orchestrator});
      await chain.waitForSomeTime(59);
      prevEpoch = await uFragmentsPolicy.epoch.call();
      prevTime = await uFragmentsPolicy.lastRebaseTimestampSec.call();
      await mockExternalData(INITIAL_RATE_60P_MORE, INITIAL_CPI, 1003);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
    });

    it('should increment epoch', async function () {
      const epoch = await uFragmentsPolicy.epoch.call();
      expect(prevEpoch.add(new BigNumber(1)).toString().should.be.eq(epoch.toString()));
    });

    it('should update lastRebaseTimestamp', async function () {
      const time = await uFragmentsPolicy.lastRebaseTimestampSec.call();
      expect(time.sub(prevTime).toString().should.be.eq('60'));
    });

    it('should emit Rebase with positive requestedSupplyAdjustment, capped by the limit', async function () {
      // Setting: maxPositiveRateChangePercentage = 1
      // Setting: maxNegativeRateChangePercentage = 100
      // Setting: DECIMALS = 18
      // Setting: MAX_RATE =                                             1000000000000000000000000
      // Setting: rebaseLag = 30
      // Setting: baseDominus/baseCPI =      10000000000000000000
      // Setting: dominus = oracleCPI = INITIAL_CPI = 251712000000000000000
      // Derived: targetRate = dominus.mul(10 ** DECIMALS).div(baseDominus) = 25171200000000000000
      // Setting: exchangeRate = oracleRate = INITIAL_RATE_30P_MORE =         32722560000000000000
      // Setting: totalSupply = 1000
      // Derived: supplyDelta = totalSupply * (exchangeRate - targetRate) / targetRate = 300
      // Derived: supplyDelta = supplyDelta / rebaseLag = 10
      // Derived: supplyDelta = smin(supplyDelta, (totalSupply * maxPositiveRateChangePercentage) / 100) = 10
      // Derived: supplyDelta = smax(supplyDelta, -(totalSupply * maxNegativeRateChangePercentage) / 100) = 10
      // *rebase happens*
      // Expect:  supplyAfterRebase = 1010
      //
      // Setting: totalSupply = 1010
      // Setting: exchangeRate = oracleRate = INITIAL_RATE_60P_MORE = 40273920000000000000
      // Derived: targetRate = dominus.mul(10 ** DECIMALS).div(baseDominus) = 25171200000000000000
      // Derived: supplyDelta = totalSupply * (exchangeRate - targetRate) / targetRate = 606
      // Derived: supplyDelta = supplyDelta / rebaseLag = 20
      // Derived: supplyDelta = smin(supplyDelta, (totalSupply * maxPositiveRateChangePercentage) / 100) = 10
      // Derived: supplyDelta = smax(supplyDelta, -(totalSupply * maxNegativeRateChangePercentage) / 100) = 10
      // *rebase happens*
      // Expect:  supplyAfterRebase = 1020

      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      expect(log.args.epoch.toString().should.be.eq(prevEpoch.add(new BigNumber(1)).toString()));
      log.args.exchangeRate.toString().should.be.eq(INITIAL_RATE_60P_MORE.toString());
      log.args.dominus.toString().should.be.eq(INITIAL_CPI.toString());
      log.args.requestedSupplyAdjustment.toString().should.be.eq('10');
    });

    it('should call getData from the market oracle', async function () {
      const fnCalled = mockMarketOracle.FunctionCalled().formatter(r.receipt.logs[2]);
      expect(fnCalled.args.instanceName).to.eq('MarketOracle');
      expect(fnCalled.args.functionName).to.eq('getData');
      expect(fnCalled.args.caller).to.eq(uFragmentsPolicy.address);
    });

    it('should call getData from the cpi oracle', async function () {
      const fnCalled = mockCpiOracle.FunctionCalled().formatter(r.receipt.logs[0]);
      expect(fnCalled.args.instanceName).to.eq('CpiOracle');
      expect(fnCalled.args.functionName).to.eq('getData');
      expect(fnCalled.args.caller).to.eq(uFragmentsPolicy.address);
    });

    it('should call uFrag Rebase', async function () {
      prevEpoch = await uFragmentsPolicy.epoch.call();
      const fnCalled = mockUFragments.FunctionCalled().formatter(r.receipt.logs[4]);
      expect(fnCalled.args.instanceName).to.eq('UFragments');
      expect(fnCalled.args.functionName).to.eq('rebase');
      expect(fnCalled.args.caller).to.eq(uFragmentsPolicy.address);
      const fnArgs = mockUFragments.FunctionArguments().formatter(r.receipt.logs[5]);
      const parsedFnArgs = Object.keys(fnArgs.args).reduce((m, k) => {
        return fnArgs.args[k].map(d => d.toNumber()).concat(m);
      }, [ ]);
      expect(parsedFnArgs).to.include.members([prevEpoch.toNumber(), 20]);
    });
  });
});

contract('UFragmentsPolicy:RebaseWithLimit', async function (accounts) {
  before('setup UFragmentsPolicy contract with limits', setupContractsWithOpenRebaseWindow);

  describe('negative rate', function () {
    before(async function () {
      await uFragmentsPolicy.setRateChangeMaximums(100, 1);
      await mockExternalData(INITIAL_RATE_60P_LESS, INITIAL_CPI, 1000);
      await chain.waitForSomeTime(60);
      r = await uFragmentsPolicy.rebase({from: orchestrator});
    });

    it('should emit Rebase with negative requestedSupplyAdjustment, capped by the limit', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.toString().should.be.eq('-10');
    });
  });
});

