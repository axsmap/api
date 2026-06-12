const { User } = require('../../models/user');

const { buildAggregationMask } = require('../../helpers/leaderboard-mask');
const { validateListUsers } = require('./validations');

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateListUsers(req.query);
  if (!isValid) return res.status(400).json(errors);

  const queryParams = req.query;

  // Mask identity for users who opted out of appearing by name. Owner/admin
  // viewers always see real identity (this route requires auth).
  const mask = buildAggregationMask({
    viewerId: req.user && req.user.id,
    viewerIsAdmin: !!(req.user && req.user.isAdmin === true),
  });

  const usersQuery = { isArchived: false };
  usersQuery.$text = { $search: queryParams.keywords || '' };

  const sort = queryParams.sortBy || {
    score: { $meta: 'textScore' }
  };
  let page = queryParams.page ? parseInt(queryParams.page, 10) - 1 : 1;
  const pageLimit = queryParams.pageLimit
    ? parseInt(queryParams.pageLimit, 10)
    : 12;

  let total;
  let users;
  try {
    [users, total] = await Promise.all([
      User.aggregate()
        .match(usersQuery)
        .project({
          _id: 0,
          id: '$_id',
          avatar: mask.field('avatar', 'avatar'),
          email: mask.field('email', 'email'),
          firstName: mask.field('firstName', 'firstName'),
          lastName: mask.field('lastName', 'lastName'),
          score: { $meta: 'textScore' },
          username: mask.field('username', 'username')
        })
        .match({ score: { $gt: 1 } })
        .sort(sort)
        .skip(page * pageLimit)
        .limit(pageLimit),
      User.find(usersQuery).count()
    ]);
  } catch (err) {
    console.log(
      `Users failed to be found or count at list-users.\nusersQuery: ${JSON.stringify(
        usersQuery
      )}`
    );
    return next(err);
  }

  let lastPage = Math.ceil(total / pageLimit);
  if (lastPage > 0) {
    page += 1;
    if (page > lastPage) {
      return res
        .status(400)
        .json({ page: `Should be less than or equal to ${lastPage}` });
    }
  } else {
    page = null;
    lastPage = null;
  }

  const dataResponse = {
    page,
    lastPage,
    pageLimit,
    total,
    sortBy: queryParams.sortBy,
    results: users
  };
  return res.status(200).json(dataResponse);
};
