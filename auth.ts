import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  pages: {
    signIn: '/login',
  },

  callbacks: {
    // Single-user app: only the email(s) in ALLOWED_EMAILS may sign in.
    // If the allowlist is empty, deny everyone (fail-safe).
    signIn({ profile }) {
      const email = (profile?.email ?? '').toLowerCase();
      if (!email) return false;
      const verified = (profile as { email_verified?: boolean })?.email_verified;
      if (!verified) return false;
      return allowedEmails().includes(email);
    },
  },
});
