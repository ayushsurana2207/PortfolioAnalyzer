import { AssetClass } from "@/types";

export const ASSET_COLORS: Record<AssetClass, string> = {
  STOCK: "#378ADD",
  MUTUAL_FUND: "#1D9E75",
  GOLD: "#EF9F27",
  SILVER: "#9CA3AF",
  RSU_GOOGLE: "#7F77DD",
  RSU_ORACLE: "#D85A30",
};

export const ASSET_LABELS: Record<AssetClass, string> = {
  STOCK: "Indian Equities",
  MUTUAL_FUND: "Mutual Funds",
  GOLD: "Gold",
  SILVER: "Silver",
  RSU_GOOGLE: "Google RSUs (Vested)",
  RSU_ORACLE: "Oracle RSUs (Vested)",
};
