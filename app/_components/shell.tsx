"use client";

// 三功能导航壳：学习 / 成长 / 学习控制台
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChartNoAxesCombined, SlidersHorizontal } from "lucide-react";

const NAV = [
  { href: "/learn", label: "学习", hint: "本周任务包", icon: BookOpen },
  { href: "/grow", label: "成长", hint: "路径与能力", icon: ChartNoAxesCombined },
  { href: "/workbench", label: "工作台", hint: "来源/测试/成果", icon: SlidersHorizontal },
] as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="t2-shell">
      <aside className="t2-sidebar">
        <div className="t2-brand">
          <i>T</i>
          <div>
            <b>Trellis</b>
            <span>可信的动态学习编排</span>
          </div>
        </div>
        <nav className="t2-desktop-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname.startsWith(item.href) ? "active" : ""}
            >
              <item.icon aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </Link>
          ))}
        </nav>
        <div className="t2-sidebar-note">
          <strong>学习处境编排</strong>
          <p>目标、能力、来源、测试和成果共同决定下一步，不把课程名当路线。</p>
        </div>
      </aside>
      <main className="t2-main">{children}</main>
      <nav className="t2-mobile-nav" aria-label="主导航">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={pathname.startsWith(item.href) ? "active" : ""}>
            <item.icon aria-hidden="true" size={19} strokeWidth={1.9} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
