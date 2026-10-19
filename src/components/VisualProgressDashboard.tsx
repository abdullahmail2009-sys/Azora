import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import {
  PieChart as PieIcon,
  BarChart2,
  Layers,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { isTopicCompleted } from '../utils/progressCalc.ts';

// AZORA Approved Palette
const AZORA_PALETTE = {
  mint: '#75D9B4',
  turquoise: '#42BDAE',
  skyBlue: '#69B7EC',
  lavender: '#B8A4EF',
  teal: '#1B4D48',
  cream: '#FBF7EF',
  cardBg: '#F5EFE2',
  border: '#E2DAC7',
  textDark: '#1B4D48',
  textMuted: '#4A6B66',
  rose: '#E11D48',
  amber: '#D97706',
};

const SUBJECT_COLORS: Record<string, string> = {
  physics: '#2574A9',
  chemistry: '#26877B',
  mathematics: '#6A55A6',
  english: '#D97706',
  hindi: '#E11D48',
};

interface UnitProgressData {
  unitId: string;
  unitNumber: number;
  unitTitle: string;
  subjectId: string;
  subjectName: string;
  totalTopics: number;
  completedTopics: number;
  completionPercentage: number;
  officialMarks: number;
  color: string;
}

interface SubjectProgressData {
  subjectId: string;
  subjectName: string;
  totalTopics: number;
  completedTopics: number;
  completionPercentage: number;
  totalMarks: number;
  completedMarks: number;
  color: string;
  unitsCount: number;
}

export const VisualProgressDashboard: React.FC<{
  onSelectSubjectFilter?: (subjectId: string) => void;
}> = ({ onSelectSubjectFilter }) => {
  const { activeSyllabus, masteryMap, preferences } = useApp();
  const allowAutoComplete = preferences.autoCompleteFromStages ?? false;

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'units' | 'subjects' | 'both'>('both');

  // Compute Subject-Level Progress Data
  const subjectsData: SubjectProgressData[] = useMemo(() => {
    return activeSyllabus.subjects.map((sub, index) => {
      let subTotalTopics = 0;
      let subCompletedTopics = 0;
      let subTotalMarks = 0;
      let subCompletedMarks = 0;

      sub.units.forEach((unit) => {
        if (unit.isArchived) return;
        subTotalMarks += unit.officialMarks || 0;

        unit.chapters.forEach((chap) => {
          if (chap.isArchived || chap.isExcluded) return;
          const activeTopics = chap.topics.filter((t) => !t.isArchived && !t.isExcluded);

          activeTopics.forEach((topic) => {
            subTotalTopics++;
            const m = masteryMap[topic.id];
            if (isTopicCompleted(m, allowAutoComplete)) {
              subCompletedTopics++;
            }
          });
        });
      });

      const pct = subTotalTopics > 0 ? Math.round((subCompletedTopics / subTotalTopics) * 100) : 0;
      subCompletedMarks = Math.round((pct / 100) * subTotalMarks);

      const color = sub.color || SUBJECT_COLORS[sub.id] || Object.values(SUBJECT_COLORS)[index % 5];

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        totalTopics: subTotalTopics,
        completedTopics: subCompletedTopics,
        completionPercentage: pct,
        totalMarks: subTotalMarks,
        completedMarks: subCompletedMarks,
        color,
        unitsCount: sub.units.filter((u) => !u.isArchived).length,
      };
    });
  }, [activeSyllabus, masteryMap, allowAutoComplete]);

  // Compute Unit-Level Progress Data
  const unitsData: UnitProgressData[] = useMemo(() => {
    const list: UnitProgressData[] = [];

    activeSyllabus.subjects.forEach((sub, subIdx) => {
      if (selectedSubjectId !== 'all' && sub.id !== selectedSubjectId) return;

      const subColor = sub.color || SUBJECT_COLORS[sub.id] || Object.values(SUBJECT_COLORS)[subIdx % 5];

      sub.units.forEach((unit) => {
        if (unit.isArchived) return;

        let unitTotalTopics = 0;
        let unitCompletedTopics = 0;

        unit.chapters.forEach((chap) => {
          if (chap.isArchived || chap.isExcluded) return;
          const activeTopics = chap.topics.filter((t) => !t.isArchived && !t.isExcluded);

          activeTopics.forEach((topic) => {
            unitTotalTopics++;
            const m = masteryMap[topic.id];
            if (isTopicCompleted(m, allowAutoComplete)) {
              unitCompletedTopics++;
            }
          });
        });

        const pct = unitTotalTopics > 0 ? Math.round((unitCompletedTopics / unitTotalTopics) * 100) : 0;

        list.push({
          unitId: unit.id,
          unitNumber: unit.number,
          unitTitle: unit.title || `Unit ${unit.number}`,
          subjectId: sub.id,
          subjectName: sub.name,
          totalTopics: unitTotalTopics,
          completedTopics: unitCompletedTopics,
          completionPercentage: pct,
          officialMarks: unit.officialMarks || 0,
          color: subColor,
        });
      });
    });

    return list;
  }, [activeSyllabus, masteryMap, allowAutoComplete, selectedSubjectId]);

  // Total Syllabus Totals
  const overallStats = useMemo(() => {
    const totalTopics = subjectsData.reduce((acc, s) => acc + s.totalTopics, 0);
    const completedTopics = subjectsData.reduce((acc, s) => acc + s.completedTopics, 0);
    const overallPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    return { totalTopics, completedTopics, overallPct };
  }, [subjectsData]);

  // Recharts Custom Tooltip Component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#1B4D48] text-[#FBF7EF] p-3 rounded-xl shadow-lg border border-[#75D9B4]/30 text-xs space-y-1 z-50">
          <p className="font-bold text-[#75D9B4]">{data.subjectName || data.unitTitle}</p>
          {data.unitTitle && <p className="text-slate-300 font-medium">{data.unitTitle}</p>}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-600/50">
            <span>Completion:</span>
            <span className="font-mono font-bold text-amber-300">{data.completionPercentage}%</span>
          </div>
          <p className="text-[11px] text-slate-300">
            {data.completedTopics} of {data.totalTopics} topics completed
          </p>
          {data.officialMarks > 0 && (
            <p className="text-[10px] text-[#69B7EC]">Official Marks Weightage: {data.officialMarks} M</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#26877B]" />
              <h2 className="text-lg font-bold text-[#1B4D48]">Visual Syllabus Progress Dashboard</h2>
            </div>
            <p className="text-xs text-[#4A6B66]">
              Real-time interactive chart analytics showing completion percentages per subject & unit
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#FBF7EF] p-1 rounded-xl border border-[#E5DEC9] text-xs">
              <button
                onClick={() => setViewMode('both')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  viewMode === 'both'
                    ? 'bg-[#1B4D48] text-[#FBF7EF] shadow-xs'
                    : 'text-[#4A6B66] hover:text-[#1B4D48]'
                }`}
              >
                All Views
              </button>
              <button
                onClick={() => setViewMode('subjects')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  viewMode === 'subjects'
                    ? 'bg-[#1B4D48] text-[#FBF7EF] shadow-xs'
                    : 'text-[#4A6B66] hover:text-[#1B4D48]'
                }`}
              >
                Subjects
              </button>
              <button
                onClick={() => setViewMode('units')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  viewMode === 'units'
                    ? 'bg-[#1B4D48] text-[#FBF7EF] shadow-xs'
                    : 'text-[#4A6B66] hover:text-[#1B4D48]'
                }`}
              >
                Units
              </button>
            </div>
          </div>
        </div>

        {/* Subject Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-[#E5DEC9]">
          <span className="text-xs font-semibold text-[#4A6B66] flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3 h-3 text-[#26877B]" /> Filter Unit Charts:
          </span>
          <button
            onClick={() => {
              setSelectedSubjectId('all');
              if (onSelectSubjectFilter) onSelectSubjectFilter('all');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedSubjectId === 'all'
                ? 'bg-[#1B4D48] text-[#FBF7EF]'
                : 'bg-[#FBF7EF] text-[#4A6B66] hover:bg-[#EAE2D0] border border-[#E5DEC9]'
            }`}
          >
            All Subjects ({subjectsData.length})
          </button>
          {subjectsData.map((sub) => (
            <button
              key={sub.subjectId}
              onClick={() => {
                setSelectedSubjectId(sub.subjectId);
                if (onSelectSubjectFilter) onSelectSubjectFilter(sub.subjectId);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                selectedSubjectId === sub.subjectId
                  ? 'bg-[#1B4D48] text-[#FBF7EF]'
                  : 'bg-[#FBF7EF] text-[#4A6B66] hover:bg-[#EAE2D0] border border-[#E5DEC9]'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: sub.color }}
              />
              {sub.subjectName} ({sub.completionPercentage}%)
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#75D9B4]/30 flex items-center justify-center text-[#1B4D48] shrink-0">
            <TrendingUp className="w-5 h-5 text-[#26877B]" />
          </div>
          <div>
            <div className="text-xs text-[#4A6B66]">Overall Syllabus Progress</div>
            <div className="text-xl font-bold text-[#1B4D48] font-mono tabular-nums">
              {overallStats.overallPct}% Completed
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#69B7EC]/20 flex items-center justify-center text-[#2574A9] shrink-0">
            <BookOpen className="w-5 h-5 text-[#2574A9]" />
          </div>
          <div>
            <div className="text-xs text-[#4A6B66]">Total Topics Completed</div>
            <div className="text-xl font-bold text-[#1B4D48] font-mono tabular-nums">
              {overallStats.completedTopics} / {overallStats.totalTopics} Topics
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#B8A4EF]/20 flex items-center justify-center text-[#6A55A6] shrink-0">
            <Layers className="w-5 h-5 text-[#6A55A6]" />
          </div>
          <div>
            <div className="text-xs text-[#4A6B66]">Active Units Displayed</div>
            <div className="text-xl font-bold text-[#1B4D48] font-mono tabular-nums">
              {unitsData.length} Units Analyzed
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Subject-Wise Completion Percentages */}
        {(viewMode === 'both' || viewMode === 'subjects') && (
          <div className="p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] space-y-4 flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1B4D48] flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#26877B]" />
                  Subject Completion Percentages
                </h3>
                <p className="text-xs text-[#4A6B66]">Overall syllabus topic coverage per subject</p>
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full min-w-0 pt-2">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                <BarChart
                  data={subjectsData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2DAC7" vertical={false} />
                  <XAxis
                    dataKey="subjectName"
                    tick={{ fill: '#1B4D48', fontSize: 11, fontWeight: 600 }}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#4A6B66', fontSize: 11 }}
                    unit="%"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="completionPercentage"
                    name="Completion %"
                    radius={[8, 8, 0, 0]}
                    barSize={32}
                  >
                    {subjectsData.map((entry) => (
                      <Cell key={entry.subjectId} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Subject Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#E2DAC7]">
              {subjectsData.map((sub) => (
                <div
                  key={sub.subjectId}
                  className="p-2.5 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: sub.color }}
                    />
                    <span className="font-bold text-[#1B4D48]">{sub.subjectName}</span>
                  </div>
                  <div className="font-mono font-bold text-[#26877B]">
                    {sub.completionPercentage}% ({sub.completedTopics}/{sub.totalTopics})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart 2: Unit-Wise Completion Percentages */}
        {(viewMode === 'both' || viewMode === 'units') && (
          <div className="p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] space-y-4 flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1B4D48] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#6A55A6]" />
                  Unit Completion Breakdown
                </h3>
                <p className="text-xs text-[#4A6B66]">
                  {selectedSubjectId === 'all'
                    ? 'Showing all units across subjects'
                    : `Filtered to units in ${subjectsData.find((s) => s.subjectId === selectedSubjectId)?.subjectName}`}
                </p>
              </div>
            </div>

            {unitsData.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#FBF7EF] text-center text-xs text-[#4A6B66]">
                No units found for selected subject.
              </div>
            ) : (
              <div className="h-64 sm:h-72 w-full min-w-0 pt-2">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                  <BarChart
                    data={unitsData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 45 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2DAC7" vertical={false} />
                    <XAxis
                      dataKey="unitTitle"
                      tick={{ fill: '#1B4D48', fontSize: 10, fontWeight: 500 }}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#4A6B66', fontSize: 11 }}
                      unit="%"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="completionPercentage"
                      name="Unit Completion %"
                      radius={[6, 6, 0, 0]}
                      barSize={24}
                    >
                      {unitsData.map((entry) => (
                        <Cell key={entry.unitId} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top / Bottom Performing Units List */}
            <div className="pt-2 border-t border-[#E2DAC7] space-y-2">
              <div className="text-xs font-bold text-[#1B4D48] flex items-center justify-between">
                <span>Detailed Unit List ({unitsData.length})</span>
                <span className="text-[11px] text-[#4A6B66]">Sorted by Unit Order</span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {unitsData.map((unit) => (
                  <div
                    key={unit.unitId}
                    className="p-2.5 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: unit.color }}
                      />
                      <div className="truncate">
                        <span className="font-bold text-[#1B4D48]">
                          [{unit.subjectName}] Unit {unit.unitNumber}:
                        </span>{' '}
                        <span className="text-[#4A6B66]">{unit.unitTitle}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-20 sm:w-28 h-2 bg-[#EAE2D0] rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${unit.completionPercentage}%`,
                            backgroundColor: unit.color,
                          }}
                        />
                      </div>
                      <span className="font-mono font-bold text-[#26877B] w-12 text-right">
                        {unit.completionPercentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
