import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "./server/db";
import { credentialsSchema } from "./server/validation";
import { verifyPassword, hashPassword } from "./server/password";
import { allowAuthAttempt } from "./server/rate-limit";
const dummy = hashPassword("degreepath-dummy-timing-password");
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        if (!(await allowAuthAttempt(`login:${email}`))) return null;
        const user = await db.user.findUnique({ where: { email } });
        const valid = await verifyPassword(
          password,
          user?.passwordHash ?? (await dummy),
        );
        return user && valid
          ? { id: user.id, email: user.email, name: user.name }
          : null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
