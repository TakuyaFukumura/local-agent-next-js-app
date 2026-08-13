import {createAgent} from '../../../../lib/agent';
import type {AgentEvent} from '@earendil-works/pi-agent-core';

/**
 * チャット用 SSE エンドポイント
 * POST /api/chat
 */
export async function POST(request: Request) {
    const requestId = crypto.randomUUID();
    console.info('[api/chat] request received', {requestId});

    let body: unknown;
    try {
        body = await request.json();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[api/chat] invalid JSON body', {requestId, error: message});
        return new Response(JSON.stringify({error: '不正な JSON です'}), {
            status: 400,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const apiToken = process.env.CHAT_API_TOKEN;
    if (process.env.NODE_ENV === 'production') {
        if (!apiToken) {
            console.error('[api/chat] CHAT_API_TOKEN is not configured', {requestId});
            return new Response(JSON.stringify({error: 'サーバー設定エラーです'}), {
                status: 503,
                headers: {'Content-Type': 'application/json'},
            });
        }

        const authHeader = request.headers.get('authorization');
        const expected = 'Bearer ' + apiToken;
        if (authHeader !== expected) {
            console.warn('[api/chat] unauthorized request', {requestId});
            return new Response(JSON.stringify({error: '認証に失敗しました'}), {
                status: 401,
                headers: {'Content-Type': 'application/json'},
            });
        }
    }

    const parsedBody =
        typeof body === 'object' && body !== null ? (body as { message?: unknown }) : {};
    const userMessage: string =
        typeof parsedBody.message === 'string' ? parsedBody.message : '';

    if (!userMessage.trim()) {
        console.warn('[api/chat] empty message', {requestId});
        return new Response(JSON.stringify({error: 'メッセージが空です'}), {
            status: 400,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = async (data: object) => {
        await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    await (async () => {
        console.info('[api/chat] stream started', {requestId});
        const agent = createAgent();

        const unsubscribe = agent.subscribe(async (event: AgentEvent) => {
            if (event.type === 'message_update') {
                const msg = event.assistantMessageEvent;
                if (msg.type === 'text_delta' && msg.delta) {
                    await sendEvent({type: 'text', content: msg.delta});
                }
            } else if (event.type === 'tool_execution_start') {
                await sendEvent({
                    type: 'tool_call',
                    name: event.toolName,
                    args: event.args,
                });
            } else if (event.type === 'tool_execution_end') {
                await sendEvent({
                    type: 'tool_result',
                    name: event.toolName,
                    result: event.result,
                    isError: event.isError,
                });
            }
        });

        try {
            await agent.prompt(userMessage);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[api/chat] agent prompt failed', {requestId, error: message});
            await sendEvent({type: 'error', message});
        } finally {
            unsubscribe();
            await sendEvent({type: 'done'});
            await writer.close();
            console.info('[api/chat] stream closed', {requestId});
        }
    })();

    return new Response(stream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
