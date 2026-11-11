import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { expo } from "@better-auth/expo";
import { captcha } from "better-auth/plugins";
import { after } from "next/server";
import { prisma } from "./db";
import { resetPasswordEmailHTML, sendEmail } from "./email";



export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      after(
        sendEmail({
          to: user.email,
          subject: "Reset your password",
          html: resetPasswordEmailHTML(url, user.name),
        }),
      );
    },
    onPasswordReset: async ({ user }) => {
      console.log(`Password for user ${user.email} has been reset.`);
    },
  },
  	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24, // Refresh every day
		disableSessionRefresh: false, // Enable auto-extension
		freshAge: 60 * 15, // 15 minute freshness window
	},
  plugins: [
    expo({}),
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: process.env.CLOUDFLARE_TURNSTILE_SECRET!,
      endpoints: ["/sign-up/email", "/sign-in/email"],
    }),
    nextCookies(),
  ],

  socialProviders: {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID_WEB!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  trustedOrigins: [
    "myapp://",
    "http://localhost:3000",
    "https://rivorea-notes.vercel.app",
  ],
});
