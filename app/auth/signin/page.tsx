import { AuthStage } from "@/components/forms/auth-stage";
import { AuthForm } from "@/components/forms/auth-form";

export default function SignInPage() {
  return (
    <main className="auth-shell grain">
      {/* AuthStage 负责左侧引导区，AuthForm 负责真正的认证交互。 */}
      <AuthStage mode="signin">
        <AuthForm mode="signin" />
      </AuthStage>
    </main>
  );
}
