import { withAuth } from 'next-auth/middleware';

// Protect all routes except login and auth callbacks
export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: ['/((?!login|api/auth|api/oauth|_next/static|_next/image|favicon.ico).*)'],
};
