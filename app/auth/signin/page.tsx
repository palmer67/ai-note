import { AuthStage } from "@/components/forms/auth-stage";
import { AuthForm } from "@/components/forms/auth-form";

export default function SignInPage() {
  return (
    <main className="auth-shell grain">
      <AuthStage mode="signin">
        <AuthForm mode="signin" />
      </AuthStage>
    </main>
  );
}
