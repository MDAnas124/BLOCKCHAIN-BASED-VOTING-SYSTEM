require('dotenv').config();
const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text) => {
    try {
        // Create reusable transporter
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // Send mail
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to,
            subject,
            text
        });

        console.log('Email sent successfully');
        
    } catch (error) {
        console.error('Send email error:', error);
        throw new Error('Failed to send email');
    }
};

module.exports = sendEmail;
