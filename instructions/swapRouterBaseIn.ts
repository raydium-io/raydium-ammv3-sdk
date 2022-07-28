import {
  PublicKey,
  TransactionInstruction,
  AccountMeta,
} from "@solana/web3.js";
import { Program, BN } from "@project-serum/anchor";
import { AmmCore } from "../anchor/amm_core";

type SwapRouterBaseInAccounts = {
  payer: PublicKey;
  inputTokenAccount: PublicKey;
  tokenProgram: PublicKey;
  remainings: AccountMeta[];
};

type SwapRouterBaseInArgs = {
  amountIn: BN;
  amountOutMinimum: BN;
  additionalAccountsPerPool: Buffer;
};

export function swapRouterBaseInInstruction(
  program: Program<AmmCore>,
  args: SwapRouterBaseInArgs,
  accounts: SwapRouterBaseInAccounts
): Promise<TransactionInstruction> {
  const { amountIn, amountOutMinimum, additionalAccountsPerPool } = args;

  const { payer, inputTokenAccount, tokenProgram } = accounts;

  return program.methods
    .swapRouterBaseIn(amountIn, amountOutMinimum, additionalAccountsPerPool)
    .accounts({
      payer,
      inputTokenAccount,
      tokenProgram,
    })
    .remainingAccounts(accounts.remainings)
    .instruction();
}
