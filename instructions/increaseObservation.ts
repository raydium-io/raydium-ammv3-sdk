import {
  PublicKey,
  TransactionInstruction,
  AccountMeta,
} from "@solana/web3.js";
import { Program, BN } from "@project-serum/anchor";
import { AmmCore } from "../anchor/amm_core";

type IncreaseObservationAccounts = {
  payer: PublicKey;
  poolState: PublicKey;
  systemProgram: PublicKey;
  remainings: AccountMeta[];
};

export function increaseObservationInstruction(
  program: Program<AmmCore>,
  observationAccountBumps: Buffer,
  accounts: IncreaseObservationAccounts
): Promise<TransactionInstruction> {
  const { payer, poolState, systemProgram } = accounts;
  return program.methods
    .increaseObservation(observationAccountBumps)
    .accounts({
      payer,
      poolState,
      systemProgram,
    })
    .remainingAccounts(accounts.remainings)
    .instruction();
}
