"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";

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

type DrinkItem = Omit<ApiDrinkItem, "priceCents"> & {
  price: string;
};

type AdminDrinksData = {
  categories: DrinkCategory[];
  items: DrinkItem[];
};

type DrinkDraft = {
  categoryId: string;
  nameEn: string;
  nameFr: string;
  descriptionEn: string;
  descriptionFr: string;
  imageUrl: string;
  price: string;
  sortOrder: number;
};

const fieldClass =
  "w-full rounded-button border border-[rgba(6,47,36,0.12)] bg-[rgba(6,47,36,0.05)] px-3 py-2.5 text-sm text-[#062F24] focus:outline-none focus-visible:outline-none focus-visible:outline-0";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-button px-4 py-2.5 text-sm font-semibold transition-all duration-300 hover:opacity-90 focus-visible:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-50";
const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#062F24]/60";
const primaryButtonStyle = {
  background: "#062F24",
  border: "1px solid #062F24",
  color: "#FFFFFF",
};
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
const emptyCategoryDraft = { nameEn: "", nameFr: "", sortOrder: 0 };
const emptyDrinkDraft: DrinkDraft = {
  categoryId: "",
  nameEn: "",
  nameFr: "",
  descriptionEn: "",
  descriptionFr: "",
  imageUrl: "",
  price: "",
  sortOrder: 0,
};

function centsToDollars(value: number) {
  return (value / 100).toFixed(2);
}

function dollarsToCents(value: string) {
  return Math.round(Number(value) * 100);
}

async function readJson(response: Response) {
  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error?.message ?? "Drink menu request failed.");
  }

  return result;
}

function toEditorItem(item: ApiDrinkItem): DrinkItem {
  return { ...item, price: centsToDollars(item.priceCents) };
}

export default function AdminDrinksPage() {
  const [data, setData] = useState<AdminDrinksData>(emptyData);
  const [categoryDraft, setCategoryDraft] = useState(emptyCategoryDraft);
  const [drinkDraft, setDrinkDraft] = useState<DrinkDraft>(emptyDrinkDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadDrinks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await readJson(
        await fetch("/api/admin/drinks", { cache: "no-store" }),
      );
      const responseData = result.data as {
        categories: DrinkCategory[];
        items: ApiDrinkItem[];
      };

      setData({
        categories: responseData.categories,
        items: responseData.items.map(toEditorItem),
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load drinks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDrinks();
  }, [loadDrinks]);

  const mutate = async (
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    successMessage: string,
    body?: unknown,
  ) => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await readJson(
        await fetch(path, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        }),
      );
      await loadDrinks();
      setMessage(successMessage);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save drinks.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const createCategory = async () => {
    const saved = await mutate(
      "/api/admin/drinks/categories",
      "POST",
      "Category added.",
      categoryDraft,
    );

    if (saved) {
      setCategoryDraft(emptyCategoryDraft);
    }
  };

  const createDrink = async () => {
    const categoryId = drinkDraft.categoryId || data.categories[0]?.id;

    if (!categoryId) {
      setError("Add a category before adding a drink.");
      return;
    }

    const saved = await mutate("/api/admin/drinks/items", "POST", "Drink added.", {
      ...drinkDraft,
      categoryId,
      priceCents: dollarsToCents(drinkDraft.price),
    });

    if (saved) {
      setDrinkDraft({ ...emptyDrinkDraft, categoryId });
    }
  };

  const saveCategory = (category: DrinkCategory) =>
    mutate(
      `/api/admin/drinks/categories/${category.id}`,
      "PATCH",
      "Category saved.",
      {
        nameEn: category.nameEn,
        nameFr: category.nameFr,
        sortOrder: category.sortOrder,
      },
    );

  const deleteCategory = (category: DrinkCategory) => {
    const confirmed = window.confirm(
      `Delete “${category.nameEn}” and every drink in this category? This cannot be undone.`,
    );

    if (!confirmed) return;

    return mutate(
      `/api/admin/drinks/categories/${category.id}`,
      "DELETE",
      "Category deleted.",
    );
  };

  const saveDrink = (item: DrinkItem) =>
    mutate(`/api/admin/drinks/items/${item.id}`, "PATCH", "Drink saved.", {
      categoryId: item.categoryId,
      nameEn: item.nameEn,
      nameFr: item.nameFr,
      descriptionEn: item.descriptionEn,
      descriptionFr: item.descriptionFr,
      imageUrl: item.imageUrl,
      priceCents: dollarsToCents(item.price),
      sortOrder: item.sortOrder,
    });

  const deleteDrink = (item: DrinkItem) => {
    const confirmed = window.confirm(
      `Delete “${item.nameEn}”? This cannot be undone.`,
    );

    if (!confirmed) return;

    return mutate(`/api/admin/drinks/items/${item.id}`, "DELETE", "Drink deleted.");
  };

  const updateCategory = (id: string, patch: Partial<DrinkCategory>) => {
    setMessage("");
    setData((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === id ? { ...category, ...patch } : category,
      ),
    }));
  };

  const updateDrink = (id: string, patch: Partial<DrinkItem>) => {
    setMessage("");
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  };

  const categoryFormValid =
    categoryDraft.nameEn.trim().length > 0 && categoryDraft.nameFr.trim().length > 0;
  const drinkFormValid =
    data.categories.length > 0 &&
    drinkDraft.nameEn.trim().length > 0 &&
    drinkDraft.nameFr.trim().length > 0 &&
    Number.isFinite(Number(drinkDraft.price)) &&
    Number(drinkDraft.price) >= 0;

  return (
    <section className="pb-20 pt-36 lg:pt-40" style={{ background: "#FFFFFF" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Link
          href="/admin/reservations"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#062F24]/70 transition hover:text-[#062F24]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Reservations
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-extrabold leading-none text-[#062F24]">
              Drinks
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#062F24]/65">
              Manage the categories and drinks shown on the public drink menu.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/drinks"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass}
              style={quietButtonStyle}
            >
              <ExternalLink size={15} aria-hidden="true" />
              View menu
            </Link>
            <button
              type="button"
              className={buttonClass}
              style={primaryButtonStyle}
              disabled={loading || saving}
              onClick={() => void loadDrinks()}
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw size={15} aria-hidden="true" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <p
            className="mt-6 rounded-surface border border-red-900/20 bg-red-900/10 p-4 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {message ? (
          <p
            className="mt-6 rounded-surface border border-emerald-900/15 bg-emerald-900/10 p-4 text-sm text-emerald-800"
            aria-live="polite"
          >
            {message}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-8 flex min-h-64 items-center justify-center rounded-surface border border-[rgba(6,47,36,0.12)] text-[#062F24]/60">
            <Loader2 className="animate-spin" aria-label="Loading drinks" />
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <section className="rounded-surface border border-[rgba(6,47,36,0.12)] p-5">
                <h2 className="text-lg font-bold text-[#062F24]">Categories</h2>
                <p className="mt-1 text-sm text-[#062F24]/60">
                  Categories control the section names and display order.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>English name</span>
                    <input
                      className={fieldClass}
                      value={categoryDraft.nameEn}
                      onChange={(event) =>
                        setCategoryDraft((current) => ({
                          ...current,
                          nameEn: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className={labelClass}>French name</span>
                    <input
                      className={fieldClass}
                      value={categoryDraft.nameFr}
                      onChange={(event) =>
                        setCategoryDraft((current) => ({
                          ...current,
                          nameFr: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Sort order</span>
                    <input
                      type="number"
                      className={fieldClass}
                      value={categoryDraft.sortOrder}
                      onChange={(event) =>
                        setCategoryDraft((current) => ({
                          ...current,
                          sortOrder: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className={`${buttonClass} self-end`}
                    style={primaryButtonStyle}
                    disabled={saving || !categoryFormValid}
                    onClick={() => void createCategory()}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add category
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {data.categories.length === 0 ? (
                    <p className="rounded-surface bg-[rgba(6,47,36,0.05)] p-4 text-sm text-[#062F24]/65">
                      No categories yet.
                    </p>
                  ) : null}
                  {data.categories.map((category) => (
                    <div
                      key={category.id}
                      className="rounded-surface border border-[rgba(6,47,36,0.08)] p-3"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label>
                          <span className={labelClass}>English name</span>
                          <input
                            className={fieldClass}
                            value={category.nameEn}
                            onChange={(event) =>
                              updateCategory(category.id, { nameEn: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          <span className={labelClass}>French name</span>
                          <input
                            className={fieldClass}
                            value={category.nameFr}
                            onChange={(event) =>
                              updateCategory(category.id, { nameFr: event.target.value })
                            }
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <label className="w-28">
                          <span className={labelClass}>Sort order</span>
                          <input
                            type="number"
                            className={fieldClass}
                            value={category.sortOrder}
                            onChange={(event) =>
                              updateCategory(category.id, {
                                sortOrder: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className={buttonClass}
                          style={quietButtonStyle}
                          disabled={saving || !category.nameEn.trim() || !category.nameFr.trim()}
                          onClick={() => void saveCategory(category)}
                        >
                          <Save size={15} aria-hidden="true" />
                          Save
                        </button>
                        <button
                          type="button"
                          className={buttonClass}
                          style={dangerButtonStyle}
                          disabled={saving}
                          onClick={() => void deleteCategory(category)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="h-fit rounded-surface border border-[rgba(6,47,36,0.12)] p-5">
                <h2 className="text-lg font-bold text-[#062F24]">Add a drink</h2>
                <p className="mt-1 text-sm text-[#062F24]/60">
                  Images use a public HTTP or HTTPS URL.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>Category</span>
                    <select
                      className={fieldClass}
                      value={drinkDraft.categoryId}
                      onChange={(event) =>
                        setDrinkDraft((current) => ({
                          ...current,
                          categoryId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Choose a category</option>
                      {data.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.nameEn}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Price (CAD)</span>
                    <input
                      className={fieldClass}
                      inputMode="decimal"
                      placeholder="0.00"
                      value={drinkDraft.price}
                      onChange={(event) =>
                        setDrinkDraft((current) => ({
                          ...current,
                          price: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className={labelClass}>English name</span>
                    <input
                      className={fieldClass}
                      value={drinkDraft.nameEn}
                      onChange={(event) =>
                        setDrinkDraft((current) => ({
                          ...current,
                          nameEn: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className={labelClass}>French name</span>
                    <input
                      className={fieldClass}
                      value={drinkDraft.nameFr}
                      onChange={(event) =>
                        setDrinkDraft((current) => ({
                          ...current,
                          nameFr: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className={labelClass}>English description</span>
                    <textarea
                      rows={3}
                      className={fieldClass}
                      value={drinkDraft.descriptionEn}
                      onChange={(event) =>
                        setDrinkDraft((current) => ({
                          ...current,
                          descriptionEn: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className={labelClass}>French description</span>
                    <textarea
                      rows={3}
                      className={fieldClass}
                      value={drinkDraft.descriptionFr}
                      onChange={(event) =>
                        setDrinkDraft((current) => ({
                          ...current,
                          descriptionFr: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className={labelClass}>Image URL</span>
                    <input
                      type="url"
                      className={fieldClass}
                      placeholder="https://..."
                      value={drinkDraft.imageUrl}
                      onChange={(event) =>
                        setDrinkDraft((current) => ({
                          ...current,
                          imageUrl: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Sort order</span>
                    <input
                      type="number"
                      className={fieldClass}
                      value={drinkDraft.sortOrder}
                      onChange={(event) =>
                        setDrinkDraft((current) => ({
                          ...current,
                          sortOrder: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className={`${buttonClass} self-end`}
                    style={primaryButtonStyle}
                    disabled={saving || !drinkFormValid}
                    onClick={() => void createDrink()}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add drink
                  </button>
                </div>
              </section>
            </div>

            <section className="mt-6 rounded-surface border border-[rgba(6,47,36,0.12)] p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#062F24]">Drinks</h2>
                  <p className="mt-1 text-sm text-[#062F24]/60">
                    {data.items.length} drink{data.items.length === 1 ? "" : "s"} on the menu.
                  </p>
                </div>
              </div>

              {data.items.length === 0 ? (
                <p className="mt-5 rounded-surface bg-[rgba(6,47,36,0.05)] p-4 text-sm text-[#062F24]/65">
                  No drinks yet.
                </p>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {data.items.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-surface border border-[rgba(6,47,36,0.08)] p-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-surface bg-[rgba(6,47,36,0.05)] text-[#062F24]/35">
                          {item.imageUrl ? (
                            <img
                              key={item.imageUrl}
                              src={item.imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />
                          )}
                        </div>
                        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                          <label>
                            <span className={labelClass}>English name</span>
                            <input
                              className={fieldClass}
                              value={item.nameEn}
                              onChange={(event) =>
                                updateDrink(item.id, { nameEn: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            <span className={labelClass}>French name</span>
                            <input
                              className={fieldClass}
                              value={item.nameFr}
                              onChange={(event) =>
                                updateDrink(item.id, { nameFr: event.target.value })
                              }
                            />
                          </label>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label>
                          <span className={labelClass}>Category</span>
                          <select
                            className={fieldClass}
                            value={item.categoryId}
                            onChange={(event) =>
                              updateDrink(item.id, { categoryId: event.target.value })
                            }
                          >
                            {data.categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.nameEn}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className={labelClass}>Price (CAD)</span>
                          <input
                            className={fieldClass}
                            inputMode="decimal"
                            value={item.price}
                            onChange={(event) =>
                              updateDrink(item.id, { price: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          <span className={labelClass}>English description</span>
                          <textarea
                            rows={3}
                            className={fieldClass}
                            value={item.descriptionEn ?? ""}
                            onChange={(event) =>
                              updateDrink(item.id, { descriptionEn: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          <span className={labelClass}>French description</span>
                          <textarea
                            rows={3}
                            className={fieldClass}
                            value={item.descriptionFr ?? ""}
                            onChange={(event) =>
                              updateDrink(item.id, { descriptionFr: event.target.value })
                            }
                          />
                        </label>
                        <label className="sm:col-span-2">
                          <span className={labelClass}>Image URL</span>
                          <input
                            type="url"
                            className={fieldClass}
                            value={item.imageUrl ?? ""}
                            placeholder="https://..."
                            onChange={(event) =>
                              updateDrink(item.id, { imageUrl: event.target.value })
                            }
                          />
                        </label>
                      </div>

                      <div className="mt-4 flex flex-wrap items-end gap-3">
                        <label className="w-28">
                          <span className={labelClass}>Sort order</span>
                          <input
                            type="number"
                            className={fieldClass}
                            value={item.sortOrder}
                            onChange={(event) =>
                              updateDrink(item.id, { sortOrder: Number(event.target.value) })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className={buttonClass}
                          style={quietButtonStyle}
                          disabled={
                            saving ||
                            !item.nameEn.trim() ||
                            !item.nameFr.trim() ||
                            !Number.isFinite(Number(item.price)) ||
                            Number(item.price) < 0
                          }
                          onClick={() => void saveDrink(item)}
                        >
                          <Save size={15} aria-hidden="true" />
                          Save
                        </button>
                        <button
                          type="button"
                          className={buttonClass}
                          style={dangerButtonStyle}
                          disabled={saving}
                          onClick={() => void deleteDrink(item)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </section>
  );
}
