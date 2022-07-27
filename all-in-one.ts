import { web3, BN } from "@project-serum/anchor";
import * as metaplex from "@metaplex/js";
import {
  Token,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { AmmPool, CacheDataProviderImpl } from "./pool";
import { SqrtPriceMath, LiquidityMath, sqrtPriceX64ToPrice } from "./math";
import { StateFetcher } from "./states";

import {
  getAmmConfigAddress,
  getPoolAddress,
  getPersonalPositionAddress,
  sendTransaction,
} from "./utils";

import {
  increaseLiquidity,
  decreaseLiquidity,
  collectFee,
  openPosition,
  swapBaseIn,
  swapBaseOut,
  swapRouterBaseIn,
} from "./instructions";

const {
  metadata: { Metadata },
} = metaplex.programs;

import {
  Connection,
  ConfirmOptions,
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { Context, NodeWallet } from "./base";

const SUPER_ADMIN_SECRET_KEY = new Uint8Array([
  18, 52, 81, 206, 137, 36, 192, 182, 13, 66, 109, 118, 114, 207, 71, 49, 105,
  175, 72, 36, 151, 192, 249, 96, 106, 164, 193, 202, 163, 193, 97, 220, 159,
  76, 221, 255, 199, 94, 34, 216, 103, 234, 235, 214, 208, 220, 7, 49, 93, 218,
  5, 14, 106, 72, 212, 32, 27, 82, 57, 7, 173, 143, 104, 159,
]);

function localWallet(): Keypair {
  const payer = Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(
        require("fs").readFileSync("./keypair.json", {
          encoding: "utf-8",
        })
      )
    )
  );
  return payer;
}

describe("test with given pool", async () => {
  console.log(SqrtPriceMath.getSqrtPriceX64FromTick(0).toString());
  console.log(SqrtPriceMath.getSqrtPriceX64FromTick(1).toString());

  const programId = new PublicKey(
    "Enmwn7qqmhUWhg3hhGiruY7apAJMNJscAvv8GwtzUKY3"
  );

  const url = "http://localhost:8899";
  const confirmOptions: ConfirmOptions = {
    preflightCommitment: "processed",
    commitment: "processed",
    skipPreflight: true,
  };
  const connection = new Connection(url, confirmOptions.commitment);
  console.log("new connection success");
  const wallet = localWallet();
  const walletPubkey = wallet.publicKey;
  console.log("wallet address: ", walletPubkey.toString());

  const ctx = new Context(
    connection,
    NodeWallet.fromSecretKey(localWallet()),
    programId,
    confirmOptions
  );
  const program = ctx.program;
  
  const superAdmin = web3.Keypair.fromSecretKey(SUPER_ADMIN_SECRET_KEY);
  console.log("superAdmin:", superAdmin.publicKey.toString());

  const ownerKeyPair = wallet;
  const owner = ownerKeyPair.publicKey;
  console.log("owner address: ", owner.toString());

  const stateFetcher = new StateFetcher(program);

  // find amm config address
  const [ammConfig, ammConfigBump] = await getAmmConfigAddress(
    0,
    program.programId
  );
  console.log("amm config address: ", ammConfig.toString());

  const mintAuthority = new Keypair();
  // Tokens constituting the pool
  let token0: Token;
  let token1: Token;
  let token2: Token;

  let ammPoolA: AmmPool;
  let ammPoolB: AmmPool;

  let poolAState: web3.PublicKey;
  let poolAStateBump: number;
  let poolBState: web3.PublicKey;
  let poolBStateBump: number;

  let ownerToken0Account: web3.PublicKey;
  let ownerToken1Account: web3.PublicKey;
  let ownerToken2Account: web3.PublicKey;

  const nftMintAKeypair = new Keypair();
  const nftMintBKeypair = new Keypair();

  let personalPositionAState: web3.PublicKey;
  let personalPositionABump: number;
  let personalPositionBState: web3.PublicKey;
  let personalPositionBBump: number;

  it("Create token mints", async () => {
    let ixs: TransactionInstruction[] = [];
    ixs.push(
      web3.SystemProgram.transfer({
        fromPubkey: walletPubkey,
        toPubkey: mintAuthority.publicKey,
        lamports: web3.LAMPORTS_PER_SOL,
      })
    );
    await sendTransaction(connection, ixs, [wallet]);

    token0 = await Token.createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      6,
      TOKEN_PROGRAM_ID
    );
    token1 = await Token.createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      6,
      TOKEN_PROGRAM_ID
    );
    token2 = await Token.createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      6,
      TOKEN_PROGRAM_ID
    );
    if (token0.publicKey > token1.publicKey) {
      // swap token mints
      console.log("Swap tokens for A");
      const temp = token0;
      token0 = token1;
      token1 = temp;
    }

    console.log("Token 0", token0.publicKey.toString());
    console.log("Token 1", token1.publicKey.toString());

    while (token1.publicKey >= token2.publicKey) {
      token2 = await Token.createMint(
        connection,
        mintAuthority,
        mintAuthority.publicKey,
        null,
        8,
        TOKEN_PROGRAM_ID
      );
    }
    console.log("Token 2", token2.publicKey.toString());
  });

  it("creates token accounts for position minter and airdrops to them", async () => {
    ownerToken0Account = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token0.publicKey,
      owner
    );
    ownerToken1Account = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token1.publicKey,
      owner
    );
    ownerToken2Account = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token2.publicKey,
      owner
    );
  });

  it("derive pool address", async () => {
    [poolAState, poolAStateBump] = await getPoolAddress(
      ammConfig,
      token0.publicKey,
      token1.publicKey,
      program.programId,
      100
    );
    console.log("got poolA address", poolAState.toString());

    [poolBState, poolBStateBump] = await getPoolAddress(
      ammConfig,
      token0.publicKey,
      token2.publicKey,
      program.programId,
      2500
    );
    console.log("got poolB address", poolBState.toString());

    const cacheDataProvider = new CacheDataProviderImpl(program, poolAState);
    const poolStateAData = await stateFetcher.getPoolState(poolAState);
    await cacheDataProvider.loadTickAndBitmapCache(
      poolStateAData.tick,
      poolStateAData.tickSpacing
    );

    ammPoolA = new AmmPool(
      ctx,
      poolAState,
      poolStateAData,
      stateFetcher,
      cacheDataProvider
    );
  });

  it("find program accounts addresses for position creation", async () => {
    [personalPositionAState, personalPositionABump] =
      await getPersonalPositionAddress(
        nftMintAKeypair.publicKey,
        program.programId
      );
    console.log(
      "personalPositionAState key: ",
      personalPositionAState.toString()
    );
    [personalPositionBState, personalPositionBBump] =
      await getPersonalPositionAddress(
        nftMintBKeypair.publicKey,
        program.programId
      );
    console.log(
      "personalPositionBState key: ",
      personalPositionBState.toString()
    );
  });

  describe("init-amm-env", async () => {
    it("create amm config", async () => {
      // feeRate/ 1e6 = 0.1

      // if (await accountExist(connection, ammConfig)) {
      //   return;
      // }

      const tx = await program.methods
        .createAmmConfig(0, 10, 1000, 2500)
        .accounts({
          owner,
          ammConfig,
          systemProgram: SystemProgram.programId,
        })
        .signers([ownerKeyPair])
        .rpc();
      console.log("init amm config tx: ", tx);

      const ammConfigData = await program.account.ammConfig.fetch(ammConfig);
      console.log(
        "ammConfigData.bump: ",
        ammConfigData.bump,
        "expectedBump:",
        ammConfigBump,
        "owner:",
        ammConfigData.owner.toString(),
        "admin:",
        superAdmin.publicKey.toString()
      );

      // assert.equal(
      //   ammConfigData.owner.toString(),
      //   superAdmin.publicKey.toString()
      // );
      // assert.equal(ammConfigData.protocolFeeRate, 100000);
      // assert.equal(ammConfigData.bump, ammConfigBump);
    });
  });

  describe("#create_personal_position", () => {
    it("open personal position", async () => {
      const cacheDataProvider = new CacheDataProviderImpl(program, poolAState);
      const poolStateAData = await stateFetcher.getPoolState(poolAState);
      cacheDataProvider.loadTickAndBitmapCache(
        poolStateAData.tick,
        poolStateAData.tickSpacing
      );

      ammPoolA = new AmmPool(
        ctx,
        poolAState,
        poolStateAData,
        stateFetcher,
        cacheDataProvider
      );
      console.log(poolStateAData);
      const additionalComputeBudgetInstruction =
        ComputeBudgetProgram.requestUnits({
          units: 400000,
          additionalFee: 0,
        });

      const openIx = await openPosition(
        {
          payer: owner,
          positionNftOwner: owner,
          positionNftMint: nftMintAKeypair.publicKey,
          token0Account: ownerToken0Account,
          token1Account: ownerToken1Account,
        },
        ammPoolA,
        -20,
        20,
        new BN(1_000_000),
        new BN(1_000_000)
      );

      const tx = await sendTransaction(
        connection,
        [additionalComputeBudgetInstruction, openIx],
        [ownerKeyPair, nftMintAKeypair],
        confirmOptions
      );

      console.log("create position, tx:", tx);
    });
  });

  describe("#increase_liquidity", () => {
    it("Add token to the position", async () => {
      const personalPositionData = await stateFetcher.getPositionState(
        personalPositionAState
      );

      const ix = await increaseLiquidity(
        {
          positionNftOwner: owner,
          token0Account: ownerToken0Account,
          token1Account: ownerToken1Account,
        },
        ammPoolA,
        personalPositionData,
        new BN(1_000_000),
        new BN(1_000_000)
      );
      const tx = await sendTransaction(
        connection,
        [ix],
        [ownerKeyPair],
        confirmOptions
      );

      console.log("increaseLiquidity tx: ", tx);
    });
  });

  describe("#decrease_liquidity", () => {
    it("burn liquidity as owner", async () => {
      const personalPositionData = await stateFetcher.getPositionState(
        personalPositionAState
      );

      const ix = await decreaseLiquidity(
        {
          positionNftOwner: owner,
          token0Account: ownerToken0Account,
          token1Account: ownerToken1Account,
        },
        ammPoolA,
        personalPositionData,
        personalPositionData.liquidity.divn(2)
      );

      const tx = await sendTransaction(
        connection,
        [ix],
        [ownerKeyPair],
        confirmOptions
      );
      console.log("tx:", tx);
    });
  });

  describe("#swap_base_input_single", () => {
    it("zero to one swap with a limit price", async () => {
      await ammPoolA.reload();
      const amountIn = new BN(100_000);
      const sqrtPriceLimitX64 = ammPoolA.poolState.sqrtPriceX64.subn(1000000);

      const ix = await swapBaseIn(
        {
          payer: owner,
          inputTokenAccount: ownerToken0Account,
          outputTokenAccount: ownerToken1Account,
        },
        ammPoolA,
        token0.publicKey,
        amountIn,
        0,
        sqrtPriceLimitX64
      );

      const tx = await sendTransaction(
        connection,
        [ix],
        [ownerKeyPair],
        confirmOptions
      );
      console.log("swap tx:", tx);
    });

    it("zero to one swap without a limit price", async () => {
      const amountIn = new BN(100_000);
      const ix = await swapBaseIn(
        {
          payer: owner,
          inputTokenAccount: ownerToken0Account,
          outputTokenAccount: ownerToken1Account,
        },
        ammPoolA,
        token0.publicKey,
        amountIn
      );

      const tx = await sendTransaction(
        connection,
        [ix],
        [ownerKeyPair],
        confirmOptions
      );
      console.log("swap tx:", tx);
    });
  });

  describe("#swap_base_output_single", () => {
    it("zero for one swap base output", async () => {
      const amountOut = new BN(100_000);
      await ammPoolA.reload();
      console.log(
        "pool current tick:",
        ammPoolA.poolState.tick,
        "tick_spacing:",
        ammPoolA.poolState.tickSpacing
      );
      const ix = await swapBaseOut(
        {
          payer: owner,
          inputTokenAccount: ownerToken0Account,
          outputTokenAccount: ownerToken1Account,
        },
        ammPoolA,
        token1.publicKey,
        amountOut
      );

      const tx = await sendTransaction(
        connection,
        [ix],
        [ownerKeyPair],
        confirmOptions
      );
      console.log("swap tx:", tx);
    });
  });

  describe("#swap_router_base_in", () => {
    it("open second pool position", async () => {
      const cacheDataProvider = new CacheDataProviderImpl(program, poolBState);
      const poolStateAData = await stateFetcher.getPoolState(poolBState);
      cacheDataProvider.loadTickAndBitmapCache(
        poolStateAData.tick,
        poolStateAData.tickSpacing
      );

      ammPoolB = new AmmPool(
        ctx,
        poolBState,
        poolStateAData,
        stateFetcher,
        cacheDataProvider
      );
      console.log(poolStateAData);
      const additionalComputeBudgetInstruction =
        ComputeBudgetProgram.requestUnits({
          units: 400000,
          additionalFee: 0,
        });

      const openIx = await openPosition(
        {
          payer: owner,
          positionNftOwner: owner,
          positionNftMint: nftMintBKeypair.publicKey,
          token0Account: ownerToken0Account,
          token1Account: ownerToken2Account,
        },
        ammPoolB,
        -120,
        120,
        new BN(1_000_000),
        new BN(1_000_000)
      );

      const tx = await sendTransaction(
        connection,
        [additionalComputeBudgetInstruction, openIx],
        [ownerKeyPair, nftMintBKeypair],
        confirmOptions
      );
      console.log("seconde position:", tx);
    });

    it("router two pool swap", async () => {
      console.log("token1.publicKey:", token1.publicKey.toString());
      const ix = await swapRouterBaseIn(
        owner,
        new BN(100_000),
        new BN(0),
        {
          ammPool: ammPoolA,
          inputTokenMint: token1.publicKey,
          inputTokenAccount: ownerToken1Account,
          outputTokenAccount: ownerToken0Account,
        },
        [
          {
            ammPool: ammPoolB,
            outputTokenAccount: ownerToken2Account,
          },
        ]
      );

      const tx = await sendTransaction(
        connection,
        [ix],
        [ownerKeyPair],
        confirmOptions
      );
      console.log("tx:", tx);
    });
  });

  describe("#collect_fee", () => {
    it("collect fee as owner", async () => {
      const amount0Max = new BN(10);
      const amount1Max = new BN(10);

      const personalPositionData = await stateFetcher.getPositionState(
        personalPositionAState
      );
      const ix = await collectFee(
        {
          positionNftOwner: owner,
          token0Account: ownerToken0Account,
          token1Account: ownerToken1Account,
        },
        ammPoolA,
        personalPositionData,
        amount0Max,
        amount1Max
      );

      const tx = await sendTransaction(
        connection,
        [ix],
        [ownerKeyPair],
        confirmOptions
      );
      console.log("tx:", tx);
    });
  });
});
