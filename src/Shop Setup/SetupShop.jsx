import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../Firebase/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const SetupShop = () => {
    const navigate = useNavigate();
    const [shopName, setShopName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [upiId, setUpiId] = useState('');
    const [tagline, setTagline] = useState('');
    const [gstin, setGstin] = useState('');
    const [stateCode, setStateCode] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [email, setEmail] = useState('');

    const [loading, setLoading] = useState(false);

    const handleSetupSubmit = async (e) => {
        e.preventDefault();
        // 👉 Agar login nahi hai, toh rok do
        if (!auth.currentUser) {
            toast.error("Bhai, pehle login karna zaroori hai!");
            return;
        }

        if (!shopName || !phone) {
            toast.error("Dukan ka naam aur phone number zaroori hai bhai!");
            return;
        }

        const userId = auth.currentUser.uid;
        setLoading(true);
        try {
            // 👉 File ka naam shopDetails_USERID kar diya
            await setDoc(doc(db, "settings", `shopDetails_${userId}`), {
                shopName,
                phone,
                address,
                upiId,
                tagline,
                gstin,
                stateCode,
                whatsapp,
                email,
                setupComplete: true,
                
                // 👉 Yahan profile ke andar bhi userId daal diya
                userId: userId
            });

            toast.success("🎉 Professional Shop Setup Completed Successfully!");
            navigate('/');
        } catch (error) {
            console.error("Error saving shop details:", error);
            toast.error("Details save karne me error aaya.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white rounded-xl shadow-lg p-8 border border-gray-200">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-black text-gray-800">🏪 Setup Your EV Shop</h1>
                    <p className="text-sm text-gray-500 mt-1">Pehli baar account banane par dukan ki details bharna zaroori hai.</p>
                </div>

                <form onSubmit={handleSetupSubmit} className="space-y-4">
                    {/* Row 1: Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dukan Ka Naam *</label>
                            <input required type="text" placeholder="e.g. Ayan EV Spares" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" value={shopName} onChange={(e) => setShopName(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Shop Tagline (Sub-title)</label>
                            <input type="text" placeholder="e.g. Controller & Charger Specialist" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" value={tagline} onChange={(e) => setTagline(e.target.value)} />
                        </div>
                    </div>

                    {/* Row 2: Contacts */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Calling Number *</label>
                            <input required type="tel" maxLength="10" placeholder="98765xxxx" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">WhatsApp Number</label>
                            <input type="tel" maxLength="10" placeholder="WhatsApp No." className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Official Email</label>
                            <input type="email" placeholder="shop@email.com" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                    </div>

                    {/* Row 3: Tax & Billing */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">GSTIN (GST Number)</label>
                            <input type="text" maxLength="15" placeholder="27AAAAA0000A1Z5" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-mono font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none uppercase" value={gstin} onChange={(e) => setGstin(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">State Code</label>
                            <input type="number" placeholder="e.g. 27" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" value={stateCode} onChange={(e) => setStateCode(e.target.value)} />
                        </div>
                    </div>

                    {/* Row 4: Address & Payments */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Shop Address</label>
                        <input type="text" placeholder="Dukan ka poora pata..." className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" value={address} onChange={(e) => setAddress(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">UPI ID (For Payments QR)</label>
                        <input type="text" placeholder="dukan@ybl" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
                    </div>

                    <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold p-3 rounded-lg transition-all shadow-md mt-4">
                        {loading ? 'Saving Details...' : 'Launch Professional System 🚀'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SetupShop;