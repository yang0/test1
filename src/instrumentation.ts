export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { bootstrapLocalFoundation } = await import("@/lib/server/bootstrap");
  await bootstrapLocalFoundation();
}
