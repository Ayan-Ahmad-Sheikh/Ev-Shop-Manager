import React, { useState, useEffect } from 'react';
import { db, auth } from '../Firebase/firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";

const TaxReports = () => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('GSTR1');

    // Date Filter State (Default to current month YYYY-MM)
    const today = new Date();
    const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

    // Data States
    const [bills, setBills] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [inventory, setInventory] = useState({});

    useEffect(() => {
        // 🔥 FIX: Firebase Auth ka jagna wait karo, taki refresh karne par report crash na ho
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const userId = user.uid; // Direct UID yahan se lo
                setLoading(true);

                // 1. Fetch Inventory (Sirf apna)
                const invQuery = query(collection(db, "items"), where("userId", "==", userId));
                const invSnap = await getDocs(invQuery);
                const invMap = {};
                invSnap.docs.forEach(doc => { 
                    invMap[doc.id] = doc.data(); 
                    invMap[doc.data().name] = doc.data(); 
                });
                setInventory(invMap);

                // 2. Fetch Bills (Sirf apna)
                const billsQuery = query(collection(db, "bills"), where("userId", "==", userId));
                const billsSnap = await getDocs(billsQuery);
                const billsList = billsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setBills(billsList);

                // 3. Fetch Expenses (Sirf apna)
                const expQuery = query(collection(db, "expenses"), where("userId", "==", userId));
                const expSnap = await getDocs(expQuery);
                const expList = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setExpenses(expList);

            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false); // Ab report aane ke baad hi chakkari hategi
            }
        });

        // Cleanup
        return () => unsubscribe();
    }, []);

    // --- FILTER DATA BY SELECTED MONTH ---
    const currentMonthBills = bills.filter(b => b.billDate && b.billDate.startsWith(selectedMonth));
    const currentMonthExpenses = expenses.filter(e => e.date && e.date.startsWith(selectedMonth));

    // --- 1. GSTR-1 CALCULATIONS ---
    let b2bTaxable = 0, b2cTaxable = 0;
    let totalCGST = 0, totalSGST = 0, totalIGST = 0;

    currentMonthBills.forEach(bill => {
        if (bill.invoiceType === 'B2B') b2bTaxable += bill.subTotal;
        else b2cTaxable += bill.subTotal;

        totalCGST += (bill.cgst || 0);
        totalSGST += (bill.sgst || 0);
        totalIGST += (bill.igst || 0);
    });

    const totalGstCollected = totalCGST + totalSGST + totalIGST;
    const totalRevenueIncludingTax = b2bTaxable + b2cTaxable + totalGstCollected;

    // --- 2. HSN SUMMARY CALCULATIONS ---
    const hsnMap = {};
    currentMonthBills.forEach(bill => {
        (bill.items || []).forEach(item => {
            const hsn = item.hsnCode || (item.refData && item.refData.hsnCode) || 'N/A';
            if (!hsnMap[hsn]) {
                hsnMap[hsn] = { hsn, qty: 0, taxableValue: 0, taxAmount: 0 };
            }

            const itemTaxable = item.qty * item.price;
            const taxRate = item.refData ? (item.refData.gstRate || 0) : 18;
            const itemTax = (itemTaxable * taxRate) / 100;

            hsnMap[hsn].qty += item.qty;
            hsnMap[hsn].taxableValue += itemTaxable;
            hsnMap[hsn].taxAmount += itemTax;
        });
    });
    const hsnSummaryArray = Object.values(hsnMap).sort((a, b) => b.taxableValue - a.taxableValue);

    // --- 3. PROFIT & LOSS CALCULATIONS ---
    let totalCOGS = 0; // Cost of Goods Sold
    currentMonthBills.forEach(bill => {
        (bill.items || []).forEach(item => {
            const refItem = inventory[item.productId] || inventory[item.name];
            const purchasePrice = refItem ? (refItem.purchasePrice || 0) : 0;
            totalCOGS += (item.qty * purchasePrice);
        });
    });

    const totalSalesRevenue = b2bTaxable + b2cTaxable; // Tax-exclusive
    const grossProfit = totalSalesRevenue - totalCOGS;
    const totalOperatingExpenses = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = grossProfit - totalOperatingExpenses;

    if (loading) {
        return (
            <div className="p-4 md:p-6 bg-gray-50 min-h-screen animate-pulse">

                {/* 1. Header & Controls Skeleton */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-200 pb-4">
                    <div>
                        <div className="h-8 bg-gray-300 rounded-md w-72 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded-md w-96 max-w-full"></div>
                    </div>
                    <div className="h-10 bg-white border border-gray-200 rounded-lg w-48"></div>
                </div>

                {/* 2. Tabs Navigation Skeleton */}
                <div className="flex bg-gray-200 p-1 rounded-xl w-fit mb-6 shadow-inner gap-2">
                    <div className="h-10 bg-white rounded-lg w-36 shadow-sm"></div>
                    <div className="h-10 bg-gray-300 rounded-lg w-36"></div>
                    <div className="h-10 bg-gray-300 rounded-lg w-36"></div>
                </div>

                {/* 3. GSTR-1 Summary Cards Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="h-3 bg-gray-200 rounded w-28 mb-3"></div>
                        <div className="h-8 bg-indigo-100 rounded w-32 mb-2"></div>
                        <div className="h-2 bg-gray-100 rounded w-24"></div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="h-3 bg-gray-200 rounded w-28 mb-3"></div>
                        <div className="h-8 bg-cyan-100 rounded w-32 mb-2"></div>
                        <div className="h-2 bg-gray-100 rounded w-24"></div>
                    </div>
                    {/* Dark Theme Card Skeleton */}
                    <div className="bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-800 md:col-span-2 flex justify-between items-center">
                        <div>
                            <div className="h-3 bg-gray-600 rounded w-40 mb-3"></div>
                            <div className="h-8 bg-gray-700 rounded w-48"></div>
                        </div>
                        <div className="space-y-2 text-right">
                            <div className="h-3 bg-gray-700 rounded w-20 ml-auto"></div>
                            <div className="h-3 bg-gray-700 rounded w-20 ml-auto"></div>
                            <div className="h-3 bg-gray-700 rounded w-20 ml-auto"></div>
                        </div>
                    </div>
                </div>

                {/* 4. Sales Register Table Skeleton */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="h-6 bg-gray-300 rounded w-64 mb-6 border-b pb-2"></div>

                    {/* Table Header */}
                    <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
                        <div className="h-4 bg-gray-300 rounded w-20"></div>
                        <div className="h-4 bg-gray-300 rounded w-16"></div>
                        <div className="h-4 bg-gray-300 rounded w-32"></div>
                        <div className="h-4 bg-gray-300 rounded w-24 text-right"></div>
                        <div className="h-4 bg-gray-300 rounded w-20 text-right"></div>
                        <div className="h-4 bg-gray-300 rounded w-24 text-right"></div>
                    </div>

                    {/* Table Rows */}
                    {[1, 2, 3, 4, 5].map((row) => (
                        <div key={row} className="flex justify-between items-center py-4 border-b border-gray-50 last:border-0">
                            <div className="h-4 bg-gray-200 rounded w-24"></div>
                            <div className="h-5 bg-indigo-50 rounded w-12"></div>
                            <div className="h-4 bg-gray-200 rounded w-32"></div>
                            <div className="h-4 bg-gray-200 rounded w-20"></div>
                            <div className="h-4 bg-red-50 rounded w-16"></div>
                            <div className="h-5 bg-gray-200 rounded w-24"></div>
                        </div>
                    ))}

                    {/* Loading Text */}
                    <div className="text-center mt-6">
                        <p className="text-sm font-bold text-gray-400 tracking-wide">⏳ Compiling secure tax data & GSTR ledgers...</p>
                    </div>
                </div>

            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-200 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">📊 Tax & Compliance Reports</h1>
                    <p className="text-sm text-gray-500">CA ke liye GSTR-1, HSN details aur P&L Statements.</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-lg border shadow-sm">
                    <label className="text-xs font-bold text-gray-500 uppercase">Select Month:</label>
                    <input
                        type="month"
                        className="border-none font-bold text-gray-800 outline-none cursor-pointer"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                </div>
            </div>

            {/* TABS NAVIGATION */}
            <div className="flex bg-gray-200 p-1 rounded-xl w-fit mb-6 shadow-inner">
                <button onClick={() => setActiveTab('GSTR1')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'GSTR1' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-900'}`}>GSTR-1 Summary</button>
                <button onClick={() => setActiveTab('HSN')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'HSN' ? 'bg-white text-purple-600 shadow' : 'text-gray-600 hover:text-gray-900'}`}>HSN/SAC Summary</button>
                <button onClick={() => setActiveTab('PNL')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'PNL' ? 'bg-white text-green-600 shadow' : 'text-gray-600 hover:text-gray-900'}`}>Profit & Loss (P&L)</button>
            </div>

            {/* --- TAB 1: GSTR-1 SUMMARY --- */}
            {activeTab === 'GSTR1' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-400 uppercase">B2B Taxable Sales</p>
                            <h3 className="text-2xl font-black text-indigo-700 mt-1">₹ {b2bTaxable.toLocaleString('en-IN')}</h3>
                            <p className="text-[10px] text-gray-500 mt-1">Registered Dealers</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-400 uppercase">B2C Taxable Sales</p>
                            <h3 className="text-2xl font-black text-cyan-700 mt-1">₹ {b2cTaxable.toLocaleString('en-IN')}</h3>
                            <p className="text-[10px] text-gray-500 mt-1">Unregistered Consumers</p>
                        </div>
                        <div className="bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-800 md:col-span-2 flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold text-purple-400 uppercase">Total GST Output Liability</p>
                                <h3 className="text-2xl font-black text-white mt-1">₹ {totalGstCollected.toLocaleString('en-IN')}</h3>
                            </div>
                            <div className="text-right text-xs font-mono text-gray-300 space-y-1">
                                <p>CGST: ₹ {totalCGST.toFixed(2)}</p>
                                <p>SGST: ₹ {totalSGST.toFixed(2)}</p>
                                <p className="text-orange-400">IGST: ₹ {totalIGST.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Sales Register ({selectedMonth})</h3>
                        <div className="overflow-x-auto h-96 overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 bg-white">
                                    <tr className="border-b text-gray-500 uppercase tracking-wider text-xs">
                                        <th className="p-3">Invoice No</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">GSTIN</th>
                                        <th className="p-3 text-right">Taxable Val</th>
                                        <th className="p-3 text-right">Tax Amt</th>
                                        <th className="p-3 text-right">Invoice Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {currentMonthBills.length === 0 ? <tr><td colSpan="6" className="p-5 text-center text-gray-400">No invoices for this month.</td></tr> :
                                        currentMonthBills.map(bill => (
                                            <tr key={bill.id} className="hover:bg-gray-50">
                                                <td className="p-3 font-bold text-gray-800">{bill.id}</td>
                                                <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${bill.invoiceType === 'B2B' ? 'bg-indigo-100 text-indigo-700' : 'bg-cyan-100 text-cyan-700'}`}>{bill.invoiceType}</span></td>
                                                <td className="p-3 font-mono text-xs">{bill.customerGstin || 'URD'}</td>
                                                {/* 🔥 FIX APPLIED HERE */}
                                                <td className="p-3 text-right font-medium">₹{(bill.subTotal || 0).toFixed(2)}</td>
                                                <td className="p-3 text-right font-medium text-red-600">₹{(bill.totalTax || 0).toFixed(2)}</td>
                                                <td className="p-3 text-right font-black">₹{(bill.grandTotal || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB 2: HSN SUMMARY --- */}
            {activeTab === 'HSN' && (
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h3 className="text-lg font-bold text-gray-800">HSN/SAC Summary (Table 12)</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b text-gray-500 uppercase tracking-wider text-xs bg-gray-50">
                                    <th className="p-4">HSN / SAC Code</th>
                                    <th className="p-4 text-center">Total Quantity</th>
                                    <th className="p-4 text-right">Total Taxable Value</th>
                                    <th className="p-4 text-right">Total Tax Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {hsnSummaryArray.length === 0 ? <tr><td colSpan="4" className="p-5 text-center text-gray-400">No data available.</td></tr> :
                                    hsnSummaryArray.map((hsn, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="p-4 font-mono font-bold text-purple-700">{hsn.hsn}</td>
                                            <td className="p-4 text-center font-bold text-gray-700">{hsn.qty}</td>
                                            <td className="p-4 text-right font-medium text-gray-800">₹ {hsn.taxableValue.toLocaleString('en-IN')}</td>
                                            <td className="p-4 text-right font-bold text-red-600">₹ {hsn.taxAmount.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- TAB 3: PROFIT & LOSS --- */}
            {activeTab === 'PNL' && (
                <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-center mb-8 border-b pb-4">
                        <h2 className="text-2xl font-black text-gray-900 uppercase">Statement of Profit & Loss</h2>
                        <p className="text-gray-500 font-medium">For the month ended {selectedMonth}</p>
                    </div>

                    <div className="space-y-2 text-sm md:text-base">
                        <div className="flex justify-between p-3 bg-gray-50 font-bold text-gray-800 rounded">
                            <span>Revenue from Operations (Sales without Tax)</span>
                            <span>₹ {totalSalesRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between p-3 text-red-600 font-medium">
                            <span>Less: Cost of Goods Sold (Purchases)</span>
                            <span>- ₹ {totalCOGS.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between p-3 border-t border-b border-gray-300 font-black text-lg text-gray-900">
                            <span>Gross Profit</span>
                            <span>₹ {grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="pt-4"></div>

                        <div className="flex justify-between p-3 text-orange-600 font-medium">
                            <span>Less: Operating Expenses (Rent, Salary, etc.)</span>
                            <span>- ₹ {totalOperatingExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="pt-2"></div>

                        <div className={`flex justify-between p-4 rounded-lg font-black text-xl border-2 ${netProfit >= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            <span>Net {netProfit >= 0 ? 'Profit' : 'Loss'} for the Month</span>
                            <span>₹ {Math.abs(netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div className="mt-8 text-center text-xs text-gray-400 font-bold uppercase tracking-widest">
                        *** System Generated Report ***
                    </div>
                </div>
            )}

        </div>
    );
};

export default TaxReports;