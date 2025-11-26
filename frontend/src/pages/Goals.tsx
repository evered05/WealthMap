import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, AlertCircle, CheckCircle, Pencil, Filter, ZoomIn, ZoomOut, DollarSign, Clock } from 'lucide-react';
import { DndContext, DragOverlay, useDraggable, useDroppable, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import api from '../api';

interface Goal {
    id?: number;
    name: string;
    amount: number;
    target_date: string;
    image_url?: string;
    goal_type: 'lump_sum' | 'cash_flow';
}

interface GoalAnalysis {
    goal_id: number;
    probability: number;
    progress_ratio: number;
    status: string;
}

// --- Components ---

const ImpactBadge = ({ amount, annualIncome }: { amount: number, annualIncome: number }) => {
    if (annualIncome === 0) return null;
    const ratio = amount / annualIncome;

    let color = "bg-emerald-100 text-emerald-700";
    let icon = <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />;
    let text = "低"; // Shortened text

    if (ratio > 0.5) {
        color = "bg-rose-100 text-rose-700";
        icon = <AlertCircle size={10} className="text-rose-600" />;
        text = "高";
    } else if (ratio > 0.1) {
        color = "bg-amber-100 text-amber-700";
        icon = <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-amber-500" />;
        text = "中";
    }

    return (
        <div className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${color}`}>
            {icon}
            <span>{text}</span>
        </div>
    );
};

const DraggableGoal = ({ goal, analysis, onEdit, onDelete, annualIncome }: { goal: Goal, analysis: GoalAnalysis, onEdit: (g: Goal) => void, onDelete: (id: number) => void, annualIncome: number }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `goal-${goal.id}`,
        data: { goal }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
    } : undefined;

    // Progress Bar Color
    let progressColor = "bg-amber-500";
    if (analysis.probability > 80) progressColor = "bg-emerald-500";
    else if (analysis.probability < 50) progressColor = "bg-rose-500";

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`relative group touch-none ${isDragging ? 'opacity-50 z-50' : 'z-10'}`}>
            <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-200 hover:shadow-md transition-all w-[160px] relative overflow-hidden cursor-grab active:cursor-grabbing">
                {/* Header: Icon & Name */}
                <div className="flex items-start space-x-2 mb-1.5">
                    <div className="w-8 h-8 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {goal.image_url ? (
                            <img src={goal.image_url} alt={goal.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-sm">✨</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-bold text-slate-800 truncate leading-tight">{goal.name}</h3>
                        <div className="flex items-center text-[10px] text-slate-500 mt-0.5">
                            ${(goal.amount / 10000).toFixed(0)}萬
                        </div>
                    </div>
                </div>

                {/* Impact Badge & Type */}
                <div className="mb-2 flex justify-between items-center">
                    <span className="text-[9px] text-slate-400 bg-slate-50 px-1 rounded border border-slate-100">
                        {goal.goal_type === 'lump_sum' ? '單筆' : '月收'}
                    </span>
                    <ImpactBadge amount={goal.amount} annualIncome={annualIncome} />
                </div>

                {/* Progress Bar */}
                <div className="space-y-0.5">
                    <div className="flex justify-between text-[9px] text-slate-500 font-medium">
                        <span>達成 {analysis.probability}%</span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${progressColor} rounded-full`} style={{ width: `${analysis.probability}%` }}></div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="absolute top-1 right-1 flex space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
                    <button onClick={() => onEdit(goal)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-sky-600"><Pencil size={10} /></button>
                    <button onClick={() => onDelete(goal.id!)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-500"><X size={10} /></button>
                </div>
            </div>
        </div>
    );
};

const YearSlot = ({ age, year, children, width }: { age: number, year: number, children: React.ReactNode, width: number }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `year-${year}`,
        data: { year, age }
    });

    const isEvenYear = year % 2 === 0;

    return (
        <div
            ref={setNodeRef}
            style={{ minWidth: `${width}px`, width: `${width}px` }}
            className={`relative flex flex-col items-center pt-8 border-r border-slate-200/30 h-full transition-colors group ${isOver ? 'bg-sky-50/60' : (isEvenYear ? 'bg-slate-50/30' : '')}`}
        >
            {/* Timeline Axis */}
            <div className="absolute top-0 w-full h-4 border-b border-slate-300"></div>
            <div className="absolute top-0 w-[1px] h-2 bg-slate-300"></div>

            {/* Vertical Lifeline */}
            <div className="absolute top-8 bottom-0 left-1/2 w-px border-l border-dashed border-slate-200/60 -z-10"></div>

            {/* Label */}
            <div className="absolute top-6 text-center group-hover:scale-110 transition-transform z-20">
                <div className="text-sm font-bold text-slate-700">{age}</div>
                <div className="text-[10px] text-slate-400">{year}</div>
            </div>

            {/* Content Area - Multi-column Layout */}
            <div className="mt-10 w-full px-1 flex flex-wrap justify-center content-start gap-2 pb-20">
                {children}
            </div>
        </div>
    );
};

const Goals: React.FC = () => {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [analysis, setAnalysis] = useState<Record<number, GoalAnalysis>>({});
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'lump_sum' | 'cash_flow'>('lump_sum');
    const [error, setError] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
    const [currentOverYear, setCurrentOverYear] = useState<number | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'high_impact' | 'at_risk'>('all');

    // UI State
    const [zoomLevel, setZoomLevel] = useState(180); // Default slightly wider to fit at least one card comfortably
    const [annualIncome, setAnnualIncome] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Form State
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
    const [goalName, setGoalName] = useState('');
    const [goalAmount, setGoalAmount] = useState('');
    const [targetAge, setTargetAge] = useState<string>('30');

    const currentAge = 30; // Mock
    const currentYear = new Date().getFullYear();
    const maxAge = 95;

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    useEffect(() => {
        fetchGoalsAndAnalyze();
    }, []);

    const fetchGoalsAndAnalyze = async () => {
        try {
            setError(null);

            const [goalsRes, assetsRes, incomeRes, expensesRes] = await Promise.all([
                api.get('/finance/goals'),
                api.get('/finance/assets'),
                api.get('/finance/incomes'),
                api.get('/finance/expenses')
            ]);

            setGoals(goalsRes.data);

            const assets = assetsRes.data;
            const initialPortfolio = assets.reduce((sum: number, item: any) => sum + item.value, 0);

            const income = incomeRes.data;
            const expenses = expensesRes.data;
            const monthlyIncome = income.reduce((sum: number, item: any) => sum + item.amount, 0);
            const monthlyExpense = expenses.reduce((sum: number, item: any) => sum + item.amount, 0);
            const annualContribution = (monthlyIncome - monthlyExpense) * 12;

            setAnnualIncome(monthlyIncome * 12);

            if (goalsRes.data.length > 0) {
                const analysisRes = await api.post('/simulation/goals_check', {
                    initial_portfolio: initialPortfolio,
                    annual_contribution: annualContribution,
                    years: 65, // Extend to 95
                    goals: goalsRes.data
                });

                const analysisMap: Record<number, GoalAnalysis> = {};
                analysisRes.data.forEach((item: GoalAnalysis) => {
                    analysisMap[item.goal_id] = item;
                });
                setAnalysis(analysisMap);
            }
        } catch (error: any) {
            console.error("Error fetching data", error);
            setError("無法連接到伺服器");
        } finally {
            setLoading(false);
        }
    };

    // ... (Handlers: handleOpenModal, handleEditGoal, handleSaveGoal, handleDeleteGoal - Keep logic same)
    const handleOpenModal = () => {
        setEditingGoal(null);
        setGoalName('');
        setGoalAmount('');
        setTargetAge('30');
        setActiveTab('lump_sum');
        setIsModalOpen(true);
    };

    const handleEditGoal = (goal: Goal) => {
        setEditingGoal(goal);
        setGoalName(goal.name);
        setGoalAmount(goal.amount.toString());
        const goalYear = new Date(goal.target_date).getFullYear();
        const goalAge = currentAge + (goalYear - new Date().getFullYear());
        setTargetAge(goalAge.toString());
        setActiveTab(goal.goal_type);
        setIsModalOpen(true);
    };

    const handleSaveGoal = async () => {
        if (!goalName || !goalAmount || !targetAge) return;
        const targetYear = new Date().getFullYear() + (parseInt(targetAge) - currentAge);
        const targetDate = new Date(targetYear, 0, 1).toISOString();
        const goalData = { name: goalName, amount: parseFloat(goalAmount), target_date: targetDate, goal_type: activeTab };

        try {
            if (editingGoal && editingGoal.id) {
                await api.put(`/finance/goals/${editingGoal.id}`, goalData);
            } else {
                await api.post('/finance/goals', goalData);
            }
            setIsModalOpen(false);
            fetchGoalsAndAnalyze();
            setGoalName(''); setGoalAmount(''); setEditingGoal(null);
        } catch (error) { console.error(error); }
    };

    const handleDeleteGoal = async (id: number) => {
        if (!window.confirm("確定要刪除這個夢想嗎？")) return;
        try {
            await api.delete(`/finance/goals/${id}`);
            fetchGoalsAndAnalyze();
        } catch (error) { console.error(error); }
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        setActiveGoal(active.data.current?.goal);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event;
        if (over) {
            setCurrentOverYear(over.data.current?.year);
        } else {
            setCurrentOverYear(null);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveGoal(null);
        setCurrentOverYear(null);

        if (!over) return;
        const goalId = active.data.current?.goal.id;
        const newYear = over.data.current?.year;

        if (goalId && newYear) {
            const updatedGoals = goals.map(g => {
                if (g.id === goalId) {
                    const newDate = new Date(newYear, 0, 1).toISOString();
                    return { ...g, target_date: newDate };
                }
                return g;
            });
            setGoals(updatedGoals);

            try {
                const goalToUpdate = goals.find(g => g.id === goalId);
                if (goalToUpdate) {
                    const newDate = new Date(newYear, 0, 1).toISOString();
                    await api.put(`/finance/goals/${goalId}`, { ...goalToUpdate, target_date: newDate });
                    fetchGoalsAndAnalyze();
                }
            } catch (error) { fetchGoalsAndAnalyze(); }
        }
    };

    // Timeline Generation
    const timelineSlots = [];
    for (let i = 0; i <= maxAge - currentAge; i++) {
        timelineSlots.push({ age: currentAge + i, year: currentYear + i });
    }

    // Life Stage Backgrounds
    const getLifeStageWidth = (startAge: number, endAge: number) => {
        const start = Math.max(startAge, currentAge);
        const end = Math.min(endAge, maxAge);
        if (start > end) return 0;
        return (end - start + 1) * zoomLevel;
    };

    // Filter Logic
    const filteredGoals = goals.filter(g => {
        if (filterType === 'all') return true;
        const gAnalysis = analysis[g.id!] || { probability: 0, progress_ratio: 0 };
        const ratio = annualIncome > 0 ? g.amount / annualIncome : 0;

        if (filterType === 'high_impact') return ratio > 0.5;
        if (filterType === 'at_risk') return gAnalysis.probability < 50;
        return true;
    });

    if (loading) return <div className="flex justify-center items-center h-screen bg-slate-50 text-slate-600">載入中...</div>;
    if (error) return <div className="flex justify-center items-center h-screen bg-slate-50 text-rose-500">{error}</div>;

    return (
        <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center z-20 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">人生夢想板</h1>
                    <p className="text-slate-500 text-xs">規劃您的人生藍圖與財務目標</p>
                </div>

                <div className="flex items-center space-x-6">
                    {/* Zoom Control */}
                    <div className="flex items-center space-x-2 bg-slate-100 rounded-lg p-1">
                        <ZoomOut size={16} className="text-slate-400 ml-2" />
                        <input
                            type="range"
                            min="170"
                            max="500"
                            value={zoomLevel}
                            onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                            className="w-32 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                        />
                        <ZoomIn size={16} className="text-slate-400 mr-2" />
                    </div>

                    <button
                        onClick={handleOpenModal}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg shadow flex items-center space-x-2 transition-all"
                    >
                        <Plus size={16} />
                        <span>新增夢想</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border-b border-slate-200 px-8 py-2 flex items-center space-x-4 z-10">
                <span className="text-xs font-bold text-slate-500 flex items-center">
                    <Filter size={12} className="mr-1" />
                    篩選：
                </span>
                <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterType === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    全部顯示
                </button>
                <button
                    onClick={() => setFilterType('high_impact')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterType === 'high_impact' ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-500' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    高財務衝擊
                </button>
                <button
                    onClick={() => setFilterType('at_risk')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterType === 'at_risk' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-500' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    達成率偏低
                </button>
            </div>

            {/* Timeline Container */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden relative" ref={scrollContainerRef}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>

                    <div className="h-full relative min-w-max">
                        {/* Life Stage Backgrounds Layer */}
                        <div className="absolute inset-0 flex h-full pointer-events-none z-0">
                            {/* Career Growth: 30-55 */}
                            <div style={{ width: getLifeStageWidth(30, 55) }} className="h-full bg-sky-50/50 border-r border-sky-100 flex flex-col justify-end pb-4">
                                <span className="text-sky-200 font-bold text-4xl uppercase tracking-widest opacity-20 rotate-0 ml-4 mb-8">Career Growth</span>
                            </div>
                            {/* Pre-Retirement: 56-65 */}
                            <div style={{ width: getLifeStageWidth(56, 65) }} className="h-full bg-amber-50/50 border-r border-amber-100 flex flex-col justify-end pb-4">
                                <span className="text-amber-200 font-bold text-4xl uppercase tracking-widest opacity-20 ml-4 mb-8">Pre-Retirement</span>
                            </div>
                            {/* Retirement: 66+ */}
                            <div style={{ width: getLifeStageWidth(66, 95) }} className="h-full bg-slate-100/50 flex flex-col justify-end pb-4">
                                <span className="text-slate-200 font-bold text-4xl uppercase tracking-widest opacity-20 ml-4 mb-8">Retirement</span>
                            </div>
                        </div>

                        {/* Slots Layer */}
                        <div className="flex h-full relative z-10">
                            {timelineSlots.map((slot) => {
                                const slotGoals = filteredGoals.filter(g => new Date(g.target_date).getFullYear() === slot.year);
                                return (
                                    <YearSlot key={slot.year} age={slot.age} year={slot.year} width={zoomLevel}>
                                        {slotGoals.map(goal => (
                                            <DraggableGoal
                                                key={goal.id}
                                                goal={goal}
                                                analysis={analysis[goal.id!] || { probability: 0, progress_ratio: 0, status: 'Unknown' }}
                                                onEdit={handleEditGoal}
                                                onDelete={handleDeleteGoal}
                                                annualIncome={annualIncome}
                                            />
                                        ))}
                                    </YearSlot>
                                );
                            })}
                        </div>
                    </div>

                    <DragOverlay dropAnimation={null}>
                        {activeId && activeGoal ? (
                            <div className="relative">
                                <div className="bg-white rounded-lg p-2 shadow-xl border-2 border-sky-500 w-[160px] opacity-90 rotate-3 cursor-grabbing">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center overflow-hidden">
                                            {activeGoal.image_url ? (
                                                <img src={activeGoal.image_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-sm">✨</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-xs font-bold text-slate-800 truncate">{activeGoal.name}</h3>
                                            <p className="text-slate-500 text-[10px]">${activeGoal.amount.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Feedback Tooltip */}
                                {currentOverYear && (
                                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-2 px-3 rounded-xl shadow-xl whitespace-nowrap z-50 pointer-events-none">
                                        {(() => {
                                            const oldYear = new Date(activeGoal.target_date).getFullYear();
                                            const diff = currentOverYear - oldYear;

                                            // Simple calculation
                                            const oldYearsLeft = Math.max(1, oldYear - currentYear);
                                            const newYearsLeft = Math.max(1, currentOverYear - currentYear);
                                            const amount = activeGoal.amount;

                                            const oldMonthly = amount / (oldYearsLeft * 12);
                                            const newMonthly = amount / (newYearsLeft * 12);
                                            const monthlyDiff = newMonthly - oldMonthly;

                                            return (
                                                <div className="flex flex-col items-center space-y-1">
                                                    <div className="font-bold text-sm flex items-center space-x-2">
                                                        <span>{oldYear}</span>
                                                        <span className="text-slate-400">→</span>
                                                        <span className="text-sky-300">{currentOverYear}</span>
                                                        <span className="text-slate-400 text-[10px]">({currentAge + (currentOverYear - currentYear)}歲)</span>
                                                    </div>
                                                    {diff !== 0 && (
                                                        <div className={`flex items-center space-x-1 ${monthlyDiff > 0 ? "text-rose-300" : "text-emerald-300"}`}>
                                                            {monthlyDiff > 0 ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                                                            <span>
                                                                {monthlyDiff > 0 ? "負擔增加" : "負擔減少"} ${Math.abs(Math.round(monthlyDiff)).toLocaleString()}/月
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>

            {/* Modal (Keep existing) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
                        <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">{editingGoal ? '編輯夢想小卡' : '新增夢想小卡'}</h2>
                            <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-slate-400" /></button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button onClick={() => setActiveTab('lump_sum')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'lump_sum' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>單筆支出 (買房/車)</button>
                                <button onClick={() => setActiveTab('cash_flow')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'cash_flow' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>財務自由 (退休)</button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">夢想名稱</label>
                                    <input type="text" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="例如：環遊世界" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-sky-500 outline-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">預計達成年齡</label>
                                        <input type="number" value={targetAge} onChange={(e) => setTargetAge(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-sky-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">{activeTab === 'lump_sum' ? '預計金額' : '目標月收入'}</label>
                                        <input type="number" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} placeholder="0" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-sky-500 outline-none" />
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleSaveGoal} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg transition-all">{editingGoal ? '更新夢想' : '建立夢想小卡'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Goals;
