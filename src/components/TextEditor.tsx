import React, { useState, useEffect, useCallback } from 'react';
import { updateExtractedText } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import debounce from 'lodash/debounce';

interface TextEditorProps {
    initialText: string;
    textId: number | null;
    onSaveComplete?: (text: string) => void;
    className?: string;
    readOnly?: boolean;
}

const TextEditor: React.FC<TextEditorProps> = ({
    initialText,
    textId: propTextId,
    onSaveComplete,
    className,
    readOnly = false
}) => {
    const [text, setText] = useState<string>(initialText);
    const [originalText, setOriginalText] = useState<string>(initialText);
    const [isEdited, setIsEdited] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        setText(initialText);
        setOriginalText(initialText);
        setIsEdited(false);
    }, [initialText]);

    // 메시지 초기화 함수
    const clearMessages = useCallback((delay = 3000) => {
        setTimeout(() => {
            setSuccessMessage(null);
            setError(null);
        }, delay);
    }, []);

    // 텍스트 저장 함수
    const saveText = useCallback(async (id: number, content: string, isAutoSave = false) => {
        try {
            setIsSaving(true);
            const { success } = await updateExtractedText(id, content);
            
            if (success) {
                setOriginalText(content);
                setIsEdited(false);
                const message = isAutoSave ? '자동 저장되었습니다' : '변경사항이 저장되었습니다';
                setSuccessMessage(message);
                clearMessages();
                
                if (onSaveComplete) {
                    onSaveComplete(content);
                }
                
                if (!isAutoSave) {
                    showToast('변경사항이 저장되었습니다.', 'success');
                }
                
                return true;
            } else {
                const message = isAutoSave ? '자동 저장 실패' : '저장에 실패했습니다';
                setError(message);
                clearMessages();
                
                if (!isAutoSave) {
                    showToast('저장에 실패했습니다.', 'error');
                }
                
                return false;
            }
        } catch (error) {
            setError('저장 중 오류가 발생했습니다');
            clearMessages();
            
            if (!isAutoSave) {
                showToast('저장 중 오류가 발생했습니다.', 'error');
            }
            
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [clearMessages, onSaveComplete, showToast]);

    // propTextId를 숫자로 변환하는 함수
    const getNumericId = useCallback((id: any): number | null => {
        if (id === null || id === undefined) return null;
        
        if (typeof id === 'number') return id;
        
        if (typeof id === 'object') {
            if (id && id.id && typeof id.id === 'number') {
                return id.id;
            }
            return null;
        }
        
        const numId = Number(id);
        return !isNaN(numId) ? numId : null;
    }, []);
    
    // 자동 저장 디바운스 함수
    const debouncedSave = useCallback(
        (value: string, id: any) => {
            const numericId = getNumericId(id);
            if (!numericId || value === originalText) {
                return;
            }
            
            debounce(async () => {
                await saveText(numericId, value, true);
            }, 2000)();
        },
        [originalText, saveText, getNumericId]
    );

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setText(newText);
        setIsEdited(newText !== originalText);
        
        if (error) {
            setError(null);
        }
        
        if (successMessage) {
            setSuccessMessage(null);
        }
        
        // 자동 저장 (읽기 전용이 아니고 textId가 있는 경우에만)
        if (!readOnly && propTextId && newText !== originalText) {
            debouncedSave(newText, propTextId);
        }
    };

    const handleSave = async () => {
        const numericId = getNumericId(propTextId);
        if (!numericId || isSaving) return;
        await saveText(numericId, text, false);
    };

    const handleReset = () => {
        setText(originalText);
        setIsEdited(false);
        setError(null);
        
        if (successMessage) {
            setSuccessMessage(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Ctrl+S 또는 Cmd+S로 저장
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (isEdited && !isSaving) {
                handleSave();
            }
        }
    };

    return (
        <div className={`w-full ${className || ''}`}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-medium text-gray-700 dark:text-gray-200">
                        {readOnly ? '추출된 텍스트' : '텍스트 편집'}
                    </h2>
                    
                    <div className="flex items-center">
                        {isSaving && (
                            <span className="text-gray-500 dark:text-gray-400 text-sm mr-2">
                                저장 중...
                            </span>
                        )}
                        
                        {successMessage && (
                            <span className="text-green-500 dark:text-green-400 text-sm">
                                {successMessage}
                            </span>
                        )}
                        
                        {error && (
                            <span className="text-red-500 dark:text-red-400 text-sm">
                                {error}
                            </span>
                        )}
                    </div>
                </div>
                
                <textarea
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    readOnly={readOnly}
                    disabled={isSaving}
                    className={`w-full h-64 p-3 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                        readOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'
                    }`}
                    placeholder="추출된 텍스트가 여기에 표시됩니다..."
                />
                
                {!readOnly && (
                    <div className="flex justify-end mt-4 space-x-2">
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={!isEdited || isSaving}
                            className={`px-4 py-2 rounded ${
                                !isEdited || isSaving
                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            초기화
                        </button>
                        
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!propTextId || isSaving}
                            className={`px-4 py-2 rounded ${
                                !propTextId || isSaving
                                    ? 'bg-blue-300 text-white cursor-not-allowed dark:bg-blue-800'
                                    : 'bg-blue-500 text-white hover:bg-blue-600 dark:hover:bg-blue-700'
                            }`}
                        >
                            {isSaving ? '저장 중...' : '저장'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TextEditor;