import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../Firebase/firebaseConfig';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const ItemDetailsMaster = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  const fromPage = location.state?.from || '/stock';

  const [activeTab, setActiveTab] = useState('view');
  const [item, setItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustType, setAdjustType] = useState('ADD');

  useEffect(() => {
    const fetchSingleItem = async () => {
      try {
        const docRef = doc(db, "items", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setItem({ id: docSnap.id, ...docSnap.data() });
        } else {
          console.log("Cloud me yeh part nahi mila!");
        }
      } catch (error) {
        console.error("Error fetching item:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSingleItem();
  }, [id]);

  if (!item) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 font-bold">Item Not Found!</p>
        <button onClick={() => navigate(fromPage)} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">Back to Stock</button>
      </div>
    );
  }

  // --- 1. STOCK ADJUSTMENT LOGIC (UNTOUCHED) ---
  const handleStockAdjustment = async (e) => {
    e.preventDefault();
    if (adjustQty <= 0) return;

    let finalStock = item.openingStock;
    if (adjustType === 'ADD') {
      finalStock += adjustQty;
    } else {
      finalStock = Math.max(0, finalStock - adjustQty);
    }

    try {
      const itemRef = doc(db, "items", id);
      await updateDoc(itemRef, { openingStock: finalStock });

      setItem({ ...item, openingStock: finalStock });
      toast.success(`Stock updated! New Quantity: ${finalStock} ${item.primaryUnit}`);
      setAdjustQty(0);
      setActiveTab('view');
    } catch (error) {
      console.error("Error updating stock:", error);
      toast.error("Error! Cloud me stock update nahi hua.");
    }
  };

  // --- 2. FIREBASE EDIT DETAILS LOGIC (UPDATED PAYLOAD WITH STRICT TYPING) ---
  const handleUpdateDetails = async (e) => {
    e.preventDefault();

    // Rule validation check
    if (Number(item.gstRate || 0) > 0 && !item.hsnCode?.trim()) {
      toast.error("⚠️ Tax Invoice parameters ke liye HSN Code likhna compulsory hai!");
      return;
    }

    try {
      const itemRef = doc(db, "items", id);

      // Strict data parsing before push to Firestore Cloud
      const updatedPayload = {
        name: String(item.name).trim(),
        itemCode: String(item.itemCode || '').trim(),
        hsnCode: String(item.hsnCode || '').trim().toUpperCase(),
        purchasePrice: Number(item.purchasePrice) || 0,
        sellingPrice: Number(item.sellingPrice) || 0,         // Retail Selling Rate
        wholesalePrice: Number(item.wholesalePrice) || 0,     // Wholesale Bulk Rate
        gstRate: parseInt(item.gstRate) || 0                  // Integer representation
      };

      await updateDoc(itemRef, updatedPayload);
      toast.success("🎉 Product Details & GST configurations updated successfully!");
      setActiveTab('view');
    } catch (error) {
      console.error("Error updating details:", error);
      toast.error("Error! Changes save nahi hue.");
    }
  };

  // --- 3. FIREBASE DELETE LOGIC (UNTOUCHED) ---
  const handleDeleteItem = async () => {
    const confirmDelete = window.confirm(`Kya aap sachme "${item.name}" ko inventory se hatana chahte hain? Iske baad yeh billing me nahi dikhega.`);
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, "items", id));
        toast.success("Product Deleted/Archived successfully from Cloud!");
        navigate(fromPage);
      } catch (error) {
        console.error("Error deleting item:", error);
        toast.error("Error! Item delete nahi ho paya.");
      }
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500 font-bold text-lg">⏳ Cloud se item ki detail nikal rahe hain...</div>;
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow border border-gray-200 overflow-hidden">

        {/* Top Header Section */}
        <div className="bg-gray-800 p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex gap-2 items-center">
              <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded font-mono uppercase">{item.itemCode || 'No Code'}</span>
              {/* Added HSN Badge in view top summary */}
              {item.hsnCode && <span className="text-xs bg-purple-900 text-purple-200 px-2 py-1 rounded font-mono">HSN: {item.hsnCode}</span>}
              <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded font-bold">Tax Slab: {item.gstRate || 0}%</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold mt-1.5">{item.name}</h1>
            <p className="text-sm text-gray-400">Category: {item.category || 'General'}</p>
          </div>
          <button onClick={() => navigate(fromPage)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm font-bold">
            ← Back
          </button>
        </div>

        {/* Tab Buttons Bar */}
        <div className="flex border-b bg-gray-50 px-4 pt-2 gap-2">
          <button onClick={() => setActiveTab('view')} className={`px-4 py-2 text-sm font-bold rounded-t-lg border-t border-x transition-all ${activeTab === 'view' ? 'bg-white border-gray-200 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>👁 View Kundali</button>
          <button onClick={() => setActiveTab('adjust')} className={`px-4 py-2 text-sm font-bold rounded-t-lg border-t border-x transition-all ${activeTab === 'adjust' ? 'bg-white border-gray-200 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>🛠 Adjust Stock</button>
          <button onClick={() => setActiveTab('edit')} className={`px-4 py-2 text-sm font-bold rounded-t-lg border-t border-x transition-all ${activeTab === 'edit' ? 'bg-white border-gray-200 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>✏ Edit Info</button>
        </div>

        {/* Dynamic Content Panel */}
        <div className="p-6">

          {/* TAB 1: VIEW DETAILS (UPDATED DUAL PRICING + GST GRID LAYOUT) */}
          {activeTab === 'view' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-gray-50 p-4 rounded border text-center">
                  <p className="text-xs text-gray-400 font-bold uppercase">Current Stock</p>
                  <p className={`text-xl font-black mt-1 ${item.openingStock <= item.minStock ? 'text-red-600' : 'text-green-600'}`}>{item.openingStock} {item.primaryUnit}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded border text-center">
                  <p className="text-xs text-gray-400 font-bold uppercase">Purchase Rate</p>
                  <p className="text-xl font-black mt-1 text-gray-800">₹ {item.purchasePrice}</p>
                </div>
                <div className="p-4 rounded border text-center border-blue-100 bg-blue-50/20">
                  <p className="text-xs text-blue-500 font-bold uppercase">🛍️ Retail Price</p>
                  <p className="text-xl font-black mt-1 text-blue-600">₹ {item.sellingPrice}</p>
                </div>
                <div className="p-4 rounded border text-center border-indigo-100 bg-indigo-50/20">
                  <p className="text-xs text-indigo-500 font-bold uppercase">📦 Wholesale Price</p>
                  <p className="text-xl font-black mt-1 text-indigo-600">₹ {item.wholesalePrice || 'Not Set'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded border text-center">
                  <p className="text-xs text-gray-400 font-bold uppercase">Loose Price</p>
                  <p className="text-xl font-black mt-1 text-purple-600">₹ {item.secondarySellingPrice || '-'}</p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                <div>
                  <p><strong>Primary Unit:</strong> {item.primaryUnit}</p>
                  {item.secondaryUnit && <p><strong>Secondary Packing:</strong> 1 {item.primaryUnit} = {item.conversionRate} {item.secondaryUnit}</p>}
                  <p><strong>Minimum Alert Trigger:</strong> Below {item.minStock} {item.primaryUnit}</p>
                </div>
                <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-100/60 text-xs">
                  <p className="font-bold text-purple-800 mb-1">📋 Government Tax Parameters:</p>
                  <p>• HSN Code Standard System: <span className="font-mono font-bold">{item.hsnCode || 'N/A'}</span></p>
                  <p>• Linked Base GST Bracket: <span className="font-bold">{item.gstRate || 0}% Slab Rate</span></p>
                </div>
              </div>

              {/* DANGEROUS DELETE ZONE */}
              <div className="border-t border-red-100 pt-6 mt-6 flex justify-between items-center bg-red-50 p-4 rounded-lg">
                <div>
                  <h4 className="text-sm font-bold text-red-800">Stop Selling This Item?</h4>
                  <p className="text-xs text-red-600">Isko delete karne par ye permanent stock master se hat jayega.</p>
                </div>
                <button onClick={handleDeleteItem} className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded text-sm transition-all">
                  ❌ Delete Item
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ADJUST STOCK (UNTOUCHED) */}
          {activeTab === 'adjust' && (
            <form onSubmit={handleStockAdjustment} className="max-w-md space-y-4">
              <h3 className="font-bold text-gray-700 text-sm">Quick Stock In / Stock Out</h3>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 font-semibold text-sm text-green-700 bg-green-50 px-4 py-2 rounded border cursor-pointer">
                  <input type="radio" name="adjType" checked={adjustType === 'ADD'} onChange={() => setAdjustType('ADD')} /> ➕ Stock In (Maal Aaya)
                </label>
                <label className="flex items-center gap-2 font-semibold text-sm text-red-700 bg-red-50 px-4 py-2 rounded border cursor-pointer">
                  <input type="radio" name="adjType" checked={adjustType === 'REDUCE'} onChange={() => setAdjustType('REDUCE')} /> ➖ Stock Out (Damage/Return)
                </label>
              </div>

              <div>
                <label className="block text-xs text-gray-500 font-bold uppercase mb-1">Enter Quantity ({item.primaryUnit})</label>
                <input required type="number" min="1" className="border p-2 rounded w-full font-bold" value={adjustQty || ''} onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)} placeholder="e.g. 10, 50" />
              </div>

              <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded font-bold text-sm">
                Confirm Adjustment
              </button>
            </form>
          )}

          {/* TAB 3: EDIT DETAILS (UPDATED FORM WITH NEW GST + WHOLESALE FIELDS INPUTS) */}
          {activeTab === 'edit' && (
            <form onSubmit={handleUpdateDetails} className="space-y-6">

              {/* Sub-Section 1: Core Metadata */}
              <div className="bg-gray-50 p-4 rounded-xl border space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">1. Item Information Update</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Item Name</label><input type="text" required className="w-full border p-2.5 bg-white rounded font-medium text-sm" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} /></div>
                  <div><label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Item Code / SKU</label><input type="text" className="w-full border p-2.5 bg-white rounded font-medium text-sm" value={item.itemCode || ''} onChange={(e) => setItem({ ...item, itemCode: e.target.value })} /></div>
                </div>
              </div>

              {/* Sub-Section 2: Premium GST System Inputs */}
              <div className="bg-purple-50/40 p-4 rounded-xl border border-purple-100 space-y-4">
                <h4 className="text-xs font-bold text-purple-500 uppercase tracking-wider">2. Tax Configuration Controls</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-purple-700 mb-1 uppercase">GST Tax Rate Slab Bracket</label>
                    <select className="w-full border p-2.5 bg-white rounded font-bold text-sm text-purple-800 outline-none" value={item.gstRate || 0} onChange={(e) => setItem({ ...item, gstRate: parseInt(e.target.value) || 0 })}>
                      <option value={18}>18% (Standard Controllers/Chargers)</option>
                      <option value={28}>28% (Luxury items / Tyres)</option>
                      <option value={12}>12% (Loose Wires / General Accessories)</option>
                      <option value={5}>5% (EV Batteries Pack)</option>
                      <option value={0}>0% (Tax Exempted)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-purple-700 mb-1 uppercase">HSN Code {item.gstRate > 0 && <span className="text-red-500">*</span>}</label>
                    <input type="text" maxLength={8} className="w-full border p-2.5 bg-white rounded font-mono font-bold text-sm uppercase" value={item.hsnCode || ''} onChange={(e) => setItem({ ...item, hsnCode: e.target.value })} placeholder="e.g. 8504" />
                  </div>
                </div>
              </div>

              {/* Sub-Section 3: Pricing System Matrix */}
              <div className="bg-gray-50 p-4 rounded-xl border space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">3. Dual-Pricing Setup Matrix</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Purchase Price (₹)</label><input type="number" required className="w-full border p-2.5 bg-white rounded font-bold text-sm" value={item.purchasePrice} onChange={(e) => setItem({ ...item, purchasePrice: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="block text-xs font-bold text-blue-600 mb-1 uppercase">🛍️ Retail Selling Price (₹)</label><input type="number" required className="w-full border border-blue-200 p-2.5 bg-blue-50/20 rounded font-black text-blue-700 text-sm" value={item.sellingPrice} onChange={(e) => setItem({ ...item, sellingPrice: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="block text-xs font-bold text-indigo-600 mb-1 uppercase">📦 Wholesale Bulk Price (₹)</label><input type="number" required className="w-full border border-indigo-200 p-2.5 bg-indigo-50/20 rounded font-black text-indigo-700 text-sm" value={item.wholesalePrice || 0} onChange={(e) => setItem({ ...item, wholesalePrice: parseFloat(e.target.value) || 0 })} placeholder="Set Bulk Rate" /></div>
                </div>
              </div>

              <div className="text-right">
                <button type="submit" className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold text-sm shadow transition-all">
                  💾 Update & Save All Changes
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default ItemDetailsMaster;