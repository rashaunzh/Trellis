"use client";

// 三功能导航壳：学习 / 成长 / 工作台
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/learn", label: "学习", hint: "课程与本周" },
  { href: "/grow", label: "成长", hint: "领域与路线" },
  { href: "/workbench", label: "工作台", hint: "辅助空间" },
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
        <nav>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname.startsWith(item.href) ? "active" : ""}
            >
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </Link>
          ))}
        </nav>
        <div className="t2-sidebar-note">
          <strong>学习 / 成长 / 工作台</strong>
          <p>课程取舍、领域路线与外部工具各司其职，学习状态保持连续。</p>
        </div>
      </aside>
      <main className="t2-main">{children}</main>
    </div>
  );
}
