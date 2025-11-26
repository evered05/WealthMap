import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import { Compass, Flag, Navigation, Plus, Minus } from 'lucide-react';

// Custom dot for the "Start" of the journey (Current Position)
const StartMarker = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.isStart) {
        return (
            <svg x={cx - 12} y={cy - 12} width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" fill="white" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="#ef4444" />
            </svg>
        );
    }
    return null;
};

// Custom dot for "Goals" (Destinations)
const GoalMarker = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.isGoal) {
        return (
            <g transform={`translate(${cx - 12},${cy - 24})`}>
                <Flag size={24} className="text-indigo-600 fill-indigo-100" />
                <text x={12} y={36} textAnchor="middle" fill="#4f46e5" fontSize={10} fontWeight="bold">{payload.goalName}</text>
            </g>
        );
    }
    return null;
};

const Dashboard: React.FC = () => {
    const [assets, setAssets] = useState<any[]>([]);
    const [liabilities, setLiabilities] = useState<any[]>([]);
    const [goals, setGoals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(1); // 1 = Normal, 0.5 = Zoomed Out (Longer view)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [assetsRes, liabilitiesRes, goalsRes] = await Promise.all([
                    api.get('/finance/assets'),
                    api.get('/finance/liabilities'),
                    api.get('/finance/goals')
                ]);
                setAssets(assetsRes.data);
                setLiabilities(liabilitiesRes.data);
                setGoals(goalsRes.data);
            } catch (error) {
                console.error("Error fetching data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const totalAssets = Array.isArray(assets) ? assets.reduce((sum, item) => sum + (item.value || 0), 0) : 0;
    const totalLiabilities = Array.isArray(liabilities) ? liabilities.reduce((sum, item) => sum + (item.amount || 0), 0) : 0;
    const netWorth = totalAssets - totalLiabilities;

    // Generate "Route" data
    const generateRouteData = () => {
        const baseData = [];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let currentVal = (isNaN(netWorth) ? 0 : netWorth) * 0.8; // Start a bit lower to show growth

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Past data (simulated)
        for (let i = 0; i < 6; i++) {
            currentVal += (Math.random() * 5000) + 1000;
            baseData.push({
                name: months[(currentMonth - 5 + i + 12) % 12],
                value: currentVal,
                isStart: i === 5, // The last point is "Current"
                isGoal: false
            });
        }

        // Future data (Goals)
        // Projected growth
        for (let i = 1; i <= 12 * zoomLevel; i++) {
            currentVal += (Math.random() * 6000) + 2000;

            // Check if there is a goal in this month/year
            const futureDate = new Date(currentYear, currentMonth + i, 1);
            const safeGoals = Array.isArray(goals) ? goals : [];
            const goalInMonth = safeGoals.find(g => {
                if (!g || !g.target_date) return false;
                const gDate = new Date(g.target_date);
                return !isNaN(gDate.getTime()) && gDate.getFullYear() === futureDate.getFullYear() && gDate.getMonth() === futureDate.getMonth();
            });

            baseData.push({
                name: months[futureDate.getMonth()],
                value: currentVal,
                isStart: false,
                isGoal: !!goalInMonth,
                goalName: goalInMonth ? goalInMonth.name : ''
            });
        }
        return baseData;
    };

    const chartData = generateRouteData();

    if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-600">載入航海圖...</div>;

    return (
        <div className="relative w-full h-screen bg-slate-50 overflow-hidden font-sans">
            {/* Background Texture Effect - Subtle Grid/Dot pattern instead of parchment */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `radial-gradient(#64748b 1px, transparent 1px)`,
                    backgroundSize: '24px 24px'
                }}>
            </div>

            {/* Header / Title Overlay */}
            <div className="absolute top-6 left-8 z-10">
                <div className="flex items-center space-x-3 text-slate-800 mb-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                        <Compass size={28} className="text-sky-600" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">財富航行圖</h1>
                </div>
                <p className="text-slate-500 text-sm font-medium ml-1">Captain: Demo User</p>
            </div>

            {/* Navigation Panel (Legend & Stats) */}
            <div className="absolute top-6 right-8 z-10 bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-200 max-w-xs">
                <h3 className="text-slate-800 font-bold border-b border-slate-100 pb-3 mb-4 flex items-center">
                    <Navigation size={18} className="mr-2 text-sky-600" /> 航行資訊
                </h3>

                <div className="space-y-5">
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-bold mb-1">當前位置 (淨資產)</p>
                        <p className="text-3xl font-bold text-slate-900 tracking-tight">${Math.round(netWorth).toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg">
                            <p className="text-xs text-slate-500 font-medium mb-1">總資產</p>
                            <p className="text-base font-bold text-slate-700">${Math.round(totalAssets).toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                            <p className="text-xs text-slate-500 font-medium mb-1">總負債</p>
                            <p className="text-base font-bold text-slate-700">${Math.round(totalLiabilities).toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-slate-600 font-medium">航速 (儲蓄率)</span>
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-xs">24%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-emerald-500 h-2 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: '24%' }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Zoom Controls */}
            <div className="absolute bottom-8 right-8 z-10 flex flex-col space-y-2 bg-white rounded-xl shadow-lg border border-slate-200 p-1.5">
                <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 3))} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors">
                    <Plus size={20} />
                </button>
                <div className="h-px bg-slate-100 w-full mx-auto w-[80%]"></div>
                <button onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 1))} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors">
                    <Minus size={20} />
                </button>
            </div>

            {/* Main Chart Area */}
            <div className="w-full h-full pt-20 pb-10 px-10">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 50, right: 50, left: 50, bottom: 50 }}>
                        <defs>
                            <filter id="shadow" height="200%">
                                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0ea5e9" floodOpacity="0.15" />
                            </filter>
                            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor="#0ea5e9" />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                            dataKey="name"
                            axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                            dy={15}
                        />
                        <YAxis
                            hide={true}
                            domain={['auto', 'auto']}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ color: '#0f172a', fontWeight: 600 }}
                            formatter={(value: number) => [`$${Math.round(value).toLocaleString()}`, '資產']}
                        />

                        {/* The Route Path */}
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="url(#lineGradient)"
                            strokeWidth={5}
                            dot={<StartMarker />}
                            activeDot={{ r: 8, strokeWidth: 0, fill: '#0ea5e9' }}
                            filter="url(#shadow)"
                            animationDuration={2000}
                        />

                        {/* Goal Markers */}
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="none"
                            dot={<GoalMarker />}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default Dashboard;
