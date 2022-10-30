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
    // 部署 ERC20 Token : A Token
    async function deployERC20() {
      //在local部署合約
      const ERC20 = await hre.ethers.getContractFactory("MyToken");
      //等待部署
      const ERC20Deploy = await ERC20.deploy();
      //部署完成後，將合約物件回傳，等待邏輯測試
      await ERC20Deploy.deployed();
      return { ERC20Deploy };
    }
    // 部署 ERC20 Token : B Token
    async function deployAnotherERC20() {
      //在local部署合約
      const anotherERC20 = await hre.ethers.getContractFactory("MyToken2");
      //等待部署
      const anotherERC20Deploy = await anotherERC20.deploy();
      //部署完成後，將合約物件回傳，等待邏輯測試
      await anotherERC20Deploy.deployed();
      return { anotherERC20Deploy };
    }
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

    async function deployAllModel() {

      const [owner] = await ethers.getSigners();

      const { ERC20Deploy } = await loadFixture(deployERC20);
      
      const { anotherERC20Deploy} = await loadFixture(deployAnotherERC20);

      const { comptrollerDeploy } = await loadFixture(deployComptroller);

      const { irModelDeploy } = await loadFixture(deployInterestRateModel);

      const { oracleDeploy} = await loadFixture(deployOracle);

      //單純使用CErc20Immutalbe
      const CERC20 = await hre.ethers.getContractFactory("CErc20Immutable");

      // ethers.utils.parseUnits("1",18) 這表示設定成 A token 和 cA token 是 1:1
      const CERC20Deploy = await CERC20.deploy(
        ERC20Deploy.address,
        comptrollerDeploy.address,
        irModelDeploy.address,
        ethers.utils.parseUnits("1",18),//
        "cHulkToken",
        "cHulk",
        18,
        owner.address
      );

      const anotherCERC20Deploy = await CERC20.deploy(
        anotherERC20Deploy.address,
        comptrollerDeploy.address,
        irModelDeploy.address,
        ethers.utils.parseUnits("1",18),//
        "cHulkToken2",
        "cHulk2",
        18,
        owner.address
      );

      //部署完成後，將合約物件回傳，等待邏輯測試
      await CERC20Deploy.deployed();   
      await anotherCERC20Deploy.deployed();
      return { CERC20Deploy, anotherCERC20Deploy, ERC20Deploy, anotherERC20Deploy, comptrollerDeploy, oracleDeploy};
    }

    // 第二題 mint / redeem
    it("fails when mint/redeem not work", async () => {

      const { CERC20Deploy,ERC20Deploy ,comptrollerDeploy, oracleModel} = await loadFixture(deployAllModel);
      const [owner] = await ethers.getSigners();
      
      const MINT_AMOUNT = 100n * DECIMAL;

      await ERC20Deploy.approve(CERC20Deploy.address,MINT_AMOUNT);

      await comptrollerDeploy._supportMarket(CERC20Deploy.address);

      await CERC20Deploy.mint(MINT_AMOUNT);

      const cerc20Erc20Balance = await ERC20Deploy.balanceOf(CERC20Deploy.address);
      const adminCErc20Balance = await CERC20Deploy.balanceOf(owner.address);
		
      // 檢查 mint完後 cToken 的 A Token balance有沒有增加
			expect(cerc20Erc20Balance).to.equal(MINT_AMOUNT);
      // 檢查 mint完後 admin cToken 餘額 有沒有 跟 mint amount一樣
			expect(adminCErc20Balance).to.equal(MINT_AMOUNT);

      await CERC20Deploy.redeem(MINT_AMOUNT);

      // 檢查 redeem完後 cToken 的 A Token balance有沒有 歸零
      const newCerc20Erc20Balance = await ERC20Deploy.balanceOf(CERC20Deploy.address);
      // 檢查 redeem完後 admin cToken 餘額 有沒有 歸零
      const newAdminCErc20Balance = await CERC20Deploy.balanceOf(owner.address);

      expect(newCerc20Erc20Balance).to.equal(0);
      expect(newAdminCErc20Balance).to.equal(0);
      
      console.log("mint erc20 succes");
    });

    // 第三題 borrow / repay
    it("fails when borrow/repay not work ", async () => {

      const { CERC20Deploy, anotherCERC20Deploy, ERC20Deploy , anotherERC20Deploy,comptrollerDeploy, oracleDeploy} = await loadFixture(deployAllModel);

      const [owner, singer1] = await ethers.getSigners();

      const MINT_AMOUNT = 1000n * DECIMAL;
    
      const COLLATERAL_FACTOR = ethers.utils.parseUnits("0.5", 18);
      
      //第一種ERC20 Token mint
      await ERC20Deploy.approve(CERC20Deploy.address,MINT_AMOUNT);

      await comptrollerDeploy._supportMarket(CERC20Deploy.address);
      //由owner先放一些AToken 進池子裡
      await CERC20Deploy.mint(MINT_AMOUNT);
      
      //第二種ERC20 Token mint
      await anotherERC20Deploy.approve(anotherCERC20Deploy.address,MINT_AMOUNT);
      await comptrollerDeploy._supportMarket(anotherCERC20Deploy.address);
      //由owner先放一些BToken 進池子裡
      await anotherCERC20Deploy.mint(MINT_AMOUNT);

      // 設定 A Token 價格為 1
      await oracleDeploy.setUnderlyingPrice(CERC20Deploy.address,ethers.utils.parseUnits("1", 18))
      // 設定 B Token 價格為 100
      await oracleDeploy.setUnderlyingPrice(anotherCERC20Deploy.address,ethers.utils.parseUnits("100", 18))
      // comptroller要正常運作需要設定 oracle 以及 colleateral factor
      await comptrollerDeploy._setPriceOracle(oracleDeploy.address);
      await comptrollerDeploy._setCollateralFactor(anotherCERC20Deploy.address, COLLATERAL_FACTOR );
      // 接下來要讓 owner 以及 signer1 分別執行 enterMarkets
      // 要不然在comptroller 裡面的 accountAssets參數 會找不到 owner / signer1 
      // 而導致後續的 borrow 出現 流動性不足錯誤
      await comptrollerDeploy.enterMarkets([CERC20Deploy.address,anotherCERC20Deploy.address]);
      await comptrollerDeploy.connect(singer1).enterMarkets([CERC20Deploy.address,anotherCERC20Deploy.address]);

      // 由 owner 轉 B Token 給 singer1
      await anotherERC20Deploy.transfer(singer1.address, ethers.utils.parseUnits("1", 18));
      
      await anotherERC20Deploy.connect(singer1).approve(anotherCERC20Deploy.address, ethers.utils.parseUnits("1", 18));
      // singer1 mint cB Token 當作等會要借 A Token 的抵押品
      await anotherCERC20Deploy.connect(singer1).mint(1n * DECIMAL);
      // singer1 借 50 A Token出來
      await CERC20Deploy.connect(singer1).borrow(ethers.utils.parseUnits("50", 18));

      //最後檢查 singer1是不是真的借出 50顆
      const signer1BorrowBalance = await ERC20Deploy.balanceOf(singer1.address);
      expect(signer1BorrowBalance).to.equal(ethers.utils.parseUnits("50", 18));
    });
  });
});