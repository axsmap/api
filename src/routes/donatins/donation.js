// services/apple.js
const axios = require("axios");
const { Donations } = require("../../models/donations");
const { sendEmail } = require("../../helpers");
const { donationMailTemplate } = require("../../helpers/mail-template");

const APPLE_PROD = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt";

async function verifyAppleReceipt(receipt) {
  const payload = {
    "receipt-data": receipt,
    password: process.env.APP_SHARED_SECRET, // only needed for subscriptions
    "exclude-old-transactions": true,
  };

  try {
    // let response = await axios.post("https://buy.itunes.apple.com/verifyReceipt", payload, {
    //   headers: { "Content-Type": "application/json" }
    // });

    response = await axios.post(APPLE_SANDBOX, payload, {
      headers: { "Content-Type": "application/json" },
    });

    return response.data;
  } catch (err) {
    console.error("Apple verification failed", err);
    throw err;
  }
}

async function purchaseProduct(req, res) {
  try {
    const receipt = await verifyAppleReceipt(req.body.transactionReceipt);
    if (receipt.status === 0 || receipt?.environment === "Sandbox") {
      const alreadyExists = await Donations.findOne({
        userId: req.user.id,
        transactionId: req.body.transactionId,
      });
      if (alreadyExists) {
        return res.status(400).json({ message: "Already purchased" });
      }
      sendEmail({
        receiversEmails: [req.user?.email],
        subject:
          "Thank You for Supporting AXS Map – Here’s Your Exclusive Content",
        htmlContent: donationMailTemplate({
          name: req.user?.firstName + " " + req.user?.lastName,
        }),
      });
        // if (receipt?.environment === "Sandbox")
        //   return res.status(400).json({ message: "Apple verification failed" });

      const result = await Donations.create({
        userId: req.user.id,
        amount: req.body.amount,
        type: "one_time",
        currency: req.body.currency,
        productId: req.body.productId,
        transactionId: req.body.transactionId,
        receipt: req.body.transactionReceipt,
        status: "purchased",
        purchasedAt: req?.body?.transactionDate,
        country: req?.body?.country,
        platform: req?.body?.platform,
      });
      return res.status(200).json({ result });
    } else {
      return res.status(400).json({ message: "verification failed" });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Apple verification failed" });
  }
}

async function purchaseSubscription(req, res) {
  try {
    const receipt =
      req.body.platform === "ios"
        ? await verifyAppleReceipt(req.body.transactionReceipt)
        : { receipt: { status: 0 } };
    // if (receipt.status !== 0 || receipt?.environment !== "Sandbox") {
    //   return res.status(400).json({ message: "verification failed" });
    // }
    const alreadyExists = await Donations.findOne({
      userId: req.user.id,
      transactionId: req.body.transactionId,
    });
    if (alreadyExists) {
      return res.status(400).json({ message: "Already purchased" });
    }
    sendEmail({
      receiversEmails: [req.user?.email],
      subject:
        "Thank You for Supporting AXS Map – Here’s Your Exclusive Content",
      htmlContent: donationMailTemplate({
        name: req.user?.firstName + " " + req.user?.lastName,
      }),
    });
    //   if (receipt?.environment === "Sandbox")
    //     return res.status(400).json({ message: "Apple verification failed" });

    const result = await Donations.create({
      userId: req.user.id,
      amount: req.body.amount,
      type: "monthly",
      currency: req.body.currency,
      productId: req.body.productId,
      transactionId: req.body.transactionId,
      originalTransactionId: req.body?.originalTransactionIdentifierIOS,
      receipt: req.body.transactionReceipt,
      status: "purchased",
      purchasedAt: req?.body?.transactionDate,
      country: req?.body?.country,
      platform: req?.body?.platform,
    });
    return res.status(200).json({ result });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Apple verification failed" });
  }
}

module.exports = { purchaseProduct, purchaseSubscription };
