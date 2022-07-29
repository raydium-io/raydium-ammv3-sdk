import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Program, BN } from "@project-serum/anchor";
import { AmmV3 } from "../../anchor/amm_v3";

export type ResetSqrtPriceAccounts = {
  owner: PublicKey;
  ammConfig: PublicKey;
  poolState: PublicKey;
  tokenVault0: PublicKey;
  tokenVault1: PublicKey;
};

export function resetSqrtPriceInstruction(
  program: Program<AmmV3>,
  sqrt_price_x64: BN,
  accounts: ResetSqrtPriceAccounts
): Promise<TransactionInstruction> {
  return program.methods
    .resetSqrtPrice(sqrt_price_x64)
    .accounts(accounts)
    .instruction();
}
