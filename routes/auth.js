const express = require("express");

const { check, validationResult, body } = require("express-validator");

const authController = require("../controllers/auth");

const User = require("../models/user");

const router = express.Router();

router.get("/login", authController.getLogin);

router.get("/signup", authController.getSignup);

router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .withMessage("Please enter a valid email address.")
      .normalizeEmail(),
    body("password")
    .isLength({ min: 5 })
    .withMessage("Password must contain at least 8 character long")
    .trim(),
  ],
  authController.postLogin
);

router.post(
  "/signup",
  [
    check("email")
      .isEmail()
      .withMessage("Please enter email")
      .custom((value, { req }) => {
        //   if (value === "ha@gmail.com") {
        //     throw new Error("This account is denied by admin");
        //   }
        //   return true;
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject("Email has already Exit");
          }
        });
      })
      .normalizeEmail(),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must contain at least 8 character long")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one Capital Letter")
      .matches(/[a-z]/)
      .withMessage("Password must contain at least one Small Letter")
      .matches(/[0-9]/)
      .withMessage("Password must contain at least one Number")
      .matches(/[\W_]/)
      .withMessage("Password must contain at least one Special Character")
      .trim(),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Password must Match!");
      }
      return true;
    }),
  ],
  authController.postSignup
);

router.post("/logout", authController.postLogout);

router.get("/reset", authController.getReset);

router.post("/reset", authController.postReset);

//new password
router.get("/reset/:token", authController.getNewPassword);

router.post("/new-password", authController.postNewPassword);

//Account
router.get("/account", authController.getAccount);
router.post(
  "/account",
  [
    check("password")
    .isLength({ min: 8 })
    .withMessage("Password must contain at least 8 character long")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one Capital Letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one Small Letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one Number")
    .matches(/[\W_]/)
    .withMessage("Password must contain at least one Special Character")
    .trim(),
    check("confirmPassword")
      .custom((value, { req }) => value === req.body.password)
      .withMessage("Passwords have to match!")
      .trim(),
  ],
  authController.postUpdateAccount
);

module.exports = router;
