// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const imageOnlyCheckbox = document.getElementById('imageOnly');
const videoOnlyCheckbox = document.getElementById('videoOnly');
const getImagesButton = document.querySelector('.filters button');
const gallery = document.getElementById('gallery');

// Modal elements
const imageModal = document.getElementById('imageModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalImage = document.getElementById('modalImage');
const modalVideo = document.getElementById('modalVideo');
const modalLoading = document.getElementById('modalLoading');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');

// NASA APOD API endpoint and key
const nasaApiUrl = 'https://api.nasa.gov/planetary/apod';
const nasaApiKey = 'kp3QJEdsQmxmHUVcQacPVk1BmpaanwNZfockuXfd';
const maxDaysPerRequest = 12;

// Store APOD entries so we can open details in the modal later
let galleryItems = [];
const apodCache = new Map();
let activeRequestController = null;

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

	const selectedDays = getDayDifference(startDate, endDate) + 1;
	if (selectedDays > maxDaysPerRequest) {
		renderMessage(`Please choose ${maxDaysPerRequest} days or fewer for faster loading.`);
		return;
	}

	const selectedMediaTypes = getSelectedMediaTypes();
	if (selectedMediaTypes.length === 0) {
		renderMessage('Please select at least one media type: Images or Videos.');
		return;
	}

	const cacheKey = `${startDate}_${endDate}`;
	if (apodCache.has(cacheKey)) {
		const cachedEntries = apodCache.get(cacheKey);
		galleryItems = filterByMediaType(cachedEntries, selectedMediaTypes);

		if (galleryItems.length === 0) {
			renderMessage('No matching entries found for the selected media type(s).');
			return;
		}

		renderGallery(galleryItems);
		return;
	}

	renderMessage('Loading media from NASA...', true);
	getImagesButton.disabled = true;
	getImagesButton.textContent = 'Loading...';

	if (activeRequestController) {
		activeRequestController.abort();
	}

	activeRequestController = new AbortController();

	try {
		const requestUrl = `${nasaApiUrl}?api_key=${nasaApiKey}&start_date=${startDate}&end_date=${endDate}&thumbs=true`;
		const response = await fetch(requestUrl, {
			signal: activeRequestController.signal
		});

		if (!response.ok) {
			throw new Error('Unable to load NASA media right now.');
		}

		const data = await response.json();

		// Keep both images and videos so users can access all APOD content.
		const allEntries = data
			.filter((item) => (item.media_type === 'image' || item.media_type === 'video') && item.url)
			.reverse();

		galleryItems = filterByMediaType(allEntries, selectedMediaTypes);

		if (galleryItems.length === 0) {
			renderMessage('No matching entries found for the selected media type(s).');
			return;
		}

		apodCache.set(cacheKey, allEntries);

		renderGallery(galleryItems);
	} catch (error) {
		if (error.name === 'AbortError') {
			return;
		}

		renderMessage('Something went wrong while fetching space media. Please try again.');
	} finally {
		getImagesButton.disabled = false;
		getImagesButton.textContent = 'Get Space Media';
		activeRequestController = null;
	}
}

function renderGallery(items) {
	const galleryMarkup = items
		.map((item, index) => {
			const isVideo = item.media_type === 'video';
			const previewImage = isVideo ? (item.thumbnail_url || 'img/nasa-worm-logo.png') : item.url;
			const mediaLabel = isVideo ? 'Video' : 'Image';

			return `
				<article class="gallery-item ${isVideo ? 'gallery-item-video' : ''}" data-index="${index}" tabindex="0" role="button" aria-label="Open details for ${item.title}">
					<img src="${previewImage}" alt="${item.title}" loading="lazy" decoding="async" />
					<p class="media-type-label">${mediaLabel}</p>
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
	const isVideo = item.media_type === 'video';
	const videoEmbedUrl = isVideo ? getVideoEmbedUrl(item.url) : '';

	modalImage.style.display = 'none';
	modalVideo.style.display = 'none';
	modalVideo.src = '';

	if (isVideo) {
		modalLoading.textContent = 'Loading space video...';
		modalLoading.classList.add('is-loading');
		modalLoading.classList.remove('hidden');

		if (videoEmbedUrl) {
			modalVideo.src = videoEmbedUrl;
			modalVideo.style.display = 'block';
			modalLoading.classList.remove('is-loading');
			modalLoading.classList.add('hidden');
		} else {
			modalLoading.textContent = 'This video cannot be embedded here.';
			modalLoading.classList.remove('is-loading');
		}
	} else {
		// Show a short loading message until the image is fully ready.
		modalLoading.textContent = 'Loading space media...';
		modalLoading.classList.add('is-loading');
		modalLoading.classList.remove('hidden');

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
	}

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
	modalVideo.style.display = 'none';
	modalVideo.src = '';
}

function getVideoEmbedUrl(videoUrl) {
	if (!videoUrl) {
		return '';
	}

	if (videoUrl.includes('youtube.com/embed/') || videoUrl.includes('player.vimeo.com/video/')) {
		return videoUrl;
	}

	if (videoUrl.includes('youtube.com/watch')) {
		const parsedUrl = new URL(videoUrl);
		const videoId = parsedUrl.searchParams.get('v');
		return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
	}

	if (videoUrl.includes('youtu.be/')) {
		const videoId = videoUrl.split('youtu.be/')[1];
		return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
	}

	if (videoUrl.includes('vimeo.com/')) {
		const parts = videoUrl.split('/');
		const videoId = parts[parts.length - 1];
		return videoId ? `https://player.vimeo.com/video/${videoId}` : '';
	}

	return '';
}

function formatDate(dateString) {
	const date = new Date(`${dateString}T00:00:00`);
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}

function getDayDifference(startDate, endDate) {
	const start = new Date(`${startDate}T00:00:00`);
	const end = new Date(`${endDate}T00:00:00`);
	const millisecondsPerDay = 1000 * 60 * 60 * 24;
	return Math.floor((end - start) / millisecondsPerDay);
}

function getSelectedMediaTypes() {
	const selectedTypes = [];

	if (imageOnlyCheckbox.checked) {
		selectedTypes.push('image');
	}

	if (videoOnlyCheckbox.checked) {
		selectedTypes.push('video');
	}

	return selectedTypes;
}

function filterByMediaType(entries, selectedTypes) {
	return entries.filter((entry) => selectedTypes.includes(entry.media_type));
}
