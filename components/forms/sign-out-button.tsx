"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="ghost-button quiet-button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await supabase.auth.signOut();
          const from = pathname?.startsWith("/dashboard/admin") ? "admin" : "dashboard";

          router.push(`/auth/signin?signed_out=1&from=${from}`);
          router.refresh();
        });
      }}
    >
      {pending ? "退出中..." : "退出登录"}
    </button>
  );
}
