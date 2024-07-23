const { ValidationError } = require("sequelize");
const fileHelper = require("../util/file");
const Product = require("../models/product");
const User = require("../models/user");
const Order = require("../models/order");
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
  const searchQuery = req.query.search || "";
  const filter = searchQuery
    ? { title: new RegExp(searchQuery, "i"), userId: req.user._id }
    : { userId: req.user._id };

  Product.find(filter)
    .then((products) => {
      res.render("admin/products", {
        prods: products,
        pageTitle: "Admin Products",
        path: "/admin/products",
        searchQuery: searchQuery,
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).render("admin/products", {
        pageTitle: "Admin Products",
        path: "/admin/products",
        prods: [],
        errorMessage: "Fetching products failed, please try again later.",
        searchQuery: searchQuery,
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
// controllers/adminController.js

exports.getUserAccount = (req, res, next) => {
  const errorMessage = req.flash("error")[0] || null;
  const successMessage = req.flash("success")[0] || null;
  
  User.find()
    .then(users => {
      const safeUsers = users.map(user => ({
        _id: user._id,
        email: user.email,
        password: user.password,
        role: user.role,
        status: user.status
      }));

      res.render("admin/userAccount", {
        users: safeUsers,
        pageTitle: "User Account",
        path: "/admin/userAccount",
        errorMessage: errorMessage,
        successMessage: successMessage
      });
    })
    .catch(err => {
      console.error("Error fetching users:", err);
      res.status(500).send("Internal Server Error");
    });
};

exports.postUpdateStatus = (req, res, next) => {
  const userId = req.params.id;
  const newStatus = req.body.status;

  console.log(`User ID: ${userId}, New Status: ${newStatus}`);
  if (!['active', 'inactive', 'pending'].includes(newStatus)) {
    req.flash('error', 'Invalid status');
    return res.redirect('/admin/userAccount');
  }

  User.findByIdAndUpdate(userId, { status: newStatus }, { new: true })
    .then(user => {
      if (!user) {
        req.flash('error', 'User not found');
        return res.redirect('/admin/userAccount');
      }
      req.flash('success', 'User status updated successfully');
      res.redirect('/admin/userAccount');
    })
    .catch(err => {
      console.error("Error updating status:", err);
      req.flash('error', 'Internal Server Error');
      res.redirect('/admin/userAccount');
    });
};

exports.postDeleteUser = (req, res, next) => {
  const userId = req.params.id;

  User.findByIdAndDelete(userId)
    .then(user => {
      if (!user) {
        req.flash('error', 'User not found');
        return res.redirect('/admin/userAccount');
      }
      req.flash('success', 'User deleted successfully');
      res.redirect('/admin/userAccount');
    })
    .catch(err => {
      console.error("Error deleting user:", err);
      req.flash('error', 'Internal Server Error');
      res.redirect('/admin/userAccount');
    });
};

exports.getOrder = (req, res, next) => {
  const errorMessage = req.flash("errorOrder")[0] || null;
  const successMessage = req.flash("successOrder")[0] || null;

  Order.find()
    .then(orders => {
      // Calculate total price for each order
      orders = orders.map(order => {
        let totalPrice = 0;
        order.products.forEach(prod => {
          totalPrice += prod.quantity * prod.product.price;
        });
        return {
          ...order._doc,
          totalPrice
        };
      });

      res.render("admin/order", {
        orders: orders, // Make sure 'users' matches what you're using in the EJS template
        pageTitle: "User Order",
        path: "/admin/order",
        errorMessage: errorMessage,
        successMessage: successMessage
      });
    })
    .catch(err => {
      console.error("Error fetching orders:", err);
      res.status(500).send("Internal Server Error");
    });
};

exports.postDeleteOrder = (req, res, next) => {
  const orderId = req.params.id;

  Order.findByIdAndDelete(orderId)
    .then(order => {
      if (!order) {
        req.flash('errorOrder', 'Order not found');
        return res.redirect('/admin/order');
      }
      req.flash('successOrder', 'Order deleted successfully');
      res.redirect('/admin/order');
    })
    .catch(err => {
      console.error("Error deleting order:", err);
      req.flash('errorOrder', 'Internal Server Error');
      res.redirect('/admin/order');
    });
};
