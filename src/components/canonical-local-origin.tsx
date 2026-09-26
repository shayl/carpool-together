"use client";

import { useEffect } from "react";
import { canonicalLocalUrl } from "@/lib/canonical-local-url";

export function CanonicalLocalOrigin() {
  useEffect(() => {
    const canonicalUrl = canonicalLocalUrl(window.location.href);

    if (canonicalUrl) {
      window.location.replace(canonicalUrl);
    }
  }, []);

  return null;
}
