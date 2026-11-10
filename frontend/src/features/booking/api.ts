import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.ts";

// Tipos espelham as respostas das rotas públicas da API (backend/src/services/public.service.ts).

export type PublicService = { id: string; name: string; durationMinutes: number; priceCents: number };
export type PublicProfessional = { id: string; name: string; serviceIds: string[] };

export type PublicEstablishment = {
  name: string;
  slug: string;
  timezone: string;
  services: PublicService[];
  professionals: PublicProfessional[];
};

export type Slot = { startAt: string; time: string };
export type Availability = { date: string; timezone: string; slots: Slot[] };

export type CustomerInput = { name: string; email: string; phone: string };

export type BookingResult = {
  id: string;
  date: string;
  time: string;
  establishment: { name: string };
  service: { name: string; durationMinutes: number };
  professional: { name: string };
  priceCents: number;
};

export function useEstablishment(slug: string) {
  return useQuery({
    queryKey: ["public-establishment", slug],
    queryFn: () => api<PublicEstablishment>(`/public/establishments/${slug}`),
  });
}

type AvailabilityParams = { serviceId: string; professionalId: string; date: string };

/** Só busca quando serviço, profissional e data estão escolhidos (params !== null). */
export function useAvailability(slug: string, params: AvailabilityParams | null) {
  return useQuery({
    queryKey: ["availability", slug, params],
    queryFn: () =>
      api<Availability>(`/public/establishments/${slug}/availability?${new URLSearchParams(params!)}`),
    enabled: params !== null,
  });
}

export function useCreateAppointment(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      serviceId: string;
      professionalId: string;
      startAt: string;
      customer: CustomerInput;
      consent: boolean;
    }) => api<BookingResult>(`/public/establishments/${slug}/appointments`, { method: "POST", body }),
    // Deu certo ou deu conflito: em ambos os casos os horários livres mudaram, então buscamos de novo.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["availability", slug] }),
  });
}
