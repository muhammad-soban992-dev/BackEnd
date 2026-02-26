import { Router } from "express";
import {
  registerUser,
  LoginUser,
  LogoutUser,
  refreshAccessToken,
  PasswordChange,
  CurrentUserProfile,
  UpdatePrfileDetail,
  UpdateUserAvatar,
  updateUserCoverImage,
  getWatchHistory,
  GetChannalDetail,
} from "../controllers/User.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifuJWT } from "../middlewares/auth.middlewares.js";
const router = Router();

router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverAvatar", maxCount: 3 },
  ]),
  registerUser
);
router.route("/login").post(upload.none(), LoginUser);
router.route("/logout").post(upload.none(), verifuJWT, LogoutUser);

router
  .route("/CurrentUserProfile")
  .get(upload.none(), verifuJWT, CurrentUserProfile);

router
  .route("/refreshtoken")
  .post(upload.none(), verifuJWT, refreshAccessToken);

router.route("/PasswordChange").post(upload.none(), verifuJWT, PasswordChange);

router
  .route("/UpdatePrfileDetail")
  .put(upload.none(), verifuJWT, UpdatePrfileDetail);

router
  .route("/UpdateUserAvatar")
  .post(
    verifuJWT,
    upload.fields([{ name: "avatar", maxCount: 1 }]),
    UpdateUserAvatar
  );
router
  .route("/updateUserCoverImage")
  .post(
    verifuJWT,
    upload.fields([{ name: "coverAvatar", maxCount: 1 }]),
    updateUserCoverImage
  );
router.route("/c/:username").get(verifuJWT, GetChannalDetail);
router.route("/WatchHoistory").get(verifuJWT, getWatchHistory);

export default router;
