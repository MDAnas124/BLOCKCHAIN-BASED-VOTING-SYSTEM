const VotingSystem = artifacts.require("VotingSystem");

module.exports = async function(deployer) {
  // Deploy the VotingSystem contract
  await deployer.deploy(VotingSystem);
  
  // Get the deployed contract instance
  const votingSystem = await VotingSystem.deployed();
  console.log("VotingSystem deployed to:", votingSystem.address);
};
