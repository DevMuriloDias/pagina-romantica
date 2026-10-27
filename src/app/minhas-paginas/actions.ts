"use server";
import { redirect } from "next/navigation";
import { clearCustomerSession } from "@/lib/pages/access";

export async function logout() {
  await clearCustomerSession();
  redirect("/minhas-paginas");
}
