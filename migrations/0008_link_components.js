var Migrations = artifacts.require("Migrations");
const UFragments = artifacts.require('UFragments');
const UFragmentsPolicy = artifacts.require('UFragmentsPolicy');
const MedianOracle = artifacts.require('MedianOracle');
const Orchestrator = artifacts.require('Orchestrator');

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

    // get existing instances
    var instanceUFragments = await UFragments.deployed();
    var instanceUFragmentsPolicy = await UFragmentsPolicy.deployed();
    var instanceBcmdOracle = await MedianOracle.at((await instanceMigrations.getAddress.call(sha256('instanceBcmdOracle'))));
    var instanceMarketOracle = await MedianOracle.at((await instanceMigrations.getAddress.call(sha256('instanceMarketOracle'))));
    var instanceOrchestrator = await Orchestrator.deployed();

    // link up the different contracts
    // call instanceUFragments.setMonetaryPolicy(address monetaryPolicy_)
    await instanceUFragments.setMonetaryPolicy(instanceUFragmentsPolicy.address, {'from': networkSettings['ownerAddress']});
    // call instanceUFragmentsPolicy.setOrchestrator(address orchestrator_)
    await instanceUFragmentsPolicy.setOrchestrator(instanceOrchestrator.address, {'from': networkSettings['ownerAddress']});
    // call instanceUFragmentsPolicy.setMarketOracle(IOracle marketOracle_)
    await instanceUFragmentsPolicy.setMarketOracle(instanceMarketOracle.address, {'from': networkSettings['ownerAddress']});
    // call instanceUFragmentsPolicy.setDominusOracle(IOracle dominusOracle_)
    await instanceUFragmentsPolicy.setDominusOracle(instanceBcmdOracle.address, {'from': networkSettings['ownerAddress']});

    var postBalance = await w3.eth.getBalance(networkSettings['ownerAddress']);
    console.log('gas used in this step:', (preBalance - postBalance) / 10**18, 'ETH');
};
