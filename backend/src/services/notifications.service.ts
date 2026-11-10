import { env } from "../config/env.js";
import {
  type AppointmentEmailData,
  canceledByEstablishmentEmail,
  confirmationEmail,
  reminderEmail,
} from "../emails/appointment-emails.js";
import { mailer } from "../lib/mailer.js";
import { prisma } from "../lib/prisma.js";

/** Link que vai no e-mail. Aponta para a página do front, que pede confirmação antes de cancelar. */
export function cancelUrl(cancelToken: string) {
  return `${env.FRONTEND_URL}/cancelar/${cancelToken}`;
}

export async function sendConfirmation(appointmentId: string) {
  await mailer.send(confirmationEmail(await loadEmailData(appointmentId)));
}

export async function sendReminder(appointmentId: string) {
  await mailer.send(reminderEmail(await loadEmailData(appointmentId)));
}

export async function sendCancellationByEstablishment(appointmentId: string) {
  await mailer.send(canceledByEstablishmentEmail(await loadEmailData(appointmentId)));
}

async function loadEmailData(appointmentId: string): Promise<AppointmentEmailData> {
  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: { customer: true, service: true, professional: true, establishment: true },
  });

  return {
    to: appointment.customer.email,
    customerName: appointment.customer.name,
    establishmentName: appointment.establishment.name,
    serviceName: appointment.service.name,
    professionalName: appointment.professional.name,
    startAt: appointment.startAt,
    timezone: appointment.establishment.timezone,
    priceCents: appointment.priceCentsAtBooking,
    cancelUrl: cancelUrl(appointment.cancelToken),
    bookingUrl: `${env.FRONTEND_URL}/agenda/${appointment.establishment.slug}`,
  };
}
