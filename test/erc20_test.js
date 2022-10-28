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
// const {ethers,upgrades} = require("hardhat");

const DECIMAL = 10n ** 18n;

describe('CToken', function () {

  describe('constructor', () => {

    async function deployERC20() {
      //在local部署合約
      const ERC20 = await hre.ethers.getContractFactory("MyToken");
      //等待部署
      const ERC20Deploy = await ERC20.deploy();
      //部署完成後，將合約物件回傳，等待邏輯測試
      await ERC20Deploy.deployed();
      return { ERC20Deploy };
    }

    async function deployComptroller() {
      const comptroller = await hre.ethers.getContractFactory("Comptroller");
      const comptrollerDeploy = await comptroller.deploy();
      await comptrollerDeploy.deployed();
      return { comptrollerDeploy };
    }
    //用最簡單的WhitePaper 
    async function deployInterestRateModel() {
      const irModel = await hre.ethers.getContractFactory("WhitePaperInterestRateModel");
      const irModelDeploy = await irModel.deploy(
        0,0
      );
      await irModelDeploy.deployed();
      return { irModelDeploy };
    }

    async function deployCERC20() {
      // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      // 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
      
      const adminAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

      const { ERC20Deploy } = await loadFixture(deployERC20);

      const { comptrollerDeploy } = await loadFixture(deployComptroller);

      const { irModelDeploy } = await loadFixture(deployInterestRateModel);

      //單純使用CErc20Immutalbe
      const CERC20 = await hre.ethers.getContractFactory("CErc20Immutable");

      const CERC20Deploy = await CERC20.deploy(
        ERC20Deploy.address,
        comptrollerDeploy.address,
        irModelDeploy.address,
        ethers.utils.parseUnits("1",18),//
        "cHulkToken",
        "cHulk",
        18,
        adminAddress
      );

      //部署完成後，將合約物件回傳，等待邏輯測試
      await CERC20Deploy.deployed();   
      return { CERC20Deploy, ERC20Deploy, comptrollerDeploy };
    }


    it("fails when cant mint cerc20 ", async () => {

      const { CERC20Deploy,ERC20Deploy ,comptrollerDeploy} = await loadFixture(deployCERC20);

      const adminAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

      const MINT_AMOUNT = 100n * DECIMAL;

      await ERC20Deploy.approve(CERC20Deploy.address,MINT_AMOUNT);

      await comptrollerDeploy._supportMarket(CERC20Deploy.address);

      await CERC20Deploy.mint(MINT_AMOUNT);

      const adminErc20Balance = await ERC20Deploy.balanceOf(adminAddress);
      const cerc20Erc20Balance = await ERC20Deploy.balanceOf(CERC20Deploy.address);
      const adminCErc20Balance = await CERC20Deploy.balanceOf(adminAddress);
		
      console.log("adminErc20Balance:" + adminErc20Balance);
      console.log("cerc20Erc20Balance:" + cerc20Erc20Balance);
      console.log("adminCErc20Balance:" + adminCErc20Balance);

			expect(cerc20Erc20Balance).to.equal(MINT_AMOUNT);
			expect(adminCErc20Balance).to.equal(MINT_AMOUNT);

      await CERC20Deploy.redeem(MINT_AMOUNT);

      const newAdminErc20Balance = await ERC20Deploy.balanceOf(adminAddress);
      const newCerc20Erc20Balance = await ERC20Deploy.balanceOf(CERC20Deploy.address);
      const newAdminCErc20Balance = await CERC20Deploy.balanceOf(adminAddress);

      console.log("adminErc20Balance:" + newAdminErc20Balance);
      console.log("cerc20Erc20Balance:" + newCerc20Erc20Balance);
      console.log("adminCErc20Balance:" + newAdminCErc20Balance);
      
      
      console.log("mint erc20 succes");
    });


    // it("fails when mint 100 erc20 token", async () => {
     


    //   const { CERC20Deploy } = await loadFixture(deployCERC20);

    //   console.log("CERC20 deploy succes");
    // });




    // it("fails when 0 initial exchange rate", async () => {
    //   await expect(makeCToken({ exchangeRate: 0 })).rejects.toRevert("revert initial exchange rate must be greater than zero.");
    // });

    // it("succeeds with erc-20 underlying and non-zero exchange rate", async () => {
    //   const cToken = await makeCToken();
    //   expect(await call(cToken, 'underlying')).toEqual(cToken.underlying._address);
    //   expect(await call(cToken, 'admin')).toEqual(root);
    // });

    // it("succeeds when setting admin to contructor argument", async () => {
    //   const cToken = await makeCToken({ admin: admin });
    //   expect(await call(cToken, 'admin')).toEqual(admin);
    // });
  });

  // describe('name, symbol, decimals', () => {
  //   let cToken;

  //   beforeEach(async () => {
  //     cToken = await makeCToken({ name: "CToken Foo", symbol: "cFOO", decimals: 10 });
  //   });

  //   it('should return correct name', async () => {
  //     expect(await call(cToken, 'name')).toEqual("CToken Foo");
  //   });

  //   it('should return correct symbol', async () => {
  //     expect(await call(cToken, 'symbol')).toEqual("cFOO");
  //   });

  //   it('should return correct decimals', async () => {
  //     expect(await call(cToken, 'decimals')).toEqualNumber(10);
  //   });
  // });

  // describe('balanceOfUnderlying', () => {
  //   it("has an underlying balance", async () => {
  //     const cToken = await makeCToken({ supportMarket: true, exchangeRate: 2 });
  //     await send(cToken, 'harnessSetBalance', [root, 100]);
  //     expect(await call(cToken, 'balanceOfUnderlying', [root])).toEqualNumber(200);
  //   });
  // });

  // describe('borrowRatePerBlock', () => {
  //   it("has a borrow rate", async () => {
  //     const cToken = await makeCToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate: .05, multiplier: 0.45, kink: 0.95, jump: 5 } });
  //     const perBlock = await call(cToken, 'borrowRatePerBlock');
  //     expect(Math.abs(perBlock * 2102400 - 5e16)).toBeLessThanOrEqual(1e8);
  //   });
  // });

  // describe('supplyRatePerBlock', () => {
  //   it("returns 0 if there's no supply", async () => {
  //     const cToken = await makeCToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate: .05, multiplier: 0.45, kink: 0.95, jump: 5 } });
  //     const perBlock = await call(cToken, 'supplyRatePerBlock');
  //     await expect(perBlock).toEqualNumber(0);
  //   });

  //   it("has a supply rate", async () => {
  //     const baseRate = 0.05;
  //     const multiplier = 0.45;
  //     const kink = 0.95;
  //     const jump = 5 * multiplier;
  //     const cToken = await makeCToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate, multiplier, kink, jump } });
  //     await send(cToken, 'harnessSetReserveFactorFresh', [etherMantissa(.01)]);
  //     await send(cToken, 'harnessExchangeRateDetails', [1, 1, 0]);
  //     await send(cToken, 'harnessSetExchangeRate', [etherMantissa(1)]);
  //     // Full utilization (Over the kink so jump is included), 1% reserves
  //     const borrowRate = baseRate + multiplier * kink + jump * .05;
  //     const expectedSuplyRate = borrowRate * .99;

  //     const perBlock = await call(cToken, 'supplyRatePerBlock');
  //     expect(Math.abs(perBlock * 2102400 - expectedSuplyRate * 1e18)).toBeLessThanOrEqual(1e8);
  //   });
  // });

  // describe("borrowBalanceCurrent", () => {
  //   let borrower;
  //   let cToken;

  //   beforeEach(async () => {
  //     borrower = accounts[0];
  //     cToken = await makeCToken();
  //   });

  //   beforeEach(async () => {
  //     await setBorrowRate(cToken, .001)
  //     await send(cToken.interestRateModel, 'setFailBorrowRate', [false]);
  //   });

  //   it("reverts if interest accrual fails", async () => {
  //     await send(cToken.interestRateModel, 'setFailBorrowRate', [true]);
  //     // make sure we accrue interest
  //     await send(cToken, 'harnessFastForward', [1]);
  //     await expect(send(cToken, 'borrowBalanceCurrent', [borrower])).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
  //   });

  //   it("returns successful result from borrowBalanceStored with no interest", async () => {
  //     await setBorrowRate(cToken, 0);
  //     await pretendBorrow(cToken, borrower, 1, 1, 5e18);
  //     expect(await call(cToken, 'borrowBalanceCurrent', [borrower])).toEqualNumber(5e18)
  //   });

  //   it("returns successful result from borrowBalanceCurrent with no interest", async () => {
  //     await setBorrowRate(cToken, 0);
  //     await pretendBorrow(cToken, borrower, 1, 3, 5e18);
  //     expect(await send(cToken, 'harnessFastForward', [5])).toSucceed();
  //     expect(await call(cToken, 'borrowBalanceCurrent', [borrower])).toEqualNumber(5e18 * 3)
  //   });
  // });

  // describe("borrowBalanceStored", () => {
  //   let borrower;
  //   let cToken;

  //   beforeEach(async () => {
  //     borrower = accounts[0];
  //     cToken = await makeCToken({ comptrollerOpts: { kind: 'bool' } });
  //   });

  //   it("returns 0 for account with no borrows", async () => {
  //     expect(await call(cToken, 'borrowBalanceStored', [borrower])).toEqualNumber(0)
  //   });

  //   it("returns stored principal when account and market indexes are the same", async () => {
  //     await pretendBorrow(cToken, borrower, 1, 1, 5e18);
  //     expect(await call(cToken, 'borrowBalanceStored', [borrower])).toEqualNumber(5e18);
  //   });

  //   it("returns calculated balance when market index is higher than account index", async () => {
  //     await pretendBorrow(cToken, borrower, 1, 3, 5e18);
  //     expect(await call(cToken, 'borrowBalanceStored', [borrower])).toEqualNumber(5e18 * 3);
  //   });

  //   it("has undefined behavior when market index is lower than account index", async () => {
  //     // The market index < account index should NEVER happen, so we don't test this case
  //   });

  //   it("reverts on overflow of principal", async () => {
  //     await pretendBorrow(cToken, borrower, 1, 3, UInt256Max());
  //     await expect(call(cToken, 'borrowBalanceStored', [borrower])).rejects.toRevert();
  //   });

  //   it("reverts on non-zero stored principal with zero account index", async () => {
  //     await pretendBorrow(cToken, borrower, 0, 3, 5);
  //     await expect(call(cToken, 'borrowBalanceStored', [borrower])).rejects.toRevert();
  //   });
  // });

  // describe('exchangeRateStored', () => {
  //   let cToken, exchangeRate = 2;

  //   beforeEach(async () => {
  //     cToken = await makeCToken({ exchangeRate });
  //   });

  //   it("returns initial exchange rate with zero cTokenSupply", async () => {
  //     const result = await call(cToken, 'exchangeRateStored');
  //     expect(result).toEqualNumber(etherMantissa(exchangeRate));
  //   });

  //   it("calculates with single cTokenSupply and single total borrow", async () => {
  //     const cTokenSupply = 1, totalBorrows = 1, totalReserves = 0;
  //     await send(cToken, 'harnessExchangeRateDetails', [cTokenSupply, totalBorrows, totalReserves]);
  //     const result = await call(cToken, 'exchangeRateStored');
  //     expect(result).toEqualNumber(etherMantissa(1));
  //   });

  //   it("calculates with cTokenSupply and total borrows", async () => {
  //     const cTokenSupply = 100e18, totalBorrows = 10e18, totalReserves = 0;
  //     await send(cToken, 'harnessExchangeRateDetails', [cTokenSupply, totalBorrows, totalReserves].map(etherUnsigned));
  //     const result = await call(cToken, 'exchangeRateStored');
  //     expect(result).toEqualNumber(etherMantissa(.1));
  //   });

  //   it("calculates with cash and cTokenSupply", async () => {
  //     const cTokenSupply = 5e18, totalBorrows = 0, totalReserves = 0;
  //     expect(
  //       await send(cToken.underlying, 'transfer', [cToken._address, etherMantissa(500)])
  //     ).toSucceed();
  //     await send(cToken, 'harnessExchangeRateDetails', [cTokenSupply, totalBorrows, totalReserves].map(etherUnsigned));
  //     const result = await call(cToken, 'exchangeRateStored');
  //     expect(result).toEqualNumber(etherMantissa(100));
  //   });

  //   it("calculates with cash, borrows, reserves and cTokenSupply", async () => {
  //     const cTokenSupply = 500e18, totalBorrows = 500e18, totalReserves = 5e18;
  //     expect(
  //       await send(cToken.underlying, 'transfer', [cToken._address, etherMantissa(500)])
  //     ).toSucceed();
  //     await send(cToken, 'harnessExchangeRateDetails', [cTokenSupply, totalBorrows, totalReserves].map(etherUnsigned));
  //     const result = await call(cToken, 'exchangeRateStored');
  //     expect(result).toEqualNumber(etherMantissa(1.99));
  //   });
  // });

  // describe('getCash', () => {
  //   it("gets the cash", async () => {
  //     const cToken = await makeCToken();
  //     const result = await call(cToken, 'getCash');
  //     expect(result).toEqualNumber(0);
  //   });
  // });
});