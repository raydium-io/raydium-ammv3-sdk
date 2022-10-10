#!/usr/bin/env ts-node
import {
  Connection,
  Keypair,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Context, NodeWallet } from "../base";
import { sendTransaction } from "../utils";
import { Config, defaultConfirmOptions } from "./config";
import keypairFile from "./owner-keypair.json";
import AdminKeypairFile from "./admin-keypair.json";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";

(async () => {
  const owner = Keypair.fromSeed(Uint8Array.from(keypairFile.slice(0, 32)));
  console.log("owner: ", owner.publicKey.toString());
  const admin = Keypair.fromSeed(Uint8Array.from(AdminKeypairFile.slice(0, 32)));
  console.log("admin:", admin.publicKey.toBase58());
  const connection = new Connection(
    Config.url,
    defaultConfirmOptions.commitment
  );

  const ctx = new Context(
    connection,
    NodeWallet.fromSecretKey(owner),
    Config.programId,
    defaultConfirmOptions
  );

  const mintAuthority = new Keypair();
  let ixs: TransactionInstruction[] = [];
  ixs.push(
    SystemProgram.transfer({
      fromPubkey: owner.publicKey,
      toPubkey: mintAuthority.publicKey,
      lamports: LAMPORTS_PER_SOL,
    })
  );
  await sendTransaction(ctx.connection, ixs, [owner]);

  let token0 = await Token.createMint(
    ctx.connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    6,
    TOKEN_PROGRAM_ID
  );

  let token1 = await Token.createMint(
    ctx.connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    8,
    TOKEN_PROGRAM_ID
  );
  if (token0.publicKey > token1.publicKey) {
    const temp = token0;
    token0 = token1;
    token1 = temp;
  }

  console.log("Token 0", token0.publicKey.toString());
  console.log("Token 1", token1.publicKey.toString());

  const ownerToken0Account = await token0.createAssociatedTokenAccount(
    owner.publicKey
  );
  const ownerToken1Account = await token1.createAssociatedTokenAccount(
    owner.publicKey
  );

  const adminToken0Account = await token0.createAssociatedTokenAccount(
    admin.publicKey
  );
  const adminToken1Account = await token1.createAssociatedTokenAccount(
    admin.publicKey
  );

  await token0.mintTo(ownerToken0Account, mintAuthority, [], 100_000_000_000);
  await token1.mintTo(ownerToken1Account, mintAuthority, [], 100_000_000_000);

  await token0.mintTo(adminToken0Account, mintAuthority, [], 100_000_000_000);
  await token1.mintTo(adminToken1Account, mintAuthority, [], 100_000_000_000);

  console.log("ownerToken0Account key: ", ownerToken0Account.toString());
  console.log("ownerToken1Account key: ", ownerToken1Account.toString());
  console.log("adminToken0Account key: ", adminToken0Account.toString());
  console.log("adminToken1Account key: ", adminToken1Account.toString());
})();
