import { getSession } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export async function AuthGuard({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: string;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (role && role === "admin" && session.user.role !== role) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
