import { loadLegal } from "@/lib/catalog";

export async function LegalPage({ page, title }: { page: "impressum" | "agb" | "datenschutz" | "allergene"; title: string }) {
  const legal = await loadLegal(page);
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-ink/80">{legal.content}</p>
      <p className="mt-8 text-xs text-mute">Quelle: {legal.sourceUrl}</p>
    </article>
  );
}

export default LegalPage;
