
import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import api from '../api';
import { PlayCircle, TrendingUp, Wallet, Calculator } from 'lucide-react';

const Simulation = () => {
    const [params, setParams] = useState({
        initial_portfolio: 100000,
        annual_contribution: 10000,
        years: 30,
        iterations: 1000,
        time_unit: 'month' // 'year', 'month', 'day'
    });
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [backtestYears, setBacktestYears] = useState<number>(10);
    const [usStockTicker, setUsStockTicker] = useState<string>('SPY');
    const [realEstateTicker, setRealEstateTicker] = useState<string>('VNQ');

    const handleRun = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Updated api.post call to include backtest_years
            const res = await api.post('/simulation/monte_carlo', {
                ...params,
                backtest_years: backtestYears,
                us_stock_ticker: usStockTicker,
                real_estate_ticker: realEstateTicker
            });
            setResults(res.data);
        } catch (error) {
            console.error("Error running simulation", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoFill = async () => {
        try {
            const res = await api.get('/finance/assets');
            const totalValue = res.data.reduce((sum: number, asset: any) => sum + asset.value, 0);
            setParams({ ...params, initial_portfolio: Math.round(totalValue) });
        } catch (error) {
            console.error("Error fetching assets", error);
        }
    };

    const handleAutoFillContribution = async () => {
        try {
            const [incomesRes, expensesRes] = await Promise.all([
                api.get('/finance/incomes'),
                api.get('/finance/expenses')
            ]);

            const totalIncome = incomesRes.data.reduce((sum: number, item: any) => sum + item.amount, 0);
            const totalExpense = expensesRes.data.reduce((sum: number, item: any) => sum + item.amount, 0);

            const annualNet = (totalIncome - totalExpense) * 12;
            setParams({ ...params, annual_contribution: Math.round(annualNet) });
        } catch (error) {
            console.error("Error fetching finance data", error);
        }
    };

    // Transform data for Recharts AreaChart (Stacked)
    // We need to calculate the "height" of each band for stacking
    // Band 1 (Bottom, Hidden/Transparent): 0 to P5
    // Band 2 (Severe Risk): P5 to P25 -> height = P25 - P5
    // Band 3 (Below Avg): P25 to P50 -> height = P50 - P25
    // Band 4 (Above Avg): P50 to P75 -> height = P75 - P50
    // Band 5 (High Growth): P75 to P95 -> height = P95 - P75

    const chartData = results ? results.years.map((year: number, index: number) => {
        const p5 = results.p5[index];
        const p25 = results.p25[index];
        const p50 = results.p50[index];
        const p75 = results.p75[index];
        const p95 = results.p95[index];

        return {
            year,
            base: p5,
            risk: p25 - p5,
            low_growth: p50 - p25,
            high_growth: p75 - p50,
            max_growth: p95 - p75,
            // Original values for tooltip
            val_p5: p5,
            val_p25: p25,
            val_p50: p50,
            val_p75: p75,
            val_p95: p95
        };
    }) : [];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-4 border border-gray-100 shadow-lg rounded-xl text-sm">
                    <p className="font-bold text-slate-900 mb-2">第 {label} 年預測</p>
                    <div className="space-y-1">
                        <div className="flex justify-between gap-4 text-emerald-700">
                            <span>P95 (極佳):</span>
                            <span className="font-mono font-bold">${Math.round(data.val_p95).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-emerald-500">
                            <span>P75 (樂觀):</span>
                            <span className="font-mono font-bold">${Math.round(data.val_p75).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-blue-600 border-y border-slate-100 py-1 my-1 font-bold bg-blue-50 px-1 -mx-1 rounded">
                            <span>P50 (中位):</span>
                            <span className="font-mono">${Math.round(data.val_p50).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-amber-500">
                            <span>P25 (保守):</span>
                            <span className="font-mono font-bold">${Math.round(data.val_p25).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-red-500">
                            <span>P5 (悲觀):</span>
                            <span className="font-mono font-bold">${Math.round(data.val_p5).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-8 font-sans">
            <h1 className="text-3xl font-bold text-slate-900">蒙地卡羅模擬分析</h1>
            <p className="text-slate-500 max-w-3xl">
                透過蒙地卡羅模擬法，預測您未來的財富增長路徑。此模型會根據您目前的資產配置，自動計算加權報酬率與波動率，並執行數千次市場模擬。
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Parameters Form */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                    <h3 className="font-bold text-slate-900 mb-6 text-lg">模擬參數設定</h3>
                    <form onSubmit={handleRun} className="space-y-5">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-slate-700">初始投資組合 (TWD)</label>
                                <button
                                    type="button"
                                    onClick={handleAutoFill}
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                    <Wallet size={14} />
                                    帶入目前資產
                                </button>
                            </div>
                            <input
                                type="number"
                                className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                value={params.initial_portfolio}
                                onChange={(e) => setParams({ ...params, initial_portfolio: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-slate-700">每年投入金額 (TWD)</label>
                                <button
                                    type="button"
                                    onClick={handleAutoFillContribution}
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                    <Calculator size={14} />
                                    帶入目前收支
                                </button>
                            </div>
                            <input
                                type="number"
                                className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                value={params.annual_contribution}
                                onChange={(e) => setParams({ ...params, annual_contribution: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">投資年限 (年)</label>
                            <input
                                type="number"
                                className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                value={params.years}
                                onChange={(e) => setParams({ ...params, years: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">分析時間單位 (Time Unit)</label>
                            <select
                                className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                value={params.time_unit}
                                onChange={(e) => setParams({ ...params, time_unit: e.target.value })}
                            >
                                <option value="year">年 (Yearly)</option>
                                <option value="month">月 (Monthly)</option>
                                <option value="day">日 (Daily)</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-1">影響「短期波動路徑圖」的精細度</p>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <h4 className="font-bold text-slate-900 mb-3 text-sm">歷史回測基準設定</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">回測年數</label>
                                    <select
                                        value={backtestYears}
                                        onChange={(e) => setBacktestYears(Number(e.target.value))}
                                        className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    >
                                        <option value={5}>5 年</option>
                                        <option value={10}>10 年</option>
                                        <option value={15}>15 年</option>
                                        <option value={20}>20 年</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">美股基準 (US Stock)</label>
                                    <select
                                        value={usStockTicker}
                                        onChange={(e) => setUsStockTicker(e.target.value)}
                                        className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    >
                                        <option value="SPY">SPY (S&P 500)</option>
                                        <option value="VOO">VOO (S&P 500)</option>
                                        <option value="QQQ">QQQ (Nasdaq 100)</option>
                                        <option value="VT">VT (Total World)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">不動產基準 (Real Estate)</label>
                                    <select
                                        value={realEstateTicker}
                                        onChange={(e) => setRealEstateTicker(e.target.value)}
                                        className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    >
                                        <option value="VNQ">VNQ (US REITs)</option>
                                        <option value="2501.TW">2501.TW (國泰建設)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                            <p className="font-bold mb-1">💡 智慧參數</p>
                            <p>系統將根據您的「資產管理」配置，自動計算預期報酬率與波動率。</p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-bold flex justify-center items-center space-x-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <span>運算中...</span>
                            ) : (
                                <>
                                    <PlayCircle size={20} />
                                    <span>開始模擬</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Results Charts */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Main Fan Chart */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[500px]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-900 text-lg">財富機率河流圖 (Fan Chart)</h3>
                            {results && results.metrics && (
                                <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                    預估年化報酬: {(results.metrics.weighted_return * 100).toFixed(2)}% |
                                    波動率: {(results.metrics.weighted_volatility * 100).toFixed(2)}%
                                </div>
                            )}
                        </div>

                        {results ? (
                            <div className="h-96">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorMax" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.4} />
                                            </linearGradient>
                                            <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#34d399" stopOpacity={0.4} />
                                            </linearGradient>
                                            <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.4} />
                                            </linearGradient>
                                            <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="year" label={{ value: '年', position: 'insideBottomRight', offset: -10 }} />
                                        <YAxis tickFormatter={(value) => `$${value / 1000} k`} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend
                                            payload={[
                                                { value: '高增長 (P75-P95)', type: 'rect', color: '#10b981' },
                                                { value: '中高增長 (P50-P75)', type: 'rect', color: '#34d399' },
                                                { value: '中低增長 (P25-P50)', type: 'rect', color: '#fbbf24' },
                                                { value: '風險區間 (P5-P25)', type: 'rect', color: '#ef4444' },
                                            ]}
                                        />

                                        {/* Stacked Areas */}
                                        {/* Base layer (transparent) */}
                                        <Area type="monotone" dataKey="base" stackId="1" stroke="none" fill="none" />

                                        {/* Risk Zone (P5 to P25) */}
                                        <Area type="monotone" dataKey="risk" stackId="1" stroke="none" fill="url(#colorRisk)" name="風險區間" />

                                        {/* Low Growth (P25 to P50) */}
                                        <Area type="monotone" dataKey="low_growth" stackId="1" stroke="none" fill="url(#colorLow)" name="中低增長" />

                                        {/* High Growth (P50 to P75) */}
                                        <Area type="monotone" dataKey="high_growth" stackId="1" stroke="none" fill="url(#colorHigh)" name="中高增長" />

                                        {/* Max Growth (P75 to P95) */}
                                        <Area type="monotone" dataKey="max_growth" stackId="1" stroke="none" fill="url(#colorMax)" name="高增長" />

                                        {/* Median Line Overlay */}
                                        <Line type="monotone" dataKey="val_p50" stroke="#2563eb" strokeWidth={2} dot={false} style={{ pointerEvents: 'none' }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                                <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                                    <div className="p-4 bg-red-50 rounded-lg">
                                        <p className="text-sm text-red-600 font-medium">悲觀預測 (P5)</p>
                                        <p className="text-xl font-bold text-slate-900 mt-1">${Math.round(results.p5[results.p5.length - 1]).toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                        <p className="text-sm text-blue-600 font-medium">中位數預測 (P50)</p>
                                        <p className="text-xl font-bold text-slate-900 mt-1">${Math.round(results.p50[results.p50.length - 1]).toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-emerald-50 rounded-lg">
                                        <p className="text-sm text-emerald-600 font-medium">樂觀預測 (P95)</p>
                                        <p className="text-xl font-bold text-slate-900 mt-1">${Math.round(results.p95[results.p95.length - 1]).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <TrendingUp size={48} className="mb-4 opacity-20" />
                                <p>請輸入參數並點擊「開始模擬」以查看結果</p>
                            </div>
                        )}
                    </div>

                    {/* Short-term Volatility Chart */}
                    {results && results.short_term_paths && results.short_term_paths.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-slate-900 text-lg mb-6">短期波動情境分析 (第一年)</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={results.short_term_paths} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="step"
                                            label={{ value: params.time_unit === 'day' ? '日' : '月', position: 'insideBottomRight', offset: -10 }}
                                        />
                                        <YAxis tickFormatter={(value) => `$${value / 1000} k`} domain={['auto', 'auto']} />
                                        <Tooltip
                                            formatter={(value: number) => `$${Math.round(value).toLocaleString()} `}
                                            labelFormatter={(label) => `第 ${label} ${params.time_unit === 'day' ? '日' : '月'} `}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey="best" name="賺最多 (P95)" stroke="#10b981" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="median" name="發生機率最大 (P50)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="volatile" name="波動最大" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                        <Line type="monotone" dataKey="worst" name="賠最多 (P5)" stroke="#ef4444" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-sm text-slate-500 mt-4 text-center">
                                * 顯示四種典型情境：最佳 (P95)、最差 (P5)、中位數 (P50) 以及波動最劇烈的情境，協助您評估短期風險。
                            </p>
                        </div>
                    )}

                    {/* One Month Daily Variation Chart */}
                    {results && results.one_month_paths && results.one_month_paths.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-slate-900 text-lg mb-6">單月每日變化情境 (21 個交易日)</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={results.one_month_paths} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="step"
                                            label={{ value: '日 (Day)', position: 'insideBottomRight', offset: -10 }}
                                        />
                                        <YAxis tickFormatter={(value) => `$${value / 1000} k`} domain={['auto', 'auto']} />
                                        <Tooltip
                                            formatter={(value: number) => `$${Math.round(value).toLocaleString()} `}
                                            labelFormatter={(label) => `第 ${label} 日`}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey="best" name="賺最多 (P95)" stroke="#10b981" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="median" name="發生機率最大 (P50)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="volatile" name="波動最大" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                        <Line type="monotone" dataKey="worst" name="賠最多 (P5)" stroke="#ef4444" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-sm text-slate-500 mt-4 text-center">
                                * 模擬單月內 (21 個交易日) 的資產變化，協助您觀察極短期的市場震盪。
                            </p>
                        </div>
                    )}

                    {/* Historical Backtest Chart */}
                    {results && results.historical_backtest && results.historical_backtest.dates && results.historical_backtest.dates.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="mb-6">
                                <h3 className="font-bold text-slate-900 text-lg">歷史回測數據 (過去 {backtestYears} 年)</h3>
                                <div className="text-sm text-slate-500 mt-1">
                                    基準: 美股({usStockTicker}), 不動產({realEstateTicker})
                                </div>
                            </div>
                            {/* Portfolio Composition Breakdown */}
                            {results.metrics.breakdown && (
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <h5 className="font-semibold text-slate-700 mb-2 text-sm">資產配置權重明細 (Composition):</h5>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-slate-500 uppercase bg-slate-100">
                                                <tr>
                                                    <th className="px-2 py-1 rounded-l">類別</th>
                                                    <th className="px-2 py-1">權重</th>
                                                    <th className="px-2 py-1">預設報酬</th>
                                                    <th className="px-2 py-1">預設波動</th>
                                                    <th className="px-2 py-1 text-blue-600">歷史報酬 ({backtestYears}年)</th>
                                                    <th className="px-2 py-1 rounded-r text-blue-600">歷史波動 ({backtestYears}年)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(results.metrics.breakdown)
                                                    .filter(([key, item]: [string, any]) => item.weight > 0)
                                                    .map(([key, item]: [string, any]) => {
                                                        const historical = results.historical_backtest?.historical_metrics?.[key];
                                                        return (
                                                            <tr key={key} className="border-b border-slate-100 last:border-0">
                                                                <td className="px-2 py-1 font-medium text-slate-700">{item.name}</td>
                                                                <td className="px-2 py-1">{(item.weight * 100).toFixed(1)}%</td>
                                                                <td className="px-2 py-1">{(item.mean_return * 100).toFixed(1)}%</td>
                                                                <td className="px-2 py-1">{(item.volatility * 100).toFixed(1)}%</td>
                                                                <td className="px-2 py-1 text-blue-600 font-medium">
                                                                    {historical ? (historical.return * 100).toFixed(1) + '%' : '-'}
                                                                </td>
                                                                <td className="px-2 py-1 text-blue-600 font-medium">
                                                                    {historical ? (historical.volatility * 100).toFixed(1) + '%' : '-'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={results.historical_backtest.dates.map((date: string, index: number) => ({
                                            date,
                                            portfolio: results.historical_backtest.portfolio[index],
                                            real_estate: results.historical_backtest.real_estate[index]
                                        }))}
                                        margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(value) => value.substring(0, 4)} // Show only year
                                            minTickGap={30}
                                        />
                                        <YAxis tickFormatter={(value) => `$${value / 1000} k`} domain={['auto', 'auto']} />
                                        <Tooltip
                                            formatter={(value: number) => `$${Math.round(value).toLocaleString()} `}
                                            labelFormatter={(label) => `日期: ${label} `}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey="portfolio" name="我的投資組合" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="real_estate" name="不動產 (VNQ)" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-sm text-slate-500 mt-4 text-center">
                                * 比較您的投資組合與不動產 (VNQ ETF) 在過去 10 年的歷史表現。假設初始投入金額相同。
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Simulation;
