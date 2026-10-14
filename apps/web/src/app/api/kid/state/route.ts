import { getDevice, isUnlocked } from "@/lib/device-auth";
import { kidState } from "@/lib/kid-service";
import { setsAwaitingPaper } from "@/lib/paper-service";

export async function GET() {
  const ctx = await getDevice();
  if (!ctx) return Response.json({ error: "device not paired" }, { status: 401 });
  if (!isUnlocked(ctx, new Date())) return Response.json({ error: "PIN required" }, { status: 403 });
  const [state, paperSets] = await Promise.all([kidState(ctx.kid), setsAwaitingPaper(ctx.kid.id)]);
  // paperSets: homework the kid can photograph a finished paper for.
  return Response.json({ ...state, paperSets, aiCheckEnabled: ctx.kid.aiCheckEnabled });
}
