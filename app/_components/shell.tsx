"use client";

// 三功能导航壳：学习 / 成长 / 工作台
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/learn", label: "学习", hint: "本周计划" },
  { href: "/grow", label: "成长", hint: "学习地图" },
  { href: "/workbench", label: "工作台", hint: "资源与工具" },
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
          <p>同一份学习状态，三个视角。地图、计划与证据始终一致。</p>
        </div>
      </aside>
      <main className="t2-main">{children}</main>
    </div>
  );
}
