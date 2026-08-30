import React, { useState } from 'react';
import { Anime, AnimeChannelLink, Channel } from '../types';
import { Plus, Search, Link as LinkIcon, Edit3, Trash2, Send, ExternalLink, Copy, Check, Tv, Film, Calendar, X } from 'lucide-react';
import { formatToISTDisplay } from '../utils/formatter';

interface AnimesViewProps {
  animes: (Anime & { channel_links?: AnimeChannelLink[] })[];
  channels: Channel[];
  onSelectAnimeForPost: (anime: Anime) => void;
  onCreateAnime: (data: { name: string; poster: string; caption: string; channel_links: Record<string, string> }) => Promise<void>;
  onUpdateAnime: (id: string, data: { name: string; poster: string; caption: string }) => Promise<void>;
  onDeleteAnime: (id: string) => Promise<void>;
  onSaveChannelLink: (animeId: string, channelId: string, url: string) => Promise<void>;
  onDeleteChannelLink: (animeId: string, channelId: string) => Promise<void>;
}

export const AnimesView: React.FC<AnimesViewProps> = ({
  animes,
  channels,
  onSelectAnimeForPost,
  onCreateAnime,
  onUpdateAnime,
  onDeleteAnime,
  onSaveChannelLink,
  onDeleteChannelLink,
}) => {
  const [search, setSearch] = useState('');
  const [selectedAnime, setSelectedAnime] = useState<(Anime & { channel_links?: AnimeChannelLink[] }) | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState<{ channelId: string; currentUrl: string } | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);

  // Form states for Add Anime
  const [addName, setAddName] = useState('');
  const [addPoster, setAddPoster] = useState('');
  const [addCaption, setAddCaption] = useState('');
  const [addLinks, setAddLinks] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Edit Anime
  const [editName, setEditName] = useState('');
  const [editPoster, setEditPoster] = useState('');
  const [editCaption, setEditCaption] = useState('');

  // Form state for editing single channel link
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const filteredAnimes = animes.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenAdd = () => {
    setAddName('');
    setAddPoster('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80');
    setAddCaption('⚔️ [Anime Title]\n\n🎭 Genre: Action, Fantasy\n🔊 Audio: Japanese [Eng Sub]\n📺 Quality: 1080p FHD\n\n⚡ Powered by KYAMI Studios\n━━━━━━━━━━━━━━━━━━━━━');
    const initLinks: Record<string, string> = {};
    channels.forEach((c) => {
      initLinks[c.id] = '';
    });
    setAddLinks(initLinks);
    setShowAddModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName || !addPoster || !addCaption) return;
    setIsSubmitting(true);
    try {
      await onCreateAnime({
        name: addName,
        poster: addPoster,
        caption: addCaption,
        channel_links: addLinks,
      });
      setShowAddModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (anime: Anime) => {
    setEditName(anime.name);
    setEditPoster(anime.poster);
    setEditCaption(anime.caption);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnime) return;
    setIsSubmitting(true);
    try {
      await onUpdateAnime(selectedAnime.id, {
        name: editName,
        poster: editPoster,
        caption: editCaption,
      });
      setShowEditModal(false);
      setSelectedAnime((prev) => (prev ? { ...prev, name: editName, poster: editPoster, caption: editCaption } : null));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSingleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnime || !showLinkModal || !newLinkUrl) return;
    setIsSubmitting(true);
    try {
      await onSaveChannelLink(selectedAnime.id, showLinkModal.channelId, newLinkUrl);
      setShowLinkModal(null);
      // Refresh local selected anime links
      const currentLinks = selectedAnime.channel_links || [];
      const updated = currentLinks.filter((l) => l.channel_id !== showLinkModal.channelId);
      updated.push({
        id: `ACL_${Date.now()}`,
        anime_id: selectedAnime.id,
        channel_id: showLinkModal.channelId,
        episode_url: newLinkUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
      });
      setSelectedAnime({ ...selectedAnime, channel_links: updated });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCaption = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Anime Library & Episode Links</h2>
          <p className="text-xs text-stone-400">
            Manage permanent channel links, posters, and immutable captions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search anime or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 w-48 sm:w-64"
            />
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-xl transition-all shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Anime</span>
          </button>
        </div>
      </div>

      {/* Anime Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAnimes.map((anime) => {
          const links = anime.channel_links || [];
          return (
            <div
              key={anime.id}
              onClick={() => setSelectedAnime(anime)}
              className="group rounded-2xl bg-stone-900 border border-stone-800 hover:border-amber-500/40 p-4 cursor-pointer transition-all flex flex-col justify-between space-y-4 hover:shadow-lg hover:shadow-amber-500/5"
            >
              <div className="flex gap-4">
                <div className="w-20 h-28 rounded-xl overflow-hidden bg-stone-950 border border-stone-750 shrink-0 relative">
                  <img
                    src={anime.poster}
                    alt={anime.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                    }}
                  />
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur text-[9px] font-mono text-amber-400 font-bold">
                    {anime.id}
                  </span>
                </div>

                <div className="space-y-2 overflow-hidden flex-1">
                  <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2">
                    {anime.name}
                  </h3>

                  <div className="text-[11px] text-stone-400 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Film className="w-3 h-3 text-emerald-400" />
                      <span>Posts: <strong className="text-stone-200">{anime.episodes_posted}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Tv className="w-3 h-3 text-cyan-400" />
                      <span>Last: <strong className="text-stone-200">{anime.last_posted_episode}</strong></span>
                    </div>
                  </div>

                  {/* Channel Permanent Links Badges */}
                  <div className="pt-1 flex flex-wrap gap-1">
                    {channels.map((ch) => {
                      const hasL = links.some((l) => l.channel_id === ch.id && l.episode_url);
                      return (
                        <span
                          key={ch.id}
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                            hasL
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20'
                              : 'bg-stone-800 text-stone-500 border-stone-700'
                          }`}
                        >
                          {ch.name.split(' ')[0]}: {hasL ? 'Saved' : 'No Link'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between">
                <span className="text-[10px] text-stone-400 font-mono">
                  Added: {formatToISTDisplay(anime.created_at).split('·')[0]}
                </span>
                <span className="text-xs font-semibold text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Dashboard →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAnimes.length === 0 && (
        <div className="text-center py-16 bg-stone-900 border border-stone-800 rounded-2xl p-8 space-y-3">
          <Tv className="w-10 h-10 text-stone-600 mx-auto" />
          <h3 className="text-base font-semibold text-stone-300">No Anime Found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {search ? `No anime matching "${search}"` : 'Your library is empty. Click "Add Anime" to register your first series.'}
          </p>
        </div>
      )}

      {/* ANIME DASHBOARD MODAL */}
      {selectedAnime && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-750 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl space-y-6 p-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-stone-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                    {selectedAnime.id}
                  </span>
                  <h3 className="text-lg font-bold text-white">{selectedAnime.name}</h3>
                </div>
                <p className="text-xs text-stone-400 mt-1 font-mono">
                  Added on {formatToISTDisplay(selectedAnime.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(selectedAnime)}
                  className="p-2 text-stone-400 hover:text-stone-200 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors"
                  title="Edit Anime Details"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    if (confirm(`Delete "${selectedAnime.name}"? This cannot be undone.`)) {
                      await onDeleteAnime(selectedAnime.id);
                      setSelectedAnime(null);
                    }
                  }}
                  className="p-2 text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/40 rounded-lg border border-rose-500/20 transition-colors"
                  title="Delete Anime"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedAnime(null)}
                  className="p-2 text-stone-400 hover:text-white bg-stone-800 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Poster & Stats & Links */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Poster & Quick Post */}
              <div className="md:col-span-4 space-y-4">
                <div className="rounded-xl overflow-hidden bg-stone-950 border border-stone-800 aspect-[3/4] relative">
                  <img
                    src={selectedAnime.poster}
                    alt={selectedAnime.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <button
                  onClick={() => {
                    onSelectAnimeForPost(selectedAnime);
                    setSelectedAnime(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm rounded-xl transition-all shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>📤 Post Episode / Movie</span>
                </button>

                <div className="p-3 bg-stone-850 rounded-xl border border-stone-800 text-xs space-y-2">
                  <div className="flex justify-between text-stone-400">
                    <span>Episodes Posted:</span>
                    <strong className="text-white">{selectedAnime.episodes_posted}</strong>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>Last Released:</span>
                    <strong className="text-amber-400">{selectedAnime.last_posted_episode}</strong>
                  </div>
                </div>
              </div>

              {/* Right Column: Permanent Links & Exact Caption */}
              <div className="md:col-span-8 space-y-5">
                {/* Permanent Channel Links Section */}
                <div className="rounded-xl bg-stone-850 border border-stone-750 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-white">Permanent Channel Episode Links</h4>
                    </div>
                    <span className="text-[10px] text-stone-400">Saved once, reused automatically</span>
                  </div>

                  <div className="space-y-2.5">
                    {channels.map((ch) => {
                      const link = selectedAnime.channel_links?.find((l) => l.channel_id === ch.id);
                      return (
                        <div
                          key={ch.id}
                          className="p-3 rounded-lg bg-stone-900 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 overflow-hidden">
                            <span className="font-semibold text-stone-200">{ch.name}</span>
                            {link && link.episode_url ? (
                              <a
                                href={link.episode_url}
                                target="_blank"
                                rel="noreferrer"
                                className="block font-mono text-[11px] text-amber-400 hover:underline truncate max-w-md"
                              >
                                {link.episode_url}
                              </a>
                            ) : (
                              <p className="text-[11px] text-stone-500 italic">⚠️ No permanent link saved</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() =>
                                setShowLinkModal({
                                  channelId: ch.id,
                                  currentUrl: link?.episode_url || '',
                                })
                              }
                              className="px-2.5 py-1 bg-stone-800 hover:bg-stone-750 text-stone-200 rounded-md font-medium text-[11px] border border-stone-700 transition-colors"
                            >
                              {link?.episode_url ? '✏ Edit' : '➕ Save Link'}
                            </button>
                            {link?.episode_url && (
                              <button
                                onClick={async () => {
                                  if (confirm(`Remove permanent link for ${ch.name}?`)) {
                                    await onDeleteChannelLink(selectedAnime.id, ch.id);
                                    const updated = (selectedAnime.channel_links || []).filter(
                                      (l) => l.channel_id !== ch.id
                                    );
                                    setSelectedAnime({ ...selectedAnime, channel_links: updated });
                                  }
                                }}
                                className="px-2 py-1 text-rose-400 hover:text-rose-300 bg-rose-950/40 rounded-md text-[11px] border border-rose-500/20"
                                title="Remove Link"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Immutable Saved Caption Preview */}
                <div className="rounded-xl bg-stone-850 border border-stone-750 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">Immutable Caption</h4>
                    <button
                      onClick={() => handleCopyCaption(selectedAnime.caption)}
                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium"
                    >
                      {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCaption ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-stone-900 rounded-lg border border-stone-800 text-xs font-mono text-stone-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {selectedAnime.caption}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD ANIME MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-750 rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-white">➕ Add New Anime to CMS</h3>
              <button onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-medium mb-1">Anime Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Elusive Samurai"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">Poster (Image URL or Telegram File ID) *</label>
                <input
                  type="text"
                  required
                  placeholder="https://... or Telegram file_id"
                  value={addPoster}
                  onChange={(e) => setAddPoster(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">Complete Caption (Stored exactly as provided) *</label>
                <textarea
                  required
                  rows={4}
                  value={addCaption}
                  onChange={(e) => setAddCaption(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 border-t border-stone-800 space-y-3">
                <h4 className="text-xs font-bold text-amber-400">Save Initial Permanent Channel Episode Links (Optional)</h4>
                {channels.map((ch) => (
                  <div key={ch.id}>
                    <label className="block text-stone-300 mb-1">{ch.name} Permanent Link</label>
                    <input
                      type="url"
                      placeholder={`https://example.com/${ch.id}/link`}
                      value={addLinks[ch.id] || ''}
                      onChange={(e) => setAddLinks({ ...addLinks, [ch.id]: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-medium hover:bg-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold transition-all"
                >
                  {isSubmitting ? 'Saving...' : 'Save Anime'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ANIME MODAL */}
      {showEditModal && selectedAnime && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-750 rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-white">✏ Edit Anime: {selectedAnime.name}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-medium mb-1">Anime Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">Poster URL / File ID</label>
                <input
                  type="text"
                  required
                  value={editPoster}
                  onChange={(e) => setEditPoster(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">Exact Caption</label>
                <textarea
                  required
                  rows={4}
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-medium hover:bg-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold"
                >
                  {isSubmitting ? 'Updating...' : 'Update Anime'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SINGLE CHANNEL LINK MODAL */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-750 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">🔗 Set Permanent Episode Link</h3>
            <p className="text-xs text-stone-400">
              This URL will be automatically used whenever an episode or movie is posted for this channel.
            </p>

            <form onSubmit={handleSaveSingleLink} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-medium mb-1">Download URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  defaultValue={showLinkModal.currentUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(null)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold"
                >
                  {isSubmitting ? 'Saving...' : 'Save Permanent Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
