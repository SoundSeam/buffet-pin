import { getAppUrl } from "@/lib/env";

export function buildManagePath(manageToken: string): string {
  return `/m/${encodeURIComponent(manageToken)}`;
}

export function buildManageUrl(manageToken: string): string {
  return new URL(buildManagePath(manageToken), getAppUrl()).toString();
}
