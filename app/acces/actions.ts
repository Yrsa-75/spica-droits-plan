"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, accessToken, passwordMatches } from "@/lib/access";

export async function login(formData: FormData) {
  const pwd = String(formData.get("password") || "").trim();
  // Petit délai constant pour freiner les essais en série
  await new Promise((r) => setTimeout(r, 700));
  if (!pwd || !passwordMatches(pwd)) redirect("/acces?e=1");
  (await cookies()).set(ACCESS_COOKIE, accessToken(), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}
