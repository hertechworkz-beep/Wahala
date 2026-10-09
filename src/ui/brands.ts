import type { BrandBooking, BrandInventory } from '../engine/types';
import { lagos } from '../content/browser';

// Brand slots live inside the story, never as banners over a scene (Brand inventory).
// Brands only appear in positive or neutral scenes; empty slots advertise themselves.

const shown: Record<string, number> = {};

export interface SlotFill {
  sponsored: boolean;
  text: string;
  sub?: string;
  link: string;
  booking?: BrandBooking;
}

export function resetBrandCaps() {
  for (const k of Object.keys(shown)) delete shown[k];
}

export function fillSlot(slotId: string, mood: 'positive' | 'neutral' | 'negative', inv: BrandInventory = lagos.brands): SlotFill | null {
  if (mood === 'negative') return null;
  const slot = inv.slots.find((s) => s.id === slotId);
  if (!slot || !(slot.scene_tone_allowed ?? ['positive', 'neutral']).includes(mood)) return null;
  const now = new Date().toISOString().slice(0, 10);
  const booking = inv.bookings.find((b) => b.slot === slotId && b.starts <= now && b.ends >= now);
  if (booking) {
    if ((shown[slotId] ?? 0) >= slot.cap_per_run) return null;
    shown[slotId] = (shown[slotId] ?? 0) + 1;
    return { sponsored: true, text: booking.creative.text ?? booking.brand, sub: booking.brand, link: booking.creative.link ?? '#', booking };
  }
  return { sponsored: false, text: HOUSE[slotId] ?? inv.house_ad, sub: 'Advertise on Wahala', link: '/advertise' };
}

const HOUSE: Record<string, string> = {
  bridge_billboard: 'YOUR BRAND ON THIS BILLBOARD',
  street_poster: 'YOUR POSTER HERE',
  club_playlist: 'Your song could be playing here',
  date_venue_host: 'Your restaurant could host this date',
  glow_spots: 'Your salon or clinic here',
  gifts: 'Your gift brand here',
  phone_apps: 'Your fintech here',
  parlour_post: 'Your brand in the Parlour',
  verdict_strip: 'Breakup brunch on [your brand]',
};
