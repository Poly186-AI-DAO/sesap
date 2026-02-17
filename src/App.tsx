import { useEffect, useState, useRef } from "react";
import { App as AntdApp, Layout, Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import useAppStore from "./store/store";
import MainContainer from "./pages/MainContainer";
import "./styles/App.css";

const { Content } = Layout;

const App = () => {
  const navigate = useNavigate();
  const init = useAppStore((state) => state.init);
  const loadFromLink = useAppStore((state) => state.loadFromLink);
  const backgroundColor = useAppStore((state) => state.backgroundColor);
  const textColor = useAppStore((state) => state.textColor);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const initCalledRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-mount causing race conditions
    if (initCalledRef.current) return;
    initCalledRef.current = true;

    const initializeApp = async () => {
      try {
        setLoading(true);
        const compressedData = searchParams.get("data");
        if (compressedData) {
          await loadFromLink(compressedData);
          if (window.location.pathname !== "/") {
            navigate("/", { replace: true });
          }
        } else {
          await init();
        }
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setLoading(false);
      }
    };
    void initializeApp();
  }, [init, loadFromLink, searchParams, navigate]);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .ant-collapse-header {
        color: ${textColor} !important;
      }
      .ant-collapse-content {
        background-color: ${backgroundColor} !important;
      }
      .ant-collapse-content-active {
        background-color: ${backgroundColor} !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [backgroundColor, textColor]);

  return (
    <AntdApp>
      <Layout style={{ minHeight: "100vh", background: backgroundColor }}>
        <Navbar />
        <Content
          className="app-layout"
          style={{ background: backgroundColor, display: "flex", flex: 1 }}
        >
          {loading ? (
            <div
              className="app-content-loading"
              style={{
                background: backgroundColor,
              }}
            >
              <Spinner />
            </div>
          ) : (
            <div
              className="app-main-content"
              style={{
                background: backgroundColor,
              }}
            >
              <MainContainer />
            </div>
          )}
        </Content>
      </Layout>
    </AntdApp>
  );
};

const Spinner = () => (
  <div className="app-spinner-container">
    <Spin
      indicator={<LoadingOutlined style={{ fontSize: 42, color: "#19c6c7" }} spin />}
    />
  </div>
);

export default App;
