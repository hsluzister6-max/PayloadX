import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import styles from "./App.module.css";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import LandingPage from "./pages/LandingPage";
import SplashScreen from "./components/SplashScreen";
import Docs from "./Docs";
import { useTheme } from "./context/ThemeContext";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const { setTheme } = useTheme();
  const location = useLocation();
  const isDocs = location.pathname.startsWith("/docs");

  const handleSplashDone = useCallback(() => setShowSplash(false), []);

  useEffect(() => {
    if (!isDocs) setTheme("dark");
  }, [isDocs, setTheme]);

  useEffect(() => {
    if (isDocs) setShowSplash(false);
  }, [isDocs]);

  return (
    <div className={`${styles.root} ${isDocs ? styles.rootDocs : styles.rootHome}`}>
      {!isDocs && showSplash && <SplashScreen onDone={handleSplashDone} />}
      <Header />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          position: isDocs ? undefined : "relative",
        }}
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/docs/:sectionId" element={<Docs />} />
        </Routes>
      </div>
      {isDocs && <Footer />}
    </div>
  );
}
