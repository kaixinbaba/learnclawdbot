import { sendEmail } from "@/actions/resend";
import { siteConfig } from "@/config/site";
import MagicLinkEmail from '@/emails/magic-link-email';
import OTPCodeEmail from '@/emails/otp-code-email';
import { UserWelcomeEmail } from "@/emails/user-welcome";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/schema";
import { redis } from "@/lib/upstash";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, anonymous, captcha, emailOTP, lastLoginMethod, magicLink, oneTap } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
    // Use Cloudflare IP header for accurate IP detection
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"],
    },
  },
  // IP-based rate limiting configuration
  rateLimit: {
    enabled: true,
    window: 60, // 60 seconds default window
    max: 100, // 100 requests per window (global default)
    customRules: {
      "/sign-in/magic-link": {
        window: 60, // 60 seconds
        max: 3, // Max 3 magic link requests per 60 seconds
      },
      "/email-otp/send-verification-otp": {
        window: 60,
        max: 3,
      },
      "/sign-in/email-otp": {
        window: 60,
        max: 5,
      },
    },
    // Use Upstash Redis for rate limit storage (works with serverless)
    ...(redis && {
      customStorage: {
        get: async (key: string) => {
          const data = await redis!.get<{ key: string; count: number; lastRequest: number }>(key);
          return data || undefined;
        },
        set: async (key: string, value: { key: string; count: number; lastRequest: number }) => {
          // TTL of 2 minutes (120 seconds) - enough for rate limit windows
          await redis!.set(key, value, { ex: 120 });
        },
      },
    }),
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 10 * 60, // Cache duration in seconds
    },
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    freshAge: 0
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'github'],
    },
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: user,
      session: session,
      account: account,
      verification: verification,
    },
  }),
  socialProviders: {
    github: {
      clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          try {
            // Update user with referral code from cookie
            const cookieStore = await cookies();
            const referralCookie = cookieStore.get('referral_source');

            if (referralCookie?.value && createdUser.id) {
              await db.update(user)
                .set({ referral: referralCookie.value })
                .where(eq(user.id, createdUser.id));

              cookieStore.delete('referral_source');
              console.log(`User ${createdUser.id} updated with referral: ${referralCookie.value}`);
            }
          } catch (error) {
            console.error('Failed to update user with referral code:', error);
          }

          // Send welcome email
          if (createdUser.email) {
            try {
              const unsubscribeToken = Buffer.from(createdUser.email).toString('base64');
              const unsubscribeLink = `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe/newsletter?token=${unsubscribeToken}`;

              await sendEmail({
                email: createdUser.email,
                subject: `Welcome to ${siteConfig.name}!`,
                react: UserWelcomeEmail,
                reactProps: {
                  name: createdUser.name,
                  email: createdUser.email,
                  unsubscribeLink: unsubscribeLink,
                },
              });
              console.log(`Welcome email sent to ${createdUser.email}`);
            } catch (error) {
              console.error('Failed to send welcome email:', error);
            }
          }
        },
      },
    },
  },
  trustedOrigins: process.env.NODE_ENV === 'development' ? [process.env.NEXT_PUBLIC_SITE_URL!, 'http://localhost:3000'] : [process.env.NEXT_PUBLIC_SITE_URL!],
  plugins: [
    oneTap(),
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: process.env.TURNSTILE_SECRET_KEY!,
    }),
    magicLink({
      sendMagicLink: async ({ email, url, token }) => {
        await sendEmail({
          email,
          subject: `Sign in to ${siteConfig.name}`,
          react: MagicLinkEmail,
          reactProps: {
            url
          }
        })
      },
      expiresIn: 60 * 5,
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 10, // 10 minutes
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendEmail({
          email,
          subject: `Your ${siteConfig.name} verification code: ${otp}`,
          react: OTPCodeEmail,
          reactProps: {
            otp,
            type
          }
        })
      },
    }),
    lastLoginMethod(),
    admin(),
    anonymous(),
    nextCookies() // make sure this is the last plugin in the array
  ]
});