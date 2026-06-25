"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UploadCloud,
  BookOpen,
  Settings as SettingsIcon,
  ChevronRight,
  ChevronLeft,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
}

const navItems: SidebarItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Upload Statements", href: "/upload", icon: UploadCloud },
  { name: "Suggestion Journal", href: "/journal", icon: BookOpen },
  { name: "Agent Settings", href: "/settings", icon: SettingsIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Desktop Left Sidebar (Hidden on mobile, visible on md+) */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen fixed top-0 left-0 bg-white border-r border-slate-100 z-30 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.02)]",
          isExpanded ? "w-64" : "w-16"
        )}
      >
        {/* Header/Logo section */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-100">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-100 shrink-0">
              <Briefcase size={18} className="animate-pulse" />
            </div>
            {isExpanded && (
              <span className="font-semibold text-slate-800 text-sm tracking-wide whitespace-nowrap">
                PORTFOLIO.AI
              </span>
            )}
          </div>
          {isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-2 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-indigo-50/70 text-indigo-600"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <Icon
                  size={18}
                  className={cn(
                    "shrink-0 transition-transform duration-200 group-hover:scale-105",
                    isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
                {isExpanded ? (
                  <span className="whitespace-nowrap">{item.name}</span>
                ) : (
                  // Tooltip on hover when collapsed
                  <span className="absolute left-14 bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer/Toggle Button when collapsed */}
        {!isExpanded && (
          <div className="p-2 border-t border-slate-100 flex justify-center">
            <button
              onClick={() => setIsExpanded(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Navigation Bar (Hidden on md+, visible on mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-t border-slate-150 flex items-center justify-around px-2 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-20 py-1 rounded-lg text-[10px] font-medium transition-all duration-250",
                isActive ? "text-indigo-600 font-semibold" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Icon
                size={20}
                className={cn(
                  "mb-1 transition-transform duration-200",
                  isActive ? "text-indigo-600 scale-105" : "text-slate-400"
                )}
              />
              <span>{item.name.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
