# Wahala 3D engine

A small, reusable game engine on top of Three.js. Everything a scene contains (people, places,
furniture, lines, who sits where) is configuration. The code knows how to walk, sit, hold, drink,
talk, react and find a route; content tells it what to do.

## Systems

| System | File | What it does |
|---|---|---|
| Engine core | `src/three/engine.ts` | Phone-tuned renderer, follow camera you can drag, taps on the world, fixed-step capture for recordings |
| Character | `src/three/character.ts` | One controller for every rig (Rocketbox Biped, Mixamo/Meshy, MakeHuman). Walks at the clip's measured speed (no foot sliding), follows routes, sits in a chair or slides in at a table, stands, carries a bag in the hand, holds a glass with a real grip and sips, gestures over the legs (upper/lower body layers), talks seated or standing |
| Face | `character.ts` (`express`, `drive`) | ARKit blendshapes (52) and visemes (15): blinking, lip movement while speaking, expressions `smile`, `flirty`, `angry`, `sad`, `surprised`. Any avatar exported with ARKit shapes works, including future MetaPerson/Meshy faces |
| People | `src/three/cast.ts`, `people.ts` | The cast as data: model, animation library, voice. Avatars on the same skeleton share one animation library |
| Navigation | `src/three/nav.ts` | Recast/Detour navmesh (the library Unity and Unreal use), built automatically from each venue's floor and furniture. People route round tables and chairs |
| Venues | `src/three/venue.ts`, `venues/*.ts` | A venue config (room, mood, props, spots) becomes a scene, seats with their places at the table, obstacles for the navmesh, and named spots |
| Props | `src/three/props.ts` | Furniture and objects made in code: tables, dining chairs, armchair, bar, stools, candle, glass, handbag, plants, pendant lamps, doors, speaker |
| Scenes | `src/three/scenes/*.ts`, `dateStage.ts` | A date scene config (venue, player, date, extras, line pools) run by the date director: choosing a table, the date arriving and greeting, the waiter serving, toasts, reactions when you leave or bother other diners |
| Voice | `src/three/voice.ts` | A recorded clip at `public/audio/voices/<who>/<id>.mp3` always wins and drives the mouth from its loudness; until recordings arrive, the phone's speech engine stands in |
| Checks | `src/three/scenes/validate.ts` | Every name a scene uses must exist; runs in `npm run validate` and the tests |

## Adding content

- **A person:** add the Rocketbox avatar to `PEOPLE` in `tools/characters/build_rocketbox_people.sh`,
  run it, add an entry to `src/three/cast.ts`. They walk, sit, drink, talk and emote immediately.
  A Meshy or MetaPerson model with a Mixamo skeleton plugs in the same way (`chief` is one).
- **A venue:** write a `VenueConfig` (see `venues/restaurant.ts`): room size, mood, props with
  positions, named spots. Tables bring their own chairs, places, plates and candles.
- **A date:** write a `DateScene` (see `scenes/firstDate.ts`): venue, who the date is, where the
  extras sit, the waiter's rounds, and line pools for each moment. Lines name their voice clip id.

## Asset pipelines

- `tools/characters/build_rocketbox_people.sh`: Rocketbox avatars with face shapes, and shared
  animation libraries (MIT).
- `tools/characters/build_chief_meshy.sh`: the approved Meshy Chief with Rocketbox clips
  retargeted onto his Mixamo skeleton.
- `tools/meshy/meshy.mjs` with `tools/meshy/jobs/*.json`: Meshy API jobs (text-to-3D, image-to-3D,
  auto-rig, animations), one JSON file per asset. Needs `MESHY_API_KEY` and `api.meshy.ai` allowed.

## Multiplayer: Colyseus

For real players moving round the same venue together, the engine will use **Colyseus**
(open-source, MIT, Node.js):

- **Authoritative rooms with automatic state sync.** A venue becomes a room; positions, seats,
  held objects and relationship events live in a typed schema that Colyseus delta-encodes and sends
  to every phone. Cheating on stats or seats isn't possible from the client.
- **TypeScript on both ends.** The server can import the same venue configs, cast and deterministic
  story engine the client uses, so rules aren't written twice.
- **Browser-first client.** A small JS SDK over WebSockets that works in mobile Safari and Chrome,
  with matchmaking and reconnection built in.
- **No lock-in.** Self-host on any Node host, or use their managed cloud; scale out later with Redis.

Considered and not chosen: Photon (proprietary, priced per concurrent user, Unity-first), Nakama
(strong social features but a Go server with heavier operations; can be added later for friends,
chat and leaderboards), PartyKit/Cloudflare (good for presence, but not a game server with rooms
and authoritative state). Voice chat stays on LiveKit, as planned.

## Licences

Rocketbox avatars and animations: MIT (Microsoft). recast-navigation: MIT. Three.js: MIT.
Chief: our Meshy model (paid plan). Props: made in code.
