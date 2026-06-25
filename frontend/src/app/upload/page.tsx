"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  UploadCloud, 
  Database, 
  Coins, 
  History, 
  Trash2, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  FileText 
} from "lucide-react";
import { toast } from "sonner";

import { apiService } from "@/lib/api";
import UploadZone from "@/components/upload/UploadZone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR, formatDate } from "@/lib/utils";
import { Holding } from "@/types";

export default function UploadPage() {
  const queryClient = useQueryClient();
  
  // Custom Tab State: "ONBOARD" or "MONTHLY"
  const [activeTab, setActiveTab] = useState<"ONBOARD" | "MONTHLY">("ONBOARD");

  // Manual Metal Form State
  const [metalType, setMetalType] = useState<"GOLD" | "SILVER">("GOLD");
  const [metalName, setMetalName] = useState("");
  const [metalQty, setMetalQty] = useState("");
  const [metalCost, setMetalCost] = useState("");
  const [metalNotes, setMetalNotes] = useState("");

  // 1. Query for manual precious metal holdings
  const { data: manualHoldings = [], isLoading: isLoadingManual } = useQuery({
    queryKey: ["manualHoldings"],
    queryFn: () => apiService.getManualHoldings(),
  });

  // 2. Query for PDF upload history log
  const { data: uploadHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ["uploadHistory"],
    queryFn: () => apiService.getUploadHistory(),
  });

  // 3. Mutation to add a manual precious metal holding
  const addMetalMutation = useMutation({
    mutationFn: (data: {
      asset_class: string;
      asset_name: string;
      quantity: number;
      average_cost_inr: number;
      notes?: string;
    }) => apiService.createManualHolding(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manualHoldings"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] }); // Invalidate dashboard numbers too
      toast.success("Precious metal asset recorded successfully!");
      // Reset form
      setMetalName("");
      setMetalQty("");
      setMetalCost("");
      setMetalNotes("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to save metal holding.");
    },
  });

  // 4. Mutation to delete a manual holding
  const deleteMetalMutation = useMutation({
    mutationFn: (id: number) => apiService.deleteManualHolding(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manualHoldings"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      toast.success("Precious metal asset deleted successfully.");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to delete asset.");
    },
  });

  const handleAddMetal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!metalName.trim() || !metalQty || !metalCost) {
      toast.error("Please fill out all required metal fields.");
      return;
    }

    addMetalMutation.mutate({
      asset_class: metalType,
      asset_name: metalName.trim(),
      quantity: parseFloat(metalQty),
      average_cost_inr: parseFloat(metalCost),
      notes: metalNotes.trim() || undefined,
    });
  };

  // Invalidate history list when an upload succeeds
  const handleUploadSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["uploadHistory"] });
    queryClient.invalidateQueries({ queryKey: ["summary"] });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          Ingestion Center
        </h1>
        <p className="text-xs text-slate-400 font-medium">
          Upload PDF investment statements or log manual physical gold/silver holdings.
        </p>
      </div>

      {/* Tabs Navigation Selector */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full sm:w-80 border border-slate-200/40 shadow-inner">
        <button
          onClick={() => setActiveTab("ONBOARD")}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-250 ${
            activeTab === "ONBOARD"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Onboarding (Cold Start)
        </button>
        <button
          onClick={() => setActiveTab("MONTHLY")}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-250 ${
            activeTab === "MONTHLY"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Monthly Updates
        </button>
      </div>

      {/* Upload Zones Grids */}
      {activeTab === "ONBOARD" ? (
        <div className="space-y-4">
          <div className="p-4 border border-indigo-100 bg-indigo-50/10 rounded-2xl flex items-start gap-3">
            <Database className="text-indigo-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-xs font-bold text-slate-800">Initial Onboarding Mode</h4>
              <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                Upload your baseline statements to configure the agent. When you upload a statement, the agent will deactivate all previous assets from that source, establishing your current base allocations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <UploadZone
              uploadType="ONBOARD_STOCKS_KITE"
              label="Zerodha Kite (Indian Stocks)"
              helpText="Upload holdings or Tax P&L PDF from console.zerodha.com"
              onSuccess={handleUploadSuccess}
            />
            <UploadZone
              uploadType="ONBOARD_MF_GROWW"
              label="Groww (Indian Mutual Funds)"
              helpText="Upload PDF account statement from Profile -> Reports"
              onSuccess={handleUploadSuccess}
            />
            <UploadZone
              uploadType="ONBOARD_RSU_MS"
              label="Google RSUs (Morgan Stanley)"
              helpText="Upload stock benefit statement PDF from StockPlan Connect"
              onSuccess={handleUploadSuccess}
            />
            <UploadZone
              uploadType="ONBOARD_RSU_FIDELITY"
              label="Oracle RSUs (Fidelity)"
              helpText="Upload Oracle equity statement PDF from NetBenefits"
              onSuccess={handleUploadSuccess}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 border border-emerald-100 bg-emerald-50/10 rounded-2xl flex items-start gap-3">
            <UploadCloud className="text-emerald-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-xs font-bold text-slate-800">Monthly Update Mode</h4>
              <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                On the first of each month, download your latest statements and drop them here. This acts as a full refresh, keeping your net worth history and analysis accurate.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <UploadZone
              uploadType="MONTHLY_STOCKS_KITE"
              label="Kite Stocks Refresh"
              helpText="Upload current month-end Kite holdings report."
              onSuccess={handleUploadSuccess}
            />
            <UploadZone
              uploadType="MONTHLY_MF_GROWW"
              label="Groww Mutual Funds Refresh"
              helpText="Upload current month-end Groww MF statement."
              onSuccess={handleUploadSuccess}
            />
            <UploadZone
              uploadType="MONTHLY_RSU_MS"
              label="Google RSU Refresh"
              helpText="Upload current Morgan Stanley statement."
              onSuccess={handleUploadSuccess}
            />
            <UploadZone
              uploadType="MONTHLY_RSU_FIDELITY"
              label="Oracle RSU Refresh"
              helpText="Upload current Fidelity NetBenefits statement."
              onSuccess={handleUploadSuccess}
            />
          </div>
        </div>
      )}

      {/* Manual Entry section (Precious Metals) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Manual Input Form (5/12 wide) */}
        <Card className="lg:col-span-5 border border-slate-100 shadow-[0_0_24px_rgba(0,0,0,0.008)] bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Coins className="text-amber-500" size={18} />
              <h3 className="text-sm font-bold text-slate-700">Manual Precious Metals Entry</h3>
            </div>

            <form onSubmit={handleAddMetal} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500">Metal Type</Label>
                <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/40">
                  <button
                    type="button"
                    onClick={() => setMetalType("GOLD")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      metalType === "GOLD" ? "bg-white text-amber-600 shadow-sm" : "text-slate-400"
                    }`}
                  >
                    Physical Gold
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetalType("SILVER")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      metalType === "SILVER" ? "bg-white text-slate-600 shadow-sm" : "text-slate-400"
                    }`}
                  >
                    Physical Silver
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="metal-name" className="text-xs font-semibold text-slate-500">Asset Description</Label>
                <Input
                  id="metal-name"
                  type="text"
                  value={metalName}
                  onChange={(e) => setMetalName(e.target.value)}
                  placeholder="e.g. 10g Gold Coin, SGB Series 2024"
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="metal-qty" className="text-xs font-semibold text-slate-500">Weight (grams)</Label>
                  <Input
                    id="metal-qty"
                    type="number"
                    step="0.001"
                    value={metalQty}
                    onChange={(e) => setMetalQty(e.target.value)}
                    placeholder="e.g. 10.0"
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="metal-cost" className="text-xs font-semibold text-slate-500">Purchase Price / g (INR)</Label>
                  <Input
                    id="metal-cost"
                    type="number"
                    step="0.01"
                    value={metalCost}
                    onChange={(e) => setMetalCost(e.target.value)}
                    placeholder="e.g. 7200"
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="metal-notes" className="text-xs font-semibold text-slate-500">Notes (Optional)</Label>
                <Input
                  id="metal-notes"
                  type="text"
                  value={metalNotes}
                  onChange={(e) => setMetalNotes(e.target.value)}
                  placeholder="Purchase vendor, purity details..."
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <Button
                type="submit"
                disabled={addMetalMutation.isPending}
                className="w-full h-9 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <Plus size={14} />
                Add Metal Asset
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Active Manual Assets List (7/12 wide) */}
        <Card className="lg:col-span-7 border border-slate-100 shadow-[0_0_24px_rgba(0,0,0,0.008)] bg-white rounded-2xl overflow-hidden self-stretch flex flex-col justify-between">
          <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Database className="text-indigo-500" size={18} />
              <h3 className="text-sm font-bold text-slate-700">Logged Precious Metals</h3>
            </div>

            {isLoadingManual ? (
              <div className="text-center py-10 text-xs text-slate-400 animate-pulse">Loading manual holdings...</div>
            ) : manualHoldings.length === 0 ? (
              <div className="text-center py-12 text-slate-450 text-xs flex-1 flex flex-col justify-center">
                No manual precious metal assets logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto flex-1 mt-2">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100">
                    <tr>
                      <th className="px-3 py-2">Asset Description</th>
                      <th className="px-3 py-2 text-right">Weight (g)</th>
                      <th className="px-3 py-2 text-right">Current Value</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {manualHoldings.map((h: Holding) => (
                      <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-slate-800">
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            h.asset_class === "GOLD" ? "bg-amber-400" : "bg-slate-350"
                          }`} />
                          {h.asset_name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold">{h.quantity.toFixed(3)}g</td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                          {formatINR(h.current_value_inr || 0)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => h.id && deleteMetalMutation.mutate(h.id)}
                            disabled={deleteMetalMutation.isPending}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Asset"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ingestion Audit Log History */}
      <Card className="border border-slate-100 shadow-[0_0_24px_rgba(0,0,0,0.008)] bg-white rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <History className="text-slate-500" size={18} />
            <h3 className="text-sm font-bold text-slate-700">Statement Ingestion History Log</h3>
          </div>

          {isLoadingHistory ? (
            <div className="text-center py-8 text-xs text-slate-400 animate-pulse">Loading history...</div>
          ) : uploadHistory.length === 0 ? (
            <div className="text-center py-10 text-slate-450 text-xs">
              No statement uploads recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2.5">File Name</th>
                    <th className="px-3 py-2.5">Ingestion Source</th>
                    <th className="px-3 py-2.5 text-center">Period</th>
                    <th className="px-3 py-2.5">Date Processed</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-right">Items</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {uploadHistory.map((log) => {
                    const isSuccess = log.parsing_status === "SUCCESS";
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-3 font-medium text-slate-800 flex items-center gap-1.5 truncate max-w-[200px]">
                          <FileText size={14} className="text-slate-400 shrink-0" />
                          {log.filename}
                        </td>
                        <td className="px-3 py-3 font-semibold uppercase text-[10px] text-slate-500">{log.upload_type.split("_").slice(-2).join(" ")}</td>
                        <td className="px-3 py-3 text-center font-bold text-slate-700">{log.period || "N/A"}</td>
                        <td className="px-3 py-3 text-slate-450">{formatDate(log.upload_date)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                            isSuccess 
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50" 
                              : "bg-rose-50 text-rose-600 border border-rose-100/50"
                          }`}>
                            {isSuccess ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                            {log.parsing_status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-bold">{log.parsed_items_count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
