// const {impersonateAccount} = require("@nomicfoundation/hardhat-network-helpers");
// const { network,ethers } = require("hardhat");
// const erc20 = require("../erc20.json");
// const { expect } = require("chai");


// describe("Send Binance to Me", function () {

//   let usdc;
//   let usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

//   let binanceHotWalletAddress = '0xF977814e90dA44bFA03b6295A0616a897441aceC';
//   let myWallet = "0x997C1a628Ba5C3a14Fe4D1724fCCEBf3246D67A3";
//   let transferAmount = 100000000

//   it("get binance usdc balance", async function () {
//     usdc = await ethers.getContractAt(erc20,usdcAddress);
//     let balance = await usdc.balanceOf(binanceHotWalletAddress);
//     expect(balance).to.gt(0);
//     console.log(`biance balance ${balance}`)
//   });

//   it("balance baba give me money", async function () {
    
//     await network.provider.request({
//       method: "hardhat_impersonateAccount",
//       params:[binanceHotWalletAddress]
//     });

//     const binanceWallet = await ethers.getSigner(
//       binanceHotWalletAddress
//     );

//     await usdc.connect(binanceWallet).transfer(myWallet,transferAmount);
//     let hulkBalance = await usdc.balanceOf(myWallet)
    
//     expect(hulkBalance).to.eq(transferAmount)
//     console.log(`my usdc balance ${hulkBalance}`)

//   });
  

// });
