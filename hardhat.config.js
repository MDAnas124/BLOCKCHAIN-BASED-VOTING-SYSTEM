require("@nomiclabs/hardhat-ethers");
require('dotenv').config();

module.exports = {
  solidity: "0.8.19",
  networks: {
    ganache: {
      url: "http://127.0.0.1:8545",
      // accounts: [process.env.PRIVATE_KEY] // Uncomment and set if needed
    }
  }
};
