import {
  minimumQueryLength,
  normalizeSuggestions,
  photonSuggestUrl,
} from "@/lib/address-suggestions";
import { apiError, requireUserId } from "@/lib/server-auth";

// Proxied rather than called from the browser so the upstream sees a single
// identified caller, and so repeated prefixes are served from the cache
// instead of hitting a free public service on every keystroke.
export async function GET(request: Request) {
  try {
    await requireUserId();

    const params = new URL(request.url).searchParams;
    const query = (params.get("q") ?? "").trim();
    const language = params.get("lang") ?? "";
    if (query.length < minimumQueryLength) {
      return Response.json({ suggestions: [] });
    }

    const upstream = photonSuggestUrl(query, {
      language,
      bias: process.env.ADDRESS_SUGGEST_BBOX,
    });

    let response: Response;
    try {
      response = await fetch(upstream, {
        headers: {
          "User-Agent": "CarpoolTogether/1.0",
          Accept: "application/json",
        },
        next: { revalidate: 86400 },
      });
    } catch {
      // Autocomplete is an optional aid: fall back to plain typing.
      return Response.json({ suggestions: [] });
    }
    if (!response.ok) {
      return Response.json({ suggestions: [] });
    }

    const payload = await response.json().catch(() => null);
    return Response.json(
      { suggestions: normalizeSuggestions(payload) },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
