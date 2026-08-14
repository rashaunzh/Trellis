import Link from "next/link";
import ProductStory from "./ProductStory";
import "./product.css";

export const metadata = {
  title: "Trellis 产品介绍",
  description: "可信的动态学习编排：从学习地图到周计划、活动证据和成长调整。",
};

export default function ProductPage() {
  return (
    <main className="tp-page">
      <section className="tp-hero">
        <nav className="tp-nav">
          <b>Trellis</b>
          <div>
            <Link href="/learn">进入学习页</Link>
            <Link href="/grow">看成长地图</Link>
            <Link href="/workbench">打开工作台</Link>
          </div>
        </nav>
        <div className="tp-hero-grid">
          <div>
            <p className="tp-eyebrow">AI-native learning system</p>
            <h1>从混乱信息里，找到可信路径，并把它变成这周能做的学习活动。</h1>
            <p className="tp-lead">
              Trellis 不是课程平台、todo 软件或聊天机器人首页。它维护一张可解释的成长地图，
              根据目标、材料、时间和真实证据，动态编排你的学习路线。
            </p>
            <div className="tp-actions">
              <Link className="tp-primary" href="/learn">开始体验闭环</Link>
              <a className="tp-secondary" href="#story">查看交互演示</a>
            </div>
          </div>
          <div className="tp-hero-card">
            <span>核心价值</span>
            <h2>可信的动态学习编排</h2>
            <ul>
              <li>先给出学习地图，而不是堆内容。</li>
              <li>把长期路径拆成周活动，而不是每日打卡。</li>
              <li>用证据更新节点状态，而不是点击完成。</li>
              <li>调整有理由、有记录、可确认。</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="tp-section">
        <p className="tp-eyebrow">产品结构</p>
        <h2>三个入口，一条学习闭环</h2>
        <div className="tp-feature-grid">
          <article>
            <span>学习</span>
            <h3>这周推进什么</h3>
            <p>周计划、核心活动、可选活动、活动抽屉和证据提交。</p>
          </article>
          <article>
            <span>成长</span>
            <h3>我在树上的哪里</h3>
            <p>统一成长地图、三色节点状态、成果证据和调整记录。</p>
          </article>
          <article>
            <span>工作台</span>
            <h3>材料和工具怎么用</h3>
            <p>目标、链接、文件、资源和工具映射到节点与活动。</p>
          </article>
        </div>
      </section>

      <section id="story" className="tp-section">
        <ProductStory />
      </section>

      <section className="tp-section tp-bottom">
        <p className="tp-eyebrow">当前 MVP</p>
        <h2>已经跑通骨架，下一步补体验深度</h2>
        <p>
          当前版本已完成诊断、地图、周计划、活动、证据、评估、节点变色和调整建议。
          下一阶段重点是综合任务、AI 多维评分、用户确认掌握、延迟复测和内容来源审计。
        </p>
        <Link className="tp-primary" href="/learn">进入可交互产品</Link>
      </section>
    </main>
  );
}

