// Initialize the map in the frontend
const map = L.map('map').setView([12.8234, 80.0458], 13); // Default to Potheri, Tamil Nadu, India
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let binMarkers = {};  // Store bin markers for easy search
let draggableBinMarker;

// Fetch existing bins from the server and display their names as fixed labels
fetch('/bins')
    .then(response => response.json())
    .then(bins => {
        console.log(bins); // Log the bins data for debugging
        bins.forEach(bin => {
            addBinWithFixedLabel(bin.latitude, bin.longitude, bin.name);
        });
    })
    .catch(err => console.error('Error fetching bins:', err));

// Function to add a bin to the map with a fixed label
function addBinWithFixedLabel(lat, lon, name) {
    // Add marker for the bin
    const marker = L.marker([lat, lon]).addTo(map);
    
    // Create a fixed label using DivIcon
    const label = L.divIcon({
        className: 'bin-label', // You can add CSS class for custom styling
        html: `<div><strong>${name}</strong></div>`,
        iconSize: [100, 40], // Adjust the size according to the text
        iconAnchor: [50, 0]   // Position relative to the marker
    });

    // Bind the label as a DivIcon to the marker's location
    L.marker([lat, lon], { icon: label }).addTo(map);

    // Store for searching later
    binMarkers[name] = marker;
}

// Function to make a draggable marker for adding bins
function addDraggableBinMarker() {
    // Fetch the next bin name from the server (based on current count)
    fetch('/next-bin-name')
        .then(response => response.json())
        .then(data => {
            const binName = data.nextBinName;

            if (draggableBinMarker) {
                map.removeLayer(draggableBinMarker); // Remove the previous draggable marker if exists
            }

            // Add a draggable marker to the map at the current center of the map
            draggableBinMarker = L.marker(map.getCenter(), { draggable: true })
                .addTo(map)
                .bindPopup(`${binName} (Drag to set location)`)
                .openPopup();

            // Event listener for when the marker is dragged and dropped
            draggableBinMarker.on('dragend', function (event) {
                const marker = event.target;
                const position = marker.getLatLng();
                marker.setPopupContent(`${binName} (Dropped here)`); // Update popup to show the bin has been dropped

                // Send the final location to the server
                sendBinLocationToServer(position.lat, position.lng, binName);
            });
        });
}

// Function to add bin at the user's current location
function addBinAtCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // Fetch the next bin name from the server
            fetch('/next-bin-name')
                .then(response => response.json())
                .then(data => {
                    const binName = data.nextBinName;

                    // Add bin at current location
                    L.marker([lat, lon])
                        .addTo(map)
                        .bindPopup(`${binName} (Current Location)`).openPopup();

                    // Send the bin location to the server
                    sendBinLocationToServer(lat, lon, binName);
                });
        });
    } else {
        alert('Geolocation is not supported by this browser.');
    }
}

// Send bin location and name to the server
const sendBinLocationToServer = (latitude, longitude, binName) => {
    fetch('/add-bin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            latitude: latitude,
            longitude: longitude,
            name: binName,
            added_by: 'admin'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Bin added successfully!');
        } else {
            alert('Error adding bin.');
        }
    });
};

// Event listener for "Drag and Drop Bin" button
document.getElementById('drag-bin').addEventListener('click', addDraggableBinMarker);

// Event listener for "Add Bin at Current Location" button
document.getElementById('current-location-bin').addEventListener('click', addBinAtCurrentLocation);

// Geocode city or area and center the map
function geocodeCityOrArea(cityName) {
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}`;

    fetch(geocodeUrl)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const lat = data[0].lat;
                const lon = data[0].lon;
                map.setView([lat, lon], 13);  // Center the map on the geocoded location
            } else {
                alert('Location not found');
            }
        })
        .catch(err => console.error('Error with geocoding:', err));
}

// Search functionality for bins or cities/areas
document.getElementById('search-btn').addEventListener('click', () => {
    const searchQuery = document.getElementById('search-bin-city').value.trim();

    if (binMarkers[searchQuery]) {
        // If the search query matches a bin, open the popup for the bin
        const marker = binMarkers[searchQuery];
        marker.openPopup();  // Open the popup for the searched bin
        map.setView(marker.getLatLng(), 13);  // Center the map on the bin
    } else {
        // If not a bin, treat it as a city or area and geocode it
        geocodeCityOrArea(searchQuery);
    }
});
