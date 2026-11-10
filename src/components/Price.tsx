import { formatEuro } from "@/lib/format";

type PriceProps = {
  cents: number;
  className?: string;
};

export function Price({ cents, className }: PriceProps) {
  return (
    <data className={className} value={(cents / 100).toFixed(2)}>
      {formatEuro(cents)}
    </data>
  );
}
