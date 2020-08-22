const connectionConfig = require('frg-ethereum-runners/config/network_config.json');

//const HDWalletProvider = require("@truffle/hdwallet-provider");
const HDWalletProvider = require("truffle-hdwallet-provider-privkey");
const privKeys = [
    "PRIVKEYPRIVKEYPRIVKEY", // Rinkeby #1
];

module.exports = {
  networks: {
    ganacheUnitTest: connectionConfig.ganacheUnitTest,
    gethUnitTest: connectionConfig.gethUnitTest,
    testrpcCoverage: connectionConfig.testrpcCoverage,
    rinkeby: {
      provider: function() {
          return new HDWalletProvider(privKeys, "https://rinkeby.infura.io/v3/KEYKEYKEY");
      },
      network_id: 4
    },
  },
  compilers: {
    solc: {
      version: '0.5.17',
      settings: {
        optimizer: {
          enabled: false
        }
      }
    }
  },
  mocha: {
    enableTimeouts: false
  }
};
