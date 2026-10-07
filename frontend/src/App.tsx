import { useCallback, useEffect, useMemo, useState } from "react";
import { useRaceStore } from "./store/useRaceStore.js";
import { useSettings } from "./hooks/useSettings.js";
import { useIsCompact, useIsMobile } from "./hooks/useMediaQuery.js";
import { useDocumentPiP } from "./hooks/useDocumentPiP.js";
import { ErrorBoundary } from "./components/layout/ErrorBoundary.js";
import { TopBar } from "./components/layout/TopBar.js";
import { TrackMap } from "./components/TrackMap/TrackMap.js";
import { TimingTower } from "./components/Leaderboard/TimingTower.js";
import { TelemetryPanel } from "./components/TelemetryPanel/TelemetryPanel.js";
import { RaceControlFeed } from "./components/RaceControl/RaceControlFeed.js";
import { WeatherBar } from "./components/TimingPanel/WeatherBar.js";
import { ReplayScrubber } from "./components/Replay/ReplayScrubber.js";
import { SettingsSheet } from "./components/UI/SettingsSheet.js";
import { WidgetView } from "./components/Widget/WidgetView.js";
import { socketService } from "./services/socket.js";

const GRID_AREAS = `
  "top    top    top"
  "tower  stage  right"
  "scrub  scrub  scrub"`;

export default function App() {
  const connect = useRaceStore((s) => s.connect);
  const leaderboard = useRaceStore((s) => s.leaderboard);
  const selectDriver = useRaceStore((s) => s.selectDriver);
  const selected = useRaceStore((s) => s.selectedDriver);
  const replay = useRaceStore((s) => s.replay);

  // Subscribing field by field keeps an unrelated settings change from re-rendering the
  // whole dashboard on every toggle.
  const showLabels = useSettings((s) => s.showLabels);
  const showTrails = useSettings((s) => s.showTrails);
  const showSectors = useSettings((s) => s.showSectors);
  const showCorners = useSettings((s) => s.showCorners);
  const rotation = useSettings((s) => s.rotation);

  const isCompact = useIsCompact();
  const isMobile = useIsMobile();
  const isDesktop = !isCompact && !isMobile;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [widget, setWidget] = useState(false);
  const pip = useDocumentPiP();

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (selected === null && leaderboard[0]) {
      selectDriver(leaderboard[0].n);
    }
  }, [leaderboard, selected, selectDriver]);

  const enterWidget = useCallback(async () => {
    if (pip.supported) {
      const win = await pip.open({ width: 408, height: 492 });
      if (win) {
        setWidget(true);
        return;
      }
    }
    setWidget(true);
  }, [pip]);

  const exitWidget = useCallback(() => {
    if (pip.active) {
      pip.close();
    }
    setWidget(false);
  }, [pip]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (replay.playing) socketService.pause();
          else socketService.play();
          break;
        case "Escape":
          if (settingsOpen) {
            setSettingsOpen(false);
          } else if (widget) {
            exitWidget();
          }
          break;
        case "m":
        case "M":
          if (widget) exitWidget();
          else void enterWidget();
          break;
        case "ArrowLeft":
        case "ArrowRight": {
          if (replay.durationMs <= 0) break;
          e.preventDefault();
          const step = (e.shiftKey ? 60_000 : 10_000) * (e.key === "ArrowRight" ? 1 : -1);
          const next = Math.round(replay.tMs + step);
          socketService.seek(Math.max(0, Math.min(replay.durationMs, next)));
          break;
        }
        case "ArrowDown":
        case "ArrowUp": {
          if (leaderboard.length === 0) break;
          e.preventDefault();
          const i = leaderboard.findIndex((x) => x.n === selected);
          const step = e.key === "ArrowDown" ? 1 : -1;
          const next = leaderboard[(i + step + leaderboard.length) % leaderboard.length];
          if (next) selectDriver(next.n);
          break;
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    replay.playing,
    replay.tMs,
    replay.durationMs,
    settingsOpen,
    widget,
    leaderboard,
    selected,
    selectDriver,
    enterWidget,
    exitWidget,
  ]);

  const panels = useMemo(
    () => ({
      top: (
        <TopBar
          onOpenSettings={() => setSettingsOpen(true)}
          onEnterWidget={enterWidget}
          widgetSupported={pip.supported}
        />
      ),
      map: (
        <ErrorBoundary label="Track map">
          <TrackMap
            showLabels={showLabels}
            showTrails={showTrails}
            showSectors={showSectors}
            showCorners={showCorners}
            rotation={rotation}
          />
        </ErrorBoundary>
      ),
      tower: (
        <ErrorBoundary label="Timing tower">
          <TimingTower />
        </ErrorBoundary>
      ),
      telemetry: (
        <ErrorBoundary label="Telemetry">
          <TelemetryPanel />
        </ErrorBoundary>
      ),
      raceControl: (limit: number) => (
        <ErrorBoundary label="Race control">
          <RaceControlFeed limit={limit} />
        </ErrorBoundary>
      ),
    }),
    [enterWidget, pip.supported, showLabels, showTrails, showSectors, showCorners, rotation],
  );

  if (widget) {
    return (
      <>
        <WidgetView pipWindow={pip.pipWindow} onRestore={exitWidget} />
        {pip.active && (
          <div className="grid h-screen place-items-center">
            <div className="text-center">
              <div className="label mb-2">Playing in a floating window</div>
              <button
                onClick={exitWidget}
                className="rounded-lg border border-f1-border bg-white/5 px-4 py-2 text-xs font-semibold hover:bg-white/10"
              >
                Return to the dashboard
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Only the desktop layout has room for every panel at once, so it alone uses a
  // fixed-height grid. Narrower viewports stack and scroll: forcing five panels into one
  // screen is what collapsed the map and the timing tower to nothing.
  const dashboard = isDesktop ? (
    <div
      className="grid h-screen grid-cols-[292px_minmax(0,1fr)_318px] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 p-3"
      style={{ gridTemplateAreas: GRID_AREAS }}
    >
      <div style={{ gridArea: "top" }}>{panels.top}</div>

      <div className="min-h-0" style={{ gridArea: "tower" }}>
        {panels.tower}
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-3" style={{ gridArea: "stage" }}>
        <div className="min-h-0 flex-1">{panels.map}</div>
        <WeatherBar />
      </div>

      <div className="flex min-h-0 flex-col gap-3" style={{ gridArea: "right" }}>
        {panels.telemetry}
        <div className="min-h-0 flex-1">{panels.raceControl(16)}</div>
      </div>

      <div style={{ gridArea: "scrub" }}>
        <ReplayScrubber />
      </div>
    </div>
  ) : (
    <div className="flex h-screen flex-col gap-3 p-3">
      <div className="shrink-0">{panels.top}</div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <div className={`shrink-0 ${isMobile ? "h-[260px]" : "h-[340px]"}`}>{panels.map}</div>
        <WeatherBar />
        <div className={`shrink-0 ${isMobile ? "h-[320px]" : "h-[360px]"}`}>{panels.tower}</div>
        <div className={`flex shrink-0 gap-3 ${isMobile ? "flex-col" : "flex-row"}`}>
          <div className={isMobile ? "" : "w-[320px] shrink-0"}>{panels.telemetry}</div>
          <div className={isMobile ? "h-[240px]" : "min-h-[240px] flex-1"}>
            {panels.raceControl(isMobile ? 8 : 12)}
          </div>
        </div>
      </div>

      <div className="shrink-0">
        <ReplayScrubber />
      </div>
    </div>
  );

  return (
    <>
      {dashboard}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
