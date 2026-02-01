// Type definitions for AI Assistant components
import type React from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}

export interface KPIItem {
  Title?: string;
  Value?: string;
  Subtitle?: string;
  Message?: string;
}

export interface ChartSeries {
  name?: string;
  data?: (number | string)[];
}

export interface ChartData {
  title?: {
    text?: string;
  };
  xAxis?: {
    categories?: string[];
  };
  series?: ChartSeries[];
}

export interface AssistantSections {
  insights?: string;
  kpi?: KPIItem[];
  kpiRaw?: string;
  kpi_summary?: string;
  system_health?: string;
  fault_trends?: string;
  charts?: ChartData;
  chartsRaw?: string;
  markdown_full?: string;
}

export interface StatCard {
  id: string;
  title: string;
  value: string;
  helper: string;
  meta: string;
  accentIcon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  tag: {
    label: string;
    color: "error" | "success" | "info" | "warning";
  } | null;
}

export interface ChartDataPoint {
  label: string;
  critical: number;
  minor: number;
}

export interface UseDifyChatReturn {
  messages: ChatMessage[];
  streamText: string;
  streaming: boolean;
  error: string | null;
  send: (query: string) => Promise<void>;
  conversationId: string | null | undefined;
  sections: AssistantSections | null;
}

export interface AssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages?: ChatMessage[];
  streamText?: string;
  streaming?: boolean;
  streamError?: string | null;
  sections?: AssistantSections | null;
  onSend?: (text: string) => void;
}

