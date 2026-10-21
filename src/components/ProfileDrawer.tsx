import { useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

interface Props {
  profile: Profile;
  onClose: () => void;
  onProfileUpdate: () => void;
  onLogout: () => void;
}

export default function ProfileDrawer({ profile, onClose, onProfileUpdate, onLogout }: Props) {
  const [bio, setBio] = useState(profile.bio ?? "");
  const [status, setStatus] = useState(profile.status ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        setError("Image must be under 2 MB.");
        return;
      }

      setUploading(true);
      setError(null);

      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const filePath = `${profile.id}/avatar-${Date.now()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(filePath, file, { upsert: true });

        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl + "?t=" + Date.now();

        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", profile.id);

        if (updateErr) throw updateErr;

        setAvatarUrl(publicUrl);
        onProfileUpdate();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        setError(msg);
      } finally {
        setUploading(false);
      }
    },
    [profile.id, onProfileUpdate]
  );

  const handleSaveProfile = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          bio: bio.trim() || null,
          status: status.trim() || null,
        })
        .eq("id", profile.id);

      if (updateErr) throw updateErr;

      onProfileUpdate();
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save profile.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [bio, status, profile.id, onProfileUpdate]);

  const initials = profile.username
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="profile-drawer">
        <div className="drawer-header">
          <h2>Profile</h2>
          <button className="drawer-close" onClick={onClose} aria-label="Close profile">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="drawer-body">
          {/* Avatar section */}
          <div className="drawer-avatar-section">
            <div className="drawer-avatar-wrap" onClick={() => fileInputRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Display picture" className="drawer-avatar-img" />
              ) : (
                <div className="drawer-avatar-placeholder">{initials}</div>
              )}
              <div className="drawer-avatar-overlay">
                {uploading ? "Uploading…" : "Change"}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleAvatarUpload}
              style={{ display: "none" }}
            />
            <p className="drawer-avatar-hint">Click the avatar to upload a new picture (max 2 MB)</p>
          </div>

          {/* Permanent fields */}
          <div className="drawer-field">
            <label>Username</label>
            <div className="drawer-readonly-value">{profile.username}</div>
            <span className="drawer-field-note">Permanent — cannot be changed</span>
          </div>

          <div className="drawer-field">
            <label>Email</label>
            <div className="drawer-readonly-value">{profile.email}</div>
          </div>

          {/* Editable fields */}
          <div className="drawer-field">
            <label htmlFor="status">Status</label>
            <input
              id="status"
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="e.g. Available, Busy, In a meeting…"
              maxLength={100}
            />
          </div>

          <div className="drawer-field">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people a bit about yourself…"
              maxLength={300}
              rows={3}
            />
          </div>

          {error && <div className="drawer-error">{error}</div>}

          <button
            className="drawer-save-btn"
            onClick={handleSaveProfile}
            disabled={saving}
          >
            {saving ? "Saving…" : savedMsg ? "Saved!" : "Save Changes"}
          </button>

          {/* Logout section */}
          <div className="drawer-logout-section">
            <button className="drawer-logout-btn" onClick={onLogout}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout / Switch Account
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
