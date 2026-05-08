import Link from "next/link";

const pillars = [
  {
    title: "收藏高价值内容",
    body: "把真正值得回看的文章收进来，而不是再堆一个永远不看的收藏夹。"
  },
  {
    title: "只做轻量标记",
    body: "你只需要写一个简短标记，真正的归纳和拆解交给 AI 去完成。"
  },
  {
    title: "边做边学 AI 开发",
    body: "这个项目把页面、数据库、登录和模型调用都拆得很清楚，适合你一边做一边理解。"
  }
];

export default function HomePage() {
  return (
    <main className="landing-shell grain">
      <nav className="landing-nav">
        <div className="brand-lockup">
          <span className="brand-mark">AI Notes</span>
          <span className="brand-caption">把好文章存下来，再交给 AI 做结构化拆解</span>
        </div>
        <div className="inline-actions">
          <Link href="/auth/signin" className="ghost-button">
            登录
          </Link>
          <Link href="/auth/signup" className="button">
            注册
          </Link>
        </div>
      </nav>

      <section className="hero-grid">
        <div className="surface hero-copy">
          <span className="hero-kicker">做一个项目，学两层能力</span>
          <h1 className="hero-title">把好文章变成你真的会回看的笔记。</h1>
          <p className="hero-lead">
            AI Notes 是一个带真实产品骨架的 AI 学习项目：有登录、有角色权限、有数据库策略，也有一条受保护的
            AI 分析链路，能把长文章转成清晰的学习卡片。
          </p>
          <div className="hero-actions">
            <Link href="/auth/signup" className="button">
              开始使用
            </Link>
            <Link href="/auth/signin" className="button secondary">
              进入工作台
            </Link>
          </div>
        </div>

        <aside className="surface hero-card reading-card">
          <div className="card-strip">
            <span className="eyebrow">AI 输出示例</span>
            <span>单篇文章</span>
          </div>
          <div className="card-title">从收藏文章到结构化学习卡片</div>
          <div className="card-body">
            第一版只专注一件事：把高质量文章保存下来，加一个轻量标记，然后拿到主题、核心观点、论据、适用场景和启发。
          </div>
          <div className="mini-grid">
            <span className="feature-chip">登录与角色</span>
            <span className="feature-chip">用户笔记</span>
            <span className="feature-chip">管理员可见</span>
            <span className="feature-chip">受保护 AI 路由</span>
          </div>
        </aside>
      </section>

      <section className="section-block">
        <span className="section-kicker">为什么做这个项目</span>
        <h2 className="section-title">它很小，但骨架是真实 AI 产品那一套。</h2>
        <p className="section-lead">
          它不是一个只看效果的假 Demo，而是把你以后做更大 AI 应用时会反复遇到的几层能力都串起来：
          登录态页面、安全模型调用、行级权限控制，以及从简单功能自然长到检索和 Agent 的演进路径。
        </p>
        <div className="feature-grid">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="feature-card">
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
