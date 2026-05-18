import type { ReactNode } from "react";

interface AuthStageProps {
  mode: "signin" | "signup";
  children: ReactNode;
}

const contentByMode = {
  signin: {
    eyebrow: "继续你的阅读工作",
    title: "回到你的 AI 笔记工作台",
    body: "你已经把产品最难的骨架搭起来了。现在每次登录，都是在一个真正能继续打磨和长期使用的小系统里继续前进。",
    points: ["进入个人工作台继续整理文章", "复用 AI 分析结果和标签体系", "管理员账号可进入全局后台"]
  },
  signup: {
    eyebrow: "开始新的知识库",
    title: "创建你的 AI 阅读笔记空间",
    body: "先从一个普通账号开始，保存第一篇好文章，体验从收藏到结构化拆解的完整链路。后面需要时，再提升为管理员账号。",
    points: ["邮箱密码注册，几分钟即可开始", "支持链接导入、标签整理与 AI 分析", "适合作为你学习全栈 AI 开发的长期项目"]
  }
} as const;

export function AuthStage({ mode, children }: AuthStageProps) {
  // 左侧文案区纯做引导，不承载任何业务状态，方便认证表单独立复用。
  const content = contentByMode[mode];

  return (
    <section className="auth-stage">
      <aside className="auth-spotlight">
        <span className="eyebrow">{content.eyebrow}</span>
        <h1 className="auth-spotlight-title">{content.title}</h1>
        <p className="auth-spotlight-copy">{content.body}</p>
        <div className="auth-spotlight-points">
          {content.points.map((point, index) => (
            <article key={point} className="auth-point-card">
              <span className="auth-point-index">{`0${index + 1}`}</span>
              <p>{point}</p>
            </article>
          ))}
        </div>
      </aside>
      <div className="auth-stage-form">{children}</div>
    </section>
  );
}
