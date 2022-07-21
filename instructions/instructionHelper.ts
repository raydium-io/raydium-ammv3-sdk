import { BN } from "@project-serum/anchor";
import {
  Connection,
  ConfirmOptions,
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram,
  TransactionInstruction,
  AccountMeta,
} from "@solana/web3.js";

import { programs } from "@metaplex/js";
import common from "mocha/lib/interfaces/common";
import { tickPosition } from "../entities";
import {
  SqrtPriceMath,
  LiquidityMath,
  MIN_SQRT_PRICE_X64,
  MAX_SQRT_PRICE_X64,
} from "../math";
import {
  PoolState,
  TickState,
  PositionState,
  FeeState,
  ObservationState,
  AmmConfig,
  PositionRewardInfo,
  RewardInfo,
} from "../states";

import {
  accountExist,
  getAmmConfigAddress,
  getFeeAddress,
  getPoolAddress,
  getPoolVaultAddress,
  getObservationAddress,
  getTickAddress,
  getTickBitmapAddress,
  getProtocolPositionAddress,
  getNftMetadataAddress,
  getPersonalPositionAddress,
  sleep,
  sendTransaction,
} from "../utils";

import {
  Token,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  openPositionInstruction,
  createPoolInstruction,
  increaseLiquidityInstruction,
  decreaseLiquidityInstruction,
  increaseObservationInstruction,
  collectFeeInstruction,
  swapInstruction,
  swapRouterBaseInInstruction,
} from "./";

import { AmmPool, CacheDataProviderImpl } from "../pool";

const defaultSlippage = 0.5; // 0.5%

export type OpenPositionAccounts = {
  payer: PublicKey;
  positionNftOwner: PublicKey;
  positionNftMint: PublicKey;
  token0Account: PublicKey;
  token1Account: PublicKey;
};

export type LiquidityChangeAccounts = {
  positionNftOwner: PublicKey;
  token0Account: PublicKey;
  token1Account: PublicKey;
};

export type SwapAccounts = {
  payer: PublicKey;
  inputTokenAccount: PublicKey;
  outputTokenAccount: PublicKey;
};

export async function openPosition(
  accounts: OpenPositionAccounts,
  ammPool: AmmPool,
  tickLowerIndex: number,
  tickUpperIndex: number,
  token0Amount: BN,
  token1Amount: BN,
  token0AmountSlippage?: number,
  token1AmountSlippage?: number
): Promise<TransactionInstruction> {
  const poolState = ammPool.poolState;
  const ctx = ammPool.ctx;
  // const priceLower = SqrtPriceMath.getSqrtPriceX64FromTick(tickLowerIndex);
  // const priceUpper = SqrtPriceMath.getSqrtPriceX64FromTick(tickUpperIndex);
  const wordPosLowerIndex = tickPosition(
    tickLowerIndex / poolState.tickSpacing
  ).wordPos;
  const wordPosUpperIndex = tickPosition(
    tickUpperIndex / poolState.tickSpacing
  ).wordPos;

  // const expectLiquity = LiquidityMath.maxLiquidityFromTokenAmounts(
  //   poolState.sqrtPriceX64,
  //   priceLower,
  //   priceUpper,
  //   token0Amount,
  //   token1Amount
  // );

  let amount0Min: BN = new BN(0);
  let amount1Min: BN = new BN(0);
  if (token0AmountSlippage !== undefined) {
    amount0Min = token0Amount.muln(1 - token0AmountSlippage);
  }
  if (token1AmountSlippage !== undefined) {
    amount1Min = token1Amount.muln(1 - token1AmountSlippage);
  }

  // prepare tick and bitmap accounts
  const [tickLower] = await getTickAddress(
    ammPool.address,
    ctx.program.programId,
    tickLowerIndex
  );
  const [tickBitmapLower] = await getTickBitmapAddress(
    ammPool.address,
    ctx.program.programId,
    wordPosLowerIndex
  );
  const [tickUpper] = await getTickAddress(
    ammPool.address,
    ctx.program.programId,
    tickUpperIndex
  );
  const [tickBitmapUpper] = await getTickBitmapAddress(
    ammPool.address,
    ctx.program.programId,
    wordPosUpperIndex
  );

  // prepare observation accounts
  const lastObservation = (
    await getObservationAddress(
      ammPool.address,
      ctx.program.programId,
      poolState.observationIndex
    )
  )[0];
  let nextObservation = lastObservation;

  const { blockTimestamp: lastBlockTime } =
    await ammPool.stateFetcher.getObservationState(lastObservation);

  const slot = await ctx.provider.connection.getSlot();
  const blockTimestamp = await ctx.provider.connection.getBlockTime(slot);

  if (Math.floor(lastBlockTime / 14) > Math.floor(blockTimestamp / 14)) {
    nextObservation = (
      await getObservationAddress(
        ammPool.address,
        ctx.program.programId,
        (poolState.observationIndex + 1) % poolState.observationCardinalityNext
      )
    )[0];
  }

  const positionANftAccount = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    accounts.positionNftMint,
    accounts.positionNftOwner
  );

  const metadataAccount = (
    await getNftMetadataAddress(accounts.positionNftMint)
  )[0];

  const [personalPosition] = await getPersonalPositionAddress(
    accounts.positionNftMint,
    ctx.program.programId
  );

  const [protocolPosition] = await getProtocolPositionAddress(
    ammPool.address,
    ctx.program.programId,
    tickLowerIndex,
    tickUpperIndex
  );

  return await openPositionInstruction(
    ctx.program,
    {
      tickLowerIndex,
      tickUpperIndex,
      wordLowerIndex: wordPosLowerIndex,
      wordUpperIndex: wordPosUpperIndex,
      amount0Desired: token0Amount,
      amount1Desired: token1Amount,
      amount0Min,
      amount1Min,
    },
    {
      payer: accounts.payer,
      positionNftOwner: accounts.positionNftOwner,
      ammConfig: poolState.ammConfig,
      positionNftMint: accounts.positionNftMint,
      positionNftAccount: positionANftAccount,
      metadataAccount,
      poolState: ammPool.address,
      protocolPosition,
      tickLower,
      tickUpper,
      tickBitmapLower,
      tickBitmapUpper,
      tokenAccount0: accounts.token0Account,
      tokenAccount1: accounts.token1Account,
      tokenVault0: poolState.tokenVault0,
      tokenVault1: poolState.tokenVault1,
      lastObservation,
      nextObservation,
      personalPosition,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      metadataProgram: programs.metadata.MetadataProgram.PUBKEY,
    }
  );
}

export async function increaseLiquidity(
  accounts: LiquidityChangeAccounts,
  ammPool: AmmPool,
  positionState: PositionState,
  token0Amount: BN,
  token1Amount: BN,
  token0AmountSlippage?: number,
  token1AmountSlippage?: number
): Promise<TransactionInstruction> {
  const poolState = ammPool.poolState;
  const ctx = ammPool.ctx;
  const tickLowerIndex = positionState.tickLower;
  const tickUpperIndex = positionState.tickUpper;
  const wordPosLowerIndex = tickPosition(
    tickLowerIndex / poolState.tickSpacing
  ).wordPos;
  const wordPosUpperIndex = tickPosition(
    tickUpperIndex / poolState.tickSpacing
  ).wordPos;

  let amount0Min: BN = new BN(0);
  let amount1Min: BN = new BN(0);
  if (token0AmountSlippage !== undefined) {
    amount0Min = token0Amount.muln(1 - token0AmountSlippage);
  }
  if (token1AmountSlippage !== undefined) {
    amount1Min = token1Amount.muln(1 - token1AmountSlippage);
  }

  // prepare tick and bitmap accounts
  const [tickLower] = await getTickAddress(
    ammPool.address,
    ctx.program.programId,
    tickLowerIndex
  );
  const [tickBitmapLower] = await getTickBitmapAddress(
    ammPool.address,
    ctx.program.programId,
    wordPosLowerIndex
  );
  const [tickUpper] = await getTickAddress(
    ammPool.address,
    ctx.program.programId,
    tickUpperIndex
  );
  const [tickBitmapUpper] = await getTickBitmapAddress(
    ammPool.address,
    ctx.program.programId,
    wordPosUpperIndex
  );

  // prepare observation accounts
  const lastObservation = (
    await getObservationAddress(
      ammPool.address,
      ctx.program.programId,
      poolState.observationIndex
    )
  )[0];
  let nextObservation = lastObservation;

  const { blockTimestamp: lastBlockTime } =
    await ammPool.stateFetcher.getObservationState(lastObservation);

  const slot = await ctx.provider.connection.getSlot();
  const blockTimestamp = await ctx.provider.connection.getBlockTime(slot);

  if (Math.floor(lastBlockTime / 14) > Math.floor(blockTimestamp / 14)) {
    nextObservation = (
      await getObservationAddress(
        ammPool.address,
        ctx.program.programId,
        (poolState.observationIndex + 1) % poolState.observationCardinalityNext
      )
    )[0];
  }

  const positionANftAccount = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    positionState.nftMint,
    accounts.positionNftOwner
  );

  const [personalPosition] = await getPersonalPositionAddress(
    positionState.nftMint,
    ctx.program.programId
  );

  const [protocolPosition] = await getProtocolPositionAddress(
    ammPool.address,
    ctx.program.programId,
    tickLowerIndex,
    tickUpperIndex
  );

  return await increaseLiquidityInstruction(
    ctx.program,
    {
      amount0Desired: token0Amount,
      amount1Desired: token1Amount,
      amount0Min,
      amount1Min,
    },
    {
      nftOwner: accounts.positionNftOwner,
      ammConfig: poolState.ammConfig,
      nftAccount: positionANftAccount,
      poolState: ammPool.address,
      protocolPosition,
      tickLower,
      tickUpper,
      tickBitmapLower,
      tickBitmapUpper,
      tokenAccount0: accounts.token0Account,
      tokenAccount1: accounts.token1Account,
      tokenVault0: poolState.tokenVault0,
      tokenVault1: poolState.tokenVault1,
      lastObservation,
      nextObservation,
      personalPosition,
      tokenProgram: TOKEN_PROGRAM_ID,
    }
  );
}

export async function decreaseLiquidity(
  accounts: LiquidityChangeAccounts,
  ammPool: AmmPool,
  positionState: PositionState,
  liquidity: BN,
  token0AmountSlippage?: number,
  token1AmountSlippage?: number
): Promise<TransactionInstruction> {
  const poolState = ammPool.poolState;
  const ctx = ammPool.ctx;
  const tickLowerIndex = positionState.tickLower;
  const tickUpperIndex = positionState.tickUpper;
  const sqrtPriceLowerX64 =
    SqrtPriceMath.getSqrtPriceX64FromTick(tickLowerIndex);
  const sqrtPriceUpperX64 =
    SqrtPriceMath.getSqrtPriceX64FromTick(tickUpperIndex);

  const wordPosLowerIndex = tickPosition(
    tickLowerIndex / poolState.tickSpacing
  ).wordPos;
  const wordPosUpperIndex = tickPosition(
    tickUpperIndex / poolState.tickSpacing
  ).wordPos;

  const token0Amount = LiquidityMath.getToken0AmountForLiquidity(
    sqrtPriceLowerX64,
    sqrtPriceUpperX64,
    liquidity,
    false
  );
  const token1Amount = LiquidityMath.getToken1AmountForLiquidity(
    sqrtPriceLowerX64,
    sqrtPriceUpperX64,
    liquidity,
    false
  );
  let amount0Min: BN = new BN(0);
  let amount1Min: BN = new BN(0);
  if (token0AmountSlippage !== undefined) {
    amount0Min = token0Amount.muln(1 - token0AmountSlippage);
  }
  if (token1AmountSlippage !== undefined) {
    amount1Min = token1Amount.muln(1 - token1AmountSlippage);
  }

  // prepare tick and bitmap accounts
  const [tickLower] = await getTickAddress(
    ammPool.address,
    ctx.program.programId,
    tickLowerIndex
  );
  const [tickBitmapLower] = await getTickBitmapAddress(
    ammPool.address,
    ctx.program.programId,
    wordPosLowerIndex
  );
  const [tickUpper] = await getTickAddress(
    ammPool.address,
    ctx.program.programId,
    tickUpperIndex
  );
  const [tickBitmapUpper] = await getTickBitmapAddress(
    ammPool.address,
    ctx.program.programId,
    wordPosUpperIndex
  );

  // prepare observation accounts
  const lastObservation = (
    await getObservationAddress(
      ammPool.address,
      ctx.program.programId,
      poolState.observationIndex
    )
  )[0];
  let nextObservation = lastObservation;
  const { blockTimestamp: lastBlockTime } =
    await ammPool.stateFetcher.getObservationState(lastObservation);
  const slot = await ctx.provider.connection.getSlot();
  const blockTimestamp = await ctx.provider.connection.getBlockTime(slot);
  if (Math.floor(lastBlockTime / 14) > Math.floor(blockTimestamp / 14)) {
    nextObservation = (
      await getObservationAddress(
        ammPool.address,
        ctx.program.programId,
        (poolState.observationIndex + 1) % poolState.observationCardinalityNext
      )
    )[0];
  }

  const positionANftAccount = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    positionState.nftMint,
    accounts.positionNftOwner
  );

  const [personalPosition] = await getPersonalPositionAddress(
    positionState.nftMint,
    ctx.program.programId
  );

  const [protocolPosition] = await getProtocolPositionAddress(
    ammPool.address,
    ctx.program.programId,
    tickLowerIndex,
    tickUpperIndex
  );

  return await decreaseLiquidityInstruction(
    ctx.program,
    {
      liquidity: liquidity,
      amount0Min,
      amount1Min,
    },
    {
      nftOwner: accounts.positionNftOwner,
      ammConfig: poolState.ammConfig,
      nftAccount: positionANftAccount,
      poolState: ammPool.address,
      protocolPosition,
      tickLower,
      tickUpper,
      tickBitmapLower,
      tickBitmapUpper,
      recipientTokenAccount0: accounts.token0Account,
      recipientTokenAccount1: accounts.token1Account,
      tokenVault0: poolState.tokenVault0,
      tokenVault1: poolState.tokenVault1,
      lastObservation,
      nextObservation,
      personalPosition,
      tokenProgram: TOKEN_PROGRAM_ID,
    }
  );
}

export async function swapBaseIn(
  accounts: SwapAccounts,
  ammPool: AmmPool,
  inputTokenMint: PublicKey,
  amountIn: BN,
  amountOutSlippage?: number,
  sqrtPriceLimitX64?: BN
): Promise<TransactionInstruction> {
  const [expectedAmountOut, remainingAccounts] =
    await ammPool.getOutputAmountAndRemainAccounts(
      inputTokenMint,
      amountIn,
      sqrtPriceLimitX64,
      true
    );

  let amountOutMin = new BN(0);
  if (amountOutSlippage !== undefined) {
    amountOutMin = expectedAmountOut.muln(1 - amountOutSlippage);
  }
  return swap(
    accounts,
    remainingAccounts,
    ammPool,
    inputTokenMint,
    amountIn,
    amountOutMin,
    true,
    sqrtPriceLimitX64
  );
}

export async function swapBaseOut(
  accounts: SwapAccounts,
  ammPool: AmmPool,
  outputTokenMint: PublicKey,
  amountOut: BN,
  amountInSlippage?: number,
  sqrtPriceLimitX64?: BN
): Promise<TransactionInstruction> {
  const [expectedAmountIn, remainingAccounts] =
    await ammPool.getInputAmountAndAccounts(
      outputTokenMint,
      amountOut,
      sqrtPriceLimitX64,
      true
    );
  let amountInMax = new BN(1).shln(32);
  if (amountInSlippage != undefined) {
    amountInMax = expectedAmountIn.muln(1 + amountInSlippage);
  }
  return swap(
    accounts,
    remainingAccounts,
    ammPool,
    outputTokenMint,
    amountOut,
    amountInMax,
    false,
    sqrtPriceLimitX64
  );
}

async function swap(
  accounts: SwapAccounts,
  remainingAccounts: AccountMeta[],
  ammPool: AmmPool,
  inputTokenMint: PublicKey,
  amount: BN,
  otherAmountThreshold: BN,
  isBaseInput: boolean,
  sqrtPriceLimitX64?: BN
): Promise<TransactionInstruction> {
  const poolState = ammPool.poolState;
  const ctx = ammPool.ctx;

  // prepare observation accounts
  const [lastObservation, nextObservation] = await getObservation(ammPool);

  // get vault
  const zeroForOne = isBaseInput
    ? inputTokenMint.equals(poolState.tokenMint0)
    : inputTokenMint.equals(poolState.tokenMint1);

  let inputVault: PublicKey = poolState.tokenVault0;
  let outputVault: PublicKey = poolState.tokenVault1;
  if (!zeroForOne) {
    inputVault = poolState.tokenVault1;
    outputVault = poolState.tokenVault0;
  }
  return await swapInstruction(
    ctx.program,
    {
      amount,
      otherAmountThreshold,
      sqrtPriceLimitX64,
      isBaseInput,
    },
    {
      payer: accounts.payer,
      ammConfig: poolState.ammConfig,
      poolState: ammPool.address,
      inputTokenAccount: accounts.inputTokenAccount,
      outputTokenAccount: accounts.outputTokenAccount,
      inputVault,
      outputVault,
      lastObservation: lastObservation,
      nextObservation: nextObservation,
      remainings: [...remainingAccounts],
      tokenProgram: TOKEN_PROGRAM_ID,
    }
  );
}

export type RouterPoolParam = {
  ammPool: AmmPool;
  inputTokenMint: PublicKey;
  inputTokenAccount: PublicKey;
  outputTokenAccount: PublicKey;
};

type PrepareOnePoolResut = {
  amountOut: BN;
  outputTokenMint: PublicKey;
  outputTokenAccount: PublicKey;
  remains: AccountMeta[];
  additionLength: number;
};

async function prepareOnePool(
  inputAmount: BN,
  param: RouterPoolParam
): Promise<PrepareOnePoolResut> {
  // get vault
  const zeroForOne = param.inputTokenMint.equals(
    param.ammPool.poolState.tokenMint0
  );
  let inputVault: PublicKey = param.ammPool.poolState.tokenVault0;
  let outputVault: PublicKey = param.ammPool.poolState.tokenVault1;
  let outputTokenMint: PublicKey = param.ammPool.poolState.tokenMint1;
  if (!zeroForOne) {
    inputVault = param.ammPool.poolState.tokenVault1;
    outputVault = param.ammPool.poolState.tokenVault0;
    outputTokenMint = param.ammPool.poolState.tokenMint0;
  }
  const [lastObservation, nextObservation] = await getObservation(
    param.ammPool
  );

  const [expectedAmountOut, remainingAccounts] =
    await param.ammPool.getOutputAmountAndRemainAccounts(
      param.inputTokenMint,
      inputAmount
    );

  return {
    amountOut: expectedAmountOut,
    outputTokenMint,
    outputTokenAccount: param.outputTokenAccount,
    remains: [
      {
        pubkey: param.ammPool.address,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: param.outputTokenAccount, // outputTokenAccount
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: inputVault, // input vault
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: outputVault, // output vault
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: lastObservation,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: nextObservation,
        isSigner: false,
        isWritable: true,
      },
      ...remainingAccounts,
    ],
    additionLength: remainingAccounts.length,
  };
}

export async function swapRouterBaseIn(
  payer: PublicKey,
  amountIn: BN,
  amountOutMin: BN,
  firstPoolParam: RouterPoolParam,
  remainRouterPools: {
    ammPool: AmmPool;
    // outputTokenMint: PublicKey;
    outputTokenAccount: PublicKey;
  }[]
): Promise<TransactionInstruction> {
  let additionalAccountsArray: number[] = [];
  let remainingAccounts: AccountMeta[] = [];

  const ammConfig = firstPoolParam.ammPool.poolState.ammConfig;
  let result = await prepareOnePool(amountIn, firstPoolParam);
  for (let i = 0; i < remainRouterPools.length; i++) {
    const param: RouterPoolParam = {
      ammPool: remainRouterPools[i].ammPool,
      inputTokenMint: result.outputTokenMint,
      inputTokenAccount: result.outputTokenAccount,
      outputTokenAccount: remainRouterPools[i].outputTokenAccount,
    };
    result = await prepareOnePool(result.amountOut, param);
    additionalAccountsArray.push[result.additionLength];
    remainingAccounts.push(...result.remains);
  }

  return await swapRouterBaseInInstruction(
    firstPoolParam.ammPool.ctx.program,
    {
      amountIn,
      amountOutMinimum: amountOutMin,
      additionalAccountsPerPool: Buffer.from(additionalAccountsArray),
    },
    {
      payer,
      ammConfig,
      inputTokenAccount: firstPoolParam.inputTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      remainings: remainingAccounts,
    }
  );
}

export async function collectFee(
  accounts: LiquidityChangeAccounts,
  ammPool: AmmPool,
  positionState: PositionState,
  amount0Max: BN,
  amount1Max: BN
): Promise<TransactionInstruction> {
  const poolState = ammPool.poolState;
  const ctx = ammPool.ctx;
  const tickLowerIndex = positionState.tickLower;
  const tickUpperIndex = positionState.tickUpper;

  const wordPosLowerIndex = tickPosition(
    tickLowerIndex / poolState.tickSpacing
  ).wordPos;
  const wordPosUpperIndex = tickPosition(
    tickUpperIndex / poolState.tickSpacing
  ).wordPos;

  // prepare tick and bitmap accounts
  const [tickLower] = await getTickAddress(
    ammPool.address,
    ctx.program.programId,
    tickLowerIndex
  );
  const [tickBitmapLower] = await getTickBitmapAddress(
    ammPool.address,
    ctx.program.programId,
    wordPosLowerIndex
  );
  const [tickUpper] = await getTickAddress(
    ammPool.address,
    ctx.program.programId,
    tickUpperIndex
  );
  const [tickBitmapUpper] = await getTickBitmapAddress(
    ammPool.address,
    ctx.program.programId,
    wordPosUpperIndex
  );

  // prepare observation accounts
  const [lastObservation, nextObservation] = await getObservation(ammPool);

  const positionANftAccount = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    positionState.nftMint,
    accounts.positionNftOwner
  );

  const [personalPosition] = await getPersonalPositionAddress(
    positionState.nftMint,
    ctx.program.programId
  );

  const [protocolPosition] = await getProtocolPositionAddress(
    ammPool.address,
    ctx.program.programId,
    tickLowerIndex,
    tickUpperIndex
  );

  return await collectFeeInstruction(
    ctx.program,
    {
      amount0Max,
      amount1Max,
    },
    {
      nftOwner: accounts.positionNftOwner,
      ammConfig: poolState.ammConfig,
      nftAccount: positionANftAccount,
      poolState: ammPool.address,
      protocolPosition,
      tickLower,
      tickUpper,
      tickBitmapLower,
      tickBitmapUpper,
      recipientTokenAccount0: accounts.token0Account,
      recipientTokenAccount1: accounts.token1Account,
      tokenVault0: poolState.tokenVault0,
      tokenVault1: poolState.tokenVault1,
      lastObservation,
      nextObservation,
      personalPosition,
      tokenProgram: TOKEN_PROGRAM_ID,
    }
  );
}

async function getObservation(
  ammPool: AmmPool
): Promise<[PublicKey, PublicKey]> {
  const lastObservation = (
    await getObservationAddress(
      ammPool.address,
      ammPool.ctx.program.programId,
      ammPool.poolState.observationIndex
    )
  )[0];
  let nextObservation = lastObservation;
  const { blockTimestamp: lastBlockTime } =
    await ammPool.stateFetcher.getObservationState(lastObservation);
  const slot = await ammPool.ctx.provider.connection.getSlot();
  const blockTimestamp = await ammPool.ctx.provider.connection.getBlockTime(
    slot
  );
  if (Math.floor(lastBlockTime / 14) > Math.floor(blockTimestamp / 14)) {
    nextObservation = (
      await getObservationAddress(
        ammPool.address,
        ammPool.ctx.program.programId,
        (ammPool.poolState.observationIndex + 1) %
          ammPool.poolState.observationCardinalityNext
      )
    )[0];
  }
  return [lastObservation, nextObservation];
}
