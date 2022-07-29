import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Program, BN } from "@project-serum/anchor";
import { AmmV3 } from "../../anchor/amm_v3";

export type CollectProtocolFeeAccounts = {
  owner: PublicKey;
  ammConfig: PublicKey;
  poolState: PublicKey;
  tokenVault0: PublicKey;
  tokenVault1: PublicKey;
  recipientTokenAccount0: PublicKey;
  recipientTokenAccount1: PublicKey;
  tokenProgram: PublicKey;
};

export type CollectProtocolFeeArgs = {
  amount0Requested: BN;
  amount1Requested: BN;
};

export function collectProtocolFeeInstruction(
  program: Program<AmmV3>,
  args: CollectProtocolFeeArgs,
  accounts: CollectProtocolFeeAccounts

): Promise<TransactionInstruction> {
  const { amount0Requested, amount1Requested } = args;

  return program.methods
    .collectProtocolFee(amount0Requested, amount1Requested)
    .accounts(accounts)
    .instruction();
}
