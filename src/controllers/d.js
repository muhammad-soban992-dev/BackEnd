import { Subscriber } from "../models/subscriber.model.js";
import { User } from "../models/user.model.js"; // assuming you have User model
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import {
  toggleSubscribeSchema,
  getChannelSubscribersSchema,
  getUserSubscriptionsSchema,
  getSubscriptionCountSchema,
} from "../validations/subscription.validation.js";
import { validate } from "../middlewares/validate.js";

// Helper to validate channel exists & is not current user
const validateChannel = async (channelId, userId) => {
  if (channelId === userId.toString()) {
    throw new ApiError(400, "You cannot subscribe to yourself");
  }

  const channel = await User.findById(channelId);
  if (!channel) {
    throw new ApiError(404, "Channel/user not found");
  }

  return channel;
};

// 1. Toggle subscribe / unsubscribe
const toggleSubscription = [
  validate(toggleSubscribeSchema),
  asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const subscriberId = req.user._id;

    await validateChannel(channelId, subscriberId);

    const existing = await Subscriber.findOne({
      subscriber: subscriberId,
      channel: channelId,
    });

    let action;
    let message;

    if (existing) {
      await Subscriber.deleteOne({ _id: existing._id });
      action = "unsubscribed";
      message = "Unsubscribed successfully";
    } else {
      await Subscriber.create({
        subscriber: subscriberId,
        channel: channelId,
      });
      action = "subscribed";
      message = "Subscribed successfully";
    }

    res.status(200).json(new ApiResponse(200, { action }, message));
  }),
];

// 2. Get list of subscribers of a channel (who subscribed to this channel)
const getChannelSubscribers = [
  validate(getChannelSubscribersSchema),
  asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    await validateChannel(channelId, req.user._id); // just existence check

    const aggregate = Subscriber.aggregate([
      { $match: { channel: new mongoose.Types.ObjectId(channelId) } },
      {
        $lookup: {
          from: "users",
          localField: "subscriber",
          foreignField: "_id",
          as: "subscriberInfo",
          pipeline: [
            {
              $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
      { $unwind: "$subscriberInfo" },
      { $sort: { createdAt: -1 } }, // newest first
      {
        $project: {
          subscriber: "$subscriberInfo",
          subscribedAt: "$createdAt",
        },
      },
    ]);

    const result = await Subscriber.aggregatePaginate(aggregate, {
      page: Number(page),
      limit: Number(limit),
    });

    res
      .status(200)
      .json(new ApiResponse(200, result, "Channel subscribers fetched"));
  }),
];

// 3. Get channels current user is subscribed to
const getSubscribedChannels = [
  validate(getUserSubscriptionsSchema),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user._id;

    const aggregate = Subscriber.aggregate([
      { $match: { subscriber: userId } },
      {
        $lookup: {
          from: "users",
          localField: "channel",
          foreignField: "_id",
          as: "channelInfo",
          pipeline: [
            {
              $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
                coverImage: 1, // optional
                subscribersCount: 1, // if you added virtual or cached field
              },
            },
          ],
        },
      },
      { $unwind: "$channelInfo" },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          channel: "$channelInfo",
          subscribedAt: "$createdAt",
        },
      },
    ]);

    const result = await Subscriber.aggregatePaginate(aggregate, {
      page: Number(page),
      limit: Number(limit),
    });

    res
      .status(200)
      .json(new ApiResponse(200, result, "Subscribed channels fetched"));
  }),
];

// 4. Get subscriber count of a channel (quick count – useful for profile)
const getChannelSubscriberCount = [
  validate(getSubscriptionCountSchema),
  asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    await validateChannel(channelId, req.user._id);

    const count = await Subscriber.countDocuments({ channel: channelId });

    // Optional: check if current user is subscribed
    const isSubscribed = await Subscriber.exists({
      subscriber: req.user._id,
      channel: channelId,
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { subscriberCount: count, isSubscribed: !!isSubscribed },
          "Count fetched"
        )
      );
  }),
];

// Bonus: Check if current user is subscribed to a channel (for UI button state)
const checkIsSubscribed = [
  validate(toggleSubscribeSchema),
  asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user._id;

    const exists = await Subscriber.exists({
      subscriber: userId,
      channel: channelId,
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isSubscribed: !!exists },
          "Subscription status checked"
        )
      );
  }),
];

export {
  toggleSubscription,
  getChannelSubscribers,
  getSubscribedChannels,
  getChannelSubscriberCount,
  checkIsSubscribed,
};
