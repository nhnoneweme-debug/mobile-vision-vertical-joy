import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function MobileShell({
  children,
  hideNav = false,
}: {
  children: ReactNode;
  hideNav?: boolean;
}) {
  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-background">
      <main
        className="flex-1 pb-28"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
