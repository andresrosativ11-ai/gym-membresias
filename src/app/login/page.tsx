import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <LoginForm callbackUrl={callbackUrl} />
    </main>
  );
}
