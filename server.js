const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const axios = require('axios'); // For making API requests to ORS
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // Serve public folder

// MySQL Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) throw err;
    console.log('MySQL connected...');
});

const orsApiKey = "5b3ce3597851110001cf62487b22337bf49342a2a61115c632172023"; // Your ORS API key

// Session configuration
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Middleware to check if user is logged in as admin
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next(); // User is logged in as admin, allow access
    } else {
        res.redirect('/admin-login'); // Redirect to admin login page if not logged in
    }
}

// Middleware to check if user is logged in as waste collector
function isWasteCollector(req, res, next) {
    if (req.session.user && req.session.user.role === 'waste_collector') {
        next(); // User is logged in as waste collector, allow access
    } else {
        res.redirect('/waste-collector-login'); // Redirect to waste collector login page if not logged in
    }
}

// API to get the next bin name (based on current count)
app.get('/next-bin-name', (req, res) => {
    const query = "SELECT COUNT(*) AS binCount FROM bins";
    db.query(query, (err, results) => {
        if (err) throw err;
        const binCount = results[0].binCount;
        res.json({ nextBinName: `bin ${binCount + 1}` });
    });
});

// API to add a bin location
app.post('/add-bin', (req, res) => {
    const { latitude, longitude, name } = req.body;
    const query = "INSERT INTO bins (latitude, longitude, name) VALUES (?, ?, ?)";
    db.query(query, [latitude, longitude, name], (err, result) => {
        if (err) throw err;
        res.send({ success: true, message: 'Bin added successfully!' });
    });
});

// API to fetch all bin locations
app.get('/bins', (req, res) => {
    const query = "SELECT * FROM bins";
    db.query(query, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// API for waste collector to fetch all bin locations (for shortest path calculation)
app.get('/collector-bins', isWasteCollector, (req, res) => {
    const query = "SELECT * FROM bins";
    db.query(query, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});
app.post('/suggest-bins-along-road', async (req, res) => {
    try {
        const { coordinates } = req.body;

        console.log('Received coordinates:', coordinates);

        if (!coordinates || coordinates.length === 0) {
            return res.status(400).json({ error: 'No coordinates provided' });
        }

        // Convert coordinates to ORS-compatible format ([lon, lat])
        const orsCoordinates = coordinates.map(coord => [coord.lon, coord.lat]);

        console.log('Coordinates sent to ORS:', orsCoordinates);

        // ORS GeoJSON request for easier geometry handling
        const response = await axios.post(
            `https://api.openrouteservice.org/v2/directions/driving-car/geojson`,
            { coordinates: orsCoordinates },
            { headers: { 'Authorization': orsApiKey } }
        );

        // Ensure ORS returned valid data
        if (!response.data || !response.data.features || response.data.features.length === 0) {
            console.error('ORS response did not contain valid routes:', response.data);
            return res.status(500).json({ error: 'No routes found in ORS response' });
        }

        // Get the route geometry from the GeoJSON response
        const routeCoordinates = response.data.features[0].geometry.coordinates;

        // Suggest bin locations along the roads
        const suggestedBins = routeCoordinates.map(coord => ({
            latitude: coord[1],
            longitude: coord[0]
        }));

        res.json({ suggestedBins });
    } catch (error) {
        console.error("Error suggesting bin locations:", error.message);
        res.status(500).json({ error: 'Failed to suggest bin locations' });
    }
});


// Serve the home.html file (login links for admin and waste collector)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Admin login page
app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html')); // Admin login page
});

// Waste Collector login page
app.get('/waste-collector-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'waste-collector-login.html')); // Waste collector login page
});

// Admin dashboard route (protected by isAdmin middleware)
app.get('/admin-dashboard', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // Admin dashboard is now index.html
});

// Waste collector dashboard route (protected by isWasteCollector middleware)
app.get('/waste-collector-dashboard', isWasteCollector, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'waste-collector-dashboard.html')); // Waste collector dashboard
});

// Serve the service.html file
app.get('/service', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'service.html')); // Service page
});

// Signup form submission handler
app.post('/signup', (req, res) => {
    const { username, password, role } = req.body;

    // Check if the username already exists
    const checkUserQuery = "SELECT * FROM users WHERE username = ?";
    db.query(checkUserQuery, [username], (err, result) => {
        if (err) throw err;

        if (result.length > 0) {
            res.send('Username already exists. Please choose another.');
        } else {
            // Insert new user into the database
            const insertUserQuery = "INSERT INTO users (username, password, role) VALUES (?, ?, ?)";
            db.query(insertUserQuery, [username, password, role], (err, result) => {
                if (err) throw err;
                res.send('Sign up successful! You can now log in.');
            });
        }
    });
});

// Handle admin login
app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    const query = "SELECT * FROM users WHERE username = ? AND role = 'admin'";

    db.query(query, [username], (err, result) => {
        if (err) throw err;
        if (result.length > 0) {
            if (password === result[0].password) { // Hash passwords in production!
                req.session.user = result[0]; // Save user to session
                res.redirect('/admin-dashboard'); // Redirect to admin dashboard
            } else {
                res.send('Invalid password');
            }
        } else {
            res.send('No admin user found');
        }
    });
});

// Handle waste collector login
app.post('/waste-collector-login', (req, res) => {
    const { username, password } = req.body;
    const query = "SELECT * FROM users WHERE username = ? AND role = 'waste_collector'";

    db.query(query, [username], (err, result) => {
        if (err) throw err;
        if (result.length > 0) {
            if (password === result[0].password) { // Hash passwords in production!
                req.session.user = result[0]; // Save user to session
                res.redirect('/waste-collector-dashboard'); // Redirect to waste collector dashboard
            } else {
                res.send('Invalid password');
            }
        } else {
            res.send('No waste collector found');
        }
    });
});

// Start the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
