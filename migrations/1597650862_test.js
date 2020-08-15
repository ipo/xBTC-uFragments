var UFragments = artifacts.require("UFragments");

module.exports = function(deployer) {
  // Use deployer to state migration tasks.
  deployer.deploy(UFragments);
};
