"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import {
  getPlanLimits,
  withUserScopeLock,
  PlanLimitError,
} from "@/lib/limits";

type Data = {
  userId: string | undefined;
  title: string;
  description: string;
  category: string[];
};

export type CreateNoteResult = {
  success: boolean;
  message?: string;
};

export async function CreateNote(data: Data): Promise<CreateNoteResult> {
  const { title, description, category } = data;

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, message: "Unauthorized" };
  }

  if (!title) {
    return { success: false, message: "please enter the title" };
  }
  if (!description) {
    return { success: false, message: "please enter the description" };
  }
  if (!category) {
    return { success: false, message: "please enter the category" };
  }

  try {
    const limits = await getPlanLimits(userId);

    await withUserScopeLock(userId, "note", async (tx) => {
      if (limits.noteLimit !== null) {
        const owned = await tx.note.count({ where: { userId } });
        if (owned >= limits.noteLimit) {
          throw new PlanLimitError(
            `Free plan is limited to ${limits.noteLimit} notes. Upgrade to Pro for unlimited notes.`
          );
        }
      }

      await tx.note.create({
        data: {
          id: uuidv4(),
          title,
          description,
          category,
          userId,
        },
      });
    });

    revalidatePath("/dashboard/create");
    return { success: true };
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return { success: false, message: error.message };
    }
    console.error("CreateNote error:", error);
    return { success: false, message: "Failed to create note" };
  }
}
