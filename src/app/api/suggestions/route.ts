import {
  suggestionRequestSchema,
  suggestCarpools,
} from "@/lib/carpool";
import { apiError, requireGroupRole } from "@/lib/server-auth";

async function createSuggestions(request: Request) {
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

  await requireGroupRole(parsed.data.groupId, [
    "owner",
    "admin",
    "coordinator",
    "member",
  ]);

  return Response.json(suggestCarpools(parsed.data), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  try {
    return await createSuggestions(request);
  } catch (error) {
    return apiError(error);
  }
}
