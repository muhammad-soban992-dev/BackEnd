import mongoose, { Schema } from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
  {
    videoFile: {
      url: {
        type: String,
      },
      public_id: {
        type: String,
      },
    },
    thumbnail: {
      url: {
        type: String,
      },
      public_id: {
        type: String,
      },
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: Number, // Provided by the upload service (e.g., Cloudinary)
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User", // References the User model
    },
  },
  {
    timestamps: true, // Tracks createdAt and updatedAt automatically
  }
);

// Plugin for handling advanced pagination in search/filters
videoSchema.plugin(aggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);
