"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { catalogLabel } from "../../lib/preferences";
import Photo from "./Photo";
import { EmptyState, Notice } from "./ui";

/** The user's saved (favorited) styles, loaded from MongoDB via /api/favorites. */
export default function SavedStyles() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/favorites", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((data) => setItems(data.favorites || []))
      .catch(() => setError("We couldn't load your saved styles."));
  }, []);

  async function remove(itemId) {
    const previous = items;
    setItems(items.filter((item) => item.item_id !== itemId));
    const response = await fetch(`/api/favorites/${encodeURIComponent(itemId)}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { setItems(previous); setError("We couldn't remove that style. Please try again."); }
  }

  if (error) return <Notice>{error}</Notice>;
  if (!items) return <p className="hint" role="status">Loading your saved styles…</p>;
  if (!items.length) return <EmptyState icon="heart" title="No saved styles yet" action={{ href: "/dashboard", label: "Explore your analyses" }}>Tap the heart on any clothing, hair or eyewear idea to keep it here.</EmptyState>;
  return (
    <ul className="saved-styles">{items.map((item) => (
      <li key={item.item_id}>
        <span className="saved-thumb"><Photo src={item.photo} alt={item.title} category={item.category} /></span>
        <span><strong>{item.title}</strong><small>{catalogLabel(item.catalog)} · {item.module === "body" ? "Body" : "Face"}</small></span>
        {item.result_id && <Link className="text-link" href={`/results/${item.module === "body" ? "body-shape" : "face-shape"}/${item.result_id}`}>Open</Link>}
        <button className="link-button" type="button" onClick={() => remove(item.item_id)} aria-label={`Remove ${item.title}`}>Remove</button>
      </li>
    ))}</ul>
  );
}
