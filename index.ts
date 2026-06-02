// index.ts
import { config } from "dotenv";
import express from "express";
import mongoose from "mongoose";
import appController from "./src/app.controller.js";

config({ path: "./.env", quiet: true });

const app = express();
const port = parseInt(process.env.PORT ?? "5000", 10);

await appController(app);

const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});

let isShuttingDown = false;

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[${signal}] Graceful shutdown initiated...`);

  server.close(() => {
    console.log("HTTP server closed. No longer accepting new requests.");

    mongoose.connection.close().then(() => {
      console.log("MongoDB connection closed successfully.");
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error("Forced shutdown triggered due to timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
