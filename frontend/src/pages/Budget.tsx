import React, { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle, Target, Calendar } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

// ...



const Budget = () => {
    const [incomes, setIncomes] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [goals, setGoals] = useState<any[]>([]);
    const [newItem, setNewItem] = useState({ name: '', amount: 0, category: 'Salary', type: 'income' });
    const [newGoal, setNewGoal] = useState({ name: '', amount: 0, target_date: '' });
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        try {
            const [incRes, expRes, goalRes] = await Promise.all([
                api.get('/finance/incomes'),
                api.get('/finance/expenses'),
                api.get('/finance/goals')
            ]);
            setIncomes(incRes.data);
            setExpenses(expRes.data);
            setGoals(goalRes.data);
        } catch (error) {
            console.error("Error fetching budget data", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const endpoint = newItem.type === 'income' ? '/finance/incomes' : '/finance/expenses';
            await api.post(endpoint, { name: newItem.name, amount: newItem.amount, category: newItem.category });
            setNewItem({ name: '', amount: 0, category: 'Salary', type: 'income' });
            fetchData();
        } catch (error) {
            console.error("Error adding item", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddGoal = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/finance/goals', {
                name: newGoal.name,
                amount: newGoal.amount,
                target_date: newGoal.target_date
            });
            setNewGoal({ name: '', amount: 0, target_date: '' });
            fetchData();
        } catch (error) {
            console.error("Error adding goal", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, type: 'income' | 'expense' | 'goal') => {
        try {
            let endpoint = '';
            if (type === 'income') endpoint = `/finance/incomes/${id}`;
            else if (type === 'expense') endpoint = `/finance/expenses/${id}`;
            else endpoint = `/finance/goals/${id}`;

            await api.delete(endpoint);
            fetchData();
        } catch (error) {
            console.error("Error deleting item", error);
        }
    };

    const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
    const netFlow = totalIncome - totalExpense;

    // Calculate Forecast Data (Next 10 Years)
    const currentYear = new Date().getFullYear();
    const forecastData = Array.from({ length: 10 }, (_, i) => {
        const year = currentYear + i;
        const annualBaseFlow = netFlow * 12;

        // Sum goals for this year
        const yearGoals = goals.filter(g => new Date(g.target_date).getFullYear() === year);
        const goalsAmount = yearGoals.reduce((sum, g) => sum + g.amount, 0);

        return {
            year: year.toString(),
            netFlow: annualBaseFlow - goalsAmount,
            baseFlow: annualBaseFlow,
            goalsImpact: -goalsAmount
        };
    });

    return (
        <div className="space-y-12 font-sans">
            <h1 className="text-3xl font-bold text-slate-900">收支預算</h1>

            {/* Top Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-2">
                        <ArrowUpCircle className="text-green-500" />
                        <span className="text-slate-500 font-medium">月收入</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">${Math.round(totalIncome).toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-2">
                        <ArrowDownCircle className="text-red-500" />
                        <span className="text-slate-500 font-medium">月支出</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">${Math.round(totalExpense).toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-2">
                        <span className="text-slate-500 font-medium">淨現金流</span>
                    </div>
                    <p className={`text-2xl font-bold ${netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${Math.round(netFlow).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Section 1: Monthly Recurring Budget */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">每月固定收支設定</h2>
                    <p className="text-slate-500 mt-1">請先輸入您的每月固定收入與支出，系統將以此計算基礎現金流。</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Add Form */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                        <h3 className="font-bold text-slate-900 mb-4 text-lg">新增收支項目</h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">類型</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNewItem({ ...newItem, type: 'income' })}
                                        className={`py-2 rounded-lg text-sm font-medium transition ${newItem.type === 'income' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-500 border border-transparent'}`}
                                    >
                                        收入
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewItem({ ...newItem, type: 'expense' })}
                                        className={`py-2 rounded-lg text-sm font-medium transition ${newItem.type === 'expense' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-50 text-slate-500 border border-transparent'}`}
                                    >
                                        支出
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">名稱</label>
                                <input
                                    type="text"
                                    className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    value={newItem.name}
                                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">金額</label>
                                <input
                                    type="number"
                                    className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    value={newItem.amount}
                                    onChange={(e) => setNewItem({ ...newItem, amount: Number(e.target.value) })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">類別</label>
                                <input
                                    type="text"
                                    className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    value={newItem.category}
                                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-slate-900 text-white py-2 rounded-lg hover:bg-slate-800 transition font-medium disabled:opacity-50"
                            >
                                {loading ? '處理中...' : '新增項目'}
                            </button>
                        </form>
                    </div>

                    {/* Right: Lists */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Income List */}
                        <div>
                            <h3 className="font-bold text-slate-900 mb-4 text-lg">收入來源</h3>
                            <div className="space-y-3">
                                {incomes.map((item) => (
                                    <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-100 flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-slate-900">{item.name}</p>
                                            <p className="text-sm text-slate-500">{item.category}</p>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <p className="font-bold text-green-600">+${Math.round(item.amount).toLocaleString()}</p>
                                            <button onClick={() => handleDelete(item.id, 'income')} className="text-slate-400 hover:text-red-500">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {incomes.length === 0 && <p className="text-slate-400 text-sm italic">尚無收入項目</p>}
                            </div>
                        </div>

                        {/* Expense List */}
                        <div>
                            <h3 className="font-bold text-slate-900 mb-4 text-lg">支出項目</h3>
                            <div className="space-y-3">
                                {expenses.map((item) => (
                                    <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-100 flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-slate-900">{item.name}</p>
                                            <p className="text-sm text-slate-500">{item.category}</p>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <p className="font-bold text-red-600">-${Math.round(item.amount).toLocaleString()}</p>
                                            <button onClick={() => handleDelete(item.id, 'expense')} className="text-slate-400 hover:text-red-500">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {expenses.length === 0 && <p className="text-slate-400 text-sm italic">尚無支出項目</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <hr className="border-gray-200" />

            {/* Section 2: Future Major Goals */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">未來重大財務目標</h2>
                    <p className="text-slate-500 mt-1">設定未來的大額支出目標（如買房、買車），右側圖表將顯示其對現金流的衝擊。</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Add Goal & List */}
                    <div className="space-y-6">
                        {/* Add Goal Form */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-slate-900 mb-4 text-lg">新增未來目標</h3>
                            <form onSubmit={handleAddGoal} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">目標名稱</label>
                                    <input
                                        type="text"
                                        placeholder="例如：買車頭期款"
                                        className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={newGoal.name}
                                        onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">預估金額</label>
                                    <input
                                        type="number"
                                        className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={newGoal.amount}
                                        onChange={(e) => setNewGoal({ ...newGoal, amount: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">目標日期</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 pl-10 cursor-pointer"
                                            value={newGoal.target_date}
                                            onChange={(e) => setNewGoal({ ...newGoal, target_date: e.target.value })}
                                            onClick={(e) => (e.currentTarget as any).showPicker()}
                                            required
                                        />
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Calendar className="h-5 w-5 text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
                                >
                                    {loading ? '處理中...' : '新增目標'}
                                </button>
                            </form>
                        </div>

                        {/* Goals List */}
                        <div>
                            <h3 className="font-bold text-slate-900 mb-4 text-lg">目標列表</h3>
                            <div className="space-y-3">
                                {goals.map((item) => (
                                    <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-100 flex justify-between items-center">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Target size={16} className="text-blue-500" />
                                                <p className="font-medium text-slate-900">{item.name}</p>
                                            </div>
                                            <p className="text-sm text-slate-500">
                                                目標日期: {new Date(item.target_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <p className="font-bold text-slate-900">${Math.round(item.amount).toLocaleString()}</p>
                                            <button onClick={() => handleDelete(item.id, 'goal')} className="text-slate-400 hover:text-red-500">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {goals.length === 0 && (
                                    <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                        <p className="text-slate-500">尚無設定目標</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Forecast Chart */}
                    <div className="lg:col-span-2">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
                            <h3 className="font-bold text-slate-900 mb-6 text-lg">未來淨現金流預測 (含大額支出衝擊)</h3>
                            <div className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={forecastData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="year" />
                                        <YAxis />
                                        <Tooltip
                                            formatter={(value: number) => `$${Math.round(value).toLocaleString()}`}
                                            labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                                        />
                                        <ReferenceLine y={0} stroke="#000" />
                                        <Bar dataKey="netFlow" name="年度淨現金流">
                                            {forecastData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.netFlow >= 0 ? '#22c55e' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-sm text-slate-500 mt-4 text-center">
                                此圖表顯示未來 10 年的預估年度淨現金流。紅色柱狀代表該年度因大額支出導致現金流為負，需提前準備資金。
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Budget;
