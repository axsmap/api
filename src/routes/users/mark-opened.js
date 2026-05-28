const { markUserOpened } = require('../../helpers/user-activity');

module.exports = async (req, res, next) => {
  try {
    await markUserOpened(req.user.id);
  } catch (err) {
    console.log(`User ${req.user.id} failed to mark opened.`);
    return next(err);
  }

  return res.status(204).send();
};
