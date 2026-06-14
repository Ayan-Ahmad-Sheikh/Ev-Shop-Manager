import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { db, auth } from '../Firebase/firebaseConfig';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

const CustomerLedger = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 🔥 NEW EXTRA STATE: Filter account metrics (All, B2B, B2C)
  const [accountFilter, setAccountFilter] = useState('All');

  // Payment Receive Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [receiveAmount, setReceiveAmount] = useState('');

  useEffect(() => {
    const fetchLedger = async () => {
      if (!auth.currentUser) return;

      try {
        const q = query(
          collection(db, "customers"),
          where("userId", "==", auth.currentUser.uid)
        );

        // collection() ki jagah 'q' pass kiya hai
        const querySnapshot = await getDocs(q);

        const customerList = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(c => c.totalDue > 0); // Sirf wahi dikhao jin par udhar baaki hai

        setCustomers(customerList);
      } catch (error) {
        console.error("Ledger Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLedger();
  }, []);

  // --- 1. DYNAMIC SUMMARY CALCULATIONS BASED ON ACTIVE FILTERS ---
  // Pure total dues calculation block
  const totalMarketDue = customers.reduce((sum, customer) => sum + customer.totalDue, 0);

  // --- 2. MULTI-CHANNEL ACCOUNT SEARCH LOGIC ---
  const filteredCustomers = customers.filter(c => {
    // A. Name ya Phone mapping logic
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery));

    // B. Wholesale vs Retail account filter rules separation
    let matchesAccountType = true;

    // 🔥 FIX: Phone ki jagah GSTIN ki length check karni hai (GSTIN 15 digit ka hota hai)
    const gstinValue = c.gstin || c.customerGstin || '';
    const isWholesaleUser = gstinValue.length === 15;

    if (accountFilter === 'B2B') {
      matchesAccountType = isWholesaleUser;
    } else if (accountFilter === 'B2C') {
      matchesAccountType = !isWholesaleUser;
    }

    return matchesSearch && matchesAccountType;
  });

  // 3. Payment Modal Open Karna
  const openPaymentModal = (customer) => {
    setSelectedCustomer(customer);
    setReceiveAmount(customer.totalDue); // Default fill full amount
    setIsModalOpen(true);
  };

  // 4. Payment Receive Logic (Udhar Minus Karna)
  const handleReceivePayment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(receiveAmount) || 0;

    if (amount <= 0 || amount > selectedCustomer.totalDue) {
      toast.error("Amount galat hai bhai! (Due se zyada nahi ho sakta)");
      return;
    }

    try {
      const newDue = selectedCustomer.totalDue - amount;
      const todayDate = new Date().toISOString().split('T')[0];

      // Cloud me customer ka khata update karo
      const custRef = doc(db, "customers", selectedCustomer.id);
      await updateDoc(custRef, {
        totalDue: newDue,
        lastUpdate: todayDate
      });

      // Screen par local state update karo
      const updatedCustomers = customers.map(c => {
        if (c.id === selectedCustomer.id) {
          return { ...c, totalDue: newDue, lastUpdate: todayDate };
        }
        return c;
      }).filter(c => c.totalDue > 0); // Agar due 0 ho gaya toh list se hata do

      setCustomers(updatedCustomers);
      setIsModalOpen(false);
      toast.success(`₹${amount} received from ${selectedCustomer.name}. Khata Updated!`);
    } catch (error) {
      console.error("Payment Update Error:", error);
      toast.error("Error updating payment in cloud.");
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 bg-gray-50 min-h-screen relative">

        {/* 1. Header & Filter Badges Skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4 mb-6 animate-pulse">
          <div>
            <div className="h-8 bg-gray-300 rounded-md w-64 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded-md w-80"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded-xl w-full sm:w-80"></div>
        </div>

        {/* 2. Top Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-pulse">
          {/* Due Card Skeleton */}
          <div className="bg-red-50 p-6 rounded-xl border border-red-100 flex items-center justify-between shadow-sm">
            <div>
              <div className="h-3 bg-red-200 rounded w-32 mb-3"></div>
              <div className="h-8 bg-red-300 rounded w-40"></div>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-lg"></div>
          </div>
          {/* Count Card Skeleton */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm">
            <div>
              <div className="h-3 bg-gray-200 rounded w-40 mb-3"></div>
              <div className="h-8 bg-gray-300 rounded w-16"></div>
            </div>
            <div className="h-12 w-12 bg-gray-100 rounded-lg"></div>
          </div>
        </div>

        {/* 3. Search Bar Skeleton */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 animate-pulse">
          <div className="h-10 bg-gray-100 rounded-lg w-full"></div>
        </div>

        {/* 4. Ledger Table Skeleton */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
          {/* Table Header */}
          <div className="flex justify-between items-center bg-gray-50 border-b border-gray-100 p-4">
            <div className="h-3 bg-gray-300 rounded w-40"></div>
            <div className="h-3 bg-gray-300 rounded w-24"></div>
            <div className="h-3 bg-gray-300 rounded w-20"></div>
            <div className="h-3 bg-gray-300 rounded w-32 text-right"></div>
            <div className="h-3 bg-gray-300 rounded w-16"></div>
          </div>

          {/* Table Rows */}
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex justify-between items-center p-4 border-b border-gray-50 last:border-0">
              <div>
                <div className="h-4 bg-gray-300 rounded w-32 mb-2"></div>
                <div className="h-3 bg-blue-100 rounded w-24"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-6 bg-red-100 rounded w-28"></div>
              <div className="h-8 bg-green-100 rounded-lg w-24"></div>
            </div>
          ))}

          <div className="text-center p-6 mt-2">
            <p className="text-sm font-bold text-gray-400 tracking-wide">⏳ Retrieving Khata Book from Secure Cloud...</p>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen relative">

      {/* Header Section with Custom Operational View Toggles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📓 Khata Book (Pending Dues)</h1>
          <p className="text-sm text-gray-500">Market mein phase hue udhar ka hisaab aur collection ledger.</p>
        </div>

        {/* 🔥 ACCOUNT FILTER BADGES SELECTOR SWITCH */}
        <div className="flex bg-gray-100 p-1 rounded-xl border text-xs font-bold shadow-inner">
          <button type="button" onClick={() => setAccountFilter('All')} className={`px-4 py-2 rounded-lg transition-all ${accountFilter === 'All' ? 'bg-gray-800 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}>
            📖 All Dues ({customers.length})
          </button>
          <button type="button" onClick={() => setAccountFilter('B2B')} className={`px-4 py-2 rounded-lg transition-all ${accountFilter === 'B2B' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-600 hover:text-indigo-900'}`}>
            📦 Wholesale Accounts
          </button>
          <button type="button" onClick={() => setAccountFilter('B2C')} className={`px-4 py-2 rounded-lg transition-all ${accountFilter === 'B2C' ? 'bg-cyan-600 text-white shadow' : 'text-cyan-600 hover:text-cyan-900'}`}>
            🛒 Retail Accounts
          </button>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-red-50 p-6 rounded-xl border border-red-100 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-bold text-red-600 uppercase tracking-wider">Total Market Due</p>
            <p className="text-3xl font-black text-red-700 mt-1">₹ {totalMarketDue.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 bg-red-100 text-red-700 rounded-lg text-2xl">💸</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Filtered Accounts Count</p>
            <p className="text-3xl font-black text-gray-800 mt-1">{filteredCustomers.length}</p>
          </div>
          <div className="p-3 bg-gray-100 text-gray-600 rounded-lg text-2xl">👥</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <input
          type="text"
          placeholder="🔍 Search customer by name, phone or ledger attribute..."
          className="w-full border border-gray-300 p-2.5 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Customers Ledger Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b text-gray-600 bg-gray-50 text-xs font-bold uppercase tracking-wider">
                <th className="p-4">Customer Name / Channel</th>
                <th className="p-4">Phone Number</th>
                <th className="p-4">Last Update</th>
                <th className="p-4 text-right">Pending Due (₹)</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400 font-medium">
                    {customers.length === 0 ? "🎉 Badhai ho! Market mein koi udhar baki nahi hai." : "Is filter mode me koi matching account nahi mila."}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  // Verify customer parameters to render channel badge identification tags
                  const isWholesale = customer.phone && customer.phone.length === 15 ? true : (customer.gstin || customer.customerGstin);

                  return (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-gray-800 text-sm uppercase">{customer.name}</div>
                        {/* 🔥 LIVE INTERACTIVE TYPE BADGES */}
                        <div className="mt-1">
                          {isWholesale ? (
                            <span className="inline-block text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                              📦 Wholesale Account (B2B)
                            </span>
                          ) : (
                            <span className="inline-block text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-100 px-1.5 py-0.5 rounded">
                              🛒 Retail Customer (B2C)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-gray-600 font-medium font-mono">{customer.phone || 'N/A'}</td>
                      <td className="p-4 text-gray-500 text-xs">{customer.lastUpdate}</td>
                      <td className="p-4 font-black text-red-600 text-right text-base">₹ {customer.totalDue.toLocaleString('en-IN')}</td>
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => openPaymentModal(customer)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-sm"
                        >
                          ✅ Receive Cash
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- PAYMENT RECEIVE MODAL --- */}
      {isModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gray-800 p-4 text-white">
              <h3 className="font-bold">Receive Payment</h3>
              <p className="text-xs text-gray-300 mt-1">Khata update karne ka target: {selectedCustomer.name}</p>
            </div>

            <form onSubmit={handleReceivePayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Pending Balance</label>
                <div className="text-2xl font-black text-red-600 font-mono">₹ {selectedCustomer.totalDue}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-green-600 uppercase mb-1">Enter Received Amount (₹)</label>
                <input
                  type="number"
                  autoFocus
                  className="w-full border border-green-300 p-3 rounded-lg bg-white text-lg font-black text-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={receiveAmount}
                  onChange={(e) => setReceiveAmount(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 font-bold text-sm"
                >
                  Save & Update Khata
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CustomerLedger;