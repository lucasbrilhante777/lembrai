import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.ts";
import type { AppointmentStatus } from "../agenda/api.ts";

// Espelha backend/src/services/customers.service.ts
type CustomerStats = {
  completed: number;
  noShows: number;
  canceled: number;
  totalSpentCents: number;
  lastVisitAt: string | null;
  nextAppointmentAt: string | null;
};

export type CustomerListItem = CustomerStats & { id: string; name: string; email: string; phone: string };

export type CustomerPage = { items: CustomerListItem[]; page: number; pageSize: number; total: number; totalPages: number };

export type CustomerDetail = CustomerListItem & {
  createdAt: string;
  averageTicketCents: number;
  appointments: {
    id: string;
    status: AppointmentStatus;
    startAt: string;
    date: string;
    time: string;
    priceCents: number;
    attendeeName: string | null;
    service: string;
    professional: string;
  }[];
};

export function useCustomers(params: { search: string; page: number }) {
  const query = new URLSearchParams({ page: String(params.page) });
  if (params.search) query.set("search", params.search);
  return useQuery({
    queryKey: ["customers", params],
    queryFn: () => api<CustomerPage>(`/customers?${query}`),
    placeholderData: (previous) => previous, // troca de página sem "piscar" a lista
  });
}

export function useCustomer(id: string) {
  return useQuery({ queryKey: ["customer", id], queryFn: () => api<CustomerDetail>(`/customers/${id}`) });
}
