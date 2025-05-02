const jwt = require('jsonwebtoken');
const Voter = require('../models/Voter');

module.exports = async (req, res, next) => {
    // Basic error handler that always returns JSON
    const handleError = (status, message) => {
        return res.status(status).json({
            success: false,
            message: message
        });
    };

    try {
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        // Get token from header
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return handleError(401, 'Authorization header missing');
        }

        const token = authHeader.replace('Bearer ', '');
        if (!token) {
            return handleError(401, 'Token missing');
        }

        // Get secret key
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('JWT_SECRET is not defined');
            return handleError(500, 'Server configuration error');
        }
        
        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        } catch (jwtError) {
            console.error('JWT verification failed:', jwtError.message);
            return handleError(401, 'Invalid or expired token');
        }

        // Find user
        const user = await Voter.findById(decoded.id).select('-password');
        if (!user) {
            return handleError(401, 'User not found');
        }

        // Add user to request
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return handleError(500, 'Server authentication error');
    }
};
