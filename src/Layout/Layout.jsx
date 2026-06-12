import React from 'react';
import Sidebar from '../Navbars/Sidebar';
import Navbar from '../Navbars/Navbar';

// Props me se state nikaali jo App.jsx se aayi h
const Layout = ({ children, sidebarOpen, setSidebarOpen }) => {
  return (
    <div className="flex bg-gray-50 min-h-screen">
      
      {/* 1. Sidebar ko open/close control diya */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Container */}
      {/* Note: Desktop par sidebar gherega jagah isiliye md:ml-64 lagaya */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen overflow-x-hidden">
        
        {/* 2. Navbar ke hamburger ko open karne ka function diya */}
        <Navbar setSidebarOpen={setSidebarOpen} />

        {/* 3. Tumhare saare routes (Dashboard, Billing etc.) yahan render honge */}
        <main className="flex-1">
          {children}
        </main>

      </div>
    </div>
  );
};

export default Layout;