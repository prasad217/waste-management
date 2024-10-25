// Initialize the map
const map = L.map('map').setView([20.5937, 78.9629], 5); // Center on India

// Add OpenStreetMap layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Define a layer group for drawn items (polygons, rectangles)
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Function to handle searching for a location
document.getElementById('search-button').addEventListener('click', () => {
    const query = document.getElementById('search-bar').value;
    if (query) {
        searchLocation(query);
    }
});

// Nominatim API to search for locations
function searchLocation(query) {
    fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const lat = data[0].lat;
                const lon = data[0].lon;
                map.setView([lat, lon], 13);

                // Allow the user to manually draw after searching
                alert('Now, manually draw the area to place bins.');
            } else {
                alert('Location not found');
            }
        })
        .catch(error => {
            console.error('Error fetching location:', error);
        });
}

// Add Leaflet Draw controls to the map
const drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems
    },
    draw: {
        polygon: true,  // Allow polygons
        rectangle: true,  // Allow rectangles
        circle: false,  // Disable circles
        polyline: false,  // Disable polylines
        marker: false  // Disable markers
    }
});
map.addControl(drawControl);

// Handle drawing events
map.on(L.Draw.Event.CREATED, function (event) {
    const layer = event.layer;

    // Add the layer to the drawn items group
    drawnItems.addLayer(layer);

    // Capture the drawn shape's coordinates (polygon or rectangle)
    const coordinates = layer.getLatLngs()[0].map(coord => ({ lat: coord.lat, lon: coord.lng }));

    // Log the drawn shape's coordinates before sending to the backend
    console.log('Drawn Shape Coordinates:', coordinates);

    // Send the coordinates to the backend to suggest bin locations
    suggestBinLocations(coordinates);
});

// Function to call backend and place bins along the road and ensure no bins in water
function suggestBinLocations(coordinates) {
    fetch('/suggest-bins-along-road', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ coordinates })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const { suggestedBins } = data;

        // Clear previous markers (but keep drawn shapes)
        drawnItems.eachLayer(layer => {
            if (!(layer instanceof L.Polygon || layer instanceof L.Rectangle)) {
                map.removeLayer(layer);
            }
        });

        let lastBinPosition = null;

        // Add new markers for suggested bins every 200 meters and ensure no placement in water
        suggestedBins.forEach(bin => {
            const lat = bin.latitude;
            const lon = bin.longitude;

            // Filter bins within the drawn polygon
            if (!isPointInsidePolygon([lat, lon], coordinates)) {
                return;
            }

            // Place bins every 200 meters
            if (!lastBinPosition || calculateDistance(lastBinPosition.lat, lastBinPosition.lon, lat, lon) >= 200) {
                lastBinPosition = { lat, lon };

                // Use reverse geocoding to check if it's on land (avoid water)
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
                    .then(res => res.json())
                    .then(location => {
                        if (location.address.waterway || location.address.river || location.address.lake) {
                            console.log('Skipping water body location:', lat, lon);
                        } else if (location.address.road) {
                            L.marker([lat, lon]).addTo(map).bindPopup('Suggested Bin Location');
                        } else {
                            console.log('Skipping non-road location:', lat, lon);
                        }
                    })
                    .catch(error => console.error('Error checking land or water:', error));
            }
        });
    })
    .catch(error => {
        console.error('Error suggesting bin locations:', error);
        alert('Failed to suggest bin locations. Please check the server.');
    });
}

// Function to calculate distance between two coordinates (Haversine Formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radius of Earth in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // In meters
    return distance;
}

// Function to check if a point is inside a polygon (using Leaflet's LatLng functions)
function isPointInsidePolygon(point, polygon) {
    const poly = L.polygon(polygon);
    return poly.getBounds().contains(L.latLng(point[0], point[1]));
}
