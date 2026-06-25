"use client";

import React from "react";
import { formatPct } from "@/lib/utils";

interface ConcentrationRiskProps {
  techConcentrationPct: number;
  threshold?: number;
}

export default function ConcentrationRisk({
  techConcentrationPct,
  threshold = 40,
}: ConcentrationRiskProps) {
  // Cap percentage at 100 for visual bar bounds
  const visualPct = Math.min(Math.max(techConcentrationPct, 0), 100);

  // Dynamic color selection based on risk levels
  let barColor = "bg-emerald-500"; // Safe (< 35%)
  let textColor = "text-emerald-600";
  let bgColor = "bg-emerald-50";

  if (techConcentrationPct > threshold) {
    barColor = "bg-rose-500 animate-pulse"; // High Risk (> 40%)
    textColor = "text-rose-600 font-bold";
    bgColor = "bg-rose-50";
  } else if (techConcentrationPct > 35) {
    barColor = "bg-amber-500"; // Warning (35-40%)
    textColor = "text-amber-600 font-semibold";
    bgColor = "bg-amber-50";
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_0_24px_rgba(0,0,0,0.015)] mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="space-y-0.5">
          <h4 className="text-sm font-semibold text-slate-700 tracking-wide">
            Tech Sector Exposure
          </h4>
          <p className="text-[10px] text-slate-400 font-medium">
            Risk Threshold: {formatPct(threshold)}
          </p>
        </div>
        <span className={`text-sm px-2.5 py-1 rounded-lg border text-xs ${textColor} ${bgColor} border-current/10 transition-colors duration-350`}>
          {formatPct(techConcentrationPct)}
        </span>
      </div>

      {/* Custom Progress Bar with Threshold Tick */}
      <div className="relative w-full h-3.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        {/* Active Value Progress Bar */}
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${visualPct}%` }}
        />
        
        {/* Visual Threshold Tick Marker at 40% */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-rose-600/70 z-10 hover:scale-x-150 transition-transform cursor-help"
          style={{ left: `${threshold}%` }}
          title={`Critical Tech Limit: ${threshold}%`}
        />
      </div>

      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
        *Caption: Includes GOOG + ORCL RSUs, IT-sector equities (NSE), and tech-weighted sector mutual funds (20% weight estimate applied to general diversified funds).
      </p>
    </div>
  );
}
