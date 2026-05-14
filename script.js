document.addEventListener("DOMContentLoaded", () => {
    let cartItems = [];
    try {
        const storedCart = localStorage.getItem('sri_cart');
        if (storedCart) cartItems = JSON.parse(storedCart);
    } catch(e) {}
    
    const cartCountElement = document.querySelector('.cart-count');
    if (cartCountElement) cartCountElement.textContent = cartItems.length;

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
                <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
                    <span class="modal-close" id="modal-close">&times;</span>
                    <div class="modal-img">
                        <img id="modal-image" src="" alt="Product">
                    </div>
                    <div class="modal-details">
                        <h2 id="modal-title">Product Title</h2>
                        <h3 class="product-price" id="modal-price">₹0</h3>
                        <p class="modal-desc" id="modal-desc">Product description goes here.</p>
                        <div style="display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;">
                            <button class="btn btn-primary add-to-cart-btn" id="modal-add-to-cart" style="flex: 1; min-width: 140px;">Add to Cart</button>
                            <button class="btn btn-primary" id="modal-proceed-checkout" style="flex: 1; background: #25D366; border-color: #25D366; min-width: 180px;">Proceed to Checkout</button>
                            <button class="btn btn-primary" id="modal-add-wishlist" style="flex: 1; background: #ff4757; border-color: #ff4757; min-width: 140px;">❤️ Wishlist</button>
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
    let offers = [];

    async function loadProducts() {
        try {
            const [resProd, resOff] = await Promise.all([
                fetch('/api/products'),
                fetch('/api/offers')
            ]);
            products = await resProd.json();
            const offersData = await resOff.json();
            if (offersData.success) {
                offers = offersData.offers;
            }
            renderAllProducts();
        } catch (error) {
            console.error('Error fetching data:', error);
            renderAllProducts();
        }
    }

    // Helper: Create product card HTML
    function createProductCard(product) {
        const inStock = product.inStock !== 0; // true unless explicitly 0
        const overlayHtml = inStock ? '' : '<div style="position: absolute; top: 10px; left: 10px; background: red; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; z-index: 10;">Out of Stock</div>';
        const imgOpacity = inStock ? '1' : '0.5';

        // Check for active offer
        let offerBadgeHtml = '';
        let displayPriceHtml = `<p class="product-price">₹${product.price}</p>`;
        let finalPrice = product.price;

        const activeOffer = offers.find(o => o.category === 'All' || o.category === product.category);
        if (activeOffer) {
            let badgeContent = `${activeOffer.title}<br><span style="font-weight: normal; font-size: 0.65rem;">${activeOffer.message}</span>`;
            
            if (activeOffer.discount && activeOffer.discount > 0) {
                finalPrice = product.price - (product.price * (activeOffer.discount / 100));
                finalPrice = Math.round(finalPrice);
                badgeContent += `<br><span style="background: white; color: #d4af37; padding: 2px 4px; border-radius: 2px; font-size: 0.7rem; font-weight: bold; margin-top: 4px; display: inline-block;">${activeOffer.discount}% OFF</span>`;
                
                displayPriceHtml = `<p class="product-price"><span style="text-decoration: line-through; color: #999; font-size: 0.9rem; margin-right: 8px;">₹${product.price}</span>₹${finalPrice}</p>`;
            }
            
            offerBadgeHtml = `<div style="position: absolute; top: 10px; right: 10px; background: #d4af37; color: #111; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.75rem; z-index: 10; max-width: 150px; text-align: right; box-shadow: 0 2px 4px rgba(0,0,0,0.2); line-height: 1.2;">${badgeContent}</div>`;
        }

        return `
            <div class="product-card" data-title="${product.title}" data-desc="${product.description}" data-price="₹${finalPrice}" data-original-price="${product.price}" data-img="${product.image}" data-instock="${inStock ? '1' : '0'}" data-discount="${activeOffer && activeOffer.discount ? activeOffer.discount : 0}" style="position: relative;">
                ${overlayHtml}
                ${offerBadgeHtml}
                <div class="product-img-wrap" style="opacity: ${imgOpacity};"><img src="${product.image}" alt="${product.title}"></div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    ${displayPriceHtml}
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
            const originalPriceStr = card.getAttribute('data-original-price');
            const discount = parseInt(card.getAttribute('data-discount')) || 0;
            const price = parseFloat(priceStr.replace('₹', ''));
            const originalPrice = originalPriceStr ? parseFloat(originalPriceStr) : price;
            const imgSrc = card.getAttribute('data-img');
            const inStock = card.getAttribute('data-instock') === '1';

            if (title && imgSrc) {
                currentSelectedProduct = { title, price, image: imgSrc };
                document.getElementById('modal-title').textContent = title;
                document.getElementById('modal-desc').textContent = desc || 'Beautifully crafted premium gift.';
                
                if (discount > 0) {
                    document.getElementById('modal-price').innerHTML = `<span style="text-decoration: line-through; color: #999; font-size: 1rem; margin-right: 10px;">₹${originalPrice}</span>₹${price} <span style="font-size: 0.9rem; color: #d4af37; margin-left: 10px;">(${discount}% OFF)</span>`;
                } else {
                    document.getElementById('modal-price').textContent = '₹' + price;
                }
                
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

                // Wishlist checks or other dynamic updates can go here
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
                localStorage.setItem('sri_cart', JSON.stringify(cartItems));
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
                localStorage.setItem('sri_cart', JSON.stringify(cartItems));
                if (cartCountElement) cartCountElement.textContent = cartItems.length;
                modalOverlay.classList.remove('active');
                const floatingCartBtn = document.querySelector('.floating-cart');
                if (floatingCartBtn) floatingCartBtn.click();
            }
        });
    }

    const modalAddWishlist = document.getElementById('modal-add-wishlist');
    if (modalAddWishlist) {
        modalAddWishlist.addEventListener('click', async () => {
            if (!currentSelectedProduct) return;
            if (!currentUser) return alert('Please login to add to wishlist.');

            try {
                const res = await fetch('/api/user/' + currentUser.id + '/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productTitle: currentSelectedProduct.title,
                        productPrice: currentSelectedProduct.price,
                        productImage: currentSelectedProduct.image
                    })
                });
                if (res.ok) {
                    alert('Added to your Wishlist!');
                    modalOverlay.classList.remove('active');
                } else {
                    alert('Failed to add to wishlist');
                }
            } catch (err) {
                alert('Error adding to wishlist');
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
                                <div style="line-height: 1.4;">UPI (GooglePay, PhonePe)</div>
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
                <div class="modal-content" style="max-width: 350px; text-align: center; flex-direction: column; padding: 1.5rem;">
                    <h2 style="margin-bottom: 0.5rem; font-size: 1.5rem;">Scan to Pay</h2>
                    <div id="qr-code-container" style="margin-bottom: 1rem; min-height: 180px; display: flex; justify-content: center; align-items: center; flex-direction: column;">
                        <img id="qr-code-img" src="" alt="Scan to Pay QR Code" style="width: 180px; height: 180px; border: 1px solid #eee; border-radius: 8px; display: none;">
                        <div id="qr-loading" style="color: var(--text-light); font-size: 0.9rem;">Generating QR code...</div>
                    </div>
                    <p style="margin-bottom: 1rem; font-weight: bold; font-size: 1.2rem; color: var(--accent-color);">Amount: <span id="qr-amount">₹0</span></p>
                    
                    <div style="margin-bottom: 1rem; text-align: left;">
                        <label style="font-size: 0.85rem; color: #333; display: block; margin-bottom: 0.3rem; font-weight: bold;">Enter 12-digit UTR / Ref No.</label>
                        <input type="text" id="upi-utr" placeholder="12-digit number" style="width: 100%; padding: 0.6rem; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-size: 0.9rem;" required minlength="12" maxlength="12">
                    </div>

                    <div style="background: #fff3f3; border: 1px solid #ffcccc; padding: 0.5rem; border-radius: 6px; margin-bottom: 1rem; text-align: left;">
                        <p style="color: #cc0000; font-size: 0.75rem; margin: 0; line-height: 1.3;">
                            ⚠️ <strong style="color: #aa0000;">Warning:</strong> Fake UTRs will result in permanent ban and order cancellation.
                        </p>
                    </div>

                    <button class="btn btn-primary" style="width: 100%; font-size: 1rem; padding: 0.8rem; background: #25D366; border-color: #25D366;" id="qr-verify-btn">Verify & Place Order</button>
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

        async function processOrder(payMethod, payTotal, utrNumber = null) {
            const originalText = document.getElementById('checkout-btn').textContent;
            document.getElementById('checkout-btn').textContent = `Processing via ${payMethod}...`;

            setTimeout(async () => {
                const orderId = 'SG-' + Math.floor(100000 + Math.random() * 900000);
                const itemTitles = cartItems.map(item => item.title);
                
                let orderMsg = `Order received with ${cartItems.length} items (${itemTitles.join(', ')}). Paid via ${payMethod}.`;

                try {
                    await fetch('/api/orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: orderId,
                            status: 'Processing',
                            message: orderMsg,
                            total: payTotal,
                            items: cartItems,
                            customerName: name,
                            address: address,
                            city: city,
                            pincode: pincode,
                            userId: currentUser ? currentUser.id : null,
                            paymentRef: utrNumber
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
                    if (qrModal) qrModal.classList.remove('active');
                    
                    document.getElementById('checkout-btn').textContent = originalText;
                    
                    if (currentUser && utrNumber) {
                        window.location.href = 'account.html';
                    }
                } catch (error) {
                    alert('Error placing order. Please try again.');
                    document.getElementById('checkout-btn').textContent = originalText;
                }
            }, 800);
        }

        if (method === 'UPI') {
            document.getElementById('qr-amount').textContent = '₹' + total;
            document.getElementById('upi-utr').value = ''; // Reset input
            
            // Generate dynamic UPI QR Code
            const upiString = `upi://pay?pa=balajisundar2296@okaxis&pn=Balaji&am=${total}&cu=INR`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiString)}`;
            
            const qrImg = document.getElementById('qr-code-img');
            const qrLoading = document.getElementById('qr-loading');
            
            qrImg.style.display = 'none';
            if (qrLoading) qrLoading.style.display = 'block';
            
            qrImg.onload = () => {
                if (qrLoading) qrLoading.style.display = 'none';
                qrImg.style.display = 'block';
            };
            qrImg.src = qrUrl;

            qrModal.classList.add('active');
            
            document.getElementById('qr-verify-btn').onclick = () => {
                const utr = document.getElementById('upi-utr').value.trim();
                if (utr.length < 12) {
                    alert('Please enter a valid 12-digit UTR or Reference Number from your payment app.');
                    return;
                }
                
                document.getElementById('qr-verify-btn').textContent = 'Verifying...';
                processOrder('UPI', total, utr);
            };
        } else {
            processOrder(method, total);
        }
    });
});

async function deleteProduct(id) {
    const confirmDelete = confirm("Are you sure you want to delete this product?");
    if (!confirmDelete) return;

    try {
        const res = await fetch('/api/products/' + id, {
            method: 'DELETE'
        });

        if (res.ok) {
            alert('Product deleted successfully');
            fetchAdminProducts(); // refresh table
        } else {
            alert('Failed to delete product');
        }
    } catch (error) {
        alert('Error deleting product');
    }
}
