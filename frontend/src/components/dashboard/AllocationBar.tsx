"use client";

import React from "react";
import { AssetClass, Holding } from "@/types";
import { formatPct } from "@/lib/utils";
import { ASSET_COLORS, ASSET_LABELS } from "@/lib/constants";

interface AllocationBarProps {
  holdingsByClass: Record<AssetClass, Holding[]>;
  totalVestedValue: number;
}

interface Segment {
  key: AssetClass;
  label: string;
  value: number;
  pct: number;
  color: string;
}

export default function AllocationBar({
  holdingsByClass,
  totalVestedValue,
}: AllocationBarProps) {
  // Helper to sum active vested holdings
  const sumVestedValue = (list: Holding[] = []) => {
    return (list || []).reduce((acc, h) => {
      if (!h.is_active || h.is_vested === false) return acc;
      return acc + (h.current_value_inr || 0);
    }, 0);
  };

  // Compile segments
  const segments: Segment[] = [];
  
  if (totalVestedValue > 0) {
    (Object.keys(holdingsByClass) as AssetClass[]).forEach((key) => {
      const val = sumVestedValue(holdingsByClass[key]);
      const pct = (val / totalVestedValue) * 100;
      
      // Only show segments with meaningful allocation
      if (pct > 0.05) {
        segments.push({
          key,
          label: ASSET_LABELS[key],
          value: val,
          pct,
          color: ASSET_COLORS[key],
        });
      }
    });
  }

  // Sort segments by percentage (highest to lowest) for the legend,
  // but keep a logical layout or sort order for the bar.
  // Sorting legend by allocation helps the user scan the biggest allocations first!
  const sortedLegend = [...segments].sort((a, b) => b.pct - a.pct);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_0_24px_rgba(0,0,0,0.015)] mb-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 tracking-wide">
        Asset Allocation Balance
      </h3>

      {/* Horizontal Stacked Bar */}
      {segments.length === 0 ? (
        <div className="w-full h-3 bg-slate-100 rounded-full flex items-center justify-center text-[10px] text-slate-400">
          No active assets to show
        </div>
      ) : (
        <div className="w-full">
          <div className="w-full h-3 bg-slate-50 rounded-full flex overflow-hidden p-0.5 border border-slate-100/30 gap-0.5">
            {segments.map((seg) => (
              <div
                key={seg.key}
                className="h-full rounded-sm transition-all duration-300 hover:opacity-90"
                style={{
                  width: `${seg.pct}%`,
                  backgroundColor: seg.color,
                }}
                title={`${seg.label}: ${formatPct(seg.pct)}`}
              />
            ))}
          </div>

          {/* Color Legend Grid */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 mt-5">
            {sortedLegend.map((seg) => (
              <div key={seg.key} className="flex items-center gap-2 text-xs">
                <span
                  className="w-3 h-3 rounded-md shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-slate-500 font-medium">{seg.label}</span>
                <span className="font-semibold text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                  {formatPct(seg.pct)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
