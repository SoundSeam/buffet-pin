"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ExternalLink,
  GripVertical,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import ModalShell from "@/components/a11y/modal-shell";

type DrinkCategory = {
  id: string;
  nameEn: string;
  nameFr: string;
  sortOrder: number;
};

type ApiDrinkItem = {
  id: string;
  categoryId: string;
  nameEn: string;
  nameFr: string;
  descriptionEn: string | null;
  descriptionFr: string | null;
  imageUrl: string | null;
  priceCents: number;
  sortOrder: number;
};

type DrinkItem = Omit<ApiDrinkItem, "priceCents"> & { price: string };
type AdminDrinksData = { categories: DrinkCategory[]; items: DrinkItem[] };
type DrinkDraft = {
  categoryId: string;
  nameEn: string;
  nameFr: string;
  descriptionEn: string;
  descriptionFr: string;
  imageUrl: string;
  price: string;
};
type CategoryDraft = { nameEn: string; nameFr: string };
type DrinkEditor = {
  id: string | null;
  original: DrinkDraft;
  draft: DrinkDraft;
};
type CategoryEditor = {
  id: string | null;
  original: CategoryDraft;
  draft: CategoryDraft;
};
type OrderSyncPayload =
  | { type: "categories"; ids: string[] }
  | { type: "drinks"; categoryId: string; ids: string[] };
type OrderSyncMemory = {
  inFlight: Set<string>;
  pending: Map<string, OrderSyncPayload>;
};

const fieldClass =
  "w-full rounded-button border border-[rgba(6,47,36,0.16)] bg-white px-3 py-2.5 text-sm text-[#062F24] outline-none transition focus:border-[#062F24] focus:ring-2 focus:ring-[#062F24]/15";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-button px-4 py-2.5 text-sm font-semibold transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062F24] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";
const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-button border border-[rgba(6,47,36,0.12)] text-[#062F24]/65 transition hover:bg-[rgba(6,47,36,0.06)] hover:text-[#062F24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062F24] disabled:cursor-not-allowed disabled:opacity-35";
const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#062F24]/60";
const primaryButtonStyle = { background: "#062F24", color: "#FFFFFF" };
const quietButtonStyle = {
  background: "rgba(6,47,36,0.05)",
  border: "1px solid rgba(6,47,36,0.12)",
  color: "#062F24",
};
const dangerButtonStyle = {
  background: "#FFFFFF",
  border: "1px solid rgba(153,27,27,0.18)",
  color: "#7F1D1D",
};

const emptyData: AdminDrinksData = { categories: [], items: [] };
const emptyCategoryDraft: CategoryDraft = { nameEn: "", nameFr: "" };

function emptyDrinkDraft(categoryId: string): DrinkDraft {
  return {
    categoryId,
    nameEn: "",
    nameFr: "",
    descriptionEn: "",
    descriptionFr: "",
    imageUrl: "",
    price: "",
  };
}

function centsToDollars(value: number) {
  return (value / 100).toFixed(2);
}

function dollarsToCents(value: string) {
  return Math.round(Number(value) * 100);
}

function toEditorItem(item: ApiDrinkItem): DrinkItem {
  return { ...item, price: centsToDollars(item.priceCents) };
}

function toDrinkDraft(item: DrinkItem): DrinkDraft {
  return {
    categoryId: item.categoryId,
    nameEn: item.nameEn,
    nameFr: item.nameFr,
    descriptionEn: item.descriptionEn ?? "",
    descriptionFr: item.descriptionFr ?? "",
    imageUrl: item.imageUrl ?? "",
    price: item.price,
  };
}

function hasChanged<T>(original: T, draft: T) {
  return JSON.stringify(original) !== JSON.stringify(draft);
}

async function requestJson(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown) {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error?.message ?? "Drink menu request failed.");
  }

  return result;
}

type SortableCategoryRowProps = {
  category: DrinkCategory;
  count: number;
  disabled: boolean;
  selected: boolean;
  onSelect: () => void;
};

function SortableCategoryRow({
  category,
  count,
  disabled,
  selected,
  onSelect,
}: SortableCategoryRowProps) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`group relative flex items-center rounded-button ${
        selected
          ? "bg-white/[0.14] text-white"
          : "text-white/80 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      <button
        type="button"
        className="min-w-0 flex-1 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D4A24C]"
        onClick={onSelect}
      >
        <span className="block truncate text-sm font-semibold">{category.nameEn}</span>
        <span
          className={`mt-0.5 block truncate text-xs ${
            selected ? "text-white/70" : "text-white/50"
          }`}
        >
          {category.nameFr} · {count} drink{count === 1 ? "" : "s"}
        </span>
      </button>
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="mr-1 inline-flex h-9 w-9 touch-none cursor-grab items-center justify-center rounded text-current hover:bg-white/10 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A24C] disabled:cursor-not-allowed disabled:opacity-25"
        disabled={disabled}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${category.nameEn}`}
      >
        <GripVertical size={17} aria-hidden="true" />
      </button>
    </li>
  );
}

type SortableDrinkRowProps = {
  disabled: boolean;
  item: DrinkItem;
  onEdit: () => void;
};

function SortableDrinkRow({ disabled, item, onEdit }: SortableDrinkRowProps) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="relative flex items-center gap-3 bg-white py-3 sm:gap-4"
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="inline-flex h-9 w-8 touch-none cursor-grab shrink-0 items-center justify-center rounded-button text-[#062F24]/40 hover:bg-[rgba(6,47,36,0.06)] hover:text-[#062F24] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062F24] disabled:cursor-not-allowed disabled:opacity-30"
        disabled={disabled}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${item.nameEn}`}
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-button bg-[rgba(6,47,36,0.05)] text-[#062F24]/30">
        <ImageIcon size={21} aria-hidden="true" />
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#062F24]">{item.nameEn}</p>
        <p className="mt-0.5 truncate text-sm text-[#062F24]/55">{item.nameFr}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-[#062F24]">
        ${item.price}
      </p>
      <button
        type="button"
        className={iconButtonClass}
        aria-label={`Edit ${item.nameEn}`}
        disabled={disabled}
        onClick={onEdit}
      >
        <Pencil size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

export default function AdminDrinksPage() {
  const [data, setData] = useState<AdminDrinksData>(emptyData);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [drinkEditor, setDrinkEditor] = useState<DrinkEditor | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<CategoryEditor | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const orderSyncMemory = useRef<OrderSyncMemory>({
    inFlight: new Set(),
    pending: new Map(),
  });
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadDrinks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await requestJson("/api/admin/drinks", "GET");
      const responseData = result.data as {
        categories: DrinkCategory[];
        items: ApiDrinkItem[];
      };
      setData({
        categories: responseData.categories,
        items: responseData.items.map(toEditorItem),
      });
      setSelectedCategoryId((current) =>
        responseData.categories.some((category) => category.id === current)
          ? current
          : (responseData.categories[0]?.id ?? ""),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load drinks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDrinks();
  }, [loadDrinks]);

  const drinkDirty = drinkEditor
    ? hasChanged(drinkEditor.original, drinkEditor.draft)
    : false;
  const categoryDirty = categoryEditor
    ? hasChanged(categoryEditor.original, categoryEditor.draft)
    : false;

  useEffect(() => {
    if (!drinkDirty && !categoryDirty) return;

    const preventAccidentalNavigation = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", preventAccidentalNavigation);
    return () => window.removeEventListener("beforeunload", preventAccidentalNavigation);
  }, [categoryDirty, drinkDirty]);

  const selectedCategory = data.categories.find(
    (category) => category.id === selectedCategoryId,
  );
  const selectedItems = useMemo(
    () => data.items.filter((item) => item.categoryId === selectedCategoryId),
    [data.items, selectedCategoryId],
  );
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return selectedItems;
    return selectedItems.filter((item) =>
      [item.nameEn, item.nameFr, item.descriptionEn, item.descriptionFr]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [query, selectedItems]);

  const closeDrinkEditor = (force = false) => {
    if (!force && drinkDirty && !window.confirm("Discard your unsaved drink changes?")) return;
    setDrinkEditor(null);
    setError("");
  };

  const closeCategoryEditor = (force = false) => {
    if (!force && categoryDirty && !window.confirm("Discard your unsaved category changes?")) return;
    setCategoryEditor(null);
    setError("");
  };

  const openNewDrink = () => {
    if (!selectedCategory) return;
    const draft = emptyDrinkDraft(selectedCategory.id);
    setDrinkEditor({ id: null, original: draft, draft });
    setError("");
  };

  const openDrink = (item: DrinkItem) => {
    const draft = toDrinkDraft(item);
    setDrinkEditor({ id: item.id, original: draft, draft });
    setError("");
  };

  const saveDrink = async () => {
    if (!drinkEditor) return;
    const editor = drinkEditor;
    const { id, draft } = editor;
    const previousData = data;
    const previousCategoryId = selectedCategoryId;
    const optimisticId = id ?? `optimistic-${crypto.randomUUID()}`;
    const existingItem = id ? data.items.find((item) => item.id === id) : null;
    const optimisticItem: DrinkItem = {
      id: optimisticId,
      categoryId: draft.categoryId,
      nameEn: draft.nameEn.trim(),
      nameFr: draft.nameFr.trim(),
      descriptionEn: draft.descriptionEn.trim() || null,
      descriptionFr: draft.descriptionFr.trim() || null,
      imageUrl: draft.imageUrl.trim() || null,
      price: Number(draft.price).toFixed(2),
      sortOrder: existingItem?.sortOrder ?? selectedItems.length * 10,
    };

    setBusyKey(`drink:${id ?? "new"}`);
    setError("");
    setData((current) => ({
      ...current,
      items: id
        ? current.items.map((item) => (item.id === id ? optimisticItem : item))
        : [...current.items, optimisticItem],
    }));
    setSelectedCategoryId(draft.categoryId);
    setQuery("");
    setDrinkEditor(null);

    try {
      const result = await requestJson(
        id ? `/api/admin/drinks/items/${id}` : "/api/admin/drinks/items",
        id ? "PATCH" : "POST",
        {
          ...draft,
          descriptionEn: draft.descriptionEn || null,
          descriptionFr: draft.descriptionFr || null,
          imageUrl: draft.imageUrl || null,
          priceCents: dollarsToCents(draft.price),
          ...(id ? {} : { sortOrder: selectedItems.length * 10 }),
        },
      );
      const savedItem = toEditorItem(result.data.item as ApiDrinkItem);
      setData((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === optimisticId ? savedItem : item,
        ),
      }));
    } catch (saveError) {
      setData(previousData);
      setSelectedCategoryId(previousCategoryId);
      setDrinkEditor(editor);
      setError(saveError instanceof Error ? saveError.message : "Unable to save drink.");
    } finally {
      setBusyKey("");
    }
  };

  const deleteDrink = async (item: DrinkItem) => {
    if (!window.confirm(`Delete “${item.nameEn}”? This cannot be undone.`)) return;
    const previousData = data;
    const previousEditor = drinkEditor;
    setBusyKey(`drink:${item.id}`);
    setError("");
    setData((current) => ({
      ...current,
      items: current.items.filter((candidate) => candidate.id !== item.id),
    }));
    setDrinkEditor(null);

    try {
      await requestJson(`/api/admin/drinks/items/${item.id}`, "DELETE");
    } catch (deleteError) {
      setData(previousData);
      setDrinkEditor(previousEditor);
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete drink.");
    } finally {
      setBusyKey("");
    }
  };

  const saveCategory = async () => {
    if (!categoryEditor) return;
    const editor = categoryEditor;
    const { id, draft } = editor;
    const previousData = data;
    const previousCategoryId = selectedCategoryId;
    const optimisticId = id ?? `optimistic-${crypto.randomUUID()}`;
    const existingCategory = id
      ? data.categories.find((category) => category.id === id)
      : null;
    const optimisticCategory: DrinkCategory = {
      id: optimisticId,
      nameEn: draft.nameEn.trim(),
      nameFr: draft.nameFr.trim(),
      sortOrder: existingCategory?.sortOrder ?? data.categories.length * 10,
    };

    setBusyKey(`category:${id ?? "new"}`);
    setError("");
    setData((current) => ({
      ...current,
      categories: id
        ? current.categories.map((category) =>
            category.id === id ? optimisticCategory : category,
          )
        : [...current.categories, optimisticCategory],
    }));
    setSelectedCategoryId(optimisticId);
    setCategoryEditor(null);

    try {
      const result = await requestJson(
        id ? `/api/admin/drinks/categories/${id}` : "/api/admin/drinks/categories",
        id ? "PATCH" : "POST",
        { ...draft, ...(id ? {} : { sortOrder: data.categories.length * 10 }) },
      );
      const savedCategory = result.data.category as DrinkCategory;
      setData((current) => ({
        ...current,
        categories: current.categories.map((category) =>
          category.id === optimisticId ? savedCategory : category,
        ),
      }));
      setSelectedCategoryId(savedCategory.id);
    } catch (saveError) {
      setData(previousData);
      setSelectedCategoryId(previousCategoryId);
      setCategoryEditor(editor);
      setError(saveError instanceof Error ? saveError.message : "Unable to save category.");
    } finally {
      setBusyKey("");
    }
  };

  const deleteCategory = async (category: DrinkCategory) => {
    const count = data.items.filter((item) => item.categoryId === category.id).length;
    const consequence = count
      ? ` It also permanently deletes ${count} drink${count === 1 ? "" : "s"}.`
      : "";
    if (!window.confirm(`Delete “${category.nameEn}”?${consequence}`)) return;
    const previousData = data;
    const previousCategoryId = selectedCategoryId;
    const previousEditor = categoryEditor;
    const remainingCategories = data.categories.filter(
      (candidate) => candidate.id !== category.id,
    );
    setBusyKey(`category:${category.id}`);
    setError("");
    setData((current) => ({
      categories: current.categories.filter((candidate) => candidate.id !== category.id),
      items: current.items.filter((item) => item.categoryId !== category.id),
    }));
    setSelectedCategoryId(remainingCategories[0]?.id ?? "");
    setCategoryEditor(null);

    try {
      await requestJson(`/api/admin/drinks/categories/${category.id}`, "DELETE");
    } catch (deleteError) {
      setData(previousData);
      setSelectedCategoryId(previousCategoryId);
      setCategoryEditor(previousEditor);
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete category.");
    } finally {
      setBusyKey("");
    }
  };

  async function flushOrderSync(key: string) {
    const memory = orderSyncMemory.current;
    if (memory.inFlight.has(key)) return;

    const payload = memory.pending.get(key);
    if (!payload) return;

    memory.pending.delete(key);
    memory.inFlight.add(key);
    let continueWithNewerOrder = false;

    try {
      await requestJson("/api/admin/drinks/reorder", "POST", payload);
      if (memory.pending.has(key)) {
        continueWithNewerOrder = true;
      } else {
        setError("");
      }
    } catch (syncError) {
      if (memory.pending.has(key)) {
        continueWithNewerOrder = true;
      } else {
        memory.pending.set(key, payload);
      }
      setError(
        syncError instanceof Error
          ? `${syncError.message} Your latest order is still kept on this page.`
          : "Unable to save the new order. Your latest order is still kept on this page.",
      );
    } finally {
      memory.inFlight.delete(key);
      if (continueWithNewerOrder) {
        void flushOrderSync(key);
      }
    }
  }

  function queueOrderSync(key: string, payload: OrderSyncPayload) {
    orderSyncMemory.current.pending.set(key, payload);
    setError("");
    void flushOrderSync(key);
  }

  const reorderCategories = (reordered: DrinkCategory[]) => {
    const optimisticCategories = reordered.map((category, index) => ({
      ...category,
      sortOrder: index * 10,
    }));
    setData((current) => ({ ...current, categories: optimisticCategories }));
    queueOrderSync("categories", {
      type: "categories",
      ids: reordered.map((category) => category.id),
    });
  };

  const reorderDrinks = (reordered: DrinkItem[]) => {
    if (!selectedCategory) return;
    const order = new Map(reordered.map((item, index) => [item.id, index * 10]));
    setData((current) => ({
      ...current,
      items: current.items
        .map((item) =>
          order.has(item.id) ? { ...item, sortOrder: order.get(item.id) ?? 0 } : item,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn)),
    }));
    queueOrderSync(`drinks:${selectedCategory.id}`, {
      type: "drinks",
      categoryId: selectedCategory.id,
      ids: reordered.map((item) => item.id),
    });
  };

  const handleCategoryDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || busyKey) return;
    const from = data.categories.findIndex((category) => category.id === active.id);
    const to = data.categories.findIndex((category) => category.id === over.id);
    if (from < 0 || to < 0) return;
    reorderCategories(arrayMove(data.categories, from, to));
  };

  const handleDrinkDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || busyKey || query) return;
    const from = selectedItems.findIndex((item) => item.id === active.id);
    const to = selectedItems.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    reorderDrinks(arrayMove(selectedItems, from, to));
  };

  const drinkFormValid = Boolean(
    drinkEditor?.draft.nameEn.trim() &&
      drinkEditor.draft.nameFr.trim() &&
      drinkEditor.draft.categoryId &&
      Number.isFinite(Number(drinkEditor.draft.price)) &&
      Number(drinkEditor.draft.price) >= 0,
  );
  const categoryFormValid = Boolean(
    categoryEditor?.draft.nameEn.trim() && categoryEditor.draft.nameFr.trim(),
  );

  return (
    <section className="min-h-screen bg-white pb-20 pt-36 lg:pt-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Link
          href="/admin/reservations"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#062F24]/70 transition hover:text-[#062F24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062F24]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Reservations
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-extrabold leading-none text-[#062F24]">Drinks</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#062F24]/65">
              Organize the menu the same way your guests see it.
            </p>
          </div>
          <Link
            href="/drinks"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass}
            style={quietButtonStyle}
          >
            <ExternalLink size={15} aria-hidden="true" />
            Preview menu
          </Link>
        </div>

        {error ? (
          <p className="mt-6 rounded-surface border border-red-900/20 bg-red-900/10 p-4 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? (
          <div className="mt-8 flex min-h-64 items-center justify-center rounded-surface border border-[rgba(6,47,36,0.12)] text-[#062F24]/60">
            <Loader2 className="animate-spin" aria-label="Loading drinks" />
          </div>
        ) : (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className="rounded-surface border border-[#062F24] bg-[#062F24] p-3 text-white lg:sticky lg:top-28">
              <div className="flex items-center justify-between px-2 py-2">
                <h2 className="font-bold text-white">Categories</h2>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-button border border-white/20 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A24C] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Add category"
                  disabled={Boolean(busyKey)}
                  onClick={() => {
                    setError("");
                    setCategoryEditor({
                      id: null,
                      original: emptyCategoryDraft,
                      draft: emptyCategoryDraft,
                    });
                  }}
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>

              {data.categories.length ? (
                <DndContext
                  sensors={dragSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleCategoryDragEnd}
                >
                  <SortableContext
                    items={data.categories.map((category) => category.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="mt-2 space-y-1">
                      {data.categories.map((category) => (
                        <SortableCategoryRow
                          key={category.id}
                          category={category}
                          count={data.items.filter((item) => item.categoryId === category.id).length}
                          disabled={Boolean(busyKey)}
                          selected={category.id === selectedCategoryId}
                          onSelect={() => {
                            setSelectedCategoryId(category.id);
                            setQuery("");
                          }}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="m-2 rounded-button border border-white/[0.12] bg-white/[0.06] p-4 text-sm text-white/65">
                  Add your first category to start the menu.
                </div>
              )}
            </aside>

            <main className="min-w-0 rounded-surface border border-[rgba(6,47,36,0.12)] p-4 sm:p-6">
              {selectedCategory ? (
                <>
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-extrabold text-[#062F24]">{selectedCategory.nameEn}</h2>
                        <button
                          type="button"
                          className={iconButtonClass}
                          aria-label={`Edit ${selectedCategory.nameEn} category`}
                          disabled={Boolean(busyKey)}
                          onClick={() => {
                            const draft = { nameEn: selectedCategory.nameEn, nameFr: selectedCategory.nameFr };
                            setError("");
                            setCategoryEditor({ id: selectedCategory.id, original: draft, draft });
                          }}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                      </div>
                      <p className="mt-1 text-sm text-[#062F24]/55">{selectedCategory.nameFr}</p>
                    </div>
                    <button type="button" className={buttonClass} style={primaryButtonStyle} disabled={Boolean(busyKey)} onClick={openNewDrink}>
                      <Plus size={16} aria-hidden="true" />
                      Add drink
                    </button>
                  </div>

                  {selectedItems.length > 5 ? (
                    <label className="relative mt-6 block">
                      <span className="sr-only">Search this category</span>
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#062F24]/40" size={16} aria-hidden="true" />
                      <input className={`${fieldClass} pl-10`} placeholder="Search this category" value={query} onChange={(event) => setQuery(event.target.value)} />
                    </label>
                  ) : null}

                  {visibleItems.length ? (
                    <DndContext
                      sensors={dragSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDrinkDragEnd}
                    >
                      <SortableContext
                        items={visibleItems.map((item) => item.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="mt-6 divide-y divide-[rgba(6,47,36,0.09)]">
                          {visibleItems.map((item) => (
                            <SortableDrinkRow
                              key={item.id}
                              item={item}
                              disabled={Boolean(busyKey) || Boolean(query)}
                              onEdit={() => openDrink(item)}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="mt-6 rounded-surface bg-[rgba(6,47,36,0.04)] px-5 py-12 text-center">
                      <p className="font-semibold text-[#062F24]">{query ? "No matching drinks" : "No drinks in this category"}</p>
                      <p className="mt-1 text-sm text-[#062F24]/55">{query ? "Try a different search." : "Add the first drink when you’re ready."}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <h2 className="text-xl font-bold text-[#062F24]">Start with a category</h2>
                  <p className="mt-2 text-sm text-[#062F24]/55">Categories keep the drink menu easy to browse.</p>
                  <button type="button" className={`${buttonClass} mt-5`} style={primaryButtonStyle} disabled={Boolean(busyKey)} onClick={() => { setError(""); setCategoryEditor({ id: null, original: emptyCategoryDraft, draft: emptyCategoryDraft }); }}>
                    <Plus size={16} aria-hidden="true" /> Add category
                  </button>
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      {drinkEditor ? (
        <ModalShell labelledBy="drink-editor-title" onClose={() => closeDrinkEditor()} panelClassName="max-w-3xl border border-[rgba(6,47,36,0.08)] bg-[#FBFCFA] !p-0">
          <div className="flex items-start justify-between border-b border-[rgba(6,47,36,0.1)] px-5 py-4 sm:px-7">
            <div>
              <h2 id="drink-editor-title" className="text-xl font-extrabold text-[#062F24]">{drinkEditor.id ? "Edit drink" : "Add drink"}</h2>
              <p className="mt-1 text-sm text-[#062F24]/55">Changes appear on the public drink menu after saving.</p>
            </div>
            <button type="button" className={iconButtonClass} aria-label="Close editor" onClick={() => closeDrinkEditor()}><X size={18} aria-hidden="true" /></button>
          </div>

          <div className="grid gap-6 p-5 sm:p-7">
            {error ? (
              <p className="rounded-button border border-red-900/20 bg-red-900/10 p-3 text-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
              <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-surface bg-[rgba(6,47,36,0.05)] text-[#062F24]/30">
                <ImageIcon size={30} aria-hidden="true" />
                {drinkEditor.draft.imageUrl ? <img src={drinkEditor.draft.imageUrl} alt="Drink preview" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className={labelClass}>Category</span><select className={fieldClass} value={drinkEditor.draft.categoryId} onChange={(event) => setDrinkEditor((current) => current ? { ...current, draft: { ...current.draft, categoryId: event.target.value } } : current)}>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.nameEn}</option>)}</select></label>
                <label><span className={labelClass}>Price (CAD)</span><input className={fieldClass} inputMode="decimal" placeholder="0.00" value={drinkEditor.draft.price} onChange={(event) => setDrinkEditor((current) => current ? { ...current, draft: { ...current.draft, price: event.target.value } } : current)} /></label>
                <label className="sm:col-span-2"><span className={labelClass}>Image URL <span className="normal-case tracking-normal text-[#062F24]/40">(optional)</span></span><input type="url" className={fieldClass} placeholder="https://…" value={drinkEditor.draft.imageUrl} onChange={(event) => setDrinkEditor((current) => current ? { ...current, draft: { ...current.draft, imageUrl: event.target.value } } : current)} /></label>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <fieldset className="grid gap-4 rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-4">
                <legend className="px-2 text-sm font-bold text-[#062F24]">English</legend>
                <label><span className={labelClass}>Name</span><input className={fieldClass} value={drinkEditor.draft.nameEn} onChange={(event) => setDrinkEditor((current) => current ? { ...current, draft: { ...current.draft, nameEn: event.target.value } } : current)} /></label>
                <label><span className={labelClass}>Description <span className="normal-case tracking-normal text-[#062F24]/40">(optional)</span></span><textarea rows={4} className={fieldClass} value={drinkEditor.draft.descriptionEn} onChange={(event) => setDrinkEditor((current) => current ? { ...current, draft: { ...current.draft, descriptionEn: event.target.value } } : current)} /></label>
              </fieldset>
              <fieldset className="grid gap-4 rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-4">
                <legend className="px-2 text-sm font-bold text-[#062F24]">Français</legend>
                <label><span className={labelClass}>Nom</span><input className={fieldClass} value={drinkEditor.draft.nameFr} onChange={(event) => setDrinkEditor((current) => current ? { ...current, draft: { ...current.draft, nameFr: event.target.value } } : current)} /></label>
                <label><span className={labelClass}>Description <span className="normal-case tracking-normal text-[#062F24]/40">(facultatif)</span></span><textarea rows={4} className={fieldClass} value={drinkEditor.draft.descriptionFr} onChange={(event) => setDrinkEditor((current) => current ? { ...current, draft: { ...current.draft, descriptionFr: event.target.value } } : current)} /></label>
              </fieldset>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(6,47,36,0.1)] bg-white px-5 py-4 sm:px-7">
            <div>{drinkEditor.id ? <button type="button" className={buttonClass} style={dangerButtonStyle} disabled={Boolean(busyKey)} onClick={() => { const item = data.items.find((candidate) => candidate.id === drinkEditor.id); if (item) void deleteDrink(item); }}><Trash2 size={15} aria-hidden="true" /> Delete</button> : null}</div>
            <div className="flex items-center gap-3">
              {drinkDirty ? <span className="hidden text-xs font-semibold text-amber-700 sm:inline">Unsaved changes</span> : null}
              <button type="button" className={buttonClass} style={quietButtonStyle} disabled={Boolean(busyKey)} onClick={() => closeDrinkEditor()}>Cancel</button>
              <button type="button" className={buttonClass} style={primaryButtonStyle} disabled={Boolean(busyKey) || !drinkFormValid || (Boolean(drinkEditor.id) && !drinkDirty)} onClick={() => void saveDrink()}>{busyKey.startsWith("drink:") ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null} Save drink</button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {categoryEditor ? (
        <ModalShell labelledBy="category-editor-title" onClose={() => closeCategoryEditor()} panelClassName="max-w-lg border border-[rgba(6,47,36,0.08)] bg-white !p-0">
          <div className="flex items-start justify-between border-b border-[rgba(6,47,36,0.1)] px-6 py-5">
            <div><h2 id="category-editor-title" className="text-xl font-extrabold text-[#062F24]">{categoryEditor.id ? "Edit category" : "Add category"}</h2><p className="mt-1 text-sm text-[#062F24]/55">Use the arrow controls to change its menu position.</p></div>
            <button type="button" className={iconButtonClass} aria-label="Close editor" onClick={() => closeCategoryEditor()}><X size={18} aria-hidden="true" /></button>
          </div>
          {error ? (
            <p className="mx-6 rounded-button border border-red-900/20 bg-red-900/10 p-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <label><span className={labelClass}>English name</span><input className={fieldClass} value={categoryEditor.draft.nameEn} onChange={(event) => setCategoryEditor((current) => current ? { ...current, draft: { ...current.draft, nameEn: event.target.value } } : current)} /></label>
            <label><span className={labelClass}>French name</span><input className={fieldClass} value={categoryEditor.draft.nameFr} onChange={(event) => setCategoryEditor((current) => current ? { ...current, draft: { ...current.draft, nameFr: event.target.value } } : current)} /></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(6,47,36,0.1)] px-6 py-4">
            <div>{categoryEditor.id ? <button type="button" className={buttonClass} style={dangerButtonStyle} disabled={Boolean(busyKey)} onClick={() => { const category = data.categories.find((candidate) => candidate.id === categoryEditor.id); if (category) void deleteCategory(category); }}><Trash2 size={15} aria-hidden="true" /> Delete category</button> : null}</div>
            <div className="flex gap-3"><button type="button" className={buttonClass} style={quietButtonStyle} disabled={Boolean(busyKey)} onClick={() => closeCategoryEditor()}>Cancel</button><button type="button" className={buttonClass} style={primaryButtonStyle} disabled={Boolean(busyKey) || !categoryFormValid || (Boolean(categoryEditor.id) && !categoryDirty)} onClick={() => void saveCategory()}>{busyKey.startsWith("category:") ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null} Save category</button></div>
          </div>
        </ModalShell>
      ) : null}
    </section>
  );
}
