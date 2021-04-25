const { deployProxy } = require('@openzeppelin/truffle-upgrades');

var Migrations = artifacts.require("Migrations");
const MedianOracle = artifacts.require('MedianOracle');

var w3 = Migrations.interfaceAdapter.web3;

function sha256(message) {
    return '0x' + require("crypto").createHash("sha256").update(message).digest("hex");
}

function loadSettings(network, accounts) {
    var fs = require('fs');
    var networkSettings = JSON.parse(fs.readFileSync('migrations/settings_' + network + '.json').toString().trim());
    if (networkSettings['ownerAddress'] == 'test_account') {
        networkSettings['ownerAddress'] = accounts[0];
    }
    if (networkSettings['oracleProviderAddress'] == 'test_account') {
        networkSettings['oracleProviderAddress'] = accounts[0];
    }
    return networkSettings;
}

module.exports = async function(deployer, network, accounts) {
    const networkSettings = loadSettings(network, accounts)

    var preBalance = await w3.eth.getBalance(networkSettings['ownerAddress']);

    var instanceMigrations = await Migrations.deployed();

    // function initialize(address owner_, uint256 reportExpirationTimeSec_, uint256 reportDelaySec_, uint256 minimumProviders_)
    var instanceMarketOracle = await deployProxy(MedianOracle, [networkSettings['ownerAddress'], 216000, 3600, 1], { deployer })
    // no need to call, proper values set via initialize: setReportExpirationTimeSec(uint256 reportExpirationTimeSec_)
    // no need to call, proper values set via initialize: setReportDelaySec(uint256 reportDelaySec_)
    // no need to call, proper values set via initialize: setMinimumProviders(uint256 minimumProviders_)

    // store address for later use
    await instanceMigrations.setAddress(sha256('instanceMarketOracle'), instanceMarketOracle.address);

    var postBalance = await w3.eth.getBalance(networkSettings['ownerAddress']);
    console.log('gas used in this step:', (preBalance - postBalance) / 10**18, 'ETH');
};
