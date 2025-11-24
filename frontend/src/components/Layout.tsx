import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Wallet, CreditCard, PiggyBank, LineChart, LogOut } from 'lucide-react';

const Layout: React.FC = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex min-h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 bg-primary text-white p-6 flex flex-col">
                <h1 className="text-2xl font-bold mb-8 text-accent">WealthMap</h1>
                <nav className="flex-1 space-y-4">
                    <Link to="/" className="flex items-center space-x-3 hover:text-accent transition">
                        <LayoutDashboard size={20} />
                        <span>總覽儀表板</span>
                    </Link>
                    <Link to="/assets" className="flex items-center space-x-3 hover:text-accent transition">
                        <Wallet size={20} />
                        <span>資產管理</span>
                    </Link>
                    <Link to="/liabilities" className="flex items-center space-x-3 hover:text-accent transition">
                        <CreditCard size={20} />
                        <span>負債管理</span>
                    </Link>
                    <Link to="/budget" className="flex items-center space-x-3 hover:text-accent transition">
                        <PiggyBank size={20} />
                        <span>收支預算</span>
                    </Link>
                    <Link to="/simulation" className="flex items-center space-x-3 hover:text-accent transition">
                        <LineChart size={20} />
                        <span>模擬分析</span>
                    </Link>
                </nav>
                {/* <button onClick={handleLogout} className="flex items-center space-x-3 hover:text-red-400 transition mt-auto">
                    <LogOut size={20} />
                    <span>Logout</span>
                </button> */}
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
