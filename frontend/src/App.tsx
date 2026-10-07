import { useCallback, useEffect, useState } from "react";
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

export default function App() {
  const connect = useRaceStore((s) => s.connect);
  const leaderboard = useRaceStore((s) => s.leaderboard);
  const selectDriver = useRaceStore((s) => s.selectDriver);
  const selected = useRaceStore((s) => s.selectedDriver);
  const replay = useRaceStore((s) => s.replay);

  const settings = useSettings();
  const isCompact = useIsCompact();
  const isMobile = useIsMobile();

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
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          replay.playing ? socketService.pause() : socketService.play();
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
          widget ? exitWidget() : void enterWidget();
          break;
        case "ArrowDown":
        case "ArrowUp": {
          e.preventDefault();
          const i = leaderboard.findIndex((x) => x.n === selected);
          const next = leaderboard[(i + (e.key === "ArrowDown" ? 1 : -1) + leaderboard.length) % leaderboard.length];
          if (next) selectDriver(next.n);
          break;
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [replay.playing, settingsOpen, widget, leaderboard, selected, selectDriver, enterWidget, exitWidget]);

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

  return (
    <div
      className={[
        "grid h-screen gap-3 p-3",
        isMobile
          ? "grid-rows-[auto_auto_380px_auto_auto] overflow-y-auto"
          : isCompact
            ? "grid-rows-[auto_minmax(0,1fr)_auto_auto]"
            : "grid-cols-[292px_minmax(0,1fr)_318px] grid-rows-[auto_minmax(0,1fr)_auto]",
      ].join(" ")}
      style={
        isMobile || isCompact
          ? undefined
          : {
              gridTemplateAreas: `
                "top    top    top"
                "tower  stage  right"
                "scrub  scrub  scrub"`,
            }
      }
    >
      <div style={!isMobile && !isCompact ? { gridArea: "top" } : undefined}>
        <TopBar
          onOpenSettings={() => setSettingsOpen(true)}
          onEnterWidget={enterWidget}
          widgetSupported={pip.supported}
        />
      </div>

      {!isMobile && (
        <div className="min-h-0" style={!isCompact ? { gridArea: "tower" } : undefined}>
          <ErrorBoundary label="Timing tower">
            <TimingTower />
          </ErrorBoundary>
        </div>
      )}

      <div
        className="flex min-h-0 min-w-0 flex-col gap-3"
        style={!isMobile && !isCompact ? { gridArea: "stage" } : undefined}
      >
        <ErrorBoundary label="Track map">
          <div className="min-h-0 flex-1">
            <TrackMap
              showLabels={settings.showLabels}
              showTrails={settings.showTrails}
              showSectors={settings.showSectors}
              showCorners={settings.showCorners}
              rotation={settings.rotation}
            />
          </div>
        </ErrorBoundary>
        <WeatherBar />
      </div>

      <div
        className={`flex min-h-0 gap-3 ${isCompact && !isMobile ? "flex-row" : "flex-col"}`}
        style={!isMobile && !isCompact ? { gridArea: "right" } : undefined}
      >
        <ErrorBoundary label="Telemetry">
          <div className={isCompact && !isMobile ? "flex-1" : ""}>
            <TelemetryPanel />
          </div>
        </ErrorBoundary>
        <ErrorBoundary label="Race control">
          <div className="min-h-0 flex-1">
            <RaceControlFeed limit={isCompact ? 8 : 16} />
          </div>
        </ErrorBoundary>
      </div>

      {isMobile && (
        <div className="h-[340px] min-h-0">
          <ErrorBoundary label="Timing tower">
            <TimingTower />
          </ErrorBoundary>
        </div>
      )}

      <div style={!isMobile && !isCompact ? { gridArea: "scrub" } : undefined}>
        <ReplayScrubber />
      </div>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
