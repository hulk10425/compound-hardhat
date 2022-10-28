require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');

// 辦帳號(免費) https://www.alchemyapi.io
// 辦好帳號把KEY抓過來貼
const ALCHEMY_API_KEY = "pz92P-wnhD3D-nA4wgvB90Xyd8_8ksJ5";

//放Metamask帳戶私鑰 
//記得選一個不放錢的帳戶（但你要用的鏈要有錢當gas）
//這裡可以挖goerli的Gas  https://goerli-faucet.pk910.de/

// 0x18b7346d98FD19D35450c0da33031F9ceD16E291
// 3828422cb8dcdf3fa1e6fb7cbf581db4847b51f81850634936572aa530310f7d

const GOERLI_PRIVATE_KEY = "3828422cb8dcdf3fa1e6fb7cbf581db4847b51f81850634936572aa530310f7d";

//辦帳號(免費) https://etherscan.io/
//辦好之後申請一個API 把API KEY貼過來
const ETHERSCAN_API_KEY = "CEKCPW6VDESH1C5JDD7N4KS75ZBW65HB7Z";

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
        blockNumber:15818116,
      },
      allowUnlimitedContractSize: true
    }
  }, 
  etherscan: {
    apiKey: {
      goerli: ETHERSCAN_API_KEY
    }
   },
};