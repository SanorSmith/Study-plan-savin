type Defaults = {
  name?: string;
  grade?: number;
  minutesPerQuestion?: number;
  dailyCapMinutes?: number;
};

const input = "mt-1 w-full rounded border p-2";

export function KidFields({ d = {}, pinHint }: { d?: Defaults; pinHint: string }) {
  return (
    <div className="space-y-4">
      <label className="block">
        Name
        <input name="name" required defaultValue={d.name} className={input} />
      </label>
      <label className="block">
        Grade (1-12)
        <input name="grade" type="number" min={1} max={12} required defaultValue={d.grade} className={input} />
      </label>
      <label className="block">
        Minutes earned per correct answer
        <input name="minutesPerQuestion" type="number" min={1} max={60} required defaultValue={d.minutesPerQuestion ?? 10} className={input} />
      </label>
      <label className="block">
        Daily cap (minutes)
        <input name="dailyCapMinutes" type="number" min={10} max={480} required defaultValue={d.dailyCapMinutes ?? 120} className={input} />
      </label>
      <label className="block">
        PIN (4 digits)
        <input name="pin" inputMode="numeric" pattern="\d{4}" placeholder={pinHint} className={input} />
      </label>
    </div>
  );
}
