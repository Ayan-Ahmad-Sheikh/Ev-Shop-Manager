import React from 'react';
import { Link } from 'react-router-dom';

const Welcome = () => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* NAVBAR */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="font-black text-xl text-gray-900 tracking-tight">EVSmart<span className="text-blue-600">Bill</span></span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors">
              Login
            </Link>
            <Link to="/signup" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md transition-all">
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div className="relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight mb-6">
            Smart Billing & Inventory for <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              EV Spare Parts Business
            </span>
          </h1>
          <p className="mt-4 text-lg md:text-xl text-gray-500 max-w-2xl mx-auto font-medium">
            India's most advanced cloud software to manage your EV controllers, chargers, stock, customer udhar khata, and GST billing. 100% Secure & Mobile Ready.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl text-lg font-black shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
              Launch Your Shop 🚀
            </Link>
            <Link to="/login" className="bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-200 px-8 py-3.5 rounded-xl text-lg font-black shadow-sm transition-all flex items-center justify-center">
              Existing User Login
            </Link>
          </div>
        </div>
      </div>

      {/* FEATURES SECTION */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-black text-gray-900">Everything your EV shop needs</h2>
          <p className="mt-2 text-gray-500 font-medium">Built by EV experts, for EV experts.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-3xl mb-6">🧾</div>
            <h3 className="text-xl font-black text-gray-900 mb-2">1-Click GST Invoicing</h3>
            <p className="text-gray-500 font-medium text-sm leading-relaxed">
              Generate B2B and B2C bills instantly. Share professional PDFs directly to your customer's WhatsApp in seconds.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-3xl mb-6">📦</div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Live Stock Tracking</h3>
            <p className="text-gray-500 font-medium text-sm leading-relaxed">
              Never run out of parts. Get low-stock alerts for controllers and chargers. Auto-deduct stock on every sale.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center text-3xl mb-6">🤝</div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Udhar Khata Book</h3>
            <p className="text-gray-500 font-medium text-sm leading-relaxed">
              Maintain split payments, track pending customer dues securely, and never lose your hard-earned money.
            </p>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-gray-900 py-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm font-medium text-gray-400">
          <p>© {new Date().getFullYear()} EVSmartBill SaaS. Built for the EV Revolution.</p>
        </div>
      </footer>
    </div>
  );
};

export default Welcome;