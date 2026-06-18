"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";

type Category = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  sortOrder: number;
  isAvailable: boolean;
  isActive: boolean;
};

type ModifierOption = {
  id: string;
  modifierGroupId: string;
  name: string;
  priceDeltaCents: number;
  sortOrder: number;
  isAvailable: boolean;
  isActive: boolean;
};

type ModifierGroup = {
  id: string;
  name: string;
  description: string | null;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  options: ModifierOption[];
};

type Assignment = {
  id: string;
  menuItemId: string;
  modifierGroupId: string;
  sortOrder: number;
};

type AdminMenuData = {
  categories: Category[];
  items: MenuItem[];
  modifierGroups: ModifierGroup[];
  itemModifierGroups: Assignment[];
};

const fieldClass =
  "w-full rounded-button border border-[rgba(6,47,36,0.12)] bg-white px-3 py-2 text-sm text-[#062F24] focus:outline-none";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-button px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

const initialData: AdminMenuData = {
  categories: [],
  items: [],
  modifierGroups: [],
  itemModifierGroups: [],
};

function dollarsToCents(value: string) {
  return Math.round(Number(value || 0) * 100);
}

function centsToDollars(value: number) {
  return (value / 100).toFixed(2);
}

async function readJson(response: Response) {
  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.error?.message ?? "Menu request failed.");
  }
  return result;
}

export default function AdminMenuPage() {
  const [data, setData] = useState<AdminMenuData>(initialData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [categoryDraft, setCategoryDraft] = useState({ name: "", sortOrder: 0 });
  const [itemDraft, setItemDraft] = useState({
    categoryId: "",
    name: "",
    price: "",
    imageUrl: "",
  });
  const [groupDraft, setGroupDraft] = useState({
    name: "",
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
  });
  const [optionDraft, setOptionDraft] = useState({
    modifierGroupId: "",
    name: "",
    price: "",
  });
  const [assignmentDraft, setAssignmentDraft] = useState({
    menuItemId: "",
    modifierGroupId: "",
  });

  const activeCategories = useMemo(
    () => data.categories.filter((category) => category.isActive),
    [data.categories],
  );
  const activeItems = useMemo(
    () => data.items.filter((item) => item.isActive),
    [data.items],
  );
  const activeGroups = useMemo(
    () => data.modifierGroups.filter((group) => group.isActive),
    [data.modifierGroups],
  );

  const loadMenu = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await readJson(
        await fetch("/api/admin/menu", { cache: "no-store" }),
      );
      setData(result.data as AdminMenuData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load menu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMenu();
  }, []);

  const mutate = async (
    path: string,
    method: "POST" | "PATCH" | "DELETE",
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
      await loadMenu();
      setMessage("Menu saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save menu.");
    } finally {
      setSaving(false);
    }
  };

  const createCategory = () =>
    mutate("/api/admin/menu/categories", "POST", {
      name: categoryDraft.name,
      sortOrder: categoryDraft.sortOrder,
    }).then(() => setCategoryDraft({ name: "", sortOrder: 0 }));

  const createItem = () =>
    mutate("/api/admin/menu/items", "POST", {
      categoryId: itemDraft.categoryId || activeCategories[0]?.id,
      name: itemDraft.name,
      priceCents: dollarsToCents(itemDraft.price),
      imageUrl: itemDraft.imageUrl,
    }).then(() =>
      setItemDraft({ categoryId: "", name: "", price: "", imageUrl: "" }),
    );

  const createGroup = () =>
    mutate("/api/admin/menu/modifier-groups", "POST", groupDraft).then(() =>
      setGroupDraft({
        name: "",
        minSelections: 0,
        maxSelections: 1,
        isRequired: false,
      }),
    );

  const createOption = () =>
    mutate("/api/admin/menu/modifier-options", "POST", {
      modifierGroupId: optionDraft.modifierGroupId || activeGroups[0]?.id,
      name: optionDraft.name,
      priceDeltaCents: dollarsToCents(optionDraft.price),
    }).then(() =>
      setOptionDraft({ modifierGroupId: "", name: "", price: "" }),
    );

  const createAssignment = () =>
    mutate("/api/admin/menu/item-modifier-groups", "POST", {
      menuItemId: assignmentDraft.menuItemId || activeItems[0]?.id,
      modifierGroupId: assignmentDraft.modifierGroupId || activeGroups[0]?.id,
    }).then(() => setAssignmentDraft({ menuItemId: "", modifierGroupId: "" }));

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
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold leading-none text-[#062F24]">
              Menu
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#062F24]/65">
              Manage mock categories, items, availability, modifier groups, and prices used by server pricing.
            </p>
          </div>
          <button
            type="button"
            className={buttonClass}
            onClick={() => void loadMenu()}
            disabled={loading || saving}
            style={{ background: "#062F24", color: "#FFFFFF" }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-surface border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-6 rounded-surface border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-surface border border-[rgba(6,47,36,0.12)] p-5">
            <h2 className="text-lg font-bold text-[#062F24]">Categories</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
              <input
                className={fieldClass}
                placeholder="Category name"
                value={categoryDraft.name}
                onChange={(event) =>
                  setCategoryDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
              <input
                className={fieldClass}
                type="number"
                placeholder="Sort"
                value={categoryDraft.sortOrder}
                onChange={(event) =>
                  setCategoryDraft((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value),
                  }))
                }
              />
              <button
                type="button"
                className={buttonClass}
                disabled={saving || !categoryDraft.name}
                onClick={() => void createCategory()}
                style={{ background: "#062F24", color: "#FFFFFF" }}
              >
                <Plus size={16} /> Add
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {data.categories.map((category) => (
                <div
                  key={category.id}
                  className="grid gap-3 rounded-surface border border-[rgba(6,47,36,0.08)] p-3 sm:grid-cols-[1fr_90px_auto_auto]"
                >
                  <input
                    className={fieldClass}
                    value={category.name}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        categories: current.categories.map((row) =>
                          row.id === category.id ? { ...row, name: event.target.value } : row,
                        ),
                      }))
                    }
                  />
                  <input
                    className={fieldClass}
                    type="number"
                    value={category.sortOrder}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        categories: current.categories.map((row) =>
                          row.id === category.id
                            ? { ...row, sortOrder: Number(event.target.value) }
                            : row,
                        ),
                      }))
                    }
                  />
                  <label className="flex items-center gap-2 text-sm text-[#062F24]">
                    <input
                      type="checkbox"
                      checked={category.isActive}
                      onChange={(event) =>
                        setData((current) => ({
                          ...current,
                          categories: current.categories.map((row) =>
                            row.id === category.id
                              ? { ...row, isActive: event.target.checked }
                              : row,
                          ),
                        }))
                      }
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={saving}
                    onClick={() =>
                      void mutate(`/api/admin/menu/categories/${category.id}`, "PATCH", {
                        name: category.name,
                        sortOrder: category.sortOrder,
                        isActive: category.isActive,
                      })
                    }
                    style={{ background: "#F6F4EF", color: "#062F24" }}
                  >
                    <Save size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-surface border border-[rgba(6,47,36,0.12)] p-5">
            <h2 className="text-lg font-bold text-[#062F24]">Items</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                className={fieldClass}
                value={itemDraft.categoryId}
                onChange={(event) =>
                  setItemDraft((current) => ({ ...current, categoryId: event.target.value }))
                }
              >
                <option value="">Category</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                className={fieldClass}
                placeholder="Item name"
                value={itemDraft.name}
                onChange={(event) =>
                  setItemDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
              <input
                className={fieldClass}
                inputMode="decimal"
                placeholder="Price"
                value={itemDraft.price}
                onChange={(event) =>
                  setItemDraft((current) => ({ ...current, price: event.target.value }))
                }
              />
              <input
                className={fieldClass}
                placeholder="Image URL"
                value={itemDraft.imageUrl}
                onChange={(event) =>
                  setItemDraft((current) => ({ ...current, imageUrl: event.target.value }))
                }
              />
              <button
                type="button"
                className={buttonClass}
                disabled={saving || !itemDraft.name || activeCategories.length === 0}
                onClick={() => void createItem()}
                style={{ background: "#062F24", color: "#FFFFFF" }}
              >
                <Plus size={16} /> Add item
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {data.items.map((item) => (
                <div key={item.id} className="rounded-surface border border-[rgba(6,47,36,0.08)] p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className={fieldClass}
                      value={item.name}
                      onChange={(event) =>
                        setData((current) => ({
                          ...current,
                          items: current.items.map((row) =>
                            row.id === item.id ? { ...row, name: event.target.value } : row,
                          ),
                        }))
                      }
                    />
                    <input
                      className={fieldClass}
                      inputMode="decimal"
                      value={centsToDollars(item.priceCents)}
                      onChange={(event) =>
                        setData((current) => ({
                          ...current,
                          items: current.items.map((row) =>
                            row.id === item.id
                              ? { ...row, priceCents: dollarsToCents(event.target.value) }
                              : row,
                          ),
                        }))
                      }
                    />
                    <select
                      className={fieldClass}
                      value={item.categoryId}
                      onChange={(event) =>
                        setData((current) => ({
                          ...current,
                          items: current.items.map((row) =>
                            row.id === item.id
                              ? { ...row, categoryId: event.target.value }
                              : row,
                          ),
                        }))
                      }
                    >
                      {data.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className={fieldClass}
                      value={item.imageUrl ?? ""}
                      placeholder="Image URL"
                      onChange={(event) =>
                        setData((current) => ({
                          ...current,
                          items: current.items.map((row) =>
                            row.id === item.id ? { ...row, imageUrl: event.target.value } : row,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-[#062F24]">
                      <input
                        type="checkbox"
                        checked={item.isAvailable}
                        onChange={(event) =>
                          setData((current) => ({
                            ...current,
                            items: current.items.map((row) =>
                              row.id === item.id
                                ? { ...row, isAvailable: event.target.checked }
                                : row,
                            ),
                          }))
                        }
                      />
                      Available
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[#062F24]">
                      <input
                        type="checkbox"
                        checked={item.isActive}
                        onChange={(event) =>
                          setData((current) => ({
                            ...current,
                            items: current.items.map((row) =>
                              row.id === item.id
                                ? { ...row, isActive: event.target.checked }
                                : row,
                            ),
                          }))
                        }
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={saving}
                      onClick={() =>
                        void mutate(`/api/admin/menu/items/${item.id}`, "PATCH", item)
                      }
                      style={{ background: "#F6F4EF", color: "#062F24" }}
                    >
                      <Save size={16} /> Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-surface border border-[rgba(6,47,36,0.12)] p-5">
            <h2 className="text-lg font-bold text-[#062F24]">Modifier Groups</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_90px_90px_auto_auto]">
              <input
                className={fieldClass}
                placeholder="Group name"
                value={groupDraft.name}
                onChange={(event) =>
                  setGroupDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
              <input
                className={fieldClass}
                type="number"
                value={groupDraft.minSelections}
                onChange={(event) =>
                  setGroupDraft((current) => ({
                    ...current,
                    minSelections: Number(event.target.value),
                  }))
                }
              />
              <input
                className={fieldClass}
                type="number"
                value={groupDraft.maxSelections}
                onChange={(event) =>
                  setGroupDraft((current) => ({
                    ...current,
                    maxSelections: Number(event.target.value),
                  }))
                }
              />
              <label className="flex items-center gap-2 text-sm text-[#062F24]">
                <input
                  type="checkbox"
                  checked={groupDraft.isRequired}
                  onChange={(event) =>
                    setGroupDraft((current) => ({
                      ...current,
                      isRequired: event.target.checked,
                    }))
                  }
                />
                Required
              </label>
              <button
                type="button"
                className={buttonClass}
                disabled={saving || !groupDraft.name}
                onClick={() => void createGroup()}
                style={{ background: "#062F24", color: "#FFFFFF" }}
              >
                <Plus size={16} /> Add
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {data.modifierGroups.map((group) => (
                <div key={group.id} className="rounded-surface border border-[rgba(6,47,36,0.08)] p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_80px_80px]">
                    <input className={fieldClass} value={group.name} readOnly />
                    <input className={fieldClass} value={group.minSelections} readOnly />
                    <input className={fieldClass} value={group.maxSelections} readOnly />
                  </div>
                  <div className="mt-2 text-xs text-[#062F24]/60">
                    {group.options.filter((option) => option.isActive).length} active option(s)
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-surface border border-[rgba(6,47,36,0.12)] p-5">
            <h2 className="text-lg font-bold text-[#062F24]">Options and Assignments</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                className={fieldClass}
                value={optionDraft.modifierGroupId}
                onChange={(event) =>
                  setOptionDraft((current) => ({
                    ...current,
                    modifierGroupId: event.target.value,
                  }))
                }
              >
                <option value="">Option group</option>
                {activeGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <input
                className={fieldClass}
                placeholder="Option name"
                value={optionDraft.name}
                onChange={(event) =>
                  setOptionDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
              <input
                className={fieldClass}
                inputMode="decimal"
                placeholder="Price delta"
                value={optionDraft.price}
                onChange={(event) =>
                  setOptionDraft((current) => ({ ...current, price: event.target.value }))
                }
              />
              <button
                type="button"
                className={buttonClass}
                disabled={saving || !optionDraft.name || activeGroups.length === 0}
                onClick={() => void createOption()}
                style={{ background: "#062F24", color: "#FFFFFF" }}
              >
                <Plus size={16} /> Add option
              </button>
              <select
                className={fieldClass}
                value={assignmentDraft.menuItemId}
                onChange={(event) =>
                  setAssignmentDraft((current) => ({
                    ...current,
                    menuItemId: event.target.value,
                  }))
                }
              >
                <option value="">Assign item</option>
                {activeItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                className={fieldClass}
                value={assignmentDraft.modifierGroupId}
                onChange={(event) =>
                  setAssignmentDraft((current) => ({
                    ...current,
                    modifierGroupId: event.target.value,
                  }))
                }
              >
                <option value="">Assign group</option>
                {activeGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={buttonClass}
                disabled={saving || activeItems.length === 0 || activeGroups.length === 0}
                onClick={() => void createAssignment()}
                style={{ background: "#062F24", color: "#FFFFFF" }}
              >
                <Plus size={16} /> Assign
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {data.itemModifierGroups.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between gap-3 rounded-surface border border-[rgba(6,47,36,0.08)] p-3 text-sm text-[#062F24]"
                >
                  <span>
                    {data.items.find((item) => item.id === assignment.menuItemId)?.name ??
                      "Unknown item"}{" "}
                    {" -> "}
                    {data.modifierGroups.find(
                      (group) => group.id === assignment.modifierGroupId,
                    )?.name ?? "Unknown group"}
                  </span>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={saving}
                    onClick={() =>
                      void mutate(
                        `/api/admin/menu/item-modifier-groups/${assignment.id}`,
                        "DELETE",
                      )
                    }
                    style={{ background: "#F6F4EF", color: "#8A1F11" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
