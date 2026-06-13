import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from '../Firebase/firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import toast from 'react-hot-toast'; // 🔥 Import Toast

const AddItemForm = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const initialFormState = {
    name: '',
    itemCode: '',
    category: '',
    hsnCode: '',
    primaryUnit: 'Pcs',
    secondaryUnit: '',
    conversionRate: 1,
    isFixedRate: false,
    purchasePrice: 0,
    sellingPrice: 0,
    wholesalePrice: 0,
    secondarySellingPrice: 0,
    openingStock: 0,
    openingStockDate: '',
    minStock: 5,
    gstRate: 18
  };

  const [newItem, setNewItem] = useState(initialFormState);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    const formattedDate = `${yyyy}-${mm}-${dd}`;
    setNewItem(prev => ({ ...prev, openingStockDate: formattedDate }));

    setTimeout(() => {
      setLoading(false);
    }, 400);
  }, []);

  const fixedConversions = {
    'Kg-Gm': 1000,
    'Ltr-Ml': 1000
  };

  const handleUnitChange = (field, value) => {
    let updatedItem = { ...newItem, [field]: value };
    const currentPrimary = field === 'primaryUnit' ? value : updatedItem.primaryUnit;
    const currentSecondary = field === 'secondaryUnit' ? value : updatedItem.secondaryUnit;
    const pair = `${currentPrimary}-${currentSecondary}`;

    if (fixedConversions[pair]) {
      updatedItem.conversionRate = fixedConversions[pair];
      updatedItem.isFixedRate = true;
    } else {
      updatedItem.isFixedRate = false;
    }
    setNewItem(updatedItem);
  };

  const handleInputChange = (field, value) => {
    setNewItem({ ...newItem, [field]: value });
  };

  const saveActionLogic = async () => {
    if (!newItem.name.trim()) {
      toast.error("⚠️ Item Name zaroori hai bhai!");
      return false;
    }

    if (Number(newItem.gstRate) > 0 && !newItem.hsnCode.trim()) {
      toast.error("⚠️ Tax Invoice ke liye HSN Code likhna compulsory hai!");
      return false;
    }

    if (newItem.purchasePrice < 0 || newItem.sellingPrice < 0 || newItem.wholesalePrice < 0 || newItem.openingStock < 0) {
      toast.error("⚠️ Rate ya Stock quantity minus (-) mein nahi ho sakti!");
      return false;
    }

    setIsSaving(true);

    try {
      const cleanedPayload = {
        name: String(newItem.name).trim(),
        itemCode: String(newItem.itemCode).trim(),
        category: String(newItem.category).trim(),
        hsnCode: String(newItem.hsnCode).trim().toUpperCase(),
        primaryUnit: String(newItem.primaryUnit),
        secondaryUnit: String(newItem.secondaryUnit),
        conversionRate: Number(newItem.conversionRate) || 1,
        isFixedRate: Boolean(newItem.isFixedRate),
        purchasePrice: Number(newItem.purchasePrice) || 0,
        sellingPrice: Number(newItem.sellingPrice) || 0,
        wholesalePrice: Number(newItem.wholesalePrice) || 0,
        secondarySellingPrice: Number(newItem.secondarySellingPrice) || 0,
        openingStock: Number(newItem.openingStock) || 0,
        minStock: Number(newItem.minStock) || 0,
        gstRate: parseInt(newItem.gstRate) || 0,
        openingStockDate: String(newItem.openingStockDate),
        status: "Active",
        createdAt: new Date().toISOString(),
        userId: auth.currentUser ? auth.currentUser.uid : null
      };

      await addDoc(collection(db, "items"), cleanedPayload);
      toast.success(`📦 ${newItem.name} Registered Successfully!`);
      return true;

    } catch (error) {
      console.error("Firebase Save Error: ", error);
      toast.error("Error! Data save nahi hua.");
      return false;
    }
    finally {
      setIsSaving(false); // 🔥 SAVING KHATAM
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const isSaved = await saveActionLogic();
    if (isSaved) {
      const fromPage = location.state?.from || '/stock';
      navigate(fromPage);
    }
  };

  const handleSaveAndNew = async (e) => {
    e.preventDefault();
    const isSaved = await saveActionLogic();
    if (isSaved) {
      const todayDate = newItem.openingStockDate;
      setNewItem({
        ...initialFormState,
        openingStockDate: todayDate
      });
    }
  };

  const handleCancel = () => {
    const fromPage = location.state?.from || '/stock';
    navigate(fromPage);
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="bg-white p-6 rounded-lg shadow border max-w-4xl mx-auto animate-pulse">
          <div className="h-6 bg-gray-300 rounded w-72 mb-6 border-b pb-2"></div>

          <div className="space-y-6">
            {/* Basic Details Skeleton */}
            <div>
              <div className="h-8 bg-gray-100 rounded w-full mb-3"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                  <div className="h-10 bg-gray-100 rounded w-full"></div>
                </div>
                <div><div className="h-4 bg-gray-200 rounded w-20 mb-1"></div><div className="h-10 bg-gray-100 rounded w-full"></div></div>
                <div><div className="h-4 bg-gray-200 rounded w-20 mb-1"></div><div className="h-10 bg-gray-100 rounded w-full"></div></div>
              </div>
            </div>

            {/* GST Details Skeleton */}
            <div>
              <div className="h-8 bg-purple-50 rounded w-full mb-3 border border-purple-100"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><div className="h-4 bg-purple-200 rounded w-32 mb-1"></div><div className="h-10 bg-gray-100 rounded w-full"></div></div>
                <div><div className="h-4 bg-purple-200 rounded w-24 mb-1"></div><div className="h-10 bg-gray-100 rounded w-full"></div></div>
              </div>
            </div>

            {/* Pricing Details Skeleton */}
            <div>
              <div className="h-8 bg-gray-100 rounded w-full mb-3"></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><div className="h-4 bg-gray-200 rounded w-32 mb-1"></div><div className="h-10 bg-gray-100 rounded w-full"></div></div>
                <div><div className="h-4 bg-blue-200 rounded w-40 mb-1"></div><div className="h-10 bg-blue-50 border border-blue-100 rounded w-full"></div></div>
                <div><div className="h-4 bg-indigo-200 rounded w-48 mb-1"></div><div className="h-10 bg-indigo-50 border border-indigo-100 rounded w-full"></div></div>
              </div>
            </div>

            {/* Footer Buttons Skeleton */}
            <div className="flex justify-between items-center pt-4 border-t mt-6">
              <div className="h-10 bg-gray-200 rounded w-32"></div>
              <div className="flex gap-3">
                <div className="h-10 bg-orange-200 rounded w-36"></div>
                <div className="h-10 bg-green-200 rounded w-32"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {isSaving && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center border border-gray-100">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin mb-4"></div>
            <p className="text-lg font-black text-gray-800">Registering Item...</p>
            <p className="text-xs text-gray-500 font-bold mt-1">Please wait, saving to cloud.</p>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow border max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-6 border-b pb-2 text-gray-800">📦 Add New Item (Dual Price & GST Enabled)</h2>

        <form className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 bg-gray-50 p-2 rounded">1. Basic Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2"><label className="block text-sm text-gray-600 mb-1">Item Name *</label><input required type="text" className="w-full border p-2 rounded" value={newItem.name} onChange={(e) => handleInputChange('name', e.target.value)} /></div>
              <div><label className="block text-sm text-gray-600 mb-1">Item Code / SKU</label><input type="text" className="w-full border p-2 rounded" value={newItem.itemCode} onChange={(e) => handleInputChange('itemCode', e.target.value)} /></div>
              <div><label className="block text-sm text-gray-600 mb-1">Category</label><input type="text" className="w-full border p-2 rounded" value={newItem.category} onChange={(e) => handleInputChange('category', e.target.value)} /></div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-purple-700 mb-3 bg-purple-50 p-2 rounded border border-purple-100">⚖️ GST Tax Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">GST Tax Rate Slab *</label>
                <select className="w-full border p-2 rounded bg-white font-bold text-purple-700 outline-none focus:ring-2 focus:ring-purple-400" value={newItem.gstRate} onChange={(e) => handleInputChange('gstRate', parseInt(e.target.value))}>
                  <option value={18}>18% (Standard EV Controllers, Chargers, Parts)</option>
                  <option value={28}>28% (Highest Luxury/Tyre Items)</option>
                  <option value={12}>12% (Loose Wires / Some Accessories)</option>
                  <option value={5}>5% (EV Batteries / Eco Parts)</option>
                  <option value={0}>0% (Tax Exempted / Nil Rated Items)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">HSN Code {newItem.gstRate > 0 && <span className="text-red-500">*</span>}</label>
                <input type="text" maxLength={8} placeholder="e.g. 8504" className="w-full border p-2 rounded font-mono uppercase focus:ring-2 focus:ring-purple-400" value={newItem.hsnCode} onChange={(e) => handleInputChange('hsnCode', e.target.value)} />
                <p className="text-[10px] text-gray-400 mt-1 font-bold">GST rules ke mutabik invoices par HSN zaroori hai.</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 bg-gray-50 p-2 rounded">3. Unit Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Primary Unit</label>
                <select className="w-full border p-2 rounded bg-white" value={newItem.primaryUnit} onChange={(e) => handleUnitChange('primaryUnit', e.target.value)}>
                  <option value="Pcs">Pcs (Pieces)</option><option value="Nos">Nos (Numbers)</option><option value="Box">Box</option><option value="Set">Set</option><option value="Ctn">Ctn (Carton)</option><option value="Pkt">Pkt (Packet)</option><option value="Pair">Pair</option><option value="Roll">Roll</option><option value="Mtr">Mtr (Meters)</option><option value="Kg">Kg</option><option value="Ltr">Ltr</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Secondary Unit (Optional)</label>
                <select className="w-full border p-2 rounded bg-white" value={newItem.secondaryUnit} onChange={(e) => handleUnitChange('secondaryUnit', e.target.value)}>
                  <option value="">None</option><option value="Pcs">Pcs (Pieces)</option><option value="Nos">Nos (Numbers)</option><option value="Box">Box</option><option value="Set">Set</option><option value="Pkt">Pkt (Packet)</option><option value="Pair">Pair</option><option value="Mtr">Mtr (Meters)</option><option value="Gm">Gm</option><option value="Ml">Ml</option>
                </select>
              </div>

              {newItem.secondaryUnit && (
                <div className={`p-2 rounded border flex items-center gap-2 ${newItem.isFixedRate ? 'bg-gray-100 border-gray-200' : 'bg-blue-50 border-blue-100'}`}>
                  <span className="text-sm font-medium text-gray-700">1 {newItem.primaryUnit} =</span>
                  <input
                    type="number"
                    min="1"
                    className={`w-20 border p-1 rounded text-center font-bold ${newItem.isFixedRate ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-black'}`}
                    value={newItem.conversionRate}
                    onChange={(e) => handleInputChange('conversionRate', parseInt(e.target.value) || 1)}
                    readOnly={newItem.isFixedRate}
                  />
                  <span className="text-sm font-medium text-gray-700">{newItem.secondaryUnit}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 bg-gray-50 p-2 rounded">4. Pricing Details (Tax Exclusive Base Rates)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm text-gray-600 mb-1">Purchase Price / {newItem.primaryUnit}</label><input required type="number" className="w-full border p-2 rounded font-bold" value={newItem.purchasePrice} onChange={(e) => handleInputChange('purchasePrice', parseFloat(e.target.value) || 0)} /></div>
              <div><label className="block text-sm text-blue-600 font-bold mb-1">🛍️ Retail Selling Price / {newItem.primaryUnit}</label><input required type="number" className="w-full border border-blue-200 p-2 rounded font-black text-blue-700 bg-blue-50/50" value={newItem.sellingPrice} onChange={(e) => handleInputChange('sellingPrice', parseFloat(e.target.value) || 0)} /></div>
              <div><label className="block text-sm text-indigo-600 font-bold mb-1">📦 Wholesale Selling Price / {newItem.primaryUnit}</label><input required type="number" className="w-full border border-indigo-200 p-2 rounded font-black text-indigo-700 bg-indigo-50/50" value={newItem.wholesalePrice} onChange={(e) => handleInputChange('wholesalePrice', parseFloat(e.target.value) || 0)} /></div>

              {newItem.secondaryUnit && (
                <div className="md:col-span-3">
                  <label className="block text-sm text-gray-600 mb-1 font-medium">Loose Price / {newItem.secondaryUnit} (Optional)</label>
                  <input type="number" className="w-1/3 border p-2 rounded" placeholder="e.g. 70" value={newItem.secondarySellingPrice} onChange={(e) => handleInputChange('secondarySellingPrice', parseFloat(e.target.value) || 0)} />
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 bg-gray-50 p-2 rounded">5. Stock Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm text-gray-600 mb-1">Opening Stock Qty</label><input required type="number" className="w-full border p-2 rounded font-bold" value={newItem.openingStock} onChange={(e) => handleInputChange('openingStock', parseFloat(e.target.value) || 0)} /></div>
              <div><label className="block text-sm text-gray-600 mb-1">As of Date</label><input type="date" className="w-full border p-2 rounded bg-gray-50 font-medium" value={newItem.openingStockDate} onChange={(e) => handleInputChange('openingStockDate', e.target.value)} /></div>
              <div><label className="block text-sm text-gray-600 mb-1">Min Stock Alert</label><input required type="number" className="w-full border p-2 rounded" value={newItem.minStock} onChange={(e) => handleInputChange('minStock', parseFloat(e.target.value) || 0)} /></div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t">
            <button type="button" onClick={handleCancel} className="w-full sm:w-auto px-5 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded font-bold text-sm">
              Cancel & Go Back
            </button>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveAndNew}
                className="w-full sm:w-auto bg-orange-500 text-white px-6 py-2.5 rounded shadow hover:bg-orange-600 font-bold text-sm transition-all"
              >
                💾 Save & Add New
              </button>

              <button
                type="button"
                onClick={handleSaveItem}
                className="w-full sm:w-auto bg-green-600 text-white px-8 py-2.5 rounded shadow hover:bg-green-700 font-bold text-sm transition-all"
              >
                ✔ Save & Exit
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItemForm;