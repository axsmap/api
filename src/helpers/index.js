const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
const { camelCase } = require("lodash");
const jwt = require("jsonwebtoken");
const { mapKeys, pickBy } = require("lodash");
const nodemailer = require("nodemailer");
const { snakeCase } = require("lodash");

// SESv2 client (AWS SDK v3) for the nodemailer 9 SES transport. Region +
// credentials come from the standard env chain (AWS_REGION /
// AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).
const sesClient = new SESv2Client({});

const { User } = require("../models/user");

module.exports = {
  cleanSpaces(string) {
    return string.replace(/\s+/g, " ").trim();
  },
  deleteUnusedProperties(obj) {
    return pickBy(obj, (prop) => prop);
  },
  isAuthenticated:
    ({ isOptional }) =>
    async (req, res, next) => {
      const authorizationHeader = req.headers.authorization;
      const deviceType = req.headers["x-device-type"];
      const userAgent = req.headers["user-agent"];

      let token;

      if (authorizationHeader) {
        token = authorizationHeader.split(" ")[1];
      }

      if (token) {
        let decoded;
        try {
          decoded = await jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
          if (isOptional) {
            // Stale/invalid token on a route that allows anonymous access →
            // proceed without req.user instead of 401. Important for mobile
            // clients holding long-cached JWTs that hit public read endpoints
            // (leaderboard click-through, public profile, badges, participant
            // page). The handler treats a missing req.user as an anonymous
            // viewer.
            return next();
          }
          console.log(err);
          return res.status(401).json({ general: "Failed to authenticate" });
        }

        // First check if user exists and if they are archived
        let user;
        try {
          user = await User.findOne({ _id: decoded.userId });
        } catch (err) {
          console.log(`User ${decoded.userId} failed to be found at authenticate`);
          return next(err);
        }

        if (!user) {
          return res.status(404).json({ general: "User not found" });
        }

        // Check if user is archived - they must reactivate first
        if (user.isArchived) {
          return res.status(403).json({ 
            general: "Your account is archived. Please reactivate your account to continue.",
            isArchived: true,
            requiresReactivation: true,
            userId: user.id
          });
        }

        // Check if user is blocked
        if (user.isBlocked) {
          return res.status(423).json({ general: "You are blocked" });
        }

        // Update activity tracking
        try {
          if (req.originalUrl.startsWith("/venues?") && req.method === "GET") {
            const location = req?.query?.location;
            if (location) {
              const [lat, lng] = location
                .split(",")
                .map((coord) => coord?.trim());
              if (lat && lng) {
                user.lastLocation = {
                  lat,
                  lng,
                };
              }
            }
          }
          user.lastActivityTime = new Date().toISOString();
          user.device = deviceType || userAgent || "";
          await user.save();
        } catch (saveErr) {
          console.log(`Failed to update user activity for ${decoded.userId}:`, saveErr.message);
          // Continue anyway - activity tracking failure shouldn't block the request
        }

        // Remove sensitive fields before attaching to request. NB: isAdmin
        // is intentionally kept — get-profile surfaces it, and the
        // /reports/users admin gate reads it from req.user.
        req.user = user.toObject({ virtuals: true });
        delete req.user.__v;
        delete req.user.createdAt;
        delete req.user.isArchived;
        delete req.user.isBlocked;
        delete req.user.hashedPassword;
        delete req.user.updatedAt;
        delete req.user._id; // Remove _id since we have id from virtuals

        return next();
      }

      if (isOptional) {
        return next();
      }

      return res.status(401).json({ general: "No token provided" });
    },
  isNumber(number) {
    return !isNaN(parseFloat(number)) && isFinite(number);
  },
  // Default display name — "First L." — used when a user hasn't set one.
  // Matches the frontend fallback. Returns "" only when both names are empty.
  buildDisplayName(firstName, lastName) {
    const f = (firstName || "").trim();
    const l = (lastName || "").trim();
    if (!f && !l) return "";
    if (!l) return f;
    return `${f} ${l.charAt(0).toUpperCase()}.`;
  },
  mapCamelCaseKeys(obj) {
    return mapKeys(obj, (value, key) => camelCase(key));
  },
  mapSnakeCaseKeys(obj) {
    return mapKeys(obj, (value, key) => snakeCase(key));
  },
  removeSpaces(string) {
    return string.replace(/\s/g, "");
  },
  sendEmail({
    senderEmail = process.env.SENDER_EMAIL,
    receiversEmails,
    subject,
    htmlContent,
    textContent,
  }) {
    const transporter = nodemailer.createTransport({
      SES: { sesClient, SendEmailCommand },
    });

    return transporter.sendMail({
      from: `"AXS Map" <${senderEmail}>`,
      to: receiversEmails.join(", "),
      subject,
      text: textContent,
      html: htmlContent,
    });
  },
  toJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
  },
  /**
   * Normalizes a date to noon UTC to avoid timezone issues.
   * This ensures the date stays the same regardless of client timezone.
   * Example: "2026-09-09T00:00:00.000Z" -> "2026-09-09T12:00:00.000Z"
   * @param {string|Date} dateInput - The date to normalize
   * @returns {Date|null} - Date at noon UTC or null if invalid
   */
  normalizeDateToNoonUTC(dateInput) {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  },
};
