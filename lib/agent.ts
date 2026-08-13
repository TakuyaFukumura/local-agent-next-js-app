import {Agent, type AgentTool} from '@earendil-works/pi-agent-core';
import type {Model} from '@earendil-works/pi-ai/compat';
import {streamSimple, Type} from '@earendil-works/pi-ai/compat';
import fs from 'fs';
import path from 'path';
import {execFile} from 'child_process';
import {promisify} from 'util';

const execFileAsync = promisify(execFile);
const workspaceRoot = path.resolve(process.env.AGENT_WORKSPACE_ROOT ?? process.cwd());
const commandsEnabled = process.env.AGENT_ENABLE_COMMANDS === 'true';
const allowedCommands = new Set(
    (process.env.AGENT_ALLOWED_COMMANDS ?? '')
        .split(',')
        .map((command) => command.trim())
        .filter(Boolean)
);

function resolveWorkspacePath(inputPath: string): string {
    const resolvedPath = path.resolve(workspaceRoot, inputPath);
    const relativePath = path.relative(workspaceRoot, resolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error('許可されたディレクトリ外のパスです');
    }
    return resolvedPath;
}

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
            const safePath = resolveWorkspacePath(params.path);
            console.info('[agent.readFile] start', {path: safePath});
            const content = fs.readFileSync(safePath, 'utf-8');
            return {
                content: [{type: 'text', text: content}],
                details: {path: safePath},
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[agent.readFile] failed', {path: params.path, error: message});
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
            const safePath = resolveWorkspacePath(params.path);
            console.info('[agent.writeFile] start', {path: safePath});
            fs.writeFileSync(safePath, params.content, 'utf-8');
            return {
                content: [{type: 'text', text: `ファイルを書き込みました: ${safePath}`}],
                details: {path: safePath},
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[agent.writeFile] failed', {path: params.path, error: message});
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
            if (!commandsEnabled) {
                throw new Error(
                    'runCommand は無効化されています。AGENT_ENABLE_COMMANDS=true で有効化してください。'
                );
            }

            const commandParts = params.command.trim().split(/\s+/);
            const commandName = commandParts[0];
            const commandArgs = commandParts.slice(1);

            if (!commandName) {
                throw new Error('コマンドが空です');
            }
            if (!allowedCommands.has(commandName)) {
                throw new Error(`許可されていないコマンドです: ${commandName}`);
            }

            console.info('[agent.runCommand] start', {
                command: commandName,
                args: commandArgs,
                cwd: workspaceRoot,
            });
            const {stdout, stderr} = await execFileAsync(commandName, commandArgs, {
                timeout: 30000,
                cwd: workspaceRoot,
                shell: false,
                maxBuffer: 1024 * 1024,
            });
            const output = stdout || stderr || '（出力なし）';
            return {
                content: [{type: 'text', text: output}],
                details: {command: commandName, args: commandArgs},
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[agent.runCommand] failed', {command: params.command, error: message});
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
