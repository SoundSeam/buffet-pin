/** Blank means unpublished; zero is an explicit price. Reject rather than round. */
export function parseDrinkPrice(input: string): number | null {
  const value = input.trim().replace(",", ".");
  if (!value) return null;
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(value)) throw new Error("Enter a price such as 4.50, or leave it blank.");
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents > 1_000_000) throw new Error("The maximum price is 10,000.00.");
  return cents;
}
