import dns from "node:dns";
import mongoose, { type ClientSession } from "mongoose";

dns.setDefaultResultOrder("ipv4first");

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  memoryUri?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

global.mongooseCache = cached;

async function resolveMongoUri() {
  const configured = process.env.MONGODB_URI?.trim();
  const onVercel = Boolean(process.env.VERCEL);
  const useMemory =
    !onVercel &&
    (!configured ||
      configured === "memory" ||
      process.env.USE_MEMORY_MONGO === "1");

  if (onVercel && (!configured || configured === "memory")) {
    throw new Error("MONGODB_URI is required on Vercel");
  }

  if (!useMemory) {
    if (!configured || configured === "memory") {
      throw new Error("MONGODB_URI is required");
    }
    return configured;
  }

  if (cached.memoryUri) return cached.memoryUri;

  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  const mongod = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  cached.memoryUri = mongod.getUri("sigma_elevator_erp");
  console.info("[db] Using in-memory MongoDB replica set (transactions enabled)");
  return cached.memoryUri;
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = (async () => {
      const uri = await resolveMongoUri();
      return mongoose.connect(uri, {
        bufferCommands: false,
        autoIndex: !Boolean(process.env.VERCEL),
        family: 4,
        serverSelectionTimeoutMS: 12_000,
      });
    })();
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}

/** Drop collections in sigma_elevator_erp that are not registered Mongoose models. */
export async function pruneOrphanCollections() {
  const conn = await connectDB();
  const db = conn.connection.db;
  if (!db) return { dropped: [] as string[] };

  const keep = new Set(
    Object.values(mongoose.models).map((m) => m.collection.collectionName),
  );

  const dropped: string[] = [];
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const name = col.name;
    if (name.startsWith("system.") || keep.has(name)) continue;
    try {
      await db.dropCollection(name);
      dropped.push(name);
    } catch {
      // ignore locked / missing
    }
  }
  return { dropped };
}

/** Drop empty collections cluster-wide — empty namespaces still count toward Atlas M0 500 limit. */
export async function pruneEmptyCollectionsClusterWide() {
  const conn = await connectDB();
  const client = conn.connection.getClient();
  const admin = client.db().admin();
  const { databases } = await admin.listDatabases();
  const dropped: string[] = [];
  const skipDb = new Set(["admin", "local", "config"]);

  for (const { name: dbName } of databases) {
    if (skipDb.has(dbName)) continue;
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      if (col.name.startsWith("system.")) continue;
      try {
        const stats = await db.collection(col.name).estimatedDocumentCount();
        if (stats === 0) {
          await db.dropCollection(col.name);
          dropped.push(`${dbName}.${col.name}`);
        }
      } catch {
        // ignore
      }
    }
  }
  return { dropped };
}

/** Use a transaction when the server supports it (Atlas / replica set). Standalone mongod falls back. */
export async function runInTransaction<T>(
  work: (session?: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {
      /* ignore */
    }
    const msg = err instanceof Error ? err.message : String(err);
    const code =
      err && typeof err === "object" && "code" in err
        ? Number((err as { code: number }).code)
        : 0;
    if (code === 20 || /replica set|retryable writes|IllegalOperation/i.test(msg)) {
      return work(undefined);
    }
    throw err;
  } finally {
    session.endSession();
  }
}
