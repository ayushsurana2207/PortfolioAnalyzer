"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AssetClass, Holding } from "@/types";
import { formatINR, formatPct } from "@/lib/utils";
import { ASSET_COLORS } from "@/lib/constants";

interface AllocationGridProps {
  holdingsByClass: Record<AssetClass, Holding[]>;
  totalVestedValue: number;
}

export default function AllocationGrid({
  holdingsByClass,
  totalVestedValue,
}: AllocationGridProps) {
  // Helper to sum active holdings values
  const sumHoldingsValue = (list: Holding[] = [], vestedOnly: boolean = true) => {
    return (list || []).reduce((acc, h) => {
      if (!h.is_active) return acc;
      // Filter by vesting if requested
      if (vestedOnly && h.is_vested === false) return acc;
      if (!vestedOnly && h.is_vested !== false) return acc;
      return acc + (h.current_value_inr || 0);
    }, 0);
  };

  // Calculate totals
  const stocksVal = sumHoldingsValue(holdingsByClass["STOCK"]);
  const mfVal = sumHoldingsValue(holdingsByClass["MUTUAL_FUND"]);
  
  const goldVal = sumHoldingsValue(holdingsByClass["GOLD"]);
  const silverVal = sumHoldingsValue(holdingsByClass["SILVER"]);
  const metalsVal = goldVal + silverVal;

  const googleVested = sumHoldingsValue(holdingsByClass["RSU_GOOGLE"], true);
  const oracleVested = sumHoldingsValue(holdingsByClass["RSU_ORACLE"], true);
  const rsuVestedVal = googleVested + oracleVested;

  // Unvested RSUs (Informational only)
  const googleUnvested = sumHoldingsValue(holdingsByClass["RSU_GOOGLE"], false);
  const oracleUnvested = sumHoldingsValue(holdingsByClass["RSU_ORACLE"], false);
  const rsuUnvestedVal = googleUnvested + oracleUnvested;

  const getPercentageStr = (val: number) => {
    if (totalVestedValue <= 0) return "0.0%";
    const pct = (val / totalVestedValue) * 100;
    return formatPct(pct);
  };

  const cards = [
    {
      title: "Indian Equities",
      value: stocksVal,
      color: ASSET_COLORS.STOCK,
      subtext: null,
    },
    {
      title: "Mutual Funds",
      value: mfVal,
      color: ASSET_COLORS.MUTUAL_FUND,
      subtext: null,
    },
    {
      title: "Gold & Silver",
      value: metalsVal,
      color: ASSET_COLORS.GOLD, // Uses gold color as dominant
      subtext: `Gold: ${getPercentageStr(goldVal)} • Silver: ${getPercentageStr(silverVal)}`,
    },
    {
      title: "Vested RSUs",
      value: rsuVestedVal,
      color: ASSET_COLORS.RSU_GOOGLE, // Uses Google color as dominant
      subtext: rsuUnvestedVal > 0 ? `Unvested: ${formatINR(rsuUnvestedVal)} (Info)` : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => {
        const pctText = getPercentageStr(card.value);
        
        return (
          <Card
            key={card.title}
            className="border border-slate-100 shadow-[0_0_20px_rgba(0,0,0,0.005)] rounded-xl overflow-hidden bg-white hover:shadow-[0_4px_24px_rgba(0,0,0,0.015)] transition-all duration-350 hover:-translate-y-0.5"
          >
            <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between gap-2">
                {/* Colored Dot + Asset Name */}
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: card.color }}
                  />
                  <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                    {card.title}
                  </span>
                </div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50/70 px-1.5 py-0.5 rounded">
                  {pctText}
                </span>
              </div>

              {/* Value and subtext */}
              <div className="space-y-1">
                <h3 className="text-2xl font-semibold text-slate-800 tracking-tight">
                  {formatINR(card.value)}
                </h3>
                {card.subtext && (
                  <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                    {card.subtext}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
