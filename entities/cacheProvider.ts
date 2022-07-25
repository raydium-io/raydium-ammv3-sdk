import { PublicKey } from "@solana/web3.js";
import { web3, BN } from "@project-serum/anchor"; 
/**
 * Provides information about ticks
 */
export interface CacheDataProvider {

  /**
   * Return the next tick that is initialized within a single word
   * @param tick The current tick
   * @param lte Whether the next tick should be lte the current tick
   * @param tickSpacing The tick spacing of the pool
   */
  nextInitializedTickWithinOneWord(
    tick: number,
    lte: boolean,
    tickSpacing: number
  ): [number, boolean, number, number, PublicKey];

  getTickLiquidityNet(tick: number): {
    address: web3.PublicKey;
    liquidityNet: BN;
  };
}
