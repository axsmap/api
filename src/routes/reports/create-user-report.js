const { pick } = require('lodash');
const { isMongoId } = require('validator');

const { User } = require('../../models/user');
const { UserReport } = require('../../models/user-report');

module.exports = async (req, res, next) => {
  const data = pick(req.body, ['comments', 'target', 'type']);

  if (!isMongoId(data.target || '')) {
    return res.status(400).json({ target: 'Should be a valid id' });
  }

  if (data.target === req.user.id) {
    return res.status(400).json({ general: 'You cannot report yourself' });
  }

  if (
    ![
      'harassment',
      'impersonation',
      'offensive',
      'spam',
      'unsafe',
      'other'
    ].includes(data.type)
  ) {
    return res.status(400).json({ type: 'Should be a valid report type' });
  }

  let target;
  try {
    target = await User.findOne({ _id: data.target, isArchived: false });
  } catch (err) {
    console.log(`Reported user ${data.target} failed to be found`);
    return next(err);
  }

  if (!target) {
    return res.status(404).json({ target: 'User not found' });
  }

  let report;
  try {
    report = await UserReport.create({
      comments: data.comments,
      reporter: req.user.id,
      target: data.target,
      type: data.type
    });
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {};
      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message;
      });
      return res.status(400).json(validationErrors);
    }

    console.log(
      `User report failed to be created.\nData: ${JSON.stringify(data)}`
    );
    return next(err);
  }

  return res.status(201).json({ id: report.id, general: 'Report submitted' });
};
