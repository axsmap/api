const crypto = require('crypto')

const moment = require('moment')

const logger = require('../../helpers/logger')
const PasswordTicket = require('../../models/password-ticket')
const { sendEmail } = require('../../helpers')
const User = require('../../models/user')

const { validateForgottenPassword } = require('./validations')

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateForgottenPassword(req.body)
  if (!isValid) {
    return res.status(400).json(errors)
  }

  const email = req.body.email

  let user
  try {
    user = await User.findOne({ email, isArchived: false })
  } catch (err) {
    logger.error(
      `User with email ${email} failed to be found at forgotten-password.`
    )
    return next(err)
  }

  if (!user) {
    return res.status(200).json({ message: 'Success' })
  }

  try {
    await PasswordTicket.remove({ email })
  } catch (err) {
    logger.error(
      `Password ticket with email ${email} failed to be removed at forgotten-password.`
    )
    return next(err)
  }

  const today = moment.utc()
  const expiresAt = today.add(1, 'days').toDate()
  const key = `${crypto
    .randomBytes(31)
    .toString('hex')}${new Date().getTime().toString()}`

  let passwordTicket
  try {
    passwordTicket = await PasswordTicket.create({ email, expiresAt, key })
  } catch (err) {
    logger.error(
      `Password ticket failed to be created at forgotten-password.\nData: ${JSON.stringify(
        { email, expiresAt, key }
      )}`
    )
    return next(err)
  }

  const htmlContent = `
    <h3>Hi from AXS Map!</h3>
    <p>To <strong>reset</strong> your password use the <strong>link</strong> below:</p>
    <br/>
    <a href="
    ${process.env.APP_URL}/reset-password/${passwordTicket.key}">
    ${process.env.APP_URL}/reset-password/${passwordTicket.key}
    </a>
    <br/><br/>
    <p>Stay awesome.</p>
  `
  const receiversEmails = [passwordTicket.email]
  const subject = 'Reset Password'
  const textContent = `
    Hi from AXS Map!
    To reset your password use the link below:
    ${process.env.APP_URL}/reset-password/${passwordTicket.key}
    Stay awesome.
  `

  try {
    await sendEmail({
      receiversEmails,
      subject,
      htmlContent,
      textContent
    })
  } catch (err) {
    logger.error(
      `Mail for user ${passwordTicket.email} failed to be sent at forgotten-password.`
    )
    return next(err)
  }

  return res.status(200).json({ message: 'Success' })
}
