import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const response = NextResponse.redirect(new URL("/", url.origin));
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('x-middleware-cache', 'no-cache');
  return response;
}
