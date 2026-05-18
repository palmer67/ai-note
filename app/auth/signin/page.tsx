import { Suspense } from "react";

import { AuthStage } from "@/components/forms/auth-stage";
import { AuthForm } from "@/components/forms/auth-form";

export default function SignInPage() {
  return (
    <main className="auth-shell grain">
      {/* AuthStage 负责左侧引导区，AuthForm 负责真正的认证交互。 */}
      <AuthStage mode="signin">
        {/* AuthForm 内部使用了 useSearchParams，生产构建下需要 Suspense 包裹。 */}
        <Suspense fallback={null}>
          <AuthForm mode="signin" />
        </Suspense>
      </AuthStage>
    </main>
  );
}
