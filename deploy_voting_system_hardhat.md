# Deploy VotingSystem.sol using Hardhat

## Prerequisites
- Node.js and npm installed
- Ganache running locally at http://127.0.0.1:8545

## Steps

1. Initialize a new Hardhat project (if you don't have one already):
```bash
mkdir voting-system-hardhat
cd voting-system-hardhat
npm init -y
npm install --save-dev hardhat
npx hardhat
```
Choose "Create a basic sample project" and follow prompts.

2. Copy your `VotingSystem.sol` contract into the `contracts/` directory of the Hardhat project.

3. Install ethers and dotenv:
```bash
npm install --save-dev @nomiclabs/hardhat-ethers ethers dotenv
```

4. Update `hardhat.config.js` to connect to Ganache:
```js
require("@nomiclabs/hardhat-ethers");
require('dotenv').config();

module.exports = {
  solidity: "0.8.19",
  networks: {
    ganache: {
      url: "http://127.0.0.1:8545",
      // accounts: [privateKey] // optional if needed
    }
  }
};
```

5. Create a deployment script `scripts/deploy.js`:
```js
async function main() {
  const VotingSystem = await ethers.getContractFactory("VotingSystem");
  const votingSystem = await VotingSystem.deploy();
  await votingSystem.deployed();
  console.log("VotingSystem deployed to:", votingSystem.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
```

6. Run the deployment:
```bash
npx hardhat run scripts/deploy.js --network ganache
```

7. After deployment, the contract address will be printed. The compiled contract JSON artifact will be in `artifacts/contracts/VotingSystem.sol/VotingSystem.json`.

8. Copy the JSON artifact to your server's `build/contracts/` directory or update your server code to point to the new path.

9. Set the environment variable `VOTING_CONTRACT_ADDRESS` to the deployed contract address.

10. Restart your server and test the voting functionality.

---

If you want, I can help you create these files or scripts in your project.
