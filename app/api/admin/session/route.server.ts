import { NextResponse } from "next/server";
import { isAdmin, isAuthConfigured } from "@/lib/admin/auth";
import { isStorageConfigured } from "@/lib/settings/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    authenticated: await isAdmin(),
    authConfigured: isAuthConfigured(),
    storageConfigured: isStorageConfigured(),
  });
}
