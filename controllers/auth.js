const crypto = require("crypto");
//for password
const bcrypt = require("bcryptjs");
//validation

const { check, validationResult } = require("express-validator");

//mail
const { sendResetEmail, sendActivateEmail } = require('../models/sendMail');

const User = require("../models/user");
const user = require("../models/user");
const { ValidationError } = require("sequelize");

exports.getLogin = (req, res, next) => {
  const errorMessage = req.flash("error")[0] || null;
  const successMessage = req.flash("success")[0] || null;

  res.render("auth/login", {
    path: "/login",
    pageTitle: "Login",
    errorMessage: errorMessage,
    successMessage: successMessage,
    oldInput: { email: "" },
    validationErrors: [],
  });
};

exports.getSignup = (req, res, next) => {
  const errorMessage = req.flash("errorSign")[0] || null;
  const successMessage = req.flash("successSign")[0] || null;
  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Sign Up",
    errorMessage: errorMessage,
    successMessage: successMessage,
    oldInput: { email: "", password: "", confirmPassword: "" },
    validationErrors: [],
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render("auth/login", {
      path: "/login",
      pageTitle: "Login",
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password,
      },
      validationErrors: errors.array(),
    });
  }

  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        return res.status(422).render("auth/login", {
          path: "/login",
          pageTitle: "Login",
          errorMessage: "Email not found in the database.",
          oldInput: {
            email: email,
            password: password,
          },
          validationErrors: [],
        });
      }

      if (user.status === 'unactive') {
        req.flash('error', 'Your account is Inactive. Please contact  to admin.');
        return res.redirect('/login');
      }

      if (user.status === 'pending') {
        return res.status(422).render("auth/login", {
          path: "/login",
          pageTitle: "Login",
          errorMessage: "Your account is Pending. Please contact to admin.",
          oldInput: {
            email: email,
            password: password,
          },
          validationErrors: [],
        });
      }

      bcrypt
        .compare(password, user.password)
        .then((doMatch) => {
          if (doMatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save((err) => {
              if (err) {
                console.log(err);
              }
              res.redirect("/");
            });
          }
          return res.status(422).render("auth/login", {
            path: "/login",
            pageTitle: "Login",
            errorMessage: "Invalid email or password.",
            oldInput: {
              email: email,
              password: password,
            },
            validationErrors: [],
          });
        })
        .catch((err) => {
          console.log(err);
          res.redirect("/login");
        });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};


exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("auth/signup", {
      path: "/signup",
      pageTitle: "Sign Up",
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password,
        confirmPassword: confirmPassword,
      },
      validationErrors: errors.array(),
    });
  }

  return bcrypt
    .hash(password, 12)
    .then(hashedPassword => {
      const user = new User({
        email: email,
        password: hashedPassword,
        cart: { items: [] },
      });
      const activationToken = user.generateActivationToken();
      return user.save().then(() => activationToken);
    })
    .then((activationToken) => {
      return sendActivateEmail(email, activationToken);
    })
    .then(() => {
      req.flash("success", "Signup successful! Please check your email to activate your account.");
      res.redirect("/login");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};


// Activate Account
exports.getEmailActivateAccount = (req, res, next) => {
  User.findOne({
    activationToken: req.params.token,
    activationExpires: { $gt: Date.now() }
  })
    .then(user => {
      if (!user) {
        return res.status(400).send('Activation token is invalid or has expired.');
      }

      user.status = 'active';
      user.activationToken = undefined;
      user.activationExpires = undefined;

      return user.save();
    })
    .then(() => {    
      const successMessage = req.flash('success');
      res.render('auth/activateEmail', {
        pageTitle: 'Account Activation',
        path: `/activate/${req.params.token}`,
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      next(error);
    });
};


exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    console.log(err);
    res.redirect("/");
  });
};

//reset

exports.getReset = (req, res, next) => {
  const errorMessage = req.flash("errorReset")[0] || null;
  const successMessage = req.flash("successReset")[0] || null;
  res.render("auth/reset", {
    path: "/reset",
    pageTitle: "Reset Password",
    errorMessage: errorMessage,
    successMessage: successMessage,
  });
};

exports.postReset = (req, res, next) => {
  const { email } = req.body;

  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.error("Error generating random bytes:", err);
      req.flash("errorReset", "Something went wrong, please try again.");
      return res.redirect("/reset");
    }

    const token = buffer.toString("hex");

    User.findOne({ email: email })
      .then((user) => {
        if (!user) {
          req.flash("errorReset", "No account with that email found.");
          return res.redirect("/reset");
        }

        // Update user document with reset token and expiration
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000; // 1 hour in milliseconds

        return user.save().then((result) => {
          // Send email with reset token
          const emailSent = sendResetEmail(email, token);

          if (emailSent) {
            req.flash("successReset", "Look in your email");
            return res.redirect("/reset");
          } else {
            req.flash("errorReset", "Email not sent.");
            return res.redirect("/reset");
          }
        });
      })
      .catch((err) => {
        console.error("Error in password reset:", err);
        req.flash("errorReset", "Something went wrong, please try again.");
        res.redirect("/reset");
      });
  });
};

exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } })
    .then((user) => {
      if (!user) {
        req.flash(
          "errorReset",
          "Password reset token is invalid or has expired."
        );
        return res.redirect("/reset");
      }

      const errorMessage = req.flash("errorNP")[0] || null;
      const successMessage = req.flash("successNP")[0] || null;

      res.render("auth/new-password", {
        path: "/new-password",
        pageTitle: "New Password",
        errorMessage: errorMessage,
        successMessage: successMessage,
        userId: user._id.toString(),
        passwordToken: token,
      });
    })
    .catch((err) => {
      console.error("Error fetching user with reset token:", err);
      req.flash("errorReset", "Something went wrong, please try again.");
      res.redirect("/reset");
    });
};

exports.postNewPassword = (req, res, next) => {
  const newPassword = req.body.password;
  const newConfirmPassword = req.body.confirmPassword;
  const userId = req.body.userId;
  const passwordToken = req.body.passwordToken;
  let resetUser;

  if (newPassword !== newConfirmPassword) {
    console.log("password not match");
    req.flash("errorNP", "Passwords do not match.");
    return res.redirect(`/reset/${passwordToken}`);
  }

  User.findOne({
    resetToken: passwordToken,
    resetTokenExpiration: { $gt: Date.now() },
    _id: userId,
  })
    .then((user) => {
      if (!user) {
        req.flash(
          "errorReset",
          "Password reset token is invalid or has expired."
        );
        return res.redirect("/reset");
      }
      resetUser = user;
      return bcrypt.hash(newPassword, 12);
    })
    .then((hashPassword) => {
      resetUser.password = hashPassword;
      resetUser.resetToken = undefined;
      resetUser.resetTokenExpiration = undefined;
      return resetUser.save();
    })
    .then(() => {
      req.flash("success", "Password changed successfully.");
      res.redirect("/login");
    })
    .catch((err) => {
      console.log(err);
      req.flash("errorNP", "Something went wrong, please try again.");
      res.redirect(`/reset/${passwordToken}`);
    });
};

//Account Setting
// exports.getAccount = (req, res, next) => {
//   const errorMessage = req.flash("errorSign")[0] || null;
//   res.render("auth/account", {
//     path: "/account",
//     pageTitle: "Account Setting",
//     errorMessage: errorMessage,
//     oldInput: { email: req.user.email },
//     validationErrors: [],
//   });
// };
// exports.postUpdateAccount = (req, res, next) => {
//   const email = req.body.email;
//   const password = req.body.password;
//   const confirmPassword = req.body.confirmPassword;
//   const errors = validationResult(req);

//   if (!errors.isEmpty()) {
//     return res.status(422).render("auth/account", {
//       path: "/account",
//       pageTitle: "Account Setting",
//       errorMessage: errors.array()[0].msg,
//       oldInput: {
//         email: email,
//         password: password,
//         confirmPassword: confirmPassword,
//       },
//       validationErrors: errors.array(),
//     });
//   }

//   // If there are no validation errors, proceed to update the user
//   User.findById(req.user._id)
//     .then(user => {
//       if (!user) {
//         return res.status(404).render("auth/account", {
//           path: "/account",
//           pageTitle: "Account Setting",
//           errorMessage: "User not found.",
//           oldInput: {
//             email: email,
//             password: password,
//             confirmPassword: confirmPassword,
//           },
//           validationErrors: [],
//         });
//       }

//       user.email = email;

//       if (password) {
//         return bcrypt
//           .hash(password, 12)
//           .then(hashedPassword => {
//             user.password = hashedPassword;
//             return user.save();
//           });
//       }

//       return user.save();
//     })
//     .then(result => {
//       req.flash("success", "Account updated successfully");
//       res.redirect("/account");
//     })
//     .catch(err => {
//       const error = new Error(err);
//       error.httpStatusCode = 500;
//       return next(error);
//     });
// };

//another account setting
exports.getAccount = (req, res, next) => {
  const errorMessage = req.flash("errorSign")[0] || null;
  const successMessage = req.flash("success")[0] || null;
  res.render("auth/account", {
    path: "/account",
    pageTitle: "Account Setting",
    errorMessage: errorMessage,
    successMessage: successMessage,
    oldInput: { email: req.user.email },
    validationErrors: [],
  });
};

exports.postUpdateAccount = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("auth/account", {
      path: "/account",
      pageTitle: "Account Setting",
      errorMessage: errors.array()[0].msg,
      successMessage: null,
      oldInput: {
        email: email,
        password: password,
        confirmPassword: confirmPassword,
      },
      validationErrors: errors.array(),
    });
  }

  User.findById(req.user._id)
    .then((user) => {
      if (!user) {
        return res.status(404).render("auth/account", {
          path: "/account",
          pageTitle: "Account Setting",
          errorMessage: "User not found.",
          successMessage: null,
          oldInput: {
            email: email,
            password: password,
            confirmPassword: confirmPassword,
          },
          validationErrors: [],
        });
      }

      user.email = email;

      if (password) {
        return bcrypt.hash(password, 12).then((hashedPassword) => {
          user.password = hashedPassword;
          return user.save();
        });
      }

      return user.save();
    })
    .then((result) => {
      req.flash("success", "Account updated successfully");
      res.redirect("/account");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};
