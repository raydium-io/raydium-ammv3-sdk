import { PublicKey, TransactionInstruction,AccountMeta } from "@solana/web3.js";
import { Program } from "@project-serum/anchor";
import { AmmV3 } from "../../anchor/amm_v3";

export function updateAmmConfigInstruction(
  program: Program<AmmV3>,
  params: {
    param: number;
    vaule: number;
  },
  accounts: {
    owner: PublicKey;
    ammConfig: PublicKey;
    remainings: AccountMeta[];
  },
): Promise<TransactionInstruction> {
  const { param,vaule } = params;
  return program.methods
    .updateAmmConfig(param,vaule)
    .accounts(accounts)
    .instruction();
}
