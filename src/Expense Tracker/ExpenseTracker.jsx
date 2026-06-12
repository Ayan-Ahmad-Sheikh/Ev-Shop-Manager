import React, { useState, useEffect } from 'react';
import { db } from '../Firebase/firebaseConfig';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';

const ExpenseTracker = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Expense States
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Chai / Nashta');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  const categories = [
    'Chai / Nashta',
    'Transport / Freight',
    'Staff Salary',
    'Shop Rent',
    'Electricity Bill',
    'Packaging Material',
    'Miscellaneous'
  ];

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "expenses"), orderBy("date", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(list);
    } catch (error) {
      console.error("Expense fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      toast.error("Sahi amount daalo bhai!");
      return;
    }

    try {
      const newExpense = {
        amount: parseFloat(amount),
        category,
        description: description || 'N/A',
        date: expenseDate,
        timestamp: new Date().toISOString()
      };

      await addDoc(collection(db, "expenses"), newExpense);
      toast.success("✅ Kharcha add ho gaya!");
      
      // Reset form
      setAmount('');
      setDescription('');
      
      // Refresh list
      fetchExpenses();
    } catch (error) {
      console.error("Expense save error:", error);
      toast.error("Data save karne me dikkat aayi.");
    }
  };

  const currentMonthTotal = expenses.reduce((sum, exp) => {
    const expMonth = exp.date.substring(0, 7);
    const currentMonth = new Date().toISOString().substring(0, 7);
    return expMonth === currentMonth ? sum + exp.amount : sum;
  }, 0);

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">💸 Expense Tracker</h1>
          <p className="text-sm text-gray-500">Roz ke dukan ke kharche yahan record karein.</p>
        </div>
        <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-right shadow-sm">
          <p className="text-xs font-bold text-red-500 uppercase">This Month Expenses</p>
          <p className="text-2xl font-black text-red-700">₹ {currentMonthTotal.toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ADD EXPENSE FORM */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
          <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Add New Expense</h2>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Amount (₹)</label>
              <input type="number" required className="w-full border p-2.5 rounded-lg bg-gray-50 text-lg font-black text-gray-800 focus:ring-2 focus:ring-blue-500" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
              <select className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
              <input type="date" required className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Details / Note</label>
              <input type="text" placeholder="Kisko paise diye ya kya laya?" className="w-full border p-2.5 rounded-lg bg-gray-50 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold p-3 rounded-lg transition-all shadow-md mt-2">
              Save Expense
            </button>
          </form>
        </div>

        {/* EXPENSE HISTORY TABLE */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800">Recent Transactions</h2>
          </div>
          <div className="overflow-x-auto h-[500px] overflow-y-auto">
            {loading ? (
              <p className="text-center p-10 font-bold text-gray-400">Loading history...</p>
            ) : expenses.length === 0 ? (
              <p className="text-center p-10 font-bold text-gray-400">Abhi tak koi kharcha add nahi kiya hai.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-gray-500 text-xs font-bold uppercase tracking-wider">
                    <th className="p-4">Date</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Description</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600 font-medium">{exp.date}</td>
                      <td className="p-4">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold border border-gray-200">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500">{exp.description}</td>
                      <td className="p-4 text-right font-black text-red-600">₹ {exp.amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExpenseTracker;