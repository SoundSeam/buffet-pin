"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  DoorOpen,
  ImageIcon,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShoppingCart,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { FaStar } from "react-icons/fa";

type Step = "menu" | "checkout";
type ServiceType = "DELIVERY";
type Language = "FR" | "EN";
type DropoffOption = "HAND_TO_ME" | "LEAVE_AT_DOOR" | "LEAVE_AT_RECEPTION";

type ModifierOption = {
  id: string;
  modifierGroupId: string;
  name: string;
  priceDeltaCents: number;
  sortOrder: number;
};

type ModifierGroup = {
  id: string;
  name: string;
  description: string | null;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  options: ModifierOption[];
};

type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  sortOrder: number;
  modifierGroups: ModifierGroup[];
};

type MenuCategory = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  items: MenuItem[];
};

type CartItem = {
  cartId: string;
  menuItemId: string;
  modifierOptionIds: string[];
  quantity: number;
  specialInstructions: string;
};

type CustomerInfo = {
  name: string;
  phone: string;
  email: string;
  language: Language;
};

type DeliveryAddress = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  deliveryInstructions: string;
};

type CartState = {
  items: CartItem[];
  serviceType: ServiceType;
  customer: CustomerInfo;
  deliveryAddress: DeliveryAddress;
  tip: { mode: "percent" | "amount"; percent: number; amountDollars: string };
  customerNotes: string;
};

type PricedCart = {
  itemsSubtotalCents: number;
  gstCents: number;
  qstCents: number;
  taxCents: number;
  tipCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  delivery: { distanceKm: number; address: { formattedAddress: string } } | null;
  items: {
    menuItemId: string;
    menuItemNameSnapshot: string;
    quantity: number;
    unitPriceCents: number;
    modifiersTotalCents: number;
    lineSubtotalCents: number;
    modifiers: {
      modifierOptionId: string;
      modifierOptionNameSnapshot: string;
      priceDeltaCents: number;
    }[];
  }[];
};

type PublicOrderSettings = {
  deliveryFeeCents: number;
  freeDeliveryThresholdCents: number | null;
};

type CheckoutSuccess = {
  publicCode: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  checkoutUrl: string | null;
};

type AddressSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

type AddressDetails = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  formattedAddress: string;
};

type Props = {
  initialStep: Step;
};

const CART_STORAGE_KEY = "buffet-pin-public-cart-v1";
const ORDER_HERO_IMAGE =
  "https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/BuffetPinFood.png";

const emptyCart: CartState = {
  items: [],
  serviceType: "DELIVERY",
  customer: {
    name: "",
    phone: "",
    email: "",
    language: "FR",
  },
  deliveryAddress: {
    addressLine1: "",
    addressLine2: "",
    city: "Chateauguay",
    province: "QC",
    postalCode: "",
    country: "CA",
    deliveryInstructions: "",
  },
  tip: {
    mode: "percent",
    percent: 15,
    amountDollars: "",
  },
  customerNotes: "",
};

const stepPath: Record<Step, string> = {
  menu: "/order",
  checkout: "/order/checkout",
};
const closedOrderingErrorCodes = new Set([
  "ONLINE_ORDERING_DISABLED",
  "PICKUP_DISABLED",
  "DELIVERY_DISABLED",
]);
const GST_RATE_PPM = 50000;
const QST_RATE_PPM = 99750;

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

function dollarsToCents(value: string) {
  const numeric = Number(value.trim() || "0");
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric * 100)) : 0;
}

function calculatePpmAmountCents(amountCents: number, ratePpm: number) {
  return Math.round((amountCents * ratePpm) / 1_000_000);
}

function itemSignature(item: Pick<CartItem, "menuItemId" | "modifierOptionIds" | "specialInstructions">) {
  return JSON.stringify({
    menuItemId: item.menuItemId,
    modifierOptionIds: [...item.modifierOptionIds].sort(),
    specialInstructions: item.specialInstructions.trim(),
  });
}

function buildCartPayload(cart: CartState) {
  return {
    serviceType: "DELIVERY" as const,
    items: cart.items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      modifierOptionIds: item.modifierOptionIds,
      specialInstructions: item.specialInstructions,
    })),
    tip:
      cart.tip.mode === "amount"
        ? { amountCents: dollarsToCents(cart.tip.amountDollars) }
        : { percent: cart.tip.percent },
    deliveryAddress: {
      ...cart.deliveryAddress,
    },
  };
}

function buildCheckoutPayload(cart: CartState) {
  return {
    ...buildCartPayload(cart),
    customer: cart.customer,
    customerNotes: cart.customerNotes,
  };
}

function formatDeliveryAddressInput(address: DeliveryAddress) {
  if (!address.addressLine1.trim()) {
    return "";
  }

  return [
    address.addressLine1,
    address.city,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function useStoredCart() {
  const [cart, setCart] = useState<CartState>(emptyCart);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setCart({ ...emptyCart, ...JSON.parse(stored), serviceType: "DELIVERY" });
      }
    } catch {
      setCart(emptyCart);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  return [cart, setCart] as const;
}

export default function OrderFlow({ initialStep }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [cart, setCart] = useStoredCart();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [orderSettings, setOrderSettings] = useState<PublicOrderSettings>({
    deliveryFeeCents: 0,
    freeDeliveryThresholdCents: null,
  });
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [selectedNote, setSelectedNote] = useState("");
  const [menuLoading, setMenuLoading] = useState(true);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSelecting, setAddressSelecting] = useState(false);
  const [addressEditing, setAddressEditing] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [dropoffDialogOpen, setDropoffDialogOpen] = useState(false);
  const [dropoffOption, setDropoffOption] = useState<DropoffOption>("LEAVE_AT_DOOR");
  const [draftDropoffOption, setDraftDropoffOption] = useState<DropoffOption>("LEAVE_AT_DOOR");
  const [draftDeliveryInstructions, setDraftDeliveryInstructions] = useState("");
  const [tipDialogOpen, setTipDialogOpen] = useState(false);
  const [draftTipAmountDollars, setDraftTipAmountDollars] = useState("");
  const [pricedCart, setPricedCart] = useState<PricedCart | null>(null);
  const [checkoutClosed, setCheckoutClosed] = useState(false);
  const [success, setSuccess] = useState<CheckoutSuccess | null>(null);

  const itemById = useMemo(() => {
    return new Map(categories.flatMap((category) => category.items.map((item) => [item.id, item])));
  }, [categories]);
  const menuItems = useMemo(() => categories.flatMap((category) => category.items), [categories]);
  const cartQuantity = cart.items.reduce((total, item) => total + item.quantity, 0);
  const clientSubtotal = cart.items.reduce((total, cartItem) => {
    const menuItem = itemById.get(cartItem.menuItemId);
    if (!menuItem) return total;

    const modifierTotal = menuItem.modifierGroups
      .flatMap((group) => group.options)
      .filter((option) => cartItem.modifierOptionIds.includes(option.id))
      .reduce((sum, option) => sum + option.priceDeltaCents, 0);

    return total + (menuItem.priceCents + modifierTotal) * cartItem.quantity;
  }, 0);
  const hasSelectedDeliveryAddress =
    Boolean(cart.deliveryAddress.addressLine1.trim()) &&
    Boolean(cart.deliveryAddress.city.trim()) &&
    Boolean(cart.deliveryAddress.postalCode.trim());
  const pricingSignature = useMemo(
    () =>
      JSON.stringify({
        items: cart.items.map((item) => ({
          menuItemId: item.menuItemId,
          modifierOptionIds: [...item.modifierOptionIds].sort(),
          quantity: item.quantity,
          specialInstructions: item.specialInstructions,
        })),
        tip: cart.tip,
        deliveryAddress: cart.deliveryAddress,
      }),
    [cart.deliveryAddress, cart.items, cart.tip],
  );
  const pricingCart = useMemo<CartState>(
    () => ({
      ...emptyCart,
      items: cart.items,
      serviceType: cart.serviceType,
      deliveryAddress: cart.deliveryAddress,
      tip: cart.tip,
    }),
    [cart.deliveryAddress, cart.items, cart.serviceType, cart.tip],
  );
  const fallbackGstCents = calculatePpmAmountCents(clientSubtotal, GST_RATE_PPM);
  const fallbackQstCents = calculatePpmAmountCents(clientSubtotal, QST_RATE_PPM);
  const fallbackTipCents =
    cart.tip.mode === "amount"
      ? dollarsToCents(cart.tip.amountDollars)
      : calculatePpmAmountCents(clientSubtotal, Math.round(cart.tip.percent * 10_000));
  const fallbackDeliveryFeeCents =
    orderSettings.freeDeliveryThresholdCents !== null &&
    clientSubtotal >= orderSettings.freeDeliveryThresholdCents
      ? 0
      : orderSettings.deliveryFeeCents;
  const fallbackTotalCents =
    clientSubtotal +
    fallbackGstCents +
    fallbackQstCents +
    fallbackTipCents +
    fallbackDeliveryFeeCents;
  const canPlaceOrder =
    cart.items.length > 0 &&
    hasSelectedDeliveryAddress &&
    Boolean(pricedCart) &&
    !pricingLoading &&
    !checkoutClosed;
  const placeOrderButtonLabel = checkoutClosed ? "Closed" : "Place order";

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  useEffect(() => {
    const loadMenu = async () => {
      setMenuLoading(true);
      setError("");

      try {
        const response = await fetch("/api/menu", { cache: "no-store" });
        const result = await response.json();

        if (!result.ok) {
          setError(result.error?.message ?? "Unable to load menu.");
          return;
        }

        setCategories(result.data.categories);
        setOrderSettings({
          deliveryFeeCents: result.data.orderSettings?.deliveryFeeCents ?? 0,
          freeDeliveryThresholdCents: result.data.orderSettings?.freeDeliveryThresholdCents ?? null,
        });
      } catch {
        setError("Unable to load menu.");
      } finally {
        setMenuLoading(false);
      }
    };

    void loadMenu();
  }, []);

  useEffect(() => {
    const formatted = formatDeliveryAddressInput(cart.deliveryAddress);

    if (formatted && !addressQuery.trim()) {
      setAddressQuery(formatted);
    }
  }, [addressQuery, cart.deliveryAddress]);

  useEffect(() => {
    if (step !== "checkout") {
      return;
    }

    const query = addressQuery.trim();

    if (query.length < 3) {
      setAddressSuggestions([]);
      setAddressLoading(false);
      setAddressError("");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setAddressLoading(true);
      setAddressError("");

      try {
        const response = await fetch(
          `/api/delivery/address/autocomplete?query=${encodeURIComponent(query)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();

        if (!result.ok) {
          setAddressSuggestions([]);
          setAddressError(result.error?.message ?? "Unable to search addresses.");
          return;
        }

        setAddressSuggestions(result.data.suggestions);
      } catch (autocompleteError) {
        if ((autocompleteError as Error).name !== "AbortError") {
          setAddressSuggestions([]);
          setAddressError("Unable to search addresses.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setAddressLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [addressQuery, step]);

  const goToStep = (nextStep: Step) => {
    setStep(nextStep);
    router.push(stepPath[nextStep]);
  };

  const updateCart = (
    updater: (current: CartState) => CartState,
    options: { resetPricing?: boolean } = {},
  ) => {
    const { resetPricing = true } = options;

    setError("");
    setSuccess(null);
    if (resetPricing) {
      setPricedCart(null);
      setCheckoutClosed(false);
    }
    setCart(updater);
  };

  const selectAddressSuggestion = async (suggestion: AddressSuggestion) => {
    setAddressSelecting(true);
    setAddressError("");

    try {
      const response = await fetch(
        `/api/delivery/address/details?placeId=${encodeURIComponent(suggestion.placeId)}`,
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!result.ok) {
        setAddressError(result.error?.message ?? "Unable to load this address.");
        return;
      }

      const address = result.data.address as AddressDetails;

      updateCart((current) => ({
        ...current,
        deliveryAddress: {
          ...current.deliveryAddress,
          addressLine1: address.addressLine1,
          city: address.city,
          province: address.province,
          postalCode: address.postalCode,
          country: address.country,
        },
      }));
      setAddressQuery(address.formattedAddress);
      setAddressSuggestions([]);
      setAddressEditing(false);
    } catch {
      setAddressError("Unable to load this address.");
    } finally {
      setAddressSelecting(false);
    }
  };

  const openDropoffDialog = () => {
    setDraftDropoffOption(dropoffOption);
    setDraftDeliveryInstructions(cart.deliveryAddress.deliveryInstructions);
    setDropoffDialogOpen(true);
  };

  const saveDropoffDialog = () => {
    setDropoffOption(draftDropoffOption);
    updateCart((current) => ({
      ...current,
      deliveryAddress: {
        ...current.deliveryAddress,
        deliveryInstructions: draftDeliveryInstructions,
      },
    }));
    setDropoffDialogOpen(false);
  };

  const openTipDialog = () => {
    setDraftTipAmountDollars(cart.tip.amountDollars);
    setTipDialogOpen(true);
  };

  const saveTipDialog = () => {
    updateCart((current) => ({
      ...current,
      tip: { mode: "amount", percent: current.tip.percent, amountDollars: draftTipAmountDollars },
    }));
    setTipDialogOpen(false);
  };

  const addSelectedItem = () => {
    if (!selectedItem) return;

    const nextItem: CartItem = {
      cartId: crypto.randomUUID(),
      menuItemId: selectedItem.id,
      modifierOptionIds: selectedModifiers,
      quantity: 1,
      specialInstructions: selectedNote,
    };
    const nextSignature = itemSignature(nextItem);

    updateCart((current) => {
      const matching = current.items.find((item) => itemSignature(item) === nextSignature);

      if (matching) {
        return {
          ...current,
          items: current.items.map((item) =>
            item.cartId === matching.cartId
              ? { ...item, quantity: Math.min(99, item.quantity + 1) }
              : item,
          ),
        };
      }

      return { ...current, items: [...current.items, nextItem] };
    });

    setSelectedItem(null);
    setSelectedModifiers([]);
    setSelectedNote("");
  };

  const toggleModifier = (group: ModifierGroup, optionId: string) => {
    setSelectedModifiers((current) => {
      const selected = current.includes(optionId);

      if (selected) {
        return current.filter((id) => id !== optionId);
      }

      const selectedInGroup = current.filter((id) =>
        group.options.some((option) => option.id === id),
      );

      if (selectedInGroup.length >= group.maxSelections) {
        const withoutGroup = current.filter(
          (id) => !group.options.some((option) => option.id === id),
        );
        return [...withoutGroup, optionId];
      }

      return [...current, optionId];
    });
  };

  const priceCart = useCallback(async (cartSnapshot: CartState, signal?: AbortSignal) => {
    if (cartSnapshot.items.length === 0) {
      return null;
    }

    setPricingLoading(true);
    setError("");
    setCheckoutClosed(false);

    try {
      const response = await fetch("/api/menu/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCartPayload(cartSnapshot)),
        signal,
      });
      const result = await response.json();

      if (signal?.aborted) {
        return null;
      }

      if (!result.ok) {
        const code = result.error?.code;

        setError(result.error?.message ?? "Unable to price this cart.");
        setPricedCart(null);
        setCheckoutClosed(closedOrderingErrorCodes.has(code));
        return null;
      }

      setPricedCart(result.data.pricedCart);
      setCheckoutClosed(false);
      return result.data.pricedCart as PricedCart;
    } catch (pricingError) {
      if ((pricingError as Error).name === "AbortError") {
        return null;
      }

      setError("Unable to price this cart.");
      return null;
    } finally {
      if (!signal?.aborted) {
        setPricingLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (step !== "checkout" || success || cart.items.length === 0 || !hasSelectedDeliveryAddress) {
      setPricingLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void priceCart(pricingCart, controller.signal);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [cart.items.length, hasSelectedDeliveryAddress, priceCart, pricingCart, pricingSignature, step, success]);

  const placeOrder = async () => {
    if (!cart.customer.name.trim() || !cart.customer.phone.trim()) {
      setError("Name and phone are required.");
      return;
    }

    setPlacingOrder(true);
    setError("");

    try {
      const response = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCheckoutPayload(cart)),
      });
      const result = await response.json();

      if (!result.ok) {
        const code = result.error?.code;

        setError(result.error?.message ?? "Unable to create checkout.");
        setCheckoutClosed(closedOrderingErrorCodes.has(code));
        if (closedOrderingErrorCodes.has(code)) {
          setPricedCart(null);
        }
        return;
      }

      setSuccess({
        publicCode: result.data.order.publicCode,
        paymentStatus: result.data.order.paymentStatus,
        fulfillmentStatus: result.data.order.fulfillmentStatus,
        checkoutUrl: result.data.payment.checkoutUrl,
      });
      setPricedCart(null);
      setCart(emptyCart);
    } catch {
      setError("Unable to create checkout.");
    } finally {
      setPlacingOrder(false);
    }
  };

  const renderMenu = () => (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-8">
        {menuLoading ? (
          <div className="flex min-h-64 items-center justify-center rounded-surface bg-white text-[#062F24] shadow-sm">
            <Loader2 className="animate-spin" aria-hidden="true" />
          </div>
        ) : menuItems.length === 0 ? (
          <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-8 text-[#062F24] shadow-sm">
            The ordering menu is empty.
          </div>
        ) : (
          <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedItem(item);
                  setSelectedModifiers([]);
                  setSelectedNote("");
                }}
                className="group block min-h-0 text-left text-[#062F24]"
                aria-label={`Add ${item.name} to cart`}
              >
                <span className="relative block aspect-square overflow-hidden rounded-surface bg-[#E5E5E5]">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[#062F24]/38">
                      <ImageIcon size={42} strokeWidth={1.5} aria-hidden="true" />
                    </span>
                  )}
                  <span
                    className="absolute bottom-3 right-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition duration-300 group-hover:scale-105"
                    aria-hidden="true"
                  >
                    <Plus size={22} strokeWidth={2.4} />
                  </span>
                </span>
                <span className="mt-3 block text-base font-medium leading-snug">{item.name}</span>
                <span className="mt-1 block text-sm font-normal leading-none text-[#062F24]/64">
                  {formatMoney(item.priceCents)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {renderSummary()}
    </div>
  );

  const renderSummary = () => (
    <aside className="h-fit rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-5 text-[#062F24] shadow-sm lg:sticky lg:top-24">
      <div>
        <h2 className="text-lg font-extrabold">Cart</h2>
      </div>

      <div className="mt-5 space-y-4">
        {cart.items.length === 0 ? (
          <p className="text-sm leading-6 text-[#062F24]/62">Choose menu items to start an order.</p>
        ) : (
          cart.items.map((cartItem) => {
            const menuItem = itemById.get(cartItem.menuItemId);
            const selectedOptions =
              menuItem?.modifierGroups
                .flatMap((group) => group.options)
                .filter((option) => cartItem.modifierOptionIds.includes(option.id)) ?? [];
            const modifierText = selectedOptions.map((option) => option.name).join(", ");
            const modifierTotal = selectedOptions.reduce((sum, option) => sum + option.priceDeltaCents, 0);
            const lineSubtotal = ((menuItem?.priceCents ?? 0) + modifierTotal) * cartItem.quantity;

            return (
              <div key={cartItem.cartId} className="-mx-5 border-t border-neutral-200 px-5 pt-4">
                <div className="grid grid-cols-[3.375rem_minmax(0,1fr)] gap-3 sm:grid-cols-[3.75rem_minmax(0,1fr)_auto] sm:items-center">
                  <div className="relative h-[3.375rem] w-[3.375rem] overflow-hidden rounded-button bg-neutral-100 sm:h-[3.75rem] sm:w-[3.75rem]">
                    {menuItem?.imageUrl ? (
                      <img src={menuItem.imageUrl} alt={menuItem.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-neutral-400">
                        <ImageIcon size={24} strokeWidth={1.5} aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold leading-tight">{menuItem?.name ?? "Menu item"}</p>
                    {modifierText ? (
                      <p className="mt-1 text-xs leading-5 text-neutral-500">{modifierText}</p>
                    ) : null}
                    {cartItem.specialInstructions ? (
                      <p className="mt-1 text-xs italic text-neutral-500">{cartItem.specialInstructions}</p>
                    ) : null}
                    <p className="mt-2 text-sm font-bold text-black">{formatMoney(lineSubtotal)}</p>
                  </div>

                  <div className="col-span-2 inline-flex w-fit items-center rounded-button bg-neutral-100 px-1 py-1 sm:col-span-1 sm:justify-self-end">
                    <button
                      type="button"
                      className="flex h-7 min-h-0 w-7 items-center justify-center rounded-button text-black"
                      onClick={() =>
                        updateCart((current) => ({
                          ...current,
                          items:
                            cartItem.quantity <= 1
                              ? current.items.filter((item) => item.cartId !== cartItem.cartId)
                              : current.items.map((item) =>
                                  item.cartId === cartItem.cartId
                                    ? { ...item, quantity: item.quantity - 1 }
                                    : item,
                                ),
                        }))
                      }
                      aria-label={cartItem.quantity <= 1 ? "Remove item" : "Decrease quantity"}
                    >
                      {cartItem.quantity <= 1 ? (
                        <Trash2 size={14} strokeWidth={2.4} aria-hidden="true" />
                      ) : (
                        <Minus size={15} strokeWidth={3} aria-hidden="true" />
                      )}
                    </button>
                    <span className="min-w-6 text-center text-sm font-bold text-black">{cartItem.quantity}</span>
                    <button
                      type="button"
                      className="flex h-7 min-h-0 w-7 items-center justify-center rounded-button text-black"
                      onClick={() =>
                        updateCart((current) => ({
                          ...current,
                          items: current.items.map((item) =>
                            item.cartId === cartItem.cartId
                              ? { ...item, quantity: Math.min(99, item.quantity + 1) }
                              : item,
                          ),
                        }))
                      }
                      aria-label="Increase quantity"
                    >
                      <Plus size={15} strokeWidth={3} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="-mx-5 mt-6 border-t border-neutral-200 px-5 pt-5">
        <div className="flex justify-between text-base font-extrabold text-black">
          <span>Item subtotal</span>
          <span>{formatMoney(clientSubtotal)}</span>
        </div>
        {step === "checkout" ? (
          <button
            type="button"
            onClick={() => goToStep("menu")}
            className="mt-5 inline-flex w-full items-center justify-center rounded-button border border-[rgba(6,47,36,0.14)] px-4 py-3 font-bold text-[#062F24] transition hover:bg-[rgba(6,47,36,0.04)]"
          >
            Add more items
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goToStep("checkout")}
            disabled={cart.items.length === 0}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-button bg-[#062F24] px-4 py-3 font-extrabold text-white transition hover:bg-[#0A3D30] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Go to checkout <ChevronRight size={17} aria-hidden="true" />
          </button>
        )}
      </div>
    </aside>
  );

  const renderTipControls = () => (
    <div className={step === "checkout" ? "" : "border-t border-[rgba(6,47,36,0.1)] pt-5"}>
      <div className="flex items-center justify-between gap-4">
        <label className={step === "checkout" ? "text-2xl font-extrabold text-black" : "text-xs font-bold uppercase text-[#062F24]/55"}>Tip</label>
      </div>
      <div className={step === "checkout" ? "mt-3 flex flex-wrap gap-2" : "mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr]"}>
        {[15, 20, 25].map((percent) => (
          <button
            key={percent}
            type="button"
            onClick={() =>
              updateCart((current) => ({
                ...current,
                tip: { ...current.tip, mode: "percent", percent, amountDollars: "" },
              }))
            }
            className={
              step === "checkout"
                ? `rounded-button px-4 py-2 text-sm font-bold transition ${
                    cart.tip.mode === "percent" && cart.tip.percent === percent
                      ? "bg-black text-white"
                      : "bg-neutral-100 text-black hover:bg-neutral-200"
                  }`
                : `rounded-button px-4 py-3 text-sm font-bold transition ${
                    cart.tip.mode === "percent" && cart.tip.percent === percent
                      ? "bg-[#062F24] text-white"
                      : "bg-[rgba(6,47,36,0.05)] text-[#062F24] hover:bg-[rgba(6,47,36,0.08)]"
                  }`
            }
          >
            {percent}%
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            updateCart((current) => ({
              ...current,
              tip: { ...current.tip, mode: "percent", percent: 0, amountDollars: "" },
            }))
          }
          className={
            step === "checkout"
              ? `rounded-button px-4 py-2 text-sm font-bold transition ${
                  cart.tip.mode === "percent" && cart.tip.percent === 0
                    ? "bg-black text-white"
                    : "bg-neutral-100 text-black hover:bg-neutral-200"
                }`
              : `rounded-button px-4 py-3 text-sm font-bold transition ${
                  cart.tip.mode === "percent" && cart.tip.percent === 0
                    ? "bg-[#062F24] text-white"
                    : "bg-[rgba(6,47,36,0.05)] text-[#062F24] hover:bg-[rgba(6,47,36,0.08)]"
                }`
          }
        >
          Not now
        </button>
        {cart.tip.mode === "amount" && cart.tip.amountDollars.trim() ? (
          <button
            type="button"
            onClick={openTipDialog}
            className={
              step === "checkout"
                ? "rounded-button bg-black px-4 py-2 text-sm font-bold text-white transition hover:bg-neutral-800"
                : "rounded-button bg-[#062F24] px-4 py-3 text-sm font-bold text-white"
            }
          >
            Other
          </button>
        ) : null}
        {step === "checkout" ? (
          <button
            type="button"
            onClick={openTipDialog}
            className="ml-auto rounded-button bg-neutral-100 px-4 py-2 text-sm font-extrabold text-black transition hover:bg-neutral-200"
          >
            Edit
          </button>
        ) : null}
      </div>
    </div>
  );

  const checkoutFieldClass =
    "rounded-button border border-neutral-200 bg-neutral-100 px-4 py-3 text-black placeholder:text-neutral-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black";
  const orderFieldClass =
    "rounded-button border border-[rgba(6,47,36,0.14)] bg-[rgba(6,47,36,0.04)] px-4 py-3 text-[#062F24]";
  const deliveryDetailRowClass = "flex min-h-[62px] items-center gap-3";
  const deliveryDetailTitleClass = "truncate text-base font-extrabold leading-5 text-black";
  const deliveryDetailSubtextClass = "mt-1 truncate text-sm font-medium leading-5 text-neutral-500";
  const deliveryDetailButtonClass =
    "shrink-0 rounded-button bg-neutral-100 px-4 py-2.5 text-sm font-extrabold leading-5 text-black transition hover:bg-neutral-200";
  const dropoffTitle =
    dropoffOption === "HAND_TO_ME"
      ? "Hand it to me"
      : dropoffOption === "LEAVE_AT_RECEPTION"
        ? "Leave at building reception"
        : "Leave at my door";
  const dropoffInstructionText = cart.deliveryAddress.deliveryInstructions.trim();

  const renderDeliveryFields = () => (
    <div className={step === "checkout" ? "space-y-3" : "space-y-3 border-t border-[rgba(6,47,36,0.1)] pt-5"}>
      <div className="min-h-[54px]">
        {hasSelectedDeliveryAddress && !addressEditing ? (
          <div className={deliveryDetailRowClass}>
            <MapPin size={22} className="shrink-0 text-neutral-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className={deliveryDetailTitleClass}>
                {cart.deliveryAddress.addressLine1}
              </p>
              <p className={deliveryDetailSubtextClass}>
                {[
                  cart.deliveryAddress.city,
                  cart.deliveryAddress.province,
                  cart.deliveryAddress.postalCode,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAddressEditing(true);
                setAddressSuggestions([]);
                setAddressError("");
              }}
              className={deliveryDetailButtonClass}
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="relative min-h-[54px]">
            <MapPin
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500"
            />
            <input
              value={addressQuery}
              onChange={(event) => {
                setAddressQuery(event.target.value);
                setAddressSuggestions([]);
                setAddressError("");
                updateCart((current) => ({
                  ...current,
                  deliveryAddress: {
                    ...current.deliveryAddress,
                    addressLine1: "",
                    city: "",
                    province: "QC",
                    postalCode: "",
                    country: "CA",
                  },
                }));
              }}
              placeholder="Search delivery address"
              autoComplete="street-address"
              className={`${step === "checkout" ? checkoutFieldClass : orderFieldClass} w-full pl-12 pr-12`}
            />
            {(addressLoading || addressSelecting) && (
              <Loader2
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-neutral-500"
              />
            )}

            {addressSuggestions.length > 0 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-[0_18px_48px_rgba(0,0,0,0.16)]">
                {addressSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.placeId}
                    type="button"
                    onClick={() => void selectAddressSuggestion(suggestion)}
                    className="flex w-full items-start gap-3 border-b border-neutral-100 px-4 py-3 text-left last:border-b-0 hover:bg-neutral-50"
                  >
                    <MapPin size={18} className="mt-0.5 shrink-0 text-neutral-500" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-black">
                        {suggestion.mainText}
                      </span>
                      {suggestion.secondaryText ? (
                        <span className="mt-0.5 block truncate text-sm text-neutral-500">
                          {suggestion.secondaryText}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {addressError ? (
        <p className="text-sm font-semibold text-[#7A211B]">{addressError}</p>
      ) : null}

      <div className={deliveryDetailRowClass}>
        <DoorOpen size={22} className="shrink-0 text-neutral-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className={deliveryDetailTitleClass}>{dropoffTitle}</p>
          <span
            tabIndex={0}
            onClick={openDropoffDialog}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDropoffDialog();
              }
            }}
            className="mt-1 block max-w-full cursor-pointer truncate text-left text-sm font-medium leading-5 text-[#087B45] transition hover:text-[#065F35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          >
            {dropoffInstructionText || "Add delivery instructions"}
          </span>
        </div>
        <button
          type="button"
          onClick={openDropoffDialog}
          className={deliveryDetailButtonClass}
        >
          Edit
        </button>
      </div>
    </div>
  );

  const renderDropoffDialog = () =>
    dropoffDialogOpen ? (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-4 py-8">
        <div className="w-full max-w-lg rounded-[18px] bg-white p-5 text-black shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold">Dropoff options</h2>
              {cart.deliveryAddress.addressLine1 ? (
                <p className="mt-3 text-sm text-neutral-600">
                  Deliver to {cart.deliveryAddress.addressLine1}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setDropoffDialogOpen(false)}
              className="flex h-9 min-h-0 w-9 items-center justify-center rounded-button bg-neutral-100 text-black transition hover:bg-neutral-200"
              aria-label="Close dropoff options"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {([
              ["HAND_TO_ME", "Hand it to me"],
              ["LEAVE_AT_DOOR", "Leave at my door"],
              ["LEAVE_AT_RECEPTION", "Leave at building reception"],
            ] as [DropoffOption, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDraftDropoffOption(value)}
                className={`flex min-h-12 w-full items-center justify-between rounded-button border px-4 py-3 text-left text-sm font-extrabold transition ${
                  draftDropoffOption === value
                    ? "border-black bg-neutral-100 text-black"
                    : "border-neutral-200 bg-white text-black hover:bg-neutral-50"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`h-5 w-5 rounded-full border-2 ${
                    draftDropoffOption === value
                      ? "border-black bg-black shadow-[inset_0_0_0_5px_#fff]"
                      : "border-neutral-500"
                  }`}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>

          <div className="mt-5">
            <label className="text-sm font-extrabold text-black" htmlFor="delivery-instructions">
              Instructions for delivery person
            </label>
            <textarea
              id="delivery-instructions"
              value={draftDeliveryInstructions}
              onChange={(event) => setDraftDeliveryInstructions(event.target.value)}
              placeholder="Example: Please leave it at the front porch, knock on arrival"
              rows={4}
              className="mt-2 w-full rounded-button border border-neutral-200 bg-neutral-100 px-4 py-3 text-black placeholder:text-neutral-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDropoffDialogOpen(false)}
              className="rounded-button px-5 py-3 text-sm font-extrabold text-black transition hover:bg-neutral-100"
            >
              Back
            </button>
            <button
              type="button"
              onClick={saveDropoffDialog}
              className="rounded-button bg-black px-5 py-3 text-sm font-extrabold text-white transition hover:bg-neutral-800"
            >
              Update
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const renderTipDialog = () =>
    tipDialogOpen ? (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-4 py-8">
        <div className="w-full max-w-md rounded-[18px] bg-white p-5 text-black shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold">Custom tip</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Add a custom amount for the delivery person.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTipDialogOpen(false)}
              className="flex h-9 min-h-0 w-9 items-center justify-center rounded-button bg-neutral-100 text-black transition hover:bg-neutral-200"
              aria-label="Close custom tip"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <label className="mt-6 block text-sm font-extrabold text-black" htmlFor="custom-tip">
            Tip amount
          </label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-neutral-500">
              $
            </span>
            <input
              id="custom-tip"
              value={draftTipAmountDollars}
              onChange={(event) => setDraftTipAmountDollars(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full rounded-button border border-neutral-200 bg-neutral-100 px-8 py-3 text-black placeholder:text-neutral-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setTipDialogOpen(false)}
              className="rounded-button px-5 py-3 text-sm font-extrabold text-black transition hover:bg-neutral-100"
            >
              Back
            </button>
            <button
              type="button"
              onClick={saveTipDialog}
              className="rounded-button bg-black px-5 py-3 text-sm font-extrabold text-white transition hover:bg-neutral-800"
            >
              Update
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const renderCheckoutTotalRows = () => {
    const totals = pricedCart;
    const shouldShowFallbackTotals = !totals && checkoutClosed && cart.items.length > 0;
    const pendingValue = pricingLoading ? "Calculating..." : "--";
    const gstValue = totals
      ? formatMoney(totals.gstCents)
      : shouldShowFallbackTotals
        ? formatMoney(fallbackGstCents)
        : pendingValue;
    const qstValue = totals
      ? formatMoney(totals.qstCents)
      : shouldShowFallbackTotals
        ? formatMoney(fallbackQstCents)
        : pendingValue;
    const deliveryFeeValue = totals
      ? formatMoney(totals.deliveryFeeCents)
      : shouldShowFallbackTotals
        ? formatMoney(fallbackDeliveryFeeCents)
        : pendingValue;
    const tipValue = totals
      ? formatMoney(totals.tipCents)
      : shouldShowFallbackTotals
        ? formatMoney(fallbackTipCents)
        : pendingValue;
    const totalValue = totals
      ? formatMoney(totals.totalCents)
      : pricingLoading
        ? "Calculating..."
        : checkoutClosed
          ? formatMoney(fallbackTotalCents)
        : hasSelectedDeliveryAddress
          ? "--"
          : "Add delivery address";

    return (
      <div className="space-y-3 text-sm text-neutral-600">
        <div className="flex justify-between gap-4">
          <span>Item subtotal</span>
          <span className="font-medium text-black">
            {formatMoney(totals?.itemsSubtotalCents ?? clientSubtotal)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span>GST</span>
          <span className="font-medium text-black">{gstValue}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>QST</span>
          <span className="font-medium text-black">{qstValue}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Delivery fee</span>
          <span className="font-medium text-black">{deliveryFeeValue}</span>
        </div>
        <div className="flex justify-between gap-4 border-b border-neutral-200 pb-3">
          <span>Tip</span>
          <span className="font-medium text-black">{tipValue}</span>
        </div>
        <div className="flex justify-between gap-4 text-base font-extrabold text-black">
          <span>Total</span>
          <span>{totalValue}</span>
        </div>
      </div>
    );
  };

  const renderCheckoutSummary = () => (
    <aside className="h-fit overflow-hidden rounded-[16px] bg-white text-black lg:sticky lg:top-24">
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-neutral-100">
            <img src={ORDER_HERO_IMAGE} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-extrabold">Buffet Pin</h2>
            <p className="truncate text-sm text-neutral-500">90 Boulevard Saint Jean Baptiste #3</p>
          </div>
          <ChevronRight size={22} className="text-neutral-500" aria-hidden="true" />
        </div>
        <button
          type="button"
          onClick={placeOrder}
          disabled={placingOrder || !canPlaceOrder}
          className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-button bg-black px-5 py-4 text-base font-extrabold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {placingOrder ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : null}
          {placeOrderButtonLabel}
        </button>
      </div>

      <div className="border-t border-neutral-100 px-5 py-5">
        <div className="flex items-center gap-3">
          <ShoppingCart size={22} className="text-neutral-500" aria-hidden="true" />
          <h3 className="text-lg font-extrabold">Cart summary ({cartQuantity} items)</h3>
        </div>
        <div className="mt-4 space-y-3">
          {cart.items.length === 0 ? (
            <p className="text-sm text-neutral-500">Choose menu items to start an order.</p>
          ) : (
            cart.items.map((cartItem) => {
              const menuItem = itemById.get(cartItem.menuItemId);
              return (
                <div key={cartItem.cartId} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {cartItem.quantity}x {menuItem?.name ?? "Menu item"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="border-t border-neutral-100 px-5 py-5">
        <h3 className="text-xl font-extrabold">Order total</h3>
        <div className="mt-5">{renderCheckoutTotalRows()}</div>
      </div>
    </aside>
  );

  const renderCheckoutSuccess = () => (
    <div className="rounded-[16px] bg-white p-8 text-center text-black">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black text-white">
        <Check size={26} aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-2xl font-extrabold">Order created</h2>
      <p className="mt-3 text-sm leading-6 text-neutral-600">
        Your order code is <span className="font-extrabold text-black">{success?.publicCode}</span>.
        Payment is still pending and will only be marked paid after Clover webhook reconciliation.
      </p>
      {success?.checkoutUrl ? (
        <a
          href={success.checkoutUrl}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-button bg-black px-6 py-3 font-extrabold text-white"
        >
          Continue to payment
        </a>
      ) : (
        <p className="mt-6 rounded-button bg-neutral-100 p-4 text-sm leading-6 text-neutral-700">
          Clover checkout is not configured yet, so no payment redirect was created.
        </p>
      )}
      <Link
        href="/order"
        className="mt-5 inline-flex items-center justify-center rounded-button bg-neutral-100 px-5 py-3 font-bold text-black"
      >
        Start another order
      </Link>
    </div>
  );

  const renderCheckout = () => (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {success ? (
          renderCheckoutSuccess()
        ) : (
          <>
            <section className="rounded-[16px] bg-white p-5 text-black sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-extrabold">
                  Delivery details
                </h2>
              </div>

              <div className="mt-6 space-y-5">
                {renderDeliveryFields()}
              </div>
            </section>

            <section className="rounded-[16px] bg-white p-5 text-black sm:p-6">
              {renderTipControls()}
            </section>

            <section className="rounded-[16px] bg-white p-5 text-black sm:p-6">
              <h2 className="text-2xl font-extrabold">Payment</h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <input
                  value={cart.customer.name}
                  onChange={(event) =>
                    updateCart((current) => ({
                      ...current,
                      customer: { ...current.customer, name: event.target.value },
                    }), { resetPricing: false })
                  }
                  placeholder="Name"
                  className={checkoutFieldClass}
                />
                <input
                  value={cart.customer.phone}
                  onChange={(event) =>
                    updateCart((current) => ({
                      ...current,
                      customer: { ...current.customer, phone: event.target.value },
                    }), { resetPricing: false })
                  }
                  placeholder="Phone"
                  className={checkoutFieldClass}
                />
                <input
                  value={cart.customer.email}
                  onChange={(event) =>
                    updateCart((current) => ({
                      ...current,
                      customer: { ...current.customer, email: event.target.value },
                    }), { resetPricing: false })
                  }
                  placeholder="Email"
                  className={checkoutFieldClass}
                />
                <select
                  value={cart.customer.language}
                  onChange={(event) =>
                    updateCart((current) => ({
                      ...current,
                      customer: {
                        ...current.customer,
                        language: event.target.value as Language,
                      },
                    }), { resetPricing: false })
                  }
                  className={checkoutFieldClass}
                >
                  <option value="FR">French</option>
                  <option value="EN">English</option>
                </select>
              </div>

              <textarea
                value={cart.customerNotes}
                onChange={(event) =>
                  updateCart(
                    (current) => ({ ...current, customerNotes: event.target.value }),
                    { resetPricing: false },
                  )
                }
                placeholder="Order notes"
                rows={4}
                className={`${checkoutFieldClass} mt-3 w-full`}
              />
            </section>

            <button
              type="button"
              onClick={placeOrder}
              disabled={placingOrder || !canPlaceOrder}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-button bg-black px-5 py-4 text-base font-extrabold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {placingOrder ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : null}
              {placeOrderButtonLabel}
            </button>
          </>
        )}
      </div>
      {renderCheckoutSummary()}
    </div>
  );

  const renderServerTotals = (totals: PricedCart) => (
    <div className="space-y-2 rounded-surface border border-[rgba(6,47,36,0.1)] bg-[rgba(6,47,36,0.035)] p-4 text-sm">
      {totals.delivery ? (
        <p className="mb-3 text-xs leading-5 text-[#062F24]/65">
          Delivery validated: {totals.delivery.address.formattedAddress} ·{" "}
          {totals.delivery.distanceKm.toFixed(2)} km
        </p>
      ) : null}
      <div className="flex justify-between">
        <span>Items</span>
        <span className="font-bold">{formatMoney(totals.itemsSubtotalCents)}</span>
      </div>
      <div className="flex justify-between">
        <span>GST</span>
        <span className="font-bold">{formatMoney(totals.gstCents)}</span>
      </div>
      <div className="flex justify-between">
        <span>QST</span>
        <span className="font-bold">{formatMoney(totals.qstCents)}</span>
      </div>
      <div className="flex justify-between">
        <span>Delivery</span>
        <span className="font-bold">{formatMoney(totals.deliveryFeeCents)}</span>
      </div>
      <div className="flex justify-between">
        <span>Tip</span>
        <span className="font-bold">{formatMoney(totals.tipCents)}</span>
      </div>
      <div className="flex justify-between border-t border-[rgba(6,47,36,0.1)] pt-3 text-base">
        <span className="font-extrabold">Total</span>
        <span className="font-extrabold">{formatMoney(totals.totalCents)}</span>
      </div>
    </div>
  );

  if (step === "checkout") {
    return (
      <section className="min-h-screen bg-neutral-100 pb-20 pt-16 text-black lg:pt-20">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          {error ? (
            <div className="mb-6 rounded-[16px] border border-[#A33A32]/25 bg-white p-4 text-sm font-semibold text-[#7A211B]">
              {error}
            </div>
          ) : null}

          {renderCheckout()}
          {renderDropoffDialog()}
          {renderTipDialog()}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white pb-20">
      <div className="bg-white pb-10 pt-16 lg:pb-14 lg:pt-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div
            className="min-h-[200px] overflow-hidden rounded-surface bg-[#062F24] sm:min-h-[230px] lg:min-h-[260px]"
            style={{
              backgroundImage: `url(${ORDER_HERO_IMAGE})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
            aria-hidden="true"
          />

          <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="max-w-2xl text-3xl font-semibold leading-tight text-black sm:text-4xl">
                Buffet Pin
              </h1>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search in Buffet Pin"
                className="h-12 w-full rounded-button bg-neutral-100 px-12 text-base text-black placeholder:text-black/45 focus:bg-white focus:ring-2 focus:ring-black"
                aria-label="Search in Buffet Pin"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 flex h-8 min-h-0 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black text-white"
                  aria-label="Clear search"
                >
                  <X size={16} strokeWidth={2.5} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 max-w-2xl text-sm font-normal leading-5 text-neutral-500">
            <div className="flex items-center gap-1.5 text-black">
              <span className="font-medium">4.7</span>
              <FaStar aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="font-normal text-neutral-500">(100+)</span>
            </div>
            <p className="mt-0.5">$0.99 Delivery Fee + $2.50-$6.50 Service Fee</p>
            <p>
              90 Boulevard Saint Jean Baptiste #3,
              <br />
              Châteauguay, Québec J6K 3A6
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {error ? (
          <div className="mb-6 rounded-surface border border-[#A33A32]/25 bg-[#A33A32]/10 p-4 text-sm font-semibold text-[#7A211B]">
            {error}
          </div>
        ) : null}

        {selectedItem ? (
          <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/55 p-4">
            <div className="mx-auto mt-20 max-w-2xl rounded-surface bg-white p-5 text-[#062F24] shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold">{selectedItem.name}</h2>
                  {selectedItem.description ? (
                    <p className="mt-2 text-sm leading-6 text-[#062F24]/65">{selectedItem.description}</p>
                  ) : null}
                </div>
                <span className="shrink-0 font-extrabold">{formatMoney(selectedItem.priceCents)}</span>
              </div>

              <div className="mt-6 space-y-5">
                {selectedItem.modifierGroups.map((group) => (
                  <div key={group.id}>
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-extrabold">{group.name}</h3>
                      <span className="text-xs font-bold text-[#062F24]/55">
                        {group.isRequired ? "Required" : "Optional"} · up to {group.maxSelections}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {group.options.map((option) => {
                        const selected = selectedModifiers.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleModifier(group, option.id)}
                            className={`flex items-center justify-between gap-4 rounded-button border px-4 py-3 text-left ${
                              selected
                                ? "border-[#062F24] bg-[#062F24] text-white"
                                : "border-[rgba(6,47,36,0.14)] bg-white"
                            }`}
                          >
                            <span className="font-semibold">{option.name}</span>
                            <span className="text-sm font-bold">
                              {option.priceDeltaCents > 0 ? `+${formatMoney(option.priceDeltaCents)}` : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <textarea
                  value={selectedNote}
                  onChange={(event) => setSelectedNote(event.target.value)}
                  placeholder="Item notes"
                  rows={3}
                  className="w-full rounded-button border border-[rgba(6,47,36,0.14)] bg-[rgba(6,47,36,0.04)] px-4 py-3 text-[#062F24]"
                />

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="inline-flex flex-1 items-center justify-center rounded-button border border-[rgba(6,47,36,0.14)] px-4 py-3 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addSelectedItem}
                    className="inline-flex flex-1 items-center justify-center rounded-button bg-[#C9A56A] px-4 py-3 font-extrabold text-[#062F24]"
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === "menu" ? renderMenu() : renderCheckout()}
      </div>
    </section>
  );
}
