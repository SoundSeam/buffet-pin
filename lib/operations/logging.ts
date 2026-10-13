export function operationalLog(event: string, fields: Record<string, string | number | boolean | null | undefined> = {}) {
  console.info(JSON.stringify({ timestamp: new Date().toISOString(), event, ...fields }));
}
