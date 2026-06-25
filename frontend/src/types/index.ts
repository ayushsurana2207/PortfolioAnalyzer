export type AssetClass =
  | "STOCK"
  | "MUTUAL_FUND"
  | "GOLD"
  | "SILVER"
  | "RSU_GOOGLE"
  | "RSU_ORACLE";

export interface Holding {
  id?: number;
  asset_class: AssetClass;
  asset_name: string;
  ticker?: string;
  quantity: number;
  average_cost_inr: number;
  current_value_inr?: number;
  current_price_inr?: number;
  currency: string;
  exchange?: string;
  source: string;
  folio_number?: string;
  fund_category?: string;
  scheme_type?: string;
  grant_id?: string;
  vest_date?: string;
  is_vested?: boolean;
  sector?: string;
  is_active: boolean;
  notes?: string;
  last_price_updated_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioSnapshot {
  id?: number;
  snapshot_date: string;
  snapshot_type: string;
  total_value_inr: number;
  stocks_value_inr: number;
  mf_value_inr: number;
  gold_value_inr: number;
  silver_value_inr: number;
  rsu_google_value_inr: number;
  rsu_oracle_value_inr: number;
  unvested_rsu_value_inr: number;
  tech_concentration_pct: number;
  usd_inr_rate: number;
  notes?: string;
  created_at?: string;
}

export type SuggestionType = "BUY" | "REDUCE" | "REBALANCE" | "FLAG" | "HOLD" | "WATCH";
export type ActionTaken = "YES" | "NO" | "PARTIAL";
export type OutcomeAssessment = "GOOD" | "NEUTRAL" | "BAD";

export interface SuggestionJournal {
  id: number;
  suggestion_date: string;
  review_type: string;
  suggestion_type: SuggestionType;
  asset_class?: string;
  asset_name?: string;
  suggestion_text: string;
  reasoning: string;
  market_context?: string;
  confidence_level: string;
  urgency: string;
  tax_note?: string;
  action_taken?: ActionTaken;
  action_date?: string;
  action_notes?: string;
  review_date: string;
  portfolio_value_at_suggestion?: number;
  asset_value_at_suggestion?: number;
  asset_value_at_review?: number;
  outcome_pct_change?: number;
  outcome_assessment?: OutcomeAssessment;
  agent_retrospective?: string;
  lesson_learned?: string;
  is_reviewed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PDFUpload {
  id: number;
  filename: string;
  upload_type: string;
  upload_date: string;
  period?: string;
  parsing_status: string;
  parsed_items_count: number;
  error_message?: string;
  raw_extracted_json?: string;
  created_at?: string;
}

export interface Flag {
  severity: "WARNING" | "INFO";
  title: string;
  message: string;
  url?: string;
}

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  published_at: string;
  relevance_tag: string;
  is_negative?: boolean;
}

export interface DashboardSummary {
  current_snapshot?: PortfolioSnapshot;
  holdings_by_class: Record<AssetClass, Holding[]>;
  active_flags: Flag[];
  upcoming_vests: Holding[];
  recent_news: NewsArticle[];
  prices_last_updated?: string;
}

export interface MonthlyReviewSuggestion {
  type: SuggestionType;
  priority: number;
  asset_class: AssetClass;
  asset_name: string;
  ticker?: string;
  action: string;
  reasoning: string;
  confidence: string;
  urgency: string;
  tax_note?: string;
  estimated_impact?: string;
}

export interface MonthlyReviewResult {
  portfolio_health: "GOOD" | "FAIR" | "NEEDS_ATTENTION";
  health_summary: string;
  suggestions: MonthlyReviewSuggestion[];
  flags: { severity: "WARNING" | "INFO"; title: string; message: string }[];
  deploy_capital_hint: string;
  retrospective: string;
}

export interface DeployCapitalRecommendation {
  allocation_pct: number;
  amount_inr: number;
  asset_name: string;
  action: string;
  reasoning: string;
}

export interface DeployCapitalResult {
  amount_inr: number;
  recommendations: DeployCapitalRecommendation[];
  total_check: string;
  tax_considerations?: string;
  overall_reasoning: string;
}

export interface JournalStats {
  total: number;
  acted_yes: number;
  acted_no: number;
  acted_partial: number;
  outcome_good: number;
  outcome_neutral: number;
  outcome_bad: number;
}
