import React, { useMemo, useEffect, useState } from "react";
import {
    DocumentTextIcon,
    ClockIcon,
    CheckCircleIcon,
    LightBulbIcon,
} from "@heroicons/react/24/outline";
import { RiRobot2Line } from "react-icons/ri";
import { SetNav } from "@uicomponents/shared";
import { Card, Tag } from "@uicomponents/ui";
import Layout from "@/components/Layout";
import { useDifyChat } from "./useDifyChat";
import { MemoizedMarkdown } from "@uicomponents/chat/memoized-markdown";
import type { AssistantSections, ChartData, ChartDataPoint, StatCard } from "./types";
import { User } from "@shared/types";

interface DocumentStats {
    totalDocuments: number;
    completedDocuments: number;
    processingDocuments: number;
    successRate: number;
}

const defaultStatCards: StatCard[] = [
    {
        id: "total",
        title: "Total Documents",
        value: "0",
        helper: "All uploaded documents",
        meta: "Start uploading to see your documents",
        accentIcon: DocumentTextIcon,
        accentClass: "bg-blue-50 text-blue-500",
        tag: null,
    },
    {
        id: "processing",
        title: "Processing",
        value: "0",
        helper: "Documents being extracted",
        meta: "OCR and data extraction in progress",
        accentIcon: ClockIcon,
        accentClass: "bg-amber-50 text-amber-500",
        tag: null,
    },
    {
        id: "completed",
        title: "Success Rate",
        value: "0%",
        helper: "Successfully processed",
        meta: "Documents ready for analysis",
        accentIcon: CheckCircleIcon,
        accentClass: "bg-emerald-50 text-emerald-500",
        tag: { label: "Active", color: "success" },
    },
];

const chartData: ChartDataPoint[] = [
    { label: "Mon", critical: 0, minor: 0 },
    { label: "Tue", critical: 0, minor: 0 },
    { label: "Wed", critical: 0, minor: 0 },
    { label: "Thu", critical: 0, minor: 0 },
    { label: "Fri", critical: 0, minor: 0 },
    { label: "Sat", critical: 0, minor: 0 },
    { label: "Sun", critical: 0, minor: 0 },
];

interface StatusCardProps {
    title: string;
    value: string;
    helper: string;
    meta: string;
    tag: StatCard["tag"];
    accentIcon: React.ComponentType<{ className?: string }>;
    accentClass: string;
}

function StatusCard({
    title,
    value,
    helper,
    meta,
    tag,
    accentIcon: Icon,
    accentClass,
}: StatusCardProps): React.JSX.Element {
    return (
        <Card skin="shadow" className="h-full p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                    <span
                        className={`flex size-11 items-center justify-center rounded-full ${accentClass}`}
                    >
                        <Icon className="size-5" />
                    </span>
                    <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-gray-800 dark:text-dark-50">
                            {title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-dark-200">{helper}</p>
                    </div>
                </div>
                {tag ? (
                    <Tag
                        color={tag.color}
                        variant="soft"
                        className="rounded-full px-2.5 py-1 text-xs font-semibold"
                    >
                        {tag.label}
                    </Tag>
                ) : null}
            </div>
            <div className="mt-4 flex flex-col gap-1">
                <p className="text-3xl font-semibold leading-none text-gray-900 dark:text-dark-50">
                    {value}
                </p>
                <p className="text-sm text-gray-500 dark:text-dark-200">{meta}</p>
            </div>
        </Card>
    );
}

interface LegendProps {
    colorClass: string;
    label: string;
}

function Legend({ colorClass, label }: LegendProps): React.JSX.Element {
    return (
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-dark-200">
            <span className={`size-2.5 rounded-full ${colorClass}`} />
            {label}
        </div>
    );
}

interface MiniStackedBarChartProps {
    data: ChartDataPoint[];
}

function MiniStackedBarChart({ data }: MiniStackedBarChartProps): React.JSX.Element {
    const maxValue = useMemo(
        () => Math.max(...data.map((item) => item.critical + item.minor)),
        [data],
    );

    return (
        <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-dark-200">
                <p>Document Processing Activity</p>
                <div className="flex items-center gap-4">
                    <Legend colorClass="bg-emerald-400" label="Completed" />
                    <Legend colorClass="bg-amber-300" label="Processing" />
                </div>
            </div>
            <div className="flex items-end gap-3 sm:gap-4">
                {data.map((item) => {
                    // critical = completed, minor = processing
                    const completedHeight = Math.round(
                        (item.critical / maxValue) * 100,
                    );
                    const processingHeight = Math.round((item.minor / maxValue) * 100);

                    return (
                        <div
                            key={item.label}
                            className="flex flex-1 flex-col items-center gap-2"
                        >
                            <div className="flex h-48 w-full max-w-[54px] flex-col justify-end overflow-hidden rounded-md bg-gray-100 dark:bg-dark-600">
                                <div
                                    style={{ height: `${processingHeight}%` }}
                                    className="rounded-t-md bg-amber-300"
                                />
                                <div
                                    style={{ height: `${completedHeight}%` }}
                                    className="rounded-b-md bg-emerald-400"
                                />
                            </div>
                            <span className="text-xs font-medium text-gray-500 dark:text-dark-200">
                                {item.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface ChartListProps {
    chart: ChartData;
}

function ChartList({ chart }: ChartListProps): React.JSX.Element {
    if (
        !chart ||
        !Array.isArray(chart.xAxis?.categories) ||
        !Array.isArray(chart.series) ||
        chart.series.length === 0
    ) {
        return (
            <p className="text-xs text-gray-600 dark:text-dark-200">
                Chart data not available.
            </p>
        );
    }

    const firstSeries = chart.series[0];
    const dataPoints = Array.isArray(firstSeries.data) ? firstSeries.data : [];
    const maxValue = Math.max(...dataPoints.map((v) => Number(v) || 0), 1);

    return (
        <div className="space-y-3">
            {chart.title?.text ? (
                <p className="text-sm font-semibold text-gray-800 dark:text-dark-50">
                    {chart.title.text}
                </p>
            ) : null}
            <div className="space-y-2">
                {chart.xAxis.categories.map((label, idx) => {
                    const value = Number(dataPoints[idx]) || 0;
                    const widthPercent = Math.min(
                        100,
                        Math.round((value / maxValue) * 100),
                    );
                    return (
                        <div
                            key={`${label}-${idx}`}
                            className="rounded-lg border border-gray-100 bg-gray-50 p-2 dark:border-dark-600 dark:bg-dark-700"
                        >
                            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-700 dark:text-dark-50">
                                <span className="line-clamp-1">{label}</span>
                                <span>{value}</span>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-dark-500">
                                <div
                                    className="h-full rounded-full bg-primary-500"
                                    style={{ width: `${widthPercent}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function HomePage(): React.JSX.Element {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [documentStats, setDocumentStats] = useState<DocumentStats>({
        totalDocuments: 0,
        completedDocuments: 0,
        processingDocuments: 0,
        successRate: 0,
    });
    const {
        sections,
    } = useDifyChat();

    useEffect(() => {
        async function fetchUser() {
            try {
                const res = await fetch('/api/profile', { credentials: 'include' });
                const data = await res.json();
                if (data.user) {
                    setUser(data.user);
                }
            } catch (err) {
                console.error('Error fetching user:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchUser();
    }, []);

    useEffect(() => {
        async function fetchDocumentStats() {
            try {
                const res = await fetch('/api/documents/user-documents?page=1', { credentials: 'include' });
                const data = await res.json();
                if (data.documents) {
                    const total = data.totalDocuments || 0;
                    const completed = data.documents.filter((doc: any) => doc.status === 'completed').length;
                    const processing = data.documents.filter((doc: any) => doc.status === 'processing').length;
                    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
                    
                    setDocumentStats({
                        totalDocuments: total,
                        completedDocuments: completed,
                        processingDocuments: processing,
                        successRate,
                    });
                }
            } catch (err) {
                console.error('Error fetching document stats:', err);
            }
        }
        if (user) {
            fetchDocumentStats();
        }
    }, [user]);

    const statCards = useMemo<StatCard[]>(() => {
        // Use AI-provided KPIs if available
        if (Array.isArray(sections?.kpi) && sections.kpi.length) {
            return sections.kpi.map((item, idx) => ({
                id: item.Title ?? `kpi-${idx}`,
                title: item.Title ?? "KPI",
                value: item.Value ?? "",
                helper: item.Subtitle ?? "",
                meta: item.Message ?? "",
                accentIcon: LightBulbIcon,
                accentClass: "bg-primary-50 text-primary-500",
                tag: null,
            }));
        }

        // Use real document statistics
        return defaultStatCards.map((card) => {
            if (card.id === "total") {
                return {
                    ...card,
                    value: documentStats.totalDocuments.toString(),
                    meta: documentStats.totalDocuments > 0 
                        ? `${documentStats.completedDocuments} completed, ${documentStats.processingDocuments} processing`
                        : "Start uploading to see your documents",
                };
            }

            if (card.id === "processing") {
                return {
                    ...card,
                    value: documentStats.processingDocuments.toString(),
                    meta: documentStats.processingDocuments > 0
                        ? "OCR and data extraction in progress"
                        : "No documents currently processing",
                };
            }

            if (card.id === "completed") {
                return {
                    ...card,
                    value: `${documentStats.successRate}%`,
                    meta: documentStats.totalDocuments > 0
                        ? `${documentStats.completedDocuments} of ${documentStats.totalDocuments} documents processed`
                        : "Documents ready for analysis",
                };
            }

            return card;
        });
    }, [sections, documentStats]);

    const activeSections: AssistantSections | null = sections || null;

    return (
        <Layout user={user} loading={loading} loadingText="Loading">
            <div className="w-full space-y-4 p-3 sm:p-4 lg:p-6 h-full">
                <SetNav className="mb-2" />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {statCards.map((card) => (
                        <StatusCard key={card.id} {...card} />
                    ))}
                </div>

                <div className="grid gap-4 grid-cols-[2fr_2fr] h-[560px]">
                    <Card skin="shadow" className="p-4 sm:p-5 h-full overflow-hidden">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-dark-50">
                            <DocumentTextIcon className="size-5 text-blue-500" />
                            <span>Processing Activity</span>
                        </div>
                        <div className="h-[430px] overflow-auto pr-1">
                            {activeSections?.charts ? (
                                <ChartList chart={activeSections.charts} />
                            ) : (
                                <MiniStackedBarChart data={chartData} />
                            )}
                        </div>
                    </Card>

                    <div className="relative h-full">
                        <Card
                            skin="shadow"
                            className="h-full p-4 sm:p-5 overflow-hidden"
                        >
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-dark-50">
                                <LightBulbIcon className="size-5 text-amber-500" />
                                <span>AI Document Insights</span>
                            </div>

                            <div className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600 dark:text-dark-100 h-[430px] overflow-auto pr-1">
                                {activeSections?.insights ? (
                                    <MemoizedMarkdown
                                        id="assistant-structured-insights"
                                        content={activeSections.insights}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-dark-300">
                                        <RiRobot2Line className="size-12 mb-4 text-gray-400 dark:text-dark-400" />
                                        <p className="text-sm mb-2">No insights yet.</p>
                                        <p className="text-xs">Use the chat button to ask questions about your documents and get AI-powered extraction insights.</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

