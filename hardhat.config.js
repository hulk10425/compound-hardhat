require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');

// 辦帳號(免費) https://www.alchemyapi.io
// 辦好帳號把KEY抓過來貼
const ALCHEMY_API_KEY = "";

module.exports = {
  //要跟你要編譯的solidity程式上寫的版本一樣
  solidity: {
    compilers:[
      {
        version: "0.5.16",
      },
      {
        version: "0.8.10"
      }
    ]
  },
  networks: {
    hardhat:{
      forking:{
        url:`https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
        blockNumber:15815693,
      },
      allowUnlimitedContractSize: true
    }
  }
};