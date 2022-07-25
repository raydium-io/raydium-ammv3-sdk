import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Program } from "@project-serum/anchor";
import { AmmCore } from "../anchor/amm_core";

type ClosePositionAccounts = {
  nftOwner: PublicKey;
  nftAccount: PublicKey;
  ammConfig: PublicKey;
  poolState: PublicKey;
  positionNftMint: PublicKey;
  personalPosition: PublicKey;
  tokenProgram: PublicKey;
  systemProgram: PublicKey;
};

export function closePositionInstruction(
  program: Program<AmmCore>,
  accounts: ClosePositionAccounts
): Promise<TransactionInstruction> {
  return program.methods
    .closePosition()
    .accounts(accounts)
    .remainingAccounts([])
    .instruction();
}
