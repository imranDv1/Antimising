// Temporary read-only diagnostics. Not part of the app.
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
const env = fs.readFileSync(envPath, "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (!m) continue;
  let value = m[2];
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!process.env[m[1]]) process.env[m[1]] = value;
}

const { PrismaClient } = require("../lib/generated/prisma");
const prisma = new PrismaClient();

(async () => {
  const payments = await prisma.sifaloPayment.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, userId: true, status: true, sid: true, paidAt: true },
  });

  for (const payment of payments) {
    const user = await prisma.user.findUnique({
      where: { id: payment.userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    console.log("payment", payment.id, "status", payment.status);
    console.log("  user:", user);

    if (payment.sid) {
      const res = await fetch(
        "https://api.sifalopay.com/gateway/verify.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sid: payment.sid }),
        }
      );
      const body = await res.json();
      console.log("  sifalo verify:", {
        status: body.status,
        code: body.code,
        amount: body.amount,
        currency: body.currency,
        response: body.response,
        order_id: body.order_id,
        hasSid: !!body.sid,
      });
    }
  }

  const allSubs = await prisma.subscription.findMany({
    select: { userId: true, endDate: true, isActive: true },
  });
  console.log("all subscriptions:", allSubs);
})()
  .catch((err) => {
    console.error("DIAG ERROR:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
