import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { LoginSchema } from "@/lib/validations";

/**
 * Single-admin authentication.
 *
 * Credentials come from env vars — no users table needed for the MVP.
 * ADMIN_EMAIL and ADMIN_PASSWORD_HASH are set in .env.
 *
 * To generate a hash:
 *   node -e "const b=require('bcryptjs'); console.log(b.hashSync('yourpassword', 10))"
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const adminEmail = process.env.ADMIN_EMAIL;
        // Next.js dotenv-expand converts \$ → $, but when running outside Next.js
        // (e.g. ts-node scripts) the raw \$ can arrive intact. Normalize both cases.
        const rawHash = process.env.ADMIN_PASSWORD_HASH ?? "";
        const adminHash = rawHash.replace(/\\\$/g, "$");

        if (!adminEmail || !adminHash) {
          console.error("[Auth] ADMIN_EMAIL or ADMIN_PASSWORD_HASH not set");
          return null;
        }

        if (email !== adminEmail) return null;

        const valid = await bcrypt.compare(password, adminHash);
        if (!valid) return null;

        return { id: "admin", name: "Admin", email };
      },
    }),
  ],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
