import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { db } from '../Firebase/firebaseConfig';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

// 💡 PROPS UPDATE: User ke naye requirements ke mutabik 'setBillingMeta' callback receive kiya
const BillingForm = ({ setBillingMeta }) => {
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [amountPaid, setAmountPaid] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [inventory, setInventory] = useState([]);

  // --- 1. NEW CORE REQ STATES (GSTIN AUTO SWITCH) ---
  const [customerGstin, setCustomerGstin] = useState('');
  const [invoiceType, setInvoiceType] = useState('B2C'); // 'B2C' (Retail) ya 'B2B' (Wholesale)
  const [isLocal, setIsLocal] = useState(true);          // true = CGST+SGST, false = IGST

  // 🔥 NEW STATES FOR LOGISTICS (TRANSPORT DETAILS)
  const [transportName, setTransportName] = useState('');
  const [marka, setMarka] = useState('');
  const [destination, setDestination] = useState('');

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "items"));
        const itemsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setInventory(itemsList.filter(item => item.status !== 'Inactive'));
      } catch (error) {
        console.error("Error fetching stock for billing:", error);
      }
    };
    fetchInventory();
  }, []);

  // --- 2. DATA PASSING TO PARENT CALLBACK (UPDATED WITH LOGISTICS) ---
  useEffect(() => {
    if (typeof setBillingMeta === 'function') {
      setBillingMeta({
        invoiceType,
        gstin: customerGstin,
        isLocal,
        transportName, // Pass to parent if needed
        marka,
        destination
      });
    }
  }, [invoiceType, customerGstin, isLocal, transportName, marka, destination, setBillingMeta]);

  // --- 3. AUTOMATED GSTIN CHANGE HANDLER ---
  const handleGstinChange = (e) => {
    const val = e.target.value.toUpperCase().trim(); // Auto UpperCase transformation
    setCustomerGstin(val);

    if (val.length === 0) {
      setInvoiceType('B2C');
      setIsLocal(true);
    } else if (val.length === 15) {
      setInvoiceType('B2B'); // Switched to Wholesale Mode

      const stateCode = val.substring(0, 2);
      if (stateCode === '27') {
        setIsLocal(true);   // Nagpur / Maharashtra Customer (CGST + SGST)
      } else {
        setIsLocal(false);  // MP, Delhi, CG etc. Outstation Customer (IGST)
      }
    }
  };

  const [discount, setDiscount] = useState(0);
  const [serviceCharge, setServiceCharge] = useState(0);

  const [searchQuery, setSearchQuery] = useState([]);
  const [showQuickAdd, setShowQuickAdd] = useState([]);

  const addRow = () => {
    setItems([...items, { productId: '', name: '', qty: 1, unit: 'Pcs', price: 0, availableUnits: ['Pcs'], refData: null }]);
    setSearchQuery([...searchQuery, '']);
    setShowQuickAdd([...showQuickAdd, false]);
  };

  const removeRow = (index) => {
    setItems(items.filter((_, i) => i !== index));
    setSearchQuery(searchQuery.filter((_, i) => i !== index));
    setShowQuickAdd(showQuickAdd.filter((_, i) => i !== index));
  };

  const toggleBillingMode = (mode) => {
    setInvoiceType(mode);

    if (mode === 'B2C' && customerGstin.length === 0) {
      setIsLocal(true);
    }
  };

  // --- 4. MODE SPECIFIC PRODUCT RATES SELECTOR ---
  const handleProductSelect = (index, product) => {
    const newItems = [...items];
    const unitsArray = [product.primaryUnit];
    if (product.secondaryUnit) unitsArray.push(product.secondaryUnit);

    const targetPrice = invoiceType === 'B2B'
      ? (product.wholesalePrice || product.sellingPrice)
      : product.sellingPrice;

    newItems[index] = {
      ...newItems[index],
      productId: product.id,
      name: product.name,
      unit: product.primaryUnit,
      price: targetPrice,
      availableUnits: unitsArray,
      refData: product
    };

    setItems(newItems);

    const newSearch = [...searchQuery];
    newSearch[index] = product.name;
    setSearchQuery(newSearch);
  };

  const handleUpdate = (index, field, value) => {
    const newItems = [...items];
    const row = newItems[index];
    row[field] = value;

    if (field === 'unit' && row.refData) {
      if (value === row.refData.secondaryUnit) {
        row.price = row.refData.secondarySellingPrice || (row.refData.sellingPrice / row.refData.conversionRate);
      } else {
        row.price = invoiceType === 'B2B' ? (row.refData.wholesalePrice || row.refData.sellingPrice) : row.refData.sellingPrice;
      }
    }
    setItems(newItems);
  };

  const handleQuickAddItem = (index) => {
    const newItemName = searchQuery[index];
    if (!newItemName.trim()) return;

    const newProduct = {
      id: Date.now(),
      name: newItemName,
      primaryUnit: 'Pcs',
      sellingPrice: 0,
      wholesalePrice: 0,
      purchasePrice: 0,
      openingStock: 0,
      minStock: 0,
      gstRate: 18 // Default
    };

    handleProductSelect(index, newProduct);

    const newQuickAddState = [...showQuickAdd];
    newQuickAddState[index] = false;
    setShowQuickAdd(newQuickAddState);
  };

  // --- 5. DYNAMIC TAX SLABS CALCULATIONS ---
  let calculatedSubTotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  items.forEach(item => {
    const itemRowTotal = item.qty * item.price;
    calculatedSubTotal += itemRowTotal;

    const currentItemTaxRate = item.refData ? Number(item.refData.gstRate || 0) : 18;
    const itemTaxCost = (itemRowTotal * currentItemTaxRate) / 100;

    if (currentItemTaxRate > 0) {
      if (isLocal) {
        totalCgst += itemTaxCost / 2;
        totalSgst += itemTaxCost / 2;
      } else {
        totalIgst += itemTaxCost;
      }
    }
  });

  const totalTaxCollected = totalCgst + totalSgst + totalIgst;
  const grandTotal = Math.max(0, (calculatedSubTotal + totalTaxCollected + parseFloat(serviceCharge || 0)) - parseFloat(discount || 0));
  const remainingUdhar = paymentMode === 'Split' ? Math.max(0, grandTotal - (parseFloat(amountPaid) || 0)) : 0;

  const handleCancel = () => {
    const fromPage = location.state?.from || '/';
    navigate(fromPage);
  };

  const handleCompleteSale = async () => {
    if (items.length === 0 || !items[0].name) {
      toast.error("Pehle koi part toh select karo bhai!");
      return;
    }

    // 🛑 STEP 1: SAFETY CHECKPOST - Pehle check karo kisi item ka stock bheed mein khatam toh nahi?
    for (const item of items) {
      if (item.productId && item.productId.toString().length > 10) {
        const itemRef = doc(db, "items", item.productId);
        const itemSnap = await getDoc(itemRef);

        if (itemSnap.exists()) {
          const currentStock = itemSnap.data().openingStock || 0;
          let deductQty = item.qty;

          if (item.refData && item.unit === item.refData.secondaryUnit) {
            deductQty = item.qty / (item.refData.conversionRate || 1);
          }

          // 🔥 AGAR GRAHAK JYADA MAANG RAHA HAI AUR DUKAN PAR NAHI HAI:
          if (currentStock < deductQty) {
            toast.error(`❌ Stock Shortage! "${item.name}" ka stock sirf ${currentStock} bacha hai, par aap ${deductQty} bech rahe hain. Pehle stock in karo bhai!`);
            return; // 👈 Bill yahi ruk jayega, aage database me kuch save nahi hoga!
          }
        }
      }
    }

    // 🟢 STEP 2: AGAR SAB MAAL IN-STOCK HAI, TOH BILL SAVE KARO
    try {
      const billData = {
        customerName: customerName || 'Cash Customer',
        customerPhone: customerPhone || 'N/A',
        customerGstin: invoiceType === 'B2B' ? customerGstin : '',
        invoiceType,
        isLocal,
        transportName: invoiceType === 'B2B' ? transportName : '',
        marka: invoiceType === 'B2B' ? marka : '',
        destination: invoiceType === 'B2B' ? destination : '',
        items: items,
        subTotal: calculatedSubTotal,
        customerGstin: invoiceType === 'B2B' ? customerGstin : '',
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        totalTax: totalTaxCollected,
        discount: discount,
        serviceCharge: serviceCharge,
        grandTotal: grandTotal,
        paymentMode: paymentMode,
        amountPaid: paymentMode === 'Split' ? parseFloat(amountPaid) : grandTotal,
        remainingUdhar: remainingUdhar,
        billDate: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, "bills"), billData);

      // --- ACTUAL STOCK DEDUCTION (Ab yeh safe hai kyunki pehle check ho chuka h) ---
      for (const item of items) {
        if (item.productId && item.productId.toString().length > 10) {
          const itemRef = doc(db, "items", item.productId);
          const itemSnap = await getDoc(itemRef);

          if (itemSnap.exists()) {
            const currentStock = itemSnap.data().openingStock || 0;
            let deductQty = item.qty;

            if (item.refData && item.unit === item.refData.secondaryUnit) {
              deductQty = item.qty / (item.refData.conversionRate || 1);
            }

            let newStock = currentStock - deductQty;
            newStock = parseFloat(newStock.toFixed(2)); // Decimal adjustment

            await updateDoc(itemRef, { openingStock: newStock });
          }
        }
      }

      // --- KHATA BOOK LOGIC ---
      if (paymentMode === 'Split' && remainingUdhar > 0) {
        const customerId = customerPhone || customerName || `Unknown_${Date.now()}`;
        const custRef = doc(db, "customers", customerId);
        const custSnap = await getDoc(custRef);
        const todayDate = new Date().toISOString().split('T')[0];

        if (custSnap.exists()) {
          await updateDoc(custRef, {
            totalDue: custSnap.data().totalDue + remainingUdhar,
            lastUpdate: todayDate
          });
        } else {
          await setDoc(custRef, {
            name: customerName || 'Cash Customer',
            phone: customerPhone || '',
            totalDue: remainingUdhar,
            lastUpdate: todayDate
          });
        }
      }

      toast.success(`🎉 Bill Successfully Saved & Stock Updated!`);
      navigate('/billing');
    } catch (error) {
      console.error("Bill Save Error: ", error);
      toast.error("Error! Bill save nahi hua.");
    }
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow border max-w-5xl mx-auto space-y-6">

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-3 gap-4">
        <div>
          <h2 className="text-lg md:text-xl font-black text-gray-800">🧾 Automated Counter Sales</h2>
          <p className="text-xs text-gray-400">Tax values are accurately assigned on product master settings</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl border text-xs font-bold shadow-inner">
          <button
            type="button"
            onClick={() => toggleBillingMode('B2C')}
            className={`px-4 py-2 rounded-lg transition-all ${invoiceType === 'B2C' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}
          >
            🛍️ Retail Rate Mode
          </button>
          <button
            type="button"
            onClick={() => toggleBillingMode('B2B')}
            className={`px-4 py-2 rounded-lg transition-all ${invoiceType === 'B2B' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}
          >
            📦 Wholesale Rate Mode
          </button>
        </div>
      </div>

      {/* Basic Customer Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Customer Name</label>
          <input type="text" placeholder="Customer Name (Optional)" className="w-full border p-2 rounded bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Mobile Number</label>
          <input type="tel" maxLength="10" placeholder="Mobile Number (Optional)" className="w-full border p-2 rounded bg-white text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Customer GSTIN (15 Digits)</label>
          <input
            type="text"
            maxLength={15}
            placeholder="e.g. 27AAAAA0000A1Z5"
            className={`w-full border p-2 rounded bg-white text-sm font-mono font-bold uppercase outline-none transition-colors ${customerGstin.length === 15 ? 'border-emerald-400 focus:ring-2 focus:ring-emerald-400 text-emerald-800' : 'focus:ring-2 focus:ring-blue-500'}`}
            value={customerGstin}
            onChange={handleGstinChange}
          />
        </div>
      </div>

      {/* NEW CONTITIONAL BLOCK: LOGISTICS AND TRANSPORT ENTRY FIELDS */}
      {invoiceType === 'B2B' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
          <div>
            <label className="block text-xs font-bold text-indigo-700 mb-1 uppercase">Dispatched Through (Transport Name)</label>
            <input
              type="text"
              placeholder="e.g. ATS, VRL, GATI Transport"
              className="w-full border border-indigo-200 p-2 rounded bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none"
              value={transportName}
              onChange={(e) => setTransportName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-indigo-700 mb-1 uppercase">Marka Details</label>
            <input
              type="text"
              placeholder="e.g. IMRAN, NAGPUR BOX-1"
              className="w-full border border-indigo-200 p-2 rounded bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none"
              value={marka}
              onChange={(e) => setMarka(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-indigo-700 mb-1 uppercase">Destination City</label>
            <input
              type="text"
              placeholder="e.g. NAGPUR, AMRAVATI, JABALPUR"
              className="w-full border border-indigo-200 p-2 rounded bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Table Headers */}
      <div className="hidden md:grid md:grid-cols-12 gap-4 border-b pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
        <div className="col-span-5">Search & Select Part</div>
        <div className="col-span-2 text-center">Qty</div>
        <div className="col-span-1.5 text-center">Unit</div>
        <div className="col-span-1.5 text-center">Rate (₹)</div>
        <div className="col-span-2 text-right">Amount</div>
      </div>

      {/* Item Rows loop container */}
      <div className="space-y-4 md:space-y-2">
        {items.map((item, index) => {
          const filteredInventory = inventory.filter(inv =>
            inv.name.toLowerCase().includes((searchQuery[index] || '').toLowerCase()) ||
            (inv.itemCode && inv.itemCode.toLowerCase().includes((searchQuery[index] || '').toLowerCase()))
          );

          return (
            <div key={index} className="bg-gray-50 md:bg-transparent p-4 md:p-0 rounded-lg border md:border-none md:border-b border-gray-100">
              <div className="md:grid md:grid-cols-12 gap-4 items-center py-2 relative">

                <div className="col-span-5 mb-3 md:mb-0 relative">
                  <input
                    type="text"
                    placeholder="Type to search part (e.g. Controller, Seal)..."
                    className="w-full border p-2 rounded bg-white text-sm focus:border-blue-500 focus:outline-none"
                    value={searchQuery[index] || ''}
                    onChange={(e) => {
                      const newSearch = [...searchQuery];
                      newSearch[index] = e.target.value;
                      setSearchQuery(newSearch);

                      const newQuickAddState = [...showQuickAdd];
                      newQuickAddState[index] = e.target.value.length > 0 && filteredInventory.length === 0;
                      setShowQuickAdd(newQuickAddState);
                    }}
                  />

                  {/* 🔥 FIXED DROUDOWN INNER MAP LEVEL BOX */}
                  {searchQuery[index] && !item.productId && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                      {filteredInventory.map(inv => {
                        // Safe strict dynamic verification matrix format assignment
                        const liveAvailStock = inv.openingStock !== undefined ? Number(inv.openingStock) : 0;
                        const minAlertBoundary = inv.minStock !== undefined ? Number(inv.minStock) : 5;

                        return (
                          <div
                            key={inv.id}
                            onClick={() => handleProductSelect(index, inv)}
                            className="p-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0 flex justify-between items-center"
                          >
                            <span className="font-medium text-gray-800">{inv.name}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${liveAvailStock <= minAlertBoundary ? 'bg-red-50 text-red-600 border border-red-100' : 'text-gray-400 bg-gray-50'}`}>
                              Stock: {liveAvailStock} {inv.primaryUnit || 'Pcs'} | Tax: {inv.gstRate || 0}%
                            </span>
                          </div>
                        );
                      })}

                      {showQuickAdd[index] && (
                        <div
                          onClick={() => handleQuickAddItem(index)}
                          className="p-3 bg-orange-50 hover:bg-orange-100 cursor-pointer text-sm font-bold text-orange-700 flex items-center justify-between"
                        >
                          <span>➕ "{searchQuery[index]}" Not Found! Add as New?</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="col-span-5 grid grid-cols-3 gap-2 mb-3 md:mb-0">
                  <div>
                    <input type="number" min="1" className="w-full border p-2 rounded text-center text-sm font-semibold" value={item.qty} onChange={(e) => handleUpdate(index, 'qty', parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <select className="w-full border p-2 rounded bg-white text-sm" value={item.unit} onChange={(e) => handleUpdate(index, 'unit', e.target.value)}>
                      {item.availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      className="w-full border p-2 rounded text-center text-sm font-bold bg-white"
                      value={item.price}
                      onChange={(e) => handleUpdate(index, 'price', parseFloat(e.target.value) || 0)}
                      placeholder="Rate"
                    />
                  </div>
                </div>

                <div className="col-span-2 flex justify-between items-center border-t md:border-none pt-2 md:pt-0">
                  <div className="md:w-full md:text-right md:pr-4">
                    <span className="font-bold text-gray-800 text-sm">₹ {(item.qty * item.price).toFixed(2)}</span>
                  </div>
                  <button type="button" onClick={() => removeRow(index)} className="text-red-400 hover:text-red-600 font-bold p-1">✕</button>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={addRow} className="w-full md:w-auto bg-gray-50 text-blue-600 px-4 py-2.5 rounded font-bold border border-dashed border-gray-300 hover:bg-gray-100 text-sm">+ Add Product Line</button>

      {/* Credit Ledger partial tracking split template */}
      <div className="border-t pt-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mt-4 space-y-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">💳 Payment Settlement</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Payment Mode</label>
            <select className="w-full border p-2.5 rounded-lg bg-white text-sm font-bold cursor-pointer focus:ring-2 focus:ring-blue-500" value={paymentMode} onChange={(e) => { setPaymentMode(e.target.value); if (e.target.value !== 'Split') setAmountPaid(0); }}>
              <option value="Cash">💵 Pure Cash (Nagad)</option>
              <option value="Online">📱 Online (UPI / QR Code)</option>
              <option value="Split">🤝 Split / Partial (Udhar Khata)</option>
            </select>
          </div>

          {paymentMode === 'Split' && (
            <>
              <div>
                <label className="block text-xs font-bold text-green-600 uppercase mb-1">Received Amount Now (₹)</label>
                <input type="number" placeholder="Amt" className="w-full border border-green-300 p-2 rounded-lg bg-white text-sm font-black text-green-700" value={amountPaid || ''} onChange={(e) => setAmountPaid(Math.min(grandTotal, parseFloat(e.target.value) || 0))} />
              </div>
              <div>
                <label className="block text-xs font-bold text-red-600 uppercase mb-1">Remaining Udhar Balance (₹)</label>
                <input type="text" readOnly className="w-full border border-red-200 p-2 rounded-lg bg-red-50 text-sm font-black text-red-600" value={`₹ ${remainingUdhar.toFixed(2)}`} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Layout Panel */}
      <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <div className="md:col-span-5 bg-gray-50 p-4 rounded-lg border border-gray-100 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">💸 Cash Discount (₹)</label>
            <input type="number" className="w-full border p-2 rounded bg-white text-sm font-bold text-red-600 focus:outline-none" value={discount || ''} onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">🛠️ Fitting Charge (₹)</label>
            <input type="number" className="w-full border p-2 rounded bg-white text-sm font-bold text-blue-600 focus:outline-none" value={serviceCharge || ''} onChange={(e) => setServiceCharge(Math.max(0, parseFloat(e.target.value) || 0))} />
          </div>
        </div>

        {/* Live Tax Display Box */}
        <div className="md:col-span-7 bg-gray-900 text-white p-5 rounded-xl space-y-2 text-sm shadow-md">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Items Base Subtotal:</span>
            <span className="font-mono">₹ {calculatedSubTotal.toFixed(2)}</span>
          </div>

          {isLocal ? (
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-400 border-b border-gray-800 pb-2">
              <div className="flex justify-between"><span>CGST:</span><span className="font-mono">₹ {totalCgst.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>SGST:</span><span className="font-mono">₹ {totalSgst.toFixed(2)}</span></div>
            </div>
          ) : (
            <div className="flex justify-between text-xs text-orange-400 border-b border-gray-800 pb-2">
              <span>IGST (InterState):</span>
              <span className="font-mono">₹ {totalIgst.toFixed(2)}</span>
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-between items-center pt-2 gap-4">
            <h2 className="text-xl font-black">
              Grand Total: <span className="text-green-400 font-mono">₹ {grandTotal.toFixed(2)}</span>
            </h2>
            <div className="flex gap-2">
              <button type="button" onClick={handleCancel} className="px-4 py-2 text-xs bg-gray-800 text-gray-300 rounded font-bold hover:bg-gray-700">Cancel</button>
              <button type="button" onClick={handleCompleteSale} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-bold text-xs shadow-md">Complete & Save Bill 🚀</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default BillingForm;