const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const UFragments = artifacts.require('UFragments');
const UFragmentsPolicy = artifacts.require('UFragmentsPolicy');

var w3 = UFragmentsPolicy.interfaceAdapter.web3;

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
    var instanceUFragments = await UFragments.deployed();

    // function initialize(address owner_, UFragments uFrags_, uint256 baseDominus_)
    var instanceUFragmentsPolicy = await deployProxy(UFragmentsPolicy, [networkSettings['ownerAddress'], instanceUFragments.address, networkSettings['startDominus']], { deployer });
    // no need to call, default value 10000, 100: setRateChangeMaximums(uint256 maxPositiveRateChangePercentage_, uint256 maxNegativeRateChangePercentage_)
    // no need to call, default value 50000000000000000: setDeviationThreshold(uint256 deviationThreshold_)
    // call setRebaseTimingParameters(uint256 minRebaseTimeIntervalSec_, uint256 rebaseWindowOffsetSec_, uint256 rebaseWindowLengthSec_) with (86400, 0, 900)
    await instanceUFragmentsPolicy.setRebaseTimingParameters(86400, 0, 900, {'from': networkSettings['ownerAddress']});
    // call setRebaseLag(uint256 rebaseLag_) with (10)
    await instanceUFragmentsPolicy.setRebaseLag(10, {'from': networkSettings['ownerAddress']});

    var postBalance = await w3.eth.getBalance(networkSettings['ownerAddress']);
    console.log('gas used in this step:', (preBalance - postBalance) / 10**18, 'ETH');
};
