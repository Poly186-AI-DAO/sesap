import { useState, useCallback } from 'react';
import { Button, Input, Upload, Modal, Progress, message } from 'antd';
import { UploadOutlined, FileTextOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import useAppStore from '../store/store';

const { TextArea } = Input;

interface TranscriptUploadProps {
    open: boolean;
    onClose: () => void;
}

/**
 * TranscriptUpload component
 * 
 * Modal for uploading or pasting a transcript to generate a contract.
 * Calls the backend API and populates the editors with the result.
 */
export default function TranscriptUpload({ open, onClose }: TranscriptUploadProps) {
    const [transcript, setTranscript] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const setContractArtifacts = useAppStore((state) => state.setContractArtifacts);

    const handleGenerate = useCallback(async () => {
        if (!transcript.trim()) {
            message.warning('Please paste or upload a transcript first');
            return;
        }

        if (transcript.length < 100) {
            message.warning('Transcript must be at least 100 characters');
            return;
        }

        setIsGenerating(true);
        setProgress(10);

        try {
            // Simulate progress stages
            const progressInterval = setInterval(() => {
                setProgress((prev) => Math.min(prev + 15, 85));
            }, 3000);

            const response = await fetch('/api/generate/contract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript }),
            });

            clearInterval(progressInterval);
            setProgress(95);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Contract generation failed');
            }

            const { model, template, data } = await response.json();
            setProgress(100);

            // Populate the editors
            await setContractArtifacts(model, template, data);

            message.success('Contract generated successfully!');
            setTranscript('');
            onClose();
        } catch (error) {
            console.error('[TranscriptUpload] Generation failed:', error);
            message.error(error instanceof Error ? error.message : 'Generation failed');
        } finally {
            setIsGenerating(false);
            setProgress(0);
        }
    }, [transcript, setContractArtifacts, onClose]);

    const handleFileUpload = useCallback((info: { file: UploadFile }) => {
        const file = info.file.originFileObj;
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (text) {
                setTranscript(text);
                message.success(`Loaded ${file.name}`);
            }
        };
        reader.onerror = () => {
            message.error('Failed to read file');
        };
        reader.readAsText(file);
    }, []);

    return (
        <Modal
            title="Generate Contract from Transcript"
            open={open}
            onCancel={onClose}
            width={700}
            footer={[
                <Button key="cancel" onClick={onClose} disabled={isGenerating}>
                    Cancel
                </Button>,
                <Button
                    key="generate"
                    type="primary"
                    onClick={handleGenerate}
                    loading={isGenerating}
                    icon={isGenerating ? <LoadingOutlined /> : <FileTextOutlined />}
                    disabled={!transcript.trim() || isGenerating}
                >
                    {isGenerating ? 'Generating...' : 'Generate Contract'}
                </Button>,
            ]}
        >
            <div style={{ marginBottom: 16 }}>
                <p style={{ marginBottom: 12 }}>
                    Paste a meeting transcript below, or upload a .txt file. The AI will extract
                    contract structure and generate Accord artifacts.
                </p>

                <Upload
                    accept=".txt,.md"
                    showUploadList={false}
                    beforeUpload={() => false}
                    onChange={handleFileUpload}
                >
                    <Button icon={<UploadOutlined />} disabled={isGenerating}>
                        Upload Transcript (.txt)
                    </Button>
                </Upload>
            </div>

            <TextArea
                placeholder="Paste your meeting transcript here..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={12}
                disabled={isGenerating}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
            />

            {transcript && (
                <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                    {transcript.length.toLocaleString()} characters
                </div>
            )}

            {isGenerating && (
                <div style={{ marginTop: 16 }}>
                    <Progress percent={progress} status="active" />
                    <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                        {progress < 30 && 'Extracting contract structure...'}
                        {progress >= 30 && progress < 60 && 'Generating Accord artifacts...'}
                        {progress >= 60 && progress < 90 && 'Validating and polishing...'}
                        {progress >= 90 && 'Finalizing...'}
                    </div>
                </div>
            )}
        </Modal>
    );
}
