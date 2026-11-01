"use client";
import { useState, useTransition } from "react";
import { updateMyProfile } from "@/server/actions/members";
import { cx } from "../ui";

/** iOS-artiger Schalter für Profil-Booleans */
export function ProfileToggle({ field, initial, label }: { field: "notify_overdue" | "notify_done"; initial: boolean; label: string }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          const r = await updateMyProfile({ [field]: next });
          if (!r.ok) setOn(!next);
        });
      }}
      className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left lg:min-h-12"
    >
      <span>{label}</span>
      <span className={cx("relative h-8 w-[52px] shrink-0 rounded-full transition", on ? "bg-accent" : "bg-line")}>
        <span className={cx("absolute top-1 size-6 rounded-full bg-white shadow transition-all", on ? "left-[24px]" : "left-1")} />
      </span>
    </button>
  );
}
