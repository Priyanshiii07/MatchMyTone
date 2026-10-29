"use client";

import { useState } from "react";
import Icon from "../components/Icon";
import LookGenerator from "./LookGenerator";
import StylistChat from "./StylistChat";

const TABS = [["chat", "Ask your stylist", "sparkle"], ["looks", "Occasion looks", "hanger"]];

export default function StylistStudio({ initialTab, module, question }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div className="stylist-studio">
      <div className="segmented" role="tablist" aria-label="Stylist tools">
        {TABS.map(([id, label, icon]) => <button key={id} id={`stylist-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`stylist-panel-${id}`} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}><Icon name={icon} size={16} />{label}</button>)}
      </div>
      <div id="stylist-panel-chat" role="tabpanel" aria-labelledby="stylist-tab-chat" hidden={tab !== "chat"}><StylistChat module={module} initialQuestion={question} /></div>
      <div id="stylist-panel-looks" role="tabpanel" aria-labelledby="stylist-tab-looks" hidden={tab !== "looks"}><LookGenerator /></div>
    </div>
  );
}
