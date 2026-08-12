'use client';

import {useState, useRef, useEffect, type KeyboardEvent} from 'react';

/** チャットメッセージの型 */
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: {name: string; args: unknown}[];
}

/** SSE イベントの型 */
interface SseEvent {
    type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';
    content?: string;
    name?: string;
    args?: unknown;
    result?: unknown;
    isError?: boolean;
    message?: string;
}

export default function ChatWindow() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // 新しいメッセージが追加されたときに一番下にスクロールする
    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages]);

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || isStreaming) return;

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setIsStreaming(true);

        const assistantId = crypto.randomUUID();
        const assistantMsg: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            toolCalls: [],
        };
        setMessages((prev) => [...prev, assistantMsg]);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({message: text}),
            });

            if (!response.ok || !response.body) {
                throw new Error('応答の取得に失敗しました');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const {done, value} = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, {stream: true});
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6);
                    let event: SseEvent;
                    try {
                        event = JSON.parse(jsonStr);
                    } catch {
                        continue;
                    }

                    if (event.type === 'text' && event.content) {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId
                                    ? {...m, content: m.content + event.content!}
                                    : m
                            )
                        );
                    } else if (event.type === 'tool_call') {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId
                                    ? {
                                        ...m,
                                        toolCalls: [
                                            ...(m.toolCalls ?? []),
                                            {name: event.name!, args: event.args},
                                        ],
                                    }
                                    : m
                            )
                        );
                    } else if (event.type === 'error') {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId
                                    ? {
                                        ...m,
                                        content:
                                            m.content ||
                                            `エラーが発生しました: ${event.message}`,
                                    }
                                    : m
                            )
                        );
                    } else if (event.type === 'done') {
                        break;
                    }
                }
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : '予期しないエラーが発生しました';
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId
                        ? {
                            ...m,
                            content: m.content || `エラー: ${message}`,
                        }
                        : m
                )
            );
        } finally {
            setIsStreaming(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* メッセージ一覧 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-gray-400 dark:text-gray-500 mt-16">
                        <p className="text-lg">AIエージェントとチャットを始めましょう</p>
                        <p className="text-sm mt-2">
                            メッセージを入力して Enter を押してください
                        </p>
                    </div>
                )}
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                                msg.role === 'user'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow'
                            }`}
                        >
                            {/* ツール呼び出し情報 */}
                            {msg.toolCalls && msg.toolCalls.length > 0 && (
                                <div className="mb-2 space-y-1">
                                    {msg.toolCalls.map((tc, i) => (
                                        <div
                                            key={i}
                                            className="text-xs bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-gray-600 dark:text-gray-300"
                                        >
                                            🔧 {tc.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* メッセージ本文 */}
                            {msg.content ? (
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            ) : (
                                msg.role === 'assistant' && (
                                    <span className="inline-block animate-pulse">●</span>
                                )
                            )}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* 入力エリア */}
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <div className="flex gap-2 max-w-4xl mx-auto">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="メッセージを入力... (Enter で送信、Shift+Enter で改行)"
                        rows={2}
                        disabled={isStreaming}
                        className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={isStreaming || !input.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isStreaming ? '送信中...' : '送信'}
                    </button>
                </div>
            </div>
        </div>
    );
}
