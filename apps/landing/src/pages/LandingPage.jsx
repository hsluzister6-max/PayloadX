import { useRef, useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRight } from "lucide-react";
import { FaApple, FaWindows, FaLinux } from "react-icons/fa6";
import DesktopShellMock from "../components/mocks/DesktopShellMock";
import DashboardMock from "../components/mocks/DashboardMock";
import WorkflowMock from "../components/mocks/WorkflowMock";
import HeroDashboard from "../components/mocks/HeroDashboard";
import styles from "./LandingPage.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const REPO_URL = "https://github.com/hsluzister6-max/PayloadX";
const RELEASE_TAG = "v1.0.10";
const RELEASE_DL = `${REPO_URL}/releases/download/${RELEASE_TAG}`;
// Filenames match GitHub Actions rename step (version stripped)
const MAC_DMG = `${RELEASE_DL}/PayloadX_aarch64.dmg`;
const WIN_SETUP = `${RELEASE_DL}/PayloadX_x64-setup.exe`;
const WIN_MSI = `${RELEASE_DL}/PayloadX_x64.msi`;
const LINUX_APPIMAGE = `${RELEASE_DL}/payload-x_amd64.AppImage`;
const LINUX_DEB = `${RELEASE_DL}/payload-x_amd64.deb`;

const PLATFORMS = [
  { os: "macOS", arch: "Apple Silicon", icon: <FaApple />, link: MAC_DMG },
  { os: "Windows", arch: "x64 Setup", icon: <FaWindows />, link: WIN_SETUP },
  { os: "Windows", arch: "x64 MSI", icon: <FaWindows />, link: WIN_MSI },
  { os: "iOS", arch: "Beta", icon: <FaApple />, link: "#", comingSoon: true },
  { os: "Linux", arch: "AppImage", icon: <FaLinux />, link: LINUX_APPIMAGE },
  { os: "Linux", arch: "Debian", icon: <FaLinux />, link: LINUX_DEB },
];

const PILLARS = [
  {
    num: "01",
    title: "Native since day one",
    body: "Rust powered core and Tauri shell deliver Postman class workflows without Electron bloat. Cold starts measured in milliseconds.",
  },
  {
    num: "02",
    title: "Local first protection",
    body: "Collections, secrets, and history stay on your machine by default. No forced cloud sync. Your APIs never leave your control.",
  },
  {
    num: "03",
    title: "Trackable request by request",
    body: "Inspect timing, headers, and payloads with clarity. Debug faster with a studio that treats every request as first class.",
  },
];

const PROPS = [
  {
    cat: "Performance",
    title: "Built for developers who ship",
    body: "PayloadX is engineered as a native desktop studio. TypeScript UI, Rust networking, and a UI that stays responsive under heavy collections.",
  },
  {
    cat: "Operations",
    title: "Studio as an operating system",
    body: "Environments, auth, scripting, and history run in one coherent surface so you can move from explore → assert → ship without context switching.",
  },
  {
    cat: "Open source",
    title: "Public code as an advantage",
    body: "Fork it, audit it, extend it. Open source means you can verify what runs against your APIs, and shape the roadmap with the community.",
  },
  {
    cat: "Privacy",
    title: "Committed to local clarity",
    body: "We provide full visibility into where data lives. Local first by design, with optional collaboration when you choose it, never by surprise.",
  },
  {
    cat: "Stack",
    title: "Partnered with the right tools",
    body: "Built on Rust, Tauri, and React, the same stack used for high trust, high performance desktop software, so PayloadX stays lean and protective.",
  },
];

const OPPORTUNITIES = [
  {
    title: "APIs are productive capital",
    body: "Every product ships through HTTP. A studio that is fast, private, and scriptable turns request work into compounding velocity.",
  },
  {
    title: "APIs secure the product economy",
    body: "Auth, contracts, and edge cases live in your collections. Treat them with the same care as production code: locally, versionably, safely.",
  },
  {
    title: "Tooling should scale with usage",
    body: "As services multiply, so do environments and secrets. PayloadX keeps that complexity on device and under your policies.",
  },
  {
    title: "Structural tailwinds favor native",
    body: "Teams are leaving heavyweight Electron apps for native speed and privacy. PayloadX is built for that shift.",
  },
];

const FAQS = [
  {
    q: "What is PayloadX?",
    a: "PayloadX is a high performance, Rust powered API studio for testing, debugging, and collaborating on APIs, a modern, local first alternative to Postman.",
  },
  {
    q: "How is PayloadX different from Postman?",
    a: "PayloadX ships as a native Tauri desktop app with a Rust core. It prioritizes speed, low memory use, and local first data so your collections and secrets stay protective by default.",
  },
  {
    q: "Where does my data live?",
    a: "On your machine. PayloadX is local first: requests, environments, and history are stored locally unless you explicitly configure external sync.",
  },
  {
    q: "Which platforms are supported?",
    a: "Windows, Linux, and macOS (Apple Silicon) builds are available today. iOS is on the roadmap. Check the download section for current installers.",
  },
  {
    q: "Is PayloadX open source?",
    a: "Yes. The project is open source on GitHub. You can inspect the code, open issues, and contribute features or fixes.",
  },
  {
    q: "Does PayloadX require an account?",
    a: "No account is required to download and use the core studio. You stay productive without handing your API traffic to a SaaS middleman.",
  },
];

function detectUserOS() {
  if (typeof window === "undefined") {
    return { name: "macOS", link: MAC_DMG, icon: <FaApple /> };
  }
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return { name: "macOS", link: MAC_DMG, icon: <FaApple /> };
  if (ua.includes("Win")) return { name: "Windows", link: WIN_SETUP, icon: <FaWindows /> };
  if (ua.includes("Mac")) return { name: "macOS", link: MAC_DMG, icon: <FaApple /> };
  if (ua.includes("Linux")) return { name: "Linux", link: LINUX_APPIMAGE, icon: <FaLinux /> };
  return { name: "macOS", link: MAC_DMG, icon: <FaApple /> };
}

function splitTitle(text) {
  const words = text.split(" ");
  return words.map((word, wi) => (
    <span key={wi} className={`${styles.titleWord} word`}>
      {word.split("").map((ch, ci) => (
        <span key={`${wi}-${ci}`} className={`${styles.titleChar} char`}>
          {ch}
        </span>
      ))}
      {wi < words.length - 1 ? (
        <span className={styles.titleSpace} aria-hidden="true">
          {"\u00A0"}
        </span>
      ) : null}
    </span>
  ));
}

export default function LandingPage() {
  const rootRef = useRef(null);
  const answerRefs = useRef([]);
  const [openFaq, setOpenFaq] = useState(0);
  const [userOS] = useState(detectUserOS);
  const location = useLocation();
  const downloadLink = userOS.link && userOS.link !== "#" ? userOS.link : MAC_DMG;
  const downloadLabel = userOS.link && userOS.link !== "#" ? userOS.name : "macOS";
  const titleChars = useMemo(() => splitTitle("APIs with an Edge"), []);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [location.hash]);

  useEffect(() => {
    answerRefs.current.forEach((el, i) => {
      if (!el) return;
      if (openFaq === i) {
        gsap.to(el, { height: "auto", autoAlpha: 1, duration: 0.45, ease: "power2.out" });
      } else {
        gsap.to(el, { height: 0, autoAlpha: 0, duration: 0.3, ease: "power2.in" });
      }
    });
  }, [openFaq]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: "(min-width: 961px)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { isDesktop, reduceMotion } = context.conditions;

          // Scroll progress
          gsap.set(".progress-fill", { scaleX: 0, transformOrigin: "left center" });
          gsap.to(".progress-fill", {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: rootRef.current,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.35,
            },
          });

          if (reduceMotion) {
            gsap.set(
              [
                ".hero-anim",
                ".char",
                ".reveal",
                ".pillar",
                ".prop-card",
                ".opp-item",
                ".stat",
                ".dl-card",
                ".faq-item",
              ],
              { autoAlpha: 1, y: 0, x: 0, clearProps: "transform" }
            );
            return;
          }

          // Ambient orbs parallax
          gsap.to(".orb-a", {
            y: 180,
            x: -60,
            ease: "none",
            scrollTrigger: { trigger: rootRef.current, start: "top top", end: "bottom bottom", scrub: 1.2 },
          });
          gsap.to(".orb-b", {
            y: -220,
            x: 80,
            ease: "none",
            scrollTrigger: { trigger: rootRef.current, start: "top top", end: "bottom bottom", scrub: 1.5 },
          });

          // Hero entrance — VFX char cascade
          const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
          heroTl
            .from(".hero-brand", { autoAlpha: 0, y: 30, duration: 0.6 })
            .from(
              ".hero-title .char",
              { autoAlpha: 0, y: 36, stagger: 0.016, duration: 0.65, ease: "power3.out" },
              "-=0.25"
            )
            .from(".hero-lead", { autoAlpha: 0, y: 28, duration: 0.7 }, "-=0.35")
            .from(".hero-cta", { autoAlpha: 0, y: 22, scale: 0.96, stagger: 0.1, duration: 0.55 }, "-=0.4")
            .from(".hero-listed", { autoAlpha: 0, y: 16, duration: 0.5 }, "-=0.25")
            .from(".hero-canvas", { autoAlpha: 0, y: 16, duration: 0.9 }, 0)
            .from(".scroll-hint", { autoAlpha: 0, y: 12, duration: 0.5 }, "-=0.3");

          gsap.to(".scroll-line", {
            scaleY: 0.35,
            opacity: 0.4,
            repeat: -1,
            yoyo: true,
            duration: 1.1,
            ease: "sine.inOut",
          });

          // Hero exit scrub
          gsap
            .timeline({
              scrollTrigger: {
                trigger: ".hero-section",
                start: "top top",
                end: "bottom top",
                scrub: 1,
              },
            })
            .to(".hero-content", { y: -48, autoAlpha: 0.35, ease: "none" }, 0)
            .to(".scroll-hint", { autoAlpha: 0, ease: "none" }, 0);

          // Intro wipe
          gsap.from(".intro-copy", {
            autoAlpha: 0,
            y: 80,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: ".intro-section", start: "top 75%", toggleActions: "play none none reverse" },
          });
          gsap.from(".news-card", {
            autoAlpha: 0,
            x: 60,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: ".intro-section", start: "top 70%", toggleActions: "play none none reverse" },
          });

          // Stats — cinematic slam-in
          const statsTl = gsap.timeline({
            scrollTrigger: {
              trigger: ".stats-grid",
              start: "top 78%",
              toggleActions: "play none none reverse",
            },
          });
          statsTl.from(".stat", {
            autoAlpha: 0,
            y: 80,
            rotateX: 18,
            stagger: 0.12,
            duration: 0.85,
            ease: "power3.out",
          });

          gsap.utils.toArray(".stat").forEach((stat) => {
            const bar = stat.querySelector(".stat-bar");
            if (bar) {
              gsap.fromTo(
                bar,
                { scaleX: 0 },
                {
                  scaleX: 1,
                  duration: 0.8,
                  ease: "power2.out",
                  scrollTrigger: { trigger: stat, start: "top 85%", toggleActions: "play none none reverse" },
                }
              );
            }
          });

          // Productivity pin reel (desktop)
          if (isDesktop) {
            const pillars = gsap.utils.toArray(".pillar");
            gsap.set(pillars, { autoAlpha: 0, y: 40 });
            gsap.set(pillars[0], { autoAlpha: 1, y: 0 });

            const prodTl = gsap.timeline({
              scrollTrigger: {
                trigger: ".prod-pin",
                start: "top top",
                end: () => `+=${window.innerHeight * 2.4}`,
                pin: true,
                scrub: 1,
                anticipatePin: 1,
              },
            });

            pillars.forEach((pillar, i) => {
              if (i === 0) return;
              const prev = pillars[i - 1];
              prodTl
                .to(prev, { autoAlpha: 0, y: -50, duration: 0.4 }, i)
                .fromTo(pillar, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.4 }, i);
            });

            gsap.from(".prod-copy .section-title", {
              y: 40,
              autoAlpha: 0,
              scrollTrigger: {
                trigger: ".prod-pin",
                start: "top 80%",
                end: "top 40%",
                scrub: true,
              },
            });
          } else {
            gsap.from(".pillar", {
              autoAlpha: 0,
              y: 50,
              stagger: 0.15,
              duration: 0.8,
              ease: "power2.out",
              scrollTrigger: { trigger: ".pillars-grid", start: "top 80%", toggleActions: "play none none none" },
            });
          }

          // Horizontal props scroll (desktop) — start only when section fills the viewport
          if (isDesktop) {
            const track = document.querySelector(".h-track");
            const stack = document.querySelector(".stack-section");
            if (track && stack) {
              const getScroll = () => -(track.scrollWidth - window.innerWidth + 72);
              gsap.to(track, {
                x: getScroll,
                ease: "none",
                scrollTrigger: {
                  trigger: stack,
                  // Wait until the whole section is parked at the top of the screen
                  start: "top top",
                  end: () => `+=${Math.max(track.scrollWidth * 0.85, window.innerHeight)}`,
                  pin: true,
                  scrub: 0.85,
                  anticipatePin: 0,
                  invalidateOnRefresh: true,
                  // Don't begin scrubbing until the pin is actually engaged
                  preventOverlaps: true,
                },
              });
            }
          } else {
            gsap.from(".prop-card", {
              autoAlpha: 0,
              y: 40,
              stagger: 0.1,
              scrollTrigger: { trigger: ".h-track", start: "top 85%", toggleActions: "play none none none" },
            });
          }

          // Band title scale scrub
          gsap.fromTo(
            ".band-title",
            { scale: 0.7, autoAlpha: 0, y: 80 },
            {
              scale: 1,
              autoAlpha: 1,
              y: 0,
              ease: "none",
              scrollTrigger: {
                trigger: ".band-section",
                start: "top 80%",
                end: "top 35%",
                scrub: 1,
              },
            }
          );

          // Opportunity stagger
          gsap.from(".opp-item", {
            autoAlpha: 0,
            x: 50,
            stagger: 0.12,
            duration: 0.75,
            ease: "power3.out",
            scrollTrigger: { trigger: ".opp-list", start: "top 78%", toggleActions: "play none none reverse" },
          });

          gsap.from(".opp-sticky", {
            autoAlpha: 0,
            y: 40,
            duration: 0.9,
            scrollTrigger: { trigger: ".opp-section", start: "top 75%", toggleActions: "play none none reverse" },
          });

          // FAQ items
          gsap.from(".faq-item", {
            autoAlpha: 0,
            y: 30,
            stagger: 0.08,
            duration: 0.6,
            scrollTrigger: { trigger: ".faq-list", start: "top 80%", toggleActions: "play none none none" },
          });

          // Downloads
          gsap.from(".dl-card", {
            autoAlpha: 0,
            y: 40,
            scale: 0.96,
            stagger: 0.08,
            duration: 0.65,
            ease: "power2.out",
            scrollTrigger: { trigger: ".dl-grid", start: "top 85%", toggleActions: "play none none none" },
          });

          // Generic reveals
          gsap.utils.toArray(".reveal").forEach((el) => {
            gsap.from(el, {
              autoAlpha: 0,
              y: 50,
              duration: 0.85,
              ease: "power2.out",
              scrollTrigger: {
                trigger: el,
                start: "top 85%",
                toggleActions: "play none none reverse",
              },
            });
          });
        }
      );

      return () => mm.revert();
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef} className={styles.page}>
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.progressRail} aria-hidden="true">
        <div className={`${styles.progressFill} progress-fill`} />
      </div>
      <div className={`${styles.orb} ${styles.orbA} orb-a`} aria-hidden="true" />
      <div className={`${styles.orb} ${styles.orbB} orb-b`} aria-hidden="true" />

      <section className={`${styles.hero} hero-section`} id="home">
        <HeroDashboard
          titleChars={titleChars}
          downloadLink={downloadLink}
          downloadLabel={downloadLabel}
        />
        <div className={`${styles.scrollHint} scroll-hint`} aria-hidden="true">
          <span>Scroll</span>
          <div className={`${styles.scrollLine} scroll-line`} />
        </div>
      </section>

      <section className={`${styles.intro} intro-section`} id="product">
        <p className={`${styles.introCopy} intro-copy`}>
          By combining native performance, local first custody of your data, and
          a studio built for real workflows, we set a new standard for how API
          tooling should feel: fast, clear, and under your control.
        </p>
        <aside className={`${styles.newsCard} news-card`}>
          <p className={styles.newsEyebrow}>Product news</p>
          <h2 className={styles.newsTitle}>Open beta · Desktop builds live</h2>
          <p className={styles.newsMeta}>Windows, Linux &amp; macOS (Apple Silicon) installers</p>
        </aside>
      </section>

      <section className={`${styles.showcase} showcase-section`} aria-label="PayloadX studio">
        <div className={`${styles.showcaseHeader} reveal`}>
          <p className={styles.sectionEyebrow}>Request studio</p>
          <h2 className={styles.sectionTitle}>Ship requests with clarity</h2>
          <p className={styles.sectionLead}>
            Method, environment variables, body, and response. The same desktop surface, live.
          </p>
        </div>
        <div className={`${styles.showcaseStage} reveal`}>
          <DesktopShellMock variant="section" />
        </div>
      </section>

      <section className={`${styles.showcase} showcase-section`} aria-label="PayloadX workflows">
        <div className={`${styles.showcaseHeader} reveal`}>
          <p className={styles.sectionEyebrow}>Workflows</p>
          <h2 className={styles.sectionTitle}>APIs that run themselves</h2>
          <p className={styles.sectionLead}>
            Login → profile → delay → teams. Watch the graph execute step by step.
          </p>
        </div>
        <div className={`${styles.showcaseStage} reveal`}>
          <WorkflowMock />
        </div>
      </section>

      <section className={`${styles.showcase} showcase-section`} aria-label="PayloadX dashboard">
        <div className={`${styles.showcaseHeader} reveal`}>
          <p className={styles.sectionEyebrow}>Analytics</p>
          <h2 className={styles.sectionTitle}>Clarity across every run</h2>
          <p className={styles.sectionLead}>
            Methods, latency, and recent activity. A clean workspace overview without the noise.
          </p>
        </div>
        <div className={`${styles.showcaseStage} reveal`}>
          <DashboardMock />
        </div>
      </section>

      <section className={`${styles.statsPin}`} id="dashboard" aria-label="Product metrics">
        <div className={`${styles.stats} stats-grid`}>
          {[
            { label: "Runtime", value: "Native", hint: "Rust + Tauri core" },
            { label: "Data model", value: "Local first", hint: "Your machine, your keys" },
            { label: "License", value: "Open", hint: "Audit on GitHub" },
            { label: "Cloud tax", value: "$0", hint: "No account required" },
          ].map((s) => (
            <div key={s.label} className={`${styles.stat} stat`}>
              <div
                className="stat-bar"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 2,
                  background: "linear-gradient(90deg, var(--accent), transparent)",
                  transformOrigin: "left center",
                }}
              />
              <p className={styles.statLabel}>{s.label}</p>
              <p className={styles.statValue}>{s.value}</p>
              <p className={styles.statHint}>{s.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.productivity} id="features">
        <div className={`${styles.prodPin} prod-pin`}>
          <div className={`${styles.prodCopy} prod-copy`}>
            <p className={`${styles.sectionEyebrow} reveal`}>Pioneering productivity</p>
            <h2 className={`${styles.sectionTitle} section-title`}>Built to compound velocity</h2>
            <p className={`${styles.sectionLead} reveal`}>
              Native protocol speed, protective defaults, and day by day clarity.
              Scroll the reel like a VFX sequence.
            </p>
          </div>
          <div className={`${styles.pillars} pillars-grid`}>
            {PILLARS.map((p, i) => (
              <article
                key={p.num}
                className={`${styles.pillar} pillar ${i === 0 ? styles.pillarActive : ""}`}
              >
                <p className={styles.pillarNum}>{p.num}</p>
                <h3 className={styles.pillarTitle}>{p.title}</h3>
                <p className={styles.pillarBody}>{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.stack} stack-section`} id="stack">
        <div className={`${styles.stackHeader} reveal`}>
          <p className={styles.stackLabel}>Propositions</p>
          <h2 className={styles.sectionTitle}>The stack for shipping APIs</h2>
        </div>
        <div className={`${styles.hScroll} h-scroll`}>
          <div className={`${styles.hTrack} h-track`}>
            {PROPS.map((item) => (
              <article key={item.cat} className={`${styles.propCard} prop-card`}>
                <span className={styles.propCat}>{item.cat}</span>
                <h3 className={styles.propTitle}>{item.title}</h3>
                <p className={styles.propBody}>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.band} band-section`}>
        <h2 className={`${styles.bandTitle} band-title`}>
          APIs for everyone, <em>engineered to move fast.</em>
        </h2>
        <div className={styles.bandCtas}>
          <a
            href={downloadLink}
            className={styles.btnPrimary}
            download
          >
            Download PayloadX
          </a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={styles.btnGhost}>
            View on GitHub
          </a>
        </div>
      </section>

      <section className={`${styles.opportunity} opp-section`} id="opportunity">
        <div className={`${styles.oppSticky} opp-sticky`}>
          <p className={styles.sectionEyebrow}>The opportunity</p>
          <h2 className={styles.sectionTitle}>The tooling shift of a generation</h2>
          <p className={styles.sectionLead}>
            API surfaces are the world&apos;s product ledger. Developers deserve a
            studio that is as serious as the systems they protect.
          </p>
          <Link to="/docs" className={styles.oppLink}>
            Learn more
          </Link>
        </div>
        <ul className={`${styles.oppList} opp-list`}>
          {OPPORTUNITIES.map((item) => (
            <li key={item.title} className={`${styles.oppItem} opp-item`}>
              <h3 className={styles.oppItemTitle}>{item.title}</h3>
              <p className={styles.oppItemBody}>{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.faq} id="faq">
        <div className={`${styles.faqHeader} reveal`}>
          <div>
            <p className={styles.sectionEyebrow}>FAQ</p>
            <h2 className={styles.sectionTitle}>Got more questions?</h2>
          </div>
          <a
            href="https://github.com/hsluzister6-max/PayloadX/issues"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.faqReach}
          >
            Reach us
          </a>
        </div>
        <div className={`${styles.faqList} faq-list`}>
          {FAQS.map((item, i) => {
            const open = openFaq === i;
            const num = String(i + 1).padStart(2, "0");
            return (
              <div key={item.q} className={`${styles.faqItem} faq-item`}>
                <button
                  type="button"
                  className={styles.faqBtn}
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? -1 : i)}
                >
                  <span className={styles.faqNum}>{num}</span>
                  <h3 className={styles.faqQ}>{item.q}</h3>
                  <span className={styles.faqIcon} aria-hidden>
                    {open ? "−" : "+"}
                  </span>
                </button>
                <div
                  ref={(el) => {
                    answerRefs.current[i] = el;
                  }}
                  className={styles.faqAnswer}
                >
                  <p>{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.downloads} id="download">
        <p className={`${styles.sectionEyebrow} reveal`}>Download</p>
        <h2 className={`${styles.sectionTitle} reveal`}>Get PayloadX</h2>
        <p className={`${styles.sectionLead} reveal`}>
          Pick your platform. Installers ship from GitHub Releases.
        </p>
        <div className={`${styles.dlGrid} dl-grid`}>
          {PLATFORMS.map((p) => {
            const soon = p.comingSoon || p.link === "#";
            return (
              <a
                key={`${p.os}-${p.arch}`}
                href={soon ? undefined : p.link}
                className={`${styles.dlCard} dl-card ${soon ? styles.dlCardDisabled : ""}`}
                aria-disabled={soon}
              >
                <span className={styles.dlOs}>
                  {p.icon} {p.os}
                </span>
                <span className={styles.dlArch}>{soon ? "Coming soon" : p.arch}</span>
              </a>
            );
          })}
        </div>
      </section>

      <footer className={styles.siteFooter}>
        <div>
          <p className={styles.footerBrandLine}>PayloadX</p>
          <p className={styles.footerNote}>
            PayloadX is the open source API studio giving developers a smarter,
            more protective way to work with HTTP.
          </p>
        </div>
        <div>
          <p className={styles.footerColTitle}>Navigation</p>
          <ul className={styles.footerLinks}>
            <li><a href="#home">Home</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#opportunity">Opportunity</a></li>
            <li><a href="#download">Download</a></li>
            <li><Link to="/docs">Docs</Link></li>
          </ul>
        </div>
        <div>
          <p className={styles.footerColTitle}>Social</p>
          <ul className={styles.footerLinks}>
            <li>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/sundan-sharma/"
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} PayloadX. All rights reserved.</span>
          <span>
            Crafted by{" "}
            <a
              href="https://www.linkedin.com/in/sundan-sharma/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sundan Sharma
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
