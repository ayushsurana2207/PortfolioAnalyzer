import axios from "axios";
import {
  DashboardSummary,
  Holding,
  PortfolioSnapshot,
  PDFUpload,
  MonthlyReviewResult,
  DeployCapitalResult,
  SuggestionJournal,
  JournalStats,
  ActionTaken,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const apiService = {
  // --- Portfolio Summary & Holdings ---
  async getPortfolioSummary(): Promise<DashboardSummary> {
    const { data } = await api.get<DashboardSummary>("/portfolio/summary");
    return data;
  },

  async getPortfolioHoldings(): Promise<Holding[]> {
    const { data } = await api.get<Holding[]>("/portfolio/holdings");
    return data;
  },

  async getSnapshotHistory(limit: number = 13): Promise<PortfolioSnapshot[]> {
    const { data } = await api.get<PortfolioSnapshot[]>(`/portfolio/snapshots?limit=${limit}`);
    return data;
  },

  async refreshPrices(): Promise<DashboardSummary> {
    const { data } = await api.post<DashboardSummary>("/portfolio/refresh-prices");
    return data;
  },

  // --- Statement Uploads ---
  async uploadPDF(
    file: File,
    uploadType: string,
    period: string
  ): Promise<{ upload_id: number; parsed_items_count: number; holdings_preview: Holding[] }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_type", uploadType);
    formData.append("period", period);

    const { data } = await api.post(
      "/upload/pdf",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return data;
  },

  async getUploadHistory(): Promise<PDFUpload[]> {
    const { data } = await api.get<PDFUpload[]>("/upload/history");
    return data;
  },

  // --- Strategic AI Analysis & Flags ---
  async runMonthlyReview(): Promise<MonthlyReviewResult> {
    const { data } = await api.post<MonthlyReviewResult>("/analysis/monthly-review");
    return data;
  },

  async deployCapital(amountInr: number): Promise<DeployCapitalResult> {
    const { data } = await api.post<DeployCapitalResult>("/analysis/deploy-capital", {
      amount_inr: amountInr,
    });
    return data;
  },

  async runFlags(): Promise<any[]> {
    const { data } = await api.post<any[]>("/analysis/run-flags");
    return data;
  },

  async getLatestReview(): Promise<SuggestionJournal[]> {
    const { data } = await api.get<SuggestionJournal[]>("/analysis/latest-review");
    return data;
  },

  // --- Suggestion Journal ---
  async getJournalEntries(filters?: {
    limit?: number;
    type?: string;
    outcome?: string;
  }): Promise<SuggestionJournal[]> {
    const params: Record<string, any> = { limit: filters?.limit || 50 };
    if (filters?.type && filters.type !== "ALL") params.type = filters.type;
    if (filters?.outcome && filters.outcome !== "ALL") params.outcome = filters.outcome;

    const { data } = await api.get<SuggestionJournal[]>("/journal", { params });
    return data;
  },

  async updateJournalEntryAction(
    id: number,
    action_taken: ActionTaken,
    action_date?: string,
    action_notes?: string
  ): Promise<SuggestionJournal> {
    const { data } = await api.patch<SuggestionJournal>(`/journal/${id}`, {
      action_taken,
      action_date: action_date || null,
      action_notes: action_notes || "",
    });
    return data;
  },

  async getJournalStats(): Promise<JournalStats> {
    const { data } = await api.get<JournalStats>("/journal/stats");
    return data;
  },

  // --- Manual Entries ---
  async createManualHolding(holding: {
    asset_class: string;
    asset_name: string;
    quantity: number;
    average_cost_inr: number;
    notes?: string;
  }): Promise<Holding> {
    const { data } = await api.post<Holding>("/manual/holding", holding);
    return data;
  },

  async getManualHoldings(): Promise<Holding[]> {
    const { data } = await api.get<Holding[]>("/manual/holdings");
    return data;
  },

  async updateManualHolding(
    id: number,
    holding: { quantity: number; notes?: string }
  ): Promise<Holding> {
    const { data } = await api.put<Holding>(`/manual/holding/${id}`, holding);
    return data;
  },

  async deleteManualHolding(id: number): Promise<{ detail: string }> {
    const { data } = await api.delete<{ detail: string }>(`/manual/holding/${id}`);
    return data;
  },

  // --- Alert Settings & Testing ---
  async getAppSettings(): Promise<Record<string, string>> {
    const { data } = await api.get<Record<string, string>>("/settings");
    return data;
  },

  async updateAppSettings(settings: Record<string, string>): Promise<Record<string, string>> {
    const { data } = await api.patch<Record<string, string>>("/settings", settings);
    return data;
  },

  async testTelegramNotification(): Promise<{ detail: string }> {
    const { data } = await api.post<{ detail: string }>("/settings/test-telegram");
    return data;
  },
};
