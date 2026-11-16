import { ApiClientError, apiFetch, type RequestOptions } from "@/lib/api";

/**
 * The frontend contract exposes /suppressions while the Spring module mounts
 * the same resource under /consent/suppressions. Try the contracted path first
 * and transparently fall back on a 404 so both deployments work.
 */
const CANDIDATE_BASES = ["/suppressions", "/consent/suppressions"] as const;

export async function suppressionRequest<T>(suffix = "", options: RequestOptions = {}): Promise<T> {
  let lastError: unknown;
  for (const base of CANDIDATE_BASES) {
    try {
      return await apiFetch<T>(`${base}${suffix}`, options);
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiClientError) || error.status !== 404) {
        throw error;
      }
    }
  }
  throw lastError;
}
