import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://roomly:roomly_password@localhost:5432/roomly",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Create hotel
  const hotel = await prisma.hotel.upsert({
    where: { slug: "hotel-roomly" },
    update: {},
    create: {
      name: "Hotel Roomly",
      slug: "hotel-roomly",
      address: "Av. San Martín 1234, Mendoza, Argentina",
      phone: "+54 261 000-0000",
      email: "recepcion@roomly.ar",
      timezone: "America/Argentina/Buenos_Aires",
    },
  });
  console.log(`✅ Hotel: ${hotel.name}`);

  // Create room types
  const standardType = await prisma.roomType.upsert({
    where: { id: "standard-type-seed" },
    update: {},
    create: {
      id: "standard-type-seed",
      hotelId: hotel.id,
      name: "Standard",
      description: "Habitación estándar para 2 personas",
      maxGuests: 2,
      amenities: ["WiFi", "AC", "TV", "Baño privado"],
    },
  });

  const suiteType = await prisma.roomType.upsert({
    where: { id: "suite-type-seed" },
    update: {},
    create: {
      id: "suite-type-seed",
      hotelId: hotel.id,
      name: "Suite",
      description: "Suite premium con vista al jardín",
      maxGuests: 4,
      amenities: ["WiFi", "AC", "TV", "Baño privado", "Bañera", "Mini-bar"],
    },
  });
  console.log("✅ Room types: Standard, Suite");

  // Create rooms
  const roomData = [
    { number: "101", floor: 1, typeId: standardType.id },
    { number: "102", floor: 1, typeId: standardType.id },
    { number: "103", floor: 1, typeId: standardType.id },
    { number: "201", floor: 2, typeId: standardType.id },
    { number: "202", floor: 2, typeId: standardType.id },
    { number: "301", floor: 3, typeId: suiteType.id },
    { number: "302", floor: 3, typeId: suiteType.id },
  ];

  for (const r of roomData) {
    await prisma.room.upsert({
      where: { hotelId_number: { hotelId: hotel.id, number: r.number } },
      update: {},
      create: { hotelId: hotel.id, ...r },
    });
  }
  console.log(`✅ Rooms: ${roomData.map((r) => r.number).join(", ")}`);

  // Create rate plans
  await prisma.ratePlan.upsert({
    where: { id: "rate-standard-seed" },
    update: {},
    create: {
      id: "rate-standard-seed",
      hotelId: hotel.id,
      typeId: standardType.id,
      name: "Tarifa base Standard",
      pricePerNight: 15000,
      validFrom: new Date("2024-01-01"),
      validTo: new Date("2030-12-31"),
      minNights: 1,
    },
  });

  await prisma.ratePlan.upsert({
    where: { id: "rate-suite-seed" },
    update: {},
    create: {
      id: "rate-suite-seed",
      hotelId: hotel.id,
      typeId: suiteType.id,
      name: "Tarifa base Suite",
      pricePerNight: 28000,
      validFrom: new Date("2024-01-01"),
      validTo: new Date("2030-12-31"),
      minNights: 2,
    },
  });
  console.log("✅ Rate plans created");

  console.log("\n🎉 Seed complete!");
  console.log(`\nHotel ID (use in API calls): ${hotel.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
