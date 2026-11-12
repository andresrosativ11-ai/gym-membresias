"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string };

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/inicio", label: "Inicio", icon: "⌂" },
    { href: "/checkin", label: "Check-in", icon: "⎆" },
    { href: "/socios", label: "Socios", icon: "☺" },
    ...(isAdmin
      ? [
          { href: "/planes", label: "Planes", icon: "☰" },
          { href: "/reportes", label: "Reportes", icon: "▤" },
        ]
      : []),
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-3xl">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center text-xs font-medium ${
                  active ? "text-zinc-900" : "text-zinc-400"
                }`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
