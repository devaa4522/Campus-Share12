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

  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  
  // Public routes that don't need auth
  const isAuthPage = url.pathname.startsWith("/login") || url.pathname.startsWith("/signup");
  const isOnboardingPage = url.pathname.startsWith("/onboarding");
  
  const isProtectedPath = url.pathname === "/" ||
                          url.pathname.startsWith("/tasks") ||
                          url.pathname.startsWith("/messages") ||
                          url.pathname.startsWith("/notifications") ||
                          url.pathname.startsWith("/dashboard") ||
                          url.pathname.startsWith("/post") ||
                          url.pathname.startsWith("/profile");

  // 1. Unauthenticated users cannot access protected paths
  if (!user && isProtectedPath) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 2. Authenticated users cannot access login/signup pages
  if (user && isAuthPage) {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 3. Onboarding Guard: if user exists and is accessing protected info, check profile department safely
  if (user && isProtectedPath && !isOnboardingPage) {
    const { data: profile } = await supabase.from('profiles').select('department').eq('id', user.id).single();
    
    // If profile exists and department is exactly null, force them to onboarding.
    if (profile && profile.department === null) {
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
