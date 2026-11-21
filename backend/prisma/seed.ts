import { prisma } from '../src/lib/prisma.js';
import { ensureDemoUser, seedDemoData } from '../src/services/demo.js';
import { config } from '../src/config.js';

async function main() {
  const user = await ensureDemoUser();
  await seedDemoData(user.id, new Date(), true);
  console.log(`✔ Demo data seeded. Log in with ${config.demo.email} / ${config.demo.password} or click "Try Demo".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
