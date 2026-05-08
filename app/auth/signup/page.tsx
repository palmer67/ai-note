import { AuthForm } from "@/components/forms/auth-form";

export default function SignUpPage() {
  return (
    <main className="auth-shell grain">
      <AuthForm mode="signup" />
    </main>
  );
}
