import Sidebar from './ui/Sidebar.jsx';
import Chat from './ui/Chat.jsx';
import OwnPanel from './ui/OwnPanel.jsx';
import GoPanel, { GapPanel } from './ui/GoPanel.jsx';
import { renderVals } from './view/chat.js';
import { useApp } from './hooks/useApp.js';

export default function App() {
  const app = useApp();
  const S = app.state, set = app.chat.set;
  const V = renderVals(app);
  const panel = V.hasOwn && !V.isLearnings ? <OwnPanel V={V} /> : V.goPanel && !V.isLearnings ? (V.goPanel.isGapCheck ? <GapPanel m={V.goPanel} /> : <GoPanel m={V.goPanel} />) : null;
  return (
    <>
    <div data-role="app" className={`flex h-[100vh] phone:h-dvh overflow-hidden ${(S.navOpen ? 'nav-open ' : '') + (panel ? 'with-sheet' : '')}`}>

    <Sidebar V={V} />
    {!!S.navOpen && <div className="hidden phone:block fixed inset-0 z-[55] bg-[rgba(31,29,26,.35)]" onClick={() => set({ navOpen: false })}></div>}

    <Chat V={V} />

    {/* On a phone the panel is a sheet over the chat (sheet.css); on a wide screen the wrapper doesn't exist for layout. */}
    {!!panel && (
      <div className={'sheet' + (S.sheetMin ? ' min' : '')}>
        {panel}
        <button className="hidden phone:flex absolute top-[13px] right-14 z-[2] w-9.5 h-9.5 rounded-[10px] border-none bg-transparent items-center justify-center text-[18px] text-muted" data-role="sheet-toggle" onClick={() => set(s => ({ sheetMin: !s.sheetMin }))} aria-label={S.sheetMin ? 'Open the panel' : 'Tuck the panel away to read the chat'}>{S.sheetMin ? '⌃' : '⌄'}</button>
      </div>
    )}
    </div>
    </>
  );
}
