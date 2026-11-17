// TEMPORARY test driver — deleted after verification.
const { PrismaClient } = require("../lib/generated/prisma");
const fs = require("fs");
const path = require("path");

const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (!m) continue;
  let v = m[2];
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const prisma = new PrismaClient();
const price = process.env.SIFALO_PRICE_USD.trim();
const userId = "test_sifalo_" + Date.now();
const sid = "SID_TEST_" + Date.now();

async function call(body) {
  const res = await fetch("http://localhost:3000/api/sifalo-selftest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const row = () =>
  prisma.sifaloPayment.findUnique({
    where: { id: paymentId },
    select: { status: true, sid: true, paidAt: true, amount: true },
  });
const sub = () =>
  prisma.subscription.findUnique({
    where: { userId },
    select: { endDate: true, isActive: true },
  });

let paymentId;

(async () => {
  await prisma.user.create({
    data: {
      id: userId,
      name: "Sifalo Test",
      email: `${userId}@example.test`,
    },
  });
  const created = await prisma.sifaloPayment.create({
    data: { userId, amount: price, currency: "USD" },
  });
  paymentId = created.id;
  console.log("price", price, "| pending row", paymentId);

  console.log("1. first fulfil:", await call({ userId, sid }));
  console.log("   row:", await row());
  const sub1 = await sub();
  console.log("   subscription:", sub1);

  console.log("2. replay:", await call({ userId, sid }));
  const sub2 = await sub();
  console.log(
    "   endDate unchanged:",
    sub1?.endDate?.getTime() === sub2?.endDate?.getTime(),
    "| row:",
    (await row()).status
  );

  // Simulate the reported bug: money confirmed (paid), subscription missing.
  await prisma.subscription.delete({ where: { userId } });
  await prisma.sifaloPayment.update({
    where: { id: paymentId },
    data: { status: "paid" },
  });
  console.log("3. heal paid-without-subscription:", await call({ userId, sid }));
  console.log("   row:", await row(), "| subscription:", await sub());

  // Legacy row: payment complete (paid) + subscription already written.
  await prisma.sifaloPayment.update({
    where: { id: paymentId },
    data: { status: "paid" },
  });
  const before = await sub();
  console.log("4. legacy paid + existing sub:", await call({ userId, sid }));
  const after = await sub();
  console.log(
    "   endDate unchanged:",
    before?.endDate?.getTime() === after?.endDate?.getTime(),
    "| row:",
    (await row()).status
  );
})()
  .catch((err) => {
    console.error("TEST ERROR:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  });
