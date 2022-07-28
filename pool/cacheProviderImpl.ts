import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@project-serum/anchor";

import { MAX_TICK, MIN_TICK } from "../math";
import { CacheDataProvider } from "../entities/cacheProvider";
import { getTickArrayAddress } from "../utils";
import {
  TICK_ARRAY_SIZE,
  Tick,
  TickArray,
  getArrayStartIndex,
  getNextTickArrayStartIndex,
} from "../entities";

// interface Tick {
//   tick: number;
//   liquidityNet: BN;
//   liquidityGross: BN;
//   secondsPerLiquidityOutsideX64: BN;
// }

const FETCH_TICKARRAY_COUNT = 15;

export declare type PoolVars = {
  key: PublicKey;
  token0: PublicKey;
  token1: PublicKey;
  fee: number;
};

// export declare type TickArray = {
//   address: PublicKey;
//   startIndex: BN;
//   ticks: Tick[];
// };

export class CacheDataProviderImpl implements CacheDataProvider {
  // @ts-ignore
  program: anchor.Program<AmmCore>;
  poolAddress: PublicKey;

  tickArrayCache: Map<number, TickArray | undefined>;

  // @ts-ignore
  constructor(program: anchor.Program<AmmCore>, poolAddress: PublicKey) {
    this.program = program;
    this.poolAddress = poolAddress;
    this.tickArrayCache = new Map();
  }

  /**
   * Caches ticks and bitmap accounts near the current price
   * @param tickCurrent The current pool tick
   * @param tickSpacing The pool tick spacing
   */
  async loadTickArrayCache(tickCurrent: number, tickSpacing: number) {
    const tickArraysToFetch = [];
    const startIndex = getArrayStartIndex(tickCurrent, tickSpacing);
    const [tickArrayAddress, _] = await getTickArrayAddress(
      this.poolAddress,
      this.program.programId,
      startIndex
    );
    tickArraysToFetch.push(startIndex);
    console.log(
      "tickArrayAddress: ",
      tickArrayAddress.toString(),
      "startIndex: ",
      startIndex
    );
    try {
      const fetchedState = await this.program.account.tickArrayState.fetch(
        tickArrayAddress
      );
      const fetchedTickArray = fetchedState as TickArray;
      console.log(
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~fetchedState: ",
        fetchedState,
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~fetchedTickArray: ",
        fetchedTickArray
      );
      this.tickArrayCache.set(fetchedTickArray.startIndex, fetchedTickArray);
    } catch (error) {
      console.log(error);
    }
    return;
    try {
      let lastStartIndex: number = startIndex;
      for (let i = 0; i < FETCH_TICKARRAY_COUNT / 2; i++) {
        const nextStartIndex = getNextTickArrayStartIndex(
          lastStartIndex,
          tickSpacing,
          true
        );
        const [tickArrayAddress, _] = await getTickArrayAddress(
          this.poolAddress,
          this.program.programId,
          nextStartIndex
        );
        tickArraysToFetch.push(tickArrayAddress);
        lastStartIndex = nextStartIndex;
        console.log(
          "tickArrayAddress: ",
          tickArrayAddress.toString(),
          "startIndex: ",
          nextStartIndex
        );
      }
      lastStartIndex = startIndex;
      for (let i = 0; i < FETCH_TICKARRAY_COUNT / 2; i++) {
        const nextStartIndex = getNextTickArrayStartIndex(
          lastStartIndex,
          tickSpacing,
          false
        );
        const [tickArrayAddress, _] = await getTickArrayAddress(
          this.poolAddress,
          this.program.programId,
          nextStartIndex
        );
        tickArraysToFetch.push(tickArrayAddress);
        lastStartIndex = nextStartIndex;
        console.log(
          "tickArrayAddress: ",
          tickArrayAddress.toString(),
          "startIndex: ",
          nextStartIndex
        );
      }
      const fetchedTickArrays =
        (await this.program.account.tickArrayState.fetchMultiple(
          tickArraysToFetch
        )) as (TickArray | null)[];
      console.log("fetchedTickArrays: ", fetchedTickArrays);

      for (let i = 0; i < FETCH_TICKARRAY_COUNT; i++) {
        fetchedTickArrays[i];

        this.tickArrayCache.set(
          fetchedTickArrays[i].startIndex,
          fetchedTickArrays[i]
        );
      }
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * Fetches the cached bitmap for the word
   * @param startIndex
   */
  getTickArray(startIndex: number): TickArray {
    let savedTickArray = this.tickArrayCache.get(startIndex);
    if (!savedTickArray) {
      throw new Error("Bitmap not cached");
    }
    return savedTickArray;
  }

  /**
   * Finds the next initialized tick in the given word. Fetched bitmaps are saved in a
   * cache for quicker lookups in future.
   * @param tickIndex The current tick
   * @param zeroForOne Whether to look for a tick less than or equal to the current one, or a tick greater than or equal to
   * @param tickSpacing The tick spacing for the pool
   * @returns
   */
  nextInitializedTick(
    tickIndex: number,
    tickSpacing: number,
    zeroForOne: boolean
  ): [Tick, PublicKey, number] {
    let [nextTick, address, startIndex] = this.nextInitializedTickInOneArray(
      tickIndex,
      tickSpacing,
      zeroForOne
    );
    while (nextTick.liquidityGross.lten(0)) {
      const nextStartIndex = getNextTickArrayStartIndex(
        startIndex,
        tickSpacing,
        zeroForOne
      );
      const cachedTickArray = this.getTickArray(nextStartIndex);
      if (cachedTickArray == undefined) {
        throw new Error("No invaild tickArray cache");
      }
      [nextTick, address, startIndex] = this.firstInitializedTickInOneArray(
        cachedTickArray,
        zeroForOne
      );
    }
    return [nextTick, address, startIndex];
  }

  firstInitializedTickInOneArray(
    tickArray: TickArray,
    zeroForOne: boolean
  ): [Tick, PublicKey, number] {
    let nextInitializedTick: Tick;
    if (zeroForOne) {
      let i = TICK_ARRAY_SIZE - 1;
      while (i >= 0) {
        const tickInArray = tickArray.ticks[i];
        if (tickInArray.liquidityGross.gtn(0)) {
          nextInitializedTick = tickInArray;
        }
        i = i - 1;
      }
    } else {
      let i = 0;
      while (i < TICK_ARRAY_SIZE) {
        const tickInArray = tickArray.ticks[i];
        if (tickInArray.liquidityGross.gtn(0)) {
          nextInitializedTick = tickInArray;
        }
        i = i + 1;
      }
    }
    return [nextInitializedTick, tickArray.address, tickArray.startIndex];
  }

  /**
   *
   * @param tickIndex
   * @param tickSpacing
   * @param zeroForOne
   * @returns
   */
  nextInitializedTickInOneArray(
    tickIndex: number,
    tickSpacing: number,
    zeroForOne: boolean
  ): [Tick, PublicKey, number] {
    const startIndex = getArrayStartIndex(tickIndex, tickSpacing);
    let tickPositionInArray = (tickIndex - startIndex) / tickSpacing;
    const cachedTickArray = this.getTickArray(startIndex);
    let nextInitializedTick: Tick;
    if (zeroForOne) {
      let i = tickPositionInArray;
      while (i >= 0) {
        const tickInArray = cachedTickArray.ticks[i];
        if (tickInArray.liquidityGross.gtn(0)) {
          nextInitializedTick = tickInArray;
        }
        i = i - 1;
      }
    } else {
      let i = 0;
      while (i < TICK_ARRAY_SIZE) {
        const tickInArray = cachedTickArray.ticks[i];
        if (tickInArray.liquidityGross.gtn(0)) {
          nextInitializedTick = tickInArray;
        }
        i = i + 1;
      }
    }
    return [
      nextInitializedTick,
      cachedTickArray.address,
      cachedTickArray.startIndex,
    ];
  }
}
