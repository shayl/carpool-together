function requireEnvironmentVariable(
  value: string | undefined,
  name: string,
): string {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const supabaseUrl = requireEnvironmentVariable(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);
const supabasePublishableKey = requireEnvironmentVariable(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);

export { supabasePublishableKey, supabaseUrl };
