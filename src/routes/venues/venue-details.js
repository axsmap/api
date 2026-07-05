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
    // console.log("venue", venue);

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
            userId: "$user._id",
            publicVisibility: {
              $ifNull: ["$user.publicVisibility", "displayName"],
            },
          },
        },
      ]);
    }
    // Mask anonymous review authors (publicVisibility === "anonymous") for
    // everyone but the author and admins. Strips the helper fields (userId,
    // publicVisibility) from the output; preserves _id/comments/createdAt.
    const viewerId = req.user && req.user.id;
    const viewerIsAdmin = !!(req.user && req.user.isAdmin === true);
    customReviews = (customReviews || []).map((r) => {
      const isOwner = viewerId && String(viewerId) === String(r.userId);
      const anonymous = r.publicVisibility === "anonymous";
      const { userId, publicVisibility, ...rest } = r;
      if (anonymous && !viewerIsAdmin && !isOwner) {
        return { ...rest, firstName: "Anonymous", lastName: "", avatar: null, anonymous: true };
      }
      return { ...rest, anonymous };
    });

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
    let photo;
    if (googleResponse.data.result.photos) {
      photo = `https://maps.googleapis.com/maps/api/place/photo?key=${
        process.env.PLACES_API_KEY
      }&maxwidth=300&photoreference=${googleResponse.data.result.photos[0].photo_reference}`;
    }
    const googleData = {
      ...googleResponse.data.result,
      photo,
    };

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
