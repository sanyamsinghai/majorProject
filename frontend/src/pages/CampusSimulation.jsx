import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sirenEngine } from "../utils/sirenAudio";
import { speak, stop as stopSpeech } from "../utils/speech";

const SCENARIOS = [
  {
    id: "svvv-fire",
    title: "SVVV Block B: Electrical Lab Fire Drill",
    building: "Block B — Engineering Wing, Level 2",
    dangerLevel: "High",
    hazard: "Dense Smoke & Electrical Fire",
    safeZone: "SVVV Central Sports Ground",
    defaultSeconds: 90,
  },
  {
    id: "svvv-earthquake",
    title: "SVVV Campus: Seismic Tremor & Rapid Evacuation",
    building: "Main Academic Complex, Level 3",
    dangerLevel: "Critical",
    hazard: "Structural Vibrations & Broken Glass",
    safeZone: "SVVV Open Assembly Lawn",
    defaultSeconds: 75,
  },
];

export default function CampusSimulation() {
  const { user } = useAuth();
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0]);
  const [viewMode, setViewMode] = useState("svvv-live"); // "svvv-live" | "tactical-hotspots"
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  // Telemetry & State
  const [timeLeft, setTimeLeft] = useState(SCENARIOS[0].defaultSeconds);
  const [vitals, setVitals] = useState(100);
  const [score, setScore] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [voiceAssistance, setVoiceAssistance] = useState(true);

  // Objectives checklist
  const [alarmTriggered, setAlarmTriggered] = useState(false);
  const [airwayCovered, setAirwayCovered] = useState(false);
  const [extinguisherCollected, setExtinguisherCollected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState("lab"); // "lab" | "corridor" | "stairwell" | "safe-zone"
  const [logMessages, setLogMessages] = useState([]);
  const [wrongChoiceAlert, setWrongChoiceAlert] = useState("");

  const timerRef = useRef(null);

  const addLog = useCallback((msg, type = "info") => {
    setLogMessages((prev) => [
      { text: msg, type, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 4),
    ]);
  }, []);

  // Voice announcer helper
  const announce = useCallback(
    (text) => {
      if (voiceAssistance) {
        speak(text);
      }
    },
    [voiceAssistance]
  );

  // Start scenario
  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setWon(false);
    setTimeLeft(selectedScenario.defaultSeconds);
    setVitals(100);
    setScore(0);
    setAlarmTriggered(false);
    setAirwayCovered(false);
    setExtinguisherCollected(false);
    setCurrentRoom("lab");
    setLogMessages([]);
    setWrongChoiceAlert("");

    addLog(`Drill initialized at ${selectedScenario.building}.`, "info");
    announce(`Emergency alert initiated. Evacuate ${selectedScenario.building} immediately.`);

    if (soundEnabled) {
      sirenEngine.startAlarm();
    }
  };

  // Toggle sound
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next && gameStarted && !gameOver) {
      sirenEngine.startAlarm();
    } else {
      sirenEngine.stopAlarm();
    }
  };

  // Action handlers
  const handleSoundAlarm = () => {
    if (alarmTriggered) return;
    setAlarmTriggered(true);
    setScore((s) => s + 25);
    sirenEngine.playBeep(true);
    addLog("Manual Fire Alarm pulled! Department warden alerted. (+25 pts)", "success");
    announce("Manual fire alarm activated. Alerting campus security.");
  };

  const handleCoverAirway = () => {
    if (airwayCovered) return;
    setAirwayCovered(true);
    setScore((s) => s + 20);
    sirenEngine.playBeep(true);
    addLog("Covered nose with cloth and assumed low-crouch posture. (+20 pts)", "success");
    announce("Airway protected. Stay low below rising smoke.");
  };

  const handleGrabExtinguisher = () => {
    if (extinguisherCollected) return;
    setExtinguisherCollected(true);
    setScore((s) => s + 15);
    sirenEngine.playBeep(true);
    addLog("CO2 Extinguisher equipped to personal inventory. (+15 pts)", "success");
    announce("Fire extinguisher equipped.");
  };

  // Route choices
  const handleRouteChoice = (choice) => {
    if (choice === "elevator") {
      setWrongChoiceAlert(
        "CRITICAL ERROR: NEVER use elevators during a fire! Power failure can trap you inside."
      );
      setVitals((v) => Math.max(0, v - 30));
      setScore((s) => Math.max(0, s - 20));
      sirenEngine.playBeep(false);
      addLog("Elevator hazard! Lost 30% vitals due to electrical trap risk.", "danger");
      announce("Warning! Never use elevators during an emergency.");
    } else if (choice === "storage") {
      setWrongChoiceAlert(
        "HAZARD: Storage rooms contain volatile solvents and lack secondary exits!"
      );
      setVitals((v) => Math.max(0, v - 25));
      sirenEngine.playBeep(false);
      addLog("Hazard area entered! Inhaled solvent vapors (-25% vitals).", "danger");
      announce("Danger! Flammable chemicals detected. Turn back.");
    } else if (choice === "stairwell") {
      setWrongChoiceAlert("");
      setScore((s) => s + 40);
      sirenEngine.playBeep(true);
      setCurrentRoom("safe-zone");
      endGame(true);
    }
  };

  const endGame = useCallback(
    (isWin) => {
      setGameOver(true);
      setWon(isWin);
      sirenEngine.stopAlarm();
      if (timerRef.current) clearInterval(timerRef.current);

      if (isWin) {
        announce("Congratulations. You have safely evacuated to the SVVV Central Assembly Ground.");
      } else {
        announce("Simulation terminated. Evacuation window closed or vitals depleted.");
      }
    },
    [announce]
  );

  // Timer loop
  useEffect(() => {
    if (gameStarted && !gameOver) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            endGame(false);
            return 0;
          }
          return prev - 1;
        });

        // Smoke inhalation if airway not covered
        if (!airwayCovered) {
          setVitals((prev) => {
            if (prev <= 2) {
              endGame(false);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted, gameOver, airwayCovered, endGame]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      sirenEngine.stopAlarm();
      stopSpeech();
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl pb-12">
      {/* Title & Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
              SVVV Campus Digital Twin
            </span>
            <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
              Interactive 3D Simulation MVP
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            Campus 360° Disaster Evacuation Simulator
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Practice spatial evacuation routes inside the actual 360° environment of Shri Vaishnav Vidyapeeth Vishwavidyalaya.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              soundEnabled
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>{soundEnabled ? "🔊 Siren ON" : "🔇 Siren Muted"}</span>
          </button>

          <button
            onClick={() => setVoiceAssistance(!voiceAssistance)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              voiceAssistance
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>{voiceAssistance ? "🗣️ Voice Guide ON" : "🤐 Voice Muted"}</span>
          </button>
        </div>
      </div>

      {!gameStarted ? (
        /* MISSION BRIEFING & SETUP SCREEN */
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-bold text-slate-900">1. Select Emergency Scenario</h2>
            <p className="mt-1 text-xs text-slate-500">
              Choose a campus disaster scenario to simulate in the 360° environment.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {SCENARIOS.map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc)}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selectedScenario.id === sc.id
                      ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
                      {sc.dangerLevel}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      ⏱️ {sc.defaultSeconds}s limit
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-900">{sc.title}</h3>
                  <p className="mt-1 text-xs text-slate-600">📍 {sc.building}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-2 text-[11px] text-slate-500">
                    <span>Hazard: {sc.hazard}</span>
                    <span className="font-semibold text-green-700">Safe: {sc.safeZone}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Mode selection */}
            <div className="mt-6 border-t border-slate-200 pt-6">
              <h2 className="text-lg font-bold text-slate-900">2. Choose Simulator Mode</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setViewMode("svvv-live")}
                  className={`rounded-xl border p-4 text-left transition ${
                    viewMode === "svvv-live"
                      ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="text-lg">🌐</div>
                  <div className="mt-1 font-bold text-slate-900 text-sm">
                    Live SVVV 360° Virtual Tour Embed
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Streams the official 360° virtual tour of SVVV with our reactive Emergency HUD overlay.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("tactical-hotspots")}
                  className={`rounded-xl border p-4 text-left transition ${
                    viewMode === "tactical-hotspots"
                      ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="text-lg">🧭</div>
                  <div className="mt-1 font-bold text-slate-900 text-sm">
                    Tactical Hotspot Mode (Interactive Rooms)
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Interactive clickable decision nodes with simulated spatial hazards and exit markers.
                  </p>
                </button>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <button
                onClick={startGame}
                className="flex-1 rounded-xl bg-blue-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-800"
              >
                🚨 Initiate 360° Disaster Drill
              </button>
              <Link
                to="/dashboard"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>

          {/* Quick instructions & SVVV Context Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              SVVV Campus Ready
            </h3>
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <h4 className="text-sm font-bold text-blue-900">Digital Twin Integration</h4>
              <p className="mt-1 text-xs text-blue-800/90 leading-relaxed">
                This module uses the 360° spatial mapping of <strong>Shri Vaishnav Vidyapeeth Vishwavidyalaya (Indore)</strong> to train students on real evacuation routes.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Drill Survival Rules:
              </h4>
              <div className="flex items-start gap-2 text-xs text-slate-600">
                <span className="font-bold text-blue-800">1.</span>
                <span>Sound the alarm box to notify the entire floor immediately.</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-600">
                <span className="font-bold text-blue-800">2.</span>
                <span>Cover your airway and crouch low to prevent toxic smoke inhalation.</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-600">
                <span className="font-bold text-blue-800">3.</span>
                <span><strong>Never</strong> take an elevator during a fire or earthquake drill.</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-600">
                <span className="font-bold text-blue-800">4.</span>
                <span>Follow green fire exit stairwells down to the open assembly ground.</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ACTIVE SIMULATION VIEWPORT & HUD */
        <div className="relative rounded-2xl border border-slate-300 bg-slate-950 p-2 shadow-2xl overflow-hidden">
          {/* TOP EMERGENCY HUD BAR */}
          <div className="mb-2 rounded-xl bg-slate-900/95 border border-slate-800 p-3 text-white backdrop-blur flex flex-wrap items-center justify-between gap-4">
            {/* Live Status Indicator */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-red-400">
                  {selectedScenario.title}
                </div>
                <div className="text-[11px] text-slate-400">
                  Target Safe Zone: <span className="text-emerald-400 font-semibold">{selectedScenario.safeZone}</span>
                </div>
              </div>
            </div>

            {/* Vitality & Score Bar */}
            <div className="flex items-center gap-6">
              {/* Timer */}
              <div className="text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Time Left</div>
                <div
                  className={`text-lg font-mono font-bold ${
                    timeLeft < 25 ? "text-red-400 animate-pulse" : "text-amber-400"
                  }`}
                >
                  ⏱️ {timeLeft}s
                </div>
              </div>

              {/* Vitals */}
              <div className="w-28 sm:w-36">
                <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400">
                  <span>Oxygen / Health</span>
                  <span className={vitals < 40 ? "text-red-400" : "text-emerald-400"}>
                    {vitals}%
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      vitals > 60
                        ? "bg-emerald-500"
                        : vitals > 30
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${vitals}%` }}
                  />
                </div>
              </div>

              {/* Score */}
              <div className="text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Safety Score</div>
                <div className="text-lg font-mono font-bold text-blue-400">{score} pts</div>
              </div>

              {/* Abort button */}
              <button
                onClick={() => setGameStarted(false)}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition"
              >
                Abort Drill
              </button>
            </div>
          </div>

          {/* MAIN 360° VIEWPORT CANVAS / IFRAME */}
          <div className="relative h-[550px] w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
            {viewMode === "svvv-live" ? (
              /* Embedded SVVV 360 Virtual Tour */
              <div className="relative h-full w-full">
                <iframe
                  title="SVVV 360 Campus Map"
                  src="https://svvv.clickeffect.in/"
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; xr-spatial-tracking"
                  allowFullScreen
                />

                {/* Subtitle / Navigation Instruction Hint */}
                <div className="absolute top-4 left-4 rounded-xl bg-slate-900/85 backdrop-blur border border-slate-700/80 px-4 py-2 text-xs text-white max-w-sm pointer-events-none shadow-lg">
                  <p className="font-semibold text-amber-300">💡 360° Spatial Navigation</p>
                  <p className="mt-0.5 text-slate-300 text-[11px]">
                    Drag your mouse across the screen to look 360° around the SVVV campus. Use the tactical actions below to survive!
                  </p>
                </div>
              </div>
            ) : (
              /* Tactical Hotspot Room Canvas */
              <div className="relative h-full w-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
                {/* Simulated Panorama Room Background */}
                <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]"></div>

                {/* Simulated smoke overlay */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-red-950/20 via-slate-900/40 to-transparent"></div>

                <div className="relative z-10 max-w-xl">
                  <div className="inline-flex rounded-full bg-red-900/60 border border-red-500/50 px-3 py-1 text-xs text-red-300 font-semibold mb-3">
                    🚨 Simulated Zone: {selectedScenario.building}
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Heavy Smoke Detected in Corridor!
                  </h3>
                  <p className="mt-2 text-xs text-slate-300">
                    Visibility is dropping rapidly. You must execute immediate safety protocols and select your evacuation path.
                  </p>

                  {/* Interactive Hotspot Buttons inside the scene */}
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <button
                      onClick={handleSoundAlarm}
                      disabled={alarmTriggered}
                      className={`rounded-xl border p-3 text-xs font-bold transition flex flex-col items-center gap-1 ${
                        alarmTriggered
                          ? "border-emerald-600 bg-emerald-950/50 text-emerald-300 opacity-80"
                          : "border-red-500 bg-red-900/40 hover:bg-red-800/60 text-white animate-pulse"
                      }`}
                    >
                      <span className="text-xl">🚨</span>
                      <span>{alarmTriggered ? "Alarm Pulled ✓" : "Pull Wall Alarm"}</span>
                    </button>

                    <button
                      onClick={handleGrabExtinguisher}
                      disabled={extinguisherCollected}
                      className={`rounded-xl border p-3 text-xs font-bold transition flex flex-col items-center gap-1 ${
                        extinguisherCollected
                          ? "border-emerald-600 bg-emerald-950/50 text-emerald-300 opacity-80"
                          : "border-amber-500 bg-amber-900/40 hover:bg-amber-800/60 text-white"
                      }`}
                    >
                      <span className="text-xl">🧯</span>
                      <span>{extinguisherCollected ? "Equipped ✓" : "Take Extinguisher"}</span>
                    </button>

                    <button
                      onClick={handleCoverAirway}
                      disabled={airwayCovered}
                      className={`rounded-xl border p-3 text-xs font-bold transition flex flex-col items-center gap-1 ${
                        airwayCovered
                          ? "border-emerald-600 bg-emerald-950/50 text-emerald-300 opacity-80"
                          : "border-blue-500 bg-blue-900/40 hover:bg-blue-800/60 text-white"
                      }`}
                    >
                      <span className="text-xl">😷</span>
                      <span>{airwayCovered ? "Airway Safe ✓" : "Cover Nose & Crouch"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ERROR POPUP BANNER */}
            {wrongChoiceAlert && (
              <div className="absolute top-4 right-4 max-w-sm rounded-xl border border-red-500 bg-red-950/90 p-4 text-xs text-red-200 backdrop-blur shadow-xl animate-bounce">
                <div className="font-bold flex items-center gap-2 text-red-300">
                  <span>⚠️ Unsafe Disaster Move</span>
                </div>
                <p className="mt-1">{wrongChoiceAlert}</p>
              </div>
            )}
          </div>

          {/* BOTTOM TACTICAL ACTION DOCK */}
          <div className="mt-2 grid gap-3 lg:grid-cols-3">
            {/* Action Buttons Panel */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 text-white lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tactical Response Actions
                </span>
                <span className="text-[11px] text-slate-500">
                  Select your next move to protect yourself & evacuate
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={handleSoundAlarm}
                  disabled={alarmTriggered}
                  className={`rounded-lg border p-2.5 text-xs font-semibold transition flex items-center justify-center gap-2 ${
                    alarmTriggered
                      ? "border-emerald-600/50 bg-emerald-950/40 text-emerald-300"
                      : "border-red-600 bg-red-900/50 hover:bg-red-800 text-white"
                  }`}
                >
                  <span>🚨</span>
                  <span>{alarmTriggered ? "Alarm Active ✓" : "Pull Fire Alarm"}</span>
                </button>

                <button
                  onClick={handleCoverAirway}
                  disabled={airwayCovered}
                  className={`rounded-lg border p-2.5 text-xs font-semibold transition flex items-center justify-center gap-2 ${
                    airwayCovered
                      ? "border-emerald-600/50 bg-emerald-950/40 text-emerald-300"
                      : "border-blue-600 bg-blue-900/50 hover:bg-blue-800 text-white"
                  }`}
                >
                  <span>😷</span>
                  <span>{airwayCovered ? "Airway Covered ✓" : "Crouch & Cover"}</span>
                </button>

                <button
                  onClick={handleGrabExtinguisher}
                  disabled={extinguisherCollected}
                  className={`rounded-lg border p-2.5 text-xs font-semibold transition flex items-center justify-center gap-2 ${
                    extinguisherCollected
                      ? "border-emerald-600/50 bg-emerald-950/40 text-emerald-300"
                      : "border-amber-600 bg-amber-900/50 hover:bg-amber-800 text-white"
                  }`}
                >
                  <span>🧯</span>
                  <span>{extinguisherCollected ? "Extinguisher Ready" : "Grab Extinguisher"}</span>
                </button>

                <button
                  onClick={() => handleRouteChoice("elevator")}
                  className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 p-2.5 text-xs font-semibold text-slate-300 transition flex items-center justify-center gap-2"
                >
                  <span>🛗</span>
                  <span>Take Elevator</span>
                </button>
              </div>

              {/* Primary Evacuation Route Trigger */}
              <div className="mt-3 flex items-center gap-2 border-t border-slate-800/80 pt-3">
                <button
                  onClick={() => handleRouteChoice("stairwell")}
                  className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow transition flex items-center justify-center gap-2"
                >
                  <span>🏃</span>
                  <span>Evacuate via Fire Exit Stairwell B $\rightarrow$ Central Lawn</span>
                </button>
              </div>
            </div>

            {/* Tactical Live Event Log */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Telemetry Feed
                </span>
                <span className="text-[10px] text-slate-500">Live logs</span>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono h-24 overflow-y-auto">
                {logMessages.map((log, idx) => (
                  <div
                    key={idx}
                    className={`rounded px-2 py-1 ${
                      log.type === "danger"
                        ? "bg-red-950/60 text-red-300 border border-red-900/50"
                        : log.type === "success"
                        ? "bg-emerald-950/60 text-emerald-300 border border-emerald-900/50"
                        : "bg-slate-800/60 text-slate-300"
                    }`}
                  >
                    <span className="text-slate-500 text-[10px]">[{log.time}]</span> {log.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DRILL COMPLETED / GAME OVER MODAL */}
          {gameOver && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
              <div className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl text-center">
                <div className="text-4xl">{won ? "🏆" : "⚠️"}</div>
                <h3 className="mt-2 text-2xl font-bold">
                  {won ? "Evacuation Successful!" : "Drill Terminated"}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {won
                    ? "You successfully reached the SVVV Central Assembly Ground within safe parameters."
                    : "Evacuation protocol failed due to critical hazards or expired time."}
                </p>

                {/* Score and Stats */}
                <div className="my-6 grid grid-cols-3 gap-2 border-y border-slate-800 py-4">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Score</div>
                    <div className="text-xl font-bold text-blue-400">{score} pts</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Remaining</div>
                    <div className="text-xl font-bold text-amber-400">{timeLeft}s</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Grade</div>
                    <div
                      className={`text-xl font-bold ${
                        score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400"
                      }`}
                    >
                      {score >= 80 ? "Grade A" : score >= 50 ? "Grade B" : "Grade C"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={startGame}
                    className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-semibold text-white transition"
                  >
                    Retry Simulation
                  </button>
                  <button
                    onClick={() => setGameStarted(false)}
                    className="flex-1 rounded-xl border border-slate-700 hover:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 transition"
                  >
                    Select Another Scenario
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
