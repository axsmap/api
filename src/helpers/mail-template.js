const activationEmailTemplate = (link,name) => {
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


module.exports={
  activationEmailTemplate
}