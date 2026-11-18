export const ORDER_FLOW = [
  "PENDING",
  "PREPARING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
] as const;

export const TRACK_STEPS = [
  { id: "received", label: "Eingegangen" },
  { id: "preparing", label: "In Zubereitung" },
  { id: "ready", label: "Bereit" },
  { id: "on_the_way", label: "Unterwegs" },
  { id: "delivered", label: "Geliefert" },
] as const;

export type TrackStepState = "done" | "current" | "upcoming" | "skipped";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Wartet auf das Restaurant",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  PREPARING: "In Zubereitung",
  READY_FOR_PICKUP: "Bereit",
  OUT_FOR_DELIVERY: "Unterwegs",
  COMPLETED: "Geliefert",
  CANCELLED: "Storniert",
};

export function orderCode(publicNumber: number) {
  return `PB-${String(publicNumber).padStart(4, "0")}`;
}

export function statusLabel(status: string, fulfillment?: "DELIVERY" | "PICKUP" | string) {
  if (status === "READY_FOR_PICKUP" && fulfillment === "PICKUP") return "Bereit zur Abholung";
  if (status === "COMPLETED" && fulfillment === "PICKUP") return "Abgeholt";
  return STATUS_LABELS[status] ?? status;
}

export function customerStatusMessage(status: string, fulfillment?: "DELIVERY" | "PICKUP" | string) {
  if (status === "PREPARING") return "Deine Bestellung wird zubereitet.";
  if (status === "READY_FOR_PICKUP") {
    return fulfillment === "PICKUP" ? "Deine Bestellung ist abholbereit." : "Deine Bestellung ist bereit.";
  }
  if (status === "OUT_FOR_DELIVERY") return "Deine Bestellung ist unterwegs.";
  if (status === "COMPLETED") {
    return fulfillment === "PICKUP" ? "Deine Bestellung wurde abgeholt." : "Deine Bestellung wurde geliefert.";
  }
  if (status === "CANCELLED") return "Deine Bestellung wurde storniert.";
  if (status === "REJECTED") return "Deine Bestellung wurde abgelehnt.";
  if (status === "ACCEPTED") return "Das Restaurant hat deine Bestellung angenommen.";
  return "Wir haben deine Bestellung erhalten.";
}

export function activeTrackIndex(status: string) {
  if (status === "CANCELLED" || status === "REJECTED") return null;
  if (status === "PREPARING") return 1;
  if (status === "READY_FOR_PICKUP") return 2;
  if (status === "OUT_FOR_DELIVERY") return 3;
  if (status === "COMPLETED") return 4;
  return 0;
}

export function trackStepState(index: number, status: string, fulfillment?: "DELIVERY" | "PICKUP" | string): TrackStepState {
  if (fulfillment === "PICKUP" && index === 3) return "skipped";
  const active = activeTrackIndex(status);
  if (active === null) return "upcoming";
  if (index < active) return "done";
  if (index === active) return "current";
  return "upcoming";
}

export const ADMIN_STATUS_OPTIONS = [
  { value: "PENDING", label: "Wartet auf das Restaurant" },
  { value: "ACCEPTED", label: "Angenommen" },
  { value: "PREPARING", label: "In Zubereitung" },
  { value: "READY_FOR_PICKUP", label: "Bereit" },
  { value: "OUT_FOR_DELIVERY", label: "Unterwegs" },
  { value: "COMPLETED", label: "Geliefert" },
  { value: "REJECTED", label: "Abgelehnt" },
  { value: "CANCELLED", label: "Storniert" },
] as const;
