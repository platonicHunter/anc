const fs = require("fs");
const path = require("path");

const Product = require("../models/product");
const Order = require("../models/order");

const PDFDocument = require("pdfkit");

const ITEMS_PER_PAGE = 3;

exports.getProducts = (req, res, next) => {
  Product.find()
    .then((products) => {
      console.log(products);
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "All Products",
        path: "/products",
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next();
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next();
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next();
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items;
      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next();
    });
};

exports.postCart = (req, res, next) => {
  const userId = req.user._id;
  const prodId = req.body.productId;

  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        return res.status(404).send("Product not found.");
      }
      if (userId.toString() === product.userId.toString()) {
        return res.status(400).send("Can't order your own product!!");
      }
      return req.user.addToCart(product).then((result) => {
        console.log(result);
        res.redirect("/cart");
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("An error occurred.");
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next();
    });
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user,
        },
        products: products,
      });
      return order.save();
    })
    .then((result) => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect("/orders");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next();
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ "user.userId": req.user._id })
    .then((orders) => {
      res.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        orders: orders,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next();
    });
};

//Another Invoice File
exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        return next(new Error("No Order Found"));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error("Unauthorized"));
      }

      const invoiceName = "invoice-" + orderId + ".pdf";
      const invoicePath = path.join("data", "invoices", invoiceName);

      const pdfDoc = new PDFDocument({ margin: 50 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'inline; filename="' + invoiceName + '"'
      );

      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);

      // Header
      pdfDoc
        .fontSize(20)
        .fillColor("black")
        .text("Company Name", { align: "center" })
        .moveDown();
      pdfDoc
        .fontSize(10)
        .fillColor("gray")
        .text("Company Address Line 1", { align: "center" })
        .text("Company Address Line 2", { align: "center" })
        .text("Company Address Line 3", { align: "center" })
        .moveDown();

      // Invoice Title
      pdfDoc
        .fontSize(26)
        .fillColor("black")
        .text("INVOICE", { align: "center", underline: true })
        .moveDown();

      const today = new Date();
      const todayDate = `${today.getDate().toString().padStart(2, "0")}-${(
        today.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}-${today.getFullYear()}`;

      // Order details
      pdfDoc
        .fontSize(14)
        .fillColor("black")
        .text(`Order ID: ${orderId}`)
        .text(`Order Date: ${todayDate}`)
        //.text(`Customer Name: ${orderId}`)
        .moveDown();

      // Table headers
      const tableTop = pdfDoc.y;
      pdfDoc
        .fontSize(14)
        .fillColor("black")
        .text("Product", 50, tableTop)
        .text("Quantity", 250, tableTop)
        .text("Price", 350, tableTop)
        .text("Total", 475, tableTop);

      // Underline headers
      pdfDoc
        .moveTo(50, pdfDoc.y + 15)
        .lineTo(550, pdfDoc.y + 15)
        .stroke();

      // Table rows
      let totalPrice = 0;
      order.products.forEach((prod) => {
        const productTotal = prod.quantity * prod.product.price;
        totalPrice += productTotal;
        const y = pdfDoc.y + 20;
        pdfDoc
          .fontSize(12)
          .fillColor("black")
          .text(prod.product.title, 50, y)
          .text(prod.quantity, 250, y)
          .text(`$${prod.product.price.toFixed(2)}`, 350, y)
          .text(`$${productTotal.toFixed(2)}`, 475, y)
          .moveDown();

        // Underline rows
        pdfDoc
          .moveTo(50, pdfDoc.y + 5)
          .lineTo(550, pdfDoc.y + 5)
          .stroke();
      });

      //Calculate Delivery Fees
      const deliveryFee = totalPrice * 0.1;
      const finalTotal = totalPrice + deliveryFee;

      pdfDoc.moveDown();
      const totalPriceY = pdfDoc.y + 20;
      pdfDoc
        .fontSize(14)
        .fillColor("black")
        .text("Total Price:", 350, totalPriceY)
        .text(`$${totalPrice.toFixed(2)}`, 450, totalPriceY, {
          align: "center",
        });
      pdfDoc.moveDown();
      const deliveryFeeY = pdfDoc.y + 20;
      pdfDoc
        .fontSize(14)
        .fillColor("black")
        .text("Delivery Fee (10%):", 350, deliveryFeeY)
        .text(`$${deliveryFee.toFixed(2)}`, 450, deliveryFeeY, {
          align: "center",
        });

      pdfDoc.moveDown();
      const finalTotalY = pdfDoc.y + 20;
      pdfDoc
        .fontSize(14)
        .fillColor("black")
        .text("Final Total:", 350, finalTotalY)
        .text(`$${finalTotal.toFixed(2)}`, 450, finalTotalY, {
          align: "center",
        });

      // Footer
      pdfDoc.moveDown();
      pdfDoc
        .fontSize(10)
        .fillColor("gray")
        .text("Thank you for your business!", { align: "center" })
        .moveDown();
      pdfDoc
        .fontSize(10)
        .fillColor("gray")
        .text("City Website: www.fashion.com", { align: "center" })
        .text("Email: admin@123.com", { align: "center" })
        .text("Phone: 09-970989566", { align: "center" })
        .text("Address: 966A Bayint Naung Rd, Yangon", { align: "center" });

      pdfDoc.end();
      //Invoice
      // exports.getInvoice = (req, res, next) => {
      //   const orderId = req.params.orderId;
      //   Order.findById(orderId)
      //     .then((order) => {
      //       if (!order) {
      //         return next(new Error("No Order Found"));
      //       }
      //       if (order.user.userId.toString() !== req.user._id.toString()) {
      //         return next(new Error("Unathorized"));
      //       }
      //       const invoiceName = "invoice-" + orderId + ".pdf";
      //       const invoicePath = path.join("data", "invoices", invoiceName);
      //       //pdfKit
      //       const pdfDoc = new PDFDocument();
      //       res.setHeader("Content-Type", "application/pdf");
      //       //inline(download auto) //attachement(rename file when download)
      //       res.setHeader(
      //         "Content-Disposition",
      //         'inline; filename="' + invoiceName + '"'
      //       );
      //       pdfDoc.pipe(fs.createWriteStream(invoicePath));
      //       pdfDoc.pipe(res);
      //       pdfDoc.fontSize(26).text("INVOICE", { underline: true });
      //       pdfDoc.text("-----------------------------");
      //       let totalprice = 0;
      //       order.products.forEach((prod) => {
      //         totalprice += prod.quantity * prod.product.price;
      //         pdfDoc
      //           .fontSize(14)
      //           .text(
      //             prod.product.title +
      //               " - " +
      //               prod.quantity +
      //               "x" +
      //               "$" +
      //               prod.product.price
      //           );
      //       });
      //       pdfDoc.text("-----------------------------");
      //       pdfDoc.fontSize(20).text("Total Price :" + totalprice);
      //       pdfDoc.end();

      // fs.readFile(invoicePath, (err, data) => {
      //   if (err) {
      //     return next(err);
      //   }
      //   res.setHeader("Content-Type", "application/pdf");
      //   //inline(download auto) //attachement(rename file when download)
      //   res.setHeader('Content-Disposition', `inline; filename="${invoiceName}"`);
      //   res.send(data);
      //});
    })
    .catch((err) => next(err));
};


