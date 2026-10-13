import { getDevice, isUnlocked } from "@/lib/device-auth";
import { kidState } from "@/lib/kid-service";

export async function GET() {
  const ctx = await getDevice();
  if (!ctx) return Response.json({ error: "device not paired" }, { status: 401 });
  if (!isUnlocked(ctx, new Date())) return Response.json({ error: "PIN required" }, { status: 403 });
  return Response.json(await kidState(ctx.kid));
}
