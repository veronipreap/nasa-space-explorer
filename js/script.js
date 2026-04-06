// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const getImagesButton = document.querySelector('.filters button');
const gallery = document.getElementById('gallery');

// Modal elements
const imageModal = document.getElementById('imageModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalImage = document.getElementById('modalImage');
const modalLoading = document.getElementById('modalLoading');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');

// NASA APOD API endpoint and key
const nasaApiUrl = 'https://api.nasa.gov/planetary/apod';
const nasaApiKey = 'kp3QJEdsQmxmHUVcQacPVk1BmpaanwNZfockuXfd';

// Store only image entries so we can open details in the modal later
let galleryItems = [];

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

// Listen for button clicks and fetch images for the selected dates
getImagesButton.addEventListener('click', async () => {
	await fetchAndRenderImages();
});

// Open modal when a gallery card is clicked
gallery.addEventListener('click', (event) => {
	const item = event.target.closest('.gallery-item');
	if (!item) {
		return;
	}

	const itemIndex = Number(item.dataset.index);
	const selectedItem = galleryItems[itemIndex];
	if (!selectedItem) {
		return;
	}

	openModal(selectedItem);
});

// Close modal with close button
closeModalBtn.addEventListener('click', closeModal);

// Close modal when clicking the overlay
imageModal.addEventListener('click', (event) => {
	if (event.target.dataset.closeModal === 'true') {
		closeModal();
	}
});

// Close modal with Escape key for better usability
document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && !imageModal.classList.contains('hidden')) {
		closeModal();
	}
});

async function fetchAndRenderImages() {
	const startDate = startInput.value;
	const endDate = endInput.value;

	if (!startDate || !endDate) {
		renderMessage('Please choose both a start date and end date.');
		return;
	}

	renderMessage('Loading images from NASA...', true);

	try {
		const requestUrl = `${nasaApiUrl}?api_key=${nasaApiKey}&start_date=${startDate}&end_date=${endDate}`;
		const response = await fetch(requestUrl);

		if (!response.ok) {
			throw new Error('Unable to load NASA images right now.');
		}

		const data = await response.json();

		// Keep only image entries (APOD sometimes returns videos)
		galleryItems = data
			.filter((item) => item.media_type === 'image' && item.url)
			.reverse();

		if (galleryItems.length === 0) {
			renderMessage('No images were returned for this date range. Try another range.');
			return;
		}

		renderGallery(galleryItems);
	} catch (error) {
		renderMessage('Something went wrong while fetching space images. Please try again.');
	}
}

function renderGallery(items) {
	const galleryMarkup = items
		.map((item, index) => {
			return `
				<article class="gallery-item" data-index="${index}" tabindex="0" role="button" aria-label="Open details for ${item.title}">
					<img src="${item.url}" alt="${item.title}" loading="lazy" decoding="async" />
					<p><strong>${item.title}</strong></p>
					<p>${formatDate(item.date)}</p>
				</article>
			`;
		})
		.join('');

	gallery.innerHTML = galleryMarkup;
}

function renderMessage(message, isLoading = false) {
	gallery.innerHTML = `
		<div class="placeholder">
			<div class="placeholder-icon">🔭</div>
			<p class="placeholder-message ${isLoading ? 'placeholder-message-loading' : ''}">${message}</p>
		</div>
	`;
}

function openModal(item) {
	// Show a short loading message until the image is fully ready.
	modalLoading.textContent = 'Loading space image...';
	modalLoading.classList.add('is-loading');
	modalLoading.classList.remove('hidden');
	modalImage.style.display = 'none';

	modalImage.onload = () => {
		modalLoading.classList.remove('is-loading');
		modalLoading.classList.add('hidden');
		modalImage.style.display = 'block';
	};

	modalImage.onerror = () => {
		modalLoading.textContent = 'Image is taking longer than expected. Please try another photo.';
		modalLoading.classList.remove('is-loading');
		modalImage.style.display = 'none';
	};

	// Use the standard image URL for faster modal rendering.
	modalImage.src = item.url;
	modalImage.alt = item.title;
	modalTitle.textContent = item.title;
	modalDate.textContent = formatDate(item.date);
	modalExplanation.textContent = item.explanation;

	imageModal.classList.remove('hidden');
	imageModal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
	imageModal.classList.add('hidden');
	imageModal.setAttribute('aria-hidden', 'true');
	modalLoading.classList.add('hidden');
	modalLoading.classList.remove('is-loading');
	modalImage.style.display = 'none';
	modalImage.src = '';
}

function formatDate(dateString) {
	const date = new Date(`${dateString}T00:00:00`);
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}
