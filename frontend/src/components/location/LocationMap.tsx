import { MapPin } from "lucide-react";
import { googleDirectionsUrl, googleMapEmbedUrl } from "@/lib/maps";

export function LocationMap({
  latitude,
  longitude,
  label,
}: {
  latitude: number;
  longitude: number;
  label: string;
}) {
  const directions = googleDirectionsUrl(latitude, longitude);
  return (
    <figure className="overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-card">
      <div className="relative">
        <iframe
          title={`Karte von ${label}`}
          src={googleMapEmbedUrl(latitude, longitude)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="h-72 w-full border-0 sm:h-80"
        />
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 left-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink shadow-card"
        >
          <MapPin className="h-4 w-4 text-brand" aria-hidden />
          Route planen
        </a>
      </div>
    </figure>
  );
}
