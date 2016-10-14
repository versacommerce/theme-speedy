(function() {
  'use strict';

  // shop url w/o cloudfront
  var SHOP_URL = $(document.body).data('shop-url');

  // display load time
  $(document).add('domContentLoaded', function() {
    if (!window.performance) { return; }

    var timing = window.performance.timing;
    var loadTime = timing.domContentLoadedEventEnd - timing.connectStart;
    $('#load-time').html(loadTime + '&thinsp;ms');
  });

  // sticky header
  var body = $(document.body);
  var win = $(window);
  win.scroll(function() {
    var scrollTop = body.scrollTop()
    if (scrollTop > 120) {
      body.addClass('sticky');
    } else {
      body.removeClass('sticky');
    }
  });

  // helper to format money
  var formatPrice = function(num) {
    return (num.toFixed(2) + '&nbsp;€').replace('.', ',');
  };

  // LineItem
  var LineItem = function LineItem(id) {
    this.id = id;
  };

  LineItem.create = function(id) {
    var li = new LineItem(id);
    li._init();

    return li;
  };

  LineItem.prototype = {
    _init: function() {},

    get price() {
      return this.unitPrice * this.quantity;
    },

    get unitPrice() {
      return parseFloat( this.getProperty('price') );
    },

    get title() {
      return this.getProperty('title');
    },

    get imageUrl() {
      return this.getProperty('image-url');
    },

    getProperty: function(name) {
      return $('#product-' + this.id).data(name);
    },

    quantity: 1,
    id: null
  };

  // Cart
  var Cart = {
    init: function() {
      var self = this;

      // add to cart buttons
      $('.add-to-cart').click(function() {
        var id = parseInt( $(this).data('product-id') );
        self.addItem(id);
      });

      // toggle cart button
      var cartElement = $('.cart');
      $('#toggle-cart').click(function() {
        if (self.count > 0) {
          cartElement.toggleClass('visible');
        } else {
          cartElement.removeClass('visible');
        }
      });

      // init cart in local storage
      if (!this.storage.get('cartItems')) {
        this.storage.set('cartItems', this.serializedLineItems);
      }

      this.storage.get('cartItems').forEach(function(li) {
        var id = li[0];
        var qu = li[1];

        self.addItem(id, qu);
      });
    },

    addItem: function(id, qu) {
      var lineItem = this.lineItems[id];
      var lineItemExists = (lineItem !== undefined);

      if (lineItemExists) {
        lineItem.quantity += qu || 1;
        this.onChangeItem(lineItem);
      } else {
        lineItem = LineItem.create(id)
        lineItem.quantity = qu || 1;
        this.lineItems[id] = lineItem;
        this.onCreateItem(lineItem);
      }
    },

    removeItem: function(id) {
      var lineItem = this.lineItems[id];
      this.onDestroyItem(lineItem);

      delete this.lineItems[id];

      this.onChange();
    },

    changeItemQuantityBy: function(id, dqu) {
      var lineItem = this.lineItems[id];

      if (dqu < 0 && lineItem.quantity == 1) {
        this.removeItem(lineItem.id);
        return;
      }

      lineItem.quantity += dqu;
      this.onChangeItem(lineItem);
    },

    get total() {
      var sum = 0;
      this.allLineItems.forEach(function(lineItem) {
        sum += lineItem.price;
      });

      return sum;
    },

    get count() {
      var count = 0;
      this.allLineItems.forEach(function(lineItem) {
        count += lineItem.quantity;
      });

      return count;
    },

    get serializedLineItems() {
      var data = [];
      this.allLineItems.forEach(function(lineItem) {
        data.push([lineItem.id, lineItem.quantity]);
      });

      return data;
    },

    get urlParams() {
      var params = [];
      this.allLineItems.forEach(function(lineItem) {
        params.push('products[][id]=' + lineItem.id)
        params.push('products[][quantity]=' + lineItem.quantity);
      });

      return params;
    },

    get checkoutUrl() {
      var baseUrl = SHOP_URL + '/cart/add?clear=1&return_to=' + encodeURIComponent('/checkout');

      return baseUrl + '&' + this.urlParams.join('&');
    },

    get allLineItems() {
      var self = this;
      var lineItems = [];
      Object.keys(this.lineItems).forEach(function(id) {
        var lineItem = self.lineItems[id];
        lineItems.push(lineItem);
      });

      return lineItems;
    },

    onCreateItem: function(lineItem) {
      var element = this.createLineItemElement(lineItem);
      $('.cart-items').append(element);
      $('.add-to-cart[data-product-id="' + lineItem.id + '"]').addClass('added');

      this.onChangeItem(lineItem);
      this.onChange();
    },

    onChangeItem: function(lineItem) {
      var id = 'line-item-' + lineItem.id;
      var element = $('#' + id);

      element.find('.cart-item-line-price')
        .html( formatPrice(lineItem.price) );

      element.find('.cart-item-unit-price')
        .html( formatPrice(lineItem.unitPrice) );

      element.find('.cart-item-quantity')
        .text(lineItem.quantity);

      this.onChange();
    },

    onDestroyItem: function(lineItem) {
      $('#line-item-' + lineItem.id).remove();
      $('.add-to-cart[data-product-id="' + lineItem.id + '"]').removeClass('added');
    },

    onChange: function() {
      var totalPrice = formatPrice(Cart.total);
      $('.value-cart-count').html(Cart.count);
      $('.value-cart-total-price').html(totalPrice);

      if (Cart.count === 0) {
        $('.cart').removeClass('visible');
      } else {
        $('#checkout').attr('href', this.checkoutUrl);
      }

      this.storage.set('cartItems', this.serializedLineItems);
    },

    createLineItemElement: function(lineItem) {
      var self = this;
      var item = $('<li class="cart-item" />')
        .attr('id', 'line-item-' + lineItem.id);

      var leftContainer = $('<span class="cart-left-container" />');
      var quControl = $('<div class="cart-item-quantity-control" />');

      var decreaseControl = $('<span class="cart-item-quantity-change cart-item-quantity-decrease">−</span>')
        .click(function() { self.changeItemQuantityBy(lineItem.id, -1); });
      quControl.append(decreaseControl);

      var display = $('<span class="cart-item-quantity" />');
      quControl.append(display);

      var increaseControl = $('<span class="cart-item-quantity-change cart-item-quantity-increase">+</span>')
        .click(function() { self.changeItemQuantityBy(lineItem.id, +1); });
      quControl.append(increaseControl);

      leftContainer.append(quControl);
      item.append(leftContainer);

      var image = $('<img>')
        .attr('alt', lineItem.title)
        .attr('src', lineItem.imageUrl);
      item.append(image);

      var title = $('<h4 class="cart-item-title" />')
        .text(lineItem.title);
      item.append(title);

      var rightContainer = $('<span class="cart-right-container" />');

      var linePrice = $('<span class="cart-item-line-price" />');
      rightContainer.append(linePrice);

      var unitPrice = $('<span class="cart-item-unit-price" />');
      rightContainer.append(unitPrice);

      item.append(rightContainer);

      return item;
    },

    lineItems: {},
    storage: Lost.create('speedy'),
  };

  Cart.init();
})();
