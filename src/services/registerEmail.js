const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendVerificationEmail = (to, token) => {
    const url = `http://localhost:3000/auth/verify?token=${token}`;
    const mailOptions = {
        from: process.env.EMAIL_SENDER,
        to: to,
        subject: 'Account Verification',
        html: `Please click this link to verify your account: <a href="${url}">${url}</a>`,
    };

    return transporter.sendMail(mailOptions);
};

module.exports = {
    sendVerificationEmail,
};
