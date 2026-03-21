import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not fetch user here on every request unless necessary, but good for refreshing tokens
  // We will handle protected routes within the app components where possible, or in this middleware.
  
  // Requirement: "New users must be redirected to the /onboarding page (Template 3) to fill in their Major and Year before they can access the full app."
  // Wait, let's implement the route protection.
  const { data: { user } } = await supabase.auth.getUser();
  const url = request.nextUrl.clone();
  const isAuthPage = url.pathname.startsWith("/login");
  const isOnboardingPge = url.pathname.startsWith("/onboarding");
  const isHomePage = url.pathname === "/";

  // If user is authenticated
  if (user) {
    if (isAuthPage) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    
    // Check if onboarding is complete (we will check profiles logic separately in pages or here)
    // Actually fetching profiles in middleware is slow and not recommended since it requires another roundtrip.
    // It's better to do the onboarding check in layout or server components where needed.
  }

  return supabaseResponse;
}
