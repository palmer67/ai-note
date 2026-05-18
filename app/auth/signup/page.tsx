import { AuthStage } from "@/components/forms/auth-stage";
import { AuthForm } from "@/components/forms/auth-form";

export default function SignUpPage() {
  return (
    <main className="auth-shell grain">
      {/* 注册页和登录页共用同一套骨架，只切换文案和提交模式。 */}
      <AuthStage mode="signup">
        <AuthForm mode="signup" />
      </AuthStage>
    </main>
  );
}
