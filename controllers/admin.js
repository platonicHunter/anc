const { ValidationError } = require("sequelize");
const fileHelper = require("../util/file");
const Product = require("../models/product");
const User = require("../models/user");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

exports.getAddProduct = (req, res, next) => {
  res.render("admin/edit-product", {
    pageTitle: "Add Product",
    path: "/admin/add-product",
    editing: false,
    hasError: false,
    errorMessage: null,
    validationErrors: [],
  });
};

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const image = req.file;
  const price = req.body.price;
  const description = req.body.description;
  const errors = validationResult(req);

  if (!image) {
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/edit-product",
      editing: false,
      hasError: true,
      product: { title, price, description },
      errorMessage: "Attach File not an Image",
      validationErrors: [],
    });
  }
  const imageUrl = image.path;
  if (!errors.isEmpty()) {
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/edit-product",
      editing: false,
      hasError: true,
      product: { title, imageUrl, price, description },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
    });
  }

  const product = new Product({
    //_id: mongoose.Types.ObjectId("6687bd6c575ba15124ca476e"),
    title: title,
    price: price,
    description: description,
    imageUrl: imageUrl,
    userId: req.user,
  });
  product
    .save()
    .then((result) => {
      console.log("Created Product");
      res.redirect("/admin/products");
    })
    .catch((err) => {
      //console.log(err);
      // res.status(500).render("admin/edit-product", {
      //   pageTitle: "Add Product",
      //   path: "/admin/add-product",
      //   editing: false,
      //   hasError: true,
      //   product: { title, imageUrl, price, description },
      //   errorMessage: "Database operation failed, please try again.",
      //   validationErrors: [],
      // });
      res.redirect("/500");
    });
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit === "true";
  if (!editMode) {
    return res.redirect("/");
  }
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        return res.redirect("/");
      }
      res.render("admin/edit-product", {
        pageTitle: "Edit Product",
        path: "/admin/edit-product",
        editing: editMode,
        product: product,
        hasError: false,
        errorMessage: null,
        validationErrors: [],
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next();
    });
};

exports.postEditProduct = (req, res, next) => {
  const prodId = req.body.productId;
  const updatedTitle = req.body.title;
  const updatedPrice = req.body.price;
  const image = req.file;
  const updatedDesc = req.body.description;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Edit Product",
      path: "/admin/edit-product",
      editing: true,
      hasError: true,
      product: {
        title: updatedTitle,
        imageUrl: updatedImageUrl,
        price: updatedPrice,
        description: updatedDesc,
        _id: prodId,
      },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
    });
  }

  Product.findById(prodId)
    .then((product) => {
      if (product.userId.toString() !== req.user._id.toString()) {
        return res.redirect("/");
      }
      product.title = updatedTitle;
      product.price = updatedPrice;
      product.description = updatedDesc;
      if (image) {
        fileHelper.deleteFile(product.imageUrl); //delete image on folder
        product.imageUrl = image.path;
      }
      return product.save();
    })
    .then((result) => {
      console.log("UPDATED PRODUCT!");
      res.redirect("/admin/products");
    })
    .catch((err) => {
      console.log(err);
      res.status(500).render("admin/edit-product", {
        pageTitle: "Edit Product",
        path: "/admin/edit-product",
        editing: true,
        hasError: true,
        product: {
          title: updatedTitle,
          imageUrl: updatedImageUrl,
          price: updatedPrice,
          description: updatedDesc,
          _id: prodId,
        },
        errorMessage: "Database operation failed, please try again.",
        validationErrors: [],
      });
    });
};

exports.getProducts = (req, res, next) => {
  Product.find({ userId: req.user._id })
    .then((products) => {
      res.render("admin/products", {
        prods: products,
        pageTitle: "Admin Products",
        path: "/admin/products",
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).render("admin/products", {
        pageTitle: "Admin Products",
        path: "/admin/products",
        prods: [],
        errorMessage: "Fetching products failed, please try again later.",
      });
    });
};

exports.postDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        throw new Error("Product not found");
      }
      fileHelper.deleteFile(product.imageUrl); //delete image on folder
      return Product.deleteOne({ _id: prodId, userId: req.user._id });
    })
    .catch((err) => next(err))

    .then(() => {
      console.log("DESTROYED PRODUCT");
      res.redirect("/admin/products");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next();
    });
};

//get User Account
exports.getUserAccount = (req, res,next) => {
  User.find()
  .then((users) => {
      const safeUsers = users.map(user => ({
          _id: user._id,
          email: user.email,
          password:user.password,
          role: user.role,
          status: user.status
      }));

      res.render("admin/userAccount", {
          users: safeUsers,
          pageTitle: "User Account",
          path: "/admin/userAccount",
      });
  })
    .catch((err) => {
      console.error("Error fetching users:", err);
      res.status(500).send("Internal Server Error");
    });
};


exports.postUpdateStatus= (req, res,next) => {
  const userId = req.params.id;
  const newStatus = req.body.status;

  // Validate input
  if (!['active', 'inactive', 'pending'].includes(newStatus)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  // Find user by ID and update status
  User.findByIdAndUpdate(userId, { status: newStatus }, { new: true })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Redirect back to the user list
      res.redirect('/admin/userAccount');
    })
    .catch(err => {
      console.error("Error updating status:", err);
      res.status(500).json({ message: 'Internal Server Error' });
    });
};

// Route to delete user (if needed)
exports.postDeleteUser= (req, res,next) => {
  const userId = req.params.id;

  User.findByIdAndDelete(userId)
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Redirect back to the user list
      res.redirect('/admin/userAccount');
    })
    .catch(err => {
      console.error("Error deleting user:", err);
      res.status(500).json({ message: 'Internal Server Error' });
    });
};

