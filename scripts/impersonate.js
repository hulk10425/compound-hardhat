const {impersonateAccount} = require("@nomicfoundation/hardhat-network-helpers");
const { network,ethers } = require("hardhat");
const erc20 = require("../erc20.json");
// const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");const { expect } = require("chai");describe("Test", function () {  let usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'  let binanceHotWalletAddress = '0xF977814e90dA44bFA03b6295A0616a897441aceC'  let accounts  let usdc;  describe("Are we in mainnet?", function () {    it("BinanceWallet should contain USDC", async function () {      accounts = await ethers.getSigners();      usdc = await ethers.getContractAt("ERC20", usdcAddress);      let balance = await usdc.balanceOf(binanceHotWalletAddress)      expect(balance).to.gt(0)      console.log(`Binance wallet USDC balance: ${balance}`)    });    it("Ask Binance to give me USDC", async function() {      let transferAmount = 10000000      // new      await impersonateAccount(binanceHotWalletAddress)      // await hre.network.provider.request({      //   method: "hardhat_impersonateAccount",      //   params: [binanceHotWalletAddress],      // });      const binanceWallet = await ethers.getSigner(        binanceHotWalletAddress        );      await usdc.connect(binanceWallet).transfer(accounts[0].address, transferAmount)      let balance = await usdc.balanceOf(accounts[0].address)      console.log(`Our wallet USDC balance: ${balance}`)      expect(balance).to.eq(transferAmount)    })  });});
async function main() {

  
  let usdc;
  let usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

  let binanceHotWalletAddress = '0xF977814e90dA44bFA03b6295A0616a897441aceC';
  let myWallet = "0x997C1a628Ba5C3a14Fe4D1724fCCEBf3246D67A3";
  
  usdc = await ethers.getContractAt(erc20,usdcAddress);

  let balance = await usdc.balanceOf(binanceHotWalletAddress);
  
  let transferAmount = 100000000
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params:[binanceHotWalletAddress]
  });

  const binanceWallet = await ethers.getSigner(
    binanceHotWalletAddress
  );

  await usdc.connect(binanceWallet).transfer(myWallet,transferAmount);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
