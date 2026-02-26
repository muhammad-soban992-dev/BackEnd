import { Video } from "../models/videos.model.js";
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../cloudinary.js";
import fs from "fs";

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title?.trim() || !description?.trim()) {
    throw new ApiError(400, "Title and description are required");
  }

  if (!req.files || !req.files.videoFile || !req.files.thumbnail) {
    throw new ApiError(400, "Both video file and thumbnail are required");
  }

  const videoFileLocalPath = req.files.videoFile[0]?.path;
  const thumbnailLocalPath = req.files.thumbnail[0]?.path;

  if (!videoFileLocalPath || !thumbnailLocalPath) {
    throw new ApiError(
      400,
      "Video file or thumbnail upload failed (local path missing)"
    );
  }

  const videoUploadResult = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnailUploadResult = await uploadOnCloudinary(thumbnailLocalPath);
  if (!videoUploadResult?.url || !thumbnailUploadResult?.url) {
    throw new ApiError(500, "Failed to upload file(s) to Cloudinary");
  }

  if (videoUploadResult.resource_type !== "video") {
    throw new ApiError(400, "Uploaded file is not a valid video");
  }

  if (fs.existsSync(videoFileLocalPath)) fs.unlinkSync(videoFileLocalPath);
  if (thumbnailUploadResult && fs.existsSync(thumbnailUploadResult)) {
    fs.unlinkSync(thumbnailUploadResult);
  }

  const video = await Video.create({
    videoFile: videoUploadResult,
    thumbnail: thumbnailUploadResult,
    title: title.trim(),
    description: description.trim(),
    duration: Math.round(videoUploadResult.duration || 0),
    owner: req.user._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, video, "Video published successfully"));
});

// 2. Get video by ID
const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.user._id;
  console.log(req.user);
  if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId).populate(
    "owner",
    "username fullName avatar"
  );

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Optional: increment views (you can also do this via separate endpoint)
  // await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

// 3. Update video details (title, description)
const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title: title?.trim() || video.title,
        description: description?.trim() || video.description,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

// 4. Delete video
const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }

  await Video.findByIdAndDelete(videoId);

  // TODO: Also delete video & thumbnail from Cloudinary (optional)

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

// 5. Toggle publish status
const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: { isPublished: !video.isPublished },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedVideo,
        `Video ${updatedVideo.isPublished ? "published" : "unpublished"} successfully`
      )
    );
});

// 6. Get all videos (with pagination, search, etc.)
const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query = "",
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query;

  const matchStage = {
    isPublished: true,
  };

  if (query) {
    matchStage.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }

  if (userId && mongoose.isValidObjectId(userId)) {
    matchStage.owner = new mongoose.Types.ObjectId(userId);
  }

  const videos = await Video.aggregatePaginate(
    Video.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [
            {
              $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      { $unwind: "$owner" },
      {
        $sort: { [sortBy]: sortType === "asc" ? 1 : -1 },
      },
      {
        $project: {
          videoFile: 1,
          thumbnail: 1,
          title: 1,
          description: 1,
          duration: 1,
          views: 1,
          createdAt: 1,
          owner: 1,
        },
      },
    ]),
    {
      page: parseInt(page),
      limit: parseInt(limit),
    }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

export {
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
  getAllVideos,
};
