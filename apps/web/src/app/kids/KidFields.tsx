import { field, labelText } from "@/components/ui";
import { UI_STYLES } from "@/lib/age-band";

type Defaults = {
  name?: string;
  grade?: number;
  minutesPerQuestion?: number;
  dailyCapMinutes?: number;
  uiStyle?: string;
};

export function KidFields({ d = {}, pinHint }: { d?: Defaults; pinHint: string }) {
  return (
    <div className="space-y-4">
      <label className={labelText}>
        Name
        <input name="name" required defaultValue={d.name} className={field} />
      </label>
      <label className={labelText}>
        Grade (1-12)
        <input name="grade" type="number" min={1} max={12} required defaultValue={d.grade} className={field} />
      </label>
      <label className={labelText}>
        Minutes earned per correct answer
        <input name="minutesPerQuestion" type="number" min={1} max={60} required defaultValue={d.minutesPerQuestion ?? 10} className={field} />
      </label>
      <label className={labelText}>
        Daily limit on earned minutes
        <input name="dailyCapMinutes" type="number" min={10} max={480} required defaultValue={d.dailyCapMinutes ?? 120} className={field} />
      </label>
      <label className={labelText}>
        Look of the kid&apos;s app
        <select name="uiStyle" defaultValue={d.uiStyle ?? "auto"} className={field}>
          {UI_STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelText}>
        Kid&apos;s PIN (4 digits)
        <input name="pin" inputMode="numeric" pattern="\d{4}" placeholder={pinHint} autoComplete="off" className={field} />
      </label>
    </div>
  );
}
