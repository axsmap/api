const crypto = require('crypto');
const querystring = require('querystring');

const axios = require('axios');
const GoogleAuth = require('google-auth-library');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const randomstring = require('randomstring');
const slugify = require('speakingurl');

const { RefreshToken } = require('../../models/refresh-token');
const { User } = require('../../models/user');

const { validateGoogleSignIn } = require('./validations');

module.exports = async (req, res, next) => {
  req.body.code = decodeURIComponent(req.body.code);
  const { errors, isValid } = validateGoogleSignIn(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const code = req.body.code;

  const getTokenUrl = 'https://www.googleapis.com/oauth2/v4/token';
  const getTokenParams = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: `${process.env.APP_URL}/auth/google`,
    grant_type: 'authorization_code'
  };
  let getTokenResponse;
  try {
    getTokenResponse = await axios.post(
      getTokenUrl,
      querystring.stringify(getTokenParams)
    );
  } catch (err) {
    return res.status(400).json({ general: 'Invalid code' });
  }

  const auth = new GoogleAuth();
  const client = new auth.OAuth2(process.env.GOOGLE_CLIENT_ID, '', '');
  const idToken = getTokenResponse.data.id_token;
  client.verifyIdToken(
    idToken,
    process.env.GOOGLE_CLIENT_ID,
    async (err, login) => {
      if (err) {
        return res.status(400).json({ general: 'Invalid token id' });
      }

      const payload = login.getPayload();

      const email = payload.email;
      const googleId = payload.sub;
      let user;
      try {
        user = await User.findOne({
          $or: [{ email }, { googleId }],
          isArchived: false
        });
      } catch (err) {
        console.log(
          `User with googleId ${googleId} and email ${email} failed to be found at google-sign-in.`
        );
        return next(err);
      }

      let refreshToken;

      if (!user) {
        const userData = {
          email: payload.email,
          googleId: payload.sub,
          firstName: payload.given_name,
          lastName: payload.family_name
        };

        if (payload.locale === 'en') {
          userData.language = 'en';
        } else if (payload.locale === 'es') {
          userData.language = 'es';
        }

        if (payload.picture) {
          userData.avatar = payload.picture;
        }

        userData.username = `${slugify(userData.firstName)}-${slugify(
          userData.lastName
        )}`;

        let repeatedUsers;
        try {
          repeatedUsers = await User.find({
            username: userData.username,
            isArchived: false
          });
        } catch (err) {
          console.log('Users failed to be found at google-sign-in.');
          return next(err);
        }

        if (repeatedUsers && repeatedUsers.length > 0) {
          let repeatedUser;
          do {
            userData.username = `${slugify(userData.firstName)}-${slugify(
              userData.lastName
            )}-${randomstring.generate({
              length: 5,
              capitalization: 'lowercase'
            })}`;

            try {
              repeatedUser = await User.findOne({
                username: userData.username,
                isArchived: false
              });
            } catch (err) {
              console.log(
                `User with username ${
                  userData.username
                } failed to be found at google-sign-in.`
              );
              return next(err);
            }
          } while (repeatedUser && repeatedUser.username === userData.username);
        }

        try {
          user = await User.create(userData);
        } catch (err) {
          console.log(
            `User failed to be created at google-sign-in.\nData: ${JSON.stringify(
              userData
            )}`
          );
          return next(err);
        }

        const today = moment.utc();
        const expiresAt = today.add(14, 'days').toDate();
        const refreshTokenData = {
          expiresAt,
          key: `${user.id}${crypto.randomBytes(28).toString('hex')}`,
          userId: user.id
        };

        try {
          refreshToken = await RefreshToken.create(refreshTokenData);
        } catch (err) {
          console.log(
            `Refresh token failed to be created at google-sign-in.\nData: ${JSON.stringify(
              refreshTokenData
            )}`
          );
          return next(err);
        }
      } else {
        const userId = user.id;
        const today = moment.utc();
        const expiresAt = today.add(14, 'days').toDate();
        const key = `${userId}${crypto.randomBytes(28).toString('hex')}`;

        try {
          refreshToken = await RefreshToken.findOneAndUpdate(
            { userId },
            { expiresAt, key, userId },
            { new: true, setDefaultsOnInsert: true, upsert: true }
          );
        } catch (err) {
          console.log(
            `Refresh Token for userId ${userId} failed to be created or updated at google-sign-in.`
          );
          return next(err);
        }
      }

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: 3600
      });
      refreshToken = refreshToken.key;

      return res.status(200).json({ token, refreshToken });
    }
  );
};
