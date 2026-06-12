import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path;

  // 🔥 Helper: Common classes for all links and buttons
  const baseClasses = "flex items-center gap-3 px-4 py-3 rounded-lg font-bold text-sm transition-all";
  const inactiveClasses = "text-gray-400 hover:bg-gray-800 hover:text-white";
  
  // Style for Active link (Blue for general, Red for accounts, etc.)
  const getActiveClasses = (path, color) => {
    if (isActive(path)) {
      return `bg-${color}-600 text-white shadow-lg`;
    }
    return inactiveClasses;
  };

  return (
    <>
      {isOpen && (
        <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300" />
      )}

      <div className={`h-screen w-64 bg-gray-900 text-white flex flex-col fixed left-0 top-0 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>

        <div className="p-6 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg"><span className="text-xl">⚡</span></div>
            <div>
              <h1 className="text-lg font-black text-white">EV Parts</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase">Shop Manager</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 text-xl p-1">✕</button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* Main Links */}
          <Link to="/" onClick={() => setIsOpen(false)} className={`${baseClasses} ${isActive('/') ? 'bg-blue-600 text-white' : inactiveClasses}`}>
            <span>📊</span> Dashboard
          </Link>

          <Link to="/billing" onClick={() => setIsOpen(false)} className={`${baseClasses} ${isActive('/billing') ? 'bg-blue-600 text-white' : inactiveClasses}`}>
            <span>🧾</span> Billing History
          </Link>

          <Link to="/stock" onClick={() => setIsOpen(false)} className={`${baseClasses} ${isActive('/stock') ? 'bg-blue-600 text-white' : inactiveClasses}`}>
            <span>📦</span> Stock Master
          </Link>

          {/* Accounts Section */}
          <div className="my-6 border-t border-gray-800 pt-4">
            <p className="px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Accounts & Dues</p>

            <Link to="/customer-ledger" onClick={() => setIsOpen(false)} className={`${baseClasses} ${isActive('/customer-ledger') ? 'bg-red-600 text-white' : inactiveClasses}`}>
              <span>📓</span> Khata Book
            </Link>

            <button onClick={() => { navigate('/expenses'); setIsOpen(false); }} className={`w-full ${baseClasses} ${isActive('/expenses') ? 'bg-red-600 text-white' : inactiveClasses}`}>
              <span>💸</span> Expense Tracker
            </button>

            <button onClick={() => { navigate('/item-report'); setIsOpen(false); }} className={`w-full ${baseClasses} ${isActive('/item-report') ? 'bg-blue-600 text-white' : inactiveClasses}`}>
              <span>📈</span> Part-wise Report
            </button>

            <button onClick={() => { navigate('/reports'); setIsOpen(false); }} className={`w-full ${baseClasses} ${isActive('/reports') ? 'bg-green-600 text-white' : inactiveClasses}`}>
              <span>📊</span> Tax & P&L Reports
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-800 bg-gray-900">
          <Link to="/settings" onClick={() => setIsOpen(false)} className={`${baseClasses} ${isActive('/settings') ? 'bg-gray-700 text-white' : inactiveClasses}`}>
            <span>⚙️</span> Settings
          </Link>
        </div>
      </div>
    </>
  );
};

export default Sidebar;