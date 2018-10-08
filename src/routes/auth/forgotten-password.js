const crypto = require('crypto');

const moment = require('moment');

const { PasswordTicket } = require('../../models/password-ticket');
const { sendEmail } = require('../../helpers');
const { User } = require('../../models/user');

const { validateForgottenPassword } = require('./validations');

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateForgottenPassword(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const email = req.body.email;

  let user;
  try {
    user = await User.findOne({ email, isArchived: false });
  } catch (err) {
    console.log(
      `User with email ${email} failed to be found at forgotten-password.`
    );
    return next(err);
  }

  if (!user) {
    return res.status(200).json({ general: 'Success' });
  }

  try {
    await PasswordTicket.remove({ email });
  } catch (err) {
    console.log(
      `Password ticket with email ${email} failed to be removed at forgotten-password.`
    );
    return next(err);
  }

  const today = moment.utc();
  const expiresAt = today.add(1, 'days').toDate();
  const key = `${crypto
    .randomBytes(31)
    .toString('hex')}${new Date().getTime().toString()}`;

  let passwordTicket;
  try {
    passwordTicket = await PasswordTicket.create({ email, expiresAt, key });
  } catch (err) {
    console.log(
      `Password ticket failed to be created at forgotten-password.\nData: ${JSON.stringify(
        { email, expiresAt, key }
      )}`
    );
    return next(err);
  }

  const htmlContent = `
    <h3>Hi from AXS Map!</h3>
    <p>To <strong>reset</strong> your password use the <strong>link</strong> below:</p>
    <br/>
    <a href="
    ${process.env.APP_URL}/reset-password?key=${passwordTicket.key}">
    ${process.env.APP_URL}/reset-password?key=${passwordTicket.key}
    </a>
    <br/><br/>
    <p>Stay awesome.</p>
  `;
  const receiversEmails = [passwordTicket.email];
  const subject = 'Reset Password';
  const textContent = `
    Hi from AXS Map!
    To reset your password use the link below:
    ${process.env.APP_URL}/reset-password?key=${passwordTicket.key}
    Stay awesome.
  `;

  sendEmail({
    receiversEmails,
    subject,
    htmlContent,
    textContent
  });

  return res.status(200).json({ general: 'Success' });
};
