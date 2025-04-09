import React, { useState, useEffect, useCallback } from 'react';
import { updateExtractedText } from '../services/api';
import { debounce } from '../utils/helpers';

interface TextEditorProps {
    initialText: string;
    textId: number;
    onSaveComplete?: (savedText: string) => void;
    className?: string;
    autoSave?: boolean;
}

const TextEditor: React.FC<TextEditorProps> = ({
                                                   initialText,
                                                   textId,
                                                   onSaveComplete,
                                                   className,
                                                   autoSave = false
                                               }) => {
    const [text, setText] = useState<string>(initialText);
    const [originalText, setOriginalText] = useState<string>(initialText);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isEdited, setIsEdited] = useState<boolean>(false);

    useEffect(() => {
        setText(initialText);
        setOriginalText(initialText);
        setIsEdited(false);
        setError(null);
        setSuccessMessage(null);
    }, [initialText]);

    // For auto-saving functionality with debounce
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSave = useCallback(
        debounce(async (textToSave: string) => {
            if (textToSave !== originalText) {
                try {
                    setIsSaving(true);
                    const response = await updateExtractedText(textId, textToSave);

                    if (response.success) {
                        setOriginalText(textToSave);
                        setSuccessMessage('자동 저장 완료');

                        if (onSaveComplete) {
                            onSaveComplete(textToSave);
                        }

                        // 3초 후 성공 메시지 숨기기
                        setTimeout(() => {
                            setSuccessMessage(null);
                        }, 3000);
                    } else {
                        setError(response.error || '텍스트 저장 중 오류가 발생했습니다.');
                    }
                } catch (err) {
                    setError('서버 연결 오류가 발생했습니다.');
                    console.error('Auto-save error:', err);
                } finally {
                    setIsSaving(false);
                }
            }
        }, 2000),
        [textId, originalText, onSaveComplete]
    );

    // Handle text change
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setText(newText);
        setIsEdited(newText !== originalText);

        // 저장 완료 메시지 숨기기
        if (successMessage) {
            setSuccessMessage(null);
        }

        // 자동 저장 활성화 시 변경 사항을 debounce하여 저장
        if (autoSave) {
            debouncedSave(newText);
        }
    };

    // Handle manual save
    const handleSave = async () => {
        if (!isEdited || isSaving) return;

        setIsSaving(true);
        setError(null);

        try {
            const response = await updateExtractedText(textId, text);

            if (response.success) {
                setOriginalText(text);
                setIsEdited(false);
                setSuccessMessage('변경사항이 저장되었습니다.');

                // 저장 완료 콜백 실행
                if (onSaveComplete) {
                    onSaveComplete(text);
                }

                // 3초 후 성공 메시지 숨기기
                setTimeout(() => {
                    setSuccessMessage(null);
                }, 3000);
            } else {
                setError(response.error || '텍스트 저장 중 오류가 발생했습니다.');
            }
        } catch (err) {
            setError('서버 연결 오류가 발생했습니다. 다시 시도해주세요.');
            console.error('Save error:', err);
        } finally {
            setIsSaving(false);
        }
    };

    // Reset to original text
    const handleReset = () => {
        setText(originalText);
        setIsEdited(false);
        setError(null);
        setSuccessMessage(null);
    };

    // Handle keyboard shortcuts
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSave();
        }

        // Escape to reset
        if (e.key === 'Escape') {
            handleReset();
        }
    };

    return (
        <div className={`w-full ${className || ''}`}>
            <div className="mb-2 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-700">텍스트 편집</h3>
                <div className="flex space-x-2">
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={!isEdited || isSaving}
                        className={`px-3 py-1 text-sm rounded-md font-medium
                      ${!isEdited || isSaving
                            ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                            : 'text-gray-700 bg-gray-200 hover:bg-gray-300'}
                      transition-colors duration-200`}
                    >
                        초기화
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!isEdited || isSaving}
                        className={`px-3 py-1 text-sm rounded-md font-medium
                      ${!isEdited || isSaving
                            ? 'bg-blue-300 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'}
                      text-white transition-colors duration-200`}
                    >
                        {isSaving ? (
                            <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                저장 중...
              </span>
                        ) : '저장'}
                    </button>
                </div>
            </div>

            <textarea
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder="추출된 텍스트가 여기에 표시됩니다."
                rows={10}
                className="w-full border rounded-lg p-3 font-mono text-sm
                 focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                 transition-colors duration-200"
            />

            {error && (
                <div className="mt-2 text-red-500 text-sm">{error}</div>
            )}

            {successMessage && (
                <div className="mt-2 text-green-500 text-sm">{successMessage}</div>
            )}

            <div className="mt-2 text-xs text-gray-500 flex justify-between">
        <span>
          {isEdited
              ? '* 변경사항이 있습니다. 저장 버튼을 눌러 변경사항을 저장하세요.'
              : '텍스트를 편집한 후 저장 버튼을 눌러 변경사항을 저장하세요.'}
        </span>
                <span className="text-gray-400">
          {autoSave && '자동 저장 활성화됨'}
        </span>
            </div>

            <div className="mt-1 text-xs text-gray-400">
                단축키: Ctrl+S (저장), ESC (초기화)
            </div>
        </div>
    );
};

export default TextEditor;