import Link from "next/link";
import { signOut } from "@/auth";
import { BottomNav } from "@/components/bottom-nav";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings();

  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="font-bold">{settings.gymName}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <span className="mr-3 text-sm text-zinc-500">{user.name}</span>
            {user.role === "ADMIN" && (
              <Link href="/ajustes" className="mr-3 text-sm font-medium text-zinc-900 underline">
                Ajustes
              </Link>
            )}
            <button className="text-sm font-medium text-zinc-900 underline">Salir</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>
      <BottomNav isAdmin={user.role === "ADMIN"} />
    </div>
  );
}
