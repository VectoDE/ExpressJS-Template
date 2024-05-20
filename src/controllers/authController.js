const { generateToken, verifyToken } = require('../middleware/auth');
const userModel = require('../database/models/usersModel');
const { sendVerificationEmail } = require('../services/registerEmail');

const register = async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const newUser = await userModel.create({ username, email, password });
        const token = generateVerificationToken(newUser);

        await sendVerificationEmail(email, token);

        res.redirect('/login');

        res.status(201).json({ message: 'User registered successfully. Please check your email to verify your account.' });
    } catch (error) {
        res.status(500).json({ error: 'Error registering user' });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await userModel.findOne({ email });

        if (user && user.password === password) {
            if (!user.isVerified) {
                return res.status(401).json({ error: 'Please verify your email to login' });
            }

            const token = generateToken({ user: { id: user._id, username: user.username } });

            res.status(200).json({ message: 'User logged in successfully', token });
        } else {
            res.status(401).json({ error: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error logging in user' });
    }
};

const verifyEmail = async (req, res) => {
    const { token } = req.query;
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(400).json({ error: 'Invalid or expired token' });
    }

    try {
        await userModel.findByIdAndUpdate(decoded.id, { isVerified: true });
        res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
    } catch (error) {
        res.status(500).json({ error: 'Error verifying email' });
    }
};

module.exports = {
    register,
    login,
    verifyEmail,
};
