import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Program, BN } from "@project-serum/anchor";
import { AmmCore } from "../anchor/amm_core";

type UpdateRewardInfosAccounts = {
  ammConfig: PublicKey;
  poolState: PublicKey;
};

export function updateRewardInfosInstruction(
  program: Program<AmmCore>,
  accounts: UpdateRewardInfosAccounts
): Promise<TransactionInstruction> {
  return program.methods.updateRewardInfos().accounts(accounts).instruction();
}
