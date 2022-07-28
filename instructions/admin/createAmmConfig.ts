import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Program ,BN} from "@project-serum/anchor";
import { AmmCore } from "../../anchor/amm_core";


export type CreateAmmConfigAccounts = {
    owner: PublicKey;
    ammConfig: PublicKey;
    systemProgram: PublicKey;
  };
  
  export function createAmmConfigInstruction(
    program: Program<AmmCore>,
    index:number,
    tickSpacing:number,
    globalFeeRate:number,
    protocolFeeRate: number,
    accounts: CreateAmmConfigAccounts
  ): Promise<TransactionInstruction> {
    return program.methods
      .createAmmConfig(index,tickSpacing,globalFeeRate,protocolFeeRate)
      .accounts(accounts)
      .instruction();
  }
  