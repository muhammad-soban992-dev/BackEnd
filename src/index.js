import connectDB from "./db/DB_connection.js";
import app from "./app.js";

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server is running at Port : ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log("MONGO DB Connection failed !!", err);
  });

/*    import dotenv from "dotenv";
import mongoose from "mongoose";
import { DB_NAME } from "./constants.js"; // Ensure the path/extension is correct
import express from "express";

 dotenv.config();

  const app = express(); // 1. You were missing this!

   (async () => {
    try {
        // 2. Connect to MongoDB
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log("MongoDB Connected");

        // 3. Error handling for the Express app
        app.on("error", (error) => {
            console.error("EXPRESS ERROR: ", error);
            throw error;
        });

        // 4. Start the server
        const port = process.env.PORT || 8000;
        app.listen(port, () => {
            console.log(`🚀 App is listening on Port ${port}`);
        });

    } catch (error) {
        console.error(" MONGODB CONNECTION ERROR:", error);
        process.exit(1); // 5. Exit the process if the DB fails
    }
 })(); */
