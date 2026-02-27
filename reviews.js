/* ===== REVIEW SYSTEM ===== */

// Load review page for specific product
async function loadReviewPage() {
    updateCartBubble();
    
    const params = new URLSearchParams(location.search);
    const productId = params.get("product");
    const container = document.getElementById("review-container");
    const formContainer = document.getElementById("review-form-container");
    const reviewsContainer = document.getElementById("existing-reviews");
    
    if (!productId) {
        container.innerHTML = '<div class="error-message">No product specified</div>';
        return;
    }
    
    try {
        // Load product data
        const data = await fetch("products/" + productId).then(r => r.json());
        
        // Display product info
        container.innerHTML = `
            <div class="product-review-header">
                <img src="${data.cover_image}" alt="${data.title}">
                <h2>Reviewing: ${data.title}</h2>
                <p>Please share your honest experience with this product</p>
            </div>
        `;
        
        // Load existing reviews
        loadExistingReviews(productId, reviewsContainer);
        
        // Create review form
        formContainer.innerHTML = createReviewForm(data, productId);
        
        // Initialize form functionality
        initializeReviewForm(data);
        
    } catch (error) {
        container.innerHTML = '<div class="error-message">Error loading product</div>';
    }
}

// Create review form HTML
function createReviewForm(productData, productId) {
    const colors = productData.colors || [{ name: "default" }];
    const sizes = productData.sizes || [];
    
    return `
        <form id="review-form" class="review-form" onsubmit="submitReview(event, '${productId}')">
            <h2>Your Review</h2>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="first-name">First Name *</label>
                    <input type="text" id="first-name" name="firstName" required>
                </div>
                <div class="form-group">
                    <label for="last-name">Last Name *</label>
                    <input type="text" id="last-name" name="lastName" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="variant">Product Variant *</label>
                    <select id="variant" name="variant" required>
                        <option value="">Select variant</option>
                        ${colors.map(color => `<option value="${color.name}">${color.name}</option>`).join('')}
                    </select>
                </div>
                ${sizes.length > 0 ? `
                <div class="form-group">
                    <label for="size">Size</label>
                    <select id="size" name="size">
                        <option value="">Select size</option>
                        ${sizes.map(size => `<option value="${size}">${size}</option>`).join('')}
                    </select>
                </div>
                ` : ''}
            </div>
            
            <div class="form-group">
                <label>Overall Rating *</label>
                <div class="star-rating">
                    ${[5,4,3,2,1].map(rating => `
                        <label>
                            <input type="radio" name="rating" value="${rating}" required>
                            <span class="star">★</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <div class="form-group">
                <label for="review-text">Your Review *</label>
                <textarea id="review-text" name="reviewText" placeholder="Share your experience with this product..." required></textarea>
            </div>
            
            <!-- Optional Ratings -->
            <div class="optional-ratings">
                <div class="optional-rating-group">
                    <h4>Fit</h4>
                    <div class="fit-options">
                        <span class="fit-option" data-value="true-to-size" onclick="selectFitOption(this)">True to size</span>
                        <span class="fit-option" data-value="small" onclick="selectFitOption(this)">Small</span>
                        <span class="fit-option" data-value="big" onclick="selectFitOption(this)">Big</span>
                    </div>
                    <input type="hidden" id="fit-value" name="fit">
                </div>
                
                <div class="optional-rating-group">
                    <h4>Quality Rating</h4>
                    <div class="sub-rating" data-type="quality">
                        ${[5,4,3,2,1].map(rating => `
                            <span class="sub-star" data-value="${rating}" onclick="setSubRating(this, 'quality')">★</span>
                        `).join('')}
                    </div>
                    <input type="hidden" id="quality-rating" name="quality">
                </div>
                
                <div class="optional-rating-group">
                    <h4>Value Rating</h4>
                    <div class="sub-rating" data-type="value">
                        ${[5,4,3,2,1].map(rating => `
                            <span class="sub-star" data-value="${rating}" onclick="setSubRating(this, 'value')">★</span>
                        `).join('')}
                    </div>
                    <input type="hidden" id="value-rating" name="value">
                </div>
            </div>
            
            <!-- Image Upload -->
            <div class="image-upload-section">
                <h4>Add Photos (Optional)</h4>
                <p class="image-count">You can upload up to 10 images</p>
                <label for="image-upload" class="image-upload-label">Choose Images</label>
                <input type="file" id="image-upload" class="image-upload-input" accept="image/*" multiple onchange="handleImageUpload(event)">
                <div id="image-preview" class="image-preview-container"></div>
            </div>
            
            <button type="submit" class="submit-review-btn" id="submit-review">Submit Review</button>
        </form>
    `;
}

// Initialize review form functionality
function initializeReviewForm(productData) {
    // Star rating selection
    const starInputs = document.querySelectorAll('.star-rating input');
    const stars = document.querySelectorAll('.star-rating .star');
    
    starInputs.forEach(input => {
        input.addEventListener('change', function() {
            const rating = parseInt(this.value);
            stars.forEach((star, index) => {
                if (5 - index <= rating) {
                    star.style.color = '#ffd700';
                } else {
                    star.style.color = '#444';
                }
            });
        });
    });
    
    // Initialize fit option selection
    const fitOptions = document.querySelectorAll('.fit-option');
    if (fitOptions.length > 0) {
        fitOptions[0].classList.add('selected');
        document.getElementById('fit-value').value = fitOptions[0].dataset.value;
    }
}

// Select fit option
function selectFitOption(element) {
    const fitOptions = document.querySelectorAll('.fit-option');
    fitOptions.forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('fit-value').value = element.dataset.value;
}

// Set sub rating (quality/value)
function setSubRating(element, type) {
    const rating = parseInt(element.dataset.value);
    const container = element.parentElement;
    const stars = container.querySelectorAll('.sub-star');
    
    // Update star colors
    stars.forEach(star => {
        if (parseInt(star.dataset.value) <= rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
    
    // Set hidden input value
    document.getElementById(`${type}-rating`).value = rating;
}

// Handle image upload
let uploadedImages = [];

function handleImageUpload(event) {
    const files = event.target.files;
    const previewContainer = document.getElementById('image-preview');
    const imageCount = document.querySelector('.image-count');
    
    // Check total image count
    if (uploadedImages.length + files.length > 10) {
        alert('You can only upload up to 10 images total');
        return;
    }
    
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) {
            alert('Please upload only image files');
            return;
        }
        
        if (uploadedImages.length >= 10) {
            alert('Maximum 10 images allowed');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            uploadedImages.push(imageData);
            
            // Create preview
            const previewDiv = document.createElement('div');
            previewDiv.className = 'image-preview';
            previewDiv.innerHTML = `
                <img src="${imageData}" alt="Preview">
                <button type="button" class="remove-image" onclick="removeImage(${uploadedImages.length - 1})">×</button>
            `;
            previewContainer.appendChild(previewDiv);
            
            // Update count
            imageCount.textContent = `${uploadedImages.length}/10 images uploaded`;
        };
        reader.readAsDataURL(file);
    });
    
    // Reset file input
    event.target.value = '';
}

// Remove uploaded image
function removeImage(index) {
    uploadedImages.splice(index, 1);
    const previewContainer = document.getElementById('image-preview');
    const imageCount = document.querySelector('.image-count');
    
    // Rebuild previews
    previewContainer.innerHTML = '';
    uploadedImages.forEach((imageData, i) => {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview';
        previewDiv.innerHTML = `
            <img src="${imageData}" alt="Preview">
            <button type="button" class="remove-image" onclick="removeImage(${i})">×</button>
        `;
        previewContainer.appendChild(previewDiv);
    });
    
    // Update count
    imageCount.textContent = `${uploadedImages.length}/10 images uploaded`;
}

// Submit review
async function submitReview(event, productId) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = document.getElementById('submit-review');
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    try {
        // Collect form data
        const reviewData = {
            id: Date.now(),
            productId: productId,
            firstName: form.firstName.value.trim(),
            lastName: form.lastName.value.trim(),
            variant: form.variant.value,
            size: form.size ? (form.size.value || null) : null,
            rating: parseInt(form.rating.value),
            reviewText: form.reviewText.value.trim(),
            fit: form.fit.value || null,
            quality: form.quality.value ? parseInt(form.quality.value) : null,
            value: form.value.value ? parseInt(form.value.value) : null,
            images: uploadedImages,
            date: new Date().toISOString(),
            verified: false // Can be marked as verified later
        };
        
        // Validate
        if (!reviewData.firstName || !reviewData.lastName || !reviewData.rating || !reviewData.reviewText) {
            throw new Error('Please fill in all required fields');
        }
        
        // Save to localStorage
        saveReview(reviewData);
        
        // Show success message
        alert('Thank you for your review! It will be visible after approval.');
        
        // Redirect back to product page
        window.location.href = `product.html?id=${productId}`;
        
    } catch (error) {
        alert(`Error submitting review: ${error.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Review';
    }
}

// Save review to localStorage
function saveReview(review) {
    const reviews = JSON.parse(localStorage.getItem('productReviews') || '{}');
    
    if (!reviews[review.productId]) {
        reviews[review.productId] = [];
    }
    
    reviews[review.productId].push(review);
    localStorage.setItem('productReviews', JSON.stringify(reviews));
    
    // Also save to product-specific array for quick access
    const productReviews = JSON.parse(localStorage.getItem(`reviews_${review.productId}`) || '[]');
    productReviews.push(review);
    localStorage.setItem(`reviews_${review.productId}`, JSON.stringify(productReviews));
}

// Load existing reviews
function loadExistingReviews(productId, container) {
    const reviews = JSON.parse(localStorage.getItem(`reviews_${productId}`) || '[]');
    
    if (reviews.length === 0) {
        container.innerHTML = `
            <h2>Customer Reviews</h2>
            <div class="no-reviews">
                <p>No reviews yet. Be the first to review this product!</p>
            </div>
        `;
        return;
    }
    
    // Sort by date (newest first)
    reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const reviewsHTML = reviews.map(review => createReviewHTML(review)).join('');
    
    container.innerHTML = `
        <h2>Customer Reviews (${reviews.length})</h2>
        ${reviewsHTML}
    `;
    
    // Initialize image click to view fullscreen
    initializeReviewImages();
}

// Create HTML for a single review
function createReviewHTML(review) {
    const date = new Date(review.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const starsHTML = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    
    const imagesHTML = review.images && review.images.length > 0 ? `
        <div class="review-images">
            ${review.images.map((img, i) => `
                <img src="${img}" alt="Review image ${i + 1}" class="review-image" 
                     onclick="openReviewImage('${img}')">
            `).join('')}
        </div>
    ` : '';
    
    const statsHTML = `
        <div class="review-stats">
            ${review.fit ? `
                <div class="review-stat">
                    <span>Fit:</span>
                    <span>${review.fit.replace('-', ' ').toUpperCase()}</span>
                </div>
            ` : ''}
            ${review.quality ? `
                <div class="review-stat">
                    <span>Quality:</span>
                    <i>${'★'.repeat(review.quality)}</i>
                </div>
            ` : ''}
            ${review.value ? `
                <div class="review-stat">
                    <span>Value:</span>
                    <i>${'★'.repeat(review.value)}</i>
                </div>
            ` : ''}
        </div>
    `;
    
    return `
        <div class="review-item">
            <div class="review-header">
                <div class="reviewer-info">
                    <div class="reviewer-name">${review.firstName} ${review.lastName.charAt(0)}.</div>
                    ${review.variant ? `<div class="review-variant">Variant: ${review.variant}</div>` : ''}
                    ${review.size ? `<div class="review-variant">Size: ${review.size}</div>` : ''}
                    <div class="review-date">Reviewed on ${date}</div>
                </div>
                <div class="review-rating">
                    <div class="review-main-rating">${starsHTML}</div>
                </div>
            </div>
            <div class="review-text">${review.reviewText}</div>
            ${imagesHTML}
            ${statsHTML}
        </div>
    `;
}

// Open review image in fullscreen
function openReviewImage(src) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
    `;
    
    modal.innerHTML = `
        <img src="${src}" style="max-width: 90%; max-height: 90%; object-fit: contain;">
        <button onclick="this.parentElement.remove()" style="
            position: absolute;
            top: 20px;
            right: 20px;
            background: #ff6565;
            color: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
        ">×</button>
    `;
    
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    document.body.appendChild(modal);
}

// Initialize review images
function initializeReviewImages() {
    const images = document.querySelectorAll('.review-image');
    images.forEach(img => {
        img.addEventListener('click', () => openReviewImage(img.src));
    });
}

// Load reviews summary for product page
function loadReviewsSummary(productId, container) {
    const reviews = JSON.parse(localStorage.getItem(`reviews_${productId}`) || '[]');
    
    if (reviews.length === 0) {
        container.innerHTML = `
            <div class="reviews-summary">
                <h4>Customer Reviews</h4>
                <p>No reviews yet. <a href="reviews.html?product=${productId}">Be the first to review!</a></p>
            </div>
        `;
        return;
    }
    
    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = (totalRating / reviews.length).toFixed(1);
    
    // Get star representation
    const fullStars = Math.floor(averageRating);
    const hasHalfStar = averageRating % 1 >= 0.5;
    
    let starsHTML = '';
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            starsHTML += '★';
        } else if (i === fullStars && hasHalfStar) {
            starsHTML += '½';
        } else {
            starsHTML += '☆';
        }
    }
    
    container.innerHTML = `
        <div class="reviews-summary">
            <h4>Customer Reviews</h4>
            <div class="review-summary-stats">
                <div class="average-rating">
                    <div class="average-rating-number">${averageRating}</div>
                    <div class="average-rating-stars">${starsHTML}</div>
                </div>
                <div class="review-count">Based on ${reviews.length} review${reviews.length !== 1 ? 's' : ''}</div>
            </div>
            <a href="reviews.html?product=${productId}" class="view-all-reviews">View All Reviews</a>
        </div>
    `;
}

// Load product card reviews
function loadProductCardReviews(productId, element) {
    const reviews = JSON.parse(localStorage.getItem(`reviews_${productId}`) || '[]');
    
    if (reviews.length === 0) return;
    
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = (totalRating / reviews.length).toFixed(1);
    
    const fullStars = Math.floor(averageRating);
    const hasHalfStar = averageRating % 1 >= 0.5;
    
    let starsHTML = '';
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            starsHTML += '★';
        } else if (i === fullStars && hasHalfStar) {
            starsHTML += '½';
        } else {
            starsHTML += '☆';
        }
    }
    
    element.innerHTML += `
        <div class="product-review-stars">
            <div class="stars">${starsHTML}</div>
            <div class="product-review-count">(${reviews.length})</div>
        </div>
    `;
}