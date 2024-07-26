const mongoose = require('mongoose');
const crypto = require('crypto');

const Schema = mongoose.Schema;
const Product=require('./product')

const userSchema = new Schema({
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  role:{
    type:String,
    default: 'User'
  },
  status:{
    type:String,
    enum: ['active', 'suspend'],
    default:'suspend'
  },
  resetToken:String,
  resetTokenExpiration: Date,
  activationToken: String,
  activationExpires: Date,
  cart: {
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        quantity: { type: Number, required: true }
      }
    ]
  }
});

userSchema.methods.addToCart = function(product,quantity) {
  const cartProductIndex = this.cart.items.findIndex(cp => {
    return cp.productId.toString() === product._id.toString();
  });
  let newQuantity = quantity;
  const updatedCartItems = [...this.cart.items];

  if (cartProductIndex >= 0) {
    newQuantity = this.cart.items[cartProductIndex].quantity + quantity;
    updatedCartItems[cartProductIndex].quantity = newQuantity;
  } else {
    updatedCartItems.push({
      productId: product._id,
      quantity: newQuantity
    });
  }
  const updatedCart = {
    items: updatedCartItems
  };
  this.cart = updatedCart;

  // Reduce the product's quantity
  product.quantity -= quantity;

  // Save both user cart and product
  return Promise.all([this.save(), product.save()]);
};

userSchema.methods.removeFromCart = function(productId) {
  const cartItem = this.cart.items.find(item => {
    return item.productId.toString() === productId.toString();
  });

  if (!cartItem) {
    return Promise.reject(new Error('Product not found in cart.'));
  }

  const updatedCartItems = this.cart.items.filter(item => {
    return item.productId.toString() !== productId.toString();
  });

  this.cart.items = updatedCartItems;

  return Product.findById(productId)
    .then(product => {
      if (!product) {
        return Promise.reject(new Error('Product not found.'));
      }

      product.quantity += cartItem.quantity;

      return Promise.all([this.save(), product.save()]);
    });
};

userSchema.methods.clearCart = function() {
  this.cart = { items: [] };
  return this.save();
};


//activate Token
userSchema.methods.generateActivationToken = function() {
  const token = crypto.randomBytes(20).toString('hex');
  this.activationToken = token;
  this.activationExpires = Date.now() + 3600000; // 1 hour
  return token;
};


module.exports = mongoose.model('User', userSchema);
