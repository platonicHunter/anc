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
    body("password", "Password has to be valid.")
      .isLength({ min: 5 })
      .isAlphanumeric()
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
    body(
      "password",
      "The password must with only number and text and at least 5 number"
    )
      .isLength({ min: 5 })
      .isAlphanumeric()
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
router.get('/account', authController.getAccount);
router.post('/account', [
  check('password')
    .isLength({ min: 5 })
    .withMessage('Password must be at least 5 characters long.')
    .trim(),
  check('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords have to match!')
    .trim()
], authController.postUpdateAccount);


module.exports = router;
