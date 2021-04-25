const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const UFragmentsPolicy = artifacts.require('UFragmentsPolicy');
const Orchestrator = artifacts.require('Orchestrator');

var w3 = Orchestrator.interfaceAdapter.web3;

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

    // get existing instance
    var instanceUFragmentsPolicy = await UFragmentsPolicy.deployed();

    //function initialize(address owner_, address policy_) 
    var instanceOrchestrator = await deployProxy(Orchestrator, [networkSettings['ownerAddress'], instanceUFragmentsPolicy.address], { deployer });

    var postBalance = await w3.eth.getBalance(networkSettings['ownerAddress']);
    console.log('gas used in this step:', (preBalance - postBalance) / 10**18, 'ETH');
};
