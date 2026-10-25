// The left sidebar: new chat, Learnings (with its recall badge), past chats.
import { NAV_ICONS, OwnIcon } from './parts.jsx';
import { NAV } from './styles.js';

export default function Sidebar({ V }) {
  return (
    // On a phone it's a drawer behind ☰ (the phone: classes): choosing anything in it closes it.
    <aside data-role="sidebar" onClickCapture={e => { if (e.target.closest && e.target.closest('button')) V.closeNav(); }} className="w-65 flex-none bg-sidebar border-r border-line flex flex-col py-4 px-3 gap-4.5 overflow-auto phone:fixed phone:inset-y-0 phone:left-0 phone:z-60 phone:w-[min(300px,84vw)] phone:-translate-x-[102%] phone:[transition:translate_.22s_ease] phone:shadow-[0_0_40px_rgba(0,0,0,.18)] phone:in-[.nav-open]:translate-x-0">
      <div className="flex items-center justify-between px-1.5">
        <span className="font-serif text-[23px] tracking-[-.01em]">Claude</span>
        <span className="w-4.5 h-3.5 border-[1.4px] border-muted rounded-[3px]"></span>
      </div>
      <div className="flex bg-line rounded-[10px] p-[3px]">
        <span className="flex-1 text-center bg-surface rounded-lg py-1.5 text-[13.5px] shadow-[0_1px_2px_rgba(0,0,0,.08)]">Chat</span>
        <span title="Not in this prototype" className="flex-1 text-center py-1.5 text-[13.5px] text-muted">Code</span>
      </div>
      <nav className="flex flex-col gap-px">
        <button onClick={V.newChat} className={`${NAV} text-[14px] text-ink bg-transparent hover:bg-wash`}><span className="w-4.5 text-center">+</span>New chat</button>
        <button onClick={V.openLearnings} data-role="nav-learnings" className={`${NAV} text-[14px] text-ink ${V.isLearnings ? 'bg-line' : 'bg-transparent'} hover:bg-wash`}><span className="w-4.5 flex justify-center text-accent"><OwnIcon /></span>Learnings{V.dueCount > 0 ? <span data-role="recall-badge" title={`${V.dueCount} ready to recall`} aria-label={`${V.dueCount} to recall`} className="ml-auto text-[11px] bg-accent text-on-accent rounded-full py-px px-[7px] flex items-center gap-1 whitespace-nowrap flex-none">{V.dueCount} due</span> : V.ownedCount > 0 && <span className="ml-auto text-[11px] bg-accent-soft-2 text-accent-text rounded-full py-px px-[7px]">{V.ownedCount}</span>}</button>
        {['Search', 'Projects', 'Artifacts', 'Customize'].map(l => <span key={l} title="Not in this prototype" className={`${NAV} text-[14px] text-muted cursor-default`}><span className="w-4.5 flex justify-center text-muted">{NAV_ICONS[l]}</span>{l}</span>)}
      </nav>
      <div className="flex flex-col gap-px">
        <div className="text-[13px] text-muted pb-1.5 px-2">Chats</div>
        {V.chatList.map((c, i) => <button key={i} onClick={c.onClick} data-role="past-chat" className={`${NAV} text-[13.5px] text-ink ${c.active ? 'bg-line' : 'bg-transparent'} hover:bg-wash`}><span className="w-4.5 text-center text-faint text-[9px]">○</span><span className="whitespace-nowrap overflow-hidden text-ellipsis">{c.title}</span></button>)}
      </div>
      {/* What you own lives on the Learnings page; the sidebar only signals when something is ready to recall. */}
      <div className="flex-1"></div>
      <div className="flex items-center gap-2.5 pt-3 px-1.5 border-t border-line">
        <span className="w-7 h-7 rounded-full bg-line flex items-center justify-center text-[12px] text-ink-2 flex-none">P</span>
        <span className="text-[12px] text-muted leading-[1.4]">Prototype · Own It or Outsource It</span>
      </div>
    </aside>
  );
}
