const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));  // Serve public folder

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

// Session configuration
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Middleware to check if user is logged in as admin
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();  // User is logged in as admin, allow access
    } else {
        res.redirect('/admin-login');  // Redirect to admin login page if not logged in
    }
}

// Middleware to check if user is logged in as waste collector
function isWasteCollector(req, res, next) {
    if (req.session.user && req.session.user.role === 'waste_collector') {
        next();  // User is logged in as waste collector, allow access
    } else {
        res.redirect('/waste-collector-login');  // Redirect to waste collector login page if not logged in
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

// Serve the home.html file (login links for admin and waste collector)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Admin login page
app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));  // Admin login page
});

// Waste Collector login page
app.get('/waste-collector-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'waste-collector-login.html'));  // Waste Collector login page
});

// Handle login for both Admin and Waste Collector
app.post('/login', (req, res) => {
    const { username, password, role } = req.body;
    const query = "SELECT * FROM users WHERE username = ? AND role = ?";
    
    db.query(query, [username, role], (err, result) => {
        if (err) throw err;
        if (result.length > 0) {
            if (password === result[0].password) {  // In production, hash passwords
                req.session.user = result[0];  // Save user to session
                if (role === 'admin') {
                    res.redirect('/admin-dashboard');
                } else if (role === 'waste_collector') {
                    res.redirect('/waste-collector-dashboard');
                }
            } else {
                res.send('Invalid password');
            }
        } else {
            res.send('No user found');
        }
    });
});

// Admin dashboard route (now serves index.html as the admin dashboard)
app.get('/admin-dashboard', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));  // Admin dashboard is now index.html
});

// Waste collector dashboard route (protected by isWasteCollector middleware)
app.get('/waste-collector-dashboard', isWasteCollector, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'waste-collector-dashboard.html'));  // Waste collector dashboard
});

app.get('/signup', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});


// Handle signup form submission
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
app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    const query = "SELECT * FROM users WHERE username = ? AND role = 'admin'";
    
    db.query(query, [username], (err, result) => {
        if (err) throw err;
        if (result.length > 0) {
            if (password === result[0].password) {  // Hash passwords in production!
                req.session.user = result[0];  // Save user to session
                res.redirect('/admin-dashboard');  // Redirect to admin dashboard
            } else {
                res.send('Invalid password');
            }
        } else {
            res.send('No admin user found');
        }
    });
});

// Handle waste collector login specifically
app.post('/waste-collector-login', (req, res) => {
    const { username, password } = req.body;
    const query = "SELECT * FROM users WHERE username = ? AND role = 'waste_collector'";
    
    db.query(query, [username], (err, result) => {
        if (err) throw err;
        if (result.length > 0) {
            if (password === result[0].password) {  // Hash passwords in production!
                req.session.user = result[0];  // Save user to session
                res.redirect('/waste-collector-dashboard');  // Redirect to waste collector dashboard
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
