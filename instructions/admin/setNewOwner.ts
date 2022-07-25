import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Program ,BN} from "@project-serum/anchor";
import { AmmCore } from "../../anchor/amm_core";

export type SetNewOwnerAccounts = {
    owner: PublicKey;
    newOwner: PublicKey;
    ammConfig: PublicKey;
  };
  
  export function setNewOwnerInstruction(
    program: Program<AmmCore>,
    accounts: SetNewOwnerAccounts,
  ): Promise<TransactionInstruction> {
    return  program.methods.setNewOwner().accounts(accounts).instruction()
  }

  