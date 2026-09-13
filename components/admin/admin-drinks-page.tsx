"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Loader2, Plus, Save } from "lucide-react";
import { useTranslation } from "@/components/providers/language-provider";
import { parseDrinkPrice } from "@/lib/drinks/price";

type Category = { id: string; nameEn: string; nameFr: string; sortOrder: number };
type Item = { id: string; categoryId: string; nameEn: string; nameFr: string; descriptionEn: string | null; descriptionFr: string | null; imageUrl: string | null; priceCents: number | null; isVisible: boolean; sortOrder: number; updatedAt: string };
type Draft = Omit<Item, "priceCents"> & { price: string };
const field = "w-full min-w-0 rounded-lg border border-[#D4DCD7] bg-white px-3 py-2.5 text-base text-[#153D30] outline-none focus:border-[#296A50] focus:ring-2 focus:ring-[#296A50]/20";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#296A50] disabled:cursor-not-allowed disabled:opacity-50";
const draftOf = (item: Item): Draft => ({ ...item, price: item.priceCents === null ? "" : (item.priceCents / 100).toFixed(2) });
async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json().catch(() => { throw new Error("The server could not respond. Please try again."); });
  if (!response.ok || !result.ok) throw new Error(response.status === 401 ? "Session expired. Sign in again in a new tab, then retry this save." : result.error?.message || "Unable to save. Please try again.");
  return result.data;
}

function DrinkRow({ item, categories, onSaved, onDirty, fr }: { item: Item; categories: Category[]; onSaved: (item: Item) => void; onDirty: (id: string, dirty: boolean) => void; fr: boolean }) {
  const [draft, setDraft] = useState(() => draftOf(item));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(item));
  useEffect(() => { onDirty(item.id, dirty); }, [dirty, item.id, onDirty]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => { setDraft((d) => ({ ...d, [key]: value })); setSaved(false); setError(""); };
  async function save() {
    setBusy(true); setError("");
    try {
      const { price, id, updatedAt, ...values } = draft;
      const data = await request<{ item: Item }>(`/api/admin/drinks/items/${id}`, "PATCH", { ...values, priceCents: parseDrinkPrice(price), expectedUpdatedAt: updatedAt });
      setDraft(draftOf(data.item)); onSaved(data.item); setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save."); }
    finally { setBusy(false); }
  }
  async function reload() {
    if (!window.confirm(fr ? "Remplacer vos modifications par la dernière version enregistrée ?" : "Replace your unsaved edits with the latest saved version?")) return;
    setBusy(true);
    try {
      const data = await request<{ items: Item[] }>("/api/admin/drinks");
      const latest = data.items.find((value) => value.id === item.id);
      if (!latest) throw new Error("This drink has been removed. Reload the page.");
      setDraft(draftOf(latest)); onSaved(latest); setError(""); setSaved(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reload."); }
    finally { setBusy(false); }
  }
  return <form aria-label={item.nameEn} onSubmit={(event) => { event.preventDefault(); void save(); }} className={`rounded-xl border bg-white p-4 sm:p-5 ${dirty ? "border-[#B99554]" : "border-[#DFE5E0]"}`}>
    <fieldset disabled={busy}>
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_100px_110px]">
        <div className="hidden h-16 w-14 rounded-lg bg-[#F3F4EE] sm:block">{item.imageUrl && <img src={item.imageUrl} alt="" width={56} height={64} className="h-full w-full object-contain" loading="lazy" />}</div>
        <label className="block text-xs font-medium text-[#486054]">{fr ? "Titre français" : "French title"}<input required maxLength={160} className={`${field} mt-1.5`} value={draft.nameFr} onChange={(event) => set("nameFr", event.target.value)} /></label>
        <label className="block text-xs font-medium text-[#486054]">{fr ? "Titre anglais" : "English title"}<input required maxLength={160} className={`${field} mt-1.5`} value={draft.nameEn} onChange={(event) => set("nameEn", event.target.value)} /></label>
        <label className="block text-xs font-medium text-[#486054]">{fr ? "Prix ($ CA)" : "Price (CAD)"}<input aria-describedby={`${item.id}-price-help`} inputMode="decimal" placeholder="—" className={`${field} mt-1.5 tabular-nums`} value={draft.price} onChange={(event) => set("price", event.target.value)} /></label>
        <button type="submit" disabled={!dirty || busy} className={`${button} bg-[#164B36] text-white`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{fr ? "Enregistrer" : "Save"}</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64776D]">
        <span id={`${item.id}-price-help`}>{fr ? "Prix vide = prix masqué sur la carte." : "Blank price = no price shown on the menu."}</span>
        <span role="status" className={dirty ? "text-[#835B17]" : "text-[#286440]"}>{dirty ? (fr ? "Modifications non enregistrées" : "Unsaved changes") : saved ? <span className="inline-flex items-center gap-1"><Check size={14} />{fr ? "Enregistré · carte à jour" : "Saved · menu updated"}</span> : !item.isVisible ? (fr ? "Masqué sur la carte" : "Hidden from menu") : ""}</span>
      </div>
      <details className="mt-3 border-t border-[#ECF0EC] pt-3">
        <summary className="w-fit cursor-pointer text-sm text-[#486054]">{fr ? "Détails, image et visibilité" : "Details, image & visibility"}</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">{fr ? "Description française" : "French description"}<textarea className={`${field} mt-1`} maxLength={1000} rows={3} value={draft.descriptionFr ?? ""} onChange={(event) => set("descriptionFr", event.target.value)} /></label>
          <label className="text-sm">{fr ? "Description anglaise" : "English description"}<textarea className={`${field} mt-1`} maxLength={1000} rows={3} value={draft.descriptionEn ?? ""} onChange={(event) => set("descriptionEn", event.target.value)} /></label>
          <label className="text-sm">{fr ? "Lien de l’image" : "Image URL"}<input type="url" className={`${field} mt-1`} value={draft.imageUrl ?? ""} onChange={(event) => set("imageUrl", event.target.value)} /></label>
          <label className="text-sm">{fr ? "Catégorie" : "Category"}<select className={`${field} mt-1`} value={draft.categoryId} onChange={(event) => set("categoryId", event.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{fr ? c.nameFr : c.nameEn}</option>)}</select></label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={draft.isVisible} onChange={(event) => set("isVisible", event.target.checked)} className="h-5 w-5 accent-[#164B36]" />{fr ? "Afficher sur la carte" : "Show on the menu"}</label>
          <label className="text-sm">{fr ? "Ordre d’affichage" : "Display order"}<input type="number" min={-10000} max={10000} step={1} required className={`${field} mt-1`} value={draft.sortOrder} onChange={(event) => set("sortOrder", event.target.valueAsNumber)} /></label>
        </div>
      </details>
    </fieldset>
    {error && <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}<button type="button" disabled={busy} onClick={reload} className="ml-2 underline">{fr ? "Recharger cette boisson" : "Reload this drink"}</button></div>}
    {dirty && <button type="button" disabled={busy} onClick={() => { setDraft(draftOf(item)); setError(""); setSaved(false); }} className="mt-3 text-xs text-[#64776D] underline">{fr ? "Annuler les modifications" : "Discard changes"}</button>}
  </form>;
}

export default function AdminDrinksPage() {
  const { language } = useTranslation();
  const fr = language === "fr";
  const [data, setData] = useState<{ categories: Category[]; items: Item[] } | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const onDirty = useCallback((id: string, dirty: boolean) => setDirtyIds((previous) => { if (previous.has(id) === dirty) return previous; const next = new Set(previous); if (dirty) next.add(id); else next.delete(id); return next; }), []);
  const load = useCallback(async () => { try { setData(await request("/api/admin/drinks")); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load the menu."); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!dirtyIds.size) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const linkGuard = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.("a");
      if (anchor && anchor.target !== "_blank" && !window.confirm(fr ? "Quitter sans enregistrer les modifications ?" : "Leave without saving your changes?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", guard); document.addEventListener("click", linkGuard, true);
    return () => { window.removeEventListener("beforeunload", guard); document.removeEventListener("click", linkGuard, true); };
  }, [dirtyIds.size, fr]);
  const saved = (item: Item) => setData((old) => old && ({ ...old, items: old.items.map((value) => value.id === item.id ? item : value) }));
  async function addDrink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setAdding(true);
    try {
      const result = await request<{ item: Item }>("/api/admin/drinks/items", "POST", { nameFr: values.get("nameFr"), nameEn: values.get("nameEn"), categoryId: values.get("categoryId"), priceCents: parseDrinkPrice(String(values.get("price") ?? "")), isVisible: false, sortOrder: 100 });
      setData((old) => old && ({ ...old, items: [...old.items, result.item] })); setShowHidden(true); setQuery(""); form.reset(); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add drink."); } finally { setAdding(false); }
  }
  return <div className="min-h-screen bg-[#F5F6F1] px-4 pb-24 pt-28 text-[#153D30] sm:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={16} />Admin</Link>
        <a href="/drinks" target="_blank" rel="noreferrer" className={`${button} border border-[#CCD8CF] bg-white`}><ExternalLink size={16} />{fr ? "Voir la carte" : "View menu"}</a>
      </div>
      <h1 className="text-3xl font-semibold sm:text-4xl">{fr ? "La carte des boissons" : "Drinks menu"}</h1>
      <p className="mt-3 text-[#5A7063]">{fr ? "Modifiez un titre ou un prix, puis enregistrez. C’est tout." : "Change a title or a price, then hit Save. That’s it."}</p>
      {error && <div role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{error}{!data && <button onClick={load} className="ml-3 underline">{fr ? "Réessayer" : "Retry"}</button>}</div>}
      {!data && !error && <p role="status" className="py-16">{fr ? "Chargement…" : "Loading…"}</p>}
      {data && <>
        <div className="my-7 flex flex-wrap items-center justify-between gap-4">
          <input type="search" aria-label={fr ? "Rechercher une boisson" : "Find a drink"} placeholder={fr ? "Rechercher une boisson…" : "Find a drink…"} className={`${field} max-w-sm`} value={query} onChange={(event) => setQuery(event.target.value)} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#164B36]" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />{fr ? "Inclure les boissons masquées" : "Include hidden drinks"} ({data.items.filter((i) => !i.isVisible).length})</label>
        </div>
        {data.categories.map((category) => {
          const items = data.items.filter((item) => item.categoryId === category.id).sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn));
          const visible = (item: Item) => (showHidden || item.isVisible || dirtyIds.has(item.id)) && (!query || `${item.nameFr} ${item.nameEn}`.toLowerCase().includes(query.toLowerCase()) || dirtyIds.has(item.id));
          return <section key={category.id} hidden={!items.some(visible)} className="mb-9"><h2 className="mb-4 text-xl font-semibold">{fr ? category.nameFr : category.nameEn}</h2><div className="space-y-3">{items.map((item) => <div key={item.id} hidden={!visible(item)}><DrinkRow item={item} categories={data.categories} onSaved={saved} onDirty={onDirty} fr={fr} /></div>)}</div></section>;
        })}
        {!data.items.some((item) => (showHidden || item.isVisible) && `${item.nameFr} ${item.nameEn}`.toLowerCase().includes(query.toLowerCase())) && <p className="py-8 text-[#5A7063]">{fr ? "Aucune boisson trouvée." : "No drinks found."}</p>}
        <details className="mt-10 rounded-xl border border-[#DCE4DD] bg-white p-5">
          <summary className="cursor-pointer font-semibold">{fr ? "Ajouter une boisson" : "Add a drink"}</summary>
          <form onSubmit={addDrink} className="mt-5 grid items-end gap-4 sm:grid-cols-2">
            <label className="text-sm">{fr ? "Titre français" : "French title"}<input name="nameFr" required maxLength={160} className={`${field} mt-1`} /></label>
            <label className="text-sm">{fr ? "Titre anglais" : "English title"}<input name="nameEn" required maxLength={160} className={`${field} mt-1`} /></label>
            <label className="text-sm">{fr ? "Catégorie" : "Category"}<select name="categoryId" defaultValue={data.items.find((item) => item.isVisible)?.categoryId} className={`${field} mt-1`}>{data.categories.map((c) => <option key={c.id} value={c.id}>{fr ? c.nameFr : c.nameEn}</option>)}</select></label>
            <label className="text-sm">{fr ? "Prix ($ CA), facultatif" : "Price (CAD), optional"}<input name="price" inputMode="decimal" className={`${field} mt-1`} /></label>
            <p className="text-sm text-[#5A7063]">{fr ? "La nouvelle boisson sera masquée jusqu’à ce que vous l’affichiez." : "New drinks stay hidden until you choose to show them."}</p>
            <button disabled={adding || !data.categories.length} className={`${button} bg-[#164B36] text-white`}>{adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}{fr ? "Ajouter" : "Add drink"}</button>
          </form>
        </details>
      </>}
    </div>
  </div>;
}
