document.addEventListener("DOMContentLoaded", () => {
    let cartItems = [];
    const cartCountElement = document.querySelector('.cart-count');

    // Auth State Handling
    const sessionId = localStorage.getItem('sri_session_id');
    let currentUser = null;

    if (sessionId) {
        fetch('/api/user/session/' + sessionId)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    currentUser = data.user;
                }
            })
            .catch(err => console.error('Session fetch error:', err));
    }

    // Create Modal Element if it doesn't exist
    if (!document.getElementById('product-modal')) {
        const modalHtml = `
            <div class="modal-overlay" id="product-modal">
                <div class="modal-content">
                    <span class="modal-close" id="modal-close">&times;</span>
                    <div class="modal-img">
                        <img id="modal-image" src="" alt="Product">
                    </div>
                    <div class="modal-details">
                        <h2 id="modal-title">Product Title</h2>
                        <h3 class="product-price" id="modal-price">₹0</h3>
                        <p class="modal-desc" id="modal-desc">Product description goes here.</p>
                        <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                            <button class="btn btn-primary add-to-cart-btn" id="modal-add-to-cart" style="flex: 1;">Add to Cart</button>
                            <button class="btn btn-primary" id="modal-proceed-checkout" style="flex: 1; background: #25D366; border-color: #25D366;">Proceed to Checkout</button>
                        </div>
                        <div id="reviews-section" style="border-top: 1px solid #eaeaea; padding-top: 1.5rem;">
                            <h3>Customer Reviews</h3>
                            <div id="reviews-list" style="margin-bottom: 1.5rem; max-height: 200px; overflow-y: auto;">
                                <p style="color: var(--text-light);">Loading reviews...</p>
                            </div>
                            <form id="add-review-form" style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <h4 style="margin:0;">Write a Review</h4>
                                <select id="review-rating" required style="padding: 0.5rem; border-radius: 4px; border: 1px solid #ccc;">
                                    <option value="5">⭐⭐⭐⭐⭐ - Excellent</option>
                                    <option value="4">⭐⭐⭐⭐ - Good</option>
                                    <option value="3">⭐⭐⭐ - Average</option>
                                    <option value="2">⭐⭐ - Poor</option>
                                    <option value="1">⭐ - Terrible</option>
                                </select>
                                <textarea id="review-comment" rows="2" placeholder="Your review..." required style="padding: 0.5rem; border-radius: 4px; border: 1px solid #ccc; font-family: inherit;"></textarea>
                                <button type="submit" class="btn btn-primary" style="padding: 0.5rem;">Submit Review</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    const modalOverlay = document.getElementById('product-modal');
    const modalClose = document.getElementById('modal-close');
    const modalAddToCart = document.getElementById('modal-add-to-cart');

    // DYNAMIC RENDERING FROM API
    let products = [];

    async function loadProducts() {
        try {
            const res = await fetch('/api/products');
            products = await res.json();
            renderAllProducts();
        } catch (error) {
            console.error('Error fetching products:', error);
            renderAllProducts();
        }
    }

    // Helper: Create product card HTML
    function createProductCard(product) {
        const inStock = product.inStock !== 0; // true unless explicitly 0
        const overlayHtml = inStock ? '' : '<div style="position: absolute; top: 10px; left: 10px; background: red; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; z-index: 10;">Out of Stock</div>';
        const imgOpacity = inStock ? '1' : '0.5';

        return `
            <div class="product-card" data-title="${product.title}" data-desc="${product.description}" data-price="₹${product.price}" data-img="${product.image}" data-instock="${inStock ? '1' : '0'}" style="position: relative;">
                ${overlayHtml}
                <div class="product-img-wrap" style="opacity: ${imgOpacity};"><img src="${product.image}" alt="${product.title}"></div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    <p class="product-price">₹${product.price}</p>
                </div>
            </div>
        `;
    }

    function renderAllProducts() {
        // Home Page Rendering
        const homeGrid = document.getElementById('home-products-grid');
        if (homeGrid) {
            homeGrid.innerHTML = '';
            if (products.length === 0) {
                homeGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: var(--text-light);">No products available. Add some from the Admin Dashboard.</p>';
            } else {
                // Show only first 6 products for home page as 'Popular'
                products.slice(0, 6).forEach(product => {
                    homeGrid.insertAdjacentHTML('beforeend', createProductCard(product));
                });
            }
        }

        // Products Page Rendering
        function renderCategoryGrid(gridId, category) {
            const grid = document.getElementById(gridId);
            if (!grid) return;
            grid.innerHTML = '';
            const catProducts = products.filter(p => p.category === category);
            if (catProducts.length === 0) {
                grid.innerHTML = '<p style="grid-column: 1/-1; color: var(--text-light);">No products in this category yet.</p>';
            } else {
                catProducts.forEach(product => {
                    grid.insertAdjacentHTML('beforeend', createProductCard(product));
                });
            }
        }

        if (document.getElementById('products-page-marker')) {
            renderCategoryGrid('grid-personalized', 'Personalized');
            renderCategoryGrid('grid-keychains', 'Keychains');
            renderCategoryGrid('grid-3d', '3D Printed');
            renderCategoryGrid('grid-frames', 'Frames');
        }

        // Category Page Rendering
        const categoryGrid = document.getElementById('category-grid');
        if (categoryGrid) {
            categoryGrid.innerHTML = '';
            const params = new URLSearchParams(window.location.search);
            const cat = params.get('cat');

            let displayProducts = products;
            if (cat) {
                displayProducts = products.filter(p => p.category === cat || (cat === 'Personalized' && p.category === 'Personalized Gifts')); // Handle slight mismatches just in case
            }

            if (displayProducts.length === 0) {
                categoryGrid.innerHTML = '<p style="grid-column: 1/-1; color: var(--text-light); text-align: center;">No products found in this category.</p>';
            } else {
                displayProducts.forEach(product => {
                    categoryGrid.insertAdjacentHTML('beforeend', createProductCard(product));
                });
            }
        }
    }

    loadProducts();

    let currentSelectedProduct = null;

    // Event Delegation for clicking on dynamic product cards
    document.body.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (card && modalOverlay) {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;

            const title = card.getAttribute('data-title');
            const desc = card.getAttribute('data-desc');
            const priceStr = card.getAttribute('data-price');
            const price = parseFloat(priceStr.replace('₹', ''));
            const imgSrc = card.getAttribute('data-img');
            const inStock = card.getAttribute('data-instock') === '1';

            if (title && imgSrc) {
                currentSelectedProduct = { title, price, image: imgSrc };
                document.getElementById('modal-title').textContent = title;
                document.getElementById('modal-desc').textContent = desc || 'Beautifully crafted premium gift.';
                document.getElementById('modal-price').textContent = '₹' + price;
                document.getElementById('modal-image').src = imgSrc;

                const proceedBtn = document.getElementById('modal-proceed-checkout');
                if (inStock) {
                    modalAddToCart.disabled = false;
                    modalAddToCart.textContent = 'Add to Cart';
                    modalAddToCart.style.opacity = '1';
                    if (proceedBtn) { proceedBtn.disabled = false; proceedBtn.style.opacity = '1'; }
                } else {
                    modalAddToCart.disabled = true;
                    modalAddToCart.textContent = 'Out of Stock';
                    modalAddToCart.style.opacity = '0.5';
                    if (proceedBtn) { proceedBtn.disabled = true; proceedBtn.style.opacity = '0.5'; }
                }

                modalOverlay.classList.add('active');

                // Fetch reviews
                const reviewsList = document.getElementById('reviews-list');
                reviewsList.innerHTML = '<p style="color: var(--text-light);">Loading reviews...</p>';
                fetch('/api/reviews/' + encodeURIComponent(title))
                    .then(res => res.json())
                    .then(data => {
                        if (data.length === 0) {
                            reviewsList.innerHTML = '<p style="color: var(--text-light);">No reviews yet. Be the first to review!</p>';
                        } else {
                            reviewsList.innerHTML = data.map(r => `
                                <div style="margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">
                                    <div style="font-weight: bold;">${r.userName || 'Guest'} <span style="color: #f39c12;">${'⭐'.repeat(r.rating)}</span></div>
                                    <div style="color: #555; font-size: 0.95rem; margin-top: 0.2rem;">${r.comment}</div>
                                </div>
                            `).join('');
                        }
                    })
                    .catch(() => {
                        reviewsList.innerHTML = '<p style="color: red;">Failed to load reviews.</p>';
                    });
            }
        }
    });

    if (modalClose) {
        modalClose.addEventListener('click', () => {
            modalOverlay.classList.remove('active');
        });
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('active');
            }
        });
    }

    if (modalAddToCart) {
        modalAddToCart.addEventListener('click', () => {
            if (currentSelectedProduct) {
                cartItems.push(currentSelectedProduct);
                if (cartCountElement) cartCountElement.textContent = cartItems.length;

                // Button animation
                const originalText = modalAddToCart.textContent;
                modalAddToCart.textContent = "Added to Cart!";
                modalAddToCart.style.backgroundColor = "#25D366";

                setTimeout(() => {
                    modalAddToCart.textContent = originalText;
                    modalAddToCart.style.backgroundColor = "";
                    modalOverlay.classList.remove('active');
                }, 1000);
            }
        });
    }

    const modalProceedCheckout = document.getElementById('modal-proceed-checkout');
    if (modalProceedCheckout) {
        modalProceedCheckout.addEventListener('click', () => {
            if (currentSelectedProduct) {
                cartItems.push(currentSelectedProduct);
                if (cartCountElement) cartCountElement.textContent = cartItems.length;
                modalOverlay.classList.remove('active');
                const floatingCartBtn = document.querySelector('.floating-cart');
                if (floatingCartBtn) floatingCartBtn.click();
            }
        });
    }

    const addReviewForm = document.getElementById('add-review-form');
    if (addReviewForm) {
        addReviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentSelectedProduct) return;
            const rating = parseInt(document.getElementById('review-rating').value);
            const comment = document.getElementById('review-comment').value;
            const userName = currentUser && currentUser.name ? currentUser.name : 'Guest Customer';
            const userId = currentUser ? currentUser.id : null;

            try {
                const res = await fetch('/api/reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productTitle: currentSelectedProduct.title, userId, userName, rating, comment })
                });
                if (res.ok) {
                    const reviewSection = document.getElementById('reviews-list');
                    if (reviewSection.innerHTML.includes('No reviews yet')) reviewSection.innerHTML = '';
                    reviewSection.insertAdjacentHTML('afterbegin', `
                        <div style="margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">
                            <div style="font-weight: bold;">${userName} <span style="color: #f39c12;">${'⭐'.repeat(rating)}</span></div>
                            <div style="color: #555; font-size: 0.95rem; margin-top: 0.2rem;">${comment}</div>
                        </div>
                    `);
                    addReviewForm.reset();
                } else {
                    alert('Failed to submit review');
                }
            } catch (err) {
                alert('Error submitting review');
            }
        });
    }

    // Dynamic Track Order Logic
    const trackBtn = document.getElementById('track-btn');
    const trackResult = document.getElementById('track-result');
    if (trackBtn && trackResult) {
        // OVERRIDE old logic by replacing node or cleanly overriding
        // Since event listeners append, let's make sure our button only uses this one
        // Wait, trackBtn was previously hardcoded in HTML. Replacing script handles it.
        trackBtn.replaceWith(trackBtn.cloneNode(true));
        const newTrackBtn = document.getElementById('track-btn');

        newTrackBtn.addEventListener('click', async () => {
            const input = document.getElementById('order-id').value.trim();
            if (input !== '') {
                trackResult.style.display = 'block';
                trackResult.innerHTML = `<p>Loading...</p>`;

                try {
                    const res = await fetch(`/api/orders/${input}`);
                    const data = await res.json();

                    if (data.success && data.order) {
                        trackResult.innerHTML = `<h3>Order Status: ${data.order.status}</h3><p>${data.order.message}</p>`;
                        trackResult.style.borderLeftColor = "#25D366";
                    } else {
                        trackResult.innerHTML = `<h3>Tracking Not Found</h3><p>We couldn't find an order with ID: ${input}.</p>`;
                        trackResult.style.borderLeftColor = "#ff4444";
                    }
                } catch (error) {
                    trackResult.innerHTML = `<h3>Error</h3><p>Could not fetch tracking info.</p>`;
                    trackResult.style.borderLeftColor = "#ff4444";
                }
            }
        });
    }

    // Cart Output logic implementation
    if (!document.getElementById('cart-modal')) {
        const cartHtml = `
            <div class="modal-overlay" id="cart-modal">
                <div class="modal-content" style="max-width: 500px; max-height: 90vh; overflow-y: auto; flex-direction: column; padding: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eaeaea; padding-bottom: 1rem;">
                        <h2 style="margin: 0; font-size: 1.8rem;">Your Cart</h2>
                        <span class="modal-close" id="cart-close" style="position: static; font-size: 2rem; margin-top: -10px;">&times;</span>
                    </div>
                    <div id="cart-items-container" style="padding: 1rem 0; min-height: 50px;">
                        <p style="text-align: center; color: var(--text-light);">Your cart is currently empty.</p>
                    </div>
                    <div style="border-top: 1px solid #eaeaea; padding-top: 1.5rem;">
                        <h3 style="margin-bottom: 1rem; font-size: 1.25rem;">Delivery Address</h3>
                        <div style="display: flex; flex-direction: column; gap: 0.8rem; margin-bottom: 2rem;">
                            <input type="text" id="checkout-name" placeholder="Full Name" style="padding: 0.8rem; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;" required>
                            <input type="text" id="checkout-address" placeholder="Street Address" style="padding: 0.8rem; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;" required>
                            <div style="display: flex; gap: 1rem;">
                                <input type="text" id="checkout-city" placeholder="City" style="padding: 0.8rem; border: 1px solid #ccc; border-radius: 6px; flex: 1; box-sizing: border-box;" required>
                                <input type="text" id="checkout-pincode" placeholder="Pincode" style="padding: 0.8rem; border: 1px solid #ccc; border-radius: 6px; flex: 1; box-sizing: border-box;" required>
                            </div>
                        </div>
                        <h3 style="margin-bottom: 1rem; font-size: 1.25rem;">Payment Method</h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; font-size: 1.1rem;">
                            <label style="cursor: pointer; display: flex; align-items: center; gap: 0.8rem;">
                                <input type="radio" name="payment" value="UPI" checked style="transform: scale(1.2);"> 
                                <div style="line-height: 1.4;">UPI (GooglePay, PhonePe) <br><span style="font-size: 0.95rem; color: #555;">Send payment to: <strong>9080125879</strong></span></div>
                            </label>
                            <label style="cursor: pointer; display: flex; align-items: center; gap: 0.8rem;">
                                <input type="radio" name="payment" value="Card" style="transform: scale(1.2);"> 
                                <div>Credit / Debit Card</div>
                            </label>
                            <label style="cursor: pointer; display: flex; align-items: center; gap: 0.8rem;">
                                <input type="radio" name="payment" value="Cash" style="transform: scale(1.2);"> 
                                <div>Cash on Delivery</div>
                            </label>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 1.4rem; color: var(--accent-color); border-top: 1px solid #eaeaea; padding-top: 1rem; margin-bottom: 1.5rem;">
                            <span>Total:</span><span id="cart-total-display" data-total="0">₹0</span>
                        </div>
                        <button class="btn btn-primary" style="width: 100%; font-size: 1.1rem; padding: 1rem;" id="checkout-btn">Proceed to Checkout</button>
                    </div>
                </div>
            </div>

            <!-- UPI QR Modal -->
            <div class="modal-overlay" id="qr-modal">
                <div class="modal-content" style="max-width: 400px; text-align: center; flex-direction: column; padding: 2rem;">
                    <h2 style="margin-bottom: 1rem;">Scan to Pay via UPI</h2>
                    <p style="margin-bottom: 1rem; color: var(--text-light);">Order placed! Scan using PhonePe, GooglePay, Paytm, etc. to complete your payment.</p>
                    <div id="qr-code-container" style="margin-bottom: 1.5rem;">
                        <img id="qr-code-img" src="qr-code.jpg" alt="Replace this with your actual QR code image (qr-code.jpg)" style="width: 250px; height: 250px; border: 1px solid #eee; border-radius: 8px;">
                        <p style="font-size: 0.85rem; color: #888; margin-top: 0.5rem;">(Please place your actual PhonePe QR image as 'qr-code.jpg' in the folder)</p>
                    </div>
                    <p style="margin-bottom: 1.5rem; font-weight: bold; font-size: 1.2rem;">Amount: <span id="qr-amount">₹0</span></p>
                    <button class="btn" style="width: 100%; font-size: 1.1rem; border: 1px solid var(--border-color);" id="qr-close-btn">Close</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', cartHtml);
    }

    const cartOverlay = document.getElementById('cart-modal');
    const cartClose = document.getElementById('cart-close');
    const floatingCart = document.querySelector('.floating-cart');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const qrModal = document.getElementById('qr-modal');

    if (floatingCart) {
        floatingCart.addEventListener('click', () => {
            if (cartItems.length > 0) {
                let itemsHtml = '';
                let total = 0;
                cartItems.forEach(item => {
                    itemsHtml += `<div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;"><span>${item.title}</span><span>₹${item.price}</span></div>`;
                    total += item.price;
                });
                cartItemsContainer.innerHTML = `<div style="margin-bottom: 1rem;">${itemsHtml}</div>`;
                const totalDisplay = document.getElementById('cart-total-display');
                if (totalDisplay) {
                    totalDisplay.textContent = '₹' + total;
                    totalDisplay.setAttribute('data-total', total);
                }
            } else {
                cartItemsContainer.innerHTML = `<p style="text-align: center; color: var(--text-light);">Your cart is currently empty.</p>`;
                const totalDisplay = document.getElementById('cart-total-display');
                if (totalDisplay) {
                    totalDisplay.textContent = '₹0';
                    totalDisplay.setAttribute('data-total', 0);
                }
            }

            // Auto-fill address if user is logged in
            if (currentUser) {
                document.getElementById('checkout-name').value = currentUser.name || '';
                document.getElementById('checkout-address').value = currentUser.address || '';
                document.getElementById('checkout-city').value = currentUser.city || '';
                document.getElementById('checkout-pincode').value = currentUser.pincode || '';
            }

            cartOverlay.classList.add('active');
        });
    }

    if (cartClose) {
        cartClose.addEventListener('click', () => {
            cartOverlay.classList.remove('active');
        });
    }

    if (cartOverlay) {
        cartOverlay.addEventListener('click', (e) => {
            if (e.target === cartOverlay) {
                cartOverlay.classList.remove('active');
            }
        });
    }

    document.getElementById('checkout-btn')?.addEventListener('click', () => {
        if (cartItems.length === 0) {
            alert('Your cart is empty!');
            return;
        }

        const name = document.getElementById('checkout-name').value;
        const address = document.getElementById('checkout-address').value;
        const city = document.getElementById('checkout-city').value;
        const pincode = document.getElementById('checkout-pincode').value;

        if (!name || !address || !city || !pincode) {
            alert('Please fill in all delivery address details.');
            return;
        }

        const method = document.querySelector('input[name="payment"]:checked').value;
        const total = parseFloat(document.getElementById('cart-total-display').getAttribute('data-total'));

        async function processOrder(payMethod, payTotal) {
            const originalText = document.getElementById('checkout-btn').textContent;
            document.getElementById('checkout-btn').textContent = `Processing via ${payMethod}...`;

            setTimeout(async () => {
                const orderId = 'SG-' + Math.floor(100000 + Math.random() * 900000);
                const itemTitles = cartItems.map(item => item.title);

                try {
                    await fetch('/api/orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: orderId,
                            status: 'Processing',
                            message: `Order received with ${cartItems.length} items (${itemTitles.join(', ')}). Paid via ${payMethod}.`,
                            total: payTotal,
                            items: cartItems,
                            customerName: name,
                            address: address,
                            city: city,
                            pincode: pincode,
                            userId: currentUser ? currentUser.id : null
                        })
                    });

                    // Update local currentUser object if changed
                    if (currentUser) {
                        currentUser.name = name;
                        currentUser.address = address;
                        currentUser.city = city;
                        currentUser.pincode = pincode;
                    }

                    alert(`Order placed successfully! Your Order ID is ${orderId}.`);
                    cartItems = [];
                    if (cartCountElement) cartCountElement.textContent = cartItems.length;
                    cartOverlay.classList.remove('active');
                    
                    if (payMethod === 'UPI') {
                        document.getElementById('qr-amount').textContent = '₹' + payTotal;
                        qrModal.classList.add('active');
                        document.getElementById('qr-close-btn').onclick = () => {
                            qrModal.classList.remove('active');
                        };
                    }
                    
                    document.getElementById('checkout-btn').textContent = originalText;
                } catch (error) {
                    alert('Error placing order. Please try again.');
                    document.getElementById('checkout-btn').textContent = originalText;
                }
            }, 800);
        }

        processOrder(method, total);
    });
});
