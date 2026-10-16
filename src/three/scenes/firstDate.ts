import type { VenueConfig } from '../venue';
import { restaurant } from '../venues/restaurant';

// A date scene is configuration: where it happens, who is there and what they say. The date
// director (dateStage.ts) runs any scene written in this shape.

export interface Line {
  id: string; // voice clip id: public/audio/voices/<who>/<id>.mp3 replaces the stand-in voice
  text: string;
}
export type Extra = { who: string; seat: string; habit?: 'chat' | 'phone' | 'quiet' } | { who: string; patrol: string[] };

export interface DateScene {
  id: string;
  venue: VenueConfig;
  player: { who: string; start: string; bag?: string };
  date: { who: string; voiceKey: string; enterFrom: string; delay: number };
  extras: Extra[];
  /** Line pools by moment; a random line is picked each time. */
  lines: {
    arrive: Line[];
    smalltalk: Line[];
    toast: Line[];
    leftAlone: Line[];
    welcomeBack: Line[];
    playerReply: Line[];
    waiterServe: Line[];
    waiterTapped: Line[];
    seatTaken: Line[];
    dinerTapped: Line[];
  };
}

export const firstDate: DateScene = {
  id: 'first_date_chief',
  venue: restaurant,
  player: { who: 'player_f', start: 'entrance', bag: '#b3202a' },
  date: { who: 'chief', voiceKey: 'chief', enterFrom: 'entrance', delay: 3 },
  extras: [
    { who: 'diner_m1', seat: 't1.a', habit: 'chat' },
    { who: 'diner_f1', seat: 't1.b', habit: 'chat' },
    { who: 'diner_m2', seat: 't6.b', habit: 'phone' },
    { who: 'waiter', patrol: ['kitchen', 'bar', 'host_stand'] },
  ],
  lines: {
    arrive: [
      { id: 'chief_arrive_1', text: 'Ah! You chose well. And you look wonderful.' },
      { id: 'chief_arrive_2', text: 'Good evening, my dear. I hope I did not keep you.' },
    ],
    smalltalk: [
      { id: 'chief_small_1', text: 'You know, I don’t usually come out on a Monday. But for you…' },
      { id: 'chief_small_2', text: 'This place? I know the owner. Order anything.' },
      { id: 'chief_small_3', text: 'Tell me about yourself. Not the CV version.' },
      { id: 'chief_small_4', text: 'My driver says Third Mainland was terrible tonight.' },
    ],
    toast: [
      { id: 'chief_toast', text: 'To new things. And to beautiful company.' },
      { id: 'chief_toast_2', text: 'Cheers. To a good evening.' },
    ],
    leftAlone: [
      { id: 'chief_left_1', text: 'Ehn? You’re leaving me here?' },
      { id: 'chief_left_2', text: 'Hmm. Is it something I said?' },
    ],
    welcomeBack: [{ id: 'chief_back_1', text: 'Ah, you came back. Good.' }],
    playerReply: [
      { id: 'player_reply_1', text: 'Haha. Go on.' },
      { id: 'player_reply_2', text: 'Really? Tell me more.' },
      { id: 'player_reply_3', text: 'Hmm. Interesting.' },
    ],
    waiterServe: [{ id: 'waiter_serve', text: 'Good evening. Your wine, madam. Sir.' }],
    waiterTapped: [
      { id: 'waiter_tap_1', text: 'Right away, madam.' },
      { id: 'waiter_tap_2', text: 'One moment, please.' },
    ],
    seatTaken: [
      { id: 'diner_taken_1', text: 'Sorry, this seat is taken.' },
      { id: 'diner_taken_2', text: 'Excuse me? We’re sitting here.' },
    ],
    dinerTapped: [
      { id: 'diner_tap_1', text: 'Good evening.' },
      { id: 'diner_tap_2', text: 'Can I help you?' },
    ],
  },
};
