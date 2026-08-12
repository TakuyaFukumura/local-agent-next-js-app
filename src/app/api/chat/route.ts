import {createAgent} from '../../../../lib/agent';
import type {AgentEvent} from '@mariozechner/pi-agent-core';

/**
 * チャット用 SSE エンドポイント
 * POST /api/chat
 */
export async function POST(request: Request) {
    const body = await request.json();
    const userMessage: string = body.message ?? '';

    if (!userMessage.trim()) {
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

    (async () => {
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
            await sendEvent({type: 'error', message});
        } finally {
            unsubscribe();
            await sendEvent({type: 'done'});
            await writer.close();
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
