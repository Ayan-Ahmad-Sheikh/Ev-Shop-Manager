import React, { useState, useEffect } from 'react';
import { db, auth } from '../Firebase/firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";

const ItemWiseReport = () => {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('qty'); // 'qty' ya 'profit'

    // Grand Summary States
    const [summary, setSummary] = useState({ totalQty: 0, totalRevenue: 0, totalProfit: 0 });

    const [inventoryMap, setInventoryMap] = useState({});

    const formatStockDisplay = (stock, primaryUnit, secondaryUnit, conversionRate) => {
        if (!secondaryUnit || !conversionRate) return `${Number(stock).toFixed(2).replace(/\.00$/, '')} ${primaryUnit}`;
        const totalLooseItems = Math.round(Number(stock) * Number(conversionRate));
        const mainUnitCount = Math.floor(totalLooseItems / Number(conversionRate));
        const looseUnitCount = totalLooseItems % Number(conversionRate);
        return `${mainUnitCount > 0 ? `${mainUnitCount} ${primaryUnit} ` : ''}${looseUnitCount > 0 ? `${looseUnitCount} ${secondaryUnit}` : ''}`.trim() || `0 ${primaryUnit}`;
    };

    useEffect(() => {
        // 🔥 FIX: Firebase Auth ka wait karo taaki Refresh karne par loading stuck na ho
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const userId = user.uid; // Direct user.uid mil gaya

                // 1. Fetch Inventory (Sirf apna)
                const invQuery = query(collection(db, "items"), where("userId", "==", userId));
                const invSnap = await getDocs(invQuery);
                const tempMap = {};
                invSnap.docs.forEach(doc => {
                    const data = doc.data();
                    tempMap[doc.id] = data;
                    tempMap[data.name] = data;
                });

                setInventoryMap(tempMap);

                // 2. Fetch All Bills (Sirf apna)
                const billsQuery = query(collection(db, "bills"), where("userId", "==", userId));
                const billsSnap = await getDocs(billsQuery);
                const partStats = {};

                let grandQty = 0;
                let grandRevenue = 0;
                let grandCost = 0;

                billsSnap.docs.forEach(doc => {
                    const bill = doc.data();
                    (bill.items || []).forEach(item => {
                        const key = item.name; // Part ka naam identifier hai

                        if (!partStats[key]) {
                            partStats[key] = { name: key, qtySold: 0, revenue: 0, cost: 0, profit: 0, currentStock: 0, primaryUnit: 'Unit', secondaryUnit: '', conversionRate: 1, primaryQty: 0, primaryRevenue: 0, primaryCost: 0, secondaryQty: 0, secondaryRevenue: 0, secondaryCost: 0 };
                        }

                        // Sales details add karo
                        partStats[key].qtySold += item.qty;
                        const itemRevenue = (item.qty * item.price);
                        partStats[key].revenue += itemRevenue;

                        // Cost (Lagat) nikalo asli database se
                        const refItem = tempMap[item.productId] || tempMap[item.name];

                        if (refItem) {
                            partStats[key].primaryUnit = refItem.primaryUnit || 'Unit';
                            partStats[key].secondaryUnit = refItem.secondaryUnit || '';
                            partStats[key].conversionRate = refItem.conversionRate || 1;
                            partStats[key].currentStock = refItem.openingStock || 0;
                        }

                        let costPricePerUnit = refItem ? (Number(refItem.purchasePrice) || 0) : 0;

                        const isSecondary = refItem && item.unit === refItem.secondaryUnit;

                        if (isSecondary) {
                            // 📦 Pcs (Loose) ki calculation
                            const convRate = Number(refItem.conversionRate) || 1;
                            costPricePerUnit = costPricePerUnit / convRate;

                            partStats[key].secondaryQty += item.qty;
                            partStats[key].secondaryRevenue += itemRevenue;
                            partStats[key].secondaryCost += (item.qty * costPricePerUnit);
                        } else {
                            // 📦 Box (Bulk) ki calculation
                            partStats[key].primaryQty += item.qty;
                            partStats[key].primaryRevenue += itemRevenue;
                            partStats[key].primaryCost += (item.qty * costPricePerUnit);
                        }

                        // 💡 Note: Agar tu aage chal kar secondary unit (e.g. Box vs Pcs) laata hai, 
                        // toh purchasePrice ko yahan conversionRate se divide karna padega. 
                        // Abhi ke liye tera logic 100% correct hai.
                        const itemCost = (item.qty * costPricePerUnit);

                        partStats[key].cost += itemCost;
                        // Live stock update
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
                    profit: part.revenue - part.cost,
                    primaryProfit: part.primaryRevenue - part.primaryCost,
                    secondaryProfit: part.secondaryRevenue - part.secondaryCost
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
                setLoading(false); // Ab hamesha loading hategi
            }
        });

        // Cleanup
        return () => unsubscribe();
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
        return (
            <div className="p-4 md:p-6 bg-gray-50 min-h-screen animate-pulse">

                {/* 1. Header Skeleton */}
                <div className="mb-6">
                    <div className="h-8 bg-gray-300 rounded-md w-72 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded-md w-96 max-w-full"></div>
                </div>

                {/* 2. Grand Summary Cards Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                            <div>
                                <div className="h-3 bg-gray-200 rounded w-32 mb-3"></div>
                                <div className="h-8 bg-gray-300 rounded w-24"></div>
                            </div>
                            <div className="h-12 w-12 bg-gray-100 rounded-lg"></div>
                        </div>
                    ))}
                </div>

                {/* 3. Controls (Search & Sort) Skeleton */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 h-11 bg-gray-100 rounded-lg"></div>
                    <div className="w-full md:w-64 h-11 bg-gray-100 rounded-lg"></div>
                </div>

                {/* 4. Data Table Skeleton */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    {/* Table Header */}
                    <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
                        <div className="h-4 bg-gray-300 rounded w-6"></div>
                        <div className="h-4 bg-gray-300 rounded w-32"></div>
                        <div className="h-4 bg-gray-300 rounded w-24 text-center"></div>
                        <div className="h-4 bg-gray-300 rounded w-28 text-right"></div>
                        <div className="h-4 bg-gray-300 rounded w-24 text-right"></div>
                        <div className="h-4 bg-gray-300 rounded w-20 text-center"></div>
                    </div>

                    {/* Table Rows */}
                    {[1, 2, 3, 4, 5, 6].map((row) => (
                        <div key={row} className="flex justify-between items-center py-4 border-b border-gray-50 last:border-0">
                            <div className="h-4 bg-gray-200 rounded w-4"></div>
                            <div className="h-4 bg-gray-300 rounded w-48"></div>
                            <div className="h-6 bg-blue-50 rounded w-12"></div>
                            <div className="h-4 bg-gray-200 rounded w-24"></div>
                            <div className="h-5 bg-green-100 rounded w-24"></div>
                            <div className="h-6 bg-gray-100 rounded w-16"></div>
                        </div>
                    ))}

                    {/* Loading Message */}
                    <div className="text-center mt-6 p-2">
                        <p className="text-sm font-bold text-gray-400 tracking-wide">⏳ Crunching data for Part-wise Analytics...</p>
                    </div>
                </div>

            </div>
        );
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
                                <th className="p-4 text-right">Total Revenue</th>
                                <th className="p-4 text-right text-blue-600">Primary Profit</th>
                                <th className="p-4 text-right text-purple-600">Secondary Profit</th>
                                <th className="p-4 text-right text-green-700">Net Profit</th>
                                <th className="p-4 text-center">Current Stock</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {processedData.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="p-8 text-center text-gray-400 font-medium">No sales data found.</td>
                                </tr>
                            ) : (
                                processedData.map((part, index) => {
                                    const itemRef = inventoryMap ? inventoryMap[part.name] : null;

                                    // Check karein ki kya item mein secondary unit exist karti hai
                                    const hasConversion = part.secondaryUnit && part.secondaryUnit !== '';

                                    return (
                                        <tr key={part.name} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 text-center text-gray-400 font-bold">{index + 1}</td>
                                            <td className="p-4 font-bold text-gray-800 uppercase">{part.name}</td>
                                            <td className="p-4 text-center font-black text-blue-600">{part.qtySold}</td>
                                            <td className="p-4 text-right font-mono font-medium text-gray-600">₹{part.revenue.toLocaleString()}</td>

                                            {/* 1. Dynamic Primary Profit Column */}
                                            <td className="p-4 text-right font-mono text-xs text-blue-600 font-semibold">
                                                {hasConversion ? (
                                                    <>
                                                        ₹{part.primaryProfit.toLocaleString()}
                                                        <span className="block text-[10px] text-gray-400">({part.primaryQty} {part.primaryUnit} bika)</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        ₹{part.profit.toLocaleString()}
                                                        <span className="block text-[10px] text-gray-400">({part.qtySold} {part.primaryUnit} bika)</span>
                                                    </>
                                                )}
                                            </td>

                                            {/* 2. Dynamic Secondary Profit Column (Hide if no conversion) */}
                                            <td className="p-4 text-right font-mono text-xs text-purple-600 font-semibold">
                                                {hasConversion ? (
                                                    <>
                                                        ₹{part.secondaryProfit.toLocaleString()}
                                                        <span className="block text-[10px] text-gray-400">({part.secondaryQty} {part.secondaryUnit} bika)</span>
                                                    </>
                                                ) : (
                                                    <span className="text-gray-400 font-normal">—</span>
                                                )}
                                            </td>

                                            <td className="p-4 text-right font-mono font-black text-green-700">₹{part.profit.toLocaleString()}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${part.currentStock < 5 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                    {formatStockDisplay(
                                                        part.currentStock,
                                                        itemRef?.primaryUnit || 'Unit',
                                                        itemRef?.secondaryUnit || '',
                                                        itemRef?.conversionRate || 1
                                                    )}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default ItemWiseReport;