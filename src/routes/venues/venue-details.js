const axios = require("axios");
const { Venue } = require("../../models/venue");
const { Review } = require("../../models/review");

module.exports = async (req, res, next) => {
  const placeId = req.params.placeId;

  try {
    const venue = await Venue.findOne({
      placeId,
    });
    let customReviews;
    if (venue) {
      customReviews = await Review.aggregate([
        {
          $match: { venue: venue._id },
        },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            _id: 1,
            comments: { $ifNull: ["$comments", null] },
            firstName: { $ifNull: ["$user.firstName", null] },
            lastName: { $ifNull: ["$user.lastName", null] },
            avatar: { $ifNull: ["$user.avatar", null] },
            createdAt: 1,
          },
        },
      ]);
    }
    const googleResponse = await axios.get(
      "https://maps.googleapis.com/maps/api/place/details/json",
      {
        params: {
          place_id: placeId,
          fields:
            "name,photos,international_phone_number,rating,reviews,formatted_address,geometry,user_ratings_total,rating,opening_hours,website",
          key: process.env.PLACES_API_KEY,
        },
      }
    );

    const googleData = googleResponse.data.result;

    if (!googleData) {
      return res
        .status(404)
        .json({ message: "Google venue details not found." });
    }
    res.json({
      data: { googleData, axsReviews: customReviews },
    });
  } catch (err) {
    console.log(`Place ${placeId} failed to be found at get-venue.`);
    return next(err);
  }
};
