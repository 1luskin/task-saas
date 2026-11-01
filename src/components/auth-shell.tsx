import { LanguageSwitch } from "./language-switch";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icons/icon.svg" alt="" className="size-11 rounded-[12px]" />
            <span className="text-xl font-semibold tracking-tight">Werkplan</span>
          </div>
          <LanguageSwitch />
        </div>
        <div className="card-white p-6">{children}</div>
      </div>
    </main>
  );
}
