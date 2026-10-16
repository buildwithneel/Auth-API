
import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import connectDB from "./config/db";

const port = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
  await connectDB();

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
};

startServer();
