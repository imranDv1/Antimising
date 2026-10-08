"use server";

import { revalidatePath } from "next/cache";

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
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return {
        success: false,
        message: body?.message || "Failed to create note",
      };
    }

    revalidatePath("/dashboard/create");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Failed to create note" };
  }
}