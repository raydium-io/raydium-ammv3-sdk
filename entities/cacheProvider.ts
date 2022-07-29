import { PublicKey } from "@solana/web3.js";
import { Tick } from "./tickArray";


export interface CacheDataProvider {

  /**
   *  Return the next tick and tickArray info
   * @param tick  The current tick
   * @param tickSpacing  The tick spacing of the pool
   * @param zeroForOne  Whether the next tick should be lte the current tick
   */
  nextInitializedTick(
    tick: number,
    tickSpacing: number,
    zeroForOne: boolean
  ): [Tick, PublicKey, number];

}
