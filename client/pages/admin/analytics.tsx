import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import { User } from '@shared/types';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Dot
} from 'recharts';
import styles from '@/styles/Analytics.module.css';

interface AnalyticsData {
  dailyUploads: Array<{ date: string; count: number }>;
  averageProcessingTime: Array<{ date: string; avgTime: number }>;
  errorRate: Array<{ date: string; errorRate: number }>;
  ocrAccuracy: Array<{ date: string; avgAccuracy: number }>;
  ocrAccuracyByType: Array<{ type: string; avgAccuracy: number; count: number }>;
  fileTypeDistribution: Array<{ type: string; count: number }>;
  successRate: Array<{ date: string; successRate: number }>;
  dailyFileTypeDistribution?: Array<{ type: string; count: number }>;
  totalStats: {
    totalDocuments: number;
    totalProcessed: number;
    totalFailed: number;
    averageProcessingTime: number;
    averageAccuracy: number;
  };
}

// Custom color scheme
const CHART_COLORS = {
  chart1: '#201649',
  chart2: '#4f5e8a',
  chart3: '#6779a5',
  chart4: '#90a9ba',
  chart5: '#b4cbd0',
  chart6: '#f0f5f6',
};

const COLORS = [
  CHART_COLORS.chart1,
  CHART_COLORS.chart2,
  CHART_COLORS.chart3,
  CHART_COLORS.chart4,
  CHART_COLORS.chart5,
  CHART_COLORS.chart6
];

export default function AnalyticsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState('30');
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyFileTypeData, setDailyFileTypeData] = useState<Array<{ type: string; count: number }>>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch('/api/profile', { credentials: 'include' });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
        }

        const analyticsRes = await fetch(`/api/admin/analytics?days=${timeRange}&date=${selectedDate}`, {
          credentials: 'include'
        });
        const analyticsResult = await analyticsRes.json();
        
        if (analyticsResult.success && analyticsResult.data) {
          setAnalyticsData(analyticsResult.data);
          if (analyticsResult.data.dailyFileTypeDistribution) {
            setDailyFileTypeData(analyticsResult.data.dailyFileTypeDistribution);
          } else {
            setDailyFileTypeData([]);
          }
        } else {
          setNotification({
            type: 'error',
            title: 'Failed to Load Analytics',
            message: analyticsResult.error || 'Failed to load analytics'
          });
        }
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load analytics data'
        });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [timeRange, selectedDate]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setNotification({
        type: 'info',
        title: 'Exporting Report',
        message: `Generating ${format.toUpperCase()} report...`
      });

      const response = await fetch(`/api/admin/analytics/export?days=${timeRange}&format=${format}`, {
        credentials: 'include',
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setNotification({
        type: 'success',
        title: 'Export Successful',
        message: `Report exported successfully as ${format.toUpperCase()}`
      });
    } catch (error: any) {
      console.error('Export error:', error);
      setNotification({
        type: 'error',
        title: 'Export Failed',
        message: error.message || 'Failed to export report'
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateLong = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Reusable tooltip content component matching the example format
  const renderTooltipContent = (label: string | number | undefined, payload: any[], formatter?: (value: any) => string) => {
    if (!payload || payload.length === 0) return null;
    
    return (
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        {label && (
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
            {formatDateLong(String(label))}
          </p>
        )}
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ margin: label ? '4px 0 0 0' : '0', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
            {formatter ? formatter(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  };

  const formatDateMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long' });
  };

  const formatDateDay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Transform error rate data for radar chart
  const radarErrorRateData = React.useMemo(() => {
    if (!analyticsData?.errorRate) return [];
    return analyticsData.errorRate.map(item => ({
      month: formatDateMonth(item.date),
      errorRate: item.errorRate
    }));
  }, [analyticsData?.errorRate]);

  // Transform daily uploads data for radar chart (last 6 days)
  const radarDailyUploadsData = React.useMemo(() => {
    if (!analyticsData?.dailyUploads) return [];
    const last6Days = analyticsData.dailyUploads.slice(-6);
    return last6Days.map(item => ({
      day: formatDateDay(item.date),
      uploads: item.count
    }));
  }, [analyticsData?.dailyUploads]);

  // Transform OCR accuracy data with colors for each dot (excluding #f0f5f6)
  const ocrAccuracyWithColors = React.useMemo(() => {
    if (!analyticsData?.ocrAccuracy) return [];
    const colorsWithoutLightest = COLORS.slice(0, 5); // Exclude #f0f5f6 (last color)
    return analyticsData.ocrAccuracy.map((item, index) => ({
      ...item,
      fill: colorsWithoutLightest[index % colorsWithoutLightest.length]
    }));
  }, [analyticsData?.ocrAccuracy]);

  // Prepare pie chart data with colors
  const pieChartData = React.useMemo(() => {
    if (dailyFileTypeData.length === 0) return [];
    return dailyFileTypeData.map((item, index) => ({
      type: item.type,
      count: item.count,
      fill: COLORS[index % COLORS.length]
    }));
  }, [dailyFileTypeData]);

  // Calculate total documents for selected date
  const totalDailyUploads = React.useMemo(() => {
    return pieChartData.reduce((acc, curr) => acc + curr.count, 0);
  }, [pieChartData]);

  if (loading) {
    return (
      <Layout user={user} loading={true} loadingText="Loading Analytics">
        <div className={styles.container}>Loading...</div>
      </Layout>
    );
  }

  if (!analyticsData) {
    return (
      <Layout user={user} loading={false}>
        <div className={styles.container}>
          {notification ? (
            <NotificationCard
              type={notification.type}
              title={notification.title}
              message={notification.message}
              primaryButtonText="OK"
              onPrimaryClick={() => setNotification(null)}
              onClose={() => setNotification(null)}
            />
          ) : (
            <div className={styles.error}>No analytics data available</div>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} loading={false}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Analytics Dashboard</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className={styles.timeRangeSelect}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <button
              onClick={() => handleExport('csv')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4f5e8a',
                color: 'white',
                border: 'none',
                borderRadius: '50px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExport('pdf')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#201649',
                color: 'white',
                border: 'none',
                borderRadius: '50px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Export PDF
            </button>
          </div>
        </div>

        {/* Total Stats Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Documents</div>
            <div className={styles.statValue}>{analyticsData.totalStats.totalDocuments}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Processed</div>
            <div className={styles.statValue}>{analyticsData.totalStats.totalProcessed}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Failed</div>
            <div className={styles.statValue}>{analyticsData.totalStats.totalFailed}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Avg Processing Time</div>
            <div className={styles.statValue}>
              {formatTime(analyticsData.totalStats.averageProcessingTime)}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Avg OCR Accuracy</div>
            <div className={styles.statValue}>
              {analyticsData.totalStats.averageAccuracy.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className={styles.chartsGrid}>
          {/* Average Processing Time - Line Chart */}
          <div className={`${styles.chartCard} ${styles.chartCardFullWidth}`}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>Average Processing Time</h2>
              <p className={styles.chartDescription}>Processing time trends over time</p>
            </div>
            <div className={styles.chartContent}>
              <div style={{ width: '100%', height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    accessibilityLayer
                    data={analyticsData.averageProcessingTime}
                    margin={{
                      left: 12,
                      right: 12,
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={formatDate}
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={(value) => formatTime(value)}
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      cursor={false}
                      content={({ active, payload, label }: any) => {
                        if (active) {
                          return renderTooltipContent(label, payload, (value) => formatTime(value as number));
                        }
                        return null;
                      }}
                    />
                    <Line
                      dataKey="avgTime"
                      type="natural"
                      stroke={CHART_COLORS.chart2}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Daily File Type Distribution - Donut Pie Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className={styles.chartTitle}>Daily Upload by File Type</h2>
                <p className={styles.chartDescription}>File type distribution for selected date</p>
              </div>
              <div className={styles.datePickerWrapper}>
                <label className={styles.dateLabel}></label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={styles.dateInput}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div className={styles.chartContent} style={{ paddingBottom: 0 }}>
              {pieChartData.length > 0 ? (
                <div style={{ width: '100%', margin: '0 auto', aspectRatio: '1', maxHeight: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        cursor={false}
                        content={({ active, payload }: any) => {
                          if (active) {
                            return renderTooltipContent(undefined, payload, (value) => `${value} uploads`);
                          }
                          return null;
                        }}
                      />
                      <Pie
                        data={pieChartData}
                        dataKey="count"
                        nameKey="type"
                        innerRadius={60}
                        strokeWidth={5}
                      >
                        {pieChartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                              return (
                                <text
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                >
                                  <tspan
                                    x={viewBox.cx}
                                    y={viewBox.cy}
                                    style={{
                                      fill: '#111827',
                                      fontSize: '24px',
                                      fontWeight: 700
                                    }}
                                  >
                                    {totalDailyUploads.toLocaleString()}
                                  </tspan>
                                  <tspan
                                    x={viewBox.cx}
                                    y={(viewBox.cy || 0) + 24}
                                    style={{
                                      fill: '#6b7280',
                                      fontSize: '14px'
                                    }}
                                  >
                                    Documents
                                  </tspan>
                                </text>
                              );
                            }
                            return null;
                          }}
                        />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className={styles.noDataMessage}>
                  No data available for the selected date
                </div>
              )}
            </div>
          </div>

          {/* Daily Uploads - Radar Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>Daily Uploads</h2>
              <p className={styles.chartDescription}>Showing total uploads for the selected period (last 6 days)</p>
            </div>
            <div className={styles.chartContent}>
              {radarDailyUploadsData.length > 0 ? (
                <div style={{ width: '100%', margin: '0 auto', aspectRatio: '1', maxHeight: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarDailyUploadsData}>
                      <Tooltip
                        cursor={false}
                        content={({ active, payload }: any) => {
                          if (active) {
                            return renderTooltipContent(undefined, payload, (value) => `${value} uploads`);
                          }
                          return null;
                        }}
                      />
                      <PolarGrid style={{ fill: CHART_COLORS.chart1, opacity: 0.2 }} />
                      <PolarAngleAxis dataKey="day" />
                      <Radar
                        dataKey="uploads"
                        fill={CHART_COLORS.chart1}
                        fillOpacity={0.5}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className={styles.noDataMessage}>
                  No upload data available
                </div>
              )}
            </div>
          </div>

          {/* Error Rate - Bar Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>Error Rate (%)</h2>
              <p className={styles.chartDescription}>Percentage of failed document processing</p>
            </div>
            <div className={styles.chartContent}>
              <div style={{ width: '100%', height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart accessibilityLayer data={analyticsData.errorRate}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                      tickFormatter={formatDate}
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={10} style={{ fontSize: '12px' }} />
                    <Tooltip
                      cursor={false}
                      content={({ active, payload, label }: any) => {
                        if (active) {
                          return renderTooltipContent(label, payload, (value) => `${value}%`);
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="errorRate" fill={CHART_COLORS.chart3} radius={5} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          

          {/* Success Rate - Area Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>Success Rate (%)</h2>
              <p className={styles.chartDescription}>Percentage of successfully processed documents</p>
            </div>
            <div className={styles.chartContent}>
              <div style={{ width: '100%', height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.successRate}>
                    <defs>
                      <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.chart2} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={CHART_COLORS.chart2} stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      tickFormatter={formatDate}
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      cursor={false}
                      content={({ active, payload, label }: any) => {
                        if (active) {
                          return renderTooltipContent(label, payload, (value) => `${value}%`);
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="natural"
                      dataKey="successRate"
                      fill="url(#fillMobile)"
                      stroke={CHART_COLORS.chart2}
                      stackId="a"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          

          {/* File Type Distribution - Pie Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>File Type Distribution</h2>
              <p className={styles.chartDescription}>Distribution of uploaded file types</p>
            </div>
            <div className={styles.chartContent}>
              <div style={{ width: '100%', margin: '0 auto', aspectRatio: '1', maxHeight: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      cursor={false}
                      content={({ active, payload }: any) => {
                        if (active) {
                          return renderTooltipContent(undefined, payload);
                        }
                        return null;
                      }}
                    />
                    <Pie
                      data={analyticsData.fileTypeDistribution}
                      dataKey="count"
                      nameKey="type"
                      innerRadius={60}
                      strokeWidth={5}
                    >
                      {analyticsData.fileTypeDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          

          {/* OCR Accuracy - Line Chart */}
          <div className={`${styles.chartCard} ${styles.chartCardFullWidth}`}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>OCR Accuracy (%)</h2>
              <p className={styles.chartDescription}>Average OCR accuracy over time</p>
            </div>
            <div className={styles.chartContent}>
              <div style={{ width: '100%', height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    accessibilityLayer
                    data={ocrAccuracyWithColors}
                    margin={{ top: 24, left: 24, right: 24 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={formatDate}
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      domain={[0, 100]}
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      cursor={false}
                      content={({ active, payload, label }: any) => {
                        if (active) {
                          return renderTooltipContent(label, payload, (value) => `${(value as number).toFixed(2)}%`);
                        }
                        return null;
                      }}
                    />
                    <Line
                      dataKey="avgAccuracy"
                      type="natural"
                      stroke={CHART_COLORS.chart4}
                      strokeWidth={1}
                      strokeOpacity={0.7}
                      dot={({ payload, ...props }) => {
                        return (
                          <Dot
                            key={`dot-${props.cx}-${props.cy}`}
                            r={5}
                            cx={props.cx}
                            cy={props.cy}
                            fill={payload.fill || CHART_COLORS.chart4}
                            stroke={payload.fill || CHART_COLORS.chart4}
                          />
                        );
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* OCR Accuracy by Document Type - Bar Chart */}
          <div className={`${styles.chartCard} ${styles.chartCardFullWidth}`}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>OCR Accuracy by Document Type</h2>
              <p className={styles.chartDescription}>Average OCR accuracy categorized by different document types</p>
            </div>
            <div className={styles.chartContent}>
              {analyticsData.ocrAccuracyByType && analyticsData.ocrAccuracyByType.length > 0 ? (
                <div style={{ width: '100%', height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      accessibilityLayer
                      data={analyticsData.ocrAccuracyByType}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        tickFormatter={(value) => `${value}%`}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="type"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip
                        cursor={false}
                        content={({ active, payload }: any) => {
                          if (active && payload && payload[0]) {
                            const data = payload[0].payload;
                            return (
                              <div style={{
                                backgroundColor: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                              }}>
                                <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                                  {data.type}
                                </p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                                  Accuracy: {data.avgAccuracy.toFixed(2)}%
                                </p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                                  Documents: {data.count}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="avgAccuracy"
                        fill={CHART_COLORS.chart2}
                        radius={[0, 5, 5, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className={styles.noDataMessage}>
                  No accuracy data by document type available
                </div>
              )}
            </div>
          </div>

        </div>

        {notification && (
          <NotificationCard
            type={notification.type}
            title={notification.title}
            message={notification.message}
            primaryButtonText="OK"
            onPrimaryClick={() => setNotification(null)}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </Layout>
  );
}
