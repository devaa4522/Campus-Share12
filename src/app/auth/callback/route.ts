import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  let nextPath = "/";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login?error=auth", url.origin));
    }
    const next = url.searchParams.get("next");
    if (next && next.startsWith("/")) {
      nextPath = next;
    }
  }

  const response = NextResponse.redirect(new URL(nextPath, url.origin));
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('x-middleware-cache', 'no-cache');
  return response;
}
