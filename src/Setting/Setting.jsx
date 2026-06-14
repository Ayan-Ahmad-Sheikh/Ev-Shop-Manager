import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../Firebase/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { onAuthStateChanged } from "firebase/auth";
import toast from 'react-hot-toast';

const Settings = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    // --- 1. SHOP PROFILE STATES ---
    const [shopDetails, setShopDetails] = useState({
        shopName: '',
        phone: '',
        address: '',
        upiId: '',
        tagline: '',
        gstin: '',
        stateCode: '',
        whatsapp: '',
        email: ''
    });

    // --- 2. INVOICE SETTINGS STATES ---
    const [invoiceSettings, setInvoiceSettings] = useState({
        billPrefix: 'INV-',
        terms: '1. Jale hue controller ya Axiom charger ki koi guarantee/wapsi nahi hogi.\n2. Kripya apna bill sambhal kar rakhein.'
    });

    // --- 3. FETCH EXISTING SETTINGS ---
    useEffect(() => {
        // 🔥 FIX: Firebase Auth ka wait karo taaki Refresh par Infinite Loading na ho
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const userId = user.uid;

                // 👉 shopDetails fetch karo
                const shopDocRef = doc(db, 'settings', `shopDetails_${userId}`);
                const shopSnap = await getDoc(shopDocRef);

                if (shopSnap.exists()) {
                    setShopDetails(shopSnap.data());
                }

                // 👉 invoiceRules fetch karo
                const invDocRef = doc(db, 'settings', `invoiceRules_${userId}`);
                const invSnap = await getDoc(invDocRef);

                if (invSnap.exists()) {
                    setInvoiceSettings(invSnap.data());
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                // Ab data aaye ya error, loading spinner hamesha hategi
                setLoading(false);
            }
        });

        // Cleanup
        return () => unsubscribe();
    }, []);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return;
        const userId = auth.currentUser.uid;

        setSaving(true);
        try {
            // 👉 updateDoc ki jagah setDoc use kiya hai
            await setDoc(doc(db, "settings", `shopDetails_${userId}`), {
                ...shopDetails,
                userId: userId
            }, { merge: true });

            toast.success("✅ Shop Profile Updated Successfully!");
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("❌ Profile update fail ho gaya.");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveInvoiceSettings = async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return;
        const userId = auth.currentUser.uid;

        try {
            // 👉 Yahan bhi setDoc use kiya hai
            await setDoc(doc(db, "settings", `invoiceRules_${userId}`), {
                ...invoiceSettings,
                userId: userId
            }, { merge: true });

            toast.success("✅ Invoice Settings Saved!");
        } catch (error) {
            console.error("Error saving invoice rules", error);
            toast.error("Error saving rules!");
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
            toast.success("Successfully Logged Out!");
        } catch (error) {
            console.error("Logout Error:", error);
            toast.error("Logout nahi ho paya!");
        }
    };

    const handleExportData = (type) => {
        toast.loading(`📥 Downloading ${type} Data as Excel/CSV... (Backend integration required)`);
    };

    if (loading) {
        return (
            <div className="p-4 md:p-6 bg-gray-50 min-h-screen animate-pulse">

                {/* 1. Header Skeleton */}
                <div className="mb-6">
                    <div className="h-8 bg-gray-300 rounded-md w-48 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded-md w-72"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* LEFT COLUMN Skeleton */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Shop Profile Skeleton */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="h-6 bg-gray-300 rounded w-48 mb-6 border-b pb-2"></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i}>
                                        <div className="h-3 bg-gray-200 rounded w-24 mb-2"></div>
                                        <div className="h-10 bg-gray-100 rounded-lg w-full"></div>
                                    </div>
                                ))}
                                <div className="md:col-span-2">
                                    <div className="h-3 bg-gray-200 rounded w-32 mb-2"></div>
                                    <div className="h-10 bg-gray-100 rounded-lg w-full"></div>
                                </div>
                                <div className="md:col-span-2">
                                    <div className="h-3 bg-gray-200 rounded w-40 mb-2"></div>
                                    <div className="h-10 bg-gray-100 rounded-lg w-full"></div>
                                </div>
                            </div>
                            <div className="text-right pt-4 mt-2">
                                <div className="h-10 bg-blue-200 rounded-lg w-32 ml-auto"></div>
                            </div>
                        </div>

                        {/* Invoice Rules Skeleton */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="h-6 bg-gray-300 rounded w-48 mb-6 border-b pb-2"></div>
                            <div className="space-y-4">
                                <div>
                                    <div className="h-3 bg-gray-200 rounded w-32 mb-2"></div>
                                    <div className="h-10 bg-gray-100 rounded-lg w-1/3"></div>
                                </div>
                                <div>
                                    <div className="h-3 bg-gray-200 rounded w-48 mb-2"></div>
                                    <div className="h-24 bg-gray-100 rounded-lg w-full"></div>
                                </div>
                                <div className="text-right pt-2">
                                    <div className="h-10 bg-blue-200 rounded-lg w-32 ml-auto"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN Skeleton */}
                    <div className="space-y-6">

                        {/* Security Skeleton */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-red-50">
                            <div className="h-6 bg-red-200 rounded w-32 mb-6 border-b pb-2"></div>
                            <div className="space-y-4">
                                <div>
                                    <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                                    <div className="h-3 bg-gray-100 rounded w-48"></div>
                                </div>
                                <div className="h-10 bg-red-100 rounded-lg w-full mt-4"></div>
                            </div>
                        </div>

                        {/* Backup Skeleton */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-green-50">
                            <div className="h-6 bg-green-200 rounded w-32 mb-6 border-b pb-2"></div>
                            <div className="h-10 bg-green-200 rounded-lg w-full mt-4"></div>
                        </div>
                    </div>

                </div>

                <div className="text-center mt-4">
                    <p className="text-xs font-bold text-gray-400">⏳ Fetching Admin Controls & Configuration...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">⚙️ System Settings</h1>
                <p className="text-sm text-gray-500">Dukan ka profile, bill printing rules, aur system security manage karein.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN: Profile & Invoice */}
                <div className="lg:col-span-2 space-y-6">
                    {/* --- 1. SHOP PROFILE SECTION --- */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                            🏪 Shop Profile Details
                        </h2>
                        <form onSubmit={handleSaveProfile} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dukan Ka Naam</label>
                                    <input type="text" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={shopDetails.shopName || ''} onChange={(e) => setShopDetails({ ...shopDetails, shopName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Shop Tagline</label>
                                    <input type="text" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={shopDetails.tagline || ''} onChange={(e) => setShopDetails({ ...shopDetails, tagline: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contact Number</label>
                                    <input type="text" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={shopDetails.phone || ''} onChange={(e) => setShopDetails({ ...shopDetails, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">WhatsApp Number</label>
                                    <input type="text" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={shopDetails.whatsapp || ''} onChange={(e) => setShopDetails({ ...shopDetails, whatsapp: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">GSTIN</label>
                                    <input type="text" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                                        value={shopDetails.gstin || ''} onChange={(e) => setShopDetails({ ...shopDetails, gstin: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                    <input type="email" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={shopDetails.email || ''} onChange={(e) => setShopDetails({ ...shopDetails, email: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Shop Address</label>
                                    <input type="text" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={shopDetails.address || ''} onChange={(e) => setShopDetails({ ...shopDetails, address: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">UPI ID (For Bill QR Code)</label>
                                    <input type="text" placeholder="e.g. 9876543210@ybl" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={shopDetails.upiId || ''} onChange={(e) => setShopDetails({ ...shopDetails, upiId: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="text-right pt-2">
                                <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition-all disabled:opacity-50">
                                    {saving ? 'Saving...' : 'Save Profile'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* --- 2. INVOICE PRINTING SETTINGS --- */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                            📄 Invoice & Billing Rules
                        </h2>
                        <form onSubmit={handleSaveInvoiceSettings} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bill Number Prefix</label>
                                <input type="text" placeholder="e.g. EV-" className="w-1/3 border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={invoiceSettings.billPrefix} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, billPrefix: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bill Terms & Conditions (Footer)</label>
                                <textarea rows="3" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={invoiceSettings.terms} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, terms: e.target.value })}
                                />
                            </div>
                            <div className="text-right pt-2">
                                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">
                                    Update Rules
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* RIGHT COLUMN: Security & Export */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 relative overflow-hidden">
                        <div className="absolute -right-6 -top-6 w-20 h-20 bg-red-50 rounded-full flex items-center justify-center opacity-50"><span className="text-3xl">🔒</span></div>
                        <h2 className="text-lg font-bold text-red-700 border-b border-red-100 pb-2 mb-4 relative z-10">Security Control</h2>
                        <div className="space-y-4 relative z-10">
                            <div>
                                <p className="text-sm font-bold text-gray-800">Admin Account</p>
                                <p className="text-xs text-gray-500">Logged in as {auth.currentUser?.email}</p>
                            </div>
                            <button
                                onClick={() => setShowLogoutModal(true)}
                                className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2.5 rounded-lg font-bold text-sm transition-all flex justify-center items-center gap-2"
                            >
                                🚪 Lock System & Logout
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100 relative overflow-hidden">
                        <div className="absolute -right-6 -top-6 w-20 h-20 bg-green-50 rounded-full flex items-center justify-center opacity-50"><span className="text-3xl">💾</span></div>
                        <h2 className="text-lg font-bold text-green-700 border-b border-green-100 pb-2 mb-4 relative z-10">Data Backup</h2>
                        <div className="space-y-3 relative z-10">
                            <button onClick={() => handleExportData('Stock Inventory')} className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-between shadow-sm">
                                <span>📦 Export Full Stock List</span>
                                <span>📥</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {showLogoutModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl transform transition-all">
                        <h3 className="text-lg font-black text-gray-800 mb-2">Logout Confirm?</h3>
                        <p className="text-gray-600 text-sm mb-6">Kya aap sachme system se bahar aana chahte hain?</p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-all"
                            >
                                Yes, Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;