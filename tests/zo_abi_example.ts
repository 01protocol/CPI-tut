import * as anchor from "@project-serum/anchor";
import { BN, Idl} from "@project-serum/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  Cluster,
  Control,
  CONTROL_ACCOUNT_SIZE,
  createProgram,
  Margin,
  ZO_DEX_DEVNET_PROGRAM_ID,
  State,
  USDC_DECIMALS,
  baseNumberToLots,
  priceNumberToLots,
  ZoOpenOrders
} from "@zero_one/client";
import * as splToken from "@solana/spl-token";
import assert from "assert";

import idl = require("../target/idl/zo_abi_example.json");
import { TOKEN_PROGRAM_ID } from "@project-serum/serum/lib/token-instructions";

import fetch from "node-fetch";

const SOL_DECIMALS = 9;
const SOL_OG_FEE = 10; // bps
const SOL_LOT_SIZE = new BN(100_000_000);
const SOL_SQ_LOT_SIZE = new BN(10_000);
const USDC_SOL_LOT_SIZE = new BN(100);
const SOL_BASE_IMF = new BN(100);
const SOL_LIQ_FEE = new BN(20);
const SOL_SQUARE_SYMBOL = "SOL-SQUARE";
export const STARTING_FUNDING_INDEX = 10 ** 9;

const SETTINGS = {
  connection: "https://api.devnet.solana.com",
  zoPid: new PublicKey("Zo1ThtSHMh9tZGECwBDL81WJRL6s3QTHf733Tyko7KQ"),
  zoState: new PublicKey("KwcWW7WvgSXLJcyjKZJBHLbfriErggzYHpjS9qjVD5F"),
  usdcMint: new PublicKey("7UT1javY6X1M9R2UrPGrwcZ78SX3huaXyETff5hm5YdX"),
  solMint: new PublicKey("So11111111111111111111111111111111111111112"),
  btcMint: new PublicKey("3n3sMJMnZhgNDaxp6cfywvjHLrV1s34ndfa6xAaYvpRs"),
  programPid: new PublicKey("Eg8fBwr5N3P9HTUZsKJ5LZP3jVRgBJcrnvAcY35G5rTw"),
};

describe("zo_abi_example", () => {
  //teststate
  const ts: any = {};

  it("Fetching the Zo state stuff and creating user", async () => {
    const userAcc = Keypair.fromSecretKey(
      Buffer.from(
        JSON.parse(
          require("fs").readFileSync(process.env.USER_WALLET, {
            encoding: "utf-8",
          })
        )
      )
    );

    const provider = new anchor.Provider(
      new anchor.web3.Connection(SETTINGS.connection),
      // @ts-ignore
      new anchor.Wallet(userAcc),
      {
        preflightCommitment: "finalized",
        commitment: "finalized",
      }
    );

    ts.user = provider;

    ts.program = new anchor.Program(idl as Idl, SETTINGS.programPid, ts.user);

    console.log("user wallet: ", ts.user.wallet.publicKey.toString());

    //@ts-ignore
    ts.userUSDC = await splToken.getOrCreateAssociatedTokenAccount(
      ts.user.connection,
      ts.user.wallet.payer,
      SETTINGS.usdcMint,
      ts.user.wallet.publicKey,
    );

    console.log("user token account", ts.userUSDC.address.toString());

    ts.zoProgram = createProgram(ts.user, Cluster.Devnet);

    ts.state = await State.load(ts.zoProgram, SETTINGS.zoState);

    ts.stateUSDCVault = ts.state.getVaultCollateralByMint(SETTINGS.usdcMint)[0];
    console.log("zo program USDC vault: ", ts.stateUSDCVault.toString());
  });

  xit("Allows users to create margin from 01_exchange", async () => {
    //creating accounts needed for CreateMargin call
    const [[key, nonce], control, controlLamports] = await Promise.all([
      PublicKey.findProgramAddress(
        [
          ts.user.wallet.publicKey.toBuffer(),
          ts.state.pubkey.toBuffer(),
          Buffer.from("marginv1"),
        ],
        SETTINGS.zoPid
      ),
      Keypair.generate(),
      ts.program.provider.connection.getMinimumBalanceForRentExemption(
        CONTROL_ACCOUNT_SIZE
      ),
    ]);

    if (await ts.program.provider.connection.getAccountInfo(key)) {
      console.log("Margin account already exists");
    } else {
      //calling CreateMaergin through CPI call
      const tx = await ts.program.rpc.doCreateMargin(nonce, {
        accounts: {
          authority: ts.user.wallet.publicKey,
          zoProgramState: ts.state.pubkey,
          zoProgramMargin: key,
          zoProgram: SETTINGS.zoPid,
          control: control.publicKey,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        preInstructions: [
          SystemProgram.createAccount({
            fromPubkey: ts.user.wallet.publicKey,
            newAccountPubkey: control.publicKey,
            lamports: controlLamports,
            space: CONTROL_ACCOUNT_SIZE,
            programId: SETTINGS.zoPid,
          }),
        ],
        signers: [control],
      });
      await ts.program.provider.connection.confirmTransaction(tx, "finalized");
    }
  });

  xit("funds the token account with the faucet", async () => {

    //making a post request to call faucet for USDC
    const response = await fetch('https://devnet-faucet.01.xyz?'
    +'owner='+ts.user.wallet.publicKey.toString()
    +'&mint=7UT1javY6X1M9R2UrPGrwcZ78SX3huaXyETff5hm5YdX'
    +'&amount=1500000000'
    , {method: 'POST'});
    
    if (!response.ok) throw new Error(`unexpected response ${response.statusText}`);

  });

  it("Allows users to fetch margin account data", async () => {
    //fetching margin data
    ts.userMargin = await Margin.load(ts.zoProgram, ts.state);

    ts.userControl = await Control.load(
      ts.zoProgram,
      ts.userMargin.data.control
    );

    console.log("user Margin account: ", ts.userMargin.pubkey.toString());

    //checking that ecerything is correct
    assert.ok(ts.userMargin.data.authority.equals(ts.user.wallet.publicKey));
    assert.ok(ts.userControl.data.authority.equals(ts.user.wallet.publicKey));
    assert.equal(ts.userMargin.data.rawCollateral.length, 3);
    assert.equal(ts.userMargin.data.actualCollateral.length, 3);
    assert.ok(ts.userMargin.data.control.equals(ts.userControl.pubkey));
  });

  xit("Allows users to make a deposit USDC", async () => {
    const depositAmount = new BN(40 * 10 ** USDC_DECIMALS);
    console.log("depositing amount: ", depositAmount.toString());

    const fetchBalanceBefore = await ts.program.provider.connection.getTokenAccountBalance(ts.userUSDC.address);
    console.log("user USDC balance before deposit: ", fetchBalanceBefore.value.amount);

    await ts.userMargin.refresh();
    console.log("user Margin USDC balance before deposit: ", ts.userMargin.balances.USDC.n.toString());

    const fetchVaultBalanceBefore = await ts.program.provider.connection.getTokenAccountBalance(ts.stateUSDCVault);
    console.log("state vault USDC balance before deposit: ", fetchVaultBalanceBefore.value.amount);

    const tx = await ts.program.rpc.doDeposit(depositAmount, {
      accounts: {
        authority: ts.user.wallet.publicKey,
        zoProgramState: ts.state.pubkey,
        zoProgramMargin: ts.userMargin.pubkey,
        zoProgram: SETTINGS.zoPid,
        cache: ts.state.cache.pubkey,
        stateSigner: ts.userMargin.state.signer,
        tokenAccount: ts.userUSDC.address,
        zoProgramVault: ts.stateUSDCVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    });
    await ts.program.provider.connection.confirmTransaction(tx, "finalized");

    const fetchBalanceAfter = await ts.program.provider.connection.getTokenAccountBalance(ts.userUSDC.address);
    console.log("user USDC balance after deposit: ", fetchBalanceAfter.value.amount);

    await ts.userMargin.refresh();
    console.log("user Margin USDC balance after deposit: ", ts.userMargin.balances.USDC.n.toString());

    const fetchVaultBalanceAfter = await ts.program.provider.connection.getTokenAccountBalance(ts.stateUSDCVault);
    console.log("state vault USDC balance after deposit: ", fetchVaultBalanceAfter.value.amount);

    assert.equal(fetchBalanceAfter.value.amount-fetchBalanceBefore.value.amount, -depositAmount.toNumber());
    assert.equal(fetchVaultBalanceAfter.value.amount-fetchVaultBalanceBefore.value.amount, depositAmount.toNumber());

  });

  xit("Allows users to make a withdraw USDC", async () => {
    const withdrawAmount = new BN(20 * 10 ** USDC_DECIMALS);
    
    console.log("withdrawing amount: ", withdrawAmount.toString());

    const fetchBalanceBefore = await ts.program.provider.connection.getTokenAccountBalance(ts.userUSDC.address);
    console.log("user USDC balance before withdraw: ", fetchBalanceBefore.value.amount);

    await ts.userMargin.refresh();
    console.log("user Margin USDC balance before withdraw: ", ts.userMargin.balances.USDC.n.toString());

    const fetchVaultBalanceBefore = await ts.program.provider.connection.getTokenAccountBalance(ts.stateUSDCVault);
    console.log("state vault USDC balance before withdraw: ", fetchVaultBalanceBefore.value.amount);

    const tx = await ts.program.rpc.doWithdraw(withdrawAmount, {
      accounts: {
        authority: ts.user.wallet.publicKey,
        zoProgramState: ts.state.pubkey,
        zoProgramMargin: ts.userMargin.pubkey,
        zoProgram: SETTINGS.zoPid,
        control: ts.userMargin.control.pubkey,
        cache: ts.state.cache.pubkey,
        stateSigner: ts.userMargin.state.signer,
        tokenAccount: ts.userUSDC.address,
        zoProgramVault: ts.stateUSDCVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    });
    await ts.program.provider.connection.confirmTransaction(tx, "finalized");

    const fetchBalanceAfter = await ts.program.provider.connection.getTokenAccountBalance(ts.userUSDC.address);
    console.log("user USDC balance after withdraw: ", fetchBalanceAfter.value.amount);

    await ts.userMargin.refresh();
    console.log("user Margin USDC balance after withdraw: ", ts.userMargin.balances.USDC.n.toString());

    const fetchVaultBalanceAfter = await ts.program.provider.connection.getTokenAccountBalance(ts.stateUSDCVault);
    console.log("state vault USDC balance after withdraw: ", fetchVaultBalanceAfter.value.amount);

    assert.equal(fetchBalanceAfter.value.amount-fetchBalanceBefore.value.amount, withdrawAmount.toNumber());
    assert.equal(fetchVaultBalanceAfter.value.amount-fetchVaultBalanceBefore.value.amount, -withdrawAmount.toNumber());

  });

  xit("Allows users to make an open order account", async () => {

    const dexMarket = ts.state.getMarketKeyBySymbol("SOL-PERP");
    const [ookey, _] = await PublicKey.findProgramAddress(
      [ts.userMargin.data.control.toBuffer(), dexMarket.toBuffer()],
      ZO_DEX_DEVNET_PROGRAM_ID
    );

    if (await ts.program.provider.connection.getAccountInfo(ookey)) {
      console.log("open order account already exists");
    } else {
      const tx = await ts.program.rpc.doCreatePerpOpenOrders({
        accounts: {
          zoProgram: SETTINGS.zoPid,
          zoProgramState: ts.state.pubkey,
          stateSigner: ts.userMargin.state.signer,
          authority: ts.user.wallet.publicKey,
          zoProgramMargin: ts.userMargin.pubkey,
          control: ts.userMargin.control.pubkey,
          openOrders: ookey,
          dexMarket: ts.state.getMarketKeyBySymbol("SOL-PERP"),
          dexProgram: ZO_DEX_DEVNET_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
      });
      await ts.program.provider.connection.confirmTransaction(tx, "finalized");
    }

    console.log("ookey: ", ookey.toString());

  });

  describe("Placing perp orders", async() => {

    const userClientId = new BN(1);

    xit("Allows users to place a long sol perp order", async() => {
      const price = 90; //in big USD
      const size = 1; //in bif SOL
  
      const isLong = true;
      const limitPrice: BN = priceNumberToLots(
        price,
        SOL_DECIMALS,
        SOL_LOT_SIZE,
        USDC_DECIMALS,
        USDC_SOL_LOT_SIZE,
      );
  
      const maxBaseQty: BN = baseNumberToLots(size, SOL_DECIMALS, SOL_LOT_SIZE);
      const maxQuoteQty: BN = limitPrice.mul(maxBaseQty).mul(USDC_SOL_LOT_SIZE);
      console.log("maxquote actual: ", maxQuoteQty.toNumber());

      const market = await ts.userMargin.state.getMarketBySymbol("SOL-PERP");
      const oo = await ts.userMargin.getOpenOrdersInfoBySymbol("SOL-PERP");

      ts.userMargin.control.refresh();
      console.log("ookey: ", ts.userMargin.control.data.openOrdersAgg[1].key.toString());

      const tx = await ts.program.rpc.doPlacePerpOrder(
        isLong,
        limitPrice,
        maxBaseQty,
        maxQuoteQty,
        userClientId,
        10,
        {
          accounts: {
            zoProgram: SETTINGS.zoPid,
            zoProgramState: ts.state.pubkey,
            stateSigner: ts.userMargin.state.signer,
            cache: ts.state.cache.pubkey,
            authority: ts.user.wallet.publicKey,
            zoProgramMargin: ts.userMargin.pubkey,
            control: ts.userMargin.control.pubkey,
            openOrders: oo.key,
            dexMarket: market.address,
            reqQ: market.requestQueueAddress,
            eventQ: market.eventQueueAddress,
            marketBids: market.bidsAddress,
            marketAsks: market.asksAddress,
            dexProgram: ZO_DEX_DEVNET_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          }
        }
      );
      await ts.program.provider.connection.confirmTransaction(tx, "finalized");

      //console.log(ts.userMargin.control);
      ts.userOo = await ZoOpenOrders.load(
        ts.program.provider.connection,
        ts.userMargin.control.data.openOrdersAgg[1].key,
        ZO_DEX_DEVNET_PROGRAM_ID,
      );
      //console.log(ts.userOo);
      assert.equal(ts.userOo.quoteTokenTotal.toNumber(), 0);
      console.log("quoteTokenFree: ", ts.userOo.quoteTokenFree.toNumber());
      // assert.equal(
      //   ts.userOo.quoteTokenFree.toNumber(),
      //   (-maxQuoteQty.toNumber()) * 2,
      // );
      assert.equal(ts.userOo.baseTokenTotal.toNumber(), 0);
      assert.equal(ts.userOo.baseTokenFree.toNumber(), 0);
      assert.equal(ts.userOo.realizedPnl.toNumber(), 0);
      console.log("fundingIndex: ",ts.userOo.fundingIndex.toNumber());
      //assert.equal(ts.userOo.fundingIndex.toNumber(), STARTING_FUNDING_INDEX);
      console.log("coinOnBids: ", ts.userOo.coinOnBids.toNumber());
      // assert.equal(
      //   ts.userOo.coinOnBids.toNumber(),
      //   maxBaseQty.toNumber() * SOL_LOT_SIZE.toNumber() * 2,
      // );
      assert.equal(ts.userOo.coinOnAsks.toNumber(), 0);

    });
    
    it("Allows users to settle funds", async() => {
      const market = await ts.userMargin.state.getMarketBySymbol("SOL-PERP");
      const oo = await ts.userMargin.getOpenOrdersInfoBySymbol("SOL-PERP");

      await ts.userMargin.refresh();
      console.log("user Margin raw col USDC balance before settle funds: ", ts.userMargin.data.rawCollateral[0].toNumber());
      console.log("user Margin actual col USDC balance before settle funds: ", ts.userMargin.data.actualCollateral[0].n.toNumber());
      console.log("user Margin USDC balance before settle funds: ", ts.userMargin.balances.USDC.n.toString());

      console.log("position size:", ts.userMargin.positions[0].coins.number);

      const tx = await ts.program.rpc.doSettleFunds({
        accounts: {
          zoProgram: SETTINGS.zoPid,
          authority: ts.user.wallet.publicKey,
          zoProgramState: ts.state.pubkey,
          stateSigner: ts.userMargin.state.signer,
          cache: ts.state.cache.pubkey,
          zoProgramMargin: ts.userMargin.pubkey,
          control: ts.userMargin.control.pubkey,
          openOrders: oo.key,
          dexMarket: market.address,
          dexProgram: ZO_DEX_DEVNET_PROGRAM_ID,
        },
      });

      await ts.program.provider.connection.confirmTransaction(tx, "finalized");

      await ts.userMargin.refresh();
      console.log("user Margin raw col USDC balance after settle funds: ", ts.userMargin.data.rawCollateral[0].toNumber());
      console.log("user Margin actual col USDC balance after settle funds: ", ts.userMargin.data.actualCollateral[0].n.toNumber());
      console.log("user Margin USDC balance after settle funds: ", ts.userMargin.balances.USDC.n.toString());

    });

  })

});
