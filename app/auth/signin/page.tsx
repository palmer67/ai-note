import { AuthForm } from "@/components/forms/auth-form";

export default function SignInPage() {
  return (
    <main className="auth-shell grain">
      <AuthForm mode="signin" />
    </main>
  );
}
