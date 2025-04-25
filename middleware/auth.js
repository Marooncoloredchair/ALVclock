const adminCredentials = {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'alvarez2024'
};

function basicAuth(req, res, next) {
    // Make the login page accessible
    if (req.path === '/admin/login') {
        return next();
    }

    // check for basic auth header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access"');
        return res.status(401).json({ message: 'Authentication required' });
    }

    // verify auth credentials
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (username === adminCredentials.username && password === adminCredentials.password) {
        // attach user to request object
        req.user = username;
        return next();
    }

    // authentication failed
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access"');
    return res.status(401).json({ message: 'Invalid credentials' });
}

module.exports = basicAuth; 