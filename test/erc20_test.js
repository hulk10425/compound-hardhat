const {
  etherUnsigned,
  etherMantissa,
  UInt256Max
} = require('./Utils/Ethereum');

const {
  makeCToken,
  setBorrowRate,
  pretendBorrow,
  makeToken
} = require('./Utils/Compound');

const {
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");

const { expect } = require("chai");
const { upgrades, ethers } = require('hardhat');
const BigNumber = require('big-number');
const { getCreate2Address } = require('ethers/lib/utils');

const DECIMAL = 10n ** 18n;

describe('CToken', function () {

  describe('constructor', () => {

    // 部署 Comptroller
    async function deployComptroller() {
      const comptroller = await hre.ethers.getContractFactory("Comptroller");
      const comptrollerDeploy = await comptroller.deploy();
      await comptrollerDeploy.deployed();
      return { comptrollerDeploy };
    }
    // 部署 IntrestRateModel 用最簡單的WhitePaper 
    async function deployInterestRateModel() {
      const irModel = await hre.ethers.getContractFactory("WhitePaperInterestRateModel");
      const irModelDeploy = await irModel.deploy(
        0,0
      );
      await irModelDeploy.deployed();
      return { irModelDeploy };
    }

    //部署 Oracle
    async function deployOracle() {
      const oracleModel = await hre.ethers.getContractFactory("SimplePriceOracle");
      const oracleDeploy = await oracleModel.deploy();
      await oracleDeploy.deployed();
      return {oracleDeploy};
    }

    async function deploySixNeedModel() {
     
      LendingPoolAddressesProvider = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5";

      const accounts = await ethers.getSigners();

      const { comptrollerDeploy } = await loadFixture(deployComptroller);

      const { irModelDeploy } = await loadFixture(deployInterestRateModel);

      const { oracleDeploy} = await loadFixture(deployOracle);

      //單純使用CErc20Immutalbe
      const CERC20 = await hre.ethers.getContractFactory("CErc20Immutable");

      const FlashLoan = await hre.ethers.getContractFactory("FlashLoan");

      const cUNIDeploy = await CERC20.deploy(
        "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        comptrollerDeploy.address,
        irModelDeploy.address,
        ethers.utils.parseUnits("1",18),// exchange rate
        "cUNIToken",
        "cUNI",
        18,
        accounts[0].address
      );

      const cUSDCDeploy = await CERC20.deploy(
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        comptrollerDeploy.address,
        irModelDeploy.address,
        ethers.utils.parseUnits("1",18),// exchange rate 10^6
        "cUSDCToken",
        "cUSDC",
        6,//18
        accounts[0].address
      );

      const FlashLoanDeploy = await FlashLoan.deploy(
        cUNIDeploy.address,
        cUSDCDeploy.address
      );
      //部署完成後，將合約物件回傳，等待邏輯測試
      await FlashLoanDeploy.deployed();
      await cUNIDeploy.deployed();   
      await cUSDCDeploy.deployed();
      return {accounts, FlashLoanDeploy,cUNIDeploy, cUSDCDeploy, comptrollerDeploy, oracleDeploy};
    }

    // 第六題
    it("it's failed, when FlashLoan not work", async () => {
      
      let usdcTransferAmount = ethers.utils.parseUnits("60000", 6);
      let uniTransferAmount = ethers.utils.parseUnits("2000", 18);

      let usdcMintAmount = ethers.utils.parseUnits("50000", 6);
      let uniMintAmount = ethers.utils.parseUnits("1000", 18);

      let uniContractAddress = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
      let usdcContractAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

      const COLLATERAL_FACTOR = ethers.utils.parseUnits("0.5", 18);
      const CLOSE_FACTOR = ethers.utils.parseUnits("0.5", 18);
      const INCENTIVE_FACTOR =  ethers.utils.parseUnits("1.1", 18);

      const {accounts, FlashLoanDeploy,cUNIDeploy, cUSDCDeploy, comptrollerDeploy, oracleDeploy} = await loadFixture(deploySixNeedModel);
      
      uni = await ethers.getContractAt("EIP20Interface",uniContractAddress); //直接拿鏈上有的合約是這樣寫
      usdc = await ethers.getContractAt("EIP20Interface",usdcContractAddress);
      //先找到兩個有大量USDC以及UNI的地址
      const impersonatedSignerUNI = await ethers.getImpersonatedSigner("0x33Ddd548FE3a082d753E5fE721a26E1Ab43e3598");
      const impersonatedSignerUSDC = await ethers.getImpersonatedSigner("0xAe2D4617c862309A3d75A0fFB358c7a5009c673F");

      await usdc.connect(impersonatedSignerUSDC).transfer(accounts[0].address,usdcTransferAmount);
      let usdcBalanceOfSinger1 = await usdc.balanceOf(accounts[0].address);
      //確保singer1有收到60000 USDC 
      expect(usdcBalanceOfSinger1).to.equal(usdcTransferAmount);

      await uni.connect(impersonatedSignerUNI).transfer(accounts[1].address,uniTransferAmount);
      let uniBalanceOfSinger2 = await uni.balanceOf(accounts[1].address);
      //確保 singer2 有收到 2000 UNI
      expect(usdcBalanceOfSinger1).to.equal(usdcTransferAmount);

      //先匯個100美進去，給清算合約當作 還flashloan的手續費
      await usdc.transfer(FlashLoanDeploy.address, ethers.utils.parseUnits("100", 6));
      
      await comptrollerDeploy._supportMarket(cUNIDeploy.address);
      await comptrollerDeploy._supportMarket(cUSDCDeploy.address);

      // 接下來要讓 singer1 以及 signer2 分別執行 enterMarkets
      // 要不然在comptroller 裡面的 accountAssets參數 會找不到 singer1 / signer2
      // 而導致後續的 borrow 出現 流動性不足錯誤
      await comptrollerDeploy.enterMarkets([cUSDCDeploy.address,cUNIDeploy.address]);
      await comptrollerDeploy.connect(accounts[0]).enterMarkets([cUSDCDeploy.address,cUNIDeploy.address]);
      await comptrollerDeploy.connect(accounts[1]).enterMarkets([cUSDCDeploy.address,cUNIDeploy.address]);
      
      // 設定 UNI Token 價格為 10
      await oracleDeploy.setUnderlyingPrice(cUNIDeploy.address,ethers.utils.parseUnits("10", 18))
      // 設定 USDC Token 價格為 1
      // 文件有
      await oracleDeploy.setUnderlyingPrice(cUSDCDeploy.address,ethers.utils.parseUnits("1", 30))

      // comptroller要正常運作需要設定 oracle 以及 colleateral factor
      await comptrollerDeploy._setPriceOracle(oracleDeploy.address);
      // 設定cUSDC / cUNI 池的 Collateral Factor 為50%
      await comptrollerDeploy._setCollateralFactor(cUSDCDeploy.address, COLLATERAL_FACTOR );
      await comptrollerDeploy._setCollateralFactor(cUNIDeploy.address, COLLATERAL_FACTOR );
      // 設定 Close Factor 為50%
      await comptrollerDeploy._setCloseFactor(CLOSE_FACTOR)
      // 設定清算人的激勵費 10%
      await comptrollerDeploy._setLiquidationIncentive(INCENTIVE_FACTOR)

      //Singer1 創造cUSDC池 mint 50000顆 cUSDC 以及 Singer2 創造cUNI池 mint 2000顆
      //由Singer1先mint usdc 進池子裡
      await usdc.approve(cUSDCDeploy.address, usdcMintAmount);
      await cUSDCDeploy.mint(usdcMintAmount);

      // 由Singer2 mint uni 進池子裡
      await uni.connect(accounts[1]).approve(cUNIDeploy.address, uniMintAmount);
      await cUNIDeploy.connect(accounts[1]).mint(uniMintAmount);
      
      singer1cUSDCBalance =  await cUSDCDeploy.balanceOf(accounts[0].address);
      singer2cUNIBalance =  await cUNIDeploy.balanceOf(accounts[1].address);

      //確保 Singer1 有mint出 50,000 cUSDC
      expect(singer1cUSDCBalance).to.equal(usdcMintAmount);
      //確保 Singer2 有mint出 1,000 cUNI
      expect(singer2cUNIBalance).to.equal(uniMintAmount);

      // Singer2 抵押 1000 UNI 借 5000顆 USDC
      await cUSDCDeploy.connect(accounts[1]).borrow(ethers.utils.parseUnits("5000", 6));
      
      singer2USDCBalance = await usdc.balanceOf(accounts[1].address);
      //確保 Singer2 有借出 5,000 USDC
      expect(singer2USDCBalance).to.equal(uniMintAmount);

       //重設UNI價格 從10調整為$6.2
      await oracleDeploy.setUnderlyingPrice(cUNIDeploy.address,ethers.utils.parseUnits("6.2", 18));
   
      //先設定 被清算人地址
      await FlashLoanDeploy.setPoorGuy(accounts[1].address);
      //將 需要借多少顆 usdc傳進去 flashloan contract，並執行flash loan & liquidity borrow
      await FlashLoanDeploy.requestFlashLoan(usdc.address,ethers.utils.parseUnits("2500", 6));
     
    });

  });
});