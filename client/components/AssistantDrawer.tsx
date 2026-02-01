import React, { Fragment, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@uicomponents/ui";
import { MemoizedMarkdown } from "@uicomponents/chat/memoized-markdown";
import type { AssistantDrawerProps, ChatMessage } from "@/pages/home/types";


export function AssistantDrawer({
  isOpen,
  onClose,
  messages = [],
  streamText = "",
  streaming = false,
  streamError = null,
  sections = null,
  onSend,
}: AssistantDrawerProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      setInputValue("");
    }
  }, [isOpen]);

  const chatLog = useMemo<ChatMessage[]>(() => {
    const log = [...messages];
    if (streamText) {
      log.push({ role: "assistant", text: streamText, streaming: true });
    }
    return log;
  }, [messages, streamText]);

  const handleSend = (text: string | null | undefined): void => {
    const trimmed = text?.trim();
    if (!trimmed) return;

    onSend?.(trimmed);
    setInputValue("");
  };

  const handleSubmit = (): void => handleSend(inputValue);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[10050]" onClose={onClose}>
        <TransitionChild
          as="div"
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity dark:bg-black/40 z-[10049]"
        />

        <TransitionChild
          as={DialogPanel}
          enter="ease-out transform-gpu transition-transform duration-200"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="ease-in transform-gpu transition-transform duration-200"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
          className="fixed right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-200 dark:bg-dark-700 z-[10050]"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 dark:border-dark-500 sm:px-5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                <DocumentTextIcon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-dark-50">
                  AI Document Assistant
                </p>
                <p className="text-xs text-gray-500 dark:text-dark-200">
                  Ask about your documents and extraction
                </p>
              </div>
            </div>
            <Button
              variant="flat"
              isIcon
              className="size-8 rounded-full"
              onClick={onClose}
            >
              <XMarkIcon className="size-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
            <div className="space-y-3">
              {chatLog.map((message, index) => {
                const isUser = message.role === "user";
                const bubbleClasses = isUser
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-800 dark:bg-dark-500 dark:text-dark-50";

                return (
                  <div
                    key={`${message.role}-${index}-${message.text.slice(0, 8)}`}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`rounded-md px-3 py-2 text-sm shadow-sm ${isUser ? "max-w-[70%]" : "w-full"
                        } ${bubbleClasses}`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{message.text}</p>
                      ) : (
                        <MemoizedMarkdown
                          id={`assistant-msg-${index}`}
                          content={message.text}
                        />
                      )}
                      {message.streaming ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-primary-500 dark:text-primary-200">
                          <span className="size-1.5 animate-pulse rounded-full bg-current" />
                          streaming
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {streamError ? (
              <p className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-100">
                {streamError}
              </p>
            ) : null}
            {sections?.insights ? (
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-800 shadow-sm dark:bg-dark-600 dark:text-dark-50">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-200">
                  AI FDD Insights
                </p>
                <MemoizedMarkdown id="ai-insights" content={sections.insights} />
              </div>
            ) : null}
            {Array.isArray(sections?.kpi) && sections.kpi.length ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-200">
                  KPIs
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {sections.kpi.map((item, idx) => (
                    <div
                      key={`${item.Title ?? "kpi"}-${idx}`}
                      className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm dark:border-dark-500 dark:bg-dark-600"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 dark:text-dark-50">
                            {item.Title ?? "KPI"}
                          </p>
                          {item.Subtitle ? (
                            <p className="text-xs text-gray-500 dark:text-dark-200">
                              {item.Subtitle}
                            </p>
                          ) : null}
                        </div>
                        {item.Value ? (
                          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600 dark:bg-primary-500/10 dark:text-primary-200">
                            {item.Value}
                          </span>
                        ) : null}
                      </div>
                      {item.Message ? (
                        <p className="mt-2 text-sm text-gray-700 dark:text-dark-50">
                          {item.Message}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {sections?.charts ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-200">
                  Charts
                </p>
                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-dark-500 dark:bg-dark-600">
                  {sections.charts.title?.text ? (
                    <p className="text-sm font-semibold text-gray-800 dark:text-dark-50">
                      {sections.charts.title.text}
                    </p>
                  ) : null}
                  {Array.isArray(sections.charts.xAxis?.categories) &&
                  Array.isArray(sections.charts.series) ? (
                    <div className="mt-2 space-y-2">
                      {sections.charts.series.map((series, idx) => (
                        <div key={`${series.name ?? "series"}-${idx}`}>
                          <p className="text-xs font-semibold text-gray-600 dark:text-dark-200">
                            {series.name ?? "Series"}
                          </p>
                          <ul className="mt-1 space-y-1 text-xs text-gray-700 dark:text-dark-50">
                            {sections.charts.xAxis?.categories.map(
                              (label, catIdx) => (
                                <li
                                  key={`${label}-${catIdx}`}
                                  className="flex justify-between rounded bg-gray-50 px-2 py-1 dark:bg-dark-700"
                                >
                                  <span className="pr-2">{label}</span>
                                  <span className="font-semibold">
                                    {Array.isArray(series.data)
                                      ? series.data[catIdx]
                                      : "-"}
                                  </span>
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 dark:text-dark-200">
                      Chart data not available.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
            {streaming ? (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-500">
                Streaming response...
              </p>
            ) : null}
          </div>

          <div className="border-t border-gray-100 px-4 py-3 dark:border-dark-500 sm:px-5 flex-shrink-0">
            <div className="flex items-center justify-between gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-dark-500 dark:bg-dark-600">
              <Button
                isIcon
                color="neutral"
                variant="filled"
                className="size-9 rounded-full hidden"
              >
                <MicrophoneIcon className="size-5 text-gray-400" />
              </Button>
              <input
                className="w-full border-none bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-dark-50"
                placeholder="Ask anything"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                isIcon
                color="primary"
                variant="filled"
                className="size-9 rounded-full"
                onClick={handleSubmit}
                disabled={streaming}
              >
                <PaperAirplaneIcon className="size-4" />
              </Button>
            </div>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}

