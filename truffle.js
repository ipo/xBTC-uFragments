const connectionConfig = require('frg-ethereum-runners/config/network_config.json');

//const HDWalletProvider = require("@truffle/hdwallet-provider");
const HDWalletProvider = require("truffle-hdwallet-provider-privkey");
try {
  privKeysRinkeby = [
    fs.readFileSync("key_xbtc_rinkeby.txt").toString().trim(), // Rinkeby #1
  ];
  privKeysMainnet = [
    fs.readFileSync("key_xbtc_mainnet.txt").toString().trim(), // Mainnet
  ];
  
  infuraRinkeby = fs.readFileSync("key_xbtc_infura_rinkeby.txt").toString().trim();
  infuraMainnet = fs.readFileSync("key_xbtc_infura_mainnet.txt").toString().trim();

  etherscanAPIKey = fs.readFileSync("key_xbtc_etherscan_api_key.txt").toString().trim();
} catch (e) {
  privKeysRinkeby = [
    "",
  ];
  privKeysMainnet = [
    "",
  ];
  
  infuraRinkeby = "";
  infuraMainnet = "";
  etherscanAPIKey = "";
}


function getGweiEnv() {
  if (typeof(process.env.GWEI) != 'string') {
    console.log('GWEI env variable needs to be set to required GWEI, if you intend to transact on mainnet!');
    return 0;
  }
  return process.env.GWEI;
}


module.exports = {
  networks: {
    ganacheUnitTest: connectionConfig.ganacheUnitTest,
    gethUnitTest: connectionConfig.gethUnitTest,
    testrpcCoverage: connectionConfig.testrpcCoverage,
    rinkeby: {
      provider: function() {
          return new HDWalletProvider(privKeysRinkeby, infuraRinkeby);
      },
      network_id: 4
    },
    mainnet: {
      provider: function() {
          return new HDWalletProvider(privKeysMainnet, infuraMainnet);
      },
      network_id: 1,
      gasPrice: getGweiEnv() + '000000000'
    },
  },
  compilers: {
    solc: {
      version: '0.5.17',
      settings: {
        optimizer: {
          enabled: true
        }
      }
    }
  },
  mocha: {
    enableTimeouts: false
  }
};
