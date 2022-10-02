import { BN } from "@project-serum/anchor";
import { ConfirmOptions, PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";

export const defaultConfirmOptions: ConfirmOptions = {
  preflightCommitment: "processed",
  commitment: "processed",
  skipPreflight: true,
};

export const Config = {
  url: "https://api.devnet.solana.com",
  // url: "http://127.0.0.1:8899",
  programId: new PublicKey("DEVeYuwvQnhz1roDpSwqmnWtoKTeYftM7Qt7gFPMF3tj"),
  "create-amm-config": [
    {
      index: 0,
      tickSpacing: 10,
      tradeFeeRate: 100,
      protocolFeeRate: 12000,
    },
    {
      index: 1,
      tickSpacing: 60,
      tradeFeeRate: 2500,
      protocolFeeRate: 12000,
    },
  ],
  "create-pool": [
    {
      ammConfig: "ABPi23j9qDjCeK5WwutWn6XG8sMRV7AiG1Z5bP8cViuz",
      tokenMint0: "So11111111111111111111111111111111111111112",
      tokenMint1: "G6wL1ygj4qKmjKQWXBMAsx56YxX1TFbrp7HN8wcM3z9C",
      initialPrice: new Decimal("44"),
    },
    {
      ammConfig: "ABPi23j9qDjCeK5WwutWn6XG8sMRV7AiG1Z5bP8cViuz",
      tokenMint0: "Gs8Emyo1bn6ZEwv4eLtwg6UP6bpFxpLxPLb19pL2xshP",
      tokenMint1: "G6wL1ygj4qKmjKQWXBMAsx56YxX1TFbrp7HN8wcM3z9C",
      initialPrice: new Decimal("44"),
    },
  ],
  "open-position": [
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      priceLower: new Decimal("11"),
      priceUpper: new Decimal("88"),
      liquidity: new BN("100000000"),
      amountSlippage: 0,
    },
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      priceLower: new Decimal("30"),
      priceUpper: new Decimal("40"),
      liquidity: new BN("100000000"),
      amountSlippage: 0,
    },
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      priceLower: new Decimal("50"),
      priceUpper: new Decimal("60"),
      liquidity: new BN("100000000"),
      amountSlippage: 0,
    },
    {
      poolId: "6GMhiojdccMt17YdyPx3jTWHmbjRGAUYQR44cMuTC5J1",
      priceLower: new Decimal("11"),
      priceUpper: new Decimal("88"),
      liquidity: new BN("100000000"),
      amountSlippage: 0,
    },
  ],
  "increase-liquidity": [
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      positionId: "emtdMbRh94n4h6ZgnmagpLNJdPhJouGmf7zrKZkykRZ",
      liquidity: new BN("100000000"),
      amountSlippage: 0,
    },
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      positionId: "6bRQEWxajFM7w1mWx4u9Pnz3H6VZRmn5ZgFPfZXpH6Ch",
      liquidity: new BN("100000000"),
      amountSlippage: 0,
    },
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      positionId: "8SRacz8szhhqjXFqUKUZjTH13NZyKXaiY6H97JBosWtf",
      liquidity: new BN("100000000"),
      amountSlippage: 0,
    },
  ],
  "decrease-liquidity": [
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      positionId: "emtdMbRh94n4h6ZgnmagpLNJdPhJouGmf7zrKZkykRZ",
      liquidity: new BN("100000000"),
      amountSlippage: 0,
    },
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      positionId: "6bRQEWxajFM7w1mWx4u9Pnz3H6VZRmn5ZgFPfZXpH6Ch",
      liquidity: new BN("100000000"),
      amountSlippage: 0,
    },
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      positionId: "8SRacz8szhhqjXFqUKUZjTH13NZyKXaiY6H97JBosWtf",
      liquidity: new BN("100000000"),
      amountSlippage: 0,
    },
  ],
  "swap-base-in": [
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      inputTokenMint: "So11111111111111111111111111111111111111112",
      amountIn: new BN("1000000000"),
      priceLimit: new Decimal(20),
      amountOutSlippage: 0,
    },
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      inputTokenMint: "G6wL1ygj4qKmjKQWXBMAsx56YxX1TFbrp7HN8wcM3z9C",
      amountIn: new BN("1000000"),
      priceLimit: new Decimal(0),
      amountOutSlippage: 0,
    },
  ],
  "swap-base-out": [
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      outputTokenMint: "So11111111111111111111111111111111111111112",
      amountOut: new BN("100000"),
      priceLimit: new Decimal(0),
      amountInSlippage: 0,
    },
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      outputTokenMint: "G6wL1ygj4qKmjKQWXBMAsx56YxX1TFbrp7HN8wcM3z9C",
      amountOut: new BN("100000"),
      priceLimit: new Decimal(0),
      amountInSlippage: 0,
    },
  ],
  "swap-router-base-in": {
    startPool: {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      inputTokenMint: "So11111111111111111111111111111111111111112",
    },
    remainRouterPoolIds: ["6GMhiojdccMt17YdyPx3jTWHmbjRGAUYQR44cMuTC5J1"],
    amountIn: new BN("100000"),
    amountOutSlippage: 0.005,
  },
  "initialize-reward": [
    {
      poolId: "F3nmy8a6Zbs4NPbTxfinWP6A4WcrrDeUb8qnPar9qpo1",
      rewardTokenMint: "447jZ4hRB9ZmziuRBZkMFnMSiw3rPKcPrYfio2uBeD4c",
      rewardIndex: 0,
      openTime: new BN(1662547526),
      endTime: new BN(1663302641),
      emissionsPerSecond: 0.1,
    }
  ],
};
