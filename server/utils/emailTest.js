require('dotenv').config();
const sendEmail = require('./email');

async function testEmail() {
  try {
    await sendEmail(
      process.env.SMTP_USER,
      'Test Email from Voting System',
      'This is a test email to verify SMTP configuration.'
    );
    console.log('Test email sent successfully');
  } catch (error) {
    console.error('Test email failed:', error);
  }
}

testEmail();
