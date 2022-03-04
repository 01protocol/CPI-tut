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
  State,
  USDC_DECIMALS,
} from "@zero_one/client";
import * as splToken from "@solana/spl-token";
import assert from "assert";

import idl = require("../target/idl/zo_abi_example.json");
import { TOKEN_PROGRAM_ID } from "@project-serum/serum/lib/token-instructions";

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
        preflightCommitment: "confirmed",
        commitment: "confirmed",
      }
    );

    ts.user = provider;

    ts.program = new anchor.Program(idl as Idl, SETTINGS.programPid, ts.user);

    console.log("user wallet: ", ts.user.wallet.publicKey.toString());
    ts.userUSDC = await splToken.getOrCreateAssociatedTokenAccount(
      ts.user.connection,
      ts.user.wallet,
      SETTINGS.usdcMint,
      ts.user.wallet.publicKey
    );

    console.log("user token account", ts.userUSDC.address.toString());

    ts.zoProgram = createProgram(ts.user, Cluster.Devnet);

    ts.state = await State.load(ts.zoProgram, SETTINGS.zoState);

    ts.stateUSDCVault = ts.state.getVaultCollateralByMint(SETTINGS.usdcMint)[0];
    console.log("zo program USDC vault: ", ts.stateUSDCVault.toString());
  });

  it("Allows users to create margin from 01_exchange", async () => {
    //creating accounts needed for CreateMargin call
    const [[key, nonce], control, controlLamports] = await Promise.all([
      PublicKey.findProgramAddress(
        [
          ts.user.wallet.publicKey.toBuffer(),
          ts.state.pubkey.toBuffer(),
          Buffer.from("marginv1"),
        ],
        ts.zoProgram.programId
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
            programId: ts.zoProgram.programId,
          }),
        ],
        signers: [control],
      });
      await ts.program.provider.connection.confirmTransaction(tx, "finalized");
    }
  });

  it("allows users to fetch margin account data", async () => {
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

  it("allows users to make a deposit USDC", async () => {
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

  it("allows users to make a withdraw USDC", async () => {
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
});
