import {
  suggestionRequestSchema,
  suggestCarpools,
} from "@/lib/carpool";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = suggestionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "The suggestion request is invalid.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  return Response.json(suggestCarpools(parsed.data), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
