import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import { ArrowUpRight, ArrowDownRight, Wallet, CreditCard, DollarSign } from 'lucide-react';

const Dashboard: React.FC = () => {
    const [assets, setAssets] = useState<any[]>([]);
    const [liabilities, setLiabilities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [assetsRes, liabilitiesRes] = await Promise.all([
                    api.get('/finance/assets'),
                    api.get('/finance/liabilities')
                ]);
                setAssets(assetsRes.data);
                setLiabilities(liabilitiesRes.data);
            } catch (error) {
                console.error("Error fetching data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const totalAssets = assets.reduce((sum, item) => sum + item.value, 0);
    const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0);
    const netWorth = totalAssets - totalLiabilities;

    // Mock data for the area chart (Net Worth over time)
    const chartData = [
        { name: '1月', value: netWorth * 0.9 },
        { name: '2月', value: netWorth * 0.92 },
        { name: '3月', value: netWorth * 0.95 },
        { name: '4月', value: netWorth * 0.94 },
        { name: '5月', value: netWorth * 0.98 },
        { name: '6月', value: netWorth },
    ];

    if (loading) return <div className="p-8 text-center text-gray-500">載入儀表板中...</div>;

    return (
        <div className="space-y-8 font-sans">
            {/* Header Section */}
            <div className="flex justify-between items-end border-b border-gray-200 pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">總覽儀表板</h1>
                    <p className="text-slate-500 mt-1">歡迎回來，演示用戶</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-slate-500 uppercase tracking-wide font-semibold">淨資產</p>
                    <p className="text-4xl font-bold text-slate-900">${Math.round(netWorth).toLocaleString()}</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Wallet className="text-blue-600" size={24} />
                        </div>
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center">
                            <ArrowUpRight size={12} className="mr-1" /> +2.5%
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">總資產</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">${Math.round(totalAssets).toLocaleString()}</h3>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-red-50 rounded-lg">
                            <CreditCard className="text-red-600" size={24} />
                        </div>
                        <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-full">
                            持平
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">總負債</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">${Math.round(totalLiabilities).toLocaleString()}</h3>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <DollarSign className="text-green-600" size={24} />
                        </div>
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                            良好
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">退休成功率</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">87%</h3>
                </div>
            </div>

            {/* Main Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900">淨資產預測</h3>
                        <select className="text-sm border-gray-300 rounded-md text-slate-600 focus:ring-blue-500 focus:border-blue-500">
                            <option>過去 6 個月</option>
                            <option>今年至今</option>
                            <option>全部時間</option>
                        </select>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `$${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [`$${Math.round(value).toLocaleString()}`, '淨資產']}
                                />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Balance Sheet Summary */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">資產負債表摘要</h3>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-600">現金與約當現金</span>
                                <span className="font-semibold text-slate-900">$12,500</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '15%' }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-600">投資組合</span>
                                <span className="font-semibold text-slate-900">$85,000</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-600">房地產</span>
                                <span className="font-semibold text-slate-900">$0</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                            </div>
                        </div>
                        <div className="pt-6 border-t border-gray-100">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-900">總資產</span>
                                <span className="text-lg font-bold text-slate-900">${Math.round(totalAssets).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
