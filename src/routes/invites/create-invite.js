const { pick } = require('lodash');
const { isEmail } = require('validator');

const { cleanSpaces, sendEmail } = require('../../helpers');
const { Invite } = require('../../models/invite');

const normalizePhone = phone => phone.replace(/[^\d+]/g, '');

module.exports = async (req, res, next) => {
  const data = pick(req.body, ['channel', 'contact', 'inviteUrl']);
  const errors = {};

  if (!['email', 'phone'].includes(data.channel)) {
    errors.channel = 'Should be email or phone';
  }

  if (!data.contact || typeof data.contact !== 'string') {
    errors.contact = 'Is required';
  }

  if (Object.keys(errors).length) {
    return res.status(400).json(errors);
  }

  const contact =
    data.channel === 'email'
      ? cleanSpaces(data.contact).toLowerCase()
      : normalizePhone(data.contact);

  if (data.channel === 'email' && !isEmail(contact)) {
    return res.status(400).json({ contact: 'Should be a valid email' });
  }

  if (data.channel === 'phone' && contact.length < 7) {
    return res.status(400).json({ contact: 'Should be a valid phone number' });
  }

  const inviteUrl = data.inviteUrl || 'https://axsmap.com';
  let deliveryState = data.channel === 'phone' ? 'recorded' : 'sent';

  if (data.channel === 'email') {
    try {
      await sendEmail({
        receiversEmails: [contact],
        subject: `${req.user.firstName || 'A friend'} invited you to AXS Map`,
        textContent: `Join me on AXS Map to review accessibility and help make places easier for everyone to navigate.\n\n${inviteUrl}`,
        htmlContent: `<p>Join me on AXS Map to review accessibility and help make places easier for everyone to navigate.</p><p><a href="${inviteUrl}">Join AXS Map</a></p>`
      });
    } catch (err) {
      deliveryState = 'failed';
      console.log(`Invite email to ${contact} failed to send`);
    }
  }

  let invite;
  try {
    invite = await Invite.create({
      channel: data.channel,
      contact,
      deliveryState,
      inviteUrl,
      sender: req.user.id
    });
  } catch (err) {
    console.log(`Invite failed to be created.\nData: ${JSON.stringify(data)}`);
    return next(err);
  }

  return res.status(201).json({
    id: invite.id,
    channel: invite.channel,
    deliveryState: invite.deliveryState,
    general:
      data.channel === 'phone'
        ? 'Invite recorded. SMS delivery is not configured yet.'
        : deliveryState === 'sent'
          ? 'Invite sent'
          : 'Invite recorded, but email delivery failed'
  });
};
