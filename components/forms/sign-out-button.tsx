"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
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
          router.push("/auth/signin");
          router.refresh();
        });
      }}
    >
      {pending ? "退出中..." : "退出登录"}
    </button>
  );
}
