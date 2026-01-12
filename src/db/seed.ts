import { db } from "@/db";
import { 
  users, 
  companies, 
  fleets, 
  vehicles, 
  drivers, 
  orders,
  timeWindowPresets,
  auditLogs,
  driverAvailability,
  driverSecondaryFleets,
  driverStatusHistory,
  vehicleStatusHistory,
  vehicleFleetHistory,
  driverSkills,
  vehicleSkills,
  optimizationJobs,
  optimizationConfigurations,
  DRIVER_STATUS,
  ORDER_STATUS,
  TIME_WINDOW_TYPES,
  TIME_WINDOW_STRICTNESS,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/password";
import { USER_ROLES } from "@/lib/auth-api";

async function seed() {
  console.log("🌱 Starting database seed...");

  // Check for --reset flag to clean existing data
  const shouldReset = process.argv.includes("--reset");

  try {
    if (shouldReset) {
      console.log("🗑️  Resetting database...");
      // Delete in correct order to respect foreign keys
      await db.delete(optimizationJobs);
      await db.delete(optimizationConfigurations);
      await db.delete(auditLogs);
      await db.delete(orders);
      await db.delete(driverAvailability);
      await db.delete(driverSecondaryFleets);
      await db.delete(driverStatusHistory);
      await db.delete(driverSkills);
      await db.delete(drivers);
      await db.delete(vehicleStatusHistory);
      await db.delete(vehicleFleetHistory);
      await db.delete(vehicleSkills);
      await db.delete(vehicles);
      await db.delete(fleets);
      await db.delete(timeWindowPresets);
      await db.delete(users);
      await db.delete(companies);
      console.log("✅ Database reset complete");
    }

    // Check if default company exists
    const existingCompany = await db
      .select()
      .from(companies)
      .where(eq(companies.legalName, "Sistema Demo"))
      .limit(1);

    let companyId: string;

    if (existingCompany.length === 0) {
      const [newCompany] = await db
        .insert(companies)
        .values({
          legalName: "Sistema Demo",
          commercialName: "Demo Company",
          email: "admin@demo.com",
          phone: "+51123456789",
          country: "PE",
          timezone: "America/Lima",
          currency: "PEN",
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

    // Create admin user
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@planeamiento.com"))
      .limit(1);

    if (existingUser.length === 0) {
      const hashedPassword = await hashPassword("admin123");

      await db.insert(users).values({
        companyId,
        email: "admin@planeamiento.com",
        password: hashedPassword,
        name: "Administrador",
        role: USER_ROLES.ADMIN_SISTEMA,
        active: true,
      });

      console.log(`✅ Created admin user: admin@planeamiento.com / admin123`);
    } else {
      console.log(`ℹ️  Admin user already exists`);
    }

    // Create time window presets
    const existingPresets = await db.select().from(timeWindowPresets).where(eq(timeWindowPresets.companyId, companyId)).limit(1);
    
    if (existingPresets.length === 0) {
      await db.insert(timeWindowPresets).values([
        { companyId, name: "Mañana", type: "RANGE" as keyof typeof TIME_WINDOW_TYPES, startTime: "08:00", endTime: "12:00", strictness: "SOFT" as keyof typeof TIME_WINDOW_STRICTNESS, active: true },
        { companyId, name: "Tarde", type: "RANGE" as keyof typeof TIME_WINDOW_TYPES, startTime: "14:00", endTime: "18:00", strictness: "SOFT" as keyof typeof TIME_WINDOW_STRICTNESS, active: true },
        { companyId, name: "Todo el día", type: "RANGE" as keyof typeof TIME_WINDOW_TYPES, startTime: "08:00", endTime: "20:00", strictness: "SOFT" as keyof typeof TIME_WINDOW_STRICTNESS, active: true },
        { companyId, name: "Urgente AM", type: "RANGE" as keyof typeof TIME_WINDOW_TYPES, startTime: "08:00", endTime: "10:00", strictness: "HARD" as keyof typeof TIME_WINDOW_STRICTNESS, active: true },
      ]);
      console.log(`✅ Created time window presets`);
    }

    // Create fleets
    const existingFleets = await db.select().from(fleets).where(eq(fleets.companyId, companyId)).limit(1);
    
    let fleetIds: string[] = [];
    if (existingFleets.length === 0) {
      const newFleets = await db.insert(fleets).values([
        { companyId, name: "Flota Ligera", type: "LIGHT_LOAD", weightCapacity: 500, volumeCapacity: 3, operationStart: "07:00", operationEnd: "19:00", active: true },
        { companyId, name: "Flota Pesada", type: "HEAVY_LOAD", weightCapacity: 2000, volumeCapacity: 15, operationStart: "06:00", operationEnd: "18:00", active: true },
        { companyId, name: "Flota Express", type: "EXPRESS", weightCapacity: 200, volumeCapacity: 1, operationStart: "08:00", operationEnd: "22:00", active: true },
      ]).returning();
      
      fleetIds = newFleets.map(f => f.id);
      console.log(`✅ Created ${newFleets.length} fleets`);
    } else {
      const allFleets = await db.select().from(fleets).where(eq(fleets.companyId, companyId));
      fleetIds = allFleets.map(f => f.id);
      console.log(`ℹ️  Fleets already exist`);
    }

    // Create vehicles
    const existingVehicles = await db.select().from(vehicles).where(eq(vehicles.companyId, companyId)).limit(1);
    
    if (existingVehicles.length === 0 && fleetIds.length > 0) {
      await db.insert(vehicles).values([
        { companyId, fleetId: fleetIds[0], plate: "ABC-123", brand: "Toyota", model: "Hilux", year: 2022, type: "PICKUP", weightCapacity: 500, volumeCapacity: 2, refrigerated: false, heated: false, lifting: false, status: "AVAILABLE", active: true },
        { companyId, fleetId: fleetIds[0], plate: "DEF-456", brand: "Ford", model: "Ranger", year: 2023, type: "PICKUP", weightCapacity: 600, volumeCapacity: 2, refrigerated: false, heated: false, lifting: false, status: "AVAILABLE", active: true },
        { companyId, fleetId: fleetIds[1], plate: "GHI-789", brand: "Mercedes", model: "Sprinter", year: 2021, type: "VAN", weightCapacity: 1500, volumeCapacity: 12, refrigerated: true, heated: false, lifting: true, status: "AVAILABLE", active: true },
        { companyId, fleetId: fleetIds[1], plate: "JKL-012", brand: "Iveco", model: "Daily", year: 2022, type: "TRUCK", weightCapacity: 2000, volumeCapacity: 15, refrigerated: false, heated: false, lifting: true, status: "IN_MAINTENANCE", active: true },
        { companyId, fleetId: fleetIds[2], plate: "MNO-345", brand: "Honda", model: "HR-V", year: 2023, type: "VAN", weightCapacity: 200, volumeCapacity: 1, refrigerated: false, heated: false, lifting: false, status: "AVAILABLE", active: true },
      ]);
      console.log(`✅ Created 5 vehicles`);
    } else {
      console.log(`ℹ️  Vehicles already exist`);
    }

    // Create drivers - Perú
    const existingDrivers = await db.select().from(drivers).where(eq(drivers.companyId, companyId)).limit(1);
    
    if (existingDrivers.length === 0 && fleetIds.length > 0) {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);
      
      await db.insert(drivers).values([
        { companyId, fleetId: fleetIds[0], name: "Juan Pérez Huamán", identification: "DNI70123456", email: "juan@demo.com", phone: "+51912345670", licenseNumber: "A-I-70123456", licenseExpiry: futureDate, licenseCategories: "A-IIa,A-IIb", status: "AVAILABLE" as keyof typeof DRIVER_STATUS, active: true },
        { companyId, fleetId: fleetIds[0], name: "María García Quispe", identification: "DNI70123457", email: "maria@demo.com", phone: "+51912345671", licenseNumber: "A-I-70123457", licenseExpiry: futureDate, licenseCategories: "A-IIa", status: "AVAILABLE" as keyof typeof DRIVER_STATUS, active: true },
        { companyId, fleetId: fleetIds[1], name: "Carlos López Mamani", identification: "DNI70123458", email: "carlos@demo.com", phone: "+51912345672", licenseNumber: "A-I-70123458", licenseExpiry: futureDate, licenseCategories: "A-IIb,A-IIIa", status: "AVAILABLE" as keyof typeof DRIVER_STATUS, active: true },
        { companyId, fleetId: fleetIds[1], name: "Ana Rodríguez Flores", identification: "DNI70123459", email: "ana@demo.com", phone: "+51912345673", licenseNumber: "A-I-70123459", licenseExpiry: futureDate, licenseCategories: "A-IIa,A-IIb", status: "IN_ROUTE" as keyof typeof DRIVER_STATUS, active: true },
        { companyId, fleetId: fleetIds[2], name: "Roberto Sánchez Torres", identification: "DNI70123460", email: "roberto@demo.com", phone: "+51912345674", licenseNumber: "A-I-70123460", licenseExpiry: futureDate, licenseCategories: "A-IIa", status: "AVAILABLE" as keyof typeof DRIVER_STATUS, active: true },
      ]);
      console.log(`✅ Created 5 drivers`);
    } else {
      console.log(`ℹ️  Drivers already exist`);
    }

    // Create sample orders - Lima, Perú
    const existingOrders = await db.select().from(orders).where(eq(orders.companyId, companyId)).limit(1);
    
    if (existingOrders.length === 0) {
      // Direcciones reales de Lima, Perú
      const addresses = [
        { address: "Av. Javier Prado Este 4200, Surco, Lima", lat: "-12.0847", lng: "-76.9716" },
        { address: "Av. Larco 345, Miraflores, Lima", lat: "-12.1219", lng: "-77.0308" },
        { address: "Jr. de la Unión 450, Centro Histórico, Lima", lat: "-12.0464", lng: "-77.0327" },
        { address: "Av. La Marina 2000, San Miguel, Lima", lat: "-12.0769", lng: "-77.0940" },
        { address: "Av. Salaverry 3250, San Isidro, Lima", lat: "-12.0983", lng: "-77.0487" },
        { address: "Av. Brasil 2850, Pueblo Libre, Lima", lat: "-12.0750", lng: "-77.0590" },
        { address: "Av. Angamos Este 1550, Surquillo, Lima", lat: "-12.1139", lng: "-77.0140" },
        { address: "Av. Arequipa 4545, Miraflores, Lima", lat: "-12.1145", lng: "-77.0278" },
        { address: "Av. Universitaria 1801, San Miguel, Lima", lat: "-12.0670", lng: "-77.0830" },
        { address: "Av. Petit Thouars 5050, Miraflores, Lima", lat: "-12.1190", lng: "-77.0340" },
      ];

      const clients = [
        "Wong Javier Prado", "Metro Larco", "Farmacia Inkafarma Centro", 
        "Plaza San Miguel", "Clínica San Isidro", "Supermercado Tottus",
        "Real Plaza Surquillo", "CC Larcomar", "PUCP Entregas", "Vivanda Miraflores"
      ];

      const getStatus = (i: number): keyof typeof ORDER_STATUS => {
        if (i < 2) return "IN_PROGRESS";
        if (i < 5) return "ASSIGNED";
        return "PENDING";
      };

      const orderValues = addresses.map((addr, i) => ({
        companyId,
        trackingId: `ORD-${String(i + 1).padStart(4, '0')}`,
        customerName: clients[i % clients.length],
        customerPhone: `+519${String(10000000 + i).slice(-8)}`,
        address: addr.address,
        latitude: addr.lat,
        longitude: addr.lng,
        weightRequired: Math.floor(Math.random() * 50) + 5,
        volumeRequired: Math.floor(Math.random() * 5) + 1,
        status: getStatus(i),
        active: true,
      }));

      await db.insert(orders).values(orderValues);
      console.log(`✅ Created ${orderValues.length} orders`);
    } else {
      console.log(`ℹ️  Orders already exist`);
    }

    console.log("\n🎉 Seed completed successfully!");
    console.log("\n📋 Login credentials:");
    console.log("   Email: admin@planeamiento.com");
    console.log("   Password: admin123");
    
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
