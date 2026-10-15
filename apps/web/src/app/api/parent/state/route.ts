import { getParentApp } from "@/lib/parent-device";
import { parentAppState } from "@/lib/parent-app";

export async function GET() {
  const parent = await getParentApp();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  return Response.json(await parentAppState(parent.id), { headers: { "cache-control": "no-store" } });
}
