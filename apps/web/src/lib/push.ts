import { eq } from "drizzle-orm";
import webpush from "web-push";
import { getDb } from "@/db";
import { appSecrets, homeworkSets, kids, paperSubmissions, pushSubscriptions } from "@/db/schema";

type Vapid = { publicKey: string; privateKey: string };

let cached: Vapid | null = null;

/** The Web Push signing keys. Made once and kept in the database, so nothing has to be configured by hand. */
export async function vapidKeys(): Promise<Vapid> {
  if (cached) return cached;
  const db = getDb();
  const read = async () => (await db.select().from(appSecrets).where(eq(appSecrets.name, "vapid")))[0];
  let row = await read();
  if (!row) {
    // Two requests may race here: the first insert wins, and both then read the winner's keys.
    await db.insert(appSecrets).values({ name: "vapid", value: JSON.stringify(webpush.generateVAPIDKeys()) }).onConflictDoNothing();
    row = await read();
  }
  cached = JSON.parse(row.value) as Vapid;
  return cached;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Sends a notification to every device a parent has turned notifications on for. Dead subscriptions are removed. */
export async function pushToParent(parentId: string, payload: PushPayload): Promise<number> {
  const db = getDb();
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.parentId, parentId));
  if (subs.length === 0) return 0;
  const keys = await vapidKeys();
  const options = { vapidDetails: { subject: "mailto:noreply@study-plan.invalid", publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 60 * 60 * 24 };
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), options);
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
      }
    }),
  );
  return sent;
}

/** The parent hears about a paper a kid just sent: "needs checking", or "the AI checked it". Never throws. */
export async function notifyPaper(submissionId: string, aiChecked?: { correct: number; total: number }) {
  try {
    const [row] = await getDb()
      .select({ parentId: kids.parentId, kidId: kids.id, kidName: kids.name, subject: homeworkSets.subject })
      .from(paperSubmissions)
      .innerJoin(kids, eq(kids.id, paperSubmissions.kidId))
      .innerJoin(homeworkSets, eq(homeworkSets.id, paperSubmissions.setId))
      .where(eq(paperSubmissions.id, submissionId));
    if (!row) return;
    await pushToParent(row.parentId, {
      title: aiChecked ? `${row.kidName}: the AI checked ${row.subject}` : `${row.kidName} sent a paper`,
      body: aiChecked ? `${aiChecked.correct} of ${aiChecked.total} right. Tap to look.` : `${row.subject}: tap to check it`,
      url: `/kids/${row.kidId}/papers/${submissionId}`,
      tag: `paper-${submissionId}`,
    });
  } catch {
    // A notification must never break a kid's upload.
  }
}
