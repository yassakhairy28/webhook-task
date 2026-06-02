import { config } from "dotenv";
import express from "express";
import appController from "./src/app.controller.js";

config({ path: "./.env", quiet: true });

const app = express();
const port = parseInt(process.env.PORT ?? "5000", 10);

const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});

await appController(app);
