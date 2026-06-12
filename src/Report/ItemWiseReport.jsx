import React, { useState, useEffect } from 'react';
import { db } from '../Firebase/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

const ItemWiseReport = () => {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('qty'); // 'qty' ya 'profit'

    // Grand Summary States
    const [summary, setSummary] = useState({ totalQty: 0, totalRevenue: 0, totalProfit: 0 });

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                // 1. Fetch Inventory (Lagat/Cost Price nikalne ke liye)
                const invSnap = await getDocs(collection(db, "items"));
                const inventoryMap = {};
                invSnap.docs.forEach(doc => {
                    const data = doc.data();
                    inventoryMap[doc.id] = data; // Lookup by ID
                    inventoryMap[data.name] = data; // Lookup by Name fallback
                });

                // 2. Fetch All Bills (Bikri/Sales nikalne ke liye)
                const billsSnap = await getDocs(collection(db, "bills"));
                const partStats = {};

                let grandQty = 0;
                let grandRevenue = 0;
                let grandCost = 0;

                billsSnap.docs.forEach(doc => {
                    const bill = doc.data();
                    (bill.items || []).forEach(item => {
                        const key = item.name; // Part ka naam identifier hai

                        if (!partStats[key]) {
                            partStats[key] = { name: key, qtySold: 0, revenue: 0, cost: 0, profit: 0, currentStock: 0 };
                        }

                        // Sales details add karo
                        partStats[key].qtySold += item.qty;
                        const itemRevenue = (item.qty * item.price);
                        partStats[key].revenue += itemRevenue;

                        // Cost (Lagat) nikalo asli database se
                        const refItem = inventoryMap[item.productId] || inventoryMap[item.name];
                        const purchasePrice = refItem ? (refItem.purchasePrice || 0) : 0;
                        const itemCost = (item.qty * purchasePrice);
                        partStats[key].cost += itemCost;

                        // Live stock bhi dikha denge table mein
                        partStats[key].currentStock = refItem ? (refItem.openingStock || 0) : 0;

                        // Grand Totals update
                        grandQty += item.qty;
                        grandRevenue += itemRevenue;
                        grandCost += itemCost;
                    });
                });

                // Object ko Array mein convert karo aur Profit calculate karo
                const finalArray = Object.values(partStats).map(part => ({
                    ...part,
                    profit: part.revenue - part.cost
                }));

                setReportData(finalArray);
                setSummary({
                    totalQty: grandQty,
                    totalRevenue: grandRevenue,
                    totalProfit: grandRevenue - grandCost
                });

            } catch (error) {
                console.error("Analytics Fetch Error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    // Filter & Sort Logic
    const processedData = reportData
        .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === 'profit') return b.profit - a.profit;
            if (sortBy === 'revenue') return b.revenue - a.revenue;
            return b.qtySold - a.qtySold; // Default sort by Quantity
        });

    if (loading) {
        return <div className="p-10 text-center font-bold text-gray-500">⏳ Item Analytics load ho rahi hai...</div>;
    }

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">📈 Part-wise Sales & Profit Report</h1>
                <p className="text-sm text-gray-500">Kaunsa part sabse zyada bika aur kisne kitni kamai di.</p>
            </div>

            {/* --- GRAND SUMMARY CARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div><p className="text-xs font-bold text-gray-400 uppercase">Total Parts Sold</p><p className="text-2xl font-black text-gray-800">{summary.totalQty} Units</p></div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg text-2xl">📦</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div><p className="text-xs font-bold text-gray-400 uppercase">Total Items Revenue</p><p className="text-2xl font-black text-gray-800">₹ {summary.totalRevenue.toLocaleString()}</p></div>
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg text-2xl">💳</div>
                </div>
                <div className="bg-green-50 p-5 rounded-xl border border-green-100 shadow-sm flex items-center justify-between">
                    <div><p className="text-xs font-bold text-green-700 uppercase">Total Items Profit</p><p className="text-2xl font-black text-green-700">₹ {summary.totalProfit.toLocaleString()}</p></div>
                    <div className="p-3 bg-green-100 text-green-700 rounded-lg text-2xl">💰</div>
                </div>
            </div>

            {/* --- CONTROLS: SEARCH & SORT --- */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4">
                <input
                    type="text"
                    placeholder="🔍 Search specific part..."
                    className="flex-1 border p-2.5 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                    className="border p-2.5 rounded-lg bg-gray-50 text-sm font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    <option value="qty">🔥 Sort by Most Sold (Qty)</option>
                    <option value="profit">💰 Sort by Highest Profit</option>
                    <option value="revenue">💳 Sort by Highest Revenue</option>
                </select>
            </div>

            {/* --- DATA TABLE --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b text-gray-500 bg-gray-50 text-xs font-bold uppercase tracking-wider">
                                <th className="p-4 w-12 text-center">#</th>
                                <th className="p-4">Part Name</th>
                                <th className="p-4 text-center">Total Qty Sold</th>
                                <th className="p-4 text-right">Revenue Generated</th>
                                <th className="p-4 text-right text-green-700">Net Profit</th>
                                <th className="p-4 text-center">Current Stock</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {processedData.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-medium">No sales data found.</td></tr>
                            ) : (
                                processedData.map((part, index) => (
                                    <tr key={part.name} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-center text-gray-400 font-bold">{index + 1}</td>
                                        <td className="p-4 font-bold text-gray-800 uppercase">{part.name}</td>
                                        <td className="p-4 text-center font-black text-blue-600">{part.qtySold}</td>
                                        <td className="p-4 text-right font-mono font-medium text-gray-600">₹{part.revenue.toLocaleString()}</td>
                                        <td className="p-4 text-right font-mono font-black text-green-600">₹{part.profit.toLocaleString()}</td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${part.currentStock < 5 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                {part.currentStock} Pcs
                                            </span>
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

export default ItemWiseReport;