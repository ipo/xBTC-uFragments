const { contract, web3 } = require('@openzeppelin/test-environment');

const MedianOracle = contract.fromArtifact('MedianOracle');

const BigNumber = web3.utils.BN;
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);
const encodeCall = require('zos-lib/lib/helpers/encodeCall').default;
const expect = require('chai').expect;

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

let medianOracle;
let deployer, user, oracle1, oracle2;

async function setupContracts () {
  await chain.waitForSomeTime(86400);
  const accounts = await chain.getUserAccounts();
  deployer = accounts[0];
  user = accounts[1];
  oracle1 = accounts[2];
  oracle2 = accounts[3];
  medianOracle = await MedianOracle.new();
  await medianOracle.sendTransaction({
    data: encodeCall(
      'initialize',
      ['address', 'uint256', 'uint256', 'uint256'],
      [deployer, 86400, 0, 2]
    ),
    from: deployer
  });
}

describe('MedianOracle', function () {
  before('setup MedianOracle contract', setupContracts);

  describe('when sent ether', async function () {
    it('should reject', async function () {
      expect(
        await chain.isEthException(medianOracle.sendTransaction({ from: user, value: 1 }))
      ).to.be.true;
    });
  });

  describe('when adds new provider', async function () {
    it('should fail to add new provider if called by non deployer', async function () {
      expect(
        await chain.isEthException(medianOracle.addProvider(user, { from: user }))
      ).to.be.true;

      expect((await medianOracle.providersSize()).toString()).equal('0');
    });

    it('should add new provider if called by deployer', async function () {
      await medianOracle.addProvider(oracle1, { from: deployer });
      await medianOracle.addProvider(oracle2, { from: deployer });

      expect((await medianOracle.providersSize()).toString()).equal('2');

      expect((await medianOracle.providers(0)).toLowerCase()).equal(oracle1);
      expect((await medianOracle.providers(1)).toLowerCase()).equal(oracle2);
    });
  });

  describe('when removes provider', async function () {
    it('should fail to remove provider if called by non deployer', async function () {
      expect(
        await chain.isEthException(medianOracle.removeProvider(oracle1, { from: user }))
      ).to.be.true;

      expect((await medianOracle.providersSize()).toString()).equal('2');
    });

    it('should do nothing  if called by deployer and passed unknown provider address', async function () {
      await medianOracle.removeProvider(user, { from: deployer });

      expect((await medianOracle.providersSize()).toString()).equal('2');

      expect((await medianOracle.providers(0)).toLowerCase()).equal(oracle1);
    });

    it('should remove provider if called by deployer and passed existend provider address', async function () {
      await medianOracle.removeProvider(oracle1, { from: deployer });

      expect((await medianOracle.providersSize()).toString()).equal('1');

      expect((await medianOracle.providers(0)).toLowerCase()).equal(oracle2);
    });
  });

  describe('when setting report expiration time', async function () {
    it('should fail to set if called by non deployer', async function () {
      expect(
        await chain.isEthException(medianOracle.setReportExpirationTimeSec(3600, { from: user }))
      ).to.be.true;

      expect((await medianOracle.reportExpirationTimeSec()).toString()).equal('86400');
    });

    it('should succeed if called by deployer', async function () {
      await medianOracle.setReportExpirationTimeSec(3600, { from: deployer });

      expect((await medianOracle.reportExpirationTimeSec()).toString()).equal('3600');
    });
  });

  describe('when setting report delay', async function () {
    it('should fail to set if called by non deployer', async function () {
      expect(
        await chain.isEthException(medianOracle.setReportDelaySec(10, { from: user }))
      ).to.be.true;

      expect((await medianOracle.reportDelaySec()).toString()).equal('0');
    });

    it('should succeed if called by deployer', async function () {
      await medianOracle.setReportDelaySec(10, { from: deployer });

      expect((await medianOracle.reportDelaySec()).toString()).equal('10');
    });
  });

  describe('when setting minimum providers required', async function () {
    it('should fail to set if called by non deployer', async function () {
      expect(
        await chain.isEthException(medianOracle.setMinimumProviders(5, { from: user }))
      ).to.be.true;

      expect((await medianOracle.minimumProviders()).toString()).equal('2');
    });

    it('should succeed if called by deployer', async function () {
      await medianOracle.setMinimumProviders(1, { from: deployer });

      expect((await medianOracle.minimumProviders()).toString()).equal('1');
    });
  });

  describe('when pushing report', async function () {
    it('should fail if called by non oracle', async function () {
      expect(
        await chain.isEthException(medianOracle.pushReport(5, { from: user }))
      ).to.be.true;
    });

    it('should fail if called by deployer', async function () {
      expect(
        await chain.isEthException(medianOracle.pushReport(5, { from: deployer }))
      ).to.be.true;
    });

    it('should suc if called by oracle', async function () {
      const r = await medianOracle.pushReport(50000000, { from: oracle2 });

      expect(r.logs[0].args.provider.toLowerCase()).equal(oracle2);
      expect(r.logs[0].args.payload.toString()).equal('50000000');
      expect(r.logs[0].args.timestamp.toString()).equal((await chain.currentTime()).toString());
    });
  });

  describe('when purging reports', async function () {
    it('should fail if called by non oracle', async function () {
      expect(
        await chain.isEthException(medianOracle.purgeReports({ from: user }))
      ).to.be.true;
    });

    it('should fail if called by deployer', async function () {
      expect(
        await chain.isEthException(medianOracle.purgeReports({ from: deployer }))
      ).to.be.true;
    });

    it('should suc if called by oracle', async function () {
      await medianOracle.purgeReports({ from: oracle2 });
    });
  });

  describe('when getting data', async function () {
    it('should return 0 if not enough providers', async function () {
      await medianOracle.removeProvider(oracle2, { from: deployer });

      expect((await medianOracle.providersSize()).toString()).equal('0');

      const r = await medianOracle.getData.call();

      expect(r['0'].toNumber()).equal(0);
      expect(r['1']).equal(false);
    });

    it('should return median of oracle reports', async function () {
      await medianOracle.addProvider(oracle1, { from: deployer });
      await medianOracle.addProvider(oracle2, { from: deployer });

      expect((await medianOracle.providersSize()).toString()).equal('2');

      await medianOracle.pushReport(50000000, { from: oracle1 });
      await medianOracle.pushReport(60000000, { from: oracle2 });

      await chain.waitForSomeTime(15);

      await medianOracle.pushReport(70000000, { from: oracle1 });
      await medianOracle.pushReport(80000000, { from: oracle2 });

      await chain.waitForSomeTime(60);

      await medianOracle.getData();
      const r = await medianOracle.getData.call();

      expect(r['0'].toNumber()).equal(75000000);
      expect(r['1']).equal(true);
    });
  });

  describe('transferOwnership', async function () {
    it('should transfer ownership', async function () {
      (await medianOracle.owner.call()).toLowerCase().should.eq(deployer.toLowerCase());
      await medianOracle.transferOwnership(user);
      (await medianOracle.owner.call()).toLowerCase().should.eq(user.toLowerCase());
    });
  });
});
