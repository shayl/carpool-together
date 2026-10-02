import { createRoot } from "react-dom/client";
import { PullToRefresh, RefreshFeedback, ScheduleRefreshButton } from "../../src/components/pull-to-refresh";
import { LanguageProvider } from "../../src/lib/i18n";

declare global {
  interface Window {
    refreshHarness: {
      calls: number;
      resolve: () => void;
      reject: () => void;
      block: (blocked: boolean) => void;
      unmount: () => void;
    };
  }
}

let resolveRefresh: (() => void) | undefined;
let rejectRefresh: ((error: Error) => void) | undefined;
const root = createRoot(document.getElementById("harness")!);

async function refresh() {
  window.refreshHarness.calls += 1;
  await new Promise<void>((resolve, reject) => {
    resolveRefresh = resolve;
    rejectRefresh = reject;
  });
}

function Harness({ blocked = false }: { blocked?: boolean }) {
  return <LanguageProvider>
    <PullToRefresh onRefresh={refresh} blocked={blocked}>
      <main>
        <div id="gesture-zone" style={{ minHeight: 220 }}>Touch surface</div>
        <ScheduleRefreshButton />
        <RefreshFeedback />
        <input aria-label="Input" />
        <textarea aria-label="Text area" />
        <select aria-label="Select"><option>Option</option></select>
        <div contentEditable suppressContentEditableWarning>Editable</div>
        <form data-dirty="false"><p>Plans</p></form>
        <div id="submission" data-submitting="false" />
        <dialog><input aria-label="Dialog input" /></dialog>
        <div id="scroll-panel" style={{ overflowY: "auto", height: 60 }}>
          <div style={{ height: 300 }}>Scrollable panel</div>
        </div>
        <div style={{ height: 1200 }} />
      </main>
    </PullToRefresh>
  </LanguageProvider>;
}

window.refreshHarness = {
  calls: 0,
  resolve: () => resolveRefresh?.(),
  reject: () => rejectRefresh?.(new Error("Could not refresh the schedule. Try again.")),
  block: (blocked) => root.render(<Harness blocked={blocked} />),
  unmount: () => root.unmount(),
};
root.render(<Harness />);
