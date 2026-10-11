"use server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptPassword, decryptPassword } from "@/lib/password-encryption";
import {
  getPlanLimits,
  withUserScopeLock,
  PlanLimitError,
} from "@/lib/limits";
import { headers } from "next/headers";

export type PassPayload = {
  id: string;
  title: string;
  username: string;
  password: string;
  description: string;
  category: string;
  createdAt: string;
};

export type CreatePassResult =
  | { success: true; message: string; pass: PassPayload }
  | { success: false; message: string };

async function getSessionUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export default async function CreateNewPass(
  formData: FormData
): Promise<CreatePassResult> {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, message: "Unauthorized" };

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const emailOruser = formData.get("emailOruser") as string;
  const password = formData.get("password") as string;
  const category = formData.get("category") as string;

  if (!title || !description || !emailOruser || !password || !category) {
    return { success: false, message: "All fields are required" };
  }

  try {
    const encrypted = encryptPassword(password);
    const limits = await getPlanLimits(userId);

    const created = await withUserScopeLock(
      userId,
      "password",
      async (tx) => {
        if (limits.passwordLimit !== null) {
          const owned = await tx.passwordManeger.count({ where: { userId } });
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
            password: encrypted,
            category,
          },
        });
      }
    );

    return {
      success: true,
      message: "Pass created successfully",
      pass: {
        id: created.id,
        title,
        username: emailOruser,
        password,
        description,
        category,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return { success: false, message: error.message };
    }
    console.error("CreateNewPass error:", error);
    return { success: false, message: "Error creating new Pass" };
  }
}

export type EditPassPayload = {
  id: string;
  title?: string;
  description?: string;
  emailOruser?: string;
  password?: string;
  category?: string;
};

export type EditPassResult =
  | { success: true; message: string; pass: PassPayload }
  | { success: false; message: string };

export async function EditPass(
  payload: EditPassPayload
): Promise<EditPassResult> {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, message: "Unauthorized" };

  try {
    const existing = await prisma.passwordManeger.findUnique({
      where: { id: payload.id },
    });
    if (!existing) return { success: false, message: "Pass not found" };
    if (existing.userId !== userId) {
      return { success: false, message: "You do not own this entry" };
    }

    const data: Record<string, string> = {};
    if (payload.title) data.title = payload.title;
    if (payload.description) data.description = payload.description;
    if (payload.emailOruser) data.emailOruser = payload.emailOruser;
    if (payload.category) data.category = payload.category;
    if (payload.password) data.password = encryptPassword(payload.password);

    const updated = await prisma.passwordManeger.update({
      where: { id: payload.id },
      data,
    });

    return {
      success: true,
      message: "Pass updated successfully",
      pass: {
        id: updated.id,
        title: updated.title,
        username: updated.emailOruser,
        password: payload.password ?? decryptPassword(existing.password),
        description: updated.description,
        category: updated.category,
        createdAt: existing.createdAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("EditPass error:", error);
    return { success: false, message: "Error updating Pass" };
  }
}

export type DeletePassResult = { success: boolean; message: string };

export async function DeletePass(id: string): Promise<DeletePassResult> {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, message: "Unauthorized" };

  try {
    const existing = await prisma.passwordManeger.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing) return { success: false, message: "Pass not found" };
    if (existing.userId !== userId) {
      return { success: false, message: "You do not own this entry" };
    }
    await prisma.passwordManeger.delete({ where: { id } });
    return { success: true, message: "Pass deleted successfully" };
  } catch (error) {
    console.error("DeletePass error:", error);
    return { success: false, message: "Error deleting Pass" };
  }
}