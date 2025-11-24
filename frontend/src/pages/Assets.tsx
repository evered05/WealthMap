import React, { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Trash2, TrendingUp, RefreshCw, Search, Edit2, X } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Asset {
    id: number;
    name: string;
    category: string;
    value: number;
    ticker?: string;
    shares?: number;
}

interface PreviewData {
    ticker: string;
    price: number;
    currency: string;
    exchange_rate: number;
    total_value_twd: number;
}

const Assets = () => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [newAsset, setNewAsset] = useState({
        name: '',
        category: 'Cash/Bank Deposit',
        value: 0,
        ticker: '',
        shares: 0
    });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);

    const categories = [
        "Cash/Bank Deposit", // 現金/銀行存款
        "Insurance",         // 保單
        "Stock/Fund",        // 股票/基金
        "Bond",              // 債券
        "Real Estate",       // 不動產
        "Other"              // 其他
    ];

    const categoryLabels: Record<string, string> = {
        "Cash/Bank Deposit": "現金/銀行存款",
        "Insurance": "保單",
        "Stock/Fund": "股票/基金",
        "Bond": "債券",
        "Real Estate": "不動產",
        "Other": "其他"
    };

    const fetchAssets = async () => {
        try {
            const res = await api.get('/finance/assets');
            setAssets(res.data);
        } catch (error) {
            console.error("Error fetching assets", error);
        }
    };

    useEffect(() => {
        fetchAssets();
    }, []);

    // Real-time preview effect
    useEffect(() => {
        const fetchPreview = async () => {
            if (newAsset.category === 'Stock/Fund' && newAsset.ticker && newAsset.shares > 0) {
                setPreviewLoading(true);
                try {
                    const res = await api.get('/finance/stock/preview', {
                        params: { ticker: newAsset.ticker, shares: newAsset.shares }
                    });
                    setPreviewData(res.data);
                    // Auto-update the value field for submission
                    setNewAsset(prev => ({ ...prev, value: res.data.total_value_twd }));
                } catch (error) {
                    console.error("Error fetching preview", error);
                    setPreviewData(null);
                } finally {
                    setPreviewLoading(false);
                }
            } else {
                setPreviewData(null);
            }
        };

        // Debounce slightly to avoid too many calls
        const timeoutId = setTimeout(() => {
            fetchPreview();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [newAsset.category, newAsset.ticker, newAsset.shares]);

    const handleAddOrUpdateAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingId) {
                await api.put(`/finance/assets/${editingId}`, newAsset);
            } else {
                await api.post('/finance/assets', newAsset);
            }
            resetForm();
            fetchAssets();
        } catch (error) {
            console.error("Error saving asset", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (asset: Asset) => {
        setEditingId(asset.id);
        setNewAsset({
            name: asset.name,
            category: asset.category,
            value: asset.value,
            ticker: asset.ticker || '',
            shares: asset.shares || 0
        });
    };

    const resetForm = () => {
        setEditingId(null);
        setNewAsset({ name: '', category: 'Cash/Bank Deposit', value: 0, ticker: '', shares: 0 });
        setPreviewData(null);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("確定要刪除此資產嗎？")) return;
        try {
            await api.delete(`/finance/assets/${id}`);
            fetchAssets();
        } catch (error) {
            console.error("Error deleting asset", error);
        }
    };

    return (
        <div className="space-y-6 font-sans">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-900">資產管理</h1>
            </div>

            {/* Asset Distribution Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-slate-900 mb-4">資產分佈</h2>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={Object.entries(
                                    assets.reduce((acc, asset) => {
                                        const cat = asset.category;
                                        if (!acc[cat]) acc[cat] = 0;
                                        acc[cat] += asset.value;
                                        return acc;
                                    }, {} as Record<string, number>)
                                ).map(([name, value]) => ({ name: categoryLabels[name] || name, value }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {Object.keys(categoryLabels).map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'][index % 6]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `$${Math.round(value).toLocaleString()}`} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Asset List */}
                <div className="lg:col-span-2 space-y-8">
                    {Object.entries(
                        assets.reduce((acc, asset) => {
                            const cat = asset.category;
                            if (!acc[cat]) acc[cat] = [];
                            acc[cat].push(asset);
                            return acc;
                        }, {} as Record<string, Asset[]>)
                    )
                        .sort(([catA], [catB]) => {
                            const order = ["Real Estate", "Cash/Bank Deposit", "Insurance", "Stock/Fund", "Bond", "Other"];
                            return order.indexOf(catA) - order.indexOf(catB);
                        })
                        .map(([category, categoryAssets]) => {
                            const categoryTotal = categoryAssets.reduce((sum, asset) => sum + asset.value, 0);
                            return (
                                <div key={category} className="space-y-4">
                                    <div className="flex justify-between items-end border-b border-gray-200 pb-2">
                                        <h2 className="text-xl font-bold text-slate-800 flex items-center">
                                            {categoryLabels[category] || category}
                                            <span className="ml-2 text-sm font-normal text-slate-500">({categoryAssets.length})</span>
                                        </h2>
                                        <span className="text-lg font-bold text-blue-600">
                                            ${Math.round(categoryTotal).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="grid gap-4">
                                        {categoryAssets.map((asset) => (
                                            <div key={asset.id} className={`bg-white p-6 rounded-xl shadow-sm border transition ${editingId === asset.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-100'}`}>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <h3 className="font-bold text-slate-900 text-lg">{asset.name}</h3>
                                                        <p className="text-slate-500 text-sm">
                                                            {asset.ticker && `${asset.ticker} • ${asset.shares}股`}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center space-x-4">
                                                        <div className="text-right mr-4">
                                                            <p className="font-bold text-slate-900 text-xl">${Math.round(asset.value).toLocaleString()}</p>
                                                            {asset.ticker && <p className="text-xs text-green-600 flex items-center justify-end"><TrendingUp size={12} className="mr-1" /> 即時更新</p>}
                                                        </div>
                                                        <button
                                                            onClick={() => handleEdit(asset)}
                                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                                                            title="編輯"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(asset.id)}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                                                            title="刪除"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                    {assets.length === 0 && (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            <p className="text-slate-500">尚無資產，請從右側新增。</p>
                        </div>
                    )}
                </div>

                {/* Add/Edit Asset Form */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit sticky top-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-900 text-lg">
                            {editingId ? '編輯資產' : '新增資產'}
                        </h3>
                        {editingId && (
                            <button
                                onClick={resetForm}
                                className="text-slate-400 hover:text-slate-600 flex items-center text-sm"
                            >
                                <X size={16} className="mr-1" /> 取消
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleAddOrUpdateAsset} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">資產名稱</label>
                            <input
                                type="text"
                                placeholder="例如：台積電股票、銀行存款"
                                className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                value={newAsset.name}
                                onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">類別</label>
                            <select
                                className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                value={newAsset.category}
                                onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })}
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{categoryLabels[cat]}</option>
                                ))}
                            </select>
                        </div>

                        {newAsset.category === 'Stock/Fund' ? (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">股票代號 (Ticker)</label>
                                        <input
                                            type="text"
                                            placeholder="例如：AAPL"
                                            className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 uppercase"
                                            value={newAsset.ticker}
                                            onChange={(e) => setNewAsset({ ...newAsset, ticker: e.target.value.toUpperCase() })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">股數 (Shares)</label>
                                        <input
                                            type="number"
                                            className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                            value={newAsset.shares}
                                            onChange={(e) => setNewAsset({ ...newAsset, shares: Number(e.target.value) })}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Preview Section */}
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-slate-700">即時估值</span>
                                        {previewLoading && <RefreshCw size={14} className="animate-spin text-blue-500" />}
                                    </div>

                                    {previewData ? (
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs text-slate-500">
                                                <span>市價 ({previewData.currency})</span>
                                                <span>{Math.round(previewData.price).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-slate-500">
                                                <span>匯率 (USD/TWD)</span>
                                                <span>{Math.round(previewData.exchange_rate).toLocaleString()}</span>
                                            </div>
                                            <div className="pt-2 border-t border-slate-200 flex justify-between items-center mt-1">
                                                <span className="text-sm font-bold text-slate-900">總價值 (TWD)</span>
                                                <span className="text-lg font-bold text-blue-600">${Math.round(previewData.total_value_twd).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 text-center py-2">
                                            {newAsset.ticker && newAsset.shares ? "正在獲取報價..." : "請輸入代號與股數"}
                                        </p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">價值 (TWD)</label>
                                <input
                                    type="number"
                                    className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                    value={newAsset.value}
                                    onChange={(e) => setNewAsset({ ...newAsset, value: Number(e.target.value) })}
                                    required
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || (newAsset.category === 'Stock/Fund' && !previewData)}
                            className={`w-full text-white py-2 rounded-lg transition font-medium disabled:opacity-50 flex justify-center items-center ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                        >
                            {loading ? '處理中...' : (editingId ? '更新資產' : '確認新增')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Assets;
