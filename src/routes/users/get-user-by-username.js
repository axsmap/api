const { getUserResponse, shapeResponse } = require("./get-user");

module.exports = async (req, res, next) => {
  const username = req.params.username;

  if (!username || typeof username !== "string") {
    return res.status(404).json({ general: "User not found" });
  }

  let user;
  try {
    // Case-insensitive match via Mongo collation strength 2.
    // Optional-auth route: owner/admin (req.user) see real identity.
    user = await getUserResponse({ username }, { locale: "en", strength: 2 }, {
      viewerId: req.user && req.user.id,
      viewerIsAdmin: !!(req.user && req.user.isAdmin === true),
    });
  } catch (err) {
    console.log(`User ${username} failed to be found at get-user-by-username`);
    return next(err);
  }

  if (!user || user.isArchived || user.isBlocked) {
    return res.status(404).json({ general: "User not found" });
  }

  return res.status(200).json(shapeResponse(user));
};
