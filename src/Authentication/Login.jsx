import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../Firebase/firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';

const Login = () => {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                navigate('/'); 
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                navigate('/setup-shop');
            }
        } catch (err) {
            console.error(err);
            setError("Email ya Password galat hai bhai, dobara check kar!");
        }
    };

    const handleGoogleLogin = () => {
        setError('');
        // CRITICAL FIX: Yahan 'async/await' nahi hai, direct call hai taaki browser block na kare
        signInWithPopup(auth, googleProvider)
            .then((result) => {
                if (result.user) {
                    navigate('/'); // Login hote hi seedha dashboard
                }
            })
            .catch((err) => {
                console.error("Google Login Error:", err);
                if (err.code === 'auth/popup-blocked') {
                    setError("Browser ne popup rok diya hai! Upar URL bar ke right side mein 'Popup Blocked' icon par click karke 'Always Allow' karo.");
                } else {
                    setError("Google se login nahi ho paya. Ek baar dobara try karo.");
                }
            });
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-200">

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-gray-800">
                        {isLogin ? '🔒 Shop Login' : '📝 Create Account'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">
                        {isLogin ? 'Dukan ke system mein aane ke liye login karein' : 'Nayi dukan ka system setup karein'}
                    </p>
                </div>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm font-bold">{error}</div>}

                <form onSubmit={handleAuth} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            className="w-full border p-3 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full border p-3 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg transition-all shadow-md">
                        {isLogin ? 'Login ➔' : 'Create Account'}
                    </button>
                </form>

                <div className="my-5 flex items-center before:mt-0.5 before:flex-1 before:border-t before:border-gray-200 after:mt-0.5 after:flex-1 after:border-t after:border-gray-200">
                    <p className="mx-4 mb-0 text-center font-bold text-gray-400 text-xs">OR</p>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold p-3 rounded-lg transition-all shadow-sm flex justify-center items-center gap-3"
                >
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                    Continue with Google
                </button>

                <div className="mt-6 text-center text-sm">
                    <p className="text-gray-600">
                        {isLogin ? "Naya system banana hai?" : "Pehle se account hai?"}
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-blue-600 font-bold ml-1 hover:underline"
                        >
                            {isLogin ? "Sign up karein" : "Login karein"}
                        </button>
                    </p>
                </div>

            </div>
        </div>
    );
};

export default Login;