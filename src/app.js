import express from "express";
import cors from "cors";
import cookiesParser from "cookie-parser";

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookiesParser());

// Import Router
import userRouter from "../src/routes/user.routes.js";
import videosRouter from "../src/routes/videos.routes.js";

//Routes Declaration
app.use("/api/v1/user", userRouter);
app.use("/api/v1/videos", videosRouter);
export default app;
