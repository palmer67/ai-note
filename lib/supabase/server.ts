import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getSupabaseUrl(),
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            // 把 Supabase 刷新的会话 cookie 回写到当前请求上下文，
            // 这样后续 Server Component 读取到的就是最新会话。
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // 某些 Server Component 渲染阶段不能直接写 cookie，这里静默跳过，
            // 中间件仍会负责主流程里的会话续期。
          }
        }
      }
    }
  );
}
