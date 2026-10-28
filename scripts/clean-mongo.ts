import { connectDB } from "../src/lib/db";
import path from "path";

process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));

async function run() {
  const conn = await connectDB();
  const client = conn.connection.getClient();
  const admin = client.db().admin();
  const { databases } = await admin.listDatabases();
  
  console.log("Databases in cluster:");
  let totalCollections = 0;
  for (const { name: dbName } of databases) {
    if (dbName === "admin" || dbName === "local" || dbName === "config") continue;
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    console.log(`- ${dbName}: ${collections.length} collections`);
    totalCollections += collections.length;
    
    // Automatically drop old test DBs if they have 'test' or 'dit_pos'
    if (dbName === "dit_pos" || dbName === "nur_engineering_erp" || dbName === "sigma_elevator_erp" || dbName.includes("test")) {
      console.log(`  -> Dropping database: ${dbName}`);
      await db.dropDatabase();
    }
  }
  console.log(`Total collections before drop: ${totalCollections}`);
  process.exit(0);
}

run();
