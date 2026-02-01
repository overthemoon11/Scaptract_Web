import nodemailer, { Transporter } from 'nodemailer';

interface EmailResult {
  success: boolean;
  devMode?: boolean;
  error?: string;
}

// Create transporter for email sending
const createTransporter = (): Transporter => {
  return nodemailer.createTransporter({
    service: 'gmail', // You can change this to your preferred email service
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Generate 6-digit OTP
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email (with dev mode bypass)
export const sendOTPEmail = async (
  email: string,
  otp: string,
  name: string,
  type: 'registration' | 'password_reset' = 'registration'
): Promise<EmailResult> => {
  // Check if in development mode
  if (process.env.DEVMODE === 'true') {
    console.log('🔧 DEVELOPMENT MODE: OTP email bypassed');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 OTP Code: ${otp}`);
    console.log(`👤 Name: ${name}`);
    console.log(`📝 Type: ${type}`);
    console.log('ℹ️  In dev mode, any 6-digit number will be accepted for OTP verification');
    return { success: true, devMode: true };
  }

  try {
    const transporter = createTransporter();
    
    // Different email content based on type
    const isPasswordReset = type === 'password_reset';
    const subject = isPasswordReset ? 'Password Reset - Your Security Code' : 'Email Verification - Your OTP Code';
    const heading = isPasswordReset ? 'Password Reset Request' : 'Email Verification';
    const message = isPasswordReset 
      ? 'You requested a password reset. Please use the following security code to reset your password:'
      : 'Thank you for registering! Please use the following OTP code to verify your email address:';
    const disclaimer = isPasswordReset
      ? 'If you didn\'t request this password reset, please ignore this email and contact support if you have concerns.'
      : 'If you didn\'t request this verification, please ignore this email.';
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${heading}</h2>
          <p>Hi ${name},</p>
          <p>${message}</p>
          <div style="background-color: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: ${isPasswordReset ? '#dc3545' : '#007bff'}; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>${disclaimer}</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true, devMode: false };
  } catch (error: any) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message, devMode: false };
  }
};

