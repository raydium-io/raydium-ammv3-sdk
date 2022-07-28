import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Program, BN } from "@project-serum/anchor";
import { AmmCore } from "../anchor/amm_core";

type IncreaseLiquidityAccounts = {
  nftOwner: PublicKey;
  nftAccount: PublicKey;
  ammConfig: PublicKey;
  poolState: PublicKey;
  protocolPosition: PublicKey;
  personalPosition: PublicKey;
  tickArrayLower: PublicKey;
  tickArrayUpper: PublicKey;
  tokenAccount0: PublicKey;
  tokenAccount1: PublicKey;
  tokenVault0: PublicKey;
  tokenVault1: PublicKey;
  tokenProgram: PublicKey;
};

type IncreaseLiquidityArgs = {
  amount0Desired: BN;
  amount1Desired: BN;
  amount0Min: BN;
  amount1Min: BN;
};

export function increaseLiquidityInstruction(
  program: Program<AmmCore>,
  args: IncreaseLiquidityArgs,
  accounts: IncreaseLiquidityAccounts
): Promise<TransactionInstruction> {
  const { amount0Desired, amount1Desired, amount0Min, amount1Min } = args;

  return program.methods
    .increaseLiquidity(amount0Desired, amount1Desired, amount0Min, amount1Min)
    .accounts(accounts)
    .remainingAccounts([])
    .instruction();
}
