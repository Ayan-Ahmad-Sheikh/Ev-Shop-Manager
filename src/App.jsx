import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast';
import Layout from './Layout/Layout'
import Dashboard from './Components/Dashboard'
import Billing from './Components/Billing'
import Stock from './Components/Stock'
import BillingForm from './Components/BillingForm'
import AddItemForm from './Components/AddItemForm'
import ItemDetailsMaster from './Components/ItemDetailsMaster'
import CustomerLedger from './Components/CustomerLedger'
import Settings from './Setting/Setting'
import Login from './Authentication/Login'
import SetupShop from './Shop Setup/SetupShop'
import ItemWiseReport from './Report/ItemWiseReport'
import ExpenseTracker from './Expense Tracker/ExpenseTracker'
import Welcome from './Welcome/Welcome';
import TaxReports from './Report/TaxReports'
import { auth } from './Firebase/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { useState, useEffect } from 'react'


function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthChecking(false); // Checking complete ho gayi
    });
    return () => unsubscribe();
  }, []);

  if (isAuthChecking) {
    return <div className="flex h-screen items-center justify-center font-bold text-gray-500">⏳ Chaabi check kar rahe hain...</div>;
  }

  return (
    <div>
      <Toaster position="top-right" reverseOrder={false} />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/" element={!user ? <Welcome /> : <Navigate to="/dashboard" />} />

          {/* Protected Routes (Layout ke andar) */}
          <Route element={user ? <Layout sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} /> : <Navigate to="/login" />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/new-bill" element={<BillingForm />} />
            <Route path="/add-item" element={<AddItemForm />} />
            <Route path="/stock-details/:id" element={<ItemDetailsMaster />} />
            <Route path="/customer-ledger" element={<CustomerLedger />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/expenses" element={<ExpenseTracker />} />
            <Route path="/item-report" element={<ItemWiseReport />} />
            <Route path="/reports" element={<TaxReports />} />
            <Route path="/setup-shop" element={<SetupShop />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App
