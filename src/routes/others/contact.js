const { sendEmail } = require('../../helpers')

const { validateContact } = require('./validations')

module.exports = async (req, res, next) => {
  const data = {
    email: req.body.email,
    message: req.body.message,
    name: req.body.name
  }

  const { errors, isValid } = validateContact(data)
  if (!isValid) return res.status(400).json(errors)

  const subject = 'Message from Contact Page'
  const htmlContent = `
    <p>${data.message}</p>
    <br/><br/>
    <p>Name: <strong>${data.name}</strong></p>
    <p>Email: <strong>${data.email}</strong></p>
  `
  const textContent = `
    ${data.message}\n\n
    Name: ${data.name}\n
    Email: ${data.email}
  `
  const receiversEmails = [process.env.AXSLAB_EMAIL]

  sendEmail({
    subject,
    htmlContent,
    textContent,
    receiversEmails
  })

  return res.status(200).json({ message: 'Success' })
}
