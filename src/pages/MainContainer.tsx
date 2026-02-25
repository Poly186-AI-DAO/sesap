import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import AgreementData from "../editors/editorsContainer/AgreementData";
import TemplateModel from "../editors/editorsContainer/TemplateModel";
import TemplateMarkdown from "../editors/editorsContainer/TemplateMarkdown";
import useAppStore from "../store/store";
import ProblemPanel from "../components/ProblemPanel";
import "../styles/pages/MainContainer.css";

const MainContainer = () => {
  const agreementHtml = useAppStore((state) => state.agreementHtml);
  const backgroundColor = useAppStore((state) => state.backgroundColor);
  const textColor = useAppStore((state) => state.textColor);
  const error = useAppStore((state) => state.error);

  return (
    <div className="main-container" style={{ backgroundColor }}>
      <PanelGroup
        direction="horizontal"
        className="main-container-panel-group"
        style={{ height: "100%", width: "100%" }}
      >
        <Panel defaultSize={62.5} minSize={30}>
          <div className="main-container-editors-panel" style={{ backgroundColor }}>
            <PanelGroup direction="vertical" className="main-container-editors-panel-group">
              <Panel minSize={20}>
                <div className="main-container-editor-section tour-concerto-model">
                  <div className={`main-container-editor-header ${backgroundColor === '#ffffff' ? 'main-container-editor-header-light' : 'main-container-editor-header-dark'}`}>
                    <span>Concerto Model</span>
                  </div>
                  <div className="main-container-editor-content" style={{ backgroundColor }}>
                    <TemplateModel />
                  </div>
                </div>
              </Panel>
              <PanelResizeHandle className="main-container-panel-resize-handle-vertical" />

              <Panel minSize={20}>
                <div className="main-container-editor-section tour-template-mark">
                  <div className={`main-container-editor-header ${backgroundColor === '#ffffff' ? 'main-container-editor-header-light' : 'main-container-editor-header-dark'}`}>
                    TemplateMark
                  </div>
                  <div className="main-container-editor-content" style={{ backgroundColor }}>
                    <TemplateMarkdown />
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="main-container-panel-resize-handle-vertical" />

              <Panel minSize={20}>
                <div className="main-container-editor-section tour-json-data">
                  <div className={`main-container-editor-header ${backgroundColor === '#ffffff' ? 'main-container-editor-header-light' : 'main-container-editor-header-dark'}`}>
                    JSON Data
                  </div>
                  <div className="main-container-editor-content" style={{ backgroundColor }}>
                    <AgreementData />
                  </div>
                </div>
              </Panel>
              {error && (
                <>
                  <PanelResizeHandle className="main-container-panel-resize-handle-vertical" />
                  <Panel defaultSize={25} minSize={15}>
                    <ProblemPanel />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </div>
        </Panel>
        <PanelResizeHandle className="main-container-panel-resize-handle-horizontal" />
        <Panel defaultSize={37.5} minSize={20}>
          <div className="main-container-preview-panel tour-preview-panel flex flex-col h-full" style={{ backgroundColor }}>
            <div className={`main-container-preview-header ${backgroundColor === '#ffffff' ? 'main-container-preview-header-light' : 'main-container-preview-header-dark'} flex justify-between items-center px-4 py-2 border-b border-slate-700/50`}>
              <div className="font-semibold text-sm">Preview & Execution</div>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-xs font-medium bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors border border-slate-700">Evaluate</button>
                <button className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors">Sign Agreement</button>
              </div>
            </div>
            <div className="main-container-preview-content flex-1 overflow-auto p-4" style={{ backgroundColor }}>

              {/* DocuSign-like wrapper concept */}
              <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden mb-8 mt-2 relative">

                {/* Document Header */}
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">P</div>
                    <div>
                      <h3 className="text-slate-800 font-medium text-sm m-0">Poly186 Protocol Agreement</h3>
                      <p className="text-slate-500 text-xs m-0">Ready for Execution</p>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    Awaiting Signatures
                  </div>
                </div>

                {/* Actual Rendered Content */}
                <div className="p-8 text-sm leading-relaxed" style={{ minHeight: '600px', color: textColor }}>
                  <div
                    className="main-container-agreement prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: agreementHtml }}
                  />

                  {/* Mock Signature Blocks */}
                  <div className="mt-16 border-t border-slate-200 pt-8 grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-xs text-slate-500 mb-6 uppercase tracking-wider font-semibold">Party A Signature</p>
                      <div className="border-b-2 border-slate-300 h-10 mb-2 relative group cursor-pointer">
                        <div className="absolute inset-0 bg-yellow-100/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs text-yellow-800 font-medium">Click to Sign</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">Date: <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-400">YYYY-MM-DD</span></p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-6 uppercase tracking-wider font-semibold">Party B Signature</p>
                      <div className="border-b-2 border-slate-300 h-10 mb-2 relative group cursor-pointer">
                        <div className="absolute inset-0 bg-yellow-100/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs text-yellow-800 font-medium">Click to Sign</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">Date: <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-400">YYYY-MM-DD</span></p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default MainContainer;
