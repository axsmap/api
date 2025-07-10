const crypto = require("crypto");

const moment = require("moment");
const { pick } = require("lodash");
const randomstring = require("randomstring");
const slugify = require("speakingurl");

const { ActivationTicket } = require("../../models/activation-ticket");
const { cleanSpaces, sendEmail } = require("../../helpers");
const { User } = require("../../models/user");

const { validateSignUp } = require("./validations");
const { activationEmailTemplate } = require("../../helpers/mail-template");

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateSignUp(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const data = pick(req.body, [
    "email",
    "firstName",
    "isSubscribed",
    "lastName",
    "password",
    "aboutMe",
    "dateOfBirth",
    "disability",
    "gender",
    "race",
  ]);
  console.log(data)
  data.aboutMe = cleanSpaces(data.aboutMe ?? "");
  data.firstName = cleanSpaces(data.firstName);
  data.lastName = cleanSpaces(data.lastName);
  data.username = `${slugify(data.firstName)}-${slugify(data.lastName)}`;


  let activationTicket;
  try {
    activationTicket = await ActivationTicket.findOne({ email: data.email });
  } catch (err) {
    console.log(
      `Activation ticket with email ${
        data.email
      } failed to be found at sign-up.`
    );
    return next(err);
  }

  if (activationTicket) {
    const expiresAt = moment(activationTicket.expiresAt).utc();
    const today = moment.utc();
    if (expiresAt.isBefore(today)) {
      try {
        await ActivationTicket.deleteOne({ _id: activationTicket._id });
      } catch (err) {
        console.log(
          `Activation ticket with email ${
            activationTicket.email
          } failed to be removed at sign-up.`
        );
        return next(err);
      }
    }
  }

  let repeatedUsers;
  try {
    repeatedUsers = await User.find({
      $or: [{ email: data.email }, { username: data.username }],
      isArchived: false,
    });
  } catch (err) {
    return next(err);
  }

  if (repeatedUsers && repeatedUsers.length > 0) {
    for (const user of repeatedUsers) {
      if (user.email === data.email) {
        return res.status(400).json({ message: "This email address is already in use. Please use forgot password to login." });
      }

      let repeatedUser;
      do {
        data.username = `${slugify(data?.firstName)}-${slugify(
          data?.lastName
        )}-${randomstring.generate({
          length: 5,
          capitalization: "lowercase",
        })}`;

        try {
          repeatedUser = await User.findOne({
            username: data.username,
            isArchived: false,
          });
        } catch (err) {
          console.log(
            `User with username ${data.username} failed to be found at sign-up.`
          );
          return next(err);
        }
      } while (repeatedUser && repeatedUser.username === data.username);
    }
  }

  const today = moment.utc();
  const expiresAt = today.add(1, "days").toDate();
  const key = `${crypto
    .randomBytes(31)
    .toString("hex")}${new Date().getTime().toString()}`;

  const activationTicketData = {
    email: data.email,
    expiresAt,
    key,
    userData: {
      firstName: data.firstName,
      isSubscribed: data.isSubscribed,
      lastName: data.lastName,
      password: data.password,
      username: data.username,
      aboutMe: data.aboutMe || null,
      dateOfBirth: data.dateOfBirth || null,
      disability: data.disability || null,
      gender: data.gender || null,
      race: data?.race || '',
    },
  };
  console.log(activationTicketData)
  try {
    activationTicket = await ActivationTicket.create(activationTicketData);
  } catch (err) {
    console.log(
      `Activation ticket failed to be created at sign-up.\nData: ${JSON.stringify(
        activationTicketData
      )}`
    );
    return next(err);
  }

  const subject = "Activate Account";
  // TODO change base URL for ACTIVATION
  const textContent = `
    Welcome to AXS Map!
    To activate your account use the link below:
    ${process.env.API_URL}/auth/activate-account/${activationTicket.key}
    Stay awesome.
  `;
  const receiversEmails = [activationTicket.email];
  const activationLink = `https://axsmap.com/auth/activate-account/${activationTicket.key}`;
  const name = `${activationTicket?.userData?.firstName ?? ""} ${activationTicket?.userData?.lastName ?? ""}`;

  sendEmail({
    subject,
    htmlContent: activationEmailTemplate(activationLink, name),
    textContent,
    receiversEmails,
  });

  return res.status(201).json({ general: "Success" });
};
