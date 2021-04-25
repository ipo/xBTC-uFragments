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

    // get oracles
    var instanceBcmdOracle = await MedianOracle.at((await instanceMigrations.getAddress.call(sha256('instanceBcmdOracle'))));
    var instanceMarketOracle = await MedianOracle.at((await instanceMigrations.getAddress.call(sha256('instanceMarketOracle'))));

    // add providers
    await instanceBcmdOracle.addProvider(networkSettings['oracleProviderAddress'], {'from': networkSettings['ownerAddress']});
    await instanceMarketOracle.addProvider(networkSettings['oracleProviderAddress'], {'from': networkSettings['ownerAddress']});

    var postBalance = await w3.eth.getBalance(networkSettings['ownerAddress']);
    console.log('gas used in this step:', (preBalance - postBalance) / 10**18, 'ETH');
};
