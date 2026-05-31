const { isEmail } = require("validator");

const { sendEmail } = require("../../helpers");
const { Invite } = require("../../models/invite");

// POST /invites  { channel: "email", contact, inviteUrl? }
// Records the invite then fire-and-forgets the email. The frontend reads
// `general` as toast text.
module.exports = async (req, res, next) => {
  const channel = req.body && req.body.channel;
  const contact = req.body && req.body.contact;
  const inviteUrl = req.body && req.body.inviteUrl;

  if (channel !== "email" && channel !== "phone") {
    return res
      .status(400)
      .json({ channel: "Should be email or phone" });
  }
  if (channel === "phone") {
    return res.status(400).json({ channel: "Phone invites not yet supported" });
  }

  if (!contact || typeof contact !== "string") {
    return res.status(400).json({ contact: "Is required" });
  }
  if (!isEmail(contact)) {
    return res.status(400).json({ contact: "Should be a valid email" });
  }
  if (contact.length > 254) {
    return res
      .status(400)
      .json({ contact: "Should be less than 255 characters" });
  }

  if (
    typeof inviteUrl !== "undefined" &&
    (typeof inviteUrl !== "string" || inviteUrl.length > 2000)
  ) {
    return res.status(400).json({ inviteUrl: "Should be a string" });
  }

  let invite;
  try {
    invite = await Invite.create({
      inviter: req.user.id,
      channel: "email",
      contact,
      inviteUrl: inviteUrl || "",
      deliveryState: "recorded",
    });
  } catch (err) {
    console.log(`Invite failed to be created for user ${req.user.id}`);
    return next(err);
  }

  // Fire-and-forget send. Don't await — let the response go.
  const inviterName = [req.user.firstName, req.user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim() || req.user.username || "Someone";
  const subject = `${inviterName} invited you to AXS Map`;
  const targetUrl =
    inviteUrl || process.env.APP_BASE_URL || "https://axsmap.com";
  const textContent = `${inviterName} thinks you'd love AXS Map.

Join us in mapping the world's accessible places: ${targetUrl}`;
  const htmlContent =
    `<p>${inviterName} thinks you'd love AXS Map.</p>` +
    `<p>Join us in mapping the world's accessible places:</p>` +
    `<p><a href="${targetUrl}">${targetUrl}</a></p>`;

  Promise.resolve(
    sendEmail({
      subject,
      htmlContent,
      textContent,
      receiversEmails: [contact],
    })
  )
    .then(() => Invite.updateOne({ _id: invite._id }, { $set: { deliveryState: "sent" } }))
    .catch((err) => {
      console.log(`Invite email failed to send to ${contact}: ${err && err.message}`);
      return Invite.updateOne(
        { _id: invite._id },
        { $set: { deliveryState: "failed" } }
      );
    });

  return res.status(201).json({
    id: invite._id.toString(),
    channel: invite.channel,
    deliveryState: invite.deliveryState,
    general: "We've emailed your friend!",
  });
};
