import { AuthStage } from "@/components/forms/auth-stage";
import { AuthForm } from "@/components/forms/auth-form";

export default function SignUpPage() {
  return (
    <main className="auth-shell grain">
      <AuthStage mode="signup">
        <AuthForm mode="signup" />
      </AuthStage>
    </main>
  );
}
