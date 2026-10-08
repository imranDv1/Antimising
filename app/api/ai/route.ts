import { NextResponse } from "next/server";
import { streamNoteBody } from "@/lib/openAi";
import { getSessionUserId, unauthorized, forbidden } from "@/lib/api-auth";
import { getPlanLimits, rateLimit } from "@/lib/limits";

export async function POST(request: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { userId, title } = await request.json();

    // The AI quota is always billed against the authenticated user.
    if (userId && userId !== sessionUserId) {
      return forbidden("You can only use your own subscription");
    }

    if (!title) {
      return NextResponse.json(
        { message: "title is required" },
        { status: 400 }
      );
    }

    // التحقق إذا كان لدى المستخدم أي اشتراك — يتحقق دائمًا من الجلسة
    const limits = await getPlanLimits(sessionUserId);

    if (!limits.isPro) {
      return NextResponse.json(
        { message: "You need an active subscription to use this feature" },
        { status: 403 }
      );
    }

    // Abuse/rate protection applies to all users, including Pro.
    if (!rateLimit(`ai:${sessionUserId}`, 10, 60_000)) {
      return NextResponse.json(
        { message: "Too many AI requests. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    // توليد النص باستخدام AI
    const encoder = new TextEncoder();
    const generator = streamNoteBody(title);
    let cancelled = false;

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await generator.next();
          if (cancelled) return;
          if (done) {
            controller.close();
          } else {
            controller.enqueue(encoder.encode(value));
          }
        } catch (error) {
          console.error("AI Stream Error:", error);
          if (!cancelled) {
            try {
              controller.enqueue(
                encoder.encode(
                  "\n\nSorry, something went wrong. Please try again."
                )
              );
              controller.close();
            } catch {
              // stream already closed by the client
            }
          }
        }
      },
      cancel() {
        cancelled = true;
        generator.return(undefined).catch(() => {});
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: unknown) {
    console.error("AI Route Error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        message,
        error: message,
      },
      { status: 500 }
    );
  }
}
