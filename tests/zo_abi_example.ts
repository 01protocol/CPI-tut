import * as anchor from "@project-serum/anchor";
import { BN, Idl, Program } from "@project-serum/anchor";
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
  IDL,
  Margin,
  State,
  USDC_DECIMALS,
} from "@zero_one/client";
import * as splToken from "@solana/spl-token";
import { ZoAbiExample } from "../target/types/zo_abi_example";
import assert from "assert";

const MINT_ACCOUNT_SIZE = 82;

//@ts-ignore
import idl from "../target/idl/zo_abi_example.json";
import { TOKEN_PROGRAM_ID } from "@project-serum/serum/lib/token-instructions";

const SETTINGS = {
  connection: "https://api.devnet.rpcpool.com/714dcbee786eb2c4bc6dfc98826b",
  zoPid: new PublicKey("Zo1ThtSHMh9tZGECwBDL81WJRL6s3QTHf733Tyko7KQ"),
  zoState: new PublicKey("KwcWW7WvgSXLJcyjKZJBHLbfriErggzYHpjS9qjVD5F"),
  usdcMint: new PublicKey("7UT1javY6X1M9R2UrPGrwcZ78SX3huaXyETff5hm5YdX"),
  solMint: new PublicKey("So11111111111111111111111111111111111111112"),
  btcMint: new PublicKey("3n3sMJMnZhgNDaxp6cfywvjHLrV1s34ndfa6xAaYvpRs"),
  programPid: new PublicKey("Eg8fBwr5N3P9HTUZsKJ5LZP3jVRgBJcrnvAcY35G5rTw"),
  user: new PublicKey("45vmGc9sVW52Tb4F77Xt3X5Ft1PVSzS3HAyno2E166zN"),
  userUSDC: new PublicKey("C8WvEkicXhE46DQrq2CDx2MdPoGzfgJSwo868r8Vjr1M"),
};
const userAcc = Keypair.fromSecretKey(
  new Uint8Array([
    77, 112, 26, 232, 38, 172, 118, 8, 248, 64, 234, 108, 113, 112, 246, 28,
    151, 52, 23, 230, 237, 233, 185, 47, 75, 152, 125, 152, 33, 13, 146, 42, 45,
    214, 44, 160, 178, 170, 37, 49, 172, 83, 180, 75, 129, 161, 66, 252, 81, 4,
    12, 68, 245, 126, 51, 201, 102, 9, 169, 210, 160, 103, 116, 219,
  ])
);

describe("zo_abi_example", () => {
  //teststate
  const ts: any = {};

  it("Fetching the Zo state stuff and creating user", async () => {
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

    ts.zoProgram = createProgram(provider, Cluster.Devnet);

    ts.state = await State.load(ts.zoProgram, SETTINGS.zoState);

    console.log("user wallet:", ts.user.wallet.publicKey.toString());

    ts.stateUSDCVault = ts.state.getVaultCollateralByMint(SETTINGS.usdcMint)[0];
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

    if (
      null == (await ts.userProgram.provider.connection.getAccountInfo(key))
    ) {
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

    ts.stateUSDCVault = ts.state.getVaultCollateralByMint(SETTINGS.usdcMint)[0];

    console.log("zo program USDC account", ts.stateUSDCVault.toString());

    //checking that ecerything is correct
    assert.ok(ts.userMargin.data.authority.equals(ts.user.wallet.publicKey));
    assert.equal(ts.userMargin.data.rawCollateral.length, 3);
    assert.equal(ts.userMargin.data.actualCollateral.length, 3);
    assert.ok(ts.userMargin.data.control.equals(ts.userControl.pubkey));
    assert.ok(ts.userControl.data.authority.equals(ts.user.wallet.publicKey));
  });

  it("allows users to make a deposit USDC", async () => {
    const depositAmount = new BN(40 * 10 ** USDC_DECIMALS);

    let tokenAcc = await splToken.getOrCreateAssociatedTokenAccount(
      ts.program.provider.connection,
      ts.user.wallet,
      SETTINGS.usdcMint,
      ts.user.wallet.publicKey
    );

    console.log("user USDC balance before deposit: ", tokenAcc.amount);

    const tx = await ts.program.rpc.doDeposit(depositAmount, {
      accounts: {
        authority: ts.user.wallet.publicKey,
        zoProgramState: ts.state.pubkey,
        zoProgramMargin: ts.userMargin.pubkey,
        zoProgram: SETTINGS.zoPid,
        cache: ts.state.cache.pubkey,
        stateSigner: ts.userMargin.state.signer,
        tokenAccount: SETTINGS.userUSDC,
        zoProgramVault: ts.stateUSDCVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    });
    await ts.program.provider.connection.confirmTransaction(tx, "finalized");

    tokenAcc = await splToken.getOrCreateAssociatedTokenAccount(
      ts.program.provider.connection,
      ts.user.wallet,
      SETTINGS.usdcMint,
      ts.user.wallet.publicKey
    );

    console.log("user USDC balance after deposit: ", tokenAcc.amount);
  });

  it("allows users to make a withdraw USDC", async () => {
    const withdrawAmount = new BN(20 * 10 ** USDC_DECIMALS);

    let tokenAcc = await splToken.getOrCreateAssociatedTokenAccount(
      ts.program.provider.connection,
      ts.user.wallet,
      SETTINGS.usdcMint,
      ts.user.wallet.publicKey
    );

    console.log("user USDC balance before withdraw: ", tokenAcc.amount);

    const tx = await ts.program.rpc.doWithdraw(withdrawAmount, {
      accounts: {
        authority: ts.user.wallet.publicKey,
        zoProgramState: ts.state.pubkey,
        zoProgramMargin: ts.userMargin.pubkey,
        zoProgram: SETTINGS.zoPid,
        control: ts.userMargin.control.pubkey,
        cache: ts.state.cache.pubkey,
        stateSigner: ts.userMargin.state.signer,
        tokenAccount: SETTINGS.userUSDC,
        zoProgramVault: ts.stateUSDCVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    });
    await ts.program.provider.connection.confirmTransaction(tx, "finalized");

    tokenAcc = await splToken.getOrCreateAssociatedTokenAccount(
      ts.program.provider.connection,
      ts.user.wallet,
      SETTINGS.usdcMint,
      ts.user.wallet.publicKey
    );

    console.log("user USDC balance after withdraw: ", tokenAcc.amount);
  });
});
