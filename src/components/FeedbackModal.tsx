import React, { useState } from 'react';
import { Star, X, Send, Mail, User, MessageSquare, CheckCircle2 } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: string;
}

const TARGET_GMAIL = 'innocent.aryan206@gmail.com';
const TARGET_NAME = 'Yaaro Ka Yaar';

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const starLabels: Record<number, string> = {
    1: 'Poor / सुधार चाहिए',
    2: 'Fair / ठीक-ठाक',
    3: 'Good / अच्छा',
    4: 'Very Good / बढ़िया',
    5: 'Excellent! ★★★★★',
  };

  const quickTags = [
    '⚡ Fast',
    '📺 Great Live TV',
    '🛠 Feature Suggestion',
    '🐞 Bug Report',
  ];

  const handleAddTag = (tag: string) => {
    setMessage((prev) => (prev ? `${prev} [${tag}]` : `[${tag}] `));
  };

  const getEmailBody = () => {
    return `Hello Yaaro Ka Yaar Stream Team,

Here is my feedback for the IPTV app:

--------------------------------------------------
★ Star Rating: ${rating} / 5 (${starLabels[rating] || ''})
👤 Full Name: ${fullName}
📧 Email: ${email ? email : 'Not provided (Optional)'}
📅 Date & Time: ${new Date().toLocaleString()}
--------------------------------------------------

Feedback Message / Notes:
${message}

--------------------------------------------------
Sent via Yaaro Ka Yaar Stream IPTV App Feedback Form (SMTP)
--------------------------------------------------`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !message.trim() || rating === 0) return;

    setIsSubmitting(true);

    try {
      // 1. Send feedback via backend SMTP Email Service
      const res = await fetch('/api/feedback/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim() || undefined,
          rating,
          message: message.trim(),
        }),
      });

      await fetch('/api/feedback/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim() || undefined,
          rating,
          message: message.trim(),
        }),
      }).catch(() => {});

      setIsSuccess(true);
    } catch {
      setIsSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      {/* Compact Dialog Container */}
      <div
        className="relative w-full max-w-[390px] bg-white rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header Banner */}
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gradient-to-r from-rose-600 via-indigo-600 to-indigo-700 text-white flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-white/15 backdrop-blur-xs flex items-center justify-center border border-white/20 shrink-0">
              <MessageSquare className="w-3.5 h-3.5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold tracking-tight leading-tight">
                App Feedback & Rating
              </h2>
              <p className="text-[10px] text-white/80 font-medium leading-tight">
                Direct to {TARGET_NAME}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clean & Minimal Success View */}
        {isSuccess ? (
          <div className="p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Green Checkmark Icon */}
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            {/* Title & Message */}
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
                धन्यवाद! Feedback & Notes Submitted
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                अपनी फीडबैक देने के लिए आपका बहुत-बहुत धन्यवाद!
              </p>
            </div>

            {/* Single Primary Close Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-indigo-600/20 transition-all cursor-pointer active:scale-[0.98]"
              >
                Close / बंद करें
              </button>
            </div>
          </div>
        ) : (
          /* Compact Form View */
          <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 space-y-2.5">
            {/* 1. Five Star Rating System */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  1. Rating / रेटिंग <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.2 rounded-full">
                  {starLabels[hoverRating ?? rating]}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg">
                {[1, 2, 3, 4, 5].map((starNum) => {
                  const isFilled = (hoverRating ?? rating) >= starNum;
                  return (
                    <button
                      key={starNum}
                      type="button"
                      onClick={() => setRating(starNum)}
                      onMouseEnter={() => setHoverRating(starNum)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="p-0.5 hover:scale-120 transition-transform cursor-pointer focus:outline-none"
                      aria-label={`${starNum} stars`}
                    >
                      <Star
                        className={`w-5 h-5 sm:w-5.5 sm:h-5.5 transition-colors ${
                          isFilled
                            ? 'text-amber-400 fill-amber-400 drop-shadow-2xs'
                            : 'text-slate-300 hover:text-amber-200'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2 & 3: Full Name and Optional Email side-by-side in 2-column grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Full Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5 uppercase tracking-wide">
                  Name / नाम <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5 uppercase tracking-wide">
                  Email <span className="text-[9px] text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@gmail.com"
                    className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* 4. Feedback Message Textarea */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">
                  Message / संदेश <span className="text-rose-500">*</span>
                </label>
                {/* Quick Tag Suggestions */}
                <div className="flex items-center gap-1">
                  {quickTags.slice(0, 3).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleAddTag(tag)}
                      className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200/80 transition-colors cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                required
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your feedback, suggestions, or feature requests..."
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none shadow-2xs"
              />
            </div>

            {/* 5. Compact Action Buttons */}
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !fullName.trim() || !message.trim()}
                className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending...' : `Send to ${TARGET_NAME}`}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
