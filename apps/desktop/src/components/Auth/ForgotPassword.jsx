import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function ForgotPassword({ onBack }) {
  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'password'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { forgotPassword, verifyOtp, resetPasswordOtp, isLoading } = useAuthStore();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    const result = await forgotPassword(email);
    if (result.success) {
      setStep('otp');
      toast.success('OTP sent to your email!');
    } else {
      toast.error(result.error);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      toast.error('Code is required');
      return;
    }

    const result = await verifyOtp(email, otp);
    if (result.success) {
      setStep('password');
      toast.success('Code verified!');
    } else {
      toast.error(result.error);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      toast.error('New password is required');
      return;
    }

    const result = await resetPasswordOtp(email, otp, newPassword);
    if (result.success) {
      toast.success('Password reset successful! Please login.');
      onBack();
    } else {
      toast.error(result.error);
    }
  };

  if (step === 'email') {
    return (
      <div className="space-y-10 animate-in">
        <div className="space-y-1.5 text-center lg:text-left">
          <h1 className="text-2xl font-bold text-white tracking-tight pb-2 leading-normal">Reset password</h1>
          <p className="text-slate-500 text-[13px]">Enter your email and we'll send you a 6-digit verification code.</p>
        </div>

        <form onSubmit={handleSendOtp} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] ml-0.5">Email Address</label>
            <input
              className="w-full h-11 px-4 bg-white/[0.02] border border-white/5 rounded-lg text-white placeholder:text-slate-700 focus:border-white/20 focus:bg-white/[0.04] outline-none transition-all duration-200 text-sm"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="w-full h-11 btn-primary" disabled={isLoading}>
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Send Code'}
          </button>

          <button type="button" onClick={onBack} className="w-full text-[11px] text-slate-500 hover:text-white font-bold uppercase tracking-[0.1em] transition-colors">
            Back to login
          </button>
        </form>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="space-y-10 animate-in">
        <div className="space-y-1.5 text-center lg:text-left">
          <h1 className="text-2xl font-bold text-white tracking-tight pb-2 leading-normal">Verify Code</h1>
          <p className="text-slate-500 text-[13px]">We've sent a code to <span className="text-slate-300 font-medium">{email}</span>.</p>
        </div>

        <form onSubmit={handleVerifyOtp} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] ml-0.5">Verification Code</label>
            <input
              className="w-full h-11 px-4 bg-white/[0.02] border border-white/5 rounded-lg text-white placeholder:text-slate-700 focus:border-white/20 focus:bg-white/[0.04] outline-none transition-all duration-200 text-sm text-center tracking-[0.5em] font-bold"
              type="text"
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
            />
          </div>

          <button type="submit" className="w-full h-11 btn-primary" disabled={isLoading}>
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Verify Code'}
          </button>

          <div className="flex flex-col space-y-4">
            <button type="button" onClick={() => setStep('email')} className="w-full text-[11px] text-slate-500 hover:text-white font-bold uppercase tracking-[0.1em] transition-colors">
              Resend code
            </button>
            <button type="button" onClick={onBack} className="w-full text-[11px] text-slate-500 hover:text-white font-bold uppercase tracking-[0.1em] transition-colors">
              Back to login
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in">
      <div className="space-y-1.5 text-center lg:text-left">
        <h1 className="text-2xl font-bold text-white tracking-tight pb-2 leading-normal">New Password</h1>
        <p className="text-slate-500 text-[13px]">Enter a secure new password for your account.</p>
      </div>

      <form onSubmit={handleResetPassword} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] ml-0.5">New Password</label>
          <input
            className="w-full h-11 px-4 bg-white/[0.02] border border-white/5 rounded-lg text-white placeholder:text-slate-700 focus:border-white/20 focus:bg-white/[0.04] outline-none transition-all duration-200 text-sm"
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
          />
        </div>

        <button type="submit" className="w-full h-11 btn-primary" disabled={isLoading}>
          {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Reset Password'}
        </button>

        <button type="button" onClick={onBack} className="w-full text-[11px] text-slate-500 hover:text-white font-bold uppercase tracking-[0.1em] transition-colors">
          Back to login
        </button>
      </form>
    </div>
  );
}
