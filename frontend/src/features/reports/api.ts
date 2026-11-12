import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.ts";

// Espelha backend/src/services/reports.service.ts
export type ReportSummary = {
  from: string;
  to: string;
  timezone: string;
  totals: {
    revenueCents: number;
    completed: number;
    noShows: number;
    canceled: number;
    scheduled: number;
    averageTicketCents: number;
    noShowRate: number | null;
  };
  previous: { from: string; to: string; revenueCents: number; completed: number };
  byDay: { date: string; revenueCents: number; completed: number }[];
  byService: { id: string; name: string; completed: number; revenueCents: number }[];
  byProfessional: { id: string; name: string; completed: number; noShows: number; revenueCents: number }[];
};

export function useReportSummary(range: { from: string; to: string }) {
  return useQuery({
    queryKey: ["report-summary", range],
    queryFn: () => api<ReportSummary>(`/reports/summary?${new URLSearchParams(range)}`),
    placeholderData: (previous) => previous, // ao trocar o período, mantém o anterior na tela até o novo chegar
  });
}
