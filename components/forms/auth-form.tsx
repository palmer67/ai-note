"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  mode: "signin" | "signup";
}

function translateAuthMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "邮箱或密码不正确。";
  }

  if (normalized.includes("email not confirmed")) {
    return "邮箱尚未验证，请先完成邮箱验证。";
  }

  if (normalized.includes("user already registered")) {
    return "这个邮箱已经注册过了。";
  }

  if (normalized.includes("password should be at least")) {
    return "密码长度太短，请至少使用 6 位密码。";
  }

  if (normalized.includes("unable to validate email address")) {
    return "邮箱格式不正确。";
  }

  if (normalized.includes("signup is disabled")) {
    return "当前项目暂未开放注册。";
  }

  return `操作失败：${message}`;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isSignIn = mode === "signin";
  const isError = feedback ? /required|invalid|error|failed|失败|错误|无效|不正确|尚未/i.test(feedback) : false;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      if (!email.trim() || !password.trim()) {
        setFeedback("邮箱和密码都需要填写。");
        return;
      }

      if (isSignIn) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) {
          setFeedback(translateAuthMessage(error.message));
          return;
        }

        router.push("/dashboard");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password
      });

      if (error) {
        setFeedback(translateAuthMessage(error.message));
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setFeedback("账号已创建。如果当前项目开启了邮箱验证，请先去邮箱完成验证后再登录。");
    });
  }

  return (
    <section className="auth-card">
      <div className="stack">
        <span className="eyebrow">{isSignIn ? "欢迎回来" : "创建你的空间"}</span>
        <div>
          <h1>{isSignIn ? "登录你的文章笔记库" : "开始你的 AI 阅读笔记本"}</h1>
          <p>
            {isSignIn
              ? "使用邮箱和密码进入你的笔记工作台。"
              : "先注册一个普通账号，后面可以再到 Supabase 里把它提升为管理员。"}
          </p>
        </div>

        <form className="stack" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">邮箱</label>
            <input
              id="email"
              name="email"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="请输入你的邮箱"
            />
          </div>

          <div className="field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              name="password"
              autoComplete={isSignIn ? "current-password" : "new-password"}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
            />
          </div>

          {feedback ? <p className={`feedback${isError ? " error" : ""}`}>{feedback}</p> : null}

          <button className="button" type="submit" disabled={pending}>
            {pending ? "处理中..." : isSignIn ? "登录" : "注册账号"}
          </button>
        </form>

        <p className="help-text">
          {isSignIn ? "还没有账号？" : "已经有账号了？"}{" "}
          <Link href={isSignIn ? "/auth/signup" : "/auth/signin"} className="small-link">
            {isSignIn ? "去注册" : "去登录"}
          </Link>
        </p>
      </div>
    </section>
  );
}
