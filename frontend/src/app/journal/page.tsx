"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Award, CheckCircle2, TrendingUp, Filter } from "lucide-react";
import { toast } from "sonner";

import { apiService } from "@/lib/api";
import JournalCard from "@/components/journal/JournalCard";
import { Card, CardContent } from "@/components/ui/card";
import { ActionTaken } from "@/types";

export default function JournalPage() {
  const queryClient = useQueryClient();

  // Filters State
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("ALL");

  // 1. Query for journal stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["journalStats"],
    queryFn: () => apiService.getJournalStats(),
  });

  // 2. Query for filtered journal entries
  const { data: entries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ["journal", typeFilter, outcomeFilter],
    queryFn: () => apiService.getJournalEntries({
      limit: 50,
      type: typeFilter,
      outcome: outcomeFilter,
    }),
  });

  // 3. Mutation to record a user action response
  const updateActionMutation = useMutation({
    mutationFn: (vars: {
      id: number;
      action_taken: ActionTaken;
      action_date?: string;
      action_notes?: string;
    }) => apiService.updateJournalEntryAction(
      vars.id,
      vars.action_taken,
      vars.action_date,
      vars.action_notes
    ),
    onSuccess: () => {
      // Invalidate all related queries to force synchronization
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: ["journalStats"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      toast.success("Your action response has been successfully recorded!");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to record action.");
    },
  });

  // Calculate Action Execution Rate
  const getActionRate = () => {
    if (!stats || stats.total === 0) return 0;
    const executed = stats.acted_yes + stats.acted_partial;
    return (executed / stats.total) * 100;
  };

  // Calculate Positive Outcome Rate
  const getOutcomeSuccessRate = () => {
    if (!stats || stats.total === 0) return 0;
    const graded = stats.outcome_good + stats.outcome_neutral + stats.outcome_bad;
    if (graded === 0) return 0;
    return (stats.outcome_good / graded) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          Suggestion Journal
        </h1>
        <p className="text-xs text-slate-400 font-medium">
          Track agent suggestions, log your investment actions, and analyze subsequent compounding outcomes.
        </p>
      </div>

      {/* Stats Cards Bar */}
      {isLoadingStats ? (
        <div className="grid grid-cols-3 gap-4 animate-pulse h-20 bg-slate-50 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tile 1: Total Advice */}
          <Card className="border border-slate-100 shadow-[0_0_20px_rgba(0,0,0,0.002)] bg-white rounded-xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <BookOpen size={18} />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total Recommendations
                </p>
                <h3 className="text-xl font-bold text-slate-800">
                  {stats?.total || 0}
                </h3>
              </div>
            </CardContent>
          </Card>

          {/* Tile 2: Action Execution Rate */}
          <Card className="border border-slate-100 shadow-[0_0_20px_rgba(0,0,0,0.002)] bg-white rounded-xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Action Execution Rate
                </p>
                <h3 className="text-xl font-bold text-slate-800">
                  {getActionRate().toFixed(1)}%
                  <span className="text-[9px] text-slate-400 font-normal ml-1.5 lowercase">
                    ({(stats?.acted_yes || 0) + (stats?.acted_partial || 0)} / {stats?.total || 0} acted)
                  </span>
                </h3>
              </div>
            </CardContent>
          </Card>

          {/* Tile 3: Positive Outcomes */}
          <Card className="border border-slate-100 shadow-[0_0_20px_rgba(0,0,0,0.002)] bg-white rounded-xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <TrendingUp size={18} />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Compounding Success Rate
                </p>
                <h3 className="text-xl font-bold text-slate-800">
                  {getOutcomeSuccessRate().toFixed(1)}%
                  <span className="text-[9px] text-slate-400 font-normal ml-1.5 lowercase">
                    ({stats?.outcome_good || 0} / {
                      (stats?.outcome_good || 0) + (stats?.outcome_neutral || 0) + (stats?.outcome_bad || 0)
                    } graded GOOD)
                  </span>
                </h3>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-100 rounded-xl p-4 shadow-[0_0_20px_rgba(0,0,0,0.002)]">
        <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold">
          <Filter size={14} className="text-slate-400" />
          Filter Suggestions:
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Advice Type Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="type-filter" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Type:
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex h-8 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Types</option>
              <option value="MONTHLY">Monthly Reviews</option>
              <option value="FLAG">Flag Engine</option>
              <option value="CAPITAL_DEPLOY">Capital Deployment</option>
            </select>
          </div>

          {/* Outcome Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="outcome-filter" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Outcome:
            </label>
            <select
              id="outcome-filter"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="flex h-8 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Outcomes</option>
              <option value="GOOD">Good Performance</option>
              <option value="NEUTRAL">Neutral Performance</option>
              <option value="BAD">Underperformance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Suggestion Cards Listing */}
      {isLoadingEntries ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-slate-100/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-450 text-sm max-w-md mx-auto my-6 shadow-[0_0_24px_rgba(0,0,0,0.005)]">
          <BookOpen className="mx-auto mb-4 text-slate-300" size={28} />
          <h4 className="font-semibold text-slate-700 mb-1">No Journal Entries Found</h4>
          <p className="text-xs text-slate-400 leading-normal">
            No recommendations match your current filter settings. Complete a monthly review to generate strategic advice.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <JournalCard
              key={entry.id}
              entry={entry}
              onUpdateAction={(id, action, date, notes) =>
                updateActionMutation.mutate({
                  id,
                  action_taken: action,
                  action_date: date,
                  action_notes: notes,
                })
              }
              isUpdating={
                updateActionMutation.isPending && 
                updateActionMutation.variables?.id === entry.id
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
