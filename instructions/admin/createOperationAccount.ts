import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Program } from "@project-serum/anchor";
import { AmmV3 } from "../../anchor/amm_v3";


export function createOperationAccountInstruction(
  program: Program<AmmV3>,
  accounts: {
    owner: PublicKey;
    operationState:PublicKey,
    systemProgram: PublicKey;
  }
): Promise<TransactionInstruction> {
  return program.methods
    .createOperationAccount()
    .accounts(accounts)
    .instruction();
}