"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { 
  PlusCircle, 
  ArrowRight, 
  TrendingUp, 
  ShieldAlert, 
  Sparkles,
  HelpCircle
} from "lucide-react";
import { toast } from "sonner";

import { apiService } from "@/lib/api";
import NetWorthHero from "@/components/dashboard/NetWorthHero";
import AllocationGrid from "@/components/dashboard/AllocationGrid";
import AllocationBar from "@/components/dashboard/AllocationBar";
import ConcentrationRisk from "@/components/dashboard/ConcentrationRisk";
import ActiveFlags from "@/components/dashboard/ActiveFlags";
import PortfolioNews from "@/components/dashboard/PortfolioNews";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 1. Fetch dashboard summary
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["summary"],
    queryFn: () => apiService.getPortfolioSummary(),
  });

  // 2. Mutation for price refreshing
  const refreshPricesMutation = useMutation({
    mutationFn: () => apiService.refreshPrices(),
    onMutate: () => {
      toast.loading("Refreshing market prices...", { id: "refresh-prices" });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["summary"], data);
      toast.success("Holdings valuation updated successfully!", { id: "refresh-prices" });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Price refresh failed.", { id: "refresh-prices" });
    },
  });

  // 3. Mutation for running the AI monthly review
  const runReviewMutation = useMutation({
    mutationFn: () => apiService.runMonthlyReview(),
    onMutate: () => {
      toast.loading("AI Agent is compiling your monthly review... (10-30s)", { id: "run-review" });
    },
    onSuccess: () => {
      // Refetch summary and invalidate journal history queries
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      toast.success("Monthly review completed! Strategic advice updated.", { id: "run-review" });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Monthly review failed.", { id: "run-review" });
    },
  });

  // Loading Skeleton State
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Error Error State
  if (error) {
    return <DashboardError onRetry={() => queryClient.invalidateQueries({ queryKey: ["summary"] })} />;
  }

  const hasAssets = summary && Object.values(summary.holdings_by_class).some(list => list.length > 0);

  return (
    <div className="space-y-6">
      {/* Top Banner section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Wealth Console
            <Sparkles size={18} className="text-indigo-500 fill-indigo-100 animate-pulse" />
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Read-only advisory workspace for Indian compounding.
          </p>
        </div>

        {/* Action badges */}
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-md border border-emerald-100/50">
            Advisory Only
          </span>
          <span className="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md border border-indigo-100/50">
            INR Mode
          </span>
        </div>
      </div>

      {/* Conditional Layout: Cold-Start vs. Active Dashboard */}
      {!hasAssets ? (
        <DashboardEmptyState onUploadRedirect={() => router.push("/upload")} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8/12 wide on large screens): Allocations and values */}
          <div className="lg:col-span-8 space-y-6">
            <NetWorthHero
              totalValue={summary?.current_snapshot?.total_value_inr || 0}
              priorSnapshotValue={summary?.current_snapshot?.total_value_inr} // MoM will compare with itself or snapshots history
              lastUpdated={summary?.prices_last_updated}
              isRefreshing={refreshPricesMutation.isPending}
              isRunningReview={runReviewMutation.isPending}
              onRefresh={() => refreshPricesMutation.mutate()}
              onRunReview={() => runReviewMutation.mutate()}
            />

            <AllocationGrid
              holdingsByClass={summary!.holdings_by_class}
              totalVestedValue={summary?.current_snapshot?.total_value_inr || 0}
            />

            <AllocationBar
              holdingsByClass={summary!.holdings_by_class}
              totalVestedValue={summary?.current_snapshot?.total_value_inr || 0}
            />

            <ConcentrationRisk
              techConcentrationPct={summary?.current_snapshot?.tech_concentration_pct || 0}
            />
          </div>

          {/* Right Column (4/12 wide on large screens): Active Flags & News */}
          <div className="lg:col-span-4 space-y-6">
            <ActiveFlags flags={summary?.active_flags || []} />
            <PortfolioNews articles={summary?.recent_news || []} />
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== SUB-COMPONENTS (SKELETON, ERROR, EMPTY STATES) ====================

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center h-12 bg-slate-100/50 rounded-lg w-1/3 mb-4" />
      <div className="h-36 bg-slate-100/50 rounded-2xl w-full mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-100/50 rounded-xl" />
        ))}
      </div>
      <div className="h-24 bg-slate-100/50 rounded-2xl w-full mb-6" />
      <div className="h-24 bg-slate-100/50 rounded-2xl w-full" />
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 bg-white border border-rose-100 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.01)] max-w-md mx-auto my-12">
      <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-4">
        <ShieldAlert size={24} />
      </div>
      <h3 className="text-base font-semibold text-slate-800 mb-2">Failed to load dashboard</h3>
      <p className="text-xs text-slate-500 mb-6 max-w-xs leading-relaxed">
        We encountered an error connecting to the portfolio backend server. Please verify the backend is running at http://localhost:8000.
      </p>
      <Button onClick={onRetry} className="bg-indigo-600 hover:bg-indigo-700 font-medium rounded-xl px-5 py-2">
        Retry Connection
      </Button>
    </div>
  );
}

function DashboardEmptyState({ onUploadRedirect }: { onUploadRedirect: () => void }) {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-8 md:p-12 text-center max-w-2xl mx-auto my-6 shadow-[0_0_30px_rgba(0,0,0,0.015)] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/10 rounded-full blur-2xl -z-10 translate-x-8 -translate-y-8" />
      
      <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm shadow-indigo-100/30 animate-bounce">
        <TrendingUp size={28} />
      </div>
      
      <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">
        Welcome to your Portfolio AI Agent
      </h2>
      <p className="text-slate-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
        Let's get started on your long-term compounding journey. Upload your investment statements (Groww, Zerodha Kite, or US RSUs) to activate your dashboard, trigger price refreshes, and unlock AI-powered reviews.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button 
          onClick={onUploadRedirect} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-6 py-3 shadow-md shadow-indigo-100 flex items-center justify-center gap-2 transition-all duration-250 hover:-translate-y-0.5"
        >
          <PlusCircle size={18} />
          Upload Statements
          <ArrowRight size={16} />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-slate-100 mt-12 pt-8 text-left max-w-lg mx-auto">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-700">1. Ingest PDF</h4>
          <p className="text-[10px] text-slate-400 leading-normal">Drag statements from Zerodha, Groww, or MS/Fidelity.</p>
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-700">2. Refresh Prices</h4>
          <p className="text-[10px] text-slate-400 leading-normal">Live yfinance market price conversions directly in INR.</p>
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-700">3. AI Review</h4>
          <p className="text-[10px] text-slate-400 leading-normal">Get strategic feedback learning from your journal.</p>
        </div>
      </div>
    </div>
  );
}
