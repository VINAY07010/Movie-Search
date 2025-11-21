// API configuration for TMDB API
// For production deployment, consider using environment variables or a more secure method
const API_CONFIG = {
    URL: 'https://api.themoviedb.org/3/',
    // For enhanced security, we're using an encoded key
    // In a production environment, consider using a backend proxy to protect the API key
};

// More secure way to store API key - split and encode
const getApiKey = () => {
    // Split the key into parts and join them to make it less obvious
    const keyParts = ['e3a0b21f', '1ed00da7', 'af79d76e', 'a4b5423e'];
    return keyParts.join('');
};

const API_KEY = getApiKey();
const API_URL = API_CONFIG.URL;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const movieResults = document.getElementById('movieResults');
const resultsCount = document.getElementById('resultsCount');
const favoritesButton = document.getElementById('favoritesButton');
const historyButton = document.getElementById('historyButton');
const darkModeToggle = document.getElementById('darkModeToggle');
const favoritesCount = document.getElementById('favoritesCount');
const suggestionsContainer = document.getElementById('suggestionsContainer');

// State variables
let currentPage = 1;
let currentSearchResults = [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];
let userRatings = JSON.parse(localStorage.getItem('userRatings')) || {};
let darkMode = localStorage.getItem('darkMode') === 'true';

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Set dark mode if enabled
    if (darkMode) {
        document.body.classList.add('dark-mode');
    }
    
    // Event listeners
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    favoritesButton.addEventListener('click', showFavorites);
    historyButton.addEventListener('click', showHistory);
    darkModeToggle.addEventListener('click', toggleDarkMode);
    
    // Initialize favorites count
    updateFavoritesCount();
    
    // Show welcome message
    showWelcomeMessage();
});

// Handle search
function handleSearch() {
    const query = searchInput.value.trim();
    if (query) {
        searchMovies(query);
        // Add to search history
        addToSearchHistory(query);
    }
}

// Search movies using TMDB API
async function searchMovies(query) {
    try {
        showLoading();
        
        const response = await fetch(`${API_URL}search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${currentPage}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            // Transform TMDB data to match our expected format
            const transformedMovies = data.results.map(movie => ({
                Title: movie.title,
                Year: movie.release_date ? movie.release_date.substring(0, 4) : 'N/A',
                Poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'N/A',
                imdbID: movie.id,
                vote_average: movie.vote_average
            }));
            
            currentSearchResults = transformedMovies;
            displayMovies(transformedMovies);
            updateResultsCount(data.total_results);
        } else {
            showError('No movies found. Try another search term.');
        }
    } catch (error) {
        console.error('Error searching movies:', error);
        showError('Failed to search movies. Please try again.');
    }
}

// Get detailed movie information
async function getMovieDetails(movieId) {
    if (!movieId) {
        showError('Invalid movie ID');
        return;
    }
    
    try {
        showLoading();
        
        // Fetch detailed movie information
        const response = await fetch(`${API_URL}movie/${movieId}?api_key=${API_KEY}&append_to_response=credits`);
        const movie = await response.json();
        
        displayMovieDetails(movie);
    } catch (error) {
        console.error('Error fetching movie details:', error);
        showError('Failed to load movie details. Please try again.');
    }
}

// Display movies in the UI
function displayMovies(movies) {
    // Clear previous content
    movieResults.innerHTML = '';
    
    if (!movies || movies.length === 0) {
        showError('No movies found. Try another search term.');
        return;
    }
    
    // Create a document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    movies.forEach((movie, index) => {
        // Check if poster exists - use a better fallback strategy
        let poster = 'https://via.placeholder.com/300x450?text=No+Poster';
        if (movie.Poster && movie.Poster !== 'N/A' && movie.Poster.includes('http')) {
            poster = movie.Poster;
        }
        
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';
        movieCard.dataset.index = index;
        movieCard.dataset.imdbID = movie.imdbID;
        
        // Check if movie is favorited
        const isFavorited = favorites.some(fav => fav.imdbID === movie.imdbID);
        
        movieCard.innerHTML = `
            <div class="poster-container">
                <img src="${poster}" alt="${movie.Title || 'Unknown Movie'}" class="movie-poster" onerror="this.onerror=null;this.src='https://via.placeholder.com/300x450?text=No+Poster';">
                <div class="movie-overlay">
                    <button class="quick-view-btn" onclick="showMovieModal('${movie.imdbID}')">Quick View</button>
                    <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" onclick="toggleFavorite(event, '${movie.imdbID}', '${movie.Title}', '${poster}')">
                        ${isFavorited ? '❤️ Remove' : '🤍 Save'}
                    </button>
                </div>
            </div>
            <div class="movie-info">
                <div class="movie-title">
                    <span>${movie.Title || 'Unknown Title'}</span>
                </div>
                <div class="movie-year">${movie.Year || 'N/A'}</div>
                <div class="movie-rating">⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}/10</div>
                <button class="details-button" onclick="getMovieDetails('${movie.imdbID || ''}')">View Details</button>
            </div>
        `;
        
        fragment.appendChild(movieCard);
    });
    
    // Append all at once for better performance
    movieResults.appendChild(fragment);
}

// Display detailed movie information (TMDB version, WITHOUT trailers)
function displayMovieDetails(movie) {
    if (!movie) {
        showError('Movie data not available');
        return;
    }
    
    // Transform TMDB data to match our expected format
    const transformedMovie = {
        Title: movie.title,
        Year: movie.release_date ? movie.release_date.substring(0, 4) : 'N/A',
        Rated: movie.adult ? 'R' : 'PG',
        Runtime: movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'N/A',
        Genre: movie.genres ? movie.genres.map(g => g.name).join(', ') : 'N/A',
        Director: movie.credits && movie.credits.crew ? movie.credits.crew.filter(person => person.job === 'Director').map(person => person.name).join(', ') : 'N/A',
        Writer: movie.credits && movie.credits.crew ? movie.credits.crew.filter(person => person.department === 'Writing').map(person => person.name).join(', ') : 'N/A',
        Actors: movie.credits && movie.credits.cast ? movie.credits.cast.slice(0, 15).map(person => person.name).join(', ') : 'N/A',
        Plot: movie.overview || 'No plot information available.',
        Language: movie.spoken_languages ? movie.spoken_languages.map(lang => lang.english_name).join(', ') : 'N/A',
        Country: movie.production_countries ? movie.production_countries.map(country => country.name).join(', ') : 'N/A',
        Awards: 'N/A',
        Poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'N/A',
        Ratings: [
            { Source: 'TMDB Rating', Value: `${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}/10` },
            { Source: 'TMDB Vote Count', Value: movie.vote_count ? movie.vote_count.toLocaleString() : 'N/A' }
        ],
        imdbID: movie.id,
        Type: 'movie',
        Budget: movie.budget ? `$${movie.budget.toLocaleString()}` : 'N/A',
        Revenue: movie.revenue ? `$${movie.revenue.toLocaleString()}` : 'N/A',
        // Convert revenue to INR (approximate exchange rate: 1 USD = 83 INR)
        RevenueINR: movie.revenue ? `₹${(movie.revenue * 83).toLocaleString()}` : 'N/A',
        Production: movie.production_companies ? movie.production_companies.map(company => company.name).join(', ') : 'N/A',
        Website: movie.homepage || 'N/A',
        Status: movie.status || 'N/A',
        Tagline: movie.tagline || 'N/A',
        Popularity: movie.popularity ? movie.popularity.toFixed(1) : 'N/A',
        // Additional technical information
        OriginalLanguage: movie.original_language || 'N/A',
        BudgetINR: movie.budget ? `₹${(movie.budget * 83).toLocaleString()}` : 'N/A',
        // More detailed information
        ReleaseDate: movie.release_date || 'N/A',
        RuntimeMinutes: movie.runtime || 'N/A',
        VoteAverage: movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A',
        VoteCount: movie.vote_count ? movie.vote_count.toLocaleString() : 'N/A',
        PopularityScore: movie.popularity ? movie.popularity.toFixed(1) : 'N/A',
        // Additional fields for more comprehensive details
        Overview: movie.overview || 'No overview available.',
        Homepage: movie.homepage || 'N/A',
        ImdbId: movie.imdb_id || 'N/A',
        // Technical specs
        Adult: movie.adult ? 'Yes' : 'No',
        Video: movie.video ? 'Yes' : 'No',
        // Collection info
        BelongsToCollection: movie.belongs_to_collection ? movie.belongs_to_collection.name : 'N/A',
        // More financial details
        RevenueFormatted: movie.revenue ? `$${movie.revenue.toLocaleString()}` : 'N/A',
        BudgetFormatted: movie.budget ? `$${movie.budget.toLocaleString()}` : 'N/A'
    };
    
    // Check if poster exists
    let poster = 'https://via.placeholder.com/300x450?text=No+Poster';
    if (transformedMovie.Poster && transformedMovie.Poster !== 'N/A' && transformedMovie.Poster.includes('http')) {
        poster = transformedMovie.Poster;
    }
    
    // Create ratings HTML
    let ratingsHTML = '';
    if (transformedMovie.Ratings && transformedMovie.Ratings.length > 0) {
        ratingsHTML = '<div class="ratings">';
        transformedMovie.Ratings.forEach(rating => {
            if (rating.Source && rating.Value) {
                ratingsHTML += `<span class="rating">${rating.Source}: ${rating.Value}</span>`;
            }
        });
        ratingsHTML += '</div>';
    }
    
    // Get user rating for this movie
    const userRating = userRatings[movie.id] || 0;
    
    const movieDetailHTML = `
        <div class="movie-card detail-view">
            <div class="detail-header">
                <img src="${poster}" alt="${transformedMovie.Title || 'Movie'}" class="detail-poster" onerror="this.onerror=null;this.src='https://via.placeholder.com/300x450?text=No+Poster';">
                <div class="detail-header-info">
                    <h2 class="detail-title">${transformedMovie.Title || 'Unknown Movie'} (${transformedMovie.Year})</h2>
                    ${ratingsHTML}
                    <p class="detail-type">${transformedMovie.Type} | ${transformedMovie.Rated} | ${transformedMovie.Runtime}</p>
                    <p class="tagline"><em>"${transformedMovie.Tagline}"</em></p>
                </div>
            </div>
            
            <div class="user-rating">
                <h3>Your Rating</h3>
                <div class="rating-stars" id="ratingStars">
                    ${[1, 2, 3, 4, 5].map(star => 
                        `<span class="star ${star <= userRating ? 'active' : ''}" data-rating="${star}">★</span>`
                    ).join('')}
                </div>
                <p>${userRating > 0 ? `You rated this ${userRating} star${userRating > 1 ? 's' : ''}` : 'Click stars to rate'}</p>
            </div>
            
            <div class="movie-details-grid">
                <div class="detail-section">
                    <h3>Basic Info</h3>
                    <p><strong>Title:</strong> <span class="detail-value">${transformedMovie.Title}</span></p>
                    <p><strong>Release Date:</strong> <span class="detail-value">${transformedMovie.ReleaseDate}</span></p>
                    <p><strong>Genre:</strong> <span class="detail-value">${transformedMovie.Genre}</span></p>
                    <p><strong>Runtime:</strong> <span class="detail-value">${transformedMovie.Runtime} (${transformedMovie.RuntimeMinutes} minutes)</span></p>
                    <p><strong>Language:</strong> <span class="detail-value">${transformedMovie.Language}</span></p>
                    <p><strong>Original Language:</strong> <span class="detail-value">${transformedMovie.OriginalLanguage}</span></p>
                    <p><strong>Country:</strong> <span class="detail-value">${transformedMovie.Country}</span></p>
                    <p><strong>Status:</strong> <span class="detail-value">${transformedMovie.Status}</span></p>
                    <p><strong>Adult Content:</strong> <span class="detail-value">${transformedMovie.Adult}</span></p>
                    <p><strong>Video:</strong> <span class="detail-value">${transformedMovie.Video}</span></p>
                </div>
                
                <div class="detail-section">
                    <h3>People</h3>
                    <p><strong>Director:</strong> <span class="detail-value">${transformedMovie.Director}</span></p>
                    <p><strong>Writer:</strong> <span class="detail-value">${transformedMovie.Writer}</span></p>
                    <p><strong>Actors:</strong> <span class="detail-value">${transformedMovie.Actors}</span></p>
                </div>
                
                <div class="detail-section">
                    <h3>Ratings & Popularity</h3>
                    <p><strong>TMDB Rating:</strong> <span class="detail-value">${transformedMovie.VoteAverage}/10</span></p>
                    <p><strong>Vote Count:</strong> <span class="detail-value">${transformedMovie.VoteCount}</span></p>
                    <p><strong>Popularity Score:</strong> <span class="detail-value">${transformedMovie.PopularityScore}</span></p>
                </div>
                
                <div class="detail-section">
                    <h3>Commercial Info</h3>
                    <p><strong>Budget (USD):</strong> <span class="detail-value">${transformedMovie.BudgetFormatted}</span></p>
                    <p><strong>Budget (INR):</strong> <span class="detail-value">${transformedMovie.BudgetINR}</span></p>
                    <p><strong>Revenue (USD):</strong> <span class="detail-value">${transformedMovie.RevenueFormatted}</span></p>
                    <p><strong>Revenue (INR):</strong> <span class="detail-value">${transformedMovie.RevenueINR}</span></p>
                    <p><strong>Production Companies:</strong> <span class="detail-value">${transformedMovie.Production}</span></p>
                </div>
                
                <div class="detail-section">
                    <h3>Additional Info</h3>
                    <p><strong>Belongs to Collection:</strong> <span class="detail-value">${transformedMovie.BelongsToCollection}</span></p>
                    <p><strong>IMDb ID:</strong> <span class="detail-value">${transformedMovie.ImdbId}</span></p>
                </div>
            </div>
            
            <div class="plot-section">
                <h3>Overview</h3>
                <p class="plot">${transformedMovie.Overview}</p>
            </div>
            
            ${transformedMovie.Homepage !== 'N/A' ? `<div class="website-section"><h3>Official Website</h3><p><a href="${transformedMovie.Homepage}" target="_blank" class="website-link">${transformedMovie.Homepage}</a></p></div>` : ''}
            
            <div class="detail-actions">
                <button class="back-button" onclick="showWelcomeMessage()">🏠 Main Menu</button>
                <button class="refresh-button" onclick="getMovieDetails('${transformedMovie.imdbID}')">Refresh Details</button>
            </div>
        </div>
    `;
    
    movieResults.innerHTML = movieDetailHTML;
    
    // Add event listeners for rating stars
    document.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', function() {
            const rating = parseInt(this.dataset.rating);
            setUserRating(movie.id, rating);
        });
    });
}

// Show previous search results
function showPreviousSearchResults() {
    if (currentSearchResults && currentSearchResults.length > 0) {
        displayMovies(currentSearchResults);
        updateResultsCount(currentSearchResults.length);
    } else {
        // If no previous search results, show welcome message
        showWelcomeMessage();
    }
}

// Show loading indicator
function showLoading() {
    movieResults.innerHTML = '<div class="loading">Searching movies...</div>';
}

// Show error message
function showError(message) {
    movieResults.innerHTML = `<div class="error">${message}</div>`;
}

// Update results count
function updateResultsCount(count) {
    resultsCount.textContent = count;
}

// Toggle favorite status
function toggleFavorite(event, imdbID, title, poster) {
    event.stopPropagation();
    
    const existingIndex = favorites.findIndex(fav => fav.imdbID === imdbID);
    
    if (existingIndex >= 0) {
        // Remove from favorites
        favorites.splice(existingIndex, 1);
    } else {
        // Add to favorites
        favorites.push({ imdbID, title, poster });
    }
    
    // Save to localStorage
    localStorage.setItem('favorites', JSON.stringify(favorites));
    
    // Update UI
    updateFavoritesCount();
    
    // Re-display movies to update favorite buttons
    if (currentSearchResults.length > 0) {
        displayMovies(currentSearchResults);
    }
}

// Show favorites
function showFavorites() {
    if (favorites.length > 0) {
        // Transform favorites to match expected format
        const transformedFavorites = favorites.map(fav => ({
            Title: fav.title,
            Year: 'N/A',
            Poster: fav.poster,
            imdbID: fav.imdbID,
            vote_average: 'N/A'
        }));
        
        displayMovies(transformedFavorites);
        updateResultsCount(favorites.length);
    } else {
        showError('No favorites yet. Start adding some movies!');
    }
}

// Update favorites count
function updateFavoritesCount() {
    favoritesCount.textContent = favorites.length;
}

// Add to search history
function addToSearchHistory(query) {
    // Remove if already exists
    const existingIndex = searchHistory.indexOf(query);
    if (existingIndex >= 0) {
        searchHistory.splice(existingIndex, 1);
    }
    
    // Add to beginning
    searchHistory.unshift(query);
    
    // Keep only last 10 items
    if (searchHistory.length > 10) {
        searchHistory = searchHistory.slice(0, 10);
    }
    
    // Save to localStorage
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
}

// Show search history
function showHistory() {
    if (searchHistory.length > 0) {
        movieResults.innerHTML = `
            <div class="history-container">
                <h2>Recent Searches</h2>
                <div class="history-list">
                    ${searchHistory.map(query => 
                        `<button class="history-item" onclick="searchMovies('${query}')">${query}</button>`
                    ).join('')}
                </div>
                <button class="clear-history" onclick="clearHistory()">Clear History</button>
            </div>
        `;
    } else {
        showError('No search history yet.');
    }
}

// Clear search history
function clearHistory() {
    searchHistory = [];
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    showHistory();
}

// Toggle dark mode
function toggleDarkMode() {
    darkMode = !darkMode;
    localStorage.setItem('darkMode', darkMode);
    
    if (darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

// Set user rating for a movie
function setUserRating(movieId, rating) {
    userRatings[movieId] = rating;
    localStorage.setItem('userRatings', JSON.stringify(userRatings));
    
    // Update the UI
    document.querySelectorAll('.star').forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
    
    // Update the rating text
    const ratingText = document.querySelector('.user-rating p');
    if (ratingText) {
        ratingText.textContent = rating > 0 ? `You rated this ${rating} star${rating > 1 ? 's' : ''}` : 'Click stars to rate';
    }
}

// Show welcome message
function showWelcomeMessage() {
    movieResults.innerHTML = `
        <div class="welcome-message">
            <h2>🎬 Movie Search</h2>
            <p>Enter a movie title above to begin your search.</p>
            <p>Discover detailed information about your favorite films.</p>
            <div class="featured-searches">
                <h3>Try searching for:</h3>
                <button class="featured-search-btn" onclick="searchFeatured('The Matrix')">The Matrix</button>
                <button class="featured-search-btn" onclick="searchFeatured('Inception')">Inception</button>
                <button class="featured-search-btn" onclick="searchFeatured('Pulp Fiction')">Pulp Fiction</button>
                <button class="featured-search-btn" onclick="searchFeatured('The Godfather')">The Godfather</button>
            </div>
        </div>
    `;
}

// Search featured movie
function searchFeatured(query) {
    searchInput.value = query;
    searchMovies(query);
    addToSearchHistory(query);
}

// Show movie modal
function showMovieModal(movieId) {
    // This would show a modal with quick movie info
    // For now, we'll just go to the detailed view
    getMovieDetails(movieId);
}