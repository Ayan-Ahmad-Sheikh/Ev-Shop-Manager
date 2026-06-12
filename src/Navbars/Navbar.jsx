import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../Firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const Navbar = ({ setSidebarOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [shopName, setShopName] = useState('');

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return '📊 Dashboard';
      case '/billing': return '🧾 Billing & History';
      case '/new-bill': return '🧾 Create New Bill';
      case '/stock': return '📦 Stock Master';
      case '/customer-ledger': return '📓 Khata Book';
      case '/settings': return '⚙️ Settings';
      default:
        if (location.pathname.includes('/stock-details')) return '👁 Item Details';
        return 'Shop Manager';
    }
  };

  const currentUser = auth.currentUser;

  // 👉 Firestore se Shop Name nikalna taaki Avatar ban sake
  useEffect(() => {
    const fetchShopDetails = async () => {
      try {
        const docRef = doc(db, "settings", "shopDetails");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().shopName) {
          setShopName(docSnap.data().shopName);
        }
      } catch (error) {
        console.error("Error fetching shop details for navbar:", error);
      }
    };
    fetchShopDetails();
  }, [location.pathname]);

  // 👉 LOGIC: Agar Google photo hai toh theek, nahi toh dukan ke naam ka pehla akshar
  const displayName = shopName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Shop Admin';
  const firstLetter = displayName[0].toUpperCase();

  return (
    <header className="h-16 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">

      {/* MOBILE HAMBURGER BUTTON */}
      <div className="md:hidden flex items-center mr-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-gray-600 hover:text-blue-600 text-2xl p-1 active:scale-95 transition-transform"
        >
          ☰
        </button>
      </div>

      {/* Left: Page Title */}
      <div className="flex items-center">
        <h2 className="text-lg md:text-xl font-black text-gray-800 tracking-tight">
          {getPageTitle()}
        </h2>
      </div>

      {/* Right: Profile Area (Click karne par Settings me jayega) */}
      <div className="flex items-center space-x-3 md:space-x-5 ml-auto">
        <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <span className="text-xl">🔔</span>
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
        </button>

        <div
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded-lg transition-colors border border-transparent hover:border-gray-200"
          title="Go to Settings"
        >
          {/* Avatar Rendering */}
          {currentUser?.photoURL ? (
            <img src={currentUser.photoURL} alt="Profile" className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200" />
          ) : (
            <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-full font-bold shadow-sm text-lg">
              {firstLetter}
            </div>
          )}

          {/* Name Rendering */}
          <div className="hidden md:block text-left">
            <p className="text-sm font-bold text-gray-700 leading-tight capitalize max-w-30 truncate">{displayName}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Settings ⚙️</p>
          </div>
        </div>
      </div>

    </header>
  );
}

export default Navbar;