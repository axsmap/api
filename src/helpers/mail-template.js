const activationEmailTemplate = (link, name) => {
  return `
    <!DOCTYPE html>
<html lang="en">
<body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f7f7;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="margin: 40px auto; background-color: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #FEE000; padding: 30px; text-align: center;">
              <h2 style="margin: 0; font-size: 24px; color: #000;">Welcome to AXS MAP 🎉</h2>
              <p style="margin: 10px 0 0; color: #444;">You're just one step away from getting started!</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                Hi <strong>${name}</strong>,
              </p>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                Thanks for signing up! Please confirm your email address by clicking the button below.
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${link}" style="background-color: #FEE000; color: #000; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                  Activate My Account
                </a>
              </div>

              <p style="font-size: 14px; color: #777; line-height: 1.5;">
                If you didn’t sign up for AXS Map, no worries — you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #FEE000; padding: 20px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #777;">
                Need help? <a href="mailto:support@axsmap.com" style="color: #000; text-decoration: underline;">Contact Support</a>
              </p>
              <p style="margin: 5px 0 0; font-size: 13px; color: #777;">&copy; 2025 AXS MAP. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

const submitServeyUserMailTemplate = (userName) => {
  return `
  <!DOCTYPE html>
<html lang="en">
<body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f7f7;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="margin: 40px auto; background-color: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #FEE000; padding: 30px; text-align: center;">
              <h2 style="margin: 0; font-size: 24px; color: #000;">Thank You for Sharing Your Voice! 🙌</h2>
              <p style="margin: 10px 0 0; color: #444;">Your recent AXS Map survey has been submitted.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                Hi <strong>${userName}</strong>,
              </p>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                We truly appreciate your input! Your recent survey submission helps us make AXS Map more accessible and impactful for everyone.
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process?.env?.FREE_T_SHIRT_RIDERECT_URL}" style="background-color: #FEE000; color: #000; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                  Order A Free AXS Map T-Shirt
                </a>
              </div>

              <p style="font-size: 14px; color: #777; line-height: 1.5;">
                Want to contribute more? You can always submit another review or share your experience with friends to help grow the community.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #FEE000; padding: 20px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #777;">
                Questions? <a href="mailto:support@axsmap.com" style="color: #000; text-decoration: underline;">Contact Support</a>
              </p>
              <p style="margin: 5px 0 0; font-size: 13px; color: #777;">&copy; 2025 AXS MAP. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

const adminServeyMailTemplate = (name, email, answers) => {
  return `
  <!DOCTYPE html>
<html lang="en">
<body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f7f7;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="margin: 40px auto; background-color: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #FEE000; padding: 30px; text-align: center;">
              <h2 style="margin: 0; font-size: 22px; color: #000;">New Survey Submitted on AXS Map 📝</h2>
              <p style="margin: 10px 0 0; color: #444;">A new survey response has just been submitted by a user.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="font-size: 16px; color: #333;">
                <strong>User Name:</strong> ${name}<br />
                <strong>Email:</strong> ${email}
              </p>

              <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

              <p style="font-size: 16px; color: #333; margin-bottom: 10px;"><strong>Survey Responses:</strong></p>

              ${answers.map((item, index) => {
                return `<p style="font-size: 15px; color: #333; line-height: 1.5;">
                <strong>Q${index + 1}:</strong> ${item?.question}<br />
                <strong>A:</strong> ${item?.answer}
              </p>`;
              })}
            </td>
          </tr>
          <tr>
            <td style="background-color: #FEE000; padding: 20px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #777;">
                For any issues, reach out to <a href="mailto:support@axsmap.com" style="color: #000; text-decoration: underline;">Support</a>
              </p>
              <p style="margin: 5px 0 0; font-size: 13px; color: #777;">&copy; 2025 AXS MAP. Admin Notification Email</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

const donationMailTemplate = (name) => {
  return `
  <!DOCTYPE html>
<html lang="en">
<body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f7f7;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="margin: 40px auto; background-color: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #FEE000; padding: 30px; text-align: center;">
              <h2 style="margin: 0; font-size: 24px; color: #000;">Thank You for Supporting AXS Map 🙏</h2>
              <p style="margin: 10px 0 0; color: #444;">Here’s your exclusive content</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                Hi <strong>${name}</strong>,
              </p>

              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                Thank you so much for supporting AXS Map. Your generosity helps us continue making accessibility more visible and empowering communities everywhere.
              </p>

              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                As a token of our appreciation, we’re sharing exclusive content just for our donors. You can access it through this private playlist:
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="https://www.youtube.com/playlist?list=PLilbYJMtY0uVPv2v7o7ILS3WQDNc5g-d6" style="background-color: #FEE000; color: #000; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                  👉 Exclusive AXS Map Content
                </a>
              </div>

              <p style="font-size: 14px; color: #777; line-height: 1.5;">
                Please keep this link private, as it’s reserved for supporters like you.
              </p>

              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                We’re grateful to have you with us on this journey toward a more accessible world. Enjoy the content, and thank you again for being part of the AXS Map community.
              </p>

              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                With gratitude,<br><strong>The AXS Map Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FEE000; padding: 20px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #777;">
                Need help? <a href="mailto:support@axsmap.com" style="color: #000; text-decoration: underline;">Contact Support</a>
              </p>
              <p style="margin: 5px 0 0; font-size: 13px; color: #777;">&copy; 2025 AXS MAP. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

module.exports = {
  activationEmailTemplate,
  submitServeyUserMailTemplate,
  adminServeyMailTemplate,
  donationMailTemplate,
};
