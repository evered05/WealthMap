import React, { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Trash2, Pencil, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Liabilities = () => {
    const [liabilities, setLiabilities] = useState<any[]>([]);
    const [newLiability, setNewLiability] = useState({
        name: '',
        category: 'Mortgage',
        amount: 0,
        interest_rate: 0,
        start_date: '',
        years: 0,
        grace_period_months: 0
    });
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const fetchLiabilities = async () => {
        try {
            const res = await api.get('/finance/liabilities');
            setLiabilities(res.data);
        } catch (error) {
            console.error("Error fetching liabilities", error);
        }
    };

    useEffect(() => {
        fetchLiabilities();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Convert empty strings to null/0 for optional fields
            const payload = {
                ...newLiability,
                years: newLiability.years || null,
                start_date: newLiability.start_date || null
            };

            if (editingId) {
                await api.put(`/finance/liabilities/${editingId}`, payload);
            } else {
                await api.post('/finance/liabilities', payload);
            }

            setNewLiability({
                name: '',
                category: 'Mortgage',
                amount: 0,
                interest_rate: 0,
                start_date: '',
                years: 0,
                grace_period_months: 0
            });
            setEditingId(null);
            fetchLiabilities();
        } catch (error) {
            console.error("Error saving liability", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item: any) => {
        setNewLiability({
            name: item.name,
            category: item.category,
            amount: item.amount,
            interest_rate: item.interest_rate,
            start_date: item.start_date ? item.start_date.split('T')[0] : '',
            years: item.years || 0,
            grace_period_months: item.grace_period_months || 0
        });
        setEditingId(item.id);
    };

    const handleCancelEdit = () => {
        setNewLiability({
            name: '',
            category: 'Mortgage',
            amount: 0,
            interest_rate: 0,
            start_date: '',
            years: 0,
            grace_period_months: 0
        });
        setEditingId(null);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("確定要刪除此負債嗎？相關的支出也會被刪除。")) return;
        try {
            await api.delete(`/finance/liabilities/${id}`);
            fetchLiabilities();
        } catch (error) {
            console.error("Error deleting liability", error);
        }
    };

    // Calculate estimated monthly payment for display
    const calculateMonthlyPayment = (amount: number, rate: number, years: number) => {
        if (!amount || !years) return 0;
        if (!rate) return amount / (years * 12);
        const r = rate / 100 / 12;
        const n = years * 12;
        return (amount * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
    };

    return (
        <div className="space-y-6 font-sans">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-900">負債管理</h1>
            </div>

            {/* Liability Distribution Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-slate-900 mb-4">負債分佈</h2>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={Object.entries(
                                    liabilities.reduce((acc, item) => {
                                        const cat = item.category;
                                        if (!acc[cat]) acc[cat] = 0;
                                        acc[cat] += item.amount;
                                        return acc;
                                    }, {} as Record<string, number>)
                                ).map(([name, value]) => ({ name, value }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {liabilities.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={['#FF8042', '#FFBB28', '#00C49F', '#0088FE', '#8884d8'][index % 5]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `$${Math.round(value).toLocaleString()}`} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Liability List */}
                <div className="lg:col-span-2 space-y-4">
                    {liabilities.map((item) => {
                        const monthlyPayment = calculateMonthlyPayment(item.amount, item.interest_rate, item.years);
                        return (
                            <div key={item.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-slate-900 text-lg">{item.name}</h3>
                                    <div className="text-slate-500 text-sm space-y-1">
                                        <p>{item.category} • 利率 {item.interest_rate}%</p>
                                        {item.years && <p>期限: {item.years} 年 • 月付: ${Math.round(monthlyPayment).toLocaleString()}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-6">
                                    <p className="font-bold text-slate-900 text-xl">${Math.round(item.amount).toLocaleString()}</p>
                                    <button onClick={() => handleEdit(item)} className="text-slate-400 hover:text-blue-500 transition">
                                        <Pencil size={20} />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-500 transition">
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {liabilities.length === 0 && (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            <p className="text-slate-500">尚無負債，請從右側新增。</p>
                        </div>
                    )}
                </div>

                {/* Add/Edit Form */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-900 text-lg">{editingId ? '編輯負債' : '新增負債'}</h3>
                        {editingId && (
                            <button onClick={handleCancelEdit} className="text-sm text-slate-500 hover:text-slate-700">
                                取消
                            </button>
                        )}
                    </div>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">負債名稱</label>
                            <input
                                type="text"
                                placeholder="例如：房屋貸款"
                                className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                value={newLiability.name}
                                onChange={(e) => setNewLiability({ ...newLiability, name: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">類別</label>
                            <select
                                className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                value={newLiability.category}
                                onChange={(e) => setNewLiability({ ...newLiability, category: e.target.value })}
                            >
                                <option value="Mortgage">房屋貸款</option>
                                <option value="Car Loan">汽車貸款</option>
                                <option value="Credit Card">信用卡</option>
                                <option value="Student Loan">學貸</option>
                                <option value="Other">其他</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">金額 (TWD)</label>
                            <input
                                type="number"
                                className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                value={newLiability.amount}
                                onChange={(e) => setNewLiability({ ...newLiability, amount: Number(e.target.value) })}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">年利率 (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                    value={newLiability.interest_rate}
                                    onChange={(e) => setNewLiability({ ...newLiability, interest_rate: Number(e.target.value) })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">期限 (年)</label>
                                <input
                                    type="number"
                                    className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                    value={newLiability.years}
                                    onChange={(e) => setNewLiability({ ...newLiability, years: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">開始日期</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 pl-10 cursor-pointer"
                                        value={newLiability.start_date}
                                        onChange={(e) => setNewLiability({ ...newLiability, start_date: e.target.value })}
                                        onClick={(e) => (e.currentTarget as any).showPicker()}
                                    />
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Calendar className="h-5 w-5 text-gray-400" />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">寬限期 (月)</label>
                                <input
                                    type="number"
                                    className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                    value={newLiability.grace_period_months}
                                    onChange={(e) => setNewLiability({ ...newLiability, grace_period_months: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full text-white py-2 rounded-lg transition font-medium disabled:opacity-50 ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                        >
                            {loading ? '處理中...' : (editingId ? '更新負債' : '新增負債')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Liabilities;
