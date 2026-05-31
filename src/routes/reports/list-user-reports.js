const { UserReport } = require("../../models/user-report");

// GET /reports/users — admin only. Newest 100, populated reporter + target.
module.exports = async (req, res, next) => {
  if (!req.user || req.user.isAdmin !== true) {
    return res.status(403).json({ general: "Forbidden" });
  }

  let reports;
  try {
    reports = await UserReport.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("reporter", "avatar firstName lastName username")
      .populate("target", "avatar firstName lastName username")
      .lean();
  } catch (err) {
    return next(err);
  }

  const shape = (u) =>
    u
      ? {
          id: u._id.toString(),
          avatar: u.avatar,
          firstName: u.firstName,
          lastName: u.lastName,
          username: u.username,
        }
      : null;

  const results = reports.map((r) => ({
    id: r._id.toString(),
    type: r.type,
    comments: r.comments || "",
    status: r.status,
    reporter: shape(r.reporter),
    target: shape(r.target),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return res.status(200).json({ results });
};
