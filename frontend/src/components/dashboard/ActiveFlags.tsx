"use client";

import React from "react";
import { AlertTriangle, Info, ArrowUpRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Flag } from "@/types";

interface ActiveFlagsProps {
  flags: Flag[];
}

export default function ActiveFlags({ flags }: ActiveFlagsProps) {
  if (!flags || flags.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      <h3 className="text-xs font-semibold text-rose-500 uppercase tracking-wider mb-2">
        Active Portfolio Alerts ({flags.length})
      </h3>

      {flags.map((flag, index) => {
        const isWarning = flag.severity === "WARNING";
        
        return (
          <Alert
            key={`${flag.title}-${index}`}
            variant={isWarning ? "destructive" : "default"}
            className="border rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.01)] bg-white overflow-hidden transition-all duration-200"
          >
            {isWarning ? (
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            ) : (
              <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            )}
            
            <div className="ml-2 flex-1 space-y-1">
              <AlertTitle className="font-semibold text-sm tracking-tight text-slate-800">
                {flag.title}
              </AlertTitle>
              <AlertDescription className="text-xs text-slate-500 leading-relaxed">
                {flag.message}
                {flag.url && (
                  <div className="mt-2">
                    <a
                      href={flag.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-all"
                    >
                      Read related news article
                      <ArrowUpRight size={12} className="shrink-0" />
                    </a>
                  </div>
                )}
              </AlertDescription>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}
