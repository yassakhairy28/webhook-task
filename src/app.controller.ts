import express from "express";
import { connectDatabase } from "./DB/DB_Connection.js";
import { webhookRouter } from "./routes/webhook.routes.js";
import {
  globalErrorHandler,
  notFoundHanlder,
} from "./middlewares/error.handler.middleware.js";

const appController = async (app: express.Application): Promise<void> => {
  app.use(express.json());

  await connectDatabase();

  app.get("/", (req, res) => res.send("Welcome to webhook-task Backend API!"));

  app.use("/api", webhookRouter);

  app.all("/*dummy", notFoundHanlder);
  app.use(globalErrorHandler);
};

export default appController;
