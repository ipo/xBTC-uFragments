const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const UFragments = artifacts.require('UFragments');

var w3 = UFragments.interfaceAdapter.web3;

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

    // function initialize(address owner_, string memory tokenName_, string memory tokenTicker_)
    var instanceUFragments = await deployProxy(UFragments, [networkSettings['ownerAddress'], networkSettings['tokenName'], networkSettings['tokenTicker']], { deployer });
    // no need to call, default value false: setRebasePaused(bool paused)
    // no need to call, default value false: setTokenPaused(bool paused)

    var postBalance = await w3.eth.getBalance(networkSettings['ownerAddress']);
    console.log('gas used in this step:', (preBalance - postBalance) / 10**18, 'ETH');
};
