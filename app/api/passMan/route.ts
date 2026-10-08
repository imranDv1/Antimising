import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { encryptPassword } from "@/lib/password-encryption";
import { getSessionUserId, unauthorized, forbidden } from "@/lib/api-auth";
import {
  getPlanLimits,
  withUserScopeLock,
  PlanLimitError,
} from "@/lib/limits";
export async function POST(request: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { userId, title, description, emailOruser, password, category } =
      await request.json();

    if (!userId) {
      return NextResponse.json(
        { message: "userId is required" },
        { status: 400 }
      );
    }
    if (userId !== sessionUserId) {
      return forbidden("You can only create entries in your own vault");
    }
    if (!title) {
      return NextResponse.json(
        { message: "title is required" },
        { status: 400 }
      );
    }

    if (!emailOruser) {
      return NextResponse.json(
        { message: "emailOruser is required" },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { message: "password is required" },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { message: "category is required" },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { message: "description is required" },
        { status: 400 }
      );
    }

    // Encrypt the password using AES-256-GCM (reversible encryption)
    const encryptedPassword = encryptPassword(password);

    const limits = await getPlanLimits(sessionUserId);

    const PassMan = await withUserScopeLock(
      sessionUserId,
      "password",
      async (tx) => {
        if (limits.passwordLimit !== null) {
          const owned = await tx.passwordManeger.count({
            where: { userId: sessionUserId },
          });
          if (owned >= limits.passwordLimit) {
            throw new PlanLimitError(
              `Free plan is limited to ${limits.passwordLimit} saved passwords. Upgrade to Pro for unlimited.`
            );
          }
        }

        return tx.passwordManeger.create({
          data: {
            userId,
            title,
            description,
            emailOruser,
            password: encryptedPassword,
            category,
          },
        });
      }
    );

    return NextResponse.json({ message: "Pass created successfully", PassMan });
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    console.error("Error creating note:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
