import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Shield, Users } from 'lucide-react';

export default function PublicDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Building2 className="w-9 h-9 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">DILG Siquijor Task Tracker</h1>
          <p className="text-xl text-blue-200 mb-8">Region NIR • Siquijor Province</p>
          <p className="text-blue-100 max-w-2xl mx-auto mb-12">
            Real-time monitoring of departmental programs, task completion, and performance metrics 
            for DILG Siquijor Provincial Office and all municipalities.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-lg transition-all shadow-lg"
            >
              <Shield className="w-5 h-5" />
              Staff Login
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-all border border-white/20"
            >
              <Users className="w-5 h-5" />
              Register
            </Link>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold mb-2">📊 Real-time Dashboard</h3>
            <p className="text-blue-200 text-sm">Monitor task completion and department performance in real-time.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold mb-2">🔄 Recurring Tasks</h3>
            <p className="text-blue-200 text-sm">Automatic generation of recurring task instances based on schedules.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold mb-2">📁 File Management</h3>
            <p className="text-blue-200 text-sm">Upload and manage task outputs with cloud storage.</p>
          </div>
        </div>

        <footer className="mt-16 text-center text-sm text-blue-200/60">
          <p>© 2025 DILG Region NIR • Siquijor Provincial Office</p>
          <p className="mt-1">Republic of the Philippines</p>
        </footer>
      </div>
    </div>
  );
}
