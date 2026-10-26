import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Mail, Building2, Calendar } from 'lucide-react';
import { formatName } from '../utils/format';

export default function Profile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <span className="text-2xl font-bold">{formatName(user.name).charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">{formatName(user.name)}</h1>
            <p className="text-blue-100 text-sm">{user.department}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                user.role === 'SUPER_ADMIN' ? 'bg-purple-400/20 text-purple-200' :
                user.role === 'ADMIN' ? 'bg-amber-400/20 text-amber-200' : 
                'bg-blue-400/20 text-blue-200'
              }`}>
                {user.role === 'SUPER_ADMIN' ? '👑 Super Admin' : 
                 user.role === 'ADMIN' ? '🛡️ Admin' : '👤 Standard User'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <User className="w-4 h-4" />
          Account Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <User className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-semibold">Full Name</p>
              <p className="text-sm font-medium text-slate-800">{formatName(user.name)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Mail className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-semibold">Email</p>
              <p className="text-sm font-medium text-slate-800">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Building2 className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-semibold">Department</p>
              <p className="text-sm font-medium text-slate-800">{user.department}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Calendar className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-semibold">Member Since</p>
              <p className="text-sm font-medium text-slate-800">{user.createdAt}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-amber-800">Security Notice</h4>
            <p className="text-xs text-amber-700 mt-1">
              Passwords are securely hashed using Supabase Auth. Never share your password with anyone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
