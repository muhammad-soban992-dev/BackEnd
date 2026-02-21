import { Router } from "express";
import { publishAVideo } from "../controllers/Vides.controllers.js";
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

export default router;
