"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiService } from "@/lib/api";
import { Holding } from "@/types";
import { formatINR } from "@/lib/utils";

interface UploadZoneProps {
  uploadType: string;
  label: string;
  helpText: string;
  onSuccess?: () => void;
}

export default function UploadZone({
  uploadType,
  label,
  helpText,
  onSuccess,
}: UploadZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  });
  const [isDragActive, setIsDragActive] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedHoldings, setParsedHoldings] = useState<Holding[] | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag handers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf" || droppedFile.name.toLowerCase().endsWith(".pdf")) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError("Only PDF statement files are supported.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleParse = async () => {
    if (!file) return;
    setIsParsing(true);
    setError(null);
    
    try {
      const result = await apiService.uploadPDF(file, uploadType, period);
      setParsedHoldings(result.holdings_preview);
      setIsLocked(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Parsing failed. Please check the API log.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedHoldings(null);
    setIsLocked(false);
    setError(null);
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_0_24px_rgba(0,0,0,0.005)] flex flex-col h-full justify-between space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-slate-700 tracking-tight">{label}</h4>
        <p className="text-[10px] text-slate-400 font-medium leading-normal">{helpText}</p>
      </div>

      {/* Main Dropzone / Lock State */}
      {isLocked && parsedHoldings ? (
        // SUCCESS LOCKED PREVIEW STATE
        <div className="border border-emerald-100 bg-emerald-50/10 rounded-xl p-4 flex flex-col items-center text-center space-y-3 flex-1 justify-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-800">✓ Upload Successful</h5>
            <p className="text-[10px] text-slate-400 font-semibold uppercase mt-1">
              Period: {period} • {parsedHoldings.length} Holdings
            </p>
          </div>
          
          {/* Minimal holdings preview table */}
          <div className="w-full text-left bg-white border border-slate-100 rounded-lg overflow-hidden max-h-36 overflow-y-auto mt-2">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase">
                <tr>
                  <th className="px-2 py-1.5">Asset</th>
                  <th className="px-2 py-1.5 text-right">Qty</th>
                  <th className="px-2 py-1.5 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {parsedHoldings.slice(0, 5).map((h, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5 truncate max-w-[100px] font-medium">{h.asset_name}</td>
                    <td className="px-2 py-1.5 text-right">{h.quantity.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-800">
                      {formatINR(h.current_value_inr || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedHoldings.length > 5 && (
              <div className="p-1 text-center text-[9px] text-slate-400 border-t border-slate-100 bg-slate-50">
                + {parsedHoldings.length - 5} more holdings imported
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-[10px] text-slate-400 hover:text-slate-600 font-bold hover:bg-slate-50"
          >
            Reset & Re-upload
          </Button>
        </div>
      ) : (
        // UPLOAD DROPZONE / PROCESSING STATE
        <div className="space-y-4 flex-1 flex flex-col justify-between">
          {/* File drag-drop input box */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 relative flex-1 min-h-[140px] ${
              isDragActive
                ? "border-indigo-500 bg-indigo-50/10"
                : file
                ? "border-slate-300 bg-slate-50/30"
                : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/50"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="application/pdf"
              className="hidden"
            />
            
            {/* Spinning overlay during parsing */}
            {isParsing && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4">
                <Loader2 size={24} className="text-indigo-600 animate-spin mb-3" />
                <h5 className="text-xs font-bold text-slate-800">Reading Statement</h5>
                <p className="text-[9px] text-slate-400 font-semibold uppercase mt-1 leading-normal max-w-[150px]">
                  AI is parsing your statement... (10–30s)
                </p>
              </div>
            )}

            {file ? (
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-sm shadow-indigo-100/30">
                  <FileText size={18} />
                </div>
                <p className="text-xs font-semibold text-slate-700 truncate max-w-[180px] mx-auto">
                  {file.name}
                </p>
                <p className="text-[10px] text-slate-450">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-100/50">
                  <Upload size={18} />
                </div>
                <p className="text-xs font-semibold text-slate-600">
                  Drag & drop PDF here
                </p>
                <p className="text-[10px] text-slate-400">
                  or <span className="text-indigo-600 font-semibold underline">browse files</span>
                </p>
              </div>
            )}
          </div>

          {/* Period selector & action button */}
          <div className="space-y-3">
            {/* Period Month Selector */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Period:
              </label>
              <input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="e.g. Jun 2026"
                className="flex h-8 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
              />
            </div>

            {/* Parse trigger button */}
            <Button
              disabled={!file || isParsing}
              onClick={handleParse}
              className="w-full h-9 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-xs font-semibold transition-all shadow-sm"
            >
              Parse Statement
            </Button>
          </div>
        </div>
      )}

      {/* Localized error notification */}
      {error && (
        <Alert variant="destructive" className="border rounded-xl mt-2 p-3 bg-rose-50/30">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div className="ml-1.5">
            <AlertTitle className="text-[10px] font-bold tracking-tight">Parsing Error</AlertTitle>
            <AlertDescription className="text-[9px] text-rose-600/95 leading-normal mt-0.5">
              {error}
            </AlertDescription>
          </div>
        </Alert>
      )}
    </div>
  );
}
