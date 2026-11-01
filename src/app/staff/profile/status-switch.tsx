"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { updateMyProfile } from "@/server/actions/members";
import { useAction } from "@/components/use-action";
import { cx } from "@/components/ui";
import type { MemberStatus } from "@/lib/supabase/types";

export function StatusSwitch({ initial }: { initial: MemberStatus }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [s, setS] = useState(initial);
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["active", "vacation", "sick"] as const).map((v) => (
        <button
          key={v}
          disabled={pending}
          onClick={() => { setS(v); run(() => updateMyProfile({ status: v })); }}
          className={cx("btn border !px-2 text-[15px]", s === v ? (v === "active" ? "border-accent bg-accent text-white" : "border-danger bg-danger text-white") : "border-line bg-surface")}
        >
          {t(`memberStatus.${v}`)}
        </button>
      ))}
    </div>
  );
}
