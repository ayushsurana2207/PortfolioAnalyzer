import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatINR = (v: number) => {
  if (v === undefined || v === null) return "₹0"
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 })
}

export const formatPct = (v: number) => {
  if (v === undefined || v === null) return "0.0%"
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"
}

export const formatDate = (s: string) => {
  if (!s) return "N/A"
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

