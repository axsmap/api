const { pick } = require('lodash');
const { isEmail } = require('validator');

const { cleanSpaces, sendEmail } = require('../../helpers');
const { getDb } = require('../events/leaderboard-helpers');
const { toObjectId } = require('../connections/helpers');

const normalizePhone = phone => phone.replace(/[^\d+]/g, '');

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((resolve, reject) =>
      setTimeout(() => reject(new Error('Email delivery timed out')), ms)
    )
  ]);

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
      await withTimeout(
        sendEmail({
          receiversEmails: [contact],
          subject: `${req.user.firstName || 'A friend'} invited you to AXS Map`,
          textContent: `Join me on AXS Map to review accessibility and help make places easier for everyone to navigate.\n\n${inviteUrl}`,
          htmlContent: `<p>Join me on AXS Map to review accessibility and help make places easier for everyone to navigate.</p><p><a href="${inviteUrl}">Join AXS Map</a></p>`
        }),
        8000
      );
    } catch (err) {
      deliveryState = 'failed';
      console.log(`Invite email to ${contact} failed to send`);
    }
  }

  let inviteId;
  try {
    const db = await getDb();
    const now = new Date();
    const result = await db.collection('invites').insertOne({
      channel: data.channel,
      contact,
      deliveryState,
      inviteUrl,
      sender: toObjectId(req.user.id),
      createdAt: now,
      updatedAt: now
    });
    inviteId = result.insertedId.toString();
  } catch (err) {
    console.log(`Invite failed to be created.\nData: ${JSON.stringify(data)}`);
    return next(err);
  }

  return res.status(201).json({
    id: inviteId,
    channel: data.channel,
    deliveryState,
    general:
      data.channel === 'phone'
        ? 'Invite recorded. SMS delivery is not configured yet.'
        : deliveryState === 'sent'
          ? 'Invite sent'
          : 'Invite recorded, but email delivery failed'
  });
};
