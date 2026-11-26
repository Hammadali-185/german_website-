"use client";

import { api } from "@/lib/api";
import { distanceKm, OUTSIDE_DELIVERY_RADIUS_MESSAGE, withinDeliveryRadius, type GeoPoint } from "@pizzablitz/shared";
import { MapPin, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type AddressSuggestion = {
  id: string;
  label: string;
  detail: string;
  street: string;
  postalCode: string;
  city: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

type Props = {
  shop: GeoPoint;
  selected: AddressSuggestion | null;
  onSelect: (suggestion: AddressSuggestion) => void;
  onClear: () => void;
};

export function AddressLookup({ shop, selected, onSelect, onClear }: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(() => {
      setError("");
      api<{ suggestions: AddressSuggestion[] }>(`/api/delivery/suggest?q=${encodeURIComponent(query.trim())}`)
        .then((data) => {
          if (cancelled) return;
          setSuggestions(data.suggestions);
          setOpen(true);
        })
        .catch((caught) => {
          if (cancelled) return;
          setSuggestions([]);
          setError(caught instanceof Error ? caught.message : "Adressvorschläge sind gerade nicht verfügbar.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, selected]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const selectedDistance = selected ? Math.round(distanceKm(shop, selected) * 10) / 10 : null;
  const outside = selected ? !withinDeliveryRadius(shop, selected) : false;

  return (
    <div ref={rootRef} className="relative">
      <label className="text-sm font-medium" htmlFor={`${listId}-input`}>
        Lieferadresse
      </label>
      <div className="relative mt-2">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={selected ? selected.label : query}
          readOnly={Boolean(selected)}
          placeholder="Firma, Straße, Landmarke oder Ort"
          className="w-full border border-ink/15 py-3 pl-10 pr-12"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (!selected && suggestions.length > 0) setOpen(true);
          }}
        />
        {selected || query ? (
          <button
            type="button"
            aria-label="Adresse löschen"
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-mute"
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              setOpen(false);
              setError("");
              onClear();
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {selected ? (
        <p className={`mt-2 text-sm ${outside ? "text-brand" : "text-mute"}`}>
          {selected.detail ? `${selected.detail}. ` : ""}
          {selectedDistance == null ? "" : `${selectedDistance.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km vom Shop. `}
          {outside ? OUTSIDE_DELIVERY_RADIUS_MESSAGE : "Diese Adresse liegt im Lieferradius."}
        </p>
      ) : null}
      {loading ? <p className="mt-2 text-sm text-mute">Suche Adressen…</p> : null}
      {error ? <p className="mt-2 text-sm text-brand">{error}</p> : null}
      {open && !selected && !loading && query.trim().length >= 2 && suggestions.length === 0 && !error ? (
        <p className="mt-2 text-sm text-brand">Diese Adresse konnte nicht gefunden werden. Bitte einen Vorschlag mit Straße und Ort wählen.</p>
      ) : null}
      {open && !selected && suggestions.length > 0 ? (
        <ul id={listId} role="listbox" className="absolute z-30 mt-2 max-h-[40vh] w-full overflow-y-auto border border-ink/10 bg-white shadow-card">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                role="option"
                className="flex w-full min-h-12 items-start gap-3 px-3 py-3 text-left hover:bg-paper"
                onClick={() => {
                  onSelect(suggestion);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{suggestion.label}</span>
                  {suggestion.detail ? <span className="mt-0.5 block text-xs text-mute">{suggestion.detail}</span> : null}
                  <span className="mt-0.5 block text-xs text-mute">{suggestion.distanceKm.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
