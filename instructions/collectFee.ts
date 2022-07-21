import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Program, BN } from "@project-serum/anchor";
import { AmmCore } from "../anchor/amm_core";
import { DecreaseLiquidityAccounts } from "./decreaseLiquidity";

type CollectFeeAccounts = {} & DecreaseLiquidityAccounts;

type CollectFeeArgs = {
  amount0Max: BN;
  amount1Max: BN;
};

export function collectFeeInstruction(
  program: Program<AmmCore>,
  args: CollectFeeArgs,
  accounts: CollectFeeAccounts
): Promise<TransactionInstruction> {
  const { amount0Max, amount1Max } = args;
  return program.methods
    .collectFee(amount0Max, amount1Max)
    .accounts(accounts)
    .remainingAccounts([])
    .instruction();
}
