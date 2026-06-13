import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { db, auth } from '../Firebase/firebaseConfig';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

const Billing = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- STATES FOR SEARCH & MODAL ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');
  const [selectedBill, setSelectedBill] = useState(null);
  const [isEstimateMode, setIsEstimateMode] = useState(false);

  // Shop Details & Invoice Rules
  const [shopDetails, setShopDetails] = useState({
    shopName: 'YOUR BUSINESS NAME',
    address: 'Yadav Nagar, Near Aero Md Rafi Chowk, Nagpur, Maharashtra - 440026',
    phone: 'XXXXXXXXXX',
    email: 'dukan@gmail.com',
    gstin: '27ABCDE1234F1Z5'
  });
  const [invoicePrefix, setInvoicePrefix] = useState('INV-'); // Prefix store karne ke liye

  useEffect(() => {
    // 1. Ek sath Shop Details aur Prefix (Rules) fetch karenge
    const fetchSettings = async () => {
      try {
        const userId = auth.currentUser.uid;
        const shopDoc = await getDoc(doc(db, "settings", `shopDetails_${userId}`));
        const rulesDoc = await getDoc(doc(db, "settings", `invoiceRules_${userId}`));

        if (shopDoc.exists()) {
          setShopDetails(prev => ({ ...prev, ...shopDoc.data() }));
        }

        if (rulesDoc.exists() && rulesDoc.data().billPrefix) {
          setInvoicePrefix(rulesDoc.data().billPrefix);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    // 2. Bills History fetch karenge
    const fetchBills = async () => {
      if (!auth.currentUser) return;

      try {

        const q = query(
          collection(db, "bills"),
          where("userId", "==", auth.currentUser.uid)
        );

        const querySnapshot = await getDocs(q);
        const billsList = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const isPaid = data.remainingUdhar === 0;

          return {
            id: data.billNumber ? data.billNumber : doc.id.substring(0, 6).toUpperCase(),
            originalId: doc.id,
            customerName: data.customerName,
            phone: data.customerPhone,
            invoiceType: data.invoiceType || 'B2C',
            customerGstin: data.customerGstin || '',
            isLocal: data.isLocal !== undefined ? data.isLocal : true,

            transportName: data.transportName || '',
            marka: data.marka || '',
            destination: data.destination || '',

            cgst: data.cgst || 0,
            sgst: data.sgst || 0,
            igst: data.igst || 0,
            totalTax: data.totalTax || 0,

            date: data.billDate ? data.billDate.split('T')[0] : 'N/A',
            fullDate: data.billDate,
            items: data.items || [],
            subTotal: data.subTotal || 0,
            discount: data.discount || 0,
            serviceCharge: data.serviceCharge || 0,
            grandTotal: data.grandTotal || 0,
            paymentMode: data.paymentMode,
            paidAmount: data.amountPaid || 0,
            dueAmount: data.remainingUdhar || 0,
            status: isPaid ? 'Paid' : 'Split'
          };
        });

        billsList.sort((a, b) => new Date(b.fullDate) - new Date(a.fullDate));
        setBills(billsList);
      } catch (error) {
        console.error("Error fetching bills: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
    fetchBills();
  }, []);

  const todayObj = new Date();
  const yyyy = todayObj.getFullYear();
  const mm = String(todayObj.getMonth() + 1).padStart(2, '0');
  const dd = String(todayObj.getDate()).padStart(2, '0');
  const today = `${yyyy}-${mm}-${dd}`;

  const todayBills = bills.filter(b => b.date === today);
  const totalInvoicesToday = todayBills.length;
  const todaysRevenue = todayBills.reduce((sum, bill) => sum + bill.paidAmount, 0);
  const totalPendingMarket = bills.reduce((sum, bill) => sum + bill.dueAmount, 0);

  const filteredBills = bills.filter((bill) => {
    const matchesSearch =
      bill.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.phone.includes(searchQuery) ||
      bill.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.customerGstin.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All' || bill.status === statusFilter;
    const matchesMode = modeFilter === 'All' || bill.invoiceType === modeFilter;

    return matchesSearch && matchesStatus && matchesMode;
  });

  const handleSMSSend = (bill) => {
    if (!bill.phone || bill.phone.length < 10) {
      toast.error("Customer ka mobile number valid nahi hai!");
      return;
    }

    // 1. Items ki ek clean list banate hain
    let itemsListText = '';
    bill.items.forEach((item, index) => {
      // Format: 1. Controller - 2 Pcs x Rs 1500 = Rs 3000
      const itemTotal = item.qty * item.price;
      itemsListText += `${index + 1}. ${item.name} - ${item.qty} ${item.unit || 'Pcs'} x Rs ${item.price} = Rs ${itemTotal}\n`;
    });

    // 2. Prefix check kar lete hain taaki bill no. sahi dikhe
    const finalBillId = String(bill.id).startsWith(invoicePrefix) ? String(bill.id) : `${invoicePrefix}${bill.id}`;

    // 3. Final SMS ka Format
    const textMessage = `🧾 ${shopDetails.shopName || 'Dukan'} - Bill Details

Hi ${bill.customerName},
Invoice: ${finalBillId}
Date: ${bill.date}

🛒 Items Purchased:
${itemsListText}
--------------------
💰 Total Bill: Rs ${bill.grandTotal}
✅ Paid Amount: Rs ${bill.paidAmount}
⏳ Due (Udhar): Rs ${bill.dueAmount}

Thank you for visiting!`;

    // 4. SMS app me bhejna
    const smsUrl = `sms:+91${bill.phone}?body=${encodeURIComponent(textMessage)}`;
    window.open(smsUrl, '_self');
  };

  const handlePDFShare = async (bill) => {
    const element = document.getElementById('real-invoice-content');
    if (!element) return toast.error("Invoice layout nahi mila!");

    const toastId = toast.loading("PDF ban raha hai, kripya pratiksha karein...");

    try {
      // Sirf usi jagah par width 800px fix karenge aadhi second ke liye
      const originalWidth = element.style.width;
      element.style.width = '800px';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: 800
      });

      element.style.width = originalWidth; // Wapas normal

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');

      const margin = 12;
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();

      const pdfImageWidth = pdfPageWidth - (margin * 2);
      const pdfImageHeight = (canvas.height * pdfImageWidth) / canvas.width;

      // MULTI-PAGE LOGIC
      let heightLeft = pdfImageHeight;
      let position = margin;
      const usablePageHeight = pdfPageHeight - (margin * 2);

      pdf.addImage(imgData, 'JPEG', margin, position, pdfImageWidth, pdfImageHeight);
      heightLeft -= usablePageHeight;

      while (heightLeft > 0) {
        position = position - usablePageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, pdfImageWidth, pdfImageHeight);
        heightLeft -= usablePageHeight;
      }

      const finalBillId = String(bill.id).startsWith(invoicePrefix) ? String(bill.id) : `${invoicePrefix}${bill.id}`;
      const safeBillId = finalBillId.replace(/[\/\\]/g, '_');
      const fileName = `Invoice_${safeBillId}.pdf`;

      toast.dismiss(toastId);

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile && navigator.canShare) {
        const pdfBlob = pdf.output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        try {
          await navigator.share({
            files: [file],
            title: `Invoice ${finalBillId}`,
            text: `Hi ${bill.customerName}, attached is your invoice from ${shopDetails.shopName}.`
          });
        } catch (err) {
          pdf.save(fileName);
        }
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error(error);
      toast.dismiss(toastId);
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleDeleteBill = async (billToDelete) => {
    const confirmDelete = window.confirm(`Bill ${billToDelete.id} delete karna hai? \nIs bill ka saara maal wapas stock mein add ho jayega.`);
    if (!confirmDelete) return;

    try {
      for (const item of billToDelete.items) {
        if (item.productId && item.productId.toString().length > 10) {
          const itemRef = doc(db, "items", item.productId);
          const itemSnap = await getDoc(itemRef);

          if (itemSnap.exists()) {
            const currentStock = itemSnap.data().openingStock || 0;
            let returnQty = item.qty;

            if (item.refData && item.unit === item.refData.secondaryUnit) {
              returnQty = item.qty / (item.refData.conversionRate || 1);
            }

            let restoredStock = currentStock + returnQty;
            restoredStock = parseFloat(restoredStock.toFixed(2));

            await updateDoc(itemRef, { openingStock: restoredStock });
          }
        }
      }

      await deleteDoc(doc(db, "bills", billToDelete.originalId));
      setBills(bills.filter(b => b.originalId !== billToDelete.originalId));
      setSelectedBill(null);
      toast.success("✅ Bill successfully deleted aur maal wapas godown me add ho gaya!");
    } catch (error) {
      console.error("Error deleting bill:", error);
      toast.error("Bhai, bill delete karne me error aa gaya.");
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500 font-bold text-lg">⏳ Cloud se Bills History load ho rahi hai...</div>;
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen relative">

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📜 Sales & Billing History</h1>
          <p className="text-sm text-gray-500">Apne dukan ke saare bills aur roz ka galla yahan dekhein.</p>
        </div>

        <button
          onClick={() => navigate('/new-bill', { state: { from: '/billing' } })}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-blue-700 font-bold text-sm transition-all flex items-center gap-2"
        >
          🧾 + Create New Bill
        </button>
      </div>

      {/* --- TOP SUMMARY CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today's Invoices</p>
            <p className="text-2xl font-black text-gray-800 mt-1">{totalInvoicesToday}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg text-2xl">📝</div>
        </div>

        <div className="bg-green-50 p-5 rounded-xl border border-green-100 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Today's Cash/Online (Galla)</p>
            <p className="text-2xl font-black text-green-800 mt-1">₹ {todaysRevenue.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 bg-green-100 text-green-700 rounded-lg text-2xl">💰</div>
        </div>

        <div className="bg-orange-50 p-5 rounded-xl border border-orange-100 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-orange-700 uppercase tracking-wider">Total Pending Due (Split)</p>
            <p className="text-2xl font-black text-orange-800 mt-1">₹ {totalPendingMarket.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 bg-orange-100 text-orange-700 rounded-lg text-2xl">⏳</div>
        </div>
      </div>

      {/* --- SEARCH & TRIPLE FILTERS BAR --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6">
          <input
            type="text"
            placeholder="🔍 Search Bill No, Customer, Phone or GSTIN..."
            className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="md:col-span-3">
          <select
            className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Settlement Types</option>
            <option value="Paid">✅ Fully Paid</option>
            <option value="Split">⏳ Pending / Split</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold cursor-pointer text-indigo-700"
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
          >
            <option value="All">All Operation Modes</option>
            <option value="B2C">🛍️ Retail Channels Only</option>
            <option value="B2B">📦 Wholesale Channels Only</option>
          </select>
        </div>
      </div>

      {/* --- BILLS HISTORY TABLE --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b text-gray-500 bg-gray-50 text-xs font-bold uppercase tracking-wider">
                <th className="p-4">Bill Details</th>
                <th className="p-4">Customer Info</th>
                <th className="p-4 text-center">Operation Type</th>
                <th className="p-4 text-center">Items Count</th>
                <th className="p-4 text-right">Final Amount</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-400 font-medium">No bills found matching your search.</td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill.originalId} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      {/* 🔥 TABLE ME BHI PREFIX LAGA DIYA */}
                      <p className="font-bold text-gray-800">{String(bill.id).startsWith(invoicePrefix) ? bill.id : `${invoicePrefix}${bill.id}`}</p>
                      <p className="text-xs text-gray-500">{bill.date}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-gray-800">{bill.customerName}</p>
                      <p className="text-xs text-gray-500">📞 {bill.phone}</p>
                    </td>

                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase ${bill.invoiceType === 'B2B' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-cyan-50 text-cyan-700'}`}>
                        {bill.invoiceType === 'B2B' ? 'Wholesale 📦' : 'Retail 🛍️'}
                      </span>
                    </td>

                    <td className="p-4 text-center font-semibold text-gray-600">{bill.items.length}</td>
                    <td className="p-4 text-right font-black text-gray-800">₹ {bill.grandTotal.toLocaleString('en-IN')}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${bill.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedBill(bill)}
                        className="bg-gray-100 hover:bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-bold text-xs transition-colors border border-gray-200 hover:border-blue-200"
                      >
                        👁 View Bill
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- TAX INVOICE MODAL --- */}
      {selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">

            <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
              <div>
                <h2 className="text-lg font-bold">Document Viewer</h2>
                <p className="text-xs text-gray-400">Date Logged: {selectedBill.date}</p>
              </div>
              <button onClick={() => { setSelectedBill(null); setIsEstimateMode(false); }} className="text-gray-400 hover:text-white text-2xl font-bold">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4" id="invoice-print-area">

              <div className="border border-black text-xs text-gray-950 font-sans bg-white p-1" id="real-invoice-content">

                {/* DYNAMIC TITLE */}
                <div className="text-center font-black text-sm uppercase tracking-widest border-b border-black py-1 bg-gray-50">
                  {isEstimateMode ? 'Sale Invoice' : 'TAX INVOICE'}
                </div>

                {/* HEADER ROW - CHANGED TO FLEX */}
                <div className="flex border-b border-black w-full">
                  <div className="w-1/2 p-2 border-r border-black space-y-1">
                    <h2 className="font-black text-base uppercase tracking-wide text-gray-900">{shopDetails.shopName || 'YOUR BUSINESS NAME'}</h2>
                    <p className="text-[11px] font-medium text-gray-700 leading-tight whitespace-pre-wrap">{shopDetails.address}</p>
                    <p className="text-[11px] font-medium">Contact: +91 {shopDetails.phone}</p>
                    {(!isEstimateMode && shopDetails.gstin) && (
                      <p className="font-black text-[11px] text-gray-900 font-mono mt-1">GSTIN/UIN: {shopDetails.gstin}</p>
                    )}
                  </div>

                  <div className="w-1/2 flex flex-wrap">
                    <div className="w-1/2 p-2 border-r border-b border-black">
                      <p className="text-[10px] text-gray-500 font-bold">Document No.</p>
                      <p className="font-black text-gray-900 font-mono text-sm">
                        {String(selectedBill.id).startsWith(invoicePrefix) ? selectedBill.id : `${invoicePrefix}${selectedBill.id}`}
                      </p>
                    </div>
                    <div className="w-1/2 p-2 border-b border-black">
                      <p className="text-[10px] text-gray-500 font-bold">Dated</p>
                      <p className="font-black text-gray-900 font-mono text-sm">{selectedBill.date}</p>
                    </div>
                    <div className="w-1/2 p-2 border-r border-black">
                      <p className="text-[10px] text-gray-500 font-bold">Buyer's Ref./Order No.</p>
                      <p className="font-bold text-gray-800">N/A (Walk-in)</p>
                    </div>
                    <div className="w-1/2 p-2">
                      <p className="text-[10px] text-gray-500 font-bold">Mode of Payment</p>
                      <p className="font-black uppercase text-gray-800">{selectedBill.paymentMode}</p>
                    </div>
                  </div>
                </div>

                {/* CUSTOMER ROW - CHANGED TO FLEX */}
                <div className="flex border-b border-black bg-gray-50/30 w-full">
                  <div className="w-1/2 p-2 border-r border-black space-y-0.5">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Customer (Bill to)</p>
                    <p className="font-black text-gray-900 text-sm uppercase">{selectedBill.customerName}</p>
                    <p className="text-gray-600 font-medium">📞 Phone: {selectedBill.phone}</p>
                    {(!isEstimateMode && selectedBill.customerGstin) && (
                      <p className="font-mono font-black text-purple-800 text-[11px] bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded w-fit mt-1">
                        GSTIN/UIN: {selectedBill.customerGstin}
                      </p>
                    )}
                  </div>

                  <div className="w-1/2 p-2">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Destination / Logistics</p>
                    <p className="font-black uppercase text-gray-800">{selectedBill.destination || 'LOCAL'} | {selectedBill.transportName || 'HAND DELIVERY'}</p>
                  </div>
                </div>

                {/* TABLE - REMAINS SAME AS HTML TABLES WORK PERFECTLY */}
                <table className="w-full text-left border-collapse border-b border-black text-[11px]">
                  <thead>
                    <tr className="border-b border-black bg-gray-100 font-bold text-center">
                      <th className="p-1.5 border-r border-black w-8">Sl</th>
                      <th className="p-1.5 border-r border-black text-left">Description of Goods</th>
                      <th className="p-1.5 border-r border-black w-20">Quantity</th>
                      <th className="p-1.5 border-r border-black w-20 text-right">Rate</th>
                      <th className="p-1.5 text-right w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/30">
                    {selectedBill.items.map((item, idx) => {
                      const taxRate = item.refData?.gstRate || 18;
                      const displayPrice = isEstimateMode ? (item.price * (1 + taxRate / 100)) : item.price;
                      const displayAmount = item.qty * displayPrice;

                      return (
                        <tr key={idx} className="font-medium align-top">
                          <td className="p-2 border-r border-black text-center font-bold text-gray-400">{idx + 1}</td>
                          <td className="p-2 border-r border-black">
                            <div className="font-black text-gray-900 uppercase">{item.name}</div>
                            {(!isEstimateMode && item.hsnCode) && <span className="text-[10px] text-purple-700 font-mono font-bold block">HSN: {item.hsnCode}</span>}
                            {(!isEstimateMode && !item.hsnCode && item.refData?.hsnCode) && <span className="text-[10px] text-purple-700 font-mono font-bold block">HSN: {item.refData.hsnCode}</span>}
                          </td>
                          <td className="p-2 border-r border-black text-center font-black text-gray-900">{item.qty} {item.unit || 'PCS'}</td>
                          <td className="p-2 border-r border-black text-right font-mono">₹{displayPrice.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-black text-gray-900">₹{displayAmount.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* TOTALS ROW - CHANGED TO FLEX */}
                <div className="flex p-2 bg-gray-50/50 items-center w-full border-b border-black">
                  <div className="w-7/12 text-[10px] text-gray-500 font-semibold space-y-1">
                    <p className="font-bold text-gray-800">Note:</p>
                    <p>{isEstimateMode ? 'This is an estimate/quotation and not a tax invoice.' : 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'}</p>
                  </div>

                  <div className="w-5/12 text-xs space-y-1 font-medium pl-6">
                    {!isEstimateMode && (
                      <>
                        <div className="flex justify-between text-gray-600"><span>Taxable Value:</span><span className="font-mono font-bold">₹{(selectedBill.subTotal || 0).toFixed(2)}</span></div>
                        {selectedBill.isLocal ? (
                          <>
                            <div className="flex justify-between text-gray-500 text-[11px]"><span>CGST:</span><span className="font-mono">₹{(selectedBill.cgst || 0).toFixed(2)}</span></div>
                            <div className="flex justify-between text-gray-500 text-[11px] border-b border-black/10 pb-1"><span>SGST:</span><span className="font-mono">₹{(selectedBill.sgst || 0).toFixed(2)}</span></div>
                          </>
                        ) : (
                          <div className="flex justify-between text-orange-700 text-[11px] border-b border-black/10 pb-1"><span>IGST:</span><span className="font-mono">₹{(selectedBill.igst || 0).toFixed(2)}</span></div>
                        )}
                      </>
                    )}
                    {selectedBill.serviceCharge > 0 && <div className="flex justify-between text-blue-600 text-[11px]"><span>Labour / Fitting:</span><span className="font-mono">₹{selectedBill.serviceCharge.toFixed(2)}</span></div>}
                    {selectedBill.discount > 0 && <div className="flex justify-between text-red-600 text-[11px]"><span>Discount:</span><span className="font-mono">-₹{selectedBill.discount.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-black text-gray-900 pt-1 text-sm border-t border-black">
                      <span>Total Amount:</span>
                      <span className="font-mono text-green-800 text-base">₹{(selectedBill.grandTotal || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* SIGNATURE ROW - CHANGED TO FLEX */}
                <div className="flex min-h-12.5 text-[10px] w-full">
                  <div className="w-1/2 p-2 border-r border-black flex items-end text-gray-400 font-bold">Customer Sign</div>
                  <div className="w-1/2 p-2 text-right flex flex-col justify-between items-end">
                    <p className="font-bold text-gray-500 uppercase">for {shopDetails.shopName || 'YOUR BUSINESS NAME'}</p>
                    <p className="font-bold text-gray-900 mt-6">Authorised Signatory</p>
                  </div>
                </div>

              </div>
            </div>

            <div className="bg-gray-50 p-4 border-t flex flex-wrap justify-end items-center gap-3">

              <label className="flex items-center gap-2 cursor-pointer bg-yellow-100 text-yellow-800 px-3 py-2 rounded-lg font-bold text-xs mr-auto border border-yellow-300 hover:bg-yellow-200 transition-colors">
                <input
                  type="checkbox"
                  className="w-4 h-4 cursor-pointer accent-yellow-600"
                  checked={isEstimateMode}
                  onChange={() => setIsEstimateMode(!isEstimateMode)}
                />
                Print as Kaccha Bill (Estimate)
              </label>

              <button onClick={() => handleDeleteBill(selectedBill)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm transition-all">
                🗑️ Delete
              </button>

              <button onClick={() => handleSMSSend(selectedBill)} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1 shadow-sm">
                💬 SMS
              </button>

              <button onClick={() => handlePDFShare(selectedBill)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm transition-all">
                📄 Share PDF
              </button>

              <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all">
                🖨️ Print
              </button>

              <button onClick={() => { setSelectedBill(null); setIsEstimateMode(false); }} className="px-4 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 text-xs transition-all">
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Billing;