/* ========= CART SYSTEM ========= */
let cart = JSON.parse(localStorage.getItem("cart") || "[]");

function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartBubble();
}

function updateCartBubble() {
    const bubble = document.getElementById("cart-bubble");
    if (bubble) bubble.innerText = cart.length;
}

function addToCart(item) {
    cart.push(item);
    saveCart();
}

/* ========= PRODUCT LIST (index.html) ========= */
async function loadProducts() {
    updateCartBubble();
    const container = document.getElementById("products");
    
    try {
        const list = await fetch("products_list.json").then(r => r.json());
        
        if (list.length === 0) {
            container.innerHTML = '<div class="no-products">No products available yet.</div>';
            return;
        }

        for (let file of list) {
            try {
                const data = await fetch("products/" + file).then(r => r.json());

                // Check if product has multiple price points
                let hasMultiplePrices = false;
                let displayPrice = data.final_price;
                
                if (data.colors && data.colors.length > 1) {
                    // Get all unique prices from colors
                    const uniquePrices = [...new Set(data.colors.map(c => c.final_price).filter(p => p !== null))];
                    hasMultiplePrices = uniquePrices.length > 1;
                    
                    if (hasMultiplePrices) {
                        // Get lowest price
                        const lowestPrice = Math.min(...uniquePrices);
                        displayPrice = `Starting from ${lowestPrice} RON`;
                    }
                }

                const card = document.createElement("div");
                card.className = "product-card";
                card.onclick = () => window.location = "product.html?id=" + file;

                const priceClass = hasMultiplePrices ? 'product-price starting-from' : 'product-price';
                card.innerHTML = `
                    <img src="${data.cover_image}">
                    <div class="product-title">${data.title}</div>
                    <div class="product-rating" id="rating-${file}"></div>
                    <div class="product-price">${data.final_price} RON</div>
                `;

                container.appendChild(card);
                loadProductCardReviews(file, document.getElementById(`rating-${file}`));
                
            } catch (error) {
                console.error(`Error loading product ${file}:`, error);
                // Continue with next product
            }
        }
        
    } catch (error) {
        console.error("Error loading products:", error);
        container.innerHTML = '<div class="error-message">Error loading products. Please try again.</div>';
    }
}

/* ========= QC IMAGE CAROUSEL ========= */
let currentQcIndex = 0;
let zoomLevel = 1;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let currentTransformX = 0;
let currentTransformY = 0;

function createQCCarousel(qcImages) {
    if (!qcImages || qcImages.length === 0) return '';
    
    return `
        <div class="qc-section">
            <h4>Quality Check Images</h4>
            <div class="qc-carousel-container">
                <button class="qc-arrow qc-arrow-left" onclick="qcPrev()">‹</button>
                <div class="qc-carousel">
                    ${qcImages.map((img, index) => `
                        <div class="qc-slide ${index === 0 ? 'active' : ''}" onclick="openQCFullscreen(${index})">
                            <img src="${img}" alt="QC Image ${index + 1}" loading="lazy">
                            <div class="qc-overlay">Click to view fullscreen</div>
                        </div>
                    `).join('')}
                </div>
                <button class="qc-arrow qc-arrow-right" onclick="qcNext()">›</button>
            </div>
            <div class="qc-dots">
                ${qcImages.map((_, index) => `
                    <span class="qc-dot ${index === 0 ? 'active' : ''}" onclick="qcGoTo(${index})"></span>
                `).join('')}
            </div>
        </div>
        
        <!-- Fullscreen QC Modal -->
        <div id="qc-modal" class="qc-modal" onclick="closeQCFullscreen()">
            <div class="qc-modal-content" onclick="event.stopPropagation();">
                <button class="qc-modal-close" onclick="closeQCFullscreen()">×</button>
                <button class="qc-modal-zoom-in" onclick="zoomIn()">+</button>
                <button class="qc-modal-zoom-out" onclick="zoomOut()">-</button>
                <button class="qc-modal-reset" onclick="resetZoom()">⟳</button>
                
                <div class="qc-modal-nav">
                    <button class="qc-modal-prev" onclick="qcModalPrev(event)">‹</button>
                    <div class="qc-modal-counter"></div>
                    <button class="qc-modal-next" onclick="qcModalNext(event)">›</button>
                </div>
                
                <div class="qc-modal-image-container">
                    <img id="qc-modal-image" src="" alt="QC Image" 
                         onmousedown="startDrag(event)" 
                         onmousemove="doDrag(event)" 
                         onmouseup="endDrag()" 
                         onmouseleave="endDrag()"
                         ontouchstart="startDragTouch(event)"
                         ontouchmove="doDragTouch(event)"
                         ontouchend="endDrag()">
                </div>
            </div>
        </div>
    `;
}

function qcPrev() {
    const slides = document.querySelectorAll('.qc-slide');
    const dots = document.querySelectorAll('.qc-dot');
    
    if (slides.length === 0) return;
    
    slides[currentQcIndex].classList.remove('active');
    dots[currentQcIndex].classList.remove('active');
    
    currentQcIndex = (currentQcIndex - 1 + slides.length) % slides.length;
    
    slides[currentQcIndex].classList.add('active');
    dots[currentQcIndex].classList.add('active');
    
    // Scroll carousel
    const carousel = document.querySelector('.qc-carousel');
    if (carousel) {
        const slideWidth = slides[0].offsetWidth;
        carousel.scrollLeft = currentQcIndex * slideWidth;
    }
}

function qcNext() {
    const slides = document.querySelectorAll('.qc-slide');
    const dots = document.querySelectorAll('.qc-dot');
    
    if (slides.length === 0) return;
    
    slides[currentQcIndex].classList.remove('active');
    dots[currentQcIndex].classList.remove('active');
    
    currentQcIndex = (currentQcIndex + 1) % slides.length;
    
    slides[currentQcIndex].classList.add('active');
    dots[currentQcIndex].classList.add('active');
    
    // Scroll carousel
    const carousel = document.querySelector('.qc-carousel');
    if (carousel) {
        const slideWidth = slides[0].offsetWidth;
        carousel.scrollLeft = currentQcIndex * slideWidth;
    }
}

function qcGoTo(index) {
    const slides = document.querySelectorAll('.qc-slide');
    const dots = document.querySelectorAll('.qc-dot');
    
    if (slides.length === 0) return;
    
    slides[currentQcIndex].classList.remove('active');
    dots[currentQcIndex].classList.remove('active');
    
    currentQcIndex = index;
    
    slides[currentQcIndex].classList.add('active');
    dots[currentQcIndex].classList.add('active');
    
    // Scroll carousel
    const carousel = document.querySelector('.qc-carousel');
    if (carousel) {
        const slideWidth = slides[0].offsetWidth;
        carousel.scrollLeft = currentQcIndex * slideWidth;
    }
}

function openQCFullscreen(index) {
    const modal = document.getElementById('qc-modal');
    const modalImage = document.getElementById('qc-modal-image');
    const counter = document.querySelector('.qc-modal-counter');
    const data = window.currentProductData || {};
    
    if (!data.qc_images || data.qc_images.length === 0) return;
    
    currentQcIndex = index;
    zoomLevel = 1;
    currentTransformX = 0;
    currentTransformY = 0;
    
    modalImage.src = data.qc_images[currentQcIndex];
    modalImage.style.transform = `scale(1) translate(0px, 0px)`;
    
    counter.textContent = `${currentQcIndex + 1} / ${data.qc_images.length}`;
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Prevent background scrolling
    document.addEventListener('wheel', preventScroll, { passive: false });
}

function closeQCFullscreen() {
    const modal = document.getElementById('qc-modal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // Re-enable scrolling
    document.removeEventListener('wheel', preventScroll);
}

function preventScroll(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
}

function qcModalPrev(e) {
    e.stopPropagation();
    const data = window.currentProductData || {};
    if (!data.qc_images) return;
    
    currentQcIndex = (currentQcIndex - 1 + data.qc_images.length) % data.qc_images.length;
    updateModalImage();
}

function qcModalNext(e) {
    e.stopPropagation();
    const data = window.currentProductData || {};
    if (!data.qc_images) return;
    
    currentQcIndex = (currentQcIndex + 1) % data.qc_images.length;
    updateModalImage();
}

function updateModalImage() {
    const modalImage = document.getElementById('qc-modal-image');
    const counter = document.querySelector('.qc-modal-counter');
    const data = window.currentProductData || {};
    
    if (!data.qc_images) return;
    
    zoomLevel = 1;
    currentTransformX = 0;
    currentTransformY = 0;
    
    modalImage.src = data.qc_images[currentQcIndex];
    modalImage.style.transform = `scale(${zoomLevel}) translate(${currentTransformX}px, ${currentTransformY}px)`;
    
    counter.textContent = `${currentQcIndex + 1} / ${data.qc_images.length}`;
}

function zoomIn() {
    zoomLevel = Math.min(zoomLevel + 0.5, 5);
    updateZoom();
}

function zoomOut() {
    zoomLevel = Math.max(zoomLevel - 0.5, 0.5);
    updateZoom();
}

function resetZoom() {
    zoomLevel = 1;
    currentTransformX = 0;
    currentTransformY = 0;
    updateZoom();
}

function updateZoom() {
    const modalImage = document.getElementById('qc-modal-image');
    modalImage.style.transform = `scale(${zoomLevel}) translate(${currentTransformX}px, ${currentTransformY}px)`;
}

function startDrag(e) {
    isDragging = true;
    dragStartX = e.clientX - currentTransformX;
    dragStartY = e.clientY - currentTransformY;
    e.preventDefault();
}

function startDragTouch(e) {
    if (e.touches.length === 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX - currentTransformX;
        dragStartY = e.touches[0].clientY - currentTransformY;
        e.preventDefault();
    }
}

function doDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    currentTransformX = e.clientX - dragStartX;
    currentTransformY = e.clientY - dragStartY;
    
    const modalImage = document.getElementById('qc-modal-image');
    modalImage.style.transform = `scale(${zoomLevel}) translate(${currentTransformX}px, ${currentTransformY}px)`;
}

function doDragTouch(e) {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    
    currentTransformX = e.touches[0].clientX - dragStartX;
    currentTransformY = e.touches[0].clientY - dragStartY;
    
    const modalImage = document.getElementById('qc-modal-image');
    modalImage.style.transform = `scale(${zoomLevel}) translate(${currentTransformX}px, ${currentTransformY}px)`;
}

function endDrag() {
    isDragging = false;
}

/* ========= SINGLE PRODUCT (product.html) ========= */
async function loadProductPage() {
    updateCartBubble();
    const params = new URLSearchParams(location.search);
    const file = params.get("id");

    const data = await fetch("products/" + file).then(r => r.json());
    window.currentProductData = data; // Store for QC modal
    
    const container = document.getElementById("product-container");

    // Check if product has multiple price points
    const hasMultiplePrices = data.colors && data.colors.length > 1 && 
        new Set(data.colors.map(c => c.final_price)).size > 1;
    
    // Get the lowest price for "Starting from" display
    const allPrices = data.colors.map(c => c.final_price).filter(p => p !== null);
    const lowestPrice = allPrices.length > 0 ? Math.min(...allPrices) : data.final_price;

    // defaults
    let selectedColor = data.colors?.[0]?.name || null;
    let selectedSize = data.colors?.[0]?.sizes?.[0] || null;
    let currentPrice = data.colors?.[0]?.final_price || data.final_price;

    container.innerHTML = `
        <div class="product-detail">
            <img id="main-img" src="${data.cover_image}">
            <h2>${data.title}</h2>
            <h3 id="price">${hasMultiplePrices ? `Starting from ${lowestPrice} RON` : `${currentPrice} RON`}</h3>

            ${data.colors && data.colors.length > 1 ? `
            <h4>Color</h4>
            <div id="color-options" class="variant-list"></div>
            ` : ''}

            ${data.sizes && data.sizes.length > 0 ? `
            <h4>Size</h4>
            <div id="size-options" class="size-list"></div>
            ` : ''}

            <a id="add-btn" class="add-cart-btn">Add to Cart — ${currentPrice} RON</a>
            
            ${data.product_images && data.product_images.length > 1 ? `
            <div class="product-gallery-section">
                <h4>Product Gallery</h4>
                <div class="product-gallery">
                    ${data.product_images.map((img, index) => `
                        <img src="${img}" alt="Product view ${index + 1}" 
                             onclick="this.classList.toggle('expanded')"
                             class="product-gallery-img ${index === 0 ? 'active' : ''}">
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${data.qc_images && data.qc_images.length > 0 ? createQCCarousel(data.qc_images) : ''}
        </div>
    `;

    const priceEl = document.getElementById("price");
    const colorBox = document.getElementById("color-options");
    const sizeBox = document.getElementById("size-options");
    const mainImg = document.getElementById("main-img");
    const addBtn = document.getElementById("add-btn");

    function getColorObj(name) {
        return data.colors.find(c => c.name === name);
    }

    function updatePrice(colorName) {
        const colorObj = getColorObj(colorName);
        if (colorObj && colorObj.final_price !== null && colorObj.final_price !== undefined) {
            currentPrice = colorObj.final_price;
            priceEl.textContent = `${currentPrice} RON`;
            addBtn.textContent = `Add to Cart — ${currentPrice} RON`;
        }
    }

    // Colors - Only render if we have multiple colors
    if (colorBox && data.colors && data.colors.length > 1) {
        data.colors.forEach(c => {
            const el = document.createElement("div");
            el.className = "variant" + (c.name === selectedColor ? " active" : "");
            
            // Show price difference if multiple prices exist
            const priceDiff = hasMultiplePrices ? ` (${c.final_price} RON)` : '';
            el.textContent = c.name + priceDiff;
            
            el.onclick = () => {
                selectedColor = c.name;

                // Update active state
                document.querySelectorAll(".variant").forEach(x => x.classList.remove("active"));
                el.classList.add("active");

                // Update main image if variant has its own images
                if (c.images && c.images.length > 0) {
                    mainImg.src = c.images[0];
                }

                // Update sizes for this color
                if (sizeBox && c.sizes && c.sizes.length > 0) {
                    sizeBox.innerHTML = "";
                    selectedSize = c.sizes[0];
                    
                    c.sizes.forEach(size => {
                        const sEl = document.createElement("div");
                        sEl.className = "size" + (size === selectedSize ? " active" : "");
                        sEl.textContent = size;
                        sEl.onclick = () => {
                            selectedSize = size;
                            document.querySelectorAll(".size").forEach(x => x.classList.remove("active"));
                            sEl.classList.add("active");
                        };
                        sizeBox.appendChild(sEl);
                    });
                }

                // Update price for selected color
                updatePrice(selectedColor);
            };
            colorBox.appendChild(el);
        });
    }

    // Sizes - Only render if we have sizes
    if (sizeBox && data.sizes && data.sizes.length > 0) {
        const sizes = data.colors?.[0]?.sizes || data.sizes;
        sizes.forEach(size => {
            const el = document.createElement("div");
            el.className = "size" + (size === selectedSize ? " active" : "");
            el.textContent = size;
            el.onclick = () => {
                selectedSize = size;
                document.querySelectorAll(".size").forEach(x => x.classList.remove("active"));
                el.classList.add("active");
            };
            sizeBox.appendChild(el);
        });
    }

    // ADD TO CART
    addBtn.onclick = () => {
        addToCart({
            title: data.title,
            price: currentPrice,
            color: selectedColor,
            size: selectedSize,
            url: data.url,
            image: data.cover_image
        });

        alert("Added to cart!");
    };
    
    // Initialize QC carousel scroll behavior
    setTimeout(() => {
        const qcCarousel = document.querySelector('.qc-carousel');
        if (qcCarousel) {
            qcCarousel.addEventListener('scroll', updateActiveQCOnScroll);
        }
    }, 100);
}

function updateActiveQCOnScroll() {
    const carousel = document.querySelector('.qc-carousel');
    const slides = document.querySelectorAll('.qc-slide');
    const dots = document.querySelectorAll('.qc-dot');
    
    if (!carousel || slides.length === 0) return;
    
    const scrollLeft = carousel.scrollLeft;
    const slideWidth = slides[0].offsetWidth;
    const newIndex = Math.round(scrollLeft / slideWidth);
    
    if (newIndex !== currentQcIndex && newIndex >= 0 && newIndex < slides.length) {
        slides[currentQcIndex].classList.remove('active');
        dots[currentQcIndex].classList.remove('active');
        
        currentQcIndex = newIndex;
        
        slides[currentQcIndex].classList.add('active');
        dots[currentQcIndex].classList.add('active');
    }
}

// Add keyboard controls for fullscreen modal
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('qc-modal');
    if (modal.style.display !== 'block') return;
    
    e.stopPropagation();
    
    switch(e.key) {
        case 'Escape':
            closeQCFullscreen();
            break;
        case 'ArrowLeft':
            qcModalPrev(e);
            break;
        case 'ArrowRight':
            qcModalNext(e);
            break;
        case '+':
        case '=':
            if (e.ctrlKey || e.metaKey) {
                zoomIn();
                e.preventDefault();
            }
            break;
        case '-':
            if (e.ctrlKey || e.metaKey) {
                zoomOut();
                e.preventDefault();
            }
            break;
        case '0':
            if (e.ctrlKey || e.metaKey) {
                resetZoom();
                e.preventDefault();
            }
            break;
    }
});

/* ========= CART OVERLAY ========== */
function openCart() {
    const overlay = document.getElementById("cart-overlay");
    const box = document.getElementById("cart-box");

    box.innerHTML = "<h2>Your Cart</h2>";

    let total = 0;

    cart.forEach((item, i) => {
        total += item.price;

        const row = document.createElement("div");
        row.className = "cart-item";

        row.innerHTML = `
            <div class="cart-item-left">
                <img src="${item.image || ''}" class="cart-item-image">
                <div>
                    <div class="cart-title">${item.title}</div>
                    ${item.color ? `<div class="cart-variant">Color: ${item.color}</div>` : ''}
                    ${item.size ? `<div class="cart-variant">Size: ${item.size}</div>` : ''}
                    <div class="cart-price">${item.price} RON</div>
                </div>
            </div>
            <div class="remove-btn" onclick="removeItem(${i})">Remove</div>
        `;

        box.appendChild(row);
    });

    box.innerHTML += `
        <h3>Total: ${total.toFixed(2)} RON</h3>
        <a id="checkout-btn" onclick="checkout()">Checkout on WhatsApp</a>
    `;

    overlay.style.display = "flex";
}

function closeCart() {
    document.getElementById("cart-overlay").style.display = "none";
}

function removeItem(i) {
    cart.splice(i, 1);
    saveCart();
    openCart();
}

function checkout() {
    let text = "Hey! Here's my order:\n\n";

    cart.forEach(item => {
        text += `• ${item.title}\n`;
        if (item.color) text += `   Color: ${item.color}\n`;
        if (item.size) text += `   Size: ${item.size}\n`;
        text += `   Price: ${item.price} RON\n`;
        text += `   Link: ${item.url}\n\n`;
    });

    const total = cart.reduce((a, b) => a + b.price, 0);
    text += `Total: ${total} RON`;

    window.open("https://wa.me/?text=" + encodeURIComponent(text));
}

/* ========= ADMIN FUNCTIONS ========= */
async function loadAdminProducts() {
    fetch('products_list.json')
        .then(response => response.json())
        .then(files => {
            const container = document.getElementById('products-list');
            container.innerHTML = '';
            
            files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'product-item';
                
                fetch('products/' + file)
                    .then(r => r.json())
                    .then(data => {
                        item.innerHTML = `
                            <div class="product-info">
                                <img src="${data.cover_image}" alt="${data.title}" class="product-thumb">
                                <div class="product-details">
                                    <div class="product-name">${data.title}</div>
                                    <div class="product-price">${data.final_price} RON</div>
                                </div>
                            </div>
                            <button onclick="deleteProduct('${file}')" class="delete-btn">Delete</button>
                        `;
                    });
                
                container.appendChild(item);
            });
        });
}

function scrapeProduct() {
    const url = document.getElementById('product-url').value;
    const status = document.getElementById('scrape-status');
    
    if (!url.includes('acbuy.com')) {
        status.innerHTML = '<span class="error">Please enter a valid AcBuy URL</span>';
        return;
    }
    
    status.innerHTML = '<span class="loading">Scraping product... This may take 10-20 seconds</span>';
    
    fetch('/api/scrape', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            status.innerHTML = `<span class="success">✓ ${data.message}</span>`;
            document.getElementById('product-url').value = '';
            loadAdminProducts();
        } else {
            status.innerHTML = `<span class="error">✗ ${data.error}</span>`;
        }
    })
    .catch(error => {
        status.innerHTML = `<span class="error">Connection error: ${error}</span>`;
    });
}

function deleteProduct(filename) {
    if (confirm('Are you sure you want to delete this product?')) {
        fetch('/api/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ file: filename })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadAdminProducts();
            } else {
                alert('Error deleting product');
            }
        });
    }
}

function regenerateList() {
    const status = document.getElementById('regen-status');
    status.innerHTML = '<span class="loading">Regenerating product list...</span>';
    
    fetch('/api/regenerate')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                status.innerHTML = `<span class="success">${data.message}</span>`;
                loadAdminProducts();
            }
        });
}

// TEMPORARY: Add this function to avoid errors until reviews.js is added
function loadProductCardReviews(productId, element) {
    // This will be implemented when reviews.js is added
    console.log("Reviews not implemented yet");
}