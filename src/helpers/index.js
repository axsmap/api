const aws = require('aws-sdk')
const { camelCase } = require('lodash')
const jwt = require('jsonwebtoken')
const { mapKeys, pickBy } = require('lodash')
const nodemailer = require('nodemailer')
const { snakeCase } = require('lodash')

const User = require('../models/user')

const logger = require('./logger')

module.exports = {
  deleteUnusedProperties(obj) {
    return pickBy(obj, prop => prop)
  },
  isAuthenticated: async (req, res, next) => {
    const authorizationHeader = req.headers.authorization
    let token

    if (authorizationHeader) {
      token = authorizationHeader.split(' ')[1]
    }

    if (token) {
      let decoded
      try {
        decoded = await jwt.verify(token, process.env.JWT_SECRET)
      } catch (err) {
        return res.status(401).json({ message: 'Failed to authenticate' })
      }

      let user
      try {
        user = await User.findOne({ _id: decoded.userID, isArchived: false })
      } catch (err) {
        logger.error(
          `User ${decoded.userID} failed to be found at authenticate`
        )
        return next(err)
      }

      if (user) {
        req.user = user
        return next()
      }

      return res.status(404).json({ message: 'User not found' })
    }

    return res.status(401).json({ message: 'No token provided' })
  },
  isNumber(number) {
    return !isNaN(parseFloat(number)) && isFinite(number)
  },
  mapCamelCaseKeys(obj) {
    return mapKeys(obj, (value, key) => camelCase(key))
  },
  mapSnakeCaseKeys(obj) {
    return mapKeys(obj, (value, key) => snakeCase(key))
  },
  removeSpaces(string) {
    return string.replace(/\s/g, '')
  },
  sendEmail({
    senderEmail = process.env.SENDER_EMAIL,
    receiversEmails,
    subject,
    htmlContent,
    textContent
  }) {
    const transporter = nodemailer.createTransport({
      SES: new aws.SES({
        apiVersion: '2010-12-01'
      })
    })

    return transporter.sendMail({
      from: `"AXS Map" <${senderEmail}>`,
      to: receiversEmails.join(', '),
      subject,
      text: textContent,
      html: htmlContent
    })
  },
  toJSON(obj) {
    return JSON.parse(JSON.stringify(obj))
  }
}
