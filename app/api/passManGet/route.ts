import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { decryptPassword } from "@/lib/password-encryption";
import { getSessionUserId, unauthorized, forbidden } from "@/lib/api-auth";

export async function POST(request: Request) {
  const { userId } = await request.json();

  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return unauthorized();
  if (!userId) {
    return NextResponse.json(
      { message: "userId is required" },
      { status: 400 }
    );
  }
  if (userId !== sessionUserId) {
    return forbidden("You can only read your own vault");
  }

  try {
    const PassMan = await prisma.passwordManeger.findMany({
      where: {
        userId,
      },
    });

    // lets return the PassMan as array of objects with decrypted passwords
    const response = PassMan.map((item) => {
      let decryptedPassword = "";
      try {
        decryptedPassword = decryptPassword(item.password);
      } catch (error) {
        console.error("Failed to decrypt password for item:", item.id, error);
        // If decryption fails (e.g., old bcrypt hash), return empty string
        decryptedPassword = "";
      }

      return {
        id: item.id,
        title: item.title,
        username: item.emailOruser,
        password: decryptedPassword,
        description: item.description,
        category: item.category,
        createdAt: item.createdAt.toISOString(),
      };
    });

    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
