import React, { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import styles from "./App.module.css";
import { FaApple, FaWindows, FaLinux } from "react-icons/fa6";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import PixelHero from "./components/PixelHero";
import Docs from "./Docs";
import { useTheme } from "./context/ThemeContext";

const REPO_URL = "https://github.com/hsluzister6-max/PayloadX";
const STATIC_DL = `${REPO_URL}/releases/download/main`;

const PLATFORMS = [
  { os: "macOS", arch: "Apple Silicon", icon: <FaApple />, primary: true, link: "#", comingSoon: true },
  { os: "Windows", arch: "x64", icon: <FaWindows />, link: `${STATIC_DL}/PayloadX_x64-setup.exe` },
  { os: "iOS", arch: "Beta", icon: <FaApple />, link: "#", comingSoon: true },
  { os: "Linux", arch: "AppImage", icon: <FaLinux />, link: `${STATIC_DL}/payload-x_amd64.AppImage` },
  { os: "Linux", arch: "Debian", icon: <FaLinux />, link: `${STATIC_DL}/payload-x_amd64.deb` },
];

export default function App() {
  const [userOS, setUserOS] = useState({
    name: "Windows",
    link: `${STATIC_DL}/PayloadX_x64-setup.exe`,
    icon: <FaWindows />,
  });
  const { setTheme } = useTheme();
  const location = useLocation();
  const isDocs = location.pathname.startsWith("/docs");

  // Landing home always runs in dark mode for the pixel hero
  useEffect(() => {
    if (!isDocs) setTheme("dark");
  }, [isDocs, setTheme]);

  useEffect(() => {
    const ua = window.navigator.userAgent;

    if (/iPad|iPhone|iPod/.test(ua)) {
      setUserOS({ name: "iOS", link: "#", icon: <FaApple /> });
    } else if (ua.indexOf("Win") !== -1) {
      setUserOS({ name: "Windows", link: `${STATIC_DL}/PayloadX_x64-setup.exe`, icon: <FaWindows /> });
    } else if (ua.indexOf("Mac") !== -1) {
      setUserOS({ name: "macOS", link: "#", icon: <FaApple /> });
    } else if (ua.indexOf("Linux") !== -1) {
      setUserOS({ name: "Linux", link: `${STATIC_DL}/payload-x_amd64.AppImage`, icon: <FaLinux /> });
    }
  }, []);

  return (
    <div className={`${styles.root} ${isDocs ? styles.rootDocs : styles.rootHome}`}>
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
          <Route
            path="/"
            element={
              <PixelHero
                description="The modern, lightweight alternative to Postman — built for developers who move fast."
                platforms={PLATFORMS}
                userOS={userOS}
                githubUrl={REPO_URL}
              />
            }
          />
          <Route path="/docs" element={<Docs />} />
          <Route path="/docs/:sectionId" element={<Docs />} />
        </Routes>
      </div>
      {isDocs && <Footer />}
    </div>
  );
}
