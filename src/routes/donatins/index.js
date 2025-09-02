const express = require("express");
const { purchaseProduct, purchaseSubscription } = require("./donation");
const { isAuthenticated } = require("../../helpers");

const router = new express.Router();

router.post("/product", isAuthenticated({ isOptional: false }), purchaseProduct);
router.post(
  "/subscription",
  isAuthenticated({ isOptional: false }),
  purchaseSubscription
);
// router.post("/apple-webhook", appleSignin);
// router.post("/google-webhook", appleSignin);

module.exports = router;
