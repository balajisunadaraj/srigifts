document.addEventListener("DOMContentLoaded", () => {
    window.cartItems = [];
    try {
        const storedCart = localStorage.getItem('sri_cart');
        if (storedCart) window.cartItems = JSON.parse(storedCart);
    } catch (e) { }

    // HTML Escaping Helper to secure dynamic attributes from special characters
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    window.escapeHtml = escapeHtml;

    const cartCountElement = document.querySelector('.cart-count');
    if (cartCountElement) cartCountElement.textContent = window.cartItems.length;

    function isQuotaExceededError(error) {
        return error && (
            error.name === 'QuotaExceededError' ||
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            error.code === 22 ||
            error.code === 1014
        );
    }

    function saveCartState() {
        try {
            localStorage.setItem('sri_cart', JSON.stringify(window.cartItems));
            return true;
        } catch (err) {
            if (isQuotaExceededError(err)) {
                console.warn('Unable to save cart to localStorage, quota exceeded.', err);
                try {
                    sessionStorage.setItem('sri_cart_backup', JSON.stringify(window.cartItems));
                } catch (backupErr) {
                    console.warn('Unable to save cart backup to sessionStorage.', backupErr);
                }
                alert('Your cart could not be saved because browser storage is full. Remove items or checkout soon.');
                return false;
            }
            throw err;
        }
    }

    // Remove mobile hamburger menu and keep top nav inline on smaller screens
    const headerEl = document.querySelector('header');
    const navEl = document.querySelector('nav');
    if (headerEl && navEl) {
        // No toggle button needed for inline responsive navigation.
    }

    // Auth State Handling
    const sessionId = localStorage.getItem('sri_session_id');
    let currentUser = null;

    if (sessionId) {
        fetch('https://srigifts.onrender.com/api/user/session/' + sessionId)
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
                <div class="modal-content" style="max-height: 90vh; overflow-y: auto; padding: 2rem; max-width: 800px; width: 95%;">
                    <span class="modal-close" id="modal-close">&times;</span>
                    
                    <!-- Top Half: Product Details -->
                    <div class="modal-main-details" style="display: flex; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap;">
                        <div class="modal-img" style="flex: 0.8; min-width: 200px; max-width: 280px; height: 280px; display: flex; align-items: center; justify-content: center; margin: 0 auto; overflow: hidden; border-radius: 8px;">
                            <img id="modal-image" src="" alt="Product" style="width: 100%; height: 100%; object-fit: cover; background: #f9f9f9; border: 1px solid #eee;">
                        </div>
                        <div class="modal-details" style="flex: 1.2; min-width: 250px; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <h2 id="modal-title" style="margin-top: 0; font-size: 2rem;">Product Title</h2>
                                <h3 class="product-price" id="modal-price" style="font-size: 1.5rem; color: var(--accent-color); margin-bottom: 1rem;">₹0</h3>
                                <p class="modal-desc" id="modal-desc" style="line-height: 1.6; color: #555;">Product description goes here.</p>
                            </div>
                            <div style="display: flex; gap: 1rem; margin-top: 1.5rem; flex-wrap: wrap;">
                                <button class="btn btn-primary add-to-cart-btn" id="modal-add-to-cart" style="flex: 1; min-width: 120px;">Add to Cart</button>
                                <button class="btn btn-primary" id="modal-proceed-checkout" style="flex: 1.3; background: #25D366; border-color: #25D366; min-width: 150px;">Buy Now</button>
                                <button class="btn btn-primary" id="modal-add-wishlist" style="flex: 1; background: #ff4757; border-color: #ff4757; min-width: 120px;">❤️ Wishlist</button>
                            </div>
                        </div>
                    </div>

                    <hr style="border: 0; border-top: 1px solid #eee; margin: 2rem 0;">

                    <!-- Bottom Half: Integrated Reviews Section -->
                    <div class="modal-reviews-container">
                        <h3 style="font-size: 1.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                            <span>Customer Reviews</span>
                            <span id="modal-reviews-avg-rating" style="font-size: 1.1rem; color: #d4af37; font-weight: bold;">⭐ 0.0 (0 reviews)</span>
                        </h3>
                        
                        <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                            <!-- Reviews List -->
                            <div style="flex: 1.5; min-width: 280px;">
                                <div id="modal-reviews-list" style="max-height: 350px; overflow-y: auto; padding-right: 0.5rem; display: flex; flex-direction: column; gap: 1rem;">
                                    <p style="color: #888; font-style: italic;">Loading reviews...</p>
                                </div>
                            </div>

                            <!-- Write a Review Form -->
                            <div style="flex: 1; min-width: 250px; background: #fbfbfb; padding: 1.5rem; border-radius: 8px; border: 1px solid #f0f0f0;">
                                <h4 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem;">Write a Review</h4>
                                <form id="modal-review-form" style="display: flex; flex-direction: column; gap: 0.8rem;">
                                    <div>
                                        <label style="font-size: 0.85rem; font-weight: 600; display: block; margin-bottom: 0.3rem;">Rating</label>
                                        <div class="rating-stars-input" style="display: flex; gap: 0.3rem; font-size: 1.4rem; color: #ccc; cursor: pointer;">
                                            <span data-value="1" class="star-in">★</span>
                                            <span data-value="2" class="star-in">★</span>
                                            <span data-value="3" class="star-in">★</span>
                                            <span data-value="4" class="star-in">★</span>
                                            <span data-value="5" class="star-in">★</span>
                                        </div>
                                        <input type="hidden" id="modal-review-rating" value="0">
                                    </div>
                                    <div>
                                        <label style="font-size: 0.85rem; font-weight: 600; display: block; margin-bottom: 0.3rem;">Your Name</label>
                                        <input type="text" id="modal-review-author" placeholder="Guest" style="width: 100%; padding: 0.6rem; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-size: 0.9rem;">
                                    </div>
                                    <div>
                                        <label style="font-size: 0.85rem; font-weight: 600; display: block; margin-bottom: 0.3rem;">Comments</label>
                                        <textarea id="modal-review-comment" placeholder="Tell us what you think..." rows="3" style="width: 100%; padding: 0.6rem; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-size: 0.9rem; resize: vertical;"></textarea>
                                    </div>
                                    <div>
                                        <label style="font-size: 0.85rem; font-weight: 600; display: block; margin-bottom: 0.3rem;">Upload Photo</label>
                                        <input type="file" id="modal-review-photo" accept="image/*" style="font-size: 0.8rem; width: 100%;">
                                    </div>
                                    <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.7rem; font-size: 0.95rem;">Submit Review</button>
                                </form>
                            </div>
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

    // Home page category list
    const homeCategories = [
        { name: 'Engraving gifts', image: 'engraving gifts.png' },
        { name: 'Photo frames', image: 'Photo frames.png' },
        { name: 'Caricature', image: 'Caricature .png' },
        { name: 'Customized Water bottle', image: 'Customized Water bottle.png' },
        { name: 'Customized gifts', image: 'Customized gifts.png' },
        { name: 'Wooden Engraving', image: 'Wooden Engraving.png' },
        { name: 'Lamp gifts', image: 'Lamp gifts.png' },
        { name: 'Gifts & Toys', image: 'Gifts & Toys.png' },
        { name: 'Customized clock', image: 'Customized clock.png' },
        { name: 'MDF Items', image: 'MDF Items.png' },
        { name: 'Acrylic frame', image: 'Acrylic frame.png' },
        { name: 'Keychains', image: 'Keychains.png' },
        { name: 'Couples gifts', image: 'Couples gifts.png' },
        { name: 'Mobile customized cover', image: 'Mobile customize cover.png' },
        { name: 'Seed pencil & pen', image: 'Seed pencil & pen.png' },
        { name: 'Wallet engraving & Sketch', image: 'Wallet engraving & Sketch.png' }
    ];
    let products = [];
    let offers = [];
    let categories = [...homeCategories];
    let searchQuery = "";
    let selectedCategory = "All";

    async function loadProducts() {
        try {
            const [resProd, resOff] = await Promise.all([
                fetch('https://srigifts.onrender.com/api/products'),
                fetch('https://srigifts.onrender.com/api/offers')
            ]);
            products = await resProd.json();
            const offersData = await resOff.json();
            if (offersData.success) {
                offers = offersData.offers;
            }
            categories = [...homeCategories];
            renderAllProducts();
            renderOffers();
        } catch (error) {
            console.error('Error fetching data:', error);
            categories = [...homeCategories];
            renderAllProducts();
        }
    }

    function renderOffers() {
        const offersList = document.getElementById('home-offers-list');
        if (!offersList) return;
        offersList.innerHTML = '';

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        const activeOffers = offers.filter(offer => offer.offerDate === todayStr);

        const wrapper = offersList.closest('.offers-slideshow-wrapper');
        const prevBtn = document.getElementById('offers-prev');
        const nextBtn = document.getElementById('offers-next');
        const dotsContainer = document.getElementById('offers-dots');

        if (activeOffers.length === 0) {
            offersList.innerHTML = `
                <div class="offer-slide offer-slide-empty">
                    <div class="offer-slide-inner">
                        <div class="offer-no-active">
                            <span style="font-size: 2.5rem;">🎁</span>
                            <h3>No Active Offers Today</h3>
                            <p>Check back soon for exclusive deals and special announcements!</p>
                        </div>
                    </div>
                </div>`;
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            if (dotsContainer) dotsContainer.innerHTML = '';
            return;
        }

        if (prevBtn) prevBtn.style.display = '';
        if (nextBtn) nextBtn.style.display = '';

        activeOffers.forEach((offer, idx) => {
            const dateStr = new Date(offer.offerDate).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
            });

            let badgeHtml = '';
            if (offer.discount > 0) {
                badgeHtml = `<span class="offer-badge discount">${offer.discount}% OFF</span>`;
            } else if (offer.category === 'All' || !offer.category) {
                badgeHtml = `<span class="offer-badge announcement">Notice</span>`;
            } else {
                badgeHtml = `<span class="offer-badge seasonal">Special</span>`;
            }

            const imgHtml = offer.image
                ? `<div class="offer-slide-img"><img src="${offer.image}" alt="${escapeHtml(offer.title)}"></div>`
                : `<div class="offer-slide-img offer-slide-img-placeholder"><span>🏷️</span></div>`;

            const discountHtml = offer.discount > 0
                ? `<div class="offer-slide-discount">${offer.discount}% OFF on ${offer.category === 'All' ? 'All Products' : offer.category}</div>`
                : '';

            const slide = `
                <div class="offer-slide${idx === 0 ? ' active' : ''}" data-index="${idx}">
                    ${imgHtml}
                    <div class="offer-slide-content">
                        ${badgeHtml}
                        <h3 class="offer-slide-title">${offer.title}</h3>
                        <p class="offer-slide-message">${offer.message}</p>
                        ${discountHtml}
                        <div class="offer-slide-meta">
                            <span>For: ${offer.category === 'All' ? 'All Products' : offer.category}</span>
                            <span>${dateStr}</span>
                        </div>
                    </div>
                </div>`;
            offersList.insertAdjacentHTML('beforeend', slide);
        });

        // Build dots
        if (dotsContainer) {
            dotsContainer.innerHTML = '';
            activeOffers.forEach((_, idx) => {
                const dot = document.createElement('button');
                dot.className = 'slideshow-dot' + (idx === 0 ? ' active' : '');
                dot.setAttribute('aria-label', `Slide ${idx + 1}`);
                dot.addEventListener('click', () => goToSlide(idx));
                dotsContainer.appendChild(dot);
            });
        }

        let currentSlide = 0;
        let autoPlayTimer = null;

        function goToSlide(n) {
            const slides = offersList.querySelectorAll('.offer-slide');
            const dots = dotsContainer ? dotsContainer.querySelectorAll('.slideshow-dot') : [];
            slides.forEach(s => s.classList.remove('active'));
            dots.forEach(d => d.classList.remove('active'));
            currentSlide = (n + slides.length) % slides.length;
            slides[currentSlide].classList.add('active');
            if (dots[currentSlide]) dots[currentSlide].classList.add('active');
        }

        function startAutoPlay() {
            stopAutoPlay();
            if (activeOffers.length > 1) {
                autoPlayTimer = setInterval(() => goToSlide(currentSlide + 1), 4500);
            }
        }

        function stopAutoPlay() {
            if (autoPlayTimer) { clearInterval(autoPlayTimer); autoPlayTimer = null; }
        }

        if (prevBtn) {
            // Remove old listeners by cloning
            const newPrev = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrev, prevBtn);
            newPrev.addEventListener('click', () => { goToSlide(currentSlide - 1); stopAutoPlay(); startAutoPlay(); });
        }
        if (nextBtn) {
            const newNext = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newNext, nextBtn);
            newNext.addEventListener('click', () => { goToSlide(currentSlide + 1); stopAutoPlay(); startAutoPlay(); });
        }

        startAutoPlay();

        // Pause on hover
        if (wrapper) {
            wrapper.addEventListener('mouseenter', stopAutoPlay);
            wrapper.addEventListener('mouseleave', startAutoPlay);
        }
    }

    // Stars input interaction
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('star-in')) {
            const rating = parseInt(e.target.getAttribute('data-value'));
            document.getElementById('modal-review-rating').value = rating;
            const stars = document.querySelectorAll('.rating-stars-input .star-in');
            stars.forEach((star, idx) => {
                if (idx < rating) {
                    star.style.color = '#d4af37';
                } else {
                    star.style.color = '#ccc';
                }
            });
        }
    });

    async function fetchAndRenderReviews(productTitle) {
        const listContainer = document.getElementById('modal-reviews-list');
        const avgDisplay = document.getElementById('modal-reviews-avg-rating');
        if (!listContainer) return;

        listContainer.innerHTML = '<p style="color: #888; font-style: italic;">Loading reviews...</p>';

        try {
            const res = await fetch(`https://srigifts.onrender.com/api/reviews/${encodeURIComponent(productTitle)}`);
            const reviews = await res.json();

            if (reviews && reviews.length > 0) {
                let totalStars = 0;
                let reviewsHtml = '';

                reviews.forEach(review => {
                    totalStars += review.rating;
                    const starsHtml = '⭐'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                    const photoHtml = review.photo ? `<div style="margin-top: 0.5rem;"><img src="${review.photo}" alt="Review Photo" style="max-width: 100px; max-height: 100px; border-radius: 4px; object-fit: cover; cursor: pointer;" onclick="window.open('${review.photo}', '_blank')"></div>` : '';
                    const dateStr = new Date(review.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    });

                    reviewsHtml += `
                        <div class="review-card" style="border-bottom: 1px solid #f0f0f0; padding-bottom: 0.8rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                                <strong style="font-size: 0.95rem;">${review.userName}</strong>
                                <span style="font-size: 0.85rem; color: #888;">${dateStr}</span>
                            </div>
                            <div style="color: #d4af37; font-size: 0.85rem; margin-bottom: 0.4rem;">${starsHtml}</div>
                            <p style="margin: 0; font-size: 0.9rem; color: #444; line-height: 1.4;">${review.comment || 'No comment provided.'}</p>
                            ${photoHtml}
                        </div>
                    `;
                });

                listContainer.innerHTML = reviewsHtml;
                const avgRating = (totalStars / reviews.length).toFixed(1);
                avgDisplay.innerHTML = `⭐ ${avgRating} (${reviews.length} review${reviews.length > 1 ? 's' : ''})`;
            } else {
                listContainer.innerHTML = '<p style="color: #888; font-style: italic;">No reviews yet for this product. Be the first to write one!</p>';
                avgDisplay.innerHTML = '⭐ 0.0 (0 reviews)';
            }
        } catch (error) {
            console.error('Error fetching reviews:', error);
            listContainer.innerHTML = '<p style="color: red;">Failed to load reviews.</p>';
        }
    }

    // Review form submit event handler
    document.body.addEventListener('submit', async (e) => {
        if (e.target.id === 'modal-review-form') {
            e.preventDefault();

            if (!currentSelectedProduct) return;

            const ratingVal = parseInt(document.getElementById('modal-review-rating').value);
            if (!ratingVal || ratingVal < 1 || ratingVal > 5) {
                alert('Please select a star rating (1 to 5 stars).');
                return;
            }

            const userName = document.getElementById('modal-review-author').value.trim() || 'Guest';
            const comment = document.getElementById('modal-review-comment').value.trim();
            const photoInput = document.getElementById('modal-review-photo');

            let photoBase64 = null;
            if (photoInput && photoInput.files && photoInput.files[0]) {
                const file = photoInput.files[0];
                photoBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });
            }

            try {
                const res = await fetch('https://srigifts.onrender.com/api/reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productTitle: currentSelectedProduct.title,
                        userId: currentUser ? currentUser.id : null,
                        userName: userName,
                        rating: ratingVal,
                        comment: comment,
                        photo: photoBase64
                    })
                });

                if (res.ok) {
                    alert('Review submitted successfully!');
                    // Reload reviews list
                    fetchAndRenderReviews(currentSelectedProduct.title);
                    // Reset form
                    e.target.reset();
                    document.getElementById('modal-review-rating').value = 0;
                    document.querySelectorAll('.rating-stars-input .star-in').forEach(s => s.style.color = '#ccc');
                } else {
                    const err = await res.json();
                    alert('Failed to submit review: ' + (err.error || 'Unknown error'));
                }
            } catch (err) {
                console.error('Error submitting review:', err);
                alert('Error submitting review. Please try again.');
            }
        }
    });

    async function prefillDefaultAddress() {
        if (!currentUser) {
            const sessionId = localStorage.getItem('sri_session_id');
            if (sessionId) {
                try {
                    const sessionRes = await fetch('https://srigifts.onrender.com/api/user/session/' + sessionId);
                    const sessionData = await sessionRes.json();
                    if (sessionData.success) {
                        currentUser = sessionData.user;
                    }
                } catch (e) {
                    console.error('Session fetch error during prefill:', e);
                }
            }
        }
        if (!currentUser) return;

        try {
            const res = await fetch(`https://srigifts.onrender.com/api/user/${currentUser.id}/addresses`);
            const data = await res.json();

            if (data.success && data.addresses && data.addresses.length > 0) {
                // Find default address (isDefault === 1) with loose check
                const defAddress = data.addresses.find(addr => addr.isDefault == 1 || addr.isDefault === true || addr.isDefault == '1');

                if (defAddress) {
                    document.getElementById('checkout-name').value = defAddress.name || currentUser.name || '';
                    document.getElementById('checkout-mobile').value = defAddress.mobile || currentUser.mobile || '';
                    document.getElementById('checkout-address').value = defAddress.address || '';
                    document.getElementById('checkout-city').value = defAddress.city || '';
                    document.getElementById('checkout-pincode').value = defAddress.pincode || '';
                    return; // Address set successfully
                }
            }
        } catch (err) {
            console.error('Error pre-filling default address:', err);
        }

        // Fallback: use user profile info if no default address found
        document.getElementById('checkout-name').value = currentUser.name || '';
        document.getElementById('checkout-mobile').value = currentUser.mobile || '';
        document.getElementById('checkout-address').value = currentUser.address || '';
        document.getElementById('checkout-city').value = currentUser.city || '';
        document.getElementById('checkout-pincode').value = currentUser.pincode || '';
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

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        const activeOffer = offers.find(o => o.offerDate === todayStr && (o.category === 'All' || o.category === product.category));
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
            <div class="product-card" data-title="${escapeHtml(product.title)}" data-desc="${escapeHtml(product.description || '')}" data-price="₹${finalPrice}" data-original-price="${product.price}" data-img="${product.image}" data-category="${escapeHtml(product.category || '')}" data-instock="${inStock ? '1' : '0'}" data-discount="${activeOffer && activeOffer.discount ? activeOffer.discount : 0}" style="position: relative;">
                ${overlayHtml}
                ${offerBadgeHtml}
                <div class="product-img-wrap" style="opacity: ${imgOpacity};"><img src="${product.image}" alt="${escapeHtml(product.title)}"></div>
                <div class="product-info">
                    <h3 class="product-title">${escapeHtml(product.title)}</h3>
                    ${displayPriceHtml}
                </div>
            </div>
        `;
    }

    function shouldRedirectToWhatsapp(items) {
        if (!Array.isArray(items)) return false;
        return items.some(item => {
            const cat = String(item.category || item.title || '').toLowerCase();
            return cat.includes('personalized') || cat.includes('photo frame') || cat.includes('frames') || cat.includes('frame');
        });
    }


    const categoryNameMap = {
        'Personalized': 'Personalized Gifts',
        'Keychains': 'Premium Keychains',
        '3D Printed': '3D Printed Masterpieces',
        'Frames': 'Elegant Photo Frames'
    };

    function renderCategoryChips() {
        const chipsContainer = document.getElementById('search-category-chips');
        if (!chipsContainer) return;
        
        chipsContainer.innerHTML = '';
        
        // Add 'All Collection' chip
        const allChip = document.createElement('button');
        allChip.className = `filter-chip ${selectedCategory === 'All' ? 'active' : ''}`;
        allChip.textContent = 'All Collection';
        allChip.addEventListener('click', () => {
            selectedCategory = 'All';
            updateSelectedChip();
            filterAndRender();
        });
        chipsContainer.appendChild(allChip);
        
        categories.forEach(cat => {
            const chip = document.createElement('button');
            chip.className = `filter-chip ${selectedCategory === cat.name ? 'active' : ''}`;
            chip.textContent = cat.name;
            chip.addEventListener('click', () => {
                selectedCategory = cat.name;
                updateSelectedChip();
                filterAndRender();
            });
            chipsContainer.appendChild(chip);
        });
    }

    function updateSelectedChip() {
        const chips = document.querySelectorAll('.filter-chip');
        chips.forEach(chip => {
            if (chip.textContent === 'All Collection' && selectedCategory === 'All') {
                chip.classList.add('active');
            } else if (chip.textContent === selectedCategory) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    function renderAllProductsGrouped() {
        const dynamicContainer = document.getElementById('dynamic-categories-container');
        if (!dynamicContainer) return;

        dynamicContainer.innerHTML = '';
        categories.forEach((cat, index) => {
            const matchName = cat.name;
            const slug = String(cat.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const filtered = products.filter(p => {
                const mappedCat = categoryNameMap[p.category] || p.category;
                return p.category === matchName || mappedCat === matchName || p.category === matchName.replace(' Gifts', '').replace(' Premium', '').replace(' Elegant', '').replace(' Photo', '').replace(' Masterpieces', '').replace(' 3D Printed', '');
            });

            const bgColor = index % 2 === 1 ? 'background-color: var(--secondary-color);' : '';
            const paddingStyle = index === 0 ? 'padding-top: 2rem;' : '';

            const sectionHtml = `
                <section id="cat-${slug}" class="container" style="${bgColor} ${paddingStyle}">
                    <h2>${cat.name}</h2>
                    <div class="grid" id="grid-cat-${slug}">
                        ${filtered.length === 0
                            ? '<p style="grid-column: 1/-1; color: var(--text-light);">No products in this category yet.</p>'
                            : filtered.map(p => createProductCard(p)).join('')}
                    </div>
                </section>
            `;
            dynamicContainer.insertAdjacentHTML('beforeend', sectionHtml);
        });
    }

    function filterAndRender() {
        const dynamicContainer = document.getElementById('dynamic-categories-container');
        if (!dynamicContainer) return;

        const query = searchQuery.toLowerCase().trim();
        const categoryFilter = selectedCategory;
        const isSearching = query.length > 0 || categoryFilter !== 'All';

        const statusBar = document.getElementById('search-status-message');
        const clearBtn = document.getElementById('search-clear-btn');

        if (clearBtn) {
            clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
        }

        if (!isSearching) {
            // Restore original grouped category sections
            renderAllProductsGrouped();
            if (statusBar) statusBar.style.display = 'none';
            return;
        }

        // Filter products matching category and/or query
        const filteredProducts = products.filter(product => {
            // Category filter check
            if (categoryFilter !== 'All') {
                const mappedCat = categoryNameMap[product.category] || product.category;
                const matchesCategory = product.category === categoryFilter || 
                                       mappedCat === categoryFilter || 
                                       product.category === categoryFilter.replace(' Gifts', '').replace(' Premium', '').replace(' Elegant', '').replace(' Photo', '').replace(' Masterpieces', '').replace(' 3D Printed', '');
                if (!matchesCategory) return false;
            }

            // Search query check
            if (query.length > 0) {
                const titleMatch = (product.title || '').toLowerCase().includes(query);
                const descMatch = (product.description || '').toLowerCase().includes(query);
                const catMatch = (product.category || '').toLowerCase().includes(query);
                return titleMatch || descMatch || catMatch;
            }

            return true;
        });

        // Show search status bar with count
        if (statusBar) {
            statusBar.style.display = 'flex';
            const countText = statusBar.querySelector('.search-count-text');
            if (countText) {
                let text = '';
                if (query && categoryFilter !== 'All') {
                    text = `Found ${filteredProducts.length} gift${filteredProducts.length === 1 ? '' : 's'} matching "${searchQuery}" in ${categoryFilter}`;
                } else if (query) {
                    text = `Found ${filteredProducts.length} gift${filteredProducts.length === 1 ? '' : 's'} matching "${searchQuery}"`;
                } else {
                    text = `Showing ${filteredProducts.length} gift${filteredProducts.length === 1 ? '' : 's'} in ${categoryFilter}`;
                }
                countText.textContent = text;
            }
        }

        // Render filtered products in a unified grid
        dynamicContainer.innerHTML = '';

        if (filteredProducts.length === 0) {
            // Show beautiful "No results found" view
            const noResultsHtml = `
                <div class="search-no-results-card">
                    <div class="no-results-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="11" cy="11" r="8" stroke-dasharray="4 2"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            <line x1="11" y1="8" x2="11" y2="12" stroke-linecap="round"></line>
                            <circle cx="11" cy="14" r="0.5" fill="currentColor"></circle>
                        </svg>
                    </div>
                    <h3>No Premium Gifts Found</h3>
                    <p>We couldn't find any products matching your selection. Try a different search term or browse our categories.</p>
                    <button id="search-reset-btn" class="btn btn-primary search-reset-btn">Reset Search &amp; Filters</button>
                </div>
            `;
            dynamicContainer.innerHTML = noResultsHtml;

            // Bind click to reset button
            const resetBtn = document.getElementById('search-reset-btn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    const searchInput = document.getElementById('product-search-input');
                    if (searchInput) searchInput.value = '';
                    searchQuery = '';
                    selectedCategory = 'All';

                    updateSelectedChip();
                    filterAndRender();
                });
            }
        } else {
            // Render grid
            const gridHtml = `
                <section class="container search-results-section" style="padding-top: 1.5rem;">
                    <div class="grid search-results-grid" style="max-height: none; overflow: visible; margin-top: 1.5rem;">
                        ${filteredProducts.map(p => createProductCard(p)).join('')}
                    </div>
                </section>
            `;
            dynamicContainer.innerHTML = gridHtml;
        }
    }

    function renderAllProducts() {
        // Home Page Category Grid Rendering
        const homeCategoryGrid = document.getElementById('home-categories-grid');
        if (homeCategoryGrid) {
            homeCategoryGrid.innerHTML = '';
            categories.forEach((cat) => {
                const slug = String(cat.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const categoryBtn = document.createElement('a');
                categoryBtn.className = 'category-button';
                categoryBtn.href = `products.html?cat=${encodeURIComponent(cat.name)}#cat-${slug}`;
                categoryBtn.innerHTML = `
                    <div class="category-image-wrap">
                        <img src="${escapeHtml(cat.image)}" alt="${escapeHtml(cat.name)}">
                    </div>
                    <div class="category-label">
                        <p class="category-name">${escapeHtml(cat.name)}</p>
                    </div>
                `;
                homeCategoryGrid.appendChild(categoryBtn);
            });
        }

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
        const dynamicContainer = document.getElementById('dynamic-categories-container');
        if (dynamicContainer && document.getElementById('products-page-marker')) {
            renderCategoryChips();
            filterAndRender();

            // If there's a hash or cat query, scroll directly to that category section
            setTimeout(() => {
                const params = new URLSearchParams(window.location.search);
                const catQuery = params.get('cat');
                const hash = window.location.hash;
                let target = null;
                if (hash) target = document.querySelector(hash);
                if (!target && catQuery) {
                    const slug = String(catQuery).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    target = document.getElementById('cat-' + slug);
                }
                if (target) {
                    const y = target.getBoundingClientRect().top + window.scrollY - 80; // offset for header
                    window.scrollTo({ top: y, behavior: 'smooth' });
                    // temporary highlight to show the selected category
                    setTimeout(() => {
                        try {
                            target.classList.add('target-highlight');
                            setTimeout(() => target.classList.remove('target-highlight'), 3200);
                        } catch (e) { /* ignore if element disappears */ }
                    }, 450);
                }
            }, 120);
        }

        // Category Page Rendering
        const categoryGrid = document.getElementById('category-grid');
        if (categoryGrid) {
            categoryGrid.innerHTML = '';
            const params = new URLSearchParams(window.location.search);
            const cat = params.get('cat');

            let displayProducts = products;
            if (cat) {
                const mappedCategory = categoryNameMap[cat] || cat;
                displayProducts = products.filter(p => p.category === mappedCategory);
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

    // Initialize Search Bar Event Listeners if elements exist
    const searchInput = document.getElementById('product-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            filterAndRender();
        });
    }

    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            searchQuery = '';
            filterAndRender();
        });
    }

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
            const category = card.getAttribute('data-category') || '';
            const inStock = card.getAttribute('data-instock') === '1';

            if (title && imgSrc) {
                currentSelectedProduct = { title, price, image: imgSrc, category };
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

                // Trigger reviews fetch
                fetchAndRenderReviews(title);

                // Reset review form inputs
                const reviewForm = document.getElementById('modal-review-form');
                if (reviewForm) {
                    reviewForm.reset();
                    document.getElementById('modal-review-rating').value = 0;
                    document.querySelectorAll('.rating-stars-input .star-in').forEach(s => s.style.color = '#ccc');
                }
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
                window.cartItems.push(currentSelectedProduct);
                saveCartState();
                if (cartCountElement) cartCountElement.textContent = window.cartItems.length;

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
                window.directCheckoutItems = [currentSelectedProduct];
                window.isDirectCheckout = true;
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
                const res = await fetch('https://srigifts.onrender.com/api/user/' + currentUser.id + '/wishlist', {
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
                    const res = await fetch(`https://srigifts.onrender.com/api/orders/${input}`);
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
                <div class="modal-content" style="max-width: 500px; max-height: 85vh; overflow-y: auto; flex-direction: column; padding: 2rem; align-items: stretch;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eaeaea; padding-bottom: 1rem; flex-shrink: 0;">
                        <h2 style="margin: 0; font-size: 1.8rem;">Your Cart</h2>
                        <span class="modal-close" id="cart-close" style="position: static; font-size: 2rem; margin-top: -10px;">&times;</span>
                    </div>
                    <div id="cart-items-container" style="padding: 1rem 0; min-height: 50px; display: flex; flex-direction: column; gap: 0.5rem;">
                        <p style="text-align: center; color: var(--text-light);">Your cart is currently empty.</p>
                    </div>
                    <div style="border-top: 1px solid #eaeaea; padding-top: 1.5rem;">
                        <h3 style="margin-bottom: 1rem; font-size: 1.25rem;">Delivery Address</h3>
                        <div style="display: flex; flex-direction: column; gap: 0.8rem; margin-bottom: 2rem;">
                            <input type="text" id="checkout-name" placeholder="Full Name" style="padding: 0.8rem; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;" required>
                            <input type="tel" id="checkout-mobile" placeholder="Mobile Number" style="padding: 0.8rem; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;" required>
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
                                <div style="line-height: 1.4; font-weight: 500;">UPI (GooglePay, PhonePe, Paytm)</div>
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
                        <p style="margin-top: 0.5rem; font-weight: 600; color: #333; font-size: 0.95rem;">Bank: OKAXIS</p>
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

                    <button class="btn btn-primary" style="width: 100%; font-size: 1rem; padding: 0.8rem; background: #25D366; border-color: #25D366; margin-bottom: 0.8rem;" id="qr-verify-btn">Verify & Place Order</button>
                    <button class="btn" style="width: 100%; font-size: 1rem; padding: 0.8rem; background: transparent; border: 1px solid #ccc; color: #333;" id="qr-cancel-btn">Cancel Payment</button>
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

    const qrCancelBtn = document.getElementById('qr-cancel-btn');
    if (qrCancelBtn) {
        qrCancelBtn.addEventListener('click', () => {
            qrModal.classList.remove('active');
            document.getElementById('checkout-btn').textContent = 'Proceed to Checkout'; // Reset checkout button text
        });
    }

    window.openCart = () => {
        if (window.cartItems.length > 0) {
            let itemsHtml = '';
            let total = 0;
            window.cartItems.forEach((item, index) => {
                itemsHtml += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span>${item.title}</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span>₹${item.price}</span>
                        <button class="btn-small" style="color: red; padding: 2px 6px; font-weight: bold; border: 1px solid red; background: transparent; cursor: pointer;" onclick="window.removeCartItem(${index})">X</button>
                    </div>
                </div>`;
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
        prefillDefaultAddress();

        cartOverlay.classList.add('active');
    };

    window.removeCartItem = (index) => {
        window.cartItems.splice(index, 1);
        saveCartState();
        if (cartCountElement) cartCountElement.textContent = window.cartItems.length;
        window.openCart(); // refresh the view
    };

    window.triggerDirectCheckout = (items) => {
        window.directCheckoutItems = items;
        window.isDirectCheckout = true;

        let itemsHtml = '';
        let total = 0;
        items.forEach((item) => {
            itemsHtml += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span>${item.title}</span>
                <span>₹${item.price}</span>
            </div>`;
            total += item.price;
        });
        cartItemsContainer.innerHTML = `<div style="margin-bottom: 1rem;">${itemsHtml}</div>`;
        const totalDisplay = document.getElementById('cart-total-display');
        if (totalDisplay) {
            totalDisplay.textContent = '₹' + total;
            totalDisplay.setAttribute('data-total', total);
        }

        // Auto-fill address if user is logged in
        prefillDefaultAddress();

        cartOverlay.classList.add('active');
    };

    if (floatingCart) {
        floatingCart.addEventListener('click', () => {
            window.isDirectCheckout = false;
            window.openCart();
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
        const checkoutItemsList = window.isDirectCheckout ? window.directCheckoutItems : window.cartItems;
        if (!checkoutItemsList || checkoutItemsList.length === 0) {
            alert('Your cart is empty!');
            return;
        }

        const name = document.getElementById('checkout-name').value;
        const mobile = document.getElementById('checkout-mobile').value;
        const address = document.getElementById('checkout-address').value;
        const city = document.getElementById('checkout-city').value;
        const pincode = document.getElementById('checkout-pincode').value;

        if (!name || !mobile || !address || !city || !pincode) {
            alert('Please fill in all delivery and contact details.');
            return;
        }

        const method = document.querySelector('input[name="payment"]:checked').value;
        const total = parseFloat(document.getElementById('cart-total-display').getAttribute('data-total'));

        async function processOrder(payMethod, payTotal, utrNumber = null) {
            const originalText = document.getElementById('checkout-btn').textContent;
            document.getElementById('checkout-btn').textContent = `Processing via ${payMethod}...`;

            setTimeout(async () => {
                const orderId = 'SG-' + Math.floor(100000 + Math.random() * 900000);
                const itemTitles = checkoutItemsList.map(item => item.title);

                let orderMsg = `Order received with ${checkoutItemsList.length} items (${itemTitles.join(', ')}). Paid via ${payMethod}.`;

                try {
                    const res = await fetch('https://srigifts.onrender.com/api/orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: orderId,
                            status: 'Processing',
                            message: orderMsg,
                            total: payTotal,
                            items: checkoutItemsList,
                            customerName: name,
                            mobile: mobile,
                            address: address,
                            city: city,
                            pincode: pincode,
                            userId: currentUser ? currentUser.id : null,
                            paymentRef: utrNumber
                        })
                    });

                    if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData.error || 'Server returned non-OK status');
                    }

                    // Update local currentUser object if changed
                    if (currentUser) {
                        currentUser.name = name;
                        currentUser.address = address;
                        currentUser.city = city;
                        currentUser.pincode = pincode;
                    }

                    alert(`Order placed successfully! Your Order ID is ${orderId}.`);
                    if (!window.isDirectCheckout) {
                        window.cartItems = [];
                        saveCartState();
                        if (cartCountElement) cartCountElement.textContent = window.cartItems.length;
                    }
                    cartOverlay.classList.remove('active');
                    if (qrModal) qrModal.classList.remove('active');

                    document.getElementById('checkout-btn').textContent = originalText;
                    const qrVerifyBtn = document.getElementById('qr-verify-btn');
                    if (qrVerifyBtn) qrVerifyBtn.textContent = 'Verify & Place Order';

                    const checkoutItems = window.isDirectCheckout ? window.directCheckoutItems : window.cartItems;
                    if (shouldRedirectToWhatsapp(checkoutItems)) {
                        const whatsappMessage = encodeURIComponent('Order ID : (Your id (Enter your order id here), i want my gift with this (photo/name) :');
                        window.location.href = `https://wa.me/919080125879?text=${whatsappMessage}`;
                    }
                } catch (error) {
                    alert('Error placing order. Please try again.');
                    document.getElementById('checkout-btn').textContent = originalText;
                    const qrVerifyBtn = document.getElementById('qr-verify-btn');
                    if (qrVerifyBtn) qrVerifyBtn.textContent = 'Verify & Place Order';
                }
            }, 800);
        }

        if (method === 'UPI') {
            document.getElementById('qr-amount').textContent = '₹' + total;
            document.getElementById('upi-utr').value = ''; // Reset input

            // Generate dynamic UPI QR Code
            const upiString = `upi://pay?pa=priyadharshinisuriyan@okaxis&pn=SriGifts&am=${total}&cu=INR`;
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
        const res = await fetch('https://srigifts.onrender.com/api/products/' + id, {
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

