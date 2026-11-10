import { getItemById } from "@/content/menu";
import {
  makeLineId,
  unitPriceCents,
  type CartSelection,
} from "@/content/ordering";

export type CartLine = {
  lineId: string;
  itemId: string;
  quantity: number;
  selection: CartSelection;
  note: string;
};

export const CART_STORAGE_KEY = "bisswerk.cart.v1";
export const MAX_QUANTITY = 20;
const MAX_NOTE = 140;

const listeners = new Set<() => void>();
const serverSnapshot: CartLine[] = [];
let snapshot: CartLine[] = serverSnapshot;
let hydrated = false;

function emit() {
  for (const listener of listeners) listener();
}

function isSelection(value: unknown): value is CartSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(
    (entry) =>
      Array.isArray(entry) && entry.every((choice) => typeof choice === "string"),
  );
}

function sanitize(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const lines: CartLine[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<CartLine>;
    if (typeof candidate.itemId !== "string" || typeof candidate.lineId !== "string") {
      continue;
    }
    try {
      getItemById(candidate.itemId);
    } catch {
      continue;
    }
    const quantity = candidate.quantity;
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      continue;
    }
    if (!isSelection(candidate.selection)) continue;
    const note = typeof candidate.note === "string" ? candidate.note.slice(0, MAX_NOTE) : "";
    lines.push({
      lineId: candidate.lineId,
      itemId: candidate.itemId,
      quantity,
      selection: candidate.selection,
      note,
    });
  }
  return lines;
}

function readStorage(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode or a full disk should not break the demo.
  }
}

function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  if (typeof window === "undefined") return;
  snapshot = readStorage();
}

export const cartStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return snapshot;
  },
  getServerSnapshot() {
    return serverSnapshot;
  },
  addLine(input: {
    itemId: string;
    quantity: number;
    selection: CartSelection;
    note: string;
  }) {
    ensureHydrated();
    const note = input.note.trim().slice(0, MAX_NOTE);
    const quantity = Math.min(MAX_QUANTITY, Math.max(1, Math.floor(input.quantity)));
    const lineId = makeLineId(input.itemId, input.selection, note);
    const existing = snapshot.find((line) => line.lineId === lineId);
    snapshot = existing
      ? snapshot.map((line) =>
          line.lineId === lineId
            ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + quantity) }
            : line,
        )
      : [
          ...snapshot,
          {
            lineId,
            itemId: input.itemId,
            quantity,
            selection: input.selection,
            note,
          },
        ];
    persist();
    emit();
  },
  setQuantity(lineId: string, quantity: number) {
    ensureHydrated();
    if (!Number.isInteger(quantity) || quantity < 1) {
      snapshot = snapshot.filter((line) => line.lineId !== lineId);
    } else {
      const next = Math.min(MAX_QUANTITY, quantity);
      snapshot = snapshot.map((line) =>
        line.lineId === lineId ? { ...line, quantity: next } : line,
      );
    }
    persist();
    emit();
  },
  removeLine(lineId: string) {
    ensureHydrated();
    snapshot = snapshot.filter((line) => line.lineId !== lineId);
    persist();
    emit();
  },
  clear() {
    ensureHydrated();
    snapshot = [];
    persist();
    emit();
  },
};

export function lineTotalCents(line: CartLine): number {
  try {
    return unitPriceCents(line.itemId, line.selection) * line.quantity;
  } catch {
    return 0;
  }
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartSubtotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
}
