"use client";

import React from "react";
import { RefreshCw, Play, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR, formatPct, formatDate } from "@/lib/utils";

interface NetWorthHeroProps {
  totalValue: number;
  priorSnapshotValue?: number;
  lastUpdated?: string;
  isRefreshing: boolean;
  isRunningReview: boolean;
  onRefresh: () => void;
  onRunReview: () => void;
}

export default function NetWorthHero({
  totalValue,
  priorSnapshotValue,
  lastUpdated,
  isRefreshing,
  isRunningReview,
  onRefresh,
  onRunReview,
}: NetWorthHeroProps) {
  // Calculate Month-over-Month change
  const hasMoM = priorSnapshotValue !== undefined && priorSnapshotValue > 0;
  const momChange = hasMoM ? totalValue - priorSnapshotValue! : 0;
  const momChangePct = hasMoM ? (momChange / priorSnapshotValue!) * 100 : 0;
  const isPositive = momChange >= 0;

  // Calculate Next Review Date (1st of next month)
  const getNextReviewDateStr = () => {
    const now = new Date();
    let nextMonth = now.getMonth() + 1;
    let year = now.getFullYear();
    if (nextMonth > 11) {
      nextMonth = 0;
      year += 1;
    }
    return new Date(year, nextMonth, 1).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="relative overflow-hidden bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-[0_0_24px_rgba(0,0,0,0.015)] mb-6">
      {/* Decorative background gradients for premium aesthetics */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/25 rounded-full blur-3xl -z-10 translate-x-10 -translate-y-10" />
      <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-emerald-50/20 rounded-full blur-3xl -z-10 translate-y-1/2" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left Section: Net Worth numbers */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Vested Net Worth
          </p>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-4xl md:text-5xl font-semibold text-slate-800 tracking-tight">
              {formatINR(totalValue)}
            </h1>
            {hasMoM && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full",
                  isPositive
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    : "bg-rose-50 text-rose-600 border border-rose-100"
                )}
              >
                {isPositive ? "↑" : "↓"} {formatPct(Math.abs(momChangePct))}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            {lastUpdated && (
              <span>
                Last updated: <strong className="text-slate-500">{formatDate(lastUpdated)}</strong>
              </span>
            )}
            <span className="hidden sm:inline-block text-slate-200">•</span>
            <span className="flex items-center gap-1">
              <Calendar size={12} className="text-slate-400" />
              Next review: <strong className="text-slate-500">{getNextReviewDateStr()}</strong>
            </span>
          </div>
        </div>

        {/* Right Section: Core Controls */}
        <div className="flex items-center gap-3 self-start md:self-center shrink-0">
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing || isRunningReview}
            className="flex items-center justify-center w-10 h-10 p-0 rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm"
            title="Refresh Unit Prices"
          >
            <RefreshCw
              size={16}
              className={cn("transition-transform duration-500", isRefreshing && "animate-spin")}
            />
          </Button>

          <Button
            variant="outline"
            onClick={onRunReview}
            disabled={isRefreshing || isRunningReview}
            className="flex items-center gap-2 px-5 h-10 rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50/50 hover:text-indigo-700 font-medium transition-all duration-200 shadow-sm shadow-indigo-50"
          >
            <Play
              size={14}
              className={cn("fill-current", isRunningReview && "hidden")}
            />
            {isRunningReview ? (
              <>
                <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                Reviewing...
              </>
            ) : (
              "Run Monthly Review"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Inline helper to avoid complex imports
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
