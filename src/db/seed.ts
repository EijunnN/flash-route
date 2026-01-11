import { db } from "@/db";
import { users, companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/password";
import { USER_ROLES } from "@/lib/auth-api";

/**
 * Seed script to create a default system administrator and company
 *
 * Run with: bun run db:seed
 */
async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    // Check if default company exists
    const existingCompany = await db
      .select()
      .from(companies)
      .where(eq(companies.legalName, "Sistema Demo"))
      .limit(1);

    let companyId: string;

    if (existingCompany.length === 0) {
      // Create default company
      const [newCompany] = await db
        .insert(companies)
        .values({
          legalName: "Sistema Demo",
          commercialName: "Demo Company",
          email: "admin@demo.com",
          phone: "+1234567890",
          country: "US",
          timezone: "UTC",
          currency: "USD",
          dateFormat: "DD/MM/YYYY",
          active: true,
        })
        .returning();

      companyId = newCompany.id;
      console.log(`✅ Created company: ${newCompany.legalName} (${companyId})`);
    } else {
      companyId = existingCompany[0].id;
      console.log(`ℹ️  Company already exists: ${existingCompany[0].legalName} (${companyId})`);
    }

    // Check if admin user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@sistema.com"))
      .limit(1);

    if (existingUser.length === 0) {
      // Create admin user
      const hashedPassword = await hashPassword("Admin123!");

      const [newUser] = await db
        .insert(users)
        .values({
          companyId,
          email: "admin@sistema.com",
          password: hashedPassword,
          name: "Administrador del Sistema",
          role: USER_ROLES.ADMIN_SISTEMA,
          active: true,
        })
        .returning();

      console.log(`✅ Created admin user: ${newUser.email}`);
      console.log(`   Password: Admin123!`);
      console.log(`   Please change this password after first login!`);
    } else {
      console.log(`ℹ️  Admin user already exists: ${existingUser[0].email}`);
    }

    console.log("🎉 Seed completed successfully!");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

// Run seed
seed();
