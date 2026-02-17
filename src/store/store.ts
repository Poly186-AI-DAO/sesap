import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
// import { debounce } from "ts-debounce";
import { ModelManager } from "@accordproject/concerto-core";
import { TemplateMarkInterpreter } from "@accordproject/template-engine";
import { TemplateMarkTransformer } from "@accordproject/markdown-template";
import { transform } from "@accordproject/markdown-transform";
import * as playground from "../samples/playground";
import { decompress } from "../utils/compression/compression";

interface AppState {
  templateMarkdown: string;
  editorValue: string;
  modelCto: string;
  editorModelCto: string;
  data: string;
  editorAgreementData: string;
  agreementHtml: string;
  error: string | undefined;
  isGenerating: boolean;
  generationProgress: string;
  backgroundColor: string;
  textColor: string;
  setTemplateMarkdown: (template: string) => Promise<void>;
  setEditorValue: (value: string) => void;
  setModelCto: (model: string) => Promise<void>;
  setEditorModelCto: (value: string) => void;
  setData: (data: string) => Promise<void>;
  setEditorAgreementData: (value: string) => void;
  rebuild: () => Promise<void>;
  init: () => Promise<void>;
  setContractArtifacts: (
    model: string,
    template: string,
    data: string,
  ) => Promise<void>;
  loadFromLink: (compressedData: string) => Promise<void>;
}

export interface DecompressedData {
  templateMarkdown: string;
  modelCto: string;
  data: string;
  agreementHtml: string;
}

interface CancelationResult {
  type: "cancelation";
  msg: string;
}

function isCancelation(result: unknown): result is CancelationResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "type" in result &&
    (result as any).type === "cancelation"
  );
}

function debounce<F extends (...args: any[]) => Promise<any>>(
  func: F,
  wait: number,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let resolvePrevious: ((value: CancelationResult) => void) | null = null;

  return (
    ...args: Parameters<F>
  ): Promise<ReturnType<F> | CancelationResult> => {
    return new Promise((resolve, reject) => {
      if (timeout) {
        clearTimeout(timeout);
        if (resolvePrevious) {
          // Resolve (not reject) with cancelation to prevent unhandled promise rejections
          resolvePrevious({
            type: "cancelation",
            msg: "operation was debounced",
          });
          resolvePrevious = null;
        }
      }
      resolvePrevious = resolve as (value: CancelationResult) => void;
      timeout = setTimeout(() => {
        func(...args)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            if (
              resolvePrevious ===
              (resolve as (value: CancelationResult) => void)
            ) {
              resolvePrevious = null;
            }
            timeout = null;
          });
      }, wait);
    });
  };
}

const rebuildDeBounce = debounce(rebuild, 500);

async function rebuild(template: string, model: string, dataString: string) {
  const modelManager = new ModelManager({ strict: true });
  modelManager.addCTOModel(model, undefined, true);
  try {
    // Manually add the external model content to avoid network/loader issues
    const moneyModel = `namespace org.accordproject.money@0.3.0
    
    enum CurrencyCode {
      o AED
      o AFN
      o ALL
      o AMD
      o ANG
      o AOA
      o ARS
      o AUD
      o AWG
      o AZN
      o BAM
      o BBD
      o BDT
      o BGN
      o BHD
      o BIF
      o BMD
      o BND
      o BOB
      o BOV
      o BRL
      o BSD
      o BTN
      o BWP
      o BYN
      o BZD
      o CAD
      o CDF
      o CHE
      o CHF
      o CHW
      o CLF
      o CLP
      o CNY
      o COP
      o COU
      o CRC
      o CUC
      o CUP
      o CVE
      o CZK
      o DJF
      o DKK
      o DOP
      o DZD
      o EGP
      o ERN
      o ETB
      o EUR
      o FJD
      o FKP
      o GBP
      o GEL
      o GHS
      o GIP
      o GMD
      o GNF
      o GTQ
      o GYD
      o HKD
      o HNL
      o HRK
      o HTG
      o HUF
      o IDR
      o ILS
      o INR
      o IQD
      o IRR
      o ISK
      o JMD
      o JOD
      o JPY
      o KES
      o KGS
      o KHR
      o KMF
      o KPW
      o KRW
      o KWD
      o KYD
      o KZT
      o LAK
      o LBP
      o LKR
      o LRD
      o LSL
      o LYD
      o MAD
      o MDL
      o MGA
      o MKD
      o MMK
      o MNT
      o MOP
      o MRU
      o MUR
      o MVR
      o MWK
      o MXN
      o MXV
      o MYR
      o MZN
      o NAD
      o NGN
      o NIO
      o NOK
      o NPR
      o NZD
      o OMR
      o PAB
      o PEN
      o PGK
      o PHP
      o PKR
      o PLN
      o PYG
      o QAR
      o RON
      o RSD
      o RUB
      o RWF
      o SAR
      o SBD
      o SCR
      o SDG
      o SEK
      o SGD
      o SHP
      o SLL
      o SOS
      o SRD
      o SSP
      o STN
      o SVC
      o SYP
      o SZL
      o THB
      o TJS
      o TMT
      o TND
      o TOP
      o TRY
      o TTD
      o TWD
      o TZS
      o UAH
      o UGX
      o USD
      o USN
      o UYI
      o UYU
      o UZS
      o VEF
      o VND
      o VUV
      o WST
      o XAF
      o XAG
      o XAU
      o XBA
      o XBB
      o XBC
      o XBD
      o XCD
      o XDR
      o XOF
      o XPD
      o XPF
      o XPT
      o XSU
      o XTS
      o XUA
      o XXX
      o YER
      o ZAR
      o ZMW
      o ZWL
    }
    
    concept MonetaryAmount {
      o Double doubleValue
      o CurrencyCode currencyCode
    }`;

    modelManager.addCTOModel(moneyModel, "money@0.3.0.cto", true);
  } catch (e) {
    console.error(
      "[Store] Failed to add money model:",
      e instanceof Error ? e.message : e,
    );
  }
  const engine = new TemplateMarkInterpreter(modelManager, {});
  const templateMarkTransformer = new TemplateMarkTransformer();
  const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate(
    { content: template },
    modelManager,
    "contract",
    { verbose: false },
  );
  const data = JSON.parse(dataString);
  const ciceroMark = await engine.generate(templateMarkDom, data);
  return await transform(
    ciceroMark.toJSON(),
    "ciceromark_parsed",
    ["html"],
    {},
    { verbose: false },
  );
}

const getInitialTheme = () => {
  if (typeof window !== "undefined") {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      return { backgroundColor: "#121212", textColor: "#ffffff" };
    } else if (savedTheme === "light") {
      return { backgroundColor: "#ffffff", textColor: "#121212" };
    }
  }
  // Default to light theme
  return { backgroundColor: "#ffffff", textColor: "#121212" };
};

const useAppStore = create<AppState>()(
  immer(
    devtools((set, get) => {
      const initialTheme = getInitialTheme();
      return {
        backgroundColor: initialTheme.backgroundColor,
        textColor: initialTheme.textColor,
        isGenerating: false,
        generationProgress: "",
        templateMarkdown: playground.TEMPLATE,
        editorValue: playground.TEMPLATE,
        modelCto: playground.MODEL,
        editorModelCto: playground.MODEL,
        data: JSON.stringify(playground.DATA, null, 2),
        editorAgreementData: JSON.stringify(playground.DATA, null, 2),
        agreementHtml: "",
        error: undefined,
        init: async () => {
          const params = new URLSearchParams(window.location.search);
          const compressedData = params.get("data");
          if (compressedData) {
            await get().loadFromLink(compressedData);
          } else {
            await get().rebuild();
          }
        },
        setContractArtifacts: async (
          model: string,
          template: string,
          dataJson: string,
        ) => {
          set(() => ({
            agreementHtml: "",
            error: undefined,
            templateMarkdown: template,
            editorValue: template,
            modelCto: model,
            editorModelCto: model,
            data: dataJson,
            editorAgreementData: dataJson,
          }));
          await get().rebuild();
        },
        rebuild: async () => {
          const { templateMarkdown, modelCto, data } = get();
          try {
            const result = await rebuildDeBounce(
              templateMarkdown,
              modelCto,
              data,
            );
            if (isCancelation(result)) return;
            set(() => ({ agreementHtml: result as string, error: undefined }));
          } catch (error: any) {
            console.error(
              "[Store] Rebuild error:",
              error instanceof Error ? error.message : error,
            );
            set(() => ({
              error: formatError(error),
            }));
            // Re-throw so callers (like setContractArtifacts) can catch and handle
            throw error;
          }
        },
        setTemplateMarkdown: async (template: string) => {
          set(() => ({ templateMarkdown: template }));
          const { modelCto, data } = get();
          try {
            const result = await rebuildDeBounce(template, modelCto, data);
            if (isCancelation(result)) return;
            set(() => ({ agreementHtml: result as string, error: undefined }));
          } catch (error: any) {
            set(() => ({
              error: formatError(error),
            }));
          }
        },
        setEditorValue: (value: string) => {
          set(() => ({ editorValue: value }));
        },
        setModelCto: async (model: string) => {
          set(() => ({ modelCto: model }));
          const { templateMarkdown, data } = get();
          try {
            const result = await rebuildDeBounce(templateMarkdown, model, data);
            if (isCancelation(result)) return;
            set(() => ({ agreementHtml: result as string, error: undefined }));
          } catch (error: any) {
            set(() => ({
              error: formatError(error),
            }));
          }
        },
        setEditorModelCto: (value: string) => {
          set(() => ({ editorModelCto: value }));
        },
        setData: async (data: string) => {
          set(() => ({ data }));
          try {
            const result = await rebuildDeBounce(
              get().templateMarkdown,
              get().modelCto,
              data,
            );
            if (isCancelation(result)) return;
            set(() => ({ agreementHtml: result as string, error: undefined }));
          } catch (error: any) {
            set(() => ({
              error: formatError(error),
            }));
          }
        },
        setEditorAgreementData: (value: string) => {
          set(() => ({ editorAgreementData: value }));
        },
        loadFromLink: async (compressedData: string) => {
          try {
            const { templateMarkdown, modelCto, data, agreementHtml } =
              decompress(compressedData);
            if (!templateMarkdown || !modelCto || !data) {
              throw new Error("Invalid share link data");
            }
            set(() => ({
              templateMarkdown,
              editorValue: templateMarkdown,
              modelCto,
              editorModelCto: modelCto,
              data,
              editorAgreementData: data,
              agreementHtml,
              error: undefined,
            }));
            await get().rebuild();
          } catch (error) {
            set(() => ({
              error:
                "Failed to load shared content: " +
                (error instanceof Error ? error.message : "Unknown error"),
            }));
          }
        },
      };
    }),
  ),
);

export default useAppStore;

function formatError(error: any): string {
  console.error(error);
  if (typeof error === "string") return error;
  if (Array.isArray(error)) return error.map((e) => formatError(e)).join("\n");
  if (error.code) {
    const sub = error.errors ? formatError(error.errors) : "";
    const msg = error.renderedMessage || "";
    return `Error: ${error.code} ${sub} ${msg}`;
  }
  return error.toString();
}
