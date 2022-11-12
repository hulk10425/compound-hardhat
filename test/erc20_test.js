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

    async function deploySixNeedModel() {
      // uni = await ethers.getContractAt("EIP20Interface","0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984");
      // usdc = await ethers.getContractAt("EIP20Interface","0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
      LendingPoolAddressesProvider = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5";

      const accounts = await ethers.getSigners();

      const { comptrollerDeploy } = await loadFixture(deployComptroller);

      const { irModelDeploy } = await loadFixture(deployInterestRateModel);

      const { oracleDeploy} = await loadFixture(deployOracle);

      //單純使用CErc20Immutalbe
      const CERC20 = await hre.ethers.getContractFactory("CErc20Immutable");

      const FlashLoan = await hre.ethers.getContractFactory("FlashLoan");

      // ethers.utils.parseUnits("1",18) 這表示設定成 A token 和 cA token 是 1:1
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
        ethers.utils.parseUnits("1",18),// exchange rate
        "cUSDCToken",
        "cUSDC",
        6,
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

    // 第四題 調整A的 collateral factor， 讓User1 被 User2 清算
    // 為了計算方便 已事先將 protocolSeizeShareMantissa設為 0，表示compound本身不會拿任何reserve
    // it("fails when lidquity part1 not work ", async () => {

    //   const { CERC20Deploy, anotherCERC20Deploy, ERC20Deploy , anotherERC20Deploy,comptrollerDeploy, oracleDeploy} = await loadFixture(deployAllModel);

    //   const [owner, ...singer] = await ethers.getSigners();

    //   const MINT_AMOUNT = 1000n * DECIMAL;
    
    //   const COLLATERAL_FACTOR = ethers.utils.parseUnits("0.5", 18);

    //   const NEW_COLLATERAL_FACTOR = ethers.utils.parseUnits("0.3", 18);
      
    //   //第一種ERC20 Token mint
    //   await ERC20Deploy.approve(CERC20Deploy.address,MINT_AMOUNT);

    //   await comptrollerDeploy._supportMarket(CERC20Deploy.address);
    //   //由owner先放一些AToken 進池子裡
    //   await CERC20Deploy.mint(MINT_AMOUNT);
      
    //   //第二種ERC20 Token mint
    //   await anotherERC20Deploy.approve(anotherCERC20Deploy.address,MINT_AMOUNT);
    //   await comptrollerDeploy._supportMarket(anotherCERC20Deploy.address);
    //   //由owner先放一些BToken 進池子裡
    //   await anotherCERC20Deploy.mint(MINT_AMOUNT);

    //   // 設定 A Token 價格為 1
    //   await oracleDeploy.setUnderlyingPrice(CERC20Deploy.address,ethers.utils.parseUnits("1", 18))
    //   // 設定 B Token 價格為 100
    //   await oracleDeploy.setUnderlyingPrice(anotherCERC20Deploy.address,ethers.utils.parseUnits("100", 18))
    //   // comptroller要正常運作需要設定 oracle 以及 colleateral factor
    //   await comptrollerDeploy._setPriceOracle(oracleDeploy.address);
    //   await comptrollerDeploy._setCollateralFactor(anotherCERC20Deploy.address, COLLATERAL_FACTOR );
    //   // 接下來要讓 owner 以及 signer1 分別執行 enterMarkets
    //   // 要不然在comptroller 裡面的 accountAssets參數 會找不到 owner / signer1 
    //   // 而導致後續的 borrow 出現 流動性不足錯誤
    //   await comptrollerDeploy.enterMarkets([CERC20Deploy.address,anotherCERC20Deploy.address]);
    //   await comptrollerDeploy.connect(singer[0]).enterMarkets([CERC20Deploy.address,anotherCERC20Deploy.address]);
    //   await comptrollerDeploy.connect(singer[1]).enterMarkets([CERC20Deploy.address,anotherCERC20Deploy.address]);

    //   // 由 owner 轉 B Token 給 singer1
    //   await anotherERC20Deploy.transfer(singer[0].address, ethers.utils.parseUnits("1", 18));
    //   // 由 owner 轉 A Token 給 singer2
    //   await ERC20Deploy.transfer(singer[1].address, ethers.utils.parseUnits("200", 18));

    //   await anotherERC20Deploy.connect(singer[0]).approve(anotherCERC20Deploy.address, ethers.utils.parseUnits("1", 18));
    //   // singer1 mint cB Token 當作等會要借 A Token 的抵押品
    //   await anotherCERC20Deploy.connect(singer[0]).mint(1n * DECIMAL);
    //   // singer1 借 50 A Token出來
    //   await CERC20Deploy.connect(singer[0]).borrow(ethers.utils.parseUnits("50", 18));

    //   // 重設抵押率，從50% --> 30%
    //   await comptrollerDeploy._setCollateralFactor(anotherCERC20Deploy.address,NEW_COLLATERAL_FACTOR);

    //   // 設定 代償比率
    //   // 預設最低是 5%
    //   // closeFactorMinMantissa = 0.05e18; // 0.05
    //   // 預設最高是 90%
    //   // closeFactorMaxMantissa = 0.9e18; // 0.9
    //   // 設定代償比率為 50%
    //   await comptrollerDeploy._setCloseFactor(ethers.utils.parseUnits("0.5", 18))

    //   // 設定清算人的激勵費 10%
    //   // 沒有預設值
    //   await comptrollerDeploy._setLiquidationIncentive(ethers.utils.parseUnits("1.1", 18))

    //   await ERC20Deploy.connect(singer[1]).approve(CERC20Deploy.address, ethers.utils.parseUnits("100", 18));

      
    //   // singer2 幫 singer1 還一半
    //   // cTokenColleateral  cB Token --> 清算人決定要哪種 被清算人獎勵
    //   await CERC20Deploy.connect(singer[1]).liquidateBorrow(
    //     singer[0].address,
    //     ethers.utils.parseUnits("25", 18),
    //     anotherCERC20Deploy.address
    //   )

    //   // user2 原本有 200A 幫 user1還 25A後，應該只剩 175A
    //   const singer2ATokenBalance = await ERC20Deploy.balanceOf(singer[1].address);
    //   expect(singer2ATokenBalance).to.equal(ethers.utils.parseUnits("175", 18));

    //   // user2 代還款後，會取得0.275個cBToken
    //   const singer2cBTokenBalance = await anotherCERC20Deploy.balanceOf(singer[1].address);
    //   expect(singer2cBTokenBalance).to.equal(ethers.utils.parseUnits("0.275", 18));


    // });

    // 第五題 調整 oracle 中的 token B 的價格 讓User1 被 User2 清算
    // 為了計算方便 已事先將 protocolSeizeShareMantissa設為 0，表示compound本身不會拿任何reserve
    // it("fails when lidquity part2 not work ", async () => {

    //   const { CERC20Deploy, anotherCERC20Deploy, ERC20Deploy , anotherERC20Deploy,comptrollerDeploy, oracleDeploy} = await loadFixture(deployAllModel);

    //   const [owner, ...singer] = await ethers.getSigners();

    //   const MINT_AMOUNT = 1000n * DECIMAL;
    
    //   const COLLATERAL_FACTOR = ethers.utils.parseUnits("0.5", 18);
  
    //   //第一種ERC20 Token mint
    //   await ERC20Deploy.approve(CERC20Deploy.address,MINT_AMOUNT);

    //   await comptrollerDeploy._supportMarket(CERC20Deploy.address);
    //   //由owner先放一些AToken 進池子裡
    //   await CERC20Deploy.mint(MINT_AMOUNT);
      
    //   //第二種ERC20 Token mint
    //   await anotherERC20Deploy.approve(anotherCERC20Deploy.address,MINT_AMOUNT);
    //   await comptrollerDeploy._supportMarket(anotherCERC20Deploy.address);
    //   //由owner先放一些BToken 進池子裡
    //   await anotherCERC20Deploy.mint(MINT_AMOUNT);

    //   // 設定 A Token 價格為 1
    //   await oracleDeploy.setUnderlyingPrice(CERC20Deploy.address,ethers.utils.parseUnits("1", 18))
    //   // 設定 B Token 價格為 100
    //   await oracleDeploy.setUnderlyingPrice(anotherCERC20Deploy.address,ethers.utils.parseUnits("100", 18))
    //   // comptroller要正常運作需要設定 oracle 以及 colleateral factor
    //   await comptrollerDeploy._setPriceOracle(oracleDeploy.address);
    //   await comptrollerDeploy._setCollateralFactor(anotherCERC20Deploy.address, COLLATERAL_FACTOR );
    //   // 接下來要讓 owner 以及 signer1 分別執行 enterMarkets
    //   // 要不然在comptroller 裡面的 accountAssets參數 會找不到 owner / signer1 
    //   // 而導致後續的 borrow 出現 流動性不足錯誤
    //   await comptrollerDeploy.enterMarkets([CERC20Deploy.address,anotherCERC20Deploy.address]);
    //   await comptrollerDeploy.connect(singer[0]).enterMarkets([CERC20Deploy.address,anotherCERC20Deploy.address]);
    //   await comptrollerDeploy.connect(singer[1]).enterMarkets([CERC20Deploy.address,anotherCERC20Deploy.address]);

    //   // 由 owner 轉 B Token 給 singer1
    //   await anotherERC20Deploy.transfer(singer[0].address, ethers.utils.parseUnits("1", 18));
    //   // 由 owner 轉 A Token 給 singer2
    //   await ERC20Deploy.transfer(singer[1].address, ethers.utils.parseUnits("200", 18));

    //   await anotherERC20Deploy.connect(singer[0]).approve(anotherCERC20Deploy.address, ethers.utils.parseUnits("1", 18));
    //   // singer1 mint cB Token 當作等會要借 A Token 的抵押品
    //   await anotherCERC20Deploy.connect(singer[0]).mint(1n * DECIMAL);
    //   // singer1 借 50 A Token出來
    //   await CERC20Deploy.connect(singer[0]).borrow(ethers.utils.parseUnits("50", 18));

    //   // 重設TokenB 價格 從100調整為50
    //   await oracleDeploy.setUnderlyingPrice(anotherCERC20Deploy.address,ethers.utils.parseUnits("50", 18))
    //   // 設定 代償比率
    //   // 預設最低是 5%
    //   // closeFactorMinMantissa = 0.05e18; // 0.05
    //   // 預設最高是 90%
    //   // closeFactorMaxMantissa = 0.9e18; // 0.9
    //   // 設定代償比率為 50%
    //   await comptrollerDeploy._setCloseFactor(ethers.utils.parseUnits("0.5", 18))

    //   // 設定清算人的激勵費 10%
    //   // 沒有預設值
    //   await comptrollerDeploy._setLiquidationIncentive(ethers.utils.parseUnits("1.1", 18))

    //   await ERC20Deploy.connect(singer[1]).approve(CERC20Deploy.address, ethers.utils.parseUnits("100", 18));

      
    //   // singer2 幫 singer1 還一半
    //   // cTokenColleateral  cB Token --> 清算人決定要哪種 被清算人獎勵
    //   await CERC20Deploy.connect(singer[1]).liquidateBorrow(
    //     singer[0].address,
    //     ethers.utils.parseUnits("25", 18),
    //     anotherCERC20Deploy.address
    //   )


    //   // user2 原本有 200A 幫 user1還 25A後，應該只剩 175A
    //   const singer2ATokenBalance = await ERC20Deploy.balanceOf(singer[1].address);
    //   expect(singer2ATokenBalance).to.equal(ethers.utils.parseUnits("175", 18));


    //   // user2 代還款後，會取得0.55個cBToken
    //   const singer2cBTokenBalance = await anotherCERC20Deploy.balanceOf(singer[1].address);
    //   expect(singer2cBTokenBalance).to.equal(ethers.utils.parseUnits("0.55", 18));


    // });

    // 第六題
    it("six", async () => {

      let usdcTransferAmount = ethers.utils.parseUnits("60000", 6);
      let uniTransferAmount = ethers.utils.parseUnits("2000", 18);
      let usdcMintAmount = ethers.utils.parseUnits("50000", 6);
      let uniMintAmount = ethers.utils.parseUnits("1000", 18);

      let uniContractAddress = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
      let usdcContractAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      const {accounts, FlashLoanDeploy,cUNIDeploy, cUSDCDeploy, comptrollerDeploy, oracleDeploy} = await loadFixture(deploySixNeedModel);
      uni = await ethers.getContractAt("EIP20Interface",uniContractAddress); //直接拿鏈上有的合約是這樣寫
      usdc = await ethers.getContractAt("EIP20Interface",usdcContractAddress);
      

      const impersonatedSignerUNI = await ethers.getImpersonatedSigner("0x33Ddd548FE3a082d753E5fE721a26E1Ab43e3598");
      const impersonatedSignerUSDC = await ethers.getImpersonatedSigner("0xAe2D4617c862309A3d75A0fFB358c7a5009c673F");

      await usdc.connect(impersonatedSignerUSDC).transfer(accounts[0].address,usdcTransferAmount);
      let usdcBalanceOfSinger1 = await usdc.balanceOf(accounts[0].address);

      await uni.connect(impersonatedSignerUNI).transfer(accounts[1].address,uniTransferAmount);
      let uniBalanceOfSinger2 = await uni.balanceOf(accounts[1].address);

      //先匯個100美進去，給清算合約當作 還flashloan的手續費
      await usdc.transfer(FlashLoanDeploy.address, ethers.utils.parseUnits("100", 6));
      
      // console.log("usdcBalanceOfSinger1");
      // console.log(usdcBalanceOfSinger1);

      // console.log("uniBalanceOfSinger2");
      // console.log(uniBalanceOfSinger2);

      const COLLATERAL_FACTOR = ethers.utils.parseUnits("0.5", 18);
      const CLOSE_FACTOR = ethers.utils.parseUnits("0.5", 18);
      const INCENTIVE_FACTOR =  ethers.utils.parseUnits("1.1", 18);

      await comptrollerDeploy._supportMarket(cUNIDeploy.address);
      await comptrollerDeploy._supportMarket(cUSDCDeploy.address);

      // 接下來要讓 owner 以及 signer1 分別執行 enterMarkets
      // 要不然在comptroller 裡面的 accountAssets參數 會找不到 owner / signer1 
      // 而導致後續的 borrow 出現 流動性不足錯誤
      await comptrollerDeploy.enterMarkets([cUSDCDeploy.address,cUNIDeploy.address]);
      await comptrollerDeploy.connect(accounts[0]).enterMarkets([cUSDCDeploy.address,cUNIDeploy.address]);
      await comptrollerDeploy.connect(accounts[1]).enterMarkets([cUSDCDeploy.address,cUNIDeploy.address]);
      
      // 設定 UNI Token 價格為 10
      await oracleDeploy.setUnderlyingPrice(cUNIDeploy.address,ethers.utils.parseUnits("10", 18))
      // 設定 USDC Token 價格為 1
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

      //  Singer1 創造cUSDC池 mint 50000顆 cUSDC 以及 Singer2 創造cUNI池 mint 2000顆

      //由Singer1先mint usdc 進池子裡
      await usdc.approve(cUSDCDeploy.address, usdcMintAmount);
      await cUSDCDeploy.mint(usdcMintAmount);

      // 由Singer2 mint uni 進池子裡
      await uni.connect(accounts[1]).approve(cUNIDeploy.address, uniMintAmount);
      await cUNIDeploy.connect(accounts[1]).mint(uniMintAmount);
      
      
      singer1cUSDCBalance =  await cUSDCDeploy.balanceOf(accounts[0].address);
      singer2cUNIBalance =  await cUNIDeploy.balanceOf(accounts[1].address);

      // console.log("singer1cUSDCBalance");
      // console.log(singer1cUSDCBalance);

      // console.log("singer2cUNIBalance");
      // console.log(singer2cUNIBalance);

      // Singer2 抵押 1000 UNI 借 5000顆 USDC
      await cUSDCDeploy.connect(accounts[1]).borrow(ethers.utils.parseUnits("5000", 6));
      
      singer2USDCBalance = await usdc.balanceOf(accounts[1].address);
      console.log("singer2USDCBalance");
      console.log(singer2USDCBalance);
       //重設UNI價格 從10調整為$6.2
      await oracleDeploy.setUnderlyingPrice(cUNIDeploy.address,ethers.utils.parseUnits("6.2", 18));
      //開始用flash loan借錢
      //要將 cUNI 及 cUSDC 地址傳進去
      await FlashLoanDeploy.setPoorGuy(accounts[1].address);
      await FlashLoanDeploy.requestFlashLoan(usdc.address,ethers.utils.parseUnits("2500", 6));
     
      // 將 UNI價格調整為 6.2 ， Singer2 成為被清算人
      // Signer1 執行AAve flash loan 借USDC後 償還 Singer2借的 2500USDC（假設 Close Factor是 50%）
      // 償還完後，Signer1 取得 cUNI後，接下來 redeem 回 UNI
      // Singer1 到uniswap 上 將UNI換成USDC
      // Singer1 償還 在Aave上面借的USDC + premium
      // 照理說會有剩餘，這時就完成套利囉

      // const { CERC20Deploy, anotherCERC20Deploy, ERC20Deploy , anotherERC20Deploy,comptrollerDeploy, oracleDeploy} = await loadFixture(deployAllModel);

      // const [owner, ...singer] = await ethers.getSigners();

      // const MINT_AMOUNT = 1000n * DECIMAL;
    
      // const COLLATERAL_FACTOR = ethers.utils.parseUnits("0.5", 18);
  
      // //第一種ERC20 Token mint
      // await ERC20Deploy.approve(CERC20Deploy.address,MINT_AMOUNT);

      // await comptrollerDeploy._supportMarket(CERC20Deploy.address);
      // //由owner先放一些AToken 進池子裡
      // await CERC20Deploy.mint(MINT_AMOUNT);
      
      // //第二種ERC20 Token mint
      // await anotherERC20Deploy.approve(anotherCERC20Deploy.address,MINT_AMOUNT);
      // await comptrollerDeploy._supportMarket(anotherCERC20Deploy.address);
      // //由owner先放一些BToken 進池子裡
      // await anotherCERC20Deploy.mint(MINT_AMOUNT);

      // // 設定 A Token 價格為 1
      // await oracleDeploy.setUnderlyingPrice(CERC20Deploy.address,ethers.utils.parseUnits("1", 18))
      // // 設定 B Token 價格為 100
      // await oracleDeploy.setUnderlyingPrice(anotherCERC20Deploy.address,ethers.utils.parseUnits("100", 18))
      // // comptroller要正常運作需要設定 oracle 以及 colleateral factor
      // await comptrollerDeploy._setPriceOracle(oracleDeploy.address);
      // await comptrollerDeploy._setCollateralFactor(anotherCERC20Deploy.address, COLLATERAL_FACTOR );
      // // 接下來要讓 owner 以及 signer1 分別執行 enterMarkets
      // // 要不然在comptroller 裡面的 accountAssets參數 會找不到 owner / signer1 
      // // 而導致後續的 borrow 出現 流動性不足錯誤
      // await comptrollerDeploy.enterMarkets([CERC20Deploy.address,anotherCERC20Deploy.address]);
      // await comptrollerDeploy.connect(singer[0]).enterMarkets([CERC20Deploy.address,anotherCERC20Deploy.address]);
      // await comptrollerDeploy.connect(singer[1]).enterMarkets([CERC20Deploy.address,anotherCERC20Deploy.address]);

      // // 由 owner 轉 B Token 給 singer1
      // await anotherERC20Deploy.transfer(singer[0].address, ethers.utils.parseUnits("1", 18));
      // // 由 owner 轉 A Token 給 singer2
      // await ERC20Deploy.transfer(singer[1].address, ethers.utils.parseUnits("200", 18));

      // await anotherERC20Deploy.connect(singer[0]).approve(anotherCERC20Deploy.address, ethers.utils.parseUnits("1", 18));
      // // singer1 mint cB Token 當作等會要借 A Token 的抵押品
      // await anotherCERC20Deploy.connect(singer[0]).mint(1n * DECIMAL);
      // // singer1 借 50 A Token出來
      // await CERC20Deploy.connect(singer[0]).borrow(ethers.utils.parseUnits("50", 18));

      // // 重設TokenB 價格 從100調整為50
      // await oracleDeploy.setUnderlyingPrice(anotherCERC20Deploy.address,ethers.utils.parseUnits("50", 18))
      // // 設定 代償比率
      // // 預設最低是 5%
      // // closeFactorMinMantissa = 0.05e18; // 0.05
      // // 預設最高是 90%
      // // closeFactorMaxMantissa = 0.9e18; // 0.9
      // // 設定代償比率為 50%
      // await comptrollerDeploy._setCloseFactor(ethers.utils.parseUnits("0.5", 18))

      // // 設定清算人的激勵費 10%
      // // 沒有預設值
      // await comptrollerDeploy._setLiquidationIncentive(ethers.utils.parseUnits("1.1", 18))

      // await ERC20Deploy.connect(singer[1]).approve(CERC20Deploy.address, ethers.utils.parseUnits("100", 18));

      
      // // singer2 幫 singer1 還一半
      // // cTokenColleateral  cB Token --> 清算人決定要哪種 被清算人獎勵
      // await CERC20Deploy.connect(singer[1]).liquidateBorrow(
      //   singer[0].address,
      //   ethers.utils.parseUnits("25", 18),
      //   anotherCERC20Deploy.address
      // )


      // // user2 原本有 200A 幫 user1還 25A後，應該只剩 175A
      // const singer2ATokenBalance = await ERC20Deploy.balanceOf(singer[1].address);
      // expect(singer2ATokenBalance).to.equal(ethers.utils.parseUnits("175", 18));


      // // user2 代還款後，會取得0.55個cBToken
      // const singer2cBTokenBalance = await anotherCERC20Deploy.balanceOf(singer[1].address);
      // expect(singer2cBTokenBalance).to.equal(ethers.utils.parseUnits("0.55", 18));


    });

  });
});