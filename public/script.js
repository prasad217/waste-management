// Initialize the map in the frontend
const map = L.map('map').setView([12.8234, 80.0458], 13); // Default to Potheri, Tamil Nadu, India
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let binMarkers = {};  // Store bin markers for easy search
let collectorLocation;  // Store the waste collector's current location

// Fetch existing bins from the server and display their names as fixed labels
fetch('/bins')
    .then(response => response.json())
    .then(bins => {
        console.log('Bins fetched:', bins); // Log the bins data for debugging
        bins.forEach(bin => {
            addBinWithFixedLabel(bin.latitude, bin.longitude, bin.name);
        });

        // Once bins are loaded, find the collector's location and calculate the shortest path
        getCollectorLocationAndCalculatePath(bins);
    })
    .catch(err => console.error('Error fetching bins:', err));

// Function to add a bin to the map with a fixed label
function addBinWithFixedLabel(lat, lon, name) {
    // Add marker for the bin
    const marker = L.marker([lat, lon]).addTo(map);
    
    // Create a fixed label using DivIcon
    const label = L.divIcon({
        className: 'bin-label',
        html: `<div><strong>${name}</strong></div>`,
        iconSize: [100, 40],
        iconAnchor: [50, 0]
    });

    // Bind the label as a DivIcon to the marker's location
    L.marker([lat, lon], { icon: label }).addTo(map);

    // Store for searching later
    binMarkers[name] = marker;
}

// Get the waste collector's current location and calculate the shortest path
function getCollectorLocationAndCalculatePath(bins) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            // Store the current location
            collectorLocation = [position.coords.latitude, position.coords.longitude];
            console.log('Collector location:', collectorLocation);

            // Call function to calculate and display the shortest path
            const binLocations = bins.map(bin => [bin.latitude, bin.longitude]);
            console.log('Bin locations:', binLocations);

            getShortestPath(collectorLocation, binLocations);
        }, error => {
            console.error('Error fetching the current location:', error);
        });
    } else {
        alert('Geolocation is not supported by this browser.');
    }
}


// OpenRouteService API to calculate the shortest path
function getShortestPath(collectorLocation, binLocations) {
    const apiKey = '5b3ce3597851110001cf62487b22337bf49342a2a61115c632172023';  // Replace with your OpenRouteService API key
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}`;

    // Prepare coordinates: start with the collector's location, followed by bins
    const coordinates = [[collectorLocation[1], collectorLocation[0]], [binLocations[0][1], binLocations[0][0]]]; // Only collector and first bin
    
    console.log("Collector Location (sent to API):", collectorLocation);  // Log collector's location
    console.log("First Bin Location (sent to API):", binLocations[0]);  // Log first bin location
    console.log("Coordinates sent to API:", coordinates);  // Log coordinates

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            coordinates: coordinates,
            format: 'json'  // Ensure the format is 'json', not 'geojson'
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log("API response:", data);  // Log the full API response
        
        if (data && data.routes && data.routes.length > 0) {
            const encodedGeometry = data.routes[0].geometry;

            // Decode the encoded polyline geometry using leaflet-polyline
            const decodedCoordinates = polyline.decode(encodedGeometry);  // 'polyline' is available globally now

            if (decodedCoordinates && decodedCoordinates.length > 0) {
                // Convert the decoded geometry into a format that Leaflet can display
                const route = L.polyline(decodedCoordinates.map(coord => [coord[0], coord[1]])).addTo(map);
                
                map.fitBounds(route.getBounds());  // Adjust map to fit the route
            } else {
                console.error('Invalid geometry in API response:', encodedGeometry);
                alert('No valid route could be calculated.');
            }
        } else {
            console.error('No valid route found or invalid API response:', data);
            alert('No route could be calculated. Please check the locations or API response.');
        }
    })
    .catch(error => {
        console.error('Error fetching the route:', error);
        alert('There was an error calculating the route. Please try again.');
    });
}
