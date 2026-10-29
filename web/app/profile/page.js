"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackButton from "../components/BackButton";
import Icon from "../components/Icon";
import PageShell from "../components/PageShell";
import SavedStyles from "../components/SavedStyles";
import { Notice, SkeletonCards } from "../components/ui";
import { PREFERENCE_FIELDS, isActivePreference, optionLabel } from "../../lib/preferences";

const GENDERS = { female: "Female", male: "Male", other: "Other" };

function preferenceSummary(field, value) {
  if (Array.isArray(value)) return value.filter((item) => isActivePreference(field, item)).map((item) => optionLabel(field, item)).join(", ");
  return optionLabel(field, value);
}

function Detail({ label, value }) {
  return <div className="detail-row"><dt>{label}</dt><dd>{value || <span className="muted-value">Not added yet</span>}</dd></div>;
}

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/users/profile", { cache: "no-store" })
      .then((response) => {
        if (response.status === 401) { window.location.assign("/login?next=/profile"); return null; }
        return response.ok ? response.json() : Promise.reject(new Error());
      })
      .then((data) => data && setUser(data.user))
      .catch(() => setError(true));
  }, []);
  const initials = (user?.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  const incomplete = user && (!user.phone || !user.dob);
  return (
    <PageShell width="narrow" className="module-profile">
      <div className="page-toolbar"><BackButton fallback="/dashboard" /></div>
      <header className="page-intro reveal"><p className="eyebrow">Your profile</p><h1>Your <em>details.</em></h1></header>
      {error && <Notice>We couldn&apos;t load your profile just now. Please refresh the page.</Notice>}
      {!user && !error && <SkeletonCards count={2} />}
      {user && (
        <div className="profile-layout reveal">
          <section className="profile-card profile-identity">
            <span className="avatar" aria-hidden="true">{initials || <Icon name="user" size={28} />}</span>
            <div><h2>{user.name}</h2><p>{user.email}</p></div>
            <Link className="btn btn-primary" href="/profile/edit"><Icon name="edit" />Edit profile</Link>
          </section>
          {incomplete && <Notice tone="info" action={<Link className="btn btn-quiet btn-small" href="/profile/edit">Complete profile</Link>}>Add your phone and date of birth to complete your profile.</Notice>}
          <section className="profile-card" aria-labelledby="account-title">
            <h3 id="account-title">Account</h3>
            <dl><Detail label="Name" value={user.name} /><Detail label="Email" value={user.email} /></dl>
          </section>
          <section className="profile-card" aria-labelledby="personal-title">
            <h3 id="personal-title">Personal details</h3>
            <dl><Detail label="Phone" value={user.phone} /><Detail label="Gender" value={GENDERS[user.gender] || user.gender} /><Detail label="Date of birth" value={user.dob} /><Detail label="Age" value={user.age != null ? String(user.age) : ""} /></dl>
          </section>
          <section className="profile-card" aria-labelledby="style-title">
            <div className="card-heading"><h3 id="style-title">Style preferences</h3><Link className="text-link" href="/profile/edit#style-preferences">Edit</Link></div>
            {Object.entries(user.style_preferences || {}).some(([field, value]) => isActivePreference(field, value)) ? (
              <dl>{Object.entries(user.style_preferences).filter(([field, value]) => isActivePreference(field, value)).map(([field, value]) => <Detail key={field} label={PREFERENCE_FIELDS[field].label} value={preferenceSummary(field, value)} />)}</dl>
            ) : (
              <p className="muted-value">Not set yet. Choose the styling you&apos;d like — men&apos;s, women&apos;s or unisex — so every analysis shows ideas that suit you.</p>
            )}
          </section>
          <section className="profile-card" aria-labelledby="saved-title">
            <h3 id="saved-title">Saved styles</h3>
            <SavedStyles />
          </section>
        </div>
      )}
    </PageShell>
  );
}
