"use client";

import React, { useState, useEffect } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  AlertCircle, 
  HelpCircle,
  Clock, 
  Edit2, 
  ArrowUpRight, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  FileText 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SuggestionJournal, ActionTaken, OutcomeAssessment } from "@/types";
import { cn, formatINR, formatPct, formatDate } from "@/lib/utils";

interface JournalCardProps {
  entry: SuggestionJournal;
  onUpdateAction: (
    id: number,
    action_taken: ActionTaken,
    action_date?: string,
    action_notes?: string
  ) => void;
  isUpdating: boolean;
}

export default function JournalCard({
  entry,
  onUpdateAction,
  isUpdating,
}: JournalCardProps) {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [isRetroExpanded, setIsRetroExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(!entry.action_taken);

  // Form states
  const [formAction, setFormAction] = useState<ActionTaken>(entry.action_taken || "YES");
  const [formDate, setFormDate] = useState(() => {
    if (entry.action_date) return entry.action_date;
    return new Date().toISOString().split("T")[0]; // default to today
  });
  const [formNotes, setFormNotes] = useState(entry.action_notes || "");

  // Sync form states when entry changes
  useEffect(() => {
    if (entry.action_taken) {
      setFormAction(entry.action_taken);
      setFormDate(entry.action_date || new Date().toISOString().split("T")[0]);
      setFormNotes(entry.action_notes || "");
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  }, [entry]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAction(entry.id, formAction, formDate, formNotes);
  };

  // Badge helpers
  const getUrgencyStyle = (urg: string) => {
    const u = urg.toUpperCase();
    if (u === "HIGH") return "bg-rose-50 text-rose-600 border-rose-150";
    if (u === "MEDIUM") return "bg-amber-50 text-amber-600 border-amber-150";
    return "bg-slate-50 text-slate-550 border-slate-150";
  };

  const getOutcomeStyle = (out?: OutcomeAssessment) => {
    if (!out) return "bg-slate-50 text-slate-500 border-slate-100";
    if (out === "GOOD") return "bg-emerald-50 text-emerald-600 border-emerald-150";
    if (out === "BAD") return "bg-rose-50 text-rose-600 border-rose-150";
    return "bg-slate-100 text-slate-600 border-slate-200";
  };

  return (
    <Card className={`border rounded-2xl bg-white shadow-[0_0_24px_rgba(0,0,0,0.005)] overflow-hidden transition-all duration-300 ${
      entry.is_reviewed ? "border-slate-100" : "border-indigo-100/50 hover:border-indigo-200 shadow-[0_4px_20px_rgba(79,70,229,0.015)]"
    }`}>
      <CardContent className="p-5 md:p-6 space-y-4">
        
        {/* Header Row: Date chip, type, confidence */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-50 pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-50 text-slate-500 border border-slate-150 px-2 py-0.5 rounded-md uppercase tracking-wider">
              <Calendar size={10} />
              {formatDate(entry.suggestion_date)}
            </span>
            <span className="text-xs font-semibold text-slate-400">•</span>
            <Badge variant="outline" className="text-[10px] font-bold uppercase py-0.5 px-2 tracking-wide border-slate-200">
              {entry.review_type}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Confidence badge */}
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Confidence:
            </span>
            <span className={`text-[10px] font-bold uppercase border px-2 py-0.5 rounded-md ${
              entry.confidence_level === "HIGH" 
                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                : entry.confidence_level === "MEDIUM"
                ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                : "bg-slate-50 text-slate-500 border-slate-100"
            }`}>
              {entry.confidence_level}
            </span>

            {/* Urgency Badge */}
            <span className={`text-[10px] font-bold uppercase border px-2 py-0.5 rounded-md ${getUrgencyStyle(entry.urgency)}`}>
              {entry.urgency} Urgency
            </span>
          </div>
        </div>

        {/* Suggestion Text & Action Title */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
              entry.suggestion_type === "BUY"
                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                : entry.suggestion_type === "REDUCE" || entry.suggestion_type === "REBALANCE"
                ? "bg-rose-50 text-rose-600 border-rose-100"
                : "bg-slate-50 text-slate-550 border-slate-150"
            }`}>
              {entry.suggestion_type}
            </span>
            <h3 className="text-base font-bold text-slate-850 tracking-tight leading-snug">
              {entry.asset_name || "General Portfolio Advice"}
            </h3>
          </div>
          <p className="text-sm font-semibold text-slate-800 tracking-wide pl-1">
            {entry.suggestion_text}
          </p>
        </div>

        {/* Reasoning section (Collapsible) */}
        <div className="space-y-1.5 pl-1">
          <h4 className="text-xs font-semibold text-slate-550 flex items-center gap-1">
            <FileText size={12} />
            Reasoning & Market Context
          </h4>
          <div className="relative">
            <p className={`text-xs text-slate-500 leading-relaxed transition-all ${
              isReasoningExpanded ? "" : "line-clamp-3"
            }`}>
              {entry.reasoning}
            </p>
            <button
              onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline mt-1.5 transition-all"
            >
              {isReasoningExpanded ? (
                <>Show less <ChevronUp size={10} /></>
              ) : (
                <>Show full reasoning <ChevronDown size={10} /></>
              )}
            </button>
          </div>
        </div>

        {/* Tax Note Badge (Render if present) */}
        {entry.tax_note && (
          <div className="pl-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-150 px-2 py-0.5 rounded-md">
              💡 Tax implication: {entry.tax_note}
            </span>
          </div>
        )}

        {/* Action Taken Section (Interactive form vs Locked Display) */}
        <div className="border-t border-slate-50 pt-4 mt-2">
          {isEditing ? (
            // EDITING MODE (Interactive form)
            <form onSubmit={handleSubmit} className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-1">
                <Clock size={12} className="text-indigo-500" />
                <h5 className="text-xs font-bold text-slate-700">Record Your Action</h5>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Action dropdown selector */}
                <div className="space-y-1.5">
                  <Label htmlFor={`action-${entry.id}`} className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Did you act?
                  </Label>
                  <select
                    id={`action-${entry.id}`}
                    value={formAction}
                    onChange={(e) => setFormAction(e.target.value as ActionTaken)}
                    className="flex h-8 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="YES">Yes, fully executed</option>
                    <option value="PARTIAL">Partially executed</option>
                    <option value="NO">No, ignored / deferred</option>
                  </select>
                </div>

                {/* Execution date picker */}
                <div className="space-y-1.5">
                  <Label htmlFor={`date-${entry.id}`} className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Execution Date
                  </Label>
                  <Input
                    id={`date-${entry.id}`}
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="rounded-lg h-8 text-xs border-slate-200"
                  />
                </div>
              </div>

              {/* Action Notes */}
              <div className="space-y-1.5">
                <Label htmlFor={`notes-${entry.id}`} className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Execution Notes / Comments
                </Label>
                <textarea
                  id={`notes-${entry.id}`}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g., Bought 25 shares of Reliance at ₹2450. Or: Decided to hold due to capital constraints."
                  className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 justify-end">
                {entry.action_taken && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs px-4 h-8"
                >
                  {isUpdating ? "Saving..." : "Save Action"}
                </Button>
              </div>
            </form>
          ) : (
            // LOCKED DISPLAY STATE
            <div className="flex items-start justify-between bg-slate-50/55 border border-slate-100 rounded-xl p-4">
              <div className="flex gap-2.5">
                <div className="mt-0.5 shrink-0 text-indigo-600">
                  <CheckCircle2 size={16} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700">
                      User Action Logged:
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                      entry.action_taken === "YES"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : entry.action_taken === "PARTIAL"
                        ? "bg-amber-50 text-amber-600 border-amber-100"
                        : "bg-rose-50 text-rose-600 border-rose-100"
                    }`}>
                      {entry.action_taken}
                    </span>
                    {entry.action_date && (
                      <span className="text-[10px] text-slate-400 font-semibold">
                        on {formatDate(entry.action_date)}
                      </span>
                    )}
                  </div>
                  {entry.action_notes && (
                    <p className="text-xs text-slate-500 font-medium italic mt-1 leading-normal max-w-md">
                      "{entry.action_notes}"
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => setIsEditing(true)}
                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
                title="Edit Action"
              >
                <Edit2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Outcome & Retrospective Section (Only visible if is_reviewed is true) */}
        {entry.is_reviewed && (
          <div className="border-t border-slate-100 pt-4 bg-slate-50/20 rounded-b-xl -mx-5 -mb-5 p-5 border-dashed">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Outcome Evaluation:</span>
                <span className={`text-[10px] font-extrabold uppercase border px-2 py-0.5 rounded-md ${getOutcomeStyle(entry.outcome_assessment)}`}>
                  {entry.outcome_assessment}
                </span>
              </div>
              
              {entry.outcome_pct_change !== undefined && (
                <div className="flex items-center gap-1 text-xs font-bold">
                  Asset change:
                  <span className={cn(
                    "inline-flex items-center gap-0.5",
                    entry.outcome_pct_change! >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {entry.outcome_pct_change! >= 0 ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )}
                    {formatPct(entry.outcome_pct_change!)}
                  </span>
                </div>
              )}
            </div>

            {/* Retro / Lesson Learned */}
            <div className="space-y-3 mt-3">
              {/* Retro text toggle */}
              {entry.agent_retrospective && (
                <div className="space-y-1">
                  <button
                    onClick={() => setIsRetroExpanded(!isRetroExpanded)}
                    className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-all"
                  >
                    {isRetroExpanded ? "Hide Agent Retrospective" : "Read Agent Retrospective"}
                    <ChevronDown size={10} className={cn("transition-transform duration-200", isRetroExpanded && "rotate-180")} />
                  </button>
                  {isRetroExpanded && (
                    <p className="text-xs text-slate-550 leading-relaxed italic p-3 bg-white border border-slate-100 rounded-xl mt-1">
                      "{entry.agent_retrospective}"
                    </p>
                  )}
                </div>
              )}

              {/* Lesson learned block */}
              {entry.lesson_learned && (
                <div className="p-3 bg-amber-50/45 border border-amber-100 rounded-xl">
                  <h5 className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                    🧠 Lesson Learned (System adjustment)
                  </h5>
                  <p className="text-xs text-amber-900 font-medium leading-normal">
                    {entry.lesson_learned}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
