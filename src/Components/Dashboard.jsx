import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { db, auth } from '../Firebase/firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';

const Dashboard = () => {
    const navigate = useNavigate();
    const [timeFrame, setTimeFrame] = useState('monthly');

    const [inventory, setInventory] = useState([]);
    const [recentBills, setRecentBills] = useState([]);
    const [allBills, setAllBills] = useState([]);
    const [allExpenses, setAllExpenses] = useState([]); // 🔥 NEW STATE: Saare kharche store karne ke liye
    const [totalUdhar, setTotalUdhar] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            // 👉 Agar login nahi hai, toh aage mat badho
            if (!auth.currentUser) return;

            try {
                const userId = auth.currentUser.uid;

                // A. Stock data laayein (Sirf apna)
                const invQuery = query(collection(db, "items"), where("userId", "==", userId));
                const invSnap = await getDocs(invQuery);
                setInventory(invSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

                // B. Bills data laayein (Sirf apna)
                const billsQuery = query(collection(db, "bills"), where("userId", "==", userId));
                const billsSnap = await getDocs(billsQuery);
                const billsList = billsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                billsList.sort((a, b) => new Date(b.billDate) - new Date(a.billDate));
                setRecentBills(billsList.slice(0, 5));
                setAllBills(billsList);

                // 🔥 C. NEW: Expenses data live laayein (Sirf apna)
                const expQuery = query(collection(db, "expenses"), where("userId", "==", userId));
                const expSnap = await getDocs(expQuery);
                const expList = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllExpenses(expList);

                // D. Customers ka Udhar laayein (Sirf apna)
                const custQuery = query(collection(db, "customers"), where("userId", "==", userId));
                const custSnap = await getDocs(custQuery);
                let udharSum = 0;
                custSnap.forEach(doc => { udharSum += (doc.data().totalDue || 0); });
                setTotalUdhar(udharSum);

            } catch (error) {
                console.error("Dashboard Fetch Error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    // 1. STOCK LOGIC CALCULATIONS
    const lowStockItems = inventory.filter(item => item.openingStock <= item.minStock);
    const totalStockValue = inventory.reduce((sum, item) => sum + (item.openingStock * item.purchasePrice), 0);

    const now = new Date();

    // 2. TIMEFRAME FILTER FOR BILLS
    const filteredBills = allBills.filter(bill => {
        if (!bill.billDate) return false;
        const billDate = new Date(bill.billDate);
        const diffDays = Math.ceil(Math.abs(now - billDate) / (1000 * 60 * 60 * 24));

        if (timeFrame === 'daily') return diffDays <= 1;
        if (timeFrame === 'weekly') return diffDays <= 7;
        if (timeFrame === 'monthly') return diffDays <= 30;
        if (timeFrame === 'yearly') return diffDays <= 365;
        return true;
    });

    // 🔥 3. TIMEFRAME FILTER FOR EXPENSES
    const filteredExpenses = allExpenses.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        const diffDays = Math.ceil(Math.abs(now - expDate) / (1000 * 60 * 60 * 24));

        if (timeFrame === 'daily') return diffDays <= 1;
        if (timeFrame === 'weekly') return diffDays <= 7;
        if (timeFrame === 'monthly') return diffDays <= 30;
        if (timeFrame === 'yearly') return diffDays <= 365;
        return true;
    });

    // Total expenses of selected timeframe
    const totalExpensesTimeframe = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // 4. PROFIT, TAX & MULTI-CHANNEL SUMMARY CALCULATION
    let currentSales = 0;
    let currentCost = 0;
    let b2bSales = 0;
    let b2cSales = 0;
    let taxCollected = 0;

    filteredBills.forEach(bill => {
        currentSales += (bill.grandTotal || 0);
        taxCollected += (bill.totalTax || 0);

        if (bill.invoiceType === 'B2B') {
            b2bSales += (bill.grandTotal || 0);
        } else {
            b2cSales += (bill.grandTotal || 0);
        }

        (bill.items || []).forEach(item => {
            const invItem = inventory.find(i => i.id === item.productId || i.name === item.name);
            const pPrice = invItem ? (invItem.purchasePrice || 0) : 0;
            currentCost += (item.qty * pPrice);
        });
    });

    // 🔥 TRUE NET PROFIT: Revenue me se GST Tax, Maal ki Cost aur Dukan ke Kharche sab minus kar diye
    const netProfit = (currentSales - taxCollected) - currentCost - totalExpensesTimeframe;
    const isProfit = netProfit >= 0;

    const currentSummary = {
        totalSales: currentSales,
        b2b: b2bSales,
        b2c: b2cSales,
        tax: taxCollected,
        expenses: totalExpensesTimeframe,
        billCount: filteredBills.length
    };

    // 5. TOP SELLING PARTS CALCULATION
    const partSalesMap = {};
    allBills.forEach(bill => {
        (bill.items || []).forEach(item => {
            if (item.name) {
                partSalesMap[item.name] = (partSalesMap[item.name] || 0) + item.qty;
            }
        });
    });

    const topPartsSorted = Object.keys(partSalesMap)
        .map(name => ({ name, sold: partSalesMap[name] }))
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 10);

    // 6. DYNAMIC GRAPH GENERATION
    let activeGraphData = [];
    if (timeFrame === 'yearly') {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        activeGraphData = months.map(m => ({ name: m, sales: 0 }));
        filteredBills.forEach(b => {
            const mIndex = new Date(b.billDate).getMonth();
            activeGraphData[mIndex].sales += b.grandTotal;
        });
    } else if (timeFrame === 'weekly') {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        activeGraphData = days.map(d => ({ name: d, sales: 0 }));
        filteredBills.forEach(b => {
            const dIndex = new Date(b.billDate).getDay();
            activeGraphData[dIndex].sales += b.grandTotal;
        });
    } else {
        const tempMap = {};
        filteredBills.forEach(b => {
            const dStr = new Date(b.billDate).toLocaleDateString('en-IN');
            tempMap[dStr] = (tempMap[dStr] || 0) + b.grandTotal;
        });
        activeGraphData = Object.keys(tempMap).map(k => ({ name: k, sales: tempMap[k] }));
    }

    if (loading) {
        return <div className="p-10 text-center text-gray-500 font-bold text-lg">⏳ Loading Business Intelligence...</div>;
    }

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen space-y-6">

            {/* HEADER & TIMEFRAME TABS */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Business Control Center</h1>
                    <p className="text-gray-500 text-sm font-medium">Real-time charts, expense-linked profits, and GST metrics</p>
                </div>

                <div className="flex bg-gray-200 p-1 rounded-lg self-start md:self-auto shadow-inner">
                    {['daily', 'weekly', 'monthly', 'yearly'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setTimeFrame(tab)}
                            className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-semibold capitalize transition-all ${timeFrame === tab ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* QUICK ACTIONS SHORTCUTS */}
            <div className="bg-white p-4 rounded-lg shadow-sm border flex flex-wrap gap-3">
                <button
                    onClick={() => navigate('/new-bill', { state: { from: '/' } })}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold px-5 py-2.5 rounded-lg shadow-md hover:bg-blue-700 transition-all text-sm"
                >
                    🧾 + New Sale Bill
                </button>
                <button
                    onClick={() => navigate('/add-item', { state: { from: '/' } })}
                    className="flex items-center justify-center gap-2 bg-gray-800 text-white font-bold px-5 py-2.5 rounded-lg shadow-md hover:bg-gray-900 transition-all text-sm"
                >
                    📦 + Add New Stock
                </button>
            </div>

            {/* TOP 4 SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* CARD 1: SALES */}
                <div className="p-5 bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div>
                        <p className="text-sm text-gray-400 font-bold mb-1 uppercase tracking-wider">Total Sales ({timeFrame})</p>
                        <h3 className="text-2xl font-black text-gray-800">₹{currentSummary.totalSales.toLocaleString()}</h3>
                    </div>
                    <div className="mt-3 flex justify-between items-center text-[10px] font-bold">
                        <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100">B2B: ₹{currentSummary.b2b.toLocaleString()}</span>
                        <span className="bg-cyan-50 text-cyan-600 px-2 py-1 rounded border border-cyan-100">B2C: ₹{currentSummary.b2c.toLocaleString()}</span>
                    </div>
                </div>

                {/* CARD 2: STOCK VALUE */}
                <div className="p-5 bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div><p className="text-sm text-gray-400 font-bold mb-1 uppercase tracking-wider">Total Stock Value</p><h3 className="text-2xl font-black text-blue-600">₹{totalStockValue.toLocaleString()}</h3></div>
                    <p className="text-xs text-blue-400 font-bold mt-2 bg-blue-50 w-fit px-2 py-1 rounded">Godown Valuation</p>
                </div>

                {/* CARD 3: REORDER ALERTS */}
                <div className="p-5 rounded-lg shadow-sm border flex flex-col justify-between ${lowStockItems.length > 0 ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-100'}">
                    <div><p className="text-sm text-gray-400 font-bold mb-1 uppercase tracking-wider">Reorder Alerts</p><h3 className={`text-2xl font-black ${lowStockItems.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>{lowStockItems.length} Parts</h3></div>
                    <p className="text-xs text-gray-500 font-bold mt-2">Below minimum alert</p>
                </div>

                {/* CARD 4: TRUE NET PROFIT LINKED WITH EXPENSES */}
                <div className={`p-5 rounded-lg shadow-sm border flex flex-col justify-between ${isProfit ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <div>
                        <p className={`text-sm font-bold uppercase tracking-wider mb-1 ${isProfit ? 'text-green-700' : 'text-red-700'}`}>Net {isProfit ? 'Profit' : 'Loss'} ({timeFrame})</p>
                        <h3 className={`text-2xl font-black ${isProfit ? 'text-green-600' : 'text-red-600'}`}>₹{Math.abs(netProfit).toLocaleString()}</h3>
                    </div>
                    {/* Live indicator showing expenses are deducted */}
                    <p className="text-[10px] font-bold text-gray-400 mt-2">
                        Expenses Deducted: <span className="text-red-500">₹{currentSummary.expenses.toLocaleString()}</span>
                    </p>
                </div>
            </div>

            {/* LEDGER & TAX MASTER DOUBLE CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div onClick={() => navigate('/customer-ledger')} className="bg-white p-5 rounded-xl border border-red-200 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                        <span className="text-2xl opacity-50">⚠️</span>
                    </div>
                    <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Total Market Khata (Pending Udhar)</p>
                    <h3 className="text-3xl font-black text-gray-800">₹ {totalUdhar.toLocaleString('en-IN')}</h3>
                    <div className="mt-2 text-xs font-bold text-red-600 flex justify-between w-full">
                        <span>Recovery Pending Collection</span>
                        <span>View Khata ➔</span>
                    </div>
                </div>

                <div className="bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-800 relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-purple-900/30 rounded-full flex items-center justify-center">
                        <span className="text-2xl opacity-50">⚖️</span>
                    </div>
                    <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">GST Tax Liability Collected ({timeFrame})</p>
                    <h3 className="text-3xl font-black text-white">₹ {currentSummary.tax.toLocaleString('en-IN')}</h3>
                    <div className="mt-2 text-[10px] font-bold text-gray-400">
                        *This amount includes CGST, SGST & IGST to be filed
                    </div>
                </div>
            </div>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-gray-800 capitalize">{timeFrame} Sales Trend</h2>
                        <p className="text-xs text-gray-400">Revenue visualization according to selected filter</p>
                    </div>

                    <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            {timeFrame === 'yearly' || timeFrame === 'daily' ? (
                                <BarChart data={activeGraphData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                                    <YAxis stroke="#9CA3AF" fontSize={11} />
                                    <Tooltip formatter={(value) => [`₹${value}`, 'Sales']} cursor={{ fill: '#f3f4f6' }} />
                                    <Bar dataKey="sales" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            ) : (
                                <LineChart data={activeGraphData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                                    <YAxis stroke="#9CA3AF" fontSize={12} />
                                    <Tooltip formatter={(value) => [`₹${value}`, 'Sales']} />
                                    <Line type="monotone" dataKey="sales" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4, fill: '#4F46E5' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 mb-1">Top Selling Parts</h2>
                        <p className="text-xs text-gray-400 mb-4">Top 10 moving inventory assets</p>
                    </div>
                    <div className="w-full h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topPartsSorted} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" stroke="#9CA3AF" fontSize={10} width={80} tickLine={false} axisLine={false} />
                                <Tooltip formatter={(value) => [value, 'Qty Sold']} cursor={{ fill: '#f3f4f6' }} />
                                <Bar dataKey="sold" fill="#111827" radius={[0, 4, 4, 0]} barSize={15} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {/* 🔥 YAHAN WAPAS AAGAYA BUTTON JO NAYE PAGE PAR LE JAYEGA */}
                    <button
                        onClick={() => navigate('/item-report')}
                        className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:bg-blue-50 py-2 rounded transition-colors"
                    >
                        View Full Items List →
                    </button>
                </div>
            </div>

            {/* LOW STOCK & RECENT SALES TABLES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Low Stock Purchase Alerts</h2>
                    {lowStockItems.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead><tr className="text-gray-400 border-b"><th className="pb-2">Part Name</th><th className="pb-2 text-center">Stock</th><th className="pb-2 text-center">Min Alert</th></tr></thead>
                                <tbody>
                                    {lowStockItems.map(item => (
                                        <tr key={item.id} className="border-b last:border-0">
                                            <td className="py-2.5 font-bold text-gray-800">{item.name}</td>
                                            <td className="py-2.5 text-center text-red-600 font-bold bg-red-50 rounded border border-red-100">{item.openingStock} {item.primaryUnit}</td>
                                            <td className="py-2.5 text-center text-gray-400 font-medium">{item.minStock}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-green-600 font-bold text-sm bg-green-50 rounded border border-green-100">✅ All inventory levels are safe!</div>
                    )}
                </div>

                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Recent Bills Generated</h2>
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b text-gray-400">
                                    <th className="pb-2">Customer & Type</th>
                                    <th className="pb-2 text-right">Amount</th>
                                    <th className="pb-2 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentBills.length === 0 ? (
                                    <tr><td colSpan="3" className="py-4 text-center text-gray-400 font-bold">No sales yet</td></tr>
                                ) : (
                                    recentBills.map((bill, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                            <td className="py-3">
                                                <div className="font-bold text-gray-800">{bill.customerName || 'Cash Customer'}</div>
                                                <div className="text-[10px] font-bold mt-0.5">
                                                    {bill.invoiceType === 'B2B' ? (
                                                        <span className="text-indigo-600 bg-indigo-50 px-1.5 rounded">📦 B2B Wholesale</span>
                                                    ) : (
                                                        <span className="text-cyan-600 bg-cyan-50 px-1.5 rounded">🛍️ B2C Retail</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 font-black text-gray-900 text-right">₹{bill.grandTotal.toLocaleString('en-IN')}</td>
                                            <td className="py-3 text-center">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${bill.remainingUdhar === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {bill.remainingUdhar === 0 ? 'Paid' : 'Udhar'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={() => navigate('/billing')} className="w-full mt-4 bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded hover:bg-gray-200 transition-colors">
                        View Complete Ledger →
                    </button>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;