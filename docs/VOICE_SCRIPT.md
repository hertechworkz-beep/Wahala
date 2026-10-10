# Voice script: 3D proof scene

Short lines for the apartment, the ride and the restaurant. Real voices replace the placeholder speech one file at a time; anything not yet recorded falls back to the phone's speech.

## How to record

- Use any phone voice-memo app, in a quiet room with soft furnishings (a bedroom is ideal), about a hand's width from the mouth.
- Record one file per line and name it with the line's ID, e.g. `chief_greet.m4a`. Any format is fine (m4a, mp3, wav).
- Leave half a second of silence before and after each line.
- Record each line two or three times, in different moods, and number the takes, e.g. `chief_greet_2.m4a`. I'll pick the best take.
- Nigerian English, natural pace. Pidgin where marked. These are guides, not scripts to read stiffly: say it the way the character would.

## Chief Emeka (59, wealthy Igbo businessman; warm, unhurried, used to being obeyed)

| ID | Where | Line | Direction |
| --- | --- | --- | --- |
| `chief_greet` | Walks up to your table | "Ah-ah! So you came. Good evening, my dear." | Delighted, big voice, arms open |
| `chief_compliment` | Standing by the table | "Look at you. You dressed for me, eh?" | Pleased, a slow look up and down |
| `chief_sit` | As he sits | "Sit, sit. Let us enjoy ourselves." | Settling in, relaxed |
| `chief_order` | To the waiter | "Bring the red wine. The good one, not the one you give tourists." | Commanding, a little playful |
| `chief_small_talk` | Seated | "You know, I don't usually come out on a Monday. But for you..." | Smooth, charming |
| `chief_toast` | Raising his glass | "To new things. And to beautiful company." | Warm, holding eye contact |
| `chief_laugh` | After the clink | (a short, rich laugh) | Genuine, from the belly |
| `chief_phone` | His phone buzzes | "Hmm. Business. It can wait." | Brief, slightly guarded |

## Bestie (player's best friend; loud, loving, suspicious of every man)

| ID | Where | Line | Direction |
| --- | --- | --- | --- |
| `bestie_call` | Phone rings in the apartment | "Babe! Are you ready? Which one are you wearing?" | Excited, fast |
| `bestie_warn` | On the call | "Fifty-nine years and a tinted Prado. Somebody's husband energy, I'm just saying." | Teasing, half-serious |
| `bestie_bye` | End of call | "Call me at ten o'clock. If you don't pick, I'm coming." | Firm, protective |

## Musa (Chief's driver, 40s, polite, calm)

| ID | Where | Line | Direction |
| --- | --- | --- | --- |
| `musa_arrive` | Car pulls up | "Good evening, Madam. Oga is waiting for you." | Respectful (record "Sir" too as `musa_arrive_sir`) |
| `musa_bridge` | On the Link Bridge | "The bridge is free tonight. God is working." | Easy-going, a small laugh |

## The player (optional; record female and male versions if you can)

| ID | Where | Line |
| --- | --- | --- |
| `you_hello` | Chief arrives | "Good evening, Chief." |
| `you_bestie` | Answering the call | "I'm almost ready, I'm almost ready!" |
| `you_toast` | The toast | "To new things." |

Female files: `you_f_hello` and so on. Male files: `you_m_hello` and so on.

## Where they go

Upload the files here. I'll trim, level and compress them for phones, and place them in `public/audio/voices/<character>/<id>.mp3`.
