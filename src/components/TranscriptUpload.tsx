import { useState, useCallback } from 'react';
import { Button, Input, Upload, Modal, Steps, message, Tabs, List, Typography, Popconfirm, Empty, Tooltip } from 'antd';
import { UploadOutlined, FileTextOutlined, LoadingOutlined, HistoryOutlined, DeleteOutlined, ClearOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import useAppStore from '../store/store';
import type { GenerationHistoryEntry } from '../store/store';

const { TextArea } = Input;
const { Text } = Typography;

/** Generation pipeline step labels mapped to progress */
const GENERATION_STEPS = [
    { key: 'extracting', label: 'Extracting structure' },
    { key: 'generating', label: 'Generating artifacts' },
    { key: 'validating', label: 'Validating & polishing' },
    { key: 'rendering', label: 'Rendering HTML' },
] as const;

function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
}

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
    const [currentStep, setCurrentStep] = useState(-1);
    const [activeTab, setActiveTab] = useState<string>('generate');
    const setContractArtifacts = useAppStore((state) => state.setContractArtifacts);
    const addHistoryEntry = useAppStore((state) => state.addHistoryEntry);
    const generationHistory = useAppStore((state) => state.generationHistory);
    const loadHistoryEntry = useAppStore((state) => state.loadHistoryEntry);
    const deleteHistoryEntry = useAppStore((state) => state.deleteHistoryEntry);
    const clearHistory = useAppStore((state) => state.clearHistory);

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
        setCurrentStep(0);

        try {
            // Step progress simulation based on typical pipeline timing
            const stepTimers = [
                setTimeout(() => setCurrentStep(1), 8000),
                setTimeout(() => setCurrentStep(2), 18000),
                setTimeout(() => setCurrentStep(3), 28000),
            ];

            const response = await fetch('/api/generate/contract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript }),
            });

            // Clear timers
            stepTimers.forEach(clearTimeout);
            setCurrentStep(3);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Contract generation failed');
            }

            const { model, template, data, html } = await response.json();
            setCurrentStep(4);

            // Populate the editors
            await setContractArtifacts(model, template, data);

            // Extract a title from the template (first heading or first line)
            const titleMatch = template.match(/^#*\s*(.+)/m);
            const title = titleMatch ? titleMatch[1].trim().slice(0, 80) : 'Untitled Contract';

            // Save to history
            addHistoryEntry({
                title,
                transcriptPreview: transcript.slice(0, 200),
                model,
                template,
                data,
                html: html || '',
            });

            message.success('Contract generated successfully!');
            setTranscript('');
            onClose();
        } catch (error) {
            console.error('[TranscriptUpload] Generation failed:', error);
            message.error(error instanceof Error ? error.message : 'Generation failed');
        } finally {
            setIsGenerating(false);
            setCurrentStep(-1);
        }
    }, [transcript, setContractArtifacts, addHistoryEntry, onClose]);

    const handleLoadHistory = useCallback(async (entry: GenerationHistoryEntry) => {
        try {
            await loadHistoryEntry(entry.id);
            message.success(`Loaded: ${entry.title}`);
            onClose();
        } catch {
            message.error('Failed to load history entry');
        }
    }, [loadHistoryEntry, onClose]);

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
            title="Contract Generator"
            open={open}
            onCancel={onClose}
            width={720}
            footer={activeTab === 'generate' ? [
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
            ] : [
                <Button key="close" onClick={onClose}>Close</Button>,
            ]}
        >
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: 'generate',
                        label: 'Generate',
                        icon: <FileTextOutlined />,
                        children: (
                            <>
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
                                    rows={10}
                                    disabled={isGenerating}
                                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                                />

                                {transcript && (
                                    <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                                        {transcript.length.toLocaleString()} characters
                                    </div>
                                )}

                                {isGenerating && (
                                    <div style={{ marginTop: 20 }}>
                                        <Steps
                                            current={currentStep}
                                            size="small"
                                            items={GENERATION_STEPS.map((step) => ({
                                                title: step.label,
                                            }))}
                                        />
                                        <div style={{ marginTop: 12, color: '#666', fontSize: 12, textAlign: 'center' }}>
                                            This typically takes 30–60 seconds
                                        </div>
                                    </div>
                                )}
                            </>
                        ),
                    },
                    {
                        key: 'history',
                        label: `History${generationHistory.length ? ` (${generationHistory.length})` : ''}`,
                        icon: <HistoryOutlined />,
                        children: (
                            <>
                                {generationHistory.length > 0 ? (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                                            <Popconfirm
                                                title="Clear all history?"
                                                description="This cannot be undone."
                                                onConfirm={clearHistory}
                                                okText="Clear"
                                                okType="danger"
                                            >
                                                <Button size="small" icon={<ClearOutlined />} danger>
                                                    Clear All
                                                </Button>
                                            </Popconfirm>
                                        </div>
                                        <List
                                            dataSource={generationHistory}
                                            renderItem={(entry) => (
                                                <List.Item
                                                    key={entry.id}
                                                    style={{ cursor: 'pointer' }}
                                                    actions={[
                                                        <Tooltip title="Delete" key="delete">
                                                            <Button
                                                                type="text"
                                                                size="small"
                                                                danger
                                                                icon={<DeleteOutlined />}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    deleteHistoryEntry(entry.id);
                                                                }}
                                                            />
                                                        </Tooltip>,
                                                    ]}
                                                    onClick={() => handleLoadHistory(entry)}
                                                >
                                                    <List.Item.Meta
                                                        title={
                                                            <Text strong style={{ fontSize: 13 }}>
                                                                {entry.title}
                                                            </Text>
                                                        }
                                                        description={
                                                            <div>
                                                                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
                                                                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                                                                    {formatTimestamp(entry.timestamp)}
                                                                </div>
                                                                <Text
                                                                    type="secondary"
                                                                    style={{ fontSize: 11 }}
                                                                    ellipsis={{ tooltip: true }}
                                                                >
                                                                    {entry.transcriptPreview}
                                                                </Text>
                                                            </div>
                                                        }
                                                    />
                                                </List.Item>
                                            )}
                                        />
                                    </>
                                ) : (
                                    <Empty
                                        description="No contracts generated yet"
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    />
                                )}
                            </>
                        ),
                    },
                ]}
            />
        </Modal>
    );
}
