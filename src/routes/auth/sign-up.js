const crypto = require('crypto')

const moment = require('moment')
const { pick, trim } = require('lodash')
const randomstring = require('randomstring')
const slugify = require('speakingurl')

const { ActivationTicket } = require('../../models/activation-ticket')
const logger = require('../../helpers/logger')
const { sendEmail } = require('../../helpers')
const { User } = require('../../models/user')

const { validateSignUp } = require('./validations')

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateSignUp(req.body)
  if (!isValid) {
    return res.status(400).json(errors)
  }

  const data = pick(req.body, [
    'email',
    'firstName',
    'isSubscribed',
    'lastName',
    'password'
  ])
  data.firstName = trim(data.firstName)
  data.lastName = trim(data.lastName)
  data.username = `${slugify(data.firstName)}-${slugify(data.lastName)}`

  let activationTicket
  try {
    activationTicket = await ActivationTicket.findOne({ email: data.email })
  } catch (err) {
    logger.error(
      `Activation ticket with email ${data.email} failed to be found at sign-up.`
    )
    return next(err)
  }

  if (activationTicket) {
    const expiresAt = moment(activationTicket.expiresAt).utc()
    const today = moment.utc()
    if (expiresAt.isBefore(today)) {
      try {
        await activationTicket.remove()
      } catch (err) {
        logger.error(
          `Activation ticket with email ${activationTicket.email} failed to be removed at sign-up.`
        )
        return next(err)
      }
    }
  }

  let repeatedUsers
  try {
    repeatedUsers = await User.find({
      $or: [{ email: data.email }, { username: data.username }],
      isArchived: false
    })
  } catch (err) {
    logger.error('Users failed to be found at sign-up.')
    return next(err)
  }

  if (repeatedUsers && repeatedUsers.length > 0) {
    for (const user of repeatedUsers) {
      if (user.email === data.email) {
        return res.status(400).json({ email: 'Is already taken' })
      }

      let repeatedUser
      do {
        data.username = `${slugify(data.firstName)}-${slugify(
          data.lastName
        )}-${randomstring.generate({ length: 5, capitalization: 'lowercase' })}`

        try {
          repeatedUser = await User.findOne({
            username: data.username,
            isArchived: false
          })
        } catch (err) {
          logger.error(
            `User with username ${data.username} failed to be found at sign-up.`
          )
          return next(err)
        }
      } while (repeatedUser && repeatedUser.username === data.username)
    }
  }

  const today = moment.utc()
  const expiresAt = today.add(1, 'days').toDate()
  const key = `${crypto
    .randomBytes(31)
    .toString('hex')}${new Date().getTime().toString()}`

  const activationTicketData = {
    email: data.email,
    expiresAt,
    key,
    userData: {
      firstName: data.firstName,
      isSubscribed: data.isSubscribed,
      lastName: data.lastName,
      password: data.password,
      username: data.username
    }
  }
  try {
    activationTicket = await ActivationTicket.create(activationTicketData)
  } catch (err) {
    logger.error(
      `Activation ticket failed to be created at sign-up.\nData: ${JSON.stringify(
        activationTicketData
      )}`
    )
    return next(err)
  }

  const subject = 'Activate Account'
  const htmlContent = `
    <h3>Welcome to AXS Map!</h3>
    <p>To <strong>activate</strong> your account use the <strong>link</strong> below:</p>
    <br/>
    <a href="
    ${process.env.API_URL}/auth/activate-account/${activationTicket.key}">
    ${process.env.API_URL}/auth/activate-account/${activationTicket.key}
    </a>
    <br/><br/>
    <p>Stay awesome.</p>
  `
  const textContent = `
    Welcome to AXS Map!
    To activate your account use the link below:
    ${process.env.API_URL}/auth/activate-account/${activationTicket.key}
    Stay awesome.
  `
  const receiversEmails = [activationTicket.email]

  sendEmail({
    subject,
    htmlContent,
    textContent,
    receiversEmails
  })

  return res.status(201).json({ general: 'Success' })
}
