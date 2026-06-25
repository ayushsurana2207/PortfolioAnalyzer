"use client";

import React from "react";
import { ExternalLink, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewsArticle } from "@/types";

interface PortfolioNewsProps {
  articles: NewsArticle[];
}

export default function PortfolioNews({ articles }: PortfolioNewsProps) {
  if (!articles || articles.length === 0) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center text-slate-400 text-xs">
        No recent news available.
      </div>
    );
  }

  // Get color styles for the relevance badges
  const getBadgeStyle = (tag: string) => {
    const t = tag.toUpperCase();
    if (t === "GOOG") return "bg-indigo-50 text-indigo-600 border-indigo-100/50 hover:bg-indigo-50";
    if (t === "ORCL") return "bg-orange-50 text-orange-600 border-orange-100/50 hover:bg-orange-50";
    if (t === "GOLD") return "bg-amber-50 text-amber-600 border-amber-100/50 hover:bg-amber-50";
    if (t === "SILVER") return "bg-slate-50 text-slate-600 border-slate-100/50 hover:bg-slate-50";
    if (t === "MARKET") return "bg-emerald-50 text-emerald-600 border-emerald-100/50 hover:bg-emerald-50";
    return "bg-slate-50 text-slate-600 border-slate-100/50 hover:bg-slate-50";
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const pubDate = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - pubDate.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      
      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins}m ago`;
      }
      if (diffHours < 24) {
        return `${diffHours}h ago`;
      }
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch (e) {
      return "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 tracking-wide">
          Asset-Targeted News
        </h3>
        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          Last 3 Days
        </span>
      </div>

      <div className="space-y-3">
        {articles.map((art, index) => {
          const isNegative = art.is_negative;
          const timeAgo = formatTimeAgo(art.published_at);
          
          return (
            <a
              key={`${art.url}-${index}`}
              href={art.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <Card
                className={`border rounded-xl bg-white shadow-[0_0_20px_rgba(0,0,0,0.002)] overflow-hidden transition-all duration-300 group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.015)] group-hover:border-slate-250 group-hover:-translate-y-0.5 ${
                  isNegative ? "border-rose-100 hover:border-rose-250 bg-rose-50/10" : "border-slate-100"
                }`}
              >
                <CardContent className="p-4 flex gap-3 justify-between items-start">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Relevance Tag Badge */}
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border tracking-wide uppercase shrink-0 ${getBadgeStyle(
                          art.relevance_tag
                        )}`}
                      >
                        {art.relevance_tag}
                      </Badge>
                      
                      {/* Negative Sentiment Alert Dot */}
                      {isNegative && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-500 font-bold bg-rose-50 border border-rose-100/40 px-1.5 py-0.5 rounded-md uppercase tracking-wider scale-95 origin-left shrink-0">
                          <AlertCircle size={10} className="fill-rose-100" />
                          Risk Alert
                        </span>
                      )}
                    </div>

                    {/* Headline */}
                    <h4 className="text-sm font-medium text-slate-750 line-clamp-2 leading-snug tracking-tight group-hover:text-indigo-600 transition-colors duration-200">
                      {art.title}
                    </h4>

                    {/* Source + Timestamp */}
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                      <span className="font-semibold text-slate-500">{art.source}</span>
                      {timeAgo && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {timeAgo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* External Link Icon */}
                  <div className="text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0 p-1 bg-slate-50 rounded-lg group-hover:bg-indigo-50/50">
                    <ExternalLink size={14} />
                  </div>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>
    </div>
  );
}
