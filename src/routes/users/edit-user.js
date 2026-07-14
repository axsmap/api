const moment = require('moment');

const { cleanSpaces } = require('../../helpers');
const { Photo } = require('../../models/photo');
const { getDb } = require('../events/leaderboard-helpers');
const { toObjectId } = require('../connections/helpers');

const { validateEditUser } = require('./validations');

module.exports = async (req, res, next) => {
  const userId = req.params.userId;

  let user;
  try {
    user = await (await getDb())
      .collection('users')
      .findOne({ _id: toObjectId(userId), isArchived: false });
  } catch (err) {
    if (
      err.name === 'CastError' ||
      (err.message && err.message.includes('ObjectId'))
    ) {
      return res.status(404).json({ general: 'User not found' });
    }

    console.log(`User with Id ${userId} failed to be found at edit-user.`);
    return next(err);
  }

  if (!user) {
    return res.status(404).json({ general: 'User not found' });
  }

  if (user._id.toString() !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ general: 'Forbidden action' });
  }

  const data = req.body;

  const { errors, isValid } = validateEditUser(data);
  if (!isValid) return res.status(400).json(errors);

  if (
    data.avatar &&
    !data.avatar.includes('default') &&
    data.avatar !== user.avatar
  ) {
    let avatar;
    try {
      avatar = await Photo.findOne({ url: data.avatar });
    } catch (err) {
      console.log(`Avatar ${data.avatar} failed to be found at edit-user`);
      return next(err);
    }

    if (!avatar) {
      return res.status(404).json({ avatar: 'Not found' });
    }

    user.avatar = data.avatar;
  } else if (data.avatar === '') {
    user.avatar = `https://s3.amazonaws.com/${
      process.env.AWS_S3_BUCKET
    }/users/avatars/default.png`;
  }

  user.description = data.description || user.description;

  user.disabilities = data.disabilities || user.disabilities;

  user.firstName = data.firstName
    ? cleanSpaces(data.firstName)
    : user.firstName;

  user.gender = data.gender || user.gender;

  user.isSubscribed =
    typeof data.isSubscribed !== 'undefined'
      ? data.isSubscribed
      : user.isSubscribed;

  user.connectionPreference =
    typeof data.connectionPreference !== 'undefined'
      ? data.connectionPreference
      : user.connectionPreference;

  if (typeof data.displayName !== 'undefined') {
    user.displayName =
      data.displayName === null || data.displayName === ''
        ? null
        : cleanSpaces(data.displayName);
  }

  user.profilePublic =
    typeof data.profilePublic !== 'undefined'
      ? data.profilePublic
      : user.profilePublic !== false;

  user.publicVisibility =
    typeof data.publicVisibility !== 'undefined'
      ? data.publicVisibility
      : user.publicVisibility || 'displayName';

  user.language = data.language || user.language;

  user.lastName = data.lastName ? cleanSpaces(data.lastName) : user.lastName;

  user.phone = data.phone || user.phone;

  user.showDisabilities =
    typeof data.showDisabilities !== 'undefined'
      ? data.showDisabilities
      : user.showDisabilities;

  user.showEmail =
    typeof data.showEmail !== 'undefined' ? data.showEmail : user.showEmail;

  user.showPhone =
    typeof data.showPhone !== 'undefined' ? data.showPhone : user.showPhone;

  if (data.username && data.username !== user.username) {
    let repeatedUser;
    try {
      repeatedUser = await (await getDb()).collection('users').findOne({
        username: data.username,
        isArchived: false
      });
    } catch (err) {
      console.log(
        `User with username ${data.username} failed to be found at edit-user.`
      );
      return next(err);
    }

    if (repeatedUser) {
      return res.status(400).json({ username: 'Is already taken' });
    }

    user.username = data.username;
  }

  user.zip = data.zip ? cleanSpaces(data.zip) : user.zip;

  user.updatedAt = moment.utc().toDate();

  try {
    const db = await getDb();
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          avatar: user.avatar,
          connectionPreference: user.connectionPreference,
          description: user.description,
          displayName: user.displayName,
          disabilities: user.disabilities,
          firstName: user.firstName,
          gender: user.gender,
          isSubscribed: user.isSubscribed,
          language: user.language,
          lastName: user.lastName,
          phone: user.phone,
          profilePublic: user.profilePublic,
          publicVisibility: user.publicVisibility,
          showDisabilities: user.showDisabilities,
          showEmail: user.showEmail,
          showPhone: user.showPhone,
          updatedAt: user.updatedAt,
          username: user.username,
          zip: user.zip
        }
      }
    );
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {};

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message;
      });

      return res.status(400).json(validationErrors);
    }

    console.log(
      `User ${
        user.id
      } failed to be updated at edit-user.\nData: ${JSON.stringify(
        data,
        null,
        2
      )}`
    );
    return next(err);
  }

  const dataResponse = {
    id: user._id.toString(),
    avatar: user.avatar,
    connectionPreference: user.connectionPreference,
    description: user.description,
    displayName: user.displayName || null,
    disabilities: user.disabilities,
    firstName: user.firstName,
    gender: user.gender,
    isSubscribed: user.isSubscribed,
    lastName: user.lastName,
    phone: user.phone,
    profilePublic: user.profilePublic,
    publicVisibility: user.publicVisibility,
    showDisabilities: user.showDisabilities,
    showEmail: user.showEmail,
    showPhone: user.showPhone,
    username: user.username,
    zip: user.zip
  };
  return res.status(200).json(dataResponse);
};
