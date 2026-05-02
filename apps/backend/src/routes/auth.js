import express from 'express';
import axios from 'axios';
import User from '../../models/User.js';
import OtpSession from '../../models/OtpSession.js';
import { signToken, authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the user
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         avatar:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and user management
 */

// POST /api/auth/login
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login an employee
 *     description: Authenticates a user using email and password. On success, returns a JWT token.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email before logging in', unverified: true });
    }

    // 1. Check MongoDB password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      // 2. If MongoDB fails, check Firebase (This handles the "Reset Password" cases)
      const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
      if (FIREBASE_API_KEY) {
        try {
          console.log(`[Login] 🔄 Password mismatch in MongoDB. Checking Firebase...`);
          const firebaseRes = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
            {
              email: email.toLowerCase(),
              password: password,
              returnSecureToken: true
            }
          );

          if (firebaseRes.data) {
            console.log(`[Login] ✅ Firebase verified new password. Syncing to MongoDB...`);
            user.password = password; 
            await user.save();
          }
        } catch (firebaseError) {
          console.log(`[Login] ❌ Firebase also rejected credentials`);
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      } else {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    const token = signToken({ id: user._id, email: user.email, name: user.name });

    res.json({ user: user.toSafeObject(), token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again later.' });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    let { accessToken, code, redirectUri } = req.body;

    // Desktop apps must use the 'code' exchange flow
    if (code) {
      if (!redirectUri) return res.status(400).json({ error: 'Redirect URI is required for code exchange' });

      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });
      accessToken = tokenResponse.data.access_token;
    }

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token or code is required' });
    }

    // Fetch user info from Google
    const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const { sub: googleId, email, name, picture: avatar } = response.data;

    // Use Atomic Upsert to prevent race conditions (Duplicate Key Errors)
    const user = await User.findOneAndUpdate(
      { $or: [{ googleId }, { email: email.toLowerCase() }] },
      {
        $set: { googleId, avatar }, // Always link/update these
        $setOnInsert: { name, email: email.toLowerCase(), isVerified: true } // Only if new
      },
      { upsert: true, new: true, runValidators: true }
    );

    const token = signToken({ id: user._id, email: user.email, name: user.name });
    res.json({ user: user.toSafeObject(), token });
  } catch (error) {
    console.error('Google Auth error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // 1. Generate OTP for email verification
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Save to OtpSession (do NOT add to User/Firebase yet)
    await OtpSession.create({
      name,
      email: email.toLowerCase(),
      password,
      otp: otpCode,
    });

    // 4. Send Email
    const { sendEmail } = await import('../lib/mailer.js');
    await sendEmail({
      to: email.toLowerCase(),
      subject: 'Verify your PayloadX account',
      text: `Your verification code is: ${otpCode}`,
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; background: #07090D; color: #D0D4DE; padding: 40px; border-radius: 12px; border: 1px solid #1E2530; text-align: center;">
          <h2 style="color: #ffffff; margin-bottom: 20px;">Welcome to PayloadX</h2>
          <p style="color: #7A8090; font-size: 14px; margin-bottom: 30px;">Enter this code to verify your email address:</p>
          <div style="background: #111827; border: 1px solid #1E2530; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; color: #ffffff; letter-spacing: 0.2em; margin-bottom: 30px;">
            ${otpCode}
          </div>
        </div>
      `
    });

    res.status(201).json({ 
      message: 'User created. Please verify your email with the OTP sent.',
      email: email.toLowerCase()
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed. Please try again later.' });
  }
});

// POST /api/auth/verify-signup
router.post('/verify-signup', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    // 1. Find the pending session
    const session = await OtpSession.findOne({
      email: email.toLowerCase(),
      otp
    });

    if (!session) return res.status(400).json({ error: 'Invalid or expired verification code' });

    // 2. Create the actual User now
    const user = await User.create({
      name: session.name,
      email: session.email,
      password: session.password, // This is already hashed by OtpSession
      isVerified: true
    });

    // 3. Create user in Firebase
    const admin = (await import('../lib/firebase.js')).default;
    try {
      await admin.auth().createUser({
        uid: user._id.toString(),
        email: user.email,
        password: session.password,
        displayName: user.name
      });
    } catch (fbError) {
      console.error('Firebase user creation failed:', fbError.message);
    }

    // 4. Delete the session
    await OtpSession.deleteOne({ _id: session._id });

    const token = signToken({ id: user._id, email: user.email, name: user.name });
    res.json({ message: 'Email verified successfully', user: user.toSafeObject(), token });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    console.error('GET /auth/me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/auth/me
router.put('/me', authenticate, async (req, res) => {
  try {
    const { name, avatar } = req.body;

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { ...(name && { name }), ...(avatar !== undefined && { avatar }) },
      { new: true, runValidators: true }
    );

    res.json({ user: updated.toSafeObject() });
  } catch (err) {
    console.error('PUT /auth/me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'No account found with this email' });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otpCode;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    const { sendEmail } = await import('../lib/mailer.js');
    await sendEmail({
      to: email.toLowerCase(),
      subject: 'Your Password Reset Code',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; background: #07090D; color: #D0D4DE; padding: 40px; border-radius: 12px; border: 1px solid #1E2530; text-align: center;">
          <h2 style="color: #ffffff; margin-bottom: 20px;">Reset Code</h2>
          <div style="background: #111827; border: 1px solid #1E2530; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; color: #ffffff; letter-spacing: 0.2em; margin-bottom: 30px;">
            ${otpCode}
          </div>
          <p style="color: #6B7280; font-size: 11px;">Expires in 10 minutes.</p>
        </div>
      `
    });

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('[Forgot Password] ❌ Error:', error.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp (Step 2 of Forgot Password)
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({
      email: email.toLowerCase(),
      otp,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired code' });
    res.json({ success: true, message: 'Code verified' });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/reset-password-otp (Step 3 of Forgot Password)
router.post('/reset-password-otp', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({
      email: email.toLowerCase(),
      otp,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired session' });

    // Sync with Firebase
    const admin = (await import('../lib/firebase.js')).default;
    try {
      const firebaseUser = await admin.auth().getUserByEmail(email.toLowerCase());
      await admin.auth().updateUser(firebaseUser.uid, { password: newPassword });
    } catch (fbError) {
      console.error('Firebase password sync failed:', fbError.message);
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('[Reset Password] ❌ Error:', error.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
