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

  const handlePrintReceipt = () => {
    const invoiceContent = document.getElementById('real-invoice-content').innerHTML;

    if (!invoiceContent) {
      toast.error("Invoice nahi mila!");
      return;
    }

    // 1. Ek chhupee hui (invisible) frame banate hain
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.top = '-10000px'; // Screen ke bahar phenk diya
    document.body.appendChild(printFrame);

    // 2. Us frame ke andar hum sirf apne bill ka code daalenge
    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write('<html><head><title>Print Invoice</title>');
    
    // Thodi si printing ki basic setting (Margin wagarah)
    frameDoc.write(`
      <style>
        @media print {
          @page { margin: 8mm; } /* Printer ka margin */
          body { 
            margin: 0; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
        }
      </style>
    `);
    frameDoc.write('</head><body>');
    frameDoc.write(invoiceContent); // Sirf bill ka design paste kiya
    frameDoc.write('</body></html>');
    frameDoc.close();

    // 3. Frame ko load hone ka thoda time de kar print maar do
    printFrame.contentWindow.focus();
    setTimeout(() => {
      printFrame.contentWindow.print();
      
      // 4. Print hone ke baad kachra saaf kar do
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1000);
    }, 250);
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

              <div
                id="real-invoice-content"
                style={{
                  width: '800px', // STRICT DESKTOP WIDTH
                  minWidth: '800px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  fontFamily: 'Arial, Helvetica, sans-serif', // Times New Roman hatane ke liye
                  border: '1px solid #000',
                  padding: '5px',
                  boxSizing: 'border-box'
                }}
              >
                {/* DYNAMIC TITLE */}
                <div style={{ textAlign: 'center', fontWeight: '900', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #000', padding: '6px', backgroundColor: '#f9fafb' }}>
                  {isEstimateMode ? 'Sale Invoice' : 'TAX INVOICE'}
                </div>

                {/* HEADER ROW */}
                <div style={{ display: 'flex', borderBottom: '1px solid #000', width: '100%' }}>
                  <div style={{ width: '50%', padding: '8px', borderRight: '1px solid #000', boxSizing: 'border-box' }}>
                    <h2 style={{ fontWeight: '900', fontSize: '18px', textTransform: 'uppercase', margin: '0 0 4px 0' }}>{shopDetails.shopName || 'YOUR BUSINESS NAME'}</h2>
                    <p style={{ fontSize: '12px', margin: '0 0 4px 0', whiteSpace: 'pre-wrap' }}>{shopDetails.address}</p>
                    <p style={{ fontSize: '12px', margin: '0 0 4px 0' }}>Contact: +91 {shopDetails.phone}</p>
                    {(!isEstimateMode && shopDetails.gstin) && (
                      <p style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '6px', margin: '0' }}>GSTIN/UIN: {shopDetails.gstin}</p>
                    )}
                  </div>

                  <div style={{ width: '50%', display: 'flex', flexWrap: 'wrap', boxSizing: 'border-box' }}>
                    <div style={{ width: '50%', padding: '8px', borderRight: '1px solid #000', borderBottom: '1px solid #000', boxSizing: 'border-box' }}>
                      <p style={{ fontSize: '10px', color: '#666', margin: '0 0 2px 0', fontWeight: 'bold' }}>Document No.</p>
                      <p style={{ fontWeight: 'bold', fontSize: '14px', margin: '0' }}>
                        {String(selectedBill.id).startsWith(invoicePrefix) ? selectedBill.id : `${invoicePrefix}${selectedBill.id}`}
                      </p>
                    </div>
                    <div style={{ width: '50%', padding: '8px', borderBottom: '1px solid #000', boxSizing: 'border-box' }}>
                      <p style={{ fontSize: '10px', color: '#666', margin: '0 0 2px 0', fontWeight: 'bold' }}>Dated</p>
                      <p style={{ fontWeight: 'bold', fontSize: '14px', margin: '0' }}>{selectedBill.date}</p>
                    </div>
                    <div style={{ width: '50%', padding: '8px', borderRight: '1px solid #000', boxSizing: 'border-box' }}>
                      <p style={{ fontSize: '10px', color: '#666', margin: '0 0 2px 0', fontWeight: 'bold' }}>Buyer's Ref./Order No.</p>
                      <p style={{ fontWeight: 'bold', fontSize: '12px', margin: '0' }}>N/A (Walk-in)</p>
                    </div>
                    <div style={{ width: '50%', padding: '8px', boxSizing: 'border-box' }}>
                      <p style={{ fontSize: '10px', color: '#666', margin: '0 0 2px 0', fontWeight: 'bold' }}>Mode of Payment</p>
                      <p style={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', margin: '0' }}>{selectedBill.paymentMode}</p>
                    </div>
                  </div>
                </div>

                {/* CUSTOMER ROW */}
                <div style={{ display: 'flex', borderBottom: '1px solid #000', backgroundColor: '#fafafa', width: '100%' }}>
                  <div style={{ width: '50%', padding: '8px', borderRight: '1px solid #000', boxSizing: 'border-box' }}>
                    <p style={{ fontSize: '10px', color: '#666', margin: '0 0 2px 0', fontWeight: 'bold', textTransform: 'uppercase' }}>Customer (Bill to)</p>
                    <p style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', margin: '0 0 2px 0' }}>{selectedBill.customerName}</p>
                    <p style={{ fontSize: '12px', margin: '0 0 4px 0' }}>Phone: {selectedBill.phone}</p>
                    {(!isEstimateMode && selectedBill.customerGstin) && (
                      <p style={{ fontSize: '11px', fontWeight: 'bold', margin: '0' }}>GSTIN/UIN: {selectedBill.customerGstin}</p>
                    )}
                  </div>
                  <div style={{ width: '50%', padding: '8px', boxSizing: 'border-box' }}>
                    <p style={{ fontSize: '10px', color: '#666', margin: '0 0 2px 0', fontWeight: 'bold', textTransform: 'uppercase' }}>Destination / Logistics</p>
                    <p style={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', margin: '0' }}>{selectedBill.destination || 'LOCAL'} | {selectedBill.transportName || 'HAND DELIVERY'}</p>
                  </div>
                </div>

                {/* TABLE */}
                <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #000', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000', backgroundColor: '#f3f4f6' }}>
                      <th style={{ padding: '6px', borderRight: '1px solid #000', width: '40px', textAlign: 'center' }}>Sl</th>
                      <th style={{ padding: '6px', borderRight: '1px solid #000', textAlign: 'left' }}>Description of Goods</th>
                      <th style={{ padding: '6px', borderRight: '1px solid #000', width: '80px', textAlign: 'center' }}>Quantity</th>
                      <th style={{ padding: '6px', borderRight: '1px solid #000', width: '80px', textAlign: 'right' }}>Rate</th>
                      <th style={{ padding: '6px', width: '100px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBill.items.map((item, idx) => {
                      const taxRate = item.refData?.gstRate || 18;
                      const displayPrice = isEstimateMode ? (item.price * (1 + taxRate / 100)) : item.price;
                      const displayAmount = item.qty * displayPrice;

                      return (
                        <tr key={idx} style={{ verticalAlign: 'top', borderBottom: idx !== selectedBill.items.length - 1 ? '1px solid #eaeaea' : 'none' }}>
                          <td style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                          <td style={{ padding: '8px', borderRight: '1px solid #000' }}>
                            <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{item.name}</div>
                            {(!isEstimateMode && item.hsnCode) && <span style={{ fontSize: '10px', color: '#555', display: 'block', marginTop: '2px' }}>HSN: {item.hsnCode}</span>}
                            {(!isEstimateMode && !item.hsnCode && item.refData?.hsnCode) && <span style={{ fontSize: '10px', color: '#555', display: 'block', marginTop: '2px' }}>HSN: {item.refData.hsnCode}</span>}
                          </td>
                          <td style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>{item.qty} {item.unit || 'PCS'}</td>
                          <td style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right' }}>₹{displayPrice.toFixed(2)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>₹{displayAmount.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* TOTALS ROW */}
                <div style={{ display: 'flex', width: '100%', borderBottom: '1px solid #000', backgroundColor: '#fafafa' }}>
                  <div style={{ width: '60%', padding: '8px', boxSizing: 'border-box' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '12px', margin: '0 0 4px 0' }}>Note:</p>
                    <p style={{ fontSize: '11px', color: '#555', margin: '0' }}>{isEstimateMode ? 'This is an estimate/quotation and not a tax invoice.' : 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'}</p>
                  </div>

                  <div style={{ width: '40%', padding: '8px', boxSizing: 'border-box' }}>
                    {!isEstimateMode && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}><span>Taxable Value:</span><span style={{ fontWeight: 'bold' }}>₹{(selectedBill.subTotal || 0).toFixed(2)}</span></div>
                        {selectedBill.isLocal ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '11px', color: '#555' }}><span>CGST:</span><span>₹{(selectedBill.cgst || 0).toFixed(2)}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#555', borderBottom: '1px solid #eee', paddingBottom: '4px' }}><span>SGST:</span><span>₹{(selectedBill.sgst || 0).toFixed(2)}</span></div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#555', borderBottom: '1px solid #eee', paddingBottom: '4px' }}><span>IGST:</span><span>₹{(selectedBill.igst || 0).toFixed(2)}</span></div>
                        )}
                      </>
                    )}
                    {selectedBill.serviceCharge > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '11px' }}><span>Labour / Fitting:</span><span>₹{selectedBill.serviceCharge.toFixed(2)}</span></div>}
                    {selectedBill.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '11px', color: 'red' }}><span>Discount:</span><span>-₹{selectedBill.discount.toFixed(2)}</span></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #000' }}>
                      <span>Total Amount:</span>
                      <span>₹{(selectedBill.grandTotal || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* SIGNATURE ROW */}
                <div style={{ display: 'flex', width: '100%', minHeight: '60px' }}>
                  <div style={{ width: '50%', padding: '8px', borderRight: '1px solid #000', display: 'flex', alignItems: 'flex-end', fontSize: '12px', fontWeight: 'bold', color: '#666', boxSizing: 'border-box' }}>
                    Customer Sign
                  </div>
                  <div style={{ width: '50%', padding: '8px', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', boxSizing: 'border-box' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '11px', color: '#555', margin: '0', textTransform: 'uppercase' }}>for {shopDetails.shopName || 'YOUR BUSINESS NAME'}</p>
                    <p style={{ fontWeight: 'bold', fontSize: '12px', margin: '0' }}>Authorised Signatory</p>
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

              <button onClick={handlePrintReceipt} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all">
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