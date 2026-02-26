import { Router } from "express";
import {
  publishAVideo,
  getVideoById,
} from "../controllers/Vides.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifuJWT } from "../middlewares/auth.middlewares.js";
const router = Router();
router.route("/UploadVideo").post(
  verifuJWT,
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "videoFile", maxCount: 1 },
  ]),
  publishAVideo
);
router.route("/GetVideos/:videoId").get(verifuJWT, getVideoById);
export default router;
