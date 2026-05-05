import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';

export const configurePassport = () => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            let user = await User.findOne({ googleId: profile.id });
            
            if (!user) {
              // Check if user with same email exists
              const email = profile.emails?.[0]?.value;
              if (email) {
                user = await User.findOne({ email });
              }

              if (user) {
                user.googleId = profile.id;
                user.avatar = profile.photos?.[0]?.value || user.avatar;
                await user.save();
              } else {
                user = new User({
                  name: profile.displayName,
                  email: email || '',
                  googleId: profile.id,
                  avatar: profile.photos?.[0]?.value,
                });
                await user.save();
              }
            }
            
            return done(null, user);
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  }

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};
