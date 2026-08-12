import {Agent, type AgentTool} from '@mariozechner/pi-agent-core';
import {streamSimple, Type} from '@mariozechner/pi-ai';
import type {Model} from '@mariozechner/pi-ai';
import fs from 'fs';
import {exec} from 'child_process';
import {promisify} from 'util';

const execAsync = promisify(exec);

// ファイル読み込みツールのパラメータスキーマ
const readFileParams = Type.Object({
    path: Type.String({description: 'ファイルパス'}),
});

// ファイル書き込みツールのパラメータスキーマ
const writeFileParams = Type.Object({
    path: Type.String({description: 'ファイルパス'}),
    content: Type.String({description: '書き込む内容'}),
});

// コマンド実行ツールのパラメータスキーマ
const runCommandParams = Type.Object({
    command: Type.String({description: '実行するシェルコマンド'}),
});

// Ollama の OpenAI 互換 API を使用するモデル定義
const ollamaModel: Model<'openai-completions'> = {
    id: 'gemma2:2b',
    name: 'Gemma2 2B (Ollama)',
    api: 'openai-completions',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    reasoning: false,
    input: ['text'],
    cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0},
    contextWindow: 8192,
    maxTokens: 2048,
};

// ファイル読み込みツール
const readFileTool: AgentTool<typeof readFileParams> = {
    name: 'readFile',
    label: 'ファイル読み込み',
    description: '指定されたパスのファイル内容を読み取ります',
    parameters: readFileParams,
    execute: async (_toolCallId, params) => {
        try {
            const content = fs.readFileSync(params.path, 'utf-8');
            return {
                content: [{type: 'text', text: content}],
                details: {path: params.path},
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                content: [{type: 'text', text: `エラー: ${message}`}],
                details: {path: params.path, error: message},
            };
        }
    },
};

// ファイル書き込みツール
const writeFileTool: AgentTool<typeof writeFileParams> = {
    name: 'writeFile',
    label: 'ファイル書き込み',
    description: '指定されたパスにテキストを書き込みます',
    parameters: writeFileParams,
    execute: async (_toolCallId, params) => {
        try {
            fs.writeFileSync(params.path, params.content, 'utf-8');
            return {
                content: [{type: 'text', text: `ファイルを書き込みました: ${params.path}`}],
                details: {path: params.path},
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                content: [{type: 'text', text: `エラー: ${message}`}],
                details: {path: params.path, error: message},
            };
        }
    },
};

// コマンド実行ツール
const runCommandTool: AgentTool<typeof runCommandParams> = {
    name: 'runCommand',
    label: 'コマンド実行',
    description: 'シェルコマンドを実行し、標準出力を返します',
    parameters: runCommandParams,
    execute: async (_toolCallId, params) => {
        try {
            const {stdout, stderr} = await execAsync(params.command, {timeout: 30000});
            const output = stdout || stderr || '（出力なし）';
            return {
                content: [{type: 'text', text: output}],
                details: {command: params.command},
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                content: [{type: 'text', text: `エラー: ${message}`}],
                details: {command: params.command, error: message},
            };
        }
    },
};

/**
 * ローカルエージェントを作成する
 */
export function createAgent(): Agent {
    const agent = new Agent({
        initialState: {
            model: ollamaModel,
            systemPrompt: 'あなたは役に立つAIアシスタントです。日本語で回答してください。',
            tools: [readFileTool, writeFileTool, runCommandTool],
        },
        streamFn: streamSimple,
        getApiKey: () => 'ollama',
    });
    return agent;
}
