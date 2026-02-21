import mongoose from "mongoose";
import fs from "fs";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went worng while generating referesh and access token"
    );
  }
};
const registerUser = asyncHandler(async (req, res) => {
  const { username, password, fullname, email } = req.body;

  //  Validate required fields
  if ([username, password, fullname, email].some((field) => !field?.trim())) {
    throw new ApiError(400, "All fields are required");
  }

  //  Check if user already exists
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "Username or Email already exists");
  }

  //  Get local file paths
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverAvatarLocalPath = req.files?.coverAvatar?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  //  Upload to Cloudinary
  let avatar;
  let coverAvatar;

  try {
    avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar) {
      throw new ApiError(500, "Avatar upload failed");
    }

    if (coverAvatarLocalPath) {
      coverAvatar = await uploadOnCloudinary(coverAvatarLocalPath);
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error);

    // cleanup local files if upload fails
    if (fs.existsSync(avatarLocalPath)) fs.unlinkSync(avatarLocalPath);
    if (coverAvatarLocalPath && fs.existsSync(coverAvatarLocalPath)) {
      fs.unlinkSync(coverAvatarLocalPath);
    }

    throw new ApiError(500, "File upload failed");
  }

  //  Cleanup local files after successful upload
  if (fs.existsSync(avatarLocalPath)) fs.unlinkSync(avatarLocalPath);
  if (coverAvatarLocalPath && fs.existsSync(coverAvatarLocalPath)) {
    fs.unlinkSync(coverAvatarLocalPath);
  }

  //  Create user
  const user = await User.create({
    username: username.toLowerCase(),
    fullname,
    email,
    password,
    avatar: avatar.url,
    coverAvatar: coverAvatar?.url || "",
  });

  //  Remove sensitive fields
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }

  //  Send response
  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});
const LoginUser = asyncHandler(async (req, res) => {
  //req body => data
  // username and email
  // find user
  // check password
  // ascess and refresh token
  // send cokiess

  if (!req.body) {
    throw new ApiError(400, "Request body is missing");
  }
  const { username, email, password } = req.body;
  if (!(username || email)) {
    throw new ApiError(400, "username and password requied");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid User Credentials ");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});
const LogoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      /* $set: { refreshToken: undefined }, */
      $unset: { refreshToken: 1 },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out"));
});
const refreshAccessToken = asyncHandler(async (req, res) => {
  // ── 1. Read token (prefer cookie in browser context)
  const incomingRefreshToken = req.cookies?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized - no refresh token provided");
  }

  try {
    // ── 2. Verify signature & expiration
    const decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // ── 3. Find user
    const user = await User.findById(decoded._id).select(
      "+refreshToken" // make sure refreshToken is selected if hidden
    );

    if (!user || !user.refreshToken) {
      throw new ApiError(401, "Invalid session");
    }

    // ── 4. Constant-time comparison + rotation check
    const isValid = incomingRefreshToken === user.refreshToken;
    if (!isValid) {
      // You could optionally blacklist here in future
      throw new ApiError(401, "Invalid refresh token");
    }

    // ── 5. Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefereshTokens(user._id);

    // ── 6. Cookie options – modern & safer
    const cookieOptions = {
      httpOnly: true,
      secure: true, // must be true in production (HTTPS)
      sameSite: "strict", // or "lax" depending on your UX needs
      maxAge: 7 * 24 * 60 * 60 * 1000, // example: match refresh token expiry
    };

    // ── 7. Set cookies
    res
      .status(200)
      .cookie("accessToken", accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000, // example: 15 minutes
      })
      .cookie("refreshToken", newRefreshToken, cookieOptions);

    // Option A: Most secure (frontend reads from cookie via same-origin)
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Access token refreshed"));

    // Option B: If mobile app / cross-origin needs tokens in body
    // .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token refreshed"));
  } catch (err) {
    // Always generic message in production
    throw new ApiError(401, "Invalid or expired refresh token");
  }
});
const PasswordChange = asyncHandler(async (req, res) => {
  const { confirmPassword, newPassword, oldPassword } = req.body;
  if (confirmPassword !== newPassword) {
    throw new ApiError(400, "Passwords do not match");
  }

  const user = await User.findById(req.user?._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Old password is incorrect");
  }

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password updated successfully"));
});
const CurrentUserProfile = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched"));
});
const UpdatePrfileDetail = asyncHandler(async (req, res) => {
  const { email, name, username, fullname } = req.body;
  if (!email || !name || !username || !fullname) {
    throw new ApiError(401, "All filde is Required");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { username, email, name, fullname } },
    { new: true, runValidators: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "profile Update Successfully"));
});
const UpdateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.files?.avatar?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const uploadedAvatar = await uploadOnCloudinary(avatarLocalPath, "avatars");

  if (!uploadedAvatar) {
    throw new ApiError(400, "Error while uploading avatar");
  }

  if (user.avatar?.public_id) {
    await cloudinary.uploader.destroy(user.avatar.public_id);
  }

  user.avatar = {
    url: uploadedAvatar.secure_url,
    public_id: uploadedAvatar.public_id,
  };

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Avatar updated successfully"));
});
const updateUserCoverImage = asyncHandler(async (req, res) => {
  //  Get local file path
  const coverLocalPath = req.files?.coverAvatar?.[0]?.path;

  if (!coverLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  // Find user
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  //  Upload new cover image
  const uploadedCover = await uploadOnCloudinary(coverLocalPath, "coverAvatar");

  if (!uploadedCover) {
    throw new ApiError(400, "Error while uploading cover image");
  }

  //  Delete old cover image AFTER successful upload
  if (user.coverAvatar?.public_id) {
    await cloudinary.uploader.destroy(user.coverAvatar.public_id);
  }

  // Update user cover image
  user.coverAvatar = {
    url: uploadedCover.secure_url,
    public_id: uploadedCover.public_id,
  };

  await user.save({ validateBeforeSave: false });

  // Send response
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Cover image updated successfully"));
});
const GetChannalDetail = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  const channal = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
      $lookup: {
        from: "subscriber",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
      $lookup: {
        from: "subscriber",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
      $addFields: {
        subscribeCount: {
          $size: "$subscribers",
        },
        ChannalsSubscribeToCount: {
          $size: "$subscribedTo ",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
          },
          then: true,
          else: false,
        },
      },
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        subscribeCount: 1,
        ChannalsSubscribeToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverAvatar: 1,
      },
    },
  ]);
  if (channal?.length) {
    throw new ApiError(404, "channal does not exists");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, channal[0], "User channel featch successfully"));
});
const getWatchHoistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "Video", // mongodb colloection name
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
      },
      pipeline: [
        {
          $lookup: {
            from: "User",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
            pipeline: [
              {
                $project: {
                  fullname: 1,
                  username: 1,
                  avatar: 1,
                },
              },
            ],
          },
        },
        {
          $addFields: {
            owner: {
              $first: "$owner",
            },
          },
        },
      ],
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].WatchHoistory,
        "watch history fetched successfully"
      )
    );
});
export {
  UpdatePrfileDetail,
  CurrentUserProfile,
  registerUser,
  LoginUser,
  LogoutUser,
  refreshAccessToken,
  PasswordChange,
  UpdateUserAvatar,
  updateUserCoverImage,
  GetChannalDetail,
  getWatchHoistory,
};
