import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Building2, UserPlus, Eye, EyeOff, ArrowLeft, AlertCircle, Shield } from 'lucide-react';
import { DEPARTMENTS } from '../data/mockData';
import { formatNameInput } from '../utils/format';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [isFirstUser, setIsFirstUser] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: DEPARTMENTS[0],
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);

  useEffect(() => {
    // Check if this is the first user in Supabase (will become Super Admin)
    checkFirstUser();
  }, []);

  async function checkFirstUser() {
    try {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error('[Register] Error checking first user:', JSON.stringify(error));
        // If RLS is blocking, ask the serverless bootstrap status endpoint
        // (service role key) instead of guessing — it only returns aggregates.
        if (error.code === '42501' || error.code === 'PGRST301' || !error.message) {
          try {
            const res = await fetch('/api/admin-bootstrap-status');
            if (res.ok) {
              const j = await res.json();
              setIsFirstUser(Number(j.userCount ?? 0) === 0);
              return;
            }
          } catch {
            /* endpoint not deployed yet */
          }
          console.warn('[Register] Could not determine user count. Assuming first user.');
          setIsFirstUser(true);
        }
        return;
      }
      
      console.log('[Register] User count:', count);
      setIsFirstUser(count === 0);
    } catch (err) {
      console.error('[Register] Exception in checkFirstUser:', err);
      // Assume first user on error
      setIsFirstUser(true);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Auto-format name field with proper capitalization
    const formattedValue = name === 'name' ? formatNameInput(value) : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: formattedValue,
    }));
    setError(''); // Clear error on input
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Name is required';
    if (!formData.email.trim()) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) return 'Invalid email format';
    if (!formData.password) return 'Password is required';
    if (formData.password.length < 6) return 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    if (!formData.department) return 'Department is required';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      // Role tiering: first-ever account becomes SUPER_ADMIN, everyone else
      // registers as STANDARD. Admins are created/promoted by a Super Admin
      // in User Management — never self-registered.
      let result = await register(
        formData.email,
        formData.password,
        formData.name,
        formData.department
      );

      // "Delete existing to replace new": if the email is already taken by the
      // caller's own (signed-in) standard account, offer to wipe & re-create it.
      if (
        !result.success &&
        /already exists/i.test(result.error || '') &&
        !replaceExisting
      ) {
        setReplaceExisting(true);
        setError(
          (result.error || 'An account with this email already exists.') +
            ' Tick "Replace my existing account" below and press Create Account again to delete it and start fresh.'
        );
        setLoading(false);
        return;
      }

      if (result.success) {
        if (isFirstUser) {
          // First Super Admin - show welcome message and redirect to dashboard
          navigate('/dashboard?welcome=superadmin');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Back to public */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Public Dashboard</span>
        </Link>

        {/* Register Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Building2 className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Create Account</h1>
            <p className="text-sm text-slate-500 mt-1">Register for DILG Task Tracker</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                placeholder="Juan Dela Cruz"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                placeholder="your.email@dilg.gov.ph"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm pr-10"
                  placeholder="Minimum 6 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm pr-10"
                  placeholder="Re-enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Department *
              </label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                required
              >
                {DEPARTMENTS.map((dept: string) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {isFirstUser ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">First Super Admin Account</p>
                    <p className="text-xs text-amber-700 mt-1">
                      You're setting up the system! This account will automatically be assigned the{' '}
                      <strong>Super Admin</strong> role with full system access. After this, create
                      <strong> Admin</strong> accounts from User Management, then register standard users.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Note:</strong> All new accounts are created as <strong>Standard Users</strong>.
                  A Super Admin can upgrade trusted accounts to <strong>Admin</strong> from the
                  User Management page.
                </p>
              </div>
            )}

            {replaceExisting && (
              <label className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-red-600 border-red-300 rounded focus:ring-red-500"
                />
                <span className="text-xs text-red-700">
                  <strong>Replace my existing account.</strong> Deletes the current Standard-user
                  profile for this email (tasks, bookmarks and notifications included) and creates a
                  fresh account with the details above.
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-1">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </Link>
            </p>
            <p className="text-xs text-slate-500">
              Forgot your password?{' '}
              <Link to="/login?recover=1" className="text-blue-600 hover:text-blue-700 font-medium">
                Recover it on the sign-in page
              </Link>{' '}
              or contact your Admin.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-blue-200/60 mt-6">
          DILG Region NIR • Siquijor Province
        </p>
      </div>
    </div>
  );
}
