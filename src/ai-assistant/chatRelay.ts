import type { editorsContent } from "../types/components/AIAssistant.types";

export const loadConfigFromLocalStorage = () => {
  // AI assistant disabled in minimal build
};

export const resetChat = () => {
  // no-op
};

export const stopMessage = () => {
  // no-op
};

export const sendMessage = async (
  _userInput: string,
  _promptPreset: string | null,
  _editorsContent: editorsContent,
  _addToChat: boolean = true,
  _editorType?: "markdown" | "concerto" | "json",
  onChunk?: (chunk: string) => void,
  _onError?: (error: Error) => void,
  onComplete?: () => void
) => {
  if (onChunk) {
    onChunk("");
  }
  if (onComplete) {
    onComplete();
  }
};
