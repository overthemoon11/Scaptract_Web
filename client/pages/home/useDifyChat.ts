import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantSections, ChatMessage, UseDifyChatReturn } from "./types";

interface DifyEvent {
  event?: string;
  conversation_id?: string;
  answer?: string;
  message?: string;
  data?: {
    outputs?: { 
      answer?: string;
    };
    answer?: string;
  };
}

// Use server API endpoint instead of direct Dify API
const API_BASE = "/api/aiassistant";

export function useDifyChat(): UseDifyChatReturn {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamText, setStreamText] = useState<string>("");
  const [streaming, setStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<AssistantSections | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const assistantBufferRef = useRef<string>("");

  const safeParseJson = useCallback((value: string | null | undefined): unknown => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }, []);

  const splitAssistantContent = useCallback(
    (raw: string | null | undefined): { text: string; sections: AssistantSections | null } => {
      if (typeof raw !== "string") {
        return { text: "", sections: null };
      }
      // Normalize non-breaking spaces and line endings to make marker detection resilient
      const normalizedRaw = raw.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n");
      const cleaned = normalizedRaw.trim();
      if (!cleaned) return { text: "", sections: null };

      interface ExtractResult {
        segment: string | null;
        remainder: string;
      }

      const extractSegment = (source: string, startPattern: string, endPattern: string): ExtractResult => {
        const startRegex = new RegExp(startPattern, "i");
        const endRegex = new RegExp(endPattern, "i");

        const startMatch = source.match(startRegex);
        if (!startMatch || startMatch.index === undefined) {
          return { segment: null, remainder: source };
        }
        const startIndex = startMatch.index;
        const afterStart = startIndex + startMatch[0].length;
        const rest = source.slice(afterStart);

        const endMatch = rest.match(endRegex);
        if (!endMatch || endMatch.index === undefined) {
          return { segment: null, remainder: source };
        }

        const segment = rest.slice(0, endMatch.index).trim();
        const remainder =
          source.slice(0, startIndex).trimEnd() +
          "\n" +
          rest.slice(endMatch.index + endMatch[0].length).trimStart();

        return { segment, remainder: remainder.trim() };
      };

      let working = cleaned;
      const template: Partial<AssistantSections> & { kpiRaw?: string; chartsRaw?: string } = {};

      const insightsExtract = extractSegment(
        working,
        "###\\s*Start\\s+Of\\s+Insights###",
        "###\\s*End\\s+Of\\s+Insights###",
      );
      if (insightsExtract.segment) {
        template.insights = insightsExtract.segment;
        working = insightsExtract.remainder;
      }

      const normalizeJsonishValues = (source: string): string =>
        source.replace(/"Value"\s*:\s*([^",\]\}\s][^,\]\}]*)/gi, '"Value": "$1"');

      const kpiExtract = extractSegment(
        working,
        "###\\s*Start\\s+OF\\s+KPI###",
        "###\\s*End\\s+OF\\s+KPI###",
      );
      if (kpiExtract.segment) {
        template.kpiRaw = kpiExtract.segment;
        working = kpiExtract.remainder;
        let parsedKpi = safeParseJson(kpiExtract.segment);
        if (!parsedKpi) {
          parsedKpi = safeParseJson(normalizeJsonishValues(kpiExtract.segment));
        }
        if (parsedKpi && Array.isArray(parsedKpi)) {
          template.kpi = parsedKpi as AssistantSections["kpi"];
        }
      }

      const chartsExtract = extractSegment(
        working,
        "###\\s*Start\\s+OF\\s+CHARTS###",
        "###\\s*End\\s+OF\\s+CHARTS###",
      );
      if (chartsExtract.segment) {
        template.chartsRaw = chartsExtract.segment;
        working = chartsExtract.remainder;
        const parsedCharts = safeParseJson(chartsExtract.segment);
        if (parsedCharts && typeof parsedCharts === "object") {
          template.charts = parsedCharts as AssistantSections["charts"];
        }
      }

      const parsedWhole = safeParseJson(cleaned);
      let sections: AssistantSections | null = null;
      let text = "";

      if (parsedWhole && typeof parsedWhole === "object") {
        const parsedObj = parsedWhole as Record<string, unknown>;
        const markdown = parsedObj?.markdown_full;
        text = typeof markdown === "string" ? markdown : "";
        sections = parsedWhole as AssistantSections;
      } else {
        const jsonStart = cleaned.lastIndexOf("{");
        if (jsonStart !== -1) {
          const candidate = cleaned.slice(jsonStart);
          const parsedTail = safeParseJson(candidate);

          if (parsedTail && typeof parsedTail === "object") {
            text = cleaned.slice(0, jsonStart).trimEnd();
            sections = parsedTail as AssistantSections;
          }
        }
      }

      if (template.insights) {
        text = text || template.insights;
      } else if (!text) {
        text = working;
      }

      if (template.insights || template.kpi || template.kpiRaw || template.charts || template.chartsRaw) {
        sections = sections || {};
        if (template.insights) sections.insights = template.insights;
        if (template.kpi) sections.kpi = template.kpi;
        else if (template.kpiRaw) sections.kpiRaw = template.kpiRaw;
        if (template.charts) sections.charts = template.charts;
        else if (template.chartsRaw) sections.chartsRaw = template.chartsRaw;

        // Debug logging to verify extraction
        // eslint-disable-next-line no-console
        console.log("[useDifyChat] Extracted template sections", {
          raw: cleaned,
          insights: Boolean(template.insights),
          kpi: template.kpi ? template.kpi.length : 0,
          hasKpiRaw: Boolean(template.kpiRaw),
          chartsKeys: template.charts ? Object.keys(template.charts) : [],
          hasChartsRaw: Boolean(template.chartsRaw),
        });
      }

      return { text, sections };
    },
    [safeParseJson],
  );

  const cleanupStream = useCallback((skipReset = false): void => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (!skipReset) {
      setStreaming(false);
      setStreamText("");
      assistantBufferRef.current = "";
    }
  }, []);

  const send = useCallback(
    async (query: string): Promise<void> => {
      const trimmed = query?.trim();
      if (!trimmed) return;

      // Abort any in-flight stream before starting a new one
      cleanupStream();

      setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
      setError(null);
      setStreamText("");
      setSections(null);
      assistantBufferRef.current = "";

      interface RequestBody {
        query: string;
        conversation_id?: string;
      }

      const body: RequestBody = {
        query: trimmed,
      };

      if (conversationId) {
        body.conversation_id = conversationId;
      }

      let taskId: string | null = null;
      const controller = new AbortController();
      const processEvent = (raw: string): void => {
        const lines = raw.split(/\r?\n/);
        const dataLines = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace(/^data:\s?/, "").trim());

        for (const dl of dataLines) {
          if (!dl) continue;

          const jsonCandidate = dl.startsWith("{")
            ? dl
            : dl.replace(/^data:\s*/, "");

          if (!jsonCandidate.trim().startsWith("{")) {
            continue;
          }

          let evt: DifyEvent;
          try {
            evt = JSON.parse(jsonCandidate) as DifyEvent;
          } catch (err) {
            // Ignore non-JSON SSE frames (workflow events, heartbeats, etc.)
            // eslint-disable-next-line no-console
            console.warn("Skipping non-JSON SSE event:", dl);
            continue;
          }

          const type = evt.event;

          if (
            (type === "message" ||
              type === "message_end" ||
              type === "message_completed") &&
            evt.conversation_id
          ) {
            setConversationId(evt.conversation_id);
          }

          switch (type) {
            case "message": {
              if (evt.answer) {
                assistantBufferRef.current += evt.answer;
                setStreamText(assistantBufferRef.current);
              }
              break;
            }

            case "message_end":
            case "message_completed": {
              if (evt.answer && typeof evt.answer === "string") {
                assistantBufferRef.current += evt.answer;
              }

              const { text, sections: parsed } =
                splitAssistantContent(assistantBufferRef.current);

              if (parsed && typeof parsed === "object") {
                setSections(parsed);
              }

              const finalMessageText =
                text ||
                (parsed?.markdown_full &&
                  typeof parsed.markdown_full === "string"
                  ? parsed.markdown_full
                  : "");

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  text: finalMessageText,
                },
              ]);

              assistantBufferRef.current = "";
              setStreamText("");
              setStreaming(false);
              cleanupStream(true);
              break;
            }

            case "workflow_finished": {
              if (evt.data) {
                const finalText =
                  evt.data?.outputs?.answer || evt.data?.answer || "";
                const { text, sections: parsed } =
                  splitAssistantContent(finalText);
                if (parsed && typeof parsed === "object") {
                  setSections(parsed);
                }
                const finalMessageText =
                  text ||
                  (parsed?.markdown_full &&
                    typeof parsed.markdown_full === "string"
                    ? parsed.markdown_full
                    : "");
                if (finalMessageText) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      text: finalMessageText,
                    },
                  ]);
                }
              }
              assistantBufferRef.current = "";
              setStreamText("");
              setStreaming(false);
              cleanupStream(true);
              break;
            }

            case "error":
              setError(evt.message || "Stream error");
              setStreaming(false);
              cleanupStream(true);
              break;

            default:
              break;
          }
        }
      };

      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || "Failed to start chat");
        }

        const contentType = res.headers.get("content-type") || "";
        abortRef.current = controller;

        // Some Dify deployments stream directly on the POST response
        if (contentType.includes("text/event-stream")) {
          const reader = res.body?.getReader();
          if (!reader) {
            throw new Error("Stream error");
          }

          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          setStreaming(true);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            while (true) {
              const separatorIndex = buffer.indexOf("\n\n");
              if (separatorIndex === -1) break;

              const rawEvent = buffer.slice(0, separatorIndex);
              buffer = buffer.slice(separatorIndex + 2);
              processEvent(rawEvent);
            }
          }

          return;
        }

        // Otherwise, expect JSON with task_id and fetch events separately
        const json = await res.json() as { task_id?: string; conversation_id?: string };
        taskId = json.task_id || null;

        if (json.conversation_id) {
          setConversationId(json.conversation_id);
        }
      } catch (err) {
        const error = err as Error;
        if (error.name !== "AbortError") {
          setError(error.message || "Failed to send message");
        }
        return;
      }

      if (!taskId) {
        setError("No task ID returned.");
        return;
      }

      abortRef.current = controller;
      const streamUrl = `${API_BASE}/chat/${taskId}/events`;

      try {
        const streamRes = await fetch(streamUrl, {
          headers: {
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
          credentials: "include",
          signal: controller.signal,
        });

        if (!streamRes.ok || !streamRes.body) {
          throw new Error("Stream error");
        }

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        setStreaming(true);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by blank lines
          while (true) {
            const separatorIndex = buffer.indexOf("\n\n");
            if (separatorIndex === -1) break;

            const rawEvent = buffer.slice(0, separatorIndex);
            buffer = buffer.slice(separatorIndex + 2);
            processEvent(rawEvent);
          }
        }
      } catch (err) {
        const error = err as Error;
        if (error.name !== "AbortError") {
          setError(error.message || "Stream closed unexpectedly");
        }
        setStreaming(false);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [cleanupStream, conversationId, splitAssistantContent]
  );

  useEffect(
    () => () => {
      cleanupStream(true);
    },
    [cleanupStream]
  );

  return {
    messages,
    streamText,
    streaming,
    error,
    send,
    conversationId,
    sections,
  };
}

