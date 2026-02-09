import { SessionEventName } from "@/lib/profile";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackAnalyticsEvent(
  name: SessionEventName,
  payload: Record<string, number | string | boolean | null> = {},
): void {
  if (typeof window === "undefined") {
    return;
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", name, payload);
  }

  if (process.env.NODE_ENV !== "production") {
    // Keep local visibility during dev and QA.
    console.info("[analytics]", name, payload);
  }
}
