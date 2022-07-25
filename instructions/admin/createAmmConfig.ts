import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Program ,BN} from "@project-serum/anchor";
import { AmmCore } from "../../anchor/amm_core";


export type CreateAmmConfigAccounts = {
    owner: PublicKey;
    ammConfig: PublicKey;
    systemprogram: PublicKey;
  };
  
  export function createAmmConfigInstruction(
    program: Program<AmmCore>,
    protocolFeeRate: number,
    accounts: CreateAmmConfigAccounts
  ): Promise<TransactionInstruction> {
    return program.methods
      .createAmmConfig(protocolFeeRate)
      .accounts(accounts)
      .instruction();
  }
  