const { MongoClient } = require("mongodb");

const mongoURI = "mongodb://beesnext:quy%402025@localhost:27017/BeeNext?authSource=BeeNext";
const dbName = "MUSICNISO";
const options = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  w: "majority",
};

const client = new MongoClient(mongoURI, options);
let isConnected = false;
let connectionPromise = null;

async function connectDB(collectionName) {
  try {
    if (!isConnected) {
      if (!connectionPromise) {
        connectionPromise = client.connect();
      }
      await connectionPromise;
      isConnected = true;
      console.log("✅ Kết nối thành công tới MongoDB!");
    }
    const db = client.db(dbName);
    if (collectionName) {
      return db.collection(collectionName);
    }
    return db;
  } catch (error) {
    console.error("❌ Lỗi kết nối MongoDB:", error);
    isConnected = false;
    connectionPromise = null;
    throw error;
  }
}

async function closeConnection() {
  if (isConnected) {
    await client.close();
    isConnected = false;
    connectionPromise = null;
    console.log("❌ Đã ngắt kết nối tới MongoDB!");
  }
}

process.on("SIGINT", async () => {
  await closeConnection();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeConnection();
  process.exit(0);
});

process.on("uncaughtException", async (error) => {
  console.error("Uncaught Exception:", error);
  await closeConnection();
  process.exit(1);
});

module.exports = { connectDB, closeConnection };