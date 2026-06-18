export const CAD_CURRENCY_CODE = "CAD";
export const GST_RATE_PPM = 50000;
export const QST_RATE_PPM = 99750;

const CAD_FORMATTER = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: CAD_CURRENCY_CODE,
});

export type TaxBreakdownCents = {
  taxableSubtotalCents: number;
  gstCents: number;
  qstCents: number;
  taxCents: number;
};

export function isIntegerCents(value: unknown): value is number {
  return Number.isSafeInteger(value);
}

export function isNonNegativeCents(value: unknown): value is number {
  return isIntegerCents(value) && value >= 0;
}

export function assertIntegerCents(
  value: unknown,
  fieldName = "amountCents",
): asserts value is number {
  if (!isIntegerCents(value)) {
    throw new Error(`${fieldName} must be an integer number of cents.`);
  }
}

export function assertNonNegativeCents(
  value: unknown,
  fieldName = "amountCents",
): asserts value is number {
  if (!isNonNegativeCents(value)) {
    throw new Error(`${fieldName} must be a non-negative integer number of cents.`);
  }
}

export function formatCadCents(amountCents: number): string {
  assertIntegerCents(amountCents);
  return CAD_FORMATTER.format(amountCents / 100);
}

export function calculatePpmAmountCents(
  amountCents: number,
  ratePpm: number,
): number {
  assertNonNegativeCents(amountCents);

  if (!Number.isSafeInteger(ratePpm) || ratePpm < 0) {
    throw new Error("ratePpm must be a non-negative integer.");
  }

  return Math.round((amountCents * ratePpm) / 1_000_000);
}

export function calculateQuebecTaxCents(
  taxableSubtotalCents: number,
  gstRatePpm = GST_RATE_PPM,
  qstRatePpm = QST_RATE_PPM,
): TaxBreakdownCents {
  assertNonNegativeCents(taxableSubtotalCents, "taxableSubtotalCents");

  const gstCents = calculatePpmAmountCents(taxableSubtotalCents, gstRatePpm);
  const qstCents = calculatePpmAmountCents(taxableSubtotalCents, qstRatePpm);

  return {
    taxableSubtotalCents,
    gstCents,
    qstCents,
    taxCents: gstCents + qstCents,
  };
}
