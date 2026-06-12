import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../Firebase/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

const Stock = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "items"));
        const itemsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (itemsList.length === 0) {
          setInventory([]);
        } else {
          const validItems = itemsList.map(item => ({ ...item, status: item.status || 'Active' }));
          setInventory(validItems);
        }
      } catch (error) {
        console.error("Firebase fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  // --- SEARCH & FILTER STATES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockStatus, setStockStatus] = useState('All'); 
  const [itemStatus, setItemStatus] = useState('Active'); 

  const categories = ['All', ...new Set(inventory.map(item => item.category).filter(Boolean))];

  // --- 1. DYNAMIC STOCK SUMMARY LOGIC ---
  const totalUniqueItems = inventory.filter(item => item.status === 'Active').length;

  const totalStockValue = inventory.reduce((acc, item) => {
    if (item.status === 'Active') {
      return acc + (item.openingStock * item.purchasePrice);
    }
    return acc;
  }, 0);

  const lowStockCount = inventory.filter(item =>
    item.status === 'Active' && item.openingStock <= item.minStock
  ).length;

  // --- 2. MULTI-FILTER SEARCH LOGIC ---
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.itemCode && item.itemCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.hsnCode && item.hsnCode.toLowerCase().includes(searchQuery.toLowerCase())); // 👈 HSN Code se bhi search chalega

    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

    let matchesStockStatus = true;
    if (stockStatus === 'InStock') {
      matchesStockStatus = item.openingStock > item.minStock;
    } else if (stockStatus === 'LowStock') {
      matchesStockStatus = item.openingStock <= item.minStock;
    }

    const matchesItemStatus = itemStatus === 'All' || item.status === itemStatus;

    return matchesSearch && matchesCategory && matchesStockStatus && matchesItemStatus;
  });

  if (loading) {
    return <div className="p-10 text-center text-gray-500 font-bold text-lg">⏳ Cloud se Stock list load ho rahi hai...</div>;
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen space-y-6">

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📦 Inventory Master</h1>
          <p className="text-sm text-gray-500">Manage products, tracking stock levels and valuation.</p>
        </div>
        <button
          onClick={() => navigate('/add-item', { state: { from: '/stock' } })}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-blue-700 font-medium text-sm transition-all"
        >
          + Add New Item
        </button>
      </div>

      {/* --- 1. STOCK SUMMARY CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Products</p>
            <p className="text-2xl font-black text-gray-800 mt-1">{totalUniqueItems}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg text-xl">📦</div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Investment (Stock Value)</p>
            <p className="text-2xl font-black text-gray-800 mt-1">₹ {totalStockValue.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-lg text-xl">💰</div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Low Stock Shortage Alert</p>
            <p className="text-2xl font-black text-red-600 mt-1">{lowStockCount}</p>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xl">⚠️</div>
        </div>
      </div>

      {/* --- 2. SEARCH AND FILTERS PANEL --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Search Item</label>
            <input
              type="text"
              placeholder="🔍 Search name, code or HSN..."
              className="w-full border p-2 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
            <select
              className="w-full border p-2 rounded-lg bg-gray-50 text-sm font-medium cursor-pointer"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stock Level Status</label>
            <select
              className="w-full border p-2 rounded-lg bg-gray-50 text-sm font-medium cursor-pointer"
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}
            >
              <option value="All">All Stock Levels</option>
              <option value="InStock">In Stock Only</option>
              <option value="LowStock">⚠️ Low Stock Alert</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Business Action Status</label>
            <select
              className="w-full border p-2 rounded-lg bg-gray-50 text-sm font-medium cursor-pointer"
              value={itemStatus}
              onChange={(e) => setItemStatus(e.target.value)}
            >
              <option value="Active">Active Items (Selling)</option>
              <option value="Inactive">Inactive Items (Stopped)</option>
              <option value="All">All Items (History)</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- 3. INVENTORY LIST TABLE (UPDATED WITH GST AND DUAL PRICES) --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="border-b text-gray-600 bg-gray-50 text-xs font-bold uppercase tracking-wider">
                <th className="p-3.5">Code / HSN</th>
                <th className="p-3.5">Item Name</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Stock</th>
                <th className="p-3.5">Unit</th>
                <th className="p-3.5">Purchase</th>
                <th className="p-3.5 text-blue-600">🛍️ Retail Rate</th>
                <th className="p-3.5 text-indigo-600">📦 Wholesale Rate</th>
                <th className="p-3.5">Tax Slab</th>
                <th className="p-3.5">Total Value</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="11" className="p-8 text-center text-gray-400 font-medium">
                    No matching items found for selected filters.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    
                    {/* Code & HSN Code layout */}
                    <td className="p-3.5 text-gray-500 font-mono text-xs space-y-0.5">
                      <div>Code: {item.itemCode || '-'}</div>
                      {item.hsnCode && <div className="text-purple-600 font-bold bg-purple-50 px-1 rounded w-fit">HSN: {item.hsnCode}</div>}
                    </td>
                    
                    <td className="p-3.5 font-bold text-gray-800">{item.name}</td>
                    
                    <td className="p-3.5">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{item.category || 'General'}</span>
                    </td>
                    
                    <td className="p-3.5">
                      <span className={`font-black px-2 py-1 rounded text-xs ${item.openingStock <= item.minStock ? 'text-red-700 bg-red-50 border border-red-100' : 'text-green-700 bg-green-50'}`}>
                        {item.openingStock}
                      </span>
                    </td>
                    
                    <td className="p-3.5 text-gray-500 text-xs">
                      {item.primaryUnit} {item.secondaryUnit && <span className="text-[10px] text-gray-400 block">(1 = {item.conversionRate} {item.secondaryUnit})</span>}
                    </td>
                    
                    {/* Sahi line-up pricing fields mapping */}
                    <td className="p-3.5 font-semibold text-gray-600">₹{item.purchasePrice}</td>
                    
                    <td className="p-3.5 font-bold text-blue-600">₹{item.sellingPrice}</td>
                    
                    <td className="p-3.5 font-bold text-indigo-600">₹{item.wholesalePrice || item.sellingPrice}</td>
                    
                    {/* Live Tax Slab badge display */}
                    <td className="p-3.5">
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                        {item.gstRate || 0}%
                      </span>
                    </td>
                    
                    {/* Final Net Valuation calculation based on Purchase price asset rate */}
                    <td className="p-3.5 font-black text-green-700">
                      ₹{(item.openingStock * item.purchasePrice).toLocaleString('en-IN')}
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => navigate(`/stock-details/${item.id}`, { state: { from: '/stock' } })}
                        className="bg-gray-50 hover:bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md font-bold text-xs transition-all border border-gray-200 hover:border-blue-200"
                      >
                        👁 View & Adjust
                      </button>
                    </td>
                    
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Stock;