// Initialize the map in the frontend
const map = L.map('map').setView([12.8234, 80.0458], 15); // Zoom level 15 for a closer view
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let binMarkers = {};  // Store bin markers for easy search
let currentFullBin = null; // Keep track of the currently full bin

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
    
    // Create a popup with a "Mark as Full" button
    const popupContent = `
        <div>
            <strong>${name}</strong>
            <button class="mark-full-btn" data-name="${name}">Mark as Full</button>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    
    // Store marker for future reference
    binMarkers[name] = marker;

    // Add event listener for "Mark as Full" button after popup opens
    marker.on('popupopen', () => {
        document.querySelector('.mark-full-btn').addEventListener('click', () => {
            markBinAsFull(name, marker);
        });
    });
}

// Function to mark a bin as full
function markBinAsFull(name, marker) {
    // If another bin is already marked as full, reset it
    if (currentFullBin) {
        currentFullBin.setIcon(new L.Icon.Default()); // Reset to the default marker icon
    }

    // Update the current full bin
    currentFullBin = marker;

    // Change the icon to indicate it is full
    const fullIcon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/2329/2329244.png', // Example full bin icon URL
        iconSize: [32, 32], // Adjust size
        iconAnchor: [16, 32], // Anchor at the bottom of the icon
    });

    marker.setIcon(fullIcon);

    // Notify the server that the bin is full
    notifyBinFull(name);
}

// Notify the server that a bin is marked as full
function notifyBinFull(binName) {
    fetch('/mark-bin-full', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ binName }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(`Bin "${binName}" has been marked as full.`);
            } else {
                alert('Error marking the bin as full.');
            }
        })
        .catch(err => console.error('Error marking bin as full:', err));
}
