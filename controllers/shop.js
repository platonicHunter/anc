const fs = require("fs");
const path = require("path");

const Product = require("../models/product");
const Order = require("../models/order");

const PDFDocument = require("pdfkit");
const { userInfo } = require("os");

const ITEMS_PER_PAGE = 3;

exports.getProducts = (req, res, next) => {
  Product.find({ _id: prodId, status: 1 })
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
  const errorMessage = req.flash("error")[0] || null;
  const page = +req.query.page || 1;
  const ITEMS_PER_PAGE = 10; // Define the number of items per page
  let totalItems;

  Product.find({ status: 1 ,quantity: { $gt: 0 } }) // Corrected filter condition here
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find({ status: 1 ,quantity: { $gt: 0 }}) // Corrected filter condition here
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
        errorMessage: errorMessage
      });
    })
    .catch((err) => {
      console.error(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items;

      let totalPrice = 0;

      products.forEach((p) => {
        totalPrice += p.productId.price * p.quantity;
      });
      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
        totalPrice: totalPrice,
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
  const quantity = parseInt(req.body.quantity, 10);

  if(quantity === null || undefined){
    req.flash('error', `Please Add Quantity!!`);
  }

  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        return res.status(404).send("Product not found.");
      }
      if (userId.toString() === product.userId.toString()) {
        req.flash('error', `Can't order your own product!!`);
        return res.redirect('/')
      }
      // if (product.quantity < quantity) {
      //   req.flash('error', `Only ${product.quantity} of this product is available.`);
      //   return res.redirect('/');
      // }
      return req.user.addToCart(product, quantity).then((result) => {
        console.log(result);
        res.redirect("/cart");
      });
    })
    .catch((err) => {
      console.error(err);
      req.flash('error', `Please Add Quantity!!`);
      return res.redirect('/')
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
      console.error(err);
      req.flash('error', 'An error occurred while removing the product from the cart.');
      res.redirect('/cart');
    });
};



exports.postOrder = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity , product: { ...i.productId._doc } };
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

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  console.log("OrderId", orderId);

  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        return next(new Error("No Order Found"));
      }

      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error("Unauthorized"));
      }

      // Define the invoice file name and path
      const invoiceName = "invoice-" + orderId + ".pdf";
      const invoicePath = path.join("data", "invoices", invoiceName);

      // Create a new PDF document
      const pdfDoc = new PDFDocument({ margin: 50 });

      // Set the response headers for PDF content
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${invoiceName}"`);

      // Pipe the PDF to a writable stream and to the response
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);

      // Format the date
      const formatDate = (date) => {
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, "0");
        const month = (d.getMonth() + 1).toString().padStart(2, "0");
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, "0");
        const minutes = d.getMinutes().toString().padStart(2, "0");
        const seconds = d.getSeconds().toString().padStart(2, "0");
        return `${day}-${month}-${year} /${hours}:${minutes}:${seconds}`;
      };

      // Get the formatted createdAt date
      const createdAtDate = formatDate(order.createdAt);

      // Header
      pdfDoc
        .fontSize(20)
        .fillColor("black")
        .text("Company Name", { align: "center" })
        .moveDown();

      // Invoice Title
      pdfDoc
        .fontSize(26)
        .fillColor("black")
        .text("INVOICE", { align: "center", underline: true })
        .moveDown();

      // Order details
      pdfDoc
        .fontSize(14)
        .fillColor("black")
        .text(`Order ID: ${orderId}`)
        .text(`Order Date: ${createdAtDate}`)
        .text(`User Email: ${order.user.email}`)
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

      // Calculate Delivery Fees
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

      // Finalize the PDF
      pdfDoc.end();
    })
    .catch((err) => next(err));
};
