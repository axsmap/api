const crypto = require('crypto');
const querystring = require('querystring');

const axios = require('axios');
const GoogleAuth = require('google-auth-library');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const randomstring = require('randomstring');
const slugify = require('speakingurl');

const { markUserOpened } = require('../../helpers/user-activity');
const { validateGoogleSignIn } = require('./validations');
const { getDb } = require('../events/leaderboard-helpers');

const AXS_MAP_IOS_CLIENT_ID =
  '485795629207-h1fdogfm67h5lmrfi727f1stl1glmhtc.apps.googleusercontent.com';

const getTokenDebugPayload = idToken => {
  try {
    const decoded = jwt.decode(idToken, { complete: true });
    const payload = decoded && decoded.payload ? decoded.payload : {};

    return {
      aud: payload.aud,
      iss: payload.iss
    };
  } catch (err) {
    return {
      decodeError: err.message
    };
  }
};

const logGoogleIdTokenDebug = (label, idToken, audiences, err) => {
  const tokenDebug = getTokenDebugPayload(idToken);

  console.log(
    `[google-sign-in] ${label}: ${JSON.stringify({
      token: tokenDebug,
      verifyAudiences: audiences,
      verifyClientId: process.env.GOOGLE_CLIENT_ID,
      verifyIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
      fallbackIosClientId: AXS_MAP_IOS_CLIENT_ID,
      error: err
        ? {
            name: err.name,
            message: err.message
          }
        : undefined
    })}`
  );
};

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateGoogleSignIn(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const code = req.body.code;
  const isAndroid = req.body.source === 'android';
  const auth = new GoogleAuth();
  const client = new auth.OAuth2(process.env.GOOGLE_CLIENT_ID, '', '');
  const audiences = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    AXS_MAP_IOS_CLIENT_ID
  ].filter(Boolean);
  const isIdToken = code.split('.').length === 3;

  const handleGoogleLogin = async login => {
    const payload = login.getPayload();

    const email = payload.email;
    const googleId = payload.sub;
    const db = await getDb();
    const users = db.collection('users');
    const refreshTokens = db.collection('refreshtokens');
    let user;
    try {
      user = await users.findOne({
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
      const firstName = payload.given_name || email.split('@')[0];
      const lastName = payload.family_name || 'User';
      const userData = {
        email: payload.email,
        googleId: payload.sub,
        firstName,
        lastName,
        avatar:
          payload.picture ||
          `https://s3.amazonaws.com/${
            process.env.AWS_S3_BUCKET
          }/users/avatars/default.png`,
        disabilities: ['none'],
        gender: 'private',
        isAdmin: false,
        isArchived: false,
        isBlocked: false,
        isSubscribed: false,
        connectionPreference: 'mapathon',
        language: 'en',
        reviewFieldsAmount: 0,
        reviewsAmount: 0,
        showDisabilities: false,
        showEmail: false,
        showPhone: false,
        events: [],
        blockedUsers: [],
        teams: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (payload.locale === 'en') {
        userData.language = 'en';
      } else if (payload.locale === 'es') {
        userData.language = 'es';
      }

      userData.username = `${slugify(userData.firstName)}-${slugify(
        userData.lastName
      )}`;

      let repeatedUsers;
      try {
        repeatedUsers = await users
          .find({
            username: userData.username,
            isArchived: false
          })
          .toArray();
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
            repeatedUser = await users.findOne({
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
        const result = await users.insertOne(userData);
        user = Object.assign({ _id: result.insertedId }, userData);
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
      const userId = user._id.toString();
      const refreshTokenData = {
        expiresAt,
        key: `${userId}${crypto.randomBytes(28).toString('hex')}`,
        userId
      };

      try {
        const result = await refreshTokens.insertOne(
          Object.assign({}, refreshTokenData, {
            createdAt: new Date(),
            updatedAt: new Date()
          })
        );
        refreshToken = Object.assign(
          { _id: result.insertedId },
          refreshTokenData
        );
      } catch (err) {
        console.log(
          `Refresh token failed to be created at google-sign-in.\nData: ${JSON.stringify(
            refreshTokenData
          )}`
        );
        return next(err);
      }
    } else {
      const userId = (user._id || user.id).toString();
      const today = moment.utc();
      const expiresAt = today.add(14, 'days').toDate();
      const key = `${userId}${crypto.randomBytes(28).toString('hex')}`;

      try {
        const result = await refreshTokens.findOneAndUpdate(
          { userId },
          {
            $set: {
              expiresAt,
              key,
              userId,
              updatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          {
            returnDocument: 'after',
            upsert: true
          }
        );
        refreshToken = result.value || result;
      } catch (err) {
        console.log(
          `Refresh Token for userId ${userId} failed to be created or updated at google-sign-in.`
        );
        return next(err);
      }
    }

    const userId = (user._id || user.id).toString();
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: 3600
    });
    refreshToken = refreshToken.key;

    try {
      await markUserOpened(userId);
    } catch (err) {
      console.log(`User ${userId} failed to mark opened at google-sign-in.`);
      return next(err);
    }

    return res.status(200).json({ token, refreshToken });
  };

  if (isIdToken) {
    logGoogleIdTokenDebug('verifying request id token', code, audiences);

    return client.verifyIdToken(code, audiences, async (err, login) => {
      if (err) {
        logGoogleIdTokenDebug(
          'request id token verification failed',
          code,
          audiences,
          err
        );
        return res.status(400).json({ general: 'Invalid token id' });
      }

      return handleGoogleLogin(login);
    });
  }

  const getTokenUrl = 'https://www.googleapis.com/oauth2/v4/token';
  const getTokenParams = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'authorization_code'
  };
  if (!isAndroid) {
    getTokenParams.redirect_uri = `${process.env.APP_URL}/auth/google`;
  }
  let getTokenResponse;
  try {
    getTokenResponse = await axios.post(
      getTokenUrl,
      querystring.stringify(getTokenParams)
    );
  } catch (err) {
    return res.status(400).json({ general: 'Invalid code' });
  }

  const idToken = getTokenResponse.data.id_token;
  logGoogleIdTokenDebug('verifying exchanged id token', idToken, audiences);

  client.verifyIdToken(idToken, audiences, async (err, login) => {
    if (err) {
      logGoogleIdTokenDebug(
        'exchanged id token verification failed',
        idToken,
        audiences,
        err
      );
      return res.status(400).json({ general: 'Invalid token id' });
    }

    return handleGoogleLogin(login);
  });
};
