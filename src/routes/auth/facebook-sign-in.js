const crypto = require('crypto');

const axios = require('axios');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const randomstring = require('randomstring');
const slugify = require('speakingurl');

const { RefreshToken } = require('../../models/refresh-token');
const { User } = require('../../models/user');

const { validateFacebookSignIn } = require('./validations');

const FACEBOOK_ISSUER = 'https://www.facebook.com';
const FACEBOOK_JWKS_URL =
  'https://www.facebook.com/.well-known/oauth/openid/jwks/';

let facebookSigningKeys;
let facebookSigningKeysExpiresAt = 0;

async function getFacebookSigningKey(kid) {
  if (!facebookSigningKeys || Date.now() >= facebookSigningKeysExpiresAt) {
    const response = await axios.get(FACEBOOK_JWKS_URL);
    facebookSigningKeys = response.data.keys;
    facebookSigningKeysExpiresAt = Date.now() + 60 * 60 * 1000;
  }

  const jwk = facebookSigningKeys.find(key => key.kid === kid);
  if (!jwk) {
    facebookSigningKeys = null;
    throw new Error('Facebook signing key was not found');
  }

  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

async function verifyLimitedLoginToken(authenticationToken, expectedNonce) {
  const decoded = jwt.decode(authenticationToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Invalid Facebook authentication token');
  }

  const signingKey = await getFacebookSigningKey(decoded.header.kid);
  const claims = jwt.verify(authenticationToken, signingKey, {
    algorithms: ['RS256'],
    audience: process.env.FACEBOOK_CLIENT_ID,
    issuer: FACEBOOK_ISSUER
  });

  if (expectedNonce && claims.nonce !== expectedNonce) {
    throw new Error('Invalid Facebook authentication nonce');
  }

  return {
    id: claims.sub,
    email: claims.email || '',
    first_name: claims.given_name || '',
    last_name: claims.family_name || '',
    name: claims.name || '',
    picture: typeof claims.picture === 'string' ? claims.picture : ''
  };
}

async function getClassicFacebookProfile(code) {
  const getTokenResponse = await axios.get(
    'https://graph.facebook.com/v2.10/oauth/access_token',
    {
      params: {
        code,
        client_id: process.env.FACEBOOK_CLIENT_ID,
        client_secret: process.env.FACEBOOK_CLIENT_SECRET,
        redirect_uri: `${process.env.APP_URL}/auth/facebook`
      }
    }
  );
  const facebookToken = getTokenResponse.data.access_token;
  const profileResponse = await axios.get(
    'https://graph.facebook.com/v2.10/me?fields=id,email,first_name,last_name,locale',
    { params: { access_token: facebookToken } }
  );

  return { profile: profileResponse.data, facebookToken };
}

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateFacebookSignIn(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  let facebookProfile;
  let facebookToken;
  try {
    if (req.body.authenticationToken) {
      facebookProfile = await verifyLimitedLoginToken(
        req.body.authenticationToken,
        req.body.nonce
      );
    } else {
      const classicLogin = await getClassicFacebookProfile(req.body.code);
      facebookProfile = classicLogin.profile;
      facebookToken = classicLogin.facebookToken;
    }
  } catch (err) {
    console.log(`Facebook authentication failed: ${err.message}`);
    return res.status(400).json({ general: 'Invalid Facebook login' });
  }

  if (!facebookProfile.email) {
    return res.status(400).json({
      general: 'No email address is available for this Facebook account'
    });
  }

  const email = facebookProfile.email;
  const facebookId = facebookProfile.id;
  let user;
  try {
    user = await User.findOne({
      $or: [{ email }, { facebookId }],
      isArchived: false
    });
  } catch (err) {
    console.log(
      `User with facebookId ${facebookId} and email ${email} failed to be found at facebook-sign-in.`
    );
    return next(err);
  }

  let refreshToken;

  if (!user) {
    const nameParts = (facebookProfile.name || '').trim().split(/\s+/);
    const userData = {
      email,
      facebookId,
      firstName: facebookProfile.first_name || nameParts[0] || 'Facebook',
      lastName:
        facebookProfile.last_name || nameParts.slice(1).join(' ') || 'User'
    };
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
      console.log('Users failed to be found at facebook-sign-in.');
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
            } failed to be found at facebook-sign-in.`
          );
          return next(err);
        }
      } while (repeatedUser && repeatedUser.username === userData.username);
    }

    if (facebookProfile.picture) {
      userData.avatar = facebookProfile.picture;
    } else if (facebookToken) {
      try {
        const pictureResponse = await axios.get(
          `https://graph.facebook.com/v2.10/${userData.facebookId}/picture`,
          {
            params: {
              access_token: facebookToken,
              redirect: false,
              type: 'large'
            }
          }
        );
        if (!pictureResponse.data.data.is_silhouette) {
          userData.avatar = pictureResponse.data.data.url;
        }
      } catch (err) {
        console.log('Facebook profile picture could not be loaded.');
      }
    }

    try {
      user = await User.create(userData);
    } catch (err) {
      console.log(
        `User failed to be created at facebook-sign-in.\nData: ${JSON.stringify(
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
        `Refresh token failed to be created at facebook-sign-in.\nData: ${JSON.stringify(
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
        `Refresh Token for userId ${userId} failed to be created or updated at facebook-sign-in.`
      );
      return next(err);
    }
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: 3600
  });
  refreshToken = refreshToken.key;

  return res.status(200).json({ token, refreshToken });
};
