import React, { useEffect, useState } from "react";
import { ToggleDarkModeContainer } from "../styles/components/ToggleDarkMode";
import { Switch } from "antd";
import useAppStore from "../store/store";

const ToggleDarkMode: React.FC = () => {
  const { backgroundColor, toggleDarkMode } = useAppStore();
  const [isDarkMode, setIsDarkMode] = useState(backgroundColor === "#121212");

  useEffect(() => {
    setIsDarkMode(backgroundColor === "#121212");
  }, [backgroundColor]);

  const handleChange = () => {
    toggleDarkMode();
    // state update is handled by useEffect listening to store
  };

  return (
    <ToggleDarkModeContainer>
      <Switch
        checked={isDarkMode}
        onChange={handleChange}
        checkedChildren="🌙"
        unCheckedChildren="☀️"
      />
    </ToggleDarkModeContainer>
  );
};

export default ToggleDarkMode;
