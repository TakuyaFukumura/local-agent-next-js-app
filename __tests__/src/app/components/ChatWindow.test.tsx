/**
 * ChatWindow コンポーネントのテスト
 *
 * このテストファイルは、src/app/components/ChatWindow.tsxの機能をテストします。
 * チャット画面の表示、メッセージ送信ボタン、入力欄の動作をテストしています。
 */

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import ChatWindow from '../../../../src/app/components/ChatWindow';
import '@testing-library/jest-dom';

// fetch のモック
global.fetch = jest.fn();

// jsdom で scrollIntoView が未実装のためモック
window.HTMLElement.prototype.scrollIntoView = jest.fn();

describe('ChatWindow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('初期表示', () => {
        it('ウェルカムメッセージが表示される', () => {
            render(<ChatWindow/>);
            expect(screen.getByText('AIエージェントとチャットを始めましょう')).toBeInTheDocument();
        });

        it('テキストエリアが表示される', () => {
            render(<ChatWindow/>);
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        it('送信ボタンが表示される', () => {
            render(<ChatWindow/>);
            expect(screen.getByRole('button', {name: '送信'})).toBeInTheDocument();
        });

        it('初期状態では送信ボタンが無効', () => {
            render(<ChatWindow/>);
            expect(screen.getByRole('button', {name: '送信'})).toBeDisabled();
        });
    });

    describe('入力欄', () => {
        it('テキストを入力すると送信ボタンが有効になる', () => {
            render(<ChatWindow/>);
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, {target: {value: 'こんにちは'}});
            expect(screen.getByRole('button', {name: '送信'})).not.toBeDisabled();
        });

        it('テキストを削除すると送信ボタンが無効になる', () => {
            render(<ChatWindow/>);
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, {target: {value: 'こんにちは'}});
            fireEvent.change(textarea, {target: {value: ''}});
            expect(screen.getByRole('button', {name: '送信'})).toBeDisabled();
        });

        it('Shift+Enter では送信されない', () => {
            render(<ChatWindow/>);
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, {target: {value: 'こんにちは'}});
            fireEvent.keyDown(textarea, {key: 'Enter', shiftKey: true});
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('メッセージ送信', () => {
        it('ボタンクリックで fetch が呼ばれる', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                body: null,
            });

            render(<ChatWindow/>);
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, {target: {value: 'こんにちは'}});
            fireEvent.click(screen.getByRole('button', {name: '送信'}));

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/chat',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({message: 'こんにちは'}),
                })
            );
        });

        it('送信後に入力欄がクリアされる', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                body: null,
            });

            render(<ChatWindow/>);
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, {target: {value: 'こんにちは'}});
            fireEvent.click(screen.getByRole('button', {name: '送信'}));

            expect((textarea as HTMLTextAreaElement).value).toBe('');
        });

        it('送信後にユーザーメッセージが表示される', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                body: null,
            });

            render(<ChatWindow/>);
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, {target: {value: 'こんにちは'}});
            fireEvent.click(screen.getByRole('button', {name: '送信'}));

            expect(screen.getByText('こんにちは')).toBeInTheDocument();
        });
    });
});
